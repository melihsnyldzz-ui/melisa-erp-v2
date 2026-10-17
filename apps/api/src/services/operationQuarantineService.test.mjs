import test from 'node:test';
import assert from 'node:assert/strict';
import {OPENING_PRICE_RUN as run} from './openingPriceService.js';
import {OPERATION_QUARANTINE_SEAL,OPERATION_QUARANTINE_V2_HASH,createOperationQuarantineService,normalizeQuarantineEntities,parseQuarantineQuery} from './operationQuarantineService.js';
import {operationQuarantineGate,invoiceQuarantineEntities} from './operationQuarantineGate.mjs';
import {normalizeOperationQuarantineError} from './operationQuarantineError.mjs';
import {fixtureContext,fixtureIdentity,fixtureProof} from './isolatedOperationCopyContext.test.mjs';
import {validateIsolatedOperationCopyContext,SHARED_COPY_DATABASE,isolatedCopyHash} from './isolatedOperationCopyContext.mjs';
import {withIsolatedOperationCopyScope} from './isolatedOperationCopyScope.mjs';
const header=()=>({database_name:run.database,run_id:run.runId,run_status:'COMMITTED',source_hash:run.sourceHash,plan_hash:run.planHash,source_as_of:'2026-09-30',sealed:true,operation_gate:true,seal_hash:OPERATION_QUARANTINE_SEAL,total:1,page:1,page_size:50,native_held:90,not_present:4});
function harness({response,mutate,isTest=true,getCopyContext,canonicalRequested=false,requiredResolverVersion=1}={}){
 const calls=[],sql={NVarChar:n=>'nvarchar'+n,Int:'int',MAX:-1};
 const request=()=>({input(k,_t,v){this[k]=v;return this;},async execute(proc){calls.push({proc,entities:this.entities_json&&JSON.parse(this.entities_json)});let r=response??{recordsets:[[header()],JSON.parse(this.entities_json).map(v=>({entity:v.entity,native_id:v.nativeId,blocked:false}))]};if(mutate)r=mutate(r);return r;}});
 const service=createOperationQuarantineService({getPool:async()=>({request}),sql,isTest:()=>isTest,getCopyContext,requiredResolverVersion,canonicalRequested:()=>canonicalRequested});return {calls,service,request,sql};
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
test('activated immutable v2 cannot fall back to legacy metadata or an unverified pin proof',async()=>{
 const input=[{entity:'supplier',nativeId:'900001'}];
 await assert.rejects(harness({requiredResolverVersion:2}).service.assertAllowed(input),{code:'MIGRATION_QUARANTINE_DRIFT'});
 for(const bad of[{resolver_version:2,resolver_hash:'0'.repeat(64),resolver_sealed:1},{resolver_version:1},{resolver_version:2,resolver_hash:OPERATION_QUARANTINE_V2_HASH,resolver_sealed:0}])await assert.rejects(harness({requiredResolverVersion:2,mutate:r=>{Object.assign(r.recordsets[0][0],bad);return r;}}).service.assertAllowed(input),{code:'MIGRATION_QUARANTINE_DRIFT'});
 const blocked=harness({requiredResolverVersion:2,mutate:r=>{Object.assign(r.recordsets[0][0],{resolver_version:2,resolver_hash:OPERATION_QUARANTINE_V2_HASH,resolver_sealed:1});r.recordsets[1][0]={entity:'supplier',native_id:'900001',blocked:1,source_key:'anonymous-held-source',reason_code:'NATIVE_TARGET_NOT_PRESENT'};return r;}});
 await assert.rejects(blocked.service.assertAllowed(input),{code:'MIGRATION_ENTITY_QUARANTINED',statusCode:409});
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
test('registered copy always checks the immutable resolver in its active same transaction without an outsideTEST skip',async()=>{
 const copy=validateIsolatedOperationCopyContext(fixtureContext()),tx={},input=[{entity:'product',nativeId:copy.products[0].id},{entity:'customer',nativeId:copy.customers[0].id},{entity:'supplier',nativeId:copy.suppliers[0].id}];
 const h=harness({isTest:false,getCopyContext:()=>copy,requiredResolverVersion:2,mutate:r=>{Object.assign(r.recordsets[0][0],{database_name:copy.target.database,resolver_version:2,resolver_hash:OPERATION_QUARANTINE_V2_HASH,resolver_sealed:true});return r;}}),ctx={transaction:tx,driver:h.sql,request:h.request};
 await assert.rejects(h.service.assertAllowed(input,ctx),{code:'MIGRATION_QUARANTINE_NOT_READY'});assert.equal(h.calls.length,0);
 await withIsolatedOperationCopyScope({context:copy,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),transaction:tx,write:true},async()=>{
  await h.service.assertAllowed(input,ctx);assert.equal(h.calls.length,1);assert.equal(h.calls[0].proc,'dbo.usp_check_operation_quarantine');assert.deepEqual(h.calls[0].entities,input);
  await assert.rejects(h.service.assertAllowed(input,{...ctx,transaction:{}}),{statusCode:503});
  await assert.rejects(h.service.assertAllowed([{entity:'product',nativeId:'99'}],ctx),{code:'MIGRATION_QUARANTINE_DRIFT'});assert.equal(h.calls.length,1);
  await assert.rejects(h.service.list({entity:'product'}),{statusCode:503});
 });
});
test('copy quarantine retains original seal, source and v2 pins and blocks held rows',async()=>{
 const copy=validateIsolatedOperationCopyContext(fixtureContext()),tx={},input=[{entity:'product',nativeId:copy.products[0].id}];
 await withIsolatedOperationCopyScope({context:copy,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),transaction:tx,write:true},async()=>{
  for(const change of [{database_name:run.database},{source_hash:'0'.repeat(64)},{resolver_hash:'0'.repeat(64)},{operation_gate:false},{seal_hash:'0'.repeat(64)}]){
   const h=harness({isTest:false,getCopyContext:()=>copy,requiredResolverVersion:2,mutate:r=>{Object.assign(r.recordsets[0][0],{database_name:copy.target.database,resolver_version:2,resolver_hash:OPERATION_QUARANTINE_V2_HASH,resolver_sealed:true},change);return r;}});
   await assert.rejects(h.service.assertAllowed(input,{transaction:tx,driver:h.sql,request:h.request}),{code:'MIGRATION_QUARANTINE_DRIFT'});
  }
  const held=harness({isTest:false,getCopyContext:()=>copy,requiredResolverVersion:2,mutate:r=>{Object.assign(r.recordsets[0][0],{database_name:copy.target.database,resolver_version:2,resolver_hash:OPERATION_QUARANTINE_V2_HASH,resolver_sealed:true});Object.assign(r.recordsets[1][0],{blocked:true,source_key:'preserved-source',reason_code:'SOURCE_BARCODE_CONFLICT'});return r;}});
  await assert.rejects(held.service.assertAllowed(input,{transaction:tx,driver:held.sql,request:held.request}),{code:'MIGRATION_ENTITY_QUARANTINED',statusCode:409});
 });
});
test('shared native check needs execute permission but still requires its active transaction and original sealed hold metadata',async()=>{
 const raw=fixtureContext();raw.target={...raw.target,database:SHARED_COPY_DATABASE,login:'melisa_shared_test_rw_20261009_01',databaseUser:'melisa_shared_test_rw_20261009_01'};raw.date='2026-10-09';raw.products=[{...raw.products[0],id:'29980'},{...raw.products[0],id:'30003'}];raw.customers[0].id='210';raw.suppliers[0].id='10162';raw.suppliers[0].currency='TRY';raw.financeAccounts=[{...raw.financeAccounts[0],id:'20043'}];delete raw.sealHash;raw.sealHash=isolatedCopyHash(raw);
 const copy=validateIsolatedOperationCopyContext(raw),tx={},input=[{entity:'product',nativeId:'29980'},{entity:'supplier',nativeId:'10162'}];let allowed=false,held=false,calls=0;
 const driver={NVarChar:n=>n,MAX:-1},context={transaction:tx,driver,request:()=>({input(){return this;},async execute(name){calls++;assert.equal(name,'dbo.usp_check_operation_quarantine');if(!allowed)throw Object.assign(new Error('execute denied'),{number:229});return {recordsets:[[{...header(),database_name:SHARED_COPY_DATABASE,resolver_version:2,resolver_hash:OPERATION_QUARANTINE_V2_HASH,resolver_sealed:true}],input.map(v=>({entity:v.entity,native_id:v.nativeId,blocked:held,source_key:'preserved-source',reason_code:'SOURCE_BARCODE_CONFLICT'}))]};}})};
 const service=createOperationQuarantineService({getCopyContext:()=>copy,requiredResolverVersion:2});
 await assert.rejects(service.assertAllowed(input,context),{code:'MIGRATION_QUARANTINE_NOT_READY'});assert.equal(calls,0);
 await withIsolatedOperationCopyScope({context:copy,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),transaction:tx,write:true},async()=>{
  await assert.rejects(service.assertAllowed(input,context),{code:'MIGRATION_QUARANTINE_NOT_READY'});allowed=true;await service.assertAllowed(input,context);held=true;
  await assert.rejects(service.assertAllowed(input,context),{code:'MIGRATION_ENTITY_QUARANTINED',statusCode:409});
 });
 await assert.rejects(service.assertAllowed(input,context),{code:'MIGRATION_QUARANTINE_NOT_READY'});
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
