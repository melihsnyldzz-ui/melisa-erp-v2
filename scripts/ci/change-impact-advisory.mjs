import {spawnSync} from 'node:child_process';
import {lstatSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// Advisory impact selection only. It is not a workflow, release, installation,
// CI-success or producer-admission signal. Unknown state always means FULL.
const sha=/^[a-f0-9]{40}$/;
const ZERO='0'.repeat(40);
const FLAGS=Object.freeze({scannerRequired:true,buildRequired:true,exactHeadFullPushAndPrRequired:true,producerAdmission:false,installationAdmission:false});
const outcome=(scope,reason)=>Object.freeze({schema:'melisa-ci-impact-advisory.v1',scope,reason,...FLAGS});
const full=reason=>outcome('FULL',reason);
const safePath=p=>typeof p==='string'&&p.length<=512&&/^docs\/evidence\/erp\/[A-Za-z0-9][A-Za-z0-9_./-]*\.md$/.test(p)&&p.split('/').every(s=>s&&s!=='.'&&s!=='..'&&s.toLowerCase()!=='agents.md');
const exactSha=v=>typeof v==='string'&&v.length===40&&sha.test(v)&&v!==ZERO;
function parseRaw(input){
 if(!Buffer.isBuffer(input)||input.length===0||input.length>2097152||input.at(-1)!==0)throw Error('DIFF_INVALID');
 const decoder=new TextDecoder('utf-8',{fatal:true}),parts=decoder.decode(input).split('\0');parts.pop();const rows=[];
 for(let i=0;i<parts.length;){
  const header=parts[i++],m=/^:(\d{6}) (\d{6}) ([a-f0-9]{40}) ([a-f0-9]{40}) ([A-Z][0-9]*)$/.exec(header);if(!m||m[0]!==header||i>=parts.length)throw Error('DIFF_INVALID');
  const code=m[5],p=parts[i++];if(/^[RC]/.test(code)){if(i>=parts.length)throw Error('DIFF_INVALID');i++;return null;}
  if(!['A','M'].includes(code))return null;
  rows.push({status:code,path:p,oldMode:m[1],newMode:m[2],oldOid:m[3],newOid:m[4]});
 }
 return rows;
}
// GitHub job data must come from a trusted caller. This verifies its shape and
// exact base/head coverage but cannot authenticate caller-supplied JSON; no
// deployment/CI authority follows from the advisory result.
export function hasFullBaseEvidence(base,evidence){
 if(!exactSha(base)||!evidence||typeof evidence!=='object'||Array.isArray(evidence)||Object.keys(evidence).sort().join(',')!=='pull_request,push')return false;
 for(const event of ['push','pull_request']){const r=evidence[event];if(!r||r.event!==event||r.head_sha!==base||r.path!=='.github/workflows/ci.yml'||r.run_attempt!==1||r.status!=='completed'||r.conclusion!=='success'||!Number.isSafeInteger(r.id)||r.id<=0||!Array.isArray(r.jobs)||r.jobs.length!==4)return false;
  const proof=r.fullScopeEvidence;if(!proof||proof.schema!=='melisa-ci-full-run-attestation.v1'||proof.scope!=='FULL'||proof.event!==event||proof.head_sha!==base||proof.run_id!==r.id||proof.run_attempt!==1||proof.allAssertionsExecuted!==true)return false;
  for(const name of ['change-impact','windows-startup-test','quality-build-test','secret-scan']){const jobs=r.jobs.filter(j=>j.name===name);if(jobs.length!==1||jobs[0].status!=='completed'||jobs[0].conclusion!=='success'||!Array.isArray(jobs[0].steps)||jobs[0].steps.length===0||jobs[0].steps.some(s=>s.status!=='completed'||s.conclusion!=='success'))return false;}
 }return evidence.push.id!==evidence.pull_request.id;
}
export function classifyCiImpact({base,head,checkedOutHead,ancestryVerified,rawDiff,fullBaseEvidence,fullRequested=false}={}){
 if(!exactSha(base)||!exactSha(head)||!exactSha(checkedOutHead)||head!==checkedOutHead||base===head||ancestryVerified!==true)return full('UNVERIFIED_GIT_RANGE');
 if(fullRequested===true)return full('FULL_EXPLICITLY_REQUESTED');
 if(fullRequested!==false)return full('UNVERIFIED_FULL_REQUEST');
 if(!hasFullBaseEvidence(base,fullBaseEvidence))return full('FULL_BASE_CI_UNVERIFIED');
 return classifyRows(rawDiff);
}
function classifyRows(rawDiff){
 let rows;try{rows=parseRaw(rawDiff);}catch{return full('INVALID_OR_EMPTY_DIFF');}if(!rows?.length)return full('UNSUPPORTED_CHANGE');
 const names=new Set();for(const r of rows){
  const key=r.path.toLowerCase();if(!safePath(r.path)||names.has(key)||r.newMode!=='100644'||r.status==='A'&&(r.oldMode!=='000000'||r.oldOid!==ZERO)||r.status==='M'&&(r.oldMode!=='100644'||!exactSha(r.oldOid))||!exactSha(r.newOid)||r.oldOid===r.newOid)return full('OUTSIDE_DOCUMENT_SCOPE');names.add(key);
 }
 return outcome('DOCS_ONLY','EVIDENCE_MARKDOWN_ONLY');
}

// Different contract: DOCS_ONLY says only that Windows may be marked skipped;
// it does not assert that a prior Windows run exists or grant CI authority.
export function classifyWindowsImpact({base,head,checkedOutHead,ancestryVerified,eventVerified,rawDiff,fullRequested=false}={}){
 if(eventVerified!==true||!exactSha(base)||!exactSha(head)||!exactSha(checkedOutHead)||head!==checkedOutHead||base===head||ancestryVerified!==true)return full('UNVERIFIED_EVENT_OR_GIT_RANGE');
 if(fullRequested===true)return full('FULL_EXPLICITLY_REQUESTED');
 if(fullRequested!==false)return full('UNVERIFIED_FULL_REQUEST');
 return classifyRows(rawDiff);
}
const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP)$/i.test(name)));
Object.assign(env,{GIT_NO_REPLACE_OBJECTS:'1',GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null'});
function git(cwd,args){const r=spawnSync('git',['--no-optional-locks','-c','core.fsmonitor=false',...args],{cwd,env,encoding:null,windowsHide:true,timeout:30000,maxBuffer:2097152});if(r.error||r.status!==0||!Buffer.isBuffer(r.stdout))throw Error('GIT_UNAVAILABLE');return r.stdout;}
export function inspectCiImpact({cwd,base,head,fullBaseEvidence}={}){
 if(typeof cwd!=='string'||!path.isAbsolute(cwd)||!exactSha(base)||!exactSha(head)||base===head)return full('UNVERIFIED_GIT_RANGE');
 try{
  const checkout=git(cwd,['rev-parse','--verify','HEAD^{commit}']).toString('utf8').trim();
  git(cwd,['cat-file','-e',`${base}^{commit}`]);git(cwd,['cat-file','-e',`${head}^{commit}`]);git(cwd,['merge-base','--is-ancestor',base,head]);
  // An exact line in the HEAD commit is an opt-in to MORE checks, never less.
  // Both push and pull_request must inspect that exact same commit separately.
  const message=new TextDecoder('utf-8',{fatal:true}).decode(git(cwd,['show','-s','--format=%B',head]));
  const fullRequested=message.split(/\r?\n/).includes('ERP-CI-FULL: required');
  // Renames/copies, deletes, submodules, symlinks and malformed paths never
  // qualify for the narrow scope. Names and contents are not printed.
  const rawDiff=git(cwd,['diff','--raw','-z','--abbrev=40','--find-renames','--find-copies','--find-copies-harder','--no-ext-diff','--no-textconv',base,head,'--']);
  return classifyCiImpact({base,head,checkedOutHead:checkout,ancestryVerified:true,rawDiff,fullBaseEvidence,fullRequested});
 }catch{return full('GIT_UNAVAILABLE_OR_INCOMPLETE');}
}

// Caller must run the reviewed classifier from a trusted source; this function
// verifies event identity and Git objects, not the authority of the workflow.
// In particular, arbitrary local JSON/environment values are NOT GitHub proof.
export function inspectGithubImpact({cwd,event,eventName,githubSha,githubRepository,githubRef}={}){
 if(typeof cwd!=='string'||!path.isAbsolute(cwd)||!event||typeof event!=='object'||Array.isArray(event)||!exactSha(githubSha)||githubRepository!=='melihsnyldzz-ui/melisa-erp-v2'||event.repository?.full_name!==githubRepository)return full('EVENT_UNVERIFIED');
 try{
  const root=git(cwd,['rev-parse','--show-toplevel']).toString('utf8').trim();
  if(path.resolve(root).toLowerCase()!==path.resolve(cwd).toLowerCase()||git(cwd,['status','--porcelain=v1','-z','--untracked-files=all']).length!==0)return full('CHECKOUT_UNVERIFIED');
  const checkout=git(cwd,['rev-parse','--verify','HEAD^{commit}']).toString('utf8').trim();
  if(checkout!==githubSha)return full('CHECKOUT_UNVERIFIED');
  let base,branchHead;
  if(eventName==='push'){
   base=event.before;branchHead=event.after;
   if(event.ref!=='refs/heads/codex/erp-p03-pr53-candidate-20261018'||githubRef!==event.ref||event.deleted!==false||event.forced!==false||branchHead!==githubSha||!exactSha(base)||!exactSha(branchHead))return full('PUSH_UNVERIFIED');
  }else if(eventName==='pull_request'){
   const pr=event.pull_request;
   if(!['opened','reopened','synchronize'].includes(event.action)||event.number!==54||githubRef!=='refs/pull/54/merge'||!pr||pr.base?.ref!=='codex/erp-p03-integrated-candidate-20261017'||pr.head?.ref!=='codex/erp-p03-pr53-candidate-20261018'||pr.base?.repo?.full_name!==githubRepository||pr.head?.repo?.full_name!==githubRepository)return full('PR_UNVERIFIED');
   base=pr.base.sha;branchHead=pr.head.sha;
   if(!exactSha(base)||!exactSha(branchHead)||base===branchHead)return full('PR_UNVERIFIED');
   const parents=git(cwd,['rev-list','--parents','-n','1',githubSha]).toString('utf8').trim().split(' ');
   if(parents.length!==3||parents[0]!==githubSha||parents[1]!==base||parents[2]!==branchHead)return full('PR_MERGE_UNVERIFIED');
  }else return full('EVENT_UNSUPPORTED');
  if(base===githubSha)return full('EMPTY_RANGE');
  git(cwd,['cat-file','-e',`${base}^{commit}`]);git(cwd,['cat-file','-e',`${branchHead}^{commit}`]);git(cwd,['merge-base','--is-ancestor',base,githubSha]);
  const message=new TextDecoder('utf-8',{fatal:true}).decode(git(cwd,['show','-s','--format=%B',branchHead]));
  const fullRequested=message.split(/\r?\n/).includes('ERP-CI-FULL: required');
  const rawDiff=git(cwd,['diff','--raw','-z','--abbrev=40','--find-renames','--find-copies','--find-copies-harder','--no-ext-diff','--no-textconv',base,githubSha,'--']);
  return classifyWindowsImpact({base,head:githubSha,checkedOutHead:checkout,ancestryVerified:true,eventVerified:true,rawDiff,fullRequested});
 }catch{return full('EVENT_OR_GIT_UNAVAILABLE');}
}
function githubEventFile(file){
 if(typeof file!=='string'||!path.isAbsolute(file))throw Error('EVENT_FILE');
 const stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1048576)throw Error('EVENT_FILE');
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(readFileSync(file)));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let result=full('INVALID_ARGUMENTS');
 if(process.argv.length===3&&process.argv[2]==='--github-event')try{result=inspectGithubImpact({cwd:process.cwd(),event:githubEventFile(process.env.GITHUB_EVENT_PATH),eventName:process.env.GITHUB_EVENT_NAME,githubSha:process.env.GITHUB_SHA,githubRepository:process.env.GITHUB_REPOSITORY,githubRef:process.env.GITHUB_REF});}catch{}
 process.stdout.write(result.scope+'\n');
}
