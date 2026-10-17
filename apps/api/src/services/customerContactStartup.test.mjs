import test from 'node:test';
import assert from 'node:assert/strict';
import {customerContactFixture} from '../../../../scripts/canonical/shared-business-customer-contact-test-fixture.mjs';
import {CUSTOMER_CONTACT_METADATA_SQL,getRegisteredCustomerContactRevision} from '../../../../scripts/canonical/shared-business-customer-contact-bootstrap.mjs';
import {validateCustomerContactStartup,configureCustomerContactStartup} from './customerContactStartup.mjs';

const config=(fixture,change=()=>{})=>{const value={businessSelectedSaleStartup:{},businessProductPriceRevisions:{},customerContactRevision:structuredClone(fixture.bundle.revision)};change(value);return value;};

test('cold-start descriptor is exact, dependency-bound and cannot grant from config alone',async()=>{
 const f=await customerContactFixture(),value=config(f);assert.equal(validateCustomerContactStartup(value,f.copy),value.customerContactRevision);assert.equal(getRegisteredCustomerContactRevision(f.copy),null);
 for(const change of [c=>delete c.businessSelectedSaleStartup,c=>delete c.businessProductPriceRevisions,c=>c.customerContactRevision.modules.reverse(),c=>c.customerContactRevision.modules[0].beforeHash='F'.repeat(64),c=>c.customerContactRevision.scope.sealHash='bad']){const candidate=config(f,change);assert.throws(()=>validateCustomerContactStartup(candidate,f.copy));}
});

test('supported order projects the registered predecessor chain then earns the exact native descriptor',async()=>{
 const f=await customerContactFixture();let predecessor=false,queries=0;
 const request={query:async sql=>{queries++;return sql===CUSTOMER_CONTACT_METADATA_SQL?{recordset:[{...f.metadata}]}:structuredClone(f.proof);}};
 const old=f.bundle.revision.modules[0],result=await configureCustomerContactStartup(config(f),f.copy,request,async compatible=>{
  const projected=await compatible.query('synthetic predecessor proof');
  assert.equal(projected.recordsets[1][0].actualHash,old.beforeHash);predecessor=true;return 'configured';
 });
 assert.equal(result,'configured');assert.equal(predecessor,true);assert.equal(getRegisteredCustomerContactRevision(f.copy)?.revision.revisionHash,f.bundle.revision.revisionHash);assert.equal(queries,10);
});

test('missing or invalid descriptor stays closed before predecessor configuration',async()=>{
 const f=await customerContactFixture();let called=0;
 assert.equal(await configureCustomerContactStartup({...config(f),customerContactRevision:undefined},f.copy,{query:async()=>assert.fail()},async()=>{called++;return null;}),null);assert.equal(called,1);
 const bad=config(f,c=>c.customerContactRevision.revisionHash='0'.repeat(64));await assert.rejects(()=>configureCustomerContactStartup(bad,f.copy,{query:async()=>assert.fail()},async()=>{called++;}));assert.equal(called,1);
});

test('a failed final proof cannot leave a registered contact writer',async()=>{
 for(let failAt=1;failAt<=10;failAt++){
  const f=await customerContactFixture();let queries=0;
  const request={query:async sql=>{if(++queries===failAt)throw new Error('proof failed');return sql===CUSTOMER_CONTACT_METADATA_SQL?{recordset:[{...f.metadata}]}:structuredClone(f.proof);}};
  await assert.rejects(()=>configureCustomerContactStartup(config(f),f.copy,request,async compatible=>compatible.query('synthetic predecessor proof')),/proof failed/);
  assert.equal(getRegisteredCustomerContactRevision(f.copy),null,`failed query ${failAt} must not grant a writer`);
 }
});

test('predecessor failure never registers contact capability',async()=>{
 const f=await customerContactFixture();
 const request={query:async sql=>sql===CUSTOMER_CONTACT_METADATA_SQL?{recordset:[{...f.metadata}]}:structuredClone(f.proof)};
 await assert.rejects(()=>configureCustomerContactStartup(config(f),f.copy,request,async()=>{throw new Error('predecessor refused');}),/predecessor refused/);
 assert.equal(getRegisteredCustomerContactRevision(f.copy),null);
});

test('a coherent replacement transaction after predecessor setup cannot earn capability',async()=>{
 const f=await customerContactFixture();let replaced=false;
 const request={query:async sql=>{
  const frame=replaced?{sessionId:72,transactionId:'1002'}:{};
  if(sql===CUSTOMER_CONTACT_METADATA_SQL)return{recordset:[{...f.metadata,...frame}]};
  const proof=structuredClone(f.proof);Object.assign(proof.recordsets[0][0],frame);return proof;
 }};
 await assert.rejects(()=>configureCustomerContactStartup(config(f),f.copy,request,async()=>{replaced=true;}),{code:'CUSTOMER_CONTACT_UNAVAILABLE'});
 assert.equal(getRegisteredCustomerContactRevision(f.copy),null);
});
