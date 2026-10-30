// One closed continuation of B6 maintenance. Packaging only: no SQL, services,
// runtime writes, credentials, callbacks, or caller-selected roots/targets.
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const SOURCE=String.raw`C:\Sirket\ERP\worktrees\erp-p03-pr53-candidate-20261018`;
const RELEASES=String.raw`C:\Sirket\ERP\releases`;
const PRIVATE=String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-preview-link-20261030\native-context-fix\array-repair-20261030`;
const PRIOR=String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-preview-link-20261030\native-context-fix\preview-read-indexed-current`;
const PROOF=path.win32.join(PRIVATE,'owner-preparation');
const VERIFIER=path.win32.join(PROOF,'verified-array-repair-producer.mjs');
export const ARRAY_REPAIR_SCOPE='TEST125-API-B6-WRITER-20261029';
export const ARRAY_REPAIR_PURPOSE='ReadContextRepair';
export const ARRAY_REPAIR_ROOTS=Object.freeze({core:path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-ARRAY-REPAIR-OWNER-20261030'),router:path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-ARRAY-REPAIR-ROUTER-20261030'),steady:path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-ARRAY-REPAIR-STEADY-OWNER-20261030')});
// The API lifetime module is a source filename, not a credential.
const lifetimeModule='test125-bound-api-quiescence.ps1';
export const ARRAY_REPAIR_SOURCE_FILES=Object.freeze([
 'business-5244-startup-exclusion.ps1',
 'start-business-5244-web.ps1',
 'business-5244-web-native.cs',
 'business-5244-retirement-channel.ps1',
 'business-5244-retirement-peer.cs',
 'business-5244-retirement-state.ps1',
 'business-5244-maintenance-dispatch.ps1',
 'start-business-5244-owned.ps1',
 lifetimeModule,
 'test125-bound-maintenance-plan.ps1',
 'start-owned-test.ps1',
 'canonical-business-sale-maintenance.ps1'
]);
export const ARRAY_REPAIR_INPUTS=Object.freeze({
 'current-read2b-owner-capture.json':'6f6a7f567629a05310e3260ab72a7adff2d2fa33eadca8cc6d4c6b07fb95f211',
 'current-erp-processes.before.json':'fc69404723c6a387411ee2e8bd2f7dce910e7618beb41e1b58651d79bb162caf',
 'current-entry-hold-capture.json':'79a1a28cabfbaa2f891111badfcd12a9cc5cd3d04c83b6bb2c3ab07c5749f403',
 'current-task-capture.json':'71876ef6308af10e3f7d6b393734491b2b2e32190607b238438fd8834946ebf1',
 'current-task.before.xml':'2ca932b6942e463eb2d2844a1d72519c77c246b201739847b56b4802fee06b92',
 'current-task.before.sddl':'cc862b7ac8c18bf4211e9fb5821b6a5ba4611698a3466547ce98a0b54da31ac4',
});
const PACKET='array-repair-review-packet-v2.json';
const PACKET_HASH='78d6e2c98354e90fadb98fb0d667b5a46c03bce889d798bd265f7010fc450411';
const OLD_CORE=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-PREVIEW-READ-INDEXED-OWNER-20261030');
const OLD_ROUTER=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-PREVIEW-READ-INDEXED-ROUTER-20261030');
const OLD_STEADY=path.win32.join(RELEASES,'ERP-BUSINESS-5244-B6-PREVIEW-READ-INDEXED-STEADY-OWNER-20261030');
const OLD_HASHES=Object.freeze({core:'3ac61670ffadc62f957d3df830d1b2c8da50f8edf5cf97ac98929a0dd4856978',router:'c525ff782fd06d54217c0c7711ef5bc23a862c681151ec7c82353f5bc9880407',steady:'d46c4939acdfcc12c9dfc240cd834c5d7cbc5c2a1a411ba51a28f59b99343102'});
const REQUIRED=Object.freeze(['windows-startup-test','quality-build-test','secret-scan']);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const json=b=>JSON.parse(b.toString('utf8').replace(/^\uFEFF/,''));
const bytes=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
const fail=c=>{throw Error(c);};
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const commit=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ps=v=>"'"+v.replaceAll("'","''")+"'";
function plain(p){for(let at=p;at;){if(fs.lstatSync(at).isSymbolicLink())fail('ARRAY_OWNER_REPARSE');const next=path.dirname(at);if(next===at)break;at=next;}}
function read(p){plain(p);return fs.readFileSync(p);}
function pin(p,h){const b=read(p);if(sha(b)!==h)fail('ARRAY_OWNER_INPUT_CHANGED');return b;}
function git(args,raw=false){return cp.execFileSync('git',args,{cwd:SOURCE,windowsHide:true,...(raw?{}:{encoding:'utf8'}),maxBuffer:8*1024*1024});}
function gh(endpoint){return JSON.parse(cp.execFileSync('gh',['api',endpoint],{cwd:SOURCE,windowsHide:true,encoding:'utf8',maxBuffer:4*1024*1024}));}
function sourceFiles(packaged=null){
 const own=path.resolve(fileURLToPath(import.meta.url)),canonical=path.win32.join(SOURCE,'scripts','canonical','prepare-business-sale-array-repair-owner.mjs');
 if(process.platform!=='win32'||own!==canonical&&(own!==VERIFIER||process.argv.slice(2).join('|')!=='--verify'))fail('ARRAY_OWNER_FIXED_SOURCE_ENTRY');
 for(const args of [['remote','get-url','origin'],['remote','get-url','--push','origin']])if(git(args).trim()!=='https://github.com/melihsnyldzz-ui/melisa-erp-v2.git')fail('ARRAY_OWNER_ORIGIN_CHANGED');
 if(git(['branch','--show-current']).trim()!=='codex/erp-p03-pr53-candidate-20261018'||git(['status','--porcelain','--untracked-files=no']).trim())fail('ARRAY_OWNER_COMMITTED_SOURCE_REQUIRED');
 const repoHead=git(['rev-parse','HEAD']).trim(),head=packaged??repoHead;if(!commit(head)||!commit(repoHead))fail('ARRAY_OWNER_SOURCE_COMMIT');
 for(const before of ['06ce7a54458f56527a9bb80dbdbd9c28f0ca2d19',head])try{git(['merge-base','--is-ancestor',before,repoHead]);}catch{fail('ARRAY_OWNER_SOURCE_ANCESTRY');}
 const files=new Map();
 for(const name of [...ARRAY_REPAIR_SOURCE_FILES,'start-business-5244-readpair-router.ps1','install-business-5244-readpair.ps1','prepare-business-sale-array-repair-owner.mjs']){
  const relative='scripts/canonical/'+name,attrs=git(['check-attr','-z','filter','working-tree-encoding','ident','text','eol','--',relative]).split('\0');
  if(attrs.pop()!==''||attrs.length!==15)fail('ARRAY_OWNER_ATTRIBUTES');const m={};for(let n=0;n<attrs.length;n+=3){if(attrs[n]!==relative||Object.hasOwn(m,attrs[n+1]))fail('ARRAY_OWNER_ATTRIBUTES');m[attrs[n+1]]=attrs[n+2];}
  if(['filter','working-tree-encoding','ident'].some(k=>!['unspecified','unset'].includes(m[k]))||!['unspecified','set','auto','unset'].includes(m.text)||!['unspecified','lf','crlf'].includes(m.eol))fail('ARRAY_OWNER_ATTRIBUTES');
  git(['ls-files','--error-unmatch','--',relative]);const b=git(['show',head+':'+relative],true),working=read(path.win32.join(SOURCE,relative));
  if(!Buffer.from(working.toString('utf8')).equals(working)||!working.equals(b)&&(m.text==='unset'||!Buffer.from(working.toString('utf8').replaceAll('\r\n','\n')).equals(b)))fail('ARRAY_OWNER_WORKING_SOURCE_CHANGED');files.set(name,b);
 }
 if(!files.get('install-business-5244-readpair.ps1').toString('utf8').includes("Hold-B6ReadPairSource $producer '"+sha(files.get('prepare-business-sale-array-repair-owner.mjs'))+"'"))fail('ARRAY_OWNER_VERIFIER_PIN');
 return {head,repoHead,files};
}
function hosted(head){const all=gh('repos/melihsnyldzz-ui/melisa-erp-v2/actions/runs?head_sha='+head+'&per_page=100').workflow_runs,result=[];
 for(const event of ['push','pull_request']){const run=all?.filter(r=>r.head_sha===head&&r.event===event&&r.path==='.github/workflows/ci.yml').sort((a,b)=>b.id-a.id)[0];if(!run||run.status!=='completed'||run.conclusion!=='success'||!Number.isSafeInteger(run.id))fail('ARRAY_OWNER_EXACT_CI_REQUIRED');const jobs=gh('repos/melihsnyldzz-ui/melisa-erp-v2/actions/runs/'+run.id+'/jobs?filter=latest&per_page=100').jobs;for(const name of REQUIRED){const rows=jobs?.filter(j=>j.name===name);if(rows?.length!==1||rows[0].status!=='completed'||rows[0].conclusion!=='success'||!rows[0].steps?.length)fail('ARRAY_OWNER_REQUIRED_JOB_FAILED');}result.push({event,runId:run.id,head,conclusion:'success',jobs:[...REQUIRED]});}return result;}

export function validateArrayRepairPacket(p){
 const names=['dbo.usp_canonical_business_sale_begin_v1','dbo.usp_canonical_business_sale_context_v1','dbo.usp_canonical_business_sale_resolve_v1'];
 if(p?.schema!=='melisa-b6-array-repair-review-packet.v1'||p.status!=='REVIEW_ONLY_NO_EXECUTOR'||p.installable!==false||p.executeAllowed!==false||p.executionAuthority!==false||p.scope!==ARRAY_REPAIR_SCOPE||p.databaseId!==18||p.database!=='MELISA_ERP_SIRKET_TEST_20260929_01'||p.server!=='Semih\\MELISADEV'||p.proposedModules?.map(m=>m.name).sort().join('|')!==names.join('|')||p.profileMetadataDelta?.map(m=>m.field).sort().join('|')!=='businessSaleAdmission.beginDefinitionHash|businessSaleAdmission.contextDefinitionHash'||p.nativeStoredHeaderValidationPending!==true||p.permissionChanges!==0||p.rolesChanged!==0||p.stockWrites!==0||p.financeWrites!==0||p.journalWrites!==0||p.sourceOrLiveWrites!==0||p.newTables!==0||p.legacy25ModulesUnchanged!==true||p.nativeModuleSet31Unchanged!==true)fail('ARRAY_OWNER_PACKET_SCOPE');
 for(const m of p.proposedModules)if(!m.applyDefinition.startsWith('ALTER PROCEDURE '+m.name+' ')||!m.inverseDefinition.startsWith('ALTER PROCEDURE '+m.name+' ')||sha(Buffer.from(m.applyDefinition,'utf16le')).toUpperCase()!==m.proposedApplyAlterTextSha256||sha(Buffer.from(m.inverseDefinition,'utf16le')).toUpperCase()!==m.proposedInverseAlterTextSha256||m.nativeStoredHeaderValidationPending!==true||m.options.signatureCount!==0)fail('ARRAY_OWNER_PACKET_DEFINITION');
 return p;
}
function before(){
 const inputs=new Map(Object.entries(ARRAY_REPAIR_INPUTS).map(([n,h])=>[n,pin(path.win32.join(PRIVATE,n),h)]));
 const capture=json(inputs.get('current-read2b-owner-capture.json')),entries=json(inputs.get('current-entry-hold-capture.json')),task=json(inputs.get('current-task-capture.json'));
 if(capture.schema!=='melisa-b6-writer-current-owner-capture.v1'||capture.predecessorEntryKind!=='ReadPairRouter'||capture.readOnly!==true||capture.stopAuthorized!==false||capture.owner?.pid!==18572||capture.owner.birth!=='134378104151292349'||capture.child?.pid!==33788||capture.child.birth!=='134378112314707445'||capture.child.parent!==18572||capture.entry?.root!==OLD_ROUTER||capture.entry.manifestSha256!==OLD_HASHES.router||capture.core?.root!==OLD_CORE||capture.core.manifestSha256!==OLD_HASHES.core||capture.core.sourceCommit!=='8d13ba54c2b9a46486e249480ef8903f88a78870'||capture.nativeStatus?.nativePeerVerified!==true||capture.nativeStatus.state?.phase!=='Running'||capture.nativeStatus.state.ownerPid!==18572||capture.nativeStatus.state.childPid!==33788||capture.serviceCalls!==0||capture.sqlCalls!==0||capture.retireCalls!==0||capture.recordBeforeSha256!==ARRAY_REPAIR_INPUTS['current-erp-processes.before.json'])fail('ARRAY_OWNER_CAPTURE');
 const oldCore=json(pin(path.win32.join(OLD_CORE,'owner-manifest.json'),OLD_HASHES.core)),oldRouter=json(pin(path.win32.join(OLD_ROUTER,'owner-manifest.json'),OLD_HASHES.router)),oldSteady=json(pin(path.win32.join(OLD_STEADY,'owner-manifest.json'),OLD_HASHES.steady));
 const fields=[...ARRAY_REPAIR_SOURCE_FILES,'run-current-owner.ps1'].sort().join('|');
 for(const [root,m] of [[OLD_CORE,oldCore],[OLD_STEADY,oldSteady]]){if(m.files?.map(f=>f.path).sort().join('|')!==fields)fail('ARRAY_OWNER_OLD_CLOSURE');for(const f of m.files){if(/[\\/]/.test(f.path)||!hex(f.sha256))fail('ARRAY_OWNER_OLD_LEAF');pin(path.win32.join(root,f.path),f.sha256);}}
 pin(path.win32.join(OLD_ROUTER,'start-business-5244-readpair-router.ps1'),oldRouter.entrySha256);pin(path.win32.join(OLD_ROUTER,'readpair-router-library.ps1'),oldRouter.routerLibrarySha256);
 if(!same(oldCore.files,capture.core.files)||capture.entry.sha256!==oldRouter.entrySha256||capture.router?.root!==OLD_ROUTER||capture.router.manifestSha256!==OLD_HASHES.router||![('"'+capture.owner.exe+'" -NoProfile -NonInteractive -WindowStyle Hidden -File '+path.win32.join(OLD_ROUTER,'start-business-5244-readpair-router.ps1')+' -ManifestSha256 '+OLD_HASHES.router.toUpperCase()+' -ScopeName '+ARRAY_REPAIR_SCOPE),('"'+capture.owner.exe+'" -NoProfile -NonInteractive -WindowStyle Hidden -File '+path.win32.join(OLD_ROUTER,'start-business-5244-readpair-router.ps1')+' -ManifestSha256 '+OLD_HASHES.router.toUpperCase()+' -ScopeName '+ARRAY_REPAIR_SCOPE+' ')].includes(capture.owner.argv))fail('ARRAY_OWNER_ENTRY');
 const prior=json(pin(path.win32.join(PRIOR,'current-entry-hold-capture.json'),'cf183aea381f86d4ffd057fcd1034e9d763affdb98998ee1c930298d7ed6af85'));
 const tails=[[OLD_ROUTER,'start-business-5244-readpair-router.ps1',oldRouter.entrySha256],[OLD_CORE,'run-current-owner.ps1',oldCore.files.find(f=>f.path==='run-current-owner.ps1').sha256],[OLD_STEADY,'run-current-owner.ps1',oldSteady.files.find(f=>f.path==='run-current-owner.ps1').sha256]];
 if(entries.ownerCaptureSha256!==ARRAY_REPAIR_INPUTS['current-read2b-owner-capture.json']||entries.readOnly!==true||entries.executionAuthority!==false||entries.runtimeValidationComplete!==false||entries.postExitExclusiveEntryCount!==41||entries.entries?.length!==6||entries.directEntries?.length!==35||!same(entries.entries,prior.entries)||!same(entries.directEntries.slice(0,32),prior.directEntries)||!same(entries.gate,prior.gate)||tails.some(([r,l,h],i)=>!same(entries.directEntries[32+i],{path:path.win32.join(r,l),sha256:h})))fail('ARRAY_OWNER_ENTRY_CHAIN');
 const running=capture.apiSupervisor,future=capture.futureTaskLauncher;
 if(running?.pid!==50348||running.birth!=='134378110068801561'||running.launcher?.coreRoot!==OLD_CORE||running.launcher.coreManifestSha256!==OLD_HASHES.core||future?.coreRoot!==OLD_STEADY||future.coreManifestSha256!==OLD_HASHES.steady||task.enginePid!==50348||task.instanceCount!==1||task.readOnly!==true||task.writes!==0||task.xmlSha256!==ARRAY_REPAIR_INPUTS['current-task.before.xml']||task.sddlSha256!==ARRAY_REPAIR_INPUTS['current-task.before.sddl'])fail('ARRAY_OWNER_TASK');
 const packet=pin(path.win32.join(PRIOR,PACKET),PACKET_HASH);validateArrayRepairPacket(json(packet));
 return {inputs,capture,packet};
}
const holdCode=String.raw`
foreach($n in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Security','CimCmdlets','NetTCPIP','ScheduledTasks')){Import-Module ([IO.Path]::Combine($PSHOME,'Modules',$n,($n+'.psd1'))) -Scope Local -ErrorAction Stop}
$held=[Collections.Generic.List[IO.FileStream]]::new();$verifiedInitExit=$false
function Hold-B6([string]$Path,[string]$Hash){for($p=$Path;$p;$p=[IO.Path]::GetDirectoryName($p)){if((Get-Item -LiteralPath $p -Force).Attributes-band[IO.FileAttributes]::ReparsePoint){throw 'ARRAY_OWNER_REPARSE'}};$s=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$h=[Security.Cryptography.SHA256]::Create();try{$v=[BitConverter]::ToString($h.ComputeHash($s)).Replace('-','').ToLowerInvariant();$s.Position=0;if($v-cne$Hash.ToLowerInvariant()){throw 'ARRAY_OWNER_PIN_CHANGED'};$held.Add($s)}catch{$s.Dispose();throw}finally{$h.Dispose()}}
`;
const exitCode=String.raw`catch{if((Get-Business5244VerifiedInitializationExitCode $_.Exception)-ne73){throw};$failure=Get-Business5244VerifiedInitializationFailureDiagnostic $_.Exception;if($null-ne$failure){[Console]::Error.WriteLine((@{kind='business-5244-initialization-restored';failure=$failure}|ConvertTo-Json -Compress))};$verifiedInitExit=$true}finally{foreach($s in $held){$s.Dispose()}}
if($verifiedInitExit){exit 73}
`;
function coreCheck(head,steady=false){return String.raw`$m=Get-Content -LiteralPath (Join-Path $core 'owner-manifest.json') -Raw|ConvertFrom-Json
if($m.kind-cne'BUSINESS5244_FRESH_OWNER_BUNDLE'-or$m.finiteScope-cne${ps(ARRAY_REPAIR_SCOPE)}-or$m.sourceCommit-cne${ps(head)}-or$m.maintenancePurpose-cne'ReadContextRepair'-or$m.actualT1-ne$false-or$m.externalOperations-ne$false-or$m.rehearsalOnly-ne$false-or$m.recordingEnabled-ne$false-or$m.apiTransitionEnabled-ne$${steady?'false':'true'}-or$m.readPairMaintenanceEnabled-ne$${steady?'false':'true'}-or$m.postExitExclusiveEntryCount-ne41){throw 'ARRAY_OWNER_MANIFEST_CHANGED'}
$names=@(${[...ARRAY_REPAIR_SOURCE_FILES,'run-current-owner.ps1'].sort().map(ps).join(',')})
if(@($m.files).Count-ne13-or(@($m.files.path|Sort-Object)-join'|')-cne($names-join'|')){throw 'ARRAY_OWNER_CLOSURE_CHANGED'}
foreach($f in $m.files){if($f.path-match'[\\/]'-or$f.sha256-cnotmatch'\A[a-f0-9]{64}\z'){throw 'ARRAY_OWNER_LEAF'};Hold-B6 (Join-Path $core $f.path) $f.sha256}
${Object.entries(ARRAY_REPAIR_INPUTS).map(([n,h])=>'Hold-B6 (Join-Path $core '+ps(n)+') '+ps(h)).join('\n')}
Hold-B6 (Join-Path $core ${ps(PACKET)}) ${ps(PACKET_HASH)}
`;}
export function renderArrayRepairCurrent(head,steady=false){if(!commit(head)||typeof steady!=='boolean')fail('ARRAY_OWNER_RENDER');return Buffer.from(String.raw`param([Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ManifestSha256)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$core=${ps(steady?ARRAY_REPAIR_ROOTS.steady:ARRAY_REPAIR_ROOTS.core)}
if($PSVersionTable.PSEdition-cne'Desktop'-or$PSScriptRoot-cne$core){throw 'ARRAY_OWNER_ROOT_CHANGED'}
${holdCode}try{Hold-B6 (Join-Path $core 'owner-manifest.json') $ManifestSha256
${coreCheck(head,steady)}
. (Join-Path $core 'start-business-5244-owned.ps1') -Library -OwnerScopeName ${ps(ARRAY_REPAIR_SCOPE)}
. (Join-Path $core 'start-owned-test.ps1') -Library
Start-Business5244OwnedSupervisor -InitialSlot Current -ScopeName ${ps(ARRAY_REPAIR_SCOPE)}|ForEach-Object{$_|ConvertTo-Json -Compress -Depth 5;[Console]::Out.Flush()}
}${exitCode}`);}
export function renderRouter(head,coreHash,libraryHash){if(!commit(head)||!hex(coreHash)||!hex(libraryHash))fail('ARRAY_OWNER_RENDER');return Buffer.from(String.raw`param([Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ManifestSha256,[ValidateSet(${ps(ARRAY_REPAIR_SCOPE)})][string]$ScopeName=${ps(ARRAY_REPAIR_SCOPE)})
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop';$core=${ps(ARRAY_REPAIR_ROOTS.core)};$root=${ps(ARRAY_REPAIR_ROOTS.router)}
if($PSVersionTable.PSEdition-cne'Desktop'-or$PSScriptRoot-cne$root-or$ScopeName-cne${ps(ARRAY_REPAIR_SCOPE)}){throw 'ARRAY_ROUTER_ROOT_CHANGED'}
${holdCode}try{Hold-B6 (Join-Path $root 'owner-manifest.json') $ManifestSha256
$r=Get-Content -LiteralPath (Join-Path $root 'owner-manifest.json') -Raw|ConvertFrom-Json
if($r.kind-cne'BUSINESS5244_READ_PAIR_ROUTER'-or$r.finiteScope-cne$ScopeName-or$r.entrySourceCommit-cne${ps(head)}-or$r.coreRoot-cne$core-or$r.coreManifestSha256-cne${ps(coreHash)}-or$r.routerLibrarySha256-cne${ps(libraryHash)}-or$r.maintenancePurpose-cne'ReadContextRepair'-or$r.rehearsalOnly-ne$false-or$r.actualT1-ne$false-or$r.externalOperations-ne$false){throw 'ARRAY_ROUTER_IDENTITY_CHANGED'}
Hold-B6 (Join-Path $root 'start-business-5244-readpair-router.ps1') $r.entrySha256
Hold-B6 (Join-Path $root 'readpair-router-library.ps1') ${ps(libraryHash)}
Hold-B6 (Join-Path $core 'owner-manifest.json') ${ps(coreHash)}
${coreCheck(head)}
. (Join-Path $core 'start-business-5244-owned.ps1') -Library -OwnerScopeName $ScopeName
. (Join-Path $core 'start-owned-test.ps1') -Library
. (Join-Path $core 'test125-bound-api-quiescence.ps1')
. (Join-Path $root 'readpair-router-library.ps1') -Library -ScopeName $ScopeName
$config=Read-ErpStartupConfig 'C:\Sirket\ERP\runtime\canonical-test\startup-config.json'
$mode=Get-Business5244ReadPairRouterMode $config -ScopeName $ScopeName
if($mode-ceq'PrepareCurrent'){Start-Business5244OwnedSupervisor -InitialSlot Current -PrepareReadPair -ScopeName $ScopeName|ForEach-Object{$_|ConvertTo-Json -Compress -Depth 5;[Console]::Out.Flush()}}else{Start-Business5244OwnedSupervisor -InitialSlot ReadPair -ScopeName $ScopeName|ForEach-Object{$_|ConvertTo-Json -Compress -Depth 5;[Console]::Out.Flush()}}
}${exitCode}`);}
function payload(source,ci,b){
 const files=new Map(ARRAY_REPAIR_SOURCE_FILES.map(n=>[n,source.files.get(n)]));files.set('run-current-owner.ps1',renderArrayRepairCurrent(source.head));
 const base={kind:'BUSINESS5244_FRESH_OWNER_BUNDLE',finiteScope:ARRAY_REPAIR_SCOPE,sourceCommit:source.head,sourcePolicy:'COMMITTED_GIT_BLOBS_ONLY',maintenancePurpose:ARRAY_REPAIR_PURPOSE,rehearsalOnly:false,recordingEnabled:false,actualT1:false,externalOperations:false,apiTransitionEnabled:true,readPairMaintenanceEnabled:true,runtimeValidationComplete:false,postExitExclusiveBytesRequired:true,postExitExclusiveEntryCount:41,apiPackageId:'CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029',appPackageId:'ERP-BUSINESS-WEB-5244-B6-PREVIEW-READ-VERIFIED-20261030',apiPort:4144,webPort:5244,nativePort:4146,installed:false,predecessor:{captureSha256:ARRAY_REPAIR_INPUTS['current-read2b-owner-capture.json'],recordBeforeSha256:ARRAY_REPAIR_INPUTS['current-erp-processes.before.json'],predecessorEntryKind:'ReadPairRouter',entry:b.capture.entry,coreRoot:OLD_CORE,coreManifestSha256:OLD_HASHES.core,routerRoot:OLD_ROUTER,routerManifestSha256:OLD_HASHES.router},repairPacket:{path:PACKET,sha256:PACKET_HASH,bytes:b.packet.length},beforeImages:Object.entries(ARRAY_REPAIR_INPUTS).map(([n,h])=>({path:n,sha256:h,bytes:b.inputs.get(n).length})),hostedCi:ci};
 const manifest=(m,f)=>bytes({...m,files:[...f].map(([n,v])=>({path:n,sha256:sha(v),bytes:v.length})).sort((a,b)=>a.path.localeCompare(b.path))});
 const coreBytes=manifest(base,files),library=source.files.get('start-business-5244-readpair-router.ps1'),entry=renderRouter(source.head,sha(coreBytes),sha(library));
 const routerBytes=bytes({kind:'BUSINESS5244_READ_PAIR_ROUTER',finiteScope:ARRAY_REPAIR_SCOPE,entrySourceCommit:source.head,coreRoot:ARRAY_REPAIR_ROOTS.core,coreManifestSha256:sha(coreBytes),routerLibrarySha256:sha(library),maintenancePurpose:ARRAY_REPAIR_PURPOSE,rehearsalOnly:false,recordingEnabled:false,actualT1:false,externalOperations:false,installed:false,entry:'start-business-5244-readpair-router.ps1',entrySha256:sha(entry)});
 const steadyFiles=new Map(files);steadyFiles.set('run-current-owner.ps1',renderArrayRepairCurrent(source.head,true));const steadyBytes=manifest({...base,apiTransitionEnabled:false,readPairMaintenanceEnabled:false},steadyFiles);
 return {files,coreBytes,library,entry,routerBytes,steadyFiles,steadyBytes};
}
function verification(source,p){return {schema:'melisa-b6-read-context-repair-owner-verification.v1',ownerSourceCommit:source.head,scope:ARRAY_REPAIR_SCOPE,maintenancePurpose:ARRAY_REPAIR_PURPOSE,...Object.fromEntries(Object.entries(ARRAY_REPAIR_ROOTS).map(([k,v])=>[k+'Root',v])),coreManifestSha256:sha(p.coreBytes),routerManifestSha256:sha(p.routerBytes),steadyManifestSha256:sha(p.steadyBytes),installerSourceSha256:sha(source.files.get('install-business-5244-readpair.ps1')),producerSourceSha256:sha(source.files.get('prepare-business-sale-array-repair-owner.mjs')),repairPacketSha256:PACKET_HASH,coreFiles:13,steadyFiles:13,beforeImages:6,dataFiles:7,postExitExclusiveBytesRequired:true,postExitExclusiveEntryCount:41,runtimeValidationComplete:false,installed:false,recordingEnabled:false,executable:false,executionAuthority:false,sqlCalls:0,serviceCalls:0,taskChanges:0,ownerCalls:0,writes:0};}
function write(root,leaf,b){if(/[\\/]/.test(leaf))fail('ARRAY_OWNER_WRITE_LEAF');fs.writeFileSync(path.win32.join(root,leaf),b,{flag:'wx'});}
export function prepareArrayRepairOwner(){
 if(path.resolve(fileURLToPath(import.meta.url))!==path.win32.join(SOURCE,'scripts','canonical','prepare-business-sale-array-repair-owner.mjs'))fail('ARRAY_OWNER_PREPARE_ENTRY');
 const source=sourceFiles(),ci=hosted(source.head),b=before(),p=payload(source,ci,b);
 for(const root of [...Object.values(ARRAY_REPAIR_ROOTS),PROOF]){if(fs.existsSync(root))fail('ARRAY_OWNER_OUTPUT_EXISTS');plain(path.dirname(root));}
 if(git(['rev-parse','HEAD']).trim()!==source.head||git(['status','--porcelain','--untracked-files=no']).trim())fail('ARRAY_OWNER_SOURCE_CHANGED');
 for(const root of [...Object.values(ARRAY_REPAIR_ROOTS),PROOF])fs.mkdirSync(root);
 for(const [root,files,m] of [[ARRAY_REPAIR_ROOTS.core,p.files,p.coreBytes],[ARRAY_REPAIR_ROOTS.steady,p.steadyFiles,p.steadyBytes]]){for(const[n,v]of files)write(root,n,v);for(const[n,v]of b.inputs)write(root,n,v);write(root,PACKET,b.packet);write(root,'owner-manifest.json',m);}
 write(ARRAY_REPAIR_ROOTS.router,'owner-manifest.json',p.routerBytes);write(ARRAY_REPAIR_ROOTS.router,'readpair-router-library.ps1',p.library);write(ARRAY_REPAIR_ROOTS.router,'start-business-5244-readpair-router.ps1',p.entry);
 const result={...verification(source,p),schema:'melisa-b6-read-context-repair-owner-preparation.v1',hostedCi:ci};write(PROOF,'preparation-receipt.json',bytes(result));write(PROOF,'reviewed-installer-source.ps1',source.files.get('install-business-5244-readpair.ps1'));write(PROOF,'verified-array-repair-producer.mjs',source.files.get('prepare-business-sale-array-repair-owner.mjs'));return result;
}
export function verifyArrayRepairOwner(){const receipt=json(read(path.win32.join(PROOF,'preparation-receipt.json'))),source=sourceFiles(receipt.ownerSourceCommit),ci=hosted(source.head),b=before(),p=payload(source,receipt.hostedCi,b),v=verification(source,p);if(!same(receipt,{...v,schema:'melisa-b6-read-context-repair-owner-preparation.v1',hostedCi:receipt.hostedCi})||receipt.hostedCi?.length!==2||receipt.hostedCi.some((r,i)=>r.event!==ci[i].event||r.head!==source.head||r.conclusion!=='success'||!same(r.jobs,REQUIRED)))fail('ARRAY_OWNER_RECEIPT_CHANGED');for(const[root,files,m]of[[ARRAY_REPAIR_ROOTS.core,p.files,p.coreBytes],[ARRAY_REPAIR_ROOTS.steady,p.steadyFiles,p.steadyBytes]]){pin(path.win32.join(root,'owner-manifest.json'),sha(m));for(const[n,v]of files)pin(path.win32.join(root,n),sha(v));for(const[n,v]of b.inputs)pin(path.win32.join(root,n),sha(v));pin(path.win32.join(root,PACKET),PACKET_HASH);}for(const[leaf,v]of[['owner-manifest.json',p.routerBytes],['readpair-router-library.ps1',p.library],['start-business-5244-readpair-router.ps1',p.entry]])pin(path.win32.join(ARRAY_REPAIR_ROOTS.router,leaf),sha(v));for(const[leaf,v]of[['reviewed-installer-source.ps1',source.files.get('install-business-5244-readpair.ps1')],['verified-array-repair-producer.mjs',source.files.get('prepare-business-sale-array-repair-owner.mjs')]])pin(path.win32.join(PROOF,leaf),sha(v));return {...v,currentRepoHead:source.repoHead};}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){try{const args=process.argv.slice(2);if(args.length!==1||!['--prepare','--verify'].includes(args[0]))fail('ARRAY_OWNER_FIXED_ACTION');console.log(JSON.stringify(args[0]==='--prepare'?prepareArrayRepairOwner():verifyArrayRepairOwner()));}catch(e){console.error(/^[A-Z][A-Z0-9_]+$/.test(e.message)?e.message:'ARRAY_OWNER_PREPARATION_FAILED');process.exitCode=1;}}
