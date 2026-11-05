param([ValidateSet('Preflight','Rehearse','Proof','Negatives')][string]$Mode='Preflight',[switch]$ReuseCompletedSourceProof,[ValidateSet('Goal6','Clean20261022')][string]$Profile='Goal6',
 [ValidateSet('BeforeB7','C5-20261025-0300')][string]$CleanBackup='BeforeB7',[switch]$ApplyCleanRestore,
 [string]$CleanPreflightReceipt,[string]$CleanPreflightSha256,[string]$CleanRestoreApprovalReference)
$ErrorActionPreference='Stop'
if($Profile -ceq 'Clean20261022'){
 if($Mode -cnotin @('Preflight','Rehearse') -or $ReuseCompletedSourceProof){throw 'CLEAN_RESTORE_PREFLIGHT_ONLY'}
 # A switch/reference is NOT evidence of human authorization. The operator must obtain
 # scoped approval outside this script before invoking Rehearse; defaults remain read-only.
 if($Mode -ceq 'Rehearse' -and (!$ApplyCleanRestore -or $CleanRestoreApprovalReference -cnotmatch '^[A-Za-z0-9:_-]{8,128}$' -or !$CleanPreflightReceipt -or $CleanPreflightSha256 -cnotmatch '^[A-Fa-f0-9]{64}$')){throw 'CLEAN_RESTORE_EXPLICIT_APPROVAL_REQUIRED'}
 if($Mode -ceq 'Preflight' -and ($ApplyCleanRestore -or $CleanPreflightReceipt -or $CleanPreflightSha256 -or $CleanRestoreApprovalReference)){throw 'CLEAN_RESTORE_MODE_INVALID'}
}elseif($ApplyCleanRestore -or $CleanPreflightReceipt -or $CleanPreflightSha256 -or $CleanRestoreApprovalReference -or $CleanBackup -cne 'BeforeB7'){throw 'CLEAN_RESTORE_PROFILE_INVALID'}
# Explicit Goal6 authorization: COPY_ONLY active TEST; restore ONLY a new isolated DB.
# These literals deliberately cannot be overridden from command-line arguments.
$sourceDb='MELISA_ERP_SIRKET_TEST_20260929_01'
$restoreDb='MELISA_ERP_GOAL6_RESTORE_TEST_20261006_01'
$server='Semih\MELISADEV'
$backupRoot='C:\Sirket\ERP\backups\ERP-GOAL6-20261006'
$restoreRoot='C:\Sirket\ERP\data\GOAL6-RESTORE-20261006-01'
$backupFile=Join-Path $backupRoot 'GOAL6_TEST_20261006_01.bak'
$dataFile=Join-Path $restoreRoot ($restoreDb+'.mdf')
$logFile=Join-Path $restoreRoot ($restoreDb+'_log.ldf')
$evidenceRoot='C:\Sirket\ERP\evidence\ERP-GOAL6-20261006'
if($Profile -ceq 'Clean20261022'){
 $sourceDb='MELISA_ERP_CLEAN_TEST_20261022'
 $restoreDb='MELISA_ERP_CLEAN_RESTORE_TEST_20261024_01'
 $backupFile='C:\Sirket\ERP\backups\CLEAN-20261022-before-B7-20261024.bak'
 if($CleanBackup -ceq 'C5-20261025-0300'){$backupFile='C:\Sirket\ERP\backups\CLEAN-20261022-C5-20261025T000001357Z-512ec2b3bf8f478ca37e1851c8a821d2\CLEAN_TEST_COPY_ONLY.bak'}
 $restoreRoot='C:\Sirket\ERP\data\CLEAN-RESTORE-20261024-01'
 $evidenceRoot='C:\Sirket\ERP\clean\20261022\runtime\semih-access-20261023'
}
function Open-VerifiedConnection([string]$db){
 if($db -cnotin @('master',$sourceDb,$restoreDb)){throw 'GOAL6_WRONG_DATABASE'}
 $cn=[Data.SqlClient.SqlConnection]::new("Server=$server;Database=$db;Integrated Security=True;Encrypt=False;Application Name=ERP-GOAL6-BACKUP-RESTORE")
 $cn.Open();$cmd=$cn.CreateCommand();$cmd.CommandText="SELECT CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)), DB_NAME()";$r=$cmd.ExecuteReader()
 $ok=$r.Read() -and $r.GetString(0) -ceq $server -and $r.GetString(1) -ceq $db;$r.Close()
 if(-not $ok){$cn.Close();throw 'GOAL6_IDENTITY_MISMATCH'};return $cn
}
function Rows($cn,[string]$query){
 $cmd=$cn.CreateCommand();$cmd.CommandTimeout=900;$cmd.CommandText=$query;$r=$cmd.ExecuteReader();$rows=@()
 try {while($r.Read()){$row=[ordered]@{};for($i=0;$i -lt $r.FieldCount;$i++){$row[$r.GetName($i)]=if($r.IsDBNull($i)){$null}else{$r.GetValue($i)}};$rows+=[pscustomobject]$row}}finally{$r.Close()};return $rows
}
function Execute($cn,[string]$query){$cmd=$cn.CreateCommand();$cmd.CommandTimeout=900;$cmd.CommandText=$query;[void]$cmd.ExecuteNonQuery()}
function Save([string]$name,$value){$file=Join-Path $evidenceRoot $name;[IO.File]::WriteAllText($file,($value|ConvertTo-Json -Depth 14),[Text.UTF8Encoding]::new($false))}
function Assert-NewRestore($cn){
 if($restoreDb -ceq $sourceDb -or $restoreDb -notmatch '^MELISA_ERP_GOAL6_RESTORE_TEST_20261006_01$'){throw 'GOAL6_RESTORE_TARGET_INVALID'}
 if((Rows $cn "SELECT name FROM sys.databases WHERE name=N'$restoreDb'").Count -ne 0){throw 'GOAL6_RESTORE_TARGET_EXISTS'}
 foreach($f in @($dataFile,$logFile)){if(Test-Path -LiteralPath $f){throw 'GOAL6_RESTORE_FILE_EXISTS'}}
 if([IO.Path]::GetFullPath($dataFile) -cne $dataFile -or [IO.Path]::GetDirectoryName($dataFile) -cne $restoreRoot -or [IO.Path]::GetDirectoryName($logFile) -cne $restoreRoot){throw 'GOAL6_RESTORE_PATH_INVALID'}
}
function Assert-BackupHeader($header){
 if($header.Count -ne 1 -or $header[0].DatabaseName -cne $sourceDb -or -not $header[0].IsCopyOnly -or -not $header[0].HasBackupChecksums -or $header[0].IsDamaged -or $header[0].BackupType -ne 1){throw 'GOAL6_BACKUP_HEADER_INVALID'}
}
function Assert-CleanBackupCandidate($header,$files,[bool]$targetExists,[bool]$directoryExists,[long]$availableBytes){
 $expectedBackup=if($CleanBackup -ceq 'C5-20261025-0300'){'C:\Sirket\ERP\backups\CLEAN-20261022-C5-20261025T000001357Z-512ec2b3bf8f478ca37e1851c8a821d2\CLEAN_TEST_COPY_ONLY.bak'}elseif($CleanBackup -ceq 'BeforeB7'){'C:\Sirket\ERP\backups\CLEAN-20261022-before-B7-20261024.bak'}else{throw 'CLEAN_RESTORE_PROFILE_INVALID'}
 if($Profile -cne 'Clean20261022' -or $Mode -cnotin @('Preflight','Rehearse') -or $sourceDb -cne 'MELISA_ERP_CLEAN_TEST_20261022' -or $restoreDb -cne 'MELISA_ERP_CLEAN_RESTORE_TEST_20261024_01' -or $server -cne 'Semih\MELISADEV' -or $backupFile -cne $expectedBackup -or $restoreRoot -cne 'C:\Sirket\ERP\data\CLEAN-RESTORE-20261024-01'){throw 'CLEAN_RESTORE_PROFILE_INVALID'}
 Assert-BackupHeader $header
 $h=$header[0]
 if($h.ServerName -ine $server -or $h.Position -ne 1 -or !$h.BackupSetGUID -or !$h.BackupStartDate -or !$h.BackupFinishDate -or [datetime]$h.BackupFinishDate -lt [datetime]$h.BackupStartDate){throw 'CLEAN_RESTORE_HEADER_IDENTITY_INVALID'}
 if($targetExists -or $directoryExists){throw 'CLEAN_RESTORE_TARGET_EXISTS'}
 if(@($files).Count -eq 0 -or @($files|Where-Object {$_.Type -cnotin @('D','L') -or ![bool]$_.IsPresent -or [decimal]$_.Size -le 0 -or [decimal]$_.Size -ne [decimal]::Truncate([decimal]$_.Size) -or [decimal]$_.Size -gt [long]::MaxValue -or [decimal]$_.FileId -le 0 -or [decimal]$_.FileId -gt [int]::MaxValue -or [decimal]$_.FileId -ne [decimal]::Truncate([decimal]$_.FileId) -or [string]::IsNullOrWhiteSpace($_.LogicalName)}).Count -gt 0){throw 'CLEAN_RESTORE_FILELIST_INVALID'}
 if(@($files|Where-Object Type -ceq 'D').Count -eq 0 -or @($files|Where-Object Type -ceq 'L').Count -eq 0 -or @($files|Group-Object LogicalName|Where-Object Count -gt 1).Count -or @($files|Group-Object FileId|Where-Object Count -gt 1).Count){throw 'CLEAN_RESTORE_FILELIST_INVALID'}
 [decimal]$required=1GB
 $moves=@();foreach($file in $files){
  $required+=[decimal]$file.Size
  $extension=if($file.Type -ceq 'L'){'.ldf'}elseif($file.FileId -eq 1){'.mdf'}else{'.ndf'}
  $path=Join-Path $restoreRoot ($restoreDb+'_'+$file.FileId+$extension)
  if([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($path)) -cne $restoreRoot){throw 'CLEAN_RESTORE_PATH_INVALID'}
  $moves+=@{logicalName=[string]$file.LogicalName;fileId=[int]$file.FileId;type=[string]$file.Type;sizeBytes=[long]$file.Size;proposedPath=$path}
 }
 if($required -gt [long]::MaxValue -or $availableBytes -lt $required){throw 'CLEAN_RESTORE_INSUFFICIENT_CAPACITY'}
 if($CleanBackup -ceq 'C5-20261025-0300' -and [string]$h.BackupSetGUID -ine 'b8b6ee89-1886-4fbd-be27-065343c02d25'){throw 'CLEAN_RESTORE_BACKUP_CHANGED'}
 return @{schemaVersion='melisa-goal6.clean-preflight.v2';server=$server;sourceDatabase=$sourceDb;proposedRestoreDatabase=$restoreDb;restoreRoot=$restoreRoot;backupFile=$backupFile;backupSetGuid=[string]$h.BackupSetGUID;sqlBackupStart=([datetime]$h.BackupStartDate).ToString('o');sqlBackupFinish=([datetime]$h.BackupFinishDate).ToString('o');requiredBytes=[long]$required;availableBytes=$availableBytes;moves=$moves;copyOnly=$true;checksum=$true;restoreExecuted=$false;sourceBackupCreated=$false;targetCreated=$false;applicationConnectionChanged=$false;humanAcceptance='PENDING';coverage='Existing backup header/file-list and proposed empty target only; not restored data or current application recovery proof'}
}
function Assert-CleanPath([string]$path){
 for($p=$path;$p;$p=[IO.Path]::GetDirectoryName($p)){
  if(Test-Path -LiteralPath $p){if((Get-Item -LiteralPath $p -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'CLEAN_RESTORE_REPARSE_PATH'}}
 }
}
function CleanPreflight($cn){
 $source=Open-VerifiedConnection $sourceDb
 try{
  $identity=@(Rows $source "SELECT environment_id,synthetic,actual_t1,external_operations FROM dbo.clean_test_environment WHERE id=1")
  if($identity.Count -ne 1 -or [string]$identity[0].environment_id -ine 'e662fd94-d797-4b3b-938a-d143ad758b67' -or !$identity[0].synthetic -or $identity[0].actual_t1 -or $identity[0].external_operations){throw 'CLEAN_RESTORE_SOURCE_IDENTITY_INVALID'}
 }finally{$source.Close()}
 Assert-CleanPath $backupFile;Assert-CleanPath $restoreRoot
 if(!(Test-Path -LiteralPath $backupFile -PathType Leaf)){throw 'CLEAN_RESTORE_BACKUP_MISSING'}
 $beforeHash=(Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash
 $header=@(Rows $cn "RESTORE HEADERONLY FROM DISK=N'$backupFile'")
 $files=@(Rows $cn "RESTORE FILELISTONLY FROM DISK=N'$backupFile'")
 $existing=@(Rows $cn "SELECT name FROM sys.databases WHERE name=N'$restoreDb'")
 $result=Assert-CleanBackupCandidate $header $files ($existing.Count -ne 0) (Test-Path -LiteralPath $restoreRoot) ([long](Get-PSDrive -Name C).Free)
 $afterHash=(Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash
 if($beforeHash -cne $afterHash){throw 'CLEAN_RESTORE_BACKUP_CHANGED'}
 if($CleanBackup -ceq 'C5-20261025-0300' -and $afterHash -cne 'FD9096307DCB058813E7A8732A4665C4CD9809CBA257403A88EAE8978795C891'){throw 'CLEAN_RESTORE_BACKUP_CHANGED'}
 $result.backupSha256=$afterHash;$result.observedAt=[DateTime]::UtcNow.ToString('o')
 $result.operatorSha256=(Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash
 $result.status='READY';$result.cleanBackup=$CleanBackup
 $result.synthetic=$true;$result.actualT1=$false;$result.externalOperations=$false
 return $result
}
function Assert-CleanRestoreReceipt($receipt,[datetimeoffset]$now,[string]$operatorHash){
 if($receipt.schemaVersion -cne 'melisa-goal6.clean-preflight.v2' -or $receipt.status -cne 'READY' -or $receipt.server -cne $server -or $receipt.sourceDatabase -cne $sourceDb -or $receipt.proposedRestoreDatabase -cne $restoreDb -or $receipt.restoreRoot -cne $restoreRoot -or $receipt.backupFile -cne $backupFile -or $receipt.cleanBackup -cne $CleanBackup -or $receipt.operatorSha256 -cne $operatorHash -or $receipt.backupSha256 -cnotmatch '^[A-Fa-f0-9]{64}$' -or !$receipt.backupSetGuid -or $receipt.synthetic -ne $true -or $receipt.actualT1 -ne $false -or $receipt.externalOperations -ne $false -or $receipt.copyOnly -ne $true -or $receipt.checksum -ne $true -or $receipt.restoreExecuted -ne $false -or $receipt.targetCreated -ne $false -or $receipt.sourceBackupCreated -ne $false -or $receipt.applicationConnectionChanged -ne $false){throw 'CLEAN_RESTORE_PREFLIGHT_MISMATCH'}
 $at=[datetimeoffset]::MinValue
 if([string]$receipt.observedAt -cnotmatch 'Z$' -or ![datetimeoffset]::TryParse([string]$receipt.observedAt,[ref]$at) -or $at -gt $now -or ($now-$at).TotalMinutes -gt 30){throw 'CLEAN_RESTORE_PREFLIGHT_STALE'}
}
function Read-CleanRestoreReceipt {
 if([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($CleanPreflightReceipt)) -cne $evidenceRoot -or [IO.Path]::GetFileName($CleanPreflightReceipt) -cnotmatch '^c6-clean-preflight-[a-f0-9]{32}\.json$'){throw 'CLEAN_RESTORE_RECEIPT_PATH_INVALID'}
 Assert-CleanPath $CleanPreflightReceipt
 $bytes=[IO.File]::ReadAllBytes($CleanPreflightReceipt)
 $hash=[BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($bytes)).Replace('-','')
 if($hash -ine $CleanPreflightSha256){throw 'CLEAN_RESTORE_RECEIPT_HASH_MISMATCH'}
 # PS7.5+ otherwise converts ISO strings to DateTime, unlike PS5. Preserve receipt bytes' date semantics.
 $jsonOptions=@{}
 if((Get-Command ConvertFrom-Json -CommandType Cmdlet).Parameters.ContainsKey('DateKind')){$jsonOptions.DateKind='String'}
 $receipt=[Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json @jsonOptions
 Assert-CleanRestoreReceipt $receipt ([datetimeoffset]::UtcNow) ((Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash)
 return $receipt
}
function Open-CleanBackupReadLock {return [IO.File]::Open($backupFile,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)}
function Restore-CleanBackup($cn,$receipt){
 # The supplied receipt is checked before connecting, then all mutable facts are read
 # again. A historical receipt never grants authority for a different backup.
 Assert-CleanPath $backupFile
 $readLock=Open-CleanBackupReadLock
 try{
 $fresh=CleanPreflight $cn
 Assert-CleanRestoreReceipt $receipt ([datetimeoffset]::UtcNow) $fresh.operatorSha256
 if($receipt.backupSha256 -cne $fresh.backupSha256 -or $receipt.backupSetGuid -cne $fresh.backupSetGuid -or $receipt.sqlBackupStart -ne $fresh.sqlBackupStart -or $receipt.sqlBackupFinish -ne $fresh.sqlBackupFinish){throw 'CLEAN_RESTORE_PREFLIGHT_MISMATCH'}
 $sqlMoves=@($fresh.moves|ForEach-Object {"MOVE N'$($_.logicalName.Replace("'","''"))' TO N'$($_.proposedPath.Replace("'","''"))'"}) -join ','
 # No -Force: creating this new fixed directory also rejects concurrent/repeated runs.
 # A failed attempt is retained; it is never deleted or automatically retried.
 New-Item -ItemType Directory -Path $restoreRoot -ErrorAction Stop | Out-Null
 $started=[DateTime]::UtcNow.ToString('o')
 Execute $cn "IF DB_ID(N'$restoreDb') IS NOT NULL THROW 51900,'CLEAN_RESTORE_TARGET_EXISTS',1; RESTORE DATABASE [$restoreDb] FROM DISK=N'$backupFile' WITH CHECKSUM,RECOVERY,$sqlMoves;"
 Execute $cn "ALTER DATABASE [$restoreDb] SET READ_ONLY WITH NO_WAIT;"
 $state=@(Rows $cn "SELECT d.name,d.state_desc,d.is_read_only,e.environment_id,e.synthetic,e.actual_t1,e.external_operations FROM sys.databases d CROSS JOIN [$restoreDb].dbo.clean_test_environment e WHERE d.name=N'$restoreDb' AND e.id=1")
 if($state.Count -ne 1 -or $state[0].name -cne $restoreDb -or $state[0].state_desc -cne 'ONLINE' -or !$state[0].is_read_only -or [string]$state[0].environment_id -ine 'e662fd94-d797-4b3b-938a-d143ad758b67' -or !$state[0].synthetic -or $state[0].actual_t1 -or $state[0].external_operations){throw 'CLEAN_RESTORE_READBACK_FAILED'}
 return @{schemaVersion='melisa-goal6.clean-restore.v1';server=$server;sourceDatabase=$sourceDb;database=$restoreDb;backupFile=$backupFile;backupSha256=$fresh.backupSha256;backupSetGuid=$fresh.backupSetGuid;moves=$fresh.moves;preflightSha256=$CleanPreflightSha256;approvalReference=$CleanRestoreApprovalReference;startedAt=$started;completedAt=[DateTime]::UtcNow.ToString('o');restored=$true;readOnly=$true;activeDatabaseOverwritten=$false;retainedForEvidence=$true;humanAcceptance='PENDING';coverage='Separate SQL restore and ONLINE READ_ONLY state only; row reconciliation and full ERP/CRM recovery remain pending'}
 }finally{$readLock.Dispose()}
}
function Snapshot([string]$db){
 $cn=Open-VerifiedConnection $db
 try {
  $tables=@('dbo.products','dbo.customers','dbo.suppliers','dbo.product_prices','dbo.product_barcodes','dbo.party_currency_accounts','dbo.sales_invoices','dbo.sales_invoice_items','dbo.purchase_invoices','dbo.purchase_invoice_items','dbo.customer_movements','dbo.supplier_movements','dbo.stock_movements','dbo.finance_account_movements','dbo.roles','dbo.permissions','dbo.users','dbo.work_inbound_counts','dbo.work_sales_links','dbo.work_collection_links','dbo.work_supplier_payment_requests','dbo.test_daily_drafts','dbo.test_daily_requests','dbo.crm_order_v2_requests','dbo.crm_order_v2_lines','dbo.crm_order_v2_intents','erp_migration.accepted_price_manifest','erp_migration.accepted_price_products','erp_migration.accepted_price_values','erp_migration.operation_quarantine_manifest','erp_migration.operation_quarantine_holds','erp_migration.runs','erp_migration.records')
  $result=@();$started=[DateTime]::UtcNow.ToString('o')
  foreach($table in $tables){
   $q="IF OBJECT_ID(N'$table',N'U') IS NULL THROW 51900,'GOAL6_CRITICAL_TABLE_MISSING',1; SELECT COUNT_BIG(*) [rowCount], CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CONVERT(nvarchar(max),h.hash),N';') WITHIN GROUP(ORDER BY h.hash)),2) sha256 FROM $table t CROSS APPLY(SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT t.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) hash) h"
   $row=@(Rows $cn $q)[0];$result+=@{table=$table;count=$row.rowCount;sha256=$row.sha256};Write-Output "HASH_READ $db $table $($row.rowCount)" | Out-Host
  }
  $guards=@(Rows $cn "SELECT SCHEMA_NAME(o.schema_id) schemaName,o.name,o.type,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(o.object_id)),2) sha256, CASE WHEN o.type='TR' THEN OBJECTPROPERTY(o.object_id,'ExecIsTriggerDisabled') ELSE 0 END disabled FROM sys.objects o WHERE o.type IN('P','TR') AND o.is_ms_shipped=0 ORDER BY schemaName,o.name")
  if($guards|Where-Object {$null -eq $_.sha256}){throw 'GOAL6_UNREADABLE_GUARD'}
  return @{schemaVersion='melisa-goal6.sql-snapshot.v1';database=$db;startedAt=$started;completedAt=[DateTime]::UtcNow.ToString('o');atomic=$false;method='SHA2_256 sorted row-JSON hashes; quiescent source proven by equal before/after digests';tables=$result;guards=$guards}
 }finally{$cn.Close()}
}
function Preflight($cn){
 Assert-NewRestore $cn
 if(Test-Path -LiteralPath $backupFile){throw 'GOAL6_BACKUP_FILE_EXISTS'}
 $source=Open-VerifiedConnection $sourceDb
 try{
  $files=@(Rows $source 'SELECT name,type_desc,physical_name,CAST(size AS bigint)*8192 sizeBytes FROM sys.database_files')
  if($files.Count -ne 2 -or $files[0].name -cne 'MELISA_ERP_V2' -or $files[1].name -cne 'MELISA_ERP_V2_log'){throw 'GOAL6_UNEXPECTED_SOURCE_FILES'}
  $vol=@(Rows $source 'SELECT volume_mount_point,MIN(available_bytes) available_bytes FROM sys.database_files f CROSS APPLY sys.dm_os_volume_stats(DB_ID(),f.file_id) GROUP BY volume_mount_point')
  $needed=([long]($files|Measure-Object sizeBytes -Sum).Sum)*2+10GB
  if($vol.Count -ne 1 -or $vol[0].volume_mount_point -cne 'C:\' -or $vol[0].available_bytes -lt $needed){throw 'GOAL6_INSUFFICIENT_CAPACITY'}
  return @{schemaVersion='melisa-goal6.backup-preflight.v1';server=$server;sourceDatabase=$sourceDb;restoreDatabase=$restoreDb;backupFile=$backupFile;dataFile=$dataFile;logFile=$logFile;sourceFiles=$files;availableBytes=$vol[0].available_bytes;requiredConservativeBytes=$needed;existingTargetAllowed=$false;overwriteAllowed=$false}
 }finally{$source.Close()}
}
# Reject missing/stale/mismatched receipts before connection or filesystem writes.
$cleanReceipt=if($Profile -ceq 'Clean20261022' -and $Mode -ceq 'Rehearse'){Read-CleanRestoreReceipt}else{$null}
if($Profile -cne 'Clean20261022'){New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null}
$master=Open-VerifiedConnection 'master'
try {
 if($Profile -ceq 'Clean20261022'){
  $name=if($Mode -ceq 'Preflight'){'c6-clean-preflight-'}else{'c6-clean-restore-'}
  $result=if($Mode -ceq 'Preflight'){CleanPreflight $master}else{Restore-CleanBackup $master $cleanReceipt}
  $file=Join-Path $evidenceRoot ($name+[guid]::NewGuid().ToString('N')+'.json')
  $stream=[IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try{$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($result|ConvertTo-Json -Depth 14));$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
  Write-Output $file;Write-Output (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash;exit
 }
 if($Mode -eq 'Preflight'){Save 'backup-preflight.json' (Preflight $master);Write-Output 'PREFLIGHT_READY';exit}
 if($Mode -eq 'Rehearse'){
  $pre=Preflight $master;Save 'backup-preflight.json' $pre
  New-Item -ItemType Directory -Path $backupRoot,$restoreRoot -Force | Out-Null
  # All source reads finish before COPY_ONLY; source remains available throughout.
  if($ReuseCompletedSourceProof){
   $before=Get-Content -LiteralPath (Join-Path $evidenceRoot 'backup-source-before.json') -Raw|ConvertFrom-Json
   if($before.database -cne $sourceDb -or $before.tables.Count -ne 33 -or ([DateTime]::UtcNow-[DateTime]$before.completedAt).TotalMinutes -gt 30){throw 'GOAL6_REUSED_SOURCE_PROOF_INVALID'}
  }else{$before=Snapshot $sourceDb;Save 'backup-source-before.json' $before}
  $edition=@(Rows $master "SELECT CONVERT(nvarchar(128),SERVERPROPERTY('Edition')) edition,CONVERT(int,SERVERPROPERTY('EngineEdition')) engineEdition")[0]
  # Express does not support compression; COPY_ONLY/CHECKSUM remain mandatory.
  $compression=if($edition.engineEdition -eq 4){''}else{',COMPRESSION'}
  $started=[DateTime]::UtcNow.ToString('o');$timer=[Diagnostics.Stopwatch]::StartNew()
  if(Test-Path -LiteralPath $backupFile){throw 'GOAL6_BACKUP_FILE_EXISTS'}
  Execute $master "IF DB_ID(N'$sourceDb') IS NULL THROW 51900,'GOAL6_SOURCE_MISSING',1; BACKUP DATABASE [$sourceDb] TO DISK=N'$backupFile' WITH COPY_ONLY,CHECKSUM$compression,NOINIT,STATS=10;"
  $timer.Stop();$backupMs=$timer.ElapsedMilliseconds;Write-Output "BACKUP_COMPLETE $backupMs ms"
  $header=@(Rows $master "RESTORE HEADERONLY FROM DISK=N'$backupFile'")
  Assert-BackupHeader $header
  $verifyTimer=[Diagnostics.Stopwatch]::StartNew();Execute $master "RESTORE VERIFYONLY FROM DISK=N'$backupFile' WITH CHECKSUM;";$verifyTimer.Stop()
  $list=@(Rows $master "RESTORE FILELISTONLY FROM DISK=N'$backupFile'")
  if($list.Count -ne 2 -or $list[0].LogicalName -cne 'MELISA_ERP_V2' -or $list[1].LogicalName -cne 'MELISA_ERP_V2_log'){throw 'GOAL6_BACKUP_FILELIST_INVALID'}
  $backupSha=(Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash
  $backup=@{schemaVersion='melisa-goal6.backup.v1';sourceDatabase=$sourceDb;server=$server;file=$backupFile;startedAt=$started;completedAt=[DateTime]::UtcNow.ToString('o');backupMs=$backupMs;verifyMs=$verifyTimer.ElapsedMilliseconds;sizeBytes=(Get-Item -LiteralPath $backupFile).Length;sha256=$backupSha;copyOnly=$true;checksum=$true;compressed=($edition.engineEdition -ne 4);sqlEdition=$edition.edition;verifyOnlyPassed=$true;sqlBackupStart=$header[0].BackupStartDate;sqlBackupFinish=$header[0].BackupFinishDate;lsnStart=[string]$header[0].FirstLSN;lsnFinish=[string]$header[0].LastLSN;backupSetGuid=[string]$header[0].BackupSetGUID}
  Save 'backup-result.json' $backup
  # Re-check just before restore; no REPLACE and no pre-existing database/file.
  Assert-NewRestore $master
  $restoreStarted=[DateTime]::UtcNow.ToString('o');$timer.Restart()
  Execute $master "IF DB_ID(N'$restoreDb') IS NOT NULL THROW 51900,'GOAL6_RESTORE_TARGET_EXISTS',1; RESTORE DATABASE [$restoreDb] FROM DISK=N'$backupFile' WITH CHECKSUM,RECOVERY,MOVE N'MELISA_ERP_V2' TO N'$dataFile',MOVE N'MELISA_ERP_V2_log' TO N'$logFile',STATS=10;"
  $timer.Stop();$restoreMs=$timer.ElapsedMilliseconds
  Execute $master "ALTER DATABASE [$restoreDb] SET READ_ONLY WITH NO_WAIT;"
  Save 'restore-result.json' @{schemaVersion='melisa-goal6.restore.v1';server=$server;sourceDatabase=$sourceDb;database=$restoreDb;backupFile=$backupFile;backupSha256=$backupSha;dataFile=$dataFile;logFile=$logFile;startedAt=$restoreStarted;completedAt=[DateTime]::UtcNow.ToString('o');restoreMs=$restoreMs;restored=$true;readOnly=$true;activeDatabaseOverwritten=$false;retainedForEvidence=$true}
  Write-Output "RESTORE_COMPLETE $restoreMs ms READ_ONLY"
 }
 if($Mode -in @('Rehearse','Proof')){
  $before=Get-Content -LiteralPath (Join-Path $evidenceRoot 'backup-source-before.json') -Raw|ConvertFrom-Json
  $after=Snapshot $sourceDb;Save 'backup-source-after.json' $after
  $restored=Snapshot $restoreDb;Save 'restore-snapshot.json' $restored
  $changes=@();foreach($b in $before.tables){$a=@($after.tables|Where-Object table -eq $b.table)[0];$r=@($restored.tables|Where-Object table -eq $b.table)[0];if($a.count -ne $b.count -or $a.sha256 -cne $b.sha256 -or $r.count -ne $b.count -or $r.sha256 -cne $b.sha256){$changes+=$b.table}}
  $guardChanges=@(Compare-Object ($before.guards|ConvertTo-Json -Depth 5) ($after.guards|ConvertTo-Json -Depth 5));$restoredGuardChanges=@(Compare-Object ($before.guards|ConvertTo-Json -Depth 5) ($restored.guards|ConvertTo-Json -Depth 5))
  $comparison=@{schemaVersion='melisa-goal6.restore-comparison.v1';comparedAt=[DateTime]::UtcNow.ToString('o');tablesCompared=$before.tables.Count;guardDefinitionsCompared=$before.guards.Count;sourceBeforeAfterEqual=($changes.Count -eq 0 -and $guardChanges.Count -eq 0);restoredMatchesSource=($changes.Count -eq 0 -and $restoredGuardChanges.Count -eq 0);changedTables=$changes;guardChanges=$guardChanges;restoredGuardChanges=$restoredGuardChanges;atomic=$false;coverage='33 critical tables including finance, roles, price and migration metadata; all user procedures/triggers; not whole database'}
  Save 'restore-comparison.json' $comparison
  if(-not $comparison.sourceBeforeAfterEqual -or -not $comparison.restoredMatchesSource){throw 'GOAL6_RESTORE_FINGERPRINT_MISMATCH'}
  Write-Output 'RESTORE_COMPARISON_PASS'
 }
 if($Mode -eq 'Negatives'){
  $results=@()
  try{$bad=Open-VerifiedConnection 'MELISA_ERP_PROD_CANDIDATE_20260917_01';throw 'NEGATIVE_DID_NOT_FAIL'}catch{if($_.Exception.Message -cne 'GOAL6_WRONG_DATABASE'){throw};$results+=@{case='wrong-database';result='blocked-before-connect'}}
  try{Assert-BackupHeader @([pscustomobject]@{DatabaseName='WRONG_TEST_DATABASE';IsCopyOnly=$true;HasBackupChecksums=$true;IsDamaged=$false;BackupType=1});throw 'NEGATIVE_DID_NOT_FAIL'}catch{if($_.Exception.Message -cne 'GOAL6_BACKUP_HEADER_INVALID'){throw};$results+=@{case='wrong-backup-database';result='production guard rejected injected header before restore';sqlRestoreAttempted=$false;kind='guard input negative; not a second real database backup'}}
  try{Assert-NewRestore $master;throw 'NEGATIVE_DID_NOT_FAIL'}catch{if($_.Exception.Message -cne 'GOAL6_RESTORE_TARGET_EXISTS'){throw};$results+=@{case='existing-restore-target';result='blocked-before-restore'}}
  $missing=Join-Path $backupRoot 'NONEXISTENT-PARENT\denied.bak';if(Test-Path -LiteralPath ([IO.Path]::GetDirectoryName($missing))){throw 'NEGATIVE_PATH_EXISTS'}
  try{Execute $master "BACKUP DATABASE [$sourceDb] TO DISK=N'$missing' WITH COPY_ONLY,CHECKSUM;";throw 'NEGATIVE_DID_NOT_FAIL'}catch{if($_.Exception.Message -eq 'NEGATIVE_DID_NOT_FAIL'){throw};$results+=@{case='unavailable-backup-path';result='SQL rejected unavailable parent; source untouched';fileCreated=(Test-Path -LiteralPath $missing)}}
  $badFile=Join-Path $backupRoot 'INVALID_GOAL6_NOT_A_SQL_BACKUP.bak';if(-not(Test-Path -LiteralPath $badFile)){[IO.File]::WriteAllText($badFile,'Goal6 deliberately invalid backup; isolated negative test.')} 
  try{$null=Rows $master "RESTORE HEADERONLY FROM DISK=N'$badFile';";throw 'NEGATIVE_DID_NOT_FAIL'}catch{if($_.Exception.Message -eq 'NEGATIVE_DID_NOT_FAIL'){throw};$results+=@{case='malformed-backup';result='SQL header rejected before restore';restoreAttempted=$false}}
  Save 'backup-restore-negatives.json' @{schemaVersion='melisa-goal6.backup-negatives.v1';recordedAt=[DateTime]::UtcNow.ToString('o');cases=$results;activeOverwrite=$false;liveConnected=$false}
  Write-Output 'BACKUP_RESTORE_NEGATIVES_PASS'
 }
} catch {
 if($Profile -cne 'Clean20261022'){Save 'backup-restore-last-failure.json' @{schemaVersion='melisa-goal6.backup-failure.v1';recordedAt=[DateTime]::UtcNow.ToString('o');mode=$Mode;sourceDatabase=$sourceDb;restoreDatabase=$restoreDb;code='BACKUP_RESTORE_REHEARSAL_FAILED';activeOverwriteAllowed=$false;secretsLogged=$false}}
 throw
} finally {$master.Close()}
