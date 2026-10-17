import test from 'node:test';
import assert from 'node:assert/strict';
import {businessProductPriceFixture} from './businessProductPrice.test-fixture.mjs';
import {validateBusinessProductPriceStartup,configureBusinessProductPriceStartup} from './businessProductPriceStartup.mjs';
import {isBusinessProductPriceWriteAllowed} from './businessProductPriceRoutesPolicy.mjs';
test('absent price descriptors preserve old startup and cannot broaden price route',async()=>{
 const {copy}=businessProductPriceFixture();assert.equal(validateBusinessProductPriceStartup({},copy),null);
 assert.equal(await configureBusinessProductPriceStartup({},copy,null,null),null);
 for(const method of ['GET','POST','PATCH'])assert.equal(isBusinessProductPriceWriteAllowed(method,'/api/products/444/current-prices',copy),false);
});
test('startup rejects partial, forged-copy and broad activation descriptors before querying',()=>{
 const {copy}=businessProductPriceFixture();
 for(const value of [true,[],{},null,{metadata:{version:12},consumer:{version:13}},{metadata:{},consumer:{},canEdit:true}])assert.throws(()=>validateBusinessProductPriceStartup({businessSelectedSaleStartup:{},businessProductPriceRevisions:value},copy));
});
