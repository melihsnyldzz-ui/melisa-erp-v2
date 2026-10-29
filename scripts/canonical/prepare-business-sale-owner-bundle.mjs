// Fixed passive B6 owner packaging. No SQL, service/task, owner IPC or install.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const SCOPE='TEST125-API-B6-ca620bac-20261028';
const APP_SOURCE='ca620bac30f96034b33d4410dc43576a38a38707';
const SOURCE_ROOT=String.raw`C:\Sirket\ERP\worktrees\erp-p03-pr53-candidate-20261018`;
const RELEASES=String.raw`C:\Sirket\ERP\releases`;
const CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-OWNER-20261029-SQLCOLLATION');
const ROUTER=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-ROUTER-20261029-SQLCOLLATION');
const PRIVATE=String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-passive-pair-ca620bac-20261028\sql-collation-recovered-20261029`;
const PROOF=path.win32.join(PRIVATE,'owner-preparation');
const VERIFIED_PRODUCER=path.win32.join(PROOF,'verified-owner-producer.mjs');
const CURRENT_SUPERSESSION_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-CURRENT-SUPERSESSION-20261029');
const CURRENT_SUPERSESSION_PRIVATE=String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-passive-pair-ca620bac-20261028\current-only-supersession-20261029`;
const CURRENT_SUPERSESSION_PROOF=path.win32.join(CURRENT_SUPERSESSION_PRIVATE,'owner-preparation');
const CURRENT_SUPERSESSION_VERIFIER=path.win32.join(CURRENT_SUPERSESSION_PROOF,'verified-owner-producer.mjs');
const CURRENT_SUPERSESSION_INPUTS=Object.freeze({
 'oldpending.before.bin':'7c42681742b6c858cda7eff730a955adeb4c2975ca8692bf95d94ca68af3fcab',
 'oldrecord.before.json':'3cd6768cdc129dbbfee8a6c30b829b746a2ca4fbe4df31302948a48658a86c74',
 'supersession-fixed-case.json':'8965df723ec4bdbbd12360129d54aab47484d67ad76d8c42f4ec7c7b67c6caf8',
 'current-entry-hold-capture.json':'311b3facefe4aa9c0e0629a1fe5ca2e87d11e04f2562a3a237a51be54c116a55',
 'protected-boundary.json':'a0edcc36f31103db37ae90ec3727ecd1f450eeb8bac1714c442b678cbfd45a3e',
});
const SQLCOLLATION_CORE_HASH='e06fc655f1473a4fe998383f2d86e992e6761bf177393edc5379975c506ba2a0';
const SQLCOLLATION_ROUTER_HASH='2d5a2a5b2e680f3b6a7dd83d2b97704c55867bb7ee734850f05caeb9b1faa2ee';
const SQLCOLLATION_CURRENT_HASH='a622e726385ed2564709814400d2f5125fd8b62eee7290515905c07c02c310fd';
const SQLCOLLATION_ROUTER_ENTRY_HASH='1f197ebfe70280cdfd04e560c1bb2aa1445f801533a5abfbeee6a4e7c5514197';
const SQLCOLLATION_SOURCE='1700581e6d1986772ddebc903019848b2847d473';
const OLD_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-OWNER-20261029-HASHCASE');
const OLD_ROUTER=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-ROUTER-20261029-HASHCASE');
const OLD_CORE_HASH='e9afdf730956822d1f1a94352c83bf0aeb4d5d891ea09aae07143e2fe17ad879';
const OLD_ROUTER_HASH='ef941287977c2913a8c4ca43cfa002e19f006d6239b9059a5c734cd0db6174e2';
const OLD_ENTRY_HASH='269ec4c3459c9e705165755f8afe9a949dd119a745e5d1f7a1585d6e60b6ef4f';
const OLD_ROUTER_ENTRY_HASH='e160fd137828a98f6b4faf814243159276a2707667885f4e321d2ed39abbf238';
const OLD_SOURCE='c6526e78e793d459141cc4fc22a33758f53658d0';
const OLD_ARGV_HASH='aba861a9f55eb0b2aa650bd7d68031da83b1c30e81c588cb83200bfc397c79e5';
const PRIOR_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-OWNER-20261029');
const PRIOR_ROUTER=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-ROUTER-20261029');
const PRIOR_CORE_HASH='a38e5c00be6d460dc87b4c5d8128dec10f01c8cc4d2d3c76a425fa6d36286deb';
const PRIOR_ROUTER_HASH='90fd861b738e07d241ab27980d4ca50dcab7d667bebf4b2d591c0922b4a6006c';
const PRIOR_ENTRY_HASH='9c473098133f2a7c2b0720c74778d41878064641b201846699f6a53cb4649d8d';
const PRIOR_ROUTER_ENTRY_HASH='7b98143028e0337f4716840bdc9aa774823a95ac53dea5b18619b59dbcba1b21';
const PRIOR_SOURCE='971416ba0d38031a3469f2ee497d722f856a343c';
const RECOVERY_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-OWNER-20261028');
const RECOVERY_ROUTER=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-ROUTER-20261028');
const RECOVERY_CORE_HASH='f6c48a1626d281699e14d783b641fcc95ccf9a9de5ad286332b8a1d9e18da235';
const RECOVERY_ROUTER_HASH='7a06577497d6814b1306fb3d2c2755fde88c2e115f621994563f0b2ae6647e9b';
const RECOVERY_ENTRY_HASH='b9e9f0661c3349e8a1b56b17460bffbc776fa7990115cba1c04602a3367641cb';
const RECOVERY_ROUTER_ENTRY_HASH='9490f1b32a76ec21dcc14b1be50b193d96c081e7ed5d84dfa210265cf164957a';
const RECOVERY_SOURCE='9941db2cd35afa6e9a26852b70cbb1ef77515e01';
const HISTORY_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-OWNER-b9416929-20261028');
const HISTORY_ROUTER=path.win32.join(RELEASES,'ERP-BUSINESS-5244-READ2B-ROUTER-b9416929-20261028');
const HISTORY_CORE_HASH='5f9e1c11fa3157b378ad2fb679ce380275adc72cac083b539503efc060e21502';
const HISTORY_ROUTER_HASH='e450a61b240063ec8555d015375b3564a5626341b692cc5d160d8947fd3e8feb';
const HISTORY_ROUTER_ENTRY_HASH='f4af241b6634cc7878f95858203a0d22e54862a20878106e7b3bd60811184b12';
const HISTORY_CURRENT_ENTRY_HASH='48067f305fd6488778ac321a04baf9a1d83077355801eff160f894db6564b9b6';
const INPUTS=Object.freeze({
 'current-read2b-owner-capture.json':'4eaa68d16be5260071f74ce7e41e33ce6adaa4c7097d661905968d4b5c1b9945',
 'current-erp-processes.before.json':'20dc7ae37497b88ce7f38039d76481b4f1e0f4e07c503737ec193e85c4be5f1f',
 'current-task.before.xml':'e959af0b36ea9d2bd0fabdd6371174c4bd406258e64dc904e38833f79820d99a',
 'current-task.before.sddl':'cc862b7ac8c18bf4211e9fb5821b6a5ba4611698a3466547ce98a0b54da31ac4',
 'current-task-capture.json':'64dae9de55b1634140958b36d7ab2958fe9cddb26ad98319f9094b4ab561f346',
 'current-entry-hold-capture.json':'e1bc4ffdce569590a0d3874a915a7a2a04502d5c470a837798d0548865077ac3',
});
export const BUSINESS_SALE_OWNER_SOURCE_FILES=Object.freeze([
 'business-5244-startup-exclusion.ps1','start-business-5244-web.ps1','business-5244-web-native.cs',
 'business-5244-retirement-channel.ps1','business-5244-retirement-peer.cs','business-5244-retirement-state.ps1',
 'business-5244-maintenance-dispatch.ps1','start-business-5244-owned.ps1','test125-bound-api-quiescence.ps1',
 'test125-bound-maintenance-plan.ps1','start-owned-test.ps1','canonical-business-sale-maintenance.ps1',
]);
const REQUIRED_JOBS=['windows-startup-test','quality-build-test','secret-scan'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const json=b=>JSON.parse(b.toString('utf8').replace(/^\uFEFF/,''));
const bytes=o=>Buffer.from(JSON.stringify(o,null,2)+'\n');
const fail=code=>{throw Error(code);};
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const commit=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const ps=v=>"'"+v.replaceAll("'","''")+"'";
function plainPath(p){for(let at=p;at;){const s=fs.lstatSync(at);if(s.isSymbolicLink())fail('B6_OWNER_REPARSE_REJECTED');const next=path.dirname(at);if(next===at)break;at=next;}}
function read(p){plainPath(p);return fs.readFileSync(p);}
function pinned(p,expected){const b=read(p);if(hash(b)!==expected)fail('B6_OWNER_INPUT_CHANGED');return b;}
function git(args,raw=false,input){return cp.execFileSync('git',args,{cwd:SOURCE_ROOT,windowsHide:true,...(raw?{}:{encoding:'utf8'}),...(input===undefined?{}:{input}),maxBuffer:8*1024*1024});}
function gh(endpoint){return JSON.parse(cp.execFileSync('gh',['api',endpoint],{cwd:SOURCE_ROOT,windowsHide:true,encoding:'utf8',maxBuffer:4*1024*1024}));}
function committedSources(packagedCommit=null,currentSupersession=false){
 const ownPath=path.resolve(fileURLToPath(import.meta.url));
 const verifier=currentSupersession?CURRENT_SUPERSESSION_VERIFIER:VERIFIED_PRODUCER,verifyAction=currentSupersession?'--verify-current-supersession':'--verify';
 if(process.platform!=='win32'||ownPath!==path.join(SOURCE_ROOT,'scripts','canonical','prepare-business-sale-owner-bundle.mjs')&&(ownPath!==verifier||process.argv.slice(2).join('|')!==verifyAction))fail('B6_OWNER_FIXED_SOURCE_REQUIRED');
 for(const args of [['remote','get-url','origin'],['remote','get-url','--push','origin']])if(git(args).trim()!=='https://github.com/melihsnyldzz-ui/melisa-erp-v2.git')fail('B6_OWNER_ORIGIN_CHANGED');
 if(git(['branch','--show-current']).trim()!=='codex/erp-p03-pr53-candidate-20261018')fail('B6_OWNER_BRANCH_CHANGED');
 const repoHead=git(['rev-parse','HEAD']).trim();if(!commit(repoHead)||git(['status','--porcelain','--untracked-files=no']).trim())fail('B6_OWNER_COMMITTED_CLEAN_SOURCE_REQUIRED');
 const head=packagedCommit??repoHead;if(!commit(head))fail('B6_OWNER_SOURCE_COMMIT_REJECTED');
 if(head!==repoHead){try{git(['merge-base','--is-ancestor',head,repoHead]);}catch{fail('B6_OWNER_SOURCE_NOT_CURRENT_ANCESTOR');}}
 const names=[...BUSINESS_SALE_OWNER_SOURCE_FILES,'start-business-5244-readpair-router.ps1','install-business-5244-readpair.ps1','prepare-business-sale-owner-bundle.mjs'];
 const files=new Map(),workingSourceHashes=[];
 for(const name of names){
  const relative='scripts/canonical/'+name;git(['ls-files','--error-unmatch','--',relative]);
  // check-attr does not execute filters. Reject every external clean/encoding
  // transform BEFORE hash-object; only literal text EOL conversion is admitted.
  const rawAttrs=git(['check-attr','-z','filter','working-tree-encoding','ident','text','eol','--',relative]).split('\0');
  if(rawAttrs.pop()!==''||rawAttrs.length!==15)fail('B6_OWNER_SOURCE_ATTRIBUTES_REJECTED');const attrs={};
  for(let n=0;n<rawAttrs.length;n+=3){if(rawAttrs[n]!==relative||Object.hasOwn(attrs,rawAttrs[n+1]))fail('B6_OWNER_SOURCE_ATTRIBUTES_REJECTED');attrs[rawAttrs[n+1]]=rawAttrs[n+2];}
  if(['filter','working-tree-encoding','ident'].some(k=>!['unspecified','unset'].includes(attrs[k]))||!['unspecified','set','auto','unset'].includes(attrs.text)||!['unspecified','lf','crlf'].includes(attrs.eol))fail('B6_OWNER_SOURCE_ATTRIBUTES_REJECTED');
  const b=git(['show',head+':'+relative],true),working=read(path.join(SOURCE_ROOT,relative));
  if(!Buffer.from(working.toString('utf8')).equals(working)||!working.equals(b)&&(attrs.text==='unset'||!Buffer.from(working.toString('utf8').replaceAll('\r\n','\n')).equals(b)))fail('B6_OWNER_WORKING_SOURCE_CHANGED');
  const objectId=git(['rev-parse',head+':'+relative]).trim();
  if(!commit(objectId)||git(['hash-object','--path',relative,'--stdin'],false,working).trim()!==objectId)fail('B6_OWNER_WORKING_SOURCE_CHANGED');
  files.set(name,b);workingSourceHashes.push({path:relative,gitBlobObjectId:objectId,gitBlobSha256:hash(b),workingSha256:hash(working),transform:working.equals(b)?'IDENTICAL':'GIT_TEXT_CRLF_TO_LF_ONLY'});
 }
 if(!files.get('install-business-5244-readpair.ps1').toString('utf8').includes("Hold-B6ReadPairSource $producer '"+hash(files.get('prepare-business-sale-owner-bundle.mjs'))+"'"))fail('B6_OWNER_CONTROLLER_VERIFIER_PIN_MISMATCH');
 return {head,repoHead,files,workingSourceHashes};
}
function hostedSourceChecks(head){
 const endpoint='repos/melihsnyldzz-ui/melisa-erp-v2/actions/runs?head_sha='+head+'&per_page=100',all=gh(endpoint).workflow_runs;
 if(!Array.isArray(all))fail('B6_OWNER_CI_UNAVAILABLE');const result=[];
 for(const event of ['push','pull_request']){
  const run=all.filter(r=>r.head_sha===head&&r.path==='.github/workflows/ci.yml'&&r.event===event).sort((a,b)=>Number(b.id)-Number(a.id))[0];
  if(!run||run.status!=='completed'||run.conclusion!=='success'||!Number.isSafeInteger(run.id)||run.id<=0)fail('B6_OWNER_EXACT_HOSTED_CI_REQUIRED');
  const rows=gh('repos/melihsnyldzz-ui/melisa-erp-v2/actions/runs/'+run.id+'/jobs?filter=latest&per_page=100').jobs;
  if(!Array.isArray(rows))fail('B6_OWNER_CI_UNAVAILABLE');
  for(const name of REQUIRED_JOBS){const found=rows.filter(j=>j.name===name);if(found.length!==1||found[0].status!=='completed'||found[0].conclusion!=='success'||!Array.isArray(found[0].steps)||found[0].steps.length===0)fail('B6_OWNER_REQUIRED_JOB_NOT_SUCCESS');}
  result.push({event,runId:run.id,head,conclusion:'success',jobs:[...REQUIRED_JOBS]});
 }
 return result;
}
function predecessor(){
 const inputs=new Map(Object.entries(INPUTS).map(([name,sha])=>[name,pinned(path.join(PRIVATE,name),sha)])),capture=json(inputs.get('current-read2b-owner-capture.json')),task=json(inputs.get('current-task-capture.json')),entries=json(inputs.get('current-entry-hold-capture.json'));
 if(capture.schema!=='melisa-b6-current-read2b-owner-capture.v1'||capture.predecessorEntryKind!=='ReadPairRouter'||capture.readOnly!==true||capture.stopAuthorized!==false||capture.recordBeforeSha256!==INPUTS['current-erp-processes.before.json']||capture.recordBeforeFile!=='current-erp-processes.before.json'||capture.entry?.root!==OLD_ROUTER||capture.entry.leaf!=='start-business-5244-readpair-router.ps1'||capture.entry.sha256!==OLD_ROUTER_ENTRY_HASH||capture.entry.manifestSha256!==OLD_ROUTER_HASH||capture.router?.root!==OLD_ROUTER||capture.router.manifestSha256!==OLD_ROUTER_HASH||capture.router.entrySha256!==OLD_ROUTER_ENTRY_HASH||capture.core?.root!==OLD_CORE||capture.core.manifestSha256!==OLD_CORE_HASH||capture.core.sourceCommit!==OLD_SOURCE)fail('B6_OWNER_PREDECESSOR_CAPTURE_REJECTED');
 if(capture.owner?.pid!==22260||String(capture.owner.birth)!=='134377094829605064'||capture.owner.exe!==String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`||capture.owner.entry!==path.join(OLD_ROUTER,'start-business-5244-readpair-router.ps1')||capture.owner.argvSha256!==OLD_ARGV_HASH||capture.child?.pid!==24520||String(capture.child.birth)!=='134377102174264511'||capture.child.parent!==22260||capture.nativeStatus?.nativePeerVerified!==true||capture.nativeStatus.stopAuthorized!==false||capture.nativeStatus.childObservationOnly!==true||capture.nativeStatus.reply!=='Status'||capture.nativeStatus.state?.phase!=='Running'||capture.nativeStatus.state.ownerPid!==capture.owner.pid||String(capture.nativeStatus.state.ownerBirth)!==String(capture.owner.birth)||capture.nativeStatus.state.childPid!==capture.child.pid||String(capture.nativeStatus.state.childBirth)!==String(capture.child.birth)||capture.serviceCalls!==0||capture.sqlCalls!==0||capture.retireCalls!==0)fail('B6_OWNER_PREDECESSOR_CAPTURE_REJECTED');
 if(task.schema!=='melisa-b6-current-task-capture.v1'||task.readOnly!==true||task.stopCalls!==0||task.taskChanges!==0)fail('B6_OWNER_TASK_CAPTURE_REJECTED');
 const legacyRuntime=String.raw`C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027`,entryPaths=['start-business-5244-web.ps1','start-business-5244-web-5cb682d8.ps1','start-business-5244-web-66a9c3bc.ps1','start-business-5244-web-bf3d65c7.ps1','start-business-5244-web-d4f52345.ps1'].map(name=>path.join(legacyRuntime,name)).concat(String.raw`C:\Sirket\ERP\clean\20261022\runtime\start-erp.ps1`);
 const directEntries=[{path:path.join(HISTORY_ROUTER,'start-business-5244-readpair-router.ps1'),sha256:HISTORY_ROUTER_ENTRY_HASH},{path:path.join(HISTORY_CORE,'run-current-owner.ps1'),sha256:HISTORY_CURRENT_ENTRY_HASH},{path:path.join(RECOVERY_ROUTER,'start-business-5244-readpair-router.ps1'),sha256:RECOVERY_ROUTER_ENTRY_HASH},{path:path.join(RECOVERY_CORE,'run-current-owner.ps1'),sha256:RECOVERY_ENTRY_HASH},{path:path.join(PRIOR_ROUTER,'start-business-5244-readpair-router.ps1'),sha256:PRIOR_ROUTER_ENTRY_HASH},{path:path.join(PRIOR_CORE,'run-current-owner.ps1'),sha256:PRIOR_ENTRY_HASH},{path:path.join(OLD_ROUTER,'start-business-5244-readpair-router.ps1'),sha256:OLD_ROUTER_ENTRY_HASH},{path:path.join(OLD_CORE,'run-current-owner.ps1'),sha256:OLD_ENTRY_HASH}];
 if(entries.schema!=='melisa-b6-current-entry-hold-capture.v1'||entries.readOnly!==true||entries.executionAuthority!==false||entries.ownerCaptureSha256!==INPUTS['current-read2b-owner-capture.json']||entries.entries?.length!==6||entries.directEntries?.length!==8||entries.entries.some((e,n)=>e.path!==entryPaths[n]||e.afterEqualsBefore!==true||!hex(e.beforeSha256))||entries.directEntries.some((e,n)=>e.path!==directEntries[n].path||e.sha256!==directEntries[n].sha256)||entries.gate?.path!==path.join(legacyRuntime,'business-5244-startup-exclusion-ec316a63.ps1')||entries.gate.sha256!=='a8df8cd3d159b99d1fad4643c986d3ae2244f2976171f4448535a9e822f22a12'||entries.entryWrites!==0||entries.serviceCalls!==0||entries.sqlCalls!==0)fail('B6_OWNER_ENTRY_CAPTURE_REJECTED');
 // The active ReadPairRouter core and all THREE prior generations are sealed.
 // None of the 12/13/13/13 historical payloads or entry files is rewritten.
 for(const generation of [{root:HISTORY_CORE,sha:HISTORY_CORE_HASH,names:[...BUSINESS_SALE_OWNER_SOURCE_FILES.filter(n=>n!=='canonical-business-sale-maintenance.ps1'),'run-current-owner.ps1']},{root:RECOVERY_CORE,sha:RECOVERY_CORE_HASH,source:RECOVERY_SOURCE,names:[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1']},{root:PRIOR_CORE,sha:PRIOR_CORE_HASH,source:PRIOR_SOURCE,names:[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1']},{root:OLD_CORE,sha:OLD_CORE_HASH,source:OLD_SOURCE,names:[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1']}]){
  const core=json(pinned(path.join(generation.root,'owner-manifest.json'),generation.sha));
  if(core.kind!=='BUSINESS5244_FRESH_OWNER_BUNDLE'||!Array.isArray(core.files)||core.files.map(f=>f.path).sort().join('|')!==generation.names.sort().join('|'))fail('B6_OWNER_OLD_CORE_REJECTED');
  if(generation.source&&(core.finiteScope!==SCOPE||core.sourceCommit!==generation.source||core.actualT1!==false||core.externalOperations!==false))fail('B6_OWNER_OLD_CORE_REJECTED');
  if(generation.root===OLD_CORE&&(!Array.isArray(capture.core.files)||capture.core.files.length!==13||capture.core.files.some((f,n)=>f.path!==core.files[n].path||f.sha256!==core.files[n].sha256||f.bytes!==core.files[n].bytes)))fail('B6_OWNER_PREDECESSOR_CAPTURE_REJECTED');
  for(const f of core.files){if(typeof f.path!=='string'||/[\\/]/.test(f.path)||!hex(f.sha256))fail('B6_OWNER_OLD_CORE_REJECTED');const b=pinned(path.join(generation.root,f.path),f.sha256);if(b.length!==f.bytes)fail('B6_OWNER_OLD_CORE_REJECTED');}
 }
 for(const generation of [{root:HISTORY_ROUTER,sha:HISTORY_ROUTER_HASH,core:HISTORY_CORE,coreSha:HISTORY_CORE_HASH,entrySha:HISTORY_ROUTER_ENTRY_HASH},{root:RECOVERY_ROUTER,sha:RECOVERY_ROUTER_HASH,core:RECOVERY_CORE,coreSha:RECOVERY_CORE_HASH,entrySha:RECOVERY_ROUTER_ENTRY_HASH},{root:PRIOR_ROUTER,sha:PRIOR_ROUTER_HASH,core:PRIOR_CORE,coreSha:PRIOR_CORE_HASH,entrySha:PRIOR_ROUTER_ENTRY_HASH},{root:OLD_ROUTER,sha:OLD_ROUTER_HASH,core:OLD_CORE,coreSha:OLD_CORE_HASH,entrySha:OLD_ROUTER_ENTRY_HASH}]){
  const router=json(pinned(path.join(generation.root,'owner-manifest.json'),generation.sha));if(router.coreRoot!==generation.core||router.coreManifestSha256!==generation.coreSha||router.entry!=='start-business-5244-readpair-router.ps1'||router.entrySha256!==generation.entrySha)fail('B6_OWNER_OLD_ROUTER_REJECTED');pinned(path.join(generation.root,router.entry),generation.entrySha);
 }
 for(const entry of directEntries)pinned(entry.path,entry.sha256);
 return {inputs,capture};
}
function predecessorIdentity(){return {captureSha256:INPUTS['current-read2b-owner-capture.json'],recordBeforeSha256:INPUTS['current-erp-processes.before.json'],predecessorEntryKind:'ReadPairRouter',entry:{root:OLD_ROUTER,leaf:'start-business-5244-readpair-router.ps1',sha256:OLD_ROUTER_ENTRY_HASH,manifestSha256:OLD_ROUTER_HASH},routerRoot:OLD_ROUTER,routerManifestSha256:OLD_ROUTER_HASH,routerEntrySha256:OLD_ROUTER_ENTRY_HASH,coreRoot:OLD_CORE,coreManifestSha256:OLD_CORE_HASH};}
function currentSupersessionHistories(){
 const generations=[
  {root:HISTORY_CORE,sha:HISTORY_CORE_HASH,router:HISTORY_ROUTER,routerSha:HISTORY_ROUTER_HASH,entrySha:HISTORY_ROUTER_ENTRY_HASH,currentSha:HISTORY_CURRENT_ENTRY_HASH,legacy:true},
  {root:RECOVERY_CORE,sha:RECOVERY_CORE_HASH,source:RECOVERY_SOURCE,router:RECOVERY_ROUTER,routerSha:RECOVERY_ROUTER_HASH,entrySha:RECOVERY_ROUTER_ENTRY_HASH,currentSha:RECOVERY_ENTRY_HASH},
  {root:PRIOR_CORE,sha:PRIOR_CORE_HASH,source:PRIOR_SOURCE,router:PRIOR_ROUTER,routerSha:PRIOR_ROUTER_HASH,entrySha:PRIOR_ROUTER_ENTRY_HASH,currentSha:PRIOR_ENTRY_HASH},
  {root:OLD_CORE,sha:OLD_CORE_HASH,source:OLD_SOURCE,router:OLD_ROUTER,routerSha:OLD_ROUTER_HASH,entrySha:OLD_ROUTER_ENTRY_HASH,currentSha:OLD_ENTRY_HASH},
  {root:CORE,sha:SQLCOLLATION_CORE_HASH,source:SQLCOLLATION_SOURCE,router:ROUTER,routerSha:SQLCOLLATION_ROUTER_HASH,entrySha:SQLCOLLATION_ROUTER_ENTRY_HASH,currentSha:SQLCOLLATION_CURRENT_HASH},
 ];
 const directEntries=[];
 for(const g of generations){
  const names=[...BUSINESS_SALE_OWNER_SOURCE_FILES.filter(n=>!g.legacy||n!=='canonical-business-sale-maintenance.ps1'),'run-current-owner.ps1'].sort(),core=json(pinned(path.join(g.root,'owner-manifest.json'),g.sha));
  if(core.kind!=='BUSINESS5244_FRESH_OWNER_BUNDLE'||!Array.isArray(core.files)||core.files.map(f=>f.path).sort().join('|')!==names.join('|')||g.source&&(core.finiteScope!==SCOPE||core.sourceCommit!==g.source||core.actualT1!==false||core.externalOperations!==false))fail('B6_CURRENT_SUPERSESSION_HISTORY_CHANGED');
  for(const f of core.files){if(typeof f.path!=='string'||/[\\/]/.test(f.path)||!hex(f.sha256)||!Number.isSafeInteger(f.bytes)||f.bytes<1||pinned(path.join(g.root,f.path),f.sha256).length!==f.bytes)fail('B6_CURRENT_SUPERSESSION_HISTORY_CHANGED');}
  if(core.files.find(f=>f.path==='run-current-owner.ps1').sha256!==g.currentSha)fail('B6_CURRENT_SUPERSESSION_HISTORY_CHANGED');
  const router=json(pinned(path.join(g.router,'owner-manifest.json'),g.routerSha));
  if(router.coreRoot!==g.root||router.coreManifestSha256!==g.sha||router.entry!=='start-business-5244-readpair-router.ps1'||router.entrySha256!==g.entrySha)fail('B6_CURRENT_SUPERSESSION_HISTORY_CHANGED');
  pinned(path.join(g.router,router.entry),g.entrySha);
  directEntries.push({path:path.join(g.router,router.entry),sha256:g.entrySha},{path:path.join(g.root,'run-current-owner.ps1'),sha256:g.currentSha});
 }
 return directEntries;
}
function currentSupersessionCase(){
 if(Object.values(CURRENT_SUPERSESSION_INPUTS).some(v=>!hex(v)))fail('B6_CURRENT_SUPERSESSION_CASE_NOT_PREPARED');
 const inputs=new Map(Object.entries(CURRENT_SUPERSESSION_INPUTS).map(([name,sha])=>[name,pinned(path.join(CURRENT_SUPERSESSION_PRIVATE,name),sha)]));
 const capture=json(inputs.get('supersession-fixed-case.json')),pending=json(inputs.get('oldpending.before.bin')),record=inputs.get('oldrecord.before.json'),entries=json(inputs.get('current-entry-hold-capture.json')),boundary=json(inputs.get('protected-boundary.json'));
 if(capture.schema!=='melisa-5244-current-supersession-case.v1'||capture.readOnly!==true||capture.executionAuthority!==false||capture.serviceCalls!==0||capture.sqlWrites!==0||capture.stopCalls!==0||capture.recordWrites!==0)fail('B6_CURRENT_SUPERSESSION_CASE_REJECTED');
 if(capture.target?.pid!==48212||capture.target.birth!=='134377121934062288'||capture.target.exe!==String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`||capture.target.entryPath!==path.join(ROUTER,'start-business-5244-readpair-router.ps1')||capture.target.argvSha256!=='182a8015aecc2575e4d3088231bc4b2295f4f5087ec0741d3878fd1d43f6336f'||typeof capture.target.sid!=='string'||!/^S-1-5-21-\d+-\d+-\d+-\d+$/.test(capture.target.sid))fail('B6_CURRENT_SUPERSESSION_TARGET_REJECTED');
 const active=capture.active;
 if(active?.coreRoot!==CORE||active.coreManifestSha256!==SQLCOLLATION_CORE_HASH||active.routerRoot!==ROUTER||active.routerManifestSha256!==SQLCOLLATION_ROUTER_HASH||active.routerEntrySha256!==SQLCOLLATION_ROUTER_ENTRY_HASH||active.coreEntrySha256!==SQLCOLLATION_CURRENT_HASH||active.coreSource!==SQLCOLLATION_SOURCE)fail('B6_CURRENT_SUPERSESSION_HISTORY_CHANGED');
 const directEntries=currentSupersessionHistories(),core=json(pinned(path.join(CORE,'owner-manifest.json'),SQLCOLLATION_CORE_HASH));
 if(JSON.stringify(active.coreFiles)!==JSON.stringify(core.files))fail('B6_CURRENT_SUPERSESSION_HISTORY_CHANGED');
 const pendingHash=CURRENT_SUPERSESSION_INPUTS['oldpending.before.bin'],recordHash=CURRENT_SUPERSESSION_INPUTS['oldrecord.before.json'];
 if(pending.schema!=='business-5244-retirement-before.v1'||pending.operationId!=='0cfa751c63644554a4faccd1f1e8d7c6'||pending.ownerPid!==capture.target.pid||pending.ownerBirth!==capture.target.birth||pending.childPid!==47092||pending.childBirth!=='134377122629606295'||pending.beforeSha256!==recordHash||typeof pending.beforeBase64!=='string'||!Buffer.from(pending.beforeBase64,'base64').equals(record)||Buffer.from(pending.beforeBase64,'base64').toString('base64')!==pending.beforeBase64)fail('B6_CURRENT_SUPERSESSION_PENDING_REJECTED');
 if(capture.pending?.path!==String.raw`C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027\5244-retirement.pending`||capture.pending.sha256!==pendingHash||capture.pending.bytes!==inputs.get('oldpending.before.bin').length||capture.pending.operationId!==pending.operationId||capture.pending.beforeRecordSha256!==recordHash||capture.record?.path!==String.raw`C:\Sirket\ERP\clean\20261022\runtime\erp-processes.json`||capture.record.sha256!==recordHash||capture.record.bytes!==record.length||capture.record.actualRecordRead!==false)fail('B6_CURRENT_SUPERSESSION_PENDING_REJECTED');
 const rows=json(record),web=Array.isArray(rows)?rows.filter(r=>r.port===5244):[];
 if(web.length!==1||web[0].pid!==pending.childPid||web[0].root!==String.raw`C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-2b744f5b-API-READ`||web[0].sourceCommit!=='2b744f5b9ebda05b1355602126b1a8e5f114be83')fail('B6_CURRENT_SUPERSESSION_PENDING_REJECTED');
 if(capture.current?.apiPackage!=='CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'||capture.current.apiManifest!=='8b39a46f27ce8c6e0b8e41a34e29bee2aab0b4575129da5503c0602c4c9c8090'||capture.current.webManifest!=='91ee8b23c37a46ec89f8060967bc7a0106f68f2de9a4a1f4199941cce5a9e0fd'||capture.current.database!=='MELISA_ERP_SIRKET_TEST_20260929_01'||capture.current.server!=='Semih\\MELISADEV')fail('B6_CURRENT_SUPERSESSION_CURRENT_REJECTED');
 const protectedPaths=[String.raw`C:\Sirket\ERP\runtime\canonical-test\startup-config.json`,String.raw`C:\Sirket\ERP\config\TEST-20260929-01\runtime-private.json`,String.raw`C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json`];
 if(!Array.isArray(capture.protectedFiles)||capture.protectedFiles.length!==3||capture.protectedFiles.some((f,n)=>f.path!==protectedPaths[n]||!hex(f.sha256))||!Array.isArray(capture.protectedProcesses)||capture.protectedProcesses.length!==4||capture.protectedProcesses.map(p=>p.LocalPort).sort((a,b)=>a-b).join('|')!=='4144|4146|5194|5234'||capture.protectedProcesses.some(p=>!Number.isSafeInteger(p.OwningProcess)||p.OwningProcess<=0))fail('B6_CURRENT_SUPERSESSION_PROTECTION_REJECTED');
 if(boundary.schema!=='melisa-5244-current-supersession-boundary.v1'||boundary.readOnly!==true||boundary.executionAuthority!==false||boundary.caseSha256!==CURRENT_SUPERSESSION_INPUTS['supersession-fixed-case.json']||boundary.writes!==0||boundary.serviceCalls!==0||boundary.sqlCalls!==0||boundary.task?.name!=='Melisa-ERP-TEST-Canonical'||boundary.task.path!=='\\'||boundary.task.xmlSha256!=='e959af0b36ea9d2bd0fabdd6371174c4bd406258e64dc904e38833f79820d99a'||boundary.task.sddlSha256!=='cc862b7ac8c18bf4211e9fb5821b6a5ba4611698a3466547ce98a0b54da31ac4'||!Array.isArray(boundary.processes)||boundary.processes.length!==4||boundary.processes.some((p,n)=>p.pid!==capture.protectedProcesses[n].OwningProcess||typeof p.birth!=='string'||!/^\d{18}$/.test(p.birth)||!Number.isSafeInteger(p.parent)||p.parent<=0||![String.raw`C:\Sirket\ERP\tools\node-v24.19.0\node.exe`,String.raw`C:\Program Files\nodejs\node.exe`].includes(p.exe)||!hex(p.argvSha256)))fail('B6_CURRENT_SUPERSESSION_BOUNDARY_REJECTED');
 const runtime=String.raw`C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027`,legacy=['start-business-5244-web.ps1','start-business-5244-web-5cb682d8.ps1','start-business-5244-web-66a9c3bc.ps1','start-business-5244-web-bf3d65c7.ps1','start-business-5244-web-d4f52345.ps1'].map(n=>path.join(runtime,n)).concat(String.raw`C:\Sirket\ERP\clean\20261022\runtime\start-erp.ps1`);
 if(capture.entryCaptureSha256!==CURRENT_SUPERSESSION_INPUTS['current-entry-hold-capture.json']||entries.schema!=='melisa-b6-current-entry-hold-capture.v1'||entries.readOnly!==true||entries.executionAuthority!==false||entries.ownerCaptureSha256!==null||entries.entries?.length!==6||entries.directEntries?.length!==10||entries.entries.some((e,n)=>e.path!==legacy[n]||e.afterEqualsBefore!==true||!hex(e.beforeSha256))||entries.directEntries.some((e,n)=>e.path!==directEntries[n].path||e.sha256!==directEntries[n].sha256)||entries.gate?.path!==path.join(runtime,'business-5244-startup-exclusion-ec316a63.ps1')||entries.gate.sha256!=='a8df8cd3d159b99d1fad4643c986d3ae2244f2976171f4448535a9e822f22a12'||entries.entryWrites!==0||entries.serviceCalls!==0||entries.sqlCalls!==0)fail('B6_CURRENT_SUPERSESSION_ENTRY_REJECTED');
 for(const e of entries.entries)pinned(e.path,e.beforeSha256);pinned(entries.gate.path,entries.gate.sha256);
 return {inputs,capture};
}
function trustedModuleImports(){return String.raw`
if($PSVersionTable.PSEdition-cne'Desktop'){throw 'B6_NATIVE_WINDOWS_POWERSHELL_REQUIRED'}
foreach($builtinName in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security','CimCmdlets','NetTCPIP','ScheduledTasks')){
 $builtinManifest=[IO.Path]::Combine($PSHOME,'Modules',$builtinName,($builtinName+'.psd1'))
 Microsoft.PowerShell.Core\Import-Module -Name $builtinManifest -Scope Local -ErrorAction Stop
}
`;}
function holdHelpers(){return trustedModuleImports()+String.raw`
$held=[Collections.Generic.List[IO.FileStream]]::new()
$verifiedInitExit=$false
function Hold-B6([string]$Path,[string]$Hash){
 for($part=$Path;$part;$part=[IO.Path]::GetDirectoryName($part)){if((Get-Item -LiteralPath $part -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'B6_OWNER_REPARSE_REJECTED'}}
 $stream=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$h=[Security.Cryptography.SHA256]::Create()
 try{$actual=[BitConverter]::ToString($h.ComputeHash($stream)).Replace('-','').ToLowerInvariant();$stream.Position=0;if($actual-cne$Hash.ToLowerInvariant()){throw 'B6_OWNER_PIN_CHANGED'};$held.Add($stream)}catch{$stream.Dispose();throw}finally{$h.Dispose()}
}
`;}
function initializationFailureTail(){return String.raw`catch{
 # Only the frozen supervisor's private issuer event can translate a failure
 # to this exit code. Exception text/Data or a serialized receipt is not proof.
 if((Get-Business5244VerifiedInitializationExitCode $_.Exception)-ne73){throw}
 $verifiedInitExit=$true
}finally{foreach($stream in $held){$stream.Dispose()}}
if($verifiedInitExit){exit 73}
`;}
function coreVerification(){const leaves=[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1'].sort();return String.raw`
$m=Get-Content -LiteralPath (Join-Path $core 'owner-manifest.json') -Raw|ConvertFrom-Json
if($m.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$m.finiteScope-cne'SCOPE_LITERAL'-or$m.sourceCommit-cne$sourceCommit-or$m.actualT1-ne$false-or$m.externalOperations-ne$false-or$m.apiPackageId-cne'CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'-or$m.appPackageId-cne'ERP-BUSINESS-WEB-5244-2b744f5b-API-READ'){throw 'B6_OWNER_IDENTITY_CHANGED'}
$names=@(LEAVES_LITERAL)
if(@($m.files).Count-ne13-or((@($m.files.path|Sort-Object)-join'|')-cne($names-join'|'))){throw 'B6_OWNER_CLOSURE_CHANGED'}
foreach($file in $m.files){if($file.path-match'[\\/]'-or$file.sha256-cnotmatch'^[a-f0-9]{64}$'){throw 'B6_OWNER_LEAF_REJECTED'};Hold-B6 (Join-Path $core $file.path) $file.sha256}
if($m.predecessor.captureSha256-cne'CAPTURE_LITERAL'-or$m.predecessor.recordBeforeSha256-cne'RECORD_LITERAL'-or$m.predecessor.predecessorEntryKind-cne'ReadPairRouter'-or$m.predecessor.entry.root-cne'ENTRY_ROOT_LITERAL'-or$m.predecessor.entry.leaf-cne'start-business-5244-readpair-router.ps1'-or$m.predecessor.entry.sha256-cne'ENTRY_HASH_LITERAL'-or$m.predecessor.entry.manifestSha256-cne'ENTRY_MANIFEST_LITERAL'){throw 'B6_OWNER_PREDECESSOR_CHANGED'}
BEFORE_LITERAL
`.replaceAll('SCOPE_LITERAL',SCOPE).replace('LEAVES_LITERAL',leaves.map(ps).join(',')).replaceAll('CAPTURE_LITERAL',INPUTS['current-read2b-owner-capture.json']).replaceAll('RECORD_LITERAL',INPUTS['current-erp-processes.before.json']).replaceAll('ENTRY_ROOT_LITERAL',OLD_ROUTER).replaceAll('ENTRY_HASH_LITERAL',OLD_ROUTER_ENTRY_HASH).replaceAll('ENTRY_MANIFEST_LITERAL',OLD_ROUTER_HASH).replace('BEFORE_LITERAL',Object.entries(INPUTS).map(([name,sha])=>'Hold-B6 (Join-Path $core '+ps(name)+') '+ps(sha)).join('\n'));}
function renderCurrent(head){return Buffer.from(`param([Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ManifestSha256)\nSet-StrictMode -Version Latest\n$ErrorActionPreference='Stop'\n$core=${ps(CORE)};$sourceCommit=${ps(head)}\nif($PSScriptRoot-cne$core){throw 'B6_OWNER_ROOT_CHANGED'}\n${holdHelpers()}try{\nHold-B6 (Join-Path $core 'owner-manifest.json') $ManifestSha256\n${coreVerification()}\n. (Join-Path $core 'start-business-5244-owned.ps1') -Library -OwnerScopeName ${ps(SCOPE)}\nStart-Business5244OwnedSupervisor -InitialSlot Current -ScopeName ${ps(SCOPE)}|ForEach-Object {$_|ConvertTo-Json -Compress -Depth 5;[Console]::Out.Flush()}\n}${initializationFailureTail()}`);}
function renderRouter(head,coreHash,libraryHash){if(!commit(head)||!hex(coreHash)||!hex(libraryHash))fail('B6_OWNER_RENDER_PIN_REJECTED');return Buffer.from(`param([Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ManifestSha256,[ValidateSet(${ps(SCOPE)})][string]$ScopeName=${ps(SCOPE)})\nSet-StrictMode -Version Latest\n$ErrorActionPreference='Stop'\n$core=${ps(CORE)};$root=${ps(ROUTER)};$sourceCommit=${ps(head)}\nif($PSScriptRoot-cne$root-or$ScopeName-cne${ps(SCOPE)}){throw 'B6_ROUTER_ROOT_CHANGED'}\n${holdHelpers()}try{\nHold-B6 (Join-Path $root 'owner-manifest.json') $ManifestSha256\n$r=Get-Content -LiteralPath (Join-Path $root 'owner-manifest.json') -Raw|ConvertFrom-Json\nif($r.kind-cne'BUSINESS5244_READ_PAIR_ROUTER'-or$r.finiteScope-cne${ps(SCOPE)}-or$r.entrySourceCommit-cne$sourceCommit-or$r.coreRoot-cne$core-or$r.coreManifestSha256-cne${ps(coreHash)}-or$r.routerLibrarySha256-cne${ps(libraryHash)}-or$r.actualT1-ne$false-or$r.externalOperations-ne$false){throw 'B6_ROUTER_IDENTITY_CHANGED'}\nHold-B6 (Join-Path $root 'start-business-5244-readpair-router.ps1') $r.entrySha256\nHold-B6 (Join-Path $root 'readpair-router-library.ps1') ${ps(libraryHash)}\nHold-B6 (Join-Path $core 'owner-manifest.json') ${ps(coreHash)}\n${coreVerification()}\n. (Join-Path $core 'start-business-5244-owned.ps1') -Library -OwnerScopeName ${ps(SCOPE)}\n. (Join-Path $core 'start-owned-test.ps1') -Library\n. (Join-Path $core 'test125-bound-api-quiescence.ps1')\n. (Join-Path $root 'readpair-router-library.ps1') -Library -ScopeName ${ps(SCOPE)}\n$config=Read-ErpStartupConfig 'C:\\Sirket\\ERP\\runtime\\canonical-test\\startup-config.json'\n$mode=Get-Business5244ReadPairRouterMode $config -ScopeName ${ps(SCOPE)}\nif($mode-ceq'PrepareCurrent'){Start-Business5244OwnedSupervisor -InitialSlot Current -PrepareReadPair -ScopeName ${ps(SCOPE)}|ForEach-Object {$_|ConvertTo-Json -Compress -Depth 5;[Console]::Out.Flush()}}else{Start-Business5244OwnedSupervisor -InitialSlot ReadPair -ScopeName ${ps(SCOPE)}|ForEach-Object {$_|ConvertTo-Json -Compress -Depth 5;[Console]::Out.Flush()}}\n}${initializationFailureTail()}`);}
function writeLeaf(root,name,b){if(/[\\/]/.test(name))fail('B6_OWNER_OUTPUT_LEAF_REJECTED');plainPath(root);const p=path.join(root,name),fd=fs.openSync(p,'wx');try{fs.writeFileSync(fd,b);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}if(hash(read(p))!==hash(b))fail('B6_OWNER_OUTPUT_READBACK_FAILED');}
export function prepareBusinessSaleOwnerBundle(){
 if(path.resolve(fileURLToPath(import.meta.url))!==path.join(SOURCE_ROOT,'scripts','canonical','prepare-business-sale-owner-bundle.mjs'))fail('B6_OWNER_PREPARATION_SOURCE_ENTRY_REQUIRED');
 const source=committedSources(),ci=hostedSourceChecks(source.head),before=predecessor();
 for(const dir of [CORE,ROUTER,PROOF]){if(fs.existsSync(dir))fail('B6_OWNER_OUTPUT_EXISTS_NO_OVERWRITE');plainPath(path.dirname(dir));}
 const coreFiles=new Map(BUSINESS_SALE_OWNER_SOURCE_FILES.map(n=>[n,source.files.get(n)]));coreFiles.set('run-current-owner.ps1',renderCurrent(source.head));
 const manifest={kind:'BUSINESS5244_FRESH_OWNER_BUNDLE',finiteScope:SCOPE,sourceCommit:source.head,businessSaleSourceCommit:APP_SOURCE,sourcePolicy:'COMMITTED_GIT_BLOBS_ONLY',initialSlot:'Current',readPairMaintenanceEnabled:true,appPackageId:'ERP-BUSINESS-WEB-5244-2b744f5b-API-READ',appManifestSha256:'91ee8b23c37a46ec89f8060967bc7a0106f68f2de9a4a1f4199941cce5a9e0fd',apiPackageId:'CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213',candidateApiPackageId:'CANONICAL-TEST125-BUSINESS5244-B6-ca620bac-PASSIVE-20261028',candidateWebPackageId:'ERP-BUSINESS-WEB-5244-B6-ca620bac-PASSIVE-20261028',apiPort:4144,nativePort:4146,webPort:5244,database:'MELISA_ERP_SIRKET_TEST_20260929_01',actualT1:false,externalOperations:false,installed:false,recordingEnabled:false,predecessor:predecessorIdentity(),beforeImages:Object.entries(INPUTS).map(([name,sha256])=>({path:name,sha256,bytes:before.inputs.get(name).length})),hostedCi:ci,files:[...coreFiles].map(([name,b])=>({path:name,sha256:hash(b),bytes:b.length})).sort((a,b)=>a.path.localeCompare(b.path))};
 const coreBytes=bytes(manifest),coreHash=hash(coreBytes),library=source.files.get('start-business-5244-readpair-router.ps1'),routerEntry=renderRouter(source.head,coreHash,hash(library));
 const routerManifest={kind:'BUSINESS5244_READ_PAIR_ROUTER',finiteScope:SCOPE,entrySourceCommit:source.head,coreRoot:CORE,coreManifestSha256:coreHash,routerLibrarySha256:hash(library),readPairMaintenanceEnabled:true,actualT1:false,externalOperations:false,installed:false,entry:'start-business-5244-readpair-router.ps1',entrySha256:hash(routerEntry),captureSha256:INPUTS['current-read2b-owner-capture.json']};const routerBytes=bytes(routerManifest);
 // Recheck source/capture before the first create; no mutable working file is copied.
 if(git(['rev-parse','HEAD']).trim()!==source.head||git(['status','--porcelain','--untracked-files=no']).trim())fail('B6_OWNER_SOURCE_CHANGED');for(const [name,sha] of Object.entries(INPUTS))pinned(path.join(PRIVATE,name),sha);
 for(const dir of [CORE,ROUTER,PROOF])fs.mkdirSync(dir);
 for(const [name,b] of coreFiles)writeLeaf(CORE,name,b);for(const [name,b] of before.inputs)writeLeaf(CORE,name,b);writeLeaf(CORE,'owner-manifest.json',coreBytes);
 writeLeaf(ROUTER,'readpair-router-library.ps1',library);writeLeaf(ROUTER,'start-business-5244-readpair-router.ps1',routerEntry);writeLeaf(ROUTER,'owner-manifest.json',routerBytes);
 const result={schema:'melisa-b6-passive-owner-preparation.v1',ownerSourceCommit:source.head,businessSaleSourceCommit:APP_SOURCE,coreRoot:CORE,coreManifestSha256:coreHash,routerRoot:ROUTER,routerManifestSha256:hash(routerBytes),installerSourceSha256:hash(source.files.get('install-business-5244-readpair.ps1')),producerSourceSha256:hash(source.files.get('prepare-business-sale-owner-bundle.mjs')),sourceFiles:BUSINESS_SALE_OWNER_SOURCE_FILES.length,sourceHashes:source.workingSourceHashes,coreFiles:coreFiles.size,beforeImages:before.inputs.size,installed:false,recordingEnabled:false,executable:false,sqlCalls:0,serviceCalls:0,ownerCalls:0,taskChanges:0,controllerSourceBound:true,executionAuthority:false,blocker:'FRESH_NATIVE_AND_OWNER_ADMISSION_REQUIRED',hostedCi:ci};
 writeLeaf(PROOF,'preparation-receipt.json',bytes(result));writeLeaf(PROOF,'reviewed-installer-source.ps1',source.files.get('install-business-5244-readpair.ps1'));writeLeaf(PROOF,'verified-owner-producer.mjs',source.files.get('prepare-business-sale-owner-bundle.mjs'));return result;
}
export function verifyBusinessSaleOwnerBundle(){
 const receipt=json(read(path.join(PROOF,'preparation-receipt.json')));
 const source=committedSources(receipt.ownerSourceCommit);hostedSourceChecks(source.head);const before=predecessor();
 const coreBytes=read(path.join(CORE,'owner-manifest.json')),manifest=json(coreBytes),routerBytes=read(path.join(ROUTER,'owner-manifest.json')),routerManifest=json(routerBytes);
 if(receipt.schema!=='melisa-b6-passive-owner-preparation.v1'||receipt.ownerSourceCommit!==source.head||receipt.businessSaleSourceCommit!==APP_SOURCE||receipt.coreRoot!==CORE||receipt.routerRoot!==ROUTER||receipt.coreManifestSha256!==hash(coreBytes)||receipt.routerManifestSha256!==hash(routerBytes)||manifest.kind!=='BUSINESS5244_FRESH_OWNER_BUNDLE'||manifest.finiteScope!==SCOPE||manifest.sourceCommit!==source.head||manifest.businessSaleSourceCommit!==APP_SOURCE||manifest.files?.length!==13)fail('B6_OWNER_PREPARED_IDENTITY_CHANGED');
 const expectedBefore=Object.entries(INPUTS).map(([name,sha256])=>({path:name,sha256,bytes:before.inputs.get(name).length}));
 const expectedPredecessor=predecessorIdentity();
 if(JSON.stringify(manifest.beforeImages)!==JSON.stringify(expectedBefore)||JSON.stringify(manifest.predecessor)!==JSON.stringify(expectedPredecessor)||manifest.sourcePolicy!=='COMMITTED_GIT_BLOBS_ONLY'||manifest.actualT1!==false||manifest.externalOperations!==false||manifest.installed!==false||manifest.recordingEnabled!==false||manifest.apiPackageId!=='CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213'||manifest.appPackageId!=='ERP-BUSINESS-WEB-5244-2b744f5b-API-READ'||receipt.installerSourceSha256!==hash(source.files.get('install-business-5244-readpair.ps1'))||receipt.producerSourceSha256!==hash(source.files.get('prepare-business-sale-owner-bundle.mjs'))||!read(VERIFIED_PRODUCER).equals(source.files.get('prepare-business-sale-owner-bundle.mjs'))||receipt.controllerSourceBound!==true||receipt.executionAuthority!==false||receipt.executable!==false||routerManifest.actualT1!==false||routerManifest.externalOperations!==false||routerManifest.captureSha256!==INPUTS['current-read2b-owner-capture.json'])fail('B6_OWNER_PREPARED_METADATA_CHANGED');
 const expected=new Map(BUSINESS_SALE_OWNER_SOURCE_FILES.map(name=>[name,source.files.get(name)]));expected.set('run-current-owner.ps1',renderCurrent(source.head));
 for(const [name,b] of expected){const rows=manifest.files.filter(r=>r.path===name);if(rows.length!==1||rows[0].sha256!==hash(b)||rows[0].bytes!==b.length||!read(path.join(CORE,name)).equals(b))fail('B6_OWNER_PREPARED_SOURCE_CHANGED');}
 for(const [name,b] of before.inputs)if(!read(path.join(CORE,name)).equals(b))fail('B6_OWNER_PREPARED_BEFORE_IMAGE_CHANGED');
 const library=source.files.get('start-business-5244-readpair-router.ps1'),entry=renderRouter(source.head,hash(coreBytes),hash(library));
 if(routerManifest.kind!=='BUSINESS5244_READ_PAIR_ROUTER'||routerManifest.finiteScope!==SCOPE||routerManifest.entrySourceCommit!==source.head||routerManifest.coreRoot!==CORE||routerManifest.coreManifestSha256!==hash(coreBytes)||routerManifest.routerLibrarySha256!==hash(library)||routerManifest.entrySha256!==hash(entry)||!read(path.join(ROUTER,'readpair-router-library.ps1')).equals(library)||!read(path.join(ROUTER,'start-business-5244-readpair-router.ps1')).equals(entry)||!read(path.join(PROOF,'reviewed-installer-source.ps1')).equals(source.files.get('install-business-5244-readpair.ps1')))fail('B6_OWNER_PREPARED_ROUTER_CHANGED');
 return {schema:'melisa-b6-passive-owner-verification.v1',ownerSourceCommit:source.head,currentRepoHead:source.repoHead,sourceHashes:source.workingSourceHashes,coreManifestSha256:hash(coreBytes),routerManifestSha256:hash(routerBytes),installerSourceSha256:hash(source.files.get('install-business-5244-readpair.ps1')),coreFiles:13,beforeImages:before.inputs.size,writes:0,sqlCalls:0,serviceCalls:0,ownerCalls:0};
}
function renderCurrentSupersession(head,installerHash){
 if(!commit(head)||!hex(installerHash))fail('B6_CURRENT_SUPERSESSION_RENDER_PIN_REJECTED');
 const names=[...BUSINESS_SALE_OWNER_SOURCE_FILES,'run-current-owner.ps1','install-business-5244-readpair.ps1'].sort();
 return Buffer.from(`param([Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ManifestSha256,[Parameter(Mandatory)][ValidateSet(${ps(SCOPE)})][string]$ScopeName)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$core=${ps(CURRENT_SUPERSESSION_CORE)};$sourceCommit=${ps(head)}
if($PSScriptRoot-cne$core-or$ScopeName-cne${ps(SCOPE)}){throw 'B6_CURRENT_SUPERSESSION_ROOT_CHANGED'}
${holdHelpers()}try{
Hold-B6 (Join-Path $core 'owner-manifest.json') $ManifestSha256
$m=Get-Content -LiteralPath (Join-Path $core 'owner-manifest.json') -Raw|ConvertFrom-Json
if($m.kind-cne'CURRENT_ONLY_SUPERSESSION_BUNDLE'-or$m.finiteScope-cne${ps(SCOPE)}-or$m.sourceCommit-cne$sourceCommit-or$m.actualT1-ne$false-or$m.externalOperations-ne$false-or$m.initialSlot-cne'Current'-or$m.apiManifestSha256-cne'8b39a46f27ce8c6e0b8e41a34e29bee2aab0b4575129da5503c0602c4c9c8090'-or$m.appManifestSha256-cne'91ee8b23c37a46ec89f8060967bc7a0106f68f2de9a4a1f4199941cce5a9e0fd'){throw 'B6_CURRENT_SUPERSESSION_IDENTITY_CHANGED'}
$names=@(${names.map(ps).join(',')})
if(@($m.files).Count-ne14-or((@($m.files.path|Sort-Object)-join'|')-cne($names-join'|'))){throw 'B6_CURRENT_SUPERSESSION_CLOSURE_CHANGED'}
foreach($file in $m.files){if($file.path-match'[\\/]'-or$file.sha256-cnotmatch'^[a-f0-9]{64}$'){throw 'B6_CURRENT_SUPERSESSION_LEAF_REJECTED'};Hold-B6 (Join-Path $core $file.path) $file.sha256}
${Object.entries(CURRENT_SUPERSESSION_INPUTS).map(([name,sha])=>'Hold-B6 (Join-Path $core '+ps(name)+') '+ps(String(sha))).join('\n')}
Hold-B6 (Join-Path $core 'install-business-5244-readpair.ps1') ${ps(installerHash)}
& (Join-Path $core 'install-business-5244-readpair.ps1') -CurrentOnlySupersession -SourceSha256 ${ps(installerHash)} -ScopeName ${ps(SCOPE)}
}finally{foreach($stream in $held){$stream.Dispose()}}
`);
}
function currentSupersessionPayload(source,ci,before){
 const installer=source.files.get('install-business-5244-readpair.ps1'),files=new Map(BUSINESS_SALE_OWNER_SOURCE_FILES.map(n=>[n,source.files.get(n)]));
 files.set('run-current-owner.ps1',renderCurrentSupersession(source.head,hash(installer)));files.set('install-business-5244-readpair.ps1',installer);
 const manifest={kind:'CURRENT_ONLY_SUPERSESSION_BUNDLE',finiteScope:SCOPE,sourceCommit:source.head,businessSaleSourceCommit:APP_SOURCE,sourcePolicy:'COMMITTED_GIT_BLOBS_ONLY',initialSlot:'Current',apiPackageId:'CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213',apiManifestSha256:'8b39a46f27ce8c6e0b8e41a34e29bee2aab0b4575129da5503c0602c4c9c8090',appPackageId:'ERP-BUSINESS-WEB-5244-2b744f5b-API-READ',appManifestSha256:'91ee8b23c37a46ec89f8060967bc7a0106f68f2de9a4a1f4199941cce5a9e0fd',apiPort:4144,nativePort:4146,webPort:5244,database:'MELISA_ERP_SIRKET_TEST_20260929_01',actualT1:false,externalOperations:false,installed:false,recordingEnabled:false,caseSha256:CURRENT_SUPERSESSION_INPUTS['supersession-fixed-case.json'],beforeImages:Object.entries(CURRENT_SUPERSESSION_INPUTS).map(([name,sha256])=>({path:name,sha256,bytes:before.inputs.get(name).length})),hostedCi:ci,files:[...files].map(([name,b])=>({path:name,sha256:hash(b),bytes:b.length})).sort((a,b)=>a.path.localeCompare(b.path))};
 return {files,manifest};
}
export function prepareBusinessSaleCurrentSupersessionBundle(){
 if(path.resolve(fileURLToPath(import.meta.url))!==path.join(SOURCE_ROOT,'scripts','canonical','prepare-business-sale-owner-bundle.mjs'))fail('B6_OWNER_PREPARATION_SOURCE_ENTRY_REQUIRED');
 const source=committedSources(null,true),ci=hostedSourceChecks(source.head),before=currentSupersessionCase(),payload=currentSupersessionPayload(source,ci,before),manifestBytes=bytes(payload.manifest);
 for(const dir of [CURRENT_SUPERSESSION_CORE,CURRENT_SUPERSESSION_PROOF]){if(fs.existsSync(dir))fail('B6_OWNER_OUTPUT_EXISTS_NO_OVERWRITE');plainPath(path.dirname(dir));}
 if(git(['rev-parse','HEAD']).trim()!==source.head||git(['status','--porcelain','--untracked-files=no']).trim())fail('B6_OWNER_SOURCE_CHANGED');
 for(const [name,sha] of Object.entries(CURRENT_SUPERSESSION_INPUTS))pinned(path.join(CURRENT_SUPERSESSION_PRIVATE,name),sha);
 for(const dir of [CURRENT_SUPERSESSION_CORE,CURRENT_SUPERSESSION_PROOF])fs.mkdirSync(dir);
 for(const [name,b] of payload.files)writeLeaf(CURRENT_SUPERSESSION_CORE,name,b);for(const [name,b] of before.inputs)writeLeaf(CURRENT_SUPERSESSION_CORE,name,b);writeLeaf(CURRENT_SUPERSESSION_CORE,'owner-manifest.json',manifestBytes);
 const result={schema:'melisa-current-supersession-passive-preparation.v1',ownerSourceCommit:source.head,businessSaleSourceCommit:APP_SOURCE,coreRoot:CURRENT_SUPERSESSION_CORE,coreManifestSha256:hash(manifestBytes),installerSourceSha256:hash(source.files.get('install-business-5244-readpair.ps1')),producerSourceSha256:hash(source.files.get('prepare-business-sale-owner-bundle.mjs')),sourceHashes:source.workingSourceHashes,coreFiles:13,installerFiles:1,beforeImages:before.inputs.size,installed:false,recordingEnabled:false,executable:false,sqlCalls:0,serviceCalls:0,ownerCalls:0,taskChanges:0,hostedCi:ci};
 writeLeaf(CURRENT_SUPERSESSION_PROOF,'preparation-receipt.json',bytes(result));writeLeaf(CURRENT_SUPERSESSION_PROOF,'reviewed-installer-source.ps1',source.files.get('install-business-5244-readpair.ps1'));writeLeaf(CURRENT_SUPERSESSION_PROOF,'verified-owner-producer.mjs',source.files.get('prepare-business-sale-owner-bundle.mjs'));return result;
}
export function verifyBusinessSaleCurrentSupersessionBundle(){
 const receipt=json(read(path.join(CURRENT_SUPERSESSION_PROOF,'preparation-receipt.json'))),source=committedSources(receipt.ownerSourceCommit,true),ci=hostedSourceChecks(source.head),before=currentSupersessionCase();
 const actualManifest=read(path.join(CURRENT_SUPERSESSION_CORE,'owner-manifest.json')),manifest=json(actualManifest);
 if(!Array.isArray(manifest.hostedCi)||manifest.hostedCi.length!==2||manifest.hostedCi.some((r,n)=>r.event!==ci[n].event||r.head!==source.head||r.conclusion!=='success'||!Number.isSafeInteger(r.runId)||r.runId<1||JSON.stringify(r.jobs)!==JSON.stringify(REQUIRED_JOBS)))fail('B6_CURRENT_SUPERSESSION_CI_CHANGED');
 const expected=currentSupersessionPayload(source,manifest.hostedCi,before);
 if(receipt.schema!=='melisa-current-supersession-passive-preparation.v1'||receipt.ownerSourceCommit!==source.head||receipt.businessSaleSourceCommit!==APP_SOURCE||receipt.coreRoot!==CURRENT_SUPERSESSION_CORE||receipt.coreManifestSha256!==hash(actualManifest)||receipt.installerSourceSha256!==hash(source.files.get('install-business-5244-readpair.ps1'))||receipt.producerSourceSha256!==hash(source.files.get('prepare-business-sale-owner-bundle.mjs'))||receipt.coreFiles!==13||receipt.installerFiles!==1||receipt.beforeImages!==5||receipt.installed!==false||receipt.recordingEnabled!==false||receipt.executable!==false||!actualManifest.equals(bytes(expected.manifest)))fail('B6_CURRENT_SUPERSESSION_PREPARED_CHANGED');
 for(const [name,b] of expected.files)if(!read(path.join(CURRENT_SUPERSESSION_CORE,name)).equals(b))fail('B6_OWNER_PREPARED_SOURCE_CHANGED');
 for(const [name,b] of before.inputs)if(!read(path.join(CURRENT_SUPERSESSION_CORE,name)).equals(b))fail('B6_OWNER_PREPARED_BEFORE_IMAGE_CHANGED');
 if(!read(CURRENT_SUPERSESSION_VERIFIER).equals(source.files.get('prepare-business-sale-owner-bundle.mjs'))||!read(path.join(CURRENT_SUPERSESSION_PROOF,'reviewed-installer-source.ps1')).equals(source.files.get('install-business-5244-readpair.ps1')))fail('B6_OWNER_PREPARED_SOURCE_CHANGED');
 return {schema:'melisa-current-supersession-passive-verification.v1',ownerSourceCommit:source.head,currentRepoHead:source.repoHead,coreRoot:CURRENT_SUPERSESSION_CORE,coreManifestSha256:hash(actualManifest),installerSourceSha256:hash(source.files.get('install-business-5244-readpair.ps1')),coreFiles:13,installerFiles:1,beforeImages:5,writes:0,sqlCalls:0,serviceCalls:0,ownerCalls:0,taskChanges:0};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){const action=process.argv.slice(2).join('|'),actions={'--prepare':prepareBusinessSaleOwnerBundle,'--verify':verifyBusinessSaleOwnerBundle,'--prepare-current-supersession':prepareBusinessSaleCurrentSupersessionBundle,'--verify-current-supersession':verifyBusinessSaleCurrentSupersessionBundle};if(!Object.hasOwn(actions,action))fail('B6_OWNER_FIXED_ACTION_REQUIRED');try{const r=actions[action]();process.stdout.write(JSON.stringify(r)+'\n');}catch(e){process.stderr.write((/^[A-Z][A-Z0-9_]+$/.test(e.message)?e.message:'B6_OWNER_PREPARATION_FAILED')+'\n');process.exitCode=1;}}
