import {OPENING_PRICE_RUN} from './openingPriceService.js';
export const OPERATION_QUARANTINE_SEAL='69ff490f2938e34aa2f10399a5cf7b8042950667780779a15d708188c4b90de7';
const entities=new Set(['product','customer','supplier']);
const fail=(code,message,statusCode=503,meta={})=>Object.assign(new Error(message),{code,statusCode,meta});
const invalid=()=>fail('MIGRATION_QUARANTINE_DRIFT','Geçiş karantinası doğrulanamadı; işlem kapalı.');
const bit=v=>v===true||v===1?true:v===false||v===0?false:null;
function nativeId(value,nullable=false){if(nullable&&value==null)return null;const text=typeof value==='number'&&Number.isSafeInteger(value)?String(value):value;if(typeof text!=='string'||!/^[1-9]\d*$/.test(text)||BigInt(text)>9223372036854775807n)throw invalid();return text;}
function metaFrom(row){
 if(!row||row.database_name!==OPENING_PRICE_RUN.database||row.run_id!==OPENING_PRICE_RUN.runId||row.run_status!=='COMMITTED'
 ||row.source_hash!==OPENING_PRICE_RUN.sourceHash||row.plan_hash!==OPENING_PRICE_RUN.planHash||bit(row.sealed)!==true||bit(row.operation_gate)!==true
 ||row.seal_hash!==OPERATION_QUARANTINE_SEAL||row.source_as_of!=='2026-09-30')throw invalid();
 return {runId:row.run_id,sourceHash:row.source_hash,planHash:row.plan_hash,sourceAsOf:row.source_as_of,readOnly:true,sealed:true,operationGate:true,sealHash:row.seal_hash};
}
export function normalizeQuarantineEntities(rows=[]){
 if(!Array.isArray(rows)||rows.length>2000)throw fail('MIGRATION_ENTITY_ID_INVALID','Geçerli işlem kartları gerekli.',400);
 const unique=new Map();for(const row of rows){if(!entities.has(row?.entity))throw fail('MIGRATION_ENTITY_ID_INVALID','Geçerli kart türü gerekli.',400);
  let id;try{id=nativeId(row.nativeId);}catch{throw fail('MIGRATION_ENTITY_ID_INVALID','Geçerli native kart kimliği gerekli.',400);}unique.set(`${row.entity}/${id}`,{entity:row.entity,nativeId:id});}
 return [...unique.values()];
}
export function parseQuarantineQuery(query={}){
 if(Object.keys(query).some(k=>!['entity','search','page','limit'].includes(k))||!entities.has(query.entity))throw fail('MIGRATION_QUARANTINE_QUERY_INVALID','Geçerli karantina türü gerekli.',400);
 if(query.search!==undefined&&(typeof query.search!=='string'||query.search.length>120))throw fail('MIGRATION_QUARANTINE_QUERY_INVALID','Arama en fazla120 karakter olmalı.',400);
 const number=(v,d,max)=>{if(v===undefined)return d;if(typeof v!=='string'||!/^\d+$/.test(v)||!Number.isSafeInteger(Number(v))||Number(v)<1||Number(v)>max)throw fail('MIGRATION_QUARANTINE_QUERY_INVALID','Geçerli sayfalama gerekli.',400);return Number(v);};
 return {entity:query.entity,search:query.search??'',page:number(query.page,1,100000),limit:number(query.limit,50,100)};
}
function rowDto(row,entity){
 let reasons;try{reasons=JSON.parse(row.reasons_json);}catch{throw invalid();}
 const id=nativeId(row.native_id,true);
 if(row.entity!==entity||typeof row.source_key!=='string'||!row.source_key.startsWith('VEGA_CAPTURE_20260930_01/')
 ||typeof row.source_code!=='string'||typeof row.source_name!=='string'||(id===null?row.status!=='not-present':row.status!=='blocked')
 ||![null,'string'].includes(row.native_code==null?null:typeof row.native_code)||![null,'string'].includes(row.native_name==null?null:typeof row.native_name)
 ||!Array.isArray(reasons)||!reasons.length||reasons.some(v=>typeof v!=='string'||!/^[A-Z0-9_]+$/.test(v)))throw invalid();
 return {entityType:entity,sourceKey:row.source_key,nativeId:id,sourceCode:row.source_code,sourceName:row.source_name,
 nativeCode:row.native_code??null,nativeName:row.native_name??null,status:row.status,reasons};
}
export function createOperationQuarantineService({getPool,sql,isTest,canonicalRequested=()=>process.env.MELISA_CANONICAL_TEST==='true'}={}){
 async function runtime(context){
  if(getPool){if(!isTest?.()){if(canonicalRequested())throw invalid();return null;}return context??{request:async()=>(await getPool()).request(),driver:sql};}
  const db=await import('../config/database.js');if(!db.isCanonicalTest()){if(canonicalRequested())throw invalid();return null;}
  if(context)return context;const pool=await db.getSqlPool();return {request:()=>pool.request(),driver:db.getSqlDriver()};
 }
 async function read(fn,context,allowOutside=false){try{const rt=await runtime(context);if(!rt){if(allowOutside)return null;throw fail('MIGRATION_QUARANTINE_TEST_ONLY','Karantina görünümü yalnız izole TEST üzerinde okunabilir.');}return await fn(rt);}catch(e){if(e.code?.startsWith('MIGRATION_'))throw e;throw fail('MIGRATION_QUARANTINE_NOT_READY','Geçiş karantinası henüz doğrulanamıyor; işlem kapalı.');}}
 return {
  async list(query){const o=parseQuarantineQuery(query);return read(async rt=>{
   const request=await rt.request(),r=await request.input('entity',rt.driver.NVarChar(20),o.entity).input('search',rt.driver.NVarChar(120),o.search).input('page',rt.driver.Int,o.page).input('page_size',rt.driver.Int,o.limit).execute('dbo.usp_list_operation_quarantine');
   if(r.recordsets?.[0]?.length!==1)throw invalid();const h=r.recordsets[0][0],meta=metaFrom(h),total=Number(h.total),rows=r.recordsets?.[1];
   if(!Number.isSafeInteger(total)||total<0||Number(h.page)!==o.page||Number(h.page_size)!==o.limit||!Array.isArray(rows)||rows.length!==Math.min(o.limit,Math.max(0,total-(o.page-1)*o.limit)))throw invalid();
   const data=rows.map(row=>rowDto(row,o.entity));if(new Set(data.map(row=>row.sourceKey)).size!==data.length)throw invalid();
   const nativeHeld=Number(h.native_held),notPresent=Number(h.not_present);if(!Number.isSafeInteger(nativeHeld)||nativeHeld<0||!Number.isSafeInteger(notPresent)||notPresent<0)throw invalid();
   return {data,meta:{...meta,total,page:o.page,limit:o.limit,totalPages:Math.ceil(total/o.limit),nativeHeld,notPresent,countScope:'selected-entity-full-scope'}};
  });},
  async assertAllowed(raw,context){return read(async rt=>{const wanted=normalizeQuarantineEntities(raw);if(!wanted.length)return;
   for(let start=0;start<wanted.length;start+=200){const batch=wanted.slice(start,start+200),request=await rt.request(),result=await request.input('entities_json',rt.driver.NVarChar(rt.driver.MAX),JSON.stringify(batch)).execute('dbo.usp_check_operation_quarantine');
    if(result.recordsets?.[0]?.length!==1)throw invalid();metaFrom(result.recordsets[0][0]);const rows=result.recordsets?.[1];if(!Array.isArray(rows)||rows.length!==batch.length)throw invalid();
    const expected=new Set(batch.map(r=>`${r.entity}/${r.nativeId}`)),blocked=[];
    for(const row of rows){const key=`${row.entity}/${nativeId(row.native_id)}`;if(!expected.delete(key)||bit(row.blocked)===null)throw invalid();
     if(bit(row.blocked)){if(typeof row.source_key!=='string'||!/^[A-Z0-9_]+$/.test(row.reason_code??''))throw invalid();blocked.push({entityType:row.entity,nativeId:nativeId(row.native_id),reasonCode:row.reason_code});}}
    if(expected.size)throw invalid();if(blocked.length)throw fail('MIGRATION_ENTITY_QUARANTINED','Kartın geçiş eşleştirmesi tamamlanmadı; işlem yapılamaz.',409,{quarantine:blocked});
   }
  },context,true);},
 };
}
export const operationQuarantineService=createOperationQuarantineService();
export const assertOperationQuarantineAllowed=(rows,context)=>operationQuarantineService.assertAllowed(rows,context);
export const quarantineTransactionContext=(driver,transaction)=>({driver,request:()=>new driver.Request(transaction)});
