param([Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$RevisionSHA256,[ValidateSet('Rehearse','Apply')][string]$Mode='Rehearse')
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'protect-shared-test-private-file.ps1')
$root='C:\Sirket\ERP\evidence\ERP-CRM-PREP-20261009\private\infra'
$path=Join-Path $root 'shared-copy-adapter-revision-01-v3.json'
$configPath='C:\Sirket\ERP\runtime\ERP-CRM-PREP-20261009\shared-copy-config.json'
if((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ine $RevisionSHA256){throw 'SHARED_REVISION_ARTIFACT_HASH'}
$a=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json -Depth 100
$b=Get-Content -LiteralPath (Join-Path $root 'shared-copy-install-bundle.json') -Raw|ConvertFrom-Json -Depth 100
$c=Get-Content -LiteralPath $configPath -Raw|ConvertFrom-Json -Depth 100
if((Get-FileHash -LiteralPath (Join-Path $root 'shared-copy-install-bundle.json') -Algorithm SHA256).Hash -ine '2ac113ae5203e3d41b4776a2e68dacead6eec36229b5b2bdb1bba7102c24ecc6'){throw 'SHARED_REVISION_BASE_BUNDLE_HASH'}
$db='MELISA_ERP_CRM_SHARED_TEST_20261009_01';$server='Semih\MELISADEV'
$names=@('dbo.usp_stage4_copy_ready','dbo.usp_stage4_copy_guard','dbo.usp_stage4_copy_context')
if($a.schemaVersion -cne 'melisa-shared-copy-adapter-install.v1' -or $a.target.database -cne $db -or $a.target.server -cne $server -or $a.target.login -cne 'melisa_shared_test_rw_20261009_01' -or $a.copyId -cne $b.copyId -or $a.copyId -cne $c.copyContext.copyId -or $a.baseSealHash -cne $c.copyContext.sealHash -or $a.baseSealHash -cne $b.config.copyContext.sealHash -or $a.revision.version -ne 1 -or $a.replacements.Count -ne 3 -or $b.moduleManifest.Count -ne 184 -or $c.database -cne $db -or $c.server -cne $server){throw 'SHARED_REVISION_TARGET'}
foreach($i in 0..2){$m=$a.replacements[$i];$old=@($b.moduleManifest|Where-Object name -CEQ $names[$i]);if($m.name -cne $names[$i] -or $m.beforeHash -cnotmatch '^[A-F0-9]{64}$' -or $m.afterHash -cnotmatch '^[A-F0-9]{64}$' -or $old.Count -ne 1 -or $old[0].afterHash -cne $m.beforeHash){throw 'SHARED_REVISION_FINITE_MODULES'}}
$cn=[Data.SqlClient.SqlConnection]::new("Server=$server;Database=$db;Integrated Security=True;Encrypt=False;Application Name=SHARED-COPY-ADAPTER-REVISION-01")
$tx=$null;$phase='CONNECT';$module=$null;$sqlCommitted=$false;$configAdjunctPersisted=$false;$aclVerified=$false
function Scalar([string]$sql){$cmd=$cn.CreateCommand();$cmd.Transaction=$tx;$cmd.CommandTimeout=900;$cmd.CommandText=$sql;try{return $cmd.ExecuteScalar()}finally{$cmd.Dispose()}}
function Execute([string]$sql){$cmd=$cn.CreateCommand();$cmd.Transaction=$tx;$cmd.CommandTimeout=900;$cmd.CommandText=$sql;try{[void]$cmd.ExecuteNonQuery()}finally{$cmd.Dispose()}}
function Snapshot{
 $snap=[ordered]@{}
 $tables=@('dbo.products','dbo.customers','dbo.suppliers','dbo.party_currency_accounts','dbo.finance_accounts','dbo.work_inbound_counts','dbo.work_inbound_requests','dbo.test_goods_batches','dbo.test_goods_batch_lines','dbo.test_purchase_batch_drafts','dbo.test_purchase_batch_links','dbo.test_purchase_batch_intent_lines','dbo.purchase_invoices','dbo.purchase_invoice_items','dbo.stock_movements','dbo.supplier_movements','dbo.finance_account_movements','dbo.stage4_copy_requests','dbo.stage4_copy_effect_components','dbo.stage4_copy_intents','dbo.stage4_copy_manifest','dbo.stage4_copy_module_manifest','dbo.users','dbo.roles','dbo.permissions','erp_migration.operation_quarantine_holds','erp_migration.operation_quarantine_manifest','erp_migration.accepted_price_manifest','erp_migration.accepted_price_products','erp_migration.accepted_price_values','erp_migration.goal7_source_version_manifest','erp_migration.goal7_source_version_products','erp_migration.goal7_source_version_prices')
 foreach($t in $tables){$snap[$t]=Scalar "SELECT CONCAT(COUNT_BIG(*),N'|',CONVERT(varchar(64),HASHBYTES('SHA2_256',COALESCE(STRING_AGG(CONVERT(nvarchar(max),h),N';') WITHIN GROUP(ORDER BY h),N'')),2)) FROM (SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) h FROM $t x WITH(UPDLOCK,HOLDLOCK)) q"}
 $snap['existingTriggers']=Scalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CONVERT(nvarchar(max),CONCAT(t.name,N'|',t.is_disabled,N'|',OBJECTPROPERTY(t.object_id,'ExecIsFirstInsertTrigger'),N'|',OBJECTPROPERTY(t.object_id,'ExecIsFirstUpdateTrigger'),N'|',OBJECTPROPERTY(t.object_id,'ExecIsFirstDeleteTrigger'),N'|',CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(t.object_id)),2))),N';') WITHIN GROUP(ORDER BY t.name)),2) FROM sys.triggers t WHERE t.name<>N'immutable_stage4_copy_module_revisions'"
 return $snap
}
try{
 $cn.Open();if((Scalar "SELECT CONCAT(DB_NAME(),N'|',CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'|',IS_SRVROLEMEMBER('sysadmin'))") -cne "$db|$server|1"){throw 'SHARED_REVISION_ACTUAL_IDENTITY'}
 $tx=$cn.BeginTransaction([Data.IsolationLevel]::Serializable);$phase='VERIFY_BASE'
 if((Scalar "SELECT COUNT(*) FROM dbo.stage4_copy_manifest WHERE copy_id='$($a.copyId)' AND seal_hash='$($a.baseSealHash)' AND backup_sha='$($a.backupSHA)' AND sealed=1") -ne 1 -or (Scalar 'SELECT COUNT(*) FROM dbo.stage4_copy_manifest') -ne 1 -or (Scalar 'SELECT COUNT(*) FROM dbo.stage4_copy_module_manifest') -ne 184 -or (Scalar "SELECT COUNT(*) FROM sys.tables WHERE object_id=OBJECT_ID(N'dbo.stage4_copy_module_revisions')") -ne 0){throw 'SHARED_REVISION_BASE_DRIFT'}
 if((Scalar "SELECT COUNT(*) FROM dbo.stage4_copy_module_manifest WHERE after_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(name))),2)") -ne 0){throw 'SHARED_REVISION_BASE_ACTUAL_DRIFT'}
 foreach($m in $b.moduleManifest){if($m.name -cnotmatch '^dbo\.[a-zA-Z0-9_]+$' -or (Scalar "SELECT COUNT(*) FROM dbo.stage4_copy_module_manifest WHERE name=N'$($m.name)' AND after_hash=N'$($m.afterHash)' AND ISNULL(before_hash,N'')=N'$($m.beforeHash)' AND kind=N'$($m.kind)'") -ne 1){throw 'SHARED_REVISION_BASE_MANIFEST_DRIFT'}}
 foreach($m in $a.replacements){if((Scalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'$($m.name)'))),2)") -cne $m.beforeHash){throw 'SHARED_REVISION_MODULE_BEFORE_DRIFT'}}
 $phase='SNAPSHOT_BEFORE';$before=Snapshot
 $phase='CREATE_APPEND_ONLY_REGISTRY';Execute $a.tableSQL;Execute $a.immutableSQL
 $phase='REPLACE_FINITE_MODULES';foreach($m in $a.replacements){$module=$m.name;Execute $m.definition;if((Scalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'$($m.name)'))),2)") -cne $m.afterHash){throw 'SHARED_REVISION_MODULE_AFTER_DRIFT'}}
 $phase='APPEND_REVISION';foreach($m in $a.revision.modules){Execute "INSERT dbo.stage4_copy_module_revisions(copy_id,revision,base_seal_hash,name,before_hash,after_hash) VALUES('$($a.copyId)',1,'$($a.baseSealHash)',N'$($m.name)','$($m.beforeHash)','$($m.afterHash)')"}
 if((Scalar "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.immutable_stage4_copy_module_revisions'))),2)") -cne $a.revision.immutableTriggerHash -or (Scalar "SELECT COUNT(*) FROM dbo.stage4_copy_module_revisions") -ne 3 -or (Scalar 'SELECT COUNT(*) FROM sys.triggers WHERE is_disabled=1') -ne 0){throw 'SHARED_REVISION_REGISTRY_DRIFT'}
 # Owner-executed procedure bodies and the registry's DML trigger require
 # finite metadata visibility for startup proof. A trigger is granted through
 # its parent table. Runtime execution and business-table DML stay unchanged.
 $phase='GRANT_FINITE_METADATA';$module=$null
 foreach($principal in @('melisa_shared_test_ro_20261009_01','melisa_shared_test_rw_20261009_01')){
  foreach($object in @('dbo.usp_stage4_copy_ready','dbo.usp_stage4_copy_guard','dbo.usp_stage4_copy_context','dbo.stage4_copy_module_revisions')){
   Execute "GRANT VIEW DEFINITION ON OBJECT::$object TO [$principal]"
  }
 }
 $phase='SNAPSHOT_AFTER';$after=Snapshot;foreach($key in $before.Keys){if($before[$key] -cne $after[$key]){throw 'SHARED_REVISION_BUSINESS_OR_GUARD_DRIFT'}}
 if($Mode -ceq 'Rehearse'){$phase='REHEARSE_ROLLBACK';$tx.Rollback();$tx.Dispose();$tx=$null;@{status='REHEARSED_ROLLBACK';copyId=$a.copyId;revisionHash=$a.revision.revisionHash;businessTables=$before.Count-1;businessUnchanged=$true;guardsDisabled=0}|ConvertTo-Json;return}
 $phase='COMMIT';$tx.Commit();$tx.Dispose();$tx=$null
 $sqlCommitted=$true
 $proof=[ordered]@{status='SQL_COMMITTED';sqlCommitted=$true;configAdjunctPersisted=$false;aclVerified=$false;copyId=$a.copyId;revisionHash=$a.revision.revisionHash;modules=$a.revision.modules;businessTables=$before.Count-1;before=$before;after=$after;businessUnchanged=$true;profileUnchanged=$true;originalModuleManifestUnchanged=$true;guardsDisabled=0;existingRolesChanged=$false;recordedAt=[DateTime]::UtcNow.ToString('o')}
 $proofPath=Join-Path $root 'shared-copy-adapter-revision-01-proof.json'
 [IO.File]::WriteAllText($proofPath,($proof|ConvertTo-Json -Depth 50),[Text.UTF8Encoding]::new($false))
 # Updating this protected file preserves its ACL and all existing credentials.
 # Base copyContext is unchanged; only the verified non-secret adjunct is added.
 $phase='CONFIG_ADJUNCT';$c|Add-Member -NotePropertyName copyAdapterRevision -NotePropertyValue $a.revision -Force
 [IO.File]::WriteAllText($configPath,($c|ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
 $configAdjunctPersisted=$true;$proof.configAdjunctPersisted=$true;$proof.status='SQL_COMMITTED_CONFIG_WRITTEN'
 [IO.File]::WriteAllText($proofPath,($proof|ConvertTo-Json -Depth 50),[Text.UTF8Encoding]::new($false))
 $phase='CONFIG_ACL'
 Protect-SharedPrivateFile $configPath
 $aclVerified=$true;$proof.aclVerified=$true;$proof.status='APPLIED'
 [IO.File]::WriteAllText($proofPath,($proof|ConvertTo-Json -Depth 50),[Text.UTF8Encoding]::new($false))
 @{status='APPLIED';copyId=$a.copyId;revisionHash=$a.revision.revisionHash;businessTables=$before.Count-1;businessUnchanged=$true;guardsDisabled=0}|ConvertTo-Json
}catch{
 $base=$_.Exception.GetBaseException();$rollback='not_started';if($tx){try{$tx.Rollback();$rollback='completed'}catch{$rollback='failed'}}
 $e=if($base -is [Data.SqlClient.SqlException]){$base}else{$null}
 $proof=@{phase=$phase;module=$module;errorType=$base.GetType().FullName;sqlErrorNumber=$(if($e){$e.Number}else{$null});sqlProcedure=$(if($e){$e.Procedure}else{$null});sqlLineNumber=$(if($e){$e.LineNumber}else{$null});rollback=$rollback;sqlCommitted=$sqlCommitted;configAdjunctPersisted=$configAdjunctPersisted;aclVerified=$aclVerified}
 [IO.File]::WriteAllText((Join-Path $root 'shared-copy-adapter-revision-01-failure.json'),($proof|ConvertTo-Json),[Text.UTF8Encoding]::new($false));throw 'SHARED_REVISION_STOPPED_SAFE_PRIVATE_DIAGNOSTIC'
}finally{if($tx){$tx.Dispose()};$cn.Dispose()}
