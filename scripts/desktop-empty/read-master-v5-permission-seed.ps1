# Fixed read-only seed observation in a separate short-lived process.
$ErrorActionPreference='Stop';$connection=$null;$command=$null
try {
 $actual=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 $expected=([Security.Principal.NTAccount]::new('SEMIH','Xaser')).Translate([Security.Principal.SecurityIdentifier]).Value
 if(-not $actual -or $actual -cne $expected){throw 'SEED_WINDOWS_IDENTITY'}
 $connection=[Data.Odbc.OdbcConnection]::new('Driver={ODBC Driver 17 for SQL Server};Server=lpc:Semih\MELISAERP;Database=MELISA_ERP_DESKTOP_TEST_20261105;Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=No;')
 $connection.Open();$command=$connection.CreateCommand();$command.CommandTimeout=15
 $command.CommandText=@'
SET NOCOUNT ON;
IF DB_ID() IS NULL OR DB_ID()<>5 OR DB_NAME() IS NULL OR CONVERT(varbinary(256),DB_NAME())<>CONVERT(varbinary(256),N'MELISA_ERP_DESKTOP_TEST_20261105')
 OR SERVERPROPERTY('ServerName') IS NULL OR CONVERT(varbinary(256),CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')))<>CONVERT(varbinary(256),N'Semih\MELISAERP')
 OR ISNULL(CONVERT(int,SERVERPROPERTY('ProcessID')),-1)<>5240 OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1
 OR SUSER_SID() IS NULL OR SUSER_SID(ORIGINAL_LOGIN()) IS NULL OR SUSER_SID(N'SEMIH\Xaser') IS NULL OR SUSER_SID()<>SUSER_SID(N'SEMIH\Xaser') OR SUSER_SID(ORIGINAL_LOGIN())<>SUSER_SID(N'SEMIH\Xaser')
 OR ISNULL(CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')),N'')<>N'Shared memory'
 OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=5 AND database_guid='c67f5317-9c0d-4831-aadd-fadc379a95d1')
 OR (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1
 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND environment_id='eb2888c2-51cb-4570-a933-397cf7e62806' AND schema_version=4 AND read_only=0 AND actual_t1=0 AND external_operations=0)
 THROW 51995,'MASTER_V5_SEED_TARGET_REJECTED',1;
SELECT CONVERT(varchar(20),IDENT_CURRENT(N'dbo.permissions'));
'@
 if([string]$command.ExecuteScalar() -cne '42'){throw 'MASTER_V5_SEED_REJECTED'}
 [Console]::WriteLine('MASTER_V5_PERMISSION_SEED_42_VERIFIED')
}catch{[Console]::Error.WriteLine('MASTER_V5_PERMISSION_SEED_REJECTED');exit 1}
finally{if($command){$command.Dispose()};if($connection){$connection.Dispose()}}
