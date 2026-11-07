// Real native cancellation plus closed coordinator; SQL is transactional and
// synthetic. This does not compile T-SQL, grant permissions or accept a GUI.
import test from 'node:test';import assert from 'node:assert/strict';
const command={requestId:'7cbb7e06-ef75-4456-92e5-99f6d99b8312',invoiceId:'13',expectedVersion:'0x0000000000000013',reason:'İskontolu dövizli satış denemesi'};
test('closed native cancellation preserves original discounted vectors, one selected ledger and same-request recovery',async t=>{
 const connector={},pool={},auth={bindFinalCancellationService:s=>s},fences=new Map();let state,deny=false,loseAck=false,corrupt=null,tombstone=false,lastError,unknown=[],profile='desktop-master-v5';
 class Transaction{async begin(){this.open=true;this.data=structuredClone(state);}async commit(){state=structuredClone(this.data);this.open=false;if(loseAck){loseAck=false;throw Error('COMMIT_ACK_LOST');}}async rollback(){this.open=false;}}
 const one=x=>({recordset:[x]}),rows=x=>({recordset:x}),ok=()=>({recordset:[],rowsAffected:[1]});
 class Request{constructor(tx){assert.equal(tx.open,true);this.tx=tx;this.p={};}input(k,_type,v){this.p[k]=v;return this;}async query(q){const d=this.tx.data,p=this.p,i=d.invoice;
  if(q.includes('@@TRANCOUNT transactionCount'))return one({targetDatabase:'MELISA_ERP_DESKTOP_TEST_20261105',sessionId:15,transactionId:'31',transactionCount:1,transactionState:1});
  if(q.includes('FROM dbo.desktop_sale_request_resolutions'))return rows(tombstone?[{}]:[]);
  if(q.includes('FROM dbo.desktop_sale_workflow_requests')&&q.includes('SELECT'))return rows(d.journal?[d.journal]:[]);
  if(q.includes('SELECT CASE WHEN (SELECT COUNT_BIG(*) FROM dbo.desktop_empty_installation'))return {recordsets:[
   [{isolated:corrupt==='linked'?0:1}],
   [{id:'13',customerId:'2',entityId:'2',accountId:'7',currency:i.documentCurrency,accountCurrency:i.accountCurrency,customerCurrency:i.customerCurrency,totalExact4:i.grandTotal.toFixed(4),accountAmountExact4:i.accountAmount.toFixed(4),amountTryExact4:'51.2160',state:i.status.toUpperCase(),workflowState:d.workflow,version:command.expectedVersion}],
   [{id:'2',entityId:'2',currency:i.customerCurrency,balanceExact4:d.main.toFixed(4)}],
   [{id:'7',customerId:'2',entityId:'2',currency:i.accountCurrency,balanceExact8:d.account.toFixed(8)}],
   d.items.map(x=>({id:String(x.id),productId:String(x.productId),quantityExact3:'1.000',stockBeforeExact3:d.stock[x.productId].toFixed(3),unitCostTryExact4:'8.0000'})),
   d.items.map((x,k)=>({id:String(31+k),invoiceId:'13',productId:String(x.productId),type:'out',quantityInExact3:'0.000',quantityOutExact3:'1.000',amountTryExact4:'25.6080',unitCostTryExact4:'8.0000'})),
   [{id:'8',invoiceId:'13',customerId:'2',entityId:'2',accountId:'7',type:'sales_invoice',currency:i.documentCurrency,accountCurrency:i.accountCurrency,amountExact4:i.grandTotal.toFixed(4),accountAmountExact4:i.accountAmount.toFixed(4),balanceEffectExact4:i.accountAmount.toFixed(4),amountTryExact4:'51.2160'}],
   d.items.map(x=>({itemId:String(x.id),productId:String(x.productId),quantityExact3:'1.000',state:'DISPATCHED'}))]};
  if(q.includes('END AS is_ready'))return one({is_ready:0});
  if(q.includes('currency_snapshot_ready'))return one({currency_snapshot_ready:1});
  if(q.includes('WHERE si.id = @finalizeSnapshotId'))return one({...i,grandTotal:corrupt==='snapshot'?999:i.grandTotal});
  if(q.includes('WHERE sii.sales_invoice_id = @finalizeItemsSnapshotId'))return rows(d.items.map(x=>({...x,currentStockQty:d.stock[x.productId],productAverageCostTry:corrupt==='cost'?9:8})));
  if(q.includes('SELECT account_currency, account_amount, account_exchange_rate_snapshot'))return one({account_currency:i.accountCurrency,account_amount:i.accountAmount,account_exchange_rate_snapshot:i.accountExchangeRate});
  if(q.includes('FROM dbo.system_settings'))return rows(corrupt==='period'?[{setting_key:'periodLockEnabled',setting_value:'true'},{setting_key:'periodLockedThroughDate',setting_value:'2026-11-06'}]:[]);
  if(q.includes('FROM dbo.terminal_sync_queue'))return rows(corrupt==='native'?[{id:1}]:[]);
  if(q.includes("OBJECT_ID(N'dbo.invoice_returns'"))return one({ready:0});
  if(q.includes('SELECT currency_code, is_active, is_deleted FROM dbo.customers'))return one({currency_code:i.customerCurrency,is_active:true,is_deleted:false});
  if(q.includes('UPDATE dbo.products')&&q.includes('cancelQuantityForStockUpdate')){d.stock[p.cancelProductIdForStockUpdate]+=p.cancelQuantityForStockUpdate;return ok();}
  if(q.includes('INSERT INTO dbo.stock_movements')){d.reverseStock.push({...p});return ok();}
  if(q.includes('INSERT INTO dbo.customer_movements')){d.reverseMovement={...p};return ok();}
  if(q.includes('SELECT id FROM dbo.customer_movements'))return one({id:9});
  if(q.includes('UPDATE dbo.customer_movements SET account_currency')){d.snapshot={...p};return ok();}
  if(q.includes('UPDATE dbo.customers')&&q.includes('cancelCustomerBalanceEffect')){d.main-=p.cancelCustomerBalanceEffect;d.mainWrites++;return ok();}
  if(q.includes("status = N'cancelled'")){i.status='cancelled';d.reason=p.cancelReason;d.cancelActor=p.cancelUpdatedBy;return ok();}
  if(q.includes('INSERT INTO dbo.audit_logs')){d.audits.push({...p});return ok();}
  if(q.includes('DECLARE @invoice bigint=CONVERT(bigint,@invoiceId)')){
   assert.equal(d.reverseStock.length,2);assert.deepEqual(d.reverseStock.map(x=>x.cancelMovementAmountTry),[-25.608,-25.608]);
   assert.equal(i.status,'cancelled');assert.equal(d.reason,command.reason);assert.equal(d.cancelActor,30002);
   assert.equal(d.reverseMovement.cancelCustomerMovementAmount,i.grandTotal);assert.equal(d.snapshot.currencyAccountAmount,i.accountAmount);assert.equal(d.snapshot.currencyBalanceEffect,-i.accountAmount);assert.equal(d.snapshot.currencyAmountTry,51.216);
   assert.equal(d.main.toFixed(4),p.customerAfterExact4);assert.equal(d.account.toFixed(8),p.accountBeforeExact8);
   assert.equal(d.audits.length,1);const a=d.audits[0];assert.equal(a.auditActorUserId,30002);assert.equal(JSON.parse(a.auditAfterJson).desktopCancellationRequestId,command.requestId);assert.equal(JSON.parse(a.auditAfterJson).reason,command.reason);
   if(corrupt==='posting')throw Error('POSTING_READBACK_FAILED');
   d.account-=Number(p.accountAmountExact4);d.workflow='CANCELLED';return one({version:'0x0000000000000014'});
  }
  if(q.startsWith('INSERT dbo.desktop_sale_workflow_requests')){d.journal={actorId:p.actor,invoiceId:p.invoice,operation:'CANCEL_SALE',hash:p.hash,resultJson:p.json};return ok();}
  unknown.push(q);throw Error('UNEXPECTED_SYNTHETIC_SQL');
 }}
 const sql={Transaction,Request,NVarChar:n=>n,Decimal:()=>null,BigInt:{},Int:{},Date:{},Bit:{},MAX:-1,ISOLATION_LEVEL:{SERIALIZABLE:4}};
 t.mock.module('mssql',{exports:{default:sql}});t.mock.module('mssql/msnodesqlv8.js',{exports:{default:sql}});
 t.mock.module('../config/desktopWriteTlsConnector.mjs',{exports:{getDesktopWritePool:c=>{assert.equal(c,connector);return pool;},getDesktopWriteProfile:()=>profile}});
 t.mock.module('./desktopWriteAuthCore.mjs',{exports:{getDesktopWriteSessionVerifier:()=>async({actorId,permission})=>{assert.deepEqual(permission,['sales.view','sales.cancel']);return !deny&&actorId==='30002';},getDesktopWriteDiscountCeiling:()=>()=> '3.0000'}});
 t.mock.module('./desktopSafeDiagnostics.mjs',{exports:{recordDesktopFailure:e=>{lastError=e.error;}}});
 t.mock.module('./desktopFinalCancellationExportFence.mjs',{exports:{createDesktopFinalCancellationExportFence:()=>({async assertNoExport(){return corrupt!=='export';},async claim(proof){if(corrupt==='fence')throw Error('FENCE_UNAVAILABLE');const old=fences.get(proof.invoiceId);if(old)assert.deepEqual(proof,old);else fences.set(proof.invoiceId,structuredClone(proof));return {state:'CANCELLATION_FENCED'};},async verify(proof){assert.deepEqual(proof,fences.get(proof.invoiceId));return corrupt!=='fenceVerify';}})}});
 const module=await import('./desktopFinalCancellationPrivate.mjs'),service=module.createDesktopFinalCancellationService({connector,auth}),native=await import('./invoiceDraftService.js');
 profile='desktop-master-v4';assert.throws(()=>module.createDesktopFinalCancellationService({connector,auth}));profile='desktop-master-v6';assert.ok(module.createDesktopFinalCancellationService({connector,auth}));profile='desktop-master-v5';
 assert.equal(module.tryAssertDesktopFinalCancellation({transaction:{}}),null);assert.equal(module.getDesktopFinalCancellationAccountContext({transaction:{}}),null);
 await assert.rejects(native.cancelSalesInvoice(13,{reason:command.reason},{id:'30002'},{transaction:{},pool,sqlDriver:sql,desktopPrivateSale:true}),/DESKTOP_PRIVATE_SALE_REJECTED/);
 for(const mode of ['foreign','TRY','USD-primary','TRY-to-EUR']){
  fences.clear();
  const mainCurrency=mode==='USD-primary'?'USD':'TRY',accountCurrency=mode==='TRY'?'TRY':mode==='TRY-to-EUR'?'EUR':'USD',documentCurrency=mode==='TRY-to-EUR'?'TRY':'EUR',rate=documentCurrency==='TRY'?1:44,accountRate=accountCurrency==='TRY'?1:accountCurrency==='EUR'?44:40;
  const initialMain=mainCurrency==='TRY'?104.32:2.7354,initialAccount=accountCurrency===mainCurrency?initialMain:2.7354;
  state={invoice:{id:13,documentNo:'DS-13',documentDate:'2026-11-06',customerId:2,customerCode:'M2',customerName:'Sentetik',customerIsActive:true,status:'finalized',customerCurrency:mainCurrency,documentCurrency,exchangeRate:rate,accountCurrency,accountAmount:51.216/accountRate,accountExchangeRate:accountRate,grandTotal:51.216/rate,amountTry:51.216,subtotal:52.8/rate,discountRate:3,discountTotal:1.584/rate},items:[10,11].map((id,k)=>({id:21+k,productId:id,stockCode:'FX'+id,productName:'Sentetik',quantity:1,currency:documentCurrency,unitPrice:26.4/rate,lineTotal:26.4/rate,averageCostTry:8})),stock:{10:7,11:7},account:initialAccount,main:initialMain,mainWrites:0,workflow:'COMPLETED',reverseStock:[],reverseMovement:null,snapshot:null,audits:[],journal:null};
  const before=structuredClone(state);
  for(const bad of ['export','linked','fence','snapshot','cost','native','period','fenceVerify','posting']){corrupt=bad;assert.equal((await service.cancel('30002',command)).state,'UNKNOWN',bad);assert.deepEqual(state,before,bad);}corrupt=null;assert.equal(fences.size,1,'the export fence survives SQL rollback');
  deny=true;assert.equal((await service.cancel('30002',command)).state,'UNKNOWN');assert.deepEqual(state,before);deny=false;
  tombstone=true;assert.equal((await service.cancel('30002',command)).state,'UNKNOWN');assert.deepEqual(state,before);tombstone=false;
  loseAck=true;assert.equal((await service.cancel('30002',command)).state,'UNKNOWN');assert.equal(state.workflow,'CANCELLED',lastError?.stack??unknown.at(-1));assert.deepEqual(state.stock,{10:8,11:8});assert.equal(state.mainWrites,accountCurrency===mainCurrency?1:0);assert.equal(state.main.toFixed(4),(accountCurrency===mainCurrency?initialMain-state.invoice.accountAmount:initialMain).toFixed(4));assert.equal(state.account.toFixed(4),(initialAccount-state.invoice.accountAmount).toFixed(4));
  const committed=structuredClone(state);assert.equal((await service.cancel('30002',command)).replayed,true);assert.deepEqual(state,committed);
  for(const mutation of [{reason:'Farklı gerekçe'},{expectedVersion:'0x0000000000000015'}]){assert.equal((await service.cancel('30002',{...command,...mutation})).state,'UNKNOWN');assert.deepEqual(state,committed);}
  assert.equal(module.getDesktopFinalCancellationAccountContext({transaction:{}}),null);assert.deepEqual(unknown,[]);
 }
});
