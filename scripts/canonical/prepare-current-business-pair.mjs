// One passive case over existing metadata/preview producers. Builtins only until
// the exact Git producer closure is checked. No profile read or runtime entry.
import fs from 'node:fs';import path from 'node:path';import cp from 'node:child_process';import crypto from 'node:crypto';import vm from 'node:vm';import {fileURLToPath,pathToFileURL} from 'node:url';
export const APPLICATION_SOURCE='1afcdd7f3c8941bfdfd262e7998093626a14ae6e';
const LEGACY_SOURCE_COMMIT='edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d';
const NORMAL_DATABASE='MELISA_ERP_SIRKET_TEST_20260929_01';
export const PAIR_REPO=String.raw`C:\Sirket\ERP\worktrees\erp-p03-pr53-candidate-20261018`;
export const PAIR_BRANCH='codex/erp-p03-pr53-candidate-20261018';
export const HELPER_FILES=Object.freeze(['scripts/canonical/prepare-customer-master-metadata-package.mjs','scripts/canonical/prepare-business-sale-preview-link-package.mjs']);
export const PAIR_ENTRY='scripts/canonical/prepare-current-business-pair.mjs';
const ROOT=String.raw`C:\Sirket\ERP\releases`,EVIDENCE=String.raw`C:\Sirket\ERP\evidence\ERP-C06-METADATA-ROUTE-RUNTIME-20261102-2254`;
const BASE_API=path.win32.join(ROOT,'CANONICAL-TEST125-BUSINESS5244-B6-PREVIEW-READ-VERIFIED-20261030'),BASE_WEB=path.win32.join(ROOT,'ERP-BUSINESS-WEB-5244-B6-PREVIEW-READ-VERIFIED-20261030');
const BASE_DIGESTS=Object.freeze(['afdb66b5c3450459778630d27bd1ff409ecb80c8ad53058fa048cf3e8e28085c','853025ef7df10eec9a4feff026b767c6c323e5e5259c7bcbc2f7f19186743855']);
const NODE=String.raw`C:\Sirket\ERP\tools\node-v24.19.0\node.exe`,NODE_DIGEST='3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237';
export const WEB_ROOTS=Object.freeze(['apps/sites-workflow/src/workflow/workSuppliers.js','apps/sites-workflow/src/workflow/workTradeModel.mjs','apps/sites-workflow/vite.config.mjs']);
// Exact reachable set for the fixed application commit, not a caller wildcard.
export const WEB_SOURCE_FILES=Object.freeze([
 ...['canonicalBusinessPartyHistoryModel','canonicalBusinessSaleReadModel','goal8DaySqlProof'].map(n=>'apps/api/src/services/'+n+'.mjs'),
 'apps/sites-workflow/business-preview-boundary.mjs','apps/sites-workflow/business-preview-session.mjs',
 ...['businessWorkface.mjs','cleanSyntheticCatalogModel.mjs','currencyAccountPresentation.mjs','customerContactPendingMarker.mjs','isolatedOperationCopyModel.mjs','moneyDisplay.mjs','selectedSaleUiModel.mjs','testAdminSession.mjs','testSuppliersModel.mjs','workBusinessPartyHistory.mjs','workCopyPresentation.mjs','workCustomerContact.mjs','workInbound.css','workInboundModel.mjs','workSupplierPaymentsModel.mjs','workSuppliers.js','workTradeModel.mjs'].map(n=>'apps/sites-workflow/src/workflow/'+n),
 'apps/sites-workflow/vite.config.mjs']);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),encode=x=>Buffer.from(JSON.stringify(x,null,2)+'\n'),lf=b=>b.toString('utf8').replaceAll('\r\n','\n');
const requireThat=(ok,code)=>{if(!ok)throw Error('CURRENT_PAIR_'+code);};
export function pairRoots(producer){requireThat(/^[a-f0-9]{40}$/.test(producer??''),'PRODUCER');const id=APPLICATION_SOURCE.slice(0,12)+'-P'+producer.slice(0,12)+'-20261103';return {api:path.win32.join(ROOT,'CANONICAL-TEST125-CURRENT-PAIR-'+id),web:path.win32.join(ROOT,'ERP-BUSINESS-WEB-5244-CURRENT-PAIR-'+id),receipt:path.win32.join(EVIDENCE,'current-pair-'+producer+'-receipt.json')};}
export function assertPairSource({repo,branch,head,producer,application=APPLICATION_SOURCE,origins}){requireThat(repo===PAIR_REPO&&branch===PAIR_BRANCH&&head===producer&&/^[a-f0-9]{40}$/.test(producer??'')&&application===APPLICATION_SOURCE&&Array.isArray(origins)&&origins.length===2&&origins.every(x=>x==='https://github.com/melihsnyldzz-ui/melisa-erp-v2.git'),'SOURCE_IDENTITY');return true;}
export function assertCurrentApplicationInputsUnchanged(changedFiles){requireThat(Array.isArray(changedFiles)&&changedFiles.length===0,'APPLICATION_CHANGED_SINCE_PIN');return true;}
export function assertPairRows(rows){requireThat(Array.isArray(rows)&&rows.length>0,'ROWS');const seen=new Set();for(const r of rows){requireThat(r&&typeof r.path==='string'&&/^[A-Za-z0-9_.@/-]+$/.test(r.path)&&!r.path.startsWith('/')&&r.path.split('/').every(x=>x&&x!=='.'&&x!=='..')&&!seen.has(r.path.toLowerCase())&&/^[a-f0-9]{64}$/.test(r.sha256??'')&&(r.bytes===undefined||Number.isSafeInteger(r.bytes)&&r.bytes>=0),'ROW');seen.add(r.path.toLowerCase());}return rows;}
// Verify ALL helper bytes before the first import; import exact verified bytes,
// not a mutable filesystem URL. The only relative helper edge is pinned here.
export async function loadVerifiedPairHelpers(records){
 requireThat(records instanceof Map&&records.size===2&&HELPER_FILES.every(p=>records.has(p)),'HELPER_COVERAGE');
 const held=new Map();for(const p of HELPER_FILES){const r=records.get(p);requireThat(Buffer.isBuffer(r?.actual)&&Buffer.isBuffer(r?.git)&&sha(Buffer.from(lf(r.actual)))===sha(r.git),'HELPER_BYTES');held.set(p,Buffer.from(r.git));}
 const url=p=>'data:text/javascript;base64,'+held.get(p).toString('base64');
 const edge="from './prepare-business-sale-preview-link-package.mjs'",metadata=held.get(HELPER_FILES[0]).toString();
 requireThat(metadata.split(edge).length===2,'HELPER_EDGE');
 const rewritten=metadata.replace(edge,'from '+JSON.stringify(url(HELPER_FILES[1])));
 return import('data:text/javascript;base64,'+Buffer.from(rewritten).toString('base64'));
}
export function currentWebClosure({readSource,parse,relativeImports}){
 const map=new Map(),queue=[...WEB_ROOTS],allowed=new Set(WEB_SOURCE_FILES);
 while(queue.length){const file=queue.pop();if(map.has(file))continue;requireThat(allowed.has(file),'WEB_CLOSURE_PATH');const b=readSource(file);requireThat(Buffer.isBuffer(b)&&b.length>0,'WEB_CLOSURE_BYTES');map.set(file,b);
  if(!/\.(?:js|mjs)$/.test(file))continue;
  for(const spec of relativeImports(b.toString(),parse)){requireThat(!spec.includes('\\')&&!spec.includes('?')&&!spec.includes('#'),'WEB_IMPORT');const next=path.posix.normalize(path.posix.join(path.posix.dirname(file),spec));requireThat(allowed.has(next),'WEB_CLOSURE_PATH');queue.push(next);}
 }
 requireThat(map.size===allowed.size&&[...allowed].every(p=>map.has(p)),'WEB_CLOSURE_INCOMPLETE');return map;
}
export function currentBusinessBuildPlan(){return {args:['build','--mode','business'],environment:{NODE_ENV:'production',VITE_ERP_WORKFACE:'ERP-5244-REALDATA-20261027',VITE_API_BASE_URL:'http://127.0.0.1:4144',VITE_VEGA_PRODUCTS_BASE_URL:'http://127.0.0.1:4144',VITE_MELISA_PILOT:'true',VITE_DEMO_MODE:'false',VITE_LOCAL_PASSWORDLESS_LOGIN:'false',VITE_TEST_READ_ONLY:'false'}};}
export function currentBuildEnvironment(input){const e=Object.fromEntries(Object.entries(input).filter(([k])=>/^(SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LANG|LC_ALL)$/i.test(k)));return {...e,Path:path.win32.dirname(NODE)+';C:\\Windows\\System32;C:\\Windows',...currentBusinessBuildPlan().environment};}
// The pinned old WEB predates this one reachable source. Use the same row union
// for the pre-build copy and final manifest so a new input cannot be omitted.
export function currentWebPayloadRows({base,overlays}){
 assertPairRows(base.files);requireThat(overlays instanceof Map&&overlays.size===WEB_SOURCE_FILES.length&&WEB_SOURCE_FILES.every(p=>Buffer.isBuffer(overlays.get(p))),'WEB_EXACT_SOURCES');
 const rows=new Map(base.files.filter(r=>!r.path.startsWith('apps/sites-workflow/dist/')).map(r=>[r.path,structuredClone(r)]));
 for(const p of WEB_SOURCE_FILES){const before=rows.get(p);requireThat(before||p==='apps/sites-workflow/business-preview-boundary.mjs','WEB_BASE_FILE');const b=overlays.get(p);rows.set(p,{...before,path:p,sha256:sha(b),bytes:b.length});}
 return assertPairRows([...rows.values()]);
}
export function compileCurrentBusinessWebManifest({api,apiBytes,base,overlays,dist,producer,apiRoot}){
 const roots=pairRoots(producer);requireThat(apiRoot===roots.api&&Buffer.isBuffer(apiBytes)&&apiBytes.equals(encode(api)),'API_PAIR_BYTES');
 requireThat(api.sourceCommit===LEGACY_SOURCE_COMMIT&&api.packageId==='CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029'&&api.database===NORMAL_DATABASE&&api.currentBusinessPair?.applicationSourceCommit===APPLICATION_SOURCE&&api.currentBusinessPair.producerSourceCommit===producer&&api.currentBusinessPair.masterWriterEnabled===false&&api.customerMasterMetadataOverlay?.sourceCommit===APPLICATION_SOURCE&&api.actualT1===false&&api.externalOperations===false,'API_PAIR_IDENTITY');
 requireThat(base.kind==='ERP_BUSINESS_WORKFACE_WEB_CANDIDATE'&&base.packageId===path.win32.basename(BASE_WEB)&&base.backendRoot===BASE_API&&base.backendManifestSha256===BASE_DIGESTS[0]&&base.sourceCommit==='fe3948c5ea77e7b0eb215cac6b6b0831adb45e8a'&&base.businessWorkfaceId==='ERP-5244-REALDATA-20261027'&&base.apiPort===4144&&base.webPort===5244&&base.database===api.database&&base.actualT1===false&&base.externalOperations===false,'WEB_BASE_IDENTITY');
 assertPairRows(api.files);const rows=new Map(currentWebPayloadRows({base,overlays}).map(r=>[r.path,r])),baseRows=new Map(base.files.map(r=>[r.path,r]));
 const files=WEB_SOURCE_FILES.map(p=>{const next=rows.get(p);return {path:p,beforeSha256:baseRows.get(p)?.sha256??null,sha256:next.sha256,bytes:next.bytes};});
 requireThat(dist instanceof Map&&dist.has('ornek-akis.html')&&dist.size>0,'DIST_REQUIRED');
 const names=new Set();for(const [name,b]of dist){assertPairRows([{path:name,sha256:sha(b),bytes:b.length}]);requireThat(!names.has(name.toLowerCase()),'DIST_ALIAS');names.add(name.toLowerCase());rows.set('apps/sites-workflow/dist/'+name,{path:'apps/sites-workflow/dist/'+name,sha256:sha(b),bytes:b.length});}
 const html=dist.get('ornek-akis.html').toString(),assetRefs=[...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(x=>x[1].slice(1));requireThat(assetRefs.length>0&&assetRefs.every(x=>dist.has(x)),'DIST_ASSET_REFERENCE');
 const js=[...dist].filter(([n])=>n.endsWith('.js')).map(([,b])=>b.toString()).join('\n');requireThat(js.includes('ERP-5244-REALDATA-20261027')&&js.includes('http://127.0.0.1:4144')&&!js.includes('?.VITE_ERP_WORKFACE'),'DIST_BUILD_TARGET');
 // Preserve accepted static non-hash resources only; never resurrect old chunks.
 for(const r of base.files)if(r.path.startsWith('apps/sites-workflow/dist/')&&!r.path.startsWith('apps/sites-workflow/dist/assets/')&&!rows.has(r.path))rows.set(r.path,structuredClone(r));
 const value=structuredClone(base);value.packageId=path.win32.basename(roots.web);value.backendRoot=roots.api;value.backendManifestSha256=sha(apiBytes);value.files=[...rows.values()].sort((a,b)=>a.path.localeCompare(b.path));value.installed=false;
 value.currentBusinessPair={schemaVersion:'melisa-current-business-web-pair.v1',applicationSourceCommit:APPLICATION_SOURCE,producerSourceCommit:producer,legacyBaseSourceCommit:base.sourceCommit,baseManifestSha256:BASE_DIGESTS[1],files,build:currentBusinessBuildPlan(),api:{root:roots.api,manifestSha256:sha(apiBytes),applicationSourceCommit:APPLICATION_SOURCE,legacyBaseSourceCommit:api.sourceCommit},sourcePolicy:'PINNED_BASE_PLUS_EXACT_23_REACHABLE_SOURCE_FILES_AND_BUSINESS_BUILD',masterWriterEnabled:false,actualT1:false,externalOperations:false,installed:false,executionAuthority:false};return value;
}
function plain(file){for(let p=path.resolve(file);;p=path.dirname(p)){requireThat(!fs.lstatSync(p).isSymbolicLink(),'REPARSE');if(path.dirname(p)===p)break;}}
export function readCurrentPairFile(file){plain(file);requireThat(fs.realpathSync.native(file)===path.resolve(file),'PATH_CASE');const a=fs.lstatSync(file);requireThat(a.isFile()&&a.nlink===1,'FILE');const b=fs.readFileSync(file),z=fs.lstatSync(file);requireThat(a.ino===z.ino&&a.mtimeMs===z.mtimeMs&&z.size===b.length&&z.nlink===1,'FILE_DRIFT');return b;}
const read=readCurrentPairFile;
function writeNew(file,b){requireThat(!fs.existsSync(file),'OUTPUT_EXISTS');plain(path.dirname(file));const fd=fs.openSync(file,'wx');try{fs.writeFileSync(fd,b);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function git(args,raw=false){return cp.execFileSync('git',args,{cwd:PAIR_REPO,encoding:raw?undefined:'utf8',windowsHide:true,maxBuffer:16000000});}
function source(p){return git(['show',APPLICATION_SOURCE+':'+p],true);}
function verifyPayload(root,manifest){for(const r of assertPairRows(manifest.files)){const b=read(path.join(root,...r.path.split('/')));requireThat(sha(b)===r.sha256&&(r.bytes===undefined||r.bytes===b.length),'PAYLOAD_DRIFT');}return manifest.files.length;}
function copyPayload(base,root,rows,overlays){fs.mkdirSync(root);for(const r of rows){const file=path.join(root,...r.path.split('/'));fs.mkdirSync(path.dirname(file),{recursive:true});const b=overlays.get(r.path)??read(path.join(base,...r.path.split('/')));requireThat(sha(b)===r.sha256,'COPY_HASH');writeNew(file,b);}}
export async function prepareCurrentBusinessPair(producer){
 requireThat(process.platform==='win32'&&path.resolve(fileURLToPath(import.meta.url))===path.join(PAIR_REPO,...PAIR_ENTRY.split('/')),'ENTRY_PATH');
 requireThat(sha(read(NODE))===NODE_DIGEST&&path.resolve(process.execPath)===path.resolve(NODE),'NODE');
 assertPairSource({repo:git(['rev-parse','--show-toplevel']).trim().replaceAll('/','\\'),branch:git(['branch','--show-current']).trim(),head:git(['rev-parse','HEAD']).trim(),producer,origins:[git(['remote','get-url','origin']).trim(),git(['remote','get-url','--push','origin']).trim()]});
 requireThat(Buffer.from(lf(read(path.join(PAIR_REPO,...PAIR_ENTRY.split('/'))))).equals(git(['show',producer+':'+PAIR_ENTRY],true)),'ENTRY_BYTES');git(['merge-base','--is-ancestor',APPLICATION_SOURCE,producer]);
 // Producer CI runs these exact application inputs. Ancestor-only proof is insufficient.
 assertCurrentApplicationInputsUnchanged(git(['diff','--name-only',APPLICATION_SOURCE,producer,'--','apps/api','apps/sites-workflow','packages']).trim().split(/\r?\n/).filter(Boolean));
 const records=new Map(HELPER_FILES.map(p=>[p,{actual:read(path.join(PAIR_REPO,...p.split('/'))),git:git(['show',producer+':'+p],true)}]));const helpers=await loadVerifiedPairHelpers(records);
 const roots=pairRoots(producer);for(const p of Object.values(roots)){requireThat(!fs.existsSync(p),'OUTPUT_EXISTS');plain(path.dirname(p));}
 const gh=p=>JSON.parse(cp.execFileSync('gh',['api',p],{cwd:PAIR_REPO,windowsHide:true,maxBuffer:16000000}));
 const pr=gh('repos/melihsnyldzz-ui/melisa-erp-v2/pulls/54'),runs=gh('repos/melihsnyldzz-ui/melisa-erp-v2/actions/runs?head_sha='+producer+'&per_page=100').workflow_runs,jobs=new Map();for(const event of ['push','pull_request']){const r=runs.filter(r=>r.head_sha===producer&&r.path==='.github/workflows/ci.yml'&&r.event===event).sort((a,b)=>b.id-a.id)[0];if(r)jobs.set(r.id,gh('repos/melihsnyldzz-ui/melisa-erp-v2/actions/runs/'+r.id+'/attempts/1/jobs?per_page=100').jobs);}const ci=helpers.validateCustomerMetadataCI(producer,pr,runs,jobs);
 const baseBytes=[BASE_API,BASE_WEB].map((root,i)=>{const b=read(path.join(root,'release-manifest.json'));requireThat(sha(b)===BASE_DIGESTS[i],'BASE_DIGEST');return b;});const [apiBase,webBase]=baseBytes.map(b=>JSON.parse(b));verifyPayload(BASE_API,apiBase);verifyPayload(BASE_WEB,webBase);
 const webIndex=new Map(webBase.files.map(r=>[r.path,r])),apiIndex=new Map(apiBase.files.map(r=>[r.path,r]));
 const vendor=p=>{const r=webIndex.get(p);requireThat(r,'TOOL_ROW');const b=read(path.join(BASE_WEB,...p.split('/')));requireThat(sha(b)===r.sha256,'TOOL_DIGEST');return b;};
 const parserPath='apps/sites-workflow/node_modules/@babel/parser/lib/index.js',parserBytes=vendor(parserPath),exports={};vm.runInNewContext(parserBytes.toString(),{exports,module:{exports}},{timeout:5000,contextCodeGeneration:{strings:false,wasm:false}});const parse=exports.parse;requireThat(typeof parse==='function','PARSER');
 // Read imports from AST using the already verified production helper.
 const preview=await import('data:text/javascript;base64,'+records.get(HELPER_FILES[1]).git.toString('base64'));
 const readBase=p=>{const r=apiIndex.get(p);requireThat(r,'API_DEPENDENCY');const b=read(path.join(BASE_API,...p.split('/')));requireThat(sha(b)===r.sha256,'API_DEPENDENCY_DRIFT');return b;};
 const closure=helpers.customerMetadataClosure([helpers.CUSTOMER_METADATA_ENTRY,...helpers.CURRENT_PAIR_API_FILES],{readSource:source,readBase,basePaths:new Set(apiIndex.keys()),parse});
 const client=helpers.customerMetadataClosure([helpers.CUSTOMER_METADATA_CLIENT],{readSource:source,basePaths:new Set(),parse,client:true});
 const tool='apps/sites-workflow/node_modules/esbuild/lib/main.js',binary='apps/sites-workflow/node_modules/@esbuild/win32-x64/esbuild.exe';vendor(tool);vendor(binary);
 const builtClient=cp.execFileSync(NODE,['-e',helpers.customerMetadataBuildProgram()],{cwd:BASE_WEB,env:{...currentBuildEnvironment(process.env),ESBUILD_BINARY_PATH:path.join(BASE_WEB,...binary.split('/'))},input:JSON.stringify({tool:path.join(BASE_WEB,...tool.split('/')),entry:helpers.CUSTOMER_METADATA_CLIENT,sources:[...client.source].map(([p,b])=>[p,b.toString()])}),windowsHide:true,timeout:60000,maxBuffer:2000000});
 const metadata=new Map(closure.source),fixes=new Map(helpers.CURRENT_PAIR_API_FILES.map(p=>{const b=metadata.get(p);requireThat(b,'API_FIX_CLOSURE');metadata.delete(p);return[p,b];}));metadata.set(helpers.CUSTOMER_METADATA_ASSET,builtClient);
 const api=helpers.buildCurrentBusinessApiManifest(apiBase,metadata,fixes,{sourceCommit:APPLICATION_SOURCE,producerSourceCommit:producer,baseEntry:readBase(helpers.CUSTOMER_METADATA_ENTRY)}),apiBytes=encode(api),apiOverlay=new Map([...metadata,...fixes]);
 const webSource=currentWebClosure({readSource:source,parse,relativeImports:preview.relativeModuleSpecifiers});
 for(const p of helpers.CURRENT_PAIR_API_FILES.slice(1))requireThat(webSource.get(p)?.equals(fixes.get(p)),'SHARED_MODEL_DRIFT');
 const inputTotal=[...apiBase.files,...webBase.files].reduce((n,r)=>n+(r.bytes??fs.statSync(path.join(apiBase.files.includes(r)?BASE_API:BASE_WEB,...r.path.split('/'))).size),0);const stat=fs.statfsSync(ROOT);requireThat(BigInt(stat.bavail)*BigInt(stat.bsize)>BigInt(inputTotal)+536870912n,'DISK_SPACE');
 requireThat(git(['rev-parse','HEAD']).trim()===producer,'HEAD_DRIFT');
 // Creation starts only after identities, CI, input closure, tools and disk checks.
 copyPayload(BASE_API,roots.api,api.files,apiOverlay);writeNew(path.join(roots.api,'release-manifest.json'),apiBytes);verifyPayload(roots.api,api);
 const preRows=currentWebPayloadRows({base:webBase,overlays:webSource});copyPayload(BASE_WEB,roots.web,preRows,webSource);
 const plan=currentBusinessBuildPlan(),work=path.join(roots.web,'apps','sites-workflow');const build=cp.spawnSync(NODE,[path.join(work,'node_modules','vite','bin','vite.js'),...plan.args],{cwd:work,env:currentBuildEnvironment(process.env),windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:16000000});
 writeNew(path.join(roots.web,'business-build.stdout.log'),Buffer.from(build.stdout??''));writeNew(path.join(roots.web,'business-build.stderr.log'),Buffer.from(build.stderr??''));requireThat(!build.error&&build.status===0,'BUILD_FAILED');
 const dist=new Map(),walk=(dir,relative='')=>{plain(dir);for(const d of fs.readdirSync(dir,{withFileTypes:true})){requireThat(!d.isSymbolicLink(),'BUILD_REPARSE');const name=relative+d.name;if(d.isDirectory())walk(path.join(dir,d.name),name+'/');else dist.set(name,read(path.join(dir,d.name)));}};walk(path.join(work,'dist'));
 const web=compileCurrentBusinessWebManifest({api,apiBytes,base:webBase,overlays:webSource,dist,producer,apiRoot:roots.api});
 for(const r of web.files){const target=path.join(roots.web,...r.path.split('/'));if(!fs.existsSync(target)){requireThat(r.path.startsWith('apps/sites-workflow/dist/')&&!r.path.startsWith('apps/sites-workflow/dist/assets/'),'OUTPUT_MISSING');fs.mkdirSync(path.dirname(target),{recursive:true});writeNew(target,read(path.join(BASE_WEB,...r.path.split('/'))));}}
 const webBytes=encode(web);writeNew(path.join(roots.web,'release-manifest.json'),webBytes);verifyPayload(roots.web,web);
 verifyPayload(BASE_API,apiBase);verifyPayload(BASE_WEB,webBase);requireThat(read(path.join(roots.api,'release-manifest.json')).equals(apiBytes)&&read(path.join(roots.web,'release-manifest.json')).equals(webBytes),'MANIFEST_READBACK');
 const receipt={schemaVersion:'melisa-current-business-pair-preparation.v1',applicationSourceCommit:APPLICATION_SOURCE,producerSourceCommit:producer,applicationInputsUnchangedThroughProducer:true,legacyApiSourceCommit:api.sourceCommit,legacyWebSourceCommit:web.sourceCommit,apiRoot:roots.api,webRoot:roots.web,apiManifestSha256:sha(apiBytes),webManifestSha256:sha(webBytes),apiFiles:api.files.length,webFiles:web.files.length,ci,helperClosure:HELPER_FILES.map(p=>({path:p,gitSha256:sha(records.get(p).git)})),apiSourceClosure:closure.sourceFiles,clientSourceClosure:client.sourceFiles,webSourceClosure:webSource.size,apiFixFiles:api.currentBusinessPair.files,webSourceFiles:web.currentBusinessPair.files,distFiles:dist.size,buildExit:build.status,buildMode:'business',dependencyInstallPerformed:false,masterWriterEnabled:false,metadataStatus:'UNKNOWN_UNTIL_NORMAL_POOL_READ',installed:false,executionAuthority:false,actualT1:false,externalOperations:false,appStarts:0,sqlQueries:0,taskChanges:0,configChanges:0,serviceChanges:0};writeNew(roots.receipt,encode(receipt));return receipt;
}
if(import.meta.url.startsWith('file:')&&process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){requireThat(process.argv.length===5&&process.argv[2]==='--prepare'&&process.argv[3]==='--producer','CLI');console.log(JSON.stringify(await prepareCurrentBusinessPair(process.argv[4])));}
