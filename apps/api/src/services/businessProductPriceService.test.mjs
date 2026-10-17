import test from 'node:test';
import assert from 'node:assert/strict';
import {createBusinessProductPriceService} from './businessProductPriceService.mjs';
import {businessProductPriceFixture} from './businessProductPrice.test-fixture.mjs';

function service(f, {canEdit=true, raw=f.raw, actual=f.actual, result, fail}={}) {
  const calls=[];
  const instance=createBusinessProductPriceService({getStore:async()=>({
    async withProductPrice(input, fn) {
      calls.push({transaction:input});
      return fn({copy:f.copy,actualActor:actual,canEdit,context:raw,async update(payloadJson) {
        calls.push({payload:JSON.parse(payloadJson)});
        if(fail)throw fail;
        return result;
      }});
    },
  })});
  return {instance,calls};
}

test('read never invokes price writer and missing registered edit capability stays false',async()=>{
  const f=businessProductPriceFixture(),s=service(f,{canEdit:false});
  const result=await s.instance.context('444',f.actor);
  assert.equal(result.canEdit,false);assert.equal(s.calls.length,1);
  assert.equal(s.calls[0].transaction.write,false);
  await assert.rejects(s.instance.update('444',f.body,f.actor),{statusCode:403});
  assert.equal(s.calls.filter(c=>c.payload).length,0);
});

test('historical request reaches native replay even when current revision changed',async()=>{
  const f=businessProductPriceFixture(),current=structuredClone(f.raw);
  current.revision='B'.repeat(64);
  current.prices[0].currentVersionId='2';current.prices[0].priceExact='4.00000000';
  const replay=structuredClone(f.raw);replay.revision='C'.repeat(64);
  replay.prices[0].currentVersionId='1';replay.prices[0].priceExact=f.body.priceExact;
  const s=service(f,{raw:current,result:{replayed:true,context:replay}});
  const result=await s.instance.update('444',f.body,f.actor);
  assert.equal(result.replayed,true);assert.equal(result.prices[0].priceExact,f.body.priceExact);
  assert.equal(s.calls[1].payload.expectedRevision,f.body.expectedRevision);
  assert.deepEqual(Object.keys(s.calls[1].payload).sort(),Object.keys(f.body).sort());
  assert.equal(current.prices[0].source.priceExact8,'3.00000000');
});

test('fresh actor denial and native context edit denial cannot call writer',async()=>{
  const f=businessProductPriceFixture();
  for(const override of [
    {actual:{...f.actual,active:false}},
    {actual:{...f.actual,permissions:['product.view','purchase.view']}},
    {raw:{...f.raw,canEdit:false}},
  ]){
    const s=service(f,override);
    await assert.rejects(s.instance.update('444',f.body,f.actor),{statusCode:403});
    assert.equal(s.calls.filter(c=>c.payload).length,0);
  }
});

test('native CAS/body conflict remains conflict and malformed success is rejected',async()=>{
  const f=businessProductPriceFixture();
  for(const code of ['BUSINESS_PRICE_STALE','BUSINESS_PRICE_REQUEST_CONFLICT']){
    const fail=Object.assign(new Error(code),{code,statusCode:409});
    const s=service(f,{fail});
    await assert.rejects(s.instance.update('444',f.body,f.actor),error=>error===fail);
  }
  for(const result of [{replayed:'false',context:f.raw},{replayed:false,context:{...f.raw,productId:'445'}}]){
    const s=service(f,{result});
    await assert.rejects(s.instance.update('444',f.body,f.actor),{statusCode:503});
  }
});
