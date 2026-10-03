import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTestInvoiceList} from './testSalesModel.js';
test('TEST receipt list adapts actual API invoiceNo and totalAmount without a zero fallback',()=>{
 const [row]=normalizeTestInvoiceList([{id:34464,invoiceNo:'TST70-example',totalAmount:200,status:'FINALIZED'}]);
 assert.equal(row.documentNo,'TST70-example');assert.equal(row.grandTotal,200);assert.equal(row.id,34464);
 for(const value of [null,[{id:1,status:'FINALIZED'}],[{id:1,invoiceNo:'X',status:'FINALIZED',totalAmount:'200'}]])assert.throws(()=>normalizeTestInvoiceList(value));
});
