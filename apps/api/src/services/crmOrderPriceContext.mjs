// Only fresh native proof under the separate CRM login earns this registration.
import {createHash} from 'node:crypto';
import {assertCrmOrderCurrentContext,assertCrmOrderCurrentIdentity,crmOrderCurrentSourceHash,CRM_EXTENDED_DATABASE} from './crmOrderCurrentContext.mjs';
import {crmV2Error} from './crmOrderV2Contract.mjs';
import {CRM_PRICE_CREATE,CRM_PRICE_READ,CRM_PRICE_PROOF,CRM_PRICE_IMMUTABLE,CRM_PRICE_REGISTRY,CRM_PRICE_MODULES,CRM_PRICE_PARENT_MODULES,CRM_PRICE_REVISION_KEYS,CRM_PRICE_ROW_KEYS,CRM_PRICE_METADATA_KEYS,CRM_PRICE_REVISION_SCHEMA,CRM_PRICE_PROOF_SCHEMA,CRM_PRICE_PROOF_SET_COUNT} from '../../../../scripts/canonical/shared-crm-price-contract.mjs';
const registered=new WeakMap();
const check=(ok,code='CRM_V2_TARGET_UNAVAILABLE')=>{if(!ok)throw crmV2Error(code,503);};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.toSorted().join();
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const canonicalJSON=v=>JSON.stringify(canonical(v));
const canonicalHash=v=>createHash('sha256').update(canonicalJSON(v),'utf16le').digest('hex').toUpperCase();
const hash=v=>typeof v==='string'&&/^[A-F0-9]{64}$/.test(v);
const nativeCopyIdMatches=(value,copyId)=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)&&value.toLowerCase()===copyId.toLowerCase();
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const BUSINESS_PRICE_TABLES=['dbo.business_product_price_versions','dbo.business_product_price_current','dbo.business_product_price_requests'];
const BUSINESS_PRICE_REGISTRY='dbo.stage4_copy_business_product_price_revisions',BUSINESS_PRICE_IMMUTABLE='dbo.immutable_stage4_copy_business_product_price_revisions';
const priceModules=['dbo.business_product_price_versions_guard','dbo.business_product_price_current_guard','dbo.business_product_price_requests_guard','dbo.usp_business_product_prices_v1','dbo.usp_business_product_price_set_v1','dbo.usp_business_product_price_proof_v1'];
const saleModules=['dbo.usp_business_product_price_sale_context_v1','dbo.usp_business_product_price_sale_begin_v1','dbo.usp_business_product_price_sale_intent_v1','dbo.usp_business_product_price_sale_history_v1','dbo.business_product_price_sale_link_guard','dbo.usp_business_product_price_sale_assert_v1','dbo.usp_business_product_price_sale_proof_v1'];
const saleImmutable='dbo.immutable_stage4_copy_business_product_price_sale_revisions',saleRegistry='dbo.stage4_copy_business_product_price_sale_revisions';
export const CRM_ORDER_PRICE_METADATA_SQL=`SELECT DB_NAME() databaseName,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName,ORIGINAL_LOGIN() loginName,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') databaseControl,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess,(SELECT COUNT(*) FROM sys.databases WHERE name<>DB_NAME() AND(UPPER(name) LIKE '%PROD%' OR UPPER(name) LIKE '%LIVE%') AND HAS_DBACCESS(name)=1) liveDatabaseAccess,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${CRM_PRICE_PROOF}',N'P'))),2) proofDefinitionHash,HAS_PERMS_BY_NAME(N'${CRM_PRICE_PROOF}','OBJECT','VIEW DEFINITION') proofViewDefinition,HAS_PERMS_BY_NAME(N'${CRM_PRICE_CREATE}','OBJECT','EXECUTE') createExecute,HAS_PERMS_BY_NAME(N'${CRM_PRICE_READ}','OBJECT','EXECUTE') readExecute,HAS_PERMS_BY_NAME(N'${CRM_PRICE_PROOF}','OBJECT','EXECUTE') proofExecute,HAS_PERMS_BY_NAME(N'dbo.usp_shared_crm_order_create','OBJECT','EXECUTE') oldCreateExecute;`;
function descriptor(context,value){
 assertCrmOrderCurrentContext(context);check(context.target.database===CRM_EXTENDED_DATABASE);
 check(exact(value,CRM_PRICE_REVISION_KEYS)&&value.schemaVersion===CRM_PRICE_REVISION_SCHEMA&&value.version===1&&value.copyId===context.copyId&&value.sourceContextHash===crmOrderCurrentSourceHash(context)&&value.sourceRunId===context.catalog.runId&&value.sourceSnapshotHash===context.catalog.snapshotHash.toUpperCase());
 for(const key of ['baseSealHash','profileHash','sourceContextHash','sourceSnapshotHash','baseSelectedRevisionHash','priceRevisionHash','saleRevisionHash','immutableTriggerHash','registryDDLHash','revisionHash'])check(hash(value[key]));
 const plain=v=>v===null||['string','boolean'].includes(typeof v)||typeof v==='number'&&Number.isFinite(v)||Array.isArray(v)&&v.every(plain)||v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype&&Object.values(v).every(plain);check(plain(value));
 const {revisionHash,...body}=value;check(revisionHash===canonicalHash(body));
 check(Array.isArray(value.modules)&&value.modules.length===3&&new Set(value.modules.map(m=>m.name)).size===3&&value.modules.every(m=>exact(m,['name','beforeHash','afterHash'])&&CRM_PRICE_MODULES.includes(m.name)&&m.beforeHash===null&&hash(m.afterHash)));
 check(Array.isArray(value.parentModules)&&value.parentModules.length===25&&new Set(value.parentModules.map(m=>m.name)).size===25&&value.parentModules.every(m=>exact(m,['name','afterHash'])&&CRM_PRICE_PARENT_MODULES.includes(m.name)&&hash(m.afterHash)));
 for(const name of [...priceModules,...saleModules,BUSINESS_PRICE_IMMUTABLE,saleImmutable])check(value.parentModules.some(m=>m.name===name));
 check(Array.isArray(value.priceSchemaDescriptors)&&value.priceSchemaDescriptors.length===4&&new Set(value.priceSchemaDescriptors.map(s=>s.name)).size===4&&value.priceSchemaDescriptors.every(s=>[...BUSINESS_PRICE_TABLES,BUSINESS_PRICE_REGISTRY].includes(s.name)&&Array.isArray(s.columns)&&Array.isArray(s.keys)&&Array.isArray(s.foreignKeys)&&Array.isArray(s.checks)&&typeof s.trigger==='string'));
 return freeze(structuredClone(value));
}
const truth=v=>v===true||v===1;
const falsity=v=>v===false||v===0;
const normal=value=>String(value??'').replace(/[\[\]\s()]/g,'').toUpperCase();
// SQL Server stores this exact IN check as two reordered equalities. Accept
// only those finite equivalent forms; retain literal case/whitespace so an
// altered allowed value cannot be normalized into MODULE or SCHEMA.
const kindCheck=value=>{
  const compact=String(value??'').split(/('[^']*')/).map((part,i)=>i%2?part:normal(part)).join('');
  return ["KINDIN'MODULE','SCHEMA'","KINDIN'SCHEMA','MODULE'","KIND='MODULE'ORKIND='SCHEMA'","KIND='SCHEMA'ORKIND='MODULE'"].includes(compact)?"KINDIN'MODULE','SCHEMA'":compact;
};
const nativeCheck=(table,value)=>table===BUSINESS_PRICE_REGISTRY?kindCheck(value):normal(value);
const rows=(set,table)=>set.filter(r=>r.tableName===table);
const json=value=>{try{return JSON.parse(value);}catch{check(false,'BUSINESS_PRICE_NATIVE_JSON');}};


function columnType(row){
  if(['nvarchar','varchar','char','nchar'].includes(row.typeName))return `${row.typeName}(${row.maxLength===-1?'max':row.maxLength/(row.typeName.startsWith('n')?2:1)})`;
  if(row.typeName==='decimal')return `decimal(${row.precision},${row.scale})`;
  if(row.typeName==='datetime2')return `datetime2(${row.scale})`;
  return row.typeName;
}

// Pure verification is exported for hostile offline proofs. It grants nothing;
// only configure below can earn the private registration after fresh DB proof.
function validatePriceProof(copy,bundle,result){
  check(Array.isArray(result?.recordsets)&&result.recordsets.length===6&&result.recordsets.every(Array.isArray),'BUSINESS_PRICE_NATIVE_RECORDSETS');
  const [registry,columns,indexes,foreignKeys,checks,triggers]=result.recordsets;
  check(registry.length===bundle.objects.length+BUSINESS_PRICE_TABLES.length,'BUSINESS_PRICE_NATIVE_REGISTRY');
  const expectedNames=[...bundle.objects.map(m=>m.name),...BUSINESS_PRICE_TABLES];
  check(new Set(registry.map(r=>r.name)).size===registry.length&&registry.every(r=>expectedNames.includes(r.name)&&String(r.copyId).toLowerCase()===copy.copyId&&r.revision===12&&r.baseSealHash===copy.sealHash&&r.baseRevisionHash===bundle.baseRevisionHash&&r.profileHash===copy.profileHash&&r.revisionHash===bundle.revision.revisionHash&&r.immutableTriggerHash===bundle.revision.immutableTriggerHash&&falsity(r.triggerDisabled)&&/^[A-F0-9]{64}$/.test(r.afterHash)&&r.actualHash===r.afterHash&&(bundle.objects.some(m=>m.name===r.name&&r.kind==='MODULE'&&m.afterHash===r.afterHash)||BUSINESS_PRICE_TABLES.includes(r.name)&&r.kind==='SCHEMA')),'BUSINESS_PRICE_NATIVE_REGISTRY_PINS');
  const schemas=bundle.schemaDescriptors;
  for(const set of [columns,indexes,foreignKeys,checks,triggers])check(set.every(r=>schemas.some(s=>s.name===r.tableName)),'BUSINESS_PRICE_NATIVE_EXTRA_SCHEMA');
  for(const schema of schemas){
    const cols=rows(columns,schema.name).toSorted((a,b)=>a.ordinal-b.ordinal);
    check(cols.length===schema.columns.length&&cols.every((c,i)=>c.ordinal===i+1&&c.columnName===schema.columns[i].name&&columnType(c)===schema.columns[i].type&&(schema.columns[i].nullable?truth(c.nullable):falsity(c.nullable))&&(schema.columns[i].identity?truth(c.identityColumn):falsity(c.identityColumn))&&normal(c.defaultDefinition)===normal(schema.columns[i].defaultDefinition)),'BUSINESS_PRICE_NATIVE_COLUMNS');
    const actualKeys=rows(indexes,schema.name);
    check(new Set(actualKeys.map(k=>canonicalJSON([truth(k.isPrimary),json(k.columnsJson).map(c=>c.columnName)]))).size===actualKeys.length&&actualKeys.length===schema.keys.length&&actualKeys.every(k=>truth(k.isUnique)&&falsity(k.disabled)&&[1,2].includes(k.indexType)&&falsity(k.hasFilter)&&k.filterDefinition===null&&schema.keys.some(e=>e.primary===truth(k.isPrimary)&&e.primary===!truth(k.uniqueConstraint)&&canonicalJSON(e.columns)===canonicalJSON(json(k.columnsJson).map((c,i)=>{check(c.keyOrdinal===i+1&&falsity(c.descendingKey)&&falsity(c.included),'BUSINESS_PRICE_NATIVE_INDEX_COLUMNS');return c.columnName;})))),'BUSINESS_PRICE_NATIVE_KEYS');
    const actualFks=rows(foreignKeys,schema.name);
    check(new Set(actualFks.map(f=>canonicalJSON([f.referencedTable,json(f.columnsJson)]))).size===actualFks.length&&actualFks.length===schema.foreignKeys.length&&actualFks.every(f=>falsity(f.disabled)&&falsity(f.notTrusted)&&f.onDelete===0&&f.onUpdate===0&&schema.foreignKeys.some(e=>e.table===f.referencedTable&&canonicalJSON(e.columns)===canonicalJSON(json(f.columnsJson).map(c=>c.columnName))&&canonicalJSON(e.referencedColumns)===canonicalJSON(json(f.columnsJson).map(c=>c.referencedColumn)))),'BUSINESS_PRICE_NATIVE_FOREIGN_KEYS');
    const actualChecks=rows(checks,schema.name);
    check(new Set(actualChecks.map(c=>nativeCheck(schema.name,c.definition))).size===actualChecks.length&&actualChecks.length===schema.checks.length&&actualChecks.every(c=>falsity(c.disabled)&&falsity(c.notTrusted)&&schema.checks.some(e=>nativeCheck(schema.name,e)===nativeCheck(schema.name,c.definition))),'BUSINESS_PRICE_NATIVE_CHECKS');
    const guard=rows(triggers,schema.name),expectedHash=schema.trigger===BUSINESS_PRICE_IMMUTABLE?bundle.revision.immutableTriggerHash:bundle.objects.find(o=>o.name===schema.trigger)?.afterHash;
    check(guard.length===1&&guard[0].triggerName===schema.trigger&&falsity(guard[0].disabled)&&falsity(guard[0].insteadOfTrigger)&&guard[0].definitionHash===expectedHash&&canonicalJSON(json(guard[0].eventsJson).map(e=>e.eventName).toSorted())===canonicalJSON(['DELETE','INSERT','UPDATE']),'BUSINESS_PRICE_NATIVE_GUARD');
  }
  return true;
}

const saleRowKeys=['copyId','name','revision','baseSealHash','basePriceRevisionHash','baseSelectedRevisionHash','profileHash','afterHash','revisionHash','actualHash','immutableTriggerHash','triggerDisabled','objectId','objectType','parentName','moduleDisabled','insteadOfTrigger','sessionId','transactionId','immutableParentName','registrySchemaValid','immutableTriggerObjectId','immutableTriggerType','immutableInsteadOfTrigger','immutableEventCount'];
export function validateCrmOrderPriceProof(context,revision,result){
 assertCrmOrderCurrentContext(context);const d=descriptor(context,revision);
 check(Array.isArray(result?.recordsets)&&result.recordsets.length===CRM_PRICE_PROOF_SET_COUNT&&result.recordsets.every(Array.isArray));
 const [leaf,metadata,...rest]=result.recordsets;check(metadata.length===1);const m=metadata[0];
 check(exact(m,CRM_PRICE_METADATA_KEYS)&&m.schemaVersion===CRM_PRICE_PROOF_SCHEMA&&m.db===context.target.database&&m.server===context.target.server&&m.originalLogin===context.target.login&&m.copyId===context.copyId&&m.sealHash===d.baseSealHash&&m.profileHash===d.profileHash&&m.sourceContextHash===d.sourceContextHash&&m.priceRevisionHash===d.priceRevisionHash&&m.saleRevisionHash===d.saleRevisionHash&&m.sourceRunId===d.sourceRunId&&Number.isSafeInteger(m.sessionId)&&m.sessionId>0&&/^[1-9]\d*$/.test(String(m.transactionId))&&m.transactionCount===1&&m.transactionState===1&&m.isolationLevel===4&&['Shared','Exclusive'].includes(m.copyLockMode)&&truth(m.registrySchemaValid));
 check(leaf.length===3&&new Set(leaf.map(r=>r.name)).size===3&&new Set(leaf.map(r=>r.objectId)).size===3);
 for(const r of leaf){check(exact(r,CRM_PRICE_ROW_KEYS)&&CRM_PRICE_MODULES.includes(r.name)&&nativeCopyIdMatches(r.copyId,d.copyId)&&r.revision===1&&r.sourceContextHash===d.sourceContextHash&&r.priceRevisionHash===d.priceRevisionHash&&r.saleRevisionHash===d.saleRevisionHash&&r.profileHash===d.profileHash&&r.revisionHash===d.revisionHash&&r.afterHash===d.modules.find(x=>x.name===r.name).afterHash&&r.actualHash===r.afterHash&&r.immutableTriggerHash===d.immutableTriggerHash&&falsity(r.triggerDisabled)&&Number.isSafeInteger(r.objectId)&&r.objectId>0&&r.objectType==='P'&&r.sessionId===m.sessionId&&String(r.transactionId)===String(m.transactionId));}
 const pins=new Map(d.parentModules.map(p=>[p.name,p.afterHash]));
 validatePriceProof({copyId:d.copyId,sealHash:d.baseSealHash,profileHash:d.profileHash},{objects:priceModules.map(name=>({name,afterHash:pins.get(name)})),baseRevisionHash:d.baseSelectedRevisionHash,revision:{revisionHash:d.priceRevisionHash,immutableTriggerHash:pins.get(BUSINESS_PRICE_IMMUTABLE)},schemaDescriptors:d.priceSchemaDescriptors},{recordsets:rest.slice(0,6)});
 const sale=rest[6];check(sale.length===7&&new Set(sale.map(r=>r.name)).size===7&&new Set(sale.map(r=>r.objectId)).size===7);
 for(const r of sale){const trigger=r.name==='dbo.business_product_price_sale_link_guard';check(exact(r,saleRowKeys)&&saleModules.includes(r.name)&&nativeCopyIdMatches(r.copyId,d.copyId)&&r.revision===13&&r.baseSealHash===d.baseSealHash&&r.basePriceRevisionHash===d.priceRevisionHash&&r.baseSelectedRevisionHash===d.baseSelectedRevisionHash&&r.profileHash===d.profileHash&&r.revisionHash===d.saleRevisionHash&&r.afterHash===pins.get(r.name)&&r.actualHash===r.afterHash&&r.immutableTriggerHash===pins.get(saleImmutable)&&falsity(r.triggerDisabled)&&r.immutableParentName===saleRegistry&&r.objectType===(trigger?'TR':'P')&&r.parentName===(trigger?'dbo.work_sales_links':null)&&Number.isSafeInteger(r.objectId)&&r.objectId>0&&falsity(r.moduleDisabled)&&falsity(r.insteadOfTrigger)&&r.sessionId===m.sessionId&&String(r.transactionId)===String(m.transactionId)&&truth(r.registrySchemaValid)&&Number.isSafeInteger(r.immutableTriggerObjectId)&&r.immutableTriggerObjectId>0&&!sale.some(x=>x.objectId===r.immutableTriggerObjectId)&&r.immutableTriggerType==='TR'&&falsity(r.immutableInsteadOfTrigger)&&r.immutableEventCount===3);}
 check(new Set(sale.map(r=>r.immutableTriggerObjectId)).size===1);return true;
}
async function prove(context,revision,request){
 check(typeof request?.query==='function');const expected=revision.modules.find(m=>m.name===CRM_PRICE_PROOF).afterHash;
 const identity=async()=>{const result=await request.query(CRM_ORDER_PRICE_METADATA_SQL);check(result?.recordset?.length===1);const m=result.recordset[0];check(exact(m,['databaseName','serverName','loginName','databaseUser','sysadmin','databaseControl','originalDatabaseAccess','liveDatabaseAccess','proofDefinitionHash','proofViewDefinition','createExecute','readExecute','proofExecute','oldCreateExecute']));assertCrmOrderCurrentIdentity(context,m);check(m.proofDefinitionHash===expected&&m.proofViewDefinition===1&&m.createExecute===1&&m.readExecute===1&&m.proofExecute===1&&m.oldCreateExecute===0);};
 await identity();const result=await request.query(`EXEC ${CRM_PRICE_PROOF} @source_context_hash=N'${revision.sourceContextHash}';`);validateCrmOrderPriceProof(context,revision,result);await identity();
}
export async function configureCrmOrderPriceContext(context,value,request){
 const revision=descriptor(context,value),previous=registered.get(context);check(!previous||previous.revision.revisionHash===revision.revisionHash);await prove(context,revision,request);
 if(previous)return previous;const capability=freeze({revision,procedures:{create:CRM_PRICE_CREATE,read:CRM_PRICE_READ,proof:CRM_PRICE_PROOF}});registered.set(context,capability);return capability;
}
export const getRegisteredCrmOrderPriceContext=context=>context&&registered.get(context)||null;
export async function verifyCrmOrderPriceContext(context,request){const value=getRegisteredCrmOrderPriceContext(context);check(value);await prove(context,value.revision,request);return value;}
