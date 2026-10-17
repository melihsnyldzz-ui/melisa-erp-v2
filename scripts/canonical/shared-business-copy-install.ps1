param([Parameter(Mandatory=$true)][string]$BundlePath,[Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$BundleSHA256,[ValidateSet('Rehearse','Apply')][string]$Mode='Rehearse')
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'protect-business-test-private-file.ps1')
$proofRoot='C:\Sirket\ERP\evidence\ERP-CRM-EXPAND-20261009\private\infra'
$runtimeRoot='C:\Sirket\ERP\runtime\ERP-CRM-EXPAND-20261009'
$configPath=Join-Path $runtimeRoot 'shared-copy-config.json'
$expectedPath=Join-Path $proofRoot 'business-copy-install-bundle.json'
if([IO.Path]::GetFullPath($BundlePath) -cne $expectedPath -or (Get-FileHash -LiteralPath $BundlePath -Algorithm SHA256).Hash -ine $BundleSHA256 -or (Test-Path -LiteralPath $configPath)){throw 'SHARED_INSTALL_ARTIFACT_REJECTED'}
$b=Get-Content -LiteralPath $BundlePath -Raw|ConvertFrom-Json -Depth 100
$db='MELISA_ERP_CRM_SHARED_TEST_20261009_02';$server='Semih\MELISADEV'
if($b.config.database -cne $db -or $b.config.server -cne $server -or $b.config.copyContext.target.database -cne $db -or $b.config.salesSqlUser -cne 'melisa_shared_test_rw_20261009_02' -or $b.config.sqlUser -cne 'melisa_shared_test_ro_20261009_02' -or $b.config.copyContext.actualT1 -ne $false -or $b.config.copyContext.sourceDatabase -cne 'MELISA_ERP_SIRKET_TEST_20260929_01'){throw 'SHARED_INSTALL_PROFILE_REJECTED'}
if($b.config.copyContext.scopeKind-cne 'VERIFIED_BUSINESS_TEST'-or$b.config.copyContext.products.Count-ne 1158-or$b.config.copyContext.customers.Count-ne 375-or$b.config.copyContext.suppliers.Count-ne 406-or$b.config.copyContext.businessInvoiceMaxExact4-cne '20000.0000'-or$b.config.copyContext.humanAccepted-ne $false-or$b.config.copyContext.externalOperations-ne $false-or$b.businessWrites-ne 0-or$b.sourceModuleHashes.Count-ne 337-or$b.sourceChecks.Count-ne 227-or$b.nativeChecks.replacements.Count-ne 4-or$b.config.currentFinanceDeltaContext.accountIds.Count-ne 283){throw 'BUSINESS_INSTALL_FINITE_PROFILE'}
$rehearsalPath=Join-Path $proofRoot 'business-install-rehearsal.json'
if($Mode-ceq 'Apply'){$review=Get-Content -LiteralPath $rehearsalPath -Raw|ConvertFrom-Json;if($review.bundleSHA256-ine $BundleSHA256-or$review.database-cne $db-or$review.copyId-cne $b.copyId-or$review.rolledBack-ne $true-or$review.status-cne 'PASS'-or$review.businessBefore-cne $review.businessAfter){throw 'BUSINESS_INSTALL_REHEARSAL_REQUIRED'}}
$raw=Get-Content -LiteralPath (Join-Path $proofRoot 'shared-raw-copy.json') -Raw|ConvertFrom-Json -AsHashtable -Depth 100
if($raw.identity.database-cne $db-or$raw.identity.server-cne $server-or$raw.groups.Count-ne 51){throw 'BUSINESS_INSTALL_RAW_PROOF'}
$cn=[Data.SqlClient.SqlConnection]::new("Server=$server;Database=$db;Integrated Security=True;Encrypt=False;Application Name=ERP-CRM-SHARED-INSTALL")
$tx=$null;$phase='CONNECT';$currentModuleName=$null
function Execute([string]$sql){$cmd=$cn.CreateCommand();$cmd.Transaction=$tx;$cmd.CommandTimeout=900;$cmd.CommandText=$sql;try{[void]$cmd.ExecuteNonQuery()}finally{$cmd.Dispose()}}
function Scalar([string]$sql){$cmd=$cn.CreateCommand();$cmd.Transaction=$tx;$cmd.CommandTimeout=900;$cmd.CommandText=$sql;try{return $cmd.ExecuteScalar()}finally{$cmd.Dispose()}}
function BusinessSnapshot {
 $groups=[ordered]@{}
 foreach($name in @($raw.groups.Keys|Sort-Object)){
  if($name-cnotmatch '^(dbo|erp_migration)\.[a-zA-Z0-9_]+$'){throw 'BUSINESS_SNAPSHOT_TABLE'}
  $parts=$name.Split('.');$qualified='['+$parts[0]+'].['+$parts[1]+']';$cmd=$cn.CreateCommand();$cmd.Transaction=$tx;$cmd.CommandTimeout=900;$cmd.CommandText="SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) rowHash FROM $qualified x ORDER BY rowHash"
  $r=$cmd.ExecuteReader();$digest=[Security.Cryptography.IncrementalHash]::CreateHash([Security.Cryptography.HashAlgorithmName]::SHA256);$count=0L
  try{$digest.AppendData([Text.Encoding]::UTF8.GetBytes('['));while($r.Read()){$h=$r.GetString(0);if($h-cnotmatch '^[A-F0-9]{64}$'){throw 'BUSINESS_ROW_PROOF'};$prefix=if($count-eq 0){'"'}else{',"'};$digest.AppendData([Text.Encoding]::UTF8.GetBytes($prefix+$h+'"'));$count++};$digest.AppendData([Text.Encoding]::UTF8.GetBytes(']'));$groups[$name]=[ordered]@{count=$count;fullRowsHashMultisetSHA256=[Convert]::ToHexString($digest.GetHashAndReset()).ToLowerInvariant();basis='SQL_FULL_ROW_JSON_UTF16_SHA256_SORTED_MULTISET'}}finally{$r.Close();$cmd.Dispose();$digest.Dispose()}
 }
 return $groups
}
function SnapshotHash($groups){$sha=[Security.Cryptography.SHA256]::Create();try{return [Convert]::ToHexString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($groups|ConvertTo-Json -Depth 10 -Compress))))}finally{$sha.Dispose()}}
try{
 $cn.Open()
 if((Scalar "SELECT CONCAT(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'|',DB_NAME(),N'|',IS_SRVROLEMEMBER('sysadmin'))") -cne "$server|$db|1"){throw 'SHARED_INSTALL_OWNER_IDENTITY'}
 $phase='BEGIN_TRANSACTION';$tx=$cn.BeginTransaction([Data.IsolationLevel]::Serializable)
 $phase='VERIFY_FULL_BUSINESS_BEFORE';$before=BusinessSnapshot
 foreach($name in $raw.groups.Keys){if($before[$name].count-ne $raw.groups[$name].count-or$before[$name].fullRowsHashMultisetSHA256-cne $raw.groups[$name].fullRowsHashMultisetSHA256){throw 'BUSINESS_INSTALL_SOURCE_ROW_DRIFT'}}
 $beforeHash=SnapshotHash $before
 $phase='VERIFY_SOURCE_MODULES_AND_CHECKS'
 if((Scalar 'SELECT COUNT(*) FROM sys.sql_modules m JOIN sys.objects o ON o.object_id=m.object_id WHERE o.is_ms_shipped=0')-ne 337){throw 'BUSINESS_INSTALL_SOURCE_MODULE_COUNT'}
 foreach($pin in $b.sourceModuleHashes){if($pin.name-cnotmatch '^[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+$'-or$pin.hash-cnotmatch '^[A-F0-9]{64}$'-or(Scalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'$($pin.name)'))),2)")-cne $pin.hash){throw 'BUSINESS_INSTALL_SOURCE_MODULE_DRIFT'}}
 foreach($pin in $b.sourceChecks){if($pin.name-cnotmatch '^[a-zA-Z0-9_]+$'-or$pin.definitionHash-cnotmatch '^[A-F0-9]{64}$'-or(Scalar "SELECT COUNT(*) FROM sys.check_constraints WHERE name=N'$($pin.name)' AND parent_object_id=OBJECT_ID(N'$($pin.schemaName).$($pin.tableName)') AND CONVERT(varchar(64),HASHBYTES('SHA2_256',definition),2)=N'$($pin.definitionHash)' AND is_disabled=0 AND is_not_trusted=0 AND is_not_for_replication=0")-ne 1){throw 'BUSINESS_INSTALL_SOURCE_CHECK_DRIFT'}}
 # Restored mappings must not let existing normal TEST credentials enter this new copy.
 # This is database-local CONNECT only; no original/server grant is modified.
 $phase='DENY_OLD_COPY_CONNECT'
 # Deny every copied login-mapped user inside DB02 only, retaining principals/roles.
 Execute "DECLARE @deny nvarchar(max)=N'';SELECT @deny=@deny+N'DENY CONNECT TO '+QUOTENAME(name)+N';' FROM sys.database_principals WHERE type IN('S','U','G') AND principal_id>4 AND SUSER_SNAME(sid) IS NOT NULL;EXEC sys.sp_executesql @deny;"
 $phase='VERIFY_ACTORS'
 foreach($actor in $b.config.copyContext.actors){
  if($actor.id -cnotin @('15','16') -or $actor.nativeRoleId -cne $actor.id -or $actor.role -cne $(if($actor.id -ceq '15'){'isolated_test_sales'}else{'isolated_test_ilker'}) -or $actor.permissionsRowsHash -cnotmatch '^[A-Fa-f0-9]{64}$'){throw 'SHARED_INSTALL_ACTOR_PROFILE'}
  if((Scalar "SELECT COUNT(*) FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id AND r.is_active=1 WHERE u.id=$($actor.id) AND u.role_id=$($actor.nativeRoleId) AND u.is_active=1 AND r.code=N'$($actor.role)'") -ne 1){throw 'SHARED_INSTALL_ACTOR_DRIFT'}
  if((Scalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT p.* FROM dbo.permissions p WHERE p.role_id=$($actor.nativeRoleId) ORDER BY p.id FOR JSON PATH,INCLUDE_NULL_VALUES)),2)") -cne $actor.permissionsRowsHash){throw 'SHARED_INSTALL_PERMISSION_DRIFT'}
 }
 $phase='INSTALL_SCHEMA';Execute $b.schemaSQL
 $phase='INSTALL_NEW_MODULE';foreach($m in $b.newDefinitions){$currentModuleName=$m.name;Execute $m.definition}
 $phase='REPLACE_MODULE';foreach($m in $b.replacements){$currentModuleName=$m.name;if($m.name -cnotmatch '^dbo\.[a-zA-Z0-9_]+$' -or $m.beforeHash -cnotmatch '^[A-F0-9]{64}$' -or (Scalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'$($m.name)'))),2)") -cne $m.beforeHash){throw 'SHARED_INSTALL_MODULE_BEFORE_DRIFT'};Execute $m.definition}
 # The source's two finite purchase scope FKs bind source-only fixture IDs.
 # Rebind exactly these constraints to the copied existing product master.
 $phase='REBIND_PURCHASE_FK';$currentModuleName=$null
 foreach($fk in @(@('FK__test_good__produ__5654B625','test_goods_batch_lines'),@('FK__test_purc__produ__69678A99','test_purchase_batch_intent_lines'))){
  $name=$fk[0];$table=$fk[1];$currentModuleName='dbo.'+$name
  $shape="SELECT COUNT(*) FROM sys.foreign_keys k JOIN sys.foreign_key_columns c ON c.constraint_object_id=k.object_id WHERE k.name=N'$name' AND k.parent_object_id=OBJECT_ID(N'dbo.$table') AND COL_NAME(c.parent_object_id,c.parent_column_id)=N'product_id' AND k.referenced_object_id=OBJECT_ID(N'dbo.test_purchase_batch_scope') AND COL_NAME(c.referenced_object_id,c.referenced_column_id)=N'product_id' AND c.constraint_column_id=1 AND k.is_disabled=0 AND k.is_not_trusted=0 AND k.is_not_for_replication=0 AND k.delete_referential_action=0 AND k.update_referential_action=0 AND (SELECT COUNT(*) FROM sys.foreign_key_columns f WHERE f.constraint_object_id=k.object_id)=1"
  if((Scalar $shape) -ne 1){throw 'SHARED_PURCHASE_FK_SOURCE_DRIFT'}
  Execute "ALTER TABLE dbo.[$table] DROP CONSTRAINT [$name]; ALTER TABLE dbo.[$table] WITH CHECK ADD CONSTRAINT [$name] FOREIGN KEY(product_id) REFERENCES dbo.products(id); ALTER TABLE dbo.[$table] CHECK CONSTRAINT [$name];"
  if((Scalar "SELECT COUNT(*) FROM sys.foreign_keys WHERE name=N'$name' AND parent_object_id=OBJECT_ID(N'dbo.$table') AND referenced_object_id=OBJECT_ID(N'dbo.products') AND is_disabled=0 AND is_not_trusted=0") -ne 1){throw 'SHARED_PURCHASE_FK_COPY_DRIFT'}
 }
 $phase='RESTORE_FIRST_ORDER';foreach($o in $b.originalFirstOrder){$currentModuleName=$o.name;if($o.name -cnotmatch '^dbo\.[a-zA-Z0-9_]+$'){throw 'SHARED_INSTALL_FIRST_ORDER'};foreach($pair in @(@('insert',$o.insert),@('update',$o.update),@('delete',$o.delete))){if($pair[1] -eq 1){Execute "EXEC sys.sp_settriggerorder @triggername=N'$($o.name)',@order=N'First',@stmttype=N'$($pair[0])'"}}}
 $phase='INSTALL_COUPLED_NATIVE_CHECKS'
 if((Scalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_stage4_copy_guard'))),2)")-cne $b.nativeChecks.requiredNativeGuardHash){throw 'BUSINESS_CHECK_GUARD_HASH'}
 foreach($c in $b.nativeChecks.replacements){$currentModuleName=$c.name;if($c.name-cnotmatch '^[a-zA-Z0-9_]+$'-or$c.table-cnotmatch '^dbo\.[a-zA-Z0-9_]+$'){throw 'BUSINESS_CHECK_NAME'};Execute $c.sql;if((Scalar "SELECT COUNT(*) FROM sys.check_constraints WHERE name=N'$($c.name)' AND parent_object_id=OBJECT_ID(N'$($c.table)') AND CONVERT(varchar(64),HASHBYTES('SHA2_256',definition),2)=N'$($c.afterHash)' AND parent_column_id=$($c.afterParentColumnId) AND is_disabled=0 AND is_not_trusted=0 AND is_not_for_replication=0")-ne 1){$canonical=@{name=$c.name;table=$c.table;expectedHash=$c.afterHash;expectedDefinition=$c.afterDefinition;actualDefinition=(Scalar "SELECT definition FROM sys.check_constraints WHERE name=N'$($c.name)' AND parent_object_id=OBJECT_ID(N'$($c.table)')");actualHash=(Scalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',definition),2) FROM sys.check_constraints WHERE name=N'$($c.name)' AND parent_object_id=OBJECT_ID(N'$($c.table)')")};[IO.File]::WriteAllText((Join-Path $proofRoot 'business-check-canonical-failure.json'),($canonical|ConvertTo-Json),[Text.UTF8Encoding]::new($false));throw 'BUSINESS_CHECK_STORED_HASH_DRIFT'}}
 $phase='SEAL_MODULE_MANIFEST';$currentModuleName=$null;foreach($m in $b.moduleManifest){$currentModuleName=$m.name;$cmd=$cn.CreateCommand();$cmd.Transaction=$tx;$cmd.CommandText='INSERT dbo.stage4_copy_module_manifest(name,before_hash,after_hash,kind) VALUES(@name,@before,@after,@kind)';foreach($p in @(@('name',$m.name),@('before',$m.beforeHash),@('after',$m.afterHash),@('kind',$m.kind))){$null=$cmd.Parameters.Add('@'+$p[0],[Data.SqlDbType]::NVarChar,128);$cmd.Parameters['@'+$p[0]].Value=if($null -eq $p[1]){[DBNull]::Value}else{$p[1]}};$null=$cmd.ExecuteNonQuery();$cmd.Dispose()}
 $phase='SEAL_PROFILE';$currentModuleName= $null;$cmd=$cn.CreateCommand();$cmd.Transaction=$tx;$cmd.CommandText='INSERT dbo.stage4_copy_manifest(copy_id,profile_json,seal_hash,backup_sha,sealed) VALUES(@id,@json,@seal,@backup,1)';$null=$cmd.Parameters.Add('@id',[Data.SqlDbType]::UniqueIdentifier);$cmd.Parameters['@id'].Value=[Guid]$b.copyId;$null=$cmd.Parameters.Add('@json',[Data.SqlDbType]::NVarChar,-1);$cmd.Parameters['@json'].Value=$b.profileJSON;foreach($p in @(@('seal',$b.config.copyContext.sealHash),@('backup',$b.config.copyContext.backupSHA))){$null=$cmd.Parameters.Add('@'+$p[0],[Data.SqlDbType]::VarChar,64);$cmd.Parameters['@'+$p[0]].Value=$p[1]};$null=$cmd.ExecuteNonQuery();$cmd.Dispose()
 $phase='CREATE_FRESH_PRINCIPALS';$currentModuleName=$null
 foreach($spec in @(@($b.config.salesSqlUser,$b.config.salesSqlPassword),@($b.config.sqlUser,$b.config.sqlPassword))){$name=$spec[0];$pass=$spec[1];if($name -cnotin @('melisa_shared_test_rw_20261009_02','melisa_shared_test_ro_20261009_02') -or $pass -cnotmatch '^[a-f0-9]{96}$'){throw 'SHARED_CREDENTIAL_SHAPE'};Execute "IF SUSER_ID(N'$name') IS NOT NULL THROW 51909,'SHARED_LOGIN_ALREADY_EXISTS',1;CREATE LOGIN [$name] WITH PASSWORD=N'$pass',DEFAULT_DATABASE=[$db],CHECK_POLICY=OFF;CREATE USER [$name] FOR LOGIN [$name];GRANT CONNECT TO [$name];GRANT SELECT TO [$name];"}
 $phase='GRANT_FINITE_RUNTIME';$rw=$b.config.salesSqlUser
 foreach($m in $b.newDefinitions|Where-Object {$_.name -like 'dbo.usp_stage4_copy_*'}){Execute "GRANT EXECUTE ON $($m.name) TO [$rw]"}
 foreach($m in $b.replacements|Where-Object {$_.kind -eq 'PRESERVED_COPY_READER'}){Execute "GRANT EXECUTE ON $($m.name) TO [$rw]"}
 # The native service calls the copied check in its existing verified transaction.
 # Its owner-executed nested resolver remains private; grant only this entrypoint.
 $quarantineCheck=@($b.replacements|Where-Object {$_.kind -eq 'QUARANTINE_NESTED_COPY_VERIFIER' -and $_.name -ceq 'dbo.usp_check_operation_quarantine'})
 if($quarantineCheck.Count -ne 1){throw 'SHARED_QUARANTINE_CHECK_REQUIRED'}
 Execute "GRANT EXECUTE ON dbo.usp_check_operation_quarantine TO [$rw]"
 foreach($m in $b.newDefinitions|Where-Object {$_.kind -eq 'FINITE_COPY_NATIVE_GUARD'}){$table=$m.name.Replace('dbo.stage4_guard_','');if($table -cnotmatch '^[a-z_]+$'){throw 'SHARED_DML_TABLE_REJECTED'};Execute "GRANT INSERT,UPDATE,DELETE ON dbo.[$table] TO [$rw]"}
 Execute "GRANT INSERT ON dbo.stage4_copy_requests TO [$rw];GRANT INSERT ON dbo.work_business_count_bindings TO [$rw];GRANT VIEW DEFINITION TO [$rw];GRANT VIEW DEFINITION TO [$($b.config.sqlUser)];"
 $phase='INSTALL_PARTY_READER_ALIASES';Execute $b.partyReaderAdjunct.preflightSQL;foreach($m in $b.partyReaderAdjunct.replacements){$currentModuleName=$m.name;Execute $m.definition};Execute $b.partyReaderAdjunct.postflightSQL;Execute $b.partyReaderAdjunct.permissionsSQL
 $phase='VERIFY_INSTALLED_HASHES';$currentModuleName=$null
 if((Scalar "SELECT COUNT(*) FROM dbo.stage4_copy_module_manifest WHERE after_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(name))),2)") -ne 0){throw 'SHARED_INSTALLED_MODULE_HASH_DRIFT'}
 if((Scalar "SELECT COUNT(*) FROM sys.triggers WHERE name LIKE N'operation[_]quarantine[_]%' AND is_disabled=0 AND OBJECTPROPERTY(object_id,'ExecIsFirstInsertTrigger')=1 AND OBJECTPROPERTY(object_id,'ExecIsFirstUpdateTrigger')=1 AND OBJECTPROPERTY(object_id,'ExecIsFirstDeleteTrigger')=1")-ne 37-or(Scalar 'SELECT COUNT(*) FROM erp_migration.operation_quarantine_holds')-ne 176){throw 'BUSINESS_INSTALL_QUARANTINE_STATE'}
 foreach($pin in $b.nativeChecks.unchangedChecks){if((Scalar "SELECT COUNT(*) FROM sys.check_constraints WHERE name=N'$($pin.name)' AND parent_object_id=OBJECT_ID(N'$($pin.schemaName).$($pin.tableName)') AND CONVERT(varchar(64),HASHBYTES('SHA2_256',definition),2)=N'$($pin.definitionHash)' AND is_disabled=0 AND is_not_trusted=0 AND is_not_for_replication=0")-ne 1){throw 'BUSINESS_INSTALL_UNCHANGED_CHECK_DRIFT'}}
 $phase='VERIFY_FULL_BUSINESS_AFTER';$after=BusinessSnapshot;$afterHash=SnapshotHash $after;if($beforeHash-cne $afterHash){throw 'BUSINESS_INSTALL_BUSINESS_ROW_CHANGED'}
 if($Mode-ceq 'Rehearse'){$phase='ROLLBACK_REHEARSAL';$tx.Rollback();$tx.Dispose();$tx=$null;$postRollback=BusinessSnapshot;if((SnapshotHash $postRollback)-cne $beforeHash-or(Scalar "SELECT COUNT(*) FROM sys.tables WHERE name=N'stage4_copy_manifest'")-ne 0-or(Scalar "SELECT COUNT(*) FROM sys.server_principals WHERE name IN(N'melisa_shared_test_rw_20261009_02',N'melisa_shared_test_ro_20261009_02')")-ne 0){throw 'BUSINESS_REHEARSAL_ROLLBACK_PROOF'};$result=@{status='PASS';database=$db;copyId=$b.copyId;bundleSHA256=$BundleSHA256.ToUpperInvariant();rolledBack=$true;businessBefore=$beforeHash;businessAfter=$afterHash;tablesCompared=51;originalModulesCompared=337;manifestModules=$b.moduleManifest.Count;nativeChecks=4;quarantineFirstTriggers=37;holds=176;businessWrites=0;recordedAt=[DateTime]::UtcNow.ToString('o')};[IO.File]::WriteAllText($rehearsalPath,($result|ConvertTo-Json),[Text.UTF8Encoding]::new($false));$result|ConvertTo-Json;return}
 $phase='COMMIT_INSTALL';$tx.Commit();$tx.Dispose();$tx=$null
 $phase='SAVE_PRIVATE_CONFIG';New-Item -ItemType Directory -Path $runtimeRoot -Force|Out-Null
 [IO.File]::WriteAllText($configPath,($b.config|ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
 Protect-BusinessPrivateFile $configPath
 $result=@{status='APPLIED';database=$db;copyId=$b.copyId;bundleSHA256=$BundleSHA256.ToUpperInvariant();businessBefore=$beforeHash;businessAfter=$afterHash;tablesCompared=51;manifestModules=$b.moduleManifest.Count;nativeChecks=4;quarantineFirstTriggers=37;holds=176;businessWrites=0;existingRolesChanged=$false;recordedAt=[DateTime]::UtcNow.ToString('o')};[IO.File]::WriteAllText((Join-Path $proofRoot 'business-install-applied.json'),($result|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
 @{status='APPLIED';database=$db;copyId=$b.copyId;modules=$b.moduleManifest.Count;existingRolesChanged=$false;guardsDisabled=0;businessWrites=0;configPath=$configPath}|ConvertTo-Json
}catch{
 $errorBase=$_.Exception.GetBaseException();$rollback='not_started';if($tx){try{$tx.Rollback();$rollback='completed'}catch{$rollback='failed'}}
 $sqlError=if($errorBase -is [Data.SqlClient.SqlException]){$errorBase}else{$null}
 $safeCode=if($errorBase.Message-cmatch '^(BUSINESS|SHARED)_[A-Z0-9_]+$'){$errorBase.Message}else{$null}
 $safeFailure=[ordered]@{phase=$phase;currentModuleName=$currentModuleName;errorType=$errorBase.GetType().FullName;errorCode=$safeCode;sqlErrorNumber=$(if($sqlError){$sqlError.Number}else{$null});sqlProcedure=$(if($sqlError){$sqlError.Procedure}else{$null});sqlLineNumber=$(if($sqlError){$sqlError.LineNumber}else{$null});rollback=$rollback;recordedAt=[DateTime]::UtcNow.ToString('o')}
 [IO.File]::WriteAllText((Join-Path $proofRoot 'shared-install-failure.json'),($safeFailure|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
 throw 'SHARED_INSTALL_STOPPED; safe diagnostic saved privately; no automatic source reset'
}finally{if($tx){$tx.Dispose()};$cn.Dispose()}
