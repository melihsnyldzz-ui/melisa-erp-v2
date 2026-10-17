import test from 'node:test';
import assert from 'node:assert/strict';
import {BUSINESS_CATALOG_PRICE_EXCLUSION_SQL,isBusinessCatalogPriceScope,validateBusinessCatalogPriceExclusions,excludeBusinessCatalogPriceCandidates} from './businessCatalogPriceExclusions.mjs';
const version={runId:'PRODUCT-00000000-0000-4000-8000-000000000001',sourceHash:'a'.repeat(64),planHash:'b'.repeat(64),bindingsHash:'c'.repeat(64),sourceAsOf:'2026-10-09',productCount:18000,priceCount:65000};
const copy={scopeKind:'VERIFIED_BUSINESS_TEST',target:{database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'},currentProductSourceVersionRunId:version.runId};
const witness=()=>[[{...version,sealed:true}],['36961','39169','40331','301991'].flatMap((productId,i)=>[0,1,2].map(j=>({productId,quoteId:i===3&&j===0?'278235':String(10+i*3+j),priceExact:i===3&&j===0?'1.00000000':'0.00000000',nativeTupleCount:i===3&&j===0?2:1,sourceWitnessVerified:true}))),[{sourceActiveCatalog:12000}]];
test('only exact registered DB02 source run activates four independently verified price exclusions; old scopes remain untouched',()=>{
 assert.equal(isBusinessCatalogPriceScope(copy,version),true);
 for(const changed of [null,{...copy,scopeKind:'CONTROLLED_TEST'},{...copy,target:{database:'LIVE'}},{...copy,target:{database:'MELISA_ERP_CRM_SHARED_TEST_20261009_01'}},{...copy,currentProductSourceVersionRunId:'another-run'}])assert.equal(isBusinessCatalogPriceScope(changed,version),false);
 const proof=validateBusinessCatalogPriceExclusions(witness(),version);assert.equal(proof.availableActiveCatalog,11996);assert.equal(proof.excludedProducts.at(-1).reason,'DUPLICATE_SOURCE_SALE_PRICE');
 const candidates=[['8',1],['36961',2],['39169',3],['40331',4],['301991',5],['9',6]];
 assert.deepEqual(JSON.parse(excludeBusinessCatalogPriceCandidates(JSON.stringify(candidates))),[['8',1],['9',6]]);
});
test('zero/duplicate source drift, new positive quote, missing/NULL witness or altered source seal stops the whole read',()=>{
 const mutations=[r=>r[0].push({...r[0][0]}),r=>r[0][0].sealed=false,...Object.keys(version).map(k=>r=>r[0][0][k]='changed'),r=>r[1][0].sourceWitnessVerified=null,r=>r[1][0].sourceWitnessVerified=false,r=>r[1][0].priceExact='1.00000000',r=>r[1][0].priceExact=null,r=>r[1][9].nativeTupleCount=1,r=>r[1][9].nativeTupleCount=3,r=>r[1][9].quoteId='different',r=>r[1].pop(),r=>r[1].push({...r[1][0]}),r=>r[1][0].productId='unknown',r=>r[2][0].sourceActiveCatalog=3,r=>r[2][0].sourceActiveCatalog='9007199254740992'];
 for(const mutate of mutations){const rows=witness();mutate(rows);assert.throws(()=>validateBusinessCatalogPriceExclusions(rows,version),{code:'CATALOG_UNAVAILABLE'});}
});
test('proof query remains read-only and verifies full bindings, stage/native hashes, held/source links and exact NULL-aware tuple identity',()=>{
 assert.doesNotMatch(BUSINESS_CATALOG_PRICE_EXCLUSION_SQL,/\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|GRANT)\b/i);
 for(const needle of ['@exclusion_run','b.binding_hash','v.binding_hash','v.native_row_hash','pr.payload_hash=b.stage_payload_hash','r.payload_hash=v.stage_payload_hash','operation_quarantine_holds','SELECT z.source_unit_id EXCEPT SELECT v.source_unit_id','sourceActiveCatalog'])assert.ok(BUSINESS_CATALOG_PRICE_EXCLUSION_SQL.includes(needle));
});
