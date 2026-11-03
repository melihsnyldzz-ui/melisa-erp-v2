import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const STARTUP_FILES=Object.freeze(['start-current-business-pair.ps1','current-business-pair-startup.ps1','start-owned-test.ps1','canonical-business-sale-maintenance.ps1','start-business-5244-owned.ps1','start-business-5244-web.ps1','business-5244-startup-exclusion.ps1','business-5244-retirement-state.ps1','business-5244-retirement-channel.ps1','business-5244-maintenance-dispatch.ps1','business-5244-web-native.cs','business-5244-retirement-peer.cs']);
export const BEFORE_FILES=Object.freeze(['startup-before-config.json','startup-before-task.xml','startup-before-sddl.txt']);
const REPO=String.raw`C:\Sirket\ERP\worktrees\erp-p03-pr53-candidate-20261018`,ORIGIN='https://github.com/melihsnyldzz-ui/melisa-erp-v2.git';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),json=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const need=(v,c)=>{if(!v)throw Error('CURRENT_PAIR_STARTUP_'+c);};
export function startupRoot(commit){need(/^[a-f0-9]{40}$/.test(commit??''),'COMMIT');return String.raw`C:\Sirket\ERP\releases\ERP-CURRENT-PAIR-STARTUP-SOURCE-`+commit;}
export function assertStartupCi(commit,runs){
 const names=['quality-build-test','secret-scan','windows-startup-test'];
 need(Array.isArray(runs)&&runs.length===2&&new Set(runs.map(x=>x.event)).size===2&&new Set(runs.map(x=>x.id)).size===2&&runs.every(r=>Number.isSafeInteger(r.id)&&r.id>0&&r.repository==='melihsnyldzz-ui/melisa-erp-v2'&&r.workflow==='CI'&&r.branch==='codex/erp-p03-pr53-candidate-20261018'&&['push','pull_request'].includes(r.event)&&r.headSha===commit&&r.status==='completed'&&r.conclusion==='success'&&r.attempt===1&&r.jobs?.length===3&&r.jobs.map(j=>j.name).sort().join('|')===names.join('|')&&r.jobs.every(j=>j.head_sha===commit&&j.run_id===r.id&&j.run_attempt===1&&j.status==='completed'&&Number.isSafeInteger(j.id)&&j.id>0&&j.conclusion==='success'&&j.steps?.length>0&&j.steps.every(s=>s.status==='completed'&&s.conclusion==='success'))),'EXACT_CI');
}
export function readStartupCi(commit,ids,gh){
 need(Array.isArray(ids)&&ids.length===2&&new Set(ids).size===2&&ids.every(x=>Number.isSafeInteger(x)&&x>0),'CI_RUN_IDS');
 const runs=ids.map(id=>{
  const run=gh('repos/melihsnyldzz-ui/melisa-erp-v2/actions/runs/'+id);
  need(run.id===id&&run.repository?.full_name==='melihsnyldzz-ui/melisa-erp-v2'&&run.path==='.github/workflows/ci.yml','CI_PROVENANCE');
  const rows=gh('repos/melihsnyldzz-ui/melisa-erp-v2/actions/runs/'+id+'/jobs?filter=latest&per_page=100');
  need(rows.total_count===3&&rows.jobs?.length===3,'CI_JOBS');
  return {id,repository:run.repository.full_name,workflow:run.name,branch:run.head_branch,event:run.event,headSha:run.head_sha,status:run.status,conclusion:run.conclusion,attempt:run.run_attempt,jobs:rows.jobs};
 });
 assertStartupCi(commit,runs);return runs;
}
export function makeStartupBundle({commit,readGit,before}){
 const root=startupRoot(commit),files=new Map();need(before instanceof Map&&before.size===3&&BEFORE_FILES.every(f=>Buffer.isBuffer(before.get(f))&&before.get(f).length>0),'BEFORE_IMAGES');
 for(const leaf of STARTUP_FILES){const b=readGit('scripts/canonical/'+leaf);need(Buffer.isBuffer(b)&&b.length>0,'GIT_SOURCE');files.set(leaf,Buffer.from(b));}
 for(const leaf of BEFORE_FILES)files.set(leaf,Buffer.from(before.get(leaf)));
 const manifest={schema:'melisa-current-pair-startup-source.v1',root,sourceCommit:commit,applicationProducer:'7c6dcc72749862958aa3fad9011837eda900cf83',installed:false,executionAuthority:false,files:[...files].map(([p,b])=>({path:p,sha256:sha(b),bytes:b.length}))};
 const bytes=json(manifest);files.set('startup-source-manifest.json',bytes);
 return {root,files,manifest,manifestHash:sha(bytes)};
}
// Passive preparation only. This script is generated from this reviewed source,
// holds the bootstrap before import, then holds the complete verified closure.
export function passiveProjectionScript(){return String.raw`
param([string]$Root,[string]$ManifestHash,[string]$EntryHash)
$ErrorActionPreference='Stop'
$entry=Join-Path $Root 'start-current-business-pair.ps1'
$held=[IO.File]::Open($entry,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
$source=$null
try{
 if((Get-FileHash -LiteralPath $entry -Algorithm SHA256).Hash-ine$EntryHash){throw 'CURRENT_PAIR_BOOTSTRAP_CHANGED'}
 . $entry -Library
 $source=Read-ErpCurrentPairSources $Root $ManifestHash
 . (Join-Path $Root 'current-business-pair-startup.ps1')
 $texts=$source.texts
 $plan=New-ErpCurrentPairProjection -BeforeConfig $texts['startup-before-config.json'].text -BeforeTask $texts['startup-before-task.xml'].text -BeforeSddl $texts['startup-before-sddl.txt'].text -ExpectedConfigHash $texts['startup-before-config.json'].digest -ExpectedTaskHash $texts['startup-before-task.xml'].digest -BundleRoot $Root -SourceManifestHash $ManifestHash -PlanPath (Join-Path $Root 'startup-plan.json')
 $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($plan|ConvertTo-Json -Depth 100 -Compress))
 $out=[IO.File]::Open((Join-Path $Root 'startup-plan.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$out.Write($bytes,0,$bytes.Length);$out.Flush($true)}finally{$out.Dispose()}
 'PASSIVE_STARTUP_PLAN_NOT_APPLIED'
}finally{if($source){foreach($s in $source.holds){$s.Dispose()}};$held.Dispose()}
`;}
function main(){
 const args=process.argv.slice(2);need(args.length===5&&args[0]==='--prepare','ARGUMENTS');
 need(process.platform==='win32'&&path.resolve(process.cwd())===REPO,'REPO');
 const git=(...a)=>cp.execFileSync('git',a,{cwd:REPO,maxBuffer:16*1024*1024}),text=(...a)=>git(...a).toString().trim();
 const commit=text('rev-parse','HEAD');need(text('branch','--show-current')==='codex/erp-p03-pr53-candidate-20261018'&&text('remote','get-url','origin')===ORIGIN&&text('remote','get-url','--push','origin')===ORIGIN,'SOURCE_IDENTITY');
 const own='scripts/canonical/prepare-current-business-pair-startup.mjs';need(sha(Buffer.from(fs.readFileSync(fileURLToPath(import.meta.url),'utf8').replaceAll('\r\n','\n')))===sha(git('show',commit+':'+own)),'PRODUCER_DIRTY');
 need(text('diff','--name-only','7c6dcc72749862958aa3fad9011837eda900cf83',commit,'--','apps','packages')==='','APPLICATION_INPUTS_CHANGED');
 const before=new Map(BEFORE_FILES.map((f,i)=>[f,fs.readFileSync(args[i+1])]));
 // Input is only run IDs. All status/identity/step evidence is read from
 // GitHub, never trusted from a caller-created green DTO or saved receipt.
 const ci=readStartupCi(commit,JSON.parse(fs.readFileSync(args[4],'utf8')),endpoint=>JSON.parse(cp.execFileSync('gh',['api',endpoint],{encoding:'utf8',maxBuffer:16*1024*1024})));
 const bundle=makeStartupBundle({commit,readGit:f=>git('show',commit+':'+f),before});
 need(!fs.existsSync(bundle.root),'NO_OVERWRITE');
 for(let p=path.dirname(bundle.root);;p=path.dirname(p)){need(!fs.lstatSync(p).isSymbolicLink(),'REPARSE');if(path.dirname(p)===p)break;}
 fs.mkdirSync(bundle.root);for(const [leaf,b]of bundle.files){fs.writeFileSync(path.join(bundle.root,leaf),b,{flag:'wx'});need(sha(fs.readFileSync(path.join(bundle.root,leaf)))===sha(b),'READBACK');}
 const prep=path.join(bundle.root,'prepare-plan.ps1');fs.writeFileSync(prep,passiveProjectionScript(),{flag:'wx'});
 const env={...process.env};delete env.PSModulePath;
 const output=cp.execFileSync(String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,['-NoProfile','-NonInteractive','-File',prep,'-Root',bundle.root,'-ManifestHash',bundle.manifestHash,'-EntryHash',sha(bundle.files.get('start-current-business-pair.ps1'))],{encoding:'utf8',env,timeout:60000});
 need(output.trim()==='PASSIVE_STARTUP_PLAN_NOT_APPLIED','PROJECTION');
 const plan=fs.readFileSync(path.join(bundle.root,'startup-plan.json'));
 fs.writeFileSync(path.join(bundle.root,'preparation-receipt.json'),json({sourceCommit:commit,applicationProducer:bundle.manifest.applicationProducer,ci:ci.map(r=>({id:r.id,event:r.event,headSha:r.headSha,attempt:r.attempt})),root:bundle.root,manifestSha256:bundle.manifestHash,planSha256:sha(plan),installed:false,executionAuthority:false,appStarts:0,taskChanges:0,configChanges:0,sqlQueries:0}),{flag:'wx'});
 console.log(JSON.stringify({root:bundle.root,sourceCommit:commit,manifestSha256:bundle.manifestHash,planSha256:sha(plan),state:'NOT_APPLIED'}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
