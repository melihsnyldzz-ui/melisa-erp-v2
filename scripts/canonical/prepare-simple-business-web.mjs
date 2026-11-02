import fs from 'node:fs';import path from 'node:path';import cp from 'node:child_process';import {fileURLToPath} from 'node:url';
import {buildSimpleWebPair} from '../../apps/sites-workflow/business-web-package.mjs';
import {webRuntimeFiles,webSha256,loadWebRelease,assertPlainWebPath,assertWebRollbackCompatible} from '../../apps/sites-workflow/business-web-release.mjs';
const repo='melihsnyldzz-ui/melisa-erp-v2',branch='codex/erp-p03-pr53-candidate-20261018';
const sourceRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const inputs=[
 {name:'ERP-BUSINESS-WEB-5244-B6-PENDING-5457e450-PASSIVE-20261031',digest:'f5f87a6ec42e2e1273d40e2ce030e3c19d836bb96b0d56a0dc289d27a2911afc'},
 {name:'ERP-BUSINESS-WEB-5244-B6-PREVIEW-READ-VERIFIED-20261030',digest:'853025ef7df10eec9a4feff026b767c6c323e5e5259c7bcbc2f7f19186743855'},
];
const need=(ok,code)=>{if(!ok)throw Error(code);};
function command(file,args){return cp.execFileSync(file,args,{cwd:sourceRoot,windowsHide:true,timeout:30000,maxBuffer:16*1024*1024,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});}
const git=args=>command(String.raw`C:\Program Files\Git\cmd\git.exe`,args);
const gh=endpoint=>JSON.parse(command(String.raw`C:\Program Files\GitHub CLI\gh.exe`,['api','--hostname','github.com',endpoint]));
export function assertSimpleWebCi(run,result,source,event){
 need(run?.head_sha===source&&run.head_repository?.full_name===repo&&run.event===event&&run.path==='.github/workflows/ci.yml'&&run.run_attempt===1&&run.status==='completed'&&run.conclusion==='success','WEB_SOURCE_CI_REQUIRED');
 need(result?.total_count===3&&result.jobs?.length===3&&new Set(result.jobs.map(j=>j.name)).size===3&&result.jobs.every(j=>['quality-build-test','secret-scan','windows-startup-test'].includes(j.name)&&j.head_sha===source&&j.run_id===run.id&&j.run_attempt===1&&j.status==='completed'&&j.conclusion==='success'&&j.steps?.length>0&&j.steps.every(s=>s.status==='completed'&&s.conclusion==='success')),'WEB_SOURCE_CI_JOBS');
 return {id:run.id,event,sourceCommit:source,attempt:1,conclusion:'success',jobs:result.jobs.map(j=>({id:j.id,name:j.name,conclusion:j.conclusion}))};
}
function ci(source){
 const pr=gh(`repos/${repo}/pulls/54`);need(pr.state==='open'&&pr.head?.ref===branch&&pr.head.sha===source&&pr.head.repo.full_name===repo,'WEB_SOURCE_PR_IDENTITY');
 const runs=gh(`repos/${repo}/actions/runs?head_sha=${source}&per_page=100`).workflow_runs;
 return ['push','pull_request'].map(event=>{const selected=runs.filter(r=>r.head_sha===source&&r.event===event&&r.path==='.github/workflows/ci.yml');need(selected.length===1&&selected[0].run_attempt===1,'WEB_SOURCE_CI_UNIQUE');const run=gh(`repos/${repo}/actions/runs/${selected[0].id}`),jobs=gh(`repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`);return assertSimpleWebCi(run,jobs,source,event);});
}
function readUi(input){
 const root=String.raw`C:\Sirket\ERP\releases`+'\\'+input.name;assertPlainWebPath(root);const manifestBytes=fs.readFileSync(path.join(root,'release-manifest.json'));need(webSha256(manifestBytes)===input.digest,'WEB_PACKAGE_UI_MANIFEST');const manifest=JSON.parse(manifestBytes),bytes=new Map();
 for(const f of manifest.files){if(!f.path.startsWith('apps/sites-workflow/dist/')&&!['apps/sites-workflow/business-preview-session.mjs','apps/sites-workflow/src/workflow/businessWorkface.mjs','apps/sites-workflow/src/workflow/workTradeModel.mjs','apps/api/src/services/canonicalBusinessSaleReadModel.mjs','apps/api/src/services/canonicalBusinessPartyHistoryModel.mjs'].includes(f.path))continue;const full=path.resolve(root,f.path);need(full.startsWith(root+path.sep),'WEB_SOURCE_INPUT_PATH');assertPlainWebPath(full);bytes.set(f.path,fs.readFileSync(full));}
 return {manifestBytes,digest:input.digest,bytes};
}
export function prepareSimpleWeb(action){
 need(process.platform==='win32'&&['--prepare','--verify'].includes(action),'WEB_PASSIVE_ACTION');
 need(git(['remote','get-url','origin']).toString().trim()===`https://github.com/${repo}.git`&&git(['remote','get-url','--push','origin']).toString().trim()===`https://github.com/${repo}.git`&&git(['branch','--show-current']).toString().trim()===branch,'WEB_SOURCE_REPOSITORY');
 const source=git(['rev-parse','HEAD']).toString().trim(),runtime=new Map();
 for(const name of [...webRuntimeFiles,'apps/sites-workflow/business-web-package.mjs','scripts/canonical/prepare-simple-business-web.mjs']){const blob=git(['show',source+':'+name]);need(fs.readFileSync(path.join(sourceRoot,name),'utf8').replaceAll('\r\n','\n')===blob.toString('utf8'),'WEB_SOURCE_UNCOMMITTED');if(webRuntimeFiles.includes(name))runtime.set(name,blob);}
 const provenance=ci(source),pair=buildSimpleWebPair({sourceCommit:source,runtime,candidate:readUi(inputs[0]),previous:readUi(inputs[1])});const receipt={schema:'melisa-simple-web-passive-pair.v1',sourceCommit:source,ci:provenance,releases:[],installed:false,runtimeVerified:false,executionAuthority:false,sqlCalls:0,serviceChanges:0};
 for(const slot of ['candidate','rollback']){const r=pair[slot],root=String.raw`C:\Sirket\ERP\releases`+'\\'+r.manifest.releaseId,manifestPath=path.join(root,'release-manifest.json'),digest=webSha256(r.manifestBytes);
  if(action==='--prepare'){need(!fs.existsSync(root),'WEB_PASSIVE_ROOT_EXISTS');assertPlainWebPath(path.dirname(root));fs.mkdirSync(root);for(const [name,b]of [...r.files,['release-manifest.json',r.manifestBytes]]){const full=path.join(root,name);fs.mkdirSync(path.dirname(full),{recursive:true});const fd=fs.openSync(full,'wx');try{fs.writeFileSync(fd,b);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}}
  const loaded=loadWebRelease(manifestPath,digest);need(JSON.stringify(loaded.manifest)===JSON.stringify(r.manifest),'WEB_PASSIVE_MANIFEST_CHANGED');receipt.releases.push({slot,root,manifestSha256:digest,fileCount:r.files.size,bytes:[...r.files.values()].reduce((n,b)=>n+b.length,0)});
 }
 assertWebRollbackCompatible(pair.candidate.manifest,pair.rollback.manifest);return receipt;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{need(process.argv.length===3,'WEB_PASSIVE_ACTION');console.log(JSON.stringify(prepareSimpleWeb(process.argv[2])));}catch(error){console.error(/^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:'WEB_PASSIVE_PREPARATION_REJECTED');process.exitCode=1;}}
