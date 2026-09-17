param([switch]$Watch)
$ErrorActionPreference='Stop'
$productionRoot='C:\do-wt\melisa-production-20260918'
$apiRoot=Join-Path $productionRoot 'apps\api'
$privateRoot=Join-Path $env:LOCALAPPDATA 'MelisaERPServer\production-switch-20260918'
$privateConfig=Join-Path $privateRoot 'runtime-private.json'
$webRoot='C:\do-wt\melisa-pilot-20260913\apps\web-admin\dist-operation-links-candidate-20260916'
$node=(Get-Command node.exe -ErrorAction Stop).Source
if(-not (Test-Path -LiteralPath $privateConfig -PathType Leaf)){throw 'Production private configuration missing'}
if(-not (Test-Path -LiteralPath (Join-Path $webRoot 'index.html') -PathType Leaf)){throw 'Production web build missing'}
function Tokens([string]$line){@([regex]::Matches($line,'"[^"]*"|[^\s"]+')|ForEach-Object{$_.Value.Trim('"')})}
function IsExpected([int]$port,[string]$script,[string[]]$arguments){
  $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object{$_.LocalPort -eq $port})
  if($listeners.Count -eq 0){return $false}
  $owners=@($listeners|Select-Object -ExpandProperty OwningProcess -Unique)
  if($owners.Count -ne 1){throw "Port $port has unexpected owners"}
  $process=Get-CimInstance Win32_Process -Filter "ProcessId=$($owners[0])"
  $actual=@(Tokens ([string]$process.CommandLine));$expected=@($node,$script)+$arguments
  if($actual.Count -ne $expected.Count){throw "Port $port process differs from production runtime"}
  for($i=0;$i -lt $expected.Count;$i++){if(-not [StringComparer]::OrdinalIgnoreCase.Equals($actual[$i],$expected[$i])){throw "Port $port process differs from production runtime"}}
  return $true
}
function Ensure([int]$port,[string]$script,[string]$log,[string[]]$arguments){
  if(IsExpected $port $script $arguments){return}
  $argList=@($script)+$arguments|ForEach-Object{'"'+$_+'"'}
  Start-Process -FilePath $node -ArgumentList $argList -WorkingDirectory $apiRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $privateRoot ($log+'.stdout.log')) -RedirectStandardError (Join-Path $privateRoot ($log+'.stderr.log'))|Out-Null
}
$launches=@(
  @{port=4114;script=(Join-Path $apiRoot 'start-production-erp.mjs');log='erp-api';arguments=@($privateConfig)},
  @{port=4116;script=(Join-Path $apiRoot 'start-production-native.mjs');log='native-api';arguments=@($privateConfig)},
  @{port=5188;script=(Join-Path $apiRoot 'start-production-web.mjs');log='web';arguments=@($webRoot)}
)
do{
  foreach($x in $launches){IsExpected $x.port $x.script $x.arguments|Out-Null}
  foreach($x in $launches){Ensure $x.port $x.script $x.log $x.arguments}
  if($Watch){Start-Sleep -Seconds 15}
}while($Watch)
