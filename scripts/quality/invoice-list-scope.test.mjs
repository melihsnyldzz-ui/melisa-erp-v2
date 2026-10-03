import test from 'node:test';
import assert from 'node:assert/strict';
import {invoiceListScope} from '../../apps/web-admin/src/modules/shared/invoiceListScope.js';
import {getSalesDraftsList, getPurchaseDraftsList} from '../../apps/api/src/services/invoiceDraftService.js';

test('same numeric product and customer IDs cannot share a sales-list tab', () => {
  const product=invoiceListScope('sales-invoice-list',{productId:10002,stockCode:'P-1'});
  const customer=invoiceListScope('sales-invoice-list',{customerId:10002,customerCode:'C-1'});
  assert.notEqual(product.key,customer.key);
  assert.equal(product.label,'Ürün: P-1');
  assert.equal(customer.label,'Cari: C-1');
  assert.notEqual(invoiceListScope('purchase-invoice-list',{productId:1}).key,invoiceListScope('purchase-invoice-list',{supplierId:1}).key);
});
test('scope identity is stable, includes combined filters and preserves BIGINT text', () => {
  const scope=invoiceListScope('sales-invoice-list',{customerId:'2',productId:'9007199254740993'});
  assert.equal(scope.key,'productId:9007199254740993|customerId:2');
  assert.equal(scope.productId,'9007199254740993');
  assert.notEqual(scope.key,invoiceListScope('sales-invoice-list',{customerId:'3',productId:'9007199254740993'}).key);
});
test('general lists and non-invoice screens receive no new tab identity', () => {
  assert.equal(invoiceListScope('sales-invoice-list',{}),null);
  assert.equal(invoiceListScope('purchase-invoice-list',{sourceId:42}),null);
  assert.equal(invoiceListScope('customer-card',{customerId:42}),null);
});
for(const [name,list] of [['sales',getSalesDraftsList],['purchase',getPurchaseDraftsList]]) {
  test(`${name} invalid exact IDs fail before database access instead of broadening results`,async()=>{
    for(const field of ['productId','customerId','supplierId'])for(const value of ['0','-1','1.5','1 OR 1=1','1e2','01',' ',[],{},true,'9223372036854775808',9007199254740992]) {
      await assert.rejects(list({[field]:value}),{code:'INVOICE_LIST_ID_INVALID',statusCode:400});
    }
  });
}
