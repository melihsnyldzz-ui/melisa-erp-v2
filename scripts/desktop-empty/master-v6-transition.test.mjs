import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileMasterV6Transition,compileMasterV6Readback,compileMasterV6ApplyObserver,compileMasterV6BaselineObserver,MASTER_V6_TRANSITION_SCOPE,MASTER_V6_IDENTITY_BASELINE} from './master-v6-transition.mjs';
import {DESKTOP_MASTER_V5_PERMISSION_MANIFEST} from '../../apps/api/src/config/desktopMasterV5Policy.mjs';
import {DESKTOP_GOODS_V6_PERMISSION_MANIFEST} from '../../apps/api/src/config/desktopGoodsV6Policy.mjs';

const baseline=Object.freeze({metadataSha256:'a'.repeat(64),securitySha256:'b'.repeat(64),businessRowsSha256:'c'.repeat(64)});
const candidate=Object.freeze({candidateMetadataSemanticSha256:'d'.repeat(64),candidateSecuritySemanticSha256:'e'.repeat(64)});
const digest=s=>createHash('sha256').update(s).digest('hex');

test('fixed transition cannot accept a caller-selected target, SQL or unproven apply hashes',()=>{
 for(const bad of [null,[],{mode:'apply',...baseline},{mode:'rollback',...baseline,server:'LIVE'},{mode:'rollback',...baseline,sql:'DROP DATABASE x'},{mode:'rollback',...baseline,metadataSha256:"';COMMIT;--"},{mode:'other',...baseline},{mode:'rollback',...baseline,...candidate}])assert.throws(()=>compileMasterV6Transition(bad),/MASTER_V6_OPTIONS_REJECTED/);
 assert.throws(()=>compileMasterV6ApplyObserver({originalJson:'{}',originalSha256:'a'.repeat(64),...candidate}));
});

test('rollback trial binds the real target and baseline, preserves old identities and cleans identity state in its own scope',()=>{
 const p=compileMasterV6Transition({mode:'rollback',...baseline});
 assert.equal(p.sqlTested,false);assert.equal(p.requiresIndependentReadback,true);assert.equal(p.target.databaseId,5);assert.equal(p.target.serverProcessId,5240);
 assert.equal(p.target.databaseGuid,'c67f5317-9c0d-4831-aadd-fadc379a95d1');
 assert.match(p.sql,/MASTER_V6_BASELINE_DRIFT/);assert.match(p.sql,/WITH\(TABLOCKX,HOLDLOCK\)/);
 assert.match(p.sql,/LOCAL_MASTER_CONCURRENT_OR_TRIGGER_REJECTED/);assert.match(p.sql,/security_id=0x417717302D2EFA478380226433A0BCA6/);
 assert.match(p.sql,/SET IDENTITY_INSERT dbo.system_settings ON;SET @identityTable=N'system_settings'/);
 assert.doesNotMatch(p.sql,/@identityTable sysname OUTPUT/);
 assert.match(p.sql,/IF @identityTable=N'system_settings' SET IDENTITY_INSERT dbo.system_settings OFF/);
 assert.match(p.sql,/V6_ROLLBACK_IDENTITY_DRIFT/);assert.match(p.sql,/i\.last_value/);
 assert.match(p.sql,/MASTER_V6_ROLLBACK_DRIFT/);assert.doesNotMatch(p.sql,/COMMIT TRANSACTION/);
 for(const n of [-30101,-30102,-30103,-30104,-30105,-30106])assert.ok(p.sql.includes('('+n+',@operatorRole,'));
 assert.doesNotMatch(p.sql,/\b(?:DBCC|CREATE LOGIN|CREATE USER|CREATE ROLE|DROP DATABASE|TRUNCATE)\b/);
 assert.doesNotMatch(p.sql,/UPDATE dbo\.(?:products|suppliers|customers|roles|sales_invoices)\b|DELETE FROM dbo\./);
 assert.equal(p.sha256,digest(p.sql));assert.equal(compileMasterV6Transition({mode:'rollback',...baseline}).sha256,p.sha256);
});

test('apply checks semantic metadata and ACL before its single commit and allocates only six rights and two settings',()=>{
 const p=compileMasterV6Transition({mode:'apply',...baseline,...candidate});
 assert.equal(p.requiresVerifiedRollbackProof,true);assert.equal(p.scope.newTables,4);assert.equal(p.scope.addedNullableColumns,14);
 assert.equal(p.scope.newPrincipals,0);assert.equal(p.scope.newPasswords,0);assert.equal(p.scope.newOperatorPermissions,6);
 const old=new Set(DESKTOP_MASTER_V5_PERMISSION_MANIFEST.map(x=>JSON.stringify(x))),extra=DESKTOP_GOODS_V6_PERMISSION_MANIFEST.filter(x=>!old.has(JSON.stringify(x)));
 assert.equal((p.sql.match(/\bGRANT /g)||[]).length,extra.length);assert.equal(MASTER_V6_TRANSITION_SCOPE.newSqlRights,extra.length);
 assert.equal((p.sql.match(/COMMIT TRANSACTION/g)||[]).length,1);assert.ok(p.sql.indexOf('MASTER_V6_CANDIDATE_DRIFT')<p.sql.indexOf('COMMIT TRANSACTION'));
 assert.match(p.sql,/IDENT_CURRENT\(N'dbo.permissions'\)<>@permissionIdentity\+6/);assert.match(p.sql,/id BETWEEN 50 AND 55/);
 assert.deepEqual(MASTER_V6_IDENTITY_BASELINE,{permissions:49,settings:2,settingsLastValue:'2'});
 assert.match(p.sql,/@permissionIdentity<>49 OR @settingsIdentity<>2/);
 assert.doesNotMatch(p.sql,/SET IDENTITY_INSERT dbo\.(?:permissions|system_settings) ON/);
 assert.match(p.sql,/V6_OLD_BUSINESS_DRIFT/);assert.match(p.sql,/V6_OLD_SECURITY_ROWS_DRIFT/);
 assert.ok(p.sql.includes(candidate.candidateMetadataSemanticSha256));assert.ok(p.sql.includes(candidate.candidateSecuritySemanticSha256));
 assert.equal(p.sha256,digest(p.sql));
});

test('later readback hashes all 37 business tables while keeping target, metadata and coherent read locks',()=>{
 const stopped=compileMasterV6Readback(),running=compileMasterV6Readback({appMayBeRunning:true});
 assert.equal(stopped.readOnly,true);assert.equal(running.readOnly,true);
 assert.match(stopped.sql,/LOCAL_MASTER_CONCURRENT_OR_TRIGGER_REJECTED/);assert.doesNotMatch(running.sql,/LOCAL_MASTER_CONCURRENT_OR_TRIGGER_REJECTED/);
 for(const p of [stopped,running]){assert.match(p.sql,/WITH\(TABLOCK,HOLDLOCK\)/);assert.match(p.sql,/<>40/);assert.match(p.sql,/<>37/);assert.match(p.sql,/schema_version=6/);assert.match(p.sql,/metadataJson/);assert.match(p.sql,/businessTablesJson/);assert.doesNotMatch(p.sql,/\b(?:ALTER TABLE|GRANT |INSERT dbo\.|DELETE FROM dbo\.|UPDATE dbo\.)/);assert.equal(p.sha256,digest(p.sql));}
 for(const bad of [{appMayBeRunning:'true'},{server:'LIVE'},[],null])assert.throws(()=>compileMasterV6Readback(bad));
});

test('baseline observer exports only original metadata and digests on the current preserved identities',()=>{
 const p=compileMasterV6BaselineObserver();assert.equal(p.readOnly,true);assert.match(p.sql,/IDENT_CURRENT\(N'dbo.permissions'\)<>49/);assert.match(p.sql,/originalSha256/);assert.match(p.sql,/schema_version=5/);assert.match(p.sql,/LOCAL_MASTER_CONCURRENT_OR_TRIGGER_REJECTED/);assert.doesNotMatch(p.sql,/\b(?:ALTER TABLE|GRANT |INSERT dbo\.|DELETE FROM dbo\.|UPDATE dbo\.)/);assert.equal(p.sha256,digest(p.sql));
});
