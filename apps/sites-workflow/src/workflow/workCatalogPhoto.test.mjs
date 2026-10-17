import test from 'node:test';import assert from 'node:assert/strict';import {createCatalogPhotoLoader,createCatalogThumbnailLoader,catalogPhotoPlaceholder} from './workCatalogPhoto.mjs';
const row=id=>({id,productName:'<Ürün>',stockCode:'00012',hold:{blocked:false},provenance:{kind:'accepted-opening',verified:true,sourceKey:`source/${id}`},photo:{status:'available',url:`/api/catalog/products/${id}/photo?variant=preview`,thumbnailUrl:`/api/catalog/products/${id}/photo?variant=thumbnail`,sourceKey:`source/${id}`,sha256:'a'.repeat(64),verified:true}});
const slot=()=>({isConnected:true,innerHTML:'',image:{},querySelector(){return this.image;}});
function urls(){const made=[],revoked=[];return {made,revoked,createObjectURL:blob=>{made.push(blob);return 'blob:photo-'+made.length;},revokeObjectURL:url=>revoked.push(url)};}
const blob=()=>new Blob(['image'],{type:'image/jpeg'});
test('detail preview creates only local object URL and releases it on close or decode error',async()=>{
 const u=urls(),h=slot(),loader=createCatalogPhotoLoader({media:async()=>blob(),urls:u});await loader.show(h,row('12'));assert.match(h.innerHTML,/src="blob:photo-1"/);assert.match(h.innerHTML,/&lt;Ürün&gt;/);assert.doesNotMatch(h.innerHTML,/\/api\/|Bearer|sha256/);loader.clear();assert.deepEqual(u.revoked,['blob:photo-1']);
 await loader.show(h,row('12'));h.image.onerror();assert.match(h.innerHTML,/Fotoğraf şu anda açılamıyor/);assert.deepEqual(u.revoked,['blob:photo-1','blob:photo-2']);loader.dispose();assert.equal(u.revoked.length,2);
});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function observerHarness(){const instances=[];class Observer{constructor(callback){this.callback=callback;this.observed=[];this.disconnected=false;instances.push(this);}observe(slot){this.observed.push(slot);}unobserve(slot){this.observed=this.observed.filter(s=>s!==slot);}disconnect(){this.disconnected=true;}visible(slots){this.callback(slots.map(target=>({target,isIntersecting:true})));}}return {Observer,instances};}
test('thumbnails load only observed visible rows, use thumbnail paths and bound concurrency to three',async()=>{
 const h=observerHarness(),u=urls(),pending=[],entries=Array.from({length:5},(_,i)=>({slot:slot(),row:row(String(i+12))}));
 entries.push({slot:slot(),row:{...row('20'),photo:{status:'missing',url:null,sourceKey:null,verified:false}}});
 const loader=createCatalogThumbnailLoader({Observer:h.Observer,urls:u,media:(path,options)=>new Promise(resolve=>pending.push({path,options,resolve}))});
 loader.mount({},entries);assert.equal(pending.length,0);assert.equal(h.instances[0].observed.length,5);
 h.instances[0].visible(entries.map(e=>e.slot));assert.equal(pending.length,3);assert.ok(pending.every(p=>p.path.endsWith('?variant=thumbnail')));
 pending[0].resolve(blob());await tick();assert.equal(pending.length,4);pending[1].resolve(blob());await tick();assert.equal(pending.length,5);
 assert.equal(entries[5].slot.innerHTML,'');loader.dispose();assert.ok(pending.every(p=>p.options.signal.aborted));assert.equal(u.revoked.length,2);
 pending.slice(2).forEach(p=>p.resolve(blob()));await tick();assert.equal(u.made.length,2);
});
test('page replacement cancels visible thumbnails, drops queued work and ignores old observer/completions',async()=>{
 const h=observerHarness(),u=urls(),pending=[],old=Array.from({length:4},(_,i)=>({slot:slot(),row:row(String(i+12))})),next={slot:slot(),row:row('30')};
 const loader=createCatalogThumbnailLoader({Observer:h.Observer,urls:u,media:(path,options)=>new Promise(resolve=>pending.push({path,options,resolve}))});
 loader.mount({},old);h.instances[0].visible(old.map(e=>e.slot));assert.equal(pending.length,3);loader.mount({},[next]);assert.equal(h.instances[0].disconnected,true);assert.ok(pending.every(p=>p.options.signal.aborted));
 h.instances[0].visible([old[3].slot]);assert.equal(pending.length,3);h.instances[1].visible([next.slot]);assert.equal(pending.length,4);
 pending.slice(0,3).forEach(p=>p.resolve(blob()));await tick();assert.equal(u.made.length,0);pending[3].resolve(blob());await tick();assert.match(next.slot.innerHTML,/blob:photo-1/);loader.dispose();assert.deepEqual(u.revoked,['blob:photo-1']);
});
test('detail dismissal leaves visible thumbnail loading independent',async()=>{
 const h=observerHarness(),pending=[],entry={slot:slot(),row:row('12')},media=(path,options)=>new Promise(resolve=>pending.push({path,options,resolve}));
 const thumbs=createCatalogThumbnailLoader({Observer:h.Observer,media,urls:urls()}),detail=createCatalogPhotoLoader({media,urls:urls()});thumbs.mount({},[entry]);h.instances[0].visible([entry.slot]);const preview=detail.show(slot(),row('12'));detail.clear();assert.equal(pending[1].options.signal.aborted,true);assert.equal(pending[0].options.signal.aborted,false);pending.forEach(p=>p.resolve(blob()));await preview;await tick();assert.match(entry.slot.innerHTML,/img/);thumbs.dispose();
});
test('new card cancels old preview; late completion never allocates or paints old image',async()=>{
 const u=urls(),h=slot(),pending=[];const loader=createCatalogPhotoLoader({media:(path,options)=>new Promise((resolve,reject)=>pending.push({path,options,resolve,reject})),urls:u});const old=loader.show(h,row('12')),next=loader.show(h,row('13'));assert.equal(pending[0].options.signal.aborted,true);pending[1].resolve(blob());await next;const current=h.innerHTML;pending[0].resolve(blob());await old;assert.equal(h.innerHTML,current);assert.equal(u.made.length,1);loader.dispose();assert.equal(u.revoked.length,1);
});
test('disposal aborts pending request; missing, held, unsafe and error photos produce clean placeholders',async()=>{
 const u=urls(),h=slot();let resolve,signal;const loader=createCatalogPhotoLoader({media:(_path,options)=>{signal=options.signal;return new Promise(done=>resolve=done);},urls:u});const pending=loader.show(h,row('12'));loader.dispose();assert.equal(signal.aborted,true);const before=h.innerHTML;resolve(blob());await pending;assert.equal(h.innerHTML,before);assert.equal(u.made.length,0);
 let calls=0;const clean=createCatalogPhotoLoader({media:async()=>{calls++;throw Error('SQL private path');},urls:u});const missing={...row('12'),photo:{status:'missing',url:null,sourceKey:null,verified:false}};await clean.show(h,missing);assert.equal(h.innerHTML,catalogPhotoPlaceholder());assert.equal(calls,0);
 await clean.show(h,{...row('12'),hold:{blocked:true}});await clean.show(h,{...row('12'),photo:{...row('12').photo,url:'https://other/image'}});assert.equal(calls,0);await clean.show(h,row('12'));assert.equal(calls,1);assert.match(h.innerHTML,/Fotoğraf şu anda açılamıyor/);assert.doesNotMatch(h.innerHTML,/SQL|private|TEST|debug|migration/);clean.dispose();
});
