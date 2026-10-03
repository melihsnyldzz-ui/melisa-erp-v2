-- Only the existing isolated TEST fixture; no table/schema or commercial rows change.
SET XACT_ABORT ON;
IF DB_NAME() <> N'MELISA_ERP_SIRKET_TEST_20260929_01'
  THROW 51070, 'WRONG_TEST_DATABASE', 1;
IF CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) <> N'Semih\MELISADEV'
  THROW 51070, 'WRONG_TEST_SERVER', 1;
BEGIN TRANSACTION;
DECLARE @extensions TABLE(name sysname, body nvarchar(max));
INSERT @extensions VALUES
(N'test_guard_daily_returns', N'
/* CANONICAL_LINKED_PURCHASE_RETURN_20261003 */
IF EXISTS(SELECT 1 FROM inserted) AND NOT EXISTS(
 SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id=d.id
 WHERE i.id IS NULL OR i.status<>N''cancelled'' OR d.status<>N''finalized''
 OR EXISTS(SELECT i.kind,i.source_purchase_invoice_id,i.source_sales_invoice_id,
 i.supplier_id,i.customer_id,i.document_date,i.document_currency,i.exchange_rate_snapshot,
 i.amount,i.account_currency,i.account_exchange_rate_snapshot,i.account_amount,i.amount_try,
 i.reason,i.payload_hash,i.plan_json,i.created_by,i.request_id
 EXCEPT SELECT d.kind,d.source_purchase_invoice_id,d.source_sales_invoice_id,
 d.supplier_id,d.customer_id,d.document_date,d.document_currency,d.exchange_rate_snapshot,
 d.amount,d.account_currency,d.account_exchange_rate_snapshot,d.account_amount,d.amount_try,
 d.reason,d.payload_hash,d.plan_json,d.created_by,d.request_id)) AND NOT EXISTS(
 SELECT 1 FROM inserted i WHERE i.kind IS NULL OR i.kind<>N''purchase'' OR i.created_by IS NULL OR i.created_by NOT IN(1,16)
 OR i.status IS NULL OR i.document_currency IS NULL OR i.account_currency IS NULL
 OR i.amount IS NULL OR i.account_amount IS NULL OR i.amount_try IS NULL
 OR i.exchange_rate_snapshot IS NULL OR i.account_exchange_rate_snapshot IS NULL
 OR i.status NOT IN(N''finalized'',N''cancelled'') OR i.document_currency<>N''TRY''
 OR i.account_currency<>N''TRY'' OR i.amount<=0 OR i.amount>300
 OR i.exchange_rate_snapshot<>1 OR i.account_exchange_rate_snapshot<>1
 OR i.amount<>i.account_amount OR i.amount<>i.amount_try
 OR NOT EXISTS(SELECT 1 FROM dbo.test_purchase_links l
 JOIN dbo.test_goods_receipts g ON g.id=l.goods_id
 JOIN dbo.test_purchase_scope t ON t.id=1
 JOIN dbo.purchase_invoices p ON p.id=l.invoice_id
 WHERE p.id=i.source_purchase_invoice_id AND p.supplier_id=t.supplier_id
 AND i.supplier_id=t.supplier_id AND g.supplier_id=t.supplier_id
 AND g.product_id=t.product_id AND g.state=N''accepted''
 AND p.document_no LIKE N''TSTG-%'' AND p.document_currency=N''TRY''
 AND i.amount<=p.grand_total
 AND (p.status=N''finalized'' OR (i.status=N''cancelled'' AND EXISTS(
 SELECT 1 FROM deleted d WHERE d.id=i.id AND d.source_purchase_invoice_id=i.source_purchase_invoice_id))))) RETURN;
'),
(N'test_guard_stock_movements', N'
/* CANONICAL_LINKED_PURCHASE_RETURN_20261003 */
IF EXISTS(SELECT 1 FROM inserted) AND NOT EXISTS(SELECT 1 FROM deleted)
 AND NOT EXISTS(SELECT 1 FROM inserted i WHERE i.created_by IS NULL OR i.created_by NOT IN(1,16)
 OR i.source_type NOT IN(N''invoice_return'',N''invoice_return_cancel'')
 OR NOT EXISTS(SELECT 1 FROM dbo.invoice_returns r
 JOIN dbo.invoice_return_items ri ON ri.invoice_return_id=r.id
 JOIN dbo.test_purchase_links l ON l.invoice_id=r.source_purchase_invoice_id
 JOIN dbo.test_goods_receipts g ON g.id=l.goods_id
 JOIN dbo.test_purchase_scope t ON t.id=1
 JOIN dbo.purchase_invoices p ON p.id=l.invoice_id
 WHERE r.id=i.source_id AND r.kind=N''purchase'' AND r.status=N''finalized''
 AND r.supplier_id=t.supplier_id AND p.supplier_id=t.supplier_id
 AND g.state=N''accepted'' AND g.product_id=t.product_id AND g.supplier_id=t.supplier_id
 AND p.document_no LIKE N''TSTG-%'' AND ri.product_id=t.product_id
 AND i.product_id=ri.product_id AND i.supplier_id=r.supplier_id
 AND i.currency_code=N''TRY'' AND i.unit_cost_try=ri.unit_cost_try AND ri.unit_cost_try=60
 AND ri.quantity>0 AND ri.quantity<=5
 AND ((i.source_type=N''invoice_return'' AND p.status=N''finalized''
 AND i.quantity_net=-ri.quantity AND i.quantity_out=ri.quantity AND i.quantity_in=0 AND i.amount_try=-ri.amount_try)
 OR (i.source_type=N''invoice_return_cancel'' AND i.quantity_net=ri.quantity
 AND i.quantity_in=ri.quantity AND i.quantity_out=0 AND i.amount_try=ri.amount_try)))) RETURN;
'),
(N'test_guard_supplier_movements', N'
/* CANONICAL_LINKED_PURCHASE_RETURN_20261003 */
IF EXISTS(SELECT 1 FROM inserted) AND NOT EXISTS(SELECT 1 FROM deleted)
 AND NOT EXISTS(SELECT 1 FROM inserted i WHERE i.created_by IS NULL OR i.created_by NOT IN(1,16)
 OR i.movement_type NOT IN(N''purchase_return'',N''purchase_return_cancel'')
 OR NOT EXISTS(SELECT 1 FROM dbo.invoice_returns r
 JOIN dbo.test_purchase_links l ON l.invoice_id=r.source_purchase_invoice_id
 JOIN dbo.test_goods_receipts g ON g.id=l.goods_id
 JOIN dbo.test_purchase_scope t ON t.id=1
 JOIN dbo.purchase_invoices p ON p.id=l.invoice_id
 WHERE r.id=i.invoice_return_id AND r.kind=N''purchase'' AND r.status=N''finalized''
 AND r.supplier_id=t.supplier_id AND i.supplier_id=t.supplier_id
 AND g.state=N''accepted'' AND g.product_id=t.product_id AND g.supplier_id=t.supplier_id
 AND p.supplier_id=t.supplier_id AND p.document_no LIKE N''TSTG-%''
 AND i.currency_code=N''TRY'' AND i.account_currency=N''TRY''
 AND i.amount=r.amount AND i.account_amount=r.account_amount AND i.amount_try=r.amount_try
 AND i.document_exchange_rate_snapshot=r.exchange_rate_snapshot
 AND i.account_exchange_rate_snapshot=r.account_exchange_rate_snapshot
 AND ((i.movement_type=N''purchase_return'' AND p.status=N''finalized'' AND i.balance_effect=-r.account_amount)
 OR (i.movement_type=N''purchase_return_cancel'' AND i.balance_effect=r.account_amount)))) RETURN;
'),
(N'test_guard_audit_logs', N'
/* CANONICAL_LINKED_PURCHASE_RETURN_20261003 */
IF EXISTS(SELECT 1 FROM inserted) AND NOT EXISTS(SELECT 1 FROM deleted)
 AND NOT EXISTS(SELECT 1 FROM inserted i WHERE i.actor_user_id IS NULL
 OR i.actor_user_id NOT IN(1,16) OR i.entity_type IS NULL OR i.entity_type<>N''invoice_return''
 OR NOT EXISTS(SELECT 1 FROM dbo.invoice_returns r
 JOIN dbo.test_purchase_links l ON l.invoice_id=r.source_purchase_invoice_id
 JOIN dbo.test_goods_receipts g ON g.id=l.goods_id
 JOIN dbo.test_purchase_scope t ON t.id=1
 JOIN dbo.purchase_invoices p ON p.id=l.invoice_id
 WHERE r.id=i.entity_id AND r.kind=N''purchase'' AND r.supplier_id=t.supplier_id
 AND g.state=N''accepted'' AND g.product_id=t.product_id AND g.supplier_id=t.supplier_id
 AND p.supplier_id=t.supplier_id AND p.document_no LIKE N''TSTG-%''
 AND r.status IN(N''finalized'',N''cancelled''))) RETURN;
');
DECLARE @name sysname,@body nvarchar(max),@definition nvarchar(max),@anchor nvarchar(200);
DECLARE guards CURSOR LOCAL FAST_FORWARD FOR SELECT name,body FROM @extensions;
OPEN guards;
FETCH NEXT FROM guards INTO @name,@body;
WHILE @@FETCH_STATUS=0
BEGIN
 SET @definition=OBJECT_DEFINITION(OBJECT_ID(N'dbo.'+@name));
 SET @definition=REPLACE(@definition,N'CREATE   TRIGGER',N'CREATE TRIGGER');
 SET @anchor=N'CREATE TRIGGER dbo.'+@name;
 IF @definition IS NULL OR (LEFT(@definition,LEN(@anchor))<>@anchor
 AND LEFT(@definition,LEN(@anchor)-1)<>N'ALTER TRIGGER dbo.'+@name)
   THROW 51070, 'UNKNOWN_TEST_GUARD_DEFINITION', 1;
 IF CHARINDEX(N'CANONICAL_LINKED_PURCHASE_RETURN_20261003',@definition)=0
 BEGIN
  IF CHARINDEX(N' AS BEGIN ',@definition)=0 THROW 51070, 'UNKNOWN_TEST_GUARD_BODY', 1;
  SET @definition=STUFF(@definition,1,6,N'ALTER');
  SET @definition=STUFF(@definition,CHARINDEX(N' AS BEGIN ',@definition)+10,0,@body);
  EXEC sys.sp_executesql @definition;
 END;
 FETCH NEXT FROM guards INTO @name,@body;
END;
CLOSE guards;
DEALLOCATE guards;
COMMIT;
SELECT name,is_disabled FROM sys.triggers WHERE name IN(
 N'test_guard_daily_returns',N'test_guard_stock_movements',N'test_guard_supplier_movements',N'test_guard_audit_logs');
