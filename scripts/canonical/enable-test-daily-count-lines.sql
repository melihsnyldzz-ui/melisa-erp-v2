-- Goal3 normal batch count: exact saved TEST draft, no new user/role/permission.
-- Default PREPARE mode reads definitions and emits planned hashes only.
-- Root executes APPLY only after capturing outside-repo before definitions/data.
-- The three legacy trigger bodies are preserved byte for byte after an exact prefix.
SET XACT_ABORT ON; SET NOCOUNT ON;
DECLARE @Apply bit=0;
IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_SIRKET_TEST_20260929_01'
 OR CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) COLLATE Latin1_General_100_BIN2<>N'Semih\MELISADEV'
 OR IS_SRVROLEMEMBER(N'sysadmin')<>1 THROW 51240,'DAILY_COUNT_INSTALL_TARGET',1;

DECLARE @plan TABLE(name sysname PRIMARY KEY,before_hash varchar(64),before_definition nvarchar(max),after_definition nvarchar(max),after_hash varchar(64));
INSERT @plan(name,before_hash) VALUES
(N'test_guard_products','6962769EA4567178D107BE4B416ADF0ED716CCCFB194F0C2781A0F535AE770C9'),
(N'test_guard_stock_movements','FCC05C512C27C40C028BE9912F6442EC3101D76F1A9A1148CEE4A5398EDACC63'),
(N'test_guard_audit_logs','E9FC039F081E2B824440CBAE2302B53FCDF75B6F5A405161885AAC341640853E'),
(N'usp_work_supplier_payment_ready','2A09FF6DBF22AE46C55842B44BD51F6E4F350FEA9E145EEECE5975DB4301DCA3');
IF OBJECT_ID(N'dbo.test_daily_count_lines_guard_manifest',N'U') IS NOT NULL
BEGIN
 IF (SELECT COUNT(*) FROM dbo.test_daily_count_lines_guard_manifest)<>5 OR EXISTS(
 SELECT 1 FROM dbo.test_daily_count_lines_guard_manifest m LEFT JOIN sys.objects o ON o.object_id=OBJECT_ID(N'dbo.'+m.name)
 WHERE o.object_id IS NULL OR m.after_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(o.object_id)),2)
 OR (o.type=N'TR' AND OBJECTPROPERTY(o.object_id,'ExecIsTriggerDisabled')<>0))
 THROW 51240,'DAILY_COUNT_INSTALLED_DRIFT',1;
 EXEC dbo.work_trade_assert_ready; EXEC dbo.usp_work_supplier_payment_ready;
 SELECT name,before_hash,after_hash,N'already-installed' mode FROM dbo.test_daily_count_lines_guard_manifest ORDER BY name; RETURN;
END;
IF OBJECT_ID(N'dbo.fn_test_daily_count_fingerprint') IS NOT NULL THROW 51240,'DAILY_COUNT_PARTIAL_INSTALL',1;
UPDATE @plan SET before_definition=OBJECT_DEFINITION(OBJECT_ID(N'dbo.'+name));
IF EXISTS(SELECT 1 FROM @plan WHERE before_definition IS NULL OR before_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',before_definition),2))
 THROW 51240,'DAILY_COUNT_BASELINE_DRIFT',1;
IF EXISTS(SELECT 1 FROM @plan WHERE name LIKE N'test[_]guard[_]%' AND OBJECTPROPERTY(OBJECT_ID(N'dbo.'+name),'ExecIsTriggerDisabled')<>0)
 THROW 51240,'DAILY_COUNT_BASELINE_DISABLED',1;
EXEC dbo.work_trade_assert_ready; EXEC dbo.usp_work_supplier_payment_ready;

DECLARE @fields_i nvarchar(max),@fields_d nvarchar(max),@prefix nvarchar(max),@definition nvarchar(max),@name sysname,@begin int;
SELECT @fields_i=STRING_AGG(CONVERT(nvarchar(max),N'CONVERT(varbinary(max),i.'+QUOTENAME(name)+N')'),N',') WITHIN GROUP(ORDER BY column_id),
 @fields_d=STRING_AGG(CONVERT(nvarchar(max),N'CONVERT(varbinary(max),d.'+QUOTENAME(name)+N')'),N',') WITHIN GROUP(ORDER BY column_id)
FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.products') AND system_type_id<>189 AND name NOT IN(N'current_stock_qty',N'updated_at');
DECLARE @prefixes TABLE(name sysname PRIMARY KEY,body nvarchar(max));
INSERT @prefixes VALUES
(N'test_guard_products',REPLACE(REPLACE(CAST(N'
/* TEST_DAILY_COUNT_LINES_20261006: saved two-product count only; legacy body follows unchanged. */
IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N''MELISA_ERP_SIRKET_TEST_20260929_01''
 OR CAST(SERVERPROPERTY(''ServerName'') AS nvarchar(128)) COLLATE Latin1_General_100_BIN2<>N''Semih\MELISADEV'' THROW 51240,''DAILY_COUNT_TARGET'',1;
DECLARE @dcLines TABLE(draft_id bigint,product_id bigint,stock_code nvarchar(50),physical decimal(18,3),system decimal(18,3),reason nvarchar(500),fingerprint varchar(64),document_date date,unit_cost decimal(18,4),PRIMARY KEY(draft_id,product_id));
INSERT @dcLines
SELECT d.id,l.productId,l.stockCode,l.physical,l.system,l.reason,l.fingerprint,TRY_CONVERT(date,JSON_VALUE(d.payload_json,''$.date'')),s.unit_cost
FROM dbo.test_daily_drafts d
CROSS APPLY OPENJSON(d.payload_json,''$.lines'') WITH(productId bigint,stockCode nvarchar(50),physical decimal(18,3),system decimal(18,3),reason nvarchar(500),fingerprint varchar(64)) l
JOIN dbo.test_purchase_batch_scope s ON s.product_id=l.productId
JOIN dbo.products p ON p.id=s.product_id
WHERE d.flow=N''count'' AND d.kind=N''count'' AND d.state=N''pending'' AND d.created_by IN(15,16) AND d.decided_by IS NULL
AND d.id=TRY_CONVERT(bigint,SESSION_CONTEXT(N''melisa_test_count_draft_id'')) AND TRY_CONVERT(bigint,SESSION_CONTEXT(N''melisa_test_count_actor_id''))=16
AND TRY_CONVERT(bigint,SESSION_CONTEXT(N''melisa_test_count_transaction_id''))=CURRENT_TRANSACTION_ID()
AND ISJSON(d.payload_json)=1 AND (SELECT COUNT(*) FROM OPENJSON(d.payload_json))=5
AND NOT EXISTS(SELECT 1 FROM OPENJSON(d.payload_json) k WHERE k.[key] COLLATE Latin1_General_100_BIN2 NOT IN(N''lines'',N''unknownScans'',N''date'',N''unit'',N''warehouse''))
AND JSON_QUERY(d.payload_json,''$.unknownScans'')=N''[]'' AND JSON_VALUE(d.payload_json,''$.unit'')=N''ADET''
AND JSON_VALUE(d.payload_json,''$.warehouse'')=N''TEST-DAILY-WH'' AND JSON_VALUE(d.payload_json,''$.date'')=N''2026-10-06''
AND (SELECT COUNT(*) FROM OPENJSON(d.payload_json,''$.lines'')) BETWEEN 1 AND 2
AND NOT EXISTS(SELECT 1 FROM OPENJSON(d.payload_json,''$.lines'') j WHERE j.type<>5 OR (SELECT COUNT(*) FROM OPENJSON(j.value))<>6
 OR EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key] COLLATE Latin1_General_100_BIN2 NOT IN(N''productId'',N''stockCode'',N''physical'',N''system'',N''reason'',N''fingerprint''))
 OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key]=N''productId'' AND k.type=1 AND k.value IN(N''301985'',N''325503''))
 OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key]=N''physical'' AND k.type=2 AND TRY_CONVERT(decimal(18,3),k.value) BETWEEN 0 AND 30 AND TRY_CONVERT(decimal(18,3),k.value)=FLOOR(TRY_CONVERT(decimal(18,3),k.value)))
 OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key]=N''system'' AND k.type=2 AND TRY_CONVERT(decimal(18,3),k.value) BETWEEN 0 AND 40)
 OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key]=N''fingerprint'' AND k.type=1 AND LEN(k.value)=64 AND k.value COLLATE Latin1_General_100_BIN2 NOT LIKE ''%[^0-9a-f]%'')
 OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key]=N''reason'' AND k.type=1 AND LEN(k.value)<=500 AND (JSON_VALUE(j.value,''$.physical'')=JSON_VALUE(j.value,''$.system'') OR LEN(LTRIM(RTRIM(k.value)))>=3))
 OR NOT EXISTS(SELECT 1 FROM dbo.test_purchase_batch_scope z JOIN dbo.products zp ON zp.id=z.product_id
 WHERE CONVERT(varchar(20),z.product_id)=JSON_VALUE(j.value,''$.productId'') AND z.product_id IN(301985,325503)
 AND CONVERT(varbinary(max),zp.stock_code)=CONVERT(varbinary(max),JSON_VALUE(j.value,''$.stockCode''))
 AND z.supplier_id=13370 AND z.warehouse_id=1 AND z.unit=N''ADET'' AND z.unit_factor=1
 AND z.unit_cost=CASE z.product_id WHEN 301985 THEN 60 ELSE 80 END AND zp.average_cost_try=z.unit_cost
 AND zp.stock_code=CASE z.product_id WHEN 301985 THEN N''TEST-V70-GOODS-P'' ELSE N''TEST-FINISH-GOODS-P2'' END
 AND zp.unit=N''ADET'' AND zp.currency_code=N''TRY'' AND zp.supplier_id=13370 AND zp.is_active=1 AND zp.is_deleted=0))
AND NOT EXISTS(SELECT 1 FROM OPENJSON(d.payload_json,''$.lines'') WITH(productId bigint) x GROUP BY x.productId HAVING COUNT(*)<>1)
AND s.product_id IN(301985,325503) AND s.supplier_id=13370 AND s.warehouse_id=1 AND s.unit=N''ADET'' AND s.unit_factor=1
AND p.stock_code=s.stock_code AND p.unit=N''ADET'' AND p.currency_code=N''TRY'' AND p.average_cost_try=s.unit_cost AND p.supplier_id=13370 AND p.is_active=1 AND p.is_deleted=0
AND EXISTS(SELECT 1 FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id WHERE u.id=d.created_by AND u.is_active=1
 AND ((u.id=15 AND r.code=N''isolated_test_sales'') OR(u.id=16 AND r.code=N''isolated_test_ilker'')))
AND EXISTS(SELECT 1 FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id JOIN dbo.permissions a ON a.role_id=u.role_id
 WHERE u.id=16 AND u.is_active=1 AND r.code=N''isolated_test_ilker'' AND a.permission_key=N''stock.adjust'' AND (a.can_view=1 OR a.can_create=1 OR a.can_update=1 OR a.can_approve=1));
IF EXISTS(SELECT 1 FROM @dcLines) AND (
 NOT EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_manifest WHERE run_id=N''VEGA-OPENING-TEST-20261004-06'' AND sealed=1
 AND seal_hash=''69ff490f2938e34aa2f10399a5cf7b8042950667780779a15d708188c4b90de7'' AND source_rows=176 AND native_holds=172 AND not_present=4)
 OR (SELECT COUNT(*) FROM sys.triggers WHERE name LIKE N''operation[_]quarantine[_]%'' AND is_disabled=0
 AND OBJECTPROPERTY(object_id,''ExecIsFirstInsertTrigger'')=1 AND OBJECTPROPERTY(object_id,''ExecIsFirstUpdateTrigger'')=1 AND OBJECTPROPERTY(object_id,''ExecIsFirstDeleteTrigger'')=1)<>37
 OR EXISTS(SELECT 1 FROM @dcLines l JOIN erp_migration.operation_quarantine_holds h ON (h.entity=N''product'' AND h.native_id=l.product_id) OR(h.entity=N''supplier'' AND h.native_id=13370)))
 THROW 51240,''DAILY_COUNT_QUARANTINE_REQUIRED'',1;

IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.id=i.id JOIN @dcLines l ON l.product_id=i.id AND l.system=d.current_stock_qty AND l.physical=i.current_stock_qty AND l.system<>l.physical)
BEGIN
 IF (SELECT COUNT(*) FROM inserted)<>(SELECT COUNT(*) FROM deleted) OR EXISTS(SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id=d.id WHERE i.id IS NULL)
 OR EXISTS(SELECT 1 FROM inserted i LEFT JOIN deleted d ON d.id=i.id WHERE d.id IS NULL OR NOT EXISTS(
 SELECT 1 FROM @dcLines l WHERE l.product_id=i.id AND l.system=d.current_stock_qty AND l.physical=i.current_stock_qty AND l.system<>l.physical
 AND l.fingerprint=dbo.fn_test_daily_count_fingerprint(i.id,NULL)
 AND NOT EXISTS(SELECT 1 FROM dbo.stock_movements m WHERE m.source_type=N''stock_count'' AND m.source_id=l.draft_id AND m.product_id=i.id)
 AND NOT EXISTS(SELECT __INSERTED_FIELDS__ EXCEPT SELECT __DELETED_FIELDS__)))
 THROW 51240,''DAILY_COUNT_EXACT_PRODUCT_REQUIRED'',1;
 RETURN;
END;
' AS nvarchar(max)),N'__INSERTED_FIELDS__',@fields_i),N'__DELETED_FIELDS__',@fields_d)),
(N'test_guard_stock_movements',CAST(N'
/* TEST_DAILY_COUNT_LINES_20261006: saved two-product count only; legacy body follows unchanged. */
IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N''MELISA_ERP_SIRKET_TEST_20260929_01''
 OR CAST(SERVERPROPERTY(''ServerName'') AS nvarchar(128)) COLLATE Latin1_General_100_BIN2<>N''Semih\MELISADEV'' THROW 51240,''DAILY_COUNT_TARGET'',1;
DECLARE @dcLines TABLE(draft_id bigint,product_id bigint,stock_code nvarchar(50),physical decimal(18,3),system decimal(18,3),reason nvarchar(500),fingerprint varchar(64),document_date date,unit_cost decimal(18,4),PRIMARY KEY(draft_id,product_id));
INSERT @dcLines
SELECT d.id,l.productId,l.stockCode,l.physical,l.system,l.reason,l.fingerprint,TRY_CONVERT(date,JSON_VALUE(d.payload_json,''$.date'')),s.unit_cost
FROM dbo.test_daily_drafts d
CROSS APPLY OPENJSON(d.payload_json,''$.lines'') WITH(productId bigint,stockCode nvarchar(50),physical decimal(18,3),system decimal(18,3),reason nvarchar(500),fingerprint varchar(64)) l
JOIN dbo.test_purchase_batch_scope s ON s.product_id=l.productId
JOIN dbo.products p ON p.id=s.product_id
WHERE d.flow=N''count'' AND d.kind=N''count'' AND d.state=N''pending'' AND d.created_by IN(15,16) AND d.decided_by IS NULL
AND d.id=TRY_CONVERT(bigint,SESSION_CONTEXT(N''melisa_test_count_draft_id'')) AND TRY_CONVERT(bigint,SESSION_CONTEXT(N''melisa_test_count_actor_id''))=16
AND TRY_CONVERT(bigint,SESSION_CONTEXT(N''melisa_test_count_transaction_id''))=CURRENT_TRANSACTION_ID()
AND ISJSON(d.payload_json)=1 AND (SELECT COUNT(*) FROM OPENJSON(d.payload_json))=5
AND NOT EXISTS(SELECT 1 FROM OPENJSON(d.payload_json) k WHERE k.[key] COLLATE Latin1_General_100_BIN2 NOT IN(N''lines'',N''unknownScans'',N''date'',N''unit'',N''warehouse''))
AND JSON_QUERY(d.payload_json,''$.unknownScans'')=N''[]'' AND JSON_VALUE(d.payload_json,''$.unit'')=N''ADET''
AND JSON_VALUE(d.payload_json,''$.warehouse'')=N''TEST-DAILY-WH'' AND JSON_VALUE(d.payload_json,''$.date'')=N''2026-10-06''
AND (SELECT COUNT(*) FROM OPENJSON(d.payload_json,''$.lines'')) BETWEEN 1 AND 2
AND NOT EXISTS(SELECT 1 FROM OPENJSON(d.payload_json,''$.lines'') j WHERE j.type<>5 OR (SELECT COUNT(*) FROM OPENJSON(j.value))<>6
 OR EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key] COLLATE Latin1_General_100_BIN2 NOT IN(N''productId'',N''stockCode'',N''physical'',N''system'',N''reason'',N''fingerprint''))
 OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key]=N''productId'' AND k.type=1 AND k.value IN(N''301985'',N''325503''))
 OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key]=N''physical'' AND k.type=2 AND TRY_CONVERT(decimal(18,3),k.value) BETWEEN 0 AND 30 AND TRY_CONVERT(decimal(18,3),k.value)=FLOOR(TRY_CONVERT(decimal(18,3),k.value)))
 OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key]=N''system'' AND k.type=2 AND TRY_CONVERT(decimal(18,3),k.value) BETWEEN 0 AND 40)
 OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key]=N''fingerprint'' AND k.type=1 AND LEN(k.value)=64 AND k.value COLLATE Latin1_General_100_BIN2 NOT LIKE ''%[^0-9a-f]%'')
 OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key]=N''reason'' AND k.type=1 AND LEN(k.value)<=500 AND (JSON_VALUE(j.value,''$.physical'')=JSON_VALUE(j.value,''$.system'') OR LEN(LTRIM(RTRIM(k.value)))>=3))
 OR NOT EXISTS(SELECT 1 FROM dbo.test_purchase_batch_scope z JOIN dbo.products zp ON zp.id=z.product_id
 WHERE CONVERT(varchar(20),z.product_id)=JSON_VALUE(j.value,''$.productId'') AND z.product_id IN(301985,325503)
 AND CONVERT(varbinary(max),zp.stock_code)=CONVERT(varbinary(max),JSON_VALUE(j.value,''$.stockCode''))
 AND z.supplier_id=13370 AND z.warehouse_id=1 AND z.unit=N''ADET'' AND z.unit_factor=1
 AND z.unit_cost=CASE z.product_id WHEN 301985 THEN 60 ELSE 80 END AND zp.average_cost_try=z.unit_cost
 AND zp.stock_code=CASE z.product_id WHEN 301985 THEN N''TEST-V70-GOODS-P'' ELSE N''TEST-FINISH-GOODS-P2'' END
 AND zp.unit=N''ADET'' AND zp.currency_code=N''TRY'' AND zp.supplier_id=13370 AND zp.is_active=1 AND zp.is_deleted=0))
AND NOT EXISTS(SELECT 1 FROM OPENJSON(d.payload_json,''$.lines'') WITH(productId bigint) x GROUP BY x.productId HAVING COUNT(*)<>1)
AND s.product_id IN(301985,325503) AND s.supplier_id=13370 AND s.warehouse_id=1 AND s.unit=N''ADET'' AND s.unit_factor=1
AND p.stock_code=s.stock_code AND p.unit=N''ADET'' AND p.currency_code=N''TRY'' AND p.average_cost_try=s.unit_cost AND p.supplier_id=13370 AND p.is_active=1 AND p.is_deleted=0
AND EXISTS(SELECT 1 FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id WHERE u.id=d.created_by AND u.is_active=1
 AND ((u.id=15 AND r.code=N''isolated_test_sales'') OR(u.id=16 AND r.code=N''isolated_test_ilker'')))
AND EXISTS(SELECT 1 FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id JOIN dbo.permissions a ON a.role_id=u.role_id
 WHERE u.id=16 AND u.is_active=1 AND r.code=N''isolated_test_ilker'' AND a.permission_key=N''stock.adjust'' AND (a.can_view=1 OR a.can_create=1 OR a.can_update=1 OR a.can_approve=1));
IF EXISTS(SELECT 1 FROM @dcLines) AND (
 NOT EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_manifest WHERE run_id=N''VEGA-OPENING-TEST-20261004-06'' AND sealed=1
 AND seal_hash=''69ff490f2938e34aa2f10399a5cf7b8042950667780779a15d708188c4b90de7'' AND source_rows=176 AND native_holds=172 AND not_present=4)
 OR (SELECT COUNT(*) FROM sys.triggers WHERE name LIKE N''operation[_]quarantine[_]%'' AND is_disabled=0
 AND OBJECTPROPERTY(object_id,''ExecIsFirstInsertTrigger'')=1 AND OBJECTPROPERTY(object_id,''ExecIsFirstUpdateTrigger'')=1 AND OBJECTPROPERTY(object_id,''ExecIsFirstDeleteTrigger'')=1)<>37
 OR EXISTS(SELECT 1 FROM @dcLines l JOIN erp_migration.operation_quarantine_holds h ON (h.entity=N''product'' AND h.native_id=l.product_id) OR(h.entity=N''supplier'' AND h.native_id=13370)))
 THROW 51240,''DAILY_COUNT_QUARANTINE_REQUIRED'',1;

IF EXISTS(SELECT 1 FROM inserted i WHERE i.source_type=N''stock_count'' AND i.product_id IN(301985,325503))
 OR EXISTS(SELECT 1 FROM deleted d WHERE d.source_type=N''stock_count'' AND d.product_id IN(301985,325503))
BEGIN
 IF EXISTS(SELECT 1 FROM deleted) OR EXISTS(SELECT 1 FROM inserted i WHERE NOT EXISTS(
 SELECT 1 FROM @dcLines l JOIN dbo.products p ON p.id=l.product_id
 WHERE i.source_type=N''stock_count'' AND i.source_id=l.draft_id AND i.product_id=l.product_id AND i.created_by=16
 AND l.system<>l.physical AND p.current_stock_qty=l.physical AND l.fingerprint=dbo.fn_test_daily_count_fingerprint(l.product_id,i.id)
 AND i.quantity_net=l.physical-l.system AND i.quantity_in=CASE WHEN l.physical>l.system THEN l.physical-l.system ELSE 0 END
 AND i.quantity_out=CASE WHEN l.physical<l.system THEN l.system-l.physical ELSE 0 END
 AND i.movement_type=CASE WHEN l.physical>l.system THEN N''in'' ELSE N''out'' END
 AND i.unit_cost_try=l.unit_cost AND i.average_cost_try_after=l.unit_cost AND i.unit_price=0 AND i.currency_code=N''TRY''
 AND i.amount_try=ABS(l.physical-l.system)*l.unit_cost AND i.document_date=l.document_date AND i.warehouse_name=N''TEST-DAILY-WH''
 AND i.source_warehouse IS NULL AND i.customer_id IS NULL AND i.supplier_id IS NULL AND i.source_record_key IS NULL AND i.migration_run_id IS NULL
 AND (SELECT COUNT(*) FROM dbo.stock_movements m WHERE m.source_type=N''stock_count'' AND m.source_id=l.draft_id AND m.product_id=l.product_id)=1))
 THROW 51240,''DAILY_COUNT_EXACT_MOVEMENT_REQUIRED'',1;
 RETURN;
END;
' AS nvarchar(max))),
(N'test_guard_audit_logs',CAST(N'
/* TEST_DAILY_COUNT_LINES_20261006: saved two-product count only; legacy body follows unchanged. */
IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N''MELISA_ERP_SIRKET_TEST_20260929_01''
 OR CAST(SERVERPROPERTY(''ServerName'') AS nvarchar(128)) COLLATE Latin1_General_100_BIN2<>N''Semih\MELISADEV'' THROW 51240,''DAILY_COUNT_TARGET'',1;
DECLARE @dcLines TABLE(draft_id bigint,product_id bigint,stock_code nvarchar(50),physical decimal(18,3),system decimal(18,3),reason nvarchar(500),fingerprint varchar(64),document_date date,unit_cost decimal(18,4),PRIMARY KEY(draft_id,product_id));
INSERT @dcLines
SELECT d.id,l.productId,l.stockCode,l.physical,l.system,l.reason,l.fingerprint,TRY_CONVERT(date,JSON_VALUE(d.payload_json,''$.date'')),s.unit_cost
FROM dbo.test_daily_drafts d
CROSS APPLY OPENJSON(d.payload_json,''$.lines'') WITH(productId bigint,stockCode nvarchar(50),physical decimal(18,3),system decimal(18,3),reason nvarchar(500),fingerprint varchar(64)) l
JOIN dbo.test_purchase_batch_scope s ON s.product_id=l.productId
JOIN dbo.products p ON p.id=s.product_id
WHERE d.flow=N''count'' AND d.kind=N''count'' AND d.state=N''pending'' AND d.created_by IN(15,16) AND d.decided_by IS NULL
AND d.id=TRY_CONVERT(bigint,SESSION_CONTEXT(N''melisa_test_count_draft_id'')) AND TRY_CONVERT(bigint,SESSION_CONTEXT(N''melisa_test_count_actor_id''))=16
AND TRY_CONVERT(bigint,SESSION_CONTEXT(N''melisa_test_count_transaction_id''))=CURRENT_TRANSACTION_ID()
AND ISJSON(d.payload_json)=1 AND (SELECT COUNT(*) FROM OPENJSON(d.payload_json))=5
AND NOT EXISTS(SELECT 1 FROM OPENJSON(d.payload_json) k WHERE k.[key] COLLATE Latin1_General_100_BIN2 NOT IN(N''lines'',N''unknownScans'',N''date'',N''unit'',N''warehouse''))
AND JSON_QUERY(d.payload_json,''$.unknownScans'')=N''[]'' AND JSON_VALUE(d.payload_json,''$.unit'')=N''ADET''
AND JSON_VALUE(d.payload_json,''$.warehouse'')=N''TEST-DAILY-WH'' AND JSON_VALUE(d.payload_json,''$.date'')=N''2026-10-06''
AND (SELECT COUNT(*) FROM OPENJSON(d.payload_json,''$.lines'')) BETWEEN 1 AND 2
AND NOT EXISTS(SELECT 1 FROM OPENJSON(d.payload_json,''$.lines'') j WHERE j.type<>5 OR (SELECT COUNT(*) FROM OPENJSON(j.value))<>6
 OR EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key] COLLATE Latin1_General_100_BIN2 NOT IN(N''productId'',N''stockCode'',N''physical'',N''system'',N''reason'',N''fingerprint''))
 OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key]=N''productId'' AND k.type=1 AND k.value IN(N''301985'',N''325503''))
 OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key]=N''physical'' AND k.type=2 AND TRY_CONVERT(decimal(18,3),k.value) BETWEEN 0 AND 30 AND TRY_CONVERT(decimal(18,3),k.value)=FLOOR(TRY_CONVERT(decimal(18,3),k.value)))
 OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key]=N''system'' AND k.type=2 AND TRY_CONVERT(decimal(18,3),k.value) BETWEEN 0 AND 40)
 OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key]=N''fingerprint'' AND k.type=1 AND LEN(k.value)=64 AND k.value COLLATE Latin1_General_100_BIN2 NOT LIKE ''%[^0-9a-f]%'')
 OR NOT EXISTS(SELECT 1 FROM OPENJSON(j.value) k WHERE k.[key]=N''reason'' AND k.type=1 AND LEN(k.value)<=500 AND (JSON_VALUE(j.value,''$.physical'')=JSON_VALUE(j.value,''$.system'') OR LEN(LTRIM(RTRIM(k.value)))>=3))
 OR NOT EXISTS(SELECT 1 FROM dbo.test_purchase_batch_scope z JOIN dbo.products zp ON zp.id=z.product_id
 WHERE CONVERT(varchar(20),z.product_id)=JSON_VALUE(j.value,''$.productId'') AND z.product_id IN(301985,325503)
 AND CONVERT(varbinary(max),zp.stock_code)=CONVERT(varbinary(max),JSON_VALUE(j.value,''$.stockCode''))
 AND z.supplier_id=13370 AND z.warehouse_id=1 AND z.unit=N''ADET'' AND z.unit_factor=1
 AND z.unit_cost=CASE z.product_id WHEN 301985 THEN 60 ELSE 80 END AND zp.average_cost_try=z.unit_cost
 AND zp.stock_code=CASE z.product_id WHEN 301985 THEN N''TEST-V70-GOODS-P'' ELSE N''TEST-FINISH-GOODS-P2'' END
 AND zp.unit=N''ADET'' AND zp.currency_code=N''TRY'' AND zp.supplier_id=13370 AND zp.is_active=1 AND zp.is_deleted=0))
AND NOT EXISTS(SELECT 1 FROM OPENJSON(d.payload_json,''$.lines'') WITH(productId bigint) x GROUP BY x.productId HAVING COUNT(*)<>1)
AND s.product_id IN(301985,325503) AND s.supplier_id=13370 AND s.warehouse_id=1 AND s.unit=N''ADET'' AND s.unit_factor=1
AND p.stock_code=s.stock_code AND p.unit=N''ADET'' AND p.currency_code=N''TRY'' AND p.average_cost_try=s.unit_cost AND p.supplier_id=13370 AND p.is_active=1 AND p.is_deleted=0
AND EXISTS(SELECT 1 FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id WHERE u.id=d.created_by AND u.is_active=1
 AND ((u.id=15 AND r.code=N''isolated_test_sales'') OR(u.id=16 AND r.code=N''isolated_test_ilker'')))
AND EXISTS(SELECT 1 FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id JOIN dbo.permissions a ON a.role_id=u.role_id
 WHERE u.id=16 AND u.is_active=1 AND r.code=N''isolated_test_ilker'' AND a.permission_key=N''stock.adjust'' AND (a.can_view=1 OR a.can_create=1 OR a.can_update=1 OR a.can_approve=1));
IF EXISTS(SELECT 1 FROM @dcLines) AND (
 NOT EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_manifest WHERE run_id=N''VEGA-OPENING-TEST-20261004-06'' AND sealed=1
 AND seal_hash=''69ff490f2938e34aa2f10399a5cf7b8042950667780779a15d708188c4b90de7'' AND source_rows=176 AND native_holds=172 AND not_present=4)
 OR (SELECT COUNT(*) FROM sys.triggers WHERE name LIKE N''operation[_]quarantine[_]%'' AND is_disabled=0
 AND OBJECTPROPERTY(object_id,''ExecIsFirstInsertTrigger'')=1 AND OBJECTPROPERTY(object_id,''ExecIsFirstUpdateTrigger'')=1 AND OBJECTPROPERTY(object_id,''ExecIsFirstDeleteTrigger'')=1)<>37
 OR EXISTS(SELECT 1 FROM @dcLines l JOIN erp_migration.operation_quarantine_holds h ON (h.entity=N''product'' AND h.native_id=l.product_id) OR(h.entity=N''supplier'' AND h.native_id=13370)))
 THROW 51240,''DAILY_COUNT_QUARANTINE_REQUIRED'',1;

IF EXISTS(SELECT 1 FROM inserted i WHERE i.action=N''stock_count_adjustment_applied'' AND i.entity_type=N''product'' AND i.entity_id IN(301985,325503))
 OR EXISTS(SELECT 1 FROM deleted d WHERE d.action=N''stock_count_adjustment_applied'' AND d.entity_type=N''product'' AND d.entity_id IN(301985,325503))
BEGIN
 IF EXISTS(SELECT 1 FROM deleted) OR EXISTS(SELECT 1 FROM inserted i WHERE NOT EXISTS(
 SELECT 1 FROM @dcLines l JOIN dbo.stock_movements m ON m.source_type=N''stock_count'' AND m.source_id=l.draft_id AND m.product_id=l.product_id
 WHERE i.action=N''stock_count_adjustment_applied'' AND i.entity_type=N''product'' AND i.entity_id=l.product_id AND i.actor_user_id=16
 AND ISJSON(i.after_json)=1 AND ISJSON(i.before_json)=1 AND (SELECT COUNT(*) FROM OPENJSON(i.after_json))=4 AND (SELECT COUNT(*) FROM OPENJSON(i.before_json))=1
 AND TRY_CONVERT(bigint,JSON_VALUE(i.after_json,''$.movementId''))=m.id AND m.created_by=16 AND m.quantity_net=l.physical-l.system
 AND TRY_CONVERT(decimal(18,3),JSON_VALUE(i.before_json,''$.stockQuantity''))=l.system AND TRY_CONVERT(decimal(18,3),JSON_VALUE(i.after_json,''$.stockQuantity''))=l.physical
 AND TRY_CONVERT(decimal(18,3),JSON_VALUE(i.after_json,''$.difference''))=l.physical-l.system
 AND CONVERT(varbinary(max),JSON_VALUE(i.after_json,''$.note''))=CONVERT(varbinary(max),l.reason)
 AND l.fingerprint=dbo.fn_test_daily_count_fingerprint(l.product_id,m.id)
 AND (SELECT COUNT(*) FROM dbo.audit_logs x WHERE x.action=i.action AND x.entity_type=i.entity_type AND x.entity_id=i.entity_id AND TRY_CONVERT(bigint,JSON_VALUE(x.after_json,''$.movementId''))=m.id)=1))
 THROW 51240,''DAILY_COUNT_EXACT_AUDIT_REQUIRED'',1;
 RETURN;
END;
' AS nvarchar(max)));
-- Git/Windows line endings must not change generated definition hashes. Only new
-- prefix/function text is normalized; the installed legacy definition remains exact.
UPDATE @prefixes SET body=REPLACE(body,CHAR(13)+CHAR(10),CHAR(10));
UPDATE p SET after_definition=STUFF(p.before_definition,CHARINDEX(N'AS BEGIN',p.before_definition)+8,0,CHAR(10)+x.body+CHAR(10))
FROM @plan p JOIN @prefixes x ON x.name=p.name;
IF EXISTS(SELECT 1 FROM @plan WHERE name LIKE N'test[_]guard[_]%' AND (after_definition IS NULL OR CHARINDEX(N'AS BEGIN',before_definition)=0))
 THROW 51240,'DAILY_COUNT_UNKNOWN_HEADER',1;
-- SQL Server persists ALTER modules with the CREATE keyword. Plan the stored
-- original CREATE header, and transform only the executable DDL to ALTER below.
UPDATE @plan SET after_hash=CONVERT(varchar(64),HASHBYTES('SHA2_256',after_definition),2) WHERE name LIKE N'test[_]guard[_]%';
DECLARE @auditHash varchar(64)=(SELECT after_hash FROM @plan WHERE name=N'test_guard_audit_logs');
UPDATE @plan SET after_definition=REPLACE(before_definition,N'E9FC039F081E2B824440CBAE2302B53FCDF75B6F5A405161885AAC341640853E',@auditHash) WHERE name=N'usp_work_supplier_payment_ready';
UPDATE @plan SET after_hash=CONVERT(varchar(64),HASHBYTES('SHA2_256',after_definition),2) WHERE name=N'usp_work_supplier_payment_ready';
INSERT @plan(name,before_hash,before_definition,after_definition,after_hash) VALUES
(N'fn_test_daily_count_fingerprint',NULL,NULL,CAST(N'CREATE FUNCTION dbo.fn_test_daily_count_fingerprint(@product_id bigint,@exclude_movement_id bigint)
RETURNS varchar(64)
AS BEGIN
 DECLARE @json nvarchar(max);
 SELECT @json=CONCAT(N''['',STRING_AGG(CONVERT(nvarchar(max),CONCAT(N''{"id":"'',id,N''","quantity_net":'',FORMAT(quantity_net,''0.###'',''en-US''),N'',"source_id":'',CASE WHEN source_id IS NULL THEN N''null'' ELSE CONCAT(N''"'',source_id,N''"'') END,N'',"source_type":"'',STRING_ESCAPE(source_type,''json''),N''"}'')),N'','') WITHIN GROUP(ORDER BY id),N'']'')
 FROM dbo.stock_movements WHERE product_id=@product_id AND (@exclude_movement_id IS NULL OR id<>@exclude_movement_id);
 RETURN LOWER(CONVERT(varchar(64),HASHBYTES(''SHA2_256'',CONVERT(varbinary(max),CONVERT(varchar(max),@json COLLATE Latin1_General_100_CI_AS_SC_UTF8))),2));
END;' AS nvarchar(max)),CONVERT(varchar(64),HASHBYTES('SHA2_256',CAST(N'CREATE FUNCTION dbo.fn_test_daily_count_fingerprint(@product_id bigint,@exclude_movement_id bigint)
RETURNS varchar(64)
AS BEGIN
 DECLARE @json nvarchar(max);
 SELECT @json=CONCAT(N''['',STRING_AGG(CONVERT(nvarchar(max),CONCAT(N''{"id":"'',id,N''","quantity_net":'',FORMAT(quantity_net,''0.###'',''en-US''),N'',"source_id":'',CASE WHEN source_id IS NULL THEN N''null'' ELSE CONCAT(N''"'',source_id,N''"'') END,N'',"source_type":"'',STRING_ESCAPE(source_type,''json''),N''"}'')),N'','') WITHIN GROUP(ORDER BY id),N'']'')
 FROM dbo.stock_movements WHERE product_id=@product_id AND (@exclude_movement_id IS NULL OR id<>@exclude_movement_id);
 RETURN LOWER(CONVERT(varchar(64),HASHBYTES(''SHA2_256'',CONVERT(varbinary(max),CONVERT(varchar(max),@json COLLATE Latin1_General_100_CI_AS_SC_UTF8))),2));
END;' AS nvarchar(max))),2));
UPDATE @plan SET after_definition=REPLACE(after_definition,CHAR(13)+CHAR(10),CHAR(10)) WHERE name=N'fn_test_daily_count_fingerprint';
UPDATE @plan SET after_hash=CONVERT(varchar(64),HASHBYTES('SHA2_256',after_definition),2) WHERE name=N'fn_test_daily_count_fingerprint';
IF @Apply=0 BEGIN SELECT name,before_hash,after_hash,N'prepare-only-no-write' mode FROM @plan ORDER BY name; RETURN; END;

BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;EXEC @lock=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;
 IF @lock<0 THROW 51240,'DAILY_COUNT_BUSY',1;
 IF EXISTS(SELECT 1 FROM @plan WHERE before_hash IS NOT NULL AND before_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.'+name))),2))
 THROW 51240,'DAILY_COUNT_BASELINE_CHANGED',1;
 -- Only metadata-manifest protection is briefly suspended under transactional schema locks.
 -- No quarantine, immutable accepted-data, product/stock or financial guard is disabled.
 DISABLE TRIGGER dbo.test_batch_guard_test_purchase_batch_guard_manifest ON dbo.test_purchase_batch_guard_manifest;
 DISABLE TRIGGER dbo.c03_immutable_test_purchase_fx_guard_manifest ON dbo.test_purchase_fx_guard_manifest;
 DISABLE TRIGGER dbo.work_night_guard_work_trade_guard_manifest ON dbo.work_trade_guard_manifest;
 DISABLE TRIGGER dbo.work_finops_manifest_guard ON dbo.work_finops_manifest;
 DECLARE @functionDefinition nvarchar(max)=(SELECT after_definition FROM @plan WHERE name=N'fn_test_daily_count_fingerprint');
 EXEC sys.sp_executesql @functionDefinition;
 DECLARE dc_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT name,after_definition FROM @plan WHERE name<>N'fn_test_daily_count_fingerprint' ORDER BY CASE WHEN name=N'usp_work_supplier_payment_ready' THEN 1 ELSE 0 END,name;
 OPEN dc_cursor; FETCH NEXT FROM dc_cursor INTO @name,@definition;
 WHILE @@FETCH_STATUS=0 BEGIN SET @definition=STUFF(@definition,1,6,N'ALTER');EXEC sys.sp_executesql @definition;FETCH NEXT FROM dc_cursor INTO @name,@definition; END;
 CLOSE dc_cursor; DEALLOCATE dc_cursor;
 IF EXISTS(SELECT 1 FROM @plan WHERE after_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.'+name))),2))
 THROW 51240,'DAILY_COUNT_DEFINITION_HASH_MISMATCH',1;
 UPDATE m SET after_hash=p.after_hash FROM dbo.test_purchase_batch_guard_manifest m JOIN @plan p ON p.name=m.name;
 UPDATE m SET definition_hash=p.after_hash FROM dbo.test_purchase_fx_guard_manifest m JOIN @plan p ON p.name=m.name;
 UPDATE m SET after_hash=p.after_hash FROM dbo.work_trade_guard_manifest m JOIN @plan p ON p.name=m.name;
 UPDATE m SET definition_hash=p.after_hash FROM dbo.work_finops_manifest m JOIN @plan p ON p.name=m.name WHERE m.name=N'usp_work_supplier_payment_ready';
 IF @@ROWCOUNT<>1 THROW 51240,'DAILY_COUNT_FINOPS_MANIFEST_REQUIRED',1;
 ENABLE TRIGGER dbo.test_batch_guard_test_purchase_batch_guard_manifest ON dbo.test_purchase_batch_guard_manifest;
 ENABLE TRIGGER dbo.c03_immutable_test_purchase_fx_guard_manifest ON dbo.test_purchase_fx_guard_manifest;
 ENABLE TRIGGER dbo.work_night_guard_work_trade_guard_manifest ON dbo.work_trade_guard_manifest;
 ENABLE TRIGGER dbo.work_finops_manifest_guard ON dbo.work_finops_manifest;
 CREATE TABLE dbo.test_daily_count_lines_guard_manifest(name sysname PRIMARY KEY,before_hash varchar(64) NULL,before_definition nvarchar(max) NULL,after_hash varchar(64) NOT NULL,after_definition nvarchar(max) NOT NULL,installed_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
 INSERT dbo.test_daily_count_lines_guard_manifest(name,before_hash,before_definition,after_hash,after_definition) SELECT name,before_hash,before_definition,after_hash,after_definition FROM @plan;
 EXEC sys.sp_executesql N'CREATE TRIGGER dbo.test_daily_count_lines_manifest_immutable ON dbo.test_daily_count_lines_guard_manifest WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON; THROW 51240,''DAILY_COUNT_MANIFEST_IMMUTABLE'',1; END;';
 EXEC dbo.work_trade_assert_ready; EXEC dbo.usp_work_supplier_payment_ready;
 IF EXISTS(SELECT 1 FROM sys.triggers WHERE name IN(N'test_guard_products',N'test_guard_stock_movements',N'test_guard_audit_logs',N'test_batch_guard_test_purchase_batch_guard_manifest',N'c03_immutable_test_purchase_fx_guard_manifest',N'work_night_guard_work_trade_guard_manifest',N'work_finops_manifest_guard',N'test_daily_count_lines_manifest_immutable') AND is_disabled<>0)
 THROW 51240,'DAILY_COUNT_DISABLED_GUARD',1;
 COMMIT;
 SELECT name,before_hash,after_hash,N'applied-existing-exact-test-scope' mode FROM dbo.test_daily_count_lines_guard_manifest ORDER BY name;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;





