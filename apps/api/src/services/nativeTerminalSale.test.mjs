// Adapter integration with a transactional in-memory SQL boundary. Real SQL and
// physical device acceptance are separate; no live endpoint can be reached here.
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {tokenCodec} from './nativeTerminalPolicy.mjs';
import {OPENING_PRICE_RUN} from './openingPriceService.js';
import {OPERATION_QUARANTINE_SEAL,OPERATION_QUARANTINE_V2_HASH as OPERATION_QUARANTINE_RESOLVER_V2_HASH} from './operationQuarantineService.js';

const signer=tokenCodec(randomBytes(32).toString('hex'));
const actor={id:3,username:'synthetic.operator',permissions:['terminal.sales.create']};
const manager={id:4,username:'synthetic.manager',permissions:['sales.edit','sales.finalize','sales.cancel']};
const operator={terminalDeviceId:1,employeeId:2,canChangeSalePrice:true};
let state,tail=Promise.resolve(),failCommit=false,corruptEffect=false,failAccount=false,canonicalRuntime=false,heldProduct=false,quarantineReady=true;
function reset(){process.env.NATIVE_CUSTOMER_ROUTES_ENABLED='false';state={queue:[],invoices:[],stock:-1,customerBalance:0,audits:[],finalizes:0,cancels:0,routeGranted:true};failCommit=false;corruptEffect=false,failAccount=false;canonicalRuntime=false;heldProduct=false;quarantineReady=true;}
class Transaction {
 async begin(){let release;const before=tail;tail=new Promise(r=>release=r);await before;this.release=release;this.data=structuredClone(state);}
 async commit(){state=this.data;this.done=true;this.release();if(failCommit){failCommit=false;throw Error('Synthetic commit response lost');}}
 async rollback(){if(!this.done){this.done=true;this.release();}}
}
class Request {
 constructor(tx){this.tx=tx;this.args={};}
 input(key,_type,value){this.args[key]=value;return this;}
 async execute(procedure){
  assert.equal(procedure,'dbo.usp_check_operation_quarantine');
  if(!quarantineReady)throw Error('Synthetic quarantine unavailable');
  return {recordsets:[[{database_name:OPENING_PRICE_RUN.database,run_id:OPENING_PRICE_RUN.runId,run_status:'COMMITTED',source_hash:OPENING_PRICE_RUN.sourceHash,plan_hash:OPENING_PRICE_RUN.planHash,sealed:1,operation_gate:1,seal_hash:OPERATION_QUARANTINE_SEAL,source_as_of:'2026-09-30',resolver_version:2,resolver_hash:OPERATION_QUARANTINE_RESOLVER_V2_HASH,resolver_sealed:1}],JSON.parse(this.args.entities_json).map(row=>({entity:row.entity,native_id:row.nativeId,blocked:heldProduct&&row.entity==='product'&&row.nativeId==='20'?1:0,source_key:'SYNTHETIC/PRODUCT/20',reason_code:'SYNTHETIC_HOLD'}))]};
 }
 async query(query){
  const s=this.tx?.data||state,a=this.args;
  if(query.includes('sp_getapplock')){assert.match(query,/@LockMode=N'Shared'/);assert.equal(s.queue.length,0);return {recordset:[{route_lock_result:0}]};}
  if(query.includes('OBJECT_ID'))return {recordset:[{ready:1}]};
  if(query.includes('AS route_allowed'))return {recordset:[{route_allowed:a.routeCash||s.routeGranted?1:0}]};
  if(query.includes('SELECT is_active FROM dbo.terminal_devices')){
   const cash=[{id:10,code:'1-PEŞİN $',name:'Cash USD',currency:'USD'},{id:11,code:'2-PEŞİN TL',name:'Cash TRY',currency:'TRY'},{id:12,code:'3-PEŞİN €',name:'Cash EUR',currency:'EUR'}];
   return {recordsets:[[{is_active:1}],s.routeGranted?[{id:7,code:'R1',name:'Route 1'}]:[],[...cash,...(s.routeGranted?[{id:101,code:'C101',name:'Route customer',currency:'USD',routeId:7}]:[])]]};
  }
  if(query.startsWith('SELECT * FROM dbo.terminal_sync_queue'))return {recordset:s.queue.filter(r=>a.key?r.client_request_id===a.key:r.target_entity_id===a.invoice)};
  if(query.includes('SELECT id,customer_code,currency_code'))return {recordset:[{id:a.customer,customer_code:a.customer===101?'C101':'1-PEŞİN $',currency_code:'USD'}]};
  if(query.includes('SELECT id,stock_code FROM dbo.products'))return {recordset:[{id:20,stock_code:'TEST-1'}]};
  if(query.startsWith('INSERT dbo.terminal_sync_queue')){assert.match(query,/N'invoice_created'/);assert.equal(JSON.parse(a.payload).kind,'native_sale_v1');assert.ok(!s.queue.some(r=>r.client_request_id===a.key));s.queue.push({id:s.queue.length+1,user_id:a.user,event_type:'invoice_created',client_request_id:a.key,payload_json:a.payload});return {rowsAffected:[1]};}
  if(query.startsWith('UPDATE dbo.terminal_sync_queue')){Object.assign(s.queue.find(r=>r.client_request_id===a.key),{target_entity_id:a.invoice,target_entity:'sales_invoice',status:'synced'});return {rowsAffected:[1]};}
  if(query.includes('SUM(quantity_net)')){const i=s.invoices.find(i=>i.id===a.nativeReceipt),cancelled=i.status==='CANCELLED';return {recordsets:[i.items.map(l=>({product_id:corruptEffect?999:l.productId,quantity:cancelled?0:-l.quantity,movement_count:cancelled?2:1})),[{movement_type:'sales_invoice',amount:i.grandTotal,balance_effect:i.grandTotal,currency_code:i.documentCurrency},...(cancelled?[{movement_type:'sales_invoice_cancel',amount:i.grandTotal,balance_effect:-i.grandTotal,currency_code:i.documentCurrency}]:[])]]};}
  if(query.includes("movement_type=N'collection'"))return {recordset:[]};
  throw Error('Unexpected SQL at the synthetic boundary: '+query.slice(0,80));
 }
}
const sql={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:4},NVarChar:()=>0,BigInt:0,MAX:0};
const pool={request:()=>new Request()};
mock.module('../config/database.js',{namedExports:{getSqlPool:async()=>pool,getSqlDriver:()=>sql,isCanonicalTest:()=>canonicalRuntime}});
mock.module('./writeGuardService.js',{namedExports:{assertMelisaWriteEnabled(){}}});
mock.module('./nativeTerminalCatalog.mjs',{namedExports:{nativeSigner:()=>signer,nativeRequestContext:async()=>operator}});
mock.module('./authService.js',{namedExports:{authenticateUserCredentials:async c=>{if(c.username!=='synthetic.manager'||c.password!=='fixture-only')throw Object.assign(Error('Denied'),{statusCode:401});return manager;},getUserById:async id=>{assert.equal(id,4);return manager;}}});
mock.module('./auditService.js',{namedExports:{writeAuditLog:async(request,event)=>{(request.tx?.data||state).audits.push(event);}}});
mock.module('./invoiceDraftService.js',{namedExports:{
 createSalesDraft:async(payload,_actor,ctx)=>{assert.ok(ctx.transaction);const s=ctx.transaction.data;const invoice={...payload,id:s.invoices.length+1,status:'DRAFT',customerName:'1-PEŞİN $',grandTotal:payload.items.reduce((n,i)=>n+i.quantity*i.unitPrice,0)*(1-payload.discountRate/100)};s.invoices.push(invoice);return invoice;},
 finalizeSalesInvoice:async(id,_actor,ctx)=>{assert.equal(ctx.nativeTerminalV1,true);const s=ctx.transaction.data,i=s.invoices.find(i=>i.id===id);assert.equal(i.status,'DRAFT');i.status='FINALIZED';s.stock-=i.items.reduce((n,i)=>n+i.quantity,0);s.customerBalance+=i.grandTotal;s.finalizes++;},
 getSalesDraft:async(id,ctx)=>(ctx?.transaction.data||state).invoices.find(i=>i.id===id),
 cancelSalesInvoice:async(id,_body,approvedBy,ctx)=>{assert.equal(ctx.nativeApproval,true);assert.equal(approvedBy.id,4);const s=ctx.transaction.data,i=s.invoices.find(i=>i.id===id);assert.equal(i.status,'FINALIZED');i.status='CANCELLED';s.stock+=i.items.reduce((n,i)=>n+i.quantity,0);s.customerBalance-=i.grandTotal;s.cancels++;},
}});
mock.module('./nativeCurrencyAccount.mjs',{namedExports:{postNativeCurrencyAccount:async(_id,ctx)=>{assert.ok(ctx.transaction);if(failAccount)throw Object.assign(Error('Currency account missing'),{code:'NATIVE_CURRENCY_ACCOUNT_NOT_UNIQUE'});},verifyNativeCurrencyAccount:async()=>{}}});
const {nativeSubmitSale,nativeSaleStatus,nativeDiscountApproval,nativeCancelSale}=await import('./nativeTerminalSale.mjs');
function payload(){const q={actorId:3,terminalCode:'TEST-DEVICE',customerId:10,productId:20,currency:'USD',unitPrice:'12.80',exchangeRate:'47.8',stockCode:'TEST-1',productName:'Synthetic product',barcode:'00001'};return {clientEventId:randomUUID(),terminalCode:'TEST-DEVICE',customerId:10,documentCurrency:'USD',discountRate:'5',note:'Fixture only',changes:[],items:[{productId:20,quantity:2,unitPrice:'12.80',quoteToken:signer.issue('quote',q)}]};}

function routedPayload(){
 const p=payload();p.customerId=101;
 const q=signer.verify(p.items[0].quoteToken,'quote');
 p.items[0].quoteToken=signer.issue('quote',{...q,priceScope:'currency-v1'});
 return p;
}
test('canonical quarantine hold and unavailable gate stop the native transaction without effects',async()=>{
 for(const missing of [false,true]){
  reset();canonicalRuntime=true;heldProduct=!missing;quarantineReady=!missing;
  await assert.rejects(nativeSubmitSale(payload(),actor),{code:missing?'MIGRATION_QUARANTINE_NOT_READY':'MIGRATION_ENTITY_QUARANTINED'});
  assert.equal(state.queue.length,0);assert.equal(state.invoices.length,0);assert.equal(state.stock,-1);assert.equal(state.customerBalance,0);assert.equal(state.audits.length,0);
 }
 reset();canonicalRuntime=true;assert.equal((await nativeSubmitSale(payload(),actor)).state,'COMPLETED');assert.equal(state.finalizes,1);
});
test('allowed routed customer retains actual customer identity and denied route writes nothing',async()=>{
 reset();process.env.NATIVE_CUSTOMER_ROUTES_ENABLED='true';
 const p=routedPayload();state.routeGranted=false;
 await assert.rejects(nativeSubmitSale(p,actor),{code:'NATIVE_CUSTOMER_ROUTE_DENIED'});
 assert.equal(state.queue.length,0);assert.equal(state.invoices.length,0);assert.equal(state.stock,-1);
 state.routeGranted=true;assert.equal((await nativeSubmitSale(p,actor)).state,'COMPLETED');
 assert.equal(state.invoices[0].customerId,101);assert.equal(state.finalizes,1);
 state.routeGranted=false;
 assert.equal((await nativeSaleStatus(p,actor)).state,'COMPLETED');
 await assert.rejects(nativeSubmitSale(p,actor),{code:'ALREADY_FINALIZED',statusCode:409});
 assert.equal(state.finalizes,1);
});

test('concurrent same-id submission calls existing finalize once and permits negative stock',async()=>{reset();const p=payload();const results=await Promise.allSettled([nativeSubmitSale(p,actor),nativeSubmitSale(p,actor)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'ALREADY_FINALIZED');assert.equal(state.finalizes,1);assert.equal(state.invoices.length,1);assert.equal(state.stock,-3);assert.equal(state.customerBalance,24.32);assert.equal(state.audits.find(a=>a.action==='native_sale_finalized').afterSnapshot.collectionMode,'none');});
test('lost commit response resolves by read-only status and repeat cannot duplicate',async()=>{reset();const p=payload();failCommit=true;await assert.rejects(nativeSubmitSale(p,actor),{code:'NATIVE_COMMIT_UNCONFIRMED'});assert.equal((await nativeSaleStatus(p,actor)).state,'COMPLETED');await assert.rejects(nativeSubmitSale(p,actor),{code:'ALREADY_FINALIZED',statusCode:409});assert.equal(state.finalizes,1);});
test('equal aggregate quantity for the wrong product cannot pass receipt verification',async()=>{reset();corruptEffect=true;await assert.rejects(nativeSubmitSale(payload(),actor),{code:'NATIVE_EFFECT_UNVERIFIED'});assert.equal(state.invoices.length,0);assert.equal(state.stock,-1);});
test('changed frozen payload or another owner cannot reuse a sale id',async()=>{reset();const p=payload();await nativeSubmitSale(p,actor);await assert.rejects(nativeSubmitSale({...p,note:'changed'},actor),{code:'NATIVE_IDEMPOTENCY_CONFLICT'});await assert.rejects(nativeSaleStatus(p,{...actor,id:7}),{code:'NATIVE_RECEIPT_OWNER'});assert.equal(state.finalizes,1);});
test('over-five discount is bound to manager credentials and exact sale',async()=>{reset();const p={...payload(),discountRate:'6'};await assert.rejects(nativeSubmitSale(p,actor));const approval=await nativeDiscountApproval({kind:'discount',terminalCode:p.terminalCode,sale:p,username:'synthetic.manager',password:'fixture-only'},actor);await assert.rejects(nativeSubmitSale({...p,note:'changed',...approval},actor),{code:'NATIVE_APPROVAL_CHANGED'});assert.equal((await nativeSubmitSale({...p,...approval},actor)).state,'COMPLETED');assert.equal(state.audits.find(a=>a.action==='native_sale_finalized').afterSnapshot.approvedBy,4);});
test('cancel requires manager password; repeated reversal stays single and audited',async()=>{reset();const p=payload(),sale=await nativeSubmitSale(p,actor),body={terminalCode:p.terminalCode,invoiceId:sale.receipt.invoiceId,username:'synthetic.manager',password:'wrong'};await assert.rejects(nativeCancelSale(body,actor),{statusCode:401});assert.equal(state.cancels,0);body.password='fixture-only';assert.equal((await nativeCancelSale(body,actor)).state,'CANCELLED');assert.equal((await nativeCancelSale(body,actor)).state,'CANCELLED');assert.equal(state.cancels,1);assert.equal(state.stock,-1);assert.equal(state.customerBalance,0);assert.equal(state.audits.find(a=>a.action==='native_cancel_approved').afterSnapshot.requestedBy,3);});


test('lost cancellation commit response resolves as cancelled without another reversal',async()=>{
 reset();const p=payload(),sale=await nativeSubmitSale(p,actor);
 const body={terminalCode:p.terminalCode,invoiceId:sale.receipt.invoiceId,username:'synthetic.manager',password:'fixture-only'};
 failCommit=true;
 await assert.rejects(nativeCancelSale(body,actor),{code:'NATIVE_COMMIT_UNCONFIRMED'});
 assert.equal((await nativeSaleStatus(p,actor)).state,'CANCELLED');
 assert.equal(state.cancels,1);assert.equal(state.stock,-1);assert.equal(state.customerBalance,0);
 assert.equal((await nativeCancelSale(body,actor)).state,'CANCELLED');assert.equal(state.cancels,1);
});

test('currency posting failure rolls back invoice, stock, customer and queue',async()=>{reset();failAccount=true;await assert.rejects(nativeSubmitSale(payload(),actor),{code:'NATIVE_CURRENCY_ACCOUNT_NOT_UNIQUE'});assert.equal(state.invoices.length,0);assert.equal(state.queue.length,0);assert.equal(state.stock,-1);assert.equal(state.customerBalance,0);});
