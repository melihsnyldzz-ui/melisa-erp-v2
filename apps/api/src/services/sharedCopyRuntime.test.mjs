import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureContext,fixtureIdentity} from './isolatedOperationCopyContext.test.mjs';
import {SHARED_COPY_DATABASE,isolatedCopyHash,validateIsolatedOperationCopyContext,assertIsolatedCopyIdentity,isolatedCopyTopology} from './isolatedOperationCopyContext.mjs';
import {sharedCopyAuthClaims} from './sharedCopyAuthClaims.mjs';
import {assertSharedCopyRelease} from './sharedCopyRelease.mjs';
import {copyRecoveryProjection} from './workSystemService.mjs';

function raw(){const c=fixtureContext();c.target={...c.target,database:SHARED_COPY_DATABASE,login:'melisa_shared_test_rw_20261009_01',databaseUser:'melisa_shared_test_rw_20261009_01'};c.date='2026-10-09';c.products=[{...c.products[0],id:'29980'},{...c.products[0],id:'30003'}];c.customers[0].id='210';c.suppliers[0].id='10162';c.suppliers[0].currency='TRY';c.financeAccounts=[{...c.financeAccounts[0],id:'20043'}];return seal(c);}
function seal(c){const {sealHash,...body}=c;return {...body,sealHash:isolatedCopyHash(body)};}
test('shared copy auth binds the fresh copy without changing user role claims',()=>{
 const c=validateIsolatedOperationCopyContext(raw()),user={sub:'23',role:'sales'};
 assert.deepEqual({...user,...sharedCopyAuthClaims(c)},{...user,database:SHARED_COPY_DATABASE,isolatedOperationCopy:c.copyId});
 assert.deepEqual(sharedCopyAuthClaims(null),{});assert.deepEqual(sharedCopyAuthClaims(validateIsolatedOperationCopyContext(fixtureContext())),{});
 assert.throws(()=>sharedCopyAuthClaims(structuredClone(c)));assert.equal(isolatedCopyTopology(c).apiPort,4174);
 assertIsolatedCopyIdentity(c,fixtureIdentity(c));assert.throws(()=>assertIsolatedCopyIdentity(c,{...fixtureIdentity(c),originalDatabaseAccess:1}));
});
test('finite shared profile rejects another product, foreign currency, source target and old writer',()=>{
 for(const mutate of [c=>c.products[0].id='34765',c=>c.suppliers[0].currency='USD',c=>c.target.login=c.target.databaseUser='melisa_stage4_copy_rw_20261008_01',c=>c.target.database='MELISA_ERP_SIRKET_TEST_20260929_01',c=>c.date='2026-10-08']){const c=raw();mutate(c);assert.throws(()=>validateIsolatedOperationCopyContext(seal(c)));}
});
test('shared bootstrap release pins must include shared ports, LAN and native boundary',()=>{
 const release={sourceCommit:'a'.repeat(40),packageId:'CANONICAL-TEST-proof',sharedTestCopy:{database:SHARED_COPY_DATABASE,apiPort:4174,nativePort:4176,webPort:5224,host:'127.0.0.1',lanHost:'192.168.1.46',nativeLoopbackOnly:true,nativeWrites:false,externalOperations:false,actualT1:false}};
 assertSharedCopyRelease(release);
 for(const mutate of [r=>delete r.sharedTestCopy,r=>r.sharedTestCopy.apiPort=4144,r=>r.sharedTestCopy.database='MELISA_ERP_SIRKET_TEST_20260929_01',r=>r.sharedTestCopy.nativeWrites=true,r=>r.sharedTestCopy.actualT1=true]){const r=structuredClone(release);mutate(r);assert.throws(()=>assertSharedCopyRelease(r));}
});
test('shared restore status requires the new raw-copy comparison and rejects inherited old proof',()=>{
 const c=raw();c.recoveryProof={schemaVersion:'melisa-shared-test.recovery-comparison.v1',status:'PASS',comparedAt:'2026-10-09T13:00:00.000Z',tablesCompared:51,moduleDefinitionsCompared:337,sourceBeforeAfterEqual:true,rawCopyMatchesSource:true,changed:[],hashBasis:'SQL_FULL_ROW_JSON_UTF16_SHA256_SORTED_MULTISET',actualRestorePerformed:true,activeDatabaseOverwritten:false,coverage:'51 critical ERP/CRM tables; not all database rows'};
 assert.equal(copyRecoveryProjection(validateIsolatedOperationCopyContext(seal(c))).restore.status,'success');
 for(const mutate of [p=>p.schemaVersion='melisa-stage4.recovery-comparison.v1',p=>p.rawCopyMatchesSource=false,p=>p.tablesCompared=29,p=>p.changed=['dbo.crm_order_v2_requests']]){const bad=structuredClone(c);mutate(bad.recoveryProof);assert.equal(copyRecoveryProjection(validateIsolatedOperationCopyContext(seal(bad))).restore.status,'unknown');}
});
