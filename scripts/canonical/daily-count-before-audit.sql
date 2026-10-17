CREATE TRIGGER dbo.test_guard_audit_logs ON dbo.audit_logs AFTER INSERT,UPDATE,DELETE AS BEGIN
/* ERP-NIGHT-20261006: exact synthetic branch; every legacy body character is retained. */
IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) COLLATE Latin1_General_100_BIN2<>N'Semih\MELISADEV' THROW 51106,'WRONG_WORK_NIGHT_TARGET',1;
IF EXISTS(SELECT 1 FROM inserted i WHERE (i.entity_type=N'sales_invoice' AND EXISTS(SELECT 1 FROM dbo.sales_invoices v JOIN dbo.work_trade_scope s ON s.customer_id=v.customer_id WHERE v.id=i.entity_id)) OR (i.entity_type=N'customer_movement' AND EXISTS(SELECT 1 FROM dbo.customer_movements m JOIN dbo.work_trade_scope s ON s.customer_id=m.customer_id WHERE m.id=i.entity_id))) OR EXISTS(SELECT 1 FROM deleted d WHERE (d.entity_type=N'sales_invoice' AND EXISTS(SELECT 1 FROM dbo.sales_invoices v JOIN dbo.work_trade_scope s ON s.customer_id=v.customer_id WHERE v.id=d.entity_id)) OR (d.entity_type=N'customer_movement' AND EXISTS(SELECT 1 FROM dbo.customer_movements m JOIN dbo.work_trade_scope s ON s.customer_id=m.customer_id WHERE m.id=d.entity_id))) BEGIN
IF EXISTS(SELECT 1 FROM inserted i WHERE NOT((i.entity_type=N'sales_invoice' AND EXISTS(SELECT 1 FROM dbo.sales_invoices v JOIN dbo.work_trade_scope s ON s.customer_id=v.customer_id WHERE v.id=i.entity_id)) OR (i.entity_type=N'customer_movement' AND EXISTS(SELECT 1 FROM dbo.customer_movements m JOIN dbo.work_trade_scope s ON s.customer_id=m.customer_id WHERE m.id=i.entity_id)))) OR EXISTS(SELECT 1 FROM deleted d WHERE NOT((d.entity_type=N'sales_invoice' AND EXISTS(SELECT 1 FROM dbo.sales_invoices v JOIN dbo.work_trade_scope s ON s.customer_id=v.customer_id WHERE v.id=d.entity_id)) OR (d.entity_type=N'customer_movement' AND EXISTS(SELECT 1 FROM dbo.customer_movements m JOIN dbo.work_trade_scope s ON s.customer_id=m.customer_id WHERE m.id=d.entity_id)))) THROW 51106,'WORK_NIGHT_SCOPE_REQUIRED',1;
EXEC dbo.work_trade_assert_ready;
 IF NOT(EXISTS(SELECT 1 FROM dbo.work_trade_intents n WHERE n.session_id=@@SPID AND n.actor_id IN(15,16) AND ISJSON(n.payload_json)=1 AND JSON_VALUE(n.payload_json,'$.actorId')=CONVERT(varchar(20),n.actor_id) AND JSON_VALUE(n.payload_json,'$.operation')=n.operation AND NOT EXISTS(SELECT 1 FROM dbo.work_trade_requests r WHERE r.request_id=n.request_id))) OR EXISTS(SELECT 1 FROM deleted) OR EXISTS(SELECT 1 FROM inserted i WHERE NOT(EXISTS(SELECT 1 FROM dbo.work_trade_intents n WHERE n.session_id=@@SPID AND i.actor_user_id=n.actor_id AND i.action IN(N'sales_invoice_draft_created',N'sales_profit_snapshot_created',N'sales_invoice_finalized',N'sales_invoice_cancelled',N'work_sales_draft_cancelled',N'customer_collection_created',N'collection_cancel') AND i.source=N'web-admin'))) THROW 51106,'WORK_NIGHT_SCOPE_REQUIRED',1;
RETURN; END;

/* TEST_PURCHASE_BATCH_20261004: exact rows only; all other rows use preserved original body. */
IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) COLLATE Latin1_General_100_BIN2<>N'Semih\MELISADEV' THROW 51070,'WRONG_TEST_BATCH_TARGET',1;
IF NOT EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_manifest WHERE run_id=N'VEGA-OPENING-TEST-20261004-06' AND sealed=1 AND seal_hash='69ff490f2938e34aa2f10399a5cf7b8042950667780779a15d708188c4b90de7' AND source_rows=176 AND native_holds=172 AND not_present=4)
 OR (SELECT COUNT(*) FROM sys.triggers WHERE name LIKE N'operation[_]quarantine[_]%' AND is_disabled=0 AND OBJECTPROPERTY(object_id,'ExecIsFirstInsertTrigger')=1 AND OBJECTPROPERTY(object_id,'ExecIsFirstUpdateTrigger')=1 AND OBJECTPROPERTY(object_id,'ExecIsFirstDeleteTrigger')=1)<>37 THROW 51070,'TEST_BATCH_QUARANTINE_NOT_READY',1;
SELECT i.* INTO #batch_exact_inserted FROM inserted i WHERE i.actor_user_id IN(15,16) AND NOT EXISTS(SELECT 1 FROM deleted) AND ISJSON(i.after_json)=1 AND ((i.entity_type=N'test_goods_batch' AND i.action IN(N'test_batch_counted',N'test_batch_approved',N'test_batch_rejected') AND EXISTS(SELECT 1 FROM dbo.test_goods_batches b WHERE b.id=i.entity_id AND b.supplier_id=(SELECT supplier_id FROM dbo.test_purchase_scope WHERE id=1) AND ((i.action=N'test_batch_counted' AND b.created_by=i.actor_user_id AND b.state=N'pending') OR (i.action=N'test_batch_approved' AND i.actor_user_id=16 AND b.state=N'accepted') OR (i.action=N'test_batch_rejected' AND i.actor_user_id=16 AND b.state=N'rejected')))) OR (i.entity_type=N'purchase_invoice' AND i.actor_user_id=16 AND i.action IN(N'purchase_invoice_draft_created',N'purchase_invoice_finalized',N'purchase_invoice_cancelled',N'test_batch_purchase_draft_cancelled') AND EXISTS(SELECT 1 FROM dbo.purchase_invoices p JOIN dbo.test_purchase_batch_drafts t ON t.document_no=p.document_no WHERE p.id=i.entity_id AND (t.invoice_id IS NULL OR t.invoice_id=p.id) AND ((i.action=N'purchase_invoice_draft_created' AND p.status=N'draft' AND t.state=N'registered') OR (i.action=N'purchase_invoice_finalized' AND p.status=N'finalized' AND t.state=N'linked') OR (i.action IN(N'purchase_invoice_cancelled',N'test_batch_purchase_draft_cancelled') AND p.status=N'cancelled' AND t.state=N'linked')))));
IF EXISTS(SELECT 1 FROM inserted i WHERE (i.entity_type=N'test_goods_batch' OR (i.entity_type=N'purchase_invoice' AND EXISTS(SELECT 1 FROM dbo.test_purchase_batch_drafts t JOIN dbo.purchase_invoices p ON p.document_no=t.document_no WHERE p.id=i.entity_id))) AND NOT EXISTS(SELECT 1 FROM #batch_exact_inserted e WHERE e.id=i.id)) THROW 51070,'TEST_BATCH_EXACT_SCOPE_REQUIRED',1;
IF EXISTS(SELECT 1 FROM deleted d WHERE (d.entity_type=N'test_goods_batch' OR (d.entity_type=N'purchase_invoice' AND EXISTS(SELECT 1 FROM dbo.test_purchase_batch_drafts t JOIN dbo.purchase_invoices p ON p.document_no=t.document_no WHERE p.id=d.entity_id))) AND NOT (1=0)) THROW 51070,'TEST_BATCH_EXACT_SCOPE_REQUIRED',1;
SELECT i.* INTO #batch_legacy_inserted FROM inserted i WHERE NOT EXISTS(SELECT 1 FROM #batch_exact_inserted e WHERE e.id=i.id);
SELECT d.* INTO #batch_legacy_deleted FROM deleted d WHERE NOT (1=0);
IF NOT EXISTS(SELECT 1 FROM #batch_legacy_inserted) AND NOT EXISTS(SELECT 1 FROM #batch_legacy_deleted) RETURN;


/* CRM_DRAFT_AUDIT_20261004 */
IF DB_NAME()=N'MELISA_ERP_SIRKET_TEST_20260929_01' AND EXISTS(SELECT 1 FROM #batch_legacy_inserted) AND NOT EXISTS(SELECT 1 FROM #batch_legacy_deleted)
 AND NOT EXISTS(SELECT 1 FROM #batch_legacy_inserted i WHERE
 i.action IS NULL OR i.action<>N'sales_order_created' OR i.entity_type IS NULL OR i.entity_type<>N'sales_order'
 OR i.source IS NULL OR i.source<>N'crm-test' OR i.before_json IS NOT NULL
 OR ISJSON(i.after_json)<>1 OR i.after_json IS NULL
 OR NOT EXISTS(SELECT 1 FROM dbo.test_crm_order_requests r
 JOIN dbo.sales_orders o ON o.id=r.order_id JOIN dbo.users u ON u.id=r.actor_id
 JOIN dbo.customers c ON c.id=o.customer_id
 WHERE r.order_id=i.entity_id AND r.actor_id=i.actor_user_id AND u.is_active=1
 AND r.customer_id=593 AND c.id=593 AND c.customer_code=N'TEST-V70-20260929-C' AND c.is_active=1 AND c.is_deleted=0
 AND r.conversation_id=N'55' AND r.peer=N'905387217733' AND o.status=N'draft'
 AND i.reason=N'CRM TEST draft only; verified CRM actor '+r.crm_actor_id
 AND ISJSON(i.after_json)=1
 AND JSON_VALUE(i.after_json,'$.requestId')=CONVERT(NVARCHAR(36),r.request_id)
 AND JSON_VALUE(i.after_json,'$.crmActorId')=r.crm_actor_id
 AND JSON_VALUE(i.after_json,'$.conversationId')=N'55' AND JSON_VALUE(i.after_json,'$.peer')=r.peer
 AND JSON_VALUE(i.after_json,'$.payloadHash')=r.payload_hash
 AND TRY_CONVERT(BIGINT,JSON_VALUE(i.after_json,'$.orderId'))=r.order_id
 AND JSON_VALUE(i.after_json,'$.currency')=o.document_currency
 AND TRY_CONVERT(DECIMAL(18,4),JSON_VALUE(i.after_json,'$.grandTotal'))=o.grand_total
 AND JSON_VALUE(i.after_json,'$.stockEffect')=N'false' AND JSON_VALUE(i.after_json,'$.ledgerEffect')=N'false'
 AND EXISTS(SELECT 1 FROM OPENJSON(i.after_json) WHERE [key]=N'stockEffect' AND [type]=3 AND [value]=N'false')
 AND EXISTS(SELECT 1 FROM OPENJSON(i.after_json) WHERE [key]=N'ledgerEffect' AND [type]=3 AND [value]=N'false')
 AND NOT EXISTS(SELECT 1 FROM dbo.audit_logs a WHERE a.entity_type=N'sales_order' AND a.entity_id=r.order_id AND a.source=N'crm-test' AND a.id<>i.id)
 AND (SELECT COUNT(*) FROM #batch_legacy_inserted x WHERE x.entity_id=i.entity_id)=1)) RETURN;
 
/* CANONICAL_LINKED_PURCHASE_RETURN_20261003 */
IF EXISTS(SELECT 1 FROM #batch_legacy_inserted) AND NOT EXISTS(SELECT 1 FROM #batch_legacy_deleted)
 AND NOT EXISTS(SELECT 1 FROM #batch_legacy_inserted i WHERE i.actor_user_id IS NULL
 OR i.actor_user_id NOT IN(1,16) OR i.entity_type IS NULL OR i.entity_type<>N'invoice_return'
 OR NOT EXISTS(SELECT 1 FROM dbo.invoice_returns r
 JOIN dbo.test_purchase_links l ON l.invoice_id=r.source_purchase_invoice_id
 JOIN dbo.test_goods_receipts g ON g.id=l.goods_id
 JOIN dbo.test_purchase_scope t ON t.id=1
 JOIN dbo.purchase_invoices p ON p.id=l.invoice_id
 WHERE r.id=i.entity_id AND r.kind=N'purchase' AND r.supplier_id=t.supplier_id
 AND g.state=N'accepted' AND g.product_id=t.product_id AND g.supplier_id=t.supplier_id
 AND p.supplier_id=t.supplier_id AND p.document_no LIKE N'TSTG-%'
 AND r.status IN(N'finalized',N'cancelled'))) RETURN;
IF (EXISTS(SELECT 1 FROM #batch_legacy_inserted) AND NOT EXISTS(SELECT 1 FROM #batch_legacy_deleted) AND NOT EXISTS(SELECT 1 FROM #batch_legacy_inserted i WHERE actor_user_id<>16 OR actor_user_id IS NULL OR entity_type<>N'supplier_movement' OR NOT EXISTS(SELECT 1 FROM dbo.supplier_movements m JOIN dbo.test_refund_scope s ON s.supplier_id=m.supplier_id WHERE m.id=i.entity_id))) RETURN;  IF (EXISTS(SELECT 1 FROM #batch_legacy_inserted) AND NOT EXISTS(SELECT 1 FROM #batch_legacy_deleted) AND NOT EXISTS(SELECT 1 FROM #batch_legacy_inserted i WHERE actor_user_id NOT IN(15,16) OR actor_user_id IS NULL OR NOT((entity_type=N'test_daily_draft' AND EXISTS(SELECT 1 FROM dbo.test_daily_drafts d WHERE d.id=i.entity_id)) OR(entity_type=N'product' AND EXISTS(SELECT 1 FROM dbo.test_daily_scope s WHERE s.product_id=i.entity_id)) OR(entity_type=N'invoice_return' AND EXISTS(SELECT 1 FROM dbo.invoice_returns r JOIN dbo.test_daily_scope s ON s.customer_id=r.customer_id OR s.supplier_id=r.supplier_id WHERE r.id=i.entity_id)) OR(entity_type=N'sales_invoice' AND EXISTS(SELECT 1 FROM dbo.sales_invoices r JOIN dbo.test_daily_scope s ON s.customer_id=r.customer_id WHERE r.id=i.entity_id)) OR(entity_type=N'purchase_invoice' AND EXISTS(SELECT 1 FROM dbo.purchase_invoices r JOIN dbo.test_daily_scope s ON s.supplier_id=r.supplier_id WHERE r.id=i.entity_id)) OR(entity_type=N'customer_movement' AND EXISTS(SELECT 1 FROM dbo.customer_movements r JOIN dbo.test_daily_scope s ON s.customer_id=r.customer_id WHERE r.id=i.entity_id)) OR(entity_type=N'supplier_movement' AND EXISTS(SELECT 1 FROM dbo.supplier_movements r JOIN dbo.test_daily_scope s ON s.supplier_id=r.supplier_id WHERE r.id=i.entity_id))))) RETURN;  IF (EXISTS(SELECT 1 FROM #batch_legacy_inserted) AND NOT EXISTS(SELECT 1 FROM #batch_legacy_deleted) AND NOT EXISTS(SELECT 1 FROM #batch_legacy_inserted i WHERE actor_user_id<>16 OR actor_user_id IS NULL OR entity_type<>N'supplier_movement' OR NOT EXISTS(SELECT 1 FROM dbo.supplier_movements m JOIN dbo.test_payment_suppliers s ON s.supplier_id=m.supplier_id WHERE m.id=i.entity_id))) RETURN;  IF (EXISTS(SELECT 1 FROM #batch_legacy_inserted) AND NOT EXISTS(SELECT 1 FROM #batch_legacy_inserted i WHERE actor_user_id NOT IN(SELECT seller_id FROM dbo.test_sales_scope UNION ALL SELECT ilker_id FROM dbo.test_sales_scope) OR actor_user_id IS NULL OR NOT((entity_type=N'test_goods_receipt' AND EXISTS(SELECT 1 FROM dbo.test_goods_receipts g WHERE g.id=i.entity_id)) OR(entity_type=N'purchase_invoice' AND EXISTS(SELECT 1 FROM dbo.purchase_invoices p WHERE p.id=i.entity_id AND p.supplier_id=(SELECT supplier_id FROM dbo.test_purchase_scope)))))) RETURN;
 IF EXISTS(SELECT 1 FROM #batch_legacy_inserted i WHERE NOT(
 ((actor_user_id=(SELECT seller_id FROM dbo.test_sales_scope) OR (actor_user_id=1 AND EXISTS(SELECT 1 FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id WHERE u.id=1 AND u.is_active=1 AND r.code=N'admin'))) AND entity_type=N'sales_invoice' AND EXISTS(SELECT 1 FROM dbo.sales_invoices s WHERE s.id=i.entity_id AND s.document_no LIKE N'TST70-%' AND s.customer_id=(SELECT customer_id FROM dbo.test_sales_scope))) OR
 (actor_user_id=(SELECT ilker_id FROM dbo.test_sales_scope) AND entity_type=N'customer_movement' AND EXISTS(SELECT 1 FROM dbo.customer_movements m WHERE m.id=i.entity_id AND m.customer_id=(SELECT customer_id FROM dbo.test_sales_scope)))) OR actor_user_id IS NULL) THROW 51070,'TEST_FIXTURE_SCOPE_REQUIRED',1;
END;
