import test from 'node:test';import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {featurePackageSpec,validateFeatureManifest,assertFeatureEntry,verifyFeatureSources,FEATURE_ENTRY,FEATURE_SOURCE_FILES} from './terminal-worktest-package.mjs';
const commit='a'.repeat(40),hash='b'.repeat(64),root='C:\\Sirket\\ERP\\releases\\CANONICAL-COMPLETE-TEST-20261011-aaaaaaaaaaaa';
const args=['--feature-package',root,'--source-commit',commit,'--manifest-sha256',hash];
const manifest={sourceCommit:commit,packageId:'CANONICAL-TEST-'+commit.slice(0,12),sharedTestCopy:{database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',apiPort:4184,nativePort:4186,webPort:5234,host:'127.0.0.1',nativeLoopbackOnly:true,nativeWrites:false,externalOperations:false,actualT1:false},files:['terminal.html','ornek-akis.html','kullanim-egitimi.html','assets/terminal-a.js'].map(p=>({path:'apps/sites-workflow/dist-business/'+p,sha256:hash}))};
test('feature package is explicit new release root, exact commit and manifest hash; default is development only',()=>{assert.equal(featurePackageSpec([]),null);assert.equal(featurePackageSpec(args).root,root);for(const a of [args.slice(0,4),[...args,'extra'],['--feature-package','C:\\Sirket\\ERP\\melisa-erp-v2',...args.slice(2)],['--feature-package',root+'\\..',...args.slice(2)],args.map((a,i)=>i===3?'c'.repeat(40):a),args.map((a,i)=>i===5?'x'.repeat(64):a)])assert.throws(()=>featurePackageSpec(a));});
test('new web package retains exact DB02 isolation and cannot claim another API/native port or T1 authority',()=>{assert.equal(validateFeatureManifest(manifest,featurePackageSpec(args)).size,4);for(const patch of [{database:'LIVE'},{apiPort:4194},{webPort:5194},{actualT1:true},{externalOperations:true},{nativeWrites:true},{nativeLoopbackOnly:false}])assert.throws(()=>validateFeatureManifest({...manifest,sharedTestCopy:{...manifest.sharedTestCopy,...patch}},featurePackageSpec(args)));assert.throws(()=>validateFeatureManifest({...manifest,sourceCommit:'c'.repeat(40)},featurePackageSpec(args)));});
test('web entries require complete page set, unique safe paths and exact sha256',()=>{for(const files of [manifest.files.slice(1),[...manifest.files,manifest.files[0]],[...manifest.files,{path:'apps/sites-workflow/dist-business/../private',sha256:hash}],[...manifest.files,{path:'assets/a.js',sha256:'x'}]])assert.throws(()=>validateFeatureManifest({...manifest,files},featurePackageSpec(args)));});

test('feature entry must be the exact packaged script, never canonical source or another release',()=>{
 const spec=featurePackageSpec(args),entry=path.win32.join(root,...FEATURE_ENTRY.split('/'));assert.doesNotThrow(()=>assertFeatureEntry(spec,entry));
 for(const bad of ['C:\\Sirket\\ERP\\melisa-erp-v2\\scripts\\canonical\\start-terminal-worktest.mjs',entry.replace('aaaaaaaaaaaa','bbbbbbbbbbbb'),entry+'\\..',entry.replace('start-terminal-worktest','other')])assert.throws(()=>assertFeatureEntry(spec,bad),{code:'WORKTEST_PACKAGE_PIN'});
});

test('all real transitive starter modules are hashed; backend drift or omission fails before package readiness',async()=>{
 const data=new Map();for(const file of FEATURE_SOURCE_FILES)data.set(file,await readFile(new URL('../../'+file,import.meta.url)));
 const files=[...data].map(([file,bytes])=>({path:file,sha256:createHash('sha256').update(bytes).digest('hex')}));const m={...manifest,files:[...manifest.files,...files]};
 await verifyFeatureSources(m,async p=>data.get(p));
 for(const file of FEATURE_SOURCE_FILES){
  await assert.rejects(()=>verifyFeatureSources(m,async p=>p===file?Buffer.concat([data.get(p),Buffer.from('\n// changed')]):data.get(p)),{code:'WORKTEST_PACKAGE_PIN'});
  await assert.rejects(()=>verifyFeatureSources({...m,files:m.files.filter(r=>r.path!==file)},async p=>data.get(p)),{code:'WORKTEST_PACKAGE_PIN'});
 }
 const invoiceReader='apps/api/src/services/businessSelectedSaleInvoiceRead.mjs';await assert.rejects(()=>verifyFeatureSources({...m,files:m.files.filter(r=>r.path!==invoiceReader)},async p=>data.get(p)),{code:'WORKTEST_PACKAGE_PIN'});
 for(const pin of ['apps/api/src/services/customerContactStartupPin.mjs','scripts/canonical/shared-business-customer-contact-contract.mjs','scripts/canonical/shared-business-customer-contact-sql.mjs'])assert(FEATURE_SOURCE_FILES.includes(pin));
 const target='apps/api/src/services/terminalCartonStore.mjs';for(const addition of ["\nimport './unlisted-source.mjs';","\nexport {x} from '../../../outside.mjs';","\nimport('file:///arbitrary.mjs');","\nimport external from 'unlisted-package';"]){const changed=Buffer.concat([data.get(target),Buffer.from(addition)]),pin=createHash('sha256').update(changed).digest('hex');await assert.rejects(()=>verifyFeatureSources({...m,files:m.files.map(r=>r.path===target?{...r,sha256:pin}:r)},async p=>p===target?changed:data.get(p)),{code:'WORKTEST_PACKAGE_PIN'});}
});
test('terminal HOME pins only the pure injected graph; dynamic default wrappers stay outside it',()=>{
 for(const file of ['apps/api/src/services/homeSummaryReadStore.mjs','apps/api/src/services/homeSummaryService.mjs','apps/api/src/services/isolatedOperationCopyStore.mjs','apps/api/src/middleware/businessInboundSelection.mjs','apps/api/src/config/database.js','apps/api/src/services/productCopyPurchaseReferenceService.mjs','apps/api/src/services/productLastPurchaseReferenceService.mjs','apps/api/src/services/customerContactStartup.mjs','scripts/canonical/shared-business-customer-contact-bootstrap.mjs'])assert.equal(FEATURE_SOURCE_FILES.includes(file),false);
 assert.equal(new Set(FEATURE_SOURCE_FILES).size,FEATURE_SOURCE_FILES.length);
});
test('pure purchase startup pin retains the exact service compatibility export',async()=>{
 const pure=await import('../../apps/api/src/services/productCopyPurchaseReferencePin.mjs');
 const service=await import('../../apps/api/src/services/productCopyPurchaseReferenceService.mjs');
 assert.strictEqual(service.validateProductCopyPurchaseReferencePin,pure.validateProductCopyPurchaseReferencePin);
 assert(FEATURE_SOURCE_FILES.includes('apps/api/src/services/productCopyPurchaseReferencePin.mjs'));
});

test('pure contact startup pin retains the exact runtime compatibility export',async()=>{
 const pure=await import('../../apps/api/src/services/customerContactStartupPin.mjs');
 const runtime=await import('../../apps/api/src/services/customerContactStartup.mjs');
 assert.strictEqual(runtime.validateCustomerContactStartup,pure.validateCustomerContactStartup);
});
