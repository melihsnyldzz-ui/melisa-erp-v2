param([ValidateSet('Preflight','Capture')][string]$Mode='Preflight',[Parameter(Mandatory=$true)][ValidateSet('Pre','Post')][string]$Phase)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$p03Server='Semih\MELISADEV'
$p03Source='MELISA_ERP_CRM_SHARED_TEST_20261009_02'
$p03Clone=if($Phase -ceq 'Pre'){'MELISA_ERP_P03_PR54_PRE_20261018'}else{'MELISA_ERP_P03_PR54_POST_20261018'}
$p03Run=if($Phase -ceq 'Pre'){'P03-20261018-140001'}else{'P03-20261018-140002'}
$p03Root=Join-Path 'C:\Sirket\ERP\backups' $p03Run
$p03Backup=Join-Path $p03Root 'DB02_COPY_ONLY.bak'
$p03BackupSha=$null
$p03RestoreRoot=Join-Path $p03Root 'invariance-readonly'
$p03Data=Join-Path $p03RestoreRoot 'P03_RESTORE_ONLY.mdf'
$p03Log=Join-Path $p03RestoreRoot 'P03_RESTORE_ONLY_log.ldf'
$p03Baseline='C:\Sirket\ERP\reports\p03-db02-content-baseline-20261017.json'
function Assert-True($condition,[string]$code){if(-not $condition){throw $code}}
function Assert-Paths {
 foreach($file in @($p03Backup,$p03RestoreRoot,$p03Data,$p03Log,$p03Baseline)){
  for($part=[IO.Path]::GetFullPath($file);$part;$part=[IO.Path]::GetDirectoryName($part)){
   if(Test-Path -LiteralPath $part){Assert-True (-not ((Get-Item -LiteralPath $part -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) 'P03_RESTORE_REPARSE_REJECTED'}
  }
 }
 Assert-True ($p03Clone -cne $p03Source -and $p03Clone -cin @('MELISA_ERP_P03_PR54_PRE_20261018','MELISA_ERP_P03_PR54_POST_20261018')) 'P03_RESTORE_SCOPE'
 Assert-True ([IO.Path]::GetDirectoryName($p03Data) -ceq $p03RestoreRoot -and [IO.Path]::GetDirectoryName($p03Log) -ceq $p03RestoreRoot) 'P03_RESTORE_PATH_SCOPE'
}
function Open-Database([string]$database){
 Assert-True ($database -cin @('master',$p03Source,$p03Clone)) 'P03_RESTORE_DATABASE_REJECTED'
 $connection=[Data.SqlClient.SqlConnection]::new("Server=$p03Server;Database=$database;Integrated Security=True;Encrypt=False;Application Name=MelisaP03IsolatedRestore;Connect Timeout=5")
 $connection.Open();$identity=@(Rows $connection "SELECT CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) serverName,DB_NAME() databaseName")[0]
 if($identity.serverName -cne $p03Server -or $identity.databaseName -cne $database){$connection.Dispose();throw 'P03_RESTORE_IDENTITY_MISMATCH'}
 return $connection
}
function Rows($connection,[string]$sql,[int]$timeout=1800){
 $command=$connection.CreateCommand();$command.CommandText=$sql;$command.CommandTimeout=$timeout
 try{$reader=$command.ExecuteReader();$rows=@();try{do{while($reader.Read()){$row=[ordered]@{};for($i=0;$i-lt $reader.FieldCount;$i++){$row[$reader.GetName($i)]=if($reader.IsDBNull($i)){$null}else{$reader.GetValue($i)}};$rows+=[pscustomobject]$row}}while($reader.NextResult())}finally{$reader.Close()};return $rows}finally{$command.Dispose()}
}
function Execute($connection,[string]$sql){$command=$connection.CreateCommand();$command.CommandText=$sql;$command.CommandTimeout=1800;try{[void]$command.ExecuteNonQuery()}finally{$command.Dispose()}}
function Save-New([string]$name,$value){$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 14));$stream=[IO.File]::Open((Join-Path $p03RestoreRoot $name),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}}
function Source-Identity($connection){
 $identity=@(Rows $connection "SELECT database_id,name,create_date,state_desc,is_read_only FROM sys.databases WHERE name=N'$p03Source'" 5)
 Assert-True ($identity.Count -eq 1 -and $identity[0].name -ceq $p03Source -and $identity[0].state_desc -ceq 'ONLINE') 'P03_SOURCE_IDENTITY_CHANGED'
 $files=@(Rows $connection "SELECT file_id,name,type_desc,physical_name FROM sys.master_files WHERE database_id=DB_ID(N'$p03Source') ORDER BY file_id" 5)
 return [ordered]@{database=$identity[0];files=$files}
}
function Snapshot([string]$database,[string[]]$tableNames){
 Assert-True ($database -ceq $p03Clone) 'P03_SNAPSHOT_CLONE_ONLY'
 $connection=Open-Database $database
 try{
  Execute $connection 'SET LOCK_TIMEOUT 3000; SET DEADLOCK_PRIORITY LOW;'
  $lsn=@(Rows $connection 'SELECT log_end_lsn lsn FROM sys.dm_db_log_stats(DB_ID())' 5)[0].lsn
  $tables=@();$deadline=[DateTime]::UtcNow.AddMinutes(10)
  function RemainingSeconds { $remaining=[int][Math]::Floor(($deadline-[DateTime]::UtcNow).TotalSeconds);Assert-True ($remaining -gt 0) 'P03_SNAPSHOT_TIME_BUDGET';return [Math]::Min(30,$remaining) }
  foreach($table in $tableNames){
   Assert-True ($table -cmatch '^(dbo|erp_migration)\.[a-zA-Z0-9_]+$') 'P03_TABLE_SCOPE'
   Assert-True ([DateTime]::UtcNow -lt $deadline) 'P03_SNAPSHOT_TIME_BUDGET'
   $parts=$table.Split('.');$qualified='['+$parts[0]+'].['+$parts[1]+']'
   # Stream only one SHA per row. Sorting/aggregation stays outside SQL so a
   # large ordered STRING_AGG cannot monopolize the shared TEST query budget.
   $command=$connection.CreateCommand();$command.CommandTimeout=RemainingSeconds
   $command.CommandText="SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT t.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) rowHash FROM $qualified t OPTION(MAXDOP 1)"
   $hashes=[Collections.Generic.List[string]]::new();$reader=$null
   try{
    $reader=$command.ExecuteReader()
    while($reader.Read()){
     $hash=$reader.GetString(0);Assert-True ($hash -cmatch '^[A-F0-9]{64}$') 'P03_ROW_HASH'
     $hashes.Add($hash)
     if(($hashes.Count -band 4095) -eq 0){Assert-True ($hashes.Count -le 3000000 -and [DateTime]::UtcNow -lt $deadline) 'P03_STREAM_BUDGET'}
    }
   }finally{if($null -ne $reader){$reader.Close()};$command.Dispose()}
   Assert-True ($hashes.Count -le 3000000 -and [DateTime]::UtcNow -lt $deadline) 'P03_STREAM_FINAL_BUDGET'
   $sorted=$hashes.ToArray();[Array]::Sort($sorted,[StringComparer]::Ordinal)
   $aggregate=[Security.Cryptography.IncrementalHash]::CreateHash([Security.Cryptography.HashAlgorithmName]::SHA256)
   try{
    $count=0L
    foreach($hash in $sorted){if(($count -band 4095) -eq 0){Assert-True ([DateTime]::UtcNow -lt $deadline) 'P03_CLIENT_HASH_BUDGET'};$aggregate.AppendData([Text.Encoding]::UTF8.GetBytes($hash+"`n"));$count++}
    $digest=[BitConverter]::ToString($aggregate.GetHashAndReset()).Replace('-','').ToLowerInvariant()
   }finally{$aggregate.Dispose()}
   $tables+=[ordered]@{table=$table;count=$count;sha256=$digest}
  }
  $modules=@(Rows $connection "SELECT SCHEMA_NAME(o.schema_id) schemaName,o.name,o.type,CONVERT(varchar(64),HASHBYTES('SHA2_256',m.definition),2) sha256 FROM sys.objects o JOIN sys.sql_modules m ON m.object_id=o.object_id WHERE o.is_ms_shipped=0 ORDER BY schemaName,o.name,o.type" (RemainingSeconds))
  Assert-True (@($modules|Where-Object {$null -eq $_.sha256}).Count -eq 0) 'P03_UNREADABLE_SQL_MODULE'
  $permissions=@(Rows $connection 'SELECT dp.name principalName,p.class,p.major_id,p.minor_id,p.permission_name,p.state FROM sys.database_permissions p JOIN sys.database_principals dp ON dp.principal_id=p.grantee_principal_id ORDER BY dp.name,p.class,p.major_id,p.minor_id,p.permission_name,p.state' (RemainingSeconds))
  $memberships=@(Rows $connection 'SELECT rp.name roleName,mp.name memberName FROM sys.database_role_members rm JOIN sys.database_principals rp ON rp.principal_id=rm.role_principal_id JOIN sys.database_principals mp ON mp.principal_id=rm.member_principal_id ORDER BY rp.name,mp.name' (RemainingSeconds))
  $principals=@(Rows $connection 'SELECT name,type,default_schema_name,authentication_type_desc,owning_principal_id,CONVERT(varchar(170),sid,2) sid FROM sys.database_principals WHERE principal_id>4 ORDER BY name,type' (RemainingSeconds))
  $last=@(Rows $connection 'SELECT log_end_lsn lsn FROM sys.dm_db_log_stats(DB_ID())' (RemainingSeconds))[0].lsn
  Assert-True ([string]$lsn -ceq [string]$last) 'P03_READONLY_CLONE_CHANGED_DURING_SNAPSHOT'
  return [ordered]@{database=$database;capturedAt=[DateTime]::UtcNow.ToString('o');tables=$tables;modules=$modules;permissions=$permissions;memberships=$memberships;principals=$principals;logEndBefore=[string]$lsn;logEndAfter=[string]$last;coverage='51 critical business tables; readable SQL modules, explicit permissions, role memberships and principals; not all764 table contents'}
 }finally{$connection.Dispose()}
}
# Capture a consistent backup recovery point, then hash only its isolated clone.
# No source table locks, source configuration changes or source business DML.
$backupScript=Join-Path $PSScriptRoot 'p03-test-backup.ps1'
$baselineSha='b2789bfcd1e2dbc9d3f7e7cc394fa4a1c31ac759e1db3f67f2db007c00c849aa'
Assert-Paths
Assert-True ((Get-FileHash -LiteralPath $p03Baseline -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $baselineSha) 'P03_INVARIANCE_TABLE_LIST_PIN'
Assert-True ((Get-FileHash -LiteralPath $backupScript -Algorithm SHA256).Hash.ToLowerInvariant() -ceq '5700edc949f377aff61c426492606e696a2af06bdd1824e7d7516b9b837fdfcb') 'P03_INVARIANCE_BACKUP_SOURCE_PIN'
$admission=Open-Database 'master'
try{Assert-True (@(Rows $admission "SELECT name FROM sys.databases WHERE name=N'$p03Clone'" 5).Count -eq 0) 'P03_INVARIANCE_CLONE_ALREADY_EXISTS'}finally{$admission.Dispose()}
Assert-True ((Get-PSDrive C).Free -gt 50GB) 'P03_INVARIANCE_CAPACITY'
if($Mode -ceq 'Preflight'){
 & $backupScript -Mode Preflight -RunId $p03Run
 return
}
& $backupScript -Mode Backup -RunId $p03Run | Out-Null
$backupProof=Get-Content -LiteralPath (Join-Path $p03Root 'backup-verified.json') -Raw|ConvertFrom-Json
Assert-True ($backupProof.database -ceq $p03Source -and $backupProof.copyOnly -and $backupProof.checksumVerified -and $backupProof.backupFile -ceq $p03Backup) 'P03_INVARIANCE_BACKUP_SCOPE'
$p03BackupSha=$backupProof.sha256
Assert-Paths
Assert-True (-not(Test-Path -LiteralPath $p03RestoreRoot)) 'P03_RESTORE_RUN_ALREADY_EXISTS'
$p03BackupHandle=[IO.File]::Open($p03Backup,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
$master=$null
try{
 Assert-True ((Get-FileHash -LiteralPath $p03Backup -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $p03BackupSha) 'P03_BACKUP_HASH_MISMATCH'
 $master=Open-Database 'master'
 $existing=@(Rows $master "SELECT name FROM sys.databases WHERE name=N'$p03Clone'")
 Assert-True ($existing.Count -eq 0 -and -not(Test-Path -LiteralPath $p03Data) -and -not(Test-Path -LiteralPath $p03Log)) 'P03_RESTORE_OVERWRITE_REJECTED'
 $header=@(Rows $master "RESTORE HEADERONLY FROM DISK=N'$p03Backup'")
 Assert-True ($header.Count -eq 1 -and $header[0].DatabaseName -ceq $p03Source -and $header[0].IsCopyOnly -and $header[0].HasBackupChecksums -and -not $header[0].IsDamaged -and $header[0].BackupType -eq 1) 'P03_RESTORE_BACKUP_HEADER'
 $files=@(Rows $master "RESTORE FILELISTONLY FROM DISK=N'$p03Backup'")
 Assert-True ($files.Count -eq 2 -and $files[0].LogicalName -ceq 'MELISA_ERP_V2' -and $files[1].LogicalName -ceq 'MELISA_ERP_V2_log') 'P03_RESTORE_FILELIST'
 $required=[long]($files|Measure-Object Size -Sum).Sum+15GB
 Assert-True ((Get-PSDrive C).Free -gt $required) 'P03_RESTORE_CAPACITY'
 $baseline=Get-Content -LiteralPath $p03Baseline -Raw|ConvertFrom-Json
 Assert-True ($baseline.database -ceq $p03Source -and $baseline.tables -eq 51) 'P03_RESTORE_TABLE_SCOPE'
 $tableNames=@($baseline.groups.PSObject.Properties.Name|Sort-Object)
 Assert-True ($tableNames.Count -eq 51) 'P03_RESTORE_TABLE_COUNT'
 $preflight=[ordered]@{source=$p03Source;clone=$p03Clone;backupSha256=$p03BackupSha;restoreData=$p03Data;restoreLog=$p03Log;existingDatabaseOverwriteAllowed=$false;restoreWithReplace=$false;sourceRestartAllowed=$false;requiredBytes=$required;availableBytes=(Get-PSDrive C).Free;applicationAttached=$false}
 if($Mode -eq 'Preflight'){$preflight|ConvertTo-Json;return}
 [IO.Directory]::CreateDirectory($p03RestoreRoot)|Out-Null
 $acl=Get-Acl -LiteralPath $p03Root;Set-Acl -LiteralPath $p03RestoreRoot -AclObject $acl
 Assert-True ((Get-Acl -LiteralPath $p03RestoreRoot).AreAccessRulesProtected) 'P03_RESTORE_ACL'
 Save-New 'preflight.json' $preflight
 # The working TEST may keep changing. Verify only its identity/file mapping;
 # restore proof refers to the backup recovery point, not the current database.
 $sourceBefore=Source-Identity $master;Save-New 'source-identity-before.json' $sourceBefore
 Assert-Paths
 Assert-True (@(Rows $master "SELECT name FROM sys.databases WHERE name=N'$p03Clone'").Count -eq 0 -and -not(Test-Path -LiteralPath $p03Data) -and -not(Test-Path -LiteralPath $p03Log)) 'P03_RESTORE_PREWRITE_TARGET_CHANGED'
 Execute $master "IF DB_ID(N'$p03Clone') IS NOT NULL THROW 51900,'P03_RESTORE_TARGET_EXISTS',1; RESTORE DATABASE [$p03Clone] FROM DISK=N'$p03Backup' WITH CHECKSUM,RECOVERY,MOVE N'MELISA_ERP_V2' TO N'$p03Data',MOVE N'MELISA_ERP_V2_log' TO N'$p03Log',STATS=10;"
 Execute $master "ALTER DATABASE [$p03Clone] SET READ_ONLY WITH NO_WAIT;"
 Assert-True ((Get-FileHash -LiteralPath $p03Backup -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $p03BackupSha) 'P03_BACKUP_CHANGED_DURING_RESTORE'
 $cloneIdentity=@(Rows $master "SELECT name,is_read_only,state_desc,is_trustworthy_on,is_broker_enabled FROM sys.databases WHERE name=N'$p03Clone'")[0]
 Assert-True ($cloneIdentity.name -ceq $p03Clone -and $cloneIdentity.is_read_only -and $cloneIdentity.state_desc -ceq 'ONLINE' -and -not $cloneIdentity.is_trustworthy_on -and -not $cloneIdentity.is_broker_enabled) 'P03_CLONE_NOT_ISOLATED'
 Save-New 'restore-created.json' ([ordered]@{restored=$true;clone=$cloneIdentity;backupSetGuid=[string]$header[0].BackupSetGUID;completedAt=[DateTime]::UtcNow.ToString('o');sourceModified=$false;applicationAttached=$false})
 $errors=@(Rows $master "DBCC CHECKDB (N'$p03Clone') WITH NO_INFOMSGS,ALL_ERRORMSGS,MAXDOP=1;")
 Assert-True ($errors.Count -eq 0) 'P03_RESTORED_DBCC_ERRORS'
 $restored=Snapshot $p03Clone $tableNames;Save-New 'restored-snapshot.json' $restored
 $sourceAfter=Source-Identity $master;Save-New 'source-identity-after.json' $sourceAfter
 Assert-True (($sourceBefore|ConvertTo-Json -Depth 8 -Compress) -ceq ($sourceAfter|ConvertTo-Json -Depth 8 -Compress)) 'P03_SOURCE_IDENTITY_OR_FILES_CHANGED'
 $proof=[ordered]@{phase=$Phase;restored=$true;readOnly=$true;dbccCheckdbPassed=$true;criticalTablesHashed=51;moduleCount=$restored.modules.Count;permissionCount=$restored.permissions.Count;sourceIdentityAndFilesPreserved=$true;equalsCurrentSourceNotClaimed=$true;recoveryPoint='verified COPY_ONLY backup, not current DB02';backupSetGuid=[string]$header[0].BackupSetGUID;backupFinishedAt=[string]$header[0].BackupFinishDate;sourceDatabase=$p03Source;cloneDatabase=$p03Clone;backupSha256=$p03BackupSha;applicationAttached=$false;liveAccessed=$false;sourceRestarted=$false;retainedForEvidence=$true;completedAt=[DateTime]::UtcNow.ToString('o');deploymentPermitted=$false}
 Save-New 'invariance-capture-verified.json' $proof;$proof|ConvertTo-Json
}finally{if($null -ne $master){$master.Dispose()};$p03BackupHandle.Dispose()}
