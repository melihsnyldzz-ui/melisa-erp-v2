import test from 'node:test';
import assert from 'node:assert/strict';
import {previewCurrentPriceSelection,createTestCurrentPricePurchaseService} from './testCurrentPricePurchaseService.mjs';
import {CURRENT_PRICE_PURCHASE_SQL_PROOF} from './testProductPriceSqlProof.mjs';
const selected={native_price_id:'15',version_id:'4',revision:'A'.repeat(64),actor_id:16,reason:'Deneme fiyatı',changed_at:'2026-10-04T12:00:00Z',price_exact_text:'1.12345678',currency:'USD',unit:'ADET',unit_factor:'1.00000000',unit_hash:'b'.repeat(64)};
const selection={productId:'301986',priceId:'15',versionId:'4',revision:selected.revision};
const rates=['TRY','USD','EUR'].map(currency=>({currency,rateToTryExact8:currency==='TRY'?'1.00000000':currency==='USD'?'40.00000000':'45.00000000',source:'synthetic-test',sourceId:'C03-FX-'+currency,asOf:'2026-10-04',version:'1',hash:'c'.repeat(64)}));
const input={selected,selection,quantity:2,date:'2026-10-04',rates};
test('native current price version has exact8/native4 projection and transaction-time FX snapshot',()=>{
 const value=previewCurrentPriceSelection(input);
 assert.equal(value.writable,true);assert.equal(value.priceExact,'1.12345678');assert.equal(value.nativePriceExact4,'1.1235');assert.equal(value.documentAmountExact4,'2.2470');assert.equal(value.amountTryExact4,'89.8800');assert.equal(value.sourceProof.source,'native-operational-price');assert.equal(value.sourceProof.versionId,'4');assert.equal(value.rates.document.asOf,'2026-10-04');
});
test('unknown, true zero, invalid quantity and over-limit price remain unwriteable',()=>{
 for(const [priceExact,quantity,blockedCode] of [[null,1,'PRICE_UNKNOWN'],['0.00000000',1,'PRICE_ZERO'],['1.00000000',0,'QUANTITY_SCOPE'],['1.00000000',1.5,'QUANTITY_SCOPE'],['1.00000000',6,'QUANTITY_SCOPE'],['6.00000000',1,'AMOUNT_SCOPE'],['99999999999999999999.99999999',1,'PRICE_OVERFLOW']]){
  const value=previewCurrentPriceSelection({...input,quantity,selected:{...selected,price_exact_text:priceExact}});
  assert.equal(value.writable,false);assert.equal(value.blockedCode,blockedCode);
 }
});
test('TRY and EUR prices use their own native exact price and quoted currency',()=>{
 for(const [currency,expected] of [['TRY','2.0000'],['EUR','90.0000']])assert.equal(previewCurrentPriceSelection({...input,selected:{...selected,currency,price_exact_text:'1.00000000'}}).amountTryExact4,expected);
 assert.throws(()=>previewCurrentPriceSelection({...input,rates:rates.map(row=>({...row,asOf:'2026-10-03'}))}),{code:'PURCHASE_RATE_STALE'});
 assert.throws(()=>previewCurrentPriceSelection({...input,selected:{...selected,unit_factor:'2.00000000'}}),{statusCode:503});
 assert.throws(()=>previewCurrentPriceSelection({...input,selected:{...selected,native_price_id:'9223372036854775808'},selection:{...selection,priceId:'9223372036854775808'}}),{code:'TEST_CURRENT_PRICE_PROOF'});
});
test('historical snapshot calculations use immutable selected version regardless of newer current price',()=>{
 const historical=previewCurrentPriceSelection(input);
 const newer=previewCurrentPriceSelection({...input,selected:{...selected,version_id:'5',price_exact_text:'2.00000000'},selection:{...selection,versionId:'5'}});
 assert.equal(newer.amountTryExact4,'160.0000');assert.equal(historical.amountTryExact4,'89.8800');assert.equal(historical.sourceProof.versionId,'4');
});
test('wrong actor and missing native permission are rejected before any SQL runtime access',async()=>{
 const service=createTestCurrentPricePurchaseService({runtime:async()=>{throw Error('runtime must remain closed');}});
 await assert.rejects(()=>service.context({id:14,permissions:['product.view','purchase.view']}),{statusCode:403});
 await assert.rejects(()=>service.createReceipt({}, {id:16,permissions:['product.view','purchase.view']}),{statusCode:403});
});

const actor={id:16,permissions:['product.view','purchase.view','goods.create','goods.approve','goods.reject','purchase.create','purchase.finalize','purchase.cancel']};
function runtimeFixture(){
 const state={current:{...selected,price_id:'15'},stock:28,cost:60,receipts:[],intents:[],requests:[],invoices:[],audits:[],nativeCalls:[],postings:0,movements:[],supplierBalance:60,commits:0,rollbacks:0};
 const sqlRates=rates.map((row,index)=>({id:index+1,currency:row.currency,rate_exact:row.rateToTryExact8,source:row.source,source_id:row.sourceId,as_of:row.asOf,version:1,hash:row.hash}));
 const scope=()=>({product_id:301986,supplier_id:13373,product_supplier:13373,supplier_currency:'TRY',unit:'ADET',product_unit:'ADET',unit_factor:1,warehouse:'TEST-DAILY-WH',document_date:'2026-10-04',max_quantity:5,max_amount_try:200,stock_code:'TEST-DAILY-PURCHASE',product_name:'Sentetik ürün',supplier_name:'Sentetik tedarikçi',supplier_balance_text:'60.0000',average_cost_try_text:state.cost.toFixed(4),current_stock_qty:state.stock,average_cost_try:state.cost,unit_hash:selected.unit_hash});
 class Transaction{async begin(level){assert.equal(level,'SERIALIZABLE');this.snapshot=structuredClone(state);}async commit(){state.commits++;}async rollback(){const rollbacks=state.rollbacks+1;Object.assign(state,this.snapshot,{rollbacks});}}
 class Request{
  constructor(){this.p={};}input(key,type,value){this.p[key]=value;return this;}
  async execute(name){assert.equal(name,'dbo.usp_get_test_current_price_purchase_context');return {recordsets:[[{...scope(),...CURRENT_PRICE_PURCHASE_SQL_PROOF,...state.proofDrift}],sqlRates,[state.current],state.intents]};}
  async query(query){const p=this.p,rs=rows=>({recordset:rows});
   if(query.startsWith('SELECT DB_NAME'))return rs([{db:'MELISA_ERP_SIRKET_TEST_20260929_01',server:'Semih\\MELISADEV'}]);
   if(query.includes('sp_getapplock'))return rs([]);
   if(query.includes('FROM dbo.test_purchase_fx_scope s JOIN'))return rs([scope()]);
   if(query.includes('currentPricePostingValid')){const movements=state.movements.filter(row=>row.invoiceId===p.invoice),cancelled=query.includes("movement_type=N'purchase_invoice_cancel'");return rs([{currentPricePostingValid:!state.failDebtProof&&movements.length===(cancelled?2:1)&&movements.every(row=>row.currency===p.currency&&row.rate===Number(p.documentRate)&&Math.abs(row.effect)===Number(p.amount))&&movements.reduce((sum,row)=>sum+row.effect,0)===(cancelled?0:Number(p.amount))&&state.supplierBalance===60+state.movements.reduce((sum,row)=>sum+row.effect,0)}]);}
   if(query.startsWith('SELECT * FROM dbo.test_current_price_purchase_requests'))return rs(state.requests.filter(row=>row.request_id===p.id));
   if(query.startsWith('SELECT COUNT(*) n FROM dbo.test_current_price_purchase_requests'))return rs([{n:state.requests.length}]);
   if(query.startsWith('INSERT dbo.test_current_price_purchase_requests')){state.requests.push({request_id:p.id,actor_id:p.actor,operation:p.op,payload_json:p.payload,payload_hash:p.hash,response_json:p.json});return rs([]);}
   if(query.startsWith('INSERT dbo.test_current_price_purchase_intents')){
    assert.equal(String(p.native),state.current.native_price_id);assert.equal(String(p.version),state.current.version_id);
    const value=previewCurrentPriceSelection({...input,quantity:p.quantity,selected:state.current,selection:{productId:'301986',priceId:p.native,versionId:p.version,revision:p.revision}});
    const dr=sqlRates.find(row=>row.currency===value.currency),id=state.intents.length+1;
    state.intents.push({id,request_id:p.request,actor_id:16,status:'quoted',price_id:'15',version_id:p.version,native_price_id:p.native,before_revision:p.revision,price_exact_text:value.priceExact,native_price_text:value.nativePriceExact4,currency:value.currency,quantity:p.quantity,document_rate_id:dr.id,account_rate_id:1,document_rate:dr.rate_exact,account_rate:'1.00000000',document_total:value.documentAmountExact4,account_total:value.accountAmountExact4,amount_try:value.amountTryExact4,payload_hash:p.hash,document_no:p.number,document_date:'2026-10-04',receipt_id:null,invoice_id:null,price_reason:state.current.reason,price_changed_at:state.current.changed_at});return rs([{id}]);
   }
   if(query.startsWith('INSERT dbo.test_daily_drafts')){const id=32+state.receipts.length;state.receipts.push({id,state:'pending',payload:JSON.parse(p.payload)});return rs([{id}]);}
   if(query.startsWith('UPDATE dbo.test_current_price_purchase_intents SET receipt_id')){state.intents.find(row=>row.id===p.intent).receipt_id=p.receipt;return rs([]);}
   if(query.startsWith('SELECT t.*,v.reason')&&query.includes('WITH(UPDLOCK,HOLDLOCK)'))return rs(state.intents.filter(row=>query.includes('WHERE invoice_id')?row.invoice_id===p.id:row.receipt_id===p.id));
   if(query.startsWith('UPDATE t SET status')){const t=state.intents.find(row=>row.id===p.id);Object.assign(t,{status:'receiving',stock_before:state.stock,cost_before:state.cost,stock_after:state.stock+t.quantity,cost_after:Math.round((state.stock*state.cost+Number(t.amount_try))/(state.stock+t.quantity)*10000)/10000});return rs([]);}
   if(query.startsWith('UPDATE dbo.test_daily_drafts')){state.receipts.find(row=>row.id===p.id).state=p.state;return rs([]);}
   if(query.startsWith('UPDATE p SET current_stock_qty')){const t=state.intents.find(row=>row.id===p.id);state.stock=t.stock_after;state.cost=t.cost_after;state.postings++;t.status='received';if(state.failPosting)throw Error('guard rejects stock');return rs([]);}
   if(query.startsWith('UPDATE dbo.test_current_price_purchase_intents SET status')){state.intents.find(row=>row.id===p.id).status=query.match(/status=N'([^']+)'/)[1];return rs([]);}
   if(query.startsWith('UPDATE dbo.test_current_price_purchase_intents SET invoice_id')){Object.assign(state.intents.find(row=>row.id===p.id),{invoice_id:p.invoice,status:'linked'});return rs([]);}
   throw Error('Unexpected SQL in current-price workflow test: '+query);
  }
 }
 const sql={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:'SERIALIZABLE'},BigInt:'bigint',UniqueIdentifier:'uuid',Char:()=>'',NVarChar:()=>'',Decimal:()=>'',MAX:-1};
 const native={normalizePurchasePayload:payload=>({grandTotal:payload.items[0].quantity*payload.items[0].purchasePrice}),
  async createPurchaseDraft(payload,user,context){assert.equal(context.stockAlreadyReceived,true);assert.equal(context.testC09Received,true);state.nativeCalls.push('create');const invoice={id:100+state.invoices.length,status:'DRAFT',documentNo:payload.documentNo,documentDate:payload.documentDate,supplierId:payload.supplierId,documentCurrency:payload.documentCurrency,accountCurrency:'TRY',exchangeRate:payload.exchangeRate,accountExchangeRate:payload.accountExchangeRate,grandTotal:payload.items[0].quantity*payload.items[0].purchasePrice,accountAmount:payload.items[0].quantity*payload.items[0].purchasePrice*payload.exchangeRate,amountTry:payload.items[0].quantity*payload.items[0].purchasePrice*payload.exchangeRate,items:payload.items};state.invoices.push(invoice);return invoice;},
  async getPurchaseDraft(id){return state.invoices.find(row=>row.id===Number(id));},
  async finalizePurchaseInvoice(id,user,context){assert.equal(context.testC09Received,true);state.nativeCalls.push('finalize');const invoice=state.invoices.find(row=>row.id===Number(id));invoice.status='FINALIZED';state.movements.push({invoiceId:Number(id),currency:invoice.documentCurrency,rate:invoice.exchangeRate,effect:invoice.accountAmount});state.supplierBalance+=invoice.accountAmount;},
  async cancelPurchaseInvoice(id,payload,user,context){assert.equal(context.testC09Received,true);state.nativeCalls.push('cancel');const invoice=state.invoices.find(row=>row.id===Number(id));invoice.status='CANCELLED';state.movements.push({invoiceId:Number(id),currency:invoice.documentCurrency,rate:invoice.exchangeRate,effect:-invoice.accountAmount});state.supplierBalance-=invoice.accountAmount;}};
 const service=createTestCurrentPricePurchaseService({runtime:async()=>({pool:{},sql,native,assertQuarantine:async()=>{},quarantineContext:()=>({}),audit:async(request,payload)=>{
  const draft=payload.action.startsWith('test_current_price_draft_');assert.equal(payload.entityType,draft?'purchase_invoice':'test_daily_draft');assert.equal(payload.entityId,draft?payload.afterSnapshot.invoiceId:payload.afterSnapshot.receiptId);assert.equal(payload.actor.id,16);state.audits.push(payload);
 },withMutation:async action=>action()})});
 return {state,service};
}
const uuid=index=>`00000000-0000-4000-8000-${String(index).padStart(12,'0')}`;
const httpInput=()=>({selection,quantity:2,date:'2026-10-04',rateVersion:'1'});
test('current native version reaches shared draft/finalize/cancel writer; changed current does not rewrite receipt or invoice and replay writes zero',async()=>{
 const {state,service}=runtimeFixture(),preview=await service.preview(httpInput(),actor);
 const receiptBody={...httpInput(),requestId:uuid(1),previewHash:preview.previewHash},receipt=await service.createReceipt(receiptBody,actor);
 state.current={...state.current,version_id:'5',revision:'B'.repeat(64),price_exact_text:'2.00000000'};
 assert.equal((await service.createReceipt(receiptBody,actor)).replayed,true);
 await assert.rejects(()=>service.createReceipt({...receiptBody,requestId:uuid(9)},actor),{code:'TEST_CURRENT_PRICE_STALE'});
 await service.decideReceipt(receipt.id,{requestId:uuid(2)},actor,true);
 const draftBody={receiptId:receipt.id,requestId:uuid(3),previewHash:preview.previewHash},draft=await service.createDraft(draftBody,actor);
 assert.equal(draft.priceExact,'1.12345678');assert.equal(draft.sourceProof.versionId,'4');assert.equal(draft.invoice.items[0].purchasePrice,1.1235);
 assert.equal((await service.createDraft(draftBody,actor)).replayed,true);
 await service.finalizeDraft(draft.id,{requestId:uuid(4)},actor);
 assert.equal((await service.finalizeDraft(draft.id,{requestId:uuid(4)},actor)).replayed,true);assert.equal(state.movements.length,1);
 await service.cancelDraft(draft.id,{requestId:uuid(5),reason:'Deneme iptali'},actor);
 assert.equal((await service.cancelDraft(draft.id,{requestId:uuid(5),reason:'Deneme iptali'},actor)).replayed,true);
 assert.deepEqual(state.nativeCalls,['create','finalize','cancel']);assert.equal(state.postings,1);assert.equal(state.stock,30);
 assert.equal(state.movements.length,2);assert.equal(state.movements.reduce((sum,row)=>sum+row.effect,0),0);assert.equal(state.supplierBalance,60);
 assert.deepEqual(state.audits.map(row=>[row.entityType,row.entityId]),[['test_daily_draft',32],['test_daily_draft',32],['purchase_invoice',100],['purchase_invoice',100],['purchase_invoice',100]]);
 assert.equal((await service.getDraft(draft.id,actor)).status,'cancelled');
});
test('same UUID with changed full payload conflicts and does not create another receipt or post stock',async()=>{
 const {state,service}=runtimeFixture(),preview=await service.preview(httpInput(),actor),body={...httpInput(),requestId:uuid(1),previewHash:preview.previewHash};
 await service.createReceipt(body,actor);
 await assert.rejects(()=>service.createReceipt({...body,quantity:1},actor),{code:'TEST_CURRENT_PRICE_REPLAY_CONFLICT'});
 assert.equal(state.receipts.length,1);assert.equal(state.intents.length,1);assert.equal(state.postings,0);assert.equal(state.requests.length,1);
});
test('native finalize rollback preserves draft and supplier balance if posting proof disagrees',async()=>{
 const {state,service}=runtimeFixture(),preview=await service.preview(httpInput(),actor),receipt=await service.createReceipt({...httpInput(),requestId:uuid(1),previewHash:preview.previewHash},actor);
 await service.decideReceipt(receipt.id,{requestId:uuid(2)},actor,true);
 const draft=await service.createDraft({receiptId:receipt.id,requestId:uuid(3),previewHash:preview.previewHash},actor);
 state.failDebtProof=true;
 await assert.rejects(()=>service.finalizeDraft(draft.id,{requestId:uuid(4)},actor),{code:'TEST_CURRENT_PRICE_POSTING_DRIFT'});
 assert.equal(state.invoices[0].status,'DRAFT');assert.equal(state.supplierBalance,60);assert.equal(state.movements.length,0);assert.equal(state.requests.length,3);assert.equal(state.stock,30);
});
test('current-price receipt approval rolls back stock, intent and journal when SQL guard refuses posting',async()=>{
 const {state,service}=runtimeFixture(),preview=await service.preview(httpInput(),actor);
 const receipt=await service.createReceipt({...httpInput(),requestId:uuid(1),previewHash:preview.previewHash},actor);
 state.failPosting=true;await assert.rejects(()=>service.decideReceipt(receipt.id,{requestId:uuid(2)},actor,true));
 assert.equal(state.stock,28);assert.equal(state.postings,0);assert.equal(state.receipts[0].state,'pending');assert.equal(state.intents[0].status,'quoted');assert.equal(state.requests.length,1);
});
test('valid current-price rows cannot mask consumer getter/assert or manifest SQL drift',async()=>{
 for(const key of Object.keys(CURRENT_PRICE_PURCHASE_SQL_PROOF)){
  const {state,service}=runtimeFixture();state.proofDrift={[key]:'0'.repeat(64)};
  await assert.rejects(()=>service.preview(httpInput(),actor),{code:'TEST_CURRENT_PRICE_SQL_DRIFT',statusCode:503});
  assert.equal(state.commits,0);assert.equal(state.rollbacks,1);assert.equal(state.receipts.length,0);
 }
});
