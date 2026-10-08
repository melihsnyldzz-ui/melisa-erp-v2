import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProductCompletionReaders,productPayloadReaderRevision2} from './product-completion-readers.mjs';
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
test('r2 extracts a long escaped source payload as nvarchar(max), retaining every original guard and field expression',()=>{
 const original=buildProductCompletionReaders({context,baselineContext}),revised=buildProductCompletionReaders({context:{...context,readerRevision:2},baselineContext});
 const legacy="JSON_VALUE(r.payload_json,'$.source_payload_json')",wide="(SELECT nested_source.source_payload_json FROM OPENJSON(r.payload_json) WITH(source_payload_json nvarchar(max) '$.source_payload_json') nested_source)";
 // Actual product-stage shape: the long value is an escaped scalar JSON string,
 // not an object. JSON_QUERY on this path would not recover it either.
 const source={unit:'ADET',mainUnitSourceId:'7001',unitStatus:'VERIFIED_ADET_FACTOR_1',unitFactor:'1.00000000',prices:Array.from({length:100},(_,i)=>({tier:1,currency:'USD',price:'8.55000000',unitSourceId:String(7001+i)}))};
 const stage=JSON.stringify({source_payload_json:JSON.stringify(source)}),nested=JSON.parse(stage).source_payload_json;assert.ok(nested.length>4000);assert.equal(typeof nested,'string');assert.equal(JSON.parse(nested).unit,'ADET');
 for(const kind of ['catalog','stock','detail','list']){
  const a=original.readers[kind],b=revised.readers[kind];assert.equal(b.procedure,a.procedure+'_r2');assert.equal(b.definitionHash,sourceVersionSqlHash(b.sql));
  const reversed=b.sql.replaceAll(b.procedure,a.procedure).replaceAll(wide,legacy);
  assert.equal(reversed,a.sql,'only procedure name and all eight scalar extraction sites may change');
  if(kind==='catalog'||kind==='stock'){assert.equal(b.sql.split(wide).length-1,8);assert.equal(b.sql.includes(legacy),false);for(const field of ['mainUnitSourceId','unit','unitStatus','unitFactor'])assert.ok(b.sql.includes("JSON_VALUE("+wide+",'$."+field+"')"));}
  else assert.equal(b.sql.includes(wide),false);
 }
 for(const k of ['runId','sourceAsOf','sourceHash','snapshotHash','planHash','bindingsHash','productCount','priceCount','actualT1','ancestry'])assert.deepEqual(revised.context[k],original.context[k]);
 assert.equal(Object.hasOwn(original.context,'readerRevision'),false);
});
test('r2 refuses a changed nested-payload template or an unknown reader revision',()=>{
 const original=buildProductCompletionReaders({context,baselineContext}),sql=original.readers.catalog.sql;
 assert.throws(()=>productPayloadReaderRevision2(sql.replace("JSON_VALUE(r.payload_json,'$.source_payload_json')","JSON_VALUE(r.payload_json,'$.other')"),'catalog'),/REVISION_TEMPLATE/);
 assert.throws(()=>productPayloadReaderRevision2(sql,'detail'),/REVISION_KIND/);
 for(const revision of [1,3,'2',null])assert.throws(()=>buildProductCompletionReaders({context:{...context,readerRevision:revision},baselineContext}));
});
