import test from 'node:test';
import assert from 'node:assert/strict';
import {goodsBatchBody,draftBody,previewTotals,purchaseProducts} from './testPurchaseModel.js';
const scope={product_id:1,stock_code:'TST-A',product_name:'Birinci TEST ürünü',current_stock_qty:10,supplier_id:8,warehouse_id:2};
const products=[{id:1,stockCode:'TST-A',name:'Birinci TEST ürünü',purchasePrice:60},{id:2,stockCode:'TST-B',name:'İkinci TEST ürünü',purchasePrice:80}];
const batch={id:11,state:'accepted',lines:[{id:21,productId:1,invoiceableQuantity:3},{id:22,productId:2,invoiceableQuantity:2}]};
test('two distinct goods rows preserve individual identity and quantity',()=>{
 const body=goodsBatchBody(scope,products,[{code:'TST-A',quantity:3},{code:'TST-B',quantity:2}],'  teslimat  ');
 assert.deepEqual(body,{supplierId:8,warehouseId:2,note:'teslimat',lines:[{clientLineId:'line-1',productId:1,quantity:3,unit:'ADET'},{clientLineId:'line-2',productId:2,quantity:2,unit:'ADET'}]});
});
test('goods rejects duplicate/outside products, fractional and out of scope quantities',()=>{
 for(const rows of [[],[{code:'TST-A',quantity:0}],[{code:'TST-A',quantity:6}],[{code:'TST-A',quantity:1.5}],[{code:'REAL',quantity:1}],[{code:'TST-A',quantity:1},{code:'TST-A',quantity:2}],[{code:'TST-A',quantity:1},{code:'TST-B',quantity:1},{code:'TST-A',quantity:1}]])assert.throws(()=>goodsBatchBody(scope,products,rows));
});
test('draft takes prices from product context and respects each remaining receipt line',()=>{
 const body=draftBody(batch,products,{number:'TSTB-01',date:'2026-10-04',currency:'USD'},[{receiptLineId:21,quantity:3,purchasePrice:1},{receiptLineId:22,quantity:2,purchasePrice:1}]);
 assert.deepEqual(body.lines,[{receiptLineId:21,quantity:3,purchasePrice:60,lineDiscountRate:0},{receiptLineId:22,quantity:2,purchasePrice:80,lineDiscountRate:0}]);assert.equal(body.currency,'TRY');assert.equal(body.vatRate,0);assert.equal(previewTotals(body.lines).grandTotal,340);
});
test('draft rejects unapproved batch, reservation overflow, duplicate line, bad date, unknown price',()=>{
 const values={number:'TSTB-01',date:'2026-10-04'},rows=[{receiptLineId:21,quantity:1}];
 assert.throws(()=>draftBody({...batch,state:'pending'},products,values,rows));
 assert.throws(()=>draftBody(batch,products,values,[{receiptLineId:22,quantity:3}]));
 assert.throws(()=>draftBody(batch,products,values,[...rows,...rows]));
 assert.throws(()=>draftBody(batch,products,{...values,date:'2026-02-30'},rows));
 assert.throws(()=>draftBody(batch,[{...products[0],purchasePrice:null}],values,rows));
 for(const price of [null,undefined,'','60','invalid',NaN])assert.equal(previewTotals([{quantity:2,purchasePrice:price}]),null);
});
test('unknown product stock and cost stay unknown instead of zero',()=>{
 const [p]=purchaseProducts({scope,products:[{id:1,stockCode:'TST-A',name:'TEST',purchasePrice:null,currentStockQuantity:null}]});assert.equal(p.purchasePrice,null);assert.equal(p.currentStockQuantity,null);
});
