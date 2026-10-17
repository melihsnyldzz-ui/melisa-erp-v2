param([Parameter(Mandatory=$true)][ValidateSet('Install','Remove','Inspect')][string]$Action,[Parameter(Mandatory=$true)][string]$StartupConfigPath)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'start-owned-test.ps1') -StartupConfigPath $StartupConfigPath -Library
$config=Read-ErpStartupConfig $StartupConfigPath
$launcher=Join-Path $config.RepoRoot 'scripts\canonical\start-owned-test.ps1'
$powershell=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$arguments='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$launcher+'" -StartupConfigPath "'+$StartupConfigPath+'"'
$existing=Get-ScheduledTask -TaskName $config.TaskName -TaskPath '\' -ErrorAction SilentlyContinue
if($existing){
 $sid=if($existing.Principal.UserId -like 'S-1-*'){$existing.Principal.UserId}else{(New-Object Security.Principal.NTAccount($existing.Principal.UserId)).Translate([Security.Principal.SecurityIdentifier]).Value}
 if($sid -ne $config.OwnerSid -or $existing.Actions.Count -ne 1 -or !(Same-ErpPath $existing.Actions[0].Execute $powershell) -or $existing.Actions[0].Arguments -ne $arguments){throw 'TEST_STARTUP_TASK_IDENTITY_MISMATCH'}
}
if($Action -eq 'Inspect'){if($existing){$existing | Select-Object TaskName,State};exit 0}
if($Action -eq 'Remove'){if($existing){Unregister-ScheduledTask -TaskName $config.TaskName -TaskPath '\' -Confirm:$false};exit 0}
$actionValue=New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $config.RepoRoot
$trigger=New-ScheduledTaskTrigger -AtLogOn -User $config.OwnerSid
$principal=New-ScheduledTaskPrincipal -UserId $config.OwnerSid -LogonType Interactive -RunLevel Limited
# Circuit-open failures require operator review; a task retry must not reset the recovery budget.
$settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([timespan]::Zero)
Register-ScheduledTask -TaskName $config.TaskName -TaskPath '\' -Action $actionValue -Trigger $trigger -Principal $principal -Settings $settings -Description 'Owned ERP TEST session; bounded recovery; physical logon acceptance pending.' -Force | Select-Object TaskName,State
