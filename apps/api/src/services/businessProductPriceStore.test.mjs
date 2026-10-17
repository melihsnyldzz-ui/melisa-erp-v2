import test from 'node:test';
import assert from 'node:assert/strict';
import {createBusinessProductPriceStore,businessPriceProcedureRow} from './businessProductPriceStore.mjs';
import {businessProductPriceFixture} from './businessProductPrice.test-fixture.mjs';
import {getRegisteredBusinessProductPriceRevision} from '../../../../scripts/canonical/shared-business-product-price-bootstrap.mjs';
import {privateBusinessPriceLeafSources,earnedBusinessProductPriceNativeFixture,modeledBusinessProductPriceStore} from './businessProductPriceNative.test-fixture.mjs';
import {createBusinessProductPriceService} from './businessProductPriceService.mjs';
const leafPath=process.env.ERP04_V11_LEAF_INPUT,leafSHA=process.env.ERP04_V11_LEAF_SHA256;
const earned=()=>earnedBusinessProductPriceNativeFixture(privateBusinessPriceLeafSources(leafPath,leafSHA));

test('unregistered runtime fields and admin JWT cannot mint a price writer or start SQL',async()=>{
 const {copy,actor}=businessProductPriceFixture(),events=[];
 assert.equal(getRegisteredBusinessProductPriceRevision(copy),null);
 const sql={Transaction:class{constructor(){events.push('transaction');}},Request:class{constructor(){events.push('request');}},ISOLATION_LEVEL:{SERIALIZABLE:4}};
 const store=createBusinessProductPriceStore({getRuntime:async()=>({copyContext:copy,pool:{},sql,canEdit:true,registered:true,businessProductPriceRevision:{canEdit:true}})});
 await assert.rejects(()=>store.withProductPrice({productId:'444',actor:{...actor,isAdmin:true},write:true},()=>{events.push('callback');}),{statusCode:503});
 assert.deepEqual(events,[]);
});

test('foreign cloned profile and noncanonical product/operation inputs fail before SQL',async()=>{
 const {copy,actor}=businessProductPriceFixture();let starts=0;
 const runtime={copyContext:structuredClone(copy),pool:{},sql:{Transaction:class{constructor(){starts++;}}}};
 const store=createBusinessProductPriceStore({getRuntime:async()=>runtime});
 await assert.rejects(()=>store.withProductPrice({productId:'444',actor},()=>{}),{code:'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED'});
 runtime.copyContext=copy;
 for(const options of [{productId:'0444',actor},{productId:'9223372036854775808',actor},{productId:444,actor},{productId:'444',actor,write:'true'}])await assert.rejects(()=>store.withProductPrice(options,()=>{}),{statusCode:503});
 assert.equal(starts,0);
});

test('procedure result locates one exact context set and rejects duplicate, unknown proof or extra columns',()=>{
 const row={context_json:'{}',actor_json:'{}',replayed:false,sessionId:91,transactionId:'92',readerDefinitionHash:'A'.repeat(64)};
 assert.equal(businessPriceProcedureRow({recordsets:[[row]]}),row);
 assert.equal(businessPriceProcedureRow({recordsets:[[],[row],[]],recordset:[]}),row);
 for(const result of [{recordsets:[]},{recordsets:[[row],[row]]},{recordsets:[[row,row]]},{recordsets:[[{proof_json:'unverified'}],[row]]},{recordsets:[[{...row,canEdit:true}]]},{recordset:[row]}])assert.throws(()=>businessPriceProcedureRow(result),{statusCode:503});
});
test('earned synthetic store keeps one owner transaction, exact UUID replay before later CAS and escaped update expires',{skip:!leafPath||!leafSHA},async()=>{
 const f=await earned(),h=modeledBusinessProductPriceStore(f),service=createBusinessProductPriceService({getStore:async()=>h.store});
 assert.equal(f.metadataCanEditBeforeConsumer,false);assert.equal(f.metadata.canEdit,true);
 const card=await service.context('444',h.actor),body={requestId:'4c758081-465d-445f-b024-aad40355f9d0',expectedRevision:card.revision,priceId:'100',tuple:card.prices[0].tuple,priceExact:null,reason:'Bilinmeyen manuel fiyat'};
 const first=await service.update('444',body,h.actor);assert.equal(first.replayed,false);assert.equal(first.prices[0].priceExact,null);
 const second=await service.update('444',{...body,requestId:'4c758081-465d-445f-b024-aad40355f9d1',expectedRevision:first.revision,priceExact:'0.00000000'},h.actor);assert.equal(second.prices[0].priceExact,'0.00000000');
 const replay=await service.update('444',body,h.actor);assert.equal(replay.replayed,true);assert.equal(replay.revision,first.revision);assert.equal(replay.prices[0].priceExact,null);assert.equal(h.journal.size,2);
 await assert.rejects(()=>service.update('444',{...body,priceExact:'9.00000000'},h.actor),{code:'BUSINESS_PRICE_REQUEST_CONFLICT',statusCode:409});assert.equal(h.events.at(-1),'rollback');
 let escaped;await h.store.withProductPrice({productId:'444',actor:h.actor},session=>{escaped=session.update;});await assert.rejects(()=>escaped(JSON.stringify(body)),{statusCode:503});
 assert.equal(f.copy.products[0].quotes[0].priceExact8,'3.00000000');assert.equal(h.events.filter(e=>e==='begin').length,h.events.filter(e=>e==='commit'||e==='rollback').length);
});
test('earned synthetic store closes wrong identity, revoked native permission and consumer drift without setter',{skip:!leafPath||!leafSHA},async()=>{
 for(const kind of ['identity','permission','consumer']){
  const f=await earned(),h=modeledBusinessProductPriceStore(f,{mutate:(phase,value,sql)=>{
   if(kind==='identity'&&phase==='query'&&sql===BUSINESS_PRICE_TRANSACTION_SQL)value.recordset[0].db='FOREIGN';
   if(kind==='permission'&&phase==='row'){const a=JSON.parse(value.actor_json);a.permissions=a.permissions.filter(p=>p!=='product.price.edit');value.actor_json=JSON.stringify(a);}
   if(kind==='consumer'&&phase==='query'&&sql===f.consumer.bundle.proofSQL)value.recordsets[0][0].actualHash='F'.repeat(64);
  }});
  const service=createBusinessProductPriceService({getStore:async()=>h.store});
  await assert.rejects(()=>service.update('444',{requestId:'4c758081-465d-445f-b024-aad40355f9d0',expectedRevision:'A'.repeat(64),priceId:'100',tuple:{type:'sale',unitId:null,tier:0,currency:'TRY'},priceExact:'4.00000000',reason:'Yeni manuel fiyat'},h.actor));
  assert.equal(h.events.at(-1),'rollback');assert.equal(h.journal.size,0);assert(!h.events.includes('dbo.usp_business_product_price_set_v1'));
 }
});
