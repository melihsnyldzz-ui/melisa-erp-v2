param([Parameter(Mandatory=$true)][string]$BindingFile)
$ErrorActionPreference='Stop'
$controlRoot=Join-Path $env:LOCALAPPDATA 'MelisaERPServer\deploy-mcp-control'
$binding=Get-Content -LiteralPath $BindingFile -Raw | ConvertFrom-Json
if($binding.port -ne 4213 -or $binding.database -cne 'MELISA_ERP_SIRKET_TEST_20260929_01'){throw 'MCP_BINDING_REJECTED'}
$scriptFile=Join-Path $PSScriptRoot 'server.mjs'
$node='C:\Sirket\ERP\tools\node-v24.19.0\node.exe'
$oldScript=Join-Path $controlRoot 'connection-observed-20261018\apps\deploy-mcp\server.mjs'
$listeners=@(Get-NetTCPConnection -State Listen -LocalPort 4213 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
if($listeners.Count -gt 1){throw 'MCP_LISTENER_AMBIGUOUS'}
if($listeners.Count -eq 1){
  $owner=Get-CimInstance Win32_Process -Filter ('ProcessId = '+[int]$listeners[0])
  $arguments=@([regex]::Matches($owner.CommandLine,'"[^"\r\n]*"|[^\s"]+') | ForEach-Object {$_.Value.Trim('"')})
  if(($arguments -inotcontains $oldScript -and $arguments -inotcontains $scriptFile) -or $owner.ExecutablePath -notin @($node,'C:\Program Files\nodejs\node.exe')){throw 'MCP_OWNER_REJECTED'}
  $token=(Get-Content -LiteralPath $binding.tokenFile -Raw).Trim()
  $health=Invoke-RestMethod 'http://127.0.0.1:4213/health' -Headers @{Authorization=('Bearer '+$token)} -TimeoutSec 3
  if($health.ok -ne $true -or $health.service -cne 'melisa-deploy-control'){throw 'MCP_HEALTH_IDENTITY_REJECTED'}
  $fresh=Get-CimInstance Win32_Process -Filter ('ProcessId = '+[int]$listeners[0])
  if($fresh.CreationDate -ne $owner.CreationDate -or $fresh.CommandLine -cne $owner.CommandLine){throw 'MCP_OWNER_CHANGED'}
  Stop-Process -Id $owner.ProcessId -Force
  Start-Sleep -Milliseconds 300
}
$env:MELISA_MCP_BINDING_FILE=$BindingFile
$process=Start-Process -FilePath $node -ArgumentList @('"'+$scriptFile+'"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $controlRoot 'diagnostics.stdout.log') -RedirectStandardError (Join-Path $controlRoot 'diagnostics.stderr.log')
$token=(Get-Content -LiteralPath $binding.tokenFile -Raw).Trim()
$ready=$false
for($attempt=0;$attempt -lt 20;$attempt++){
  Start-Sleep -Milliseconds 250
  $process.Refresh()
  if($process.HasExited){throw 'MCP_DIAGNOSTICS_EXITED_OLD_MCP_STOPPED'}
  try{
    $bound=@(Get-NetTCPConnection -State Listen -LocalPort 4213 -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -Unique)
    if($bound.Count -ne 1 -or $bound[0] -ne $process.Id){continue}
    $fresh=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$process.Id)
    if($fresh.ExecutablePath -ine $node -or $fresh.CommandLine -notlike ('*"'+$scriptFile+'"*')){throw 'MCP_DIAGNOSTICS_PROCESS_MISMATCH'}
    $health=Invoke-RestMethod 'http://127.0.0.1:4213/health' -Headers @{Authorization=('Bearer '+$token)} -TimeoutSec 2
    $after=Get-NetTCPConnection -State Listen -LocalPort 4213 -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -Unique
    if($health.ok -and $health.service -ceq 'melisa-deploy-control' -and @($after).Count -eq 1 -and $after -eq $process.Id){$ready=$true;break}
  }catch{}
}
if(-not $ready){throw 'MCP_DIAGNOSTICS_NOT_READY_OLD_MCP_STOPPED'}
[ordered]@{port=4213;pid=$process.Id;ready=$true;erpRestarts=0}|ConvertTo-Json -Compress
