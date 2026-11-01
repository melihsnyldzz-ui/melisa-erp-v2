// One finite SOURCE/OFFLINE cold-Current recovery case. Import is inert.
// Passive preparation never enters a mutex, archives a marker or starts a host.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
// Public file digests, never credentials. Keep them distinct from API fields.
const READONLY_MANIFEST_SHA256='afdb66b5c3450459778630d27bd1ff409ecb80c8ad53058fa048cf3e8e28085c';
const READONLY_BEFORE_SHA256='ab9817705bf239d58844a5f94061abbdf7cd410be2b3be9f3b93c24d462d34d6';
export const COLD_CURRENT=Object.freeze({
 id:'ERP-B6-CURRENT-WEB-RECOVERY-SOURCE-20261101-1258',
 sourceRoot:String.raw`C:\Sirket\ERP\worktrees\erp-p03-pr53-candidate-20261018`,
 root:String.raw`C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-CURRENT-WEB-COLD-RECOVERY-OWNER-20261101`,
 privateRoot:String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-current-web-cold-recovery-20261101`,
 predecessorRoot:String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-pending-web-generation-post-recovery-20261101`,
 beforeRoot:String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-pending-web-generation-20261031`,
 failureSha256:'a0f90c26b22522ead52d8bbbaa5b3ebf834f389375ac4da3ed24b254240e6342',
 markerSha256:'769d25b8bce8212e0895e47adce2b5f8bb32d830120f1ebd1608a00b8e8c9aff',
 readbackSha256:'63f02560b45f7b221c13bec39806e9cfbf217e8a3f195a24eb6824e30532274f',
 summarySha256:'2d2fde1c8114208925e5dfd6e1923f61ad1826d6a07eb142046d24285f12f794',
 beforeSha256:'25127ef33de5323af9e7ed6888b2699c5276836fff8d471fdad4c34d43b2dcdc',
 recordSha256:'4582474922eb94954f5fcf039777b58be53190fc3d3b10ffb292861148447564',
 webRoot:String.raw`C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-B6-PREVIEW-READ-VERIFIED-20261030`,
 webSha256:'853025ef7df10eec9a4feff026b767c6c323e5e5259c7bcbc2f7f19186743855',
 apiRoot:String.raw`C:\Sirket\ERP\releases\CANONICAL-TEST125-BUSINESS5244-B6-PREVIEW-READ-VERIFIED-20261030`,
 apiSha256:READONLY_MANIFEST_SHA256,
 node:String.raw`C:\Sirket\ERP\tools\node-v24.19.0\node.exe`,
 nodeSha256:'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237',
 markerPath:String.raw`C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027\5244-retirement.pending`,
 originalRequestId:'d3d54eed-5de6-46ed-8881-1d3f004c37d8'
});
const C=COLD_CURRENT,sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fail=code=>{throw new Error(code);};
const bytes=o=>Buffer.from(JSON.stringify(o,null,2)+'\n');
const passive={installed:false,applied:false,executionAuthority:false,admissionIssued:false,runtimeValidationComplete:false};
export function validateColdCurrentRecords({failure:r,readback:b,summary:s,before}){
 if(r?.sourceCommit!=='6e13a67d7647729a599f7b6f82e7c09c916c101c'||r.status!=='FAILED_REVIEW_RECEIPT'||r.scope!=='TEST125-API-B6-WRITER-20261029'||r.outcome!==null||r.failure!=='READPAIR_UNCLASSIFIED_FAILURE'||['stopCalls','startCalls','retireAttempts','apiRestarts','taskChanges','profileWrites','sqlWrites'].some(k=>r[k]!==0)||r.primaryFailure?.site?.scriptLineNumber!==1337||r.restoreFailure?.site?.scriptLineNumber!==545||r.cleanupFailure?.site?.scriptLineNumber!==1527)fail('COLD_CURRENT_FAILURE_CHANGED');
 if(b?.schema!=='melisa-b6-post-recovery-failure-readback.v1'||b.oldOwnerPresent!==false||b.oldChildPresent!==false||b.controllerPresent!==false||b.webListenerCount!==0||b.markerPresent!==true||['protectedListenersEqual','taskXmlSddlInstanceEqual','apiHealthEqual','erpRecordBytesEqual','originalSaleInputFilesEqual'].some(k=>b[k]!==true)||b.installResultSha256!==C.failureSha256||b.markerSha256!==C.markerSha256||b.originalRequestId!==C.originalRequestId||b.actualInstallInvocations!==1||b.actualNormalDebuggerQuitInvocations!==1||b.actualNewOwnerStarts!==0||b.rollbackComplete!==false||b.secondInstallCalls!==0||b.commercialWrites!==0||Object.entries({apiFiles:4,legacyEntries:56,protectedFiles:4,protectedProcesses:4}).some(([k,n])=>!Array.isArray(b[k])||b[k].length!==n||b[k].some(v=>!v||Array.isArray(v)||typeof v!=='object'||v.equal!==true)))fail('COLD_CURRENT_READBACK_CHANGED');
 if(s?.task!=='ERP-B6-POST-RECOVERY-INSTALL-20261101-1216'||s.sourceCommit!==r.sourceCommit||s.command?.controllerPid!==2696||s.command.controllerBirth!=='134380102437098616'||s.command.actualInvocations!==1||s.command.exitCode!==1||s.receiptSha256!==C.failureSha256||s.markerSha256!==C.markerSha256||s.protectedReadbackSha256!==C.readbackSha256||s.observedNativePrimaryError!=='B6_MANAGED_EXIT_SIGNAL_TIMEOUT'||s.historicalFirstInstallError!=='UNKNOWN'||s.web5244!=='DOWN'||s.installed!==false||s.rollbackComplete!==false||['newOwnerStarts','retireAttempts','apiRestarts','sqlWrites','taskChanges','configChanges','salesPostCount','secondInstallerCalls'].some(k=>s[k]!==0))fail('COLD_CURRENT_SUMMARY_CHANGED');
 if(before?.schema!=='melisa-b6-pending-web-passive-before.v1'||before.recordSha256!==C.recordSha256||before.owner?.pid!==33080||before.owner.birth!=='134379216568450540'||before.child?.pid!==7052||before.child.birth!=='134379217109250880'||!Array.isArray(before.entries)||before.entries.length!==56||before.entries.some(f=>!f||typeof f!=='object'||Array.isArray(f)||Object.keys(f).sort().join('|')!=='path|sha256'||typeof f.path!=='string'||!f.path.startsWith('C:\\Sirket\\ERP\\')||f.path.includes('/')||f.path.slice(2).includes(':')||path.win32.normalize(f.path)!==f.path||typeof f.sha256!=='string'||!/^[a-f0-9]{64}$/.test(f.sha256))||new Set(before.entries.map(f=>f.path.toLowerCase())).size!==56)fail('COLD_CURRENT_BEFORE_CHANGED');
 return {caseId:C.id,originalRequestId:C.originalRequestId,historicalFirstInstallError:'UNKNOWN',newPrimaryError:s.observedNativePrimaryError,currentOnly:true,candidateInstallation:false,...passive};
}
export function validateColdCurrentRaw(input){
 for(const k of['failure','readback','summary','before'])if(!Buffer.isBuffer(input?.[k])||sha(input[k])!==C[k+'Sha256'])fail('COLD_CURRENT_INPUT_PIN_CHANGED');
 return validateColdCurrentRecords(Object.fromEntries(['failure','readback','summary','before'].map(k=>[k,JSON.parse(input[k])])));
}

export const COLD_OWNER_FILES=Object.freeze([
        'business-5244-startup-exclusion.ps1',
        'start-business-5244-web.ps1',
        'business-5244-web-native.cs',
        'business-5244-retirement-channel.ps1',
        'business-5244-retirement-peer.cs',
        'business-5244-retirement-state.ps1',
        'business-5244-maintenance-dispatch.ps1',
        'start-business-5244-owned.ps1',
        'test125-bound-api-quiescence.ps1',
        'test125-bound-maintenance-plan.ps1',
        'start-owned-test.ps1',
        'canonical-business-sale-maintenance.ps1'
    ]);
export const COLD_PROOF_FILES=Object.freeze(['prepare-business-5244-cold-current-recovery.mjs','recover-business-5244-current-web.ps1','business-5244-cold-current-recovery.cs']);
const REPO='melihsnyldzz-ui/melisa-erp-v2',BRANCH='codex/erp-p03-pr53-candidate-20261018',WORKFLOW=374179065;
const GIT=String.raw`C:\Program Files\Git\cmd\git.exe`,GH=String.raw`C:\Program Files\GitHub CLI\gh.exe`,PROOF=path.win32.join(C.privateRoot,'owner-preparation');
const REQUIRED_JOBS=['quality-build-test','secret-scan','windows-startup-test'];
const PRIVATE_INPUTS=Object.freeze([
 ['current-erp-processes.before.json','owner-preparation/current-erp-processes.before.json',C.recordSha256],
 ['webonly-api-before.json','owner-preparation/webonly-api-before.json',READONLY_BEFORE_SHA256],
 ['current-task-capture.json','owner-preparation/current-task-capture.json','98cc5ec1abe9e1f0da55d6cba8c9ca82ebedd2685fcc29b4db346808c94ed865'],
 ['preserved-sale-input-before-1216.json','preserved-sale-input-before-1216.json','0c9372e715e7d34455252efd33e022dabfe019beeb588176418da3f5aca97a0f']
]);
const need=(v,c)=>{if(!v)fail(c);},hex=(v,n)=>typeof v==='string'&&new RegExp(`^[a-f0-9]{${n}}$`).test(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function plain(p){for(let q=p;q;){need(!fs.lstatSync(q).isSymbolicLink(),'COLD_CURRENT_REPARSE');const next=path.dirname(q);if(next===q)break;q=next;}}
function read(p){plain(p);need(fs.statSync(p).isFile(),'COLD_CURRENT_NOT_FILE');return fs.readFileSync(p);}
function pinned(p,h){const b=read(p);need(hex(h,64)&&sha(b)===h,'COLD_CURRENT_DEPENDENCY_CHANGED');return b;}
function execute(file,args){const env={...process.env};for(const n of Object.keys(env))if(/^(NODE_OPTIONS|NODE_PATH|NODE_EXTRA_CA_CERTS|NODE_TLS_REJECT_UNAUTHORIZED|GH_HOST|GH_CONFIG_DIR|GIT_DIR|GIT_WORK_TREE|GIT_CONFIG.*)$/i.test(n))delete env[n];return cp.execFileSync(file,args,{cwd:C.sourceRoot,env,windowsHide:true,timeout:30000,maxBuffer:8*1024*1024});}
const git=args=>execute(GIT,args);
export function validateColdCiEndpoint(endpoint){
 const prefix=`repos/${REPO}`;need(typeof endpoint==='string'&&endpoint.startsWith(prefix+'/'),'COLD_CURRENT_CI_ENDPOINT');const tail=endpoint.slice(prefix.length);
 need(/^\/(?:pulls\/54|actions\/runs\?head_sha=[a-f0-9]{40}&per_page=100|actions\/runs\/[1-9][0-9]*\/attempts\/1(?:\/jobs\?per_page=100)?)$/.test(tail),'COLD_CURRENT_CI_ENDPOINT');return endpoint;
}
function gh(endpoint){validateColdCiEndpoint(endpoint);return JSON.parse(execute(GH,['api','--hostname','github.com',endpoint]));}
export function validateColdCiRun(run,jobs,source,event){
 need(hex(source,40)&&['push','pull_request'].includes(event),'COLD_CURRENT_CI_SOURCE');
 need(run?.head_sha===source&&run.event===event&&run.run_attempt===1&&run.status==='completed'&&run.conclusion==='success'&&run.workflow_id===WORKFLOW&&run.path==='.github/workflows/ci.yml'&&run.head_repository?.full_name===REPO&&Number.isSafeInteger(run.id)&&run.id>0,'COLD_CURRENT_CI_RUN');
 need(jobs?.total_count===3&&Array.isArray(jobs.jobs)&&jobs.jobs.length===3,'COLD_CURRENT_CI_JOBSET');
 const rows=jobs.jobs.map(j=>{
  need(j&&Number.isSafeInteger(j.id)&&j.id>0&&j.run_id===run.id&&j.run_attempt===1&&j.head_sha===source&&REQUIRED_JOBS.includes(j.name)&&j.status==='completed'&&j.conclusion==='success','COLD_CURRENT_CI_JOB');
  need(Array.isArray(j.steps)&&j.steps.length>0&&j.steps.every(s=>s&&s.status==='completed'&&s.conclusion==='success'&&Number.isSafeInteger(s.number)&&typeof s.name==='string'),'COLD_CURRENT_CI_STEP');
  return {id:j.id,name:j.name,steps:j.steps.map(s=>({number:s.number,name:s.name,status:s.status,conclusion:s.conclusion}))};
 }).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
 need(new Set(rows.map(j=>j.id)).size===3&&new Set(rows.map(j=>j.name)).size===3,'COLD_CURRENT_CI_DUPLICATE');
 return {id:run.id,event,sourceCommit:source,attempt:1,status:'completed',conclusion:'success',jobs:rows};
}
function liveCi(source){
 const base=`repos/${REPO}`,pr=gh(base+'/pulls/54');need(pr.state==='open'&&pr.head?.repo?.full_name===REPO&&pr.head.ref===BRANCH,'COLD_CURRENT_PR_IDENTITY');
 const runs=gh(base+`/actions/runs?head_sha=${source}&per_page=100`).workflow_runs;need(Array.isArray(runs),'COLD_CURRENT_CI_RUNS');
 const result=['push','pull_request'].map(event=>{const matches=runs.filter(r=>r.head_sha===source&&r.event===event&&r.workflow_id===WORKFLOW);need(matches.length===1&&matches[0].run_attempt===1,'COLD_CURRENT_CI_UNIQUE_ATTEMPT');const id=matches[0].id;need(Number.isSafeInteger(id)&&id>0,'COLD_CURRENT_CI_RUN_ID');return validateColdCiRun(gh(base+`/actions/runs/${id}/attempts/1`),gh(base+`/actions/runs/${id}/attempts/1/jobs?per_page=100`),source,event);});
 need(result[0].id!==result[1].id,'COLD_CURRENT_CI_REUSED_RUN');return result;
}
export function compileColdCurrentArtifacts({source,files,ci,inputs}){
 need(hex(source,40)&&files instanceof Map&&COLD_OWNER_FILES.concat(COLD_PROOF_FILES).every(n=>Buffer.isBuffer(files.get(n))&&files.get(n).length>0)&&files.size===15,'COLD_CURRENT_SOURCE_CLOSURE');
 need(Array.isArray(ci)&&ci.length===2&&ci.every((r,i)=>r&&Number.isSafeInteger(r.id)&&r.id>0&&r.event===['push','pull_request'][i]&&r.sourceCommit===source&&r.status==='completed'&&r.conclusion==='success'&&r.attempt===1&&Array.isArray(r.jobs)&&r.jobs.length===3&&new Set(r.jobs.map(j=>j?.name)).size===3&&new Set(r.jobs.map(j=>j?.id)).size===3&&r.jobs.every(j=>j&&Number.isSafeInteger(j.id)&&j.id>0&&REQUIRED_JOBS.includes(j.name)&&Array.isArray(j.steps)&&j.steps.length>0&&j.steps.every(s=>s&&Number.isSafeInteger(s.number)&&typeof s.name==='string'&&s.status==='completed'&&s.conclusion==='success')))&&ci[0].id!==ci[1].id,'COLD_CURRENT_CI_CLOSURE');
 const e=files.get(COLD_PROOF_FILES[1]),p=files.get(COLD_PROOF_FILES[0]),n=files.get(COLD_PROOF_FILES[2]);
 need(e.toString().includes("expectedColdProducerSha256='"+sha(p)+"'")&&n.toString().includes('ExpectedEntryHash="'+sha(e)+'"'),'COLD_CURRENT_SOURCE_PINS');
 need(inputs instanceof Map&&inputs.size===PRIVATE_INPUTS.length,'COLD_CURRENT_PRIVATE_CLOSURE');
 for(const[name,,h]of PRIVATE_INPUTS)need(Buffer.isBuffer(inputs.get(name))&&sha(inputs.get(name))===h,'COLD_CURRENT_PRIVATE_PIN');
 const core=new Map(COLD_OWNER_FILES.map(name=>[name,files.get(name)]));core.set('run-current-owner.ps1',e);
 const row=(name,b)=>({path:name,sha256:sha(b),bytes:b.length});
 const proof=new Map(COLD_PROOF_FILES.map(name=>[name,files.get(name)]));for(const [name,b]of inputs)proof.set(name,b);
 const ciBytes=bytes({schema:'melisa-b6-cold-current-ci.v1',sourceCommit:source,runs:ci});proof.set('ci-provenance.json',ciBytes);
 const sources=bytes({schema:'melisa-b6-cold-current-sources.v1',sourceCommit:source,entrySha256:sha(e),producerSha256:sha(p),nativeSha256:sha(n),files:COLD_PROOF_FILES.map(name=>row(name,files.get(name))),privateInputs:PRIVATE_INPUTS.map(([name])=>row(name,inputs.get(name))),provenance:{path:'ci-provenance.json',sha256:sha(ciBytes)}});proof.set('source-manifest.json',sources);
 const coldCase=bytes({schema:'melisa-b6-cold-current-case.v1',...C,scope:'TEST125-API-B6-WRITER-20261029',purpose:'ColdCurrentWebRecovery',currentOnly:true,candidateInstallation:false,archiveOnlyClearing:false,historicalFirstInstallError:'UNKNOWN',newPrimaryError:'B6_MANAGED_EXIT_SIGNAL_TIMEOUT',actualT1:false,externalOperations:false,...passive});
 const manifest=bytes({schema:'melisa-b6-cold-current-owner.v1',kind:'BUSINESS5244_FRESH_OWNER_BUNDLE',root:C.root,coldRecoveryCaseId:C.id,sourceCommit:source,finiteScope:'TEST125-API-B6-WRITER-20261029',maintenancePurpose:'ColdCurrentWebRecovery',entrySha256:sha(e),files:[...core].map(([name,b])=>row(name,b)),dataFiles:[row('cold-current-case.json',coldCase)],coldCurrentCase:{path:'cold-current-case.json',sha256:sha(coldCase)},recoverySources:{root:PROOF,sha256:sha(sources)},apiTransitionEnabled:false,readPairMaintenanceEnabled:false,recordingEnabled:false,actualT1:false,externalOperations:false,...passive});
 core.set('cold-current-case.json',coldCase);core.set('owner-manifest.json',manifest);
 const receipt=bytes({schema:'melisa-b6-cold-current-preparation.v1',id:C.id,sourceCommit:source,coreRoot:C.root,sourceRoot:PROOF,manifestSha256:sha(manifest),sourceManifestSha256:sha(sources),entrySha256:sha(e),producerSha256:sha(p),nativeSha256:sha(n),coreFiles:core.size,proofFiles:proof.size+1,...passive});proof.set('preparation-receipt.json',receipt);
 return {core,proof,verification:{schema:'melisa-b6-cold-current-verification.v1',sourceCommit:source,coreRoot:C.root,sourceRoot:PROOF,manifestSha256:sha(manifest),sourceManifestSha256:sha(sources),entrySha256:sha(e),producerSha256:sha(p),nativeSha256:sha(n),receiptSha256:sha(receipt),liveGithubVerified:true,...passive}};
}
export function writeColdCurrentNew(root,files){
 need(files instanceof Map&&[...files].every(([name,b])=>typeof name==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)&&!['.','..'].includes(name)&&path.basename(name)===name&&Buffer.isBuffer(b)),'COLD_CURRENT_OUTPUT_LEAF');
 need(!fs.existsSync(root),'COLD_CURRENT_OUTPUT_EXISTS');plain(path.dirname(root));fs.mkdirSync(root);
 for(const[name,b]of files){need(typeof name==='string'&&path.basename(name)===name&&Buffer.isBuffer(b),'COLD_CURRENT_OUTPUT_LEAF');const p=path.join(root,name),fd=fs.openSync(p,'wx');try{fs.writeFileSync(fd,b);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}need(read(p).equals(b),'COLD_CURRENT_OUTPUT_READBACK');}
}
function sourceContext(action){
 need(process.platform==='win32'&&process.execPath.toLowerCase()===C.node.toLowerCase(),'COLD_CURRENT_FIXED_NODE');pinned(C.node,C.nodeSha256);
 need(git(['remote','get-url','origin']).toString().trim()===`https://github.com/${REPO}.git`&&git(['remote','get-url','--push','origin']).toString().trim()===`https://github.com/${REPO}.git`&&git(['branch','--show-current']).toString().trim()===BRANCH,'COLD_CURRENT_CANONICAL_SOURCE');
 const own=fileURLToPath(import.meta.url),expected=action==='--prepare'?path.join(C.sourceRoot,'scripts','canonical',COLD_PROOF_FILES[0]):path.join(PROOF,COLD_PROOF_FILES[0]);need(own===expected,'COLD_CURRENT_FIXED_ENTRY');
 const source=action==='--prepare'?git(['rev-parse','HEAD']).toString().trim():JSON.parse(read(path.join(PROOF,'source-manifest.json'))).sourceCommit;need(hex(source,40),'COLD_CURRENT_SOURCE_COMMIT');
 const head=git(['rev-parse','HEAD']).toString().trim();need(hex(head,40),'COLD_CURRENT_SOURCE_COMMIT');
 try{git(['merge-base','--is-ancestor',source,head]);}catch{fail('COLD_CURRENT_SOURCE_LINEAGE');}
 const files=new Map();for(const name of COLD_OWNER_FILES.concat(COLD_PROOF_FILES)){
  const relative='scripts/canonical/'+name,attrs=git(['check-attr','-z','filter','working-tree-encoding','ident','--',relative]).toString().split('\0');for(let i=0;i+2<attrs.length;i+=3)need(['unspecified','unset'].includes(attrs[i+2]),'COLD_CURRENT_GIT_TRANSFORM');
  const blob=git(['show',source+':'+relative]),local=read(path.join(action==='--prepare'?path.join(C.sourceRoot,'scripts','canonical'):COLD_PROOF_FILES.includes(name)?PROOF:C.root,name));
  need(action==='--prepare'?local.toString('utf8').replaceAll('\r\n','\n')===blob.toString('utf8'):local.equals(blob),'COLD_CURRENT_UNCOMMITTED_SOURCE');
  const current=git(['show',head+':'+relative]),working=read(path.join(C.sourceRoot,'scripts','canonical',name));
  need(current.equals(blob)&&working.toString('utf8').replaceAll('\r\n','\n')===blob.toString('utf8'),'COLD_CURRENT_NEWER_SOURCE_CHANGED');files.set(name,blob);
 }return {source,files};
}
function historicalInputs(){
 validateColdCurrentRaw({failure:read(path.join(C.predecessorRoot,'owner-preparation','install-once','result.json')),readback:read(path.join(C.predecessorRoot,'runtime-failure-readback-1216.json')),summary:read(path.join(C.predecessorRoot,'install-attempt-summary-1216.json')),before:read(path.join(C.beforeRoot,'before.json'))});
 return new Map(PRIVATE_INPUTS.map(([name,relative,h])=>[name,pinned(path.join(C.predecessorRoot,relative),h)]));
}
export function main(action){
 need(['--prepare','--verify'].includes(action),'COLD_CURRENT_FIXED_ACTION');const {source,files}=sourceContext(action),inputs=historicalInputs(),ci=liveCi(source),result=compileColdCurrentArtifacts({source,files,ci,inputs});
 need(!fs.existsSync(path.join(C.privateRoot,'recovery-once')),'COLD_CURRENT_USE_EXISTING_ATTEMPT');
 if(action==='--prepare'){
  need(!fs.existsSync(C.root)&&!fs.existsSync(C.privateRoot),'COLD_CURRENT_OUTPUT_EXISTS');plain(path.dirname(C.root));plain(path.dirname(C.privateRoot));fs.mkdirSync(C.privateRoot);writeColdCurrentNew(PROOF,result.proof);writeColdCurrentNew(C.root,result.core);
 }else{for(const[root,payload]of[[C.root,result.core],[PROOF,result.proof]]){need(same(fs.readdirSync(root).sort(),[...payload.keys()].sort()),'COLD_CURRENT_OUTPUT_CLOSURE');for(const[name,b]of payload)need(read(path.join(root,name)).equals(b),'COLD_CURRENT_ARTIFACT_CHANGED');}}
 return result.verification;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){try{need(process.argv.length===3,'COLD_CURRENT_FIXED_ACTION');process.stdout.write(JSON.stringify(main(process.argv[2]))+'\n');}catch(e){process.stderr.write((/^[A-Z][A-Z0-9_]+$/.test(e.message)?e.message:'COLD_CURRENT_VERIFICATION_FAILED')+'\n');process.exitCode=1;}}
