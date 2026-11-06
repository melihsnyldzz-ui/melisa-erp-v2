param([Parameter(Mandatory)][ValidateSet('before','after-info','after-recovery')][string]$Label)
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

DECLARE @v3_data TABLE(table_name sysname NOT NULL PRIMARY KEY,row_count bigint NOT NULL,row_hash char(64) NOT NULL);
DECLARE @v3_table sysname,@v3_keys nvarchar(max),@v3_query nvarchar(max),@v3_rows nvarchar(max),@v3_count bigint;
IF (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0)<>36 OR (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0 AND schema_id=SCHEMA_ID(N'dbo'))<>36 THROW 51995,'MASTER_V3_TABLE_SET_REJECTED',1;
DECLARE v3_tables CURSOR LOCAL FAST_FORWARD FOR SELECT t.name FROM sys.tables t WHERE t.is_ms_shipped=0 AND t.schema_id=SCHEMA_ID(N'dbo') AND t.name NOT IN(N'desktop_empty_installation',N'roles',N'permissions') ORDER BY t.name;
OPEN v3_tables; FETCH NEXT FROM v3_tables INTO @v3_table;
WHILE @@FETCH_STATUS=0 BEGIN
 SELECT @v3_keys=STRING_AGG(CONVERT(nvarchar(max),QUOTENAME(c.name)),N',') WITHIN GROUP(ORDER BY ic.key_ordinal)
 FROM sys.tables t JOIN sys.indexes i ON i.object_id=t.object_id AND i.is_primary_key=1 JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0 JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE t.schema_id=SCHEMA_ID(N'dbo') AND t.name=@v3_table;
 IF @v3_keys IS NULL THROW 51995,'MASTER_V3_PRIMARY_KEY_REQUIRED',1;
 SET @v3_query=N'SELECT @n=COUNT_BIG(*) FROM dbo.'+QUOTENAME(@v3_table)+N'; SELECT @j=(SELECT * FROM dbo.'+QUOTENAME(@v3_table)+N' ORDER BY '+@v3_keys+N' FOR JSON PATH,INCLUDE_NULL_VALUES);';
 SET @v3_rows=NULL; SET @v3_count=NULL;
 EXEC sys.sp_executesql @v3_query,N'@n bigint OUTPUT,@j nvarchar(max) OUTPUT',@n=@v3_count OUTPUT,@j=@v3_rows OUTPUT;
 -- SQL Server can yield a NULL scalar JSON subquery for an empty table.
 -- Canonicalize only independently counted emptiness; nonempty NULL fails.
 IF @v3_count=0 AND @v3_rows IS NULL SET @v3_rows=N'[]';
 IF @v3_rows IS NULL OR @v3_count IS NULL BEGIN
 DECLARE @rowError nvarchar(128)=CONCAT(N'MASTER_V3_ROW_SNAPSHOT_REJECTED_',UPPER(@v3_table COLLATE Latin1_General_100_BIN2),N'_R',CASE WHEN @v3_rows IS NULL THEN 1 ELSE 0 END,N'_C',CASE WHEN @v3_count IS NULL THEN 1 ELSE 0 END);
 THROW 51995,@rowError,1;END;
 INSERT @v3_data VALUES(@v3_table,@v3_count,CONVERT(char(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@v3_rows)),2));
 FETCH NEXT FROM v3_tables INTO @v3_table;
END; CLOSE v3_tables; DEALLOCATE v3_tables;
IF (SELECT COUNT(*) FROM @v3_data)<>33 THROW 51995,'MASTER_V3_ROW_SCOPE_REJECTED',1;
DECLARE @v3_data_json nvarchar(max)=(SELECT table_name,row_count,row_hash FROM @v3_data ORDER BY table_name FOR JSON PATH,INCLUDE_NULL_VALUES);
DECLARE @v3_business_sha char(64)=LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@v3_data_json)),2));
DECLARE @r1_operations nvarchar(max)=(SELECT table_name,row_count,row_hash FROM @v3_data WHERE table_name IN(N'customers',N'suppliers',N'party_entities',N'party_currency_accounts',N'products',N'product_barcodes',N'product_images',N'product_prices',N'desktop_local_product_units',N'desktop_local_price_units',N'stock_movements',N'customer_movements',N'supplier_movements',N'sales_invoices',N'sales_invoice_items',N'purchase_invoices',N'purchase_invoice_items',N'desktop_sale_workflows',N'desktop_sale_reservations',N'desktop_sale_cartons',N'desktop_sale_carton_items',N'desktop_sale_workflow_requests',N'desktop_sale_request_resolutions') ORDER BY table_name FOR JSON PATH);
SELECT LOWER(CONVERT(char(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@r1_operations)),2)) operationalRowsSha256,
 JSON_QUERY(@r1_operations) operationalTables,
 JSON_QUERY((SELECT LOWER(CONVERT(varchar(36),request_id)) requestId,operation,LOWER(CONVERT(varchar(64),payload_hash,2)) payloadHash,JSON_QUERY(response_json) response FROM dbo.desktop_local_master_requests WHERE actor_id=30002 ORDER BY created_at,request_id FOR JSON PATH)) requests,
 JSON_QUERY((SELECT p.id,p.stock_code,p.name,p.brand,p.category,p.supplier_id,CONVERT(varchar(40),p.current_stock_qty) stockExact3,CONVERT(varchar(40),p.average_cost_try) costExact4,CONVERT(varchar(40),p.sales_price) saleExact4 FROM dbo.products p ORDER BY p.id FOR JSON PATH)) products,
 JSON_QUERY((SELECT c.customer_code,CONVERT(varchar(40),c.balance) balanceExact4 FROM dbo.customers c ORDER BY c.id FOR JSON PATH)) customerBalances,
 JSON_QUERY((SELECT s.supplier_code,CONVERT(varchar(40),s.balance) balanceExact4 FROM dbo.suppliers s ORDER BY s.id FOR JSON PATH)) supplierBalances,
 JSON_QUERY((SELECT t.name [table],CONVERT(varchar(30),c.last_value) lastValue FROM sys.identity_columns c JOIN sys.tables t ON t.object_id=c.object_id WHERE t.name IN(N'products',N'desktop_local_product_units',N'product_barcodes',N'product_prices') ORDER BY t.name FOR JSON PATH,INCLUDE_NULL_VALUES)) identityValues,
 JSON_QUERY((SELECT m.id,m.product_id,m.movement_type,m.source_type,CONVERT(varchar(40),m.quantity_in) quantityInExact3,CONVERT(varchar(40),m.quantity_out) quantityOutExact3,CONVERT(varchar(40),m.unit_cost_try) costExact4,CONVERT(varchar(40),m.amount_try) amountExact4 FROM dbo.stock_movements m JOIN dbo.products p ON p.id=m.product_id WHERE p.stock_code=N'ERP-R1-P7' ORDER BY m.id FOR JSON PATH)) newProductMovements,
 JSON_QUERY((SELECT u.id,u.product_id,u.label,CONVERT(varchar(40),u.factor) factorExact8,u.is_main FROM dbo.desktop_local_product_units u JOIN dbo.products p ON p.id=u.product_id WHERE p.stock_code=N'ERP-R1-P7' ORDER BY u.is_main DESC,u.id FOR JSON PATH)) newProductUnits,
 JSON_QUERY((SELECT q.id,q.price_type,q.currency_code,CONVERT(varchar(40),q.price) priceExact8,l.unit_id,u.label unitLabel,CONVERT(varchar(40),u.factor) factorExact8 FROM dbo.product_prices q JOIN dbo.products p ON p.id=q.product_id JOIN dbo.desktop_local_price_units l ON l.price_id=q.id AND l.product_id=q.product_id JOIN dbo.desktop_local_product_units u ON u.id=l.unit_id AND u.product_id=q.product_id WHERE p.stock_code=N'ERP-R1-P7' ORDER BY q.id FOR JSON PATH)) newProductPrices,
 JSON_QUERY((SELECT a.id,a.actor_user_id,a.action,a.entity_id,a.reason requestId,JSON_QUERY(a.after_json) detail FROM dbo.audit_logs a JOIN dbo.products p ON p.id=a.entity_id WHERE p.stock_code=N'ERP-R1-P7' AND a.entity_type=N'local-master' AND a.action=N'product.create' AND a.source=N'desktop-local-master-v1' ORDER BY a.id FOR JSON PATH)) newProductAudit,
 JSON_QUERY((SELECT i.id,i.document_no,i.status,i.customer_id,w.state workflowState,i.document_currency,CONVERT(varchar(40),i.grand_total) totalExact4,CONVERT(varchar(40),i.estimated_profit_try) profitExact4,JSON_QUERY((SELECT x.id,x.product_id,x.stock_code_snapshot stockCode,CONVERT(varchar(40),x.quantity) quantityExact3,CONVERT(varchar(40),x.unit_price) unitPriceExact4,CONVERT(varchar(40),x.line_total) lineTotalExact4,CONVERT(varchar(40),x.average_cost_try_snapshot) costExact4 FROM dbo.sales_invoice_items x WHERE x.sales_invoice_id=i.id ORDER BY x.id FOR JSON PATH)) items FROM dbo.sales_invoices i JOIN dbo.desktop_sale_workflows w ON w.invoice_id=i.id WHERE EXISTS(SELECT 1 FROM dbo.sales_invoice_items x JOIN dbo.products p ON p.id=x.product_id WHERE x.sales_invoice_id=i.id AND p.stock_code=N'ERP-R1-P7') ORDER BY i.id FOR JSON PATH)) newSales,
 JSON_QUERY((SELECT a.id,a.actor_user_id,a.action,a.entity_id,a.reason requestId,JSON_QUERY(a.after_json) detail FROM dbo.audit_logs a WHERE a.action=N'sales.series.selection' AND a.entity_type=N'sales-invoice' AND a.source=N'desktop-sale-v1' AND EXISTS(SELECT 1 FROM dbo.sales_invoice_items x JOIN dbo.products p ON p.id=x.product_id WHERE x.sales_invoice_id=a.entity_id AND p.stock_code=N'ERP-R1-P7') ORDER BY a.id FOR JSON PATH)) newSeriesAudit,
 JSON_QUERY((SELECT LOWER(CONVERT(varchar(36),r.request_id)) requestId,r.invoice_id,r.actor_id,r.operation,LOWER(CONVERT(varchar(64),r.payload_hash,2)) payloadHash,JSON_QUERY(r.result_json) result FROM dbo.desktop_sale_workflow_requests r WHERE EXISTS(SELECT 1 FROM dbo.sales_invoice_items x JOIN dbo.products p ON p.id=x.product_id WHERE x.sales_invoice_id=r.invoice_id AND p.stock_code=N'ERP-R1-P7') ORDER BY r.request_id FOR JSON PATH)) newSaleRequests,
 JSON_QUERY((SELECT m.id,m.product_id,m.source_id,m.created_by,m.movement_type,m.source_type,CONVERT(varchar(40),m.quantity_in) quantityInExact3,CONVERT(varchar(40),m.quantity_out) quantityOutExact3,CONVERT(varchar(40),m.unit_cost_try) costExact4,CONVERT(varchar(40),m.amount_try) amountExact4 FROM dbo.stock_movements m WHERE m.source_type=N'sales_invoice' AND EXISTS(SELECT 1 FROM dbo.sales_invoice_items x JOIN dbo.products p ON p.id=x.product_id WHERE x.sales_invoice_id=m.source_id AND p.stock_code=N'ERP-R1-P7') ORDER BY m.id FOR JSON PATH)) newSaleStock,
 JSON_QUERY((SELECT p.id,CONVERT(varchar(40),p.current_stock_qty) physicalExact3,CONVERT(varchar(40),CONVERT(decimal(18,3),q.reserved)) reservedExact3,CONVERT(varchar(40),CONVERT(decimal(19,3),p.current_stock_qty)-CONVERT(decimal(19,3),q.reserved)) availableExact3 FROM dbo.products p OUTER APPLY(SELECT ISNULL(SUM(r.quantity),0) reserved FROM dbo.desktop_sale_reservations r WITH(HOLDLOCK) WHERE r.product_id=p.id AND r.state='ACTIVE') q ORDER BY p.id FOR JSON PATH)) stockAmounts,
 JSON_QUERY((SELECT invoice_id,item_id,product_id,CONVERT(varchar(40),quantity) quantityExact3,state FROM dbo.desktop_sale_reservations ORDER BY invoice_id,item_id FOR JSON PATH)) reservations,
 JSON_QUERY((SELECT i.id,i.status,w.state workflowState,CONVERT(varchar(40),i.grand_total) totalExact4 FROM dbo.sales_invoices i JOIN dbo.desktop_sale_workflows w ON w.invoice_id=i.id ORDER BY i.id FOR JSON PATH)) allInvoices,
 JSON_QUERY((SELECT CONVERT(varchar(20),c.id) id,c.customer_code customerCode,c.name,c.phone,c.city,c.country,c.customer_type customerType,c.currency_code currency,CONVERT(varchar(40),c.balance) balanceExact4,CONVERT(varchar(20),c.party_entity_id) entityId,c.is_active isActive,
 JSON_QUERY((SELECT CONVERT(varchar(20),a.id) id,CONVERT(varchar(20),a.customer_id) customerId,CONVERT(varchar(20),a.party_entity_id) entityId,CONVERT(varchar(20),a.supplier_id) supplierId,a.currency_code currency,CONVERT(varchar(50),a.current_balance) balanceExact8,a.balance_status balanceStatus FROM dbo.party_currency_accounts a WHERE a.customer_id=c.id ORDER BY a.currency_code,a.id FOR JSON PATH,INCLUDE_NULL_VALUES)) accounts,
 JSON_QUERY((SELECT TOP(1) CONVERT(varchar(20),i.id) invoiceId,CONVERT(varchar(20),i.customer_id) customerId,i.document_no documentNo,CONVERT(char(10),i.document_date,23) documentDate,i.document_currency currency,CONVERT(varchar(40),i.grand_total) totalExact4 FROM dbo.sales_invoices i JOIN dbo.desktop_sale_workflows w ON w.invoice_id=i.id WHERE i.customer_id=c.id AND i.status=N'finalized' AND w.state='COMPLETED' ORDER BY i.document_date DESC,i.id DESC FOR JSON PATH,WITHOUT_ARRAY_WRAPPER)) lastSale
 FROM dbo.customers c JOIN dbo.party_entities e ON e.id=c.party_entity_id AND e.role=N'customer' WHERE c.is_deleted=0 ORDER BY c.id FOR JSON PATH,INCLUDE_NULL_VALUES)) customerCards,
 JSON_QUERY((SELECT a.id,a.customer_id,a.supplier_id,a.currency_code,CONVERT(varchar(40),a.current_balance) balanceExact8 FROM dbo.party_currency_accounts a ORDER BY a.id FOR JSON PATH)) currencyAccounts
FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;COMMIT TRANSACTION;
'@
 $reader=$command.ExecuteReader();$builder=[Text.StringBuilder]::new()
 try {while($reader.Read()){[void]$builder.Append($reader.GetString(0))};while($reader.NextResult()){while($reader.Read()){throw 'K02_EXTRA_RESULT'}}}finally{$reader.Dispose();$command.Dispose()}
 $data=$builder.ToString()|ConvertFrom-Json -AsHashtable
 $result=@{state='R1_CARD_READ_ONLY_SNAPSHOT';capturedAt=[DateTime]::UtcNow.ToString('o');target=@{server='Semih\MELISAERP';database='MELISA_ERP_DESKTOP_TEST_20261105';databaseId=5;databaseGuid='c67f5317-9c0d-4831-aadd-fadc379a95d1';schemaVersion=3};metadata=$data;ddlExecuted=$false;dmlExecuted=$false;servicesChanged=$false}
 $file=Join-Path 'C:\Users\Xaser\Desktop\ERP\kurulum' ('r1-runtime-info-'+$Label+'.json')
 if(Test-Path -LiteralPath $file){throw 'K02_OBSERVATION_ALREADY_EXISTS'}
 [IO.File]::WriteAllText($file,($result|ConvertTo-Json -Depth 15),[Text.UTF8Encoding]::new($false))
 [Console]::WriteLine('R1_CARD_READ_ONLY_'+$Label)
}finally{if($connection){$connection.Dispose()}}
