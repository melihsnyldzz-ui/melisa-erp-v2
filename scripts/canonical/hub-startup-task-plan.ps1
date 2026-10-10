param([Parameter(Mandatory=$true)][string]$StartupConfigPath)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Preview only. Deliberately contains no Register/Set/Enable/Start task command.
$c=Get-Content -LiteralPath $StartupConfigPath -Raw|ConvertFrom-Json
if($c.OwnerSid -ne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -or $c.SourceCommit -notmatch '^[a-f0-9]{40}$' -or ![IO.Path]::IsPathRooted($c.PackageRoot) -or ![IO.Path]::IsPathRooted($StartupConfigPath)){throw 'HUB_TASK_PLAN_IDENTITY_REQUIRED'}
foreach($path in @($c.PackageRoot,$StartupConfigPath)){if($path -match '["\r\n]'){throw 'HUB_TASK_PLAN_PATH_REJECTED'}}
$script=Join-Path $c.PackageRoot 'scripts\canonical\watch-hub-web.ps1'
if(!(Test-Path -LiteralPath $script)){throw 'HUB_TASK_PLAN_SCRIPT_REQUIRED'}
$existing=Get-ScheduledTask -TaskName 'Melisa-Hub-TEST-Web' -TaskPath '\' -ErrorAction SilentlyContinue
if($existing){throw 'HUB_TASK_ALREADY_EXISTS_REVIEW_REQUIRED'}
[ordered]@{
 Before='Task absent; original ERP/CRM tasks unchanged'
 TaskName='Melisa-Hub-TEST-Web'
 TaskPath='\'
 Execute=(Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
 Arguments=('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$script+'" -StartupConfigPath "'+$StartupConfigPath+'"')
 WorkingDirectory=(Join-Path $c.PackageRoot 'apps\api')
 OwnerSid=$c.OwnerSid
 Trigger='AtLogOn for the same current user only'
 LogonType='Interactive'
 RunLevel='Limited'
 MultipleInstances='IgnoreNew'
 StartWhenAvailable=$true
 RestartCount=0
 SupervisorRestartCount=3
 SupervisorRetryInterval='PT1M'
 ExecutionTimeLimit='PT0S'
 Scope='Web5234 only; no stop, DB/API/native/CRM/task repointing or network changes'
 Failure='Missing exact DB02 API/native dependency or occupied port fails closed'
 ChildSupervision='Watch holds only the exact receipt child; initial attempt plus three retries at one minute; Scheduler retries disabled to avoid multiplication'
 UnattendedReboot=$false
 Installed=$false
} | ConvertTo-Json -Depth 3
