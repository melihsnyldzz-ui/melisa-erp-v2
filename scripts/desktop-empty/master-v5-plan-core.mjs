import {compileMasterV5Snapshot,compileMasterV5Transition,compileMasterV5Revert} from './master-v5-transition.mjs';
const fail=()=>{throw Error('MASTER_V5_PLAN_REJECTED');};
export async function compileMasterV5ReviewPlan(mode,read,ctx){
 if(!['snapshot','rollback','apply','revert','diagnose'].includes(mode)||typeof read!=='function'||!ctx||!/^[a-f0-9]{64}$/.test(ctx.contextKey)||!/^[a-f0-9]{64}$/.test(ctx.packageSha256))fail();
 if(mode==='snapshot')return {mode,...compileMasterV5Snapshot()};
 const baseline=await read('master-v5-preparation-baseline.json');if(!baseline||Object.keys(baseline).sort().join(',')!=='businessRowsSha256,metadataSha256,securitySha256'||Object.values(baseline).some(x=>typeof x!=='string'||!/^[a-f0-9]{64}$/.test(x)))fail();
 if(mode==='diagnose'){const {compileMasterV5RollbackDiagnostic}=await import('./master-v5-rollback-diagnostic.mjs');return compileMasterV5RollbackDiagnostic(baseline);}
 if(mode==='rollback')return compileMasterV5Transition({mode,...baseline});
 const proof=await read(`master-v5-${mode==='apply'?'rollback':'apply'}-verification.json`);if(proof.observerProcessCompleted!==true||proof.state!==`MASTER_V5_${mode==='apply'?'ROLLBACK':'APPLY'}_INDEPENDENTLY_VERIFIED`||proof.contextKey!==ctx.contextKey||proof.packageSha256!==ctx.packageSha256||Object.keys(baseline).some(k=>proof.baseline?.[k]!==baseline[k]))fail();
 const candidate=proof.candidate;if(!candidate||typeof candidate.metadataSha256!=='string'||typeof candidate.securitySha256!=='string')fail();
 const v={...baseline,candidateMetadataSha256:candidate.metadataSha256,candidateSecuritySha256:candidate.securitySha256};return mode==='apply'?compileMasterV5Transition({mode,...v}):compileMasterV5Revert(v);
}
