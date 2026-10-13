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
