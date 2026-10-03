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
test('ordinary daily ERP and native listeners keep dedicated CRM drafts out of their write scope',()=>{
 const draft='/api/test/crm/orders/drafts';
 assert.equal(allowed('POST',draft,ctx),false);
 for(const context of [{mode:'native',writes:true},{mode:'erp',writes:false}])assert.equal(allowed('POST',draft,context),false);
 for(const path of [draft+'/1/finalize',draft+'/1/convert-to-sales-draft','/api/sales-orders','/api/sales-orders/1/convert-to-sales-draft'])assert.equal(allowed('POST',path,ctx),false);
 for(const method of ['PUT','PATCH','DELETE'])assert.equal(allowed(method,draft,ctx),false);
});
