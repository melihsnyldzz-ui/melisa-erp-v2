import {desktopTargetForProfile} from '../config/desktopEmptyV7Profile.mjs';
// Source-only transaction ownership primitive. The private production service
// must supply the verifier obtained from the registered normal-auth instance.
// This module neither connects nor starts/commits a transaction.
import {AsyncLocalStorage} from 'node:async_hooks';
const fail=()=>{throw Error('DESKTOP_FINAL_CANCEL_SCOPE_UNAVAILABLE');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const physicalOwners=new WeakMap();
const physicalSql='SELECT DB_NAME() targetDatabase,@@SPID sessionId,CONVERT(varchar(20),CURRENT_TRANSACTION_ID()) transactionId,@@TRANCOUNT transactionCount,XACT_STATE() transactionState;';
export function createDesktopFinalCancellationScope({sql,verifySession,targetProfile=null}={}){
 if(typeof sql?.Request!=='function'||typeof verifySession!=='function')fail();
 const storage=new AsyncLocalStorage(),owners=physicalOwners,registered=new WeakSet();
 async function physical(transaction){
  const rows=(await new sql.Request(transaction).query(physicalSql))?.recordset;
  if(!Array.isArray(rows)||rows.length!==1)fail();const r=rows[0];
  if(r.targetDatabase!==desktopTargetForProfile(targetProfile).database||!Number.isInteger(r.sessionId)||r.sessionId<1||!id(r.transactionId)||r.transactionCount!==1||r.transactionState!==1)fail();
  return Object.freeze({targetDatabase:r.targetDatabase,sessionId:r.sessionId,transactionId:r.transactionId});
 }
 const samePhysical=(a,b)=>a.targetDatabase===b.targetDatabase&&a.sessionId===b.sessionId&&a.transactionId===b.transactionId;
 async function withScope({transaction,actorId,requestId,invoiceId}={},fn){
  if(!transaction||typeof transaction!=='object'||!id(actorId)||!uuid(requestId)||!id(invoiceId)||typeof fn!=='function'||storage.getStore()||owners.has(transaction))fail();
  const state={transaction,actorId,requestId,invoiceId,scope:null,active:false};owners.set(transaction,state);
  try{
   const before=await physical(transaction);
   if(await verifySession({transaction,actorId,permission:['sales.view','sales.cancel']})!==true)fail();
   const after=await physical(transaction);if(!samePhysical(before,after))fail();
   const scope=Object.freeze({actorId,requestId,invoiceId,...after});registered.add(scope);state.scope=scope;state.active=true;
   return await storage.run(state,()=>fn(scope));
  }finally{state.active=false;owners.delete(transaction);}
 }
 async function verifyScope({transaction,scope,invoiceId}={}){
  const state=storage.getStore(),valid=()=>Boolean(state?.active&&owners.get(transaction)===state&&state.transaction===transaction&&state.scope===scope&&registered.has(scope)&&invoiceId===state.invoiceId);
  if(!valid())return false;
  try{
   const current=await physical(transaction);return valid()&&samePhysical(current,scope);
  }catch{return false;}
 }
 return Object.freeze({withScope,verifyScope});
}
