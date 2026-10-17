import test from 'node:test';import assert from 'node:assert/strict';
import {createCustomerContactService} from './customerContactService.mjs';
import {contactFixture} from './customerContact.test-fixture.mjs';

function harness(){const f=contactFixture(),calls=[];let gets=0;
 const state={context:f.context,replayed:false,bad:false};
 const store={async withCustomerContact(options,fn){calls.push(options);return fn({copy:f.copy,context:state.context,update:async payload=>{calls.push(payload);if(state.bad)return {};const raw=JSON.parse(payload);return {context:{...f.context,contact:{phone:raw.phone,city:raw.city,country:raw.country},revision:raw.expectedRevision},replayed:state.replayed};}});}};
 return {...f,calls,state,getCount:()=>gets,service:createCustomerContactService({getStore:async()=>{gets++;return store;}})};
}
test('modeled contact read keeps unmasked phone and all distinct sealed currency links without exposing a trade action',async()=>{
 const h=harness(),result=await h.service.context('100',h.actor);assert.equal(result.contact.phone,'001000000');assert.equal(result.accounts.length,2);assert.deepEqual(result.accounts.map(row=>row.currency),['TRY','USD']);assert.equal('canEdit' in result,false);assert.deepEqual(h.copy.actors.map(actor=>actor.id),['15','16']);assert.equal(h.calls[0].write,false);
});
test('modeled contact update sends only canonical path-bound JSON and does not reject historical replay with an old CAS token',async()=>{
 const h=harness();h.state.replayed=true;
 const result=await h.service.update('100',{...h.body,expectedRevision:'B'.repeat(64)},h.actor);assert.equal(result.replayed,true);assert.equal(result.context.revision,'B'.repeat(64));assert.equal(result.context.contact.phone,'001610000');assert.deepEqual(Object.keys(result),['context','replayed']);
 assert.deepEqual(Object.keys(JSON.parse(h.calls[1])),['customerId','requestId','expectedRevision','phone','city','country']);assert.equal(JSON.parse(h.calls[1]).customerId,'100');assert.equal(h.calls[0].write,true);
});
test('missing current permissions, malformed IDs or payload and query overrides fail before loading any store',async()=>{
 const h=harness();await assert.rejects(h.service.context('100',{...h.actor,permissions:['customer.view']}),{code:'AUTH_PERMISSION_DENIED'});
 await assert.rejects(h.service.update('100',{...h.body,balance:'0'},h.actor),{code:'CUSTOMER_VALIDATION_FAILED'});
 await assert.rejects(h.service.context('0100',h.actor),{code:'CUSTOMER_ID_INVALID'});
 await assert.rejects(h.service.context('100',h.actor,{currency:'USD'}),{code:'CUSTOMER_VALIDATION_FAILED'});assert.equal(h.getCount(),0);assert.equal(h.calls.length,0);
});
test('unexpected or altered native context and malformed update result cannot be returned as a successful contact write',async()=>{
 const h=harness();h.state.context={...h.context,sourceId:'999'};await assert.rejects(h.service.context('100',h.actor),{code:'CUSTOMER_CONTACT_UNAVAILABLE'});
 h.state.context=h.context;h.state.bad=true;await assert.rejects(h.service.update('100',h.body,h.actor),{code:'CUSTOMER_CONTACT_UNAVAILABLE'});
});
