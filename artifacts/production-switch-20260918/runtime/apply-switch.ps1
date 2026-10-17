$ErrorActionPreference='Stop'
$runId='PRODUCTION-SWITCH-20260918-01'
$productionRoot='C:\do-wt\melisa-production-20260918'
$privateRoot=Join-Path $env:LOCALAPPDATA 'MelisaERPServer\production-switch-20260918'
$rollbackRoot=Join-Path $privateRoot 'rollback'
New-Item -ItemType Directory -Path $rollbackRoot -Force|Out-Null
$oldRuntimeName='Melisa-Pilot-20260913-Runtime'
$oldTerminalName='Melisa Vega Terminal API'
$oldBackupName='MelisaERP-V2-NightlyVerifiedBackup'
$newRuntimeName='Melisa-Production-20260918-Runtime'
$newBackupName='Melisa-Production-Candidate-NightlyBackup'
foreach($name in @($oldRuntimeName,$oldTerminalName,$oldBackupName)){
  Export-ScheduledTask -TaskName $name|Set-Content -LiteralPath (Join-Path $rollbackRoot ($name+'.xml')) -Encoding Unicode
}
function Stop-OwnedPort([int]$port,[string]$expected,[bool]$allowOther=$false){
  $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue|Where-Object{$_.LocalPort -eq $port})
  $owners=@($listeners|Select-Object -ExpandProperty OwningProcess -Unique)
  foreach($owner in $owners){
    $process=Get-CimInstance Win32_Process -Filter "ProcessId=$owner" -ErrorAction SilentlyContinue
    if(-not $process -or $process.CommandLine -notmatch $expected){if($allowOther){continue}else{throw "PORT_${port}_OWNER_REJECTED"}}
    Stop-Process -Id $owner -Force
  }
}
function Enable-And-Start([string]$name){Enable-ScheduledTask -TaskName $name|Out-Null;Start-ScheduledTask -TaskName $name}
$oldRuntime=Get-ScheduledTask -TaskName $oldRuntimeName
$oldBackup=Get-ScheduledTask -TaskName $oldBackupName
$powerShell="$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$runtimeAction=New-ScheduledTaskAction -Execute $powerShell -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$productionRoot\start-production.ps1`" -Watch"
$backupAction=New-ScheduledTaskAction -Execute 'C:\Program Files\nodejs\node.exe' -Argument "`"$productionRoot\apps\api\backup-production-candidate.mjs`"" -WorkingDirectory "$productionRoot\apps\api"
Register-ScheduledTask -TaskName $newRuntimeName -Action $runtimeAction -Trigger $oldRuntime.Triggers -Settings $oldRuntime.Settings -Principal $oldRuntime.Principal -Force|Out-Null
Register-ScheduledTask -TaskName $newBackupName -Action $backupAction -Trigger $oldBackup.Triggers -Settings $oldBackup.Settings -Principal $oldBackup.Principal -Force|Out-Null
try{
  Stop-ScheduledTask -TaskName $oldRuntimeName -ErrorAction SilentlyContinue
  Stop-ScheduledTask -TaskName $oldTerminalName -ErrorAction SilentlyContinue
  Disable-ScheduledTask -TaskName $oldRuntimeName|Out-Null
  Disable-ScheduledTask -TaskName $oldTerminalName|Out-Null
  Disable-ScheduledTask -TaskName $oldBackupName|Out-Null
  Stop-OwnedPort 4114 'melisa-pilot-20260913'
  Stop-OwnedPort 4116 'melisa-pilot-20260913'
  Stop-OwnedPort 5188 'melisa-pilot-20260913'
  Stop-OwnedPort 4112 'terminal-release-20260912' $true
  Enable-And-Start $newRuntimeName
  Enable-ScheduledTask -TaskName $newBackupName|Out-Null
  Start-Sleep -Seconds 5
  $checks=@()
  foreach($url in @('http://192.168.1.46:4114/production-switch-health','http://192.168.1.46:4114/api/health','http://192.168.1.46:4116/production-switch-health','http://192.168.1.46:4116/native-terminal-health','http://192.168.1.46:5188')){
    try{$response=Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 15;$checks+=[pscustomobject]@{Url=$url;Status=$response.StatusCode;Body=$response.Content.Substring(0,[Math]::Min(900,$response.Content.Length))}}
    catch{$checks+=[pscustomobject]@{Url=$url;Status='ERR';Body=$_.Exception.Message}}
  }
  if($checks.Where({$_.Status -ne 200}).Count){throw 'PRODUCTION_HEALTH_FAILED'}
  $state=[pscustomobject]@{RunId=$runId;SwitchedAt=(Get-Date).ToUniversalTime().ToString('o');NewRuntimeTask=$newRuntimeName;NewBackupTask=$newBackupName;OldRuntimeTaskDisabled=$true;OldTerminalTaskDisabled=$true;OldBackupTaskDisabled=$true;Checks=$checks;Status='PASS'}
  $state|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $privateRoot 'switch-state.json') -Encoding utf8NoBOM
  $state|ConvertTo-Json -Depth 8
}catch{
  Stop-ScheduledTask -TaskName $newRuntimeName -ErrorAction SilentlyContinue
  Disable-ScheduledTask -TaskName $newRuntimeName -ErrorAction SilentlyContinue|Out-Null
  Disable-ScheduledTask -TaskName $newBackupName -ErrorAction SilentlyContinue|Out-Null
  foreach($port in @(4114,4116,5188)){try{Stop-OwnedPort $port 'melisa-production-20260918'}catch{}}
  Enable-And-Start $oldRuntimeName
  Enable-And-Start $oldTerminalName
  Enable-ScheduledTask -TaskName $oldBackupName|Out-Null
  throw
}
