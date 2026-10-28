import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {saleNativeActor,saleReadCustomer,saleReadCustomerList,saleReadProduct,saleReadCatalog,saleReadSelection,saleNativeResult,saleNativeInvoice} from './workBusinessSalesRead.test-fixture.mjs';
const tick=()=>new Promise(r=>setImmediate(r)),settle=async()=>{await tick();await tick();};
const actor=()=>({...saleNativeActor(),permissions:[...saleNativeActor().permissions,'finance.view','sales.finalize','sales.cancel']});
const requestId='00000000-0000-4000-8000-000000000001',key='melisa-work-sale-v1:local:17';
async function controller(){let source=await readFile(new URL('./workSales.js',import.meta.url),'utf8');source=source.replace(/^import ['"]\.\/[^'"]+\.css['"];\s*$/gm,'').replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,import.meta.url).href));return (await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).createWorkSales;}
function surface(){let html='',nodes=new Map(),child=null;
 const root={isConnected:true,querySelector:node,querySelectorAll(selector){const attr=selector.slice(1,-1),field=attr.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return [...html.matchAll(new RegExp(attr+'="([^\"]*)"','g'))].map(m=>{const n=make(selector+m[1]);n.dataset[field]=m[1];return n;});}};
 function make(k){if(!nodes.has(k))nodes.set(k,{isConnected:true,value:'',innerHTML:'',dataset:{},elements:{search:{value:''}},addEventListener(e,f){this['on'+e]=f;},setAttribute(){},remove(){},querySelector:node,querySelectorAll:()=>[]});return nodes.get(k);}
 function node(k){if(k==='[data-business-sales-read]'){if(!html.includes('data-business-sales-read'))return null;child??=surface();return child.root;}if(!k.startsWith('[')||!html.includes(k.slice(1,-1)))return null;return make(k);}
 Object.defineProperty(root,'innerHTML',{get:()=>html,set:v=>{if(child)child.root.isConnected=false;child=null;html=v;nodes=new Map();}});
 return {root,node,child:()=>child};
}
async function fixture({receiptOnly=false,user=actor(),record=null,previewRead=s=>saleNativeResult(s),invoiceRead=i=>i,contextError={status:403,code:'BUSINESS_WORKFACE_SCOPE_UNAVAILABLE'},customer=saleReadCustomer()}={}){
 const d=surface(),values=new Map(record?[[key,JSON.stringify(record)]]:[]),calls=[],uuids=[];let writes=0;
 const product=saleReadProduct();product.stockQuantityExact='8.00000000';
 const session={work:async(path,options)=>{calls.push({kind:'work',path,options});if(path==='/api/work-sales/context'&&!options)throw contextError;assert.fail('Closed binder must never send a commercial request');},customers:async(path,options)=>{calls.push({kind:'customers',path,options});return path.endsWith('/card')?customer:saleReadCustomerList([customer]);},api:async(path,options)=>{calls.push({kind:'catalog',path,options});return path.includes('?')?saleReadCatalog([product]):saleReadCatalog(product,{detail:true});},businessSaleSelection:async s=>saleReadSelection(s,{product}),businessSalePreview:async s=>{calls.push({kind:'preview',selection:s});return previewRead(s);},businessSaleInvoice:async(q,i)=>{calls.push({kind:'invoice',q,i});return invoiceRead(i);},businessSaleRequest:async(q,p)=>{calls.push({kind:'request',q,p});return {requestId:p.body.requestId,operation:'sale_draft',invoice:record.result.invoice,replayed:false};},media(){assert.fail('No media required');}};
 const create=await controller(),ui=create({root:d.root,session,user,receiptOnly,uuid:()=>{const value='00000000-0000-4000-8000-'+String(uuids.length+2).padStart(12,'0');uuids.push(value);return value;},storage:{getItem:k=>values.get(k)??null,setItem(){writes++;assert.fail('Closed binder cannot write journal');},removeItem(){writes++;assert.fail('Closed binder cannot clear journal');}}});ui.mount();await settle();return {ui,d,calls,values,uuids,writes:()=>writes,child:()=>d.child(),session};
}
async function choose(f){const d=f.child();assert(d);await d.node('[data-bsr-customer]').onchange({target:{value:'155'}});await settle();d.node('[data-bsr-account]').onchange({target:{value:'7'}});return d;}
async function basket(f){let d=await choose(f);const form=d.node('[data-bsr-product-search]');form.elements.search.value='0000120000';await form.onsubmit({preventDefault(){}});await settle();d.node('[data-bsr-price]').onchange({target:{value:'81'}});await d.node('[data-bsr-check]').onclick();d.node('[data-bsr-quantity]').oninput({target:{value:'2'}});d.node('[data-bsr-add]').onclick();await d.node('[data-bsr-basket-check]').onclick();d.node('[data-bsr-native-date]').onchange({target:{value:'2026-10-28'}});await d.node('[data-bsr-native-preview]').onclick();return d;}
function done(status='draft'){return {version:1,status:'done',path:'/api/work-sales/drafts',body:{requestId},result:{requestId,invoice:saleNativeInvoice({status}),replayed:false}};}
test('actual normal UI callback reaches typed draft binder and existing begin closed guard without journal/POST or losing basket',async()=>{
 const f=await fixture(),d=await basket(f);assert.match(d.root.innerHTML,/data-bsr-native-save disabled/);await d.node('[data-bsr-native-save]').onclick({canSend:true,writeAuthorized:true});assert.equal(f.uuids.length,1,'actual controller created the typed request');assert.equal(f.calls.filter(c=>c.kind==='preview').length,2,'binder rechecks native draft preview');assert.match(d.root.innerHTML,/Satış işlemi hazırlandı|kayıt gönderme henüz açık değil/);assert.match(d.root.innerHTML,/data-bsr-basket-quantity/);assert.match(d.root.innerHTML,/data-bsr-native-save disabled/);assert.equal(f.writes(),0);assert(f.calls.filter(c=>c.kind==='work').every(c=>!c.options));f.ui.dispose();
});
test('standalone receiptOnly uses explicit account plus witnessed journal draft and real finalize/cancel callbacks remain closed',async()=>{
 const record=done(),f=await fixture({receiptOnly:true,record}),d=await choose(f),original=f.values.get(key);assert.match(d.root.innerHTML,/<h1>Satış fişleri/);assert.doesNotMatch(d.root.innerHTML,/data-bsr-product-search|data-bsr-native-save|data-bsr-basket/);await d.node('[data-bsr-last-request]').onclick();assert.match(d.root.innerHTML,/SYNTHETIC-RECEIPT|data-business-sale-finalize disabled/);assert.equal(f.calls.filter(c=>c.kind==='catalog').length,0);
 await d.node('[data-business-sale-finalize]').onclick({canSend:true});assert.equal(f.uuids.length,1);assert.match(d.root.innerHTML,/kayıt gönderme henüz açık değil/);assert.match(d.root.innerHTML,/data-business-sale-finalize disabled/);
 d.node('[data-business-sale-reason]').value='Sentetik iptal';await d.node('[data-business-sale-cancel]').onclick({writeAuthorized:true});assert.equal(f.uuids.length,2);assert.equal(f.calls.filter(c=>c.kind==='invoice').length,2);assert.equal(f.values.get(key),original);assert.equal(f.writes(),0);assert(f.calls.filter(c=>c.kind==='work').every(c=>c.path==='/api/work-sales/context'&&!c.options));f.ui.dispose();
});
test('closed callback singleflight and disposal/date generation fences reject late preparation before creating UUID or a journal entry',async()=>{
 let finish,count=0;const f=await fixture({previewRead:s=>++count===1?saleNativeResult(s):new Promise(resolve=>{finish=()=>resolve(saleNativeResult(s));})}),d=await basket(f),send=d.node('[data-bsr-native-save]').onclick,pending=send();await tick();assert.equal(f.ui.requestClose(),false);await send();assert.equal(count,2);d.node('[data-bsr-native-date]').onchange({target:{value:'2026-10-29'}});finish();await pending;assert.equal(f.uuids.length,0);assert.equal(f.writes(),0);assert.doesNotMatch(d.root.innerHTML,/Satış işlemi hazırlandı/);f.ui.dispose();
 let release,n=0;const g=await fixture({previewRead:s=>++n===1?saleNativeResult(s):new Promise(resolve=>{release=()=>resolve(saleNativeResult(s));})}),e=await basket(g),p=e.node('[data-bsr-native-save]').onclick();await tick();g.ui.dispose();const before=e.root.innerHTML;release();await p;assert.equal(e.root.innerHTML,before);assert.equal(g.uuids.length,0);assert.equal(g.writes(),0);
});
test('unknown pending, changed retained journal, permission and fresh invoice revision never advance closed binder',async()=>{
 const unknown={version:1,status:'pending',path:'/api/work-sales/drafts/51/finalize',body:{requestId,expectedRevision:'a'.repeat(64)}},f=await fixture({record:unknown}),d=await basket(f),original=f.values.get(key);await d.node('[data-bsr-native-save]').onclick();assert.equal(f.calls.filter(c=>c.kind==='preview').length,1);assert.equal(f.uuids.length,0);assert.equal(f.values.get(key),original);assert.equal(f.writes(),0);f.ui.dispose();
 const g=await fixture({receiptOnly:true,record:done(),invoiceRead:i=>({...i,revision:'e'.repeat(64)})}),e=await choose(g);await e.node('[data-bsr-last-request]').onclick();await e.node('[data-business-sale-finalize]').onclick();assert.equal(g.uuids.length,0);assert.match(e.root.innerHTML,/Fiş işlemi doğrulanamadı/);assert.equal(g.writes(),0);g.ui.dispose();
 const user=actor();user.permissions=user.permissions.filter(p=>p!=='sales.finalize');const h=await fixture({receiptOnly:true,record:done(),user}),b=await choose(h);await b.node('[data-bsr-last-request]').onclick();await b.node('[data-business-sale-finalize]').onclick();assert.equal(h.uuids.length,0);assert.equal(h.calls.filter(c=>c.kind==='invoice').length,0);assert.equal(h.writes(),0);h.ui.dispose();
});
test('standalone fallback is specific to normal business scope rejection and does not adopt another actor or real role denial',async()=>{
 for(const options of [{user:{...actor(),id:16}},{contextError:{status:403}},{contextError:{status:503}}]){const f=await fixture({receiptOnly:true,...options});assert.equal(f.child(),null);assert.equal(f.calls.length,1);assert.equal(f.writes(),0);f.ui.dispose();}
});

test('retained journal replacement or same-currency account drift during lifecycle preparation cannot publish a plan or overwrite another tab',async()=>{
 for(const changed of ['journal','account']){
  let finish;const customer=saleReadCustomer();customer.accounts.push({...customer.accounts[0],accountId:'9'});customer.accountCount=3;const f=await fixture({receiptOnly:true,record:done(),customer,invoiceRead:i=>new Promise(resolve=>{finish=()=>resolve(i);})}),d=await choose(f);await d.node('[data-bsr-last-request]').onclick();const pending=d.node('[data-business-sale-finalize]').onclick();await tick();
  if(changed==='journal'){const other={...done(),result:{...done().result,replayed:true}};f.values.set(key,JSON.stringify(other));}
  else d.node('[data-bsr-account]').onchange({target:{value:'9'}});
  const retained=f.values.get(key);finish();await pending;assert.equal(f.uuids.length,0);assert.equal(f.values.get(key),retained);assert.equal(f.writes(),0);assert.doesNotMatch(d.root.innerHTML,/Fiş işlemi hazırlandı|Satış işlemi hazırlandı/);f.ui.dispose();
 }
});

test('same-account current receipt replacement fences an awaited lifecycle binder even when the retained journal is unchanged',async()=>{
 let finish;const f=await fixture({receiptOnly:true,record:done(),invoiceRead:i=>new Promise(resolve=>{finish=()=>resolve(i);})}),d=await choose(f);await d.node('[data-bsr-last-request]').onclick();const pending=d.node('[data-business-sale-finalize]').onclick();await tick();const retained=f.values.get(key);
 f.session.businessSaleRequest=async(q,p)=>({requestId:p.body.requestId,operation:'sale_draft',invoice:saleNativeInvoice({id:'52'}),replayed:false});await d.node('[data-bsr-last-request]').onclick();finish();await pending;assert.equal(f.uuids.length,0);assert.equal(f.values.get(key),retained);assert.equal(f.writes(),0);assert.doesNotMatch(d.root.innerHTML,/Fiş işlemi hazırlandı|Satış işlemi hazırlandı/);f.ui.dispose();
});

test('fresh preview hash drift retains basket but revokes displayed preview and sends no typed request',async()=>{
 let reads=0;const f=await fixture({previewRead:s=>{const result=saleNativeResult(s);if(++reads>1)result.preview.previewHash='f'.repeat(64);return result;}}),d=await basket(f);await d.node('[data-bsr-native-save]').onclick();assert.equal(f.uuids.length,0);assert.equal(f.writes(),0);assert.match(d.root.innerHTML,/Satış hazırlığı doğrulanamadı|data-bsr-basket-quantity/);assert.doesNotMatch(d.root.innerHTML,/Satış toplamı:/);f.ui.dispose();
});
