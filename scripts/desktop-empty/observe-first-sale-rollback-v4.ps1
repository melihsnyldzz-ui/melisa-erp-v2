# Independent READ ONLY reconciliation of v4. Does not repeat any DDL/account
# provisioning and never edits the original UNKNOWN/readback-failure records.
$ErrorActionPreference='Stop';$root='C:\Users\Xaser\Desktop\ERP';$dir=Join-Path $root 'kurulum\first-sale-install-rollback-v4';$connection=$null;$owner=$null;$readerOwner=$null
try{
 $owner=[IO.File]::Open((Join-Path $root 'desktop-empty-schema.owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 $readerOwner=[IO.File]::Open((Join-Path $root 'desktop-initial-reader.owner.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 if(@(Get-NetTCPConnection -State Listen -LocalPort 4294,5294 -ErrorAction SilentlyContinue).Count){throw 'READER_STILL_RUNNING'}
 $attempt=Get-Content -Raw -LiteralPath (Join-Path $dir 'attempt.json')|ConvertFrom-Json -AsHashtable
 $failure=Get-Content -Raw -LiteralPath (Join-Path $dir 'failure.json')|ConvertFrom-Json -AsHashtable
 if($attempt.state -cne 'UNKNOWN' -or $attempt.sqlHash -cne 'fe4691b6b046ffd76f2bc61b2eda3a30aae6b4fb0ae8d4bd76f4f84bc76697d7' -or $failure.stage -cne 'INDEPENDENT_READBACK'){throw 'ATTEMPT_NOT_MATCHED'}
 $parts=$attempt.adminSession.Split(':');if($parts.Count -ne 2 -or $parts[1] -cnotmatch '^[a-fA-F0-9-]{36}$'){throw 'ORIGINAL_CONNECTION_ID_REJECTED'};$oldConnection=$parts[1]
 $template=Join-Path $root 'kurulum\first-sale-source-review\941b189699f41005812810349472acb793ca2de5ca21b47de27ce1d2dd8bf5d7.readback.current-tx.template.sql'
 if((Get-FileHash -LiteralPath $template -Algorithm SHA256).Hash -cne '941B189699F41005812810349472ACB793CA2DE5CA21B47DE27CE1D2DD8BF5D7'){throw 'READONLY_TEMPLATE_PIN_REJECTED'}
 $sql=[IO.File]::ReadAllText($template,[Text.UTF8Encoding]::new($false,$true));if([regex]::Matches($sql,'__SQL_CHILD_PID__').Count -ne 1){throw 'TEMPLATE_PLACEHOLDER_REJECTED'};$sql=$sql.Replace('__SQL_CHILD_PID__',[string]$PID)
 $connection=[System.Data.Odbc.OdbcConnection]::new('Driver={ODBC Driver 17 for SQL Server};Server=lpc:Semih\MELISAERP;Database=MELISA_ERP_DESKTOP_TEST_20261105;Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=No;');$connection.Open()
 $c=$connection.CreateCommand();$c.CommandTimeout=30;$c.CommandText="SELECT CASE WHEN EXISTS(SELECT 1 FROM sys.dm_exec_connections WHERE connection_id=CONVERT(uniqueidentifier,'$oldConnection')) OR SUSER_ID(N'melisa_desktop_test_writer_20261105') IS NOT NULL OR USER_ID(N'melisa_desktop_test_writer_20261105') IS NOT NULL OR EXISTS(SELECT 1 FROM dbo.users WHERE username=N'erp_deneme') OR EXISTS(SELECT 1 FROM dbo.roles WHERE code=N'desktop_first_sale_operator') OR EXISTS(SELECT 1 FROM dbo.audit_logs WHERE source=N'desktop-first-sale-install') THEN 0 ELSE 1 END;"
 try{if([int]$c.ExecuteScalar() -ne 1){throw 'PREVIOUS_CONNECTION_OR_INSTALL_EFFECT_PRESENT'};$c.CommandText=$sql;if($c.ExecuteScalar() -cne 'FIRST_SALE_ROLLBACK_READBACK_VERIFIED'){throw 'READBACK_RESULT_REJECTED'}}finally{$c.Dispose()}
 $record=@{state='LATER_BASELINE_OBSERVED';originalReadbackSucceeded=$false;ddlRepeated=$false;originalConnectionAbsent=$true;newLoginUserRoleAuditAbsent=$true;scopedSchemaSha256='cc3f08a44d00044ddeadb6499ad4d37a126adfb751ccbd54e7499619962cc3bd';readbackAtomicSnapshot=$false;time=[DateTime]::UtcNow.ToString('o')};$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($record|ConvertTo-Json -Compress)+"`n");$s=[IO.File]::Open((Join-Path $dir 'later-baseline.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$s.Write($bytes);$s.Flush($true)}finally{$s.Dispose()}
 [Console]::WriteLine('V4_LATER_BASELINE_VERIFIED_NO_DDL_REPEAT')
}catch{
 $code=if($_.Exception.Message -cmatch '^[A-Z_]{3,80}$'){$_.Exception.Message}else{'UNCLASSIFIED'};$numbers=@();$cursor=$_.Exception;while($cursor){if($cursor -is [System.Data.Odbc.OdbcException]){$numbers=@($cursor.Errors|ForEach-Object{$_.NativeError});break};$cursor=$cursor.InnerException};[Console]::Error.WriteLine("V4_READBACK_STOPPED code=$code native=$($numbers -join ',')");exit 1
}finally{if($connection){$connection.Dispose()};if($readerOwner){$readerOwner.Dispose()};if($owner){$owner.Dispose()}}
