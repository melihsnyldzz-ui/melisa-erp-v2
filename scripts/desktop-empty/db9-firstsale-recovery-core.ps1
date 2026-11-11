# Declarations only. Root owns explicit operational invocation and public pins.
# Full rows (including authentication tables) are hashed INSIDE SQL Server only.
function Recovery-Assert([bool]$Condition,[string]$Code){if(-not $Condition){throw $Code}}
function Recovery-Sha([byte[]]$Bytes){return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($Bytes)).ToLowerInvariant()}
function Recovery-Quote([string]$Value){return "N'"+$Value.Replace("'","''")+"'"}
function Recovery-Database([string]$Name){
 Recovery-Assert ($Name -cin @('MELISA_ERP_SCHEMA_REHEARSAL_20261107_K0210','MELISA_ERP_DB9_RESTORE_20261111_CA3526AE')) 'RECOVERY_DATABASE_REJECTED'
 return '['+$Name+']'
}
function Recovery-Target {
 return [ordered]@{server='Semih\MELISAERP';database='MELISA_ERP_SCHEMA_REHEARSAL_20261107_K0210';databaseId=9;databaseGuid='6d773db9-bd69-4906-b791-d63a490ab1f2';databaseCreateTime='2026-11-10T11:10:18.030';environmentId='287f689a-43bb-43dd-950b-adb615fcb20c';schemaVersion=7;tableCount=43;columnCount=502;actualT1=$false;externalOperations=$false}
}
function Recovery-Names {
 return [ordered]@{operationId='ca3526ae-6d32-41f3-b05d-514578d1dc2c';restoreDatabase='MELISA_ERP_DB9_RESTORE_20261111_CA3526AE';backupPath='C:/Program Files/Microsoft SQL Server/MSSQL16.MELISAERP/MSSQL/Backup/DB9_K12_AFTER_FIRSTSALE_ca3526ae6d3241f3b05d514578d1dc2c.bak';dataPath='C:/Program Files/Microsoft SQL Server/MSSQL16.MELISAERP/MSSQL/DATA/MELISA_ERP_DB9_RESTORE_20261111_CA3526AE.mdf';logPath='C:/Program Files/Microsoft SQL Server/MSSQL16.MELISAERP/MSSQL/DATA/MELISA_ERP_DB9_RESTORE_20261111_CA3526AE_log.ldf';mediaName='DB9_K12_ca3526ae6d3241f3b05d514578d1dc2c'}
}
function Recovery-GuardSql {
 return @'
SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 10000;
IF @@TRANCOUNT<>0 OR DB_ID()<>9 OR DB_NAME() COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_SCHEMA_REHEARSAL_20261107_K0210'
 OR ISNULL(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'') COLLATE Latin1_General_100_BIN2<>N'Semih\MELISAERP'
 OR ISNULL(CONVERT(int,SERVERPROPERTY('ProcessID')),-1)<>4924
 OR ISNULL(CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')),N'')<>N'Shared memory'
 OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 OR SUSER_SID() IS NULL OR SUSER_SID(ORIGINAL_LOGIN()) IS NULL
 OR SUSER_SID(N'SEMIH\Xaser') IS NULL OR SUSER_SID()<>SUSER_SID(N'SEMIH\Xaser') OR SUSER_SID(ORIGINAL_LOGIN())<>SUSER_SID(N'SEMIH\Xaser')
 OR SUSER_SID(ORIGINAL_LOGIN())<>0x0105000000000005150000004c0463816267f53b9f6e1299e9030000
 OR NOT EXISTS(SELECT 1 FROM sys.databases WHERE database_id=9 AND CONVERT(varchar(23),create_date,121)='2026-11-10 11:10:18.030' AND state=0 AND is_read_only=0)
 OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=9 AND database_guid='6d773db9-bd69-4906-b791-d63a490ab1f2')
 OR (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1
 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND environment_id='287f689a-43bb-43dd-950b-adb615fcb20c' AND schema_version=7 AND read_only=0 AND actual_t1=0 AND external_operations=0)
 OR (SELECT COUNT_BIG(*) FROM sys.tables WHERE is_ms_shipped=0)<>43
 OR (SELECT COUNT_BIG(*) FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id WHERE t.is_ms_shipped=0)<>502
 OR EXISTS(SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE t.is_ms_shipped=0 AND s.name<>N'dbo')
 OR EXISTS(SELECT 1 FROM sys.dm_exec_sessions WHERE is_user_process=1 AND database_id=9 AND session_id<>@@SPID)
 THROW 51995,'RECOVERY_SOURCE_IDENTITY_REJECTED',1;
'@
}
function Recovery-LayoutSql {
 $n=Recovery-Names
 return (Recovery-GuardSql)+@"
IF DB_ID(N'$($n.restoreDatabase)') IS NOT NULL OR EXISTS(SELECT 1 FROM sys.master_files WHERE REPLACE(physical_name,N'\',N'/') IN($(Recovery-Quote $n.dataPath),$(Recovery-Quote $n.logPath))) THROW 51995,'RECOVERY_DESTINATION_EXISTS',1;
IF (SELECT COUNT(*) FROM sys.database_files)<>2 OR (SELECT COUNT(*) FROM sys.database_files WHERE type=0)<>1 OR (SELECT COUNT(*) FROM sys.database_files WHERE type=1)<>1 THROW 51995,'RECOVERY_TWO_FILE_LAYOUT_REQUIRED',1;
IF (SELECT COUNT(*) FROM sys.tables t WHERE t.is_ms_shipped=0 AND EXISTS(SELECT 1 FROM sys.indexes i WHERE i.object_id=t.object_id AND i.is_primary_key=1 AND i.is_disabled=0))<>43 THROW 51995,'RECOVERY_PK43_REQUIRED',1;
SELECT CONVERT(nvarchar(4000),SERVERPROPERTY('InstanceDefaultBackupPath')) backupDirectory,CONVERT(nvarchar(4000),SERVERPROPERTY('InstanceDefaultDataPath')) dataDirectory,CONVERT(nvarchar(4000),SERVERPROPERTY('InstanceDefaultLogPath')) logDirectory,
 (SELECT name FROM sys.database_files WHERE type=0) logicalData,(SELECT name FROM sys.database_files WHERE type=1) logicalLog,
 CONVERT(varchar(30),(SELECT SUM(CONVERT(bigint,size)*8192) FROM sys.database_files)) fileBytes,
 JSON_QUERY((SELECT file_id,name,type,REPLACE(physical_name,N'\',N'/') physicalName,CONVERT(varchar(30),CONVERT(bigint,size)*8192) sizeBytes FROM sys.database_files ORDER BY file_id FOR JSON PATH,INCLUDE_NULL_VALUES)) files,
 (SELECT COUNT_BIG(*) FROM dbo.users) usersCount,(SELECT COUNT_BIG(*) FROM dbo.roles) rolesCount,(SELECT COUNT_BIG(*) FROM dbo.permissions) permissionsCount
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES;
"@
}
function Recovery-FingerprintSql([string]$Database){
 $db=Recovery-Database $Database
 # Credential/token/audit bodies never leave SQL. PK order is mandatory for ALL43.
 return (Recovery-GuardSql)+@"
DECLARE @result TABLE(tableName nvarchar(128),rowCount varchar(30),dataSha256 varchar(64));
DECLARE @table sysname,@keys nvarchar(max),@sql nvarchar(max),@json nvarchar(max),@count bigint;
IF (SELECT COUNT(*) FROM $db.sys.tables WHERE is_ms_shipped=0)<>43 OR (SELECT COUNT(*) FROM $db.sys.columns c JOIN $db.sys.tables t ON t.object_id=c.object_id WHERE t.is_ms_shipped=0)<>502 THROW 51995,'RECOVERY_SCHEMA_SHAPE',1;
DECLARE tables CURSOR LOCAL FAST_FORWARD FOR SELECT t.name FROM $db.sys.tables t JOIN $db.sys.schemas s ON s.schema_id=t.schema_id WHERE t.is_ms_shipped=0 AND s.name=N'dbo' ORDER BY t.name COLLATE Latin1_General_100_BIN2;
OPEN tables;FETCH NEXT FROM tables INTO @table;WHILE @@FETCH_STATUS=0 BEGIN
 SET @keys=NULL;SELECT @keys=STRING_AGG(CONVERT(nvarchar(max),QUOTENAME(c.name)),N',') WITHIN GROUP(ORDER BY ic.key_ordinal) FROM $db.sys.tables t JOIN $db.sys.schemas s ON s.schema_id=t.schema_id JOIN $db.sys.indexes i ON i.object_id=t.object_id AND i.is_primary_key=1 AND i.is_disabled=0 JOIN $db.sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0 JOIN $db.sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE t.name=@table AND s.name=N'dbo';
 IF @keys IS NULL THROW 51995,'RECOVERY_PK_REQUIRED',1;
 SET @sql=N'SELECT @n=COUNT_BIG(*) FROM $db.dbo.'+QUOTENAME(@table)+N';IF @n>100000 THROW 51995,''RECOVERY_ROW_BOUND'',1;SELECT @j=COALESCE((SELECT * FROM $db.dbo.'+QUOTENAME(@table)+N' ORDER BY '+@keys+N' FOR JSON PATH,INCLUDE_NULL_VALUES),N''[]'');';
 EXEC sys.sp_executesql @sql,N'@n bigint OUTPUT,@j nvarchar(max) OUTPUT',@n=@count OUTPUT,@j=@json OUTPUT;
 IF @json IS NULL OR DATALENGTH(@json)>16777216 THROW 51995,'RECOVERY_TABLE_HASH_BOUND',1;
 INSERT @result VALUES(@table,CONVERT(varchar(30),@count),LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',@json),2)));SET @json=NULL;FETCH NEXT FROM tables INTO @table;
END;CLOSE tables;DEALLOCATE tables;
IF (SELECT COUNT(*) FROM @result)<>43 THROW 51995,'RECOVERY_TABLE43_REQUIRED',1;
SELECT tableName,rowCount,dataSha256 FROM @result ORDER BY tableName COLLATE Latin1_General_100_BIN2 FOR JSON PATH,INCLUDE_NULL_VALUES;
"@
}
function Recovery-MetadataSql([string]$Database,[bool]$Copy){
 $db=Recovery-Database $Database
 Recovery-Assert (($Copy -and $Database -ceq (Recovery-Names).restoreDatabase) -or (-not $Copy -and $Database -ceq (Recovery-Target).database)) 'RECOVERY_METADATA_SCOPE'
 $exclude=if($Copy){"AND NOT(p.class=0 AND p.major_id=0 AND p.minor_id=0 AND p.permission_name=N'CONNECT' AND p.state=N'D' AND p.grantee_principal_id=0)"}else{''}
 return (Recovery-GuardSql)+@"
DECLARE @schema nvarchar(max)=(SELECT
 JSON_QUERY(COALESCE((SELECT t.object_id,t.schema_id,t.name FROM $db.sys.tables t WHERE is_ms_shipped=0 ORDER BY object_id FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) tables,
 JSON_QUERY(COALESCE((SELECT c.object_id,c.column_id,c.name,c.system_type_id,c.user_type_id,c.max_length,c.precision,c.scale,c.collation_name,c.is_nullable,c.is_identity,c.is_computed,c.default_object_id FROM $db.sys.columns c JOIN $db.sys.tables t ON t.object_id=c.object_id WHERE t.is_ms_shipped=0 ORDER BY c.object_id,c.column_id FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) columns,
 JSON_QUERY(COALESCE((SELECT i.object_id,i.index_id,i.name,i.type,i.is_unique,i.is_primary_key,i.is_unique_constraint,i.is_disabled,i.has_filter,i.filter_definition FROM $db.sys.indexes i JOIN $db.sys.tables t ON t.object_id=i.object_id WHERE t.is_ms_shipped=0 ORDER BY i.object_id,i.index_id FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) indexes,
 JSON_QUERY(COALESCE((SELECT i.object_id,i.index_id,i.index_column_id,i.column_id,i.key_ordinal,i.is_descending_key,i.is_included_column FROM $db.sys.index_columns i JOIN $db.sys.tables t ON t.object_id=i.object_id WHERE t.is_ms_shipped=0 ORDER BY i.object_id,i.index_id,i.index_column_id FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) indexColumns,
 JSON_QUERY(COALESCE((SELECT object_id,name,parent_object_id,definition FROM $db.sys.default_constraints ORDER BY object_id FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) defaults,
 JSON_QUERY(COALESCE((SELECT object_id,name,parent_object_id,definition,is_disabled,is_not_trusted FROM $db.sys.check_constraints ORDER BY object_id FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) checks,
 JSON_QUERY(COALESCE((SELECT object_id,name,parent_object_id,referenced_object_id,key_index_id,delete_referential_action,update_referential_action,is_disabled,is_not_trusted FROM $db.sys.foreign_keys ORDER BY object_id FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) foreignKeys,
 JSON_QUERY(COALESCE((SELECT * FROM $db.sys.foreign_key_columns ORDER BY constraint_object_id,constraint_column_id FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) foreignKeyColumns,
 JSON_QUERY(COALESCE((SELECT object_id,definition,uses_ansi_nulls,uses_quoted_identifier,is_schema_bound FROM $db.sys.sql_modules ORDER BY object_id FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) modules,
 JSON_QUERY(COALESCE((SELECT object_id,column_id,CONVERT(nvarchar(128),seed_value) seedValue,CONVERT(nvarchar(128),increment_value) incrementValue,CONVERT(nvarchar(128),last_value) lastValue,is_not_for_replication FROM $db.sys.identity_columns ORDER BY object_id,column_id FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) identities
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES);
DECLARE @security nvarchar(max)=(SELECT
 JSON_QUERY(COALESCE((SELECT principal_id,name,type,sid,default_schema_name,owning_principal_id FROM $db.sys.database_principals ORDER BY principal_id FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) principals,
 JSON_QUERY(COALESCE((SELECT role_principal_id,member_principal_id FROM $db.sys.database_role_members ORDER BY role_principal_id,member_principal_id FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) members,
 JSON_QUERY(COALESCE((SELECT class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type,state FROM $db.sys.database_permissions p WHERE 1=1 $exclude ORDER BY class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type,state FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) permissions
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES);
DECLARE @server nvarchar(max)=(SELECT
 JSON_QUERY(COALESCE((SELECT principal_id,name,type,sid,is_disabled FROM sys.server_principals ORDER BY principal_id FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) principals,
 JSON_QUERY(COALESCE((SELECT role_principal_id,member_principal_id FROM sys.server_role_members ORDER BY role_principal_id,member_principal_id FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) members,
 JSON_QUERY(COALESCE((SELECT class,major_id,grantee_principal_id,grantor_principal_id,type,state FROM sys.server_permissions ORDER BY class,major_id,grantee_principal_id,grantor_principal_id,type,state FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) permissions
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES);
SELECT LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',@schema),2)) schemaSha256,LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',@security),2)) securitySha256,LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',@server),2)) serverSecuritySha256 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
"@
}
function Recovery-BackupSql {
 $n=Recovery-Names;$source=Recovery-Database (Recovery-Target).database
 return (Recovery-GuardSql)+"BACKUP DATABASE $source TO DISK=$(Recovery-Quote $n.backupPath) WITH COPY_ONLY,CHECKSUM,NO_COMPRESSION,NOINIT,NOSKIP,MEDIANAME=$(Recovery-Quote $n.mediaName),NAME=$(Recovery-Quote $n.mediaName);"
}
function Recovery-BackupVerifySql([ValidateSet('HEADERONLY','LABELONLY','FILELISTONLY','VERIFYONLY')][string]$Kind){
 $n=Recovery-Names
 $options=if($Kind -ceq 'VERIFYONLY'){",CHECKSUM,FILE=1,MEDIANAME=$(Recovery-Quote $n.mediaName)"}elseif($Kind -ceq 'FILELISTONLY'){',FILE=1'}else{''}
 return (Recovery-GuardSql)+"RESTORE $Kind FROM DISK=$(Recovery-Quote $n.backupPath) WITH NOUNLOAD$options;"
}
function Recovery-RestoreSql($Layout){
 Recovery-Assert ($Layout.logicalData -is [string] -and $Layout.logicalData.Length -in 1..128 -and $Layout.logicalLog -is [string] -and $Layout.logicalLog.Length -in 1..128 -and $Layout.logicalData -cne $Layout.logicalLog) 'RECOVERY_LOGICAL_NAMES'
 $n=Recovery-Names;$copy=Recovery-Database $n.restoreDatabase
 return (Recovery-GuardSql)+"IF DB_ID($(Recovery-Quote $n.restoreDatabase)) IS NOT NULL OR EXISTS(SELECT 1 FROM sys.master_files WHERE REPLACE(physical_name,N'\',N'/') IN($(Recovery-Quote $n.dataPath),$(Recovery-Quote $n.logPath))) THROW 51995,'RECOVERY_TARGET_EXISTS',1;RESTORE DATABASE $copy FROM DISK=$(Recovery-Quote $n.backupPath) WITH MOVE $(Recovery-Quote $Layout.logicalData) TO $(Recovery-Quote $n.dataPath),MOVE $(Recovery-Quote $Layout.logicalLog) TO $(Recovery-Quote $n.logPath),CHECKSUM,FILE=1,MEDIANAME=$(Recovery-Quote $n.mediaName),RECOVERY,RESTRICTED_USER;"
}
function Recovery-IsolateSql {
 $copy=Recovery-Database (Recovery-Names).restoreDatabase
 return (Recovery-GuardSql)+"IF DB_ID(N'MELISA_ERP_DB9_RESTORE_20261111_CA3526AE') IS NULL OR DB_ID(N'MELISA_ERP_DB9_RESTORE_20261111_CA3526AE')=9 THROW 51995,'RECOVERY_COPY_MISSING',1;EXEC $copy.sys.sp_executesql N'DENY CONNECT TO public;';"
}
function Recovery-CopyCheckSql {
 $n=Recovery-Names;$copy=Recovery-Database $n.restoreDatabase
 return (Recovery-GuardSql)+@"
IF NOT EXISTS(SELECT 1 FROM sys.databases WHERE name=N'$($n.restoreDatabase)' AND database_id<>9 AND state=0 AND user_access=1)
 OR (SELECT COUNT(*) FROM sys.master_files WHERE database_id=DB_ID(N'$($n.restoreDatabase)'))<>2
 OR (SELECT COUNT(*) FROM sys.master_files WHERE database_id=DB_ID(N'$($n.restoreDatabase)') AND REPLACE(physical_name,N'\',N'/') IN($(Recovery-Quote $n.dataPath),$(Recovery-Quote $n.logPath)))<>2
 OR EXISTS(SELECT 1 FROM $copy.sys.check_constraints WHERE is_disabled=1 OR is_not_trusted=1)
 OR EXISTS(SELECT 1 FROM $copy.sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1)
 OR NOT EXISTS(SELECT 1 FROM $copy.sys.database_permissions WHERE class=0 AND major_id=0 AND minor_id=0 AND grantee_principal_id=0 AND permission_name=N'CONNECT' AND state=N'D') THROW 51995,'RECOVERY_COPY_ISOLATION',1;
EXECUTE AS LOGIN=N'melisa_empty_profile_db9_writer_v1';DECLARE @access int=HAS_DBACCESS(N'$($n.restoreDatabase)');REVERT;
IF ISNULL(@access,-1)<>0 THROW 51995,'RECOVERY_WRITER_ACCESS',1;
DBCC CHECKDB($copy) WITH NO_INFOMSGS,ALL_ERRORMSGS;
SELECT CONVERT(varchar(20),d.database_id) databaseId,CONVERT(varchar(36),r.database_guid) databaseGuid,N'RECOVERY_COPY_CHECKED' state FROM sys.databases d JOIN sys.database_recovery_status r ON r.database_id=d.database_id WHERE d.name=N'$($n.restoreDatabase)' FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
"@
}
function Recovery-ValidateLayout($Layout,[long]$FreeBytes){
 $base='C:/Program Files/Microsoft SQL Server/MSSQL16.MELISAERP/MSSQL/'
 foreach($item in @(@('backupDirectory','Backup/'),@('dataDirectory','DATA/'),@('logDirectory','DATA/'))){
  $actual=([string]$Layout[$item[0]]).Replace('\','/').TrimEnd('/')+'/'
  Recovery-Assert ($actual -ceq ($base+$item[1])) 'RECOVERY_DEFAULT_PATH_MISMATCH'
 }
 Recovery-Assert ($Layout.files.Count -eq 2 -and @($Layout.files|Where-Object type -eq 0).Count -eq 1 -and @($Layout.files|Where-Object type -eq 1).Count -eq 1) 'RECOVERY_TWO_FILE_LAYOUT_REQUIRED'
 foreach($file in $Layout.files){Recovery-Assert ($file.physicalName -is [string] -and $file.physicalName.StartsWith($base+'DATA/',[StringComparison]::Ordinal) -and $file.physicalName.Substring(($base+'DATA/').Length) -cmatch '^[A-Za-z0-9_.-]+\.(mdf|ldf)$') 'RECOVERY_SOURCE_FILE_PATH'}
 Recovery-Assert ($Layout.fileBytes -cmatch '^[1-9][0-9]{0,12}$') 'RECOVERY_SIZE_INVALID'
 $bytes=[long]$Layout.fileBytes;Recovery-Assert ($FreeBytes -ge ($bytes*4+2147483648L)) 'RECOVERY_CAPACITY'
 Recovery-Assert ($Layout.usersCount -eq 7 -and $Layout.rolesCount -eq 7 -and $Layout.permissionsCount -eq 58) 'RECOVERY_ROLE_FINAL_BINDING'
 return $bytes*4+2147483648L
}
function Recovery-ValidateFingerprint($Rows){
 Recovery-Assert ($Rows -is [array] -and $Rows.Count -eq 43) 'RECOVERY_TABLE43_REQUIRED'
 $names=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
 foreach($row in $Rows){Recovery-Assert ($row.tableName -cmatch '^[a-z][a-z0-9_]{0,127}$' -and $names.Add($row.tableName) -and $row.rowCount -cmatch '^(0|[1-9][0-9]{0,5})$' -and [long]$row.rowCount -le 100000 -and $row.dataSha256 -cmatch '^[a-f0-9]{64}$') 'RECOVERY_FINGERPRINT_INVALID'}
}
function Recovery-EqualSnapshot($Before,$After){
 Recovery-ValidateFingerprint $Before.tables;Recovery-ValidateFingerprint $After.tables
 Recovery-Assert (($Before.tables|ConvertTo-Json -Depth 5 -Compress) -ceq ($After.tables|ConvertTo-Json -Depth 5 -Compress)) 'RECOVERY_DATA_CHANGED'
 foreach($key in @('schemaSha256','securitySha256','serverSecuritySha256')){Recovery-Assert ($Before.metadata[$key] -cmatch '^[a-f0-9]{64}$' -and $Before.metadata[$key] -ceq $After.metadata[$key]) 'RECOVERY_METADATA_CHANGED'}
}
function Recovery-ValidateBackup($Header,$Media,$Files,$Layout){
 $n=Recovery-Names
 Recovery-Assert ($Header.Count -eq 1 -and $Media.Count -eq 1 -and $Files.Count -eq 2) 'RECOVERY_SINGLE_BACKUP_REQUIRED'
 $h=$Header[0];$m=$Media[0]
 Recovery-Assert ($h.Position -eq 1 -and $h.BackupType -eq 1 -and $h.DatabaseName -ceq (Recovery-Target).database -and $h.BackupName -ceq $n.mediaName -and $h.HasBackupChecksums -eq $true -and $h.IsCopyOnly -eq $true -and $h.IsDamaged -eq $false -and [string]$h.BackupSetGUID -cmatch '^[a-fA-F0-9-]{36}$') 'RECOVERY_BACKUP_HEADER_REJECTED'
 Recovery-Assert ($m.MediaName -ceq $n.mediaName -and $m.FamilyCount -eq 1 -and $m.FamilySequenceNumber -eq 1) 'RECOVERY_MEDIA_REJECTED'
 Recovery-Assert (@($Files|Where-Object {$_.Type -ceq 'D' -and $_.LogicalName -ceq $Layout.logicalData}).Count -eq 1 -and @($Files|Where-Object {$_.Type -ceq 'L' -and $_.LogicalName -ceq $Layout.logicalLog}).Count -eq 1 -and @($Files|Where-Object {$_.IsPresent -ne $true}).Count -eq 0) 'RECOVERY_BACKUP_FILELIST_REJECTED'
}
function Recovery-Phase([string]$Name,[scriptblock]$Intent,[scriptblock]$Invoke,[scriptblock]$Result){
 # Durable CreateNew+flush MUST complete before any nontransactional command.
 & $Intent $Name
 try{$value=& $Invoke;& $Result $Name $value;return $value}catch{throw 'RECOVERY_UNKNOWN_NO_RETRY'}
}
function Recovery-ValidatePreflightClosed($Preflight,$Closed,$Reference){
 Recovery-Assert ($Closed.state -ceq 'RECOVERY_LIFECYCLE_CLOSED_AND_RELEASED' -and $Closed.mode -ceq 'Preflight' -and $Preflight.mode -ceq 'Preflight' -and $Closed.operationId -ceq (Recovery-Names).operationId -and $Closed.operationId -ceq $Preflight.operationId) 'RECOVERY_PREFLIGHT_CLOSED_SCOPE'
 Recovery-Assert ($Closed.resultPath -ceq $Reference.path -and $Closed.resultSha256 -ceq $Reference.sha256 -and $Closed.resultSha256 -cmatch '^[a-f0-9]{64}$' -and $Closed.resultState -ceq $Preflight.state -and $Closed.decisionSha256 -ceq $Preflight.decisionSha256 -and $Closed.decisionSha256 -cmatch '^[a-f0-9]{64}$' -and $Closed.runnerSha256 -ceq $Preflight.runnerSha256 -and $Closed.coreSha256 -ceq $Preflight.coreSha256) 'RECOVERY_PREFLIGHT_CLOSED_BINDING'
 Recovery-Assert ($Closed.connectionCloseCompleted -ceq $true -and $Closed.connectionDisposeCompleted -ceq $true -and $Closed.connectionStateClosed -ceq $true -and $Closed.holdsReleaseCompleted -ceq $true -and $Closed.locksReleaseCompleted -ceq $true -and $Closed.locksExpectedCount -eq 2 -and $Closed.locksReleasedCount -eq 2 -and $Closed.successResultPersisted -ceq $true -and $Closed.sqlRollbackClaimed -ceq $false) 'RECOVERY_PREFLIGHT_CLOSE_NOT_VERIFIED'
}
function Recovery-CloseResources($Connection,$Holds,$Locks){
 $closeCompleted=$null -eq $Connection;$disposeCompleted=$null -eq $Connection;$stateClosed=$null -eq $Connection
 if($null -ne $Connection){
  try{$Connection.Close();$closeCompleted=$true}catch{}
  # Dispose must be attempted even if Close threw. Neither failure is hidden.
  try{$Connection.Dispose();$disposeCompleted=$true}catch{}
  try{$stateClosed=[string]$Connection.State -ceq 'Closed'}catch{$stateClosed=$false}
 }
 $holdsOk=$true;$locksOk=$true;$released=0
 foreach($hold in $Holds){try{$hold.Dispose()}catch{$holdsOk=$false}}
 foreach($lock in $Locks){try{$lock.Dispose();$released++}catch{$locksOk=$false}}
 return @{connectionCloseCompleted=$closeCompleted;connectionDisposeCompleted=$disposeCompleted;connectionStateClosed=$stateClosed;holdsReleaseCompleted=$holdsOk;locksReleaseCompleted=$locksOk;locksExpectedCount=@($Locks).Count;locksReleasedCount=$released;sqlRollbackClaimed=$false}
}
