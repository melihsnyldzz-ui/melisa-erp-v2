import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {businessPriceRequest} from './businessProductPriceModel.mjs';

const tick=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
const requestId='4c758081-465d-445f-b024-aad40355f9d0';
const permissions=['product.view','purchase.view','product.price.edit','sales.view'];
const row=(price='3.12345678')=>({id:'12',stockCode:'00012',displayCode:'00012',classification:{brand:null,productType:null,sourceName:'Ürün',verified:true},productName:'Ürün',isActive:true,stockQuantityExact:'0.00000000',unit:{label:'ADET',sourceId:'7',factorExact8:'1.00000000',verified:true},barcodes:[],provenance:{kind:'accepted-opening',sourceKey:'VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/12',runId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30',verified:true},hold:{blocked:false,reasons:[]},salePrices:[{id:'77',type:'sale',unitSourceId:'7',tier:1,currency:'TRY',priceExact:price,isMainUnit:true,sourceKey:null}],photo:{status:'missing',url:null,sourceKey:null,verified:false}});
const meta=()=>({schemaVersion:'melisa-catalog.v1',readOnly:true,sourceAsOf:'2026-09-30',freshLive:false,readAt:'2026-10-13T08:00:00.000Z',canViewSalesPrices:true,scopeCounts:{acceptedOpening:16622,syntheticTest:0,quarantinedSource:54},filters:{brands:[],productTypes:[]},total:1,page:1,limit:50,totalPages:1});
const context=()=>({schemaVersion:'melisa-business-product-prices.v1',productId:'12',copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',sealHash:'A'.repeat(64),revision:'B'.repeat(64),operationOrigin:'ISOLATED_TEST_COPY',canEdit:true,prices:[{priceId:'77',tuple:{type:'sale',unitId:'7',tier:1,currency:'TRY'},priceExact:'3.12345678',currentVersionId:null,source:{quoteId:'77',priceExact8:'3.12345678',nativeRowHash:'C'.repeat(64),bindingHash:'D'.repeat(64),sourceUnitId:'7'}}],recentChanges:[]});
const pending=()=>{const c=context();return {actorId:'16',productId:'12',copyId:c.copyId,sealHash:c.sealHash,status:'pending',body:businessPriceRequest(c,{priceId:'77',priceExact:'9.00000000',reason:'Yeni fiyat'},requestId)};};
const acknowledgement=body=>{const c=context();c.replayed=false;c.prices[0].currentVersionId='1';c.prices[0].priceExact=body.priceExact;c.recentChanges=[{versionId:'1',requestId:body.requestId,actorId:'16',priceId:body.priceId,tuple:body.tuple,beforePriceExact:'3.12345678',priceExact:body.priceExact,reason:body.reason,createdAt:'2026-10-13T10:00:00.000Z'}];return c;};
function storage(value=null){let raw=value&&JSON.stringify(value);return {getItem:()=>raw,setItem:(key,value)=>{raw=value;},saved:()=>raw&&JSON.parse(raw)};}

// A small event/slot DOM exercises actual controllers without global browser
// state, rendering code injection, network, SQL, or application startup.
class Slot{
 constructor(){this.isConnected=true;this.children=new Map();this.dataset={};this.events={};this.elements={price:{value:'9.00000000'},unknown:{checked:false},reason:{value:'Yeni fiyat'}};}
 set innerHTML(v){this.html=v;this.children.clear();}
 get innerHTML(){return this.html??'';}
 set textContent(v){this.text=v;this.innerHTML='';}
 get textContent(){return this.text??'';}
 focus(){} setAttribute(){} closest(){return null;}
 addEventListener(type,fn){this.events[type]=fn;}
 child(key){if(!this.children.has(key))this.children.set(key,new Slot());return this.children.get(key);}
 querySelector(s){const attr=s.match(/^\[([^=\]]+)/)?.[1];return attr&&this.innerHTML.includes(attr)?this.child(s):null;}
 querySelectorAll(s){const attr=s.match(/^\[([^=\]]+)/)?.[1];if(!attr)return [];return [...this.innerHTML.matchAll(new RegExp(attr+'="([^"]+)"','g'))].map(m=>{const n=this.child(s+':'+m[1]);n.dataset[attr.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=m[1];return n;});}
}
function dom(){
 const host=new Slot(),nodes=new Map(),form=new Slot();
 form.elements=Object.fromEntries(['search','barcode','brand','productType','image','stock','status','sort'].map(k=>[k,{value:k==='sort'?'code-asc':['stock','status','image'].includes(k)?'all':''}]));form.reset=()=>{form.resetCount=(form.resetCount??0)+1;};
 const node=s=>{if(s==='[data-catalog-filter]')return form;if(!nodes.has(s))nodes.set(s,new Slot());return nodes.get(s);};host.querySelector=node;host.querySelectorAll=()=>[];
 return {host,node,form,opener:()=>node('[data-catalog-results]').querySelectorAll('[data-catalog-open]')[0],slot:()=>node('[data-catalog-detail]').querySelector('[data-business-price-slot]')};
}
async function controllers(){
 let editor=(await readFile(new URL('./businessProductPriceEditor.js',import.meta.url),'utf8')).replace("import './testProductPriceEditor.css';",'');
 for(const name of ['businessProductPriceModel.mjs','workTradeModel.mjs'])editor=editor.replace("'./"+name+"'",JSON.stringify(new URL('./'+name,import.meta.url).href));
 const editorURL='data:text/javascript;base64,'+Buffer.from(editor).toString('base64');
 let source=(await readFile(new URL('./workCatalog.js',import.meta.url),'utf8')).replace("import './workCatalog.css';",'').replace("'./businessProductPriceEditor.js'",JSON.stringify(editorURL));
 for(const name of ['workCatalogModel.mjs','workCatalogPhoto.mjs','purchaseReference.mjs'])source=source.replace("'./"+name+"'",JSON.stringify(new URL('./'+name,import.meta.url).href));
 return {catalog:(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).createWorkCatalog,editor:(await import(editorURL)).createBusinessProductPriceEditor};
}
function backend({cap={enabled:true,productIds:['12']},failRefresh=false,failPost=false}={}){
 const calls=[];let effective='3.12345678';
 return {calls,api:async(path,options={})=>{
  calls.push({path,options});
  if(path.endsWith('/current-prices')){
   if(options.method==='POST'){if(failPost)throw Error('network');effective=options.body.priceExact;return acknowledgement(options.body);}
   return effective==='3.12345678'?context():acknowledgement(pending().body);
  }
  if(path.includes('?')){if(failRefresh&&calls.filter(c=>c.path.includes('?')).length>1)throw Error('network');return {success:true,data:[row(effective)],meta:meta()};}
  return {success:true,data:row(effective),meta:{...meta(),...(cap?{productPriceEdit:cap}:{})}};
 }};
}

test('normal detail requires server product subset, all native permissions and actor16',async()=>{
 const {catalog}=await controllers();
 for(const [actorId,perms,cap,expected] of [['16',permissions,{enabled:true,productIds:['12']},true],['15',permissions,{enabled:true,productIds:['12']},false],['16',permissions.filter(p=>p!=='purchase.view'),{enabled:true,productIds:['12']},false],['16',permissions.filter(p=>p!=='product.price.edit'),{enabled:true,productIds:['12']},false],['16',permissions,null,false],['16',permissions,{enabled:true,productIds:['13']},false]]){
  const d=dom(),b=backend({cap}),ui=catalog({api:b.api,permissions:perms,actorId,storage:storage()});ui.mount(d.host);await tick();d.opener().onclick();await tick();
  assert.equal(b.calls.some(c=>c.path.endsWith('/current-prices')),expected);assert.equal(Boolean(d.slot()),expected);ui.dispose();
 }
});
test('editing and pending requests protect close, refresh, reset, search and navigation',async()=>{
 const {catalog}=await controllers();
 for(const saved of [null,pending()]){
  const d=dom(),b=backend(),ui=catalog({api:b.api,permissions,actorId:'16',storage:storage(saved)});ui.mount(d.host);await tick();d.opener().onclick();await tick();
  if(!saved)d.slot().querySelectorAll('[data-business-price-edit]')[0].onclick();
  const reads=b.calls.length;assert.equal(ui.requestClose(),false);d.node('[data-catalog-detail]').querySelector('[data-catalog-close]').onclick();d.node('[data-catalog-refresh]').onclick();d.node('[data-catalog-reset]').onclick();d.form.onsubmit({preventDefault(){}});d.opener().onclick();await tick();
  assert.equal(b.calls.length,reads);assert.equal(d.form.resetCount,undefined);assert.ok(d.slot());
  if(!saved){d.slot().querySelector('[data-business-price-cancel]').events.click();assert.equal(ui.requestClose(),true);}
  ui.dispose();
 }
});
test('confirmed save reloads effective normal list and card once with no second POST',async()=>{
 const {catalog}=await controllers(),d=dom(),b=backend(),store=storage(pending()),ui=catalog({api:b.api,permissions,actorId:'16',storage:store});ui.mount(d.host);await tick();d.opener().onclick();await tick();d.slot().querySelector('[data-business-price-retry]').onclick();await tick();
 assert.equal(store.saved().status,'saved');assert.equal(b.calls.filter(c=>c.options.method==='POST').length,1);assert.equal(b.calls.filter(c=>c.path.includes('?')).length,2);assert.equal(b.calls.filter(c=>c.path==='/api/catalog/products/12').length,2);
 assert.match(d.node('[data-catalog-results]').innerHTML,/9,00 TRY/);assert.match(d.node('[data-catalog-detail]').innerHTML,/9,00 TRY/);assert.match(d.slot().innerHTML,/9,00 TRY/);
 assert.match(d.slot().innerHTML,/Son fiyat değişiklikleri/);assert.match(d.slot().innerHTML,/Önce: <strong>3,12 TRY<\/strong> · Sonra: <strong>9,00 TRY<\/strong>/);assert.match(d.slot().innerHTML,/Gerekçe: Yeni fiyat/);assert.equal(ui.requestClose(),true);ui.dispose();
});
test('confirmed write plus failed catalog refresh stays saved and hides stale prices',async()=>{
 const {catalog}=await controllers(),d=dom(),b=backend({failRefresh:true}),store=storage(pending()),ui=catalog({api:b.api,permissions,actorId:'16',storage:store});ui.mount(d.host);await tick();d.opener().onclick();await tick();d.slot().querySelector('[data-business-price-retry]').onclick();await tick();
 assert.equal(store.saved().status,'saved');assert.match(d.node('[data-catalog-summary]').textContent,/Fiyat kaydı doğrulandı/);assert.doesNotMatch(d.node('[data-catalog-results]').innerHTML,/3,12|3\.12|data-catalog-open/);assert.equal(d.slot(),null);d.node('[data-catalog-refresh]').onclick();await tick();assert.equal(b.calls.filter(c=>c.options.method==='POST').length,1);ui.dispose();
});
test('unknown POST outcome retains exact request for retry; failed post-save GET only retries reading',async()=>{
 const {editor}=await controllers(),slot=new Slot(),store=storage(pending()),b=backend({failPost:true}),ui=editor({api:b.api,esc:String,productId:'12',actorId:'16',storage:store});ui.mount(slot);await tick();
 slot.querySelector('[data-business-price-retry]').onclick();await tick();slot.querySelector('[data-business-price-retry]').onclick();await tick();assert.equal(store.saved().status,'pending');assert.deepEqual(b.calls.filter(c=>c.options.method==='POST').map(c=>c.options.body),[pending().body,pending().body]);assert.equal(ui.requestClose(),false);ui.dispose();
 const s=new Slot(),saved=storage(pending()),calls=[];let reads=0;const other=editor({api:async(path,options={})=>{calls.push(options.method??'GET');if(options.method==='POST')return acknowledgement(options.body);if(++reads>1)throw Error('network');return context();},esc:String,productId:'12',actorId:'16',storage:saved});other.mount(s);await tick();s.querySelector('[data-business-price-retry]').onclick();await tick();assert.equal(saved.saved().status,'saved');assert.match(s.innerHTML,/Güncel fiyatlar henüz yüklenemedi/);s.querySelector('[data-business-price-load-retry]').onclick();await tick();assert.equal(calls.filter(c=>c==='POST').length,1);other.dispose();
});

test('revoked edit capability retains the pending body, forbids POST and permits readonly close',async()=>{
 const {editor}=await controllers(),slot=new Slot(),store=storage(pending()),before=JSON.stringify(store.saved()),calls=[];
 const ui=editor({api:async(path,options={})=>{calls.push(options.method??'GET');assert.notEqual(options.method,'POST');return {...context(),canEdit:false};},esc:String,productId:'12',actorId:'16',storage:store});
 ui.mount(slot);await tick();assert.match(slot.innerHTML,/bekleyen isteğiniz aynı haliyle korunuyor/i);assert.match(slot.innerHTML,/bu ekrandan çıkabilirsiniz/i);
 assert.equal(slot.querySelector('[data-business-price-retry]'),null);assert.equal(ui.requestClose(),true);assert.equal(JSON.stringify(store.saved()),before);assert.deepEqual(calls,['GET']);ui.dispose();
});

test('normal price history shows escaped before/after, currency, reason and Istanbul date in readonly mode',async()=>{
 const {editor}=await controllers();
 const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 for(const [currency,before,after,expected] of [['TRY',null,'0.00000000',/Önce: <strong>Bilinmiyor \(TRY\)<\/strong> · Sonra: <strong>0,00 TRY<\/strong>/],['USD','0.00000000',null,/Önce: <strong>0,00 USD<\/strong> · Sonra: <strong>Bilinmiyor \(USD\)<\/strong>/]]){
  const c=acknowledgement({...pending().body,priceExact:after,reason:'Etiket <b>yenilendi</b>'});c.canEdit=false;c.prices[0].tuple.currency=currency;c.recentChanges[0].tuple.currency=currency;c.recentChanges[0].beforePriceExact=before;
  const slot=new Slot(),calls=[],ui=editor({api:async(path,options={})=>{calls.push(options.method??'GET');return c;},esc,productId:'12',actorId:'16',storage:storage()});
  ui.mount(slot);await tick();assert.match(slot.innerHTML,/Son fiyat değişiklikleri/);assert.match(slot.innerHTML,expected);assert.match(slot.innerHTML,/Gerekçe: Etiket &lt;b&gt;yenilendi&lt;\/b&gt;/);assert.match(slot.innerHTML,/<time datetime="2026-10-13T10:00:00.000Z">[^<]*13:00<\/time>/);
  assert.doesNotMatch(slot.innerHTML,/Etiket <b>|actorId|requestId|versionId|Kullanıcı #|Kaydeden/);assert.equal(slot.querySelectorAll('[data-business-price-edit]').length,0);assert.equal(ui.requestClose(),true);assert.deepEqual(calls,['GET']);ui.dispose();
 }
});

test('normal price history clearly shows empty history without additional requests',async()=>{
 const {editor}=await controllers(),slot=new Slot(),calls=[];
 const ui=editor({api:async(path,options={})=>{calls.push(options.method??'GET');return context();},esc:String,productId:'12',actorId:'16',storage:storage()});ui.mount(slot);await tick();
 assert.match(slot.innerHTML,/Son fiyat değişiklikleri/);assert.match(slot.innerHTML,/Henüz fiyat değişikliği yok\./);assert.deepEqual(calls,['GET']);ui.dispose();
});

test('normal LAN price save uses getRandomValues when randomUUID is unavailable',async()=>{
 const {editor}=await controllers(),slot=new Slot(),store=storage(),calls=[];
 const original=Object.getOwnPropertyDescriptor(globalThis,'crypto');let randomCalls=0,ui;
 try{
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues(bytes){randomCalls++;assert.equal(bytes.length,16);bytes.fill(0x12);return bytes;}}});
  ui=editor({api:async(path,options={})=>{calls.push(options);return options.method==='POST'?acknowledgement(options.body):context();},esc:String,productId:'12',actorId:'16',storage:store});ui.mount(slot);await tick();
  slot.querySelectorAll('[data-business-price-edit]')[0].onclick();const form=slot.querySelector('[data-business-price-form]');form.events.input();form.events.submit({preventDefault(){}});await tick();
  const posts=calls.filter(c=>c.method==='POST');assert.equal(posts.length,1);assert.equal(randomCalls,1);assert.equal(posts[0].body.requestId,'12121212-1212-4212-9212-121212121212');assert.equal(store.saved().status,'saved');assert.equal(ui.requestClose(),true);
 }finally{ui?.dispose();if(original)Object.defineProperty(globalThis,'crypto',original);else delete globalThis.crypto;}
});

test('normal price save without secure randomness reports failure and sends no POST',async()=>{
 const {editor}=await controllers(),slot=new Slot(),store=storage(),calls=[];
 const original=Object.getOwnPropertyDescriptor(globalThis,'crypto');let ui;
 try{
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{}});
  ui=editor({api:async(path,options={})=>{calls.push(options.method??'GET');return context();},esc:String,productId:'12',actorId:'16',storage:store});ui.mount(slot);await tick();
  slot.querySelectorAll('[data-business-price-edit]')[0].onclick();const form=slot.querySelector('[data-business-price-form]');form.events.input();form.events.submit({preventDefault(){}});await tick();
  assert.match(slot.innerHTML,/İşlem hazırlanamadı; kayıt gönderilmedi/);assert.deepEqual(calls,['GET']);assert.equal(store.saved(),null);assert.equal(ui.requestClose(),false);
 }finally{ui?.dispose();if(original)Object.defineProperty(globalThis,'crypto',original);else delete globalThis.crypto;}
});
