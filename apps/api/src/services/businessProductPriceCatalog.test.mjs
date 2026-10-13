import test from 'node:test';
import assert from 'node:assert/strict';
import {businessProductPriceFixture} from './businessProductPrice.test-fixture.mjs';
import {projectBusinessCatalogPrices,readBusinessCatalogPrices} from './businessProductPriceCatalog.mjs';
function fixture(value='1.23456789'){
 const f=businessProductPriceFixture(raw=>{raw.products[0].quotes[0].unitSourceId=7;});
 f.raw.prices[0].tuple.tier=1;
 const price={...f.raw.prices[0],priceExact:value,currentVersionId:'1',manual:{requestId:f.body.requestId,actorId:'16',payloadHash:'A'.repeat(64),beforePriceExact:'3.00000000',reason:'Satış fiyatı güncelleme',createdAt:'2026-10-13T09:00:00Z',versionProofHash:'B'.repeat(64)}};
 // sourceKey below is a synthetic stock-table lineage identifier, not a credential.
 const rows=[{id:'444',stockCode:'OFFLINE-444',hold:{blocked:false},provenance:{kind:'accepted-opening',verified:true,sourceKey:'VEGA2026/F0102/TBLSTOKLAR/444'},salePrices:[{id:'100',type:'sale',unitSourceId:'7',tier:1,currency:'TRY',isMainUnit:true,priceExact:'3.00000000'}]}]; // gitleaks:allow
 const raw={schemaVersion:'melisa-business-product-price-catalog.v1',copyId:f.copy.copyId,sealHash:f.copy.sealHash,operationOrigin:f.copy.operationOrigin,products:[{productId:'444',overlayEligible:true,prices:[price]}]};
 return {...f,rows,raw};
}
test('catalog current price overlays only exact quote tuple and preserves explicit NULL and zero',()=>{
 for(const amount of ['1.23456789','0.00000000',null]){
  const f=fixture(amount),out=projectBusinessCatalogPrices(f.copy,f.rows,f.raw);
  assert.equal(out[0].salePrices[0].priceExact,amount);assert.equal(out[0].salePrices[0].pricing.sourcePriceExact,'3.00000000');
  assert.equal(f.rows[0].salePrices[0].priceExact,'3.00000000');assert.equal(f.copy.products[0].quotes[0].priceExact8,'3.00000000');
 }
});
test('catalog source witness, identity, hold, tuple and page substitution fail closed',()=>{
 for(const mutate of [f=>f.raw.products[0].prices[0].source.nativeRowHash='C'.repeat(64),f=>f.rows[0].stockCode='OTHER',f=>f.rows[0].hold.blocked=true,f=>f.raw.products[0].prices[0].tuple.currency='USD',f=>f.rows[0].salePrices[0].tier=2,f=>f.raw.products[0].productId='445',f=>f.raw.products.push(f.raw.products[0]),f=>f.raw.products[0].prices[0].manual.actorId='15']){
  const f=fixture();mutate(f);assert.throws(()=>projectBusinessCatalogPrices(f.copy,f.rows,f.raw));
 }
});
test('products outside operation profile stay unchanged and unregistered runtime starts no SQL',async()=>{
 const f=fixture(),outside={...f.rows[0],id:'445'};
 const raw={...f.raw,products:[{productId:'445',overlayEligible:false,prices:[]}]};
 assert.equal(projectBusinessCatalogPrices(f.copy,[outside],raw)[0],outside);
 assert.equal(await readBusinessCatalogPrices({copy:f.copy,rows:f.rows,sql:null,transaction:null,actorId:'16'}),f.rows);
 raw.products[0].overlayEligible=true;assert.throws(()=>projectBusinessCatalogPrices(f.copy,[outside],raw));
});

import {earnedBusinessProductPriceNativeFixture,privateBusinessPriceLeafSources} from './businessProductPriceNative.test-fixture.mjs';
import {BUSINESS_PRICE_GET} from '../../../../scripts/canonical/shared-business-product-price-revision-contract.mjs';
const leafPath=process.env.ERP04_V11_LEAF_INPUT,leafSHA=process.env.ERP04_V11_LEAF_SHA256;
async function earnedCatalog(){
 const f=await earnedBusinessProductPriceNativeFixture(privateBusinessPriceLeafSources(leafPath,leafSHA)),p=f.copy.products[0];
 const qs=p.quotes.filter(q=>q.type==='sale'&&q.mainUnit&&q.verified);
 const prices=qs.map(q=>({priceId:q.quoteId,tuple:{type:'sale',unitId:q.unitSourceId===null?null:String(q.unitSourceId),tier:0,currency:q.currency},priceExact:q.priceExact8,currentVersionId:null,source:{quoteId:q.quoteId,priceExact8:q.priceExact8,nativeRowHash:q.nativeRowHash.toUpperCase(),bindingHash:q.bindingHash.toUpperCase(),sourceKey:p.sourceKey,sourceUnitId:q.unitSourceId===null?null:String(q.unitSourceId),versionRunId:f.copy.currentProductSourceVersionRunId},manual:null}));
 const eligible={id:p.id,stockCode:p.stockCode,hold:{blocked:false},provenance:{kind:'accepted-opening',verified:true},salePrices:prices.map(x=>({id:x.priceId,...x.tuple,unitSourceId:x.tuple.unitId,isMainUnit:true,priceExact:x.priceExact}))};
 const raw={schemaVersion:'melisa-business-product-price-catalog.v1',copyId:f.copy.copyId,sealHash:f.copy.sealHash,operationOrigin:f.copy.operationOrigin,products:[{productId:p.id,overlayEligible:true,prices}]};
 const transaction={},calls=[],pin=f.metadata.revision.modules.find(m=>m.name===BUSINESS_PRICE_GET).afterHash;
 let mutate=()=>{};
 class Request{constructor(parent){this.parent=parent;this.params={};}input(k,t,v){this.params[k]=v;return this;}async query(){calls.push('frame');const recordset=[{...f.frame,readerDefinitionHash:pin}];mutate('frame',recordset);return{recordset};}async execute(name){assert.equal(name,BUSINESS_PRICE_GET);calls.push({...this.params});const row={catalog_json:JSON.stringify(raw),actor_json:JSON.stringify({id:'16',role:'isolated_test_ilker',active:true,permissions:['product.view','sales.view']}),sessionId:f.frame.sessionId,transactionId:f.frame.transactionId,readerDefinitionHash:pin};mutate('result',row);return{recordsets:[[row]]};}}
 const sql={Request,UniqueIdentifier:0,BigInt:0,NVarChar:()=>0,MAX:0};
 return{f,eligible,raw,calls,options:{copy:f.copy,sql,transaction,actorId:'16'},mutate:fn=>{mutate=fn;}};
}
test('earned catalog sends only copy intersection once and preserves all 50 row positions',{skip:!leafPath||!leafSHA},async()=>{
 const h=await earnedCatalog(),rows=Array.from({length:50},(_,i)=>({id:String(10000+i),salePrices:[],marker:i}));rows[27]=h.eligible;
 const before=JSON.stringify(rows),out=await readBusinessCatalogPrices({...h.options,rows});
 assert.equal(h.calls.length,3);assert.deepEqual(JSON.parse(h.calls[1].catalog_ids_json),[h.eligible.id]);assert.equal(h.calls[1].product_id,null);
 assert.deepEqual(out.map(r=>r.id),rows.map(r=>r.id));for(let i=0;i<50;i++)if(i!==27)assert.strictEqual(out[i],rows[i]);
 assert.deepEqual(out[27],h.eligible);assert.equal(JSON.stringify(rows),before);
 const noCopy=rows.filter(r=>r.id!==h.eligible.id),callCount=h.calls.length;assert.strictEqual(await readBusinessCatalogPrices({...h.options,rows:noCopy}),noCopy);assert.equal(h.calls.length,callCount);
});
test('earned narrowed catalog retains native actor/frame/hash/substitution and subset guard failures',{skip:!leafPath||!leafSHA},async()=>{
 for(const change of [(kind,r)=>{if(kind==='frame')r[0].readerDefinitionHash='0'.repeat(64);},(kind,r)=>{if(kind==='result')r.actor_json=JSON.stringify({id:'15',role:'isolated_test_sales',active:true,permissions:['product.view','sales.view']});},(kind,r)=>{if(kind==='result')r.transactionId='999';},(kind,r)=>{if(kind==='result'){const raw=JSON.parse(r.catalog_json);raw.products[0].productId='999';r.catalog_json=JSON.stringify(raw);}}]){
  const h=await earnedCatalog();h.mutate(change);await assert.rejects(readBusinessCatalogPrices({...h.options,rows:[{id:'10000',salePrices:[]},h.eligible]}));
 }
 const h=await earnedCatalog();await assert.rejects(readBusinessCatalogPrices({...h.options,rows:[h.eligible,h.eligible]}));assert.equal(h.calls.length,0);
});
