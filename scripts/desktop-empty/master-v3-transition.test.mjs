import test from 'node:test';
import assert from 'node:assert/strict';
import {MASTER_V3_TARGET,MASTER_V3_TRANSITION_SCOPE,MASTER_V3_REQUIRED_PROOFS,compileMasterV3Transition,masterV3PolicyConsistency} from './master-v3-transition.mjs';
const hashes={metadataSha256:'a'.repeat(64),securitySha256:'b'.repeat(64),businessRowsSha256:'c'.repeat(64)};
test('V3 plan targets only the explicitly named instance and existing role',()=>{
 assert.equal(MASTER_V3_TARGET.databaseId,5);assert.equal(MASTER_V3_TARGET.serverProcessId,5240);
 assert.equal(MASTER_V3_TARGET.operatorId,30002);assert.equal(MASTER_V3_TARGET.writerRole,'desktop_local_writer_v2');
 assert.equal(MASTER_V3_TRANSITION_SCOPE.expectedTableCount,36);assert.equal(masterV3PolicyConsistency(),true);
 assert.deepEqual(MASTER_V3_TRANSITION_SCOPE.addedSqlGrants,['INSERT dbo.suppliers','UPDATE dbo.suppliers(party_entity_id)']);
 assert(Object.isFrozen(MASTER_V3_TRANSITION_SCOPE.preserve));assert(MASTER_V3_REQUIRED_PROOFS.some(s=>s.includes('unknown outcome')));
});
test('compile rejects malformed or unspecified comparison inputs',()=>{
 for(const arg of [{},{mode:'apply',...hashes,extra:true},{mode:'apply',...hashes,securitySha256:'A'.repeat(64)},{mode:'other',...hashes}])assert.throws(()=>compileMasterV3Transition(arg),{code:'MASTER_V3_OPTIONS_REJECTED'});
});

test('rollback trial has no commit path and compares all three restored hashes',()=>{
 const p=compileMasterV3Transition({mode:'rollback',...hashes});
 assert.equal(p.requiresIndependentReadback,true);assert.equal(p.credentialsChanged,false);assert.equal(p.sqlTested,false);
 assert.match(p.sql,/ROLLBACK TRANSACTION;\s*EXEC sys\.sp_executesql/);
 assert.match(p.sql,/MASTER_V3_ROLLBACK_DRIFT/);assert.match(p.sql,/MASTER_V3_ROLLED_BACK/);
 assert.doesNotMatch(p.sql,/COMMIT TRANSACTION;/);
});
test('apply commits once only after business, security, schema, permission and transaction checks',()=>{
 const p=compileMasterV3Transition({mode:'apply',...hashes}),q=p.sql;
 assert.equal(q.split('COMMIT TRANSACTION;').length,2);
 for(const guard of ['MASTER_V3_SECURITY_DIFF','MASTER_V3_SCHEMA_READBACK','MASTER_V3_BUSINESS_ROWS_CHANGED','MASTER_V3_TRANSACTION_REJECTED'])assert(q.indexOf(guard)<q.indexOf('COMMIT TRANSACTION;'));
 assert.match(q,/MASTER_V3_COMMITTED_UNVERIFIED/);assert.match(q,/SET @impersonating=1/);assert.match(q,/IF @impersonating=1 BEGIN TRY REVERT/);
 assert.match(q,/DESKTOP_WRITE_OBJECT_PERMISSION_REJECTED/);assert.match(q,/LOCAL_MASTER_CONCURRENT_OR_TRIGGER_REJECTED/);
 assert.match(q,/TABLOCKX,HOLDLOCK/);assert.match(q,/MASTER_V3_BASELINE_DRIFT/);
 assert.doesNotMatch(q,/ALTER LOGIN|CREATE LOGIN|CREATE USER|DROP TABLE|DROP DATABASE|WITH REPLACE|DELETE FROM dbo/i);
 assert.match(q,/GRANT INSERT ON OBJECT::dbo\.suppliers/);assert.match(q,/GRANT UPDATE ON OBJECT::dbo\.suppliers\(party_entity_id\)/);
 assert.equal((q.match(/GRANT INSERT ON OBJECT/g)||[]).length,1);assert.equal((q.match(/GRANT UPDATE ON OBJECT/g)||[]).length,1);
 assert.match(q,/COUNT_BIG\(\*\) FROM dbo\.permissions WHERE role_id=@operatorRole\)<>9/);
 assert.match(q,/COUNT_BIG\(\*\) FROM dbo\.permissions WHERE role_id=@operatorRole\)<>10/);
});
test('snapshot helpers retain bounded table and permission metadata scope',async()=>{
 const m=await import('./master-v3-transition.mjs');
 assert.match(m.MASTER_V3_BUSINESS_SNAPSHOT_SQL,/key_ordinal>0/);assert.match(m.MASTER_V3_BUSINESS_SNAPSHOT_SQL,/ORDER BY table_name FOR JSON/);
 assert.match(m.MASTER_V3_BUSINESS_SNAPSHOT_SQL,/desktop_empty_installation.*roles.*permissions/);
 assert.match(m.MASTER_V3_SECURITY_SNAPSHOT_SQL,/sys\.database_permissions/);assert.doesNotMatch(m.MASTER_V3_SECURITY_SNAPSHOT_SQL,/password_hash|credential/i);
});
test('read-only observer compiles fixed target and emits digests only',async()=>{
 const {compileMasterV3Snapshot}=await import('./master-v3-transition.mjs');const p=compileMasterV3Snapshot();
 assert.equal(p.readOnly,true);assert.equal(p.sqlTested,false);assert.match(p.sql,/Semih\\MELISAERP/);assert.match(p.sql,/SEMIH\\Xaser/);
 assert.match(p.sql,/metadataSha256,@v3_security_sha securitySha256,@v3_business_sha businessRowsSha256/);
 assert.doesNotMatch(p.sql,/\b(?:CREATE|ALTER|GRANT|REVOKE|DELETE|UPDATE|INSERT)\s+(?:TABLE|ROLE|LOGIN|USER|INTO dbo)/i);
});
