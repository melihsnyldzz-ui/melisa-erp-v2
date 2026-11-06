import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileDesktopEmptyBootstrap} from './bootstrap-sql.mjs';
import {compileDesktopRollbackProbe,desktopRollbackCommandPlan,createDesktopRollbackAttempt,
 startDesktopRollbackProbe,ROLLBACK_PROBE_REQUIREMENTS} from './rollback-probe.mjs';

const originalHash='9ab2cc9dca7437ac30233f005a3d6277ef0d5eab12310046c2033b2541aa120b';
const injection=" THROW 51990, 'DESKTOP_ROLLBACK_PROBE_REACHED', 1;\n";
const anchor=" COMMIT TRANSACTION;\n SELECT N'DESKTOP_EMPTY_SCHEMA_APPLIED' AS outcome;";
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');

test('only one controlled error is inserted immediately before the original commit',()=>{
 const base=compileDesktopEmptyBootstrap(),probe=compileDesktopRollbackProbe();
 assert.equal(base.sqlSha256,originalHash);assert.equal(sha(base.sql),originalHash);
 assert.equal(probe.originalSha256,originalHash);assert.equal(probe.probeSha256,sha(probe.sql));
 assert.notEqual(probe.probeSha256,originalHash);
 assert.equal(probe.sql.split(injection).length-1,1);assert.equal(base.sql.split(anchor).length-1,1);
 assert.ok(probe.sql.includes(injection+anchor));
 assert.equal(probe.sql.replace(injection,''),base.sql);
 assert.equal(sha(probe.sql.replace(injection,'')),originalHash);
 assert.equal(probe.batchCount,41);assert.equal(probe.expectedTableCount,27);assert.equal(probe.expectedEmptyTableCount,26);
 assert.equal(probe.expectedErrorNumber,51990);assert.equal(probe.requirements.executionAuthorized,false);
 assert.ok(Object.isFrozen(probe));assert.ok(Object.isFrozen(probe.requirements));
});

test('any original byte drift, extra options or accessors fail before output',()=>{
 const base=compileDesktopEmptyBootstrap().sql;
 for(const originalSql of [base+'\n',base.replace(anchor,anchor+anchor),base.replace('COMMIT TRANSACTION','ROLLBACK TRANSACTION'),
  base.replace('DESKTOP_EMPTY_SCHEMA_APPLIED','DIFFERENT'),base.replace(anchor,injection+anchor)]){
  assert.throws(()=>compileDesktopRollbackProbe({originalSql}),/PROBE_ORIGINAL_REJECTED/);
 }
 assert.throws(()=>compileDesktopRollbackProbe({server:'other'}),/PROBE_OPTIONS_REJECTED/);
 const options={};let invoked=false;Object.defineProperty(options,'originalSql',{enumerable:true,get(){invoked=true;return base;}});
 assert.throws(()=>compileDesktopRollbackProbe(options),/PROBE_OPTIONS_REJECTED/);assert.equal(invoked,false);
 assert.equal(compileDesktopRollbackProbe({originalSql:base}).probeSha256,compileDesktopRollbackProbe().probeSha256);
});

test('SQLCMD plan is pinned, local, bounded and has no authority to dispatch',()=>{
 const plan=desktopRollbackCommandPlan();
 assert.equal(plan.executable,'C:\\Program Files\\Microsoft SQL Server\\Client SDK\\ODBC\\170\\Tools\\Binn\\SQLCMD.EXE');
 assert.equal(plan.executableSha256,'7220b526ab97b0a5b30ed7b09c497ab7fad39141090f8801d68691c38ff248da');
 assert.deepEqual(plan.args,['-S','lpc:Semih\\MELISAERP','-d','MELISA_ERP_DESKTOP_TEST_20261105','-E','-b','-r1','-X1','-x','-l','10']);
 assert.equal(plan.shell,false);assert.equal(plan.windowsHide,true);assert.equal(plan.maxOutputBytes,8192);
 assert.equal(plan.stdinEncoding,'UNVERIFIED_SQLCMD_ENCODING');assert.equal(plan.exitCodeAloneIsNotSuccess,true);
 assert.equal(plan.executionAuthorized,false);assert.ok(Object.isFrozen(plan.args));
});

test('executor is hard disabled and requirements do not equate errors with rollback',()=>{
 for(const candidate of [undefined,{}, {approved:true}, {error:51990,readback:true}])
  assert.throws(()=>startDesktopRollbackProbe(candidate),/PROBE_EXECUTOR_NOT_AUTHORIZED/);
 assert.equal(ROLLBACK_PROBE_REQUIREMENTS.requiresIndependentIdentityBoundReadback,true);
 assert.equal(ROLLBACK_PROBE_REQUIREMENTS.requiresClosedChildAndResolvedSession,true);
 assert.equal(ROLLBACK_PROBE_REQUIREMENTS.requiresExclusiveTargetOwner,true);
 assert.equal(ROLLBACK_PROBE_REQUIREMENTS.noAutomaticRetry,true);
 assert.equal(ROLLBACK_PROBE_REQUIREMENTS.requiresDirectoryCrashDurabilityProof,true);
 assert.equal(ROLLBACK_PROBE_REQUIREMENTS.commercialData,'NONE');
});

test('invalid attempt evidence is rejected before any filesystem access',async()=>{
 const p=compileDesktopRollbackProbe();
 const input={server:p.server,database:p.database,environmentId:p.environmentId,originalSha256:p.originalSha256,
  probeSha256:p.probeSha256,databaseId:8,databaseCreateDate:'2026-11-05T00:00:00.000Z',
  databaseGuid:'eb2888c2-51cb-4570-a933-397cf7e62806',serverProcessId:1234};
 for(const bad of [{...input,server:'Semih\\MELISADEV'},{...input,database:'master'},{...input,probeSha256:'0'.repeat(64)},
  {...input,originalSha256:'0'.repeat(64)},{...input,databaseId:4},{...input,databaseGuid:'bad'},
  {...input,serverProcessId:0},{...input,unexpected:true}]){
  await assert.rejects(createDesktopRollbackAttempt(bad),/PROBE_EVIDENCE_REJECTED/);
 }
});
