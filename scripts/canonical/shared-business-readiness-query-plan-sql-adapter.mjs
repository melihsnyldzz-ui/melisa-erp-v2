// Source-only SQL adapter. No connection/provision/restore, credentials, CLI,
// commit, shared-copy config or default pool. A separate proof clone is required.
import {createHash} from 'node:crypto';
import {moduleHash} from './stage4-copy-sql.mjs';
import {isolatedCopyHash} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {readinessProofTarget,validateReadinessQueryPlanPreparation,READINESS_PROOF_DATABASE,READINESS_PROOF_LOGIN,QUERY_PLAN_REGISTRY,QUERY_PLAN_TRIGGER} from './shared-business-readiness-query-plan-revision.mjs';
import {READINESS_PROOF_NEGATIVE_LAYERS} from './shared-business-readiness-query-plan-isolated.mjs';
// Eleven requirements are retained. Three need their actual actor/effects/hold
// contracts; six source fixtures need an intentional, reviewed binding accepted
// by historical guards. No binding is enabled by default. Two exact records
// fixture bindings can be built explicitly below; seven still need contracts.
export const UNSUPPORTED_READINESS_PROBES=Object.freeze(['party_hold','permission_drift','stock_drift','party_currency','party_identity','missing_source_account','unknown_balance','ll_account','price_drift']);
const unsupportedCodes=Object.freeze({party_hold:'READINESS_SQL_HOLD_FIXTURE_REQUIRED',permission_drift:'READINESS_SQL_ACTOR_CONTEXT_REQUIRED',stock_drift:'READINESS_SQL_STOCK_EFFECTS_REQUIRED',...Object.fromEntries(UNSUPPORTED_READINESS_PROBES.slice(3).map(k=>[k,'READINESS_SQL_PROTECTED_FIXTURE_BINDING_REQUIRED_'+k]))});
// Schema names only: existing FINAL04 writer-owned-check-rehearsal-v03,
// SHA256 f8380ac44c9d384ce7e50ce3883f77bb8227f7041b50a763ec68f87a7a72a9c1.
// Its 51 business + 11 historic proof tables are a required floor. All later
// current tables are ALSO hashed; this is not an assertion of only 62 tables.
export const READINESS_REQUIRED_TABLES=Object.freeze([
 'dbo.audit_logs','dbo.crm_order_v2_intents','dbo.crm_order_v2_lines','dbo.crm_order_v2_requests','dbo.customer_movements','dbo.customer_route_assignments','dbo.customer_routes','dbo.customers','dbo.finance_account_movements','dbo.finance_accounts','dbo.invoice_return_items','dbo.invoice_returns','dbo.party_currency_accounts','dbo.party_entities','dbo.party_source_links','dbo.permissions','dbo.product_barcodes','dbo.product_prices','dbo.product_source_aliases','dbo.products','dbo.purchase_invoice_items','dbo.purchase_invoices','dbo.roles','dbo.sales_invoice_items','dbo.sales_invoices','dbo.sales_order_items','dbo.sales_orders','dbo.stage4_copy_business_daily_profit_revisions','dbo.stage4_copy_business_daily_revisions','dbo.stage4_copy_effect_components','dbo.stage4_copy_effects_performance_revisions','dbo.stage4_copy_intents','dbo.stage4_copy_manifest','dbo.stage4_copy_module_manifest','dbo.stage4_copy_ready_performance_revisions','dbo.stage4_copy_ready_revisions','dbo.stage4_copy_requests','dbo.stock_movements','dbo.supplier_movements','dbo.suppliers','dbo.terminal_device_customer_routes','dbo.terminal_devices','dbo.test_daily_drafts','dbo.test_daily_requests','dbo.users','dbo.work_business_count_bindings','dbo.work_collection_links','dbo.work_inbound_counts','dbo.work_inbound_requests','dbo.work_sales_links','dbo.work_supplier_payment_requests','dbo.work_trade_intents','dbo.work_trade_requests','erp_migration.accepted_price_manifest','erp_migration.accepted_price_products','erp_migration.accepted_price_values','erp_migration.goal7_source_version_manifest','erp_migration.goal7_source_version_prices','erp_migration.goal7_source_version_products','erp_migration.operation_quarantine_holds','erp_migration.product_last_purchase_rows','erp_migration.product_purchase_reference_rows'
]);
const SHARED='MELISA_ERP_CRM_SHARED_TEST_20261009_02',SERVER='Semih\\MELISADEV',NAME='dbo.usp_stage4_copy_ready',COPY='e16b70f0-4057-428b-9abc-6bbcaf35fe82';
const check=(v,c)=>{if(!v)throw Error(c);};
const hex=v=>typeof v==='string'&&/^[A-F0-9]{64}$/.test(v);
const safeTable=x=>/^(dbo|erp_migration)\.[A-Za-z][A-Za-z0-9_]*$/.test(x);
// Snapshot identifiers come only from sys.tables/sys.schemas. Keep the two
// parts separate: periods, Unicode, spaces and closing brackets are legal.
// Binding/execution pins deliberately retain their narrow safeTable contract.
const metadataIdentifier=x=>typeof x==='string'&&x.length>0&&x.length<=128&&!x.includes('\0');
const quoteIdentifier=x=>'['+x.replaceAll(']',']]')+']';
const quoteTable=(schemaName,tableName)=>quoteIdentifier(schemaName)+'.'+quoteIdentifier(tableName);
const permissionTables=new Set(['users','roles','permissions','role_permissions','user_permissions','user_roles']);
export const READINESS_ADAPTER_IDENTITY_SQL=`SELECT CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,DB_NAME() databaseName,ORIGINAL_LOGIN() originalLogin,IS_ROLEMEMBER(N'db_owner') dbOwner,IS_SRVROLEMEMBER(N'sysadmin') sysadmin,HAS_DBACCESS(N'${SHARED}') accessShared,HAS_DBACCESS(N'MELISA_ERP_SIRKET_TEST_20260929_01') accessTest125,HAS_DBACCESS(N'MELISA_ERP_PROD_CANDIDATE_20260917_01') accessLive,@@TRANCOUNT transactionCount,@@SPID spid,
 (SELECT CONVERT(varchar(36),copy_id) FROM dbo.stage4_copy_manifest WHERE sealed=1) copyId,(SELECT JSON_VALUE(profile_json,'$.actualT1') FROM dbo.stage4_copy_manifest WHERE sealed=1) actualT1,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${NAME}'))),2) definitionHash;`;
export const READINESS_ADAPTER_TABLE_SQL=`SELECT s.name schemaName,t.name tableName FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE t.is_ms_shipped=0 ORDER BY s.name,t.name;`;
export const READINESS_ADAPTER_SCHEMA_SQL=`SELECT o.object_id id,s.name+N'.'+o.name name,o.type,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(o.object_id)),2) definitionHash,CONVERT(int,OBJECTPROPERTY(o.object_id,'ExecIsTriggerDisabled')) triggerDisabled FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id WHERE o.is_ms_shipped=0 ORDER BY s.name,o.name,o.type;
SELECT c.object_id,c.column_id,c.name,c.system_type_id,c.user_type_id,c.max_length,c.precision,c.scale,c.is_nullable,c.is_identity,c.is_computed FROM sys.columns c JOIN sys.objects o ON o.object_id=c.object_id WHERE o.is_ms_shipped=0 ORDER BY c.object_id,c.column_id;
SELECT i.object_id,i.index_id,i.name,i.type,i.is_unique,i.is_disabled,i.filter_definition,(SELECT c.column_id,c.index_column_id,c.key_ordinal,c.is_descending_key,c.is_included_column FROM sys.index_columns c WHERE c.object_id=i.object_id AND c.index_id=i.index_id ORDER BY c.index_column_id FOR JSON PATH,INCLUDE_NULL_VALUES) indexColumns FROM sys.indexes i WHERE i.object_id IN(SELECT object_id FROM sys.tables WHERE is_ms_shipped=0) ORDER BY i.object_id,i.index_id;
SELECT o.parent_object_id,o.object_id,o.type,c.is_disabled,c.is_not_trusted,f.referenced_object_id,f.delete_referential_action,f.update_referential_action,COALESCE(f.is_not_for_replication,k.is_not_for_replication) is_not_for_replication,
 (SELECT fc.constraint_column_id,fc.parent_object_id,fc.parent_column_id,fc.referenced_object_id,fc.referenced_column_id FROM sys.foreign_key_columns fc WHERE fc.constraint_object_id=o.object_id ORDER BY fc.constraint_column_id FOR JSON PATH,INCLUDE_NULL_VALUES) foreignKeyColumns
FROM sys.objects o LEFT JOIN (SELECT object_id,is_disabled,is_not_trusted FROM sys.check_constraints UNION ALL SELECT object_id,is_disabled,is_not_trusted FROM sys.foreign_keys)c ON c.object_id=o.object_id LEFT JOIN sys.foreign_keys f ON f.object_id=o.object_id LEFT JOIN sys.check_constraints k ON k.object_id=o.object_id WHERE o.type IN('C','F') AND o.is_ms_shipped=0 ORDER BY o.object_id;`;
export const READINESS_ADAPTER_PERMISSION_SQL=`SELECT class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type,state FROM sys.database_permissions ORDER BY class,major_id,minor_id,grantee_principal_id,type;
SELECT role_principal_id,member_principal_id FROM sys.database_role_members ORDER BY role_principal_id,member_principal_id;
SELECT principal_id,name,type,authentication_type,default_schema_name FROM sys.database_principals WHERE principal_id>4 ORDER BY principal_id;`;
const guardCode=e=>{for(const value of [e?.message,e?.originalError?.info?.message,...(e?.precedingErrors??[]).map(x=>x.message)])if(typeof value==='string'&&/^[A-Z][A-Z0-9_]+$/.test(value))return value;return null;};
const sourceRun='VEGA-OPENING-TEST-20261004-06';
const rowSqlHash="CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT r.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)";
// Data-only reviewed fixture input. This factory neither discovers a row nor
// connects to SQL. All pins are rechecked on the owned SERIALIZABLE transaction.
// Both negatives exercise the composite witness guard; UNKNOWN also invalidates
// the sealed payload hash, so it cannot prove the balance-only branch separately.
export function createReadinessSourceWitnessBindings({bundle,fixture}={}){
 validateReadinessQueryPlanPreparation(bundle);
 const keys=['schemaVersion','copyId','baseSealHash','profileSqlHash','role','id','accountId','currency','sourceKey','sourceWitnessHash','recordSourceKey','recordSqlHash'];
 check(fixture&&Object.keys(fixture).sort().join(',')===keys.sort().join(',')&&fixture.schemaVersion==='melisa-readiness-source-witness-fixture.v1'&&fixture.copyId===COPY&&fixture.baseSealHash===bundle?.revision?.baseSealHash&&['baseSealHash','profileSqlHash','recordSqlHash'].every(k=>hex(fixture[k]))&&['customer','supplier'].includes(fixture.role)&&['id','accountId'].every(k=>typeof fixture[k]==='string'&&/^[1-9][0-9]{0,17}$/.test(fixture[k]))&&['TRY','USD','EUR'].includes(fixture.currency)&&typeof fixture.sourceWitnessHash==='string'&&/^[A-Fa-f0-9]{64}$/.test(fixture.sourceWitnessHash)&&typeof fixture.recordSourceKey==='string'&&fixture.recordSourceKey.length>0&&fixture.recordSourceKey.length<=400&&!fixture.recordSourceKey.includes('\0'),'READINESS_SQL_SOURCE_FIXTURE');
 const f=Object.freeze({...fixture}),company=f.role==='customer'?'F0102':'F0103',plural=f.role==='customer'?'customers':'suppliers',other=f.role==='customer'?'supplier':'customer';
 check(typeof f.sourceKey==='string'&&new RegExp('^VEGA2026/'+company+'TBLCARI/[1-9][0-9]{0,9}$').test(f.sourceKey)&&hex(bundle?.revision?.modules?.[0]?.beforeHash),'READINESS_SQL_SOURCE_FIXTURE');
 const sourceId=f.sourceKey.split('/').at(-1),partySourceKey=`VEGA_CAPTURE_20260930_01/${company}/TBLCARI/${sourceId}`;
 check(BigInt(sourceId)<=2147483647n&&!(f.role==='customer'&&['591','592'].includes(f.id)),'READINESS_SQL_SOURCE_FIXTURE');
 const parameters=Object.freeze({copy:COPY,seal:f.baseSealHash,profile:f.profileSqlHash,id:f.id,account:f.accountId,currency:f.currency,source:f.sourceKey,witness:f.sourceWitnessHash,record:f.recordSourceKey,row:f.recordSqlHash,party:partySourceKey,sourceId});
 const manifest=`SELECT 1 FROM dbo.stage4_copy_manifest m WHERE m.copy_id=@copy AND m.sealed=1 AND m.seal_hash=@seal AND JSON_VALUE(m.profile_json,'$.sealHash')=@seal AND JSON_VALUE(m.profile_json,'$.actualT1')=N'false' AND CONVERT(varchar(64),HASHBYTES('SHA2_256',m.profile_json),2)=@profile AND (SELECT COUNT(*) FROM OPENJSON(m.profile_json,'$.${plural}')WITH(id bigint,accountId bigint,currency nvarchar(3),sourceKey nvarchar(250),sourceWitnessHash char(64))s WHERE s.id=@id AND s.accountId=@account AND s.currency=@currency AND s.sourceKey COLLATE Latin1_General_100_BIN2=@source AND s.sourceWitnessHash COLLATE Latin1_General_100_BIN2=@witness)=1`;
 const sourceScope=`r.run_id=N'${sourceRun}' AND r.entity=N'accounts' AND JSON_VALUE(r.payload_json,'$.party_source_key') COLLATE Latin1_General_100_BIN2=@party AND JSON_VALUE(r.payload_json,'$.role')=N'${f.role}' AND JSON_VALUE(r.payload_json,'$.currency_code')=@currency`;
 const exactRow=`r.run_id=N'${sourceRun}' AND r.entity=N'accounts' AND r.source_key COLLATE Latin1_General_100_BIN2=@record AND r.payload_hash COLLATE Latin1_General_100_BIN2=@witness AND ${rowSqlHash}=@row`;
 const verifySQL=`SELECT CASE WHEN (SELECT COUNT(*) FROM dbo.stage4_copy_manifest WHERE copy_id=@copy AND sealed=1)=1 AND EXISTS(${manifest}) AND (SELECT COUNT(*) FROM dbo.party_source_links l WHERE l.${f.role}_id=@id AND l.${other}_id IS NULL AND l.source_company=N'${company}' AND l.source_id=@sourceId AND l.source_currency<>N'LL')=1 AND (SELECT COUNT(*) FROM erp_migration.records r WHERE ${sourceScope})=1 AND EXISTS(SELECT 1 FROM erp_migration.records r WHERE ${exactRow} AND ${sourceScope} AND JSON_VALUE(r.payload_json,'$.balance_status')=N'SOURCE' AND TRY_CONVERT(decimal(28,8),JSON_VALUE(r.payload_json,'$.balance')) IS NOT NULL AND LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varchar(max),r.payload_json COLLATE Latin1_General_100_BIN2_UTF8)),2))=LOWER(r.payload_hash)) AND NOT EXISTS(SELECT 1 FROM sys.triggers WHERE parent_id=OBJECT_ID(N'erp_migration.records') AND is_disabled=0) AND NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE (parent_object_id=OBJECT_ID(N'erp_migration.records') OR referenced_object_id=OBJECT_ID(N'erp_migration.records')) AND is_disabled=0) THEN 1 ELSE 0 END verified;`;
 const fixtureHash=isolatedCopyHash(f);
 const confirm=async query=>{const rows=(await query(verifySQL,parameters)).recordset;check(rows?.length===1&&rows[0].verified===1,'READINESS_SQL_SOURCE_FIXTURE_DRIFT');};
 return Object.freeze(['missing_source_account','unknown_balance'].map(kind=>Object.freeze({kind,layer:'actual_ready',predicateKind:'composite_source_witness',fixtureHash,modulePins:Object.freeze([Object.freeze({name:NAME,hash:bundle.revision.modules[0].beforeHash})]),expectedErrorCodes:Object.freeze(['BUSINESS_SOURCE_ACCOUNT_WITNESS_DRIFT']),
  async verify({query,copyId}){check(copyId===COPY,'READINESS_SQL_SOURCE_COPY');await confirm(query);return {verified:true,fixtureHash};},
  async prepare({query,copyId}){
   check(copyId===COPY,'READINESS_SQL_SOURCE_COPY');await confirm(query);
   const dml=kind==='missing_source_account'?`DELETE r OUTPUT deleted.source_key sourceKey,deleted.payload_hash payloadHash FROM erp_migration.records r WHERE ${exactRow};`:`UPDATE r SET payload_json=JSON_MODIFY(JSON_MODIFY(r.payload_json,'$.balance_status',N'UNKNOWN'),'strict $.balance',NULL) OUTPUT deleted.source_key sourceKey,deleted.payload_hash payloadHash FROM erp_migration.records r WHERE ${exactRow};`;
   const rows=(await query(dml,parameters)).recordset;check(rows?.length===1&&rows[0].sourceKey===f.recordSourceKey&&rows[0].payloadHash===f.sourceWitnessHash,'READINESS_SQL_SOURCE_MUTATION_COUNT');
   const condition=kind==='missing_source_account'?`NOT EXISTS(SELECT 1 FROM erp_migration.records r WHERE ${sourceScope})`:`(SELECT COUNT(*) FROM erp_migration.records r WHERE ${sourceScope})=1 AND EXISTS(SELECT 1 FROM erp_migration.records r WHERE r.run_id=N'${sourceRun}' AND r.entity=N'accounts' AND r.source_key COLLATE Latin1_General_100_BIN2=@record AND r.payload_hash COLLATE Latin1_General_100_BIN2=@witness AND ${sourceScope} AND JSON_VALUE(r.payload_json,'$.balance_status')=N'UNKNOWN' AND JSON_VALUE(r.payload_json,'$.balance') IS NULL AND ${rowSqlHash}<>@row AND LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varchar(max),r.payload_json COLLATE Latin1_General_100_BIN2_UTF8)),2))<>LOWER(r.payload_hash))`;
   const post=(await query(`SELECT CASE WHEN EXISTS(${manifest}) AND ${condition} THEN 1 ELSE 0 END prepared;`,parameters)).recordset;check(post?.length===1&&post[0].prepared===1,'READINESS_SQL_SOURCE_MUTATION_UNVERIFIED');
  },
  async execute({query,copyId}){check(copyId===COPY,'READINESS_SQL_SOURCE_COPY');await query('EXEC dbo.usp_stage4_copy_ready @copy_id=@copy;',{copy:COPY});}
 })));
}
// Trusted server-code bindings, like native domain callbacks. They are never
// read from JSON or HTTP. No binding means unsupported, not an inferred pass.
// verify must bind a reviewed fixture; module pins are checked independently
// on this transaction. execute must produce an actual driver guard rejection.
export function createReadinessQueryPlanSqlAdapter({sql,pool,bundle,target,nativeProbeBindings=[]}={}){
 const proof=readinessProofTarget(bundle,target);
 check(sql&&typeof sql.Request==='function'&&typeof sql.Transaction==='function'&&sql.ISOLATION_LEVEL?.SERIALIZABLE&&pool?.connected===true,'READINESS_SQL_POOL_REQUIRED');
 check(Array.isArray(nativeProbeBindings)&&new Set(nativeProbeBindings.map(b=>b?.kind)).size===nativeProbeBindings.length,'READINESS_SQL_BINDINGS');
 const bindings=new Map();
 for(const b of nativeProbeBindings){
  check(b&&Object.keys(b).sort().join(',')===['kind','layer','fixtureHash','modulePins','expectedErrorCodes','verify','prepare','execute',...(b.predicateKind===undefined?[]:['predicateKind'])].sort().join(',')&&UNSUPPORTED_READINESS_PROBES.includes(b.kind)&&READINESS_PROOF_NEGATIVE_LAYERS[b.kind].includes(b.layer)&&hex(b.fixtureHash)&&['verify','prepare','execute'].every(k=>typeof b[k]==='function')&&(b.predicateKind===undefined||(b.predicateKind==='composite_source_witness'&&['missing_source_account','unknown_balance'].includes(b.kind)&&b.layer==='actual_ready')),'READINESS_SQL_BINDING_CONTRACT');
  check(Array.isArray(b.modulePins)&&b.modulePins.length>0&&new Set(b.modulePins.map(p=>p?.name)).size===b.modulePins.length&&b.modulePins.every(p=>p&&Object.keys(p).sort().join(',')==='hash,name'&&safeTable(p.name)&&hex(p.hash))&&Array.isArray(b.expectedErrorCodes)&&b.expectedErrorCodes.length>0&&b.expectedErrorCodes.every(c=>/^[A-Z][A-Z0-9_]+$/.test(c)),'READINESS_SQL_BINDING_PINS');
  if(b.predicateKind)check(b.expectedErrorCodes.length===1&&b.expectedErrorCodes[0]==='BUSINESS_SOURCE_ACCOUNT_WITNESS_DRIFT','READINESS_SQL_BINDING_PINS');
  bindings.set(b.kind,Object.freeze({...b,modulePins:b.modulePins.map(p=>Object.freeze({...p})),expectedErrorCodes:[...b.expectedErrorCodes]}));
 }
 let inspected=false,active=null,current=null,ended=true,transactionSpid=null;
 const observedSpids=[];
 const tokenMap=new WeakMap();
 async function query(text,parameters={},transaction=null,onInfo){
  const request=new sql.Request(transaction??pool);request.timeout=900000;
  for(const [key,value]of Object.entries(parameters)){check(/^[A-Za-z][A-Za-z0-9]*$/.test(key),'READINESS_SQL_PARAMETER');request.input(key,value);}
  if(onInfo)request.on('info',onInfo);
  try{return await request.query(text);}catch(e){throw Error(guardCode(e)??'READINESS_SQL_REQUEST_FAILED');}finally{if(onInfo)request.removeListener('info',onInfo);}
 }
 async function identity(transaction=null){const rows=(await query(READINESS_ADAPTER_IDENTITY_SQL,{},transaction)).recordset;check(rows?.length===1,'READINESS_SQL_IDENTITY_ROWS');const x=rows[0];check(x.server===SERVER&&x.databaseName===READINESS_PROOF_DATABASE&&x.originalLogin===READINESS_PROOF_LOGIN&&x.copyId?.toLowerCase()===COPY&&x.actualT1==='false'&&x.dbOwner===1&&x.sysadmin===0&&x.accessShared===0&&x.accessTest125===0&&x.accessLive===0&&x.transactionCount===(transaction?1:0)&&Number.isSafeInteger(x.spid)&&x.spid>0,'READINESS_SQL_IDENTITY');if(transaction&&transactionSpid!==null)check(x.spid===transactionSpid,'READINESS_SQL_TRANSACTION_SPID');return x;}
 async function snapshotParts(transaction=null){
  await identity(transaction);
  const tables=(await query(READINESS_ADAPTER_TABLE_SQL,{},transaction)).recordset;
  check(Array.isArray(tables)&&tables.length>0&&tables.every(r=>metadataIdentifier(r?.schemaName)&&metadataIdentifier(r?.tableName))&&new Set(tables.map(r=>JSON.stringify([r.schemaName,r.tableName]))).size===tables.length,'READINESS_SQL_TABLE_SCOPE');
  check(READINESS_REQUIRED_TABLES.every(name=>{const [schemaName,tableName]=name.split('.');return tables.some(r=>r.schemaName===schemaName&&r.tableName===tableName);}),'READINESS_SQL_REQUIRED_TABLE_MISSING');
  const groups={};
  const source={},roles={},history={};
  for(const {schemaName,tableName}of tables){
   // Same SQL_FULL_ROW_JSON_UTF16_SHA256_SORTED_MULTISET as the existing
   // stage4/revision snapshot helpers; duplicates and NULLs are retained.
   const qualifiedName=quoteTable(schemaName,tableName);
   const rows=(await query(`SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) rowHash FROM ${qualifiedName} x ORDER BY rowHash;`,{},transaction)).recordset;
   check(Array.isArray(rows)&&rows.every(r=>hex(r.rowHash)),'READINESS_SQL_ROW_HASH');
   const value={count:rows.length,hash:createHash('sha256').update(JSON.stringify(rows.map(r=>r.rowHash)),'utf8').digest('hex').toUpperCase()};groups[qualifiedName]=value;
   if(schemaName==='dbo'&&permissionTables.has(tableName))roles[qualifiedName]=value;else if(schemaName==='dbo'&&tableName.startsWith('stage4_copy_'))history[qualifiedName]=value;else source[qualifiedName]=value;
  }
  const schema=(await query(READINESS_ADAPTER_SCHEMA_SQL,{},transaction)).recordsets,permissions=(await query(READINESS_ADAPTER_PERMISSION_SQL,{},transaction)).recordsets;
  check(Array.isArray(schema)&&schema.length===4&&Array.isArray(permissions)&&permissions.length===3,'READINESS_SQL_METADATA');
  return {groups,schema,permissions,protectedSchemaHash:isolatedCopyHash(schema),businessHash:isolatedCopyHash(source),permissionsHash:isolatedCopyHash({tables:roles,permissions}),registryHistoryHash:isolatedCopyHash(history),fullHash:isolatedCopyHash({groups,schema,permissions})};
 }
 function transactionOf(token){check(inspected&&active&&tokenMap.get(token)===active,'READINESS_SQL_TRANSACTION');return active;}
 async function execution(tx,collect){
  let logicalReads=0,ioMessages=0;
  const start=performance.now(),info=event=>{const message=event?.message??'';for(const hit of message.matchAll(/logical reads (\d+)/g)){logicalReads+=Number(hit[1]);ioMessages++;}};
  let reply;
  try{reply=await query(`${collect?'SET LANGUAGE us_english; SET STATISTICS IO ON; SET STATISTICS XML ON;':''}EXEC dbo.usp_stage4_copy_ready @copy_id=@copy;${collect?'SET STATISTICS XML OFF; SET STATISTICS IO OFF;':''}`,{copy:COPY},tx,collect?info:undefined);}
  finally{if(collect)await query('SET STATISTICS XML OFF; SET STATISTICS IO OFF;',{},tx);}
  const elapsedMs=performance.now()-start;
  if(!collect)return;
  const plans=(reply.recordsets??[]).flatMap(rows=>rows.flatMap(row=>Object.values(row))).filter(v=>typeof v==='string'&&v.includes('<ShowPlanXML')&&v.includes('schemas.microsoft.com/sqlserver/2004/07/showplan')&&/<(?:[A-Za-z_][\w.-]*:)?RunTimeCountersPerThread(?:\s|\/?>)/.test(v));
  check(plans.length>0&&ioMessages>0&&Number.isSafeInteger(logicalReads),'READINESS_SQL_ACTUAL_PLAN_REQUIRED');
  const parts=await snapshotParts(tx);
  return {result:'READY',elapsedMs,queryPlanSha256:createHash('sha256').update(plans.join('\n'),'utf8').digest('hex').toUpperCase(),logicalReads,sourceContributionHash:parts.businessHash,actorPermissionsHash:parts.permissionsHash};
 }
 return Object.freeze({
  unsupportedNegativeKinds:Object.freeze(UNSUPPORTED_READINESS_PROBES.filter(kind=>!bindings.has(kind))),
  get observedTransactionSpids(){return [...observedSpids];},
  async inspect(){check(!active,'READINESS_SQL_ALREADY_ACTIVE');const x=await identity();check(x.definitionHash===proof.sharedBeforeHash,'READINESS_SQL_SOURCE_PIN');const s=await snapshotParts();inspected=true;return {server:x.server,database:x.databaseName,originalLogin:x.originalLogin,copyId:x.copyId.toLowerCase(),actualT1:false,dbOwner:x.dbOwner,sysadmin:x.sysadmin,accessShared:x.accessShared,accessTest125:x.accessTest125,accessLive:x.accessLive,sourceDefinitionHash:x.definitionHash,protectedSchemaHash:s.protectedSchemaHash,businessHash:s.businessHash,permissionsHash:s.permissionsHash,registryHistoryHash:s.registryHistoryHash};},
  async snapshot(){check(inspected&&!active,'READINESS_SQL_INSPECT_REQUIRED');return (await snapshotParts()).fullHash;},
  async beginRollbackOnly(){check(inspected&&!active,'READINESS_SQL_INSPECT_REQUIRED');check((await identity()).definitionHash===proof.sharedBeforeHash,'READINESS_SQL_SOURCE_PIN');const tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);active=tx;ended=false;transactionSpid=null;const token=Object.freeze({});tokenMap.set(token,tx);try{const x=await identity(tx);check(x.definitionHash===proof.sharedBeforeHash,'READINESS_SQL_SOURCE_PIN');transactionSpid=x.spid;observedSpids.push(x.spid);await query('SET XACT_ABORT OFF;',{},tx);return token;}catch(e){try{await tx.rollback();active=null;ended=true;transactionSpid=null;tokenMap.delete(token);}catch{throw Error('READINESS_SQL_ROLLBACK_FAILED');}throw e;}},
  async installTemporaryRevision(token,p){const tx=transactionOf(token);await identity(tx);
   check(p?.proofOnly===true&&['baseline','candidate'].includes(p.variant)&&p.executionSQL===(p.variant==='baseline'?proof.baselineExecutionSQL:proof.candidateExecutionSQL)&&p.storedDefinition===(p.variant==='baseline'?proof.baselineStoredDefinition:proof.candidateStoredDefinition)&&moduleHash(p.storedDefinition)===p.afterHash&&p.executionSQL===p.storedDefinition.replace(/^CREATE PROCEDURE /,'ALTER PROCEDURE ')&&p.tableSQL===proof.tableSQL&&p.immutableSQL===proof.immutableSQL&&p.triggerHash===proof.proofTriggerHash,'READINESS_SQL_INSTALL_PIN');
   const {revisionHash,...body}=p.revision??{}, {revisionHash:sourceHash,...sourceBody}=bundle.revision;
   const expectedBody={...sourceBody,modules:[{...sourceBody.modules[0],afterHash:p.afterHash}],immutableTriggerHash:proof.proofTriggerHash};
   check(revisionHash===isolatedCopyHash(body)&&isolatedCopyHash(body)===isolatedCopyHash(expectedBody),'READINESS_SQL_REVISION_PIN');
   check(p.executionSQL.startsWith('ALTER PROCEDURE dbo.usp_stage4_copy_ready '),'READINESS_SQL_EXACT_ALTER_TEXT');
   await query(p.tableSQL,{},tx);await query(p.immutableSQL,{},tx);await query(p.executionSQL,{},tx);
   check((await identity(tx)).definitionHash===p.afterHash,'READINESS_SQL_INSTALLED_DEFINITION_HASH');
   await query(`INSERT ${QUERY_PLAN_REGISTRY}(copy_id,revision,base_seal_hash,base_daily_revision_hash,base_profit_revision_hash,daily_scope_hash,name,before_hash,after_hash,revision_hash)VALUES(@copy,6,@seal,@daily,@profit,@scope,N'${NAME}',@before,@after,@revision);`,{copy:COPY,seal:body.baseSealHash,daily:body.baseDailyRevisionHash,profit:body.baseProfitRevisionHash,scope:body.dailyScopeHash,before:body.modules[0].beforeHash,after:p.afterHash,revision:revisionHash},tx);current={...p};
  },
  async observeReady(token,p){const tx=transactionOf(token);check(current&&p?.variant===current.variant&&p.copyId===COPY&&p.collectActualPlan===true,'READINESS_SQL_OBSERVATION_SCOPE');await identity(tx);return execution(tx,true);},
  async negativeProbe(token,p){const tx=transactionOf(token);await identity(tx);check(current&&p?.variant===current.variant&&p.fullRollbackRequired===true,'READINESS_SQL_PROBE_SCOPE');
   const binding=bindings.get(p.kind);
   check(!UNSUPPORTED_READINESS_PROBES.includes(p.kind)||binding,unsupportedCodes[p.kind]);check(binding||['registry_hash_drift','disabled_query_plan_trigger'].includes(p.kind),'READINESS_SQL_UNKNOWN_PROBE');
   let code=null,layer='actual_ready';
   if(binding){
    // First prove this installed control is READY. Setup/verification errors
    // are prerequisites, never negatives. Callbacks cannot see tx or commit.
    await execution(tx,false);
    const declaredNativeCodes=new Set([...current.storedDefinition.matchAll(/THROW\s+\d+\s*,\s*'([A-Z][A-Z0-9_]+)'/g)].map(hit=>hit[1]));
    for(const pin of binding.modulePins){const installedReady=pin.name===NAME;if(installedReady)check(pin.hash===proof.sharedBeforeHash,'READINESS_SQL_BINDING_SOURCE_PIN');const rows=(await query("SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(@name))),2) definitionHash,CONVERT(int,OBJECTPROPERTY(OBJECT_ID(@name),'ExecIsTriggerDisabled')) triggerDisabled,OBJECT_DEFINITION(OBJECT_ID(@name)) definition;",{name:pin.name},tx)).recordset;check(rows?.length===1&&rows[0].definitionHash===(installedReady?current.afterHash:pin.hash)&&rows[0].triggerDisabled!==1&&typeof rows[0].definition==='string'&&(!installedReady||rows[0].definition===current.storedDefinition),'READINESS_SQL_BINDING_MODULE_DRIFT');for(const hit of rows[0].definition.matchAll(/THROW\s+\d+\s*,\s*'([A-Z][A-Z0-9_]+)'/g))declaredNativeCodes.add(hit[1]);}
    check(binding.expectedErrorCodes.every(code=>declaredNativeCodes.has(code)),'READINESS_SQL_BINDING_GUARD_CODE_PIN');
    const safeQuery=async(text,parameters={})=>{check(typeof text==='string'&&/^\s*(?:SELECT|INSERT|UPDATE|DELETE|EXEC)\b/i.test(text)&&!text.replace(/;\s*$/,'').includes(';')&&!/\b(?:COMMIT|ROLLBACK|ALTER|CREATE|DROP|TRUNCATE|DISABLE|ENABLE|GRANT|DENY|REVOKE|BACKUP|RESTORE|THROW|RAISERROR|EXECUTE\s+AS)\b/i.test(text),'READINESS_SQL_BINDING_UNSAFE_QUERY');if(/^\s*EXEC\b/i.test(text)){const name=text.match(/^\s*EXEC\s+(dbo\.usp_(?:stage4_copy|business_daily)_[A-Za-z0-9_]+)/i)?.[1];check(name&&(name===NAME||binding.modulePins.some(pin=>pin.name===name)),'READINESS_SQL_BINDING_ENTRYPOINT_PIN');}await identity(tx);return query(text,parameters,tx);};
    const verifyQuery=async(text,parameters={})=>{check(typeof text==='string'&&/^\s*SELECT\b/i.test(text)&&!/\b(?:INSERT|UPDATE|DELETE|MERGE|EXEC|EXECUTE|INTO)\b/i.test(text),'READINESS_SQL_BINDING_VERIFY_READONLY');return safeQuery(text,parameters);};
    try{const verified=await binding.verify(Object.freeze({query:verifyQuery,copyId:COPY}));check(verified&&Object.keys(verified).sort().join(',')==='fixtureHash,verified'&&verified.verified===true&&verified.fixtureHash===binding.fixtureHash,'READINESS_SQL_FIXTURE_UNVERIFIED');await binding.prepare(Object.freeze({query:safeQuery,copyId:COPY}));}catch{throw Error('READINESS_SQL_FIXTURE_PREPARATION_REJECTED');}
    let nativeCode=null,nativeLayer=null;
    const probeQuery=async(text,parameters={})=>{try{return await safeQuery(text,parameters);}catch(e){const actual=guardCode(e);if(actual&&!actual.startsWith('READINESS_SQL_')){nativeCode=actual;nativeLayer=/^\s*EXEC\s+dbo\.usp_stage4_copy_ready\b/i.test(text)?'actual_ready':/^\s*EXEC\s+dbo\.usp_stage4_copy_effects\b/i.test(text)?'native_effects':/^\s*EXEC\s+dbo\.usp_(?:stage4_copy|business_daily)_(?:context|begin)\b/i.test(text)?'native_actor':/^\s*(?:INSERT|UPDATE|DELETE)\b/i.test(text)?'upstream_native_business':null;}throw e;}};
    try{await binding.execute(Object.freeze({query:probeQuery,copyId:COPY}));}catch{}
    check(nativeCode&&nativeLayer===binding.layer&&binding.expectedErrorCodes.includes(nativeCode),'READINESS_SQL_NATIVE_GUARD_REQUIRED');code=nativeCode;layer=nativeLayer;
   }else{
    if(p.kind==='registry_hash_drift')await query(current.executionSQL+'\n-- isolated definition drift probe',{},tx);
    else await query(`DISABLE TRIGGER ${QUERY_PLAN_TRIGGER} ON ${QUERY_PLAN_REGISTRY};`,{},tx);
    try{await execution(tx,false);}catch(e){code=guardCode(e);check(code,'READINESS_SQL_NATIVE_GUARD_REQUIRED');}
   }
   check(code,'READINESS_SQL_GUARD_DID_NOT_REJECT');
   // Identity still uses the same SPID even if a native trigger ended/doomed
   // the transaction. Full rollback is owned by the harness's finally block.
   const state=(await query('SELECT @@SPID spid,@@TRANCOUNT transactionCount,XACT_STATE() transactionState;',{},tx)).recordset?.[0];check(state&&state.spid===transactionSpid&&[-1,0,1].includes(state.transactionState)&&[0,1].includes(state.transactionCount),'READINESS_SQL_NEGATIVE_TRANSACTION_STATE');
   return {rejected:true,errorCode:code,layer,readinessPredicateExercised:layer==='actual_ready',transactionState:state.transactionState,...(binding?.predicateKind?{predicateKind:binding.predicateKind}:{})};
  },
  async rollback(token){const tx=transactionOf(token);try{await tx.rollback();}catch{throw Error('READINESS_SQL_ROLLBACK_FAILED');}active=null;current=null;ended=true;transactionSpid=null;tokenMap.delete(token);},
  async assertEnded(){check(ended&&!active,'READINESS_SQL_ROLLBACK_REQUIRED');const x=await identity();check(x.definitionHash===proof.sharedBeforeHash,'READINESS_SQL_ROLLBACK_DEFINITION_DRIFT');}
 });
}
