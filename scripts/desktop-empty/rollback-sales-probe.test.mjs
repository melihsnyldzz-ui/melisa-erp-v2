import test from 'node:test';
import assert from 'node:assert/strict';
import {compileDesktopSalesBootstrap} from './bootstrap-sales-proposal.mjs';
import {compileSalesRollbackProbe,compileSalesRollbackReadback} from './rollback-sales-probe.mjs';

test('45-batch probe inserts only controlled error at commit and preserves all original bytes',()=>{
 const base=compileDesktopSalesBootstrap(),probe=compileSalesRollbackProbe();
 const inject=" THROW 51990, 'DESKTOP_SALES_ROLLBACK_PROBE_REACHED', 1;\n";
 assert.equal(base.sqlSha256,'e4f0eb89743f497e761a02ebd6be6a74742d188f88fbaae77086292964ee7f1d');
 assert.equal(probe.batchCount,45);assert.equal(probe.sql.split(inject).length,2);
 assert.equal(probe.sql.replace(inject,''),base.sql);
 assert.match(probe.sql,/DESKTOP_SALES_ROLLBACK_PROBE_REACHED', 1;\n COMMIT TRANSACTION/);
 assert.match(probe.sql,/IF XACT_STATE\(\)<>0 ROLLBACK TRANSACTION/);
 assert.equal(probe.commercialData,'NONE');
 assert.equal(probe.executionAuthorized,false);assert.equal(probe.requiresExclusiveTargetOwner,true);
 assert.equal(probe.requiresClosedProcess,true);assert.equal(probe.requiresIndependentIdentityBoundReadback,true);
 assert.equal(probe.noAutomaticRetry,true);
});
test('independent empty readback is bound to 45-batch proposal and probe hashes',()=>{
 const p=compileSalesRollbackProbe(),r=compileSalesRollbackReadback({databaseId:8,databaseCreateDate:'2026-11-05T00:00:00.000',
  databaseGuid:'eb2888c2-51cb-4570-a933-397cf7e62806',serverProcessId:5240,probeProcessId:1234});
 assert.equal(r.originalSha256,p.originalSha256);assert.equal(r.probeSha256,p.probeSha256);
 assert.match(r.sql,/DESKTOP_ROLLBACK_READBACK_EMPTY/);
});
