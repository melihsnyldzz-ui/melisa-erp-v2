import fs from 'node:fs';import path from 'node:path';import cp from 'node:child_process';import crypto from 'node:crypto';import {fileURLToPath,pathToFileURL} from 'node:url';
const REPO='melihsnyldzz-ui/melisa-erp-v2',REPO_ID=1354084247,WORKFLOW=374179065,BRANCH='codex/erp-p03-pr53-candidate-20261018';
const SOURCE=String.raw`C:\Sirket\ERP\worktrees\erp-p03-pr53-candidate-20261018`,BASE=String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-retained-handoff-recovery-20261101`,ROOT=BASE.replace('recovery-20261101','recovery-ci-v2-20261101');
const NODE=String.raw`C:\Sirket\ERP\tools\node-v24.19.0\node.exe`,NODE_SHA='3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237',GH=String.raw`C:\Program Files\GitHub CLI\gh.exe`;
const GENERATION='ERP-B6-RECOVERY-CI-PROVENANCE-20261101-0103',OLD='df57c83d78038eec5281bee3e16502b898f73ce4',JOBS=['quality-build-test','secret-scan','windows-startup-test'];
const FILES=['recover-business-5244-retained-handoff.ps1','business-5244-retirement-peer.cs','prepare-business-5244-retained-recovery.mjs'];
const OLD_PINS={'source-manifest.json':'02721d64d39b1778513ffa052aa2a904ffaf0fa7cccd2c44e54abab315a15504','passive-preparation-receipt.json':'4a9ea22b82c77ccb2aa2d66d6dddba1f65fbe87b8fd13a55e7699af0bf6c907d','recover-business-5244-retained-handoff.ps1':'273996f5862ea3479202deb71f4e0f5132f04377248e7790398f284b5570adf8','business-5244-retirement-peer.cs':'4cce4731630f3be32355f5d7e38baca7043cffe2a0eca0dc15d08411187f6dc7','future-application-not-executed.json':'9d2503faa792d8d85f9d6bbd5e5e0ba03bd7587817f051af396a4ade4b9f1176','ci-attempt2-binding-verification.json':'9c26f5594446ed1f1648e7586451b728d05992e8e53dadf7afcfa51bfc9c3c15'};
export const PREDECESSOR_FILES=Object.freeze(OLD_PINS);
export const BINDING=Object.freeze({generation:GENERATION,sourceRoot:ROOT,recoveryRoot:BASE,markerSha256:'3a036109935e733fa2e6f3cf229677b067ff0ecfdab7f98794fe9b065c718745',failureSha256:'a983c262bf21bb6fb8b0ce95eb386799b622846bb3c3dc1ded78fb0d1ea97dbf',ownerPid:33080,ownerBirth:'134379216568450543',childPid:7052,childBirth:'134379217109250887',controllerPid:53132,controllerBirth:'134379606963542382'});
const fail=code=>{throw new Error(code);},need=(v,code)=>{if(!v)fail(code);},hash=b=>crypto.createHash('sha256').update(b).digest('hex'),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),hex=v=>typeof v==='string'&&v.length===40&&/^[a-f0-9]{40}$/.test(v);
const date=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT/.test(v)&&Number.isFinite(Date.parse(v));
function repo(v){need(v?.id===REPO_ID&&v.full_name===REPO,'RECOVERY_CI_REPOSITORY');}
// Only server data collected by the fixed CLI path reaches this validator in
// production. Exported pure validators are for synthetic offline tests only.
export function validateRun(bundle,expected){
 const {run:r,jobs,checks}=bundle;repo(r?.repository);repo(r?.head_repository);
 need(hex(expected.source)&&Number.isSafeInteger(r.id)&&r.id>0&&r.id===expected.id&&r.head_sha===expected.source&&r.event===expected.event&&r.run_attempt===expected.attempt&&r.workflow_id===WORKFLOW&&r.path==='.github/workflows/ci.yml'&&r.status==='completed'&&r.conclusion===expected.conclusion&&Number.isSafeInteger(r.check_suite_id)&&r.check_suite_id>0,'RECOVERY_CI_RUN');
 need(jobs?.total_count===3&&Array.isArray(jobs.jobs)&&jobs.jobs.length===3&&equal(jobs.jobs.map(j=>j.name).sort(),JOBS)&&Array.isArray(checks)&&checks.length===3,'RECOVERY_CI_CHECKSET');
 const rows=jobs.jobs.map(j=>{
  const conclusion=expected.conclusion==='cancelled'&&j.name==='windows-startup-test'?'cancelled':'success';
  need(Number.isSafeInteger(j.id)&&j.id>0&&j.run_id===r.id&&j.run_attempt===r.run_attempt&&j.head_sha===r.head_sha&&j.status==='completed'&&j.conclusion===conclusion&&date(j.started_at)&&date(j.completed_at)&&Date.parse(j.completed_at)>=Date.parse(j.started_at)&&Array.isArray(j.steps)&&j.steps.length>0,'RECOVERY_CI_JOB');
  const c=checks.find(c=>c.id===j.id);need(c&&c.name===j.name&&c.head_sha===r.head_sha&&c.status==='completed'&&c.conclusion===conclusion&&c.check_suite?.id===r.check_suite_id&&c.app?.id===15368&&c.app.slug==='github-actions'&&c.details_url===`https://github.com/${REPO}/actions/runs/${r.id}/job/${j.id}`,'RECOVERY_CI_CHECK');
  const allowedSteps=conclusion==='cancelled'?['success','skipped','cancelled']:['success','skipped'];
  need(j.check_run_url===`https://api.github.com/repos/${REPO}/check-runs/${j.id}`&&new Set(j.steps.map(s=>s.number)).size===j.steps.length&&j.steps.every(s=>Number.isSafeInteger(s.number)&&s.number>0&&typeof s.name==='string'&&s.name.length>0&&s.status==='completed'&&allowedSteps.includes(s.conclusion)&&date(s.started_at)&&date(s.completed_at)&&Date.parse(s.completed_at)>=Date.parse(s.started_at)),'RECOVERY_CI_STEPS');
  return{id:j.id,name:j.name,startedAt:j.started_at,completedAt:j.completed_at,conclusion:j.conclusion,steps:j.steps.map(s=>({number:s.number,name:s.name,status:s.status,conclusion:s.conclusion,startedAt:s.started_at,completedAt:s.completed_at})).sort((a,b)=>a.number-b.number)};
 }).sort((a,b)=>a.name.localeCompare(b.name));
 need(new Set(rows.map(j=>j.id)).size===3,'RECOVERY_CI_DUPLICATE_JOB');
 return{repository:REPO,repositoryId:REPO_ID,workflowId:WORKFLOW,path:r.path,id:r.id,source:r.head_sha,event:r.event,attempt:r.run_attempt,status:r.status,conclusion:r.conclusion,checkSuiteId:r.check_suite_id,jobs:rows};
}
export function validateHistory(before,after,pr){
 const a=validateRun(before,{id:41255956111,source:OLD,event:'push',attempt:1,conclusion:'cancelled'}),b=validateRun(after,{id:41255956111,source:OLD,event:'push',attempt:2,conclusion:'success'}),p=validateRun(pr,{id:41255959077,source:OLD,event:'pull_request',attempt:1,conclusion:'success'});
 need(a.jobs.find(j=>j.name==='windows-startup-test').id===124699035749&&b.jobs.find(j=>j.name==='windows-startup-test').id===124705031166,'RECOVERY_CI_HISTORY_JOB');
 for(const n of JOBS.filter(n=>n!=='windows-startup-test')){const {id:oldId,...oldJob}=a.jobs.find(j=>j.name===n),{id:newId,...newJob}=b.jobs.find(j=>j.name===n);need(equal(oldJob,newJob),'RECOVERY_CI_CARRIED_EXECUTION_CHANGED');}
 return{firstCancelled:a,controlledRetry:b,pullRequest:p};
}
export function validateSourceCi(bundle,source){
 const r=bundle.run;need([1,2].includes(r?.run_attempt)&&['push','pull_request'].includes(r.event),'RECOVERY_CI_SOURCE_ATTEMPT');
 const final=validateRun(bundle,{id:r.id,source,event:r.event,attempt:r.run_attempt,conclusion:'success'});
 if(r.run_attempt===1){need(!Object.hasOwn(bundle,'priorCancelled'),'RECOVERY_CI_UNEXPECTED_PREVIOUS_ATTEMPT');return final;}
 const prior=bundle.priorCancelled;need(prior&&Array.isArray(prior.timeoutAnnotations)&&prior.timeoutAnnotations.some(a=>a.annotation_level==='failure'&&a.message==='The job has exceeded the maximum execution time of 20m0s'),'RECOVERY_CI_TIMEOUT_ANNOTATION');
 const first=validateRun(prior,{id:r.id,source,event:r.event,attempt:1,conclusion:'cancelled'});
 const before=first.jobs.find(j=>j.name==='windows-startup-test'),after=final.jobs.find(j=>j.name==='windows-startup-test');
 need(before.id!==after.id&&Date.parse(after.startedAt)>=Date.parse(before.completedAt),'RECOVERY_CI_WINDOWS_RETRY_IDENTITY');
 for(const n of JOBS.filter(n=>n!=='windows-startup-test')){const {id:a,...old}=first.jobs.find(j=>j.name===n),{id:b,...current}=final.jobs.find(j=>j.name===n);need(equal(old,current),'RECOVERY_CI_CARRIED_EXECUTION_CHANGED');}
 return{...final,priorCancelled:first,timeoutAnnotation:'The job has exceeded the maximum execution time of 20m0s'};
}
export function validateProvenance(proof,source){
 need(proof?.schema==='melisa-b6-retained-ci-provenance.v2'&&hex(source)&&source!==OLD&&proof.sourceCommit===source&&equal(proof.binding,BINDING)&&proof.executionAuthority===false&&proof.installed===false&&proof.applied===false&&proof.admissionIssued===false&&proof.runtimeValidationComplete===false,'RECOVERY_CI_BINDING');
 need(Array.isArray(proof.sourceCi)&&proof.sourceCi.length===2&&proof.sourceCi[0].run.event==='push'&&proof.sourceCi[1].run.event==='pull_request','RECOVERY_CI_EVENTS');
 const sourceCi=proof.sourceCi.map(b=>validateSourceCi(b,source));
 need(sourceCi[0].id!==sourceCi[1].id,'RECOVERY_CI_REPLAYED_RUN');
 const history=validateHistory(proof.history.firstCancelled,proof.history.controlledRetry,proof.history.pullRequest);
 return{schema:proof.schema,sourceCommit:source,binding:BINDING,sourceCi,history,executionAuthority:false,installed:false,applied:false,admissionIssued:false,runtimeValidationComplete:false};
}
function plain(p){for(let x=p;x;){need(!fs.lstatSync(x).isSymbolicLink(),'RECOVERY_CI_REPARSE');const n=path.dirname(x);if(n===x)break;x=n;}}
function read(p){plain(p);return fs.readFileSync(p);}function pinned(p,h){need(typeof h==='string'&&/^[a-fA-F0-9]{64}$/.test(h),'RECOVERY_CI_HASH_FORMAT');const b=read(p);need(hash(b)===h.toLowerCase(),'RECOVERY_CI_DEPENDENCY_CHANGED');return b;}
function exec(file,args){const env={...process.env};for(const n of Object.keys(env))if(/^(NODE_OPTIONS|NODE_PATH|NODE_EXTRA_CA_CERTS|NODE_TLS_REJECT_UNAUTHORIZED|GH_HOST|GH_CONFIG_DIR|GIT_DIR|GIT_WORK_TREE|GIT_CONFIG.*)$/i.test(n))delete env[n];return cp.execFileSync(file,args,{cwd:SOURCE,env,windowsHide:true,timeout:30000,maxBuffer:8*1024*1024});}
export function validateApiEndpoint(endpoint){
 const base=`repos/${REPO}`;need(typeof endpoint==='string','RECOVERY_CI_API_SCOPE');
 const tail=endpoint===base?'':endpoint.startsWith(base+'/')?endpoint.slice(base.length):null;
 need(tail!==null&&(/^(?:|\/actions\/workflows\/ci\.yml|\/pulls\/54|\/actions\/runs\?head_sha=[a-f0-9]{40}&per_page=100|\/actions\/runs\/[1-9][0-9]*\/attempts\/[12](?:\/jobs\?per_page=100)?|\/check-runs\/[1-9][0-9]*(?:\/annotations\?per_page=100)?)$/.test(tail)),'RECOVERY_CI_API_SCOPE');return endpoint;
}
function git(args){return exec(String.raw`C:\Program Files\Git\cmd\git.exe`,args);}function gh(endpoint){validateApiEndpoint(endpoint);return JSON.parse(exec(GH,['api','--hostname','github.com',endpoint]));}
function collect(id,attempt){need(Number.isSafeInteger(id)&&id>0&&[1,2].includes(attempt),'RECOVERY_CI_RUN_IDENTITY');const run=gh(`repos/${REPO}/actions/runs/${id}/attempts/${attempt}`),jobs=gh(`repos/${REPO}/actions/runs/${id}/attempts/${attempt}/jobs?per_page=100`);need(Array.isArray(jobs.jobs)&&jobs.jobs.length===3,'RECOVERY_CI_CHECKSET');const checks=jobs.jobs.map(j=>{need(Number.isSafeInteger(j.id)&&j.id>0,'RECOVERY_CI_JOB');return gh(`repos/${REPO}/check-runs/${j.id}`);});return{run,jobs,checks};}
function collectProof(source){
 const r=gh(`repos/${REPO}`);repo(r);const w=gh(`repos/${REPO}/actions/workflows/ci.yml`);need(w.id===WORKFLOW&&w.path==='.github/workflows/ci.yml'&&w.state==='active','RECOVERY_CI_WORKFLOW');
 const pr=gh(`repos/${REPO}/pulls/54`);repo(pr.head?.repo);need(pr.number===54&&pr.state==='open'&&pr.head.ref===BRANCH&&pr.head.sha===source,'RECOVERY_CI_PR');
 const all=gh(`repos/${REPO}/actions/runs?head_sha=${source}&per_page=100`).workflow_runs;need(Array.isArray(all),'RECOVERY_CI_RUNS');
 const sourceCi=['push','pull_request'].map(event=>{const found=all.filter(r=>r.head_sha===source&&r.event===event&&r.workflow_id===WORKFLOW&&r.path==='.github/workflows/ci.yml');need(found.length===1&&[1,2].includes(found[0].run_attempt),'RECOVERY_CI_UNIQUE_ALLOWED_ATTEMPT');const result=collect(found[0].id,found[0].run_attempt);if(found[0].run_attempt===2){result.priorCancelled=collect(found[0].id,1);const windows=result.priorCancelled.jobs.jobs.find(j=>j.name==='windows-startup-test');need(windows,'RECOVERY_CI_CHECKSET');result.priorCancelled.timeoutAnnotations=gh(`repos/${REPO}/check-runs/${windows.id}/annotations?per_page=100`);}return result;});
 const raw={schema:'melisa-b6-retained-ci-provenance.v2',sourceCommit:source,binding:BINDING,sourceCi,history:{firstCancelled:collect(41255956111,1),controlledRetry:collect(41255956111,2),pullRequest:collect(41255959077,1)},executionAuthority:false,installed:false,applied:false,admissionIssued:false,runtimeValidationComplete:false};
 return{raw,normalized:validateProvenance(raw,source)};
}
// Read-only integration boundary: never writes an artifact or issues authority.
// The fixed CLI still requires its committed source and successful own CI.
export function readCiProvenance(source){need(hex(source)&&source!==OLD,'RECOVERY_CI_SOURCE');return collectProof(source).normalized;}
export function validateManifest(m,source,files,provenanceSha256,dependencies){
 const expected={schema:'melisa-b6-retained-recovery-source.v2',generation:GENERATION,sourceCommit:source,binding:BINDING,files,provenance:{path:'ci-provenance.json',sha256:provenanceSha256},predecessor:{sourceCommit:OLD,files:OLD_PINS},dependencies,executionAuthority:false,installed:false,applied:false,admissionIssued:false,runtimeValidationComplete:false};need(equal(m,expected),'RECOVERY_CI_MANIFEST_CHANGED');return expected;
}
function closure(){
 const prior=JSON.parse(pinned(path.join(BASE,'source-manifest.json'),OLD_PINS['source-manifest.json']));need(prior.dependencies.length===93,'RECOVERY_CI_EXTERNAL_CLOSURE');
 for(const[n,h]of Object.entries(OLD_PINS))pinned(path.join(BASE,n),h);
 for(const f of prior.dependencies)pinned(f.path,f.sha256);
 for(const n of ['recovery-claim.json','recovery-once'])need(!fs.existsSync(path.join(BASE,n)),'RECOVERY_CI_PRIOR_ATTEMPT');
 return prior.dependencies;
}
function sourceFiles(source){need(hex(source)&&source!==OLD,'RECOVERY_CI_SOURCE');return FILES.map(name=>({name,bytes:git(['show',source+':scripts/canonical/'+name])}));}
function ioContext(action){
 need(process.platform==='win32'&&process.execPath.toLowerCase()===NODE.toLowerCase(),'RECOVERY_CI_FIXED_NODE');pinned(NODE,NODE_SHA);plain(GH);
 need(git(['remote','get-url','origin']).toString().trim()===`https://github.com/${REPO}.git`&&git(['remote','get-url','--push','origin']).toString().trim()===`https://github.com/${REPO}.git`&&git(['branch','--show-current']).toString().trim()===BRANCH,'RECOVERY_CI_CANONICAL_SOURCE');
 const own=fileURLToPath(import.meta.url),expected=action==='--prepare'?path.join(SOURCE,'scripts','canonical',FILES[2]):path.join(ROOT,FILES[2]);need(own===expected,'RECOVERY_CI_FIXED_ENTRY');
 const source=action==='--prepare'?git(['rev-parse','HEAD']).toString().trim():JSON.parse(read(path.join(ROOT,'source-manifest.json'))).sourceCommit,blobs=sourceFiles(source);
 for(const f of blobs){const local=read(path.join(action==='--prepare'?path.join(SOURCE,'scripts','canonical'):ROOT,f.name));need((action==='--prepare'?local.toString().replaceAll('\r\n','\n')===f.bytes.toString():local.equals(f.bytes)),'RECOVERY_CI_UNCOMMITTED_SOURCE');}
 const ps=blobs[0].bytes.toString();need(ps.includes("expectedCiProducerSha256='"+hash(blobs[2].bytes)+"'")&&ps.includes("expectedPeerSourceSha256='"+hash(blobs[1].bytes)+"'"),'RECOVERY_CI_CONSUMER_PIN');
 return{source,blobs};
}
export function writeNewArtifact(root,files){
 need(!fs.existsSync(root),'RECOVERY_CI_OUTPUT_EXISTS');plain(path.dirname(root));fs.mkdirSync(root);
 for(const [n,b]of files){need(path.basename(n)===n,'RECOVERY_CI_OUTPUT_LEAF');const f=path.join(root,n),h=fs.openSync(f,'wx');try{fs.writeFileSync(h,b);fs.fsyncSync(h);}finally{fs.closeSync(h);}need(read(f).equals(b),'RECOVERY_CI_OUTPUT_READBACK');}
}
export function main(action){
 need(['--prepare','--verify'].includes(action),'RECOVERY_CI_FIXED_ACTION');const {source,blobs}=ioContext(action),dependencies=closure(),live=readCiProvenance(source),files=blobs.map(f=>({name:f.name,sha256:hash(f.bytes),bytes:f.bytes.length})),proofBytes=Buffer.from(JSON.stringify(live,null,2)+'\n');
 const manifest=validateManifest({schema:'melisa-b6-retained-recovery-source.v2',generation:GENERATION,sourceCommit:source,binding:BINDING,files,provenance:{path:'ci-provenance.json',sha256:hash(proofBytes)},predecessor:{sourceCommit:OLD,files:OLD_PINS},dependencies,executionAuthority:false,installed:false,applied:false,admissionIssued:false,runtimeValidationComplete:false},source,files,hash(proofBytes),dependencies),manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
 const receipt={schema:'melisa-b6-retained-recovery-ci-receipt.v2',generation:GENERATION,sourceCommit:source,sourceRoot:ROOT,recoveryRoot:BASE,manifestSha256:hash(manifestBytes),provenanceSha256:hash(proofBytes),entrySha256:files[0].sha256,peerSha256:files[1].sha256,producerSha256:files[2].sha256,externalReferences:93,executionAuthority:false,installed:false,applied:false,admissionIssued:false,runtimeValidationComplete:false,claimCreated:false,attemptCreated:false,applicationCommandExecuted:false},receiptBytes=Buffer.from(JSON.stringify(receipt,null,2)+'\n');
 const outputs=[...blobs.map(f=>[f.name,f.bytes]),['ci-provenance.json',proofBytes],['source-manifest.json',manifestBytes],['passive-preparation-receipt.json',receiptBytes]];
 if(action==='--prepare'){writeNewArtifact(ROOT,outputs);closure();}
 else{need(equal(fs.readdirSync(ROOT).sort(),outputs.map(([n])=>n).sort()),'RECOVERY_CI_OUTPUT_CLOSURE');for(const[n,b]of outputs)need(read(path.join(ROOT,n)).equals(b),'RECOVERY_CI_ARTIFACT_CHANGED');validateManifest(JSON.parse(read(path.join(ROOT,'source-manifest.json'))),source,files,hash(proofBytes),dependencies);}
 return{...receipt,schema:'melisa-b6-retained-recovery-ci-verification.v2',receiptSha256:hash(receiptBytes),liveGithubVerified:true};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){try{need(process.argv.length===3,'RECOVERY_CI_FIXED_ACTION');process.stdout.write(JSON.stringify(main(process.argv[2]))+'\n');}catch(e){process.stderr.write((/^[A-Z][A-Z0-9_]+$/.test(e.message)?e.message:'RECOVERY_CI_VERIFICATION_FAILED')+'\n');process.exitCode=1;}}
