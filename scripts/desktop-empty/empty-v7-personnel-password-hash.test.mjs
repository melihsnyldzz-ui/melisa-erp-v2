import test from 'node:test';
import assert from 'node:assert/strict';
import {PERSONNEL_PASSWORD_KEYS,PERSONNEL_PASSWORD_TARGET,validatePersonnelPasswordInput,hashPersonnelPasswords,readPersonnelPasswordBytes} from './empty-v7-personnel-password-hash.mjs';
const digest='a'.repeat(64),sample=()=>({version:1,rosterOperationId:'12345678-1234-4234-8234-123456789abc',...PERSONNEL_PASSWORD_TARGET,rosterSha256:digest,password:'x'.repeat(8),passwordConfirmation:'x'.repeat(8)});
test('human confirmation and exact DB9 roster frame precede hashing',()=>{
 assert.equal(validatePersonnelPasswordInput(sample(),digest),true);
 for(const change of [{databaseGuid:'c67f5317-9c0d-4831-aadd-fadc379a95d1'},{profileId:'legacy'},{rosterSha256:'b'.repeat(64)},{rosterOperationId:'not-an-operation'},{passwordConfirmation:'mismatch'},{unexpected:true}])assert.throws(()=>validatePersonnelPasswordInput({...sample(),...change},digest),/PERSONNEL_PASSWORD_INPUT_REJECTED/);
});
test('password byte limit avoids bcrypt truncation and invalid Unicode',()=>{
 for(const p of ['x'.repeat(7),'x'.repeat(65),'🙂'.repeat(19),'a'.repeat(8)+'\0','a'.repeat(8)+'\n','a'.repeat(8)+'\r','a'.repeat(8)+'\ud800'])assert.throws(()=>validatePersonnelPasswordInput({...sample(),password:p,passwordConfirmation:p},digest));
 const p='ü'.repeat(36);assert.equal(validatePersonnelPasswordInput({...sample(),password:p,passwordConfirmation:p},digest),true);
});
test('accessor payload and wrong roster digest are rejected without getters',()=>{
 let accessed=false;const input=sample();Object.defineProperty(input,'password',{enumerable:true,get(){accessed=true;throw Error('unexpected');}});assert.throws(()=>validatePersonnelPasswordInput(input,digest));assert.equal(accessed,false);assert.throws(()=>validatePersonnelPasswordInput(sample(),'bad'));
});
test('six independently salted bcrypt12 outputs contain no plaintext fields',async()=>{
 let count=0;const calls=[],bcrypt={async hash(value,cost){calls.push({length:value.length,cost});return '$2b$12$'+String.fromCharCode(65+count++).repeat(53);},getRounds(){return 12;}};
 const output=await hashPersonnelPasswords(sample(),{bcrypt,expectedRosterSha256:digest});assert.equal(count,6);assert.equal(calls.every(c=>c.length===8&&c.cost===12),true);assert.deepEqual(Object.keys(output.hashes),PERSONNEL_PASSWORD_KEYS);assert.equal(output.origin,'HUMAN_ENTRY');assert.equal(new Set(Object.values(output.hashes)).size,6);assert.equal(JSON.stringify(output).includes('password'),false);
});
test('invalid, duplicate, wrong-cost and throwing hashers fail with a static error',async()=>{
 for(const bcrypt of [{hash:async()=>'$2b$11$'+'A'.repeat(53),getRounds:()=>11},{hash:async()=>'$2b$12$'+'A'.repeat(53),getRounds:()=>12},{hash:async()=>{throw Error('private library detail');},getRounds:()=>12}])await assert.rejects(hashPersonnelPasswords(sample(),{bcrypt,expectedRosterSha256:digest}),e=>e.message==='PERSONNEL_PASSWORD_INPUT_REJECTED');
});
test('invalid input never calls bcrypt',async()=>{
 let calls=0;await assert.rejects(hashPersonnelPasswords({...sample(),passwordConfirmation:'wrong'},{bcrypt:{hash(){calls++;},getRounds(){return 12;}},expectedRosterSha256:digest}));assert.equal(calls,0);
});
test('private input is bounded and original chunks are cleared',async()=>{
 const first=Buffer.from('ab'),second=Buffer.from('cd');const bytes=await readPersonnelPasswordBytes((async function*(){yield first;yield second;})());assert.equal(bytes.toString(),'abcd');assert.equal(first.every(b=>b===0),true);assert.equal(second.every(b=>b===0),true);bytes.fill(0);
 const excess=Buffer.alloc(4097,65);await assert.rejects(readPersonnelPasswordBytes((async function*(){yield excess;})()));assert.equal(excess.every(b=>b===0),true);await assert.rejects(readPersonnelPasswordBytes((async function*(){})()));
});
