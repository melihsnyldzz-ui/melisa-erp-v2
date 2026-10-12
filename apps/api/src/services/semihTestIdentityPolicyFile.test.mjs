import test,{mock,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import path from 'node:path';
let state;
const file='C:\\Sirket\\ERP\\runtime\\semih-test-20261012\\erp-semih-identity.json';
const copy={copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',target:{server:'Semih\\MELISADEV',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'},actualT1:false};
const profile={schemaVersion:'melisa-semih-test-identity.v1',copyId:copy.copyId,target:copy.target,userId:'17',username:'erp-semih-test-20261012',displayName:'Semih TEST',role:{id:'2',code:'admin'},fingerprint:'b'.repeat(64)};
mock.module('node:fs',{defaultExport:{existsSync:p=>p===file||p===path.dirname(file),lstatSync:p=>({isSymbolicLink:()=>state.reparse===p,isFile:()=>state.regular,nlink:state.nlink,size:state.size??state.bytes.length}),readFileSync:p=>{assert.equal(p,file);return state.bytes;}}});
const {configuredSemihTestIdentity}=await import('./semihTestIdentityPolicy.mjs');
const config=()=>({MELISA_TEST_SEMIH_IDENTITY_PATH:file,MELISA_TEST_SEMIH_IDENTITY_SHA256:state.pin});
beforeEach(()=>{const bytes=Buffer.from(JSON.stringify(profile));state={bytes,pin:createHash('sha256').update(bytes).digest('hex'),reparse:null,regular:true,nlink:1};});
test('exact public identity file and immutable digest load successfully',()=>{
 const p=configuredSemihTestIdentity({copy,config:config()});assert.equal(p.userId,'17');assert.equal(Object.isFrozen(p),true);assert.equal(Object.isFrozen(p.role),true);
});
test('modified bytes, invalid JSON and wrong digest reject',()=>{
 state.bytes=Buffer.from('{}');assert.throws(()=>configuredSemihTestIdentity({copy,config:config()}));
 state.bytes=Buffer.from('bad json');state.pin=createHash('sha256').update(state.bytes).digest('hex');assert.throws(()=>configuredSemihTestIdentity({copy,config:config()}));
});
test('file or parent reparse and hardlinks reject before protected identity is accepted',()=>{
 for(const p of [file,path.dirname(file)]){state.reparse=p;assert.throws(()=>configuredSemihTestIdentity({copy,config:config()}));}
 state.reparse=null;state.nlink=2;assert.throws(()=>configuredSemihTestIdentity({copy,config:config()}));
});
test('oversize, non-file, wrong copy and T1 fail closed',()=>{
 state.size=4097;assert.throws(()=>configuredSemihTestIdentity({copy,config:config()}));state.size=null;state.regular=false;assert.throws(()=>configuredSemihTestIdentity({copy,config:config()}));state.regular=true;
 assert.throws(()=>configuredSemihTestIdentity({copy:{...copy,actualT1:true},config:config()}));
});
