import test from 'node:test';import assert from 'node:assert/strict';
import {parseBusinessInboundSelection,withBusinessInboundSelection,getBusinessInboundSelection,createBusinessInboundSelectionMiddleware} from './businessInboundSelection.mjs';
const copy={target:{database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'},products:[{id:'100',supplierId:'1'}],suppliers:[{id:'1',currency:'TRY',accountId:'11'},{id:'1',currency:'USD',accountId:'12'}]};
test('pair is exact finite supplier/account/currency and never a new account grant',()=>{
 assert.deepEqual(parseBusinessInboundSelection(copy),{supplierId:'1',currency:'TRY',accountId:'11'});assert.equal(parseBusinessInboundSelection(null),null);assert.deepEqual(parseBusinessInboundSelection(copy,{supplierId:'1',currency:'USD'}),{supplierId:'1',currency:'USD',accountId:'12'});
 for(const headers of [{supplierId:'1'},{currency:'TRY'},{supplierId:'01',currency:'TRY'},{supplierId:'1',currency:'LL'},{supplierId:'2',currency:'TRY'},{supplierId:['1'],currency:'TRY'}])assert.throws(()=>parseBusinessInboundSelection(copy,headers));
 assert.throws(()=>parseBusinessInboundSelection({target:{database:'MELISA_ERP_CRM_SHARED_TEST_20261009_01'}},{supplierId:'1',currency:'TRY'}),{statusCode:403});
});
test('default skips the first source-known TRY account without goods, while explicit empty accounts retain a clear409 without account auto-pairing',async()=>{
 const expanded={...copy,suppliers:[{id:'10152',currency:'TRY',accountId:'410'},{id:'10152',currency:'USD',accountId:'411'},...copy.suppliers]};
 assert.deepEqual(parseBusinessInboundSelection(expanded),{supplierId:'1',currency:'TRY',accountId:'11'});
 for(const currency of ['TRY','USD'])assert.throws(()=>parseBusinessInboundSelection(expanded,{supplierId:'10152',currency}),{code:'BUSINESS_SUPPLIER_PRODUCTS_NOT_VERIFIED',statusCode:409});
 assert.equal(expanded.suppliers.length,4);assert.throws(()=>parseBusinessInboundSelection({...expanded,products:[]}),{code:'BUSINESS_SUPPLIER_PRODUCTS_NOT_VERIFIED',statusCode:409});
 let selected;await createBusinessInboundSelectionMiddleware({getContext:async()=>expanded})({get:()=>undefined},{},error=>{if(error)throw error;selected=getBusinessInboundSelection(expanded);});assert.equal(selected.supplierId,'1');
 let rejection;await createBusinessInboundSelectionMiddleware({getContext:async()=>expanded})({get:key=>key.endsWith('supplier-id')?'10152':'TRY'},{},error=>{rejection=error;});assert.equal(rejection.code,'BUSINESS_SUPPLIER_PRODUCTS_NOT_VERIFIED');assert.equal(rejection.statusCode,409);
});
test('concurrent selection scopes preserve account identity without bleeding to another transaction',async()=>{
 const run=currency=>withBusinessInboundSelection(copy,parseBusinessInboundSelection(copy,{supplierId:'1',currency}),async()=>{await Promise.resolve();assert.equal(getBusinessInboundSelection(copy).currency,currency);assert.throws(()=>getBusinessInboundSelection({...copy}),{statusCode:403});});
 await Promise.all([run('USD'),run('TRY')]);assert.equal(getBusinessInboundSelection(copy),null);
 let seen;await createBusinessInboundSelectionMiddleware({getContext:async()=>copy})({get:key=>key.endsWith('supplier-id')?'1':'USD'},{},e=>{if(e)throw e;seen=getBusinessInboundSelection(copy);});assert.equal(seen.accountId,'12');
});
