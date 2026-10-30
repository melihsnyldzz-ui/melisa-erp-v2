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
// The corrective derivative preserves the accepted three-blob overlay.
// The exact reviewed corrective commit must be pinned before preparation.
export const NATIVE_CONTEXT_PACKAGE=Object.freeze({
 ...P,sourceCommit:'c59bc3936ae9cfd39178716898e928aaf8e993c5',baseApi:P.api,baseWeb:P.web,
 api:String.raw`C:\Sirket\ERP\releases\CANONICAL-TEST125-BUSINESS5244-B6-PREVIEW-CONTEXT-20261030`,
 web:String.raw`C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-B6-PREVIEW-CONTEXT-20261030`,
 proof:path.win32.join(P.proof,'native-context-fix'),
 baseApiHash:['082786d92ea204ec4','a448231a8a1b555e','a8f7aaaabe1f3441','3b11ddd99247f5f'].join(''),
 baseWebHash:'c3c7af16091f11f07acb704d2785a1d103392411510167bdf4befc7f0845765c',
 paths:Object.freeze(['apps/api/src/services/workTradeStore.mjs'])
});
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
export function compileNativeContextManifests(api,web,overlays){
 const C=NATIVE_CONTEXT_PACKAGE;
 check(typeof C.sourceCommit==='string'&&/^[a-f0-9]{40}$/.test(C.sourceCommit),'CONTEXT_SOURCE_NOT_PREPARED');
 check(api.packageId===path.win32.basename(P.baseApi)&&api.sourceCommit===FROZEN_BASE_SOURCE&&api.database===FROZEN_TEST_DATABASE&&api.actualT1===false&&api.externalOperations===false&&api.businessSaleCandidate?.kind==='ADMITTED_B6_WRITER'&&api.businessSaleCandidate.recordingEnabled===true,'API_IDENTITY');
 check(api.apiOverlaySourceCommit===P.sourceCommit&&Array.isArray(api.apiOverlayFiles)&&api.apiOverlayFiles.length===3&&P.paths.every(p=>api.apiOverlayFiles.some(r=>r.path===p))&&!Object.hasOwn(api,'nativeContextOverlaySourceCommit'),'CONTEXT_BASE_PROVENANCE');
 check(web.packageId===path.win32.basename(P.web)&&web.sourceCommit==='fe3948c5ea77e7b0eb215cac6b6b0831adb45e8a'&&web.backendRoot===P.api&&web.backendPackageId===api.packageId&&web.backendManifestSha256===C.baseApiHash&&web.actualT1===false&&web.externalOperations===false,'WEB_IDENTITY');
 const before=new Map(validRows(api.files).map(r=>[r.path,{...r}]));validRows(web.files);
 check(overlays instanceof Map&&overlays.size===1&&Buffer.isBuffer(overlays.get(C.paths[0]))&&before.has(C.paths[0]),'EXACT_OVERLAYS');
 const p=C.paths[0],b=overlays.get(p),old=before.get(p),overlayFiles=[{path:p,sha256:hash(b),bytes:b.length,beforeSha256:old.sha256}];
 check(overlayFiles[0].sha256!==old.sha256,'CONTEXT_UNCHANGED_OVERLAY');before.set(p,{...old,sha256:hash(b),...(old.bytes!==undefined?{bytes:b.length}:{})});
 const provenance={kind:'NATIVE_CONTEXT_PACKAGE_REFRESH',sourceCommit:C.sourceCommit,baseManifestSha256:C.baseApiHash,installed:false,sqlExecuted:false,profileChanged:false};
 const a={...structuredClone(api),installed:false,files:[...before.values()].sort((a,b)=>a.path.localeCompare(b.path)),nativeContextOverlaySourceCommit:C.sourceCommit,nativeContextOverlayFiles:overlayFiles,nativeContextPackageRefresh:provenance};
 const apiBytes=bytes(a),w={...structuredClone(web),packageId:path.win32.basename(C.web),backendRoot:C.api,backendManifestSha256:hash(apiBytes),installed:false,nativeContextPackageRefresh:{...provenance,baseManifestSha256:C.baseWebHash,frontendPayloadUnchanged:true}};
 const webBytes=bytes(w),apiPin={root:C.api,packageId:a.packageId,manifestSha256:hash(apiBytes),sourceCommit:a.sourceCommit,configPath:String.raw`C:\Sirket\ERP\config\TEST-20260929-01\business-5244-private.json`},webPin={root:C.web,packageId:w.packageId,manifestSha256:hash(webBytes),frontendSourceCommit:w.sourceCommit,backendPackageId:a.packageId,backendManifestSha256:hash(apiBytes)};
 const pair={schema:'melisa-b6-preview-package-pair.v1',scope:'TEST125-API-B6-WRITER-20261029',purpose:'PreviewLinkPackageRefresh',current:{api:{...apiPin,root:C.baseApi,manifestSha256:C.baseApiHash},web:{...webPin,root:C.baseWeb,packageId:web.packageId,manifestSha256:C.baseWebHash,backendManifestSha256:C.baseApiHash}},candidate:{api:apiPin,web:webPin}};
 return {api:a,web:w,apiBytes,webBytes,pairBytes:bytes(pair),overlayFiles};
}
function git(args,raw=false){return cp.execFileSync('git',args,{cwd:P.sourceRoot,encoding:raw?undefined:'utf8',windowsHide:true,maxBuffer:8*1024*1024});}
function exactSource(policy=P){
 check(typeof policy.sourceCommit==='string'&&/^[a-f0-9]{40}$/.test(policy.sourceCommit),'CONTEXT_SOURCE_NOT_PREPARED');
 for(const args of [['remote','get-url','origin'],['remote','get-url','--push','origin']])check(git(args).trim()==='https://github.com/melihsnyldzz-ui/melisa-erp-v2.git','ORIGIN');
 check(git(['branch','--show-current']).trim()==='codex/erp-p03-pr53-candidate-20261018','BRANCH');git(['merge-base','--is-ancestor',policy.sourceCommit,'HEAD']);
 const out=new Map();for(const p of policy.paths){const b=git(['show',policy.sourceCommit+':'+p],true),working=read(path.join(P.sourceRoot,p));check(Buffer.from(working.toString('utf8').replaceAll('\r\n','\n')).equals(b),'WORKING_SOURCE_CHANGED');out.set(p,b);}return out;
}
function exactCI(policy=P){
 const gh=endpoint=>json(cp.execFileSync('gh',['api',endpoint],{cwd:P.sourceRoot,windowsHide:true,maxBuffer:4*1024*1024}));const all=gh('repos/melihsnyldzz-ui/melisa-erp-v2/actions/runs?head_sha='+policy.sourceCommit+'&per_page=100').workflow_runs;check(Array.isArray(all),'CI');const result=[];
 for(const event of ['push','pull_request']){const r=all.filter(r=>r.head_sha===policy.sourceCommit&&r.path==='.github/workflows/ci.yml'&&r.event===event).sort((a,b)=>b.id-a.id)[0];check(r&&r.status==='completed'&&r.conclusion==='success','EXACT_CI');const jobs=gh('repos/melihsnyldzz-ui/melisa-erp-v2/actions/runs/'+r.id+'/jobs?filter=latest&per_page=100').jobs;for(const name of ['windows-startup-test','quality-build-test','secret-scan']){const rows=jobs.filter(j=>j.name===name);check(rows.length===1&&rows[0].status==='completed'&&rows[0].conclusion==='success'&&rows[0].steps?.length,'CI_JOB');}result.push({event,id:r.id,head:r.head_sha,conclusion:r.conclusion});}return result;
}
function checkPayload(root,manifest){validRows(manifest.files);for(const r of manifest.files)check(hash(read(path.join(root,r.path)))===r.sha256,'BASE_PAYLOAD_CHANGED');}
function staticRelativeClosure(root,overlays,policy=P){
 const seen=new Set(),queue=[...policy.paths],missing=[];while(queue.length){const p=queue.shift();if(seen.has(p))continue;seen.add(p);const b=overlays.get(p)??read(path.join(root,p)),text=b.toString('utf8');
  for(const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"\r\n]+)['"]/g)){if(!m[1].startsWith('.'))continue;const next=path.posix.normalize(path.posix.join(path.posix.dirname(p),m[1]));check(!next.startsWith('../')&&!path.posix.isAbsolute(next),'IMPORT_OUTSIDE');if(!overlays.has(next)&&!fs.existsSync(path.join(root,next))){missing.push(next);continue;}if(/\.(?:mjs|cjs|js)$/.test(next))queue.push(next);}
 }check(missing.length===0,'IMPORT_MISSING');return {kind:'STATIC_RELATIVE_IMPORT_EXISTENCE',sourceFiles:seen.size,missing:0,evaluated:0};
}
function write(file,b){check(!fs.existsSync(file),'OUTPUT_EXISTS');plain(path.dirname(file));const fd=fs.openSync(file,'wx');try{fs.writeFileSync(fd,b);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function copyPayload(from,to,rows,overlays=new Map()){
 fs.mkdirSync(to);for(const r of rows){const target=path.join(to,r.path);fs.mkdirSync(path.dirname(target),{recursive:true});const b=overlays.get(r.path)??read(path.join(from,r.path));check(hash(b)===r.sha256,'COPY_INPUT_CHANGED');write(target,b);check(hash(read(target))===r.sha256,'COPY_READBACK_CHANGED');}
}
export function prepareBusinessSalePreviewLinkPackages(){return prepareFixedPackages(P,false);}
export function prepareBusinessSaleNativeContextPackages(){return prepareFixedPackages(NATIVE_CONTEXT_PACKAGE,true);}
function prepareFixedPackages(policy,context){
 check(process.platform==='win32'&&path.resolve(fileURLToPath(import.meta.url))===path.join(policy.sourceRoot,'scripts','canonical','prepare-business-sale-preview-link-package.mjs'),'FIXED_SOURCE');
 const apiBytes=read(path.join(policy.baseApi,'release-manifest.json')),webBytes=read(path.join(policy.baseWeb,'release-manifest.json'));check(hash(apiBytes)===policy.baseApiHash&&hash(webBytes)===policy.baseWebHash,'BASE_MANIFEST_CHANGED');
 const a=json(apiBytes),w=json(webBytes),overlays=exactSource(policy),ci=exactCI(policy);for(const out of [policy.api,policy.web]){check(!fs.existsSync(out),'OUTPUT_EXISTS');plain(path.dirname(out));}plain(policy.proof);check(!fs.existsSync(path.join(policy.proof,'preview-package-pair.json'))&&!fs.existsSync(path.join(policy.proof,'package-preparation.json')),'OUTPUT_EXISTS');
 checkPayload(policy.baseApi,a);checkPayload(policy.baseWeb,w);const closure=staticRelativeClosure(policy.baseApi,overlays,policy),compiled=context?compileNativeContextManifests(a,w,overlays):compilePreviewLinkManifests(a,w,overlays);
 check(shaUnchanged(a,compiled.api,compiled.overlayFiles)&&JSON.stringify(w.files)===JSON.stringify(compiled.web.files),'PAYLOAD_SCOPE');
 // All source, manifests, CI and payload inputs have passed before creation.
 copyPayload(policy.baseApi,policy.api,compiled.api.files,overlays);write(path.join(policy.api,'release-manifest.json'),compiled.apiBytes);copyPayload(policy.baseWeb,policy.web,compiled.web.files);write(path.join(policy.web,'release-manifest.json'),compiled.webBytes);
 check(hash(read(path.join(policy.api,'release-manifest.json')))===hash(compiled.apiBytes)&&hash(read(path.join(policy.web,'release-manifest.json')))===hash(compiled.webBytes),'MANIFEST_READBACK');
 write(path.join(policy.proof,'preview-package-pair.json'),compiled.pairBytes);const result={schema:context?'melisa-b6-native-context-package-preparation.v1':'melisa-b6-preview-link-package-preparation.v1',sourceCommit:policy.sourceCommit,apiRoot:policy.api,webRoot:policy.web,apiManifestSha256:hash(compiled.apiBytes),webManifestSha256:hash(compiled.webBytes),pairSha256:hash(compiled.pairBytes),apiFiles:compiled.api.files.length,webFiles:compiled.web.files.length,overlayFiles:compiled.overlayFiles,staticRelativeClosure:closure,hostedCi:ci,installed:false,sqlCalls:0,profileChanges:0,taskChanges:0,serviceCalls:0,sourceEvaluated:0};write(path.join(policy.proof,'package-preparation.json'),bytes(result));return result;
}
function shaUnchanged(before,after,overlays){const allowed=new Set(overlays.map(r=>r.path)),a=new Map(after.files.map(r=>[r.path,r.sha256]));return before.files.every(r=>allowed.has(r.path)||a.get(r.path)===r.sha256)&&after.files.every(r=>allowed.has(r.path)||before.files.some(v=>v.path===r.path));}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){const action=process.argv.slice(2).join('|'),actions={'--prepare':prepareBusinessSalePreviewLinkPackages,'--prepare-native-context':prepareBusinessSaleNativeContextPackages};check(Object.hasOwn(actions,action),'FIXED_ACTION');try{process.stdout.write(JSON.stringify(actions[action]())+'\n');}catch(e){process.stderr.write((/^PREVIEW_LINK_[A-Z0-9_]+$/.test(e.message)?e.message:'PREVIEW_LINK_PREPARATION_FAILED')+'\n');process.exitCode=1;}}
