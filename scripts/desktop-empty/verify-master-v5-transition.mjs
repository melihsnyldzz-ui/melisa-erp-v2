// Fixed files, completed separate processes, exact source compilation and an
// independent SQL snapshot are all required. Does not connect or retry SQL.
import {loadMasterV5RunContext,readMasterV5RunFile,createMasterV5RunFile} from './master-v5-run-files.mjs';import {createHash} from 'node:crypto';
import {compileMasterV5Snapshot,compileMasterV5Transition,compileMasterV5Revert} from './master-v5-transition.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex'),keys=['metadataSha256','securitySha256','businessRowsSha256'],fail=()=>{throw Error('MASTER_V5_VERIFICATION_REJECTED');};
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),identity=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v);
async function read(root,name){const bytes=await readMasterV5RunFile(root,name);return {bytes,value:JSON.parse(bytes.toString('utf8'))};}
function completed(pid){if(!Number.isInteger(pid)||pid<1)fail();try{process.kill(pid,0);fail();}catch(error){if(error.code!=='ESRCH')fail();}}
try{
 const mode=process.argv[2];if(process.argv.length!==4||!['rollback','apply','revert'].includes(mode))fail();
 const ctx=await loadMasterV5RunContext(process.argv[3]),root=ctx.root,packageSha256=ctx.packageSha256,contextKey=ctx.contextKey;
 const baseline=(await read(root,'master-v5-baseline-outcome.json')).value,preparation=(await read(root,'master-v5-preparation-baseline.json')).value;
 if(baseline.state!=='MASTER_V5_BATCH_COMPLETED'||baseline.result?.schemaVersion!==4||!identity(baseline.result.permissionIdentityCurrent)||keys.some(k=>!hash(preparation[k])||baseline.result[k]!==preparation[k]))fail();
 let candidate=null,prior=null;
 if(mode!=='rollback'){prior=(await read(root,`master-v5-${mode==='apply'?'rollback':'apply'}-verification.json`)).value;if(prior.contextKey!==contextKey||prior.packageSha256!==packageSha256||prior.observerProcessCompleted!==true||prior.state!==`MASTER_V5_${mode==='apply'?'ROLLBACK':'APPLY'}_INDEPENDENTLY_VERIFIED`||keys.some(k=>prior.baseline?.[k]!==preparation[k]))fail();candidate=prior.candidate;if(!hash(candidate?.metadataSha256)||!hash(candidate?.securitySha256))fail();}
 const p=await read(root,`master-v5-${mode}-plan.json`),plan=p.value,compiled=mode==='rollback'?compileMasterV5Transition({mode,...preparation}):mode==='apply'?compileMasterV5Transition({mode,...preparation,candidateMetadataSha256:candidate.metadataSha256,candidateSecuritySha256:candidate.securitySha256}):compileMasterV5Revert({...preparation,candidateMetadataSha256:candidate.metadataSha256,candidateSecuritySha256:candidate.securitySha256});
 if(plan.mode!==mode||plan.sha256!==compiled.sha256||sha(plan.sql)!==compiled.sha256||mode==='revert'&&plan.publicBindingSha256!==compiled.publicBindingSha256)fail();
 const outcome=(await read(root,`master-v5-${mode}-outcome.json`)).value,attempt=(await read(root,`master-v5-${mode}-attempt.json`)).value;
 const observed=(await read(root,`master-v5-after-${mode}-outcome.json`)).value,observerAttempt=(await read(root,`master-v5-after-${mode}-attempt.json`)).value,snapshot=await read(root,'master-v5-snapshot-plan.json');
 const baselineAttempt=(await read(root,'master-v5-baseline-attempt.json')).value;
 if([baseline,baselineAttempt,outcome,attempt,observed,observerAttempt].some(record=>record.packageSha256?.toLowerCase()!==packageSha256||record.contextKey!==contextKey))fail();
 if(baseline.operation!=='snapshot'||baseline.sqlSha256!==compileMasterV5Snapshot().sha256||baseline.planSha256?.toLowerCase()!==sha(snapshot.bytes)||baselineAttempt.operation!=='snapshot'||baselineAttempt.sqlSha256!==baseline.sqlSha256||baselineAttempt.planSha256?.toLowerCase()!==sha(snapshot.bytes)||[attempt.ownerPid,observerAttempt.ownerPid].includes(baselineAttempt.ownerPid))fail();completed(baselineAttempt.ownerPid);
 if(snapshot.value.mode!=='snapshot'||snapshot.value.sha256!==compileMasterV5Snapshot().sha256||sha(snapshot.value.sql)!==snapshot.value.sha256||observed.state!=='MASTER_V5_BATCH_COMPLETED'||observed.operation!=='observe'||observed.sqlSha256!==snapshot.value.sha256||observed.planSha256?.toLowerCase()!==sha(snapshot.bytes)||observerAttempt.operation!=='observe'||observerAttempt.planSha256?.toLowerCase()!==sha(snapshot.bytes)||observerAttempt.sqlSha256!==snapshot.value.sha256)fail();
 if(outcome.state!=='MASTER_V5_BATCH_COMPLETED'||outcome.operation!==mode||outcome.sqlSha256!==compiled.sha256||outcome.planSha256?.toLowerCase()!==sha(p.bytes)||attempt.operation!==mode||attempt.planSha256?.toLowerCase()!==sha(p.bytes)||attempt.sqlSha256!==compiled.sha256||attempt.ownerPid===observerAttempt.ownerPid)fail();
 completed(attempt.ownerPid);completed(observerAttempt.ownerPid);
 if(mode==='rollback'){candidate={metadataSha256:outcome.result?.candidateMetadataSha256,securitySha256:outcome.result?.candidateSecuritySha256};if(!hash(candidate.metadataSha256)||!hash(candidate.securitySha256)||candidate.metadataSha256===preparation.metadataSha256||candidate.securitySha256===preparation.securitySha256||outcome.result.permissionIdentityPreserved!==baseline.result.permissionIdentityCurrent)fail();}
 const expected=mode==='apply'?{...candidate,businessRowsSha256:preparation.businessRowsSha256}:preparation;
 if(outcome.result?.state!==`MASTER_V5_${mode==='rollback'?'ROLLED_BACK':mode==='apply'?'COMMITTED_UNVERIFIED':'REVERTED_UNVERIFIED'}`||keys.some(k=>outcome.result[k]!==expected[k]||observed.result?.[k]!==expected[k])||observed.result?.schemaVersion!==(mode==='apply'?5:4)||!identity(observed.result.permissionIdentityCurrent))fail();
 const seed=BigInt(baseline.result.permissionIdentityCurrent),actual=BigInt(observed.result.permissionIdentityCurrent);
 if(mode==='rollback'?actual!==seed:mode==='apply'?actual!==seed+1n:observed.result.permissionIdentityCurrent!==prior.observed.result.permissionIdentityCurrent)fail();
 const proof={contextKey,state:`MASTER_V5_${mode.toUpperCase()}_INDEPENDENTLY_VERIFIED`,packageSha256,sqlSha256:compiled.sha256,baseline:preparation,candidate,observed,observerProcessCompleted:true,writerProcessCompleted:true,businessRowsPreserved:true,permissionIdentityCurrent:observed.result.permissionIdentityCurrent,time:new Date().toISOString()};
 await createMasterV5RunFile(root,`master-v5-${mode}-verification.json`,Buffer.from(JSON.stringify(proof,null,2)+'\n'));process.stdout.write(JSON.stringify({state:proof.state,businessRowsPreserved:true}));
}catch{process.stderr.write('MASTER_V5_VERIFICATION_REJECTED');process.exitCode=1;}
