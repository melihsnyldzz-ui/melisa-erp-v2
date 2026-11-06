param([Parameter(Mandatory)][ValidateSet('capture')][string]$Label)
# Read-only K02-02 observation. No DDL, DML, account or service operations.
$ErrorActionPreference='Stop';$connection=$null
try {
 $connection=[Data.Odbc.OdbcConnection]::new('Driver={ODBC Driver 17 for SQL Server};Server=lpc:Semih\MELISAERP;Database=MELISA_ERP_DESKTOP_TEST_20261105;Trusted_Connection=Yes;Encrypt=No;');$connection.Open()
 $command=$connection.CreateCommand();$command.CommandTimeout=30
 $command.CommandText=@'
SET NOCOUNT ON;SET LOCK_TIMEOUT 5000;
IF ISNULL(DB_ID(),-1)<>5
 OR CONVERT(varbinary(256),CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')))<>CONVERT(varbinary(256),N'Semih\MELISAERP')
 OR DB_NAME() IS NULL OR CONVERT(varbinary(256),DB_NAME())<>CONVERT(varbinary(256),N'MELISA_ERP_DESKTOP_TEST_20261105')
 OR ISNULL(CONVERT(int,SERVERPROPERTY('ProcessID')),-1)<>5240
 OR SUSER_SID() IS NULL OR SUSER_SID(ORIGINAL_LOGIN()) IS NULL OR SUSER_SID(N'SEMIH\Xaser') IS NULL
 OR SUSER_SID()<>SUSER_SID(N'SEMIH\Xaser') OR SUSER_SID(ORIGINAL_LOGIN())<>SUSER_SID(N'SEMIH\Xaser')
 OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 OR ISNULL(CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')),N'')<>N'Shared memory'
 OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=5 AND database_guid='c67f5317-9c0d-4831-aadd-fadc379a95d1')
 OR (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1
 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND environment_id='eb2888c2-51cb-4570-a933-397cf7e62806' AND schema_version=3 AND read_only=0 AND actual_t1=0 AND external_operations=0)
 THROW 51995,'K02_METADATA_TARGET_REJECTED',1;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;BEGIN TRANSACTION;

SELECT JSON_QUERY((SELECT m.* FROM dbo.customer_movements m WHERE m.sales_invoice_id=8 AND m.customer_id=3 AND EXISTS(SELECT 1 FROM dbo.sales_invoice_items x JOIN dbo.products p ON p.id=x.product_id WHERE x.sales_invoice_id=m.sales_invoice_id AND p.stock_code=N'ERP-R1-P7') ORDER BY m.id FOR JSON PATH,INCLUDE_NULL_VALUES)) customerMovement,
 JSON_QUERY((SELECT a.id,a.party_entity_id,a.customer_id,a.supplier_id,a.currency_code,CONVERT(varchar(40),a.current_balance) balanceExact8 FROM dbo.party_currency_accounts a WHERE a.customer_id=3 AND a.supplier_id IS NULL ORDER BY a.id FOR JSON PATH,INCLUDE_NULL_VALUES)) account
FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;COMMIT TRANSACTION;
'@
 $reader=$command.ExecuteReader();$builder=[Text.StringBuilder]::new()
 try {while($reader.Read()){[void]$builder.Append($reader.GetString(0))};while($reader.NextResult()){while($reader.Read()){throw 'K02_EXTRA_RESULT'}}}finally{$reader.Dispose();$command.Dispose()}
 $data=$builder.ToString()|ConvertFrom-Json -AsHashtable
 $result=@{state='R1_CARD_READ_ONLY_SNAPSHOT';capturedAt=[DateTime]::UtcNow.ToString('o');target=@{server='Semih\MELISAERP';database='MELISA_ERP_DESKTOP_TEST_20261105';databaseId=5;databaseGuid='c67f5317-9c0d-4831-aadd-fadc379a95d1';schemaVersion=3};metadata=$data;ddlExecuted=$false;dmlExecuted=$false;servicesChanged=$false}
 $file=Join-Path 'C:\Users\Xaser\Desktop\ERP\kurulum' ('r1-series-posting-'+$Label+'.json')
 if(Test-Path -LiteralPath $file){throw 'K02_OBSERVATION_ALREADY_EXISTS'}
 [IO.File]::WriteAllText($file,($result|ConvertTo-Json -Depth 15),[Text.UTF8Encoding]::new($false))
 [Console]::WriteLine('R1_CARD_READ_ONLY_'+$Label)
}finally{if($connection){$connection.Dispose()}}
