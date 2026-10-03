import test from 'node:test';
import assert from 'node:assert/strict';
import {purchaseReturnSources,invoiceReturnRow,approvedPurchaseReturnCents} from './testDailyPurchaseModel.js';
import {dailyReturnsView} from './testDailyReturnsView.js';
const data={scope:{source_id:5,stock_code:'OLD'},party:{name:'Old supplier'},availablePurchaseSources:[{id:5,document_no:'OLD-5',document_currency:'TRY',supplierName:'Old supplier',supplierBalance:0,supplierCurrency:'TRY',items:[{id:51,stock_code:'OLD',product_name:'Old product',quantity:5,line_total:300,returnableQuantity:4,pendingQuantity:1,returnedQuantity:0,current_stock_qty:7}]},{id:9,document_no:'TSTG-NEW-9',document_currency:'TRY',supplierName:'Goods supplier',supplierBalance:120,supplierCurrency:'TRY',items:[{id:91,stock_code:'GOODS',product_name:'Goods product',quantity:3,line_total:180,returnableQuantity:2,pendingQuantity:0,returnedQuantity:1,current_stock_qty:2}]}]};
const draft={id:'11',kind:'invoice-return',state:'pending',payload:{sourceInvoiceId:9,items:[{sourceItemId:91,quantity:1}],reason:'Hasarlı'},plan:{sourceDocumentNo:'TSTG-NEW-9',partyName:'Goods supplier',documentCurrency:'TRY',amount:60,items:[{stockCode:'GOODS'}]}};
test('selected purchase source and stored draft retain their own invoice, item, supplier, price and stock',()=>{
 const sources=purchaseReturnSources(data),row=invoiceReturnRow(draft,data,sources);
 assert.equal(sources[1].items[0].priceCents,6000);assert.equal(sources[1].items[0].returnableQuantity,2);
 assert.equal(row.purchaseId,'9');assert.equal(row.sourceItemId,91);assert.equal(row.code,'GOODS');assert.equal(row.supplier,'Goods supplier');assert.equal(row.purchaseNumber,'TSTG-NEW-9');assert.equal(row.stock,2);assert.equal(row.amount,6000);
 const withoutAvailable=invoiceReturnRow(draft,data,[]);assert.equal(withoutAvailable.code,'GOODS');assert.equal(withoutAvailable.purchaseNumber,'TSTG-NEW-9');assert.equal(withoutAvailable.supplier,'Goods supplier');
});
test('only approved returns from the matching invoice reduce the purchase outstanding balance',()=>{
 const raw=(id,state,amount)=>({kind:'invoice-return',state,payload_json:JSON.stringify({sourceInvoiceId:id}),plan_json:JSON.stringify({amount})});
 const d={drafts:[raw(9,'approved',60),raw(5,'approved',120),raw(9,'pending',60),raw(9,'rejected',60),raw(9,'cancelled',60)]};
 assert.equal(approvedPurchaseReturnCents(d,9),6000);assert.equal(approvedPurchaseReturnCents(d,5),12000);
});
test('invoice shortcut preselects the actual row, bounds remaining quantity and sends both source ids',()=>{
 let body,callback,sent;const detail={},submit={},error={},f={elements:{source:{value:'9:91'},qty:{}}};
 const oldDocument=globalThis.document;
 globalThis.document={getElementById:id=>id==='demo-form'?f:id==='return-source-detail'?detail:error,querySelector:()=>submit};
 try{
  const view=dailyReturnsView({state:{purchases:purchaseReturnSources(data)},purchaseLines:p=>p.items,esc:String,money:(v,c)=>v/100+' '+c,select:(_l,_n,o)=>o,field:()=>'',form:(_t,b,cb)=>{body=b;callback=cb},canDraft:()=>true,actor:()=> 'İlker',requestSupplierReturn:(_s,d)=>sent=d});
  view.supplierReturnForm('9');assert.match(body,/value="9:91" selected/);assert.equal(f.elements.qty.max,2);assert.match(detail.textContent,/GOODS/);assert.match(detail.textContent,/60 TRY/);assert.equal(submit.disabled,false);
  callback({}, {source:'9:91',qty:'1',reason:'Hasarlı'});assert.deepEqual(sent,{purchaseId:'9',sourceItemId:'91',quantity:1,reason:'Hasarlı'});
  assert.throws(()=>callback({}, {source:'9:91',qty:'3',reason:'Hasarlı'}),/kalan/);
  f.elements.source.value='5:51';f.elements.source.onchange();assert.equal(f.elements.qty.max,4);assert.match(detail.textContent,/OLD-5/);
 }finally{globalThis.document=oldDocument}
});
test('return draft and approval submit stay disabled without the actual session permission',()=>{
 const submit={},error={},detail={},f={elements:{source:{value:'9:91'},qty:{}}},oldDocument=globalThis.document;let callback;
 globalThis.document={getElementById:id=>id==='demo-form'?f:id==='return-source-detail'?detail:error,querySelector:()=>submit};
 try{
  const view=dailyReturnsView({state:{purchases:purchaseReturnSources(data),supplierReturns:[invoiceReturnRow(draft,data,purchaseReturnSources(data))]},purchaseLines:p=>p.items,esc:String,money:v=>v,select:()=>'',field:()=>'',form:(_t,_b,cb)=>callback=cb,canDraft:()=>false,allowed:()=>false,stockQuantity:()=>2,receipts:()=>[]});
  view.supplierReturnForm('9');assert.equal(submit.disabled,true);assert.throws(()=>callback({}, {source:'9:91',qty:'1'}),/yetkisi/);
  view.reviewSupplierReturn('11');assert.equal(submit.disabled,true);assert.match(error.textContent,/onay yetkisi/);
 }finally{globalThis.document=oldDocument}
});
