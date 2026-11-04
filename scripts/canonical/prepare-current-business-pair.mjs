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

// Source-only C06 successor. Any later application change requires a new pin
// and exact CI; this source pin does not grant package or execution authority.
export const C06_SUCCESSOR_SOURCE_PIN='fce4d7aa21d2828c32576a8e5a51adb84fb000fe';
export const C06_D246_SOURCE_PIN='d2466250fabc1a319f7ff0592ab39bb6903bebfb';
export const C06_C2CE_SOURCE_PIN='c2ce84dffcc843c659d6f1fd866e056d7cca8c1b';
export const C06_EC80_SOURCE_PIN='ec80a13b220bc009acfa94849f8a64b3f4bb283f';
export function assertC06SuccessorPinned(application){requireThat([C06_SUCCESSOR_SOURCE_PIN,C06_D246_SOURCE_PIN,C06_C2CE_SOURCE_PIN,C06_EC80_SOURCE_PIN].includes(application),'C06_SOURCE_PIN_UNSET_OR_MISMATCH');return true;}
export const C06_WEB_ROOTS=Object.freeze([...WEB_ROOTS,'apps/sites-workflow/src/workflow/workCustomers.js','apps/sites-workflow/src/workflow/workingCatalogSession.mjs']);
export const C06_WEB_SOURCE_FILES=Object.freeze([
 ...WEB_SOURCE_FILES,
 ...['businessSupplierSelection.mjs','protectedDeviceSession.mjs','testCustomersModel.mjs','workCustomerMaster.mjs','workCustomers.js','workOpenAccountPresentation.mjs','workSales.css','workingCatalogSession.mjs'].map(n=>'apps/sites-workflow/src/workflow/'+n)
]);
export const C06_D246_WEB_ROOTS=Object.freeze([...C06_WEB_ROOTS,'apps/sites-workflow/src/workflow/workSales.js']);
export const C06_D246_WEB_SOURCE_FILES=Object.freeze([...C06_WEB_SOURCE_FILES,
 'apps/api/src/services/currentProductCatalogContext.mjs','apps/api/src/services/finalCatalogContext.mjs',
 ...['currentProductCatalogModel.mjs','savedBusinessSalesBasket.mjs','selectedSourceCollectionHandoff.mjs','stockProductsModel.mjs','workBusinessSalesBasketModel.mjs','workBusinessSalesRead.mjs','workCatalogModel.mjs','workCatalogPhoto.mjs','workSales.js','workTaskHandoff.css','workTaskHandoff.mjs'].map(n=>'apps/sites-workflow/src/workflow/'+n)
]);
export const C06_C2CE_WEB_ROOTS=Object.freeze([...C06_D246_WEB_ROOTS,'apps/sites-workflow/src/workflow/workReceiving.js']);
export const C06_C2CE_WEB_SOURCE_FILES=Object.freeze([...C06_D246_WEB_SOURCE_FILES,...['workBusinessReceivingRead.mjs','workInboundJournal.mjs','workReceiving.js','workReceivingHandoff.mjs','workReceivingRecovery.mjs'].map(n=>'apps/sites-workflow/src/workflow/'+n)]);
export const C06_EC80_WEB_ROOTS=Object.freeze([...C06_C2CE_WEB_ROOTS,'apps/sites-workflow/src/workflow/workCollections.js']);
export const C06_EC80_WEB_SOURCE_FILES=Object.freeze([...C06_C2CE_WEB_SOURCE_FILES,...['workCollections.js','workFinanceMovements.mjs'].map(n=>'apps/sites-workflow/src/workflow/'+n)]);
export function currentC06WebClosure({readSource,parse,relativeImports,sourcePin=C06_SUCCESSOR_SOURCE_PIN}){
 assertC06SuccessorPinned(sourcePin);const sources=sourcePin===C06_EC80_SOURCE_PIN?C06_EC80_WEB_SOURCE_FILES:sourcePin===C06_C2CE_SOURCE_PIN?C06_C2CE_WEB_SOURCE_FILES:sourcePin===C06_D246_SOURCE_PIN?C06_D246_WEB_SOURCE_FILES:C06_WEB_SOURCE_FILES,roots=sourcePin===C06_EC80_SOURCE_PIN?C06_EC80_WEB_ROOTS:sourcePin===C06_C2CE_SOURCE_PIN?C06_C2CE_WEB_ROOTS:sourcePin===C06_D246_SOURCE_PIN?C06_D246_WEB_ROOTS:C06_WEB_ROOTS;
 const map=new Map(),queue=[...roots],allowed=new Set(sources);
 requireThat(allowed.size===sources.length,'C06_WEB_DUPLICATE');
 while(queue.length){const file=queue.pop();if(map.has(file))continue;requireThat(allowed.has(file),'C06_WEB_CLOSURE_PATH');const b=readSource(file);requireThat(Buffer.isBuffer(b)&&b.length>0,'C06_WEB_CLOSURE_BYTES');map.set(file,b);
  if(!/\.(?:js|mjs)$/.test(file))continue;
  for(const spec of relativeImports(b.toString(),parse)){requireThat(!spec.includes('\\')&&!spec.includes('?')&&!spec.includes('#'),'C06_WEB_IMPORT');const next=path.posix.normalize(path.posix.join(path.posix.dirname(file),spec));requireThat(allowed.has(next),'C06_WEB_CLOSURE_PATH');queue.push(next);}
 }
 requireThat(map.size===allowed.size&&[...allowed].every(p=>map.has(p)),'C06_WEB_CLOSURE_INCOMPLETE');return map;
}
// Old WEB UI may be retained only after a separately proven compatible API and
// exact transport protocol pair. A prior manifest is never relabeled here.
export function assertC06RollbackCompatibility(candidate,previous){
 requireThat(candidate?.backend&&previous?.backend&&candidate?.protocol&&previous?.protocol&&JSON.stringify(candidate.backend)===JSON.stringify(previous.backend)&&JSON.stringify(candidate.protocol)===JSON.stringify(previous.protocol),'C06_ROLLBACK_BACKEND_OR_PROTOCOL_CHANGED');return true;
}


// The accepted P7c6 pair is used only as a verified before-image. Existing
// release bytes are read-only and never relabeled or overwritten.
export const C06_BASE=Object.freeze({api:path.win32.join(ROOT,'CANONICAL-TEST125-CURRENT-PAIR-1afcdd7f3c89-P7c6dcc727498-20261103'),web:path.win32.join(ROOT,'ERP-BUSINESS-WEB-5244-CURRENT-PAIR-1afcdd7f3c89-P7c6dcc727498-20261103'),apiSha256:'342fa6b6ac7448a8ac515cbd118638b857d44c56fc621b74ac0070dd209c0a5f',webSha256:'fbedc4da026b4ac257440ddcd54166b569a623c067d7c5a5c712fa6af5d99ab6'});
export const C06_API_SOURCE_FILES=Object.freeze([
 'apps/api/canonical-test-env.mjs','apps/api/start-canonical-test.mjs','apps/api/src/services/canonicalTestRoutePolicy.mjs','apps/api/src/services/workTradeStore.mjs',
 ...['customerMasterMetadataBootstrap','customerMasterCanonicalSql','customerMasterCanonicalRuntime','customerMasterMetadataSql','customerMasterSqlStore'].map(n=>'apps/api/src/services/'+n+'.mjs'),
 'apps/api/src/routes/customerMasterCanonicalRoutes.mjs','apps/api/src/controllers/customerMasterController.mjs'
]);
export const C06_WEB_RUNTIME_FILES=Object.freeze(['apps/sites-workflow/business-web-gateway.mjs','apps/sites-workflow/business-web-release.mjs','apps/sites-workflow/business-preview-boundary.mjs','apps/sites-workflow/business-preview-session.mjs','apps/sites-workflow/src/workflow/businessWorkface.mjs','apps/api/src/services/canonicalBusinessSaleReadModel.mjs','apps/api/src/services/canonicalBusinessPartyHistoryModel.mjs','apps/sites-workflow/business-web-backend-proof.ps1']);
// These source witnesses are pinned for the sales dependency audit only. They
// are not executed, compiled, packaged as a SQL change, or installed here.
export const C06_SALE_UNAPPLIED_SQL_SOURCE_FILES=Object.freeze(['scripts/canonical/canonical-business-sale-owner-sql.mjs','scripts/canonical/canonical-business-sale-effects-sql.mjs','scripts/canonical/canonical-business-sale-admission-sql.mjs','apps/api/src/services/workTradeSqlProof.mjs']);
export const C06_GIT_FILES=Object.freeze([...new Set([...C06_API_SOURCE_FILES,...C06_WEB_SOURCE_FILES,...C06_WEB_RUNTIME_FILES,...C06_SALE_UNAPPLIED_SQL_SOURCE_FILES])].sort());
export const C06_D246_GIT_FILES=Object.freeze([...new Set([...C06_API_SOURCE_FILES,...C06_D246_WEB_SOURCE_FILES,...C06_WEB_RUNTIME_FILES,...C06_SALE_UNAPPLIED_SQL_SOURCE_FILES])].sort());
export const C06_C2CE_GIT_FILES=Object.freeze([...new Set([...C06_API_SOURCE_FILES,...C06_C2CE_WEB_SOURCE_FILES,...C06_WEB_RUNTIME_FILES,...C06_SALE_UNAPPLIED_SQL_SOURCE_FILES])].sort());
export const C06_EC80_GIT_FILES=Object.freeze([...new Set([...C06_API_SOURCE_FILES,...C06_EC80_WEB_SOURCE_FILES,...C06_WEB_RUNTIME_FILES,...C06_SALE_UNAPPLIED_SQL_SOURCE_FILES])].sort());
export function assertC06GitBlobClosure({paths,gitBlobs,workingBytes,sourcePin=C06_SUCCESSOR_SOURCE_PIN}){
 assertC06SuccessorPinned(sourcePin);const files=sourcePin===C06_EC80_SOURCE_PIN?C06_EC80_GIT_FILES:sourcePin===C06_C2CE_SOURCE_PIN?C06_C2CE_GIT_FILES:sourcePin===C06_D246_SOURCE_PIN?C06_D246_GIT_FILES:C06_GIT_FILES;
 requireThat(Array.isArray(paths)&&new Set(paths).size===paths.length&&paths.length===files.length&&files.every(p=>paths.includes(p))&&gitBlobs instanceof Map&&workingBytes instanceof Map&&gitBlobs.size===paths.length&&workingBytes.size===paths.length,'C06_GIT_CLOSURE');
 for(const p of files){const committed=gitBlobs.get(p),actual=workingBytes.get(p);requireThat(Buffer.isBuffer(committed)&&committed.length>0&&Buffer.isBuffer(actual)&&Buffer.from(lf(actual)).equals(committed),'C06_GIT_BLOB_DRIFT');}
 return true;
}
export const C06_INSTALLATION_CHECKS=Object.freeze({nativeSqlApi:'UNVERIFIED',customerSchema:'UNVERIFIED',normalActorPermissions:'UNVERIFIED',dataProtection:'UNVERIFIED'});
export const C06_WEB_PAYLOAD_FILES=Object.freeze([...new Set([...C06_WEB_SOURCE_FILES,...C06_WEB_RUNTIME_FILES])]);
export const C06_D246_WEB_PAYLOAD_FILES=Object.freeze([...new Set([...C06_D246_WEB_SOURCE_FILES,...C06_WEB_RUNTIME_FILES])]);
export const C06_C2CE_WEB_PAYLOAD_FILES=Object.freeze([...new Set([...C06_C2CE_WEB_SOURCE_FILES,...C06_WEB_RUNTIME_FILES])]);
export const C06_EC80_WEB_PAYLOAD_FILES=Object.freeze([...new Set([...C06_EC80_WEB_SOURCE_FILES,...C06_WEB_RUNTIME_FILES])]);
export function currentC06WebPayloadRows({base,overlays,sourcePin=C06_SUCCESSOR_SOURCE_PIN}){
 assertC06SuccessorPinned(sourcePin);const files=sourcePin===C06_EC80_SOURCE_PIN?C06_EC80_WEB_PAYLOAD_FILES:sourcePin===C06_C2CE_SOURCE_PIN?C06_C2CE_WEB_PAYLOAD_FILES:sourcePin===C06_D246_SOURCE_PIN?C06_D246_WEB_PAYLOAD_FILES:C06_WEB_PAYLOAD_FILES;
 assertPairRows(base.files);requireThat(overlays instanceof Map&&overlays.size===files.length&&files.every(p=>Buffer.isBuffer(overlays.get(p))&&overlays.get(p).length>0),'C06_WEB_EXACT_SOURCES');
 const rows=new Map(base.files.filter(r=>!r.path.startsWith('apps/sites-workflow/dist/')).map(r=>[r.path,structuredClone(r)]));
 const additions=new Set(['apps/sites-workflow/src/workflow/workCustomerMaster.mjs','apps/sites-workflow/business-web-gateway.mjs','apps/sites-workflow/business-web-release.mjs','apps/sites-workflow/business-web-backend-proof.ps1',...(sourcePin!==C06_SUCCESSOR_SOURCE_PIN?['apps/sites-workflow/src/workflow/savedBusinessSalesBasket.mjs']:[])]);
 for(const p of files){const before=rows.get(p);requireThat(before||additions.has(p),'C06_WEB_BASE_FILE');const b=overlays.get(p);rows.set(p,{...before,path:p,sha256:sha(b),bytes:b.length});}
 return assertPairRows([...rows.values()]);
}
export function c06CandidateRoots(producer,sourcePin=C06_SUCCESSOR_SOURCE_PIN){assertC06SuccessorPinned(sourcePin);requireThat(/^[a-f0-9]{40}$/.test(producer??''),'C06_PRODUCER');const suffix=sourcePin.slice(0,12)+'-P'+producer.slice(0,12)+'-PASSIVE';const receipt=sourcePin===C06_SUCCESSOR_SOURCE_PIN?'c06-passive-'+producer+'-receipt.json':'c06-passive-'+sourcePin.slice(0,12)+'-'+producer+'-receipt.json';return {api:path.win32.join(ROOT,'CANONICAL-TEST125-C06-'+suffix),web:path.win32.join(ROOT,'ERP-BUSINESS-WEB-5244-C06-'+suffix),receipt:path.win32.join(EVIDENCE,receipt)};}
export function compileC06WebManifest({api,apiBytes,apiRoot,base,overlays,dist,producer,sourcePin=C06_SUCCESSOR_SOURCE_PIN}){
 const roots=c06CandidateRoots(producer,sourcePin);requireThat(apiRoot===roots.api&&Buffer.isBuffer(apiBytes)&&apiBytes.equals(encode(api))&&api.customerMasterSuccessor?.sourceCommit===sourcePin&&api.customerMasterSuccessor.producerCommit===producer&&api.customerMasterSuccessor.executionAuthority===false&&api.customerMasterSuccessor.installed===false,'C06_API_PAIR_BYTES');
 requireThat(base?.packageId===path.win32.basename(C06_BASE.web)&&base.database==='MELISA_ERP_SIRKET_TEST_20260929_01'&&base.backendManifestSha256===C06_BASE.apiSha256&&base.apiPort===4144&&base.webPort===5244&&base.actualT1===false&&base.externalOperations===false,'C06_WEB_BASE_IDENTITY');
 const files=sourcePin===C06_EC80_SOURCE_PIN?C06_EC80_WEB_PAYLOAD_FILES:sourcePin===C06_C2CE_SOURCE_PIN?C06_C2CE_WEB_PAYLOAD_FILES:sourcePin===C06_D246_SOURCE_PIN?C06_D246_WEB_PAYLOAD_FILES:C06_WEB_PAYLOAD_FILES,rows=new Map(currentC06WebPayloadRows({base,overlays,sourcePin}).map(r=>[r.path,r])),old=new Map(base.files.map(r=>[r.path,r]));requireThat(dist instanceof Map&&dist.has('ornek-akis.html')&&dist.size>0,'C06_DIST_REQUIRED');
 const seen=new Set();for(const [name,b] of dist){requireThat(Buffer.isBuffer(b)&&b.length>0,'C06_DIST_BYTES');assertPairRows([{path:name,sha256:sha(b),bytes:b.length}]);requireThat(!seen.has(name.toLowerCase()),'C06_DIST_ALIAS');seen.add(name.toLowerCase());rows.set('apps/sites-workflow/dist/'+name,{path:'apps/sites-workflow/dist/'+name,sha256:sha(b),bytes:b.length});}
 const html=dist.get('ornek-akis.html').toString(),assets=[...html.matchAll(/(?:src|href)=[\"'](\/assets\/[^\"']+)[\"']/g)].map(x=>x[1].slice(1));requireThat(assets.length>0&&assets.every(x=>dist.has(x)),'C06_DIST_ASSET_REFERENCE');
 const js=[...dist].filter(([name])=>name.endsWith('.js')).map(([,b])=>b.toString()).join('\n');requireThat(js.includes('ERP-5244-REALDATA-20261027')&&js.includes('http://127.0.0.1:4144')&&!js.includes('?.VITE_ERP_WORKFACE'),'C06_DIST_BUILD_TARGET');
 for(const r of base.files)if(r.path.startsWith('apps/sites-workflow/dist/')&&!r.path.startsWith('apps/sites-workflow/dist/assets/')&&!rows.has(r.path))rows.set(r.path,structuredClone(r));
 const result=structuredClone(base);result.packageId=path.win32.basename(roots.web);result.backendRoot=roots.api;result.backendManifestSha256=sha(apiBytes);result.files=[...rows.values()].sort((a,b)=>a.path.localeCompare(b.path));result.installed=false;
 result.customerMasterSuccessor={schemaVersion:'melisa-c06-web-source-overlay.v1',sourceCommit:sourcePin,producerCommit:producer,baseManifestSha256:C06_BASE.webSha256,backendManifestSha256:sha(apiBytes),files:files.map(p=>({path:p,beforeSha256:old.get(p)?.sha256??null,sha256:rows.get(p).sha256,bytes:rows.get(p).bytes})),build:currentBusinessBuildPlan(),rollbackStatus:'UNVERIFIED',installationReadiness:'NOT_EVALUATED',installationChecks:C06_INSTALLATION_CHECKS,installed:false,runtimeVerified:false,executionAuthority:false,actualT1:false,externalOperations:false};return result;
}
// Validate the final serialized pair independently of the builders and compare
// every overlay SHA with the committed Git witness and accepted before image.
export function verifyC06PassiveManifests({apiBytes,webBytes,apiBase,webBase,producer,gitBlobs,dist,sourcePin=C06_SUCCESSOR_SOURCE_PIN}){
 requireThat(Buffer.isBuffer(apiBytes)&&Buffer.isBuffer(webBytes)&&gitBlobs instanceof Map&&dist instanceof Map&&dist.has('ornek-akis.html'),'C06_READBACK_INPUT');const api=JSON.parse(apiBytes),web=JSON.parse(webBytes),roots=c06CandidateRoots(producer,sourcePin),a=api.customerMasterSuccessor,w=web.customerMasterSuccessor;
 requireThat(a?.sourceCommit===sourcePin&&w?.sourceCommit===sourcePin&&a.producerCommit===producer&&w.producerCommit===producer&&a.baseManifestSha256===C06_BASE.apiSha256&&w.baseManifestSha256===C06_BASE.webSha256&&a.executionAuthority===false&&w.executionAuthority===false&&a.installed===false&&w.installed===false&&w.runtimeVerified===false&&a.actualT1===false&&w.actualT1===false&&a.externalOperations===false&&w.externalOperations===false&&w.rollbackStatus==='UNVERIFIED'&&w.installationReadiness==='NOT_EVALUATED'&&JSON.stringify(w.installationChecks)===JSON.stringify(C06_INSTALLATION_CHECKS),'C06_READBACK_FLAGS');
 requireThat(a.salesSqlCompatibility?.state==='NOT_APPLIED_NOT_VERIFIED'&&a.salesSqlCompatibility.sqlExecuted===false&&a.salesSqlCompatibility.installationBlocked===true&&web.backendRoot===roots.api&&web.backendManifestSha256===sha(apiBytes)&&w.backendManifestSha256===sha(apiBytes)&&web.packageId===path.win32.basename(roots.web),'C06_READBACK_BINDING');
 const webFiles=sourcePin===C06_EC80_SOURCE_PIN?C06_EC80_WEB_PAYLOAD_FILES:sourcePin===C06_C2CE_SOURCE_PIN?C06_C2CE_WEB_PAYLOAD_FILES:sourcePin===C06_D246_SOURCE_PIN?C06_D246_WEB_PAYLOAD_FILES:C06_WEB_PAYLOAD_FILES;
 for(const [next,base,paths,overlay] of [[api,apiBase,C06_API_SOURCE_FILES,a.files],[web,webBase,webFiles,w.files]]){
  const nextRows=new Map(assertPairRows(next.files).map(r=>[r.path,r])),baseRows=new Map(assertPairRows(base.files).map(r=>[r.path,r]));requireThat(Array.isArray(overlay)&&overlay.length===paths.length&&new Set(overlay.map(r=>r.path)).size===paths.length&&paths.every(p=>overlay.some(r=>r.path===p)),'C06_READBACK_COVERAGE');
  for(const p of paths){const row=overlay.find(r=>r.path===p),content=gitBlobs.get(p),old=baseRows.get(p);requireThat(Buffer.isBuffer(content)&&row.sha256===sha(content)&&row.sha256===nextRows.get(p)?.sha256&&row.bytes===content.length&&row.beforeSha256===(old?.sha256??null),'C06_READBACK_SOURCE');}
  for(const r of base.files)if(!paths.includes(r.path)&&(next===api||!r.path.startsWith('apps/sites-workflow/dist/')))requireThat(nextRows.get(r.path)?.sha256===r.sha256,'C06_READBACK_BASE_PRESERVATION');
  const expected=new Set([...baseRows.keys()].filter(p=>next===api||!p.startsWith('apps/sites-workflow/dist/')));for(const p of paths)expected.add(p);
  if(next===web){for(const [name,b] of dist){requireThat(Buffer.isBuffer(b)&&b.length>0,'C06_READBACK_DIST_BYTES');const p='apps/sites-workflow/dist/'+name;expected.add(p);requireThat(nextRows.get(p)?.sha256===sha(b)&&nextRows.get(p)?.bytes===b.length,'C06_READBACK_DIST_CONTENT');}for(const [p,old] of baseRows)if(p.startsWith('apps/sites-workflow/dist/')&&!p.startsWith('apps/sites-workflow/dist/assets/')){expected.add(p);if(!dist.has(p.slice('apps/sites-workflow/dist/'.length)))requireThat(nextRows.get(p)?.sha256===old.sha256&&(old.bytes===undefined||nextRows.get(p)?.bytes===old.bytes),'C06_READBACK_RETAINED_STATIC');}}
  requireThat(nextRows.size===expected.size&&[...expected].every(p=>nextRows.has(p)),'C06_READBACK_EXACT_FILE_SET');
 }
 const sql=a.salesSqlCompatibility.sourceWitnesses;requireThat(Array.isArray(sql)&&sql.length===C06_SALE_UNAPPLIED_SQL_SOURCE_FILES.length&&C06_SALE_UNAPPLIED_SQL_SOURCE_FILES.every(p=>sql.some(r=>r.path===p&&Buffer.isBuffer(gitBlobs.get(p))&&r.sha256===sha(gitBlobs.get(p)))),'C06_READBACK_SQL_SOURCE');return true;
}
// Real producer entry's supported C06 path. No output directory is touched
// until all source, CI and before-image checks have passed. Passive output
// has no installation authority; rollback remains separately unverified.
export async function prepareC06BusinessPair(producer,sourcePin=C06_SUCCESSOR_SOURCE_PIN){
 assertC06SuccessorPinned(sourcePin);
 // d246 has no proven held output-parent identity yet. Its offline manifests
 // remain testable, but real artifact creation must stop before any I/O.
 requireThat(sourcePin!==C06_D246_SOURCE_PIN,'C06_D246_OUTPUT_PARENT_UNVERIFIED');
 requireThat(sourcePin!==C06_C2CE_SOURCE_PIN,'C06_C2CE_OUTPUT_PARENT_UNVERIFIED');
 requireThat(sourcePin!==C06_EC80_SOURCE_PIN,'C06_EC80_OUTPUT_PARENT_UNVERIFIED');
 requireThat(process.platform==='win32'&&path.resolve(fileURLToPath(import.meta.url))===path.join(PAIR_REPO,...PAIR_ENTRY.split('/')),'C06_ENTRY_PATH');
 requireThat(sha(read(NODE))===NODE_DIGEST&&path.resolve(process.execPath)===path.resolve(NODE),'C06_NODE');
 assertPairSource({repo:git(['rev-parse','--show-toplevel']).trim().replaceAll('/','\\'),branch:git(['branch','--show-current']).trim(),head:git(['rev-parse','HEAD']).trim(),producer,origins:[git(['remote','get-url','origin']).trim(),git(['remote','get-url','--push','origin']).trim()]});
 requireThat(Buffer.from(lf(read(path.join(PAIR_REPO,...PAIR_ENTRY.split('/'))))).equals(git(['show',producer+':'+PAIR_ENTRY],true)),'C06_ENTRY_BYTES');
 git(['merge-base','--is-ancestor',sourcePin,producer]);
 assertCurrentApplicationInputsUnchanged(git(['diff','--name-only',sourcePin,producer,'--','apps/api','apps/sites-workflow','packages']).trim().split(/\r?\n/).filter(Boolean));
 const records=new Map(HELPER_FILES.map(p=>[p,{actual:read(path.join(PAIR_REPO,...p.split('/'))),git:git(['show',producer+':'+p],true)}]));const helpers=await loadVerifiedPairHelpers(records);
 requireThat(JSON.stringify(helpers.C06_SUCCESSOR_API_FILES)===JSON.stringify(C06_API_SOURCE_FILES),'C06_API_SOURCE_CONTRACT');
 const gh=p=>JSON.parse(cp.execFileSync('gh',['api',p],{cwd:PAIR_REPO,windowsHide:true,maxBuffer:16000000}));
 const pr=gh('repos/melihsnyldzz-ui/melisa-erp-v2/pulls/54'),runs=gh('repos/melihsnyldzz-ui/melisa-erp-v2/actions/runs?head_sha='+producer+'&per_page=100').workflow_runs,jobs=new Map();for(const event of ['push','pull_request']){const r=runs.filter(r=>r.head_sha===producer&&r.path==='.github/workflows/ci.yml'&&r.event===event).sort((a,b)=>b.id-a.id)[0];if(r)jobs.set(r.id,gh('repos/melihsnyldzz-ui/melisa-erp-v2/actions/runs/'+r.id+'/attempts/1/jobs?per_page=100').jobs);}const ci=helpers.validateCustomerMetadataCI(producer,pr,runs,jobs);
 const raw=[C06_BASE.api,C06_BASE.web].map((root,i)=>{const b=read(path.join(root,'release-manifest.json'));requireThat(sha(b)===[C06_BASE.apiSha256,C06_BASE.webSha256][i],'C06_BASE_DIGEST');return b;});const [apiBase,webBase]=raw.map(b=>JSON.parse(b));verifyPayload(C06_BASE.api,apiBase);verifyPayload(C06_BASE.web,webBase);
 const gitFiles=sourcePin===C06_EC80_SOURCE_PIN?C06_EC80_GIT_FILES:sourcePin===C06_C2CE_SOURCE_PIN?C06_C2CE_GIT_FILES:sourcePin===C06_D246_SOURCE_PIN?C06_D246_GIT_FILES:C06_GIT_FILES,gitBlobs=new Map(gitFiles.map(p=>[p,git(['show',sourcePin+':'+p],true)])),workingBytes=new Map(gitFiles.map(p=>[p,read(path.join(PAIR_REPO,...p.split('/')))]));assertC06GitBlobClosure({paths:gitFiles,gitBlobs,workingBytes,sourcePin});
 const apiIndex=new Map(apiBase.files.map(r=>[r.path,r])),webIndex=new Map(webBase.files.map(r=>[r.path,r]));const readBase=p=>{const r=apiIndex.get(p);requireThat(r,'C06_API_BASE_DEPENDENCY');const b=read(path.join(C06_BASE.api,...p.split('/')));requireThat(sha(b)===r.sha256,'C06_API_BASE_DRIFT');return b;};
 const parserPath='apps/sites-workflow/node_modules/@babel/parser/lib/index.js',parserRow=webIndex.get(parserPath),parserBytes=read(path.join(C06_BASE.web,...parserPath.split('/')));requireThat(parserRow&&sha(parserBytes)===parserRow.sha256,'C06_PARSER');const exports={};vm.runInNewContext(parserBytes.toString(),{exports,module:{exports}},{timeout:5000,contextCodeGeneration:{strings:false,wasm:false}});const parse=exports.parse;requireThat(typeof parse==='function','C06_PARSER_EXPORT');
 const preview=await import('data:text/javascript;base64,'+records.get(HELPER_FILES[1]).git.toString('base64'));
 const apiClosure=helpers.customerMetadataClosure(C06_API_SOURCE_FILES,{readSource:p=>gitBlobs.get(p),readBase,basePaths:new Set(apiIndex.keys()),parse,newFiles:['apps/api/src/routes/customerMasterCanonicalRoutes.mjs','apps/api/src/controllers/customerMasterController.mjs']});
 requireThat(apiClosure.source.size===C06_API_SOURCE_FILES.length&&C06_API_SOURCE_FILES.every(p=>apiClosure.source.get(p)?.equals(gitBlobs.get(p))),'C06_API_CLOSURE');
 requireThat(readBase('apps/api/src/services/workTradeSqlProof.mjs').equals(gitBlobs.get('apps/api/src/services/workTradeSqlProof.mjs')),'C06_SALE_REVISION_PROOF_DRIFT');
 const before=new Map(C06_API_SOURCE_FILES.filter(p=>apiIndex.has(p)).map(p=>[p,readBase(p)]));
 const api=helpers.buildCustomerMasterSuccessorApiManifest({baseBytes:raw[0],baseDigest:C06_BASE.apiSha256,sourceCommit:sourcePin,sourcePin,producerCommit:producer,overlays:apiClosure.source,previousBytes:before});
 api.customerMasterSuccessor.salesSqlCompatibility={state:'NOT_APPLIED_NOT_VERIFIED',sourceWitnesses:C06_SALE_UNAPPLIED_SQL_SOURCE_FILES.map(p=>({path:p,sha256:sha(gitBlobs.get(p))})),sqlExecuted:false,installationBlocked:true};const apiBytes=encode(api);
 const web=currentC06WebClosure({readSource:p=>gitBlobs.get(p),parse,relativeImports:preview.relativeModuleSpecifiers,sourcePin}),webOverlays=new Map(web);for(const p of C06_WEB_RUNTIME_FILES)webOverlays.set(p,gitBlobs.get(p));const preRows=currentC06WebPayloadRows({base:webBase,overlays:webOverlays,sourcePin});
 const roots=c06CandidateRoots(producer,sourcePin);for(const p of Object.values(roots)){requireThat(!fs.existsSync(p),'C06_OUTPUT_EXISTS');plain(path.dirname(p));}
 const inputTotal=[...apiBase.files,...webBase.files].reduce((n,r)=>n+(r.bytes??fs.statSync(path.join(apiBase.files.includes(r)?C06_BASE.api:C06_BASE.web,...r.path.split('/'))).size),0),stat=fs.statfsSync(ROOT);requireThat(BigInt(stat.bavail)*BigInt(stat.bsize)>BigInt(inputTotal)+536870912n,'C06_DISK_SPACE');
 requireThat(git(['rev-parse','HEAD']).trim()===producer,'C06_HEAD_DRIFT');
 // Fresh exclusive paths only. Failure leaves inspectable partial artifacts and
 // never overwrites accepted releases or makes a candidate installable.
 copyPayload(C06_BASE.api,roots.api,api.files,apiClosure.source);writeNew(path.join(roots.api,'release-manifest.json'),apiBytes);verifyPayload(roots.api,api);
 copyPayload(C06_BASE.web,roots.web,preRows,webOverlays);
 const plan=currentBusinessBuildPlan(),work=path.join(roots.web,'apps','sites-workflow');const build=cp.spawnSync(NODE,[path.join(work,'node_modules','vite','bin','vite.js'),...plan.args],{cwd:work,env:currentBuildEnvironment(process.env),windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:16000000});requireThat(!build.error&&build.status===0,'C06_BUILD_FAILED');
 const dist=new Map(),walk=(dir,relative='')=>{plain(dir);for(const d of fs.readdirSync(dir,{withFileTypes:true})){requireThat(!d.isSymbolicLink(),'C06_BUILD_REPARSE');const name=relative+d.name;if(d.isDirectory())walk(path.join(dir,d.name),name+'/');else dist.set(name,read(path.join(dir,d.name)));}};walk(path.join(work,'dist'));
 const webManifest=compileC06WebManifest({api,apiBytes,apiRoot:roots.api,base:webBase,overlays:webOverlays,dist,producer,sourcePin});for(const r of webManifest.files){const file=path.join(roots.web,...r.path.split('/'));if(!fs.existsSync(file)){requireThat(r.path.startsWith('apps/sites-workflow/dist/')&&!r.path.startsWith('apps/sites-workflow/dist/assets/'),'C06_OUTPUT_MISSING');fs.mkdirSync(path.dirname(file),{recursive:true});writeNew(file,read(path.join(C06_BASE.web,...r.path.split('/'))));}}
 const webBytes=encode(webManifest);writeNew(path.join(roots.web,'release-manifest.json'),webBytes);
 // Independent, from-disk readback binds both manifests and every payload row.
 const apiRead=read(path.join(roots.api,'release-manifest.json')),webRead=read(path.join(roots.web,'release-manifest.json'));requireThat(apiRead.equals(apiBytes)&&webRead.equals(webBytes),'C06_MANIFEST_READBACK');const apiVerified=JSON.parse(apiRead),webVerified=JSON.parse(webRead);verifyPayload(roots.api,apiVerified);verifyPayload(roots.web,webVerified);verifyC06PassiveManifests({apiBytes:apiRead,webBytes:webRead,apiBase,webBase,producer,gitBlobs,dist,sourcePin});verifyPayload(C06_BASE.api,apiBase);verifyPayload(C06_BASE.web,webBase);requireThat(webVerified.backendManifestSha256===sha(apiRead)&&apiVerified.customerMasterSuccessor.executionAuthority===false&&webVerified.customerMasterSuccessor.executionAuthority===false,'C06_PAIR_READBACK');
 const receipt={schemaVersion:'melisa-c06-passive-pair.v1',sourceCommit:sourcePin,producerCommit:producer,apiRoot:roots.api,webRoot:roots.web,apiManifestSha256:sha(apiRead),webManifestSha256:sha(webRead),apiFiles:apiVerified.files.length,webFiles:webVerified.files.length,ci,apiSourceClosure:apiClosure.sourceFiles,webSourceClosure:web.size,gitSourceFiles:gitFiles.length,salesSqlCompatibility:'NOT_APPLIED_NOT_VERIFIED',rollbackStatus:'UNVERIFIED',installationReadiness:'NOT_EVALUATED',installationChecks:C06_INSTALLATION_CHECKS,installed:false,runtimeVerified:false,executionAuthority:false,actualT1:false,externalOperations:false,sqlCalls:0,serviceChanges:0,configChanges:0};writeNew(roots.receipt,encode(receipt));return receipt;
}
if(import.meta.url.startsWith('file:')&&process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 requireThat(process.argv.length===5&&['--prepare','--prepare-c06','--prepare-c06-d246','--prepare-c06-c2ce','--prepare-c06-ec80'].includes(process.argv[2])&&process.argv[3]==='--producer','CLI');
 console.log(JSON.stringify(await (process.argv[2]==='--prepare'?prepareCurrentBusinessPair(process.argv[4]):prepareC06BusinessPair(process.argv[4],process.argv[2]==='--prepare-c06-ec80'?C06_EC80_SOURCE_PIN:process.argv[2]==='--prepare-c06-c2ce'?C06_C2CE_SOURCE_PIN:process.argv[2]==='--prepare-c06-d246'?C06_D246_SOURCE_PIN:C06_SUCCESSOR_SOURCE_PIN))));
}
