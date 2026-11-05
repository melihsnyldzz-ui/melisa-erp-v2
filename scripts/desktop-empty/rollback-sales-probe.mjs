// Offline compiler for the 45-batch rollback probe. No connection or writes.
import {createHash} from 'node:crypto';
import {compileDesktopSalesBootstrap} from './bootstrap-sales-proposal.mjs';
import {compileRollbackReadback} from './rollback-readback.mjs';

const ORIGINAL='e4f0eb89743f497e761a02ebd6be6a74742d188f88fbaae77086292964ee7f1d';
const SERVER='Semih\\MELISAERP',DATABASE='MELISA_ERP_DESKTOP_TEST_20261105';
const INJECT=" THROW 51990, 'DESKTOP_SALES_ROLLBACK_PROBE_REACHED', 1;\n";
const ANCHOR=" COMMIT TRANSACTION;\n SELECT N'DESKTOP_EMPTY_SCHEMA_APPLIED' AS outcome;";
const hash=x=>createHash('sha256').update(x,'utf8').digest('hex');
const fail=()=>{throw new Error('SALES_ROLLBACK_PROBE_REJECTED');};
export function compileSalesRollbackProbe(){
 const base=compileDesktopSalesBootstrap();
 if(base.server!==SERVER||base.database!==DATABASE||base.ddlBatchCount!==45||base.expectedTableCount!==27
  ||base.expectedCommercialEmptyTableCount!==26||base.sqlSha256!==ORIGINAL||hash(base.sql)!==ORIGINAL)fail();
 const at=base.sql.indexOf(ANCHOR);
 if(at<0||base.sql.indexOf(ANCHOR,at+1)>=0||base.sql.includes(INJECT)||base.sql.includes('DESKTOP_SALES_ROLLBACK_PROBE_REACHED'))fail();
 const sql=base.sql.slice(0,at)+INJECT+base.sql.slice(at);
 if(sql.replace(INJECT,'')!==base.sql||hash(sql.replace(INJECT,''))!==ORIGINAL)fail();
 return Object.freeze({server:SERVER,database:DATABASE,environmentId:base.environmentId,sql,
  originalSha256:ORIGINAL,probeSha256:hash(sql),batchCount:45,expectedError:51990,
  expectedErrorMessage:'DESKTOP_SALES_ROLLBACK_PROBE_REACHED',commercialData:'NONE',
  executionAuthorized:false,requiresExclusiveTargetOwner:true,requiresClosedProcess:true,
  requiresIndependentIdentityBoundReadback:true,noAutomaticRetry:true});
}
export function compileSalesRollbackReadback(identity){
 const probe=compileSalesRollbackProbe(),readback=compileRollbackReadback(identity);
 return Object.freeze({...readback,originalSha256:probe.originalSha256,probeSha256:probe.probeSha256});
}
