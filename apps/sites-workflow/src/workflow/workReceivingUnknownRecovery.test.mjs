import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createInboundJournal} from './workInboundJournal.mjs';
const requestId='00000000-0000-4000-8000-000000000001',revision='a'.repeat(64),key='melisa-work-inbound-count:local:16';
function fixture(){const products=['301','302'].map(id=>({id,stockCode:'00'+id+' UNIT',name:'Offline '+id,barcode:'00000'+id,unit:{label:'ADET',factorExact8:'1.00000000'},stockQuantityExact3:null,writeEligible:true}));return {meta:{schemaVersion:'melisa-work-inbound.v1',source:'native-test',timeZone:'Europe/Istanbul'},capabilities:Object.fromEntries(['canCount','canSubmit','canApprove','canReject','canViewPurchase','canViewSupplier','canCreatePurchase','canFinalizePurchase','canCancelPurchase'].map(k=>[k,true])),scope:{synthetic:true,supplier:{id:'601',code:'OFFLINE-SUPPLIER',name:'Offline tedarikçi'},warehouse:{id:'1',label:'Depo'},products},countDrafts:[],receipts:[{id:'7',supplierId:'601',warehouseId:'1',state:'pending',note:'',lines:[{id:'901',clientLineId:'line-1',productId:'301',stockCode:products[0].stockCode,name:products[0].name,quantityExact3:'2.000',unit:products[0].unit,receivedQuantityExact3:'0.000',invoiceableQuantityExact3:'0.000'}]}]};}
async function controller(){let s=await readFile(new URL('./workReceiving.js',import.meta.url),'utf8');s=s.replace(/import '\.\/[^']+\.css';/g,'').replace(/from '(\.\/[^']+\.mjs)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,import.meta.url).href));return import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'));}
function memory(){const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};}
function dom(){let html='';const nodes=new Map(),node=k=>{if(!nodes.has(k))nodes.set(k,{isConnected:true,innerHTML:'',value:'',dataset:{},elements:{scan:{value:''},query:{value:''}},setAttribute(k,v){this[k]=v;},addEventListener(e,f){this['on'+e]=f;},querySelector:node,querySelectorAll:()=>[]});return nodes.get(k);};return {node,root:{isConnected:true,get innerHTML(){return html;},set innerHTML(v){html=v;},querySelector:node,querySelectorAll(selector){const field=selector.slice(1,-1),fieldKey=field.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return [...html.matchAll(new RegExp(field+'="([^"]+)"','g'))].map(m=>{const n=node(selector+m[1]);n.dataset[fieldKey]=m[1];return n;});}}};}
const tick=()=>new Promise(r=>setImmediate(r));
async function setup({store=memory(),write}={}){const c=fixture(),d=dom(),calls=[],{createWorkReceiving}=await controller();const ui=createWorkReceiving({root:d.root,session:{media:async()=>{},inbound:async(path,options)=>{calls.push({path,options:structuredClone(options)});if(!options)return structuredClone(c);return write(path,options,c);}},user:{id:16,permissions:[]},storage:store,uuid:()=>requestId});ui.mount();await tick();return {ui,c,d,calls,store,journal:createInboundJournal({storage:store,key,makeUuid:()=>requestId})};}
for(const status of [400,403,404,409,422])test('restored unknown receiving request survives explicit retry denial '+status,async()=>{
 const store=memory(),journal=createInboundJournal({storage:store,key,makeUuid:()=>requestId});journal.backup({id:'18',note:'Korunan taslak',lines:[],dirty:false});const p=journal.begin('/api/work-receiving/count-drafts/18/submit',{expectedRevision:revision}),before=store.getItem(key);
 const f=await setup({store,write:async()=>{throw Object.assign(Error('Denied'),{status});}});
 assert.equal(f.calls.length,1,'mount must not POST');await f.ui.refresh();assert.equal(f.calls.length,1,'pending refresh must not POST');
 await f.d.node('[data-count-retry]').onclick();await tick();
 assert.equal(f.journal.read().request.status,'pending');assert.equal(store.getItem(key),before);assert.deepEqual(f.calls.at(-1).options.body,p.body);assert.equal(f.ui.requestClose(),false);f.ui.dispose();
});
for(const status of [400,403,404,409,422])test('lost ACK then receiving retry denial keeps original UUID/body/history '+status,async()=>{
 let writes=0;const f=await setup({write:async()=>{if(++writes===1)throw Error('Lost ACK');throw Object.assign(Error('Denied'),{status});}});
 f.d.root.querySelectorAll('[data-count-approve]')[0].onclick();await tick();const before=f.store.getItem(key),p=f.journal.read().request;
 assert.equal(p.status,'pending');await f.d.node('[data-count-retry]').onclick();await tick();
 assert.equal(f.store.getItem(key),before);assert.equal(f.journal.read().request.status,'pending');const posts=f.calls.filter(c=>c.options);assert.equal(posts.length,2);assert.deepEqual(posts[1],posts[0]);assert.equal(posts[1].options.body.requestId,requestId);f.ui.dispose();
});
for(const status of [400,403,404,409,422])test('definite first receiving send rejection may close only its fresh journal '+status,async()=>{
 const f=await setup({write:async()=>{throw Object.assign(Error('Rejected'),{status});}});f.d.root.querySelectorAll('[data-count-approve]')[0].onclick();await tick();assert.equal(f.calls.filter(c=>c.options).length,1);assert.equal(f.journal.read().request.status,'rejected');assert.equal(f.journal.read().request.body.requestId,requestId);assert.equal(f.ui.requestClose(),true);f.ui.dispose();
});
test('explicit retry still completes only from the matching original receipt',async()=>{
 let writes=0;const f=await setup({write:async(_path,_options,c)=>{if(++writes===1)throw Error('Lost ACK');const receipt=structuredClone(c.receipts[0]);receipt.state='accepted';return {requestId,replayed:true,receipt};}});f.d.root.querySelectorAll('[data-count-approve]')[0].onclick();await tick();const p=f.journal.read().request;await f.d.node('[data-count-retry]').onclick();await tick();assert.equal(f.journal.read().request.status,'done');assert.deepEqual(f.journal.read().request.body,p.body);assert.equal(f.journal.read().request.result.replayed,true);assert.equal(f.ui.requestClose(),true);f.ui.dispose();
});
