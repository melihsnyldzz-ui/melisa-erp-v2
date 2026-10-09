// Pure companion builder: the existing V2 writer/replay algorithm is reused.
// This module cannot connect, migrate a source, install SQL or start a listener.
import {createHash} from 'node:crypto';
import {buildCrmV2Procedures,buildCrmV2Guards,CRM_V2_TARGET_SQL,CRM_V2_READY_SQL,CRM_V2_PRODUCT_PROOF_SQL} from './crm-order-v2-sql.mjs';
import {CUSTOMER_CARD_READY_SQL} from '../../apps/api/src/services/customerCardReadStore.mjs';
import {assertCrmOrderCurrentContext,CRM_SHARED_SOURCE_DATABASE,CRM_CURRENT_PROCEDURES,crmOrderCurrentSource,crmOrderCurrentSourceHash} from '../../apps/api/src/services/crmOrderCurrentContext.mjs';
import {SOURCE_VERSION_TABLES,sourceVersionImmutableSql} from '../migration/goal7-source-version.mjs';
const q=v=>"N'"+v.replaceAll("'","''")+"'";
const hash=v=>createHash('sha256').update(v,'utf16le').digest('hex').toUpperCase();
const originalGuardHash='9AE41CA1AB25EE165019AD04DBD9A6FB4E5B7190F027E0A07A87FB03D698379E';
function target(context,requireLogin=true){const t=assertCrmOrderCurrentContext(context).target;return `IF DB_NAME() COLLATE Latin1_General_100_BIN2<>${q(t.database)} OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2<>${q(t.server)}${requireLogin?` OR ORIGINAL_LOGIN() COLLATE Latin1_General_100_BIN2<>${q(t.login)}`:''} THROW 51200,'CRM_V2_TARGET_UNAVAILABLE',1;`;}
const registryReady=`IF (SELECT COUNT(*) FROM dbo.crm_order_current_definitions WITH(HOLDLOCK))<>5 OR EXISTS(SELECT 1 FROM dbo.crm_order_current_definitions d WITH(HOLDLOCK) WHERE OBJECT_DEFINITION(OBJECT_ID(N'dbo.'+d.name)) IS NULL OR d.definition_hash<>CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.'+d.name))),2) OR (OBJECTPROPERTY(OBJECT_ID(N'dbo.'+d.name),'IsTrigger')=1 AND OBJECTPROPERTY(OBJECT_ID(N'dbo.'+d.name),'ExecIsTriggerDisabled')<>0)) THROW 51207,'CRM_V2_NOT_READY',1;`;
export function crmOrderCurrentReadySql(context){
 const c=assertCrmOrderCurrentContext(context).catalog;
 const party=CUSTOMER_CARD_READY_SQL.replaceAll(CRM_SHARED_SOURCE_DATABASE,context.target.database).replaceAll(originalGuardHash,context.quarantineGuardHash.toUpperCase());
 const immutable=Object.values(SOURCE_VERSION_TABLES).map(table=>{const name='erp_migration.immutable_'+table.split('.')[1];return `IF OBJECT_DEFINITION(OBJECT_ID(${q(name)})) IS NULL OR CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(${q(name)}))),2)<>'${hash(sourceVersionImmutableSql(table))}' OR OBJECTPROPERTY(OBJECT_ID(${q(name)}),'ExecIsTriggerDisabled')<>0 THROW 51207,'CRM_V2_NOT_READY',1;`;}).join('\n');
 return `${target(context)}\n${party}\n${immutable}
IF NOT EXISTS(SELECT 1 FROM erp_migration.goal7_source_version_manifest WITH(HOLDLOCK) WHERE run_id=${q(c.runId)} AND source_hash='${c.sourceHash}' AND plan_hash='${c.planHash}' AND bindings_hash='${c.bindingsHash}' AND source_as_of=${q(c.sourceAsOf)} AND product_count=${c.productCount} AND price_count=${c.priceCount} AND sealed=1) OR (SELECT COUNT(*) FROM erp_migration.goal7_source_version_products WITH(HOLDLOCK) WHERE version_run_id=${q(c.runId)})<>${c.productCount} OR (SELECT COUNT(*) FROM erp_migration.goal7_source_version_prices WITH(HOLDLOCK) WHERE version_run_id=${q(c.runId)})<>${c.priceCount} THROW 51207,'CRM_V2_NOT_READY',1;
${registryReady}\n${writerGuards(context)}`;
}
const writerGuards=context=>Object.entries(buildCrmV2Guards()).map(([name,body])=>`IF OBJECT_DEFINITION(OBJECT_ID(N'dbo.${name}')) IS NULL OR CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'dbo.${name}'))),2)<>'${hash(body.replaceAll(CRM_SHARED_SOURCE_DATABASE,context.target.database))}' OR OBJECTPROPERTY(OBJECT_ID(N'dbo.${name}'),'ExecIsTriggerDisabled')<>0 THROW 51207,'CRM_V2_NOT_READY',1;`).join('\n');
export function crmOrderLegacyGuardRebinds(context){assertCrmOrderCurrentContext(context);return Object.entries(buildCrmV2Guards()).map(([name,body])=>({name:'dbo.'+name,beforeHash:hash(body),afterHash:hash(body.replaceAll(CRM_SHARED_SOURCE_DATABASE,context.target.database)),definition:body.replaceAll(CRM_SHARED_SOURCE_DATABASE,context.target.database)}));}
export function crmOrderLegacyGuardRebindSql(context){const guards=crmOrderLegacyGuardRebinds(context);return `${target(context,false)}
IF @@TRANCOUNT=0 THROW 51207,'CRM_COPY_REBIND_TRANSACTION_REQUIRED',1;
IF (SELECT COUNT(*) FROM dbo.crm_order_v2_requests)<>5 OR (SELECT COUNT(*) FROM dbo.crm_order_v2_lines)<>9 THROW 51207,'CRM_COPY_LEGACY_BASELINE_CHANGED',1;
${guards.map(g=>`IF OBJECT_ID(${q(g.name)},N'TR') IS NULL OR OBJECTPROPERTY(OBJECT_ID(${q(g.name)}),'ExecIsTriggerDisabled')<>0 OR CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(${q(g.name)}))),2)<>'${g.beforeHash}' THROW 51207,'CRM_COPY_LEGACY_GUARD_BEFORE_DRIFT',1;`).join('\n')}
${guards.filter(g=>g.beforeHash!==g.afterHash).map((g,i)=>`DECLARE @firstI${i} int=OBJECTPROPERTY(OBJECT_ID(${q(g.name)}),'ExecIsFirstInsertTrigger'),@firstU${i} int=OBJECTPROPERTY(OBJECT_ID(${q(g.name)}),'ExecIsFirstUpdateTrigger'),@firstD${i} int=OBJECTPROPERTY(OBJECT_ID(${q(g.name)}),'ExecIsFirstDeleteTrigger'),@lastI${i} int=OBJECTPROPERTY(OBJECT_ID(${q(g.name)}),'ExecIsLastInsertTrigger'),@lastU${i} int=OBJECTPROPERTY(OBJECT_ID(${q(g.name)}),'ExecIsLastUpdateTrigger'),@lastD${i} int=OBJECTPROPERTY(OBJECT_ID(${q(g.name)}),'ExecIsLastDeleteTrigger');
DROP TRIGGER ${g.name};EXEC sys.sp_executesql ${q(g.definition)};
IF @firstI${i}=1 EXEC sys.sp_settriggerorder @triggername=${q(g.name)},@order=N'First',@stmttype=N'INSERT';
IF @firstU${i}=1 EXEC sys.sp_settriggerorder @triggername=${q(g.name)},@order=N'First',@stmttype=N'UPDATE';
IF @firstD${i}=1 EXEC sys.sp_settriggerorder @triggername=${q(g.name)},@order=N'First',@stmttype=N'DELETE';
IF @lastI${i}=1 EXEC sys.sp_settriggerorder @triggername=${q(g.name)},@order=N'Last',@stmttype=N'INSERT';
IF @lastU${i}=1 EXEC sys.sp_settriggerorder @triggername=${q(g.name)},@order=N'Last',@stmttype=N'UPDATE';
IF @lastD${i}=1 EXEC sys.sp_settriggerorder @triggername=${q(g.name)},@order=N'Last',@stmttype=N'DELETE';`).join('\n')}
${writerGuards(context)}
IF (SELECT COUNT(*) FROM dbo.crm_order_v2_requests)<>5 OR (SELECT COUNT(*) FROM dbo.crm_order_v2_lines)<>9 THROW 51207,'CRM_COPY_LEGACY_BASELINE_CHANGED',1;`;}
export function crmOrderCurrentProductProofSql(context){
 const c=assertCrmOrderCurrentContext(context).catalog;
 const stages='(SELECT run_id,entity,source_key,payload_hash,payload_json FROM erp_migration.records UNION SELECT run_id,entity,source_key,payload_hash,payload_json FROM erp_migration.goal7_source_version_records)';
 let proof=CRM_V2_PRODUCT_PROOF_SQL
  .replace('erp_migration.accepted_price_products b','erp_migration.goal7_source_version_products b')
  .replace('erp_migration.accepted_price_values v','erp_migration.goal7_source_version_prices v')
  .replace("JOIN erp_migration.records r WITH(HOLDLOCK) ON r.run_id=N'VEGA-OPENING-TEST-20261004-06' AND r.entity=N'products' AND r.source_key=b.product_source_key",`JOIN ${stages} r ON r.run_id=b.lineage_run_id AND r.entity=N'products' AND r.source_key=b.lineage_source_key`)
  .replace("JOIN erp_migration.records pr WITH(HOLDLOCK) ON pr.run_id=N'VEGA-OPENING-TEST-20261004-06' AND pr.entity=N'prices' AND pr.source_key=v.price_source_key",`JOIN ${stages} pr ON pr.run_id=v.lineage_run_id AND pr.entity=N'prices' AND pr.source_key=v.lineage_source_key`)
  .replace("WHERE p.is_active=1",`WHERE b.version_run_id=${q(c.runId)} AND v.version_run_id=b.version_run_id AND (${c.ancestry.map(a=>`(b.lineage_run_id=${q(a.runId)} AND b.lineage_source_as_of=${q(a.sourceAsOf)})`).join(' OR ')}) AND v.lineage_run_id IN(${c.ancestry.map(a=>q(a.runId)).join(',')}) AND p.is_active=1`)
  .replace("AND b.product_source_key=N'VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/'+b.source_id", "AND (b.product_source_key=N'VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/'+b.source_id OR b.product_source_key=N'VEGA2026/F0102/TBLSTOKLAR/'+b.source_id) AND b.native_source_key=N'VEGA2026/F0102TBLSTOKLAR/'+b.source_id")
  .replace('FROM erp_migration.accepted_price_values z WITH(HOLDLOCK) WHERE z.product_id=p.id',`FROM erp_migration.goal7_source_version_prices z WITH(HOLDLOCK) WHERE z.version_run_id=${q(c.runId)} AND z.product_id=p.id`);
 if(proof.includes('erp_migration.accepted_price_')||proof.includes("r.run_id=N'VEGA-OPENING-TEST-20261004-06'"))throw Error('CRM_CURRENT_SQL_REUSE_BOUNDARY');
 return proof;
}
export function buildCrmOrderCurrentProcedures(context){
 assertCrmOrderCurrentContext(context);const sourceJSON=JSON.stringify(crmOrderCurrentSource(context));
 const rename=sql=>sql.replaceAll('dbo.usp_test_crm_order_v2_customers',CRM_CURRENT_PROCEDURES.customers).replaceAll('dbo.usp_test_crm_order_v2_create',CRM_CURRENT_PROCEDURES.create).replaceAll('dbo.usp_test_crm_order_v2_read',CRM_CURRENT_PROCEDURES.read);
 const out={};for(const [name,sql]of Object.entries(buildCrmV2Procedures())){
  let text=rename(sql.replaceAll(CRM_V2_READY_SQL,crmOrderCurrentReadySql(context)).replaceAll(CRM_V2_TARGET_SQL,target(context)).replaceAll(CRM_V2_PRODUCT_PROOF_SQL,crmOrderCurrentProductProofSql(context)))
   .replace('@actor_id bigint,@crm_actor_id nvarchar(80),','@actor_id bigint,@crm_actor_id nvarchar(80),@source_context_hash char(64),')
   .replace('WITH EXECUTE AS OWNER AS BEGIN',`WITH EXECUTE AS OWNER AS BEGIN IF @source_context_hash IS NULL OR @source_context_hash<>'${crmOrderCurrentSourceHash(context)}' THROW 51207,'CRM_V2_NOT_READY',1;`)
   .replaceAll(`EXEC ${CRM_CURRENT_PROCEDURES.read} @actor_id,@crm_actor_id,@request_id`, `EXEC ${CRM_CURRENT_PROCEDURES.read} @actor_id=@actor_id,@crm_actor_id=@crm_actor_id,@source_context_hash=@source_context_hash,@request_id=@request_id`);
  if(name.endsWith('_customers'))text=text.replace('SELECT (SELECT @phone phone,',`SELECT (SELECT JSON_QUERY(${q(sourceJSON)}) currentSource,@phone phone,`);
  if(name.endsWith('_create'))text=text.replace('DELETE dbo.crm_order_v2_intents WHERE request_id=@request_id',`INSERT dbo.crm_order_current_sources(request_id,source_json,source_hash) VALUES(@request_id,${q(sourceJSON)},'${hash(sourceJSON)}');\nDELETE dbo.crm_order_v2_intents WHERE request_id=@request_id`);
  if(name.endsWith('_read'))text=text.replace('SELECT (SELECT JSON_QUERY(@body) request,',`${registryReady}\n${writerGuards(context)}\nIF EXISTS(SELECT 1 FROM dbo.crm_order_current_sources s WITH(HOLDLOCK) WHERE s.request_id=@request_id AND (ISJSON(s.source_json)<>1 OR CONVERT(char(64),HASHBYTES('SHA2_256',s.source_json),2)<>s.source_hash)) THROW 51207,'CRM_V2_NOT_READY',1;\nSELECT (SELECT JSON_QUERY((SELECT s.source_json FROM dbo.crm_order_current_sources s WHERE s.request_id=@request_id)) currentSource,JSON_QUERY(@body) request,`);
  out[CRM_CURRENT_PROCEDURES[name.endsWith('_customers')?'customers':name.endsWith('_create')?'create':'read'].slice(4)]=text;
 }
 return out;
}
export function buildCrmOrderCurrentGuards(context){
 assertCrmOrderCurrentContext(context);const sourceJSON=JSON.stringify(crmOrderCurrentSource(context));
 return {crm_order_current_sources_immutable:`CREATE TRIGGER dbo.crm_order_current_sources_immutable ON dbo.crm_order_current_sources WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON;${target(context)}
IF EXISTS(SELECT 1 FROM deleted) OR EXISTS(SELECT 1 FROM inserted i WHERE CONVERT(varbinary(max),i.source_json)<>CONVERT(varbinary(max),${q(sourceJSON)}) OR i.source_hash<>'${hash(sourceJSON)}' OR NOT EXISTS(SELECT 1 FROM dbo.crm_order_v2_intents n JOIN dbo.crm_order_v2_requests r ON r.request_id=n.request_id WHERE n.request_id=i.request_id AND n.session_id=@@SPID AND n.actor_id=r.actor_id AND CONVERT(varbinary(max),n.crm_actor_id)=CONVERT(varbinary(max),r.crm_actor_id) AND n.order_id=r.order_id AND n.payload_hash=r.payload_hash AND CONVERT(varbinary(max),n.body_json)=CONVERT(varbinary(max),r.body_json))) THROW 51207,'CRM_V2_NOT_READY',1;END;`,
 crm_order_current_definitions_immutable:`CREATE TRIGGER dbo.crm_order_current_definitions_immutable ON dbo.crm_order_current_definitions WITH EXECUTE AS OWNER AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON;IF EXISTS(SELECT 1 FROM inserted) OR EXISTS(SELECT 1 FROM deleted) THROW 51207,'CRM_V2_NOT_READY',1;END;`};
}
export function buildCrmOrderCurrentInstallSql(context){
 assertCrmOrderCurrentContext(context);const definitions={...buildCrmOrderCurrentProcedures(context),...buildCrmOrderCurrentGuards(context)},user=context.target.databaseUser;
 return `${target(context,false)}
SET XACT_ABORT ON;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;BEGIN TRY BEGIN TRANSACTION;
IF HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL')<>1 THROW 51207,'CRM_V2_INSTALL_OWNER_REQUIRED',1;
IF OBJECT_ID(N'dbo.crm_order_current_definitions',N'U') IS NOT NULL BEGIN ${registryReady} IF EXISTS(SELECT 1 FROM(VALUES ${Object.entries(definitions).map(([name,sql])=>`(${q(name)},'${hash(sql)}')`).join(',')}) expected(name,definition_hash) LEFT JOIN dbo.crm_order_current_definitions actual ON actual.name=expected.name WHERE actual.name IS NULL OR actual.definition_hash<>expected.definition_hash) THROW 51207,'CRM_V2_NOT_READY',1;COMMIT;SELECT N'NOOP' result;RETURN;END;
IF OBJECT_ID(N'dbo.crm_order_v2_requests',N'U') IS NULL OR OBJECT_ID(N'dbo.crm_order_v2_intents',N'U') IS NULL OR OBJECT_ID(N'dbo.crm_order_v2_lines',N'U') IS NULL OR DATABASE_PRINCIPAL_ID(${q(user)}) IS NULL THROW 51207,'CRM_V2_NOT_READY',1;
IF EXISTS(SELECT 1 FROM sys.objects WHERE name LIKE N'crm[_]order[_]current[_]%' OR name LIKE N'usp[_]shared[_]crm[_]order[_]%') THROW 51207,'CRM_V2_PARTIAL_INSTALL',1;
CREATE TABLE dbo.crm_order_current_definitions(name sysname PRIMARY KEY,definition_hash char(64) NOT NULL);
CREATE TABLE dbo.crm_order_current_sources(request_id uniqueidentifier PRIMARY KEY REFERENCES dbo.crm_order_v2_requests(request_id),source_json nvarchar(max) NOT NULL CHECK(ISJSON(source_json)=1),source_hash char(64) NOT NULL);
${Object.entries(definitions).map(([name,sql])=>`INSERT dbo.crm_order_current_definitions VALUES(${q(name)},'${hash(sql)}');`).join('\n')}
${Object.values(definitions).map(sql=>`EXEC sys.sp_executesql ${q(sql)};`).join('\n')}
${['dbo.crm_order_current_definitions','dbo.crm_order_current_sources','dbo.crm_order_v2_intents','dbo.crm_order_v2_requests','dbo.crm_order_v2_lines','dbo.sales_orders','dbo.sales_order_items'].map(table=>`DENY SELECT,INSERT,UPDATE,DELETE ON OBJECT::${table} TO [${user}];`).join('\n')}
${Object.values(CRM_CURRENT_PROCEDURES).map(name=>`GRANT EXECUTE ON OBJECT::${name} TO [${user}];`).join('\n')}
COMMIT;SELECT N'INSTALLED' result;END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK;THROW;END CATCH;`;
}
export function buildCrmOrderCurrentDisableSql(context){
 assertCrmOrderCurrentContext(context);return `${target(context,false)}\nSET XACT_ABORT ON;BEGIN TRY BEGIN TRANSACTION;${registryReady}\n${Object.values(CRM_CURRENT_PROCEDURES).map(name=>`REVOKE EXECUTE ON OBJECT::${name} FROM [${context.target.databaseUser}];`).join('\n')}\nCOMMIT;SELECT N'CURRENT_DISABLED_HISTORY_PRESERVED' result;END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK;THROW;END CATCH;`;
}
