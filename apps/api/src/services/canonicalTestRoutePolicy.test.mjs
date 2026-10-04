import test from 'node:test';import assert from 'node:assert/strict';
import {isCanonicalTestWriteAllowed as allowed} from './canonicalTestRoutePolicy.mjs';
const ctx={writes:true,mode:'erp'};
test('only authenticated guarded TEST contracts can reach a write',()=>{
 for(const p of ['/api/sales-invoices/test-complete','/api/sales-invoices/1/cancel','/api/finance/collections','/api/test-purchase/goods','/api/test-daily/count/approve','/api/test-daily/fx/collect'])assert.equal(allowed('POST',p,ctx),true,p);
 for(const p of ['/api/sales-invoices/draft','/api/sales-invoices/1/finalize','/api/products/1','/api/customers','/api/finance/accounts/cleanup','/api/test-daily/count/approve/extra','/api/test-daily/unregistered/approve','/api/native-terminal/sales','/api/stock-count/adjust'])assert.equal(allowed('POST',p,ctx),false,p);
});
test('native and read-only runtime never allow business writes',()=>{
 for(const context of [{mode:'native',writes:true},{mode:'erp',writes:false}]){
  assert.equal(allowed('POST','/api/test-daily/count/approve',context),false);
  assert.equal(allowed('POST','/api/auth/login',context),true);
 }
 assert.equal(allowed('DELETE','/api/test-purchase/goods',ctx),false);
});
test('batch writes are narrow POST paths and fail closed in native/read-only mode',()=>{
 for(const p of ['/api/test-purchase/batches','/api/test-purchase/batches/2/approve','/api/test-purchase/batches/2/reject','/api/test-purchase/invoice-drafts','/api/test-purchase/invoice-drafts/3/finalize','/api/test-purchase/invoice-drafts/3/cancel']){
  assert.equal(allowed('POST',p,ctx),true,p);assert.equal(allowed('POST',p,{writes:false,mode:'erp'}),false);assert.equal(allowed('POST',p,{writes:true,mode:'native'}),false);assert.equal(allowed('DELETE',p,ctx),false);
 }
 for(const p of ['/api/test-purchase/batches/0/approve','/api/test-purchase/batches/2/finalize','/api/test-purchase/invoice-drafts/3','/api/test-purchase/invoice-drafts/3/finalize/extra'])assert.equal(allowed('POST',p,ctx),false,p);
});
test('foreign purchase bridge admits only its guarded exact POST paths',()=>{
 for(const p of ['/api/test-purchase-fx/preview','/api/test-purchase-fx/receipts','/api/test-purchase-fx/receipts/2/approve','/api/test-purchase-fx/receipts/2/reject','/api/test-purchase-fx/invoice-drafts','/api/test-purchase-fx/invoice-drafts/3/finalize','/api/test-purchase-fx/invoice-drafts/3/cancel']){
  assert.equal(allowed('POST',p,ctx),true,p);assert.equal(allowed('POST',p,{writes:false,mode:'erp'}),false);assert.equal(allowed('POST',p,{writes:true,mode:'native'}),false);assert.equal(allowed('PUT',p,ctx),false);
 }
 for(const p of ['/api/test-purchase-fx/context','/api/test-purchase-fx/receipts/0/approve','/api/test-purchase-fx/invoice-drafts/3','/api/test-purchase-fx/invoice-drafts/3/finalize/extra','/api/test-purchase-fx/rates','/api/test-purchase-fx/price-write'])assert.equal(allowed('POST',p,ctx),false,p);
});
