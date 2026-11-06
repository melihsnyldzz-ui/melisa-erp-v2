param([Parameter(Mandatory)][ValidatePattern('^[a-z0-9-]{1,50}$')][string]$Label)
# Read-only fixed synthetic cards. No schema/permission/credential changes.
$ErrorActionPreference='Stop';$connection=$null
try{
 $connection=[Data.Odbc.OdbcConnection]::new('Driver={ODBC Driver 17 for SQL Server};Server=lpc:Semih\MELISAERP;Database=MELISA_ERP_DESKTOP_TEST_20261105;Trusted_Connection=Yes;Encrypt=No;');$connection.Open()
 $command=$connection.CreateCommand();$command.CommandTimeout=30;$command.CommandText=@'
SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;
IF ISNULL(DB_ID(),-1)<>5 OR ISNULL(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'') COLLATE Latin1_General_100_BIN2<>N'Semih\MELISAERP'
 OR ISNULL(CONVERT(int,SERVERPROPERTY('ProcessID')),-1)<>5240
 OR SUSER_SID() IS NULL OR SUSER_SID(ORIGINAL_LOGIN()) IS NULL OR SUSER_SID(N'SEMIH\Xaser') IS NULL
 OR SUSER_SID()<>SUSER_SID(N'SEMIH\Xaser') OR SUSER_SID(ORIGINAL_LOGIN())<>SUSER_SID(N'SEMIH\Xaser')
 OR ISNULL(IS_SRVROLEMEMBER(N'sysadmin'),0)<>1 OR ISNULL(CONVERT(nvarchar(40),CONNECTIONPROPERTY('net_transport')),N'')<>N'Shared memory'
 OR NOT EXISTS(SELECT 1 FROM sys.database_recovery_status WHERE database_id=5 AND database_guid='c67f5317-9c0d-4831-aadd-fadc379a95d1')
 OR (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation)<>1
 OR NOT EXISTS(SELECT 1 FROM dbo.desktop_empty_installation WHERE id=1 AND environment_id='eb2888c2-51cb-4570-a933-397cf7e62806' AND schema_version=3 AND read_only=0 AND actual_t1=0 AND external_operations=0)
 THROW 51995,'MASTER_V3_FIXTURE_TARGET_REJECTED',1;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;BEGIN TRANSACTION;
SELECT
 JSON_QUERY((SELECT p.id,p.stock_code,p.name,p.brand,p.category,p.supplier_id,p.currency_code,p.unit,CONVERT(varchar(40),p.sales_price) saleExact4,CONVERT(varchar(40),p.purchase_price) purchaseExact4,CONVERT(varchar(20),p.purchase_discount_rate) discountExact4,CONVERT(varchar(40),p.average_cost_try) costExact4,CONVERT(varchar(40),p.current_stock_qty) stockExact3 FROM dbo.products p WHERE p.stock_code IN(N'ERP-TEST-P1',N'ERP-TEST-P2',N'ERP-V3-P3') ORDER BY p.id FOR JSON PATH,INCLUDE_NULL_VALUES)) products,
 JSON_QUERY((SELECT s.id,s.supplier_code,s.name,s.party_entity_id,s.city,s.country,s.currency_code,CONVERT(varchar(40),s.balance) balanceExact4,CONVERT(varchar(20),s.purchase_discount_rate) discountExact4,s.is_active,s.is_deleted,e.role FROM dbo.suppliers s LEFT JOIN dbo.party_entities e ON e.id=s.party_entity_id WHERE s.supplier_code=N'ERP-V3-S1' FOR JSON PATH,INCLUDE_NULL_VALUES)) suppliers,
 JSON_QUERY((SELECT c.id,c.customer_code,c.party_entity_id,c.city,c.country,c.currency_code,CONVERT(varchar(40),c.balance) balanceExact4,e.role FROM dbo.customers c LEFT JOIN dbo.party_entities e ON e.id=c.party_entity_id WHERE c.customer_code IN(N'ERP-TEST-20261106',N'ERP-V3-C1') ORDER BY c.id FOR JSON PATH,INCLUDE_NULL_VALUES)) customers,
 JSON_QUERY((SELECT a.id,a.party_entity_id,a.customer_id,a.supplier_id,a.currency_code,CONVERT(varchar(40),a.current_balance) balanceExact8,e.role FROM dbo.party_currency_accounts a LEFT JOIN dbo.party_entities e ON e.id=a.party_entity_id WHERE a.customer_id IN(SELECT id FROM dbo.customers WHERE customer_code IN(N'ERP-TEST-20261106',N'ERP-V3-C1')) OR a.supplier_id IN(SELECT id FROM dbo.suppliers WHERE supplier_code=N'ERP-V3-S1') ORDER BY a.id FOR JSON PATH,INCLUDE_NULL_VALUES)) accounts,
 JSON_QUERY((SELECT m.id,m.product_id,m.source_type,m.movement_type,CONVERT(varchar(40),m.quantity_in) inExact3,CONVERT(varchar(40),m.quantity_out) outExact3,CONVERT(varchar(40),m.unit_cost_try) costExact4,CONVERT(varchar(40),m.amount_try) amountExact4 FROM dbo.stock_movements m JOIN dbo.products p ON p.id=m.product_id WHERE p.stock_code=N'ERP-V3-P3' ORDER BY m.id FOR JSON PATH,INCLUDE_NULL_VALUES)) newProductMovements,
 JSON_QUERY((SELECT LOWER(CONVERT(varchar(36),r.request_id)) requestId,r.operation,r.actor_id,LOWER(CONVERT(varchar(64),r.payload_hash,2)) payloadHash,JSON_VALUE(r.response_json,'$.entity.id') entityId FROM dbo.desktop_local_master_requests r WHERE r.actor_id=30002 ORDER BY r.created_at,r.request_id FOR JSON PATH)) masterRequests,
 JSON_QUERY((SELECT i.id,i.document_no,i.status,w.state workflowState,CONVERT(varchar(40),i.grand_total) totalExact4,CONVERT(varchar(40),i.estimated_profit_try) profitExact4,c.customer_code FROM dbo.sales_invoices i JOIN dbo.customers c ON c.id=i.customer_id LEFT JOIN dbo.desktop_sale_workflows w ON w.invoice_id=i.id WHERE c.customer_code IN(N'ERP-TEST-20261106',N'ERP-V3-C1') ORDER BY i.id FOR JSON PATH,INCLUDE_NULL_VALUES)) invoices,
 JSON_QUERY((SELECT m.id,m.sales_invoice_id,m.party_entity_id,m.party_currency_account_id,CONVERT(varchar(40),m.amount) amountExact4,CONVERT(varchar(40),m.balance_effect) balanceEffectExact4 FROM dbo.customer_movements m JOIN dbo.customers c ON c.id=m.customer_id WHERE c.customer_code=N'ERP-V3-C1' ORDER BY m.id FOR JSON PATH)) newCustomerMovements,
 JSON_QUERY((SELECT r.invoice_id,r.item_id,r.product_id,CONVERT(varchar(40),r.quantity) quantityExact3,r.state FROM dbo.desktop_sale_reservations r JOIN dbo.sales_invoices i ON i.id=r.invoice_id JOIN dbo.customers c ON c.id=i.customer_id WHERE c.customer_code=N'ERP-V3-C1' ORDER BY r.item_id FOR JSON PATH)) newReservations,
 JSON_QUERY((SELECT p.permission_key,p.can_view,p.can_create,p.can_update,p.can_delete,p.can_approve FROM dbo.permissions p JOIN dbo.roles r ON r.id=p.role_id WHERE r.code=N'desktop_first_sale_operator' ORDER BY p.permission_key FOR JSON PATH)) operatorPermissions
FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
COMMIT TRANSACTION;
'@
 $reader=$command.ExecuteReader();$builder=[Text.StringBuilder]::new();try{while($reader.Read()){[void]$builder.Append($reader.GetString(0))};while($reader.NextResult()){while($reader.Read()){throw 'MASTER_V3_FIXTURE_EXTRA_RESULT'}}}finally{$reader.Dispose();$command.Dispose()}
 $data=$builder.ToString()|ConvertFrom-Json -AsHashtable;$record=@{state='MASTER_V3_READ_ONLY_FIXTURES';label=$Label;time=[DateTime]::UtcNow.ToString('o');data=$data};$json=$record|ConvertTo-Json -Depth 14 -Compress
 $dir='C:\Users\Xaser\Desktop\ERP\kurulum\master-v3-observations';[void][IO.Directory]::CreateDirectory($dir);$file=Join-Path $dir ([DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfff')+'-'+$Label+'.json');[IO.File]::WriteAllText($file,$json,[Text.UTF8Encoding]::new($false));[Console]::WriteLine($json)
}finally{if($connection){$connection.Dispose()}}
