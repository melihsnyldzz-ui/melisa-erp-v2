import test from 'node:test';
import assert from 'node:assert/strict';
import {customerContactFixture} from './shared-business-customer-contact-test-fixture.mjs';
import {CUSTOMER_CONTACT_METADATA_SQL,validateCustomerContactNativeProof,configureCustomerContactRevision,getRegisteredCustomerContactRevision,verifyCustomerContactRevision,projectCustomerContactPredecessorProof,withCustomerContactCompatibilityProof} from './shared-business-customer-contact-bootstrap.mjs';
import {CUSTOMER_CONTACT_PREDECESSOR_NAMES,CUSTOMER_CONTACT_PROOF} from './shared-business-customer-contact-contract.mjs';

// Native-shaped results are generated entirely from the existing offline fixture.
function compatibilityRequest(f,mutate=()=>{}){
 let reads=0;
 return {get reads(){return reads;},query:async sql=>{
  const result=structuredClone(sql===CUSTOMER_CONTACT_METADATA_SQL?{recordset:[f.metadata]}:f.proof);
  mutate(result,++reads);return result;
 }};
}
test('pure native validation never earns a capability or accepts extra/mixed/tampered rows',async()=>{
 const f=await customerContactFixture();assert.equal(validateCustomerContactNativeProof(f.bundle.revision,f.proof,f.metadata),true);assert.equal(getRegisteredCustomerContactRevision(f.copy),null);
 for(const mutate of [r=>r.recordsets[0][0].sessionId++,r=>r.recordsets[1].pop(),r=>r.recordsets[1][0].actualHash='F'.repeat(64),r=>r.recordsets[1][0].moduleType='FN',r=>r.recordsets[1][0].immutableDisabled=1,r=>r.recordsets[1][0].extra=true,r=>r.recordsets[2][0].scope_json+=' ']){const p=structuredClone(f.proof);mutate(p);assert.throws(()=>validateCustomerContactNativeProof(f.bundle.revision,p,f.metadata));}
 assert.throws(()=>projectCustomerContactPredecessorProof({...f.bundle.revision},f.proof));
});
test('outside-owner private/identity proof gates actual registration and every verify',async()=>{
 const f=await customerContactFixture();let reads=0;const request={query:async sql=>{reads++;return sql===CUSTOMER_CONTACT_METADATA_SQL?{recordset:[{...f.metadata}]}:structuredClone(f.proof);}};
 const cap=await configureCustomerContactRevision(f.copy,f.bundle,request);assert.equal(reads,3);assert.equal(getRegisteredCustomerContactRevision(f.copy),cap);assert.equal(await verifyCustomerContactRevision(f.copy,request),cap);assert.equal(reads,6);
 await assert.rejects(()=>verifyCustomerContactRevision(f.copy,request,{write:true}));assert.equal(reads,7);
 for(const change of [m=>m.sysadmin=1,m=>m.control=1,m=>m.originalDatabaseAccess=1,m=>m.registryPrivateAccess=1,m=>m.projectorPrivateAccess=1,m=>m.databaseUser='dbo',m=>m.proofDefinitionHash='F'.repeat(64),m=>m.isolationLevel=2]){const g=await customerContactFixture(),m={...g.metadata};change(m);const r={query:async()=>({recordset:[m]})};await assert.rejects(()=>configureCustomerContactRevision(g.copy,g.bundle,r));assert.equal(getRegisteredCustomerContactRevision(g.copy),null);}
});
test('unregistered/clone copy and coherent owner flags cannot enable contact edits',async()=>{
 const f=await customerContactFixture();let reads=0;const r={query:async()=>{reads++;throw Error('unexpected');}};
 await assert.rejects(()=>verifyCustomerContactRevision(f.copy,r));await assert.rejects(()=>configureCustomerContactRevision(structuredClone(f.copy),f.bundle,r));assert.equal(reads,0);
});
test('compatibility callback projects named predecessor rows without changing source results or unrelated hashes',async()=>{
 const f=await customerContactFixture(),request=compatibilityRequest(f);
 const modules=f.bundle.revision.modules.filter(m=>CUSTOMER_CONTACT_PREDECESSOR_NAMES.includes(m.name));
 const selected=modules.find(m=>m.name==='dbo.usp_business_selected_sale_context_v2');
 const contact=f.bundle.revision.modules.find(m=>m.name===CUSTOMER_CONTACT_PROOF);
 const source={recordsets:[modules.map(m=>({name:m.name,actualHash:m.afterHash,proofDefinitionHash:m.afterHash,readerDefinitionHash:m.afterHash})),[
  {name:'dbo.unrelated_reader',readerDefinitionHash:selected.afterHash},
  {name:selected.name,actualHash:'F'.repeat(64)},
  {name:contact.name,actualHash:contact.afterHash},
 ]]},before=structuredClone(source);
 const projected=await withCustomerContactCompatibilityProof(f.copy,request,f.bundle,project=>project(source));
 assert.deepEqual(projected.recordsets[0],modules.map(m=>({name:m.name,actualHash:m.beforeHash,proofDefinitionHash:m.beforeHash,readerDefinitionHash:m.beforeHash})));
 assert.deepEqual(projected.recordsets[1],before.recordsets[1]);
 assert.deepEqual(source,before);assert.notEqual(projected,source);assert.equal(request.reads,6);
});
test('compatibility callback projects unnamed selected reader and price proof metadata hashes',async()=>{
 const f=await customerContactFixture(),request=compatibilityRequest(f);
 const selected=f.bundle.revision.modules.find(m=>m.name==='dbo.usp_business_selected_sale_context_v2');
 const price=f.bundle.revision.modules.find(m=>m.name==='dbo.usp_business_product_price_proof_v1');
 const contact=f.bundle.revision.modules.find(m=>m.name===CUSTOMER_CONTACT_PROOF);
 // These are the actual generated successor/predecessor module hashes, not placeholders.
 assert.notEqual(selected.afterHash,selected.beforeHash);assert.notEqual(price.afterHash,price.beforeHash);
 const selectedResult={recordset:[{sessionId:f.metadata.sessionId,transactionId:f.metadata.transactionId,readerDefinitionHash:selected.afterHash}]};
 const priceResult={recordsets:[[{sessionId:f.metadata.sessionId,transactionId:f.metadata.transactionId,proofDefinitionHash:price.afterHash}],
  [{readerDefinitionHash:'F'.repeat(64),proofDefinitionHash:contact.afterHash}]]};
 const selectedBefore=structuredClone(selectedResult),priceBefore=structuredClone(priceResult);
 const [selectedProjected,priceProjected]=await withCustomerContactCompatibilityProof(f.copy,request,f.bundle,project=>[project(selectedResult),project(priceResult)]);
 assert.equal(selectedProjected.recordset[0].readerDefinitionHash,selected.beforeHash);
 assert.equal(priceProjected.recordsets[0][0].proofDefinitionHash,price.beforeHash);
 assert.deepEqual(priceProjected.recordsets[1],priceBefore.recordsets[1]);
 assert.deepEqual(selectedResult,selectedBefore);assert.deepEqual(priceResult,priceBefore);
 assert.equal(request.reads,6);
});
test('compatibility projector expires after successful and throwing callbacks',async()=>{
 for(const throws of [false,true]){
  const f=await customerContactFixture(),request=compatibilityRequest(f);let leaked;
  const failure=new Error('synthetic callback failure');
  const run=()=>withCustomerContactCompatibilityProof(f.copy,request,f.bundle,project=>{leaked=project;assert.deepEqual(project({recordset:[]}),{recordset:[]});if(throws)throw failure;return 'projected';});
  if(throws)await assert.rejects(run,error=>error===failure);else assert.equal(await run(),'projected');
  assert.throws(()=>leaked({recordset:[]}),{code:'CUSTOMER_CONTACT_UNAVAILABLE'});
  assert.equal(request.reads,throws?3:6);
 }
});
test('compatibility proof and metadata frame drift fail closed and revoke any earned projector',async()=>{
 for(const badRead of [2,3,5,6]){
  const f=await customerContactFixture();let called=false,leaked;
  const request=compatibilityRequest(f,(result,read)=>{if(read===badRead){if(result.recordsets)result.recordsets[0][0].sessionId++;else result.recordset[0].transactionId='1002';}});
  await assert.rejects(()=>withCustomerContactCompatibilityProof(f.copy,request,f.bundle,project=>{called=true;leaked=project;return project({recordset:[]});}),{code:'CUSTOMER_CONTACT_UNAVAILABLE'});
  assert.equal(called,badRead>3);assert.equal(request.reads,badRead);
  if(leaked)assert.throws(()=>leaked({recordset:[]}),{code:'CUSTOMER_CONTACT_UNAVAILABLE'});
  assert.equal(getRegisteredCustomerContactRevision(f.copy),null);
 }
});
