// Source-only review artifact. This is deliberately not an executable
// migration, admission, grant, rollback, or independent observation plan.
import {createHash} from 'node:crypto';
import {DESKTOP_FINANCE_PROPOSAL_SQL,DESKTOP_FINANCE_PROPOSED_RIGHTS} from '../../apps/api/src/config/desktopFinanceSchemaProposal.mjs';
import {DESKTOP_FINANCE_V7_OPERATOR_PERMISSIONS,DESKTOP_FINANCE_V7_LIMITS} from '../../apps/api/src/config/desktopFinanceV7Policy.mjs';
import {compileMasterV6Readback} from './master-v6-transition.mjs';
import {addDesktopFinanceObjectIds} from './master-v7-readback.mjs';
export {verifyDesktopFinanceV6Baseline,compareDesktopFinanceV6Observations,compareDesktopFinanceV7Data} from './master-v7-snapshot-verify.mjs';
export {compileDesktopFinanceV7MutationFragments} from './master-v7-mutation-fragments.mjs';
export {compareDesktopFinanceV7OldMetadata} from './master-v7-metadata-compare.mjs';
export {compileMasterV7Readback} from './master-v7-readback.mjs';
export {compareDesktopFinanceV7Security} from './master-v7-security-compare.mjs';
export {compileDesktopFinanceV7Trial} from './master-v7-trial.mjs';
export {prepareDesktopFinanceV7TrialProof} from './master-v7-trial-proof.mjs';
export {compileDesktopFinanceV7ConditionalApply} from './master-v7-apply.mjs';

export function compileDesktopFinanceV7Proposal(){
 const sqlSha256=createHash('sha256').update(DESKTOP_FINANCE_PROPOSAL_SQL,'utf8').digest('hex');
 return Object.freeze({state:'MASTER_V7_SOURCE_PROPOSAL_ONLY',target:Object.freeze({database:'MELISA_ERP_DESKTOP_TEST_20261105',databaseId:5,databaseGuid:'c67f5317-9c0d-4831-aadd-fadc379a95d1',environmentId:'eb2888c2-51cb-4570-a933-397cf7e62806',schemaBefore:6,schemaAfter:7,tableCountAfter:43,operatorPermissionCountAfter:19}),sqlSha256,proposedRights:DESKTOP_FINANCE_PROPOSED_RIGHTS,operatorPermissions:DESKTOP_FINANCE_V7_OPERATOR_PERMISSIONS,sqlVerified:DESKTOP_FINANCE_V7_LIMITS.sqlVerified,admissionAllowed:false,requirements:Object.freeze(['exact-live-v6-baseline','rollback-and-identity-proof','independent-sql-server-metadata-observation','explicit-grant-and-admission-plan','independent-review'])});
}

// Reuse the existing fixed-target stopped-application observer to capture the
// actual V6 metadata, all 37 business hashes and identity values. Its result
// alone never authorizes V7 DDL, grants or runtime admission.
export function compileDesktopFinanceV7Baseline(){
 const baseline=compileMasterV6Readback({appMayBeRunning:false}),sql=addDesktopFinanceObjectIds(baseline.sql);
 return Object.freeze({...baseline,sql,sha256:createHash('sha256').update(sql,'utf8').digest('hex'),purpose:'MASTER_V7_V6_BASELINE_ONLY',admissionAllowed:false});
}
