import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import * as currentPair from './prepare-current-business-pair.mjs';
import path from 'node:path';import os from 'node:os';import {createRequire} from 'node:module';
import {relativeModuleSpecifiers} from './prepare-business-sale-preview-link-package.mjs';
import {APPLICATION_SOURCE,PAIR_REPO,PAIR_BRANCH,HELPER_FILES,WEB_SOURCE_FILES,WEB_ROOTS,pairRoots,assertPairSource,assertPairRows,loadVerifiedPairHelpers,currentWebClosure,currentBusinessBuildPlan,currentBuildEnvironment,compileCurrentBusinessWebManifest} from './prepare-current-business-pair.mjs';
import {CUSTOMER_METADATA_PACKAGE as P,CUSTOMER_METADATA_ENTRY as ENTRY,CUSTOMER_METADATA_NEW_FILES as NEW,CUSTOMER_METADATA_ASSET as ASSET,CUSTOMER_METADATA_CONTEXT_LINE as LINE,CUSTOMER_METADATA_ROUTE_BLOCK as BLOCK,CURRENT_PAIR_API_FILES,buildCurrentBusinessApiManifest} from './prepare-customer-master-metadata-package.mjs';
const digest=b=>crypto.createHash('sha256').update(b).digest('hex'),bytes=x=>Buffer.from(JSON.stringify(x,null,2)+'\n'),producer='2'.repeat(40),baseline=Buffer.from('baseline\n');
function apiFixture(){const names=[ENTRY,...Array.from({length:13},(_,i)=>'apps/api/fixture/'+i+'.mjs'),...CURRENT_PAIR_API_FILES],files=Array.from({length:11992},(_,i)=>({path:names[i]??'apps/api/fixture/f'+i+'.mjs',sha256:digest(baseline),bytes:baseline.length}));const base={sourceCommit:P.baseSourceCommit,packageId:P.basePackageId,database:'MELISA_ERP_SIRKET_TEST_20260929_01',actualT1:false,externalOperations:false,files,businessNormalSessionClosure:{version:1,files:files.slice(0,14).map(({path,sha256})=>({path,sha256}))}},metadata=new Map([[ENTRY,Buffer.from(LINE+baseline+BLOCK)],...NEW.map(p=>[p,Buffer.from('export const value=1;')]),[ASSET,Buffer.from('console.log("metadata");')]]),fixes=new Map(CURRENT_PAIR_API_FILES.map(p=>[p,Buffer.from('export const current=23;')]));return {base,metadata,fixes,options:{sourceCommit:APPLICATION_SOURCE,producerSourceCommit:producer,baseEntry:baseline}};}
function fixture(){const a=apiFixture(),api=buildCurrentBusinessApiManifest(a.base,a.metadata,a.fixes,a.options),apiBytes=bytes(api),overlays=new Map(WEB_SOURCE_FILES.map(p=>[p,Buffer.from('export const input=1;')])),base={kind:'ERP_BUSINESS_WORKFACE_WEB_CANDIDATE',packageId:'ERP-BUSINESS-WEB-5244-B6-PREVIEW-READ-VERIFIED-20261030',backendRoot:P.baseRoot,backendManifestSha256:P.baseManifestSha256,backendPackageId:api.packageId,sourceCommit:'fe3948c5ea77e7b0eb215cac6b6b0831adb45e8a',businessWorkfaceId:'ERP-5244-REALDATA-20261027',apiPort:4144,webPort:5244,database:api.database,actualT1:false,externalOperations:false,files:[...WEB_SOURCE_FILES.map(path=>({path,sha256:digest(baseline),bytes:baseline.length})),{path:'apps/sites-workflow/dist/assets/obsolete.js',sha256:digest(baseline)},{path:'apps/sites-workflow/dist/help.html',sha256:digest(baseline)}]},dist=new Map([['ornek-akis.html',Buffer.from('<script type="module" src="/assets/current.js"></script>')],['assets/current.js',Buffer.from('const profile="ERP-5244-REALDATA-20261027",api="http://127.0.0.1:4144";')]]);return {api,apiBytes,base,overlays,dist,producer,apiRoot:pairRoots(producer).api};}
const newBoundary='apps/sites-workflow/business-preview-boundary.mjs';
function legacyFixture(){const f=fixture();f.base.files=f.base.files.filter(r=>r.path!==newBoundary);return f;}
test('real legacy WEB shape copies the new boundary dependency before build and records it in the manifest',()=>{const f=legacyFixture(),old=JSON.stringify(f.base),rows=currentPair.currentWebPayloadRows({base:f.base,overlays:f.overlays});assert.equal(JSON.stringify(f.base),old);assert.equal(rows.filter(r=>r.path===newBoundary).length,1);assert.equal(rows.find(r=>r.path===newBoundary).sha256,digest(f.overlays.get(newBoundary)));assert.equal(rows.some(r=>r.path.startsWith('apps/sites-workflow/dist/')),false);const m=compileCurrentBusinessWebManifest(f);assert.equal(m.files.find(r=>r.path===newBoundary).sha256,digest(f.overlays.get(newBoundary)));assert.equal(m.currentBusinessPair.files.find(r=>r.path===newBoundary).beforeSha256,null);});
test('WEB copy rows refuse an unapproved missing base dependency or substituted new source',()=>{for(const kind of ['missing-existing','extra-overlay','missing-new']){const f=legacyFixture();if(kind==='missing-existing')f.base.files=f.base.files.filter(r=>r.path!==WEB_ROOTS[0]);if(kind==='extra-overlay')f.overlays.set('apps/sites-workflow/unapproved.mjs',baseline);if(kind==='missing-new')f.overlays.delete(newBoundary);assert.throws(()=>currentPair.currentWebPayloadRows({base:f.base,overlays:f.overlays}));}});
test('current API case consumes historical metadata compiler, preserving base/session/guard identity',()=>{const f=apiFixture(),old=JSON.stringify(f.base),m=buildCurrentBusinessApiManifest(f.base,f.metadata,f.fixes,f.options);assert.equal(JSON.stringify(f.base),old);assert.equal(m.files.length,12007);assert.equal(m.sourceCommit,P.baseSourceCommit);assert.equal(m.customerMasterMetadataOverlay.sourceCommit,APPLICATION_SOURCE);assert.equal(m.currentBusinessPair.producerSourceCommit,producer);assert.equal(m.currentBusinessPair.files.length,4);assert.equal(m.currentBusinessPair.masterWriterEnabled,false);for(const p of CURRENT_PAIR_API_FILES)assert.equal(m.files.find(r=>r.path===p).sha256,digest(f.fixes.get(p)));assert.deepEqual(m.businessNormalSessionClosure.files.slice(1),f.base.businessNormalSessionClosure.files.slice(1));});
for(const kind of ['missing','extra','wrong-source','bad-producer','closure-overwrite'])test('current API rejects '+kind,()=>{const f=apiFixture();if(kind==='missing')f.fixes.delete(CURRENT_PAIR_API_FILES[0]);if(kind==='extra')f.fixes.set('apps/api/other.mjs',baseline);if(kind==='wrong-source')f.options.sourceCommit='invalid';if(kind==='bad-producer')f.options.producerSourceCommit='invalid';if(kind==='closure-overwrite')f.base.businessNormalSessionClosure.files[1].path=CURRENT_PAIR_API_FILES[0];assert.throws(()=>buildCurrentBusinessApiManifest(f.base,f.metadata,f.fixes,f.options));});
test('WEB compiler binds exact API bytes/hash/provenance and removes obsolete hash chunks',()=>{const f=fixture(),m=compileCurrentBusinessWebManifest(f);assert.equal(m.backendManifestSha256,digest(f.apiBytes));assert.equal(m.backendRoot,f.apiRoot);assert.equal(m.currentBusinessPair.applicationSourceCommit,APPLICATION_SOURCE);assert.equal(m.currentBusinessPair.producerSourceCommit,producer);assert.equal(m.sourceCommit,f.base.sourceCommit);assert.equal(m.currentBusinessPair.files.length,23);assert.equal(m.files.some(r=>r.path.endsWith('obsolete.js')),false);assert.equal(m.files.some(r=>r.path.endsWith('help.html')),true);assert.equal(m.installed,false);assert.equal(m.currentBusinessPair.masterWriterEnabled,false);});
for(const kind of ['wrong-api-bytes','wrong-api-root','wrong-artifact','wrong-producer','wrong-backend-base','wrong-db','extra-web','missing-web','missing-dist','missing-asset','asset-drift','wrong-target','duplicate-case'])test('WEB compiler rejects '+kind,()=>{const f=fixture();if(kind==='wrong-api-bytes')f.apiBytes=Buffer.from('{}');if(kind==='wrong-api-root')f.apiRoot+='-other';if(kind==='wrong-artifact'){f.api.currentBusinessPair.applicationSourceCommit='3'.repeat(40);f.apiBytes=bytes(f.api);}if(kind==='wrong-producer'){f.api.currentBusinessPair.producerSourceCommit='3'.repeat(40);f.apiBytes=bytes(f.api);}if(kind==='wrong-backend-base')f.base.backendManifestSha256='f'.repeat(64);if(kind==='wrong-db')f.base.database='VEGA2026';if(kind==='extra-web')f.overlays.set('apps/sites-workflow/src/extra.js',baseline);if(kind==='missing-web')f.overlays.delete(WEB_SOURCE_FILES[0]);if(kind==='missing-dist')f.dist.clear();if(kind==='missing-asset')f.dist.delete('assets/current.js');if(kind==='asset-drift')f.dist.set('ornek-akis.html',Buffer.from('<script src="/assets/missing.js"></script>'));if(kind==='wrong-target')f.dist.set('assets/current.js',Buffer.from('API_OTHER'));if(kind==='duplicate-case')f.dist.set('ASSETS/current.js',baseline);assert.throws(()=>compileCurrentBusinessWebManifest(f));});
test('source/branch/origin/root are fixed, producer and application identities are distinct',()=>{const f={repo:PAIR_REPO,branch:PAIR_BRANCH,head:producer,producer,origins:Array(2).fill('https://github.com/melihsnyldzz-ui/melisa-erp-v2.git')};assert.equal(assertPairSource(f),true);for(const v of [{repo:PAIR_REPO.toLowerCase()},{branch:'main'},{head:'4'.repeat(40)},{producer:'wrong'},{application:'4'.repeat(40)},{origins:['https://other','https://other']}])assert.throws(()=>assertPairSource({...f,...v}));assert.throws(()=>pairRoots('../x'));assert.match(pairRoots(producer).api,/1afcdd7f3c89-P222222222222/);});
for(const paths of [['x','X'],['../x'],['x/../z'],['/root'],['x\\z'],['x:z'],['x//z'],['x/./z']])test('manifest rejects unsafe or aliased rows '+paths.join(','),()=>assert.throws(()=>assertPairRows(paths.map(path=>({path,sha256:'a'.repeat(64)})))));
function helperRecords(){return new Map(HELPER_FILES.map(p=>{const b=fs.readFileSync(new URL('./'+p.split('/').at(-1),import.meta.url));return[p,{actual:b,git:Buffer.from(b.toString().replaceAll('\r\n','\n'))}];}));}
test('actual verified helper graph imports from checked bytes without filesystem re-read',async()=>{const h=await loadVerifiedPairHelpers(helperRecords());assert.equal(typeof h.buildCurrentBusinessApiManifest,'function');const f=apiFixture();assert.equal(h.buildCurrentBusinessApiManifest(f.base,f.metadata,f.fixes,f.options).currentBusinessPair.files.length,4);});
test('import-before-hash sentinel: ALL helpers verified before ANY helper code executes',async()=>{for(const p of HELPER_FILES){const r=helperRecords();r.get(p).actual=Buffer.from('globalThis.CURRENT_PAIR_IMPORT_SENTINEL=true;\n'+r.get(p).actual);delete globalThis.CURRENT_PAIR_IMPORT_SENTINEL;await assert.rejects(loadVerifiedPairHelpers(r),/CURRENT_PAIR_HELPER_BYTES/);assert.equal(globalThis.CURRENT_PAIR_IMPORT_SENTINEL,undefined);}});
test('helper coverage rejects omitted, extra and wrong-case paths before import',async()=>{for(const kind of ['missing','extra','case']){const r=helperRecords();if(kind==='missing')r.delete(HELPER_FILES[0]);if(kind==='extra')r.set('other.mjs',r.get(HELPER_FILES[0]));if(kind==='case'){const v=r.get(HELPER_FILES[0]);r.delete(HELPER_FILES[0]);r.set(HELPER_FILES[0].toUpperCase(),v);}await assert.rejects(loadVerifiedPairHelpers(r),/CURRENT_PAIR_HELPER_COVERAGE/);}});
test('business build has fixed mode/target and never inherits secrets or arbitrary Node options',()=>{const p=currentBusinessBuildPlan(),env=currentBuildEnvironment({SystemRoot:'Windows',TEMP:'temp',SQL_PASSWORD:'secret',NODE_OPTIONS:'--import evil',MELISA_CLEAN_UI_NETWORK:'true',Path:'evil'});assert.deepEqual(p.args,['build','--mode','business']);assert.equal(env.VITE_LOCAL_PASSWORDLESS_LOGIN,'false');assert.equal(env.VITE_API_BASE_URL,'http://127.0.0.1:4144');assert.equal(env.SQL_PASSWORD,undefined);assert.equal(env.NODE_OPTIONS,undefined);assert.equal(env.MELISA_CLEAN_UI_NETWORK,undefined);});
test('actual closure walker refuses missing/extra source paths without evaluating application source',()=>{const relativeImports=text=>[...text.matchAll(/import ['"]([^'"]+)['"]/g)].map(x=>x[1]),readSource=p=>Buffer.from(p===WEB_ROOTS[0]?"import './not-allowed.mjs';throw Error('APP_NOT_EVALUATED');":'');assert.throws(()=>currentWebClosure({readSource,parse:null,relativeImports}),/CURRENT_PAIR_WEB_CLOSURE/);});
test('entry imports only Node builtins before its verified helper loader',()=>{const s=fs.readFileSync(new URL('./prepare-current-business-pair.mjs',import.meta.url),'utf8');assert.doesNotMatch(s,/^import.*from ['"]\./m);assert.match(s,/loadVerifiedPairHelpers\(records\)/);assert.match(s,/verifyPayload\(BASE_API,apiBase\);verifyPayload\(BASE_WEB,webBase\)/);assert.doesNotMatch(s,/Get-Cim|Start-Process|Stop-Process|sql\.connect|\.listen\(/);});
test('producer CI cannot certify different application blobs from an older ancestor',()=>{assert.equal(typeof currentPair.assertCurrentApplicationInputsUnchanged,'function');assert.equal(currentPair.assertCurrentApplicationInputsUnchanged([]),true);for(const files of [['apps/api/src/a.mjs'],['apps/sites-workflow/src/a.js'],['packages/x.js'],null])assert.throws(()=>currentPair.assertCurrentApplicationInputsUnchanged(files));});
test('real pinned WEB roots resolve exactly twenty-three production inputs using the actual AST walker',()=>{const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'apps/sites-workflow/package.json')),parser=require('@babel/parser');const closure=currentWebClosure({readSource:p=>fs.readFileSync(path.join(root,p)),parse:parser.parse,relativeImports:relativeModuleSpecifiers});assert.equal(closure.size,23);for(const p of WEB_SOURCE_FILES)assert.ok(closure.has(p));});
test('actual producer file reader rejects hardlink, reparse ancestor and case aliases',()=>{const parent=fs.realpathSync.native(os.tmpdir()),dir=fs.realpathSync.native(fs.mkdtempSync(path.join(parent,'current-pair-io-'))),file=path.join(dir,'source.mjs'),alias=path.join(dir,'alias.mjs'),junction=path.join(dir,'junction');try{fs.writeFileSync(file,'source');assert.equal(currentPair.readCurrentPairFile(file).toString(),'source');fs.linkSync(file,alias);assert.throws(()=>currentPair.readCurrentPairFile(file));fs.unlinkSync(alias);fs.symlinkSync(dir,junction,'junction');assert.throws(()=>currentPair.readCurrentPairFile(path.join(junction,'source.mjs')));assert.throws(()=>currentPair.readCurrentPairFile(path.join(dir,'SOURCE.mjs')));}finally{const resolved=fs.realpathSync.native(dir);assert.equal(path.dirname(resolved),parent);assert.match(path.basename(resolved),/^current-pair-io-/);if(fs.existsSync(junction))fs.unlinkSync(junction);fs.rmSync(dir,{recursive:true});}});

test('C06 successor accepts only the explicitly reviewed application sources',()=>{
 assert.equal(currentPair.C06_SUCCESSOR_SOURCE_PIN,'fce4d7aa21d2828c32576a8e5a51adb84fb000fe');assert.equal(currentPair.C06_D246_SOURCE_PIN,'d2466250fabc1a319f7ff0592ab39bb6903bebfb');assert.equal(currentPair.C06_C2CE_SOURCE_PIN,'c2ce84dffcc843c659d6f1fd866e056d7cca8c1b');for(const value of [currentPair.C06_SUCCESSOR_SOURCE_PIN,currentPair.C06_D246_SOURCE_PIN,currentPair.C06_C2CE_SOURCE_PIN])assert(currentPair.assertC06SuccessorPinned(value));for(const value of [null,'a'.repeat(40),'not-a-sha'])assert.throws(()=>currentPair.assertC06SuccessorPinned(value),/C06_SOURCE_PIN_UNSET_OR_MISMATCH/);
});
test('C06 frontend closure contains exact 31 transitive sources for customer, session and existing workface',()=>{
 const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'apps/sites-workflow/package.json')),parser=require('@babel/parser');const closure=currentPair.currentC06WebClosure({readSource:p=>fs.readFileSync(path.join(root,p)),parse:parser.parse,relativeImports:relativeModuleSpecifiers});assert.equal(closure.size,31);for(const p of currentPair.C06_WEB_SOURCE_FILES)assert(closure.has(p));
});
test('C06 exact closure rejects unapproved imports and empty inputs without evaluating source',()=>{
 const rel=text=>[...text.matchAll(/import ['"]([^'"]+)['"]/g)].map(x=>x[1]);assert.throws(()=>currentPair.currentC06WebClosure({readSource:p=>Buffer.from(p===currentPair.C06_WEB_ROOTS[0]?"import './not-allowed.mjs';throw Error('MUST_NOT_EVALUATE')":'export const x=1;'),parse:null,relativeImports:rel}),/C06_WEB_CLOSURE_PATH/);assert.throws(()=>currentPair.currentC06WebClosure({readSource:()=>Buffer.alloc(0),parse:null,relativeImports:rel}),/C06_WEB_CLOSURE_BYTES/);
});
test('C06 rollback fails closed when backend or protocol differs instead of relabeling the old manifest',()=>{
 const candidate={backend:{source:'new'},protocol:{transport:'new'}},old={backend:{source:'old'},protocol:{transport:'old'}};assert.throws(()=>currentPair.assertC06RollbackCompatibility(candidate,old),/C06_ROLLBACK_BACKEND_OR_PROTOCOL_CHANGED/);assert.throws(()=>currentPair.assertC06RollbackCompatibility(candidate,{backend:candidate.backend,protocol:old.protocol}),/C06_ROLLBACK_BACKEND_OR_PROTOCOL_CHANGED/);assert(currentPair.assertC06RollbackCompatibility(candidate,structuredClone(candidate)));
});

test('C06 exact Git source closure rejects missing, extra, changed, and unpinned working bytes',()=>{
 const paths=[...currentPair.C06_GIT_FILES],gitBlobs=new Map(paths.map(p=>[p,Buffer.from('git '+p+'\n')])),workingBytes=new Map([...gitBlobs].map(([p,b])=>[p,Buffer.from(b.toString().replaceAll('\n','\r\n'))]));
 assert(currentPair.assertC06GitBlobClosure({paths,gitBlobs,workingBytes}));for(const p of ['scripts/canonical/canonical-business-sale-owner-sql.mjs','scripts/canonical/canonical-business-sale-effects-sql.mjs','scripts/canonical/canonical-business-sale-admission-sql.mjs','apps/api/src/services/workTradeSqlProof.mjs'])assert(paths.includes(p));
 for(const kind of ['missing','extra','drift','wrong-path']){const g=new Map(gitBlobs),w=new Map(workingBytes),p=[...paths];if(kind==='missing')g.delete(p[0]);if(kind==='extra')g.set('other',Buffer.from('x'));if(kind==='drift')w.set(p[0],Buffer.from('changed'));if(kind==='wrong-path')p[0]='other';assert.throws(()=>currentPair.assertC06GitBlobClosure({paths:p,gitBlobs:g,workingBytes:w}));}
});
test('C06 WEB successor rows preserve existing exact files, permit only new customer master and drop obsolete dist',()=>{
 const added=new Set(['apps/sites-workflow/src/workflow/workCustomerMaster.mjs','apps/sites-workflow/business-web-gateway.mjs','apps/sites-workflow/business-web-release.mjs','apps/sites-workflow/business-web-backend-proof.ps1']),base={files:[...currentPair.C06_WEB_PAYLOAD_FILES.filter(p=>!added.has(p)).map(p=>({path:p,sha256:digest(baseline),bytes:baseline.length})),{path:'apps/sites-workflow/dist/assets/old.js',sha256:digest(baseline),bytes:baseline.length}]},overlays=new Map(currentPair.C06_WEB_PAYLOAD_FILES.map(p=>[p,Buffer.from('source '+p)])),before=JSON.stringify(base),rows=currentPair.currentC06WebPayloadRows({base,overlays});
 assert.equal(JSON.stringify(base),before);assert.equal(rows.find(x=>x.path.endsWith('/workCustomerMaster.mjs')).sha256,digest(overlays.get('apps/sites-workflow/src/workflow/workCustomerMaster.mjs')));assert(!rows.some(x=>x.path.startsWith('apps/sites-workflow/dist/')));
 for(const kind of ['missing','extra','base']){const changed={files:[...base.files]},input=new Map(overlays);if(kind==='missing')input.delete(currentPair.C06_WEB_SOURCE_FILES[0]);if(kind==='extra')input.set('other',baseline);if(kind==='base')changed.files=changed.files.filter(x=>x.path!==currentPair.C06_WEB_SOURCE_FILES[0]);assert.throws(()=>currentPair.currentC06WebPayloadRows({base:changed,overlays:input}));}
});
test('real C06 producer entry checks source and CI before passive output and keeps rollback unverified',()=>{
 const source=fs.readFileSync(new URL('./prepare-current-business-pair.mjs',import.meta.url),'utf8'),body=source.slice(source.indexOf('export async function prepareC06BusinessPair('),source.lastIndexOf("if(import.meta.url.startsWith('file:')"));
 for(const gate of ['assertC06SuccessorPinned','validateCustomerMetadataCI','assertC06GitBlobClosure','verifyPayload(C06_BASE.api','customerMetadataClosure','buildCustomerMasterSuccessorApiManifest','C06_SALE_REVISION_PROOF_DRIFT','currentC06WebClosure','verifyC06PassiveManifests','UNVERIFIED'])assert(body.includes(gate),gate);
 assert(body.indexOf('validateCustomerMetadataCI')<body.indexOf('copyPayload('));assert(body.indexOf('C06_HEAD_DRIFT')<body.indexOf('copyPayload('));assert(!body.includes('assertC06RollbackCompatibility('));assert(!/sql\.connect|Start-Process|Stop-Process/.test(body));
});
function c06PassiveFixture(source=currentPair.C06_SUCCESSOR_SOURCE_PIN){
 const producer='9'.repeat(40),roots=currentPair.c06CandidateRoots(producer,source),all=source===currentPair.C06_C2CE_SOURCE_PIN?currentPair.C06_C2CE_GIT_FILES:source===currentPair.C06_D246_SOURCE_PIN?currentPair.C06_D246_GIT_FILES:currentPair.C06_GIT_FILES,webFiles=source===currentPair.C06_C2CE_SOURCE_PIN?currentPair.C06_C2CE_WEB_PAYLOAD_FILES:source===currentPair.C06_D246_SOURCE_PIN?currentPair.C06_D246_WEB_PAYLOAD_FILES:currentPair.C06_WEB_PAYLOAD_FILES,gitBlobs=new Map(all.map(p=>[p,Buffer.from('git '+p)])),sha=digest,apiAdded=new Set(['apps/api/src/routes/customerMasterCanonicalRoutes.mjs','apps/api/src/controllers/customerMasterController.mjs']),webAdded=new Set(['apps/sites-workflow/src/workflow/workCustomerMaster.mjs','apps/sites-workflow/business-web-gateway.mjs','apps/sites-workflow/business-web-release.mjs','apps/sites-workflow/business-web-backend-proof.ps1',...(source!==currentPair.C06_SUCCESSOR_SOURCE_PIN?['apps/sites-workflow/src/workflow/savedBusinessSalesBasket.mjs']:[])]);
 const rows=paths=>paths.map(p=>({path:p,sha256:sha(baseline),bytes:baseline.length})),apiBase={files:rows(currentPair.C06_API_SOURCE_FILES.filter(p=>!apiAdded.has(p)))},webBase={kind:'ERP_BUSINESS_WORKFACE_WEB_CANDIDATE',packageId:'ERP-BUSINESS-WEB-5244-CURRENT-PAIR-1afcdd7f3c89-P7c6dcc727498-20261103',backendManifestSha256:currentPair.C06_BASE.apiSha256,database:'MELISA_ERP_SIRKET_TEST_20260929_01',apiPort:4144,webPort:5244,actualT1:false,externalOperations:false,files:[...rows(webFiles.filter(p=>!webAdded.has(p))),{path:'apps/sites-workflow/dist/retained-help.html',sha256:sha(baseline),bytes:baseline.length}]};
 const mk=(paths,base)=>paths.map(p=>({path:p,beforeSha256:base.files.find(r=>r.path===p)?.sha256??null,sha256:sha(gitBlobs.get(p)),bytes:gitBlobs.get(p).length})),apiFiles=mk(currentPair.C06_API_SOURCE_FILES,apiBase),api={files:apiFiles.map(({path,sha256,bytes})=>({path,sha256,bytes})),customerMasterSuccessor:{sourceCommit:source,producerCommit:producer,baseManifestSha256:currentPair.C06_BASE.apiSha256,files:apiFiles,executionAuthority:false,installed:false,actualT1:false,externalOperations:false,salesSqlCompatibility:{state:'NOT_APPLIED_NOT_VERIFIED',sqlExecuted:false,installationBlocked:true,sourceWitnesses:currentPair.C06_SALE_UNAPPLIED_SQL_SOURCE_FILES.map(p=>({path:p,sha256:sha(gitBlobs.get(p))}))}}};
 const apiBytes=bytes(api),overlays=new Map(webFiles.map(p=>[p,gitBlobs.get(p)])),dist=new Map([['ornek-akis.html',Buffer.from('<script src="/assets/app.js"></script>')],['assets/app.js',Buffer.from('ERP-5244-REALDATA-20261027 http://127.0.0.1:4144')]]),web=currentPair.compileC06WebManifest({api,apiBytes,apiRoot:roots.api,base:webBase,overlays,dist,producer,sourcePin:source});return {api,apiBytes,apiBase,web,webBytes:bytes(web),webBase,producer,gitBlobs,overlays,dist,roots,sourcePin:source};
}
test('C06 passive API and WEB manifests retain separate install readiness and rollback status and independently rebind every source',()=>{const f=c06PassiveFixture();assert.equal(f.web.customerMasterSuccessor.rollbackStatus,'UNVERIFIED');assert.equal(f.web.customerMasterSuccessor.executionAuthority,false);assert.equal(f.web.customerMasterSuccessor.installed,false);assert.equal(f.web.customerMasterSuccessor.installationReadiness,'NOT_EVALUATED');assert.deepEqual(f.web.customerMasterSuccessor.installationChecks,currentPair.C06_INSTALLATION_CHECKS);assert(currentPair.verifyC06PassiveManifests(f));});
test('d246 passive successor uses separate paths and binds the matching API and WEB source without relabeling fce',()=>{
 const old=c06PassiveFixture(),next=c06PassiveFixture(currentPair.C06_D246_SOURCE_PIN);
 for(const key of ['api','web','receipt'])assert.notEqual(old.roots[key],next.roots[key]);
 assert(currentPair.verifyC06PassiveManifests(old));assert(currentPair.verifyC06PassiveManifests(next));
 assert.throws(()=>currentPair.verifyC06PassiveManifests({...next,sourcePin:currentPair.C06_SUCCESSOR_SOURCE_PIN}));
 assert.throws(()=>currentPair.compileC06WebManifest({api:old.api,apiBytes:old.apiBytes,apiRoot:next.roots.api,base:next.webBase,overlays:next.overlays,dist:next.dist,producer:next.producer,sourcePin:currentPair.C06_D246_SOURCE_PIN}));
 assert.throws(()=>currentPair.c06CandidateRoots(next.producer,'a'.repeat(40)),/C06_SOURCE_PIN_UNSET_OR_MISMATCH/);
});
test('d246 production entry stops before I/O while its output-parent identity is unverified',async()=>{
 await assert.rejects(()=>currentPair.prepareC06BusinessPair('9'.repeat(40),currentPair.C06_D246_SOURCE_PIN),/C06_D246_OUTPUT_PARENT_UNVERIFIED/);
 const code=fs.readFileSync(new URL('./prepare-current-business-pair.mjs',import.meta.url),'utf8'),body=code.slice(code.indexOf('export async function prepareC06BusinessPair('));
 assert(body.indexOf('C06_D246_OUTPUT_PARENT_UNVERIFIED')<body.indexOf('C06_ENTRY_PATH'));assert(body.indexOf('C06_D246_OUTPUT_PARENT_UNVERIFIED')<body.indexOf('copyPayload('));
});
// Offline graph fixture: relative imports were extracted once from local d246
// Git blobs. The synthesized bytes below are NOT those Git blobs, and do not
// establish commit ancestry, historical full-tree delta or production input.
// Production independently checks the real Git contents, ancestry and CI.
const d246HistoricalImportGraph=Object.freeze({
  "apps/api/src/services/canonicalBusinessPartyHistoryModel.mjs": [],
  "apps/api/src/services/canonicalBusinessSaleReadModel.mjs": [],
  "apps/api/src/services/goal8DaySqlProof.mjs": [],
  "apps/sites-workflow/business-preview-boundary.mjs": [
    "./src/workflow/businessWorkface.mjs"
  ],
  "apps/sites-workflow/business-preview-session.mjs": [
    "./src/workflow/businessWorkface.mjs"
  ],
  "apps/sites-workflow/src/workflow/businessWorkface.mjs": [
    "../../../api/src/services/canonicalBusinessSaleReadModel.mjs",
    "../../../api/src/services/canonicalBusinessPartyHistoryModel.mjs"
  ],
  "apps/sites-workflow/src/workflow/cleanSyntheticCatalogModel.mjs": [],
  "apps/sites-workflow/src/workflow/currencyAccountPresentation.mjs": [
    "./moneyDisplay.mjs"
  ],
  "apps/sites-workflow/src/workflow/customerContactPendingMarker.mjs": [],
  "apps/sites-workflow/src/workflow/isolatedOperationCopyModel.mjs": [],
  "apps/sites-workflow/src/workflow/moneyDisplay.mjs": [],
  "apps/sites-workflow/src/workflow/selectedSaleUiModel.mjs": [
    "./isolatedOperationCopyModel.mjs"
  ],
  "apps/sites-workflow/src/workflow/testAdminSession.mjs": [
    "./cleanSyntheticCatalogModel.mjs",
    "./businessWorkface.mjs"
  ],
  "apps/sites-workflow/src/workflow/testSuppliersModel.mjs": [],
  "apps/sites-workflow/src/workflow/workBusinessPartyHistory.mjs": [
    "./workTradeModel.mjs",
    "../../../api/src/services/canonicalBusinessPartyHistoryModel.mjs",
    "./moneyDisplay.mjs"
  ],
  "apps/sites-workflow/src/workflow/workCopyPresentation.mjs": [
    "./isolatedOperationCopyModel.mjs"
  ],
  "apps/sites-workflow/src/workflow/workCustomerContact.mjs": [
    "./customerContactPendingMarker.mjs",
    "./workTradeModel.mjs"
  ],
  "apps/sites-workflow/src/workflow/workInbound.css": [],
  "apps/sites-workflow/src/workflow/workInboundModel.mjs": [
    "./isolatedOperationCopyModel.mjs",
    "./moneyDisplay.mjs",
    "./workTradeModel.mjs"
  ],
  "apps/sites-workflow/src/workflow/workSupplierPaymentsModel.mjs": [
    "./isolatedOperationCopyModel.mjs",
    "./cleanSyntheticCatalogModel.mjs",
    "./testAdminSession.mjs",
    "./moneyDisplay.mjs",
    "./workTradeModel.mjs"
  ],
  "apps/sites-workflow/src/workflow/workSuppliers.js": [
    "./workBusinessPartyHistory.mjs",
    "./workCustomerContact.mjs",
    "./workCopyPresentation.mjs",
    "./currencyAccountPresentation.mjs",
    "./workInbound.css",
    "./workInboundModel.mjs",
    "./testSuppliersModel.mjs",
    "./workSupplierPaymentsModel.mjs"
  ],
  "apps/sites-workflow/src/workflow/workTradeModel.mjs": [
    "./businessWorkface.mjs",
    "./moneyDisplay.mjs",
    "./isolatedOperationCopyModel.mjs",
    "../../../api/src/services/goal8DaySqlProof.mjs",
    "./selectedSaleUiModel.mjs"
  ],
  "apps/sites-workflow/vite.config.mjs": [
    "./src/workflow/businessWorkface.mjs",
    "./business-preview-session.mjs",
    "./business-preview-boundary.mjs"
  ],
  "apps/sites-workflow/src/workflow/businessSupplierSelection.mjs": [
    "./isolatedOperationCopyModel.mjs"
  ],
  "apps/sites-workflow/src/workflow/protectedDeviceSession.mjs": [],
  "apps/sites-workflow/src/workflow/testCustomersModel.mjs": [],
  "apps/sites-workflow/src/workflow/workCustomerMaster.mjs": [
    "./workTradeModel.mjs"
  ],
  "apps/sites-workflow/src/workflow/workCustomers.js": [
    "./workCustomerMaster.mjs",
    "./workBusinessPartyHistory.mjs",
    "./workCopyPresentation.mjs",
    "./currencyAccountPresentation.mjs",
    "./workSales.css",
    "./testCustomersModel.mjs",
    "./workTradeModel.mjs",
    "./workOpenAccountPresentation.mjs",
    "./workCustomerContact.mjs"
  ],
  "apps/sites-workflow/src/workflow/workOpenAccountPresentation.mjs": [
    "./workTradeModel.mjs"
  ],
  "apps/sites-workflow/src/workflow/workSales.css": [],
  "apps/sites-workflow/src/workflow/workingCatalogSession.mjs": [
    "./businessSupplierSelection.mjs",
    "./cleanSyntheticCatalogModel.mjs",
    "./businessWorkface.mjs",
    "../../../api/src/services/canonicalBusinessSaleReadModel.mjs",
    "../../../api/src/services/canonicalBusinessPartyHistoryModel.mjs",
    "./workTradeModel.mjs",
    "./testAdminSession.mjs",
    "./isolatedOperationCopyModel.mjs",
    "./protectedDeviceSession.mjs"
  ],
  "apps/api/src/services/currentProductCatalogContext.mjs": [
    "./finalCatalogContext.mjs"
  ],
  "apps/api/src/services/finalCatalogContext.mjs": [],
  "apps/sites-workflow/src/workflow/currentProductCatalogModel.mjs": [
    "../../../../apps/api/src/services/currentProductCatalogContext.mjs"
  ],
  "apps/sites-workflow/src/workflow/savedBusinessSalesBasket.mjs": [
    "./workBusinessSalesBasketModel.mjs"
  ],
  "apps/sites-workflow/src/workflow/selectedSourceCollectionHandoff.mjs": [
    "./isolatedOperationCopyModel.mjs"
  ],
  "apps/sites-workflow/src/workflow/stockProductsModel.mjs": [
    "./moneyDisplay.mjs"
  ],
  "apps/sites-workflow/src/workflow/workBusinessSalesBasketModel.mjs": [
    "../../../api/src/services/canonicalBusinessSaleReadModel.mjs",
    "./businessWorkface.mjs"
  ],
  "apps/sites-workflow/src/workflow/workBusinessSalesRead.mjs": [
    "./workTradeModel.mjs",
    "./workBusinessPartyHistory.mjs",
    "./workCatalogModel.mjs",
    "./testCustomersModel.mjs",
    "./workCatalogPhoto.mjs",
    "../../../api/src/services/canonicalBusinessSaleReadModel.mjs",
    "./workBusinessSalesBasketModel.mjs",
    "./savedBusinessSalesBasket.mjs"
  ],
  "apps/sites-workflow/src/workflow/workCatalogModel.mjs": [
    "./moneyDisplay.mjs",
    "./stockProductsModel.mjs",
    "./currentProductCatalogModel.mjs",
    "./cleanSyntheticCatalogModel.mjs"
  ],
  "apps/sites-workflow/src/workflow/workCatalogPhoto.mjs": [
    "./workCatalogModel.mjs"
  ],
  "apps/sites-workflow/src/workflow/workSales.js": [
    "./workBusinessSalesBasketModel.mjs",
    "./workOpenAccountPresentation.mjs",
    "./workBusinessSalesRead.mjs",
    "./workCopyPresentation.mjs",
    "./workTaskHandoff.mjs",
    "./workTaskHandoff.css",
    "./isolatedOperationCopyModel.mjs",
    "./workSales.css",
    "./selectedSaleUiModel.mjs",
    "./workTradeModel.mjs",
    "./workCatalogModel.mjs",
    "./selectedSourceCollectionHandoff.mjs",
    "./workCatalogPhoto.mjs"
  ],
  "apps/sites-workflow/src/workflow/workTaskHandoff.css": [],
  "apps/sites-workflow/src/workflow/workTaskHandoff.mjs": []
});
const d246HistoricalChangeWitness=Object.freeze({
  "apps/sites-workflow/src/workflow/workBusinessSalesRead.mjs": {
    "before": "4feacd3ed14b88b2897b6b123b6c0510ac1fb50955bdd745fc7c410b7fe0c587",
    "after": "f1d763382b54f9ff179fcee51ba62f5ae42bf57bba6f250af06bd6ce58bce4da"
  },
  "apps/sites-workflow/src/workflow/workBusinessSalesRead.test.mjs": {
    "before": "f7d4a76de23de4db4746b78f9b55a680f1f13124cd8b4a4d981835d95bf51946",
    "after": "ad2b47e7838536540f932d9f892410287f759d96c4031318a4b93cab15398a55"
  },
  "apps/sites-workflow/src/workflow/workCustomers.js": {
    "before": "735ed858428f07d602a42a7a7077931f43b9b5f1971913837f156b3af95240b7",
    "after": "0f64a67e870f58af5c381c2af3a5dae1b924242f9add2342464e6e4d8dfba9d6"
  },
  "apps/sites-workflow/src/workflow/workCustomersListRace.test.mjs": {
    "before": null,
    "after": "fa3a2d860c21f46fb4759f374f34737a66f70ec28201c21026c2a720919efb57"
  }
});
function d246SyntheticSource(p){
 const imports=d246HistoricalImportGraph[p];assert(Array.isArray(imports),'fixture source missing: '+p);
 return Buffer.from(imports.map(x=>'import '+JSON.stringify(x)+';').join('\n')+'\n/* synthetic source, never evaluated */\n');
}
// Synthetic extension of the reviewed d246 graph; these are not Git blobs.
const c2ceSyntheticImportGraph=Object.freeze({...d246HistoricalImportGraph,
 'apps/sites-workflow/src/workflow/workBusinessReceivingRead.mjs':['./workingCatalogSession.mjs','./workCatalogModel.mjs','./testSuppliersModel.mjs'],
 'apps/sites-workflow/src/workflow/workInboundJournal.mjs':['./workTradeModel.mjs'],
 'apps/sites-workflow/src/workflow/workReceivingHandoff.mjs':['./workInboundModel.mjs'],
 'apps/sites-workflow/src/workflow/workReceivingRecovery.mjs':[],
 'apps/sites-workflow/src/workflow/workReceiving.js':['./workBusinessReceivingRead.mjs','./isolatedOperationCopyModel.mjs','./businessSupplierSelection.mjs','./workCopyPresentation.mjs','./workTaskHandoff.mjs','./workTaskHandoff.css','./workInbound.css','./workInboundModel.mjs','./workInboundJournal.mjs','./workReceivingRecovery.mjs','./workReceivingHandoff.mjs','./workTradeModel.mjs','./workCatalogModel.mjs','./workCatalogPhoto.mjs']
});
test('c2ce synthetic sales, customer and receiving graph has all 49 approved sources and rejects missing or extra dependencies',()=>{
 const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'apps/sites-workflow/package.json')),parse=require('@babel/parser').parse,pin=currentPair.C06_C2CE_SOURCE_PIN;
 assert.deepEqual(Object.keys(c2ceSyntheticImportGraph).sort(),[...currentPair.C06_C2CE_WEB_SOURCE_FILES].sort());
 const blobs=new Map(currentPair.C06_C2CE_GIT_FILES.map(p=>[p,Object.hasOwn(c2ceSyntheticImportGraph,p)?Buffer.from(c2ceSyntheticImportGraph[p].map(x=>'import '+JSON.stringify(x)+';').join('\n')+'\n/* synthetic only */'):Buffer.from('/* synthetic fixture */')]));
 const args={readSource:p=>blobs.get(p),parse,relativeImports:relativeModuleSpecifiers,sourcePin:pin};assert.equal(currentPair.currentC06WebClosure(args).size,49);
 assert.throws(()=>currentPair.currentC06WebClosure({...args,readSource:p=>p.endsWith('/workBusinessReceivingRead.mjs')?Buffer.alloc(0):blobs.get(p)}),/C06_WEB_CLOSURE_BYTES/);
 assert.throws(()=>currentPair.currentC06WebClosure({...args,readSource:p=>p.endsWith('/workReceiving.js')?Buffer.from("import './unexpected.mjs';"):blobs.get(p)}),/C06_WEB_CLOSURE_PATH/);
 assert(currentPair.assertC06GitBlobClosure({paths:currentPair.C06_C2CE_GIT_FILES,gitBlobs:blobs,workingBytes:new Map(blobs),sourcePin:pin}));
 const missing=new Map(blobs);missing.delete('apps/sites-workflow/src/workflow/workReceiving.js');assert.throws(()=>currentPair.assertC06GitBlobClosure({paths:currentPair.C06_C2CE_GIT_FILES,gitBlobs:missing,workingBytes:blobs,sourcePin:pin}),/C06_GIT_CLOSURE/);
});
test('c2ce offline manifests cannot relabel historical pairs, and production entry stops before I/O',async()=>{
 const old=c06PassiveFixture(),prior=c06PassiveFixture(currentPair.C06_D246_SOURCE_PIN),current=c06PassiveFixture(currentPair.C06_C2CE_SOURCE_PIN);
 for(const key of ['api','web','receipt'])assert.equal(new Set([old.roots[key],prior.roots[key],current.roots[key]]).size,3);
 for(const f of [old,prior,current])assert(currentPair.verifyC06PassiveManifests(f));
 assert.throws(()=>currentPair.verifyC06PassiveManifests({...current,sourcePin:currentPair.C06_D246_SOURCE_PIN}));
 assert.throws(()=>currentPair.compileC06WebManifest({api:prior.api,apiBytes:prior.apiBytes,apiRoot:current.roots.api,base:current.webBase,overlays:current.overlays,dist:current.dist,producer:current.producer,sourcePin:current.sourcePin}));
 await assert.rejects(()=>currentPair.prepareC06BusinessPair('9'.repeat(40),current.sourcePin),/C06_C2CE_OUTPUT_PARENT_UNVERIFIED/);
 const code=fs.readFileSync(new URL('./prepare-current-business-pair.mjs',import.meta.url),'utf8'),body=code.slice(code.indexOf('export async function prepareC06BusinessPair('));assert(body.indexOf('C06_C2CE_OUTPUT_PARENT_UNVERIFIED')<body.indexOf('C06_ENTRY_PATH'));
});
test('c2ce receiving files require their own original before-image and exact source bytes',()=>{
 for(const name of ['workReceiving.js','workBusinessReceivingRead.mjs','workInboundJournal.mjs','workReceivingHandoff.mjs','workReceivingRecovery.mjs']){
  const p='apps/sites-workflow/src/workflow/'+name,f=c06PassiveFixture(currentPair.C06_C2CE_SOURCE_PIN),row=f.web.customerMasterSuccessor.files.find(x=>x.path===p);assert(row);assert.equal(row.beforeSha256,digest(baseline));
  f.gitBlobs.set(p,Buffer.from('changed source'));assert.throws(()=>currentPair.verifyC06PassiveManifests(f),/C06_READBACK_SOURCE/);
  const other=c06PassiveFixture(currentPair.C06_C2CE_SOURCE_PIN);other.web.customerMasterSuccessor.files.find(x=>x.path===p).beforeSha256=null;other.webBytes=bytes(other.web);assert.throws(()=>currentPair.verifyC06PassiveManifests(other),/C06_READBACK_SOURCE/);
 }
});
test('d246 reviewed change witnesses are explicitly historical metadata, not Git admission',()=>{
 const paths=Object.keys(d246HistoricalChangeWitness).sort();assert.deepEqual(paths,["apps/sites-workflow/src/workflow/workBusinessSalesRead.mjs","apps/sites-workflow/src/workflow/workBusinessSalesRead.test.mjs","apps/sites-workflow/src/workflow/workCustomers.js","apps/sites-workflow/src/workflow/workCustomersListRace.test.mjs"].sort());
 for(const p of paths){const {before,after}=d246HistoricalChangeWitness[p];assert(before===null||/^[a-f0-9]{64}$/.test(before));assert.match(after,/^[a-f0-9]{64}$/);if(before!==null)assert.notEqual(before,after);}
 assert.throws(()=>currentPair.assertCurrentApplicationInputsUnchanged(paths),/APPLICATION_CHANGED_SINCE_PIN/);
});
test('d246 synthetic import-graph fixture covers 44 sources and fails closed on drift',()=>{
 const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'apps/sites-workflow/package.json')),parse=require('@babel/parser').parse,pin=currentPair.C06_D246_SOURCE_PIN;
 assert.equal(pin,'d2466250fabc1a319f7ff0592ab39bb6903bebfb');assert.deepEqual(Object.keys(d246HistoricalImportGraph).sort(),[...currentPair.C06_D246_WEB_SOURCE_FILES].sort());
 const fixtureBlobs=new Map(currentPair.C06_D246_GIT_FILES.map(p=>[p,Object.hasOwn(d246HistoricalImportGraph,p)?d246SyntheticSource(p):Buffer.from('/* synthetic fixture '+p+' */')]));
 const closure=currentPair.currentC06WebClosure({readSource:p=>fixtureBlobs.get(p),parse,relativeImports:relativeModuleSpecifiers,sourcePin:pin});
 assert.equal(closure.size,44);for(const p of currentPair.C06_D246_WEB_SOURCE_FILES)assert(closure.has(p));
 for(const p of ['workSales.js','workBusinessSalesRead.mjs','workBusinessSalesBasketModel.mjs','savedBusinessSalesBasket.mjs','workTaskHandoff.css'])assert(closure.has('apps/sites-workflow/src/workflow/'+p));
 assert.throws(()=>currentPair.currentC06WebClosure({readSource:p=>p.endsWith('/savedBusinessSalesBasket.mjs')?Buffer.alloc(0):fixtureBlobs.get(p),parse,relativeImports:relativeModuleSpecifiers,sourcePin:pin}),/C06_WEB_CLOSURE_BYTES/);
 assert.throws(()=>currentPair.currentC06WebClosure({readSource:p=>p.endsWith('/workSales.js')?Buffer.from("import './unexpected.mjs';"):fixtureBlobs.get(p),parse,relativeImports:relativeModuleSpecifiers,sourcePin:pin}),/C06_WEB_CLOSURE_PATH/);
 const workingBytes=new Map(fixtureBlobs);assert(currentPair.assertC06GitBlobClosure({paths:currentPair.C06_D246_GIT_FILES,gitBlobs:fixtureBlobs,workingBytes,sourcePin:pin}));
 workingBytes.set('apps/sites-workflow/src/workflow/workBusinessSalesRead.mjs',Buffer.from('wrong source'));assert.throws(()=>currentPair.assertC06GitBlobClosure({paths:currentPair.C06_D246_GIT_FILES,gitBlobs:fixtureBlobs,workingBytes,sourcePin:pin}),/C06_GIT_BLOB_DRIFT/);
 const missing=new Map(fixtureBlobs);missing.delete(currentPair.C06_D246_GIT_FILES[0]);assert.throws(()=>currentPair.assertC06GitBlobClosure({paths:currentPair.C06_D246_GIT_FILES,gitBlobs:missing,workingBytes:fixtureBlobs,sourcePin:pin}),/C06_GIT_CLOSURE/);
 const extra=new Map(fixtureBlobs);extra.set('unapproved',Buffer.from('x'));assert.throws(()=>currentPair.assertC06GitBlobClosure({paths:currentPair.C06_D246_GIT_FILES,gitBlobs:extra,workingBytes:fixtureBlobs,sourcePin:pin}),/C06_GIT_CLOSURE/);
});
test('d246 independent readback rejects sales-source replacement, missing before-image and extra payload',()=>{
 for(const kind of ['blob','before','extra']){
  const f=c06PassiveFixture(currentPair.C06_D246_SOURCE_PIN),p='apps/sites-workflow/src/workflow/workBusinessSalesRead.mjs';
  if(kind==='blob')f.gitBlobs.set(p,Buffer.from('wrong sales code'));
  if(kind==='before')f.web.customerMasterSuccessor.files.find(r=>r.path===p).beforeSha256=null;
  if(kind==='extra')f.web.files.push({path:'apps/sites-workflow/src/workflow/unapproved.mjs',sha256:'a'.repeat(64),bytes:1});
  f.webBytes=bytes(f.web);assert.throws(()=>currentPair.verifyC06PassiveManifests(f),undefined,kind);
 }
});
test('C06 independent pair readback rejects wrong blobs, flags, links, overlays, SQL witnesses or source provenance',()=>{
 for(const kind of ['api-blob','web-blob','api-enabled','web-enabled','rollback','backend','source','coverage','before','sql','unexpected','base-drift','api-extra-dist','web-extra-dist','web-missing-dist','web-case-alias','retained-static','readiness','checks']){const f=c06PassiveFixture();if(kind==='api-blob')f.gitBlobs.set(currentPair.C06_API_SOURCE_FILES[0],Buffer.from('tamper'));if(kind==='web-blob')f.gitBlobs.set(currentPair.C06_WEB_PAYLOAD_FILES[0],Buffer.from('tamper'));if(kind==='api-enabled')f.api.customerMasterSuccessor.executionAuthority=true;if(kind==='web-enabled')f.web.customerMasterSuccessor.installed=true;if(kind==='rollback')f.web.customerMasterSuccessor.rollbackStatus='PASS';if(kind==='readiness')f.web.customerMasterSuccessor.installationReadiness='READY';if(kind==='checks')f.web.customerMasterSuccessor.installationChecks={...f.web.customerMasterSuccessor.installationChecks,dataProtection:'PASS'};if(kind==='backend')f.web.backendRoot+='bad';if(kind==='source')f.web.customerMasterSuccessor.sourceCommit='0'.repeat(40);if(kind==='coverage')f.api.customerMasterSuccessor.files.pop();if(kind==='before')f.web.customerMasterSuccessor.files[0].beforeSha256='0'.repeat(64);if(kind==='sql')f.api.customerMasterSuccessor.salesSqlCompatibility.sourceWitnesses[0].sha256='0'.repeat(64);if(kind==='unexpected')f.web.files.push({path:'apps/sites-workflow/unapproved.mjs',sha256:'a'.repeat(64),bytes:1});if(kind==='api-extra-dist')f.api.files.push({path:'apps/sites-workflow/dist/assets/rogue.js',sha256:'a'.repeat(64),bytes:1});if(kind==='web-extra-dist')f.web.files.push({path:'apps/sites-workflow/dist/assets/rogue.js',sha256:'a'.repeat(64),bytes:1});if(kind==='web-missing-dist')f.web.files=f.web.files.filter(x=>x.path!=='apps/sites-workflow/dist/assets/app.js');if(kind==='web-case-alias')f.web.files.push({path:'apps/sites-workflow/dist/assets/APP.js',sha256:'a'.repeat(64),bytes:1});if(kind==='retained-static')f.web.files.find(x=>x.path==='apps/sites-workflow/dist/retained-help.html').sha256='a'.repeat(64);if(kind==='base-drift'){const row={path:'apps/api/untouched.mjs',sha256:digest(baseline),bytes:baseline.length};f.apiBase.files.push(row);f.api.files.push({...row,sha256:'b'.repeat(64)});}f.apiBytes=bytes(f.api);if(['api-enabled','coverage','sql','base-drift','api-extra-dist'].includes(kind)){f.web.backendManifestSha256=digest(f.apiBytes);f.web.customerMasterSuccessor.backendManifestSha256=digest(f.apiBytes);}f.webBytes=bytes(f.web);assert.throws(()=>currentPair.verifyC06PassiveManifests(f),undefined,kind);}
});
