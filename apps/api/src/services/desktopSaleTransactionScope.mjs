// Source only. Profile-bound transaction context; never creates a transaction,
// modifies roles or grants, or installs native invoice guard integration.
import {AsyncLocalStorage} from 'node:async_hooks';
const fail=()=>{throw Error('DESKTOP_SALE_SCOPE_UNAVAILABLE');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const sqlText=`SELECT DB_NAME() targetDatabase,@@SPID sessionId,CONVERT(varchar(20),CURRENT_TRANSACTION_ID()) transactionId,@@TRANCOUNT transactionCount,XACT_STATE() transactionState;`;
export function createDesktopSaleTransactionScope({sql,verifySession}={}){
 if(typeof sql?.Request!=='function'||typeof verifySession!=='function')fail();
 const storage=new AsyncLocalStorage(),registered=new WeakSet();
 async function withScope({transaction,actorId,requestId,customerId,productId,productIds}={},fn){
  const multi=productIds!==undefined;
  if(multi&&(productId!==undefined||!Array.isArray(productIds)||productIds.length!==2||productIds.some(v=>!id(v))||new Set(productIds).size!==2))fail();
  const selected=multi?Object.freeze([...productIds]):Object.freeze([productId]);
  if(!transaction||!id(actorId)||!uuid(requestId)||!id(customerId)||!selected.every(id)||typeof fn!=='function'||storage.getStore())fail();
  if(await verifySession({transaction,actorId,permission:['sales.create','sales.finalize']})!==true)fail();
  const result=await new sql.Request(transaction).query(sqlText),rows=result?.recordset;if(!Array.isArray(rows)||rows.length!==1)fail();const row=rows[0];
  if(typeof row.targetDatabase!=='string'||!row.targetDatabase||row.targetDatabase.length>128||!Number.isInteger(row.sessionId)||row.sessionId<1||!id(row.transactionId)||row.transactionCount!==1||row.transactionState!==1)fail();
  const state={transaction,actorId,requestId,customerId,productId,productIds:selected,multi,active:true,base:null,bound:null};
  const base=Object.freeze({actorId,requestId,customerId,...(multi?{productIds:selected}:{productId}),targetDatabase:row.targetDatabase,sessionId:row.sessionId,transactionId:row.transactionId});state.base=base;registered.add(base);
  return storage.run(state,async()=>{try{return await fn(Object.freeze({scope:base,bindInvoice(expected,invoiceId){
   const sameSelection=multi?Array.isArray(expected?.lines)&&expected.lines.length===selected.length&&expected.lines.every((line,i)=>line.productId===selected[i]):expected?.productId===productId;
   if(!state.active||state.bound||!expected||expected.customerId!==customerId||!sameSelection||!id(invoiceId))fail();
   const bound=Object.freeze({...expected,...base,invoiceId});registered.add(bound);state.bound=bound;return bound;
  }}));}finally{state.active=false;}});
 }
 function verifyScope({transaction,scope,customerId,productId,invoiceId}={}){
  const state=storage.getStore();if(!state?.active||transaction!==state.transaction||!scope||!registered.has(scope)||scope!==state.base&&scope!==state.bound)return false;
  if(customerId!==undefined&&customerId!==state.customerId||productId!==undefined&&!state.productIds.includes(productId)||invoiceId!==undefined&&(!state.bound||scope!==state.bound||invoiceId!==state.bound.invoiceId))return false;
  return true;
 }
 return Object.freeze({withScope,verifyScope});
}
export const DESKTOP_SALE_TRANSACTION_SCOPE_LIMITS=Object.freeze({sourceOnly:true,initialSyntheticAcceptanceCurrency:'TRY',multiCurrencySalesImplemented:false,requiresExistingVerifiedWriterSession:true,requiresSerializedStoreTransaction:true,nativeInvoiceGuardIntegration:false,realSqlVerified:false});
