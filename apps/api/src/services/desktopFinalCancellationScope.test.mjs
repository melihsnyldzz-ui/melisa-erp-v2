import test from 'node:test';import assert from 'node:assert/strict';
import {createDesktopFinalCancellationScope} from './desktopFinalCancellationScope.mjs';
const args=()=>({transaction:{},actorId:'30002',requestId:'7cbb7e06-ef75-4456-92e5-99f6d99b8312',invoiceId:'13'});
function fixture({allowed=true,probe={targetDatabase:'MELISA_ERP_DESKTOP_TEST_20261105',sessionId:15,transactionId:'31',transactionCount:1,transactionState:1},verify}={}){const calls=[];class Request{constructor(tx){calls.push(tx);}async query(){return {recordset:[probe]};}}return {calls,scope:createDesktopFinalCancellationScope({sql:{Request},verifySession:async a=>{calls.push(a);return verify?verify(a):allowed;}})};}
test('requires normal current sales.cancel and binds actor, invoice and physical transaction until callback settles',async()=>{
 const a=args(),f=fixture();let escaped;await f.scope.withScope(a,async s=>{escaped=s;assert(Object.isFrozen(s));assert.equal(await f.scope.verifyScope({transaction:a.transaction,scope:s,invoiceId:'13'}),true);assert.equal(await f.scope.verifyScope({transaction:{},scope:s,invoiceId:'13'}),false);assert.equal(await f.scope.verifyScope({transaction:a.transaction,scope:{...s},invoiceId:'13'}),false);assert.equal(await f.scope.verifyScope({transaction:a.transaction,scope:s,invoiceId:'14'}),false);});assert.deepEqual(f.calls.find(v=>v?.permission).permission,['sales.view','sales.cancel']);assert.equal(await f.scope.verifyScope({transaction:a.transaction,scope:escaped,invoiceId:'13'}),false);
});
test('denied or invalid physical scope never enters mutation callback; throw expires ownership',async()=>{
 for(const options of [{allowed:false},{probe:{targetDatabase:'OTHER',sessionId:15,transactionId:'31',transactionCount:1,transactionState:1}},{probe:{targetDatabase:'MELISA_ERP_DESKTOP_TEST_20261105',sessionId:15,transactionId:'31',transactionCount:2,transactionState:1}},{probe:{targetDatabase:'MELISA_ERP_DESKTOP_TEST_20261105',sessionId:15,transactionId:'31',transactionCount:1,transactionState:-1}}]){const f=fixture(options);let entered=false;await assert.rejects(f.scope.withScope(args(),()=>{entered=true;}));assert.equal(entered,false);}
 const a=args(),f=fixture();let escaped;await assert.rejects(f.scope.withScope(a,s=>{escaped=s;throw Error('LATER_FAILURE');}),/LATER_FAILURE/);assert.equal(await f.scope.verifyScope({transaction:a.transaction,scope:escaped,invoiceId:'13'}),false);await f.scope.withScope(a,()=>{});
});
test('rejects nested or concurrent ownership of the same SQL transaction before the auth lease',async()=>{
 const a=args();let release,entered;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r),f=fixture({verify:async()=>{entered();await gate;return true;}});const first=f.scope.withScope(a,async()=>{await assert.rejects(f.scope.withScope({...a,transaction:{}},()=>{}));});await ready;await assert.rejects(f.scope.withScope(a,()=>{}));assert.equal(f.calls.length,2);release();await first;
});
test('reader refuses a copied or escaped ownership scope and uses the same held transaction',async()=>{
 const a=args(),f=fixture();await f.scope.withScope(a,async scope=>{await Promise.resolve();assert.equal(await f.scope.verifyScope({transaction:a.transaction,scope,invoiceId:a.invoiceId}),true);});
 for(const change of [v=>v.actorId='0',v=>v.invoiceId='013',v=>v.requestId='bad',v=>v.transaction=null]){const bad=args();change(bad);await assert.rejects(f.scope.withScope(bad,()=>{}));}
});
test('same JS transaction object cannot carry authorization across a physical commit and rebegin',async()=>{
 const probe={targetDatabase:'MELISA_ERP_DESKTOP_TEST_20261105',sessionId:15,transactionId:'31',transactionCount:1,transactionState:1},a=args(),f=fixture({probe});
 await f.scope.withScope(a,async scope=>{assert.equal(await f.scope.verifyScope({transaction:a.transaction,scope,invoiceId:'13'}),true);probe.transactionId='32';assert.equal(await f.scope.verifyScope({transaction:a.transaction,scope,invoiceId:'13'}),false);probe.transactionId='31';probe.sessionId=16;assert.equal(await f.scope.verifyScope({transaction:a.transaction,scope,invoiceId:'13'}),false);probe.sessionId=15;probe.transactionCount=0;assert.equal(await f.scope.verifyScope({transaction:a.transaction,scope,invoiceId:'13'}),false);});
});
test('separate cancellation factories cannot concurrently own the same physical transaction',async()=>{
 const a=args();let release,entered;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r),first=fixture({verify:async()=>{entered();await gate;return true;}}),second=fixture();const pending=first.scope.withScope(a,()=>{});await ready;await assert.rejects(second.scope.withScope(a,()=>{}));assert.equal(second.calls.length,0);release();await pending;await second.scope.withScope(a,()=>{});
});
test('authorization cannot migrate to a new physical transaction during its own SQL await',async()=>{
 const probe={targetDatabase:'MELISA_ERP_DESKTOP_TEST_20261105',sessionId:15,transactionId:'31',transactionCount:1,transactionState:1};let authorized,release;const ready=new Promise(r=>authorized=r),gate=new Promise(r=>release=r),f=fixture({probe,verify:async()=>{authorized();await gate;return true;}});let entered=false;const pending=f.scope.withScope(args(),()=>{entered=true;});await ready;probe.transactionId='32';release();await assert.rejects(pending);assert.equal(entered,false);
});
