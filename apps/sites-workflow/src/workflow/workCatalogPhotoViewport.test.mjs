import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogThumbnailLoader} from './workCatalogPhoto.mjs';

// Synthetic non-bubbling scroll propagation: ancestors receive capture only.
function target(parent=null){
 const listeners=[];
 return {parent,listeners,addEventListener(type,fn,options){const capture=options===true||options?.capture===true;if(!listeners.some(l=>l.type===type&&l.fn===fn&&l.capture===capture))listeners.push({type,fn,capture});},removeEventListener(type,fn,options){const capture=options===true||options?.capture===true;const i=listeners.findIndex(l=>l.type===type&&l.fn===fn&&l.capture===capture);if(i>=0)listeners.splice(i,1);},emit(type){const path=[];for(let p=parent;p;p=p.parent)path.unshift(p);for(const p of path)for(const l of [...p.listeners])if(l.type===type&&l.capture)l.fn({target:this});for(const l of [...listeners])if(l.type===type)l.fn({target:this});}};
}
const row=id=>({id,stockCode:'000'+id,productName:'Yapay ürün',hold:{blocked:false},provenance:{kind:'accepted-opening',verified:true,sourceKey:`source/${id}`},photo:{status:'available',url:`/api/catalog/products/${id}/photo?variant=preview`,thumbnailUrl:`/api/catalog/products/${id}/photo?variant=thumbnail`,sourceKey:`source/${id}`,sha256:'a'.repeat(64),verified:true}});
function entry(id,top=800){return {row:row(id),slot:{isConnected:true,top,innerHTML:'',image:{},getBoundingClientRect(){return {top:this.top,bottom:this.top+40};},querySelector(){return this.image;}}};}
function fixture(t){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'innerHeight');Object.defineProperty(globalThis,'innerHeight',{value:600,writable:true,configurable:true});t.after(()=>{if(previous)Object.defineProperty(globalThis,'innerHeight',previous);else delete globalThis.innerHeight;});
 const viewport=target(),ancestor=target(viewport),root=Object.assign(target(ancestor),{ownerDocument:{defaultView:viewport},getBoundingClientRect:()=>({top:0,bottom:1200})});
 const calls=[],made=[],revoked=[];
 const loader=createCatalogThumbnailLoader({Observer:null,media:(path,options)=>new Promise(resolve=>calls.push({path,options,resolve})),urls:{createObjectURL(value){made.push(value);return 'blob:synthetic-'+made.length;},revokeObjectURL:value=>revoked.push(value)}});
 t.after(()=>loader.dispose());return {viewport,ancestor,root,calls,made,revoked,loader};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve)),blob=()=>new Blob(['synthetic'],{type:'image/jpeg'});

for(const event of ['window scroll','ancestor scroll','window resize']){
 test(`fallback notices ${event} without a results scroll`,async t=>{
  const h=fixture(t),e=entry('12');let rootScrolls=0;h.root.addEventListener('scroll',()=>rootScrolls++);
  h.loader.mount(h.root,[e]);assert.equal(h.calls.length,0);const bounds=h.root.getBoundingClientRect();
  if(event==='window resize'){globalThis.innerHeight=900;h.viewport.emit('resize');}else{e.slot.top=100;(event==='ancestor scroll'?h.ancestor:h.viewport).emit('scroll');}
  assert.equal(rootScrolls,0);assert.deepEqual(h.root.getBoundingClientRect(),bounds);
  assert.equal(h.calls.length,1,'A newly visible thumbnail must be queued without a results scroll');assert.equal(h.calls[0].path,e.row.photo.thumbnailUrl);
  h.calls[0].resolve(blob());await tick();assert.match(e.slot.innerHTML,/blob:synthetic-1/);
 });
}

test('fallback scroll capture remains lazy, deduplicated and limited to three in-flight thumbnails',async t=>{
 const h=fixture(t),entries=Array.from({length:50},(_,i)=>entry(String(i+12),800+i*50));h.loader.mount(h.root,entries);assert.equal(h.calls.length,0);
 entries.slice(0,5).forEach((e,i)=>e.slot.top=100+i*50);h.ancestor.emit('scroll');h.viewport.emit('scroll');h.root.emit('scroll');h.viewport.emit('resize');
 assert.equal(h.calls.length,3);assert.ok(h.calls.every(c=>c.path.endsWith('?variant=thumbnail')));
 h.calls[0].resolve(blob());await tick();assert.equal(h.calls.length,4);h.calls[1].resolve(blob());await tick();assert.equal(h.calls.length,5);
 h.calls.slice(2).forEach(c=>c.resolve(blob()));await tick();h.viewport.emit('scroll');assert.equal(h.calls.length,5);assert.ok(entries.slice(5).every(e=>e.slot.innerHTML===''));
 h.loader.dispose();assert.equal(h.revoked.length,5);assert.equal(new Set(h.revoked).size,5);assert.equal(h.viewport.listeners.length,0);assert.equal(h.root.listeners.length,0);
});

test('dispose removes capture/resize listeners, aborts requests and ignores saved callbacks or late media',async t=>{
 const h=fixture(t),e=entry('12',100),hidden=entry('13');h.loader.mount(h.root,[e,hidden]);assert.equal(h.calls.length,1);
 assert.ok(h.viewport.listeners.some(l=>l.type==='scroll'&&l.capture));assert.ok(h.viewport.listeners.some(l=>l.type==='resize'));
 const callbacks=h.viewport.listeners.map(l=>l.fn),before=e.slot.innerHTML;h.loader.dispose();assert.ok(h.calls[0].options.signal.aborted);
 assert.equal(h.viewport.listeners.length,0);assert.equal(h.root.listeners.length,0);hidden.slot.top=100;callbacks.forEach(fn=>fn());h.ancestor.emit('scroll');h.viewport.emit('resize');
 h.calls[0].resolve(blob());await tick();assert.equal(h.calls.length,1);assert.equal(e.slot.innerHTML,before);assert.equal(h.made.length,0);assert.equal(h.revoked.length,0);
});

test('remount cleans the old viewport and old generation cannot queue or paint replacement rows',async t=>{
 const h=fixture(t),old=entry('12',100);h.loader.mount(h.root,[old]);const callbacks=h.viewport.listeners.map(l=>l.fn);
 h.calls[0].resolve(blob());await tick();const nextViewport=target(),nextRoot=Object.assign(target(nextViewport),{ownerDocument:{defaultView:nextViewport},getBoundingClientRect:()=>({top:0,bottom:1200})}),next=entry('30');
 h.loader.mount(nextRoot,[next]);assert.deepEqual(h.revoked,['blob:synthetic-1']);assert.equal(h.viewport.listeners.length,0);assert.equal(h.root.listeners.length,0);
 next.slot.top=100;callbacks.forEach(fn=>fn());h.viewport.emit('scroll');assert.equal(h.calls.length,1);nextViewport.emit('scroll');assert.equal(h.calls.length,2);
 h.calls[1].resolve(blob());await tick();assert.match(next.slot.innerHTML,/blob:synthetic-2/);h.loader.clear();assert.equal(nextViewport.listeners.length,0);assert.equal(nextRoot.listeners.length,0);assert.deepEqual(h.revoked,['blob:synthetic-1','blob:synthetic-2']);
});

test('fallback keeps root-only scrolling when a window event target is unavailable',t=>{
 const h=fixture(t),e=entry('12');delete h.root.ownerDocument;h.loader.mount(h.root,[e]);assert.equal(h.calls.length,0);e.slot.top=100;h.root.emit('scroll');assert.equal(h.calls.length,1);h.loader.clear();assert.equal(h.root.listeners.length,0);
});

test('normal IntersectionObserver path does not subscribe to fallback viewport events',async t=>{
 const h=fixture(t),e=entry('12');let callback,disconnects=0;
 class Observer{constructor(fn){callback=fn;}observe(){}unobserve(){}disconnect(){disconnects++;}}
 const loader=createCatalogThumbnailLoader({Observer,urls:{createObjectURL:()=> 'blob:observer',revokeObjectURL(){}},media:async path=>{h.calls.push({path});return blob();}});t.after(()=>loader.dispose());
 loader.mount(h.root,[e]);assert.equal(h.viewport.listeners.length,0);assert.equal(h.root.listeners.length,0);e.slot.top=100;h.viewport.emit('scroll');h.viewport.emit('resize');assert.equal(h.calls.length,0);
 callback([{target:e.slot,isIntersecting:true}]);await tick();assert.equal(h.calls.length,1);assert.equal(h.calls[0].path,e.row.photo.thumbnailUrl);loader.dispose();assert.equal(disconnects,1);
});

test('viewport discovery still rejects held, unverified or unsafe photo provenance before media access',async t=>{
 const h=fixture(t),entries=['12','13','14'].map(id=>entry(id));entries[0].row.hold.blocked=true;entries[1].row.photo.verified=false;entries[2].row.photo.thumbnailUrl='https://invalid.example/private';
 h.loader.mount(h.root,entries);entries.forEach(e=>e.slot.top=100);h.ancestor.emit('scroll');await tick();assert.equal(h.calls.length,0);assert.equal(h.made.length,0);assert.ok(entries.every(e=>!/img/.test(e.slot.innerHTML)));
});
