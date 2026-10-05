import test from 'node:test';import assert from 'node:assert/strict';import {createCatalogPhotoLoader,catalogPhotoPlaceholder} from './workCatalogPhoto.mjs';
const row=id=>({id,productName:'<Ürün>',stockCode:'00012',hold:{blocked:false},provenance:{kind:'accepted-opening',verified:true,sourceKey:`source/${id}`},photo:{status:'available',url:`/api/catalog/products/${id}/photo?variant=preview`,thumbnailUrl:`/api/catalog/products/${id}/photo?variant=thumbnail`,sourceKey:`source/${id}`,sha256:'a'.repeat(64),verified:true}});
const slot=()=>({isConnected:true,innerHTML:'',image:{},querySelector(){return this.image;}});
function urls(){const made=[],revoked=[];return {made,revoked,createObjectURL:blob=>{made.push(blob);return 'blob:photo-'+made.length;},revokeObjectURL:url=>revoked.push(url)};}
const blob=()=>new Blob(['image'],{type:'image/jpeg'});
test('detail preview creates only local object URL and releases it on close or decode error',async()=>{
 const u=urls(),h=slot(),loader=createCatalogPhotoLoader({media:async()=>blob(),urls:u});await loader.show(h,row('12'));assert.match(h.innerHTML,/src="blob:photo-1"/);assert.match(h.innerHTML,/&lt;Ürün&gt;/);assert.doesNotMatch(h.innerHTML,/\/api\/|Bearer|sha256/);loader.clear();assert.deepEqual(u.revoked,['blob:photo-1']);
 await loader.show(h,row('12'));h.image.onerror();assert.match(h.innerHTML,/Fotoğraf şu anda açılamıyor/);assert.deepEqual(u.revoked,['blob:photo-1','blob:photo-2']);loader.dispose();assert.equal(u.revoked.length,2);
});
test('new card cancels old preview; late completion never allocates or paints old image',async()=>{
 const u=urls(),h=slot(),pending=[];const loader=createCatalogPhotoLoader({media:(path,options)=>new Promise((resolve,reject)=>pending.push({path,options,resolve,reject})),urls:u});const old=loader.show(h,row('12')),next=loader.show(h,row('13'));assert.equal(pending[0].options.signal.aborted,true);pending[1].resolve(blob());await next;const current=h.innerHTML;pending[0].resolve(blob());await old;assert.equal(h.innerHTML,current);assert.equal(u.made.length,1);loader.dispose();assert.equal(u.revoked.length,1);
});
test('disposal aborts pending request; missing, held, unsafe and error photos produce clean placeholders',async()=>{
 const u=urls(),h=slot();let resolve,signal;const loader=createCatalogPhotoLoader({media:(_path,options)=>{signal=options.signal;return new Promise(done=>resolve=done);},urls:u});const pending=loader.show(h,row('12'));loader.dispose();assert.equal(signal.aborted,true);const before=h.innerHTML;resolve(blob());await pending;assert.equal(h.innerHTML,before);assert.equal(u.made.length,0);
 let calls=0;const clean=createCatalogPhotoLoader({media:async()=>{calls++;throw Error('SQL private path');},urls:u});const missing={...row('12'),photo:{status:'missing',url:null,sourceKey:null,verified:false}};await clean.show(h,missing);assert.equal(h.innerHTML,catalogPhotoPlaceholder());assert.equal(calls,0);
 await clean.show(h,{...row('12'),hold:{blocked:true}});await clean.show(h,{...row('12'),photo:{...row('12').photo,url:'https://other/image'}});assert.equal(calls,0);await clean.show(h,row('12'));assert.equal(calls,1);assert.match(h.innerHTML,/Fotoğraf şu anda açılamıyor/);assert.doesNotMatch(h.innerHTML,/SQL|private|TEST|debug|migration/);clean.dispose();
});
