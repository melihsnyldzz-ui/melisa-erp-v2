import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {syncBuiltinESMExports} from 'node:module';
const calls=[];
net.connect=()=>({synthetic:true});
globalThis.fetch=async(url,options)=>{calls.push({url,options});net.connect({host:'127.0.0.1',port:62401});return {ok:true,json:async()=>({success:true})};};
syncBuiltinESMExports();
const policy=await import('../../canonical-test-network.mjs');
test('fixed TEST health GET permits only its own loopback transport and never enables generic CRM requests',async()=>{
 process.env.MELISA_CANONICAL_TEST='true';process.env.SQL_DATABASE='MELISA_ERP_SIRKET_TEST_20260929_01';
 assert.equal((await policy.readCanonicalCrmHealth()).ok,true);
 assert.equal(calls.length,1);assert.equal(calls[0].url,'http://127.0.0.1:62401/health');
 assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.redirect,'error');assert.deepEqual(calls[0].options.headers,{Accept:'application/json'});
 assert.equal(calls[0].options.body,undefined);assert(!policy.networkPolicy.ports.includes(62401));
 for(const url of ['http://127.0.0.1:62401/health','http://127.0.0.1:62401/api/send','http://example.com/health'])assert.throws(()=>fetch(url),e=>e.code==='TEST_EXTERNAL_OPERATION_DISABLED');
 assert.throws(()=>net.connect({host:'127.0.0.1',port:62401}),e=>e.code==='TEST_EXTERNAL_OPERATION_DISABLED');
 process.env.SQL_DATABASE='MELISA_ERP_PROD_CANDIDATE_20260917_01';assert.throws(()=>policy.readCanonicalCrmHealth(),e=>e.code==='TEST_EXTERNAL_OPERATION_DISABLED');assert.equal(calls.length,1);
});
