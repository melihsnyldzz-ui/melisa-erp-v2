import test from 'node:test';import assert from 'node:assert/strict';
import {isCanonicalTestWriteAllowed as allowed} from './canonicalTestRoutePolicy.mjs';
const ctx={writes:true,mode:'erp'};
test('session pair confirmation requires exact protected writable ERP POST; never opens auth administration',()=>{
 const route='/api/auth/session-confirm';assert.equal(allowed('POST',route,{...ctx,protectedNormalAuth:true}),true);
 for(const scope of [ctx,{writes:false,mode:'erp',protectedNormalAuth:true},{writes:true,mode:'native',protectedNormalAuth:true},{...ctx,protectedNormalAuth:'true'}])assert.equal(allowed('POST',route,scope),false);
 for(const method of ['GET','PUT','PATCH','DELETE'])assert.equal(allowed(method,route,{...ctx,protectedNormalAuth:true}),false);
 for(const p of [route+'/',route+'/extra','/api/auth-admin/users','/api/auth/test-admin'])assert.equal(allowed('POST',p,{...ctx,protectedNormalAuth:true}),false);
});
test('protected normal refresh/logout require explicit writable ERP opt-in and exact routes',()=>{for(const route of ['/api/auth/refresh','/api/auth/logout']){assert.equal(allowed('POST',route,{...ctx,protectedNormalAuth:true}),true);for(const scope of [ctx,{writes:false,mode:'erp',protectedNormalAuth:true},{writes:true,mode:'native',protectedNormalAuth:true},{...ctx,protectedNormalAuth:'true'}])assert.equal(allowed('POST',route,scope),false);for(const method of ['GET','PUT','DELETE'])assert.equal(allowed(method,route,{...ctx,protectedNormalAuth:true}),false);assert.equal(allowed('POST',route+'/',{...ctx,protectedNormalAuth:true}),false);}assert.equal(allowed('POST','/api/auth/test-admin',{...ctx,protectedNormalAuth:true}),false);});
test('supplier payments expose only their exact normal lifecycle inside writable ERP TEST',()=>{
 for(const suffix of ['preview','payments','payments/12/cancel']){
  const path='/api/work-supplier-payments/'+suffix;
  assert.equal(allowed('POST',path,ctx),true);
  for(const scope of [{writes:true,mode:'native'},{writes:false,mode:'erp'}])assert.equal(allowed('POST',path,scope),false);
  for(const method of ['PUT','PATCH','DELETE'])assert.equal(allowed(method,path,ctx),false);
 }
 for(const suffix of ['context','requests/00000000-0000-4000-8000-000000000001','payments/01/cancel','payments/0/cancel','payments/12/cancel/extra','accounts','suppliers'])assert.equal(allowed('POST','/api/work-supplier-payments/'+suffix,ctx),false);
});
test('normal current-price FX purchase paths keep the existing TEST/native boundary',()=>{
 for(const suffix of ['preview','receipts','receipts/12/approve','receipts/12/reject','drafts','drafts/12/finalize','drafts/12/cancel']){
  const path='/api/work-purchases/fx/'+suffix;
  assert.equal(allowed('POST',path,ctx),true,path);
  for(const scope of [{mode:'native',writes:true},{mode:'erp',writes:false}])assert.equal(allowed('POST',path,scope),false);
  for(const method of ['PUT','PATCH','DELETE'])assert.equal(allowed(method,path,ctx),false);
 }
 for(const suffix of ['context','drafts/12','receipts/01/approve','receipts/0/approve','drafts/12/finalize/extra','rates','prices'])assert.equal(allowed('POST','/api/work-purchases/fx/'+suffix,ctx),false,suffix);
});
test('inbound normal writes cannot reach native, supplier editing or malformed lifecycle IDs',()=>{
 for(const path of ['/api/work-receiving/count-drafts','/api/work-receiving/count-drafts/12/update','/api/work-receiving/count-drafts/12/submit','/api/work-receiving/count-drafts/12/cancel','/api/work-receiving/receipts/12/approve','/api/work-receiving/receipts/12/reject','/api/work-purchases/preview','/api/work-purchases/drafts','/api/work-purchases/drafts/12/finalize','/api/work-purchases/drafts/12/cancel']){
  assert.equal(allowed('POST',path,ctx),true,path);assert.equal(allowed('POST',path,{mode:'native',writes:true}),false);assert.equal(allowed('POST',path,{mode:'erp',writes:false}),false);
  for(const method of ['PUT','PATCH','DELETE'])assert.equal(allowed(method,path,ctx),false);
 }
 for(const path of ['/api/work-receiving/count-drafts/01/submit','/api/work-receiving/count-drafts/12/submit/extra','/api/work-suppliers/context','/api/work-receiving/context','/api/work-purchases/drafts/0/finalize','/api/work-purchases/products/12'])assert.equal(allowed('POST',path,ctx),false,path);
});
test('normal work writes permit only exact lifecycle paths in ERP TEST',()=>{
 for(const path of ['/api/work-sales/preview','/api/work-sales/drafts','/api/work-sales/drafts/1/finalize','/api/work-sales/drafts/1/cancel','/api/work-collections','/api/work-collections/preview','/api/work-collections/1/cancel']){
  assert.equal(allowed('POST',path,ctx),true);assert.equal(allowed('POST',path,{mode:'native',writes:true}),false);assert.equal(allowed('POST',path,{mode:'erp',writes:false}),false);
  for(const method of ['PUT','PATCH','DELETE'])assert.equal(allowed(method,path,ctx),false);
 }
 for(const path of ['/api/work-sales/customers','/api/work-sales/drafts/01/finalize','/api/work-sales/drafts/1/finalize/extra','/api/work-collections/1/refund','/api/work-collections/context','/api/work-sales/invoices'])assert.equal(allowed('POST',path,ctx),false);
});
test('native price writes stay on the one synthetic product and cannot escape to general cards',()=>{
 const path='/api/products/301986/current-prices';
 assert.equal(allowed('POST',path,ctx),true);
 for(const other of ['/api/products/1/current-prices','/api/products/0301986/current-prices','/api/products/301986','/api/products/301986/current-prices/extra'])assert.equal(allowed('POST',other,ctx),false,other);
 for(const mode of [{mode:'native',writes:true},{mode:'erp',writes:false}])assert.equal(allowed('POST',path,mode),false);
 for(const method of ['PUT','PATCH','DELETE'])assert.equal(allowed(method,path,ctx),false);
});
test('current-price purchases retain native/read-only isolation and allow only their recorded lifecycle',()=>{
 const prefix='/api/test-current-price-purchase/';
 for(const suffix of ['preview','receipts','receipts/1/approve','receipts/1/reject','invoice-drafts','invoice-drafts/1/finalize','invoice-drafts/1/cancel']){
  assert.equal(allowed('POST',prefix+suffix,ctx),true);
  assert.equal(allowed('POST',prefix+suffix,{mode:'native',writes:true}),false);
  assert.equal(allowed('POST',prefix+suffix,{mode:'erp',writes:false}),false);
 }
 for(const suffix of ['context','receipts/0/approve','receipts/1/finalize','invoice-drafts/1','invoice-drafts/1/cancel/extra','rates','cleanup'])assert.equal(allowed('POST',prefix+suffix,ctx),false);
});
test('supplier contact writes target only the proved synthetic card and keep general PUT closed',()=>{
 const path='/api/test-supplier-cards/13373/contact';
 assert.equal(allowed('POST',path,ctx),true);
 for(const context of [{mode:'native',writes:true},{mode:'erp',writes:false}])assert.equal(allowed('POST',path,context),false);
 for(const method of ['PUT','PATCH','DELETE'])assert.equal(allowed(method,path,ctx),false);
 for(const candidate of ['/api/suppliers/13373','/api/test-supplier-cards/10160/contact','/api/test-supplier-cards/013373/contact','/api/test-supplier-cards/13373/contact/extra'])assert.equal(allowed('POST',candidate,ctx),false);
 assert.equal(allowed('PUT','/api/suppliers/13373',ctx),false);
});
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
