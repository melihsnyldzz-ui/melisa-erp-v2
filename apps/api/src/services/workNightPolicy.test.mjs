import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyWebScopeMiddleware,isDailyWebCustomerScope,isDailyWebCorePath,resolveDailyWebPolicy} from './dailyWebPolicy.mjs';

test('night daily customer scope opens only exact server routes and enabled policy',()=>{
 const enabled=dailyWebScopeMiddleware(resolveDailyWebPolicy({dailyWebEnabled:true}));
 for(const path of ['/work-sales/preview','/work-sales/drafts','/work-sales/drafts/42/finalize','/work-sales/drafts/42/cancel']){
  assert.equal(isDailyWebCorePath(path),true);enabled({path,method:'POST'},null,()=>assert.equal(isDailyWebCustomerScope(),true));assert.equal(isDailyWebCustomerScope(),false);
 }
 for(const path of ['/work-sales/anything','/work-sales/drafts/0/finalize','/work-sales/drafts/42/edit','/work-sales/drafts/42/finalize/extra','/work-collections']){
  assert.equal(isDailyWebCorePath(path),false);enabled({path,method:'POST'},null,()=>assert.equal(isDailyWebCustomerScope(),false));
 }
 dailyWebScopeMiddleware(resolveDailyWebPolicy())({path:'/work-sales/drafts',method:'POST'},null,()=>assert.equal(isDailyWebCustomerScope(),false));
});
