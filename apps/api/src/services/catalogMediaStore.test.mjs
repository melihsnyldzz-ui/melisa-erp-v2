import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createCatalogMediaStore,parseCatalogMediaVariant} from './catalogMediaStore.mjs';
const source='VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/12';
const row=()=>({id:'12',stockCode:'0012',provenance:{kind:'accepted-opening',verified:true,sourceKey:source,runId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30'},hold:{blocked:false},photo:{status:'missing',url:null,sourceKey:null,verified:false}});
test('v2 source lineage retains authentic old photo binding; wrongstock/source/hold and new products do not inherit photos',async t=>{const f=await fixture(t);await f.store.configure(f.context);const r=row();r.provenance.runId='GOAL7-00000000-0000-4000-8000-000000000001';r.provenance.sourceAsOf='2026-10-07';assert.equal(f.store.photoFor(r).status,'missing');r.mediaProvenance={sourceKey:source,runId:'VEGA-OPENING-TEST-20261004-06'};assert.equal(f.store.photoFor(r).status,'available');assert.deepEqual((await f.store.readPhoto(r,'preview')).bytes,f.bytes);for(const edit of [x=>x.stockCode='other',x=>x.id='13',x=>x.provenance.sourceKey+='0',x=>x.mediaProvenance.runId='other',x=>x.hold.blocked=true]){const bad=structuredClone(r);edit(bad);assert.equal(f.store.photoFor(bad).status,'missing');await assert.rejects(()=>f.store.readPhoto(bad,'preview'));}});
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'melisa-media-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const bytes=Buffer.from([255,216,255,224,1,2,255,217]),sha=createHash('sha256').update(bytes).digest('hex');
 const entry={productId:'12',stockCode:'0012',sourceKey:source,runId:'VEGA-OPENING-TEST-20261004-06',sourceSha256:sha,sourceFileName:'0012.jpg',validationStatus:'CONFIRMED',validatedAt:'2026-10-05T13:00:00.000Z'};
 for(const variant of ['original','thumbnail','preview']){await fs.mkdir(path.join(root,variant));await fs.writeFile(path.join(root,variant,sha+'.jpg'),bytes);entry[variant]={relativePath:variant+'/'+sha+'.jpg',sha256:sha,bytes:bytes.length};}
 const index={schemaVersion:'melisa-erp.catalog-media.v1',server:'Semih\\MELISADEV',database:'MELISA_ERP_SIRKET_TEST_20260929_01',planRecordsSha256:'5da967d2652aa0d6710ad206ac10b7a5898d5a8af7ff3f45e048669e15d22b6d',batchId:'D04-batch',entries:[entry]};
 const publish=()=>fs.writeFile(path.join(root,'index.json'),JSON.stringify(index));await publish();
 const store=createCatalogMediaStore({expectedRoot:root,expectedCount:1}),context={root,indexSha256:createHash('sha256').update(await fs.readFile(path.join(root,'index.json'))).digest('hex'),mode:'erp',port:4144,writes:true,identity:{serverName:index.server,databaseName:index.database,sysadmin:0,databaseControl:0,liveDatabaseAccess:0}};return {root,bytes,sha,entry,index,store,context,publish};
}
test('disabled registry leaves missing shape and denies bytes; query cannot contain tokens or paths',async()=>{
 const store=createCatalogMediaStore();assert.deepEqual(store.photoFor(row()),row().photo);await assert.rejects(()=>store.readPhoto(row(),'preview'),{statusCode:404});assert.equal(parseCatalogMediaVariant({}),'preview');
 for(const q of [null,[],{token:'secret'},{variant:'../original'},{variant:['preview']}])assert.throws(()=>parseCatalogMediaVariant(q),{statusCode:400});
});
test('verified startup registry overlays exact current identity and reads hash-checked JPEG',async t=>{
 const f=await fixture(t);await f.store.configure(f.context);const photo=f.store.photoFor(row());assert.equal(photo.status,'available');assert.equal(photo.sha256,f.sha);assert.equal(photo.thumbnailUrl,'/api/catalog/products/12/photo?variant=thumbnail');assert.deepEqual((await f.store.readPhoto(row(),'preview')).bytes,f.bytes);
 assert.deepEqual(JSON.parse(f.store.filterBindingsJson()),[{productId:'12',stockCode:'0012',sourceKey:source,runId:'VEGA-OPENING-TEST-20261004-06'}]);assert.equal(f.store.filterBindingsJson().includes('sha256'),false);
 for(const mutate of [r=>r.id='13',r=>r.stockCode='12',r=>r.provenance.sourceKey+='1',r=>r.provenance.runId='old',r=>r.provenance.kind='quarantined-source',r=>r.provenance.verified=false,r=>r.hold.blocked=true]){const r=row();mutate(r);assert.equal(f.store.photoFor(r).status,'missing');await assert.rejects(()=>f.store.readPhoto(r,'preview'),{statusCode:404});}
});
test('wrong startup scope clears old registry and fails closed before file publication',async t=>{
 const f=await fixture(t);for(const changed of [{mode:'native'},{port:4146},{writes:false},{indexSha256:undefined},{indexSha256:'bad'},{indexSha256:'0'.repeat(64)},{root:path.join(f.root,'wrong')},{identity:{...f.context.identity,sysadmin:1}},{identity:{...f.context.identity,liveDatabaseAccess:1}},{identity:{...f.context.identity,databaseName:'LIVE'}}]){await f.store.configure(f.context);await assert.rejects(()=>f.store.configure({...f.context,...changed}),{statusCode:503});assert.equal(f.store.photoFor(row()).status,'missing');}
});
test('duplicate/synthetic IDs, altered plan, incomplete count and path traversal cannot load',async t=>{
 const f=await fixture(t),baseline=JSON.stringify(f.index);
 for(const mutate of [i=>i.entries.push(structuredClone(i.entries[0])),i=>i.entries=[],i=>i.planRecordsSha256='0'.repeat(64),i=>i.entries[0].productId='301986',i=>i.entries[0].preview.relativePath='../bad.jpg',i=>i.entries[0].original.sha256='0'.repeat(64),i=>i.entries[0].validationStatus='AMBIGUOUS',i=>i.entries[0].absolutePath='C:/secret']){f.index=JSON.parse(baseline);mutate(f.index);const raw=JSON.stringify(f.index);await fs.writeFile(path.join(f.root,'index.json'),raw);await assert.rejects(()=>f.store.configure({...f.context,indexSha256:createHash('sha256').update(raw).digest('hex')}),{statusCode:503});}
});
test('trusted full-index pin rejects swapping image and derivative bindings between two valid products',async t=>{
 const f=await fixture(t),second=structuredClone(f.entry),bytes=Buffer.from([255,216,255,224,3,4,255,217]),sha=createHash('sha256').update(bytes).digest('hex');
 Object.assign(second,{productId:'13',stockCode:'0013',sourceKey:'VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/13',sourceFileName:'0013.jpg',sourceSha256:sha});
 for(const variant of ['original','preview','thumbnail']){second[variant]={relativePath:`${variant}/${sha}.jpg`,sha256:sha,bytes:bytes.length};await fs.writeFile(path.join(f.root,second[variant].relativePath),bytes);}
 f.index.entries.push(second);await f.publish();const context={...f.context,indexSha256:createHash('sha256').update(await fs.readFile(path.join(f.root,'index.json'))).digest('hex')},store=createCatalogMediaStore({expectedRoot:f.root,expectedCount:2});await store.configure(context);assert.equal(store.photoFor(row()).sha256,f.sha);
 for(const key of ['sourceSha256','sourceFileName','original','preview','thumbnail'])[f.entry[key],second[key]]=[second[key],f.entry[key]];await f.publish();
 await assert.rejects(()=>store.configure(context),{statusCode:503});assert.equal(store.photoFor(row()).status,'missing');
});
test('post-startup derived file corruption never serves changed bytes',async t=>{
 const f=await fixture(t);await f.store.configure(f.context);await fs.writeFile(path.join(f.root,f.entry.preview.relativePath),Buffer.from([255,216,255,225,1,2,255,217]));await assert.rejects(()=>f.store.readPhoto(row(),'preview'),{statusCode:503});
 await assert.rejects(()=>f.store.configure(f.context),{statusCode:503});
});
test('directory junction storage escape is rejected at startup and request',async t=>{
 const f=await fixture(t),target=path.join(f.root,'preview');await f.store.configure(f.context);await fs.rename(target,target+'-real');
 await fs.symlink(target+'-real',target,process.platform==='win32'?'junction':'dir');
 await assert.rejects(()=>f.store.readPhoto(row(),'preview'),{statusCode:503});await assert.rejects(()=>f.store.configure(f.context),{statusCode:503});
});
