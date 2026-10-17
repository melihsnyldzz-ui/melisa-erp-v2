// Explicit TEST metadata transaction. No top-level SQL, filesystem writes or CLI.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {targetPool} from './goal73-supplier-delta-runtime.mjs';
import {additiveQuarantineDefinitions,serializeQuarantineDefinitions} from './operation-quarantine-v2-runtime.mjs';
import {QUARANTINE_V2_MODULES} from './operation-quarantine-sql.mjs';
import {RUN,TARGET,TABLES,SCHEMA,SOURCE_PLAN_SHA256,check,hash,sqlHash,identitiesFromPlan,validateSourceProof,metadataRows,validateManifest,replayDecision,validateReadback} from './supplier-identity-metadata.mjs';
export const PRIVATE_PLAN='C:/Sirket/ERP/evidence/ERP-GOAL7.2-20261007/private/four-card-create-plan.json';
export const REPLAY_COMPATIBILITY=Object.freeze({manifestHash:'4dd3285c2ade83e8823c37e951b01241dea3a9e72ff8bd6a11287bda250a5662',previousDefinitionsHash:'9440b9cb8e73555c020c5c90ee3acb04e74e7ce30f1496680775cd3855bea3d1',originalDefinitionsHash:'5d9cd41555f027f9dbbb045f1ad6bb7077dda71af9840e23003f716fada3270b',seal:'69ff490f2938e34aa2f10399a5cf7b8042950667780779a15d708188c4b90de7'});
const ident=s=>{check(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s),'IDENTIFIER');return '['+s+']';};
const lit=s=>"N'"+String(s).replaceAll("'","''")+"'";
const JOURNAL=['supplier_identity_runs','supplier_identity_rows'];
export const PROTECTED=Object.freeze(['products','product_prices','product_barcodes','product_source_aliases','customers','party_entities','party_source_links','customer_movements','sales_invoices','sales_invoice_items','purchase_invoices','purchase_invoice_items','invoice_returns','invoice_return_items','finance_accounts','finance_account_movements','cash_adjustments','cash_drawer_accounts','cash_drawers','cash_expenses','cash_session_counts','cash_sessions','cash_transfers','terminal_sync_queue','inventory_cutovers','inventory_cutover_items','inventory_documents','inventory_document_items','financial_documents','financial_document_items','document_links','stock_movements','suppliers','supplier_movements','party_currency_accounts','audit_logs']);
const type=c=>['nvarchar','varchar','char'].includes(c.type)?`${c.type}(${c.max_length===-1?'max':c.type==='nvarchar'?c.max_length/2:c.max_length})`:['decimal','numeric'].includes(c.type)?`${c.type}(${c.precision},${c.scale})`:c.type==='datetime2'?`datetime2(${c.scale})`:c.type;
const managed=c=>c.is_identity||c.is_computed||['created_at','row_version'].includes(c.name);
export async function fileHash(file){const h=createHash('sha256');for await(const chunk of fs.createReadStream(file,{highWaterMark:4*1024*1024}))h.update(chunk);return h.digest('hex');}
export function metadataGuardPredicate(table,columns,m){
 check(TABLES.includes(table)&&m.runId===RUN&&/^[a-f0-9]{64}$/.test(m.manifestHash),'GUARD_SCOPE');
 const cols=columns.filter(c=>!managed(c));check(cols.length>0&&cols.some(c=>c.name==='source_record_key'),'GUARD_COLUMNS');
 const mismatch=cols.map(c=>`NOT EXISTS(SELECT 1 FROM OPENJSON(p.after_json) j WHERE j.[key]=N'${c.name}') OR EXISTS(SELECT i.${ident(c.name)} EXCEPT SELECT CONVERT(${type(c)},JSON_VALUE(p.after_json,N'$.${c.name}')))`).join(' OR ');
 return `CONVERT(nvarchar(80),SESSION_CONTEXT(N'supplier_metadata_run'))=${lit(m.runId)} AND COALESCE(IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN()),0)=1 AND DB_NAME()=${lit(TARGET.database)} AND @@SERVERNAME=${lit(TARGET.server)} AND OBJECT_ID(N'tempdb..#supplier_metadata_scope') IS NOT NULL AND OBJECT_ID(N'tempdb..#supplier_metadata_insert') IS NOT NULL AND (SELECT COUNT(*) FROM #supplier_metadata_scope)=1 AND EXISTS(SELECT 1 FROM #supplier_metadata_scope WHERE run_id=${lit(m.runId)} AND manifest_hash=${lit(m.manifestHash)}) AND NOT EXISTS(SELECT 1 FROM deleted) AND EXISTS(SELECT 1 FROM inserted) AND NOT EXISTS(SELECT 1 FROM inserted i LEFT JOIN #supplier_metadata_insert p ON p.table_name=N'${table}' AND CONVERT(varbinary(max),p.source_key)=CONVERT(varbinary(max),i.source_record_key) WHERE p.source_key IS NULL OR (${mismatch}))`;
}
export function metadataGuardBranch(table,columns,m){return `IF (${metadataGuardPredicate(table,columns,m)}) RETURN;`;}
export function extendGuard(definition,branch){
 check(/^CREATE\s+TRIGGER\b/i.test(definition)&&/AS\s+BEGIN\b/i.test(definition),'GUARD_FORMAT');
 return definition.replace(/^CREATE\s+TRIGGER/i,'ALTER TRIGGER').replace(/AS\s+BEGIN\b/i,x=>x+'\n'+branch+'\n');
}
export const triggeredInsertSql=(table,cols)=>{const defs=cols.map(x=>`${ident(x.name)} ${type(x)} '$.${x.name}'`).join(',');return `DECLARE @created TABLE(id bigint);INSERT dbo.${ident(table)}(${cols.map(x=>ident(x.name)).join(',')}) OUTPUT inserted.id INTO @created(id) SELECT ${cols.map(x=>ident(x.name)).join(',')} FROM OPENJSON(@body) WITH(${defs});SELECT CONVERT(varchar(20),id) id FROM @created;`;};
export async function restoreNativeGuard(query,g){
 // DROP/CREATE preserves the exact original module text. Refuse explicit object grants;
 // their original object IDs cannot be preserved by recreation.
 const permissions=(await query(`SELECT COUNT(*) count FROM sys.database_permissions WHERE class=1 AND major_id=OBJECT_ID(${lit('dbo.'+g.name)})`)).recordset;
 check(permissions[0].count===0,'TRIGGER_OBJECT_PERMISSIONS');
 await query(`DROP TRIGGER dbo.${ident(g.name)}`);await query(g.definition);
 for(const [field,event] of [['firstInsert','INSERT'],['firstUpdate','UPDATE'],['firstDelete','DELETE']])if(g[field]===1)await query(`EXEC sys.sp_settriggerorder @triggername=${lit('dbo.'+g.name)},@order=N'First',@stmttype=N'${event}';`);
}
export async function columnsFor(request,table){return (await request().query(`SELECT c.name,TYPE_NAME(c.user_type_id) type,c.max_length,c.precision,c.scale,c.is_nullable,c.is_identity,c.is_computed FROM sys.columns c WHERE c.object_id=OBJECT_ID(N'dbo.${table}') ORDER BY c.column_id`)).recordset;}
export async function guardProof(request){return (await request().query("SELECT name,OBJECT_NAME(parent_id) tableName,OBJECT_DEFINITION(object_id) definition,is_disabled,OBJECTPROPERTY(object_id,'ExecIsFirstInsertTrigger') firstInsert,OBJECTPROPERTY(object_id,'ExecIsFirstUpdateTrigger') firstUpdate,OBJECTPROPERTY(object_id,'ExecIsFirstDeleteTrigger') firstDelete FROM sys.triggers WHERE OBJECT_SCHEMA_NAME(parent_id)=N'dbo' AND OBJECT_NAME(parent_id) IN(N'party_entities',N'suppliers',N'party_currency_accounts',N'party_source_links') ORDER BY name")).recordset.map(x=>({...x,hash:sqlHash(x.definition)}));}
export async function protectedProof(request,created=[]){
 const result={};for(const table of PROTECTED){const ids=created.flatMap(c=>c.images.filter(x=>x.table===table).map(x=>x.id));check(ids.every(i=>/^[1-9]\d*$/.test(i)),'PROTECTED_IDS');
  const rows=(await request().query(`SELECT CONVERT(varchar(20),x.id) id,CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) hash FROM dbo.${ident(table)} x ${ids.length?`WHERE x.id NOT IN(${ids.join(',')})`:''} ORDER BY x.id`)).recordset;result[table]={count:rows.length,hash:hash(rows)};
 }
 for(const [name,query] of Object.entries({migrationRecords:'SELECT * FROM erp_migration.records ORDER BY run_id,entity,source_key FOR JSON PATH,INCLUDE_NULL_VALUES',migrationRuns:'SELECT * FROM erp_migration.runs ORDER BY run_id FOR JSON PATH,INCLUDE_NULL_VALUES',holds:'SELECT * FROM erp_migration.operation_quarantine_holds ORDER BY source_key FOR JSON PATH,INCLUDE_NULL_VALUES',holdManifest:'SELECT * FROM erp_migration.operation_quarantine_manifest ORDER BY run_id FOR JSON PATH,INCLUDE_NULL_VALUES',roles:'SELECT * FROM dbo.roles ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES',permissions:'SELECT * FROM dbo.permissions ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES',users:'SELECT * FROM dbo.users ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES',sqlPermissions:'SELECT * FROM sys.database_permissions ORDER BY class,major_id,minor_id,grantee_principal_id,grantor_principal_id,type FOR JSON PATH,INCLUDE_NULL_VALUES'})){
  result[name]=(await request().query(`SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(${query})),2) hash`)).recordset[0].hash;
 }return result;
}
export function readApprovedPlan(file=PRIVATE_PLAN){const bytes=fs.readFileSync(file);check(hash(bytes.toString('utf8'))===SOURCE_PLAN_SHA256,'PRIVATE_PLAN_FILE_CHANGED');return identitiesFromPlan(JSON.parse(bytes));}
export async function captureSource(connectSource,cards){
 check(typeof connectSource==='function','SOURCE_CONNECTOR_REQUIRED');const source=await connectSource(),startedAt=new Date().toISOString();
 try{const permissions=(await source.q("SELECT HAS_PERMS_BY_NAME(DB_NAME(),N'DATABASE',N'INSERT') ins,HAS_PERMS_BY_NAME(DB_NAME(),N'DATABASE',N'UPDATE') upd,HAS_PERMS_BY_NAME(DB_NAME(),N'DATABASE',N'DELETE') del,HAS_PERMS_BY_NAME(DB_NAME(),N'DATABASE',N'EXECUTE') execPerm,HAS_PERMS_BY_NAME(N'dbo.F0103TBLCARI',N'OBJECT',N'INSERT') cardInsert,HAS_PERMS_BY_NAME(N'dbo.F0103TBLCARI',N'OBJECT',N'UPDATE') cardUpdate,HAS_PERMS_BY_NAME(N'dbo.F0103TBLCARI',N'OBJECT',N'DELETE') cardDelete,HAS_PERMS_BY_NAME(N'dbo.F0102TBLCARI',N'OBJECT',N'INSERT') otherInsert,HAS_PERMS_BY_NAME(N'dbo.F0102TBLCARI',N'OBJECT',N'UPDATE') otherUpdate,HAS_PERMS_BY_NAME(N'dbo.F0102TBLCARI',N'OBJECT',N'DELETE') otherDelete"))[0];
  const query=`SELECT IND,FIRMANO,FIRMAKODU,FIRMAADI,FIRMATIPI,PARABIRIMI,STATU,STATUS,DELETED,ALIAS,UID,CONVERT(varchar(40),KAYITTARIHI,126) KAYITTARIHI FROM dbo.F0103TBLCARI WHERE IND IN(${cards.map(c=>c.sourceId).join(',')}) ORDER BY IND`;
  const first=await source.q(query),second=await source.q(query),uids=cards.map(c=>lit(c.uid)).join(',');
  const globalUidCounts=(await source.q(`SELECT UID uid,COUNT(*) [count] FROM(SELECT UID FROM dbo.F0103TBLCARI WHERE UID IN(${uids}) UNION ALL SELECT UID FROM dbo.F0102TBLCARI WHERE UID IN(${uids})) c GROUP BY UID`));
  const proof={identity:source.identity,permissions,first,second,globalUidCounts,startedAt,endedAt:new Date().toISOString()};validateSourceProof(cards,proof);return proof;
 }finally{await source.pool.close();}
}
async function identity(request){const x=(await request().query("SELECT @@SERVERNAME server,DB_NAME() [database],IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN()) admin")).recordset[0];check(x.server===TARGET.server&&x.database===TARGET.database&&x.admin===1,'WRONG_TARGET');return x;}
async function scopeAbsent(request,cards){for(const c of cards){
 const rows=(await request().query(`SELECT N'supplier' entity,CONVERT(varchar(20),id) id FROM dbo.suppliers WITH(UPDLOCK,HOLDLOCK) WHERE source_record_key=${lit(c.nativeKey)} OR supplier_code=${lit(c.code)} OR source_payload_json LIKE ${lit('%'+c.uid+'%')} UNION ALL SELECT N'customer',CONVERT(varchar(20),id) FROM dbo.customers WITH(UPDLOCK,HOLDLOCK) WHERE source_record_key=${lit(c.nativeKey)} OR customer_code=${lit(c.code)} OR source_payload_json LIKE ${lit('%'+c.uid+'%')} UNION ALL SELECT N'entity',CONVERT(varchar(20),id) FROM dbo.party_entities WITH(UPDLOCK,HOLDLOCK) WHERE source_record_key=${lit(c.nativeKey)} OR source_payload_json LIKE ${lit('%'+c.uid+'%')} UNION ALL SELECT N'link',CONVERT(varchar(20),id) FROM dbo.party_source_links WITH(UPDLOCK,HOLDLOCK) WHERE (source_company=N'F0103' AND source_id=${c.sourceId}) OR source_record_key=${lit(c.nativeKey)} UNION ALL SELECT N'account',CONVERT(varchar(20),id) FROM dbo.party_currency_accounts WITH(UPDLOCK,HOLDLOCK) WHERE source_record_key=${lit(c.nativeKey+'/ACCOUNT/TRY')}`)).recordset;check(rows.length===0,'SOURCE_ALREADY_MAPPED');
 const hold=(await request().query(`SELECT native_id,native_entity_id,native_source_key FROM erp_migration.operation_quarantine_holds WITH(UPDLOCK,HOLDLOCK) WHERE entity=N'supplier' AND source_company=N'F0103' AND source_id=${lit(c.sourceId)}`)).recordset;check(hold.length===1&&hold[0].native_id===null&&hold[0].native_entity_id===null&&hold[0].native_source_key===c.nativeKey,'SOURCE_HOLD_DRIFT');
 }}
export async function prepareMetadata({actorId,backup,quarantineDefinitions,connectSource,planFile=PRIVATE_PLAN,getTarget=targetPool}){
 const cards=readApprovedPlan(planFile);await captureSource(connectSource,cards);const t=await getTarget();try{
 const request=()=>t.pool.request();await identity(request);await scopeAbsent(request,cards);
 const body={schemaVersion:SCHEMA,approval:'ERP-DEC-027',runId:RUN,...TARGET,sourcePlanHash:SOURCE_PLAN_SHA256,actorId,cards,metadataBlueprintHash:hash(cards.map(c=>metadataRows(c,{actorId}))),financialWrites:0,holdChanges:0,backup,protectedBefore:await protectedProof(request),guardBefore:await guardProof(request),quarantineDefinitions};
 const manifest={...body,manifestHash:hash(body)};validateManifest(manifest);
 check(await fileHash(backup.file)===backup.sha256.toLowerCase(),'BACKUP_FILE_HASH');return manifest;
 }finally{await t.pool.close();}
}
export async function assertDefinitions(request,expected){for(const x of expected){check(/^[A-Za-z_][A-Za-z0-9_]*$/.test(x.name)&&['dbo','erp_migration'].includes(x.schema),'DEFINITION_NAME');const r=(await request().query(`SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(${lit(x.schema+'.'+x.name)}))),2) hash`)).recordset[0];if(r.hash!==x.hash.toUpperCase())throw Object.assign(Error('SUPPLIER_METADATA_QUARANTINE_V2_NOT_INSTALLED'),{definitionName:x.schema+'.'+x.name,expectedHash:x.hash,actualHash:r.hash});}}
export function validateCompatibilityPayload(record){
 check(record?.id===1&&record.mode==='UPGRADE','COMPATIBILITY_RECORD');
 const body=JSON.parse(record.record_json);check(sqlHash(record.record_json).toLowerCase()===record.record_hash&&Object.keys(body).length===5,'COMPATIBILITY_RECORD_HASH');
 for(const field of ['mode','historical_manifest_hash','previous_definitions_hash','original_definitions_hash','new_definitions_hash'])check(body[field]===record[field],'COMPATIBILITY_RECORD_FIELDS');
 const decoded={};for(const [field,count] of [['previous_definitions',41],['original_definitions',37],['new_definitions',79]]){
  check(sqlHash(record[field+'_json']).toLowerCase()===record[field+'_hash'],'COMPATIBILITY_JSON_HASH');const pins=JSON.parse(record[field+'_json']);
  check(Array.isArray(pins)&&pins.length===count&&new Set(pins.map(x=>x.object_name)).size===count&&pins.every(x=>typeof x.object_name==='string'&&/^(dbo|erp_migration)\.[A-Za-z_][A-Za-z0-9_]*$/.test(x.object_name)&&/^[a-f0-9]{64}$/.test(x.definition_hash)&&Object.keys(x).length===2)&&serializeQuarantineDefinitions(pins)===record[field+'_json'],'COMPATIBILITY_PIN_SET');decoded[field]=pins;
 }
 const names=decoded.new_definitions.map(x=>x.object_name);check(names.length===QUARANTINE_V2_MODULES.length&&QUARANTINE_V2_MODULES.every(n=>names.includes(n)),'COMPATIBILITY_NEW_SCOPE');
 const originals=QUARANTINE_V2_MODULES.filter(n=>n.startsWith('dbo.operation_quarantine_'));check(decoded.original_definitions.every(x=>originals.includes(x.object_name)),'COMPATIBILITY_ORIGINAL_SCOPE');
 const compiled=additiveQuarantineDefinitions(REPLAY_COMPATIBILITY.seal);
 for(const pin of decoded.new_definitions){const original=decoded.original_definitions.find(x=>x.object_name===pin.object_name);if(original){check(pin.definition_hash===original.definition_hash,'COMPATIBILITY_ORIGINAL_HASH');continue;}
  const definition=compiled.get(pin.object_name);check(typeof definition==='string'&&[definition,definition.replace(/^CREATE (TRIGGER|PROCEDURE) /,'ALTER $1 ')].some(d=>sqlHash(d).toLowerCase()===pin.definition_hash),'COMPATIBILITY_NEW_CODE');
 }return decoded;
}
export function validateReplayCompatibility(record,manifest){
 check(manifest.manifestHash===REPLAY_COMPATIBILITY.manifestHash&&record?.historical_manifest_hash===manifest.manifestHash&&record.previous_definitions_hash===REPLAY_COMPATIBILITY.previousDefinitionsHash&&record.original_definitions_hash===REPLAY_COMPATIBILITY.originalDefinitionsHash,'COMPATIBILITY_APPROVED_SCOPE');
 check(serializeQuarantineDefinitions(manifest.quarantineDefinitions)===record.previous_definitions_json,'COMPATIBILITY_PREVIOUS_PINS');return validateCompatibilityPayload(record);
}
export async function assertReplayDefinitions(request,manifest){
 try{await assertDefinitions(request,manifest.quarantineDefinitions);return 'HISTORICAL_EXACT';}catch(error){if(error.message!=='SUPPLIER_METADATA_QUARANTINE_V2_NOT_INSTALLED')throw error;}
 const available=(await request().query("SELECT OBJECT_ID(N'erp_migration.operation_quarantine_compatibility_v2',N'U') id")).recordset[0].id;check(available!==null,'COMPATIBILITY_NOT_INSTALLED');
 const rows=(await request().query('SELECT * FROM erp_migration.operation_quarantine_compatibility_v2')).recordset;check(rows.length===1,'COMPATIBILITY_CARDINALITY');const pins=validateReplayCompatibility(rows[0],manifest);
 await assertDefinitions(request,pins.new_definitions.map(x=>{const [schema,name]=x.object_name.split('.');return {schema,name,hash:x.definition_hash};}));
 await request().query('EXEC dbo.usp_assert_operation_quarantine_v2;');return 'SEALED_ADDITIVE_V2';
}
async function readback(request,card){
 const r=(await request().query(`SELECT CONVERT(varchar(20),s.id) supplierId,CONVERT(varchar(20),s.party_entity_id) entityId,CONVERT(varchar(20),a.id) accountId,CONVERT(varchar(20),l.id) linkId,s.source_record_key nativeKey,CONVERT(varchar(20),l.source_id) sourceId,a.currency_code currency,e.role,a.balance_status balanceStatus,CONVERT(bit,CASE WHEN a.current_balance IS NULL THEN 1 ELSE 0 END) currentBalanceIsNull,JSON_VALUE(s.source_payload_json,'$.sourceUid') uid,(SELECT COUNT(*) FROM dbo.party_source_links z WHERE z.source_company=N'F0103' AND z.source_id=${card.sourceId}) linkCount,(SELECT COUNT(*) FROM dbo.supplier_movements m WHERE m.supplier_id=s.id) financialMovements,CONVERT(bit,CASE WHEN EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N'supplier' AND h.source_company=N'F0103' AND h.source_id=${lit(card.sourceId)} AND h.native_source_key=s.source_record_key) THEN 1 ELSE 0 END) held FROM dbo.suppliers s JOIN dbo.party_entities e ON e.id=s.party_entity_id JOIN dbo.party_source_links l ON l.supplier_id=s.id AND l.party_entity_id=e.id AND l.customer_id IS NULL JOIN dbo.party_currency_accounts a ON a.id=l.party_currency_account_id AND a.supplier_id=s.id AND a.party_entity_id=e.id AND a.customer_id IS NULL WHERE s.source_record_key=${lit(card.nativeKey)} AND l.source_company=N'F0103' AND l.source_id=${card.sourceId}`)).recordset;check(r.length===1,'READBACK_CARDINALITY');const x=r[0];
 x.images=[];for(const [table,key] of [['party_entities','entityId'],['suppliers','supplierId'],['party_currency_accounts','accountId'],['party_source_links','linkId']]){const row=(await request().query(`SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) hash FROM dbo.${table} p WHERE p.id=${x[key]}`)).recordset[0];x.images.push({table,id:x[key],hash:row.hash});}return validateReadback(card,x);
}
export async function readMetadata(request,cards){const out=[];for(const c of cards)out.push(await readback(request,c));return out;}
export const journalImmutable=table=>`CREATE TRIGGER erp_migration.immutable_${table} ON erp_migration.${table} AFTER INSERT,UPDATE,DELETE AS BEGIN IF EXISTS(SELECT 1 FROM deleted) OR COALESCE(IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN()),0)<>1 OR OBJECT_ID(N'tempdb..#supplier_metadata_scope') IS NULL OR NOT EXISTS(SELECT 1 FROM #supplier_metadata_scope WHERE run_id=CONVERT(nvarchar(80),SESSION_CONTEXT(N'supplier_metadata_run'))) OR EXISTS(SELECT 1 FROM inserted WHERE run_id<>CONVERT(nvarchar(80),SESSION_CONTEXT(N'supplier_metadata_run'))) THROW 51374,'SUPPLIER_METADATA_JOURNAL_IMMUTABLE',1;END;`;
export const JOURNAL_DDL=`CREATE TABLE erp_migration.supplier_identity_runs(run_id nvarchar(80) PRIMARY KEY,manifest_hash char(64) NOT NULL,source_plan_hash char(64) NOT NULL,status nvarchar(20) NOT NULL CHECK(status=N'COMMITTED'),receipt_json nvarchar(max) NOT NULL);
CREATE TABLE erp_migration.supplier_identity_rows(run_id nvarchar(80) NOT NULL,source_key nvarchar(250) NOT NULL,source_uid nvarchar(40) NOT NULL,entity_id bigint NOT NULL,supplier_id bigint NOT NULL,account_id bigint NOT NULL,link_id bigint NOT NULL,images_json nvarchar(max) NOT NULL,PRIMARY KEY(run_id,source_key),UNIQUE(source_key),UNIQUE(source_uid),UNIQUE(supplier_id));`;
export async function applyMetadata(manifest,{connectSource,getTarget=targetPool,installQuarantine}={}){
 validateManifest(manifest);check(typeof installQuarantine==='function','QUARANTINE_INSTALLER_REQUIRED');const cards=readApprovedPlan();check(hash(cards)===hash(manifest.cards),'APPROVED_PLAN_DRIFT');
 const t=await getTarget();const tx=new t.sql.Transaction(t.pool);let begun=false;try{await tx.begin(t.sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;const request=()=>new t.sql.Request(tx),q=async s=>(await request().query(s)).recordset;await identity(request);
 await q(`SET XACT_ABORT ON; DECLARE @lock int;EXEC @lock=sys.sp_getapplock @Resource=N'ERP-PARTY-SOURCE-IDENTITY',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=10000;IF @lock<0 THROW 51374,'SUPPLIER_METADATA_LOCK_FAILED',1;`);
 const exists=(await q("SELECT OBJECT_ID(N'erp_migration.supplier_identity_runs') id"))[0].id;const prior=exists?(await q(`SELECT manifest_hash,source_plan_hash,status,receipt_json FROM erp_migration.supplier_identity_runs WHERE run_id=${lit(RUN)}`))[0]:null;
 await captureSource(connectSource,cards);
 if(replayDecision(prior,manifest)==='REPLAY_NOOP'){for(const name of JOURNAL){const d=(await q(`SELECT OBJECT_DEFINITION(OBJECT_ID(N'erp_migration.immutable_${name}')) definition`))[0].definition;check(d===journalImmutable(name),'JOURNAL_DEFINITION_DRIFT');}
  const resolverProof=await assertReplayDefinitions(request,manifest);const rows=await readMetadata(request,cards),receipt=JSON.parse(prior.receipt_json);check(hash(rows)===hash(receipt.rows),'REPLAY_READBACK_DRIFT');await tx.commit();begun=false;return {status:'REPLAY_NOOP',writes:0,financialWrites:0,resolverProof,rows};}
 await scopeAbsent(request,cards);check(hash(await protectedProof(request))===hash(manifest.protectedBefore),'PROTECTED_PREIMAGE_DRIFT');check(hash(await guardProof(request))===hash(manifest.guardBefore),'GUARD_PREIMAGE_DRIFT');
 check(await fileHash(manifest.backup.file)===manifest.backup.sha256.toLowerCase(),'BACKUP_FILE_HASH');
 await q(`CREATE TABLE #supplier_metadata_scope(run_id nvarchar(80),manifest_hash char(64));INSERT #supplier_metadata_scope VALUES(${lit(RUN)},${lit(manifest.manifestHash)});CREATE TABLE #supplier_metadata_insert(table_name sysname,source_key nvarchar(400),after_json nvarchar(max),PRIMARY KEY NONCLUSTERED(table_name,source_key));EXEC sys.sp_set_session_context @key=N'supplier_metadata_run',@value=${lit(RUN)};`);
 const columns={};for(const table of TABLES)columns[table]=await columnsFor(request,table);
 const finalizeQuarantine=await installQuarantine({request,sql:t.sql,manifest,columns,metadataGuardPredicate});check(typeof finalizeQuarantine==='function','QUARANTINE_FINALIZER_REQUIRED');
 const nativeGuards=manifest.guardBefore.filter(g=>!g.name.startsWith('operation_quarantine_'));for(const g of nativeGuards){check(g.is_disabled===false,'NATIVE_GUARD_DISABLED');await q(extendGuard(g.definition,metadataGuardBranch(g.tableName,columns[g.tableName],manifest)));}
 validateSourceProof(cards,await captureSource(connectSource,cards));
 const allocated=[];
 for(const c of cards){const refs={actorId:manifest.actorId};const ids={};for(let index=0;index<4;index++){
   const {table,fields}=metadataRows(c,refs)[index],cols=columns[table].filter(x=>!managed(x));check(Object.keys(fields).length===cols.length&&cols.every(x=>Object.hasOwn(fields,x.name)),'FULL_INSERT_FIELDS');
   await request().input('table',t.sql.NVarChar(128),table).input('key',t.sql.NVarChar(400),fields.source_record_key).input('body',t.sql.NVarChar(t.sql.MAX),JSON.stringify(fields)).query('INSERT #supplier_metadata_insert VALUES(@table,@key,@body)');
   const inserted=await request().input('body',t.sql.NVarChar(t.sql.MAX),JSON.stringify(fields)).query(triggeredInsertSql(table,cols));check(inserted.recordset.length===1,'INSERT_CARDINALITY');const newId=inserted.recordset[0].id;
   if(index===0)refs.entityId=ids.entityId=newId;if(index===1)refs.supplierId=ids.supplierId=newId;if(index===2)refs.accountId=ids.accountId=newId;if(index===3)ids.linkId=newId;
  }allocated.push(ids);}
 for(const g of nativeGuards)await restoreNativeGuard(text=>request().query(text),g);await finalizeQuarantine();await assertDefinitions(request,manifest.quarantineDefinitions);
 const finalGuards=await guardProof(request);for(const g of nativeGuards){const after=finalGuards.find(x=>x.name===g.name);check(after?.definition===g.definition&&after.is_disabled===g.is_disabled&&after.firstInsert===g.firstInsert&&after.firstUpdate===g.firstUpdate&&after.firstDelete===g.firstDelete,'NATIVE_GUARD_RESTORE_DRIFT');}
 const rows=await readMetadata(request,cards);check(hash(await protectedProof(request,rows))===hash(manifest.protectedBefore),'PROTECTED_AFTER_DRIFT');
 if(!exists){await q(JOURNAL_DDL);for(const name of JOURNAL)await q(journalImmutable(name));}
 const receipt={status:'CREATED_METADATA_ONLY',runId:RUN,manifestHash:manifest.manifestHash,rows,metadataInserts:16,financialWrites:0,stockWrites:0,holdChanges:0,protectedUnchanged:true,rollback:{mode:'EXACT_CREATED_IDENTITIES_ONLY',requires:['same full row hashes','zero subsequent business references','same immutable holds','SERIALIZABLE exact-plan inverse'],ids:allocated}};
 for(let i=0;i<rows.length;i++){const c=cards[i],r=rows[i];await request().input('run',t.sql.NVarChar(80),RUN).input('key',t.sql.NVarChar(250),c.nativeKey).input('uid',t.sql.NVarChar(40),c.uid).input('e',t.sql.BigInt,r.entityId).input('s',t.sql.BigInt,r.supplierId).input('a',t.sql.BigInt,r.accountId).input('l',t.sql.BigInt,r.linkId).input('images',t.sql.NVarChar(t.sql.MAX),JSON.stringify(r.images)).query('INSERT erp_migration.supplier_identity_rows VALUES(@run,@key,@uid,@e,@s,@a,@l,@images)');}
 await request().input('run',t.sql.NVarChar(80),RUN).input('manifest',t.sql.Char(64),manifest.manifestHash).input('source',t.sql.Char(64),manifest.sourcePlanHash).input('receipt',t.sql.NVarChar(t.sql.MAX),JSON.stringify(receipt)).query("INSERT erp_migration.supplier_identity_runs VALUES(@run,@manifest,@source,N'COMMITTED',@receipt);EXEC sys.sp_set_session_context @key=N'supplier_metadata_run',@value=NULL;");
 await tx.commit();begun=false;return receipt;
 }catch(error){if(begun)await tx.rollback().catch(()=>{});throw error;}finally{await t.pool.close();}
}
