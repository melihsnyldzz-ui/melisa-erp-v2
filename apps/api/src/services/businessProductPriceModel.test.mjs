import test from 'node:test';
import assert from 'node:assert/strict';
import {businessProductPriceFixture} from './businessProductPrice.test-fixture.mjs';
import {parseBusinessProductPrice,businessProductPriceContext,assertBusinessProductPriceActor,assertSupportedBusinessProductPrice} from './businessProductPriceModel.mjs';
const revision='A'.repeat(64),requestId='4c758081-465d-445f-b024-aad40355f9d0';
const tuple={type:'sale',unitId:null,tier:0,currency:'TRY'};
const body=()=>({requestId,expectedRevision:revision,priceId:'100',tuple:{...tuple},priceExact:'1.23456789',reason:'Yeni satış fiyatı'});
const fixture=businessProductPriceFixture;
test('strict six-key canonical request preserves native28/8 maximum, unknown and actual zero without floats',()=>{
 const {copy}=fixture();
 for(const priceExact of [null,'0.00000000','99999999999999999999.99999999']){
  const input=parseBusinessProductPrice(copy,'444',{...body(),priceExact});assert.equal(input.priceExact,priceExact);
  assert.deepEqual(JSON.parse(input.payloadJson),{...body(),priceExact});assert.equal(input.payloadJson,parseBusinessProductPrice(copy,'444',{...body(),priceExact}).payloadJson);
 }
 for(const change of [{priceExact:0},{priceExact:'0'},{priceExact:'-1.00000000'},{priceExact:'01.00000000'},{priceExact:'100000000000000000000.00000000'},{priceExact:'1.000000001'},{priceExact:NaN},{priceId:null},{priceId:'999'},{reason:'xx'},{requestId:requestId.toUpperCase()},{requestId:requestId.replace('-445f-','-145f-')},{copyId:copy.copyId},{tuple:{...tuple,extra:1}},{tuple:{...tuple,type:'purchase'}},{tuple:{...tuple,unitId:'7'}}])assert.throws(()=>parseBusinessProductPrice(copy,'444',{...body(),...change}));
 assert.throws(()=>parseBusinessProductPrice(copy,'301986',body()));
 assert.throws(()=>parseBusinessProductPrice(structuredClone(copy),'444',body()));
});
test('native read DTO binds copy and every immutable source witness; tuples and ids cannot duplicate',()=>{
 const {copy,raw}=fixture(),before=JSON.stringify(copy);
 const dto=businessProductPriceContext(copy,raw,{canEdit:true});assert.deepEqual(dto,raw);assert.equal(businessProductPriceContext(copy,raw).canEdit,false);
 const edits=[r=>r.copyId='other',r=>r.sealHash='F'.repeat(64),r=>r.operationOrigin='LIVE',r=>r.revision=null,r=>r.canEdit=1,r=>r.prices[0].source.quoteId='101',r=>r.prices[0].source.priceExact8='0.00000000',r=>r.prices[0].source.nativeRowHash='E'.repeat(64),r=>r.prices[0].source.bindingHash='F'.repeat(64),r=>r.prices[0].source.sourceKey='foreign',r=>r.prices[0].source.versionRunId='other',r=>r.prices[0].source.sourceUnitId='7',r=>r.prices[0].tuple.currency='USD',r=>r.prices[0].tuple.tier=7,r=>r.prices[0].priceExact=null,r=>r.prices.push(structuredClone(r.prices[0]))];
 for(const edit of edits){const changed=structuredClone(raw);edit(changed);assert.throws(()=>businessProductPriceContext(copy,changed));}
 assert.equal(JSON.stringify(copy),before);
});
test('manual versions retain explicit unknown versus zero; read capability can never override native false',()=>{
 const {copy,raw}=fixture();
 for(const priceExact of [null,'0.00000000']){
  const changed=structuredClone(raw);changed.prices[0].currentVersionId='9';changed.prices[0].priceExact=priceExact;
  changed.recentChanges=[{versionId:'9',requestId,actorId:'16',priceId:'100',tuple:{...tuple},beforePriceExact:raw.prices[0].priceExact,priceExact,reason:'Yeni satış fiyatı',createdAt:'2026-10-13T10:00:00.000Z'}];
  assert.equal(businessProductPriceContext(copy,changed,{canEdit:true}).prices[0].priceExact,priceExact);
  for(const edit of [r=>r.recentChanges[0].actorId='15',r=>r.recentChanges[0].priceId='101',r=>r.recentChanges[0].tuple.tier=2,r=>r.recentChanges[0].beforePriceExact=0,r=>r.recentChanges.push(structuredClone(r.recentChanges[0]))]){const bad=structuredClone(changed);edit(bad);assert.throws(()=>businessProductPriceContext(copy,bad));}
 }
 assert.equal(businessProductPriceContext(copy,{...raw,canEdit:false},{canEdit:true}).canEdit,false);
});
test('actor16 write requires current native role/permissions and external capability; admin and actor15 grant nothing',()=>{
 const {copy,actor,actual}=fixture();assertBusinessProductPriceActor(copy,actor,actual);assertBusinessProductPriceActor(copy,actor,actual,{write:true,canEdit:true});
 for(const [a,n,o]of [[actor,actual,{write:true}],[actor,{...actual,active:false},{write:true,canEdit:true}],[actor,{...actual,role:'admin'},{write:true,canEdit:true}],[{...actor,permissions:['product.view','product.price.edit']},actual,{write:true,canEdit:true}],[actor,{...actual,permissions:['product.view','purchase.view']},{write:true,canEdit:true}],[{id:'15',permissions:actor.permissions},{id:'15',role:copy.actors.find(a=>a.id==='15').role,active:true,permissions:actor.permissions},{write:true,canEdit:true}],[{...actor,id:'99',isAdmin:true},{...actual,id:'99',role:'admin'},{write:true,canEdit:true}]])assert.throws(()=>assertBusinessProductPriceActor(copy,a,n,o),{statusCode:403});
});
test('supported tuple check permits historical replay to owner before CAS but never a newly invented tier',()=>{
 const {copy,raw}=fixture(),context=businessProductPriceContext(copy,{...raw,revision:'B'.repeat(64)}),input=parseBusinessProductPrice(copy,'444',body());
 assertSupportedBusinessProductPrice(input,context);assert.equal(input.expectedRevision,revision);
 assert.throws(()=>assertSupportedBusinessProductPrice({...input,tuple:{...tuple,tier:1}},context),{code:'BUSINESS_PRODUCT_PRICE_UNSUPPORTED'});
});
test('missing source unit is unknown and cannot become null; an explicit native unit keeps its own tuple',()=>{
 const missing=businessProductPriceFixture(input=>{delete input.products[0].quotes[0].unitSourceId;});
 assert.throws(()=>parseBusinessProductPrice(missing.copy,'444',body()),{code:'BUSINESS_PRODUCT_PRICE_SOURCE'});
 assert.throws(()=>businessProductPriceContext(missing.copy,missing.raw),{statusCode:503});
 const explicit=businessProductPriceFixture(input=>{input.products[0].quotes[0].unitSourceId='7';});
 const dto=businessProductPriceContext(explicit.copy,explicit.raw),parsed=parseBusinessProductPrice(explicit.copy,'444',explicit.body);
 assert.equal(dto.prices[0].tuple.unitId,'7');assertSupportedBusinessProductPrice(parsed,dto);
 assert.throws(()=>parseBusinessProductPrice(explicit.copy,'444',{...explicit.body,tuple:{...explicit.body.tuple,unitId:null}}),{code:'BUSINESS_PRODUCT_PRICE_UNSUPPORTED'});
});
