param([ValidateSet('Preflight','Backup')][string]$Mode='Preflight')
$ErrorActionPreference='Stop'
# Owner-authorized Goal7 COPY_ONLY of the exact TEST database. No restore command.
$goal7Server='Semih\MELISADEV'
$goal7Database='MELISA_ERP_SIRKET_TEST_20260929_01'
$goal7BackupRoot='C:\Sirket\ERP\backups\ERP-GOAL7-20261007'
$goal7BackupFile=Join-Path $goal7BackupRoot 'GOAL7_TEST_20261007_01.bak'
$goal7Evidence='C:\Sirket\ERP\evidence\ERP-GOAL7-20261007\analysis-private'
if ((Get-Acl -LiteralPath $goal7Evidence).AreAccessRulesProtected -ne $true) { throw 'GOAL7_PRIVATE_ACL_REQUIRED' }
if (Test-Path -LiteralPath $goal7BackupFile) { throw 'GOAL7_BACKUP_ALREADY_EXISTS' }
if ([IO.Path]::GetFullPath($goal7BackupFile) -cne $goal7BackupFile -or [IO.Path]::GetDirectoryName($goal7BackupFile) -cne $goal7BackupRoot) { throw 'GOAL7_BACKUP_PATH_REJECTED' }
function Goal7-Rows($connection,[string]$query) {
 $command=$connection.CreateCommand();$command.CommandTimeout=900;$command.CommandText=$query;$reader=$command.ExecuteReader();$rows=@()
 try { while ($reader.Read()) { $row=[ordered]@{};for ($i=0;$i -lt $reader.FieldCount;$i++) { $row[$reader.GetName($i)]=if ($reader.IsDBNull($i)) {$null} else {$reader.GetValue($i)} };$rows+=[pscustomobject]$row } } finally {$reader.Close()}
 return $rows
}
function Goal7-Execute($connection,[string]$query) { $command=$connection.CreateCommand();$command.CommandTimeout=900;$command.CommandText=$query;[void]$command.ExecuteNonQuery() }
function Goal7-Save([string]$name,$value) {
 $file=Join-Path $goal7Evidence $name;if(Test-Path -LiteralPath $file){throw 'GOAL7_RECEIPT_ALREADY_EXISTS'}
 [IO.File]::WriteAllText($file,($value|ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))
}
$goal7Connection=[Data.SqlClient.SqlConnection]::new("Server=$goal7Server;Database=$goal7Database;Integrated Security=True;Encrypt=False;Application Name=ERP-GOAL7-TEST-BACKUP")
$goal7Connection.Open()
try {
 $identity=@(Goal7-Rows $goal7Connection "SELECT CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) server, DB_NAME() [database], IS_SRVROLEMEMBER('sysadmin') admin,CONVERT(int,SERVERPROPERTY('EngineEdition')) edition")[0]
 if ($identity.server -cne $goal7Server -or $identity.database -cne $goal7Database -or $identity.admin -ne 1) { throw 'GOAL7_WRONG_TEST_DATABASE' }
 $files=@(Goal7-Rows $goal7Connection 'SELECT name,type_desc,CAST(size AS bigint)*8192 sizeBytes FROM sys.database_files')
 if ($files.Count -ne 2 -or $files[0].name -cne 'MELISA_ERP_V2' -or $files[1].name -cne 'MELISA_ERP_V2_log') { throw 'GOAL7_SOURCE_FILE_IDENTITY' }
 $volume=@(Goal7-Rows $goal7Connection 'SELECT volume_mount_point,MIN(available_bytes) freeBytes FROM sys.database_files f CROSS APPLY sys.dm_os_volume_stats(DB_ID(),f.file_id) GROUP BY volume_mount_point')
 $needed=[long]($files|Measure-Object sizeBytes -Sum).Sum+10GB
 if ($volume.Count -ne 1 -or $volume[0].volume_mount_point -cne 'C:\' -or $volume[0].freeBytes -lt $needed) { throw 'GOAL7_BACKUP_INSUFFICIENT_SPACE' }
 $preflight=@{schemaVersion='melisa-goal7.backup-preflight.v1';server=$goal7Server;sourceDatabase=$goal7Database;file=$goal7BackupFile;checkedAt=[DateTime]::UtcNow.ToString('o');freeBytes=$volume[0].freeBytes;requiredConservativeBytes=$needed;overwriteAllowed=$false;restoreRequested=$false}
 if ($Mode -eq 'Preflight') { Goal7-Save 'backup-preflight.json' $preflight;Write-Output 'GOAL7_BACKUP_PREFLIGHT_READY';exit }
 if (Test-Path -LiteralPath $goal7BackupRoot) { throw 'GOAL7_BACKUP_DIRECTORY_ALREADY_EXISTS' }
 New-Item -ItemType Directory -Path $goal7BackupRoot | Out-Null
 if ((Get-Item -LiteralPath $goal7BackupRoot).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'GOAL7_BACKUP_REPARSE_REJECTED' }
 $acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetAccessRuleProtection($true,$false)
 $owner=[Security.Principal.WindowsIdentity]::GetCurrent().User;$acl.SetOwner($owner)
 foreach ($principal in @($owner,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'),[Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))) { $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($principal,'FullControl','ContainerInherit,ObjectInherit','None','Allow')) }
 $service=[Security.Principal.NTAccount]::new('NT Service\MSSQL$MELISADEV').Translate([Security.Principal.SecurityIdentifier])
 $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($service,'Modify','ContainerInherit,ObjectInherit','None','Allow'))
 Set-Acl -LiteralPath $goal7BackupRoot -AclObject $acl
 if (-not (Get-Acl -LiteralPath $goal7BackupRoot).AreAccessRulesProtected) { throw 'GOAL7_BACKUP_ACL_REQUIRED' }
 $compression=if ($identity.edition -eq 4) {''} else {',COMPRESSION'}
 $started=[DateTime]::UtcNow.ToString('o');$timer=[Diagnostics.Stopwatch]::StartNew()
 Goal7-Execute $goal7Connection "BACKUP DATABASE [$goal7Database] TO DISK=N'$goal7BackupFile' WITH COPY_ONLY,CHECKSUM$compression,NOINIT,STATS=10;"
 $timer.Stop();$backupMs=$timer.ElapsedMilliseconds
 $header=@(Goal7-Rows $goal7Connection "RESTORE HEADERONLY FROM DISK=N'$goal7BackupFile'")
 if ($header.Count -ne 1 -or $header[0].DatabaseName -cne $goal7Database -or -not $header[0].IsCopyOnly -or -not $header[0].HasBackupChecksums -or $header[0].IsDamaged -or $header[0].BackupType -ne 1) { throw 'GOAL7_BACKUP_HEADER_REJECTED' }
 $timer.Restart();Goal7-Execute $goal7Connection "RESTORE VERIFYONLY FROM DISK=N'$goal7BackupFile' WITH CHECKSUM;";$timer.Stop()
 $receipt=@{schemaVersion='melisa-goal7.backup.v1';server=$goal7Server;sourceDatabase=$goal7Database;file=$goal7BackupFile;startedAt=$started;completedAt=[DateTime]::UtcNow.ToString('o');copyOnly=$true;checksum=$true;verifyOnlyPassed=$true;sha256=(Get-FileHash -LiteralPath $goal7BackupFile -Algorithm SHA256).Hash;sizeBytes=(Get-Item -LiteralPath $goal7BackupFile).Length;backupSetGuid=[string]$header[0].BackupSetGUID;backupMs=$backupMs;verifyMs=$timer.ElapsedMilliseconds;activeOverwrite=$false;liveConnected=$false;restorePerformed=$false}
 Goal7-Save 'backup-result.json' $receipt
 Write-Output ($receipt|Select-Object schemaVersion,copyOnly,checksum,verifyOnlyPassed,sizeBytes,backupMs,verifyMs,sha256|ConvertTo-Json -Compress)
} finally { $goal7Connection.Close() }
