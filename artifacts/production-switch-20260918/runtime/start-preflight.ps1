$ErrorActionPreference='Stop'
$private=Join-Path $env:LOCALAPPDATA 'MelisaERPServer\production-switch-20260918'
$base=Get-Content -LiteralPath (Join-Path $private 'runtime-private.json') -Raw|ConvertFrom-Json
$base.erpPort=4244
$base.nativePort=4246
$preflight=Join-Path $private 'runtime-preflight.json'
$base|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $preflight -Encoding utf8NoBOM
$grantUser="$($env:USERNAME):F"
& icacls.exe $preflight '/inheritance:r' '/grant:r' $grantUser 'SYSTEM:F'|Out-Null
if($LASTEXITCODE -ne 0){throw 'PREFLIGHT_ACL_FAILED'}
$api='C:\do-wt\melisa-production-20260918\apps\api'
$node=(Get-Command node.exe).Source
$erp=Start-Process -FilePath $node -ArgumentList @('"'+(Join-Path $api 'start-production-erp.mjs')+'"','"'+$preflight+'"') -WorkingDirectory $api -WindowStyle Hidden -RedirectStandardOutput (Join-Path $private 'preflight-erp.stdout.log') -RedirectStandardError (Join-Path $private 'preflight-erp.stderr.log') -PassThru
$native=Start-Process -FilePath $node -ArgumentList @('"'+(Join-Path $api 'start-production-native.mjs')+'"','"'+$preflight+'"') -WorkingDirectory $api -WindowStyle Hidden -RedirectStandardOutput (Join-Path $private 'preflight-native.stdout.log') -RedirectStandardError (Join-Path $private 'preflight-native.stderr.log') -PassThru
[pscustomobject]@{ErpPid=$erp.Id;NativePid=$native.Id}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $private 'preflight-pids.json') -Encoding utf8NoBOM
Start-Sleep -Seconds 3
$results=@()
foreach($url in @('http://192.168.1.46:4244/production-switch-health','http://192.168.1.46:4244/api/health','http://192.168.1.46:4246/production-switch-health','http://192.168.1.46:4246/native-terminal-health')){
  try{$response=Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 10;$results+=[pscustomobject]@{Url=$url;Status=$response.StatusCode;Body=$response.Content}}
  catch{$results+=[pscustomobject]@{Url=$url;Status='ERR';Body=$_.Exception.Message}}
}
$results|ConvertTo-Json -Depth 6
if($results.Where({$_.Status -ne 200}).Count){exit 2}
