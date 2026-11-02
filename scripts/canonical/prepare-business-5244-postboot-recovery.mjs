import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import {pathToFileURL} from 'node:url';

export const POSTBOOT=Object.freeze({
 id:'ERP-B6-POSTBOOT-ENTRY-FIX-20261102-0742',
 source:String.raw`C:\Sirket\ERP\worktrees\erp-p03-pr53-candidate-20261018`,
 root:String.raw`C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-POSTBOOT-ENTRY-0742-20261102`,
 privateRoot:String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-postboot-entry-fix-20261102-0742`,
 taskName:'Melisa-ERP-TEST-Canonical',
 taskBeforeSha256:'4c747a088c387cd714ce9d645831280ffbba59f4f29ce93a8e7e93fa9f7af0da',
 ps:String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,
 node:{path:String.raw`C:\Sirket\ERP\tools\node-v24.19.0\node.exe`,sha256:'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'},
 base:{root:String.raw`C:\Sirket\ERP\releases\CANONICAL-TEST125-CATALOG-COMPAT-20261027-0a221778`,manifestSha256:'0927de3c6d03640acc504d7c8a9aaf1228edbb4170758cf2d1e12f638e044d64',sourceCommit:'edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d'},
 oldWeb:{root:String.raw`C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-B6-PREVIEW-READ-VERIFIED-20261030`,manifestSha256:'853025ef7df10eec9a4feff026b767c6c323e5e5259c7bcbc2f7f19186743855',packageId:'ERP-BUSINESS-WEB-5244-B6-PREVIEW-READ-VERIFIED-20261030',sourceCommit:'fe3948c5ea77e7b0eb215cac6b6b0831adb45e8a'},
 candidateWeb:{root:String.raw`C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-B6-PENDING-5457e450-PASSIVE-20261031`,manifestSha256:'f5f87a6ec42e2e1273d40e2ce030e3c19d836bb96b0d56a0dc289d27a2911afc',packageId:'ERP-BUSINESS-WEB-5244-B6-PENDING-5457e450-PASSIVE-20261031',sourceCommit:'5457e450ad153894c2f81112f08217a16c70330a'},
 api:{root:String.raw`C:\Sirket\ERP\releases\CANONICAL-TEST125-BUSINESS5244-B6-PREVIEW-READ-VERIFIED-20261030`,manifestSha256:'afdb66b5c3450459778630d27bd1ff409ecb80c8ad53058fa048cf3e8e28085c',packageId:'CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029',sourceCommit:'edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d'},
 originalRequestId:'d3d54eed-5de6-46ed-8881-1d3f004c37d8',originalPath:'/api/work-sales/drafts',originalBodySha256:'9a9fa1be7ffe3158f1c05f433fe07e2a9f4c2333005ca1243489d403673a76ed'
});
export const POSTBOOT_FILES=Object.freeze([
 'business-5244-postboot.ps1','business-5244-postboot-native.cs',
 'postboot-task.ps1','postboot-owner.ps1','postboot-control.ps1',
 'start-owned-test.ps1','start-business-5244-owned.ps1','start-business-5244-web.ps1',
 'business-5244-startup-exclusion.ps1','business-5244-retirement-state.ps1',
 'business-5244-retirement-channel.ps1','business-5244-retirement-peer.cs',
 'business-5244-web-native.cs','business-5244-maintenance-dispatch.ps1',
 'canonical-business-sale-maintenance.ps1',
 'test125-bound-maintenance-plan.ps1',
 'capture-business-5244-postboot.ps1',
 'prepare-business-5244-postboot-recovery.mjs',
 'test125-bound-api-quiescence.ps1'
]);
export const POSTBOOT_STEADY=Object.freeze({Old:String.raw`C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-POSTBOOT-STEADY-8530-0742-20261102`,Candidate:String.raw`C:\Sirket\ERP\releases\ERP-BUSINESS-5244-B6-POSTBOOT-STEADY-F5F8-0742-20261102`});
const GIT=String.raw`C:\Program Files\Git\cmd\git.exe`,GH=String.raw`C:\Program Files\GitHub CLI\gh.exe`;
const passive=Object.freeze({installed:false,applied:false,executionAuthority:false,runtimeGo:false,actualT1:false,externalOperations:false});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=o=>Buffer.from(JSON.stringify(o,null,2)+'\n');
const need=(v,c)=>{if(!v)throw new Error(c);};
function plain(p){for(let q=p;q;){need(!fs.lstatSync(q).isSymbolicLink(),'POSTBOOT_REPARSE_REJECTED');const n=path.dirname(q);if(n===q)break;q=n;}}
function git(args){return cp.execFileSync(GIT,['-C',POSTBOOT.source,...args],{windowsHide:true,maxBuffer:32*1024*1024});}
function cli(file,args){return cp.execFileSync(file,args,{windowsHide:true,maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_OPTIONS:'',NODE_PATH:''}});}
export function validatePostbootCapture(c){
 need(c?.schema==='melisa-b6-postboot-capture.v1'&&/^\d{17,18}$/.test(c.beforeBootFileTime)&&/^\d{17,18}$/.test(c.capturedFileTime)&&BigInt(c.beforeBootFileTime)<BigInt(c.capturedFileTime),'POSTBOOT_CAPTURE_EPOCH_REJECTED');
 need(typeof c.taskXml==='string'&&hash(Buffer.from(c.taskXml))===POSTBOOT.taskBeforeSha256&&typeof c.taskSddl==='string'&&c.taskSddl.length>20,'POSTBOOT_CAPTURE_TASK_CHANGED');
 need(c.taskChanges===0&&c.sqlCalls===0&&c.processActions===0,'POSTBOOT_CAPTURE_EFFECT_REJECTED');
 need(Array.isArray(c.protected)&&c.protected.length>=5&&new Set(c.protected.map(f=>f.path.toLowerCase())).size===c.protected.length,'POSTBOOT_CAPTURE_PROTECTED_REJECTED');
 for(const f of c.protected)need(Object.keys(f).sort().join(',')==='path,sha256'&&typeof f.path==='string'&&f.path.startsWith('C:\\Sirket\\ERP\\')&&path.win32.normalize(f.path)===f.path&&!f.path.includes('/')&&/^[a-f0-9]{64}$/.test(f.sha256),'POSTBOOT_CAPTURE_PROTECTED_REJECTED');
 need(c.windowsPowerShell?.path===POSTBOOT.ps&&/^[a-f0-9]{64}$/.test(c.windowsPowerShell.sha256),'POSTBOOT_CAPTURE_EXECUTABLE_REJECTED');
 const h=c.health;
 need(c.base&&c.base.root===POSTBOOT.base.root&&c.base.manifestSha256===POSTBOOT.base.manifestSha256&&c.base.sourceCommit===POSTBOOT.base.sourceCommit,'POSTBOOT_CAPTURE_BASE_CHANGED');
 need(h&&h.ok===true&&h.environment==='CANONICAL_TEST'&&h.port===4144&&h.mode==='erp'&&h.databaseName==='MELISA_ERP_SIRKET_TEST_20260929_01'&&h.serverName.toLowerCase()==='semih\\melisadev'&&h.sourceCommit===POSTBOOT.api.sourceCommit&&h.packageId===POSTBOOT.api.packageId&&h.actualT1===false&&h.externalOperations===false&&h.automaticJobs===false&&h.sysadmin===0&&h.databaseControl===0&&h.liveDatabaseAccess===0,'POSTBOOT_CAPTURE_API_REJECTED');
 return c;
}
export function projectPostbootTask(xml,manifestHash,slot=null){
 need(typeof xml==='string'&&/^[a-f0-9]{64}$/.test(manifestHash),'POSTBOOT_TASK_PROJECTION_REJECTED');
 need(slot===null||Object.hasOwn(POSTBOOT_STEADY,slot),'POSTBOOT_TASK_SLOT_REJECTED');
 const matches=[...xml.matchAll(/<Arguments>([\s\S]*?)<\/Arguments>/g)];need(matches.length===1,'POSTBOOT_TASK_ACTION_COUNT');
 const root=slot===null?POSTBOOT.root:POSTBOOT_STEADY[slot];
 const args=`-NoProfile -NonInteractive -WindowStyle Hidden -File "${root}\\postboot-task.ps1" -ManifestSha256 ${manifestHash}`;
 const escaped=args.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const m=matches[0];return xml.slice(0,m.index)+`<Arguments>${escaped}</Arguments>`+xml.slice(m.index+m[0].length);
}
export function compilePostbootGeneration({source,files,capture,ci}){
 validatePostbootCapture(capture);need(/^[a-f0-9]{40}$/.test(source),'POSTBOOT_SOURCE_REQUIRED');
 need(files instanceof Map&&files.size===POSTBOOT_FILES.length&&POSTBOOT_FILES.every(n=>Buffer.isBuffer(files.get(n))),'POSTBOOT_SOURCE_CLOSURE_REQUIRED');
 need(Array.isArray(ci)&&ci.length===2&&['push','pull_request'].every(event=>ci.filter(r=>r.event===event&&r.head===source&&r.conclusion==='success'&&r.jobs?.length===3&&['quality-build-test','secret-scan','windows-startup-test'].every(name=>r.jobs.filter(j=>j.name===name&&j.conclusion==='success').length===1)).length===1),'POSTBOOT_EXACT_CI_REQUIRED');
 const rows=POSTBOOT_FILES.map(name=>({path:name,sha256:hash(files.get(name)),bytes:files.get(name).length}));
 const taskXml=Buffer.from(capture.taskXml),taskSddl=Buffer.from(capture.taskSddl);
 const common={schema:'melisa-b6-postboot-generation.v1',id:POSTBOOT.id,privateRoot:POSTBOOT.privateRoot,sourceCommit:source,files:rows,protected:[...capture.protected,{path:path.win32.join(POSTBOOT.privateRoot,'task-before.xml'),sha256:hash(taskXml)},{path:path.win32.join(POSTBOOT.privateRoot,'task-before.sddl'),sha256:hash(taskSddl)}],taskSddlSha256:hash(taskSddl),beforeBootFileTime:capture.beforeBootFileTime,capturedFileTime:capture.capturedFileTime,health:capture.health,windowsPowerShell:capture.windowsPowerShell,node:POSTBOOT.node,oldWeb:POSTBOOT.oldWeb,candidateWeb:POSTBOOT.candidateWeb,api:POSTBOOT.api,base:POSTBOOT.base,origin:'http://192.168.1.46:5244',originalRequestId:POSTBOOT.originalRequestId,originalPath:POSTBOOT.originalPath,originalBodySha256:POSTBOOT.originalBodySha256,...passive};
 const planSha256=hash(bytes(common)),steady={},steadyFiles={};
 for(const slot of ['Old','Candidate']){const raw=bytes({...common,root:POSTBOOT_STEADY[slot],phase:'STEADY',initialSlot:slot,planSha256});steady[slot]={root:POSTBOOT_STEADY[slot],manifestSha256:hash(raw)};steadyFiles[slot]=new Map([...files,['postboot-manifest.json',raw]]);}
 const manifest=bytes({...common,root:POSTBOOT.root,phase:'FINITE',initialSlot:'Old',planSha256,steady});
 const manifestHash=hash(manifest),proposal=Buffer.from(projectPostbootTask(capture.taskXml,manifestHash));
 return {root:new Map([...files,['postboot-manifest.json',manifest]]),steadyFiles,steady,proof:new Map([['task-before.xml',taskXml],['task-before.sddl',taskSddl],['task-proposed-NOT-APPLIED.xml',proposal],...['Old','Candidate'].map(slot=>[`task-steady-${slot.toLowerCase()}-NOT-APPLIED.xml`,Buffer.from(projectPostbootTask(capture.taskXml,steady[slot].manifestSha256,slot))]),['capture.json',bytes(capture)],['ci-provenance.json',bytes(ci)],['preparation-receipt.json',bytes({schema:'melisa-b6-postboot-preparation.v1',id:POSTBOOT.id,sourceCommit:source,manifestSha256:manifestHash,steady,planSha256,taskProposalSha256:hash(proposal),taskActionChangesPerProposal:1,taskChangesApplied:0,oldNamespacesReused:false,postbootObserved:false,...passive})]]),manifestHash};
}
function liveCi(source){
 const runs=JSON.parse(cli(GH,['run','list','--repo','melihsnyldzz-ui/melisa-erp-v2','--commit',source,'--limit','20','--json','databaseId,event,status,conclusion,headSha,workflowName']));
 return ['push','pull_request'].map(event=>{
  const r=runs.find(r=>r.event===event&&r.workflowName==='CI');need(r&&r.status==='completed'&&r.conclusion==='success'&&r.headSha===source,'POSTBOOT_EXACT_CI_REQUIRED');
  const detail=JSON.parse(cli(GH,['run','view',String(r.databaseId),'--repo','melihsnyldzz-ui/melisa-erp-v2','--json','jobs,attempt']));need(detail.attempt===1,'POSTBOOT_CI_ATTEMPT_CHANGED');
  return {event,head:source,run:r.databaseId,conclusion:r.conclusion,jobs:detail.jobs.map(j=>({name:j.name,conclusion:j.conclusion}))};
 });
}
function sourceFiles(source){return new Map(POSTBOOT_FILES.map(n=>[n,git(['show',`${source}:scripts/canonical/${n}`])]));}
function writeNew(dir,files){need(!fs.existsSync(dir),'POSTBOOT_OUTPUT_EXISTS');plain(path.dirname(dir));fs.mkdirSync(dir);for(const [leaf,b]of files){need(!/[\\/]/.test(leaf),'POSTBOOT_OUTPUT_SCOPE');fs.writeFileSync(path.join(dir,leaf),b,{flag:'wx'});}}
function verifyFiles(dir,files){plain(dir);const names=fs.readdirSync(dir).sort();need(JSON.stringify(names)===JSON.stringify([...files.keys()].sort()),'POSTBOOT_OUTPUT_CLOSURE_CHANGED');for(const [leaf,b]of files){const p=path.join(dir,leaf);plain(p);need(fs.statSync(p).isFile()&&fs.statSync(p).nlink===1&&fs.readFileSync(p).equals(b),'POSTBOOT_OUTPUT_CHANGED');}}
function verifyBindings(){for(const p of [POSTBOOT.oldWeb,POSTBOOT.candidateWeb,POSTBOOT.api,POSTBOOT.base]){const f=path.join(p.root,'release-manifest.json');plain(f);need(hash(fs.readFileSync(f))===p.manifestSha256,'POSTBOOT_PACKAGE_MANIFEST_CHANGED');}plain(POSTBOOT.node.path);need(hash(fs.readFileSync(POSTBOOT.node.path))===POSTBOOT.node.sha256,'POSTBOOT_NODE_CHANGED');}
export function main(args){
 need(process.platform==='win32'&&args.length===1&&['--prepare','--verify','--read-only-preflight'].includes(args[0]),'POSTBOOT_FIXED_ACTION');
 need(git(['remote','get-url','origin']).toString().trim()==='https://github.com/melihsnyldzz-ui/melisa-erp-v2.git'&&git(['remote','get-url','--push','origin']).toString().trim()==='https://github.com/melihsnyldzz-ui/melisa-erp-v2.git','POSTBOOT_REPO_IDENTITY_CHANGED');
 verifyBindings();let capture,source;
 if(args[0]==='--prepare'){
  need(git(['branch','--show-current']).toString().trim()==='codex/erp-p03-pr53-candidate-20261018','POSTBOOT_FEATURE_BRANCH_REQUIRED');source=git(['rev-parse','HEAD']).toString().trim();
  const files=sourceFiles(source),ci=liveCi(source);need(!fs.existsSync(POSTBOOT.root)&&!fs.existsSync(POSTBOOT.privateRoot)&&Object.values(POSTBOOT_STEADY).every(p=>!fs.existsSync(p)),'POSTBOOT_OUTPUT_EXISTS');
  // The capture is canonical Git bytes in a fresh private temporary script,
  // executed by normal PS5: no encoded command or policy override.
  const captureBytes=files.get('capture-business-5244-postboot.ps1');
  const captureDir=path.join(process.env.TEMP,`melisa-postboot-capture-${crypto.randomUUID()}`);fs.mkdirSync(captureDir);const capturePath=path.join(captureDir,'capture.ps1');fs.writeFileSync(capturePath,captureBytes,{flag:'wx'});
  const result=cli(POSTBOOT.ps,['-NoProfile','-NonInteractive','-File',capturePath,'-Capture']);capture=JSON.parse(result.toString('utf8').replace(/^\uFEFF/,''));
  const compiled=compilePostbootGeneration({source,files,capture,ci});verifyBindings();writeNew(POSTBOOT.privateRoot,compiled.proof);writeNew(POSTBOOT.root,compiled.root);for(const slot of ['Old','Candidate'])writeNew(POSTBOOT_STEADY[slot],compiled.steadyFiles[slot]);
  return {schema:'melisa-b6-postboot-prepared.v1',sourceCommit:source,root:POSTBOOT.root,manifestSha256:compiled.manifestHash,steady:compiled.steady,taskProposalApplied:false,postbootObserved:false,...passive};
 }
 const recorded=JSON.parse(fs.readFileSync(path.join(POSTBOOT.privateRoot,'preparation-receipt.json')));source=recorded.sourceCommit;capture=JSON.parse(fs.readFileSync(path.join(POSTBOOT.privateRoot,'capture.json')));
 const ci=JSON.parse(fs.readFileSync(path.join(POSTBOOT.privateRoot,'ci-provenance.json')));liveCi(source);const compiled=compilePostbootGeneration({source,files:sourceFiles(source),capture,ci});verifyFiles(POSTBOOT.root,compiled.root);verifyFiles(POSTBOOT.privateRoot,compiled.proof);
 for(const slot of ['Old','Candidate'])verifyFiles(POSTBOOT_STEADY[slot],compiled.steadyFiles[slot]);
 if(args[0]==='--read-only-preflight'){
  const result=JSON.parse(cli(POSTBOOT.ps,['-NoProfile','-NonInteractive','-File',path.join(POSTBOOT.root,'capture-business-5244-postboot.ps1'),'-ReadOnlyPreflight','-ManifestSha256',compiled.manifestHash]).toString('utf8').replace(/^\uFEFF/,''));
  need(result.schema==='melisa-b6-postboot-read-only-preflight.v1'&&result.sourceCommit===source&&result.executableIdentityVerified===true&&result.argumentTailExact===true&&result.frozenSourceClosures===3&&result.sourceFilesPerClosure===19&&['taskWrites','registrationCalls','claims','pendingWrites'].every(k=>result[k]===0)&&result.runtimeGo===false&&result.postbootObserved===false,'POSTBOOT_READ_ONLY_PREFLIGHT_REJECTED');return result;
 }
 return {schema:'melisa-b6-postboot-verified.v1',sourceCommit:source,manifestSha256:compiled.manifestHash,steady:compiled.steady,taskProposalApplied:false,postbootObserved:false,...passive};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{process.stdout.write(JSON.stringify(main(process.argv.slice(2)))+'\n');}catch(e){process.stderr.write((/^POSTBOOT_[A-Z0-9_]+$/.test(e.message)?e.message:'POSTBOOT_PREPARATION_FAILED')+'\n');process.exitCode=1;}}
