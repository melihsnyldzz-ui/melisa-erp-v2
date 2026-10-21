param(
 [ValidateSet('Preflight','Backup')][string]$Mode='Preflight',
 [Parameter(Mandatory=$true)][ValidatePattern('^P03-202610(?:18|19|20|21)-[0-9]{6}$')][string]$RunId
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$p03Server='Semih\MELISADEV'
$p03Database='MELISA_ERP_CRM_SHARED_TEST_20261009_02'
$p03BackupRoot=Join-Path 'C:\Sirket\ERP\backups' $RunId
$p03BackupFile=Join-Path $p03BackupRoot 'DB02_COPY_ONLY.bak'
function Assert-NoReparse([string]$target){
 for($itemPath=[IO.Path]::GetFullPath($target);$itemPath;$itemPath=[IO.Path]::GetDirectoryName($itemPath)){
  if(Test-Path -LiteralPath $itemPath){if((Get-Item -LiteralPath $itemPath -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'P03_REPARSE_REJECTED'}}
 }
}
Assert-NoReparse $p03BackupRoot
if(Test-Path -LiteralPath $p03BackupRoot){throw 'P03_BACKUP_RUN_ALREADY_EXISTS'}
$p03Connection=[Data.SqlClient.SqlConnection]::new("Server=$p03Server;Database=$p03Database;Integrated Security=True;Encrypt=False;Application Name=MelisaP03TestBackup;Connect Timeout=5")
function Rows([string]$sql){
 $command=$p03Connection.CreateCommand();$command.CommandTimeout=1800;$command.CommandText=$sql
 try{$reader=$command.ExecuteReader();$result=@();try{while($reader.Read()){$row=[ordered]@{};for($i=0;$i-lt $reader.FieldCount;$i++){$row[$reader.GetName($i)]=if($reader.IsDBNull($i)){$null}else{$reader.GetValue($i)}};$result+=[pscustomobject]$row}}finally{$reader.Close()};return $result}finally{$command.Dispose()}
}
function Execute([string]$sql){$command=$p03Connection.CreateCommand();$command.CommandTimeout=1800;$command.CommandText=$sql;try{[void]$command.ExecuteNonQuery()}finally{$command.Dispose()}}
function Save-New([string]$name,$value){
 $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 12));if($RunId -cmatch '^P03-202610(?:19|20|21)-[0-9]{6}$'){$fileAcl=[Security.AccessControl.FileSecurity]::new();$fileAcl.SetAccessRuleProtection($true,$false);$fileOwner=[Security.Principal.WindowsIdentity]::GetCurrent().User;$fileAcl.SetOwner($fileOwner);foreach($fileSid in @($fileOwner,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'))){$fileAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($fileSid,'FullControl','Allow'))};$stream=New-Object IO.FileStream((Join-Path $p03BackupRoot $name),[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough,$fileAcl)}else{$stream=[IO.File]::Open((Join-Path $p03BackupRoot $name),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)}
 try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
}
try{
 $p03Connection.Open()
 $identity=@(Rows "SELECT CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) serverName,DB_NAME() databaseName,IS_SRVROLEMEMBER('sysadmin') isAdmin,CONVERT(int,SERVERPROPERTY('EngineEdition')) edition")[0]
 if($identity.serverName -cne $p03Server -or $identity.databaseName -cne $p03Database -or $identity.isAdmin -ne 1){throw 'P03_WRONG_TEST_IDENTITY'}
 if($RunId -cmatch '^P03-202610(?:19|20|21)-[0-9]{6}$'){$seal=@(Rows "SELECT COUNT_BIG(*) n FROM dbo.stage4_copy_manifest WHERE copy_id='e16b70f0-4057-428b-9abc-6bbcaf35fe82' AND sealed=1")[0];if($seal.n-ne1){throw 'P03_CURRENT_COPY_IDENTITY'}}
 $files=@(Rows 'SELECT name,type_desc,CAST(size AS bigint)*8192 sizeBytes FROM sys.database_files ORDER BY file_id')
 if($files.Count -ne 2 -or $files[0].name -cne 'MELISA_ERP_V2' -or $files[1].name -cne 'MELISA_ERP_V2_log'){throw 'P03_TEST_FILE_IDENTITY_MISMATCH'}
 $needed=[long]($files|Measure-Object sizeBytes -Sum).Sum+10GB
 $available=(Get-PSDrive C).Free
 if($available -lt $needed){throw 'P03_BACKUP_INSUFFICIENT_SPACE'}
 $preflight=[ordered]@{runId=$RunId;server=$p03Server;database=$p03Database;checkedAt=[DateTime]::UtcNow.ToString('o');sourceFiles=$files;availableBytes=$available;requiredBytes=$needed;backupFile=$p03BackupFile;restoreExecuted=$false;commercialWrites=$false}
 if($Mode -eq 'Preflight'){$preflight|ConvertTo-Json -Depth 5;return}
 $acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetAccessRuleProtection($true,$false)
 $userSid=[Security.Principal.WindowsIdentity]::GetCurrent().User;$acl.SetOwner($userSid)
 foreach($sid in @($userSid,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'))){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))}
 $sqlSid=[Security.Principal.NTAccount]::new('NT Service\MSSQL$MELISADEV').Translate([Security.Principal.SecurityIdentifier])
 $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sqlSid,'Modify','ContainerInherit,ObjectInherit','None','Allow'))
 [IO.Directory]::CreateDirectory($p03BackupRoot)|Out-Null
 Set-Acl -LiteralPath $p03BackupRoot -AclObject $acl
 if(-not(Get-Acl -LiteralPath $p03BackupRoot).AreAccessRulesProtected){throw 'P03_BACKUP_ACL_NOT_PROTECTED'}
 Save-New 'preflight.json' $preflight
 $compression=if($identity.edition -eq 4){''}else{',COMPRESSION'}
 $started=[DateTime]::UtcNow.ToString('o')
 Execute "BACKUP DATABASE [$p03Database] TO DISK=N'$p03BackupFile' WITH COPY_ONLY,CHECKSUM,NOINIT$compression,STATS=10;"
 $header=@(Rows "RESTORE HEADERONLY FROM DISK=N'$p03BackupFile'")
 if($header.Count -ne 1 -or $header[0].DatabaseName -cne $p03Database -or -not $header[0].IsCopyOnly -or -not $header[0].HasBackupChecksums -or $header[0].IsDamaged -or $header[0].BackupType -ne 1){throw 'P03_BACKUP_HEADER_REJECTED'}
 Execute "RESTORE VERIFYONLY FROM DISK=N'$p03BackupFile' WITH CHECKSUM;"
 $fileInfo=Get-Item -LiteralPath $p03BackupFile
 if($fileInfo.Length -le 0){throw 'P03_EMPTY_BACKUP'}
 $proof=[ordered]@{runId=$RunId;server=$p03Server;database=$p03Database;backupFile=$p03BackupFile;bytes=$fileInfo.Length;sha256=(Get-FileHash -LiteralPath $p03BackupFile -Algorithm SHA256).Hash.ToLowerInvariant();startedAt=$started;completedAt=[DateTime]::UtcNow.ToString('o');backupSetGuid=[string]$header[0].BackupSetGUID;firstLsn=[string]$header[0].FirstLSN;lastLsn=[string]$header[0].LastLSN;copyOnly=$true;checksumVerified=$true;restoreVerifyOnly=$true;restoreRehearsed=$false;independentDeviceCopy=$false;sourceRestarted=$false;commercialWrites=$false;deploymentPermitted=$false}
 if($RunId -cmatch '^P03-202610(?:19|20|21)-[0-9]{6}$'){$proof.copyId='e16b70f0-4057-428b-9abc-6bbcaf35fe82';$proof.actualT1=$false;$proof.observedAt=$proof.completedAt}
 Save-New 'backup-verified.json' $proof
 $proof|ConvertTo-Json -Depth 5
}finally{$p03Connection.Dispose()}
