param([ValidateSet('Preflight','Restore','Proof')][string]$Mode='Preflight')
$ErrorActionPreference='Stop'
$businessMode=$Mode
. (Join-Path $PSScriptRoot 'shared-test-copy-recovery.ps1')
$Mode=$businessMode
$copyDb='MELISA_ERP_CRM_SHARED_TEST_20261009_02'
$recoveryDb=$copyDb
$targets=@($copyDb)
$dataRoot='C:\Sirket\ERP\data\ERP-CRM-EXPAND-20261009'
$evidenceRoot='C:\Sirket\ERP\evidence\ERP-CRM-EXPAND-20261009\private\infra'
# Reuse the accepted COPY_ONLY/CHECKSUM backup. Never overwrite a database or
# take another import/migration pass through accepted opening records.
$acceptedBackup='C:\Sirket\ERP\evidence\ERP-CRM-PREP-20261009\private\infra\shared-backup.json'
if($MyInvocation.InvocationName -eq '.'){return}
New-Item -ItemType Directory -Path $evidenceRoot -Force|Out-Null
$b=Get-Content -LiteralPath $acceptedBackup -Raw|ConvertFrom-Json
if($b.server -cne $server -or $b.sourceDatabase -cne $sourceDb -or $b.file -cne $backupFile -or $b.copyOnly -ne $true -or $b.checksum -ne $true -or $b.verifyOnlyPassed -ne $true -or (Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash -cne $b.sha256){throw 'BUSINESS_ACCEPTED_BACKUP_CHANGED'}
$master=Open-Stage4Connection 'master'
try{
 if($Mode -in @('Preflight','Restore')){
  Assert-NewStage4Targets $master
  $files=@(Stage4-Rows $master "RESTORE FILELISTONLY FROM DISK=N'$backupFile'");Assert-Stage4FileList $files $true
  $header=@(Stage4-Rows $master "RESTORE HEADERONLY FROM DISK=N'$backupFile'");Assert-Stage4Header $header
  $required=[long]($files|Measure-Object Size -Sum).Sum+5GB
  if((Get-PSDrive C).Free -lt $required){throw 'BUSINESS_RESTORE_DISK_REQUIRED'}
  Stage4-Save 'business-preflight.json' @{database=$copyDb;sourceDatabase=$sourceDb;backupSHA=$b.sha256;requiredBytes=$required;freeBytes=(Get-PSDrive C).Free;overwriteAllowed=$false}
 }
 if($Mode -eq 'Preflight'){return}
 if($Mode -eq 'Restore'){
  $before=Shared-Snapshot $sourceDb;Stage4-Save 'shared-source-before.json' $before
  $accepted=Get-Content -LiteralPath 'C:\Sirket\ERP\evidence\ERP-CRM-PREP-20261009\private\infra\shared-source-before.json' -Raw|ConvertFrom-Json -AsHashtable
  # The reused backup must match current protected source on the established
  # full-row hash coverage, definitions and native schema before any restore.
  foreach($t in $criticalTables){if($accepted.groups[$t].fullRowsHashMultisetSHA256 -cne $before.groups[$t].fullRowsHashMultisetSHA256 -or $accepted.groups[$t].count -ne $before.groups[$t].count){throw 'BUSINESS_SOURCE_CHANGED_SINCE_ACCEPTED_BACKUP'}}
  foreach($part in @('modules','schema')){if(($accepted[$part]|ConvertTo-Json -Depth 15 -Compress) -cne ($before[$part]|ConvertTo-Json -Depth 15 -Compress)){throw 'BUSINESS_SOURCE_SCHEMA_CHANGED_SINCE_BACKUP'}}
  Stage4-Execute $master "RESTORE VERIFYONLY FROM DISK=N'$backupFile' WITH CHECKSUM;"
  New-Item -ItemType Directory -Path $dataRoot -Force|Out-Null
  $data=Join-Path $dataRoot ($copyDb+'.mdf');$log=Join-Path $dataRoot ($copyDb+'_log.ldf')
  Assert-Stage4Target $copyDb $data $log (@(Stage4-Rows $master "SELECT name FROM sys.databases WHERE name=N'$copyDb'").Count -ne 0) (Test-Path -LiteralPath $data) (Test-Path -LiteralPath $log)
  Stage4-Execute $master "IF DB_ID(N'$copyDb') IS NOT NULL THROW 51909,'BUSINESS_TARGET_EXISTS',1; RESTORE DATABASE [$copyDb] FROM DISK=N'$backupFile' WITH CHECKSUM,RECOVERY,MOVE N'MELISA_ERP_V2' TO N'$data',MOVE N'MELISA_ERP_V2_log' TO N'$log';"
  Stage4-Save 'shared-backup.json' $b
  Stage4-Save 'shared-restore.json' @{server=$server;database=$copyDb;restored=$true;existingBackupReused=$true;activeDatabaseOverwritten=$false;sourceWrites=0}
 }
 $before=Get-Content -LiteralPath (Join-Path $evidenceRoot 'shared-source-before.json') -Raw|ConvertFrom-Json -AsHashtable
 $after=Shared-Snapshot $sourceDb;Stage4-Save 'shared-source-after.json' $after
 $copy=Shared-Snapshot $copyDb;Stage4-Save 'shared-raw-copy.json' $copy
 $comparison=Shared-Compare $before $after $copy;Stage4-Save 'shared-restore-comparison.json' $comparison
 if($comparison.status -cne 'PASS'){throw 'BUSINESS_RESTORE_COMPARISON_FAILED'}
 $comparison|ConvertTo-Json -Depth 4
}finally{$master.Dispose()}
