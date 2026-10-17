import {assertIsolatedCopyContext,assertIsolatedCopyIdentity,isolatedCopyHash,isolatedCopyJSON} from '../../apps/api/src/services/isolatedOperationCopyContext.mjs';
import {getRegisteredBusinessSelectedSaleRevision,verifyBusinessSelectedSaleRevision} from './shared-business-selected-sale-revision-bootstrap.mjs';
import {buildBusinessProductPriceRevision} from './shared-business-product-price-revision-sql.mjs';
import {getRegisteredBusinessProductPriceSaleRevision,verifyBusinessProductPriceSaleRevision} from './shared-business-product-price-sale-bootstrap.mjs';
import {BUSINESS_PRICE_GET,BUSINESS_PRICE_SET,BUSINESS_PRICE_PROOF,BUSINESS_PRICE_TABLES,BUSINESS_PRICE_REGISTRY,BUSINESS_PRICE_IMMUTABLE} from './shared-business-product-price-revision-contract.mjs';

const registered=new WeakMap();
const check=(ok,code)=>{if(!ok)throw Object.assign(new Error('Ürün fiyatı kaynak ve yerel yetki kanıtı doğrulanamadı.'),{code,statusCode:503});};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.toSorted().join();
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
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
const privateTables=[...BUSINESS_PRICE_TABLES,BUSINESS_PRICE_REGISTRY];

// Caller binds @copy_id on the SAME SERIALIZABLE transaction request. This
// metadata runs as the restricted caller, independently of owner EXEC proof.
export const BUSINESS_PRODUCT_PRICE_METADATA_SQL=`SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess,@@SPID sessionId,CURRENT_TRANSACTION_ID() transactionId,@@TRANCOUNT transactionCount,XACT_STATE() transactionState,(SELECT transaction_isolation_level FROM sys.dm_exec_sessions WHERE session_id=@@SPID) isolationLevel,APPLOCK_MODE(N'public',N'melisa-stage4-copy:'+LOWER(CONVERT(varchar(36),@copy_id)),N'Transaction') copyLockMode,(SELECT COUNT(*) FROM(VALUES ${privateTables.map(n=>`(N'${n}')`).join(',')})t(name) WHERE HAS_PERMS_BY_NAME(t.name,'OBJECT','SELECT')=0 AND HAS_PERMS_BY_NAME(t.name,'OBJECT','INSERT')=0 AND HAS_PERMS_BY_NAME(t.name,'OBJECT','UPDATE')=0 AND HAS_PERMS_BY_NAME(t.name,'OBJECT','DELETE')=0) privateAccessRows,HAS_PERMS_BY_NAME(N'${BUSINESS_PRICE_GET}','OBJECT','EXECUTE') getterExecute,HAS_PERMS_BY_NAME(N'${BUSINESS_PRICE_SET}','OBJECT','EXECUTE') setterExecute,HAS_PERMS_BY_NAME(N'${BUSINESS_PRICE_PROOF}','OBJECT','EXECUTE') proofExecute,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${BUSINESS_PRICE_PROOF}'))),2) proofDefinitionHash;`;

function assertMetadata(copy,result,write){
  const row=result?.recordset?.length===1?result.recordset[0]:null;
  check(row&&exact(row,['db','server','login','databaseUser','sysadmin','control','live','originalDatabaseAccess','sessionId','transactionId','transactionCount','transactionState','isolationLevel','copyLockMode','privateAccessRows','getterExecute','setterExecute','proofExecute','proofDefinitionHash']),'BUSINESS_PRICE_NATIVE_METADATA');
  assertIsolatedCopyIdentity(copy,row);
  check(Number.isInteger(row.sessionId)&&row.sessionId>0&&/^[1-9]\d*$/.test(String(row.transactionId))&&row.transactionCount===1&&row.transactionState===1&&row.isolationLevel===4&&(write?row.copyLockMode==='Exclusive':['Shared','Exclusive'].includes(row.copyLockMode))&&row.privateAccessRows===4&&row.getterExecute===1&&row.setterExecute===1&&row.proofExecute===1,'BUSINESS_PRICE_NATIVE_TRANSACTION');
  return row;
}
function columnType(row){
  if(['nvarchar','varchar','char','nchar'].includes(row.typeName))return `${row.typeName}(${row.maxLength===-1?'max':row.maxLength/(row.typeName.startsWith('n')?2:1)})`;
  if(row.typeName==='decimal')return `decimal(${row.precision},${row.scale})`;
  if(row.typeName==='datetime2')return `datetime2(${row.scale})`;
  return row.typeName;
}

// Pure verification is exported for hostile offline proofs. It grants nothing;
// only configure below can earn the private registration after fresh DB proof.
export function validateBusinessProductPriceNativeProof(copy,bundle,result){
  assertIsolatedCopyContext(copy);
  check(Array.isArray(result?.recordsets)&&result.recordsets.length===6&&result.recordsets.every(Array.isArray),'BUSINESS_PRICE_NATIVE_RECORDSETS');
  const [registry,columns,indexes,foreignKeys,checks,triggers]=result.recordsets;
  check(registry.length===bundle.objects.length+BUSINESS_PRICE_TABLES.length,'BUSINESS_PRICE_NATIVE_REGISTRY');
  const expectedNames=[...bundle.objects.map(m=>m.name),...BUSINESS_PRICE_TABLES];
  check(new Set(registry.map(r=>r.name)).size===registry.length&&registry.every(r=>expectedNames.includes(r.name)&&String(r.copyId).toLowerCase()===copy.copyId&&r.revision===12&&r.baseSealHash===copy.sealHash&&r.baseRevisionHash===bundle.baseRevisionHash&&r.profileHash===isolatedCopyHash(copy)&&r.revisionHash===bundle.revision.revisionHash&&r.immutableTriggerHash===bundle.revision.immutableTriggerHash&&falsity(r.triggerDisabled)&&/^[A-F0-9]{64}$/.test(r.afterHash)&&r.actualHash===r.afterHash&&(bundle.objects.some(m=>m.name===r.name&&r.kind==='MODULE'&&m.afterHash===r.afterHash)||BUSINESS_PRICE_TABLES.includes(r.name)&&r.kind==='SCHEMA')),'BUSINESS_PRICE_NATIVE_REGISTRY_PINS');
  const schemas=bundle.schemaDescriptors;
  for(const set of [columns,indexes,foreignKeys,checks,triggers])check(set.every(r=>schemas.some(s=>s.name===r.tableName)),'BUSINESS_PRICE_NATIVE_EXTRA_SCHEMA');
  for(const schema of schemas){
    const cols=rows(columns,schema.name).toSorted((a,b)=>a.ordinal-b.ordinal);
    check(cols.length===schema.columns.length&&cols.every((c,i)=>c.ordinal===i+1&&c.columnName===schema.columns[i].name&&columnType(c)===schema.columns[i].type&&(schema.columns[i].nullable?truth(c.nullable):falsity(c.nullable))&&(schema.columns[i].identity?truth(c.identityColumn):falsity(c.identityColumn))&&normal(c.defaultDefinition)===normal(schema.columns[i].defaultDefinition)),'BUSINESS_PRICE_NATIVE_COLUMNS');
    const actualKeys=rows(indexes,schema.name);
    check(new Set(actualKeys.map(k=>isolatedCopyJSON([truth(k.isPrimary),json(k.columnsJson).map(c=>c.columnName)]))).size===actualKeys.length&&actualKeys.length===schema.keys.length&&actualKeys.every(k=>truth(k.isUnique)&&falsity(k.disabled)&&[1,2].includes(k.indexType)&&falsity(k.hasFilter)&&k.filterDefinition===null&&schema.keys.some(e=>e.primary===truth(k.isPrimary)&&e.primary===!truth(k.uniqueConstraint)&&isolatedCopyJSON(e.columns)===isolatedCopyJSON(json(k.columnsJson).map((c,i)=>{check(c.keyOrdinal===i+1&&falsity(c.descendingKey)&&falsity(c.included),'BUSINESS_PRICE_NATIVE_INDEX_COLUMNS');return c.columnName;})))),'BUSINESS_PRICE_NATIVE_KEYS');
    const actualFks=rows(foreignKeys,schema.name);
    check(new Set(actualFks.map(f=>isolatedCopyJSON([f.referencedTable,json(f.columnsJson)]))).size===actualFks.length&&actualFks.length===schema.foreignKeys.length&&actualFks.every(f=>falsity(f.disabled)&&falsity(f.notTrusted)&&f.onDelete===0&&f.onUpdate===0&&schema.foreignKeys.some(e=>e.table===f.referencedTable&&isolatedCopyJSON(e.columns)===isolatedCopyJSON(json(f.columnsJson).map(c=>c.columnName))&&isolatedCopyJSON(e.referencedColumns)===isolatedCopyJSON(json(f.columnsJson).map(c=>c.referencedColumn)))),'BUSINESS_PRICE_NATIVE_FOREIGN_KEYS');
    const actualChecks=rows(checks,schema.name);
    check(new Set(actualChecks.map(c=>nativeCheck(schema.name,c.definition))).size===actualChecks.length&&actualChecks.length===schema.checks.length&&actualChecks.every(c=>falsity(c.disabled)&&falsity(c.notTrusted)&&schema.checks.some(e=>nativeCheck(schema.name,e)===nativeCheck(schema.name,c.definition))),'BUSINESS_PRICE_NATIVE_CHECKS');
    const guard=rows(triggers,schema.name),expectedHash=schema.trigger===BUSINESS_PRICE_IMMUTABLE?bundle.revision.immutableTriggerHash:bundle.objects.find(o=>o.name===schema.trigger)?.afterHash;
    check(guard.length===1&&guard[0].triggerName===schema.trigger&&falsity(guard[0].disabled)&&falsity(guard[0].insteadOfTrigger)&&guard[0].definitionHash===expectedHash&&isolatedCopyJSON(json(guard[0].eventsJson).map(e=>e.eventName).toSorted())===isolatedCopyJSON(['DELETE','INSERT','UPDATE']),'BUSINESS_PRICE_NATIVE_GUARD');
  }
  return true;
}

async function prove(copy,bundle,request,write){
  check(typeof request?.query==='function','BUSINESS_PRICE_NATIVE_REQUEST');
  const before=assertMetadata(copy,await request.query(BUSINESS_PRODUCT_PRICE_METADATA_SQL),write);
  const expectedProof=bundle.objects.find(o=>o.name===BUSINESS_PRICE_PROOF)?.afterHash;
  check(before.proofDefinitionHash===expectedProof,'BUSINESS_PRICE_NATIVE_PROOF_DEFINITION');
  await verifyBusinessSelectedSaleRevision(copy,request);
  validateBusinessProductPriceNativeProof(copy,bundle,await request.query(bundle.proofSQL));
  const after=assertMetadata(copy,await request.query(BUSINESS_PRODUCT_PRICE_METADATA_SQL),write);
  check(after.proofDefinitionHash===expectedProof,'BUSINESS_PRICE_NATIVE_PROOF_DEFINITION');
  check(before.sessionId===after.sessionId&&String(before.transactionId)===String(after.transactionId)&&before.copyLockMode===after.copyLockMode,'BUSINESS_PRICE_NATIVE_FRAME');
}

export async function configureBusinessProductPriceRevision(copy,candidateRevision,request){
  assertIsolatedCopyContext(copy);check(!registered.has(copy),'BUSINESS_PRICE_ALREADY_REGISTERED');
  const predecessor=getRegisteredBusinessSelectedSaleRevision(copy)?.stockPredicateRevision;
  check(predecessor?.version===11,'BUSINESS_PRICE_REGISTERED_V11_REQUIRED');
  const bundle=buildBusinessProductPriceRevision({copyContext:copy,baseRevision:predecessor});
  check(isolatedCopyJSON(bundle.revision)===isolatedCopyJSON(candidateRevision),'BUSINESS_PRICE_CANONICAL_REVISION');
  await prove(copy,bundle,request,false);
  // No boolean/env/HTTP activation path. Manual writes stay unavailable until
  // the separately installed sale consumer earns its own native capability.
  const value=freeze({revision:bundle.revision,bundle,get canEdit(){
    const consumer=getRegisteredBusinessProductPriceSaleRevision(copy);
    return consumer?.canEdit===true&&consumer.revision.basePriceRevisionHash===bundle.revision.revisionHash;
  }});
  registered.set(copy,value);return value;
}
export function getRegisteredBusinessProductPriceRevision(copy){return registered.get(copy)??null;}
export async function verifyBusinessProductPriceRevision(copy,request,{write=false}={}){
  assertIsolatedCopyContext(copy);const value=registered.get(copy);
  check(value&&typeof write==='boolean'&&(!write||value.canEdit===true),'BUSINESS_PRICE_REGISTERED_CAPABILITY');
  await prove(copy,value.bundle,request,write);
  // Only a write needs the consumer proof here. Consumer proof calls this
  // metadata verifier read-only, so neither registration nor reads recurse.
  if(write)await verifyBusinessProductPriceSaleRevision(copy,request,{write:true});
  return value;
}
