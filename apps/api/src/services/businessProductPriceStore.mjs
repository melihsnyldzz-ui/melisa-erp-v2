import {assertIsolatedCopyContext,assertIsolatedCopyIdentity,BUSINESS_COPY_DATABASE} from './isolatedOperationCopyContext.mjs';
import {assertBusinessProductPriceActor,businessProductPriceContext,businessProductPriceError} from './businessProductPriceModel.mjs';
import {BUSINESS_PRICE_GET,BUSINESS_PRICE_SET} from '../../../../scripts/canonical/shared-business-product-price-revision-contract.mjs';

export const BUSINESS_PRICE_TRANSACTION_SQL=`SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess,@@SPID sessionId,CURRENT_TRANSACTION_ID() transactionId,@@TRANCOUNT transactionCount,XACT_STATE() transactionState,(SELECT transaction_isolation_level FROM sys.dm_exec_sessions WHERE session_id=@@SPID) isolationLevel,APPLOCK_MODE(N'public',N'melisa-stage4-copy:'+LOWER(CONVERT(varchar(36),@copy_id)),N'Transaction') copyLockMode;`;
const unavailable=()=>businessProductPriceError('BUSINESS_PRICE_UNAVAILABLE',503);
const check=ok=>{if(!ok)throw unavailable();};
const parse=text=>{check(typeof text==='string');try{return JSON.parse(text);}catch{throw unavailable();}};
const uuidTransaction=v=>/^[1-9]\d*$/.test(String(v))&&(typeof v!=='number'||Number.isSafeInteger(v));
export function businessPriceProcedureRow(result){
 const sets=result?.recordsets;check(Array.isArray(sets)&&sets.length>0&&sets.every(Array.isArray));
 const contextSets=sets.filter(rows=>rows.some(row=>Object.hasOwn(row,'context_json')));
 check(contextSets.length===1&&contextSets[0].length===1&&sets.every(rows=>rows===contextSets[0]||rows.length===0));
 const row=contextSets[0][0],keys=['context_json','actor_json','replayed','sessionId','transactionId','readerDefinitionHash'];
 check(row&&Object.keys(row).length===keys.length&&keys.every(k=>Object.hasOwn(row,k)));return row;
}
async function defaultRuntime(){
 const db=await import('../config/database.js');check(db.isIsolatedOperationCopyRuntime?.());
 const copyContext=assertIsolatedCopyContext(db.getIsolatedOperationCopyConfig());
 return {copyContext,pool:await db.getSqlPool(),sql:db.getSqlDriver()};
}

// Registration remains private to the canonical native bootstrap. Neither
// injected runtime fields, JWT admin flags nor raw SQL canEdit create authority.
export function createBusinessProductPriceStore({getRuntime=defaultRuntime}={}){
 check(typeof getRuntime==='function');
 return Object.freeze({async withProductPrice({productId,actor,write=false},fn){
  let tx;
  try{
   check(typeof fn==='function'&&typeof write==='boolean'&&typeof productId==='string'&&/^[1-9]\d*$/.test(productId)&&BigInt(productId)<=9223372036854775807n);
   const runtime=await getRuntime(),copy=assertIsolatedCopyContext(runtime.copyContext),q=runtime.sql;
   check(copy.target.database===BUSINESS_COPY_DATABASE&&copy.scopeKind==='VERIFIED_BUSINESS_TEST'&&runtime.pool&&q);
   const bootstrap=await import('../../../../scripts/canonical/shared-business-product-price-bootstrap.mjs');
   const registered=bootstrap.getRegisteredBusinessProductPriceRevision(copy);check(registered);
   if(write&&!registered.canEdit)throw businessProductPriceError('BUSINESS_PRICE_FORBIDDEN',403);
   tx=new q.Transaction(runtime.pool);await tx.begin(q.ISOLATION_LEVEL.SERIALIZABLE);
   let active=true;const req=()=>{check(active);const request=new q.Request(tx);check(request.parent===tx);return request;};
   const readMeta=async()=>{const rows=(await req().input('copy_id',q.UniqueIdentifier,copy.copyId).query(BUSINESS_PRICE_TRANSACTION_SQL)).recordset;check(rows?.length===1);const row=rows[0];assertIsolatedCopyIdentity(copy,row);check(row.transactionCount===1&&row.transactionState===1&&row.isolationLevel===4&&Number.isSafeInteger(row.sessionId)&&row.sessionId>0&&uuidTransaction(row.transactionId)&&row.copyLockMode===(write?'Exclusive':'Shared'));return row;};
   await req().input('lockKey',q.NVarChar(255),'melisa-stage4-copy:'+copy.copyId).query(`DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=@lockKey,@LockMode=N'${write?'Exclusive':'Shared'}',@LockOwner=N'Transaction',@LockTimeout=15000;IF @r<0 THROW 51401,'ISOLATED_COPY_BUSY',1;`);
   const before=await readMeta();
   const verify=async()=>{const value=await bootstrap.verifyBusinessProductPriceRevision(copy,req().input('copy_id',q.UniqueIdentifier,copy.copyId),{write});check(value===registered);return value;};
   await verify();
   const call=async(proc,payloadJson)=>{
    const request=req().input('copy_id',q.UniqueIdentifier,copy.copyId).input('product_id',q.BigInt,productId).input('actor_id',q.BigInt,String(actor?.id));
    if(payloadJson!==undefined){check(write&&typeof payloadJson==='string'&&Buffer.byteLength(payloadJson,'utf16le')<=8192);request.input('payload_json',q.NVarChar(q.MAX),payloadJson);}
    const row=businessPriceProcedureRow(await request.execute(proc)),pin=registered.revision.modules.find(m=>m.name===proc);
    check(pin&&row.readerDefinitionHash===pin.afterHash&&row.sessionId===before.sessionId&&uuidTransaction(row.transactionId)&&String(row.transactionId)===String(before.transactionId)&&typeof row.replayed==='boolean'&&(proc!==BUSINESS_PRICE_GET||row.replayed===false));
    const actualActor=parse(row.actor_json),canEdit=registered.canEdit===true;
    assertBusinessProductPriceActor(copy,actor,actualActor,{write,canEdit});
    const context=businessProductPriceContext(copy,parse(row.context_json),{canEdit});check(context.productId===productId);
    return {actualActor,canEdit,context,replayed:row.replayed};
   };
   const initial=await call(BUSINESS_PRICE_GET);
   const update=async payloadJson=>{check(write&&registered.canEdit===true);await verify();const result=await call(BUSINESS_PRICE_SET,payloadJson);return {context:result.context,replayed:result.replayed};};
   let result;
   try{result=await fn(Object.freeze({copy,actualActor:initial.actualActor,canEdit:initial.canEdit,context:initial.context,update}));await verify();const after=await readMeta();check(before.sessionId===after.sessionId&&String(before.transactionId)===String(after.transactionId));}finally{active=false;}
   await tx.commit();return result;
  }catch(error){
   if(tx)try{await tx.rollback();}catch{}
   const numbers=[error?.number,error?.originalError?.info?.number,...(error?.precedingErrors??[]).map(e=>e.number)];
   if(numbers.includes(51905))throw businessProductPriceError('BUSINESS_PRICE_STALE',409);
   if(numbers.includes(51906))throw businessProductPriceError('BUSINESS_PRICE_REQUEST_CONFLICT',409);
   if(error?.statusCode)throw error;
   throw unavailable();
  }
 }});
}
export const businessProductPriceStore=createBusinessProductPriceStore();
