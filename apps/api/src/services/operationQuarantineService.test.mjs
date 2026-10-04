import test from 'node:test';
import assert from 'node:assert/strict';
import {OPENING_PRICE_RUN as run} from './openingPriceService.js';
import {OPERATION_QUARANTINE_SEAL,createOperationQuarantineService,normalizeQuarantineEntities,parseQuarantineQuery} from './operationQuarantineService.js';
import {operationQuarantineGate,invoiceQuarantineEntities} from './operationQuarantineGate.mjs';
import {normalizeOperationQuarantineError} from './operationQuarantineError.mjs';
const header=()=>({database_name:run.database,run_id:run.runId,run_status:'COMMITTED',source_hash:run.sourceHash,plan_hash:run.planHash,source_as_of:'2026-09-30',sealed:true,operation_gate:true,seal_hash:OPERATION_QUARANTINE_SEAL,total:1,page:1,page_size:50,native_held:90,not_present:4});
function harness({response,mutate,isTest=true,canonicalRequested=false}={}){
 const calls=[],sql={NVarChar:n=>'nvarchar'+n,Int:'int',MAX:-1};
 const request=()=>({input(k,_t,v){this[k]=v;return this;},async execute(proc){calls.push({proc,entities:this.entities_json&&JSON.parse(this.entities_json)});let r=response??{recordsets:[[header()],JSON.parse(this.entities_json).map(v=>({entity:v.entity,native_id:v.nativeId,blocked:false}))]};if(mutate)r=mutate(r);return r;}});
 const service=createOperationQuarantineService({getPool:async()=>({request}),sql,isTest:()=>isTest,canonicalRequested:()=>canonicalRequested});return {calls,service,request,sql};
}
test('negative hold set preserves every other ID including fixture IDs; exact native entity identity is deduplicated',async()=>{
 const h=harness();await h.service.assertAllowed([{entity:'product',nativeId:'15'},{entity:'product',nativeId:15},{entity:'supplier',nativeId:'15'}]);
 assert.deepEqual(h.calls[0].entities,[{entity:'product',nativeId:'15'},{entity:'supplier',nativeId:'15'}]);
 assert.equal(h.calls[0].proc,'dbo.usp_check_operation_quarantine');
 for(const row of [{entity:'product',nativeId:'00015'},{entity:'product',nativeId:'15 OR 1=1'},{entity:'source',nativeId:'15'},{entity:'product',nativeId:9007199254740993}])assert.throws(()=>normalizeQuarantineEntities([row]),{code:'MIGRATION_ENTITY_ID_INVALID'});
});
test('same transaction request handles more than200 identities without changing transaction or losing a line',async()=>{
 const h=harness(),rows=Array.from({length:401},(_,i)=>({entity:'product',nativeId:String(i+1)}));let txRequests=0;
 await h.service.assertAllowed(rows,{driver:h.sql,request:()=>{txRequests++;return h.request();}});
 assert.deepEqual(h.calls.map(v=>v.entities.length),[200,200,1]);assert.equal(txRequests,3);
 assert.deepEqual(h.calls.flatMap(v=>v.entities),rows);
});
test('one held item fails whole mixed document before business handler and ignores source/barcode/document IDs',async()=>{
 let handler=0,checked;
 const gate=operationQuarantineGate('sales',async rows=>{checked=rows;throw Object.assign(new Error('blocked'),{code:'MIGRATION_ENTITY_QUARANTINED',statusCode:409});});
 const error=await new Promise(resolve=>gate({body:{customerId:'11',sourceId:'77',invoiceId:'77',barcode:'77',items:[{productId:'12'},{productId:'77'}]}},{},e=>{if(!e)handler++;resolve(e);}));
 assert.equal(error.code,'MIGRATION_ENTITY_QUARANTINED');assert.equal(handler,0);
 assert.deepEqual(checked,[{entity:'customer',nativeId:'11'},{entity:'product',nativeId:'12'},{entity:'product',nativeId:'77'}]);
 assert.deepEqual([...invoiceQuarantineEntities('purchase',{supplierId:'80',items:[{productId:'81'}]}),...invoiceQuarantineEntities('purchase',{supplierId:'90',items:[{productId:'91'}]})].map(v=>v.nativeId),['80','81','90','91']);
 for(const items of [{productId:'77'},'77'])assert.throws(()=>invoiceQuarantineEntities('sales',{items}),{statusCode:400,code:'MIGRATION_ITEMS_INVALID'});
});
test('blocked native row returns stable409 without revealing source names; missing/duplicate/wrong metadata failclosed',async()=>{
 const input=[{entity:'product',nativeId:'15'}];
 await assert.rejects(harness({mutate:r=>{r.recordsets[1][0]={entity:'product',native_id:'15',blocked:true,source_key:'private-key',reason_code:'SOURCE_BARCODE_CONFLICT',source_name:'private name'};return r;}}).service.assertAllowed(input),e=>e.code==='MIGRATION_ENTITY_QUARANTINED'&&e.statusCode===409&&!JSON.stringify(e.meta).includes('private'));
 for(const mutate of [r=>{r.recordsets[0][0].run_status='PREPARED';return r;},r=>{r.recordsets[0][0].source_as_of='2026-09-30junk';return r;},r=>{r.recordsets[1]=[];return r;},r=>{r.recordsets[1][0].native_id='16';return r;},r=>{r.recordsets[0][0].sealed=false;return r;}])await assert.rejects(harness({mutate}).service.assertAllowed(input),{code:'MIGRATION_QUARANTINE_DRIFT'});
});
test('canonical TEST with mismatched identity failsclosed; genuine outsideTEST writehooks do not connect or change validation',async()=>{
 const drift=harness({isTest:false,canonicalRequested:true});await assert.rejects(drift.service.assertAllowed([{entity:'product',nativeId:'15'}]),{code:'MIGRATION_QUARANTINE_DRIFT'});assert.equal(drift.calls.length,0);
 const outside=harness({isTest:false});await outside.service.assertAllowed([{garbage:true}]);assert.equal(outside.calls.length,0);
 await assert.rejects(outside.service.list({entity:'product'}),{code:'MIGRATION_QUARANTINE_TEST_ONLY'});
});
test('list preserves source-only NULL native IDs and leadingzero codes with bounded parameterized permission-kind query',async()=>{
 const source={entity:'supplier',source_key:'VEGA_CAPTURE_20260930_01/F0103/TBLCARILER/1',source_code:'00017',source_name:'fixture source',native_id:null,native_code:null,native_name:null,status:'not-present',reasons_json:'["NATIVE_TARGET_NOT_PRESENT"]'};
 const h=harness({response:{recordsets:[[header()],[source]]}}),result=await h.service.list({entity:'supplier',search:'00017'});
 assert.equal(result.data[0].nativeId,null);assert.equal(result.data[0].sourceCode,'00017');assert.equal(result.meta.countScope,'selected-entity-full-scope');assert.equal(h.calls[0].proc,'dbo.usp_list_operation_quarantine');
 for(const query of [{entity:'any'},{entity:'product',limit:'101'},{entity:'customer',runId:'LIVE'},{entity:'supplier',search:['x']}])assert.throws(()=>parseQuarantineQuery(query),{code:'MIGRATION_QUARANTINE_QUERY_INVALID'});
});
test('SQL hold and readiness tokens normalize safely only with dedicated server error number',()=>{
 const error={number:51076,originalError:{info:{message:'MIGRATION_OPERATION_QUARANTINED private detail'}}};
 assert.equal(normalizeOperationQuarantineError(error).code,'MIGRATION_ENTITY_QUARANTINED');
 assert.equal(normalizeOperationQuarantineError(error).statusCode,409);
 assert.equal(normalizeOperationQuarantineError({number:51076,message:'MIGRATION_QUARANTINE_BINDING_DRIFT'}).statusCode,503);
 const other={number:51070,message:'MIGRATION_OPERATION_QUARANTINED'};assert.equal(normalizeOperationQuarantineError(other),other);
});
test('unknown source name remains NULL and never acquires the native card name',async()=>{
 const row={entity:'supplier',source_key:'VEGA_CAPTURE_20260930_01/F0103/TBLCARI/7',native_id:null,source_code:'0007',source_name:null,native_code:null,native_name:null,status:'not-present',reasons_json:'["NATIVE_TARGET_NOT_PRESENT"]'};
 const h=harness({response:{recordsets:[[header()],[row]]}});
 assert.equal((await h.service.list({entity:'supplier'})).data[0].sourceName,null);
 delete row.source_name;
 await assert.rejects(()=>h.service.list({entity:'supplier'}),{code:'MIGRATION_QUARANTINE_DRIFT'});
});
