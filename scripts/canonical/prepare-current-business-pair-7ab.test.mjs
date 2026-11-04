// Pure synthetic fixtures only. No Git, subprocess, package, path mutation or SQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as pair from './prepare-current-business-pair.mjs';
import * as metadata from './prepare-customer-master-metadata-package.mjs';
import * as runner from './local-c06-test-runner.mjs';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const addedApi=['apps/api/src/config/canonicalReadonlyAuthQuery.mjs','apps/api/src/routes/c06SaleReadonlyMetadataRoutes.mjs','apps/api/src/services/c06SaleReadonlyMetadata.mjs'];
function apiFixture(){
 const before=Buffer.from(`before\nif(mode==='erp'&&writes&&businessSession){\n const {prepareCanonicalCustomerMasterMetadata}=await import('./src/services/customerMasterMetadataBootstrap.mjs');\n app.use('/api',createCustomerMasterMetadataRoutes({reader}));\n}\nif(!isCanonicalTestWriteAllowed(req.method,req.path,{writes,mode,protectedNormalAuth:!!businessSession}))throw Error('fixture');\nif(mode==='erp'){\n  if(businessSession){\n  }\n}else{\n  app.locals.nativeTerminalV1=true;\n}\n`);
 const after=Buffer.from(`before\nlet customerMasterWriterRoutes=null;\nif(mode==='erp'&&writes&&businessSession){\n const {prepareCanonicalCustomerMasterMetadata,prepareCanonicalCustomerMasterWriter}=await import('./src/services/customerMasterMetadataBootstrap.mjs');\n app.use('/api',createCustomerMasterMetadataRoutes({reader}));\n if(config.customerMasterWritesEnabled===true)customerMasterWriterRoutes=await prepareCanonicalCustomerMasterWriter({startup:{...canonicalStartup,mode},database});\n}\nif(!isCanonicalTestWriteAllowed(req.method,req.path,{writes,mode,protectedNormalAuth:!!businessSession,customerMasterWriterReady:!!customerMasterWriterRoutes}))throw Error('fixture');\nif(mode==='erp'){\n  if(customerMasterWriterRoutes)app.use('/api',customerMasterWriterRoutes);\n  if(businessSession){\n  }\n}else{\n  app.locals.nativeTerminalV1=true;\n  const {createC06SaleReadonlyMetadataRoutes}=await import('./src/routes/c06SaleReadonlyMetadataRoutes.mjs');\n  app.use('/api',createC06SaleReadonlyMetadataRoutes());\n}\n`);
 const additions=new Set(metadata.C06_7AB_NEW_API_FILES),previousBytes=new Map(metadata.C06_7AB_API_FILES.filter(p=>!additions.has(p)).map(p=>[p,p===metadata.CUSTOMER_METADATA_ENTRY?before:Buffer.from('OLD '+p)]));
 const overlays=new Map(metadata.C06_7AB_API_FILES.map(p=>[p,p===metadata.CUSTOMER_METADATA_ENTRY?after:Buffer.from('NEW '+p)]));
 const normal=['apps/api/canonical-test-env.mjs',metadata.CUSTOMER_METADATA_ENTRY,'apps/api/src/services/canonicalTestRoutePolicy.mjs',...Array.from({length:11},(_,i)=>'apps/api/fixture-normal-'+i+'.mjs')];
 const all=new Map(previousBytes);for(const p of normal)if(!all.has(p))all.set(p,Buffer.from('OLD '+p));
 const files=[...all].map(([path,b])=>({path,sha256:hash(b),bytes:b.length}));
 const base={database:'MELISA_ERP_SIRKET_TEST_20260929_01',actualT1:false,externalOperations:false,files,currentBusinessPair:{masterWriterEnabled:false},customerMasterMetadataOverlay:{masterWriterEnabled:false},businessNormalSessionClosure:{version:1,files:normal.map(p=>files.find(r=>r.path===p))}};
 const baseBytes=Buffer.from(JSON.stringify(base));return {baseBytes,baseDigest:hash(baseBytes),sourceCommit:pair.C06_7AB_SOURCE_PIN,sourcePin:pair.C06_7AB_SOURCE_PIN,producerCommit:'9'.repeat(40),overlays,previousBytes};
}
test('7ab is an exact additive source case; old source scopes remain unchanged',()=>{
 assert.equal(pair.C06_7AB_SOURCE_PIN,'7ab1ebd85841bd53c8a0daeae1eedecd076282af');assert.equal(metadata.C06_7AB_SOURCE_PIN,pair.C06_7AB_SOURCE_PIN);
 assert.deepEqual(pair.C06_7AB_API_SOURCE_FILES,metadata.C06_7AB_API_FILES);assert.deepEqual(pair.C06_7AB_NEW_API_FILES,metadata.C06_7AB_NEW_API_FILES);
 assert.equal(pair.C06_7AB_API_SOURCE_FILES.length,24);for(const p of ['apps/api/src/config/database.js',...addedApi]){assert(pair.C06_7AB_GIT_FILES.includes(p));assert(!pair.C06_154_GIT_FILES.includes(p));}
 assert(pair.C06_154_WEB_SOURCE_FILES.includes('apps/sites-workflow/src/workflow/workSuppliers.js'));
 assert.equal(new Set(pair.C06_7AB_GIT_FILES).size,pair.C06_7AB_GIT_FILES.length);
 assert.throws(()=>pair.assertC06SuccessorPinned('a'.repeat(40)),/C06_SOURCE_PIN/);
});
test('7ab exact API overlays require old database before-image and native-only startup delta',()=>{
 const f=apiFixture(),m=metadata.buildCustomerMasterSuccessorApiManifest(f);assert.equal(m.customerMasterSuccessor.files.length,24);assert.equal(m.customerMasterSuccessor.executionAuthority,false);assert.equal(m.customerMasterSuccessor.installed,false);
 const db=m.customerMasterSuccessor.files.find(x=>x.path==='apps/api/src/config/database.js');assert.equal(db.beforeSha256,hash(f.previousBytes.get(db.path)));for(const p of addedApi)assert.equal(m.customerMasterSuccessor.files.find(x=>x.path===p).beforeSha256,null);
 for(const kind of ['missing','extra','before','startup']){const bad=apiFixture();if(kind==='missing')bad.overlays.delete(addedApi[0]);if(kind==='extra')bad.overlays.set('apps/api/not-approved.mjs',Buffer.from('x'));if(kind==='before')bad.previousBytes.set('apps/api/src/config/database.js',Buffer.from('changed'));if(kind==='startup')bad.overlays.set(metadata.CUSTOMER_METADATA_ENTRY,Buffer.from(bad.overlays.get(metadata.CUSTOMER_METADATA_ENTRY).toString().replace('nativeTerminalV1=true','nativeTerminalV1=false')));assert.throws(()=>metadata.buildCustomerMasterSuccessorApiManifest(bad));}
 const old=apiFixture();old.sourcePin=old.sourceCommit=pair.C06_154_SOURCE_PIN;assert.throws(()=>metadata.buildCustomerMasterSuccessorApiManifest(old));
});
test('7ab git witnesses, scoped test inputs and output parent remain fail-closed',async()=>{
 const files=pair.C06_7AB_GIT_FILES,gitBlobs=new Map(files.map(p=>[p,Buffer.from('blob '+p)])),workingBytes=new Map(gitBlobs);
 assert(pair.assertC06GitBlobClosure({paths:files,gitBlobs,workingBytes,sourcePin:pair.C06_7AB_SOURCE_PIN}));
 for(const p of ['apps/api/src/config/database.js',...addedApi]){const bad=new Map(workingBytes);bad.set(p,Buffer.from('drift'));assert.throws(()=>pair.assertC06GitBlobClosure({paths:files,gitBlobs,workingBytes:bad,sourcePin:pair.C06_7AB_SOURCE_PIN}),/C06_GIT_BLOB_DRIFT/);}
 const before=runner.localC06InputPaths(),next=runner.localC06InputPaths7ab();assert.equal(before.length,36);assert.equal(next.length,42);assert.equal(new Set(next).size,42);assert.deepEqual(next.slice(0,36),before);assert(next.some(p=>p.endsWith('canonicalReadonlyAuthQuery.test.mjs')));assert(next.some(p=>p.endsWith('workSupplierCardSwitch.test.mjs')));
 assert.notDeepEqual(pair.c06CandidateRoots('9'.repeat(40),pair.C06_7AB_SOURCE_PIN),pair.c06CandidateRoots('9'.repeat(40),pair.C06_154_SOURCE_PIN));
 await assert.rejects(()=>pair.prepareC06BusinessPair('9'.repeat(40),pair.C06_7AB_SOURCE_PIN),/C06_7AB_OUTPUT_PARENT_UNVERIFIED/);
});
