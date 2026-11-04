import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {validateCleanOperationalStartup} from './cleanSyntheticStartup.mjs';
const enabled={API_PORT:'4194',MELISA_CLEAN_STORE_DAY:'20261022',MELISA_CLEAN_FINANCE:'20261022',MELISA_CLEAN_INVENTORY:'20261022'};
function fixture(rejection){const calls=[],pool={config:{requestTimeout:10000,connectionTimeout:10000}};
 class Request{constructor(parent,options){assert.equal(parent,pool);calls.push({options});}async query(batch){calls.at(-1).batch=batch;if(rejection)throw rejection;return {};}}
 return {calls,pool,sql:{Request}};
}
test('all enabled startup cohorts are proved before one full bounded checkpoint',async()=>{
 const f=fixture();await validateCleanOperationalStartup({...f,environment:enabled});
 assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].options,{requestTimeout:30000});
 assert.equal(f.calls[0].batch,"IF OBJECT_ID(N'dbo.clean_store_finance_manifest') IS NULL THROW 51960,'CLEAN_INBOUND_COHORT_DRIFT',1;\nIF OBJECT_ID(N'dbo.clean_store_inventory_manifest') IS NULL THROW 51960,'CLEAN_INBOUND_COHORT_DRIFT',1;\nEXEC dbo.usp_clean_store_day_ready;");
 assert.deepEqual(f.pool.config,{requestTimeout:10000,connectionTimeout:10000});
});
test('legacy flag combinations retain their exact cohort requirements',async()=>{
 for(const [environment,manifests] of [[{API_PORT:'4194',MELISA_CLEAN_STORE_DAY:'20261022'},[]],[{API_PORT:'4194',MELISA_CLEAN_FINANCE:'20261022'},['finance']],[{API_PORT:'4194',MELISA_CLEAN_STORE_DAY:'20261022',MELISA_CLEAN_INVENTORY:'20261022'},['inventory']]]){
  const f=fixture();await validateCleanOperationalStartup({...f,environment});assert.equal(f.calls.length,1);
  for(const name of ['finance','inventory'])assert.equal(f.calls[0].batch.includes(`clean_store_${name}_manifest`),manifests.includes(name));
  assert.equal((f.calls[0].batch.match(/EXEC dbo.usp_clean_store_day_ready;/g)||[]).length,1);
 }
});
test('native and inactive profiles acquire no operational SQL authority',async()=>{
 for(const environment of [{...enabled,API_PORT:'4196'},{API_PORT:'4194'},{API_PORT:'4194',MELISA_CLEAN_INVENTORY:'20261022'}]){
  const f=fixture();await validateCleanOperationalStartup({...f,environment});assert.equal(f.calls.length,0);
 }
});
test('checkpoint rejection and timeout propagate without retry or cached success',async()=>{
 for(const rejection of [Object.assign(Error('integrity rejected'),{number:51960}),Object.assign(Error('timeout'),{code:'ETIMEOUT'})]){
  const f=fixture(rejection);await assert.rejects(validateCleanOperationalStartup({...f,environment:enabled}),e=>e===rejection);assert.equal(f.calls.length,1);
 }
 const f=fixture();await validateCleanOperationalStartup({...f,environment:enabled});await validateCleanOperationalStartup({...f,environment:enabled});assert.equal(f.calls.length,2);
});
test('entry point proves identity first, awaits startup proof before listen, and contains no repeated ready batches',()=>{
 const source=fs.readFileSync(new URL('../cleanSyntheticServer.mjs',import.meta.url),'utf8');
 const identity=source.indexOf('registerCleanContext((await probe.request().query(CLEAN_IDENTITY_SQL)).recordset[0])');
 const validation=source.indexOf('await validateCleanOperationalStartup({pool:probe,sql})');
 assert(identity>=0&&validation>identity&&source.indexOf('app.listen(')>validation);
 assert(!source.includes('EXEC dbo.usp_clean_store_day_ready'));
 assert(!source.includes("execute('dbo.usp_clean_store_day_ready')"));
 assert(source.includes('connectionTimeout:10000,requestTimeout:10000'));
 assert(source.includes('finally{await probe.close();}'));
});
