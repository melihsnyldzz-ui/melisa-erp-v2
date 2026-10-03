-- Reviewed provisioning only. Not part of LIVE migrations; never auto-run.
-- Product scope is deliberately empty. Provision exact independently verified
-- source/native links separately, with an evidence SHA256; never guess by name.
IF DB_NAME()<>N'MELISA_ERP_SIRKET_TEST_20260929_01' THROW 51090,'CRM_TEST_DATABASE_REQUIRED',1;
IF NOT EXISTS(SELECT 1 FROM dbo.customers WHERE id=593 AND customer_code=N'TEST-V70-20260929-C' AND is_active=1 AND is_deleted=0) THROW 51094,'CRM_TEST_SCOPE_REQUIRED',1;
IF USER_ID(N'melisa_sirket_sales_test_20260929_01') IS NULL THROW 51094,'CRM_TEST_WRITER_REQUIRED',1;
GO
IF DB_NAME()<>N'MELISA_ERP_SIRKET_TEST_20260929_01' THROW 51090,'CRM_TEST_DATABASE_REQUIRED',1;
IF OBJECT_ID(N'dbo.test_crm_order_product_scope',N'U') IS NULL
CREATE TABLE dbo.test_crm_order_product_scope(
 source_id NVARCHAR(50) NOT NULL PRIMARY KEY,
 source_stock_code NVARCHAR(120) NOT NULL UNIQUE,
 source_product_name NVARCHAR(250) NOT NULL,
 product_id BIGINT NOT NULL UNIQUE REFERENCES dbo.products(id),
 native_stock_code NVARCHAR(50) NOT NULL,
 native_product_name NVARCHAR(250) NOT NULL,
 unit_price DECIMAL(18,4) NOT NULL CHECK(unit_price>=0 AND unit_price<=1000000),
 currency NVARCHAR(3) NOT NULL CHECK(currency IN(N'TRY',N'USD',N'EUR')),
 evidence_sha256 CHAR(64) NOT NULL,
 verified_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
 is_active BIT NOT NULL DEFAULT 1,
 CONSTRAINT CK_test_crm_order_source CHECK(source_id LIKE N'vega-[1-9]%' AND SUBSTRING(source_id,6,50) NOT LIKE N'%[^0-9]%' AND TRY_CONVERT(BIGINT,SUBSTRING(source_id,6,50))>0 AND LEN(evidence_sha256)=64 AND evidence_sha256 NOT LIKE '%[^0-9a-f]%')
);
IF OBJECT_ID(N'dbo.test_crm_order_requests',N'U') IS NULL
CREATE TABLE dbo.test_crm_order_requests(
 request_id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
 actor_id BIGINT NOT NULL REFERENCES dbo.users(id),
 crm_actor_id NVARCHAR(80) NOT NULL,
 conversation_id NVARCHAR(20) NOT NULL CHECK(conversation_id=N'55'),
 peer NVARCHAR(20) NOT NULL CHECK(peer=N'905387217733'),
 customer_id BIGINT NOT NULL CHECK(customer_id=593),
 payload_hash CHAR(64) NOT NULL,
 items_json NVARCHAR(MAX) NOT NULL CHECK(ISJSON(items_json)=1),
 exchange_rate DECIMAL(18,8) NOT NULL,
 order_id BIGINT NOT NULL UNIQUE REFERENCES dbo.sales_orders(id),
 created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()
);
IF OBJECT_ID(N'dbo.test_crm_order_request_lines',N'U') IS NULL
CREATE TABLE dbo.test_crm_order_request_lines(
 request_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.test_crm_order_requests(request_id),
 item_id BIGINT NOT NULL REFERENCES dbo.sales_order_items(id),
 source_id NVARCHAR(50) NOT NULL,
 source_stock_code NVARCHAR(120) NOT NULL,
 PRIMARY KEY(request_id,item_id)
);
GO
CREATE OR ALTER PROCEDURE dbo.usp_test_crm_order_context @actor_id BIGINT,@crm_actor_id NVARCHAR(80)
AS
BEGIN
 SET NOCOUNT ON;
 IF DB_NAME()<>N'MELISA_ERP_SIRKET_TEST_20260929_01' THROW 51090,'CRM_TEST_DATABASE_REQUIRED',1;
 IF LEN(@crm_actor_id) NOT BETWEEN 1 AND 80 OR NOT EXISTS(SELECT 1 FROM dbo.users WHERE id=@actor_id AND is_active=1) THROW 51094,'CRM_TEST_SCOPE_REQUIRED',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.customers WHERE id=593 AND customer_code=N'TEST-V70-20260929-C' AND is_active=1 AND is_deleted=0) THROW 51094,'CRM_TEST_SCOPE_REQUIRED',1;
 SELECT id,customer_code AS code,name,currency_code AS currency FROM dbo.customers WHERE id=593;
 SELECT s.source_id AS sourceId,s.source_stock_code AS stockCode,s.source_product_name AS productName,s.currency,s.unit_price AS unitPrice,s.product_id AS erpProductId
 FROM dbo.test_crm_order_product_scope s JOIN dbo.products p ON p.id=s.product_id
 WHERE s.is_active=1 AND p.is_active=1 AND p.is_deleted=0 AND p.stock_code=s.native_stock_code AND p.name=s.native_product_name
 AND p.source_record_key=N'VEGA2026/F0102TBLSTOKLAR/'+SUBSTRING(s.source_id,6,50) AND p.currency_code=s.currency AND p.source_sales_currency=s.currency AND p.sales_price=s.unit_price ORDER BY s.source_id;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_test_crm_order_read @actor_id BIGINT,@crm_actor_id NVARCHAR(80),@request_id UNIQUEIDENTIFIER
AS
BEGIN
 SET NOCOUNT ON;
 IF DB_NAME()<>N'MELISA_ERP_SIRKET_TEST_20260929_01' THROW 51090,'CRM_TEST_DATABASE_REQUIRED',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.test_crm_order_requests r JOIN dbo.sales_orders o ON o.id=r.order_id JOIN dbo.customers c ON c.id=o.customer_id JOIN dbo.users u ON u.id=@actor_id
   WHERE r.request_id=@request_id AND r.actor_id=@actor_id AND r.crm_actor_id=@crm_actor_id AND r.conversation_id=N'55' AND r.peer=N'905387217733' AND o.status=N'draft' AND c.id=593 AND c.customer_code=N'TEST-V70-20260929-C' AND u.is_active=1) THROW 51096,'CRM_TEST_ORDER_NOT_FOUND',1;
 SELECT o.id,o.document_no AS documentNo,o.status,o.customer_id AS customerId,c.name AS customerName,o.document_currency AS documentCurrency,o.exchange_rate_snapshot AS exchangeRate,o.grand_total AS grandTotal,o.amount_try AS amountTry,r.payload_hash AS payloadHash
 FROM dbo.test_crm_order_requests r JOIN dbo.sales_orders o ON o.id=r.order_id JOIN dbo.customers c ON c.id=o.customer_id WHERE r.request_id=@request_id;
 SELECT l.source_id AS sourceId,l.source_stock_code AS stockCode,i.quantity,i.unit_price AS unitPrice,i.currency_code AS currency,i.line_total AS lineTotal
 FROM dbo.test_crm_order_request_lines l JOIN dbo.sales_order_items i ON i.id=l.item_id WHERE l.request_id=@request_id ORDER BY i.id;
END;
GO
CREATE OR ALTER PROCEDURE dbo.usp_test_crm_order_create
 @actor_id BIGINT,@crm_actor_id NVARCHAR(80),@request_id UNIQUEIDENTIFIER,@conversation_id NVARCHAR(20),@customer_id BIGINT,@exchange_rate DECIMAL(18,8),@items_json NVARCHAR(MAX),@payload_hash VARCHAR(64)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 IF DB_NAME()<>N'MELISA_ERP_SIRKET_TEST_20260929_01' THROW 51090,'CRM_TEST_DATABASE_REQUIRED',1;
 IF @conversation_id IS NULL OR @customer_id IS NULL OR @crm_actor_id IS NULL OR @payload_hash IS NULL OR @exchange_rate IS NULL OR @items_json IS NULL OR @conversation_id<>N'55' OR @customer_id<>593 OR @request_id IS NULL OR LEN(@crm_actor_id) NOT BETWEEN 1 AND 80 OR LEN(@payload_hash)<>64 OR @payload_hash LIKE '%[^0-9a-f]%' OR @exchange_rate<=0 OR @exchange_rate>10000 OR DATALENGTH(@items_json)>65536 OR ISJSON(@items_json)<>1 OR LEFT(LTRIM(@items_json),1)<>N'[' THROW 51091,'CRM_TEST_LINES_INVALID',1;
 DECLARE @lines TABLE(source_id NVARCHAR(50),stock_code NVARCHAR(120),quantity INT,unit_price DECIMAL(18,4),currency NVARCHAR(3),product_id BIGINT,product_name NVARCHAR(250),native_stock_code NVARCHAR(50));
 IF (SELECT COUNT(*) FROM OPENJSON(@items_json)) NOT BETWEEN 1 AND 50 THROW 51091,'CRM_TEST_LINES_INVALID',1;
 IF EXISTS(SELECT 1 FROM OPENJSON(@items_json) j WHERE j.type<>5 OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) WHERE [key]='quantity' AND [type]=2) OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) WHERE [key]='unitPrice' AND [type]=2)) THROW 51091,'CRM_TEST_LINES_INVALID',1;
 IF EXISTS(SELECT 1 FROM OPENJSON(@items_json) WITH(sourceId NVARCHAR(MAX),stockCode NVARCHAR(MAX),quantity NVARCHAR(MAX),unitPrice NVARCHAR(MAX),currency NVARCHAR(MAX)) j
  WHERE LEN(sourceId)>50 OR LEN(stockCode)>120 OR LEN(currency)<>3 OR TRY_CONVERT(INT,quantity) IS NULL OR TRY_CONVERT(DECIMAL(38,8),quantity) IS NULL OR TRY_CONVERT(DECIMAL(38,8),quantity)<>TRY_CONVERT(INT,quantity) OR TRY_CONVERT(DECIMAL(18,4),unitPrice) IS NULL OR TRY_CONVERT(DECIMAL(38,10),unitPrice) IS NULL OR TRY_CONVERT(DECIMAL(38,10),unitPrice)<>TRY_CONVERT(DECIMAL(18,4),unitPrice)) THROW 51091,'CRM_TEST_LINES_INVALID',1;
 INSERT @lines(source_id,stock_code,quantity,unit_price,currency) SELECT sourceId,stockCode,quantity,unitPrice,currency FROM OPENJSON(@items_json) WITH(sourceId NVARCHAR(50),stockCode NVARCHAR(120),quantity INT,unitPrice DECIMAL(18,4),currency NVARCHAR(3));
 IF EXISTS(SELECT 1 FROM @lines WHERE source_id IS NULL OR stock_code IS NULL OR quantity IS NULL OR quantity NOT BETWEEN 1 AND 9999 OR unit_price IS NULL OR unit_price<0 OR unit_price>1000000 OR currency IS NULL OR currency NOT IN(N'TRY',N'USD',N'EUR')) OR (SELECT COUNT(DISTINCT source_id) FROM @lines)<>(SELECT COUNT(*) FROM @lines) OR (SELECT COUNT(DISTINCT stock_code) FROM @lines)<>(SELECT COUNT(*) FROM @lines) OR (SELECT COUNT(DISTINCT currency) FROM @lines)<>1 THROW 51091,'CRM_TEST_LINES_INVALID',1;
 DECLARE @currency NVARCHAR(3)=(SELECT TOP(1) currency FROM @lines),@total DECIMAL(18,4)=(SELECT SUM(CAST(quantity AS DECIMAL(18,4))*unit_price) FROM @lines);
 IF (@currency=N'TRY' AND @exchange_rate<>1) OR @total>10000000000 OR @total*@exchange_rate>10000000000 THROW 51091,'CRM_TEST_LINES_INVALID',1;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @lock INT,@resource NVARCHAR(255)=N'TEST-CRM-ORDER-'+CONVERT(NVARCHAR(36),@request_id);
  EXEC @lock=sys.sp_getapplock @Resource=@resource,@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;
  IF @lock<0 THROW 51095,'CRM_TEST_LOCK_TIMEOUT',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.users WHERE id=@actor_id AND is_active=1) OR NOT EXISTS(SELECT 1 FROM dbo.customers WITH(UPDLOCK,HOLDLOCK) WHERE id=593 AND customer_code=N'TEST-V70-20260929-C' AND is_active=1 AND is_deleted=0) THROW 51094,'CRM_TEST_SCOPE_REQUIRED',1;
  IF EXISTS(SELECT 1 FROM dbo.test_crm_order_requests WHERE request_id=@request_id)
  BEGIN
   IF NOT EXISTS(SELECT 1 FROM dbo.test_crm_order_requests WHERE request_id=@request_id AND actor_id=@actor_id AND crm_actor_id=@crm_actor_id AND conversation_id=@conversation_id AND customer_id=@customer_id AND peer=N'905387217733' AND payload_hash=@payload_hash AND items_json=@items_json AND exchange_rate=@exchange_rate) THROW 51093,'CRM_TEST_REQUEST_CONFLICT',1;
   COMMIT;
   EXEC dbo.usp_test_crm_order_read @actor_id,@crm_actor_id,@request_id;
   RETURN;
  END;
  UPDATE l SET product_id=s.product_id,product_name=p.name,native_stock_code=p.stock_code FROM @lines l
  JOIN dbo.test_crm_order_product_scope s WITH(UPDLOCK,HOLDLOCK) ON s.source_id=l.source_id AND s.source_stock_code=l.stock_code AND s.unit_price=l.unit_price AND s.currency=l.currency AND s.is_active=1
  JOIN dbo.products p WITH(UPDLOCK,HOLDLOCK) ON p.id=s.product_id AND p.stock_code=s.native_stock_code AND p.name=s.native_product_name AND p.is_active=1 AND p.is_deleted=0
   AND p.source_record_key=N'VEGA2026/F0102TBLSTOKLAR/'+SUBSTRING(s.source_id,6,50) AND p.currency_code=s.currency AND p.source_sales_currency=s.currency AND p.sales_price=s.unit_price;
  IF EXISTS(SELECT 1 FROM @lines WHERE product_id IS NULL) THROW 51092,'CRM_TEST_PRODUCT_MAPPING_REQUIRED',1;
  DECLARE @order_id BIGINT,@document_no NVARCHAR(30)=N'CRM-'+LEFT(REPLACE(CONVERT(NVARCHAR(36),@request_id),N'-',N''),26);
  INSERT dbo.sales_orders(document_no,document_date,customer_id,status,customer_currency,document_currency,exchange_rate_snapshot,description,subtotal,discount_rate,discount_total,grand_total,amount_try,created_by)
  SELECT @document_no,CONVERT(DATE,SYSUTCDATETIME()),593,N'draft',currency_code,@currency,@exchange_rate,N'CRM TEST · konuşma 55 · '+@payload_hash,@total,0,0,@total,ROUND(@total*@exchange_rate,4),@actor_id FROM dbo.customers WHERE id=593;
  SET @order_id=SCOPE_IDENTITY();
  DECLARE @created TABLE(item_id BIGINT,product_id BIGINT);
  INSERT dbo.sales_order_items(sales_order_id,product_id,stock_code_snapshot,product_name_snapshot,quantity,currency_code,unit_price,line_total)
  OUTPUT inserted.id,inserted.product_id INTO @created
  SELECT @order_id,product_id,native_stock_code,product_name,quantity,currency,unit_price,quantity*unit_price FROM @lines;
  INSERT dbo.test_crm_order_requests(request_id,actor_id,crm_actor_id,conversation_id,peer,customer_id,payload_hash,items_json,exchange_rate,order_id) VALUES(@request_id,@actor_id,@crm_actor_id,N'55',N'905387217733',593,@payload_hash,@items_json,@exchange_rate,@order_id);
  INSERT dbo.test_crm_order_request_lines(request_id,item_id,source_id,source_stock_code) SELECT @request_id,c.item_id,l.source_id,l.stock_code FROM @created c JOIN @lines l ON l.product_id=c.product_id;
  DECLARE @audit_json NVARCHAR(MAX)=(SELECT CONVERT(NVARCHAR(36),@request_id) requestId,@crm_actor_id crmActorId,N'55' conversationId,N'905387217733' peer,@payload_hash payloadHash,@order_id orderId,@currency currency,@total grandTotal,CAST(0 AS BIT) stockEffect,CAST(0 AS BIT) ledgerEffect FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
  INSERT dbo.audit_logs(actor_user_id,action,entity_type,entity_id,after_json,reason,source) VALUES(@actor_id,N'sales_order_created',N'sales_order',@order_id,@audit_json,N'CRM TEST draft only; verified CRM actor '+@crm_actor_id,N'crm-test');
  COMMIT;
  EXEC dbo.usp_test_crm_order_read @actor_id,@crm_actor_id,@request_id;
 END TRY
 BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK;
  THROW;
 END CATCH;
END;
GO
IF DB_NAME()<>N'MELISA_ERP_SIRKET_TEST_20260929_01' THROW 51090,'CRM_TEST_DATABASE_REQUIRED',1;
-- Only EXECUTE on the three bounded procedures. No native-table DML grants.
GRANT EXECUTE ON dbo.usp_test_crm_order_context TO [melisa_sirket_sales_test_20260929_01];
GRANT EXECUTE ON dbo.usp_test_crm_order_read TO [melisa_sirket_sales_test_20260929_01];
GRANT EXECUTE ON dbo.usp_test_crm_order_create TO [melisa_sirket_sales_test_20260929_01];
DENY INSERT,UPDATE,DELETE ON dbo.test_crm_order_product_scope TO [melisa_sirket_sales_test_20260929_01];
DENY INSERT,UPDATE,DELETE ON dbo.test_crm_order_requests TO [melisa_sirket_sales_test_20260929_01];
DENY INSERT,UPDATE,DELETE ON dbo.test_crm_order_request_lines TO [melisa_sirket_sales_test_20260929_01];
