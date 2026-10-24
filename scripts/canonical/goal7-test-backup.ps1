param(
 [ValidateSet('Preflight','Backup','TaskDefinition')][string]$Mode='Preflight',
 [ValidateSet('Goal7','Clean20261022')][string]$Profile='Goal7',
 [string]$RunId='',
 [string]$OwnerSid='',
 [ValidatePattern('^(?:[01][0-9]|2[0-3]):[0-5][0-9]$')][string]$DailyAt='03:00'
)
$ErrorActionPreference='Stop'
# Owner-authorized Goal7 COPY_ONLY of the exact TEST database. No restore command.
$goal7Server='Semih\MELISADEV'
$goal7Database='MELISA_ERP_SIRKET_TEST_20260929_01'
$goal7BackupRoot='C:\Sirket\ERP\backups\ERP-GOAL7-20261007'
$goal7BackupFile=Join-Path $goal7BackupRoot 'GOAL7_TEST_20261007_01.bak'
$goal7Evidence='C:\Sirket\ERP\evidence\ERP-GOAL7-20261007\analysis-private'
if($Profile -ceq 'Goal7' -and ($RunId -or $OwnerSid -or $Mode -ceq 'TaskDefinition')){throw 'GOAL7_CLEAN_OPTIONS_REJECTED'}
if($Profile -ceq 'Clean20261022'){
 if(!$RunId){$RunId=[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')+'-'+[guid]::NewGuid().ToString('N')}
 if($RunId -cnotmatch '^\d{8}T\d{9}Z-[a-f0-9]{32}$'){throw 'CLEAN_BACKUP_RUN_ID_REJECTED'}
 $goal7Database='MELISA_ERP_CLEAN_TEST_20261022'
 $goal7BackupRoot='C:\Sirket\ERP\backups\CLEAN-20261022-C5-'+$RunId
 $goal7BackupFile=Join-Path $goal7BackupRoot 'CLEAN_TEST_COPY_ONLY.bak'
 $goal7Evidence=$goal7BackupRoot
}
function Goal7-AssertCleanIdentity($identity,$environment){
 if($identity.server -cne 'Semih\MELISADEV' -or $identity.database -cne 'MELISA_ERP_CLEAN_TEST_20261022' -or $identity.admin -ne 1){throw 'CLEAN_BACKUP_TARGET_REJECTED'}
 if(@($environment).Count -ne 1 -or [string]$environment[0].environment_id -ine 'e662fd94-d797-4b3b-938a-d143ad758b67' -or $environment[0].synthetic -ne 1 -or $environment[0].actual_t1 -ne 0 -or $environment[0].external_operations -ne 0){throw 'CLEAN_BACKUP_ENVIRONMENT_REJECTED'}
}
function Goal7-CleanTaskDefinition([string]$sid,[string]$time){
 if($sid -cnotmatch '^S-1-5-21-\d+-\d+-\d+-\d+$'){throw 'CLEAN_BACKUP_TASK_OWNER_REQUIRED'}
 if($time -cnotmatch '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'){throw 'CLEAN_BACKUP_TASK_TIME_REJECTED'}
 $start=[DateTime]::Today.AddDays(1).ToString('yyyy-MM-dd')+'T'+$time+':00'
 # This is a definition only. No task API is called, no password is stored.
 return @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
 <RegistrationInfo><Description>Clean TEST SQL COPY_ONLY + CHECKSUM + VERIFYONLY. Retain all; ERP/CRM files are excluded.</Description><URI>\Melisa-Clean-20261022-NightlyBackup</URI></RegistrationInfo>
 <Triggers><CalendarTrigger><StartBoundary>$start</StartBoundary><Enabled>true</Enabled><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger></Triggers>
 <Principals><Principal id="Owner"><UserId>$sid</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
 <Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><StartWhenAvailable>true</StartWhenAvailable><Enabled>true</Enabled><Hidden>true</Hidden><WakeToRun>false</WakeToRun><ExecutionTimeLimit>PT1H</ExecutionTimeLimit></Settings>
 <Actions Context="Owner"><Exec><Command>C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe</Command><Arguments>-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File &quot;C:\Sirket\ERP\clean\20261022\erp\scripts\canonical\goal7-test-backup.ps1&quot; -Profile Clean20261022 -Mode Backup</Arguments><WorkingDirectory>C:\Sirket\ERP\clean\20261022\erp</WorkingDirectory></Exec></Actions>
</Task>
"@
}
if($Mode -ceq 'TaskDefinition'){Write-Output (Goal7-CleanTaskDefinition $OwnerSid $DailyAt);exit}
if($Profile -ceq 'Clean20261022'){
 # Pin standard modules to the executing shell; a PS7 parent may inherit a PS7-only module path.
 foreach($module in @('Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security')){Import-Module (Join-Path $PSHOME ('Modules\'+$module+'\'+$module+'.psd1')) -ErrorAction Stop}
}
if($Profile -ceq 'Goal7' -and (Get-Acl -LiteralPath $goal7Evidence).AreAccessRulesProtected -ne $true){throw 'GOAL7_PRIVATE_ACL_REQUIRED'}
if (Test-Path -LiteralPath $goal7BackupFile) { throw 'GOAL7_BACKUP_ALREADY_EXISTS' }
if ([IO.Path]::GetFullPath($goal7BackupFile) -cne $goal7BackupFile -or [IO.Path]::GetDirectoryName($goal7BackupFile) -cne $goal7BackupRoot) { throw 'GOAL7_BACKUP_PATH_REJECTED' }
if($Profile -ceq 'Clean20261022'){
 $parent=[IO.Path]::GetDirectoryName($goal7BackupRoot)
 if($parent -cne 'C:\Sirket\ERP\backups' -or !(Test-Path -LiteralPath $parent -PathType Container)){throw 'CLEAN_BACKUP_PARENT_REJECTED'}
 if(Test-Path -LiteralPath $goal7BackupRoot){throw 'GOAL7_BACKUP_DIRECTORY_ALREADY_EXISTS'}
 while($parent){if((Get-Item -LiteralPath $parent -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'GOAL7_BACKUP_REPARSE_REJECTED'};$parent=[IO.Path]::GetDirectoryName($parent)}
}
function Goal7-Rows($connection,[string]$query) {
 $command=$connection.CreateCommand();$command.CommandTimeout=900;$command.CommandText=$query;$reader=$command.ExecuteReader();$rows=@()
 try { while ($reader.Read()) { $row=[ordered]@{};for ($i=0;$i -lt $reader.FieldCount;$i++) { $row[$reader.GetName($i)]=if ($reader.IsDBNull($i)) {$null} else {$reader.GetValue($i)} };$rows+=[pscustomobject]$row } } finally {$reader.Close()}
 return $rows
}
function Goal7-Execute($connection,[string]$query) { $command=$connection.CreateCommand();$command.CommandTimeout=900;$command.CommandText=$query;[void]$command.ExecuteNonQuery() }
function Goal7-Save([string]$name,$value) {
 $file=Join-Path $goal7Evidence $name
 $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 12))
 $stream=[IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
}
function Goal7-WriteVerifiedBackup($connection,[int]$edition){
 if(Test-Path -LiteralPath $goal7BackupFile){throw 'GOAL7_BACKUP_ALREADY_EXISTS'}
 $compression=if($edition -eq 4){''}else{',COMPRESSION'}
 $guard=''
 if($Profile -ceq 'Clean20261022'){
  # Repeat the B7 exact source/environment check inside the BACKUP batch.
  $guard="IF DB_NAME()<>N'MELISA_ERP_CLEAN_TEST_20261022' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'))<>N'Semih\MELISADEV' OR NOT EXISTS(SELECT 1 FROM dbo.clean_test_environment WHERE id=1 AND environment_id='e662fd94-d797-4b3b-938a-d143ad758b67' AND synthetic=1 AND actual_t1=0 AND external_operations=0) THROW 51967,'CLEAN_BACKUP_TARGET',1; "
 }
 $started=[DateTime]::UtcNow.ToString('o');$timer=[Diagnostics.Stopwatch]::StartNew()
 Goal7-Execute $connection ($guard+"BACKUP DATABASE [$goal7Database] TO DISK=N'$goal7BackupFile' WITH COPY_ONLY,CHECKSUM$compression,NOINIT,STATS=10;")
 $timer.Stop();$backupMs=$timer.ElapsedMilliseconds
 $header=@(Goal7-Rows $connection "RESTORE HEADERONLY FROM DISK=N'$goal7BackupFile'")
 if($header.Count -ne 1 -or $header[0].DatabaseName -cne $goal7Database -or -not $header[0].IsCopyOnly -or -not $header[0].HasBackupChecksums -or $header[0].IsDamaged -or $header[0].BackupType -ne 1){throw 'GOAL7_BACKUP_HEADER_REJECTED'}
 if($Profile -ceq 'Clean20261022' -and ($header[0].ServerName -ine $goal7Server -or $header[0].Position -ne 1 -or !$header[0].BackupSetGUID)){throw 'CLEAN_BACKUP_HEADER_IDENTITY_REJECTED'}
 $timer.Restart();Goal7-Execute $connection "RESTORE VERIFYONLY FROM DISK=N'$goal7BackupFile' WITH CHECKSUM;";$timer.Stop()
 $receipt=@{schemaVersion='melisa-goal7.backup.v1';server=$goal7Server;sourceDatabase=$goal7Database;file=$goal7BackupFile;startedAt=$started;completedAt=[DateTime]::UtcNow.ToString('o');copyOnly=$true;checksum=$true;verifyOnlyPassed=$true;sha256=(Get-FileHash -LiteralPath $goal7BackupFile -Algorithm SHA256).Hash;sizeBytes=(Get-Item -LiteralPath $goal7BackupFile).Length;backupSetGuid=[string]$header[0].BackupSetGUID;backupMs=$backupMs;verifyMs=$timer.ElapsedMilliseconds;activeOverwrite=$false;liveConnected=$false;restorePerformed=$false}
 if($Profile -ceq 'Clean20261022'){$receipt.schemaVersion='melisa-clean.sql-backup.v1';$receipt.runId=$RunId;$receipt.retention='retain-all-no-delete';$receipt.coverage='Clean TEST SQL database only; excludes ERP/CRM files, media, private settings and machine-protected accounts';$receipt.fullSystemRecoveryProven=$false}
 Goal7-Save 'backup-result.json' $receipt
 return $receipt
}
$goal7Connection=[Data.SqlClient.SqlConnection]::new("Server=$goal7Server;Database=$goal7Database;Integrated Security=True;Encrypt=False;Application Name=ERP-GOAL7-TEST-BACKUP")
$goal7Connection.Open()
try {
 $identity=@(Goal7-Rows $goal7Connection "SELECT CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) server, DB_NAME() [database], IS_SRVROLEMEMBER('sysadmin') admin,CONVERT(int,SERVERPROPERTY('EngineEdition')) edition")[0]
 if ($identity.server -cne $goal7Server -or $identity.database -cne $goal7Database -or $identity.admin -ne 1) { throw 'GOAL7_WRONG_TEST_DATABASE' }
 if($Profile -ceq 'Clean20261022'){Goal7-AssertCleanIdentity $identity @(Goal7-Rows $goal7Connection 'SELECT environment_id,synthetic,actual_t1,external_operations FROM dbo.clean_test_environment WHERE id=1')}
 $files=@(Goal7-Rows $goal7Connection 'SELECT name,type_desc,CAST(size AS bigint)*8192 sizeBytes FROM sys.database_files')
 $dataName=if($Profile -ceq 'Clean20261022'){'MELISA_ERP_CLEAN_TEST_20261022'}else{'MELISA_ERP_V2'}
 if($files.Count -ne 2 -or @($files|Where-Object {$_.name -ceq $dataName -and $_.type_desc -ceq 'ROWS'}).Count -ne 1 -or @($files|Where-Object {$_.name -ceq ($dataName+'_log') -and $_.type_desc -ceq 'LOG'}).Count -ne 1){throw 'GOAL7_SOURCE_FILE_IDENTITY'}
 $volume=@(Goal7-Rows $goal7Connection 'SELECT volume_mount_point,MIN(available_bytes) freeBytes FROM sys.database_files f CROSS APPLY sys.dm_os_volume_stats(DB_ID(),f.file_id) GROUP BY volume_mount_point')
 $needed=[long]($files|Measure-Object sizeBytes -Sum).Sum+10GB
 if ($volume.Count -ne 1 -or $volume[0].volume_mount_point -cne 'C:\' -or $volume[0].freeBytes -lt $needed) { throw 'GOAL7_BACKUP_INSUFFICIENT_SPACE' }
 $preflight=@{schemaVersion='melisa-goal7.backup-preflight.v1';server=$goal7Server;sourceDatabase=$goal7Database;file=$goal7BackupFile;checkedAt=[DateTime]::UtcNow.ToString('o');freeBytes=$volume[0].freeBytes;requiredConservativeBytes=$needed;overwriteAllowed=$false;restoreRequested=$false}
 if($Mode -eq 'Preflight'){
  if($Profile -ceq 'Clean20261022'){$preflight.schemaVersion='melisa-clean.backup-preflight.v1';$preflight.retention='retain-all-no-delete';$preflight.sourceBackupCreated=$false;Write-Output ($preflight|ConvertTo-Json -Depth 8)}else{Goal7-Save 'backup-preflight.json' $preflight;Write-Output 'GOAL7_BACKUP_PREFLIGHT_READY'}
  exit
 }
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
 $receipt=Goal7-WriteVerifiedBackup $goal7Connection $identity.edition
 Write-Output ($receipt|Select-Object schemaVersion,copyOnly,checksum,verifyOnlyPassed,sizeBytes,backupMs,verifyMs,sha256|ConvertTo-Json -Compress)
} finally { $goal7Connection.Close() }
