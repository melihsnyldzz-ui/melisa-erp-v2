import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {bindNormalTestFingerprint} from './normalTestRefreshSession.mjs';
import {validateSemihTestIdentity,matchesSemihTestUser,configuredSemihTestIdentity,allowsProtectedNormalTestUser} from './semihTestIdentityPolicy.mjs';
const copy={copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',target:{server:'Semih\\MELISADEV',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'},actualT1:false};
const makeUser=()=>bindNormalTestFingerprint({id:17,username:'erp-semih-test-20261012',displayName:'Semih TEST',role:{id:2,code:'admin'},permissions:['settings.manage','product.view']},{password_hash:'fixture-bcrypt-only'});
const profile={schemaVersion:'melisa-semih-test-identity.v1',copyId:copy.copyId,target:copy.target,userId:'17',username:'erp-semih-test-20261012',displayName:'Semih TEST',role:{id:'2',code:'admin'},fingerprint:createHash('sha256').update(JSON.stringify(['17','erp-semih-test-20261012',2,'admin',['product.view','settings.manage'],'fixture-bcrypt-only'])).digest('hex')};

test('clean protected grants preserve only exact existing non-admin actor identities with fresh SQL fingerprints',()=>{
 const clean={environment:'CLEAN_SYNTHETIC_TEST',environmentId:'e662fd94-d797-4b3b-938a-d143ad758b67',database:'MELISA_ERP_CLEAN_TEST_20261022',synthetic:true,actualT1:false,externalOperations:false};
 const u=()=>bindNormalTestFingerprint({id:18,username:'ornek-depo',role:{id:23,code:'clean_test_warehouse'},permissions:['product.view']},{password_hash:'fixture-hash'});
 assert.equal(allowsProtectedNormalTestUser(u(),{clean}),true);
 for(const patch of [{id:15},{username:'Mehmet'},{role:{id:2,code:'admin'}},{isAdmin:true},{testAdminSession:true},{isActive:false},{permissions:null}]){const actor=u();Object.assign(actor,patch);assert.equal(allowsProtectedNormalTestUser(actor,{clean}),false);}
 assert.equal(allowsProtectedNormalTestUser({...u()},{clean}),false);
 assert.equal(allowsProtectedNormalTestUser(u(),{clean:{...clean,actualT1:true}}),false);assert.equal(allowsProtectedNormalTestUser(u(),{clean,copy}),false);
 const semih=bindNormalTestFingerprint({id:10018,username:'semih',role:{id:28,code:'clean_test_administrator'},permissions:['product.view']},{password_hash:'fixture-hash'});assert.equal(allowsProtectedNormalTestUser(semih,{clean}),true);
});
test('dedicated identity binds fresh user role permissions and password fingerprint',()=>{
 const p=validateSemihTestIdentity(profile,copy);assert.equal(matchesSemihTestUser(makeUser(),p),true);
 for(const edit of [u=>u.username='admin',u=>u.displayName='Other',u=>u.id=15,u=>u.role.code='isolated_test_sales',u=>u.role.id=3]){const u=makeUser();edit(u);assert.equal(matchesSemihTestUser(u,p),false);}
 const changedPermissions=makeUser();changedPermissions.permissions.push('new.permission');
 assert.equal(matchesSemihTestUser(bindNormalTestFingerprint({...changedPermissions},{password_hash:'fixture-bcrypt-only'}),p),false);
 assert.equal(matchesSemihTestUser(bindNormalTestFingerprint({...makeUser()},{password_hash:'changed-fixture'}),p),false);
});
test('LIVE, wrong copy, T1, alias, sealed actors, other admin and unexpected fields reject',()=>{
 for(const c of [{...copy,actualT1:true},{...copy,copyId:'other'},{...copy,target:{...copy.target,database:'LIVE'}}])assert.throws(()=>validateSemihTestIdentity(profile,c));
 for(const p of [{...profile,userId:'15'},{...profile,userId:'16'},{...profile,username:'admin'},{...profile,role:{id:'3',code:'admin'}},{...profile,extra:true},{...profile,fingerprint:'no'}])assert.throws(()=>validateSemihTestIdentity(p,copy));
});
test('unconfigured preserves only legacy protected actors and never grants Semih',()=>{
 assert.equal(configuredSemihTestIdentity({copy,config:{}}),null);assert.equal(allowsProtectedNormalTestUser({id:15},{copy,config:{}}),true);assert.equal(allowsProtectedNormalTestUser({id:16},{copy,config:{}}),true);assert.equal(allowsProtectedNormalTestUser(makeUser(),{copy,config:{}}),false);
});
test('partial config, path escape, wrong hash and missing profile fail closed without secrets',()=>{
 for(const config of [{MELISA_TEST_SEMIH_IDENTITY_PATH:'C:/Sirket/ERP/runtime/missing.json'},{MELISA_TEST_SEMIH_IDENTITY_SHA256:'a'.repeat(64)},{MELISA_TEST_SEMIH_IDENTITY_PATH:'C:/outside/missing.json',MELISA_TEST_SEMIH_IDENTITY_SHA256:'a'.repeat(64)},{MELISA_TEST_SEMIH_IDENTITY_PATH:'C:/Sirket/ERP/runtime/missing.json',MELISA_TEST_SEMIH_IDENTITY_SHA256:'a'.repeat(64)}])assert.throws(()=>configuredSemihTestIdentity({copy,config}),{code:'AUTH_TEST_SEMIH_IDENTITY_INVALID'});
});
