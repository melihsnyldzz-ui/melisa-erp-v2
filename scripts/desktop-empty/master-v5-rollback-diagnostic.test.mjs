// Static checks over generated SQL only. No SQL connection or process launch.
import test from 'node:test';
import assert from 'node:assert/strict';
import {compileMasterV5RollbackDiagnostic} from './master-v5-rollback-diagnostic.mjs';
import {compileMasterV5Transition} from './master-v5-transition.mjs';
import {DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL} from '../../apps/api/src/config/desktopMasterV3Policy.mjs';
import {DESKTOP_MASTER_V5_PERMISSION_GUARD_SQL,DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL,DESKTOP_MASTER_V5_CHECKS} from '../../apps/api/src/config/desktopMasterV5Policy.mjs';
const baseline={metadataSha256:'a'.repeat(64),securitySha256:'b'.repeat(64),businessRowsSha256:'c'.repeat(64)};
const original=()=>compileMasterV5Transition({mode:'rollback',...baseline});
const labels=sql=>[...sql.matchAll(/\bTHROW\s+\d+\s*,\s*N?('{1,2})((?:MASTER_V5|DESKTOP|LOCAL_MASTER)_[A-Z0-9_]+)\1\s*,\s*\d+\s*;/g)].map(x=>x[2]);
test('deterministic diagnostic pins target/baseline without changing ordinary compiler output',()=>{
 const before=original(),a=compileMasterV5RollbackDiagnostic(baseline),b=compileMasterV5RollbackDiagnostic({...baseline}),after=original();
 assert.equal(a.sql,b.sql);assert.equal(a.sha256,b.sha256);assert.deepEqual(a.target,before.target);assert.deepEqual(a.baseline,baseline);assert.equal(a.target.database,'MELISA_ERP_DESKTOP_TEST_20261105');assert.equal(a.mode,'diagnose');assert.equal(a.candidate,null);assert.equal(a.scope.diagnosticOnly,true);assert.equal(a.scope.createsAdmissionProof,false);assert.equal(a.sqlTested,false);assert.equal(a.requiresIndependentReadback,true);assert.equal(before.sql,after.sql);assert.equal(before.sha256,after.sha256);
});
test('original rollback guards, four narrow effective permissions and pre/post proofs survive',()=>{
 const a=compileMasterV5RollbackDiagnostic(baseline),s=a.sql,o=original().sql;
 for(const guard of [DESKTOP_MASTER_V3_PERMISSION_GUARD_SQL,DESKTOP_MASTER_V5_PERMISSION_GUARD_SQL,DESKTOP_MASTER_V5_SCHEMA_GUARD_SQL])assert.ok(s.includes(guard));
 for(const [name,definition] of Object.entries(DESKTOP_MASTER_V5_CHECKS)){assert.ok(s.includes(name));assert.ok(s.includes(definition.replaceAll("'","''")));}
 for(const label of new Set(labels(o)))assert.ok(s.includes("'"+label+"'"),label);
 assert.equal((s.match(/\bGRANT\s/gi)||[]).length,2);assert.match(s,/GRANT UPDATE ON OBJECT::dbo\.sales_invoices\(cancelled_at,cancel_reason,updated_by\)/);assert.match(s,/GRANT SELECT ON OBJECT::dbo\.terminal_sync_queue/);
 assert.match(s,/VALUES\(-30002,@operatorRole,N'sales\.cancel'/);assert.match(s,/MASTER_V5_ROLLBACK_IDENTITY_DRIFT/);assert.match(s,/MASTER_V5_ROLLBACK_DRIFT/);for(const h of Object.values(baseline))assert.ok(s.includes(h));
 assert.doesNotMatch(s,/\bCOMMIT\s+TRAN(?:SACTION)?\b|\bCREATE\s+(?:LOGIN|USER|ROLE)\b|\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?dbo\.(?:sales_invoices|products|customers|stock_movements|customer_movements)\b/i);
});
test('both result states are diagnostic only and metadata is captured before rollback',()=>{
 const s=compileMasterV5RollbackDiagnostic(baseline).sql;
 assert.match(s,/SELECT N'MASTER_V5_DIAGNOSTIC_ROLLED_BACK' state/);assert.match(s,/SELECT N'MASTER_V5_DIAGNOSTIC_ROLLED_BACK_ERROR' state/);assert.doesNotMatch(s,/SELECT N'MASTER_V5_(?:ROLLED_BACK|COMMITTED_UNVERIFIED)' state/);
 for(const name of ['Checks','Rights','Permissions']){const at=s.indexOf('SET @diagnostic'+name+'='),rollback=s.indexOf('ROLLBACK TRANSACTION;\n IF ISNULL(IDENT_CURRENT');assert.ok(at>=0&&at<rollback,name);}
 assert.match(s,/FOR JSON PATH,INCLUDE_NULL_VALUES/);assert.match(s,/ERROR_NUMBER\(\).*ERROR_MESSAGE\(\)/s);assert.doesNotMatch(s,/SELECT\s+@diagnosticMessage\b/i);
});
test('error path cannot claim identity proof when pre-trial identity was never captured',()=>{
 const s=compileMasterV5RollbackDiagnostic(baseline).sql,catchAt=s.lastIndexOf('END TRY BEGIN CATCH'),resultAt=s.lastIndexOf("SELECT N'MASTER_V5_DIAGNOSTIC_ROLLED_BACK_ERROR' state"),identityAt=s.indexOf('MASTER_V5_ROLLBACK_IDENTITY_DRIFT',catchAt);
 assert.ok(catchAt>=0&&identityAt>catchAt&&resultAt>identityAt);
 assert.match(s.slice(catchAt,identityAt),/@permissionIdentity\s+IS\s+NULL/i);
});
test('error labels are restricted to THROW labels from original SQL',()=>{
 const s=compileMasterV5RollbackDiagnostic(baseline).sql,o=original().sql;
 const match=s.match(/@diagnosticMessage COLLATE Latin1_General_100_BIN2 IN\(([^)]*)\)/);assert.ok(match);
 const emitted=[...match[1].matchAll(/N'([^']+)'/g)].map(x=>x[1]).sort();assert.deepEqual(emitted,[...new Set(labels(o))].sort());
});
test('invalid baseline fields and hashes reject',()=>{
 for(const input of [undefined,null,{}, {...baseline,mode:'rollback'}, {...baseline,metadataSha256:'not-a-hash'}, {...baseline,securitySha256:'A'.repeat(64)}, {...baseline,businessRowsSha256:null}])assert.throws(()=>compileMasterV5RollbackDiagnostic(input));
});
