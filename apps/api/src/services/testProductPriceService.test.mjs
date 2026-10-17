import test from 'node:test';
import assert from 'node:assert/strict';
import {parseProductPrice, productPriceContext} from './testProductPriceModel.mjs';
import {createTestProductPriceService} from './testProductPriceService.mjs';
const revision='A'.repeat(64),later='B'.repeat(64);
const actor={id:16,permissions:['product.view','purchase.view','product.price.edit']};
const tuple={type:'purchase',unitId:null,tier:0,currency:'USD'};
const context=()=>({product:{id:'301986',stockCode:'TEST-DAILY-PURCHASE',name:'TEST günlük alış ürünü',unit:'ADET',synthetic:true},
  capabilities:{currencies:['TRY','USD','EUR'],units:[{id:'7',label:'ADET',factorExact8:'1.00000000',isMainUnit:true}],purchaseTier:0,saleTiers:[1,2,3,4,5,6],canEdit:true,supportedTuples:[tuple,{type:'sale',unitId:'7',tier:2,currency:'TRY'}]},revision,prices:[],recentChanges:[]});
const body=()=>({requestId:'4c758081-465d-445f-b024-aad40355f9d0',expectedRevision:revision,priceId:null,tuple,priceExact:'1.23456789',reason:'Deneme fiyatı'});
test('canonical native28,8 rejects number/coercion/negative/extras; unknown and actual zero are distinct',()=>{
  for(const priceExact of [null,'0.00000000','99999999999999999999.99999999'])assert.equal(parseProductPrice({...body(),priceExact}).priceExact,priceExact);
  for(const priceExact of [0,'0','-1.00000000','01.00000000','100000000000000000000.00000000','1.123456789',NaN])assert.throws(()=>parseProductPrice({...body(),priceExact}),{code:'TEST_PRODUCT_PRICE_INVALID'});
  assert.throws(()=>parseProductPrice({...body(),averageCost:10}),{code:'TEST_PRODUCT_PRICE_INVALID'});
  assert.throws(()=>parseProductPrice({...body(),tuple:{...tuple,unitId:'7'}}),{code:'TEST_PRODUCT_PRICE_INVALID'});
  assert.throws(()=>parseProductPrice({...body(),priceId:'9223372036854775808'}),{code:'TEST_PRODUCT_PRICE_INVALID'});
});
test('authorized reader14 can read; price.edit does not grant whole product.edit',async()=>{
  let readActor;
  const service=createTestProductPriceService({getStore:async()=>({readTestProductPrices:async(id,actorId)=>{readActor=actorId;return context();}})});
  const data=await service.context('301986',{id:14,permissions:['product.view','purchase.view']});
  assert.equal(readActor,'14');assert.equal(data.capabilities.canEdit,false);
  await assert.rejects(()=>service.update('301986',body(),{id:16,permissions:['product.view','purchase.view','product.edit']}),{statusCode:403});
  await assert.rejects(()=>service.context('301987',actor),{code:'TEST_PRODUCT_PRICE_SCOPE'});
});
test('supported tuples come from trusted SQL capabilities, and unsupported mutation never reaches writer',async()=>{
  let writes=0;
  const service=createTestProductPriceService({getStore:async()=>({readTestProductPrices:async()=>context(),setTestProductPrice:async()=>{writes++;throw Error('must not execute');}})});
  await assert.rejects(()=>service.update('301986',{...body(),tuple:{type:'sale',unitId:'7',tier:3,currency:'TRY'}},actor),{code:'TEST_PRODUCT_PRICE_UNSUPPORTED'});
  assert.equal(writes,0);
});
test('historical writer response replays after current revision changes; service does not preempt CAS',async()=>{
  let payload;
  const historical=context();
  const service=createTestProductPriceService({getStore:async()=>({readTestProductPrices:async()=>({...context(),revision:later}),
    setTestProductPrice:async(id,actorId,json)=>{assert.equal(id,'301986');assert.equal(actorId,'16');payload=JSON.parse(json);return {...historical,replayed:true};}})});
  const result=await service.update('301986',body(),actor);
  assert.equal(result.replayed,true);assert.equal(result.revision,revision);assert.equal(payload.expectedRevision,revision);assert.equal(payload.productId,'301986');
});
test('unknown native DTO state and duplicate tuples fail closed; DB canEdit false denies mutation',async()=>{
  assert.throws(()=>productPriceContext({...context(),revision:'broken'}),{statusCode:503});
  const service=createTestProductPriceService({getStore:async()=>({readTestProductPrices:async()=>({...context(),capabilities:{...context().capabilities,canEdit:false}})})});
  await assert.rejects(()=>service.update('301986',body(),actor),{statusCode:403});
});
