param([ValidateSet('rollback','apply')][string]$Mode='rollback',[switch]$ExecuteReviewedInstall)
$ErrorActionPreference='Stop'
if(-not $ExecuteReviewedInstall){throw 'EXPLICIT_EXECUTION_SWITCH_REQUIRED'}
$root='C:\Users\Xaser\Desktop\ERP';$source=Join-Path $root 'kaynak';$node='C:\Program Files\nodejs\node.exe'
$pkgFile=Join-Path $root 'kurulum\first-sale-package.json'
$expectedPackageHash='FE674C232E7710A8F691B14831D0D0433EE02525EFDD1F16314138426E8D360E'
$attemptDir=Join-Path $root "kurulum\first-sale-install-$Mode-v4"
$lock=$null;$readerLock=$null;$connection=$null;$secret=$null;$appSecret=$null;$stage='PRECHECK';$attempted=$false
function Write-New([string]$file,$value){$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 8 -Compress)+"`n");$s=[IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$s.Write($bytes);$s.Flush($true)}finally{$s.Dispose()}}
function Run-Node([string[]]$arguments,[byte[]]$inputBytes){
 $p=[Diagnostics.ProcessStartInfo]::new();$p.FileName=$node;$p.WorkingDirectory=$source;$p.UseShellExecute=$false;$p.CreateNoWindow=$true;$p.RedirectStandardInput=$true;$p.RedirectStandardOutput=$true;$p.RedirectStandardError=$true;$p.Environment.Clear();$p.Environment['SystemRoot']='C:\Windows';$p.Environment['MELISA_EMPTY_LOCAL']='20261105';foreach($a in $arguments){[void]$p.ArgumentList.Add($a)}
 $child=[Diagnostics.Process]::new();$child.StartInfo=$p
 try{if(-not $child.Start()){throw 'NODE_NOT_STARTED'};$out=$child.StandardOutput.ReadToEndAsync();$err=$child.StandardError.ReadToEndAsync();if($inputBytes){$child.StandardInput.BaseStream.Write($inputBytes)};$child.StandardInput.Close();if(-not $child.WaitForExit(30000)){$child.Kill();$child.WaitForExit();throw 'NODE_TIMEOUT'};if($child.ExitCode -ne 0 -or $err.GetAwaiter().GetResult().Length -ne 0){throw 'NODE_FAILED'};$value=$out.GetAwaiter().GetResult();if($value.Length -gt 250000){throw 'NODE_OUTPUT_LIMIT'};return $value}
 finally{if(-not $child.HasExited){try{$child.Kill()}catch{};$child.WaitForExit()};$child.Dispose()}
}
function Scalar([string]$sql){$c=$connection.CreateCommand();$c.CommandText=$sql;$c.CommandTimeout=30;try{return $c.ExecuteScalar()}finally{$c.Dispose()}}
try{
 if($PSVersionTable.PSVersion -lt [version]'7.5' -or [Security.Principal.WindowsIdentity]::GetCurrent().Name -cne 'SEMIH\Xaser'){throw 'IDENTITY_REJECTED'}
 Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class DesktopNoOdbcPooling { [DllImport("odbc32.dll")] public static extern short SQLSetEnvAttr(IntPtr env,int attr,IntPtr value,int length); }'
 if([DesktopNoOdbcPooling]::SQLSetEnvAttr([IntPtr]::Zero,201,[IntPtr]::Zero,0) -notin @(0,1)){throw 'ODBC_POOLING_NOT_DISABLED'}
 if((Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash -cne '3331E1FFE19874215472217C5E94F5A0C6D8E18C4AC7111D3937AA0AD5E9B4A5' -or (Get-FileHash -LiteralPath $pkgFile -Algorithm SHA256).Hash -cne $expectedPackageHash){throw 'PACKAGE_REJECTED'}
 $pkg=Get-Content -Raw -LiteralPath $pkgFile|ConvertFrom-Json -AsHashtable
 if(-not $pkg.helpers -or $pkg.helpers.Count -ne 3){throw 'HELPER_MANIFEST_REQUIRED'}
 foreach($name in $pkg.helpers.Keys){if((Get-FileHash -LiteralPath (Join-Path $source $name) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $pkg.helpers[$name]){throw 'HELPER_PIN_REJECTED'}}
 . (Join-Path $source 'scripts\desktop-empty\first-sale-runner-common.ps1')
 foreach($name in $pkg.sources.Keys){$f=Get-Item -LiteralPath (Join-Path $source $name);if($f.PSIsContainer -or ($f.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -cne $pkg.sources[$name]){throw 'SOURCE_PIN_REJECTED'}}
 $lock=[IO.File]::Open((Join-Path $root 'desktop-empty-schema.owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 $readerLock=[IO.File]::Open((Join-Path $root 'desktop-initial-reader.owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 foreach($port in @(4294,5294)){if(@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue).Count){throw 'READER_NOT_STOPPED'}}
 if(Test-Path -LiteralPath $attemptDir){throw 'ATTEMPT_EXISTS_NO_RETRY'}
 if($Mode -ceq 'apply'){
  foreach($n in @('melisa-desktop-test-writer.dpapi','melisa-desktop-test-operator.dpapi')){if(Test-Path -LiteralPath (Join-Path $root ('kurulum\'+$n))){throw 'GLOBAL_CREDENTIAL_FILE_ALREADY_PRESENT'}}
  $trialRoot=Join-Path $root 'kurulum\first-sale-install-rollback-v4';$trial=Get-Content -Raw -LiteralPath (Join-Path $trialRoot 'attempt.json')|ConvertFrom-Json -AsHashtable;$oldFailure=Get-Content -Raw -LiteralPath (Join-Path $trialRoot 'failure.json')|ConvertFrom-Json -AsHashtable;$later=Get-Content -Raw -LiteralPath (Join-Path $trialRoot 'later-baseline.json')|ConvertFrom-Json -AsHashtable
  if($trial.mode -cne 'rollback' -or $trial.sqlHash -cne $pkg.rollbackSqlSha256 -or $oldFailure.stage -cne 'INDEPENDENT_READBACK' -or $later.state -cne 'LATER_BASELINE_OBSERVED' -or $later.originalReadbackSucceeded -ne $false -or $later.ddlRepeated -ne $false -or $later.originalConnectionAbsent -ne $true -or $later.newLoginUserRoleAuditAbsent -ne $true -or $later.scopedSchemaSha256 -cne 'cc3f08a44d00044ddeadb6499ad4d37a126adfb751ccbd54e7499619962cc3bd'){throw 'ROLLBACK_RECONCILIATION_NOT_MATCHED'}
 }
 $tree=Run-Node @('scripts/desktop-empty/sql-login-runtime-integrity.mjs') $null|ConvertFrom-Json -AsHashtable;if($tree.sha256 -cne $pkg.dependencySha256){throw 'DEPENDENCY_PIN_REJECTED'}
 $script="import {compileFirstSaleInstall} from './scripts/desktop-empty/first-sale-install-plan.mjs';process.stdout.write(JSON.stringify(compileFirstSaleInstall({mode:'$Mode'})));"
 $plan=Run-Node @('--input-type=module','-e',$script) $null|ConvertFrom-Json -AsHashtable
 if($plan.sqlSha256 -cne $pkg["${Mode}SqlSha256"] -or [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($plan.sql))).ToLowerInvariant() -cne $plan.sqlSha256){throw 'SQL_PIN_REJECTED'}
 $connection=Open-FirstSaleAdmin
 if([int](Scalar "SELECT CASE WHEN DB_ID()=5 AND CONVERT(int,SERVERPROPERTY('ProcessID'))=5240 AND CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'))=N'Semih\MELISAERP' AND EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=5 AND database_guid='c67f5317-9c0d-4831-aadd-fadc379a95d1') THEN 1 ELSE 0 END;") -ne 1){throw 'TARGET_REJECTED'}
 # No user-defined statement capture. Built-in engine health/default telemetry
 # still means a server-side CREATE LOGIN literal may be visible to SQL admins.
 if([int](Scalar "SELECT (SELECT COUNT(*) FROM sys.traces WHERE is_default=0)+(SELECT COUNT(*) FROM sys.dm_xe_sessions WHERE name NOT IN(N'hkenginexesession',N'system_health',N'telemetry_xevents'))+(SELECT COUNT(*) FROM sys.dm_server_audit_status WHERE status_desc=N'STARTED');") -ne 0){throw 'CUSTOM_SQL_CAPTURE_REJECTED'}
 [void][IO.Directory]::CreateDirectory($attemptDir)
 . (Join-Path $source 'scripts\desktop-empty\sql-login-secret.ps1')
 $secret=New-DesktopConnectSecretBytes;$appSecret=New-DesktopConnectSecretBytes
 $appHash=Run-Node @('scripts/desktop-empty/hash-first-sale-test-password.mjs') $appSecret
 if($appHash -cnotmatch '^\$2b\$12\$[./A-Za-z0-9]{53}$'){throw 'APP_HASH_REJECTED'}
 foreach($entry in @(@{name='writer.dpapi';bytes=$secret},@{name='operator.dpapi';bytes=$appSecret})){$cipher=Protect-DesktopConnectSecretBytes $entry.bytes;$f=[IO.File]::Open((Join-Path $attemptDir $entry.name),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$f.Write($cipher);$f.Flush($true)}finally{$f.Dispose()}}
 $session=[string](Scalar "SELECT CONVERT(varchar(12),@@SPID)+':'+CONVERT(varchar(36),connection_id) FROM sys.dm_exec_connections WHERE session_id=@@SPID;")
 Write-New (Join-Path $attemptDir 'attempt.json') @{state='UNKNOWN';mode=$Mode;packageHash=$expectedPackageHash;sqlHash=$plan.sqlSha256;adminSession=$session;time=[DateTime]::UtcNow.ToString('o')};$attempted=$true;$stage='SQL_DISPATCH'
 $command=$connection.CreateCommand();$command.CommandText=$plan.sql;$command.CommandTimeout=30
 [void]$command.Parameters.Add('sqlPassword',[System.Data.Odbc.OdbcType]::NVarChar,128);$command.Parameters[0].Value=[Text.Encoding]::ASCII.GetString($secret)
 [void]$command.Parameters.Add('appHash',[System.Data.Odbc.OdbcType]::NVarChar,100);$command.Parameters[1].Value=$appHash
 $controlled=$false
 try{$answer=$command.ExecuteScalar();if($Mode -cne 'apply' -or $answer -cne 'FIRST_SALE_INSTALL_APPLIED'){throw 'SQL_RESPONSE_REJECTED'}}
 catch [System.Data.Odbc.OdbcException]{$numbers=@($_.Exception.Errors|ForEach-Object{$_.NativeError});if($Mode -ceq 'rollback' -and $numbers.Count -eq 1 -and $numbers[0] -eq 51990){$controlled=$true}else{throw}}
 finally{$command.Parameters.Clear();$command.Dispose();$appHash=$null}
 $connection.Dispose();$connection=$null;$stage='INDEPENDENT_READBACK'
 $connection=Open-FirstSaleAdmin
 $parts=$session.Split(':');if($parts.Count -ne 2 -or $parts[0] -cnotmatch '^[0-9]+$' -or $parts[1] -cnotmatch '^[0-9a-fA-F-]{36}$'){throw 'PREVIOUS_SESSION_RECORD_REJECTED'}
 $oldSpid=[int]$parts[0];$oldConnection=$parts[1]
 if([int](Scalar "SELECT CASE WHEN EXISTS(SELECT 1 FROM sys.dm_exec_connections WHERE connection_id=CONVERT(uniqueidentifier,'$oldConnection')) OR EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE session_id=$oldSpid AND session_id<>@@SPID) THEN 1 ELSE 0 END;") -ne 0){throw 'PREVIOUS_SQL_CONNECTION_STILL_PRESENT'}
 if($Mode -ceq 'rollback'){
  if(-not $controlled -or [int](Scalar "SELECT CASE WHEN (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0)=27 AND EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND schema_version=1 AND read_only=1) AND SUSER_ID(N'melisa_desktop_test_writer_20261105') IS NULL AND USER_ID(N'melisa_desktop_test_writer_20261105') IS NULL AND DATABASE_PRINCIPAL_ID(N'desktop_local_writer_v2') IS NULL AND NOT EXISTS(SELECT 1 FROM dbo.users WHERE username=N'erp_deneme') AND NOT EXISTS(SELECT 1 FROM dbo.roles WHERE code=N'desktop_first_sale_operator') AND NOT EXISTS(SELECT 1 FROM dbo.audit_logs WHERE source=N'desktop-first-sale-install') THEN 1 ELSE 0 END;") -ne 1){throw 'ROLLBACK_STATE_REJECTED'}
  # Full scoped baseline, target, constraint and no-active-transaction observer.
  $observer=Run-Node @('--input-type=module','-e',"import {compileFirstSaleRollbackReadback} from './scripts/desktop-empty/first-sale-schema-proposal.mjs';process.stdout.write(compileFirstSaleRollbackReadback({reviewedBaselineSha256:'cc3f08a44d00044ddeadb6499ad4d37a126adfb751ccbd54e7499619962cc3bd'}).sql);") $null
  $observer=$observer.Replace('__SQL_CHILD_PID__',[string]$PID)
  if((Scalar $observer) -cne 'FIRST_SALE_ROLLBACK_READBACK_VERIFIED'){throw 'BASELINE_REJECTED'}
  Write-New (Join-Path $attemptDir 'outcome.json') @{state='ROLLBACK_AND_BASELINE_VERIFIED';mode=$Mode;packageHash=$expectedPackageHash;sqlHash=$plan.sqlSha256;time=[DateTime]::UtcNow.ToString('o')}
 }else{
  if([int](Scalar "SELECT CASE WHEN DB_ID()=5 AND CONVERT(int,SERVERPROPERTY('ProcessID'))=5240 AND CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'))=N'Semih\MELISAERP' AND EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=5 AND database_guid='c67f5317-9c0d-4831-aadd-fadc379a95d1') AND SUSER_SID()=SUSER_SID(N'SEMIH\Xaser') AND SUSER_SID(ORIGINAL_LOGIN())=SUSER_SID(N'SEMIH\Xaser') AND IS_SRVROLEMEMBER(N'sysadmin')=1 AND CONNECTIONPROPERTY('net_transport')=N'Shared memory' AND (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0)=36 AND EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND environment_id='eb2888c2-51cb-4570-a933-397cf7e62806' AND schema_version=2 AND read_only=0 AND actual_t1=0 AND external_operations=0) AND EXISTS(SELECT 1 FROM sys.sql_logins WHERE name=N'melisa_desktop_test_writer_20261105' AND is_disabled=1 AND is_policy_checked=1) AND (SELECT COUNT(*) FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id WHERE u.username=N'erp_deneme' AND u.is_active=0 AND r.code=N'desktop_first_sale_operator' AND r.is_active=1 AND r.is_system_role=0)=1 THEN 1 ELSE 0 END;") -ne 1){throw 'APPLY_DISABLED_STATE_REJECTED'}
  foreach($pair in @(@('writer.dpapi','melisa-desktop-test-writer.dpapi'),@('operator.dpapi','melisa-desktop-test-operator.dpapi'))){[IO.File]::Copy((Join-Path $attemptDir $pair[0]),(Join-Path $root ('kurulum\'+$pair[1])),$false)}
  Write-New (Join-Path $attemptDir 'outcome.json') @{state='APPLIED_DISABLED_ADMIN_READBACK';packageHash=$expectedPackageHash;sqlHash=$plan.sqlSha256;runtimeVerified=$false;time=[DateTime]::UtcNow.ToString('o')}
 }
 [Console]::WriteLine("FIRST_SALE_INSTALL_$($Mode.ToUpperInvariant())_VERIFIED")
}catch{
 $native=@();$labels=@();$safeDetails=@();$cursor=$_.Exception;while($cursor){if($cursor -is [System.Data.Odbc.OdbcException]){$native=@($cursor.Errors|ForEach-Object{$_.NativeError});foreach($e in $cursor.Errors){$labels+=@([regex]::Matches($e.Message,'\b(?:FIRST_SALE_|DESKTOP_WRITE_|LOCAL_MASTER_)[A-Z_]+\b')|ForEach-Object{$_.Value});$safeDetails+=@([regex]::Matches($e.Message,'FIRST_SALE_SETUP_FAILURE stage=[0-9]+ error=[0-9]+ state=[0-9]+ line=[0-9]+ cleanup=[0-9]+')|ForEach-Object{$_.Value})};break};$cursor=$cursor.InnerException}
 if(Test-Path -LiteralPath $attemptDir){try{Write-New (Join-Path $attemptDir 'failure.json') @{state=if($attempted){'UNKNOWN_NO_RETRY'}else{'NOT_DISPATCHED'};stage=$stage;nativeErrors=$native;labels=@($labels|Select-Object -Unique);safeDetails=$safeDetails;time=[DateTime]::UtcNow.ToString('o')}}catch{}}
 [Console]::Error.WriteLine("FIRST_SALE_INSTALL_STOPPED stage=$stage attempted=$attempted native=$($native -join ',') details=$($safeDetails -join ',')");exit 1
}finally{if($connection){$connection.Dispose()};if($secret){[Security.Cryptography.CryptographicOperations]::ZeroMemory($secret)};if($appSecret){[Security.Cryptography.CryptographicOperations]::ZeroMemory($appSecret)};if($readerLock){$readerLock.Dispose()};if($lock){$lock.Dispose()}}
