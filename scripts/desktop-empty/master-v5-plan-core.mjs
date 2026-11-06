// Pure fixed-target review-plan composition. No connection or file mutation.
import {compileMasterV5Snapshot,compileMasterV5Transition,compileMasterV5Revert} from './master-v5-transition.mjs';
export async function compileMasterV5ReviewPlan(mode,read){
 if(!['snapshot','rollback','apply','revert'].includes(mode)||typeof read!=='function')throw Error('MASTER_V5_PLAN_REJECTED');
 if(mode==='snapshot')return {mode,...compileMasterV5Snapshot()};
 const baseline=await read('master-v5-preparation-baseline.json');if(!baseline||Object.keys(baseline).sort().join(',')!=='businessRowsSha256,metadataSha256,securitySha256')throw Error('MASTER_V5_PLAN_REJECTED');
 if(mode==='rollback')return compileMasterV5Transition({mode,...baseline});
 const proof=await read(`master-v5-${mode==='apply'?'rollback':'apply'}-verification.json`);if(proof.observerProcessCompleted!==true||proof.state!==`MASTER_V5_${mode==='apply'?'ROLLBACK':'APPLY'}_INDEPENDENTLY_VERIFIED`)throw Error('MASTER_V5_PLAN_REJECTED');
 const candidate=proof.candidate;if(!candidate||typeof candidate.metadataSha256!=='string'||typeof candidate.securitySha256!=='string')throw Error('MASTER_V5_PLAN_REJECTED');
 const v={...baseline,candidateMetadataSha256:candidate.metadataSha256,candidateSecuritySha256:candidate.securitySha256};return mode==='apply'?compileMasterV5Transition({mode,...v}):compileMasterV5Revert(v);
}
