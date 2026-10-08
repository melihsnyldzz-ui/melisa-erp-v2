import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProductCompletionReaders} from './product-completion-readers.mjs';
import {sourceVersionSqlHash} from '../migration/goal7-source-version.mjs';
const h='a'.repeat(64),goal7='GOAL7-a6090360-2739-41e6-8b98-cedecb78bf0d',run='PRODUCT-f89c11a7-108b-4ae7-b781-26eb066459d5';
const baselineContext={runId:goal7,sourceHash:h,planHash:'b'.repeat(64),bindingsHash:'c'.repeat(64),sourceAsOf:'2026-10-07',productCount:16671,priceCount:64015};
const context={schemaVersion:'melisa-product-completion-catalog-context.v1',runId:run,sourceHash:'d'.repeat(64),planHash:'e'.repeat(64),bindingsHash:'f'.repeat(64),sourceAsOf:'2026-10-08',productCount:16725,priceCount:64111,snapshotHash:h,actualT1:false,evidenceKind:'DATED_TEST_PRODUCT_SCOPE',ancestry:[{runId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30'},{runId:goal7,sourceAsOf:'2026-10-07'},{runId:run,sourceAsOf:'2026-10-08'}]};
test('four additive TEST readers preserve old pins and exact three-stage lineage at a colliding count',()=>{
 const built=buildProductCompletionReaders({context,baselineContext});
 for(const kind of ['catalog','stock','detail','list']){
  const r=built.readers[kind];assert.equal(r.definitionHash,sourceVersionSqlHash(r.sql));
  assert.ok(r.sql.includes('product_count=16622 AND price_count=63774'));
  assert.ok(r.sql.includes('product_count=16725 AND price_count=64111'));
  assert.ok(r.sql.includes("lineage_run_id NOT IN(N'VEGA-OPENING-TEST-20261004-06',N'"+goal7+"',N'"+run+"')"));
  assert.ok(r.sql.includes("anc.runId=b.lineage_run_id AND anc.sourceAsOf=b.lineage_source_as_of"));
  assert.ok(r.sql.includes('r.source_key=b.lineage_source_key')&&r.sql.includes('r.source_key=v.lineage_source_key'));
  assert.ok(r.sql.startsWith('CREATE PROCEDURE '+r.procedure));
  assert.ok(r.sql.includes('WITH EXECUTE AS OWNER'));
 }
 assert.ok(built.readers.catalog.sql.includes('<>16779'));
});
test('dated publication cannot impersonate T1 or discard previous accepted ancestry',()=>{
 assert.throws(()=>buildProductCompletionReaders({context:{...context,actualT1:true},baselineContext}));
 assert.throws(()=>buildProductCompletionReaders({context:{...context,ancestry:context.ancestry.slice(1)},baselineContext}));
 assert.throws(()=>buildProductCompletionReaders({context,baselineContext:{...baselineContext,productCount:53084}}));
});
