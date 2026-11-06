param([Parameter(Mandatory)][ValidatePattern('^[A-F0-9]{64}$')][string]$ExpectedPackageHash)
$ErrorActionPreference='Stop';$root='C:\Users\Xaser\Desktop\ERP';$source=Join-Path $root 'kaynak-r1';$pwshExe=(Get-Process -Id $PID).Path
if((Get-FileHash -LiteralPath (Join-Path $root 'kurulum\master-v4-package.json') -Algorithm SHA256).Hash -cne $ExpectedPackageHash){throw 'PACKAGE_REJECTED'}
$pkg=Get-Content -Raw -LiteralPath (Join-Path $root 'kurulum\master-v4-package.json')|ConvertFrom-Json -AsHashtable
if($pkg.profile -cne 'desktop-master-v4' -or (Get-FileHash -LiteralPath (Join-Path $source 'scripts\desktop-empty\start-master-v4.ps1')).Hash.ToLowerInvariant() -cne $pkg.helpers['scripts/desktop-empty/start-master-v4.ps1']){throw 'START_PACKAGE_REJECTED'}
$ports=@(Get-NetTCPConnection -State Listen -LocalPort 4294,5294 -ErrorAction Stop);if($ports.Count -ne 2 -or @($ports.OwningProcess|Select-Object -Unique).Count -ne 1 -or @($ports|Where-Object LocalAddress -ne '127.0.0.1').Count){throw 'OWNED_PORTS_REJECTED'}
$w=Get-CimInstance Win32_Process -Filter "ProcessId=$($ports[0].OwningProcess)";$p=Get-CimInstance Win32_Process -Filter "ProcessId=$($w.ParentProcessId)"
$expectedWorker='"C:\Program Files\nodejs\node.exe" C:\Users\Xaser\Desktop\ERP\kaynak-r1\scripts\desktop-empty\start-master-v4-worker.mjs '+$ExpectedPackageHash
$expectedParent='"'+$pwshExe+'" -NoProfile -NonInteractive -File C:\Users\Xaser\Desktop\ERP\kaynak-r1\scripts\desktop-empty\start-master-v4.ps1 -ExpectedPackageHash '+$ExpectedPackageHash
if($w.ExecutablePath -cne 'C:\Program Files\nodejs\node.exe' -or $w.CommandLine -cne $expectedWorker -or $p.ExecutablePath -cne $pwshExe -or $p.CommandLine -cne $expectedParent){throw 'OWNED_PROCESS_REJECTED'}
$worker=Get-Process -Id $w.ProcessId;$parent=Get-Process -Id $p.ProcessId;[void]$worker.Handle;[void]$parent.Handle
try{if([Math]::Abs(($worker.StartTime.ToUniversalTime()-$w.CreationDate.ToUniversalTime()).TotalMilliseconds) -gt 10 -or [Math]::Abs(($parent.StartTime.ToUniversalTime()-$p.CreationDate.ToUniversalTime()).TotalMilliseconds) -gt 10){throw 'CREATION_REJECTED'};$parent.Kill();$parent.WaitForExit();if(-not $worker.WaitForExit(15000)){throw 'WORKER_NOT_CLOSED'}}finally{$worker.Dispose();$parent.Dispose()}
if(@(Get-NetTCPConnection -State Listen -ErrorAction Stop|Where-Object LocalPort -in @(4294,5294)).Count){throw 'PORTS_NOT_CLOSED'}
[Console]::WriteLine('OWNED_MASTER_V4_RUNTIME_STOPPED')
