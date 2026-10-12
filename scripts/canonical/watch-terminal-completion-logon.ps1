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
& $c.node.path --no-maglev $driver --config $StartupConfigPath --sha256 $StartupConfigSha256 --owner-sid $owner --action $Action
$terminalNodeExitCode=$LASTEXITCODE
# Preserve the original exit result. Diagnostic persistence never handles it.
try {
 $terminalExitDirectory=$c.runtimeDirectory
 if($terminalExitDirectory-cne'C:\Sirket\ERP\runtime\terminal-completion-logon'){throw 'EXIT_RECEIPT_PATH'}
 for($terminalPath=$terminalExitDirectory;$terminalPath.Length-gt3;$terminalPath=[IO.Path]::GetDirectoryName($terminalPath)){if((Get-Item -LiteralPath $terminalPath -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'EXIT_RECEIPT_REPARSE'}}
 $terminalBoundedCode=if($terminalNodeExitCode-is[int]){$terminalNodeExitCode}else{$null}
 $terminalReceipt=@{schemaVersion='melisa-terminal-completion-shell-exit.v1';sourceCommit=$c.supervisor.sourceCommit;shellPid=$PID;nodeExitCode=$terminalBoundedCode;recordedAt=[DateTime]::UtcNow.ToString('o')}
 $terminalReceiptPath=Join-Path $terminalExitDirectory ('supervisor-shell-exit-'+$PID+'-'+[guid]::NewGuid().ToString()+'.json')
 $terminalReceiptHandle=[IO.File]::Open($terminalReceiptPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$terminalReceiptBytes=[Text.UTF8Encoding]::new($false).GetBytes(($terminalReceipt|ConvertTo-Json -Compress));$terminalReceiptHandle.Write($terminalReceiptBytes,0,$terminalReceiptBytes.Length);$terminalReceiptHandle.Flush($true)}finally{$terminalReceiptHandle.Dispose()}
} catch { }
if($terminalNodeExitCode -ne 0){throw 'TERMINAL_LOGON_DRIVER_FAILED'}
