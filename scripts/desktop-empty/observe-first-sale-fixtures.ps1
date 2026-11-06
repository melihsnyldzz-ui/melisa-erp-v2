param([Parameter(Mandatory)][ValidatePattern('^[a-z0-9-]{1,50}$')][string]$Label)
# Read-only, fixed-fixture snapshot. No DDL, credentials or business writes.
$ErrorActionPreference='Stop';$connection=$null
try{
 $connection=[Data.Odbc.OdbcConnection]::new('Driver={ODBC Driver 17 for SQL Server};Server=lpc:Semih\MELISAERP;Database=MELISA_ERP_DESKTOP_TEST_20261105;Trusted_Connection=Yes;Encrypt=No;');$connection.Open()
 $command=$connection.CreateCommand();$command.CommandTimeout=30
 $command.CommandText=@'
SET NOCOUNT ON; SET XACT_ABORT ON; SET TRANSACTION ISOLATION LEVEL SERIALIZABLE; BEGIN TRANSACTION;
IF DB_ID()<>5 OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName'))<>N'Semih\MELISAERP' OR CONVERT(int,SERVERPROPERTY('ProcessID'))<>5240
 OR SUSER_SID()<>SUSER_SID(N'SEMIH\Xaser') OR SUSER_SID(ORIGINAL_LOGIN())<>SUSER_SID(N'SEMIH\Xaser')
 OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 OR ISNULL(CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')),N'')<>N'Shared memory'
 OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=5 AND database_guid='c67f5317-9c0d-4831-aadd-fadc379a95d1')
 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND environment_id='eb2888c2-51cb-4570-a933-397cf7e62806' AND schema_version=2 AND read_only=0 AND actual_t1=0 AND external_operations=0)
 THROW 51995,'FIXTURE_OBSERVER_TARGET_REJECTED',1;
SELECT
 JSON_QUERY((SELECT (SELECT COUNT_BIG(*) FROM dbo.sales_invoices) invoices,(SELECT COUNT_BIG(*) FROM dbo.sales_invoice_items) items,(SELECT COUNT_BIG(*) FROM dbo.desktop_sale_workflows) workflows,(SELECT COUNT_BIG(*) FROM dbo.desktop_sale_workflow_requests) requests,(SELECT COUNT_BIG(*) FROM dbo.stock_movements WHERE source_type=N'sales_invoice') saleStockRows,(SELECT COUNT_BIG(*) FROM dbo.customer_movements) customerRows FOR JSON PATH,WITHOUT_ARRAY_WRAPPER)) counts,
 JSON_QUERY((SELECT p.id,p.stock_code,CONVERT(varchar(40),p.current_stock_qty) stockExact3,CONVERT(varchar(40),p.average_cost_try) costExact4 FROM dbo.products p WHERE p.stock_code IN(N'ERP-TEST-P1',N'ERP-TEST-P2') ORDER BY p.id FOR JSON PATH)) products,
 JSON_QUERY((SELECT c.id,c.customer_code,CONVERT(varchar(40),c.balance) balanceExact4 FROM dbo.customers c WHERE c.customer_code=N'ERP-TEST-20261106' FOR JSON PATH)) customers,
 JSON_QUERY((SELECT a.id,a.party_entity_id,a.customer_id,a.currency_code,CONVERT(varchar(40),a.current_balance) balanceExact8 FROM dbo.party_currency_accounts a JOIN dbo.customers c ON c.id=a.customer_id WHERE c.customer_code=N'ERP-TEST-20261106' FOR JSON PATH)) accounts,
 JSON_QUERY((SELECT m.id,m.sales_invoice_id,m.party_entity_id,m.party_currency_account_id,m.movement_type,m.currency_code,CONVERT(varchar(40),m.amount) amountExact4,CONVERT(varchar(40),m.balance_effect) effectExact4 FROM dbo.customer_movements m JOIN dbo.customers c ON c.id=m.customer_id WHERE c.customer_code=N'ERP-TEST-20261106' ORDER BY m.id FOR JSON PATH)) customerMovements,
 JSON_QUERY((SELECT m.id,m.source_id,m.product_id,m.movement_type,CONVERT(varchar(40),m.quantity_out) outExact3,CONVERT(varchar(40),m.quantity_net) netExact3 FROM dbo.stock_movements m JOIN dbo.products p ON p.id=m.product_id WHERE p.stock_code IN(N'ERP-TEST-P1',N'ERP-TEST-P2') AND m.source_type=N'sales_invoice' ORDER BY m.id FOR JSON PATH)) stockMovements,
 JSON_QUERY((SELECT i.id,i.document_no,i.status,i.document_currency,CONVERT(varchar(40),i.grand_total) totalExact4,CONVERT(varchar(40),i.estimated_profit_try) profitExact4,w.state workflowState,CONVERT(varchar(18),CONVERT(binary(8),w.version),1) version FROM dbo.sales_invoices i LEFT JOIN dbo.desktop_sale_workflows w ON w.invoice_id=i.id JOIN dbo.customers c ON c.id=i.customer_id WHERE c.customer_code=N'ERP-TEST-20261106' ORDER BY i.id FOR JSON PATH)) invoices,
 JSON_QUERY((SELECT r.invoice_id,r.item_id,r.product_id,CONVERT(varchar(40),r.quantity) quantityExact3,r.state FROM dbo.desktop_sale_reservations r JOIN dbo.sales_invoices i ON i.id=r.invoice_id JOIN dbo.customers c ON c.id=i.customer_id WHERE c.customer_code=N'ERP-TEST-20261106' ORDER BY r.invoice_id,r.item_id FOR JSON PATH)) reservations,
 JSON_QUERY((SELECT k.invoice_id,k.carton_no,k.item_id,k.product_id,CONVERT(varchar(40),k.quantity) quantityExact3 FROM dbo.desktop_sale_carton_items k JOIN dbo.sales_invoices i ON i.id=k.invoice_id JOIN dbo.customers c ON c.id=i.customer_id WHERE c.customer_code=N'ERP-TEST-20261106' ORDER BY k.invoice_id,k.carton_no,k.item_id FOR JSON PATH)) cartons,
 JSON_QUERY((SELECT r.invoice_id,r.operation,LOWER(CONVERT(varchar(36),r.request_id)) requestId FROM dbo.desktop_sale_workflow_requests r JOIN dbo.sales_invoices i ON i.id=r.invoice_id JOIN dbo.customers c ON c.id=i.customer_id WHERE c.customer_code=N'ERP-TEST-20261106' ORDER BY r.invoice_id,r.operation FOR JSON PATH)) requests
FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
COMMIT TRANSACTION;
'@
 $reader=$command.ExecuteReader();$builder=[Text.StringBuilder]::new();try{while($reader.Read()){[void]$builder.Append($reader.GetString(0))};while($reader.NextResult()){while($reader.Read()){throw 'UNEXPECTED_OBSERVER_RESULT'}}}finally{$reader.Dispose();$command.Dispose()}
 $data=$builder.ToString()|ConvertFrom-Json -AsHashtable;$record=@{state='READ_ONLY_FIXTURE_SNAPSHOT';label=$Label;time=[DateTime]::UtcNow.ToString('o');databaseGuid='c67f5317-9c0d-4831-aadd-fadc379a95d1';data=$data};$json=$record|ConvertTo-Json -Depth 15 -Compress
 $directory='C:\Users\Xaser\Desktop\ERP\kurulum\first-sale-observations';[void][IO.Directory]::CreateDirectory($directory);$file=Join-Path $directory ([DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfff')+'-'+$Label+'.json');[IO.File]::WriteAllText($file,$json,[Text.UTF8Encoding]::new($false));[Console]::WriteLine($json)
}finally{if($connection){$connection.Dispose()}}
