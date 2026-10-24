import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createTerminalHandoffProvider,TERMINAL_IDENTITY_FIELDS} from './terminalHandoffProvider.mjs';

const token=()=>crypto.randomBytes(32).toString('base64url');
const challenge=value=>crypto.createHash('sha256').update(value).digest('base64url');
const uuid=()=>crypto.randomUUID();
const defer=()=>{let resolve;return {promise:new Promise(done=>{resolve=done;}),resolve:value=>resolve(value)};};
function fixture(options={}){
 let clock=10000,active=true,enabled=true,familyId='e1000001-0000-4000-8000-000000000001';
 const key=token(),verifier=token(),calls=[];
 const context={environment:'CLEAN_SYNTHETIC_TEST',environmentId:'e662fd94-d797-4b3b-938a-d143ad758b67',database:'MELISA_ERP_CLEAN_TEST_20261022',synthetic:true,actualT1:false,externalOperations:false};
 // Explicit synthetic fixture only. Never an inferred real-person mapping.
 let relation={erpUserId:15,crmUserId:'clean-staff-20261022',chatwootAgentId:2,bindingRevision:'a'.repeat(64),active:true};
 const user={id:15,permissions:['product.view']},family=()=>({user,normalTestSessionId:familyId,expiresAt:1000000});
 const provider=createTerminalHandoffProvider({context,peerKey:key,enabled:()=>enabled,now:()=>clock,
  confirmErpPair:async(access,refresh)=>{calls.push(['confirm',access,refresh]);assert.equal(access,'synthetic-own-erp-access');assert.equal(refresh,'synthetic-own-erp-refresh');return {confirmed:true,user,normalTestSessionId:familyId,expiresAt:100000};},
  readErpFamily:async(id,sid)=>{calls.push(['family',id,sid]);if(!active)throw Error('Synthetic revoked family');return family();},
  relationFor:async id=>{calls.push(['relation',id]);return relation;},...options});
 const prepare={accessToken:'synthetic-own-erp-access',refreshToken:'synthetic-own-erp-refresh',requestId:uuid(),deviceBinding:'b'.repeat(64),codeChallenge:challenge(verifier),erpOrigin:'http://127.0.0.1:5244',crmOrigin:'http://127.0.0.1:62800'};
 const redeem=code=>({code,requestId:prepare.requestId,deviceBinding:prepare.deviceBinding,codeVerifier:verifier,erpOrigin:prepare.erpOrigin,crmOrigin:prepare.crmOrigin});
 const verify=linkId=>({linkId,requestId:prepare.requestId,deviceBinding:prepare.deviceBinding,erpOrigin:prepare.erpOrigin,crmOrigin:prepare.crmOrigin});
 return {provider,key,prepare,redeem,verify,calls,context,advance:ms=>{clock+=ms;},revoke:()=>{active=false;},disable:()=>{enabled=false;},change:next=>{relation=next;},relation:()=>({...relation}),newFamily:()=>{familyId=uuid();}};
}

test('one exact normal family produces only a purpose-bound opaque handoff and fresh identity metadata',async()=>{
 const f=fixture(),ticket=await f.provider.prepare(f.prepare);
 assert.deepEqual(Object.keys(ticket).sort(),['code','expiresAt','requestId','version']);assert.equal(ticket.expiresAt,40000);
 const linked=await f.provider.redeem(f.redeem(ticket.code),f.key);
 assert.deepEqual(Object.keys(linked.terminalIdentity).sort(),[...TERMINAL_IDENTITY_FIELDS].sort());
 assert.equal(linked.terminalIdentity.erpUserId,15);assert.equal(linked.terminalIdentity.crmUserId,'clean-staff-20261022');assert.equal(linked.terminalIdentity.chatwootAgentId,2);
 assert.equal(linked.terminalIdentity.erpNormalSessionId,'e1000001-0000-4000-8000-000000000001');assert.equal(linked.linkExpiresAt,1000000);
 assert(!JSON.stringify(linked).includes(f.prepare.accessToken));assert(!JSON.stringify(linked).includes(f.prepare.refreshToken));assert(!JSON.stringify(linked).includes(f.key));
 f.advance(31000);const live=await f.provider.verify(f.verify(linked.linkId),f.key);assert.equal(live.terminalIdentity.expiresAt,71000);
 assert(f.calls.filter(call=>call[0]==='family').every(call=>call.length===3&&call[1]===15));
});

test('atomic take allows one concurrent redemption and no request/device replay can issue a second code',async()=>{
 const f=fixture(),ticket=await f.provider.prepare(f.prepare);
 await assert.rejects(()=>f.provider.prepare({...f.prepare}));
 const results=await Promise.allSettled([f.provider.redeem(f.redeem(ticket.code),f.key),f.provider.redeem(f.redeem(ticket.code),f.key)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 await assert.rejects(()=>f.provider.redeem(f.redeem(ticket.code),f.key));f.advance(31000);await assert.rejects(()=>f.provider.prepare({...f.prepare}));
});

test('two concurrent prepare calls with the same request cannot publish two independent handoffs',async()=>{
 const f=fixture(),r=await Promise.allSettled([f.provider.prepare(f.prepare),f.provider.prepare({...f.prepare})]);
 assert.equal(r.filter(v=>v.status==='fulfilled').length,1);assert.equal(r.filter(v=>v.status==='rejected').length,1);
});

test('wrong peer cannot consume a code and wrong PKCE/device/request/audience never delegates',async()=>{
 const first=fixture(),ticket=await first.provider.prepare(first.prepare);
 await assert.rejects(()=>first.provider.redeem(first.redeem(ticket.code),token()));
 assert(await first.provider.redeem(first.redeem(ticket.code),first.key));
 for(const change of [{codeVerifier:token()},{deviceBinding:'c'.repeat(64)},{requestId:uuid()},{crmOrigin:'http://127.0.0.1:62700'},{erpOrigin:'http://192.168.1.46:5244'}]){
  const f=fixture(),t=await f.provider.prepare(f.prepare);await assert.rejects(()=>f.provider.redeem({...f.redeem(t.code),...change},f.key));
 }
});

test('expired, unbound, changed revision, revoked or switched normal family cannot be redeemed',async()=>{
 for(const effect of [f=>f.advance(30000),f=>f.change(null),f=>f.change({...f.relation(),bindingRevision:'c'.repeat(64)}),f=>f.revoke(),f=>f.newFamily(),f=>f.disable()]){
  const f=fixture(),t=await f.provider.prepare(f.prepare);effect(f);await assert.rejects(()=>f.provider.redeem(f.redeem(t.code),f.key));
 }
 const f=fixture();f.change(null);await assert.rejects(()=>f.provider.prepare(f.prepare));
});

test('fresh family/relation revocation closes an existing link; explicit close is idempotent and scoped',async()=>{
 for(const effect of [f=>f.revoke(),f=>f.change({...f.relation(),chatwootAgentId:3}),f=>f.change({...f.relation(),crmUserId:'clean-stranger-20261022'}),f=>f.disable()]){
  const f=fixture(),t=await f.provider.prepare(f.prepare),linked=await f.provider.redeem(f.redeem(t.code),f.key);effect(f);
  await assert.rejects(()=>f.provider.verify(f.verify(linked.linkId),f.key));
 }
 const f=fixture(),t=await f.provider.prepare(f.prepare),linked=await f.provider.redeem(f.redeem(t.code),f.key);
 assert.throws(()=>f.provider.revoke({...f.verify(linked.linkId),deviceBinding:'c'.repeat(64)},f.key));
 assert(await f.provider.verify(f.verify(linked.linkId),f.key));assert.deepEqual(f.provider.revoke(f.verify(linked.linkId),f.key),{revoked:true});
 assert.deepEqual(f.provider.revoke(f.verify(linked.linkId),f.key),{revoked:true});await assert.rejects(()=>f.provider.verify(f.verify(linked.linkId),f.key));
});

test('type-coerced revision metadata cannot enter or replace an explicit binding',async()=>{
 const f=fixture();f.change({...f.relation(),bindingRevision:['a'.repeat(64)]});await assert.rejects(()=>f.provider.prepare(f.prepare));
 const other=fixture(),t=await other.provider.prepare(other.prepare);other.change({...other.relation(),bindingRevision:['a'.repeat(64)]});await assert.rejects(()=>other.provider.redeem(other.redeem(t.code),other.key));
});

test('revocation during the final asynchronous relation lookup rejects redemption and verification',async()=>{
 for(const operation of ['redeem','verify']){
  let armed=false,lookups=0;const waiting=defer(),entered=defer();let f;
  f=fixture({relationFor:async()=>{if(armed&&++lookups===2){entered.resolve();await waiting.promise;}return f.relation();}});
  const t=await f.provider.prepare(f.prepare),linked=operation==='verify'?await f.provider.redeem(f.redeem(t.code),f.key):null;
  armed=true;const pending=operation==='verify'?f.provider.verify(f.verify(linked.linkId),f.key):f.provider.redeem(f.redeem(t.code),f.key);
  await entered.promise;f.revoke();waiting.resolve();await assert.rejects(pending);
  if(linked)assert.deepEqual(f.provider.revoke(f.verify(linked.linkId),f.key),{revoked:true});
 }
});

test('process close and expiry while validation is pending cannot publish a late link',async()=>{
 const waiting=defer(),entered=defer();let hold=false;
 const f=fixture({relationFor:async()=>{if(hold){entered.resolve();await waiting.promise;}return {erpUserId:15,crmUserId:'clean-staff-20261022',chatwootAgentId:2,bindingRevision:'a'.repeat(64),active:true};}});
 const t=await f.provider.prepare(f.prepare);hold=true;const pending=f.provider.redeem(f.redeem(t.code),f.key);await entered.promise;f.provider.close();waiting.resolve();await assert.rejects(()=>pending);
 await assert.rejects(()=>f.provider.prepare({...f.prepare,requestId:uuid()}));
 const second=fixture(),expired=await second.provider.prepare(second.prepare);second.advance(1000001);await assert.rejects(()=>second.provider.redeem(second.redeem(expired.code),second.key));
});

test('copied confirmed/identity claims, credential-shaped RPC bodies and unsafe environment fail closed',async()=>{
 const f=fixture();for(const extra of [{confirmed:true},{normalTestSessionId:uuid()},{erpUserId:15},{crmUserId:'clean-staff-20261022'}])await assert.rejects(()=>f.provider.prepare({...f.prepare,...extra}));
 const t=await f.provider.prepare(f.prepare);await assert.rejects(()=>f.provider.redeem({...f.redeem(t.code),refreshToken:'not-a-peer-credential'},f.key));
 for(const change of [{environmentId:'other'},{database:'LIVE'},{synthetic:false},{actualT1:true},{externalOperations:true}])assert.throws(()=>fixture({context:{...f.context,...change}}));
});
