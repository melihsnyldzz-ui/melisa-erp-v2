// Manual local Git integration evidence; not part of offline CI unit tests.
// Requires both exact source commits locally; no network or runtime access.
import test from 'node:test';import assert from 'node:assert/strict';
import path from 'node:path';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';
import * as currentPair from './prepare-current-business-pair.mjs';
import {relativeModuleSpecifiers} from './prepare-business-sale-preview-link-package.mjs';
import fs from 'node:fs';import crypto from 'node:crypto';
import * as metadata from './prepare-customer-master-metadata-package.mjs';
test('d246 exact source delta is only the two covered sales and customer screens and their tests',()=>{
 const root=path.resolve(import.meta.dirname,'../..'),git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 const old=currentPair.C06_SUCCESSOR_SOURCE_PIN,next=currentPair.C06_D246_SOURCE_PIN;
 assert.equal(git('rev-parse',next),next);assert.equal(git('diff','--name-only',old,next,'--','apps/api','packages'),'');
 assert.equal(git('diff','--name-only',old,next,'--',...currentPair.C06_SALE_UNAPPLIED_SQL_SOURCE_FILES),'');
 const paths=git('diff','--name-only',old,next,'--','apps/sites-workflow').split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(paths,['apps/sites-workflow/src/workflow/workBusinessSalesRead.mjs','apps/sites-workflow/src/workflow/workBusinessSalesRead.test.mjs','apps/sites-workflow/src/workflow/workCustomers.js','apps/sites-workflow/src/workflow/workCustomersListRace.test.mjs'].sort());
 for(const p of paths.filter(p=>!p.includes('.test.mjs'))){assert(currentPair.C06_D246_WEB_SOURCE_FILES.includes(p));assert.notEqual(git('rev-parse',old+':'+p),git('rev-parse',next+':'+p));}
 assert.throws(()=>currentPair.assertCurrentApplicationInputsUnchanged(paths),/APPLICATION_CHANGED_SINCE_PIN/);
});
test('d246 transitive sales and customer source graph is read from the pinned Git objects and rejects missing or changed dependencies',()=>{
 const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'apps/sites-workflow/package.json')),parse=require('@babel/parser').parse,pin=currentPair.C06_D246_SOURCE_PIN;
 const gitSource=p=>execFileSync('git',['show',pin+':'+p],{cwd:root}),closure=currentPair.currentC06WebClosure({readSource:gitSource,parse,relativeImports:relativeModuleSpecifiers,sourcePin:pin});
 assert.equal(closure.size,44);for(const p of currentPair.C06_D246_WEB_SOURCE_FILES)assert(closure.has(p));
 for(const p of ['workSales.js','workBusinessSalesRead.mjs','workBusinessSalesBasketModel.mjs','savedBusinessSalesBasket.mjs','workTaskHandoff.css'])assert(closure.has('apps/sites-workflow/src/workflow/'+p));
 assert.throws(()=>currentPair.currentC06WebClosure({readSource:p=>p.endsWith('/savedBusinessSalesBasket.mjs')?Buffer.alloc(0):gitSource(p),parse,relativeImports:relativeModuleSpecifiers,sourcePin:pin}),/C06_WEB_CLOSURE_BYTES/);
 assert.throws(()=>currentPair.currentC06WebClosure({readSource:p=>p.endsWith('/workSales.js')?Buffer.from("import './unexpected.mjs';"):gitSource(p),parse,relativeImports:relativeModuleSpecifiers,sourcePin:pin}),/C06_WEB_CLOSURE_PATH/);
 const gitBlobs=new Map(currentPair.C06_D246_GIT_FILES.map(p=>[p,gitSource(p)])),workingBytes=new Map(gitBlobs);
 assert(currentPair.assertC06GitBlobClosure({paths:currentPair.C06_D246_GIT_FILES,gitBlobs,workingBytes,sourcePin:pin}));
 workingBytes.set('apps/sites-workflow/src/workflow/workBusinessSalesRead.mjs',Buffer.from('wrong source'));
 assert.throws(()=>currentPair.assertC06GitBlobClosure({paths:currentPair.C06_D246_GIT_FILES,gitBlobs,workingBytes,sourcePin:pin}),/C06_GIT_BLOB_DRIFT/);
});
test('c2ce binds the exact receiving delta and the 49-source real Git graph without changing API or SQL',()=>{
 const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'apps/sites-workflow/package.json')),parse=require('@babel/parser').parse,old=currentPair.C06_D246_SOURCE_PIN,pin=currentPair.C06_C2CE_SOURCE_PIN;
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim(),gitSource=p=>execFileSync('git',['show',pin+':'+p],{cwd:root});
 assert.equal(git('rev-parse',pin),pin);assert.equal(git('diff','--name-only',old,pin,'--','apps/api','packages',...currentPair.C06_SALE_UNAPPLIED_SQL_SOURCE_FILES),'');
 assert.deepEqual(git('diff','--name-only',old,pin,'--','apps/sites-workflow').split(/\r?\n/).filter(Boolean).sort(),['apps/sites-workflow/src/workflow/workBusinessReceivingRead.mjs','apps/sites-workflow/src/workflow/workBusinessReceivingRead.test.mjs'].sort());
 const closure=currentPair.currentC06WebClosure({readSource:gitSource,parse,relativeImports:relativeModuleSpecifiers,sourcePin:pin});assert.equal(closure.size,49);for(const p of currentPair.C06_C2CE_WEB_SOURCE_FILES)assert(closure.has(p));
 for(const name of ['workReceiving.js','workBusinessReceivingRead.mjs','workInboundJournal.mjs','workReceivingHandoff.mjs','workReceivingRecovery.mjs'])assert(closure.has('apps/sites-workflow/src/workflow/'+name));
 assert.notEqual(git('rev-parse',old+':apps/sites-workflow/src/workflow/workBusinessReceivingRead.mjs'),git('rev-parse',pin+':apps/sites-workflow/src/workflow/workBusinessReceivingRead.mjs'));
 const gitBlobs=new Map(currentPair.C06_C2CE_GIT_FILES.map(p=>[p,gitSource(p)])),workingBytes=new Map(gitBlobs);assert(currentPair.assertC06GitBlobClosure({paths:currentPair.C06_C2CE_GIT_FILES,gitBlobs,workingBytes,sourcePin:pin}));
 workingBytes.set('apps/sites-workflow/src/workflow/workBusinessReceivingRead.mjs',Buffer.from('tamper'));assert.throws(()=>currentPair.assertC06GitBlobClosure({paths:currentPair.C06_C2CE_GIT_FILES,gitBlobs,workingBytes,sourcePin:pin}),/C06_GIT_BLOB_DRIFT/);
});
test('ec80 binds collection and existing bounded session GET to the 51-source real Git graph',()=>{
 const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'apps/sites-workflow/package.json')),parse=require('@babel/parser').parse,old=currentPair.C06_C2CE_SOURCE_PIN,pin=currentPair.C06_EC80_SOURCE_PIN;
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim(),gitSource=p=>execFileSync('git',['show',pin+':'+p],{cwd:root});
 assert.equal(git('rev-parse',pin),pin);assert.equal(git('diff','--name-only',old,pin,'--','apps/api','packages',...currentPair.C06_SALE_UNAPPLIED_SQL_SOURCE_FILES),'');
 assert.deepEqual(git('diff','--name-only',old,pin,'--','apps/sites-workflow').split(/\r?\n/).filter(Boolean).sort(),['workCollections.js','workCollectionsCache.test.mjs','workInbound.test.mjs','workTrade.test.mjs','workingCatalogSession.mjs','workingCatalogSession.test.mjs'].map(n=>'apps/sites-workflow/src/workflow/'+n).sort());
 const closure=currentPair.currentC06WebClosure({readSource:gitSource,parse,relativeImports:relativeModuleSpecifiers,sourcePin:pin});assert.equal(closure.size,51);for(const p of currentPair.C06_EC80_WEB_SOURCE_FILES)assert(closure.has(p));
 for(const name of ['workCollections.js','workFinanceMovements.mjs','workingCatalogSession.mjs'])assert(closure.has('apps/sites-workflow/src/workflow/'+name));
 for(const name of ['workCollections.js','workingCatalogSession.mjs']){const p='apps/sites-workflow/src/workflow/'+name;assert.notEqual(git('rev-parse',old+':'+p),git('rev-parse',pin+':'+p));}
 const session=gitSource('apps/sites-workflow/src/workflow/workingCatalogSession.mjs').toString();assert.match(session,/cleanInvoiceListRead=cleanReadTarget/);assert.match(session,/cleanInvoiceListRead\|\|cleanCollectionContextRead\?45000/);assert(session.includes('limit=25(?![\\s\\S])'));
 const gitBlobs=new Map(currentPair.C06_EC80_GIT_FILES.map(p=>[p,gitSource(p)])),workingBytes=new Map(gitBlobs);assert(currentPair.assertC06GitBlobClosure({paths:currentPair.C06_EC80_GIT_FILES,gitBlobs,workingBytes,sourcePin:pin}));
 workingBytes.set('apps/sites-workflow/src/workflow/workingCatalogSession.mjs',Buffer.from('tamper'));assert.throws(()=>currentPair.assertC06GitBlobClosure({paths:currentPair.C06_EC80_GIT_FILES,gitBlobs,workingBytes,sourcePin:pin}),/C06_GIT_BLOB_DRIFT/);
});
test('6d binds exact unverified-collection display delta to the 51-source real Git graph',()=>{
 const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'apps/sites-workflow/package.json')),parse=require('@babel/parser').parse,old=currentPair.C06_EC80_SOURCE_PIN,pin=currentPair.C06_6D_SOURCE_PIN;
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim(),gitSource=p=>execFileSync('git',['show',pin+':'+p],{cwd:root});
 assert.equal(git('rev-parse',pin),pin);git('merge-base','--is-ancestor',old,pin);assert.equal(git('diff','--name-only',old,pin,'--','apps/api','packages',...currentPair.C06_SALE_UNAPPLIED_SQL_SOURCE_FILES),'');
 const names=['workCollections.js','workCollectionsCache.test.mjs','workCustomers.js','workFinanceMovements.mjs','workFinanceMovements.test.mjs','workOpenAccountPresentation.mjs','workOpenAccountPresentation.test.mjs','workSales.js'];
 const changed=git('diff','--name-only',old,pin,'--','apps/sites-workflow').split(/\r?\n/).filter(Boolean).sort();assert.deepEqual(changed,names.map(n=>'apps/sites-workflow/src/workflow/'+n).sort());
 const closure=currentPair.currentC06WebClosure({readSource:gitSource,parse,relativeImports:relativeModuleSpecifiers,sourcePin:pin});assert.equal(closure.size,51);for(const p of currentPair.C06_EC80_WEB_SOURCE_FILES)assert(closure.has(p));
 for(const name of names.filter(n=>!n.endsWith('.test.mjs'))){const p='apps/sites-workflow/src/workflow/'+name;assert(closure.has(p));assert.notEqual(git('rev-parse',old+':'+p),git('rev-parse',pin+':'+p));}
 for(const name of names.filter(n=>n.endsWith('.test.mjs')))assert(!closure.has('apps/sites-workflow/src/workflow/'+name));
 assert.throws(()=>currentPair.assertCurrentApplicationInputsUnchanged(changed),/APPLICATION_CHANGED_SINCE_PIN/);
 const gitBlobs=new Map(currentPair.C06_EC80_GIT_FILES.map(p=>[p,gitSource(p)])),workingBytes=new Map(gitBlobs);assert(currentPair.assertC06GitBlobClosure({paths:currentPair.C06_EC80_GIT_FILES,gitBlobs,workingBytes,sourcePin:pin}));workingBytes.set('apps/sites-workflow/src/workflow/workFinanceMovements.mjs',Buffer.from('tamper'));assert.throws(()=>currentPair.assertC06GitBlobClosure({paths:currentPair.C06_EC80_GIT_FILES,gitBlobs,workingBytes,sourcePin:pin}),/C06_GIT_BLOB_DRIFT/);
});
test('d670 real pinned Git and read-only P7 before image bind the complete API and WEB closures',()=>{
 const root=path.resolve(import.meta.dirname,'../..'),parse=createRequire(path.join(root,'apps/sites-workflow/package.json'))('@babel/parser').parse,pin=currentPair.C06_D670_SOURCE_PIN;
 const git=(...args)=>execFileSync('git',args,{cwd:root}),source=p=>git('show',pin+':'+p),raw=fs.readFileSync(path.win32.join(currentPair.C06_BASE.api,'release-manifest.json')),digest=b=>crypto.createHash('sha256').update(b).digest('hex');
 assert.equal(digest(raw),currentPair.C06_BASE.apiSha256);const rows=new Map(JSON.parse(raw).files.map(x=>[x.path,x]));
 const readBase=p=>{const row=rows.get(p);assert(row,'missing baseline '+p);const bytes=fs.readFileSync(path.win32.join(currentPair.C06_BASE.api,...p.split('/')));assert.equal(digest(bytes),row.sha256);return bytes;};
 assert.deepEqual(currentPair.C06_D670_API_SOURCE_FILES,metadata.C06_D670_API_FILES);assert.deepEqual(currentPair.C06_D670_NEW_API_FILES,metadata.C06_D670_NEW_API_FILES);
 const api=metadata.customerMetadataClosure(currentPair.C06_D670_API_SOURCE_FILES,{readSource:source,readBase,basePaths:new Set(rows.keys()),parse,newFiles:currentPair.C06_D670_NEW_API_FILES});assert.equal(api.source.size,20);assert.equal(api.sourceFiles,379);
 const web=currentPair.currentC06WebClosure({readSource:source,parse,relativeImports:relativeModuleSpecifiers,sourcePin:pin});assert.equal(web.size,59);for(const p of currentPair.C06_D670_WEB_SOURCE_FILES)assert(web.has(p));
 const changed=git('diff','--name-only',currentPair.C06_6D_SOURCE_PIN,pin,'--','apps/api','apps/sites-workflow','packages').toString().trim().split(/\r?\n/).filter(p=>p&&!/\.test\./.test(p));assert.equal(changed.length,9);for(const p of changed)assert(currentPair.C06_D670_GIT_FILES.includes(p),'unbound runtime source '+p);
});

test('f17 real pinned Git and read-only P7 before image bind the complete API and WEB closures',()=>{
 const root=path.resolve(import.meta.dirname,'../..'),parse=createRequire(path.join(root,'apps/sites-workflow/package.json'))('@babel/parser').parse,pin=currentPair.C06_F17_SOURCE_PIN;
 const git=(...args)=>execFileSync('git',args,{cwd:root}),source=p=>git('show',pin+':'+p),raw=fs.readFileSync(path.win32.join(currentPair.C06_BASE.api,'release-manifest.json')),digest=b=>crypto.createHash('sha256').update(b).digest('hex');
 assert.equal(digest(raw),currentPair.C06_BASE.apiSha256);const rows=new Map(JSON.parse(raw).files.map(x=>[x.path,x]));
 const readBase=p=>{const row=rows.get(p);assert(row,'missing baseline '+p);const bytes=fs.readFileSync(path.win32.join(currentPair.C06_BASE.api,...p.split('/')));assert.equal(digest(bytes),row.sha256);return bytes;};
 assert.deepEqual(currentPair.C06_D670_API_SOURCE_FILES,metadata.C06_D670_API_FILES);assert.deepEqual(currentPair.C06_D670_NEW_API_FILES,metadata.C06_D670_NEW_API_FILES);
 const api=metadata.customerMetadataClosure(currentPair.C06_D670_API_SOURCE_FILES,{readSource:source,readBase,basePaths:new Set(rows.keys()),parse,newFiles:currentPair.C06_D670_NEW_API_FILES});assert.equal(api.source.size,20);assert.equal(api.sourceFiles,379);
 const web=currentPair.currentC06WebClosure({readSource:source,parse,relativeImports:relativeModuleSpecifiers,sourcePin:pin});assert.equal(web.size,59);for(const p of currentPair.C06_D670_WEB_SOURCE_FILES)assert(web.has(p));
 const changed=git('diff','--name-only',currentPair.C06_D670_SOURCE_PIN,pin,'--','apps/api','apps/sites-workflow','packages').toString().trim().split(/\r?\n/).filter(p=>p&&!/\.test\./.test(p));assert.deepEqual(changed,['apps/sites-workflow/src/workflow/workBusinessSalesRead.mjs']);for(const p of changed)assert(currentPair.C06_D670_GIT_FILES.includes(p),'unbound runtime source '+p);
});
