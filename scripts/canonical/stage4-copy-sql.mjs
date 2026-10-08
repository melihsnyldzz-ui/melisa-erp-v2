import {createHash} from 'node:crypto';
import {ISOLATED_COPY_OPERATION_PERMISSIONS} from '../../apps/api/src/services/isolatedOperationCopyStore.mjs';

export const COPY_DB='MELISA_ERP_STAGE04_COPY_TEST_20261008_01';
export const COPY_LOGIN='melisa_stage4_copy_rw_20261008_01';
export const SOURCE_DB='MELISA_ERP_SIRKET_TEST_20260929_01';
const fail=code=>{throw Error(code);};
const literal=v=>{if(typeof v!=='string'||v.includes('\0'))fail('STAGE4_SQL_LITERAL');return "N'"+v.replaceAll("'","''")+"'";};
const digest=v=>createHash('sha256').update(v,'utf16le').digest('hex').toUpperCase();
export const moduleHash=digest;
const qualified=name=>{if(!/^dbo\.[a-zA-Z0-9_]+$/.test(name))fail('STAGE4_SQL_OBJECT');return name.split('.').map(v=>'['+v+']').join('.');};
const identity=`IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'${COPY_DB}' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2<>N'Semih\\MELISADEV' THROW 51904,'STAGE4_WRONG_COPY_TARGET',1;`;
const activeIntent=`IF NOT EXISTS(SELECT 1 FROM dbo.stage4_copy_intents n JOIN dbo.stage4_copy_manifest m ON m.copy_id=n.copy_id WHERE n.session_id=@@SPID AND n.transaction_id=CURRENT_TRANSACTION_ID() AND m.sealed=1 AND ORIGINAL_LOGIN() COLLATE Latin1_General_100_BIN2=N'${COPY_LOGIN}') THROW 51904,'STAGE4_SAME_TX_INTENT_REQUIRED',1;`;
const manifest=`DECLARE @p nvarchar(max);SELECT @p=profile_json FROM dbo.stage4_copy_manifest WHERE copy_id=@copy_id AND sealed=1;IF @p IS NULL THROW 51904,'STAGE4_COPY_SEAL_REQUIRED',1;`;

export function stage4CopySchema(){return `${identity}
IF OBJECT_ID(N'dbo.stage4_copy_manifest') IS NOT NULL THROW 51904,'STAGE4_PROFILE_ALREADY_EXISTS',1;
CREATE TABLE dbo.stage4_copy_manifest(copy_id uniqueidentifier NOT NULL PRIMARY KEY,profile_json nvarchar(max) NOT NULL,seal_hash char(64) NOT NULL,backup_sha char(64) NOT NULL,sealed bit NOT NULL CHECK(sealed=1),created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
CREATE TABLE dbo.stage4_copy_module_manifest(name sysname NOT NULL PRIMARY KEY,before_hash char(64) NULL,after_hash char(64) NOT NULL,kind varchar(32) NOT NULL);
CREATE TABLE dbo.stage4_copy_requests(copy_id uniqueidentifier NOT NULL,request_id uniqueidentifier NOT NULL,actor_id bigint NOT NULL,operation nvarchar(40) NOT NULL,payload_hash char(64) NOT NULL,payload_json nvarchar(max) NOT NULL,response_json nvarchar(max) NOT NULL,effect_proof_json nvarchar(max) NOT NULL,created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),CONSTRAINT PK_stage4_copy_requests PRIMARY KEY(copy_id,request_id));
CREATE TABLE dbo.stage4_copy_intents(copy_id uniqueidentifier NOT NULL,request_id uniqueidentifier NOT NULL,session_id int NOT NULL,transaction_id bigint NOT NULL,actor_id bigint NOT NULL,operation nvarchar(40) NOT NULL,payload_hash char(64) NOT NULL,payload_json nvarchar(max) NOT NULL,before_state_json nvarchar(max) NOT NULL,response_json nvarchar(max) NULL,effect_proof_json nvarchar(max) NULL,created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),CONSTRAINT PK_stage4_copy_intents PRIMARY KEY(copy_id,request_id),CONSTRAINT UQ_stage4_copy_intents_tx UNIQUE(session_id,transaction_id));
CREATE TABLE dbo.stage4_copy_effect_components(copy_id uniqueidentifier NOT NULL,request_id uniqueidentifier NOT NULL,entity varchar(32) NOT NULL,native_id bigint NOT NULL,effect_json nvarchar(max) NOT NULL,CONSTRAINT PK_stage4_copy_effect_components PRIMARY KEY(copy_id,request_id,entity,native_id));
`;} 

const stateSQL=`SELECT @state=(SELECT
 JSON_QUERY((SELECT p.id,CONVERT(varchar(50),p.current_stock_qty) quantity FROM dbo.products p JOIN OPENJSON(@p,'$.products') WITH(id bigint '$.id') s ON s.id=p.id ORDER BY p.id FOR JSON PATH)) products,
 JSON_QUERY((SELECT a.id,a.customer_id,a.supplier_id,a.party_entity_id,a.currency_code,CONVERT(varchar(50),a.current_balance) balance FROM dbo.party_currency_accounts a JOIN (SELECT accountId FROM OPENJSON(@p,'$.customers') WITH(accountId bigint '$.accountId') UNION ALL SELECT accountId FROM OPENJSON(@p,'$.suppliers') WITH(accountId bigint '$.accountId')) s ON s.accountId=a.id ORDER BY a.id FOR JSON PATH)) parties,
 JSON_QUERY((SELECT a.id,CONVERT(varchar(50),a.current_balance) balance FROM dbo.finance_accounts a JOIN OPENJSON(@p,'$.financeAccounts') WITH(id bigint '$.id') s ON s.id=a.id ORDER BY a.id FOR JSON PATH)) finance,
 ISNULL((SELECT MAX(id) FROM dbo.stock_movements),0) maxStockId,ISNULL((SELECT MAX(id) FROM dbo.customer_movements),0) maxCustomerId,ISNULL((SELECT MAX(id) FROM dbo.supplier_movements),0) maxSupplierId,ISNULL((SELECT MAX(id) FROM dbo.finance_account_movements),0) maxFinanceId
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);`;

export function stage4ReadySQL(){return `CREATE PROCEDURE dbo.usp_stage4_copy_ready @copy_id uniqueidentifier WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;${identity}${manifest}
IF ORIGINAL_LOGIN() COLLATE Latin1_General_100_BIN2<>N'${COPY_LOGIN}' THROW 51904,'STAGE4_WRITER_REQUIRED',1;
IF HAS_DBACCESS(N'${SOURCE_DB}')<>0 OR HAS_DBACCESS(N'MELISA_ERP_PROD_CANDIDATE_20260917_01')<>0 THROW 51904,'STAGE4_DATABASE_BOUNDARY',1;
IF NOT EXISTS(SELECT 1 FROM dbo.stage4_copy_module_manifest) OR EXISTS(SELECT 1 FROM dbo.stage4_copy_module_manifest p LEFT JOIN sys.objects o ON o.object_id=OBJECT_ID(p.name) WHERE o.object_id IS NULL OR p.after_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(o.object_id)),2) OR (o.type='TR' AND OBJECTPROPERTY(o.object_id,'ExecIsTriggerDisabled')<>0)) THROW 51904,'STAGE4_MODULE_DRIFT',1;
IF EXISTS(SELECT 1 FROM OPENJSON(@p,'$.products') WITH(id bigint '$.id',stockCode nvarchar(250) '$.stockCode',sourceKey nvarchar(250) '$.sourceKey') s LEFT JOIN dbo.products p ON p.id=s.id WHERE p.id IS NULL OR p.stock_code COLLATE Latin1_General_100_BIN2<>s.stockCode COLLATE Latin1_General_100_BIN2 OR p.source_record_key COLLATE Latin1_General_100_BIN2<>s.sourceKey COLLATE Latin1_General_100_BIN2 OR p.unit<>N'ADET' OR p.is_active<>1 OR p.is_deleted<>0 OR EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N'product' AND h.native_id=s.id)) THROW 51904,'STAGE4_PRODUCT_SCOPE_DRIFT',1;
IF EXISTS(SELECT 1 FROM(SELECT id,partyId,accountId,currency,sourceKey,N'customer' role FROM OPENJSON(@p,'$.customers') WITH(id bigint '$.id',partyId bigint '$.partyId',accountId bigint '$.accountId',currency nvarchar(3) '$.currency',sourceKey nvarchar(250) '$.sourceKey') UNION ALL SELECT id,partyId,accountId,currency,sourceKey,N'supplier' FROM OPENJSON(@p,'$.suppliers') WITH(id bigint '$.id',partyId bigint '$.partyId',accountId bigint '$.accountId',currency nvarchar(3) '$.currency',sourceKey nvarchar(250) '$.sourceKey'))s LEFT JOIN dbo.party_currency_accounts a ON a.id=s.accountId WHERE a.id IS NULL OR a.party_entity_id<>s.partyId OR a.currency_code<>s.currency OR (s.role=N'customer' AND a.customer_id<>s.id) OR (s.role=N'supplier' AND a.supplier_id<>s.id) OR EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE h.native_entity_id=s.partyId OR (h.entity=s.role AND h.native_id=s.id))) THROW 51904,'STAGE4_PARTY_SCOPE_DRIFT',1;
END;`;}

export function stage4BeginSQL(){return `CREATE PROCEDURE dbo.usp_stage4_copy_begin @copy_id uniqueidentifier,@request_id uniqueidentifier,@actor_id bigint,@operation nvarchar(40),@payload_hash char(64),@payload_json nvarchar(max) WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;${identity}${manifest}
EXEC dbo.usp_stage4_copy_ready @copy_id;
IF ISNULL(APPLOCK_MODE(N'public',N'melisa-stage4-copy:'+LOWER(CONVERT(varchar(36),@copy_id)),N'Transaction'),N'NoLock')<>N'Exclusive' THROW 51904,'STAGE4_COPY_LOCK_REQUIRED',1;
IF @@TRANCOUNT<>1 OR @copy_id IS NULL OR @request_id IS NULL OR @actor_id IS NULL OR @operation IS NULL OR @payload_hash IS NULL OR ISJSON(@payload_json)<>1 OR @payload_json IS NULL OR ISNULL(JSON_VALUE(@payload_json,'$.copyId'),'') COLLATE Latin1_General_100_BIN2<>LOWER(CONVERT(varchar(36),@copy_id)) OR ISNULL(JSON_VALUE(@payload_json,'$.actorId'),'')<>CONVERT(varchar(20),@actor_id) OR ISNULL(JSON_VALUE(@payload_json,'$.requestId'),'') COLLATE Latin1_General_100_BIN2<>LOWER(CONVERT(varchar(36),@request_id)) OR ISNULL(JSON_VALUE(@payload_json,'$.operation'),'') COLLATE Latin1_General_100_BIN2<>@operation OR ISNULL(JSON_VALUE(@payload_json,'$.operationOrigin'),'')<>N'ISOLATED_TEST_COPY' OR ISNULL(JSON_VALUE(@payload_json,'$.sealHash'),'') COLLATE Latin1_General_100_BIN2<>JSON_VALUE(@p,'$.sealHash') OR CONVERT(varchar(64),HASHBYTES('SHA2_256',@payload_json),2)<>@payload_hash THROW 51904,'STAGE4_INTENT_IDENTITY',1;
DECLARE @roleId bigint,@roleCode nvarchar(80),@permissionHash char(64),@actorPermissions nvarchar(max),@permission nvarchar(80);
SELECT @roleId=s.nativeRoleId,@roleCode=s.nativeRoleCode,@permissionHash=s.permissionsRowsHash,@actorPermissions=s.permissions FROM OPENJSON(@p,'$.actors') WITH(id bigint '$.id',nativeRoleId bigint '$.nativeRoleId',nativeRoleCode nvarchar(80) '$.nativeRoleCode',permissionsRowsHash char(64) '$.permissionsRowsHash',permissions nvarchar(max) '$.permissions' AS JSON)s JOIN dbo.users u ON u.id=s.id AND u.is_active=1 AND u.role_id=s.nativeRoleId JOIN dbo.roles r ON r.id=u.role_id AND r.code=s.nativeRoleCode AND r.is_active=1 WHERE s.id=@actor_id;
IF @roleId IS NULL OR @permissionHash IS NULL OR @actorPermissions IS NULL OR CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT x.* FROM dbo.permissions x WHERE x.role_id=@roleId ORDER BY x.id FOR JSON PATH,INCLUDE_NULL_VALUES)),2)<>@permissionHash THROW 51904,'STAGE4_ACTOR_PERMISSION_DRIFT',1;
SELECT @permission=v.permission FROM(VALUES ${Object.entries(ISOLATED_COPY_OPERATION_PERMISSIONS).map(([operation,permission])=>'('+literal(operation)+','+literal(permission)+')').join(',')})v(operation,permission) WHERE v.operation=@operation;
IF @permission IS NULL OR NOT EXISTS(SELECT 1 FROM OPENJSON(@actorPermissions) WHERE value=@permission) THROW 51904,'STAGE4_OPERATION_FORBIDDEN',1;
IF EXISTS(SELECT 1 FROM dbo.stage4_copy_requests WHERE copy_id=@copy_id AND request_id=@request_id) OR EXISTS(SELECT 1 FROM dbo.stage4_copy_intents WHERE session_id=@@SPID OR (copy_id=@copy_id AND request_id=@request_id)) THROW 51904,'STAGE4_REQUEST_CONFLICT',1;
DECLARE @state nvarchar(max);${stateSQL}
INSERT dbo.stage4_copy_intents(copy_id,request_id,session_id,transaction_id,actor_id,operation,payload_hash,payload_json,before_state_json) VALUES(@copy_id,@request_id,@@SPID,CURRENT_TRANSACTION_ID(),@actor_id,@operation,@payload_hash,@payload_json,@state);
END;`;}

export function stage4EffectsSQL(){return `CREATE PROCEDURE dbo.usp_stage4_copy_effects @copy_id uniqueidentifier,@request_id uniqueidentifier,@actor_id bigint,@operation nvarchar(40),@payload_hash char(64),@response_json nvarchar(max),@replay bit WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;${identity}${manifest}
EXEC dbo.usp_stage4_copy_ready @copy_id;
IF @replay=1 BEGIN
 IF NOT EXISTS(SELECT 1 FROM dbo.stage4_copy_requests WHERE copy_id=@copy_id AND request_id=@request_id AND actor_id=@actor_id AND operation=@operation AND payload_hash=@payload_hash AND response_json=@response_json) THROW 51904,'STAGE4_REPLAY_DRIFT',1;
 IF EXISTS(SELECT 1 FROM dbo.stage4_copy_effect_components e LEFT JOIN dbo.stock_movements s ON e.entity='stock' AND s.id=e.native_id LEFT JOIN dbo.customer_movements c ON e.entity='customer' AND c.id=e.native_id LEFT JOIN dbo.supplier_movements p ON e.entity='supplier' AND p.id=e.native_id LEFT JOIN dbo.finance_account_movements f ON e.entity='cash' AND f.id=e.native_id WHERE e.copy_id=@copy_id AND e.request_id=@request_id AND (e.entity NOT IN('stock','customer','supplier','cash') OR CASE e.entity WHEN 'stock' THEN CASE WHEN s.id IS NULL THEN NULL ELSE (SELECT s.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) END WHEN 'customer' THEN CASE WHEN c.id IS NULL THEN NULL ELSE (SELECT c.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) END WHEN 'supplier' THEN CASE WHEN p.id IS NULL THEN NULL ELSE (SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) END WHEN 'cash' THEN CASE WHEN f.id IS NULL THEN NULL ELSE (SELECT f.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) END END IS NULL OR ISNULL(CONVERT(varchar(64),HASHBYTES('SHA2_256',CASE e.entity WHEN 'stock' THEN (SELECT s.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) WHEN 'customer' THEN (SELECT c.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) WHEN 'supplier' THEN (SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) WHEN 'cash' THEN (SELECT f.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) END),2),'')<>CONVERT(varchar(64),HASHBYTES('SHA2_256',e.effect_json),2))) THROW 51904,'STAGE4_REPLAY_NATIVE_DRIFT',1;
 SELECT effect_proof_json FROM dbo.stage4_copy_requests WHERE copy_id=@copy_id AND request_id=@request_id;RETURN;END;
${activeIntent}
DECLARE @before nvarchar(max);SELECT @before=before_state_json FROM dbo.stage4_copy_intents WHERE copy_id=@copy_id AND request_id=@request_id AND actor_id=@actor_id AND operation=@operation AND payload_hash=@payload_hash;
IF @before IS NULL THROW 51904,'STAGE4_EFFECT_INTENT_REQUIRED',1;
IF EXISTS(SELECT 1 FROM OPENJSON(@before,'$.products') WITH(id bigint '$.id',quantity decimal(38,8) '$.quantity') b JOIN dbo.products p ON p.id=b.id OUTER APPLY(SELECT ISNULL(SUM(CONVERT(decimal(38,8),m.quantity_net)),0) effect FROM dbo.stock_movements m WHERE m.product_id=b.id AND m.affects_inventory=1 AND m.id>TRY_CONVERT(bigint,JSON_VALUE(@before,'$.maxStockId')))m WHERE CONVERT(decimal(38,8),p.current_stock_qty)<>b.quantity+m.effect) THROW 51904,'STAGE4_STOCK_EFFECT_MISMATCH',1;
IF EXISTS(SELECT 1 FROM OPENJSON(@before,'$.parties') WITH(id bigint '$.id',balance decimal(38,8) '$.balance',customerId bigint '$.customer_id',supplierId bigint '$.supplier_id') b JOIN dbo.party_currency_accounts a ON a.id=b.id OUTER APPLY(SELECT ISNULL(SUM(effect),0) effect FROM(SELECT CONVERT(decimal(38,8),m.balance_effect_exact) effect FROM dbo.customer_movements m WHERE m.party_currency_account_id=b.id AND m.id>TRY_CONVERT(bigint,JSON_VALUE(@before,'$.maxCustomerId')) AND m.affects_balance=1 UNION ALL SELECT CONVERT(decimal(38,8),m.balance_effect_exact) FROM dbo.supplier_movements m WHERE m.party_currency_account_id=b.id AND m.id>TRY_CONVERT(bigint,JSON_VALUE(@before,'$.maxSupplierId')) AND m.affects_balance=1)e)m WHERE CONVERT(decimal(38,8),a.current_balance)<>b.balance+m.effect) THROW 51904,'STAGE4_PARTY_EFFECT_MISMATCH',1;
IF EXISTS(SELECT 1 FROM dbo.customer_movements m JOIN OPENJSON(@p,'$.customers') WITH(id bigint '$.id',accountId bigint '$.accountId',partyId bigint '$.partyId',currency nvarchar(3) '$.currency') s ON s.id=m.customer_id WHERE m.id>TRY_CONVERT(bigint,JSON_VALUE(@before,'$.maxCustomerId')) AND (m.party_currency_account_id IS NULL OR m.party_currency_account_id<>s.accountId OR m.party_entity_id IS NULL OR m.party_entity_id<>s.partyId OR m.currency_code IS NULL OR m.currency_code<>s.currency OR m.balance_effect_exact IS NULL)) OR EXISTS(SELECT 1 FROM dbo.supplier_movements m JOIN OPENJSON(@p,'$.suppliers') WITH(id bigint '$.id',accountId bigint '$.accountId',partyId bigint '$.partyId',currency nvarchar(3) '$.currency') s ON s.id=m.supplier_id WHERE m.id>TRY_CONVERT(bigint,JSON_VALUE(@before,'$.maxSupplierId')) AND (m.party_currency_account_id IS NULL OR m.party_currency_account_id<>s.accountId OR m.party_entity_id IS NULL OR m.party_entity_id<>s.partyId OR m.currency_code IS NULL OR m.currency_code<>s.currency OR m.balance_effect_exact IS NULL)) THROW 51904,'STAGE4_NATIVE_ACCOUNT_LINK_MISSING',1;
IF EXISTS(SELECT 1 FROM dbo.customers c JOIN OPENJSON(@p,'$.customers') WITH(id bigint '$.id',accountId bigint '$.accountId')s ON s.id=c.id JOIN dbo.party_currency_accounts a ON a.id=s.accountId WHERE CONVERT(decimal(38,8),c.balance)<>a.current_balance) OR EXISTS(SELECT 1 FROM dbo.suppliers c JOIN OPENJSON(@p,'$.suppliers') WITH(id bigint '$.id',accountId bigint '$.accountId')s ON s.id=c.id JOIN dbo.party_currency_accounts a ON a.id=s.accountId WHERE CONVERT(decimal(38,8),c.balance)<>a.current_balance) THROW 51904,'STAGE4_MAIN_CARD_BALANCE_MISMATCH',1;
/* Finance arithmetic is checked with the native account amount, never a sum of currencies. */
IF EXISTS(SELECT 1 FROM OPENJSON(@before,'$.finance') WITH(id bigint '$.id',balance decimal(38,8) '$.balance') b JOIN dbo.finance_accounts a ON a.id=b.id OUTER APPLY(SELECT ISNULL(SUM(CASE WHEN m.direction=N'in' THEN CONVERT(decimal(38,8),m.amount) WHEN m.direction=N'out' THEN -CONVERT(decimal(38,8),m.amount) END),0) effect FROM dbo.finance_account_movements m WHERE m.account_id=b.id AND m.affects_balance=1 AND m.id>TRY_CONVERT(bigint,JSON_VALUE(@before,'$.maxFinanceId')))m WHERE CONVERT(decimal(38,8),a.current_balance)<>b.balance+m.effect) THROW 51904,'STAGE4_FINANCE_EFFECT_MISMATCH',1;
INSERT dbo.stage4_copy_effect_components(copy_id,request_id,entity,native_id,effect_json) SELECT @copy_id,@request_id,'stock',m.id,(SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) FROM dbo.stock_movements m WHERE m.id>TRY_CONVERT(bigint,JSON_VALUE(@before,'$.maxStockId'));
INSERT dbo.stage4_copy_effect_components(copy_id,request_id,entity,native_id,effect_json) SELECT @copy_id,@request_id,'customer',m.id,(SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) FROM dbo.customer_movements m WHERE m.id>TRY_CONVERT(bigint,JSON_VALUE(@before,'$.maxCustomerId'));
INSERT dbo.stage4_copy_effect_components(copy_id,request_id,entity,native_id,effect_json) SELECT @copy_id,@request_id,'supplier',m.id,(SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) FROM dbo.supplier_movements m WHERE m.id>TRY_CONVERT(bigint,JSON_VALUE(@before,'$.maxSupplierId'));
INSERT dbo.stage4_copy_effect_components(copy_id,request_id,entity,native_id,effect_json) SELECT @copy_id,@request_id,'cash',m.id,(SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) FROM dbo.finance_account_movements m WHERE m.id>TRY_CONVERT(bigint,JSON_VALUE(@before,'$.maxFinanceId'));
DECLARE @proof nvarchar(max)=(SELECT CAST(1 AS bit) valid,CONVERT(varchar(36),@copy_id) copyId,JSON_VALUE(@p,'$.sealHash') sealHash,CONVERT(varchar(36),@request_id) requestId,@actor_id actorId,@operation operation,@payload_hash payloadHash,CAST(1 AS bit) stockVerified,CAST(1 AS bit) partyAccountsVerified,CAST(1 AS bit) financeAccountsVerified,CAST(1 AS bit) protectedRowsVerified FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
UPDATE dbo.stage4_copy_intents SET response_json=@response_json,effect_proof_json=@proof WHERE copy_id=@copy_id AND request_id=@request_id AND session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID();
SELECT @proof effect_proof_json;
END;`;}

// A copy-specific adapter guard is additive. All original SQL bodies remain
// byte-for-byte after the branch. Quarantine guards retain their full bodies.
export function stage4GuardBranch(module,{quarantine=false}={}){
 if(module?.schemaName!=='dbo'||module.type_desc!=='SQL_TRIGGER'||typeof module.definition!=='string'||!module.name?.match(/^[a-zA-Z0-9_]+$/))fail('STAGE4_MODULE_INPUT');
 let definition=module.definition;
 const table=definition.match(/\bON\s+(?:\[dbo\]|dbo)\.(?:\[([a-zA-Z0-9_]+)\]|([a-zA-Z0-9_]+))/i)?.slice(1).find(Boolean);
 if(!table)fail('STAGE4_TRIGGER_TABLE_REQUIRED');
 const head=definition.match(/^(CREATE(?:\s+OR\s+ALTER)?|ALTER)\s+TRIGGER/i);if(!head)fail('STAGE4_TRIGGER_HEADER');
 definition=definition.replace(head[0],'ALTER TRIGGER');
 if(quarantine){
  const pattern=/DB_NAME\(\) COLLATE Latin1_General_100_BIN2\s*<>\s*N'MELISA_ERP_SIRKET_TEST_20260929_01'/g;
  if(!pattern.test(definition))fail('STAGE4_QUARANTINE_IDENTITY_PATTERN');pattern.lastIndex=0;
  definition=definition.replace(pattern,`(DB_NAME() COLLATE Latin1_General_100_BIN2<>N'${SOURCE_DB}' AND NOT(DB_NAME() COLLATE Latin1_General_100_BIN2=N'${COPY_DB}' AND EXISTS(SELECT 1 FROM dbo.stage4_copy_intents WHERE session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID()) AND ORIGINAL_LOGIN() COLLATE Latin1_General_100_BIN2=N'${COPY_LOGIN}'))`);
 }else{
  const opening=/\bAS\s+BEGIN\b/i;const matched=definition.match(opening);if(!matched)fail('STAGE4_TRIGGER_BODY');
  const branch=`\n/* STAGE4_COPY exact same-TX native adapter. Preserved original body follows. */\nIF DB_NAME() COLLATE Latin1_General_100_BIN2=N'${COPY_DB}' BEGIN\n DECLARE @stage4_i nvarchar(max)=(SELECT * FROM inserted FOR JSON PATH,INCLUDE_NULL_VALUES),@stage4_d nvarchar(max)=(SELECT * FROM deleted FOR JSON PATH,INCLUDE_NULL_VALUES);\n EXEC dbo.usp_stage4_copy_guard @table_name=${literal(table)},@inserted=@stage4_i,@deleted=@stage4_d;RETURN;END;\n`;
  definition=definition.replace(matched[0],matched[0]+branch);
 }
 return {name:'dbo.'+module.name,table,beforeHash:digest(module.definition),afterHash:digest(definition.replace(/^ALTER\b/i,'CREATE')),definition,kind:quarantine?'QUARANTINE_FULL_BODY':'FINITE_COPY_ADAPTER'};
}

export function immutableCopyTrigger(name,table){return `CREATE TRIGGER ${qualified(name)} ON ${qualified(table)} AFTER UPDATE,DELETE AS BEGIN SET NOCOUNT ON;IF EXISTS(SELECT 1 FROM inserted) OR EXISTS(SELECT 1 FROM deleted) THROW 51904,'STAGE4_IMMUTABLE_PROOF',1;END;`;}

export function stage4RequestGuardSQL(){return `CREATE TRIGGER dbo.stage4_copy_requests_guard ON dbo.stage4_copy_requests WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON;${identity}
IF EXISTS(SELECT 1 FROM deleted) OR (SELECT COUNT(*) FROM inserted)<>1 THROW 51904,'STAGE4_IMMUTABLE_REQUEST',1;
${activeIntent}
IF EXISTS(SELECT 1 FROM inserted i WHERE NOT EXISTS(SELECT 1 FROM dbo.stage4_copy_intents n WHERE n.copy_id=i.copy_id AND n.request_id=i.request_id AND n.actor_id=i.actor_id AND n.operation=i.operation AND n.payload_hash=i.payload_hash AND n.payload_json=i.payload_json AND n.response_json=i.response_json AND n.effect_proof_json=i.effect_proof_json AND JSON_VALUE(n.effect_proof_json,'$.valid')='true' AND n.session_id=@@SPID AND n.transaction_id=CURRENT_TRANSACTION_ID())) THROW 51904,'STAGE4_UNVERIFIED_REQUEST',1;
DELETE n FROM dbo.stage4_copy_intents n JOIN inserted i ON i.copy_id=n.copy_id AND i.request_id=n.request_id WHERE n.session_id=@@SPID AND n.transaction_id=CURRENT_TRANSACTION_ID();END;`;}

export const COPY_MUTABLE_TABLES=Object.freeze([
 'products','customers','suppliers','party_currency_accounts','finance_accounts',
 'sales_invoices','sales_invoice_items','purchase_invoices','purchase_invoice_items',
 'customer_movements','supplier_movements','finance_account_movements','stock_movements',
 'invoice_returns','invoice_return_items','audit_logs',
 'test_daily_drafts','test_daily_requests','test_stock_reversals','test_goods_batches','test_goods_batch_lines',
 'test_purchase_batch_drafts','test_purchase_batch_links','test_purchase_batch_intent_lines',
 'test_finance_requests','test_payment_requests','test_refund_requests','test_purchase_requests',
 'work_inbound_counts','work_inbound_requests','work_supplier_payment_requests',
 'work_trade_requests','work_trade_intents','work_sales_links','work_collection_links',
]);

// Trigger inputs are SQL inserted/deleted rowsets, not client JSON. Full
// immutable columns are compared; only finite selected balances may change.
export function stage4NativeGuardSQL(metadata){
 if(!Array.isArray(metadata)||!metadata.length)fail('STAGE4_NATIVE_SCHEMA_REQUIRED');
 const immutableExclusions={products:['current_stock_qty','updated_at','updated_by','row_version'],customers:['balance','updated_at','updated_by','row_version'],suppliers:['balance','updated_at','updated_by','row_version'],party_currency_accounts:['current_balance'],finance_accounts:['current_balance','balance_exact','updated_at']};
 const profileArray={products:'products',customers:'customers',suppliers:'suppliers',party_currency_accounts:'parties',finance_accounts:'financeAccounts'};
 let cases='';
 for(const table of COPY_MUTABLE_TABLES){
  const cols=metadata.filter(c=>c.schemaName==='dbo'&&c.tableName===table).map(c=>c.columnName);if(!cols.length)continue;
  const named=l=>literal(l);let checks='';
  if(immutableExclusions[table]){
   const profile=profileArray[table];
   const candidates=profile==='parties'?`SELECT accountId id FROM OPENJSON(@p,'$.customers') WITH(accountId bigint '$.accountId') UNION ALL SELECT accountId FROM OPENJSON(@p,'$.suppliers') WITH(accountId bigint '$.accountId')`:`SELECT id FROM OPENJSON(@p,'$.${profile}') WITH(id bigint '$.id')`;
   checks+=`IF (SELECT COUNT(*) FROM OPENJSON(@inserted))<>(SELECT COUNT(*) FROM OPENJSON(@deleted)) OR EXISTS(SELECT 1 FROM OPENJSON(@inserted)i WHERE NOT EXISTS(SELECT 1 FROM(${candidates})s WHERE s.id=TRY_CONVERT(bigint,JSON_VALUE(i.value,'$.id')))) THROW 51904,'STAGE4_MASTER_SCOPE',1;\n`;
   const kept=cols.filter(c=>!immutableExclusions[table].includes(c));
   checks+=`IF EXISTS(SELECT 1 FROM OPENJSON(@inserted)i LEFT JOIN OPENJSON(@deleted)d ON JSON_VALUE(i.value,'$.id')=JSON_VALUE(d.value,'$.id') WHERE d.value IS NULL OR EXISTS(SELECT 1 FROM OPENJSON(i.value)x FULL JOIN OPENJSON(d.value)y ON x.[key]=y.[key] WHERE COALESCE(x.[key],y.[key]) IN(${kept.map(named).join(',')}) AND (x.[key] IS NULL OR y.[key] IS NULL OR x.type<>y.type OR ISNULL(x.value,N'') COLLATE Latin1_General_100_BIN2<>ISNULL(y.value,N'') COLLATE Latin1_General_100_BIN2))) THROW 51904,'STAGE4_IMMUTABLE_MASTER_COLUMN',1;\n`;
  }else{
   const numericId=metadata.some(c=>c.schemaName==='dbo'&&c.tableName===table&&c.columnName==='id'&&['int','bigint'].includes(c.typeName));
   if(numericId)checks+=`IF TRY_CONVERT(bigint,JSON_VALUE(@p,'$.baselineMaxIds.${table}')) IS NULL THROW 51904,'STAGE4_HISTORY_BASELINE_REQUIRED',1;IF EXISTS(SELECT 1 FROM OPENJSON(@inserted)i WHERE TRY_CONVERT(bigint,JSON_VALUE(i.value,'$.id')) IS NULL OR TRY_CONVERT(bigint,JSON_VALUE(i.value,'$.id'))<=TRY_CONVERT(bigint,JSON_VALUE(@p,'$.baselineMaxIds.${table}'))) OR EXISTS(SELECT 1 FROM OPENJSON(@deleted)d WHERE TRY_CONVERT(bigint,JSON_VALUE(d.value,'$.id')) IS NULL OR TRY_CONVERT(bigint,JSON_VALUE(d.value,'$.id'))<=TRY_CONVERT(bigint,JSON_VALUE(@p,'$.baselineMaxIds.${table}'))) THROW 51904,'STAGE4_OLD_HISTORY_PROTECTED',1;\n`;
   else if(cols.includes('id')||cols.includes('request_id')){
    const column=cols.includes('id')?'id':'request_id';
    checks+=`IF JSON_QUERY(@p,'$.baselineRowIds.${table}') IS NULL THROW 51904,'STAGE4_HISTORY_BASELINE_REQUIRED',1;IF EXISTS(SELECT 1 FROM(SELECT value FROM OPENJSON(@inserted) UNION ALL SELECT value FROM OPENJSON(@deleted))r WHERE EXISTS(SELECT 1 FROM OPENJSON(@p,'$.baselineRowIds.${table}') b WHERE b.value COLLATE Latin1_General_100_BIN2=JSON_VALUE(r.value,'$.${column}') COLLATE Latin1_General_100_BIN2)) THROW 51904,'STAGE4_OLD_HISTORY_PROTECTED',1;\n`;
   }
   if(['test_purchase_batch_links','test_purchase_batch_intent_lines'].includes(table)){const parent=table==='test_purchase_batch_links'?'purchase_invoices':'test_purchase_batch_drafts',column=table==='test_purchase_batch_links'?'invoice_id':'draft_id';checks+=`IF TRY_CONVERT(bigint,JSON_VALUE(@p,'$.baselineMaxIds.${parent}')) IS NULL OR EXISTS(SELECT 1 FROM OPENJSON(@inserted)i WHERE TRY_CONVERT(bigint,JSON_VALUE(i.value,'$.${column}')) IS NULL OR TRY_CONVERT(bigint,JSON_VALUE(i.value,'$.${column}'))<=TRY_CONVERT(bigint,JSON_VALUE(@p,'$.baselineMaxIds.${parent}'))) THROW 51904,'STAGE4_OLD_LINK_PROTECTED',1;\n`;}
   checks+=`IF EXISTS(SELECT 1 FROM OPENJSON(@deleted)d WHERE NOT EXISTS(SELECT 1 FROM OPENJSON(@inserted)i WHERE JSON_VALUE(i.value,'$.id')=JSON_VALUE(d.value,'$.id') OR JSON_VALUE(i.value,'$.request_id')=JSON_VALUE(d.value,'$.request_id'))) THROW 51904,'STAGE4_HISTORY_DELETE_FORBIDDEN',1;\n`;
   if(cols.includes('source_record_key'))checks+=`IF EXISTS(SELECT 1 FROM OPENJSON(@inserted)i WHERE JSON_VALUE(i.value,'$.source_record_key') IS NOT NULL OR JSON_VALUE(i.value,'$.migration_run_id') IS NOT NULL) THROW 51904,'STAGE4_SOURCE_HISTORY_PROTECTED',1;\n`;
   for(const [column,array] of [['product_id','products'],['customer_id','customers'],['supplier_id','suppliers'],['account_id','financeAccounts']]){
    if(cols.includes(column))checks+=`IF EXISTS(SELECT 1 FROM OPENJSON(@inserted)i WHERE JSON_VALUE(i.value,'$.${column}') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM OPENJSON(@p,'$.${array}') WITH(id bigint '$.id')s WHERE s.id=TRY_CONVERT(bigint,JSON_VALUE(i.value,'$.${column}')))) THROW 51904,'STAGE4_ENTITY_OUTSIDE_SCOPE',1;\n`;
   }
   if(cols.includes('currency_code'))checks+=`IF EXISTS(SELECT 1 FROM OPENJSON(@inserted)i WHERE JSON_VALUE(i.value,'$.currency_code') IS NOT NULL AND JSON_VALUE(i.value,'$.currency_code')<>N'TRY') THROW 51904,'STAGE4_CURRENCY_SCOPE',1;\n`;
   if(cols.includes('created_by'))checks+=`IF EXISTS(SELECT 1 FROM OPENJSON(@inserted)i WHERE JSON_VALUE(i.value,'$.created_by') IS NOT NULL AND TRY_CONVERT(bigint,JSON_VALUE(i.value,'$.created_by'))<>@actor) THROW 51904,'STAGE4_ACTOR_SCOPE',1;\n`;
   if(['stock_movements','customer_movements','supplier_movements','finance_account_movements'].includes(table)){
    const updateFields=table==='customer_movements'||table==='supplier_movements'?['party_entity_id','party_currency_account_id','balance_effect_exact','affects_balance']:[];
    const kept=cols.filter(c=>!updateFields.includes(c));
    checks+=`IF EXISTS(SELECT 1 FROM OPENJSON(@inserted)i JOIN OPENJSON(@deleted)d ON JSON_VALUE(i.value,'$.id')=JSON_VALUE(d.value,'$.id') WHERE EXISTS(SELECT 1 FROM OPENJSON(i.value)x FULL JOIN OPENJSON(d.value)y ON x.[key]=y.[key] WHERE COALESCE(x.[key],y.[key]) IN(${kept.map(named).join(',')}) AND (x.[key] IS NULL OR y.[key] IS NULL OR x.type<>y.type OR ISNULL(x.value,N'') COLLATE Latin1_General_100_BIN2<>ISNULL(y.value,N'') COLLATE Latin1_General_100_BIN2))) THROW 51904,'STAGE4_LEDGER_AMOUNT_IMMUTABLE',1;\n`;
   }
  }
  cases+=`IF @table_name=${literal(table)} BEGIN ${checks}RETURN;END;\n`;
 }
 return `CREATE PROCEDURE dbo.usp_stage4_copy_guard @table_name sysname,@inserted nvarchar(max),@deleted nvarchar(max) WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;${identity}\n${activeIntent}\nDECLARE @p nvarchar(max),@actor bigint;SELECT @p=m.profile_json,@actor=n.actor_id FROM dbo.stage4_copy_intents n JOIN dbo.stage4_copy_manifest m ON m.copy_id=n.copy_id WHERE n.session_id=@@SPID AND n.transaction_id=CURRENT_TRANSACTION_ID() AND m.sealed=1;\nIF ISJSON(@inserted)<>1 OR ISJSON(@deleted)<>1 THROW 51904,'STAGE4_TRIGGER_ROWSETS_REQUIRED',1;\n${cases}THROW 51904,'STAGE4_TABLE_OUTSIDE_OPERATION_SCOPE',1;END;`;
}

export function stage4ReadProcedure(module,preservedGuardHash,guardChanges=[]){
 if(module?.schemaName!=='dbo'||module.type_desc!=='SQL_STORED_PROCEDURE'
   ||!/^usp_(read_work_catalog|read_stock_products|get_source_version_prices|list_source_version_products)_product_4161d6d9_0716_469e_8c67_c165a20fa674_r3$/.test(module.name)
   ||!module.definition?.includes("N'"+SOURCE_DB+"'")||!/^[A-F0-9]{64}$/.test(preservedGuardHash))fail('STAGE4_READ_PROCEDURE_SCOPE');
 const original=module.definition;
 let definition=original.replace(/^CREATE(?:\s+OR\s+ALTER)?\s+PROCEDURE/i,'ALTER PROCEDURE');
 // These four established readers retain all source/index/binding/permission
 // checks. Only their verified target and copy guard digest are different.
 definition=definition.replaceAll("N'"+SOURCE_DB+"'","N'"+COPY_DB+"'")
  .replaceAll('9AE41CA1AB25EE165019AD04DBD9A6FB4E5B7190F027E0A07A87FB03D698379E',preservedGuardHash);
 for(const changed of guardChanges){
  if(!/^dbo\.[a-zA-Z0-9_]+$/.test(changed.name??'')||!/^[A-F0-9]{64}$/.test(changed.beforeHash??'')||!/^[A-F0-9]{64}$/.test(changed.afterHash??''))fail('STAGE4_READER_GUARD_MAPPING');
  definition=definition.replaceAll(changed.beforeHash,changed.afterHash);
 }
 // Retain immutable legacy receipts, including their exact old hash witness.
 // A copy pin substitutes only the matching module and matching before hash.
 definition=definition.replace(/m\.(after_hash|definition_hash)(?=<>CONVERT\(varchar\(64\),HASHBYTES\('SHA2_256',OBJECT_DEFINITION)/g,(_match,column)=>`COALESCE((SELECT p.after_hash FROM dbo.stage4_copy_module_manifest p WHERE p.name=N'dbo.'+m.name AND p.before_hash=m.${column}),m.${column})`);
 const opening=/\bAS\s+BEGIN\b/i;
 if(!opening.test(definition))fail('STAGE4_READ_PROCEDURE_BODY');
 definition=definition.replace(opening,m=>m+`\nDECLARE @stage4_reader_copy uniqueidentifier;SELECT @stage4_reader_copy=copy_id FROM dbo.stage4_copy_manifest WHERE sealed=1;EXEC dbo.usp_stage4_copy_ready @stage4_reader_copy;\n`);
 return {name:'dbo.'+module.name,beforeHash:digest(original),afterHash:digest(definition.replace(/^ALTER\b/i,'CREATE')),definition,kind:'PRESERVED_COPY_READER'};
}
