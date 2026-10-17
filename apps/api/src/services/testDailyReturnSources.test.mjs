import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveDailyReturnSource,pendingDailyReturnQuantity,purchaseSourcesFromRows} from './testDailyReturnSources.mjs';

const rows=[{id:25,document_no:'TSTG-NEW',status:'finalized',document_currency:'TRY',grand_total:180,supplier_id:90,supplier_name:'TEST tedarikçi',supplier_balance:120,supplier_currency:'TRY',item_id:250,product_id:91,stock_code:'TEST-V70-GOODS-P',product_name:'TEST ürün',current_stock_qty:23,quantity:3,line_total:180,returned_quantity:1},
 {id:10,document_no:'TDAY-PURCHASE-01',status:'finalized',document_currency:'TRY',grand_total:300,supplier_id:80,supplier_name:'Eski TEST',supplier_balance:0,supplier_currency:'TRY',item_id:100,product_id:81,stock_code:'TEST-DAILY-P',product_name:'Eski TEST ürün',current_stock_qty:25,quantity:5,line_total:300,returned_quantity:0}];
const reservation=(invoiceId,itemId,quantity,state='pending')=>({kind:'invoice-return',state,payload_json:JSON.stringify({sourceInvoiceId:invoiceId,items:[{sourceItemId:itemId,quantity}]})});

test('new receipt invoice selects its own product and supplier, preserving legacy default',()=>{
 const sources=purchaseSourcesFromRows(rows,[]);
 const selected=resolveDailyReturnSource(sources,{sourceInvoiceId:25,sourceItemId:250},10);
 assert.equal(selected.source.supplierId,90);
 assert.equal(selected.item.product_id,91);
 assert.equal(selected.item.returnableQuantity,2);
 assert.equal(resolveDailyReturnSource(sources,{},10).item.id,100);
});

test('foreign invoice and crossed invoice/item pair cannot select a commercial source',()=>{
 const sources=purchaseSourcesFromRows(rows,[]);
 for(const input of [{sourceInvoiceId:999,sourceItemId:250},{sourceInvoiceId:25,sourceItemId:100},{sourceInvoiceId:25},{sourceInvoiceId:0,sourceItemId:250},{sourceInvoiceId:'25 OR 1=1',sourceItemId:250},{sourceInvoiceId:'9007199254740993',sourceItemId:250}])
  assert.throws(()=>resolveDailyReturnSource(sources,input,10),e=>e.code==='TEST_RETURN_SOURCE');
});

test('cancelled invoice cannot create a new return but may reverse its earlier return',()=>{
 const sources=purchaseSourcesFromRows([{...rows[0],status:'cancelled'}],[]);
 const input={sourceInvoiceId:25,sourceItemId:250};
 assert.throws(()=>resolveDailyReturnSource(sources,input,10));
 assert.equal(resolveDailyReturnSource(sources,input,10,{allowCancelled:true}).source.id,25);
});

test('pending reservations apply only to the exact source line and release on reject/cancel',()=>{
 const drafts=[reservation(25,250,1),reservation(10,100,5),reservation(25,251,5),reservation(25,250,8,'rejected'),reservation(25,250,8,'cancelled'),reservation(25,250,8,'approved')];
 assert.equal(pendingDailyReturnQuantity(drafts,25,250),1);
 const source=purchaseSourcesFromRows(rows,drafts)[0];
 assert.equal(source.items[0].returnedQuantity,1);
 assert.equal(source.items[0].pendingQuantity,1);
 assert.equal(source.items[0].returnableQuantity,1);
 assert.equal(purchaseSourcesFromRows(rows,[reservation(25,250,1,'rejected')])[0].items[0].returnableQuantity,2);
});

test('separate items share one invoice header without losing source identity',()=>{
 const sources=purchaseSourcesFromRows([rows[0],{...rows[0],item_id:251,product_id:92,line_total:60,quantity:1,returned_quantity:0}],[]);
 assert.equal(sources.length,1);assert.equal(sources[0].items.length,2);
 assert.equal(resolveDailyReturnSource(sources,{sourceInvoiceId:25,sourceItemId:251},10).item.product_id,92);
});
