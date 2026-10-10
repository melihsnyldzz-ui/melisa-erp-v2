param(
 [Parameter(Mandatory=$true)][string]$ArtifactPath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[A-Fa-f0-9]{64}$')][string]$ArtifactSHA256,
 [Parameter(Mandatory=$true)][string]$ProofPath,
 [ValidateSet('Rehearse','Apply')][string]$Mode='Rehearse',
 [string]$RehearsalProofPath
)
$ErrorActionPreference='Stop'
$db='MELISA_ERP_CRM_SHARED_TEST_20261009_02';$server='Semih\MELISADEV'
$registry='dbo.stage4_copy_business_daily_profit_revisions';$trigger='dbo.immutable_stage4_copy_business_daily_profit_revisions'
if((Get-FileHash -LiteralPath $ArtifactPath -Algorithm SHA256).Hash-ine$ArtifactSHA256){throw 'DAILY_PROFIT_ARTIFACT_HASH'}
$a=Get-Content -LiteralPath $ArtifactPath -Raw|ConvertFrom-Json -Depth 100
if($a.schemaVersion-cne'melisa-business-daily-profit-install.v1'-or$a.target.database-cne$db-or$a.target.server-cne$server-or$a.target.login-cne'melisa_shared_test_rw_20261009_02'-or$a.revision.version-ne5-or$a.replacements.Count-ne3-or$a.revision.modules.Count-ne3-or$a.baseDailyRevision.modules.Count-ne8-or$a.businessWrites-ne0-or$a.openingHumanAccepted-ne$false-or$a.realFinancialOpeningAuthorized-ne$false-or$a.nativeChecksUnchanged-ne$true-or$a.rolesChanged-ne$false){throw 'DAILY_PROFIT_TARGET'}
foreach($m in $a.replacements){if($m.name-cnotmatch'^dbo\.usp_(business_daily_(guard|context)|stage4_copy_ready)$'-or$m.beforeHash-cnotmatch'^[A-F0-9]{64}$'-or$m.afterHash-cnotmatch'^[A-F0-9]{64}$'){throw 'DAILY_PROFIT_MODULE_INPUT'}}
# Offline canonical compiler validation rejects altered SQL and revision hashes.
$compiler=Join-Path $PSScriptRoot 'shared-business-daily-profit-revision.mjs'
& node $compiler verify $ArtifactPath
if($LASTEXITCODE-ne0){throw 'DAILY_PROFIT_COMPILER_VALIDATION'}
if($Mode-ceq'Apply'){
 if(-not$RehearsalProofPath){throw 'DAILY_PROFIT_REHEARSAL_REQUIRED'}
 $r=Get-Content -LiteralPath $RehearsalProofPath -Raw|ConvertFrom-Json
 if($r.status-cne'PASS'-or$r.rolledBack-ne$true-or$r.artifactSHA256-ine$ArtifactSHA256-or$r.revisionHash-cne$a.revision.revisionHash-or$r.dailyScopeHash-cne$a.revision.dailyScopeHash-or$r.businessBefore-cne$r.businessAfter-or$r.oldProofBefore-cne$r.oldProofAfter-or$r.sqlBefore-cne$r.sqlAfter){throw 'DAILY_PROFIT_REHEARSAL_REQUIRED'}
}
$raw=Get-Content -LiteralPath 'C:\Sirket\ERP\evidence\ERP-CRM-EXPAND-20261009\private\infra\shared-raw-copy.json' -Raw|ConvertFrom-Json -AsHashtable -Depth 100
if($raw.identity.database-cne$db-or$raw.identity.server-cne$server-or$raw.groups.Count-ne51){throw 'DAILY_PROFIT_PROTECTED_SCOPE'}
$cn=[Data.SqlClient.SqlConnection]::new("Server=$server;Database=$db;Integrated Security=True;Encrypt=False;Application Name=DAILY-PROFIT-REVISION-OWNER");$tx=$null;$phase='CONNECT';$committed=$false
function QueryScalar([string]$sql){$cmd=$cn.CreateCommand();$cmd.Transaction=$tx;$cmd.CommandTimeout=900;$cmd.CommandText=$sql;try{return $cmd.ExecuteScalar()}finally{$cmd.Dispose()}}
function ExecuteDDL([string]$sql){$cmd=$cn.CreateCommand();$cmd.Transaction=$tx;$cmd.CommandTimeout=900;$cmd.CommandText=$sql;try{[void]$cmd.ExecuteNonQuery()}finally{$cmd.Dispose()}}
function HashText([string]$text){return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($text)))}
function BusinessHash{
 $groups=[ordered]@{}
 foreach($name in @($raw.groups.Keys|Sort-Object)){
  if($name-cnotmatch'^(dbo|erp_migration)\.[a-zA-Z0-9_]+$'){throw 'DAILY_PROFIT_PROTECTED_TABLE'}
  $p=$name.Split('.');$qualified='['+$p[0]+'].['+$p[1]+']'
  $cmd=$cn.CreateCommand();$cmd.Transaction=$tx;$cmd.CommandTimeout=900;$cmd.CommandText="SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) h FROM $qualified x ORDER BY h"
  $reader=$cmd.ExecuteReader();$digest=[Security.Cryptography.IncrementalHash]::CreateHash([Security.Cryptography.HashAlgorithmName]::SHA256);$count=0L
  try{while($reader.Read()){$h=$reader.GetString(0);if($h-cnotmatch'^[A-F0-9]{64}$'){throw 'DAILY_PROFIT_PROTECTED_HASH'};$digest.AppendData([Text.Encoding]::UTF8.GetBytes($h+"`n"));$count++};$groups[$name]=@{count=$count;hash=[Convert]::ToHexString($digest.GetHashAndReset())}}
  finally{$reader.Close();$cmd.Dispose();$digest.Dispose()}
 }
 return HashText ($groups|ConvertTo-Json -Depth 5 -Compress)
}
function OldProofHash{
 # The adapter registry belongs to DB01; DB02 must retain its absence.
 # Every actual DB02 proof table below is mandatory: missing tables fail closed.
 $absence=QueryScalar "SELECT CASE WHEN OBJECT_ID(N'dbo.stage4_copy_module_revisions') IS NULL THEN N'DB01_ADAPTER_REGISTRY_ABSENT' ELSE N'UNEXPECTED_DB01_ADAPTER_REGISTRY' END"
 if($absence-cne'DB01_ADAPTER_REGISTRY_ABSENT'){throw 'DAILY_PROFIT_UNEXPECTED_DB01_REGISTRY'}
 $hashes=@($absence);foreach($entry in @(@('stage4_copy_manifest','copy_id'),@('stage4_copy_module_manifest','name'),@('stage4_copy_ready_revisions','copy_id'),@('stage4_copy_ready_performance_revisions','copy_id'),@('stage4_copy_effects_performance_revisions','copy_id,name'),@('stage4_copy_business_daily_revisions','copy_id,name'),@('stage4_copy_requests','copy_id,request_id'),@('stage4_copy_intents','copy_id,request_id'),@('stage4_copy_effect_components','copy_id,request_id,entity,native_id'),@('work_business_count_bindings','count_id'))){$hashes+=QueryScalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT * FROM dbo.$($entry[0]) ORDER BY $($entry[1]) FOR JSON PATH,INCLUDE_NULL_VALUES)),2)"}
 $hashes+=QueryScalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT role_principal_id,member_principal_id FROM sys.database_role_members ORDER BY role_principal_id,member_principal_id FOR JSON PATH)),2)"
 return HashText ($hashes|ConvertTo-Json -Compress)
}
function ProtectedSQLHash{
 $excluded=(@($a.replacements.name)+$trigger|ForEach-Object{"ISNULL(OBJECT_ID(N'$_'),-1)"})-join','
 $modules=QueryScalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT OBJECT_SCHEMA_NAME(m.object_id) schemaName,OBJECT_NAME(m.object_id) name,m.definition FROM sys.sql_modules m WHERE m.object_id NOT IN($excluded) ORDER BY m.object_id FOR JSON PATH,INCLUDE_NULL_VALUES)),2)"
 $checks=QueryScalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT c.* FROM sys.check_constraints c WHERE c.parent_object_id<>ISNULL(OBJECT_ID(N'$registry'),0) ORDER BY c.object_id FOR JSON PATH,INCLUDE_NULL_VALUES)),2)"
 $triggers=QueryScalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT t.object_id,t.name,t.is_disabled,OBJECTPROPERTY(t.object_id,'ExecIsFirstInsertTrigger') firstI,OBJECTPROPERTY(t.object_id,'ExecIsFirstUpdateTrigger') firstU,OBJECTPROPERTY(t.object_id,'ExecIsFirstDeleteTrigger') firstD FROM sys.triggers t WHERE t.object_id<>ISNULL(OBJECT_ID(N'$trigger'),0) ORDER BY t.object_id FOR JSON PATH,INCLUDE_NULL_VALUES)),2)"
 return HashText (@($modules,$checks,$triggers)|ConvertTo-Json -Compress)
}
try{
 $cn.Open();if((QueryScalar "SELECT CONCAT(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'|',DB_NAME(),N'|',IS_SRVROLEMEMBER('sysadmin'))")-cne"$server|$db|1"){throw 'DAILY_PROFIT_OWNER_IDENTITY'}
 $tx=$cn.BeginTransaction([Data.IsolationLevel]::Serializable);$phase='VERIFY_BASE'
 if((QueryScalar "DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=N'melisa-stage4-copy:$($a.copyId)',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=10000;SELECT @r")-lt0){throw 'DAILY_PROFIT_COPY_BUSY'}
 if((QueryScalar "SELECT COUNT(*) FROM dbo.stage4_copy_manifest WHERE copy_id='$($a.copyId)' AND seal_hash='$($a.baseSealHash)' AND sealed=1")-ne1-or(QueryScalar 'SELECT COUNT(*) FROM dbo.stage4_copy_module_manifest')-ne185-or(QueryScalar 'SELECT COUNT(*) FROM dbo.stage4_copy_business_daily_revisions')-ne8-or(QueryScalar "SELECT COUNT(*) FROM sys.tables WHERE object_id=OBJECT_ID(N'$registry')")-ne0){throw 'DAILY_PROFIT_BASE_DRIFT'}
 foreach($m in $a.baseDailyRevision.modules){if((QueryScalar "SELECT COUNT(*) FROM dbo.stage4_copy_business_daily_revisions WHERE copy_id='$($a.copyId)' AND name=N'$($m.name)' AND revision=4 AND revision_hash='$($a.baseDailyRevision.revisionHash)' AND daily_scope_hash='$($a.revision.dailyScopeHash)' AND after_hash='$($m.afterHash)'")-ne1-or(QueryScalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'$($m.name)'))),2)")-cne$m.afterHash){throw 'DAILY_PROFIT_PREDECESSOR_HASH'}}
 if((QueryScalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.immutable_stage4_copy_business_daily_revisions'))),2)")-cne$a.baseDailyRevision.immutableTriggerHash-or(QueryScalar "SELECT ISNULL(OBJECTPROPERTY(OBJECT_ID(N'dbo.immutable_stage4_copy_business_daily_revisions'),'ExecIsTriggerDisabled'),1)")-ne0){throw 'DAILY_PROFIT_OLD_TRIGGER_DRIFT'}
 $phase='PROTECT_BEFORE';$businessBefore=BusinessHash;$oldBefore=OldProofHash;$sqlBefore=ProtectedSQLHash
 $phase='INSTALL_REVIEWED_DDL';ExecuteDDL $a.tableSQL;ExecuteDDL $a.immutableSQL
 foreach($m in $a.replacements){ExecuteDDL $m.definition;if((QueryScalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'$($m.name)'))),2)")-cne$m.afterHash){throw 'DAILY_PROFIT_INSTALLED_HASH'}}
 if((QueryScalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'$trigger'))),2)")-cne$a.revision.immutableTriggerHash){throw 'DAILY_PROFIT_TRIGGER_HASH'}
 $phase='APPEND_THREE_ROWS';$cmd=$cn.CreateCommand();$cmd.Transaction=$tx;$cmd.CommandTimeout=10;$values=@()
 foreach($entry in @(@('copy',[Data.SqlDbType]::UniqueIdentifier,[Guid]$a.copyId),@('seal',[Data.SqlDbType]::Char,$a.baseSealHash,64),@('base',[Data.SqlDbType]::Char,$a.baseDailyRevision.revisionHash,64),@('revision',[Data.SqlDbType]::Char,$a.revision.revisionHash,64),@('scope',[Data.SqlDbType]::Char,$a.revision.dailyScopeHash,64))){$parameter=if($entry.Count-eq4){$cmd.Parameters.Add('@'+$entry[0],$entry[1],$entry[3])}else{$cmd.Parameters.Add('@'+$entry[0],$entry[1])};$parameter.Value=$entry[2]}
 for($i=0;$i-lt$a.replacements.Count;$i++){$m=$a.replacements[$i];$cmd.Parameters.Add('@name'+$i,[Data.SqlDbType]::NVarChar,128).Value=$m.name;$cmd.Parameters.Add('@before'+$i,[Data.SqlDbType]::Char,64).Value=$m.beforeHash;$cmd.Parameters.Add('@after'+$i,[Data.SqlDbType]::Char,64).Value=$m.afterHash;$values+="(@copy,@name$i,5,@seal,@base,@scope,@before$i,@after$i,@revision)"}
 $cmd.CommandText="INSERT $registry(copy_id,name,revision,base_seal_hash,base_daily_revision_hash,daily_scope_hash,before_hash,after_hash,revision_hash) VALUES "+($values-join',');try{[void]$cmd.ExecuteNonQuery()}finally{$cmd.Dispose()}
 $phase='GRANT_METADATA'
 foreach($principal in @('melisa_shared_test_rw_20261009_02','melisa_shared_test_ro_20261009_02')){
  # A DML trigger is metadata of its parent table, not a standalone securable.
  ExecuteDDL "GRANT SELECT ON OBJECT::$registry TO [$principal];GRANT VIEW DEFINITION ON OBJECT::$registry TO [$principal];"
  foreach($m in $a.replacements){ExecuteDDL "GRANT VIEW DEFINITION ON OBJECT::$($m.name) TO [$principal];"}
 }
 $phase='VERIFY_METADATA_AS_EXISTING_USERS'
 foreach($principal in @('melisa_shared_test_rw_20261009_02','melisa_shared_test_ro_20261009_02')){
  $visibleHash=QueryScalar "DECLARE @h varchar(64); BEGIN TRY EXECUTE AS USER=N'$principal'; SELECT @h=CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'$trigger'))),2); REVERT; END TRY BEGIN CATCH REVERT; THROW; END CATCH; SELECT @h;"
  if($visibleHash-is[DBNull]-or$null-eq$visibleHash-or$visibleHash-cne$a.revision.immutableTriggerHash){throw 'DAILY_PROFIT_METADATA_VISIBILITY'}
 }
 $phase='PROTECT_AFTER';$businessAfter=BusinessHash;$oldAfter=OldProofHash;$sqlAfter=ProtectedSQLHash
 if($businessBefore-cne$businessAfter-or$oldBefore-cne$oldAfter-or$sqlBefore-cne$sqlAfter-or(QueryScalar "SELECT COUNT(*) FROM $registry")-ne3-or(QueryScalar 'SELECT COUNT(*) FROM sys.triggers WHERE is_disabled=1')-ne0){throw 'DAILY_PROFIT_PROTECTION_DRIFT'}
 $proof=[ordered]@{status='PASS';artifactSHA256=$ArtifactSHA256.ToUpperInvariant();revisionHash=$a.revision.revisionHash;dailyScopeHash=$a.revision.dailyScopeHash;database=$db;copyId=$a.copyId;businessBefore=$businessBefore;businessAfter=$businessAfter;oldProofBefore=$oldBefore;oldProofAfter=$oldAfter;sqlBefore=$sqlBefore;sqlAfter=$sqlAfter;businessWrites=0;openingHumanAccepted=$false;realFinancialOpeningAuthorized=$false;nativeChecksChanged=0;rolesChanged=$false;recordedAt=[DateTime]::UtcNow.ToString('o')}
 if($Mode-ceq'Rehearse'){$tx.Rollback();$tx.Dispose();$tx=$null;$proof.rolledBack=$true}else{$tx.Commit();$tx.Dispose();$tx=$null;$committed=$true;$proof.sqlCommitted=$true}
 [IO.File]::WriteAllText($ProofPath,($proof|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false));$proof|ConvertTo-Json -Depth 4
}catch{
 $rolledBack=$false;if($tx){try{$tx.Rollback();$rolledBack=$true}catch{}}
 $ex=$_.Exception;while($ex.InnerException-and-not($ex-is[Data.SqlClient.SqlException])){$ex=$ex.InnerException};$errors=@();foreach($e in $ex.Errors){$errors+=@{number=$e.Number;procedure=$e.Procedure;line=$e.LineNumber;safeCode=if($e.Message-cmatch'^[A-Z][A-Z0-9_]+$'){$e.Message}else{$null}}}
 $failure=@{status='STOPPED';phase=$phase;sqlCommitted=$committed;rolledBack=$rolledBack;errors=$errors;errorCode=if($ex.Message-cmatch'^DAILY_PROFIT_[A-Z0-9_]+$'){$ex.Message}else{$null};recordedAt=[DateTime]::UtcNow.ToString('o')};[IO.File]::WriteAllText($ProofPath,($failure|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false));$failure|ConvertTo-Json -Depth 6;throw 'DAILY_PROFIT_STOPPED_PRIVATE_DIAGNOSTIC'
}finally{if($tx){$tx.Dispose()};$cn.Close();$cn.Dispose()}
