// Closed private native bridge. No HTTP flag or pure calculation can establish
// this AsyncLocalStorage capability. Its factory requires the registered TLS
// writer + registered normal auth verifier and retains the transaction itself.
import {AsyncLocalStorage} from 'node:async_hooks';
import sql from 'mssql';
import {getDesktopWritePool} from '../config/desktopWriteTlsConnector.mjs';
import * as desktopConnector from '../config/desktopWriteTlsConnector.mjs';
import {getDesktopWriteSessionVerifier} from './desktopWriteAuthCore.mjs';
import {createDesktopFinalCancellationScope} from './desktopFinalCancellationScope.mjs';
import {createDesktopFinalCancellationReader} from './desktopFinalCancellationRead.mjs';
import {createDesktopFinalCancellationPosting} from './desktopFinalCancellationPosting.mjs';
import {normalizeDesktopSaleCancellation} from '../../../../packages/shared/src/desktopSaleCancellation.mjs';
import {lockDesktopResolution,desktopWorkflowRequestIdentity} from './desktopWorkflowRequestResolution.mjs';
import {recordDesktopFailure} from './desktopSafeDiagnostics.mjs';
import {createDesktopFinalCancellationExportFence} from './desktopFinalCancellationExportFence.mjs';
import {getCanonicalBusinessSaleTransaction} from './canonicalBusinessSessionContext.mjs';
import {isolatedCopyTransactionContext} from './isolatedOperationCopyScope.mjs';
import {tryAssertDesktopWorkflowDraft} from './desktopWorkflowDraftPrivate.mjs';
const storage=new AsyncLocalStorage(),owners=new WeakMap();
const fail=()=>{throw Error('DESKTOP_FINAL_CANCEL_PRIVATE_REJECTED');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
function competing(transaction){
 if(getCanonicalBusinessSaleTransaction(transaction))return true;
 if(tryAssertDesktopWorkflowDraft({transaction,operation:'sale_cancel',checkOnly:true})!==null)return true;
 try{isolatedCopyTransactionContext(transaction,{writeRequired:false});return true;}catch(e){if(e?.code!=='ISOLATED_COPY_TRANSACTION_REQUIRED')throw e;return false;}
}
function parity(value,scale,wanted){
 if(typeof value!=='number'||!Number.isFinite(value)||typeof wanted!=='string')fail();
 const expected=BigInt(wanted.replace('.','')),magnitude=Math.round(Math.abs(value)*10**scale),actual=BigInt(Number.isSafeInteger(magnitude)?magnitude:0)*(value<0?-1n:1n);
 if(!Number.isSafeInteger(magnitude)||expected>9007199254740991n||expected< -9007199254740991n||actual!==expected)fail();
}
function active(s,transaction){return s?.open&&owners.get(transaction)===s&&s.transaction===transaction&&!competing(transaction);}
export function tryAssertDesktopFinalCancellation({transaction,actor,operation,invoiceId,invoice,checkOnly=false}={}){
 const s=storage.getStore();if(!s)return null;
 if(!active(s,transaction)||String(actor?.id)!==s.actorId||operation!=='sale_cancel'||String(invoiceId)!==s.plan.invoiceId||s.phase!=='native_cancel_pending')fail();
 if(checkOnly)return true;
 const p=s.plan,m=p.customerMovement;
 if(!invoice||String(invoice.id)!==p.invoiceId||String(invoice.customerId)!==p.customerId||invoice.status!=='FINALIZED'||invoice.documentCurrency!==p.currency||invoice.accountCurrency!==p.accountCurrency||invoice.customerCurrency!==p.customerCurrency||!Array.isArray(invoice.items)||invoice.items.length!==2)fail();
 parity(invoice.grandTotal,4,m.amountExact4);parity(invoice.accountAmount,4,m.accountAmountExact4);parity(invoice.amountTry,4,m.amountTryExact4);
 const seen=new Set();let totalQuantity=0n;
 for(const item of invoice.items){const line=p.stock.find(v=>v.itemId===String(item.id)&&v.productId===String(item.productId));if(!line||seen.has(line.itemId)||item.currency!==p.currency)fail();seen.add(line.itemId);parity(item.quantity,3,line.quantityInExact3);parity(item.averageCostTry,4,line.unitCostTryExact4);parity(item.productAverageCostTry,4,line.unitCostTryExact4);parity(item.currentStockQty,3,line.stockBeforeExact3);totalQuantity+=BigInt(line.quantityInExact3.replace('.',''));}
 if(totalQuantity>9007199254740991n)fail();
 s.phase='native_cancel_verified';return true;
}
export function getDesktopFinalCancellationAccountContext({transaction,customerId,invoiceId}={}){
 const s=storage.getStore();if(!s)return null;
 if(!active(s,transaction)||s.phase!=='native_cancel_verified'||String(customerId)!==s.plan.customerId||String(invoiceId)!==s.plan.invoiceId)fail();
 return Object.freeze({actorId:s.actorId,requestId:s.command.requestId,currency:s.plan.accountCurrency,customerCurrency:s.plan.customerCurrency,preserveLegacyBalance:s.plan.preserveLegacyBalance,cancellation:s.plan});
}
export function createDesktopFinalCancellationService({connector,auth}={}){
 if(!['desktop-master-v5','desktop-master-v6'].includes(desktopConnector.getDesktopWriteProfile?.(connector)))fail();
 const pool=getDesktopWritePool(connector),verifySession=getDesktopWriteSessionVerifier(auth,pool),scope=createDesktopFinalCancellationScope({sql,verifySession});
 if(typeof auth?.bindFinalCancellationService!=='function')fail();
 const fence=createDesktopFinalCancellationExportFence();
 const read=createDesktopFinalCancellationReader({sql,verifyScope:scope.verifyScope,verifyExport:async args=>{if(await scope.verifyScope(args)!==true||await fence.assertNoExport(args.invoiceId)!==true)fail();return await scope.verifyScope(args);}});
 const post=createDesktopFinalCancellationPosting({sql,verifyPlan:async({transaction,scope:owned,plan})=>{const s=storage.getStore();return active(s,transaction)&&s.phase==='native_cancel_verified'&&s.plan===plan&&s.scope===owned&&await scope.verifyScope({transaction,scope:owned,invoiceId:plan.invoiceId});}});
 return auth.bindFinalCancellationService({async cancel(actorId,raw){let requestId=typeof raw?.requestId==='string'?raw.requestId:null;
  try{
   if(!id(actorId))fail();const command=normalizeDesktopSaleCancellation(raw);requestId=command.requestId;
   const {hash}=desktopWorkflowRequestIdentity(actorId,'cancel',command),fenceProof={invoiceId:command.invoiceId,actorId,requestId,payloadHash:hash},tx=new sql.Transaction(pool);let begun=false;
   try{await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;
    const result=await scope.withScope({transaction:tx,actorId,requestId,invoiceId:command.invoiceId},async owned=>{
     if(await lockDesktopResolution({sql,transaction:tx,requestId}))fail();
     const query=(text,values={})=>{const r=new sql.Request(tx);for(const [key,value] of Object.entries(values))r.input(key,sql.NVarChar(key==='json'?sql.MAX:4000),value);return r.query(text);};
     const journalSql=`SELECT CONVERT(varchar(20),actor_id) actorId,CONVERT(varchar(20),invoice_id) invoiceId,operation,LOWER(CONVERT(varchar(64),payload_hash,2)) hash,result_json resultJson FROM dbo.desktop_sale_workflow_requests WITH(UPDLOCK,HOLDLOCK) WHERE request_id=TRY_CONVERT(uniqueidentifier,@request);`;
     const prior=(await query(journalSql,{request:requestId}))?.recordset;if(!Array.isArray(prior)||prior.length>1)fail();
     if(prior.length){const r=prior[0];if(r.actorId!==actorId||r.invoiceId!==command.invoiceId||r.operation!=='CANCEL_SALE'||r.hash!==hash)fail();const value=JSON.parse(r.resultJson);if(value?.state!=='COMMITTED'||value.requestId!==requestId||value.invoiceId!==command.invoiceId||value.workflowState!=='CANCELLED'||value.replayed!==false||!/^0x[0-9A-F]{16}$/.test(value.version)||Object.keys(value).sort().join(',')!=='invoiceId,replayed,requestId,state,version,workflowState'||await fence.verify(fenceProof)!==true)fail();return {...value,replayed:true};}
     const plan=await read({transaction:tx,scope:owned,invoiceId:command.invoiceId,expectedVersion:command.expectedVersion,reason:command.reason});
     if((await fence.claim(fenceProof))?.state!=='CANCELLATION_FENCED')fail();
     if(storage.getStore()||owners.has(tx)||competing(tx)||await scope.verifyScope({transaction:tx,scope:owned,invoiceId:command.invoiceId})!==true)fail();
     const state={transaction:tx,scope:owned,actorId,command,plan,phase:'native_cancel_pending',open:true};owners.set(tx,state);
     try{return await storage.run(state,async()=>{
      const native=await import('./invoiceDraftService.js');await native.cancelSalesInvoice(Number(command.invoiceId),{reason:command.reason},{id:actorId},{transaction:tx,pool,sqlDriver:sql,desktopPrivateSale:true});
      if(state.phase!=='native_cancel_verified'||!active(state,tx)||await fence.verify(fenceProof)!==true)fail();const version=await post({transaction:tx,scope:owned,plan});
      const outcome={state:'COMMITTED',requestId,invoiceId:command.invoiceId,workflowState:'CANCELLED',version,replayed:false};
      await query(`INSERT dbo.desktop_sale_workflow_requests(request_id,invoice_id,actor_id,operation,payload_hash,result_json) VALUES(TRY_CONVERT(uniqueidentifier,@request),TRY_CONVERT(bigint,@invoice),TRY_CONVERT(bigint,@actor),'CANCEL_SALE',CONVERT(binary(32),@hash,2),@json);`,{request:requestId,invoice:command.invoiceId,actor:actorId,hash,json:JSON.stringify(outcome)});
      const saved=(await query(journalSql,{request:requestId}))?.recordset;if(!Array.isArray(saved)||saved.length!==1||saved[0].actorId!==actorId||saved[0].invoiceId!==command.invoiceId||saved[0].operation!=='CANCEL_SALE'||saved[0].hash!==hash||saved[0].resultJson!==JSON.stringify(outcome)||await fence.verify(fenceProof)!==true)fail();return outcome;
     });}finally{state.open=false;owners.delete(tx);}
    });await tx.commit();begun=false;return result;
   }catch(error){if(begun)try{await tx.rollback();}catch{}throw error;}
  }catch(error){recordDesktopFailure({requestId,error});return {state:'UNKNOWN',requestId,retry:'SAME_REQUEST_ONLY'};}
 }});
}
