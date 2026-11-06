param([switch]$ExecuteReviewedActivation)
$ErrorActionPreference='Stop';if(-not $ExecuteReviewedActivation){throw 'EXPLICIT_ACTIVATION_SWITCH_REQUIRED'}
$root='C:\Users\Xaser\Desktop\ERP';$source=Join-Path $root 'kaynak';$dir=Join-Path $root 'kurulum\first-sale-activation-v3';$packageFile=Join-Path $root 'kurulum\first-sale-package.json';$packageHash='AF62438A22BEFE7ADBF9864FC91E926E0CAD4D38439555C01DA3D395CA52B714';$pwshExe=(Get-Process -Id $PID).Path
$owner=$null;$readerOwner=$null;$secret=$null;$identity=$null;$activationDispatched=$false;$stage='PRECHECK';$seen=[Collections.Generic.List[string]]::new();$attemptId=[Guid]::NewGuid().ToString();$created=$false
$sourceLocks=[Collections.Generic.List[IO.FileStream]]::new();$packageLock=[IO.File]::Open($packageFile,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$sourceLocks.Add($packageLock)
if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($packageLock)) -cne $packageHash){throw 'PACKAGE_REJECTED'};$pkg=Get-Content -Raw -LiteralPath $packageFile|ConvertFrom-Json -AsHashtable
if(-not $pkg.helpers -or $pkg.helpers.Count -ne 4){throw 'HELPER_MANIFEST_REQUIRED'}
foreach($group in @($pkg.sources,$pkg.helpers)){foreach($name in $group.Keys){$held=[IO.File]::Open((Join-Path $source $name),[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$sourceLocks.Add($held);if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($held)).ToLowerInvariant() -cne $group[$name]){throw 'SOURCE_PIN_REJECTED'}}}
. (Join-Path $source 'scripts\desktop-empty\first-sale-runner-common.ps1')
function Action([string]$mode){
 $payload=@{protocol=2;mode=$mode;attemptId=$attemptId;supervisorPid=$PID;packageHash=$packageHash;identity=$identity;previousConnections=@($seen.ToArray())}
 $p=[Diagnostics.ProcessStartInfo]::new();$p.FileName=$pwshExe;$p.WorkingDirectory=$source;$p.UseShellExecute=$false;$p.CreateNoWindow=$true;$p.RedirectStandardInput=$true;$p.RedirectStandardOutput=$true;$p.RedirectStandardError=$true;$p.StandardOutputEncoding=[Text.UTF8Encoding]::new($false,$true);$p.StandardErrorEncoding=[Text.UTF8Encoding]::new($false,$true)
 foreach($a in @('-NoProfile','-NonInteractive','-File',(Join-Path $source 'scripts\desktop-empty\first-sale-activation-child.ps1'))){[void]$p.ArgumentList.Add($a)}
 $child=[Diagnostics.Process]::new();$child.StartInfo=$p;$code=-1
 try{if(-not $child.Start()){throw 'CHILD_NOT_STARTED'};$out=$child.StandardOutput.ReadToEndAsync();$err=$child.StandardError.ReadToEndAsync();$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($payload|ConvertTo-Json -Depth 6 -Compress));$child.StandardInput.BaseStream.Write($bytes);$child.StandardInput.Close();$watch=[Diagnostics.Stopwatch]::StartNew();while(-not $child.WaitForExit(500)){if($watch.ElapsedMilliseconds -ge 60000){$child.Kill();$child.WaitForExit();throw 'ACTION_CHILD_TIMEOUT'}};$code=$child.ExitCode;$o=$out.GetAwaiter().GetResult();$e=$err.GetAwaiter().GetResult();if($o.Length+$e.Length -gt 16384){throw 'CHILD_OUTPUT_LIMIT'};[Console]::Write($o);[Console]::Error.Write($e)
 }finally{if(-not $child.HasExited){$child.Kill();$child.WaitForExit()};$childPid=$child.Id;$child.Dispose();$f=Join-Path $dir ($mode+'.dispatch.json');if(Test-Path -LiteralPath $f){$d=Get-Content -Raw -LiteralPath $f|ConvertFrom-Json -AsHashtable;if($d.attemptId -cne $attemptId -or $d.childPid -ne $childPid -or $d.connectionId -cnotmatch '^[a-fA-F0-9-]{36}$'){throw 'CHILD_DISPATCH_RECEIPT_REJECTED'};$seen.Add($d.connectionId)}}
 if($code -ne 0){throw 'ACTION_CHILD_FAILED'};$r=Get-Content -Raw -LiteralPath (Join-Path $dir ($mode+'.result.json'))|ConvertFrom-Json -AsHashtable
 if($r.state -cne 'COMMAND_ACKNOWLEDGED' -or $r.mode -cne $mode -or $r.attemptId -cne $attemptId -or $r.childPid -ne $childPid -or $r.identity.loginSid -cne $identity.loginSid -or $r.identity.operatorId -cne $identity.operatorId){throw 'CHILD_RESULT_RECEIPT_REJECTED'}
 Write-FirstSaleNew (Join-Path $dir ($mode+'.process-closed.json')) @{childPid=$childPid;exitCode=$code;hasExited=$true;connectionId=$r.connectionId;time=[DateTime]::UtcNow.ToString('o')}
}
try{
 if([Security.Principal.WindowsIdentity]::GetCurrent().Name -cne 'SEMIH\Xaser' -or $PSVersionTable.PSVersion -lt [version]'7.5' -or (Get-FileHash 'C:\Program Files\nodejs\node.exe' -Algorithm SHA256).Hash -cne '3331E1FFE19874215472217C5E94F5A0C6D8E18C4AC7111D3937AA0AD5E9B4A5'){throw 'OWNER_OR_NODE_REJECTED'}
 $owner=[IO.File]::Open((Join-Path $root 'desktop-empty-schema.owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$readerOwner=[IO.File]::Open((Join-Path $root 'desktop-initial-reader.owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 if(@(Get-NetTCPConnection -State Listen -LocalPort 4294,5294 -ErrorAction SilentlyContinue).Count){throw 'APPLICATION_NOT_STOPPED'};if(Test-Path -LiteralPath $dir){throw 'ACTIVATION_ALREADY_ATTEMPTED_NO_RETRY'}
 $reconciled=Get-Content -Raw -LiteralPath (Join-Path $root 'kurulum\first-sale-install-apply-v4\reconciled-disabled.json')|ConvertFrom-Json -AsHashtable
 if($reconciled.state -cne 'APPLIED_DISABLED_INDEPENDENTLY_OBSERVED' -or $reconciled.applySqlHash -cne $pkg.applySqlSha256 -or $reconciled.originalConnectionAbsent -ne $true -or $reconciled.businessDataEmpty -ne $true){throw 'DISABLED_RECONCILIATION_REJECTED'};$identity=$reconciled.identity
 if($identity.Count -ne 2 -or $identity.loginSid -cnotmatch '^0x[0-9A-F]{32}$' -or $identity.operatorId -cnotmatch '^[1-9][0-9]{0,15}$'){throw 'IDENTITY_REJECTED'}
 foreach($name in $reconciled.cipherFileHashes.Keys){if((Get-FileHash (Join-Path $root ('kurulum\'+$name)) -Algorithm SHA256).Hash -cne $reconciled.cipherFileHashes[$name]){throw 'CIPHER_CHANGED'}}
 $tree=Invoke-FirstSaleNode @('scripts/desktop-empty/sql-login-runtime-integrity.mjs') $null|ConvertFrom-Json -AsHashtable;if($tree.sha256 -cne $pkg.dependencySha256){throw 'DEPENDENCY_PIN_REJECTED'}
 [void][IO.Directory]::CreateDirectory($dir);$created=$true;$started=(Get-Process -Id $PID).StartTime.ToUniversalTime().ToString('o');Write-FirstSaleNew (Join-Path $dir 'attempt.json') @{state='UNKNOWN';protocol=2;attemptId=$attemptId;supervisorPid=$PID;supervisorStartedUtc=$started;packageHash=$packageHash;identity=$identity;time=[DateTime]::UtcNow.ToString('o')}
 $old=Get-Content -Raw -LiteralPath (Join-Path $root 'kurulum\first-sale-install-apply-v4\attempt.json')|ConvertFrom-Json -AsHashtable;$oldId=$old.adminSession.Split(':')[1];if($oldId -cnotmatch '^[a-fA-F0-9-]{36}$'){throw 'ORIGINAL_CONNECTION_REJECTED'};$seen.Add($oldId)
 $stage='DISABLED_EFFECTIVE_VERIFY';Action 'verify'
 $stage='ACTIVATION_DISPATCH';$activationDispatched=$true;Action 'activate'
 $stage='WRITER_TLS_VERIFY';$secret=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $root 'kurulum\melisa-desktop-test-writer.dpapi')),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 if((Invoke-FirstSaleNode @('scripts/desktop-empty/verify-first-sale-writer.mjs') $secret) -cne 'FIRST_SALE_WRITER_TLS_VERIFIED'){throw 'TLS_RESULT_REJECTED'};[Security.Cryptography.CryptographicOperations]::ZeroMemory($secret);$secret=$null
 $stage='ACTIVE_FRESH_PROCESS_STATE';Action 'active'
 Write-FirstSaleNew (Join-Path $dir 'outcome.json') @{state='ACTIVE_TLS_VERIFIED';protocol=2;identity=$identity;packageHash=$packageHash;freshProcessReadback=$true;normalGuiVerified=$false;salesVerified=$false;time=[DateTime]::UtcNow.ToString('o')};[Console]::WriteLine('FIRST_SALE_ACTIVE_TLS_VERIFIED')
}catch{
 $code=if($_.Exception.Message -cmatch '^[A-Z_]{3,100}$'){$_.Exception.Message}else{'UNCLASSIFIED'};$compensated=$false;$inactiveObserved=$false
 if($created -and $identity){try{if($activationDispatched){Action 'disable'};Action 'inactive';$inactiveObserved=$true;$compensated=$activationDispatched}catch{}}
 $state=if($inactiveObserved){'DISABLED_INACTIVE_FRESH_PROCESS_VERIFIED'}elseif($activationDispatched){'ACTIVE_UNVERIFIED_NO_RUNTIME_START'}else{'VERIFY_FAILED_NO_ACTIVATION_DISPATCHED'}
 if($created){try{Write-FirstSaleNew (Join-Path $dir 'failure.json') @{state=$state;stage=$stage;code=$code;activationDispatched=$activationDispatched;compensationVerified=$compensated;identity=$identity;time=[DateTime]::UtcNow.ToString('o')}}catch{}}
 [Console]::Error.WriteLine("FIRST_SALE_ACTIVATION_STOPPED stage=$stage code=$code state=$state");exit 1
}finally{if($secret){[Security.Cryptography.CryptographicOperations]::ZeroMemory($secret)};if($readerOwner){$readerOwner.Dispose()};if($owner){$owner.Dispose()};foreach($held in $sourceLocks){$held.Dispose()}}
