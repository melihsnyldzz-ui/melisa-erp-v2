import test from 'node:test';
import assert from 'node:assert/strict';
import {customerContactFixture} from './shared-business-customer-contact-test-fixture.mjs';
import {CUSTOMER_CONTACT_METADATA_SQL,validateCustomerContactNativeProof,configureCustomerContactRevision,getRegisteredCustomerContactRevision,verifyCustomerContactRevision,projectCustomerContactPredecessorProof} from './shared-business-customer-contact-bootstrap.mjs';
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
