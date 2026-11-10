// Real native invoice calls within real private goods owners and a synthetic SQL driver.
// The INSERT assertions stop and roll back before any synthetic commit. Not SQL Server acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {projectDesktopGoodsPreview} from './desktopGoodsPreview.mjs';

test('native purchase INSERT actor is bound to the private owner for draft and finalize',async t=>{
 const U=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const input={supplierId:'8',accountId:'9',documentNo:'F1',documentDate:'2026-11-06',documentCurrency:'TRY',lines:[{clientLineId:U(9),productId:'5',selectedUnitId:'6',quantityExact3:'2.000',purchasePriceExact4:'10.0000',lineDiscountRateExact4:'0.0000'}],invoiceDiscountType:'rate',invoiceDiscountRateExact4:'0.0000',invoiceDiscountAmountExact4:'0.0000',supplierDiscountRateExact4:'0.0000',documentRateExact8:'1.00000000',accountRateExact8:'1.00000000'};
 const locked={supplier:{id:'8',entityId:'4',currency:'TRY',active:true,version:'0x0000000000000001'},account:{id:'9',supplierId:'8',entityId:'4',currency:'TRY',balanceExact8:'0.00000000',active:true},products:[{id:'5',active:true,version:'0x0000000000000002',unitId:'6',unitProductId:'5',unitLabel:'ADET',unitFactorExact8:'1.00000000',baseUnitId:'6',stockCode:'P5',productName:'Ürün'}]};
 const preview=projectDesktopGoodsPreview({input,locked}),cards=[{id:'5',stockCode:'P5',name:'Ürün',barcode:null,active:true}], connector={},pool={},auth={};
 let db={journal:{},receipt:null,invoice:null,lines:[],stock:'0.000',cost:'0.0000',supplier:'0.0000',account:'0.00000000',movements:[],links:[]},lost=false,failPosting=false;const observed=[];
 const row=x=>({recordset:[x]}),rows=x=>({recordset:x});
 class Transaction{async begin(level){assert.equal(level,4);this.open=true;this.data=structuredClone(db);}async commit(){assert(this.open);db=structuredClone(this.data);this.open=false;if(lost){lost=false;throw Error('synthetic lost acknowledgement');}}async rollback(){this.open=false;}}
 class Request{constructor(tx){assert(tx.open);this.tx=tx;this.p={};}input(k,_type,v){this.p[k]=v;return this;}async query(q){if(q.includes('desktopAuditActorId'))return {recordset:[{id:this.p.desktopAuditActorId,username:'fixture-user'}]};const d=this.tx.data,p=this.p;
  if(q.includes('currency_snapshot_ready'))return row({currency_snapshot_ready:1});
  if(q.includes('discount_ready'))return row({discount_ready:0});
  if(q.includes('FROM dbo.system_settings'))return rows([]);
  if(q.includes('SELECT currency_code, is_active, is_deleted FROM dbo.suppliers'))return row({currency_code:'TRY',is_active:true,is_deleted:false});
  if(q.includes('purchaseSupplierCheckProductId'))return row({id:5,stock_code:'P5',name:'Ürün',supplier_id:8,is_active:true});
  if(q.includes('INSERT INTO dbo.purchase_invoices')){assert.equal(p.desktopPurchaseCreatedBy,7);assert.match(q,/@stockCostEffectTry,\s*@desktopPurchaseCreatedBy,\s*NULL/);const owner=await import('./desktopGoodsService.mjs');const binding={transaction:this.tx,operation:'draft',actorId:'7',receiptId:null,invoiceId:null,checkOnly:true};assert.equal(owner.assertDesktopPrivatePurchase(binding),true);assert.throws(()=>owner.assertDesktopPrivatePurchase({...binding,actorId:'8'}));assert.throws(()=>owner.assertDesktopPrivatePurchase({...binding,transaction:{}}));observed.push('draft');throw Error('stop after draft INSERT assertion');}
  if(q.includes('WHERE pi.id = @purchaseFinalizeSnapshotId'))return row({id:13,documentNo:'F1',documentDate:'2026-11-06',supplierId:8,supplierName:'Supplier',supplierIsActive:true,status:'draft',supplierCurrency:'TRY',documentCurrency:'TRY',exchangeRate:1,description:null,subtotal:20,lineDiscountTotal:0,invoiceDiscountRate:0,supplierDiscountRate:0,discountTotal:0,grandTotal:20,amountTry:20,stockCostEffectTry:20,finalizedAt:null,updatedAt:null});
  if(q.includes('WHERE pii.purchase_invoice_id = @purchaseFinalizeItemsSnapshotId'))return rows([{id:31,productId:5,currentStockQty:2,currentAverageCostTry:10,stockCode:'P5',barcode:null,productName:'Ürün',quantity:2,currency:'TRY',purchasePrice:10,lineDiscountRate:0,lineTotal:20,lineTotalTry:20,stockEffect:2,note:null}]);
  if(q.includes('SELECT account_currency, account_amount, account_exchange_rate_snapshot'))return row({account_currency:'TRY',account_amount:20,account_exchange_rate_snapshot:1});
  if(q.includes('INSERT INTO dbo.supplier_movements')){assert.equal(p.desktopSupplierMovementCreatedBy,7);assert.match(q,/SYSUTCDATETIME\(\),\s*@desktopSupplierMovementCreatedBy/);const owner=await import('./desktopGoodsService.mjs');const binding={transaction:this.tx,operation:'finalize',actorId:'7',receiptId:'12',invoiceId:'13',checkOnly:true};assert.equal(owner.assertDesktopPrivatePurchase(binding),true);assert.throws(()=>owner.assertDesktopPrivatePurchase({...binding,actorId:'8'}));assert.throws(()=>owner.assertDesktopPrivatePurchase({...binding,transaction:{}}));observed.push('finalize');throw Error('stop after supplier movement INSERT assertion');}
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
 const sql={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:4},BigInt:{},Int:{},Date:{},UniqueIdentifier:{},Binary:()=>({}),NVarChar:()=>({}),VarChar:()=>({}),Decimal:()=>({}),Bit:{},MAX:-1};
 t.mock.module('mssql',{exports:{default:sql}});
 t.mock.module('mssql/msnodesqlv8.js',{exports:{default:sql}});
 t.mock.module('../config/desktopWriteTlsConnector.mjs',{exports:{getDesktopWritePool:c=>{assert.equal(c,connector);return pool;},getDesktopWriteTargetProfile:()=>null,getDesktopWriteProfile:()=> 'desktop-master-v6'}});
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

 const native=await import('./invoiceDraftService.js');
 const {createDesktopGoodsDraftService,assertDesktopPrivatePurchase}=await import('./desktopGoodsService.mjs');
 const main=await createDesktopGoodsDraftService({connector,auth});
 const fake={pool,sqlDriver:sql,transaction:{open:true},desktopPrivatePurchase:true,stockAlreadyReceived:true,receiptId:'12'};
 const payload={supplierId:8,supplierCurrency:'TRY',documentCurrency:'TRY',documentNo:'F1',documentDate:'2026-11-06',exchangeRate:1,accountExchangeRate:1,items:[{productId:5,quantity:2,purchasePrice:10,lineDiscountRate:0,currency:'TRY',stockCode:'P5',productName:'Ürün'}]};
 await assert.rejects(native.createPurchaseDraft(payload,{id:'7'},fake));
 await assert.rejects(native.finalizePurchaseInvoice('13',{id:'7'},fake));
 assert.throws(()=>assertDesktopPrivatePurchase({transaction:{},operation:'draft',actorId:'7',receiptId:null,invoiceId:null,checkOnly:true}));
 const create={...input,requestId:U(1),previewHash:preview.previewHash};
 assert.equal((await main.create('7',create)).state,'UNKNOWN');assert.deepEqual(observed,['draft']);
 db.receipt={version:2,state:'accepted'};db.invoice={status:'DRAFT'};db.stock='2.000';db.cost='10.0000';db.movements=[{id:'41'}];
 assert.equal((await main.finalize('7',{requestId:U(2),expectedVersion:2},'12')).state,'UNKNOWN');
 assert.deepEqual(observed,['draft','finalize']);
});
