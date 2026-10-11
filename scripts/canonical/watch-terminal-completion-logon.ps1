param([Parameter(Mandatory=$true)][string]$StartupConfigPath,[Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$StartupConfigSha256,[ValidateSet('Probe','Start')][string]$Action='Start')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# SOURCE ONLY. Same-user Windows logon; no task registration, grants, SQL write,
# reboot, edge activation or replacement of the accepted Hub web supervisor.
if($StartupConfigPath -notmatch '^C:\\Sirket\\ERP\\runtime\\[^"''`$%\r\n]+\.json$' -or [IO.Path]::GetFullPath($StartupConfigPath) -cne $StartupConfigPath){throw 'TERMINAL_LOGON_CONFIG_SCOPE'}
if((Get-FileHash -LiteralPath $StartupConfigPath -Algorithm SHA256).Hash -ine $StartupConfigSha256){throw 'TERMINAL_LOGON_CONFIG_PIN'}
$c=Get-Content -LiteralPath $StartupConfigPath -Raw|ConvertFrom-Json
$owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
if($c.ownerSid -cne $owner -or $c.database -cne 'MELISA_ERP_CRM_SHARED_TEST_20261009_02' -or $c.copyId -cne 'e16b70f0-4057-428b-9abc-6bbcaf35fe82' -or $c.actualT1 -ne $false -or $c.lanAddress -cne '192.168.1.46'){throw 'TERMINAL_LOGON_TARGET_REJECTED'}
$expected=Join-Path $c.supervisor.packageRoot 'scripts\canonical\watch-terminal-completion-logon.ps1'
if([IO.Path]::GetFullPath($PSCommandPath) -ine $expected -or $c.supervisor.packageRoot -notmatch '^C:\\Sirket\\ERP\\releases\\[^"''`$%\r\n]+$' -or $c.node.path -notmatch '^[A-Za-z]:\\[^"''`$%\r\n]+\\node\.exe$'){throw 'TERMINAL_LOGON_ENTRY_SCOPE'}
if((Get-FileHash -LiteralPath $c.node.path -Algorithm SHA256).Hash -ine $c.node.sha256 -or (Get-FileHash -LiteralPath (Join-Path $c.supervisor.packageRoot 'release-manifest.json') -Algorithm SHA256).Hash -ine $c.supervisor.manifestSha256){throw 'TERMINAL_LOGON_OUTER_PIN'}
$manifest=Get-Content -LiteralPath (Join-Path $c.supervisor.packageRoot 'release-manifest.json') -Raw|ConvertFrom-Json
$pins=@($manifest.files|Where-Object {$_.path.Replace('\','/') -ceq 'scripts/canonical/watch-terminal-completion-logon.ps1'})
if($pins.Count -ne 1 -or $manifest.sourceCommit -cne $c.supervisor.sourceCommit -or (Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash -ine $pins[0].sha256){throw 'TERMINAL_LOGON_SHELL_PIN'}
$driver=Join-Path $c.supervisor.packageRoot 'scripts\canonical\terminal-completion-logon.mjs'
# Node holds the sole initial+3 retry budget; Scheduler retries must be disabled.
& $c.node.path $driver --config $StartupConfigPath --sha256 $StartupConfigSha256 --owner-sid $owner --action $Action
if($LASTEXITCODE -ne 0){throw 'TERMINAL_LOGON_DRIVER_FAILED'}
