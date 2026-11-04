import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createResetManagedAuthPasswordCore} from './resetManagedAuthPasswordCore.mjs';
function fixture({user={id:17,username:'fixture-person',role_id:17,is_active:true},deny=false,badResult=false}={}){
 const events=[],tx={},sql={BigInt:'bigint',NVarChar:n=>'text'+n};
 const request=()=>{const values={};return{input(k,t,v){values[k]=v;return this;},async query(text){events.push({kind:'sql',text,values});return text.startsWith('SELECT')?{recordset:user?[user]:[]}:{recordset:badResult?[]:[{row_version:Buffer.from('0000000000000002','hex')}]};}};};
 const reset=createResetManagedAuthPasswordCore({sql,request,hashPassword:async(value,rounds)=>{events.push({kind:'hash',rounds});assert.equal(value,'fixture-new-password');return 'fixture-hash';},authorizeUser:async()=>{events.push({kind:'admit'});if(deny)throw Error('TARGET_REJECTED');},writeAudit:async(req,event)=>{events.push({kind:'audit',event});}});
 return{reset,tx,events};
}
test('reset admits locked identity before hashing and writes only its password, metadata and own refresh revocation',async()=>{
 const f=fixture(),r=await f.reset(f.tx,17,{password:'fixture-new-password'},null);
 assert.equal(r.rowVersion,'0000000000000002');assert.deepEqual(f.events.map(e=>e.kind),['sql','admit','hash','sql','audit']);
 const write=f.events[3];assert.equal(write.values.userId,17);assert.match(write.text,/WHERE id=@userId/);assert.match(write.text,/WHERE user_id=@userId AND revoked_at IS NULL/);assert(!/SET\s+(?:role_id|is_active|username)/i.test(write.text));
 assert.equal(f.events[2].rounds,12);const audit=JSON.stringify(f.events[4]);assert(!audit.includes('fixture-new-password'));assert(!audit.includes('fixture-hash'));assert(!('password' in r));assert(!('passwordHash' in r));
});
test('wrong identity, absent user and invalid input have no hash or write effect',async()=>{
 for(const opts of [{deny:true},{user:null}]){const f=fixture(opts);await assert.rejects(f.reset(f.tx,17,{password:'fixture-new-password'}));assert(!f.events.some(e=>['hash','audit'].includes(e.kind)));assert.equal(f.events.filter(e=>e.kind==='sql').length,1);}
 for(const [id,payload] of [[0,{password:'fixture-new-password'}],[17,{password:'short'}],[17,{password:'x'.repeat(129)}]]){const f=fixture();await assert.rejects(f.reset(f.tx,id,payload));assert.equal(f.events.length,0);}
});
test('missing update acknowledgment fails closed before audit; transaction remains caller-owned',async()=>{
 const f=fixture({badResult:true});await assert.rejects(f.reset(f.tx,17,{password:'fixture-new-password'}),/CORE_RESULT/);assert(!f.events.some(e=>e.kind==='audit'));assert.deepEqual(f.tx,{});
});
test('normal API retains its write guard and calls the shared reset operation',()=>{
 const source=fs.readFileSync(new URL('./authAdminService.js',import.meta.url),'utf8');const body=source.slice(source.indexOf('export async function resetAuthAdminUserPassword'),source.indexOf('export async function updateUserAccess'));
 assert.match(body,/if\(!assertCleanPersonnelWrite\(actor,'user_password'\)\)assertMelisaWriteEnabled\(\)/);assert.match(body,/createResetManagedAuthPasswordCore/);assert.match(body,/await transaction.commit\(\)/);assert.match(body,/await transaction.rollback\(\)/);
});
