// Fixed passive three-blob derivative; no runtime, SQL, profile or task changes.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import cp from 'node:child_process';import {fileURLToPath,pathToFileURL} from 'node:url';
// Public frozen package/source identities; these are not authentication material.
const FROZEN_RELEASE_DIGEST=['560c735fcaffa669','2f55543840f81066','79b43b871e3c19f1','990bdd17d46f9946'].join('');
const FROZEN_BASE_SOURCE='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';
const FROZEN_TEST_DATABASE='MELISA_ERP_SIRKET_TEST_20260929_01';
export const PREVIEW_LINK_PACKAGE=Object.freeze({
 sourceRoot:String.raw`C:\Sirket\ERP\worktrees\erp-p03-pr53-candidate-20261018`,
 sourceCommit:'d4a7ec26edc22cb7cd707dc2fe4fdb209adf9d5c',
 baseApi:String.raw`C:\Sirket\ERP\releases\CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029`,
 api:String.raw`C:\Sirket\ERP\releases\CANONICAL-TEST125-BUSINESS5244-B6-PREVIEW-LINK-20261030`,
 baseWeb:String.raw`C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-B6-WORKFACE-fe3948c5-20261029`,
 web:String.raw`C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-B6-PREVIEW-LINK-20261030`,
 proof:String.raw`C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-preview-link-20261030`,
 baseApiHash:FROZEN_RELEASE_DIGEST,
 baseWebHash:'5cebcda8e9937a4db7135bdd18e48fc1585e0d5b1854f63711fe546886ec4bf6',
 paths:Object.freeze(['apps/api/src/routes/workSalesRoutes.mjs','apps/api/src/services/businessSelectedSalePreviewStore.mjs','apps/api/src/services/businessSelectedSalePreview.mjs'])
});
const P=PREVIEW_LINK_PACKAGE,hash=b=>crypto.createHash('sha256').update(b).digest('hex'),fail=c=>{throw Error('PREVIEW_LINK_'+c);};
const check=(v,c)=>{if(!v)fail(c);},json=b=>JSON.parse(b.toString('utf8')),bytes=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
function plain(file){for(let p=path.resolve(file);p;p=path.dirname(p)){const s=fs.lstatSync(p);check(!s.isSymbolicLink(),'REPARSE');if(path.dirname(p)===p)break;}}
function read(file){plain(file);const a=fs.lstatSync(file);check(a.isFile()&&a.nlink===1,'REGULAR_FILE');const b=fs.readFileSync(file),z=fs.lstatSync(file);check(a.size===b.length&&a.ino===z.ino&&a.mtimeMs===z.mtimeMs,'READ_CHANGED');return b;}
function validRows(rows){check(Array.isArray(rows),'FILES');const seen=new Set();for(const r of rows){check(r&&typeof r.path==='string'&&!r.path.includes('\\')&&!r.path.startsWith('/')&&r.path.split('/').every(p=>p&&p!=='.'&&p!=='..')&&/^[a-f0-9]{64}$/.test(r.sha256)&&!seen.has(r.path.toLowerCase()),'FILES');seen.add(r.path.toLowerCase());}return rows;}
export function compilePreviewLinkManifests(api,web,overlays){
 check(api.packageId===path.win32.basename(P.baseApi)&&api.sourceCommit===FROZEN_BASE_SOURCE&&api.database===FROZEN_TEST_DATABASE&&api.actualT1===false&&api.externalOperations===false&&api.businessSaleCandidate?.kind==='ADMITTED_B6_WRITER'&&api.businessSaleCandidate.recordingEnabled===true,'API_IDENTITY');
 check(web.packageId==='ERP-BUSINESS-WEB-5244-B6-WORKFACE-fe3948c5-20261029'&&web.sourceCommit==='fe3948c5ea77e7b0eb215cac6b6b0831adb45e8a'&&web.backendPackageId===api.packageId&&web.backendManifestSha256===P.baseApiHash&&web.actualT1===false&&web.externalOperations===false,'WEB_IDENTITY');
 const before=new Map(validRows(api.files).map(r=>[r.path,{...r}]));validRows(web.files);check(overlays instanceof Map&&overlays.size===3&&P.paths.every(p=>Buffer.isBuffer(overlays.get(p))),'EXACT_OVERLAYS');
 const overlayFiles=P.paths.map(p=>({path:p,sha256:hash(overlays.get(p)),bytes:overlays.get(p).length,beforeSha256:before.get(p)?.sha256??null}));
 for(const r of overlayFiles)before.set(r.path,{...(before.get(r.path)??{}),path:r.path,sha256:r.sha256,...(before.get(r.path)?.bytes!==undefined?{bytes:r.bytes}:{})});
 const a={...structuredClone(api),installed:false,files:[...before.values()].sort((a,b)=>a.path.localeCompare(b.path)),apiOverlaySourceCommit:P.sourceCommit,apiOverlayFiles:overlayFiles,previewLinkPackageRefresh:{kind:'PREVIEW_LINK_PACKAGE_REFRESH',sourceCommit:P.sourceCommit,baseManifestSha256:P.baseApiHash,installed:false,sqlExecuted:false,profileChanged:false}};
 const apiBytes=bytes(a),w={...structuredClone(web),packageId:path.win32.basename(P.web),backendRoot:P.api,backendManifestSha256:hash(apiBytes),installed:false,previewLinkPackageRefresh:{kind:'PREVIEW_LINK_PACKAGE_REFRESH',sourceCommit:P.sourceCommit,baseManifestSha256:P.baseWebHash,frontendPayloadUnchanged:true,sqlExecuted:false,profileChanged:false}};
 const webBytes=bytes(w),apiPin={root:P.api,packageId:a.packageId,manifestSha256:hash(apiBytes),sourceCommit:a.sourceCommit,configPath:String.raw`C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json`},webPin={root:P.web,packageId:w.packageId,manifestSha256:hash(webBytes),frontendSourceCommit:w.sourceCommit,backendPackageId:a.packageId,backendManifestSha256:hash(apiBytes)};
 const pair={schema:'melisa-b6-preview-package-pair.v1',scope:'TEST125-API-B6-WRITER-20261029',purpose:'PreviewLinkPackageRefresh',current:{api:{...apiPin,root:P.baseApi,manifestSha256:P.baseApiHash},web:{...webPin,root:P.baseWeb,packageId:web.packageId,manifestSha256:P.baseWebHash,backendManifestSha256:P.baseApiHash}},candidate:{api:apiPin,web:webPin}};
 return {api:a,web:w,apiBytes,webBytes,pairBytes:bytes(pair),overlayFiles};
}
function git(args,raw=false){return cp.execFileSync('git',args,{cwd:P.sourceRoot,encoding:raw?undefined:'utf8',windowsHide:true,maxBuffer:8*1024*1024});}
function exactSource(){
 for(const args of [['remote','get-url','origin'],['remote','get-url','--push','origin']])check(git(args).trim()==='https://github.com/melihsnyldzz-ui/melisa-erp-v2.git','ORIGIN');
 check(git(['branch','--show-current']).trim()==='codex/erp-p03-pr53-candidate-20261018','BRANCH');git(['merge-base','--is-ancestor',P.sourceCommit,'HEAD']);
 const out=new Map();for(const p of P.paths){const b=git(['show',P.sourceCommit+':'+p],true),working=read(path.join(P.sourceRoot,p));check(Buffer.from(working.toString('utf8').replaceAll('\r\n','\n')).equals(b),'WORKING_SOURCE_CHANGED');out.set(p,b);}return out;
}
function exactCI(){
 const gh=endpoint=>json(cp.execFileSync('gh',['api',endpoint],{cwd:P.sourceRoot,windowsHide:true,maxBuffer:4*1024*1024}));const all=gh('repos/melihsnyldzz-ui/melisa-erp-v2/actions/runs?head_sha='+P.sourceCommit+'&per_page=100').workflow_runs;check(Array.isArray(all),'CI');const result=[];
 for(const event of ['push','pull_request']){const r=all.filter(r=>r.head_sha===P.sourceCommit&&r.path==='.github/workflows/ci.yml'&&r.event===event).sort((a,b)=>b.id-a.id)[0];check(r&&r.status==='completed'&&r.conclusion==='success','EXACT_CI');const jobs=gh('repos/melihsnyldzz-ui/melisa-erp-v2/actions/runs/'+r.id+'/jobs?filter=latest&per_page=100').jobs;for(const name of ['windows-startup-test','quality-build-test','secret-scan']){const rows=jobs.filter(j=>j.name===name);check(rows.length===1&&rows[0].status==='completed'&&rows[0].conclusion==='success'&&rows[0].steps?.length,'CI_JOB');}result.push({event,id:r.id,head:r.head_sha,conclusion:r.conclusion});}return result;
}
function checkPayload(root,manifest){validRows(manifest.files);for(const r of manifest.files)check(hash(read(path.join(root,r.path)))===r.sha256,'BASE_PAYLOAD_CHANGED');}
function staticRelativeClosure(root,overlays){
 const seen=new Set(),queue=[...P.paths],missing=[];while(queue.length){const p=queue.shift();if(seen.has(p))continue;seen.add(p);const b=overlays.get(p)??read(path.join(root,p)),text=b.toString('utf8');
  for(const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"\r\n]+)['"]/g)){if(!m[1].startsWith('.'))continue;const next=path.posix.normalize(path.posix.join(path.posix.dirname(p),m[1]));check(!next.startsWith('../')&&!path.posix.isAbsolute(next),'IMPORT_OUTSIDE');if(!overlays.has(next)&&!fs.existsSync(path.join(root,next))){missing.push(next);continue;}if(/\.(?:mjs|cjs|js)$/.test(next))queue.push(next);}
 }check(missing.length===0,'IMPORT_MISSING');return {kind:'STATIC_RELATIVE_IMPORT_EXISTENCE',sourceFiles:seen.size,missing:0,evaluated:0};
}
function write(file,b){check(!fs.existsSync(file),'OUTPUT_EXISTS');plain(path.dirname(file));const fd=fs.openSync(file,'wx');try{fs.writeFileSync(fd,b);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function copyPayload(from,to,rows,overlays=new Map()){
 fs.mkdirSync(to);for(const r of rows){const target=path.join(to,r.path);fs.mkdirSync(path.dirname(target),{recursive:true});const b=overlays.get(r.path)??read(path.join(from,r.path));check(hash(b)===r.sha256,'COPY_INPUT_CHANGED');write(target,b);check(hash(read(target))===r.sha256,'COPY_READBACK_CHANGED');}
}
export function prepareBusinessSalePreviewLinkPackages(){
 check(process.platform==='win32'&&path.resolve(fileURLToPath(import.meta.url))===path.join(P.sourceRoot,'scripts','canonical','prepare-business-sale-preview-link-package.mjs'),'FIXED_SOURCE');
 const apiBytes=read(path.join(P.baseApi,'release-manifest.json')),webBytes=read(path.join(P.baseWeb,'release-manifest.json'));check(hash(apiBytes)===P.baseApiHash&&hash(webBytes)===P.baseWebHash,'BASE_MANIFEST_CHANGED');
 const a=json(apiBytes),w=json(webBytes),overlays=exactSource(),ci=exactCI();for(const out of [P.api,P.web]){check(!fs.existsSync(out),'OUTPUT_EXISTS');plain(path.dirname(out));}plain(P.proof);check(!fs.existsSync(path.join(P.proof,'preview-package-pair.json'))&&!fs.existsSync(path.join(P.proof,'package-preparation.json')),'OUTPUT_EXISTS');
 checkPayload(P.baseApi,a);checkPayload(P.baseWeb,w);const closure=staticRelativeClosure(P.baseApi,overlays),compiled=compilePreviewLinkManifests(a,w,overlays);
 check(shaUnchanged(a,compiled.api,compiled.overlayFiles)&&JSON.stringify(w.files)===JSON.stringify(compiled.web.files),'PAYLOAD_SCOPE');
 // All source, manifests, CI and payload inputs have passed before creation.
 copyPayload(P.baseApi,P.api,compiled.api.files,overlays);write(path.join(P.api,'release-manifest.json'),compiled.apiBytes);copyPayload(P.baseWeb,P.web,compiled.web.files);write(path.join(P.web,'release-manifest.json'),compiled.webBytes);
 check(hash(read(path.join(P.api,'release-manifest.json')))===hash(compiled.apiBytes)&&hash(read(path.join(P.web,'release-manifest.json')))===hash(compiled.webBytes),'MANIFEST_READBACK');
 write(path.join(P.proof,'preview-package-pair.json'),compiled.pairBytes);const result={schema:'melisa-b6-preview-link-package-preparation.v1',sourceCommit:P.sourceCommit,apiRoot:P.api,webRoot:P.web,apiManifestSha256:hash(compiled.apiBytes),webManifestSha256:hash(compiled.webBytes),pairSha256:hash(compiled.pairBytes),apiFiles:compiled.api.files.length,webFiles:compiled.web.files.length,overlayFiles:compiled.overlayFiles,staticRelativeClosure:closure,hostedCi:ci,installed:false,sqlCalls:0,profileChanges:0,taskChanges:0,serviceCalls:0,sourceEvaluated:0};write(path.join(P.proof,'package-preparation.json'),bytes(result));return result;
}
function shaUnchanged(before,after,overlays){const allowed=new Set(overlays.map(r=>r.path)),a=new Map(after.files.map(r=>[r.path,r.sha256]));return before.files.every(r=>allowed.has(r.path)||a.get(r.path)===r.sha256)&&after.files.every(r=>allowed.has(r.path)||before.files.some(v=>v.path===r.path));}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){check(process.argv.slice(2).join('|')==='--prepare','FIXED_ACTION');try{process.stdout.write(JSON.stringify(prepareBusinessSalePreviewLinkPackages())+'\n');}catch(e){process.stderr.write((/^PREVIEW_LINK_[A-Z0-9_]+$/.test(e.message)?e.message:'PREVIEW_LINK_PREPARATION_FAILED')+'\n');process.exitCode=1;}}
