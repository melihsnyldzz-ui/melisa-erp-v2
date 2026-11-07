// Stateful synthetic orchestration test. Native invoice operations and the
// SQL driver are explicitly mocked: this is not T-SQL or driver validation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {projectDesktopGoodsPreview} from './desktopGoodsPreview.mjs';

test('three goods owners preserve one stock/debt effect, recovery and rollback (synthetic native)',async t=>{
 const U=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const input={supplierId:'8',accountId:'9',documentNo:'F1',documentDate:'2026-11-06',documentCurrency:'TRY',lines:[{clientLineId:U(9),productId:'5',selectedUnitId:'6',quantityExact3:'2.000',purchasePriceExact4:'10.0000',lineDiscountRateExact4:'0.0000'}],invoiceDiscountType:'rate',invoiceDiscountRateExact4:'0.0000',invoiceDiscountAmountExact4:'0.0000',supplierDiscountRateExact4:'0.0000',documentRateExact8:'1.00000000',accountRateExact8:'1.00000000'};
 const locked={supplier:{id:'8',entityId:'4',currency:'TRY',active:true,version:'0x0000000000000001'},account:{id:'9',supplierId:'8',entityId:'4',currency:'TRY',balanceExact8:'0.00000000',active:true},products:[{id:'5',active:true,version:'0x0000000000000002',unitId:'6',unitProductId:'5',unitLabel:'ADET',unitFactorExact8:'1.00000000',baseUnitId:'6',stockCode:'P5',productName:'Ürün'}]};
 const preview=projectDesktopGoodsPreview({input,locked}),cards=[{id:'5',stockCode:'P5',name:'Ürün',barcode:null,active:true}], connector={},pool={},auth={};
 let db={journal:{},receipt:null,invoice:null,lines:[],stock:'0.000',cost:'0.0000',supplier:'0.0000',account:'0.00000000',movements:[],links:[]},lost=false,failPosting=false;
 const row=x=>({recordset:[x]}),rows=x=>({recordset:x});
 class Transaction{async begin(level){assert.equal(level,4);this.open=true;this.data=structuredClone(db);}async commit(){assert(this.open);db=structuredClone(this.data);this.open=false;if(lost){lost=false;throw Error('synthetic lost acknowledgement');}}async rollback(){this.open=false;}}
 class Request{constructor(tx){assert(tx.open);this.tx=tx;this.p={};}input(k,_type,v){this.p[k]=v;return this;}async query(q){if(q.includes('desktopAuditActorId'))return {recordset:[{id:this.p.desktopAuditActorId,username:'fixture-user'}]};const d=this.tx.data,p=this.p;
  if(q.includes('DESKTOP_GOODS_TARGET_REJECTED'))return row({ok:1});
  if(q.includes('@@SPID sessionId'))return row({databaseName:'MELISA_ERP_DESKTOP_TEST_20261105',sessionId:11,transactionId:'31',transactionCount:1,transactionState:1});
  if(q.includes('SELECT quote_json quoteJson'))return row({quoteJson:JSON.stringify({input,locked,preview})});
  if(q.includes('s.balance')&&q.includes('movementCount'))return row({supplierBalance:d.supplier,accountBalance:d.account,movementCount:d.invoice?.status==='FINALIZED'?1:0});
  if(q.includes('s.balance')&&q.includes('accountBalance'))return row({supplierBalance:d.supplier,accountBalance:d.account});
  if(q.includes('average_cost_try')&&q.includes('current_stock_qty')&&q.includes('FROM dbo.products'))return row(q.includes('stockExact3')?{id:'5',stockExact3:d.stock,averageCostTryExact4:d.cost}:{id:'5',quantity:d.stock,cost:d.cost});
  if(q.includes('UPDATE dbo.purchase_invoices SET party_entity_id'))return row({changed:1});
  if(q.includes('r.quote_hash')&&q.includes('lineCount'))return row({id:'12',invoiceId:'13',version:1,state:'draft',quoteHash:preview.previewHash,lineCount:1});
  if(q.includes('SELECT CONVERT(varchar(20),supplier_id) supplierId')&&q.includes('FROM dbo.purchase_invoices'))return row({supplierId:'8',entityId:'4',accountId:'9',currency:'TRY',amount:'20.0000'});
  if(q.includes('FROM dbo.desktop_goods_receipt_lines WITH(UPDLOCK,HOLDLOCK)')&&q.includes('quantityBaseExact3'))return rows([{id:'21',clientLineId:U(9),productId:'5',selectedUnitId:'6',baseUnitId:'6',quantityBaseExact3:'2.000',unitCostTryExact4:'10.0000',stockMovementId:null}]);
  if(q.includes('supplierCount')&&q.includes('invoiceStockCount'))return row({supplierCount:0,stockCount:0,invoiceStockCount:0});
  if(q.includes("source_type=N'goods_receipt'")&&q.includes('COUNT_BIG(*) count'))return row({count:d.movements.length});
  if(q.includes('SELECT CONVERT(varchar(20),id) id,LOWER(CONVERT(varchar(36),line_uuid)) lineId'))return rows([{id:'21',lineId:U(9),productId:'5'}]);
  if(q.includes('INSERT dbo.stock_movements')){d.movements.push({id:'41'});return row({id:'41'});}
  if(q.includes('UPDATE dbo.products SET current_stock_qty')){d.stock=String(p.after);d.cost=String(p.average);return row({changed:1});}
  if(q.includes('movementAverageExact4')&&q.includes('JOIN dbo.stock_movements'))return rows([{lineId:'21',movementId:'41',productId:'5',movementType:'in',sourceId:'12',supplierId:'8',documentDate:'2026-11-06',currency:'TRY',quantityInExact3:'2.000',quantityOutExact3:'0.000',quantityNetExact3:'2.000',movementAverageExact4:'10.0000',unitCostTryExact4:'10.0000',purchasePriceExact4:'10.0000',lineTotalTryExact4:'20.0000',stockAfterExact3:d.stock,averageAfterExact4:d.cost}]);
  if(q.includes('goodsCount')&&q.includes('invoiceCount'))return row({goodsCount:d.movements.length,invoiceCount:0});
  if(q.includes('linkCount')&&q.includes('movementCount'))return row({linkCount:d.links.length,movementCount:0});
  if(q.includes('UPDATE dbo.supplier_movements SET party_entity_id'))return row({changed:1});
  if(q.includes('INSERT dbo.desktop_goods_purchase_links')){d.links.push({lineId:'21',itemId:'31',quantity:'2.000'});return row({changed:1});}
  if(q.includes('FROM dbo.desktop_goods_purchase_links WITH(UPDLOCK,HOLDLOCK)'))return rows(d.links);
  if(q.includes('FROM sys.columns c JOIN sys.types'))return rows([]);
  throw Error('unhandled synthetic query');}}
 const sql={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:4},BigInt:{},Int:{},Date:{},UniqueIdentifier:{},Binary:()=>({}),NVarChar:()=>({}),VarChar:()=>({}),MAX:-1};
 t.mock.module('mssql',{exports:{default:sql}});
 t.mock.module('../config/desktopWriteTlsConnector.mjs',{exports:{getDesktopWritePool:c=>{assert.equal(c,connector);return pool;},getDesktopWriteProfile:()=> 'desktop-master-v6'}});
 t.mock.module('./desktopWriteAuthCore.mjs',{exports:{getDesktopWriteSessionVerifier:(a,p)=>{assert.equal(a,auth);assert.equal(p,pool);return async()=>true;}}});
 t.mock.module('./desktopGoodsLockedSelection.mjs',{exports:{readDesktopGoodsLockedSelection:async()=>({locked,preview,cards})}});
 t.mock.module('./desktopGoodsJournalStore.mjs',{exports:{lockDesktopGoodsJournal:async({transaction,binding})=>{const x=transaction.data.journal[binding.requestId];if(!x){transaction.data.journal[binding.requestId]={hash:binding.bodyHash,state:'pending'};return {kind:'new'};}if(x.hash!==binding.bodyHash)throw Error('conflict');if(x.state==='pending')return {kind:'unknown_same_request_only'};return {kind:'replay',response:x.response};},finishDesktopGoodsJournal:async({transaction,binding,response})=>{const x=transaction.data.journal[binding.requestId];assert.equal(x?.state,'pending');assert.equal(x.hash,binding.bodyHash);transaction.data.journal[binding.requestId]={hash:binding.bodyHash,state:'committed',response};}}});
 const receipt=tx=>({id:'12',version:tx.data.receipt.version,state:tx.data.receipt.state,purchaseInvoiceId:'13',preview});
 t.mock.module('./desktopGoodsReceiptRead.mjs',{exports:{readDesktopGoodsReceipt:async({transaction})=>receipt(transaction)}});
 t.mock.module('./desktopGoodsDraftInvoiceRead.mjs',{exports:{assertDesktopGoodsDraftInvoice:async()=>[{invoiceItemId:'31',clientLineId:U(9),productId:'5',quantityBaseExact3:'2.000'}]}});
 t.mock.module('./desktopGoodsApprovedStock.mjs',{exports:{assertDesktopGoodsApprovedStock:async({transaction})=>{assert.equal(transaction.data.movements.length,1);return true;}}});
 t.mock.module('./desktopGoodsAudit.mjs',{exports:{writeDesktopGoodsAudit:async()=>true}});
 t.mock.module('./desktopGoodsMutationSql.mjs',{exports:{insertDesktopGoodsHeader:async({transaction})=>{transaction.data.receipt={version:1,state:'draft'};return '12';},insertDesktopGoodsLine:async()=> '21',bindDesktopGoodsInvoice:async()=>{},bindDesktopGoodsMovement:async()=>{},advanceDesktopGoodsState:async({transaction,previous,next,expectedVersion})=>{assert.equal(transaction.data.receipt.state,previous);assert.equal(transaction.data.receipt.version,expectedVersion);transaction.data.receipt={state:next,version:expectedVersion+1};},updateDesktopGoodsAccount:async({transaction,afterExact8})=>{if(failPosting)throw Error('synthetic account failure');transaction.data.account=afterExact8;}}});
 t.mock.module('./desktopPurchaseAccountProjection.mjs',{exports:{planDesktopPurchaseAccount:()=>({accountAfterExact8:'20.00000000'}),compileDesktopPurchaseAccountReadback:()=>({sql:'SYNTHETIC_PROOF',parameters:{}}),verifyDesktopPurchaseAccountReadback:()=>true}});
 const originalQuery=Request.prototype.query;Request.prototype.query=async function(q){if(q==='SYNTHETIC_PROOF')return {recordsets:[]};return originalQuery.call(this,q);};
 const normalizedPurchase=x=>({...structuredClone(x),grandTotal:20,amountTry:20});
 const nativeSnapshot=()=>{const items=[{id:31,productId:5,quantity:2,purchasePrice:10}];Object.defineProperties(items,{columns:{value:{id:{index:0}},enumerable:false,configurable:true,writable:false},toTable:{value:()=>{},enumerable:false,configurable:true,writable:false}});return {id:'13',supplierId:'8',status:'DRAFT',grandTotal:20,accountCurrency:'TRY',accountAmount:20,exchangeRate:1,accountExchangeRate:1,updatedAt:new Date('2026-11-06T12:00:00.123Z'),items};};
 t.mock.module('./invoiceDraftService.js',{exports:{normalizePurchasePayload:normalizedPurchase,createPurchaseDraft:async(invoice,actor,context)=>{
  const s=await import('./desktopGoodsService.mjs'),normalized=normalizedPurchase(invoice),binding={transaction:context.transaction,operation:'draft',actorId:String(actor.id),receiptId:null,invoiceId:null};
  s.assertDesktopPrivatePurchase({...binding,invoice:normalized});
  // Real prepareInvoiceCurrency mutates the normalized draft before the
  // supplier-items guard. The old identity mock omitted this second phase.
  Object.assign(normalized,{accountCurrency:'TRY',accountAmount:20,accountExchangeRate:1,exchangeRate:1,amountTry:20});
  s.assertDesktopPrivatePurchase({...binding,invoice:normalized});
  for(const patch of [{accountCurrency:'USD'},{accountAmount:21},{exchangeRate:2},{supplierId:9},{extra:true}])assert.throws(()=>s.assertDesktopPrivatePurchase({...binding,invoice:{...normalized,...patch}}));
  const tampered=structuredClone(normalized);tampered.items[0].purchasePrice=11;assert.throws(()=>s.assertDesktopPrivatePurchase({...binding,invoice:tampered}));
  context.transaction.data.invoice={status:'DRAFT'};return {id:'13',status:'DRAFT',supplierId:'8',supplierCurrency:'TRY',documentCurrency:'TRY',documentNo:'F1',documentDate:'2026-11-06',exchangeRate:1,accountExchangeRate:1,invoiceDiscountType:'rate',invoiceDiscountRate:0,invoiceDiscountAmount:0,supplierDiscountRate:0,subtotal:20,lineDiscountTotal:0,discountTotal:0,stockCostEffectTry:20,grandTotal:20,amountTry:20,items:[{productId:'5',quantity:2,currency:'TRY',stockCode:'P5',productName:'Ürün',barcode:null,purchasePrice:10,lineDiscountRate:0,lineTotal:20,lineTotalTry:20}]};},readDesktopPurchaseFinalizeSnapshot:async()=>nativeSnapshot(),finalizePurchaseInvoice:async(id,actor,context)=>{
   const s=await import('./desktopGoodsService.mjs'),invoice=nativeSnapshot(),binding={transaction:context.transaction,operation:'finalize',actorId:String(actor.id),receiptId:'12',invoiceId:id};
   s.assertDesktopPrivatePurchase({...binding,invoice});s.assertDesktopPrivatePurchase({...binding,invoice:{...invoice,items:[...invoice.items]}});
   for(const bad of [(()=>{const x=nativeSnapshot();delete x.items.toTable;return x;})(),(()=>{const x=nativeSnapshot();Object.defineProperty(x.items,'columns',{value:{},enumerable:true,configurable:true,writable:false});return x;})(),(()=>{const x=nativeSnapshot();Object.defineProperty(x.items,'extra',{value:1});return x;})(),(()=>{const x=nativeSnapshot();delete x.items[0];return x;})(),{...nativeSnapshot(),grandTotal:21}])assert.throws(()=>s.assertDesktopPrivatePurchase({...binding,invoice:bad}));
   let accessed=false;const accessor=nativeSnapshot();Object.defineProperty(accessor.items,'columns',{get:()=>{accessed=true;return {};},enumerable:false,configurable:true});assert.throws(()=>s.assertDesktopPrivatePurchase({...binding,invoice:accessor}));assert.equal(accessed,false);
   const changedRow=nativeSnapshot();changedRow.items[0].quantity=3;assert.throws(()=>s.assertDesktopPrivatePurchase({...binding,invoice:changedRow}));
   assert.equal(context.stockAlreadyReceived,true);context.transaction.data.invoice.status='FINALIZED';context.transaction.data.supplier='20.0000';return {...invoice,status:'FINALIZED'};}}});
 const {createDesktopGoodsDraftService,assertDesktopPrivatePurchase}=await import('./desktopGoodsService.mjs'),{createDesktopGoodsApprovalService}=await import('./desktopGoodsApprovalService.mjs');const main=await createDesktopGoodsDraftService({connector,auth}),approval=await createDesktopGoodsApprovalService({connector,auth});assert.throws(()=>assertDesktopPrivatePurchase({transaction:{},operation:'draft',actorId:'7',receiptId:null,invoiceId:null,checkOnly:true}));
 const create={...input,requestId:U(1),previewHash:preview.previewHash},accept={requestId:U(2),expectedVersion:1},finish={requestId:U(3),expectedVersion:2};
 assert.equal((await main.create('7',create)).state,'COMMITTED');assert.equal(db.stock,'0.000');assert.equal(db.account,'0.00000000');assert.equal((await main.create('7',create)).replayed,true);assert.equal((await main.create('7',{...create,documentNo:'F2'})).state,'UNKNOWN');assert.equal(db.movements.length,0);
 assert.equal((await approval.approve('7',accept,'12')).state,'COMMITTED');assert.equal(db.stock,'2.000');assert.equal(db.movements.length,1);assert.equal((await approval.approve('7',accept,'12')).replayed,true);
 assert.equal((await main.finalize('7',{requestId:U(4),expectedVersion:1},'12')).state,'NOT_COMMITTED');failPosting=true;assert.equal((await main.finalize('7',finish,'12')).state,'UNKNOWN');assert.equal(db.supplier,'0.0000');assert.equal(db.account,'0.00000000');assert.equal(db.stock,'2.000');failPosting=false;lost=true;assert.equal((await main.finalize('7',finish,'12')).state,'UNKNOWN');assert.equal((await main.finalize('7',finish,'12')).replayed,true);assert.equal(db.supplier,'20.0000');assert.equal(db.account,'20.00000000');assert.equal(db.movements.length,1);assert.equal(db.links.length,1);
});
