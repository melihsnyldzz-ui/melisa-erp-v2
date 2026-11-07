import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRehearsalIdentity,REHEARSAL_SERVER,REHEARSAL_DATABASE} from './identity.mjs';

const valid={server:REHEARSAL_SERVER,database:REHEARSAL_DATABASE,databaseId:11,databaseGuid:'e2a89d24-3984-4bbf-8a3f-d1485c667234',databaseCreateTime:'2026-11-07T10:00:00.000',environmentId:'ab621184-82bf-4d09-8257-d2d9b0657372',adminPid:12000,adminProcessBirth:'2026-11-07T09:00:00.000000Z',adminSid:'0x0102030405060708',sqlProcessId:5240,sqlProcessBirth:'2026-11-05T14:17:00.247024Z'};
test('identity requires every exact field and immutable distinct synthetic target identities',()=>{
 assert.deepEqual(validateRehearsalIdentity(valid),valid);
 for(const change of [{server:'OTHER'},{database:'MELISA_ERP_DESKTOP_TEST_20261105'},{database:'MELISA_ERP_RESTORE_CHECK_20261106_D2DA15E3'},{database:'LAB'},{database:'LAB2'},{databaseId:5},{databaseGuid:'c67f5317-9c0d-4831-aadd-fadc379a95d1'},{databaseGuid:'fa7492c4-a52e-4d49-806e-f99bbafdd656'},{databaseGuid:'07e987d9-e7d6-49a5-9339-53ac93205545'},{environmentId:valid.databaseGuid},{adminPid:5240},{adminSid:'0x12'},{databaseCreateTime:'2026-02-30T10:00:00.000Z'},{extra:true}])assert.throws(()=>validateRehearsalIdentity({...valid,...change}),/K0210_IDENTITY_REJECTED/);
 for(const key of Object.keys(valid)){const copy={...valid};delete copy[key];assert.throws(()=>validateRehearsalIdentity(copy),/K0210_IDENTITY_REJECTED/);}
 assert.throws(()=>validateRehearsalIdentity({...valid,databaseId:6}),/K0210_IDENTITY_REJECTED/);assert.throws(()=>validateRehearsalIdentity({...valid,databaseId:7}),/K0210_IDENTITY_REJECTED/);
 assert.throws(()=>validateRehearsalIdentity({...valid,databaseCreateTime:'2026-02-30T10:00:00.000'}),/K0210_IDENTITY_REJECTED/);
 let accessed=false;const getter={...valid};Object.defineProperty(getter,'databaseGuid',{enumerable:true,get(){accessed=true;return valid.databaseGuid;}});assert.throws(()=>validateRehearsalIdentity(getter));assert.equal(accessed,false);assert.throws(()=>validateRehearsalIdentity({...valid,[Symbol('hidden')]:1}));
});
