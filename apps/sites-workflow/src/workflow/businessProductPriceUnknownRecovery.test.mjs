import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {businessPriceRequest} from './businessProductPriceModel.mjs';
const id='4c758081-465d-445f-b024-aad40355f9d0',key='melisa-business-price:16:12';
const context=()=>({schemaVersion:'melisa-business-product-prices.v1',productId:'12',copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',sealHash:'A'.repeat(64),revision:'B'.repeat(64),operationOrigin:'ISOLATED_TEST_COPY',canEdit:true,prices:[{priceId:'77',tuple:{type:'sale',unitId:'7',tier:1,currency:'TRY'},priceExact:'3.12345678',currentVersionId:null,source:{quoteId:'77',priceExact8:'3.12345678',nativeRowHash:'C'.repeat(64),bindingHash:'D'.repeat(64),sourceUnitId:'7'}}],recentChanges:[]});
const pending=()=>{const c=context();return {actorId:'16',productId:'12',copyId:c.copyId,sealHash:c.sealHash,status:'pending',body:businessPriceRequest(c,{priceId:'77',priceExact:'9.00000000',reason:'Yeni fiyat'},id)};};
const tick=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};
class Slot{
 constructor(){this.isConnected=true;this.children=new Map();this.dataset={};this.events={};this.elements={price:{value:'9.00000000'},unknown:{checked:false},reason:{value:'Yeni fiyat'}};}
 set innerHTML(v){this.html=v;this.children.clear();} get innerHTML(){return this.html??'';} set textContent(v){this.innerHTML='';} addEventListener(type,fn){this.events[type]=fn;}
 child(k){if(!this.children.has(k))this.children.set(k,new Slot());return this.children.get(k);}
 querySelector(s){const attr=s.match(/^\[([^=\]]+)/)?.[1];return attr&&this.innerHTML.includes(attr)?this.child(s):null;}
 querySelectorAll(s){const attr=s.match(/^\[([^=\]]+)/)?.[1];return [...this.innerHTML.matchAll(new RegExp(attr+'="([^"]+)"','g'))].map(m=>{const n=this.child(s+':'+m[1]);n.dataset[attr.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=m[1];return n;});}
}
async function setup({saved=null,write,read=context}={}){
 let s=(await readFile(new URL('./businessProductPriceEditor.js',import.meta.url),'utf8')).replace("import './testProductPriceEditor.css';",'');for(const file of ['businessProductPriceModel.mjs','workTradeModel.mjs'])s=s.replace("'./"+file+"'",JSON.stringify(new URL('./'+file,import.meta.url).href));
 const {createBusinessProductPriceEditor}=await import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'));let raw=saved?JSON.stringify(saved):null,writes=0;const calls=[],slot=new Slot(),storage={getItem:()=>raw,setItem:(k,v)=>{assert.equal(k,key);raw=v;writes++;}};
 const ui=createBusinessProductPriceEditor({api:async(path,o={})=>{calls.push({path,...structuredClone(o)});return o.method==='POST'?write(o):read();},esc:String,productId:'12',actorId:'16',storage,uuid:()=>id});ui.mount(slot);await tick();return {ui,slot,calls,storage,raw:()=>raw,setRaw:v=>{raw=v;},writes:()=>writes};
}
function submit(f){f.slot.querySelectorAll('[data-business-price-edit]')[0].onclick();const form=f.slot.querySelector('[data-business-price-form]');form.events.input();form.events.submit({preventDefault(){}});}
for(const status of [400,403,409])for(const property of ['status','statusCode'])test('restored uncertain price retry keeps pending on '+property+' '+status,async()=>{
 const f=await setup({saved:pending(),write:async()=>{throw Object.assign(Error('denied'),{[property]:status});}}),before=f.raw();
 assert.equal(f.calls.length,1);f.slot.querySelector('[data-business-price-retry]').onclick({type:'click',isTrusted:true});await tick();
 assert.equal(f.raw(),before);assert.equal(f.writes(),0);assert.match(f.slot.innerHTML,/Sonuç henüz doğrulanamadı/);assert.equal(f.ui.requestClose(),false);assert.deepEqual(f.calls.at(-1).body,pending().body);f.ui.dispose();
});
for(const status of [400,403,409])test('lost ACK then price retry denial cannot release original pending '+status,async()=>{
 let sends=0;const f=await setup({write:async()=>{if(++sends===1)throw Error('lost ACK');throw Object.assign(Error('denied'),{status});}});submit(f);await tick();const before=f.raw();assert.equal(JSON.parse(before).status,'pending');
 f.slot.querySelector('[data-business-price-retry]').onclick({type:'click'});await tick();assert.equal(f.raw(),before);assert.equal(f.writes(),1);const posts=f.calls.filter(c=>c.method==='POST');assert.equal(posts.length,2);assert.deepEqual(posts[1],posts[0]);assert.equal(f.ui.requestClose(),false);f.ui.dispose();
});
for(const status of [400,403,409])test('first fresh price send can record definite rejection '+status,async()=>{
 const f=await setup({write:async()=>{throw Object.assign(Error('denied'),{status});}});submit(f);await tick();assert.equal(JSON.parse(f.raw()).status,'rejected');assert.equal(f.writes(),2);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.equal(f.ui.requestClose(),true);f.ui.dispose();
});
test('unknown rejection still enforces retained storage CAS and does not overwrite replacement',async()=>{
 let reject;const f=await setup({saved:pending(),write:()=>new Promise((_resolve,r)=>{reject=r;})});f.slot.querySelector('[data-business-price-retry]').onclick();await tick();const next={...pending(),body:{...pending().body,reason:'Nový důvod'}};f.setRaw(JSON.stringify(next));const before=f.raw();reject(Object.assign(Error('denied'),{status:409}));await tick();assert.equal(f.raw(),before);assert.equal(f.writes(),0);assert.equal(f.slot.querySelector('[data-business-price-retry]'),null);assert.ok(f.slot.querySelector('[data-business-price-load-retry]'));f.ui.dispose();
});
test('revoked edit capability permits read only and preserves retained request with zero POST',async()=>{
 const f=await setup({saved:pending(),read:()=>({...context(),canEdit:false}),write:()=>assert.fail('POST denied')}),before=f.raw();assert.equal(f.slot.querySelector('[data-business-price-retry]'),null);assert.equal(f.ui.requestClose(),true);assert.equal(f.raw(),before);assert.equal(f.calls.length,1);f.ui.dispose();
});
