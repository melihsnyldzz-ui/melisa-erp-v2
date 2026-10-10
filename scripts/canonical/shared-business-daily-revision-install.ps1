param(
 [Parameter(Mandatory=$true)][string]$ArtifactPath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[A-Fa-f0-9]{64}$')][string]$ArtifactSHA256,
 [Parameter(Mandatory=$true)][string]$ProofPath,
 [ValidateSet('Rehearse','Apply')][string]$Mode='Rehearse',
 [string]$RehearsalProofPath
)
# Owner-only finite DB02 DDL. No config rewrite, restore, opening or native DML.
$ErrorActionPreference='Stop'
$db='MELISA_ERP_CRM_SHARED_TEST_20261009_02';$server='Semih\MELISADEV';$registry='dbo.stage4_copy_business_daily_revisions';$trigger='dbo.immutable_stage4_copy_business_daily_revisions'
if((Get-FileHash -LiteralPath $ArtifactPath -Algorithm SHA256).Hash-ine $ArtifactSHA256){throw 'BUSINESS_DAILY_ARTIFACT_HASH'}
$a=Get-Content -LiteralPath $ArtifactPath -Raw|ConvertFrom-Json -Depth 100
if($a.schemaVersion-cne 'melisa-business-copy-daily-install.v1'-or$a.target.database-cne $db-or$a.target.server-cne $server-or$a.target.login-cne 'melisa_shared_test_rw_20261009_02'-or$a.revision.version-ne 4-or$a.replacements.Count-ne 8-or$a.revision.modules.Count-ne 8-or$a.businessWrites-ne 0-or$a.openingHumanAccepted-ne $false-or$a.realFinancialOpeningAuthorized-ne $false-or$a.nativeChecksUnchanged-ne $true-or$a.sourceModuleHashes.Count-ne 337-or$a.nativeCheckInventory.Count-ne 227){throw 'BUSINESS_DAILY_ARTIFACT_TARGET'}
foreach($m in $a.replacements){if($m.name-cnotmatch '^dbo\.usp_(stage4_copy_(ready|context|begin|guard|effects)|business_daily_(context|begin|guard))$'-or$m.afterHash-cnotmatch '^[A-F0-9]{64}$'-or($null-ne$m.beforeHash-and$m.beforeHash-cnotmatch '^[A-F0-9]{64}$')){throw 'BUSINESS_DAILY_MODULE_INPUT'}}
if($Mode-ceq 'Apply'){
 if(-not$RehearsalProofPath){throw 'BUSINESS_DAILY_REHEARSAL_REQUIRED'}
 $r=Get-Content -LiteralPath $RehearsalProofPath -Raw|ConvertFrom-Json
 if($r.status-cne 'PASS'-or$r.rolledBack-ne $true-or$r.artifactSHA256-ine $ArtifactSHA256-or$r.revisionHash-cne $a.revision.revisionHash-or$r.businessBefore-cne $r.businessAfter-or$r.oldProofBefore-cne $r.oldProofAfter-or$r.sqlBefore-cne $r.sqlAfter){throw 'BUSINESS_DAILY_REHEARSAL_REQUIRED'}
}
$raw=Get-Content -LiteralPath 'C:\Sirket\ERP\evidence\ERP-CRM-EXPAND-20261009\private\infra\shared-raw-copy.json' -Raw|ConvertFrom-Json -AsHashtable -Depth 100
if($raw.identity.database-cne $db-or$raw.identity.server-cne $server-or$raw.groups.Count-ne 51){throw 'BUSINESS_DAILY_PROTECTED_SCOPE'}
$cn=[Data.SqlClient.SqlConnection]::new("Server=$server;Database=$db;Integrated Security=True;Encrypt=False;Application Name=BUSINESS-DAILY-REVISION-OWNER");$tx=$null;$phase='CONNECT';$committed=$false
function QueryScalar([string]$sql){$cmd=$cn.CreateCommand();$cmd.Transaction=$tx;$cmd.CommandTimeout=900;$cmd.CommandText=$sql;try{return $cmd.ExecuteScalar()}finally{$cmd.Dispose()}}
function ExecuteDDL([string]$sql){$cmd=$cn.CreateCommand();$cmd.Transaction=$tx;$cmd.CommandTimeout=900;$cmd.CommandText=$sql;try{[void]$cmd.ExecuteNonQuery()}finally{$cmd.Dispose()}}
function HashText([string]$text){return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($text)))}
function BusinessHash{
 $groups=[ordered]@{}
 foreach($name in @($raw.groups.Keys|Sort-Object)){
  if($name-cnotmatch '^(dbo|erp_migration)\.[a-zA-Z0-9_]+$'){throw 'BUSINESS_DAILY_PROTECTED_TABLE'}
  $p=$name.Split('.');$qualified='['+$p[0]+'].['+$p[1]+']'
  $cmd=$cn.CreateCommand();$cmd.Transaction=$tx;$cmd.CommandTimeout=900;$cmd.CommandText="SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) h FROM $qualified x ORDER BY h"
  $reader=$cmd.ExecuteReader();$digest=[Security.Cryptography.IncrementalHash]::CreateHash([Security.Cryptography.HashAlgorithmName]::SHA256);$count=0L
  try{while($reader.Read()){$h=$reader.GetString(0);if($h-cnotmatch '^[A-F0-9]{64}$'){throw 'BUSINESS_DAILY_PROTECTED_HASH'};$digest.AppendData([Text.Encoding]::UTF8.GetBytes($h+"`n"));$count++};$groups[$name]=@{count=$count;hash=[Convert]::ToHexString($digest.GetHashAndReset())}}
  finally{$reader.Close();$cmd.Dispose();$digest.Dispose()}
 }
 return HashText ($groups|ConvertTo-Json -Depth 5 -Compress)
}
function OldProofHash{
 $hashes=@();foreach($entry in @(@('stage4_copy_manifest','copy_id'),@('stage4_copy_module_manifest','name'),@('stage4_copy_ready_revisions','copy_id'),@('stage4_copy_ready_performance_revisions','copy_id'),@('stage4_copy_effects_performance_revisions','copy_id,name'),@('stage4_copy_requests','copy_id,request_id'),@('stage4_copy_intents','copy_id,request_id'),@('stage4_copy_effect_components','copy_id,request_id,entity,native_id'),@('work_business_count_bindings','count_id'))){$hashes+=QueryScalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT * FROM dbo.$($entry[0]) ORDER BY $($entry[1]) FOR JSON PATH,INCLUDE_NULL_VALUES)),2)"}
 $hashes+=QueryScalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT role_principal_id,member_principal_id FROM sys.database_role_members ORDER BY role_principal_id,member_principal_id FOR JSON PATH)),2)"
 return HashText ($hashes|ConvertTo-Json -Compress)
}
function ProtectedSQLHash{
 $excluded=(@($a.replacements.name)+$trigger|ForEach-Object {"ISNULL(OBJECT_ID(N'$_'),-1)"})-join ','
 $modules=QueryScalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT OBJECT_SCHEMA_NAME(m.object_id) schemaName,OBJECT_NAME(m.object_id) name,m.definition FROM sys.sql_modules m WHERE m.object_id NOT IN($excluded) ORDER BY m.object_id FOR JSON PATH,INCLUDE_NULL_VALUES)),2)"
 $checks=QueryScalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT c.* FROM sys.check_constraints c WHERE c.parent_object_id<>ISNULL(OBJECT_ID(N'$registry'),0) ORDER BY c.object_id FOR JSON PATH,INCLUDE_NULL_VALUES)),2)"
 $triggers=QueryScalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT t.object_id,t.name,t.is_disabled,OBJECTPROPERTY(t.object_id,'ExecIsFirstInsertTrigger') firstI,OBJECTPROPERTY(t.object_id,'ExecIsFirstUpdateTrigger') firstU,OBJECTPROPERTY(t.object_id,'ExecIsFirstDeleteTrigger') firstD FROM sys.triggers t WHERE t.object_id<>ISNULL(OBJECT_ID(N'$trigger'),0) ORDER BY t.object_id FOR JSON PATH,INCLUDE_NULL_VALUES)),2)"
 return HashText (@($modules,$checks,$triggers)|ConvertTo-Json -Compress)
}
try{
 $cn.Open();if((QueryScalar "SELECT CONCAT(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'|',DB_NAME(),N'|',IS_SRVROLEMEMBER('sysadmin'))")-cne "$server|$db|1"){throw 'BUSINESS_DAILY_OWNER_IDENTITY'}
 $tx=$cn.BeginTransaction([Data.IsolationLevel]::Serializable);$phase='VERIFY_BASE'
 if((QueryScalar "DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=N'melisa-stage4-copy:$($a.copyId)',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=10000;SELECT @r")-lt 0){throw 'BUSINESS_DAILY_COPY_BUSY'}
 if((QueryScalar "SELECT COUNT(*) FROM dbo.stage4_copy_manifest WHERE copy_id='$($a.copyId)' AND seal_hash='$($a.baseSealHash)' AND backup_sha='$($a.backupSHA)' AND sealed=1")-ne 1-or(QueryScalar 'SELECT COUNT(*) FROM dbo.stage4_copy_module_manifest')-ne 185-or(QueryScalar "SELECT COUNT(*) FROM dbo.stage4_copy_effects_performance_revisions WHERE revision=3 AND revision_hash='$($a.baseEffectsRevision.revisionHash)'")-ne 2-or(QueryScalar "SELECT ISNULL(OBJECTPROPERTY(OBJECT_ID(N'dbo.immutable_stage4_copy_effects_performance_revisions'),'ExecIsTriggerDisabled'),1)")-ne 0-or(QueryScalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.immutable_stage4_copy_effects_performance_revisions'))),2)")-cne $a.baseEffectsRevision.immutableTriggerHash-or(QueryScalar "SELECT COUNT(*) FROM sys.tables WHERE object_id=OBJECT_ID(N'$registry')")-ne 0){throw 'BUSINESS_DAILY_BASE_DRIFT'}
 foreach($m in $a.replacements){$actual=QueryScalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'$($m.name)'))),2)";if($null-eq$m.beforeHash){if($null-ne$actual-and$actual-isnot[DBNull]){throw 'BUSINESS_DAILY_HELPER_ALREADY_EXISTS'}}elseif($actual-cne$m.beforeHash){throw 'BUSINESS_DAILY_PREDECESSOR_HASH'}}
 $phase='PROTECT_BEFORE';$businessBefore=BusinessHash;$oldBefore=OldProofHash;$sqlBefore=ProtectedSQLHash
 $phase='INSTALL_REVIEWED_DDL';ExecuteDDL $a.tableSQL;ExecuteDDL $a.immutableSQL
 if((QueryScalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'$trigger'))),2)")-cne$a.revision.immutableTriggerHash){throw 'BUSINESS_DAILY_TRIGGER_DEFINITION'}
 foreach($m in $a.replacements){ExecuteDDL $m.definition;if((QueryScalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'$($m.name)'))),2)")-cne$m.afterHash){throw 'BUSINESS_DAILY_INSTALLED_HASH'}}
 $phase='APPEND_EIGHT_ROWS';$values=@();$cmd=$cn.CreateCommand();$cmd.Transaction=$tx;$cmd.CommandTimeout=10
 foreach($entry in @(@('copy',[Data.SqlDbType]::UniqueIdentifier,[Guid]$a.copyId),@('seal',[Data.SqlDbType]::Char,$a.baseSealHash,64),@('base',[Data.SqlDbType]::Char,$a.baseEffectsRevision.revisionHash,64),@('revision',[Data.SqlDbType]::Char,$a.revision.revisionHash,64),@('scope',[Data.SqlDbType]::Char,$a.revision.dailyScopeHash,64),@('profile',[Data.SqlDbType]::NVarChar,$a.dailyProfileJSON,-1))){$parameter=if($entry.Count-eq 4){$cmd.Parameters.Add('@'+$entry[0],$entry[1],$entry[3])}else{$cmd.Parameters.Add('@'+$entry[0],$entry[1])};$parameter.Value=$entry[2]}
 for($i=0;$i-lt$a.replacements.Count;$i++){$m=$a.replacements[$i];$cmd.Parameters.Add('@name'+$i,[Data.SqlDbType]::NVarChar,128).Value=$m.name;$cmd.Parameters.Add('@before'+$i,[Data.SqlDbType]::Char,64).Value=if($null-eq$m.beforeHash){[DBNull]::Value}else{$m.beforeHash};$cmd.Parameters.Add('@after'+$i,[Data.SqlDbType]::Char,64).Value=$m.afterHash;$values+="(@copy,@name$i,4,@seal,@base,@before$i,@after$i,@revision,@scope,@profile)"}
 $cmd.CommandText="INSERT $registry(copy_id,name,revision,base_seal_hash,base_effects_revision_hash,before_hash,after_hash,revision_hash,daily_scope_hash,daily_profile_json) VALUES "+($values-join ',');try{[void]$cmd.ExecuteNonQuery()}finally{$cmd.Dispose()}
 foreach($principal in @('melisa_shared_test_rw_20261009_02','melisa_shared_test_ro_20261009_02')){
  ExecuteDDL "GRANT SELECT ON OBJECT::$registry TO [$principal];GRANT VIEW DEFINITION ON OBJECT::$registry TO [$principal];"
  foreach($m in $a.replacements){ExecuteDDL "GRANT VIEW DEFINITION ON OBJECT::$($m.name) TO [$principal];"}
 }
 # Helpers receive no public/reader EXECUTE grant; normal endpoints call the
 # existing owned procedures. Existing native CHECKs and trigger order stay.
 $phase='PROTECT_AFTER';$businessAfter=BusinessHash;$oldAfter=OldProofHash;$sqlAfter=ProtectedSQLHash
 if($businessBefore-cne$businessAfter-or$oldBefore-cne$oldAfter-or$sqlBefore-cne$sqlAfter-or(QueryScalar "SELECT COUNT(*) FROM $registry")-ne 8-or(QueryScalar 'SELECT COUNT(*) FROM sys.triggers WHERE is_disabled=1')-ne 0){throw 'BUSINESS_DAILY_PROTECTION_DRIFT'}
 $proof=[ordered]@{status='PASS';artifactSHA256=$ArtifactSHA256.ToUpperInvariant();revisionHash=$a.revision.revisionHash;dailyScopeHash=$a.revision.dailyScopeHash;database=$db;copyId=$a.copyId;businessBefore=$businessBefore;businessAfter=$businessAfter;oldProofBefore=$oldBefore;oldProofAfter=$oldAfter;sqlBefore=$sqlBefore;sqlAfter=$sqlAfter;businessWrites=0;openingHumanAccepted=$false;realFinancialOpeningAuthorized=$false;nativeChecksChanged=0;rolesChanged=$false;normalEndpointExecution='NOT_ATTEMPTED_OWNER_DDL_ONLY';recordedAt=[DateTime]::UtcNow.ToString('o')}
 if($Mode-ceq 'Rehearse'){$tx.Rollback();$tx.Dispose();$tx=$null;$proof.rolledBack=$true}else{$tx.Commit();$tx.Dispose();$tx=$null;$committed=$true;$proof.sqlCommitted=$true;$proof.configAdjunctPersisted=$false}
 [IO.File]::WriteAllText($ProofPath,($proof|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false));$proof|ConvertTo-Json -Depth 4
}catch{
 $rolledBack=$false;if($tx){try{$tx.Rollback();$rolledBack=$true}catch{}}
 $ex=$_.Exception;while($ex.InnerException-and-not($ex-is[Data.SqlClient.SqlException])){$ex=$ex.InnerException};$errors=@();foreach($e in $ex.Errors){$errors+=@{number=$e.Number;procedure=$e.Procedure;line=$e.LineNumber;safeCode=if($e.Message-cmatch '^[A-Z][A-Z0-9_]+$'){$e.Message}else{$null}}}
 $failure=@{status='STOPPED';phase=$phase;sqlCommitted=$committed;rolledBack=$rolledBack;errors=$errors;errorCode=if($ex.Message-cmatch '^BUSINESS_DAILY_[A-Z0-9_]+$'){$ex.Message}else{$null};recordedAt=[DateTime]::UtcNow.ToString('o')};[IO.File]::WriteAllText($ProofPath,($failure|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false));$failure|ConvertTo-Json -Depth 6;throw 'BUSINESS_DAILY_STOPPED_PRIVATE_DIAGNOSTIC'
}finally{if($tx){$tx.Dispose()};$cn.Close();$cn.Dispose()}
