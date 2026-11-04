// In-memory fixtures only; no child process, fixture paths, link or cleanup.
import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';import path from 'node:path';
import * as pair from './prepare-current-business-pair.mjs';import * as metadata from './prepare-customer-master-metadata-package.mjs';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),baseline=Buffer.from('before');
const row=p=>({path:p,sha256:hash(baseline),bytes:baseline.length});
const webAdded=new Set(['apps/sites-workflow/src/workflow/workCustomerMaster.mjs','apps/sites-workflow/src/workflow/savedBusinessSalesBasket.mjs','apps/sites-workflow/business-web-gateway.mjs','apps/sites-workflow/business-web-release.mjs','apps/sites-workflow/business-web-backend-proof.ps1']);
const expectedFour=['workInboundFx.js','workInboundFxModel.mjs','workPurchasePresentation.mjs','workPurchases.js'].map(n=>'apps/sites-workflow/src/workflow/'+n);
function webFixture(){const files=pair.C06_154_WEB_PAYLOAD_FILES,base={files:files.filter(p=>!webAdded.has(p)).map(row)},overlays=new Map(files.map(p=>[p,Buffer.from('source '+p)]));return {base,overlays};}
function apiFixture(){
 const old=Buffer.from(`before\nif(mode==='erp'&&writes&&businessSession){\n const {prepareCanonicalCustomerMasterMetadata}=await import('./src/services/customerMasterMetadataBootstrap.mjs');\n app.use('/api',createCustomerMasterMetadataRoutes({reader}));\n}\nif(!isCanonicalTestWriteAllowed(req.method,req.path,{writes,mode,protectedNormalAuth:!!businessSession}))throw Error('fixture');\nif(mode==='erp'){\n  if(businessSession){\n  }\n}\n`);
 const next=Buffer.from(`before\nlet customerMasterWriterRoutes=null;\nif(mode==='erp'&&writes&&businessSession){\n const {prepareCanonicalCustomerMasterMetadata,prepareCanonicalCustomerMasterWriter}=await import('./src/services/customerMasterMetadataBootstrap.mjs');\n app.use('/api',createCustomerMasterMetadataRoutes({reader}));\n if(config.customerMasterWritesEnabled===true)customerMasterWriterRoutes=await prepareCanonicalCustomerMasterWriter({startup:{...canonicalStartup,mode},database});\n}\nif(!isCanonicalTestWriteAllowed(req.method,req.path,{writes,mode,protectedNormalAuth:!!businessSession,customerMasterWriterReady:!!customerMasterWriterRoutes}))throw Error('fixture');\nif(mode==='erp'){\n  if(customerMasterWriterRoutes)app.use('/api',customerMasterWriterRoutes);\n  if(businessSession){\n  }\n}\n`);
 const added=new Set(metadata.C06_D670_NEW_API_FILES),oldPaths=metadata.C06_D670_API_FILES.filter(p=>!added.has(p));
 const previousBytes=new Map(oldPaths.map(p=>[p,p===metadata.CUSTOMER_METADATA_ENTRY?old:Buffer.from('OLD '+p)])),overlays=new Map(metadata.C06_D670_API_FILES.map(p=>[p,p===metadata.CUSTOMER_METADATA_ENTRY?next:Buffer.from('NEW '+p)]));
 const normal=['apps/api/canonical-test-env.mjs',metadata.CUSTOMER_METADATA_ENTRY,'apps/api/src/services/canonicalTestRoutePolicy.mjs',...Array.from({length:11},(_,i)=>'apps/api/fixture-normal-'+i+'.mjs')];
 const all=new Map(previousBytes);for(const p of normal)if(!all.has(p))all.set(p,Buffer.from('OLD '+p));
 const files=[...all].map(([path,b])=>({path,sha256:hash(b),bytes:b.length})),base={database:'MELISA_ERP_SIRKET_TEST_20260929_01',actualT1:false,externalOperations:false,files,currentBusinessPair:{masterWriterEnabled:false},customerMasterMetadataOverlay:{masterWriterEnabled:false},businessNormalSessionClosure:{version:1,files:normal.map(p=>({path:p,sha256:hash(all.get(p))}))}},baseBytes=Buffer.from(JSON.stringify(base));
 return {baseBytes,baseDigest:hash(baseBytes),sourceCommit:pair.C06_154_SOURCE_PIN,sourcePin:pair.C06_154_SOURCE_PIN,producerCommit:'9'.repeat(40),overlays,previousBytes};
}
test('ERP154 pin and purchase closure keep all previous source sets without broadening',()=>{
 assert.equal(pair.C06_154_SOURCE_PIN,'154f73c790e8cbafb6bc1e291f19b7e1751c9c8b');assert.equal(metadata.C06_154_SOURCE_PIN,pair.C06_154_SOURCE_PIN);assert.equal(pair.C06_154_WEB_SOURCE_FILES.length,63);
 assert.deepEqual(pair.C06_154_WEB_SOURCE_FILES.slice(pair.C06_D670_WEB_SOURCE_FILES.length),expectedFour);assert(pair.C06_154_WEB_ROOTS.includes(expectedFour[3]));
 const files=pair.C06_154_WEB_SOURCE_FILES,first=pair.C06_154_WEB_ROOTS[0],graph=new Map(files.map(p=>[p,[]]));
 graph.set(first,files.filter(p=>p!==first).map(p=>{const spec=path.posix.relative(path.posix.dirname(first),p);return spec.startsWith('.')?spec:'./'+spec;}));
 const readSource=p=>Buffer.from(p),relativeImports=text=>graph.get(text)??[];
 assert.equal(pair.currentC06WebClosure({readSource,relativeImports,sourcePin:pair.C06_154_SOURCE_PIN}).size,63);
 const bad=new Map(graph);bad.set(first,['./unapproved.mjs']);assert.throws(()=>pair.currentC06WebClosure({readSource,relativeImports:text=>bad.get(text)??[],sourcePin:pair.C06_154_SOURCE_PIN}),/C06_WEB_CLOSURE_PATH/);
 assert.throws(()=>pair.currentC06WebClosure({readSource:p=>p===expectedFour[0]?Buffer.alloc(0):readSource(p),relativeImports,sourcePin:pair.C06_154_SOURCE_PIN}),/C06_WEB_CLOSURE_BYTES/);
 for(const pin of [pair.C06_SUCCESSOR_SOURCE_PIN,pair.C06_D246_SOURCE_PIN,pair.C06_C2CE_SOURCE_PIN,pair.C06_EC80_SOURCE_PIN,pair.C06_6D_SOURCE_PIN,pair.C06_D670_SOURCE_PIN,pair.C06_F17_SOURCE_PIN])assert(pair.assertC06SuccessorPinned(pin));
});
test('ERP154 API exact 20 overlays preserve new-versus-before proof and old case scope',()=>{
 const f=apiFixture(),m=metadata.buildCustomerMasterSuccessorApiManifest(f);assert.equal(m.customerMasterSuccessor.files.length,20);assert.equal(m.customerMasterSuccessor.executionAuthority,false);assert.equal(m.customerMasterSuccessor.installed,false);
 for(const p of metadata.C06_D670_API_FILES){const r=m.customerMasterSuccessor.files.find(x=>x.path===p);assert.equal(r.sha256,hash(f.overlays.get(p)));assert.equal(r.beforeSha256,f.previousBytes.has(p)?hash(f.previousBytes.get(p)):null);}
 for(const kind of ['missing','extra','before']){const bad=apiFixture();if(kind==='missing')bad.overlays.delete(metadata.C06_D670_API_FILES.at(-1));if(kind==='extra')bad.overlays.set('apps/api/other.mjs',baseline);if(kind==='before')bad.previousBytes.set('apps/api/canonical-test-env.mjs',Buffer.from('changed'));assert.throws(()=>metadata.buildCustomerMasterSuccessorApiManifest(bad));}
 const old=apiFixture();old.sourcePin=old.sourceCommit=pair.C06_SUCCESSOR_SOURCE_PIN;assert.throws(()=>metadata.buildCustomerMasterSuccessorApiManifest(old));
});
test('ERP154 WEB exact overlays and candidate path stay fail closed',async()=>{
 const f=webFixture(),rows=pair.currentC06WebPayloadRows({...f,sourcePin:pair.C06_154_SOURCE_PIN});for(const p of pair.C06_154_WEB_PAYLOAD_FILES)assert.equal(rows.find(r=>r.path===p).sha256,hash(f.overlays.get(p)));
 for(const p of expectedFour){assert(f.base.files.some(r=>r.path===p));const bad=webFixture();bad.base.files=bad.base.files.filter(r=>r.path!==p);assert.throws(()=>pair.currentC06WebPayloadRows({...bad,sourcePin:pair.C06_154_SOURCE_PIN}));}
 for(const kind of ['missing','extra']){const bad=webFixture();if(kind==='missing')bad.overlays.delete(expectedFour[0]);else bad.overlays.set('apps/sites-workflow/other.js',baseline);assert.throws(()=>pair.currentC06WebPayloadRows({...bad,sourcePin:pair.C06_154_SOURCE_PIN}));}
 const source=pair.C06_154_SOURCE_PIN,blobs=new Map(pair.C06_154_GIT_FILES.map(p=>[p,Buffer.from('blob '+p)])),working=new Map(blobs);assert(pair.assertC06GitBlobClosure({paths:pair.C06_154_GIT_FILES,gitBlobs:blobs,workingBytes:working,sourcePin:source}));working.set(expectedFour[3],Buffer.from('changed'));assert.throws(()=>pair.assertC06GitBlobClosure({paths:pair.C06_154_GIT_FILES,gitBlobs:blobs,workingBytes:working,sourcePin:source}));
 assert.notDeepEqual(pair.c06CandidateRoots('9'.repeat(40),source),pair.c06CandidateRoots('9'.repeat(40),pair.C06_F17_SOURCE_PIN));await assert.rejects(()=>pair.prepareC06BusinessPair('9'.repeat(40),source),/C06_154_OUTPUT_PARENT_UNVERIFIED/);
});
