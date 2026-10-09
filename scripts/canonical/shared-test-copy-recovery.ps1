param([ValidateSet('Preflight','Rehearse','Proof')][string]$Mode='Preflight')
$ErrorActionPreference='Stop'
$sharedRequestedMode=$Mode
# Reuse the proven snapshot/header/file guards, without running its dated targets.
. (Join-Path $PSScriptRoot 'stage4-copy-recovery.ps1')
$Mode=$sharedRequestedMode
$server='Semih\MELISADEV'
$sourceDb='MELISA_ERP_SIRKET_TEST_20260929_01'
$copyDb='MELISA_ERP_CRM_SHARED_TEST_20261009_01'
$recoveryDb=$copyDb
$targets=@($copyDb)
$backupRoot='C:\Sirket\ERP\backups\ERP-CRM-PREP-20261009'
$backupFile=Join-Path $backupRoot 'SHARED_TEST125_CURRENT_20261009_01.bak'
$dataRoot='C:\Sirket\ERP\data\ERP-CRM-PREP-20261009'
$evidenceRoot='C:\Sirket\ERP\evidence\ERP-CRM-PREP-20261009\private\infra'
$criticalTables=@($criticalTables)+@(
 'dbo.crm_order_v2_requests','dbo.crm_order_v2_lines','dbo.crm_order_v2_intents',
 'dbo.sales_orders','dbo.sales_order_items','dbo.audit_logs',
 'dbo.work_inbound_counts','dbo.work_inbound_requests','dbo.work_trade_requests','dbo.work_trade_intents',
 'dbo.work_sales_links','dbo.work_collection_links','dbo.work_supplier_payment_requests',
 'dbo.test_daily_drafts','dbo.test_daily_requests',
 'dbo.customer_routes','dbo.customer_route_assignments','dbo.terminal_device_customer_routes','dbo.terminal_devices',
 'erp_migration.accepted_price_manifest','erp_migration.accepted_price_products','erp_migration.accepted_price_values'
)
function Shared-Snapshot([string]$db){$value=Stage4-Snapshot $db;$value.coverage="$($criticalTables.Count) critical ERP/CRM tables, all SQL modules/trigger states/native columns; not all database rows";return $value}
function Shared-Compare($before,$after,$copy){
 if($before.identity.database -cne $sourceDb -or $after.identity.database -cne $sourceDb -or $copy.identity.database -cne $copyDb){throw 'SHARED_PROOF_IDENTITY'}
 foreach($snapshot in @($before,$after,$copy)){if($snapshot.identity.server -cne $server){throw 'SHARED_PROOF_IDENTITY'}}
 $changed=[Collections.Generic.List[string]]::new()
 foreach($snapshot in @($after,$copy)){
  foreach($table in $criticalTables){$b=$before.groups[$table];$a=$snapshot.groups[$table];if($null -eq $a -or $null -eq $b -or $a.basis -cne $hashBasis -or $a.count -ne $b.count -or $a.fullRowsHashMultisetSHA256 -cne $b.fullRowsHashMultisetSHA256){$changed.Add($snapshot.identity.database+':'+$table)}}
  foreach($part in @('modules','schema')){if(($before[$part]|ConvertTo-Json -Depth 15 -Compress) -cne ($snapshot[$part]|ConvertTo-Json -Depth 15 -Compress)){$changed.Add($snapshot.identity.database+':'+$part)}}
  if($snapshot.databaseState[0].state_desc -cne 'ONLINE' -or $snapshot.databaseState[0].is_read_only -ne $false -or $snapshot.databaseState[0].collation_name -cne $before.databaseState[0].collation_name){throw 'SHARED_PROOF_DATABASE_STATE'}
 }
 return [ordered]@{status=$(if($changed.Count){'FAIL'}else{'PASS'});sourceBeforeAfterEqual=($changed.Count -eq 0);rawCopyMatchesSource=($changed.Count -eq 0);tablesCompared=$criticalTables.Count;moduleDefinitionsCompared=$before.modules.Count;changed=$changed.ToArray();actualRestorePerformed=$true;activeDatabaseOverwritten=$false;coverage=$copy.coverage;hashBasis=$hashBasis;recordedAt=[DateTime]::UtcNow.ToString('o')}
}
# Dot-source is an offline function-only mode for tests. No SQL or files are touched.
if($MyInvocation.InvocationName -eq '.'){return}
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
$master=$null
try{
 $master=Open-Stage4Connection 'master'
 if($Mode -eq 'Preflight'){Stage4-Save 'shared-preflight.json' (Stage4-Preflight $master);exit}
 if($Mode -eq 'Rehearse'){
  Stage4-Save 'shared-preflight.json' (Stage4-Preflight $master)
  New-Item -ItemType Directory -Path $backupRoot,$dataRoot -Force | Out-Null
  $before=Shared-Snapshot $sourceDb;Stage4-Save 'shared-source-before.json' $before
  $edition=@(Stage4-Rows $master "SELECT CONVERT(int,SERVERPROPERTY('EngineEdition')) engineEdition")[0]
  $compression=if($edition.engineEdition -eq 4){''}else{',COMPRESSION'}
  Assert-Stage4BackupPath $backupFile (Test-Path -LiteralPath $backupFile)
  Stage4-Execute $master "BACKUP DATABASE [$sourceDb] TO DISK=N'$backupFile' WITH COPY_ONLY,CHECKSUM$compression,NOINIT;"
  $header=@(Stage4-Rows $master "RESTORE HEADERONLY FROM DISK=N'$backupFile'");Assert-Stage4Header $header
  $files=@(Stage4-Rows $master "RESTORE FILELISTONLY FROM DISK=N'$backupFile'");Assert-Stage4FileList $files $true
  Stage4-Execute $master "RESTORE VERIFYONLY FROM DISK=N'$backupFile' WITH CHECKSUM;"
  $sha=(Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash
  Stage4-Save 'shared-backup.json' @{server=$server;sourceDatabase=$sourceDb;file=$backupFile;sha256=$sha;copyOnly=$true;checksum=$true;verifyOnlyPassed=$true;backupSetGuid=[string]$header[0].BackupSetGUID;sizeBytes=(Get-Item -LiteralPath $backupFile).Length}
  $data=Join-Path $dataRoot ($copyDb+'.mdf');$log=Join-Path $dataRoot ($copyDb+'_log.ldf')
  Assert-Stage4Target $copyDb $data $log (@(Stage4-Rows $master "SELECT name FROM sys.databases WHERE name=N'$copyDb'").Count -ne 0) (Test-Path -LiteralPath $data) (Test-Path -LiteralPath $log)
  if((Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash -cne $sha){throw 'SHARED_BACKUP_CHANGED'}
  Stage4-Execute $master "IF DB_ID(N'$copyDb') IS NOT NULL THROW 51909,'SHARED_TARGET_EXISTS',1; RESTORE DATABASE [$copyDb] FROM DISK=N'$backupFile' WITH CHECKSUM,RECOVERY,MOVE N'MELISA_ERP_V2' TO N'$data',MOVE N'MELISA_ERP_V2_log' TO N'$log';"
  Stage4-Save 'shared-restore.json' @{server=$server;database=$copyDb;dataFile=$data;logFile=$log;restored=$true;readOnly=$false;activeDatabaseOverwritten=$false}
 }
 if($Mode -in @('Rehearse','Proof')){
  $before=Get-Content -LiteralPath (Join-Path $evidenceRoot 'shared-source-before.json') -Raw|ConvertFrom-Json -AsHashtable
  $backup=Get-Content -LiteralPath (Join-Path $evidenceRoot 'shared-backup.json') -Raw|ConvertFrom-Json -AsHashtable
  if($backup.server -cne $server -or $backup.sourceDatabase -cne $sourceDb -or $backup.file -cne $backupFile -or (Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash -cne $backup.sha256){throw 'SHARED_BACKUP_PROOF_CHANGED'}
  $after=Shared-Snapshot $sourceDb;Stage4-Save 'shared-source-after.json' $after
  $copy=Shared-Snapshot $copyDb;Stage4-Save 'shared-raw-copy.json' $copy
  $comparison=Shared-Compare $before $after $copy;Stage4-Save 'shared-restore-comparison.json' $comparison
  if($comparison.status -cne 'PASS'){throw 'SHARED_RESTORE_PROOF_FAILED'}
 }
}finally{if($master){$master.Dispose()}}
