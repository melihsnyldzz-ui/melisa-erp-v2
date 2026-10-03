-- Extend only the reviewed TEST audit insert case; preserve every existing rule.
-- Run after test-crm-order-draft-20261004.sql. Never run on LIVE.
IF DB_NAME()<>N'MELISA_ERP_SIRKET_TEST_20260929_01' THROW 51090,'CRM_TEST_DATABASE_REQUIRED',1;
IF OBJECT_ID(N'dbo.test_crm_order_requests',N'U') IS NULL THROW 51094,'CRM_TEST_SCOPE_REQUIRED',1;
DECLARE @definition NVARCHAR(MAX)=OBJECT_DEFINITION(OBJECT_ID(N'dbo.test_guard_audit_logs'));
IF @definition IS NULL OR OBJECTPROPERTY(OBJECT_ID(N'dbo.test_guard_audit_logs'),'ExecIsTriggerDisabled')<>0 THROW 51094,'CRM_TEST_AUDIT_GUARD_REQUIRED',1;
IF CHARINDEX(N'/* CRM_DRAFT_AUDIT_20261004 */',@definition)>0 RETURN;
-- Refuse unfamiliar header syntax instead of replacing an unknown guard.
DECLARE @header NVARCHAR(200)=N'CREATE TRIGGER dbo.test_guard_audit_logs ON dbo.audit_logs AFTER INSERT,UPDATE,DELETE AS BEGIN';
IF LEFT(@definition,LEN(@header))<>@header THROW 51094,'CRM_TEST_AUDIT_HEADER_REQUIRED',1;
DECLARE @clause NVARCHAR(MAX)=N'
/* CRM_DRAFT_AUDIT_20261004 */
IF DB_NAME()=N''MELISA_ERP_SIRKET_TEST_20260929_01'' AND EXISTS(SELECT 1 FROM inserted) AND NOT EXISTS(SELECT 1 FROM deleted)
 AND NOT EXISTS(SELECT 1 FROM inserted i WHERE
 i.action IS NULL OR i.action<>N''sales_order_created'' OR i.entity_type IS NULL OR i.entity_type<>N''sales_order''
 OR i.source IS NULL OR i.source<>N''crm-test'' OR i.before_json IS NOT NULL
 OR ISJSON(i.after_json)<>1 OR i.after_json IS NULL
 OR NOT EXISTS(SELECT 1 FROM dbo.test_crm_order_requests r
 JOIN dbo.sales_orders o ON o.id=r.order_id JOIN dbo.users u ON u.id=r.actor_id
 JOIN dbo.customers c ON c.id=o.customer_id
 WHERE r.order_id=i.entity_id AND r.actor_id=i.actor_user_id AND u.is_active=1
 AND r.customer_id=593 AND c.id=593 AND c.customer_code=N''TEST-V70-20260929-C'' AND c.is_active=1 AND c.is_deleted=0
 AND r.conversation_id=N''55'' AND r.peer=N''905387217733'' AND o.status=N''draft''
 AND i.reason=N''CRM TEST draft only; verified CRM actor ''+r.crm_actor_id
 AND ISJSON(i.after_json)=1
 AND JSON_VALUE(i.after_json,''$.requestId'')=CONVERT(NVARCHAR(36),r.request_id)
 AND JSON_VALUE(i.after_json,''$.crmActorId'')=r.crm_actor_id
 AND JSON_VALUE(i.after_json,''$.conversationId'')=N''55'' AND JSON_VALUE(i.after_json,''$.peer'')=r.peer
 AND JSON_VALUE(i.after_json,''$.payloadHash'')=r.payload_hash
 AND TRY_CONVERT(BIGINT,JSON_VALUE(i.after_json,''$.orderId''))=r.order_id
 AND JSON_VALUE(i.after_json,''$.currency'')=o.document_currency
 AND TRY_CONVERT(DECIMAL(18,4),JSON_VALUE(i.after_json,''$.grandTotal''))=o.grand_total
 AND JSON_VALUE(i.after_json,''$.stockEffect'')=N''false'' AND JSON_VALUE(i.after_json,''$.ledgerEffect'')=N''false''
 AND EXISTS(SELECT 1 FROM OPENJSON(i.after_json) WHERE [key]=N''stockEffect'' AND [type]=3 AND [value]=N''false'')
 AND EXISTS(SELECT 1 FROM OPENJSON(i.after_json) WHERE [key]=N''ledgerEffect'' AND [type]=3 AND [value]=N''false'')
 AND NOT EXISTS(SELECT 1 FROM dbo.audit_logs a WHERE a.entity_type=N''sales_order'' AND a.entity_id=r.order_id AND a.source=N''crm-test'' AND a.id<>i.id)
 AND (SELECT COUNT(*) FROM inserted x WHERE x.entity_id=i.entity_id)=1)) RETURN;
';
-- Current shared TEST body is retained byte-for-byte after its BEGIN header.
SET @definition=N'ALTER'+SUBSTRING(@definition,7,LEN(@definition));
DECLARE @beginOffset INT=CHARINDEX(N' AS BEGIN',@definition)+LEN(N' AS BEGIN');
SET @definition=STUFF(@definition,@beginOffset,0,@clause);
EXEC sys.sp_executesql @definition;
