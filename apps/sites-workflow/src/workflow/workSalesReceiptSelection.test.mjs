import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTradeJournal} from './workTradeModel.mjs';
const revision='a'.repeat(64),requestId='00000000-0000-4000-8000-000000000001',tick=()=>new Promise(r=>setImmediate(r)),key='melisa-work-sale-v1:local:16';
const context=()=>({meta:{schemaVersion:'melisa-work-trade.v1',date:'2026-10-07',timeZone:'Europe/Istanbul',source:'native-test'},revision,capabilities:{canCreate:true,canFinalize:true,canCancel:true,canCollect:true,canCancelCollection:true},scope:{synthetic:true,customer:{id:'30598',code:'TEST-C',name:'Sentetik müşteri',currency:'TRY',synthetic:true,writeEligible:true,balanceExact4:'100.0000',revision},products:['111','112'].map(id=>({id,stockCode:'TEST-'+id,name:'Sentetik ürün',barcode:null,synthetic:true,writeEligible:true,stockQuantityExact3:'3.000',unit:{label:'ADET',factorExact8:'1.00000000'},revision,prices:[{quoteId:'quote-'+id,currency:'TRY',unitPriceExact8:'120.00000000',source:{kind:'synthetic-test'},revision}]})),accounts:[{id:'20043',code:'TEST-CASH',name:'Nakit',type:'cash',currency:'TRY',balanceExact4:'360.0000',synthetic:true}]},supportedCurrencies:['TRY'],limits:{maxItems:2,maxQuantityPerLine:5,maxInvoiceAmountExact4:'500.0000'}});
const invoice=id=>({id,documentNo:'SAT-'+id,documentDate:'2026-10-07',status:'finalized',customerId:'30598',currency:'TRY',revision,subtotalExact4:'120.0000',grandTotalExact4:'120.0000',amountTryExact4:'120.0000',customerBalanceExact4:'100.0000',collections:{revision,receivedExact4:'120.0000',outstandingExact4:'0.0000',items:[]},items:[{productId:'111',stockCode:'TEST-111',name:'Sentetik ürün',quantityExact3:'1.000',unitPriceExact8:'120.00000000',unitPriceExact4:'120.0000',lineTotalExact4:'120.0000',currency:'TRY'}]});
function storage(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
function done(store){const j=createTradeJournal({storage:store,key}),p=j.begin('/api/work-sales/drafts/34617/finalize',{requestId,expectedRevision:revision});j.done(p,{invoice:invoice('34617'),requestId,replayed:false});return store.getItem(key);}
async function controller(){let s=await readFile(new URL('./workSales.js',import.meta.url),'utf8');s=s.replace(/^import ['"]\.\/[^'"]+\.css['"];\s*$/gm,'').replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,import.meta.url).href));return (await import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'))).createWorkSales;}
function dom(){let html='',nodes=new Map();const list=/<div data-sale-invoice-list>([\s\S]*?)<\/div><\/section>/;
 const node=k=>{if(nodes.has(k))return nodes.get(k);let inner=k==='[data-sale-invoice-list]'?(list.exec(html)?.[1]??''):'';const n={isConnected:true,dataset:{},elements:{search:{value:''}},value:'',setAttribute(k,v){this[k]=v;},remove(){},addEventListener(e,f){this['on'+e]=f;},querySelector:node,querySelectorAll(selector){return select(selector,inner);}};Object.defineProperty(n,'innerHTML',{get:()=>inner,set:v=>{inner=v;if(k==='[data-sale-invoice-list]')html=html.replace(list,()=>'<div data-sale-invoice-list>'+v+'</div></section>');}});nodes.set(k,n);return n;};
 const select=(selector,source)=>{const field=selector.slice(1,-1),attr=field.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return [...source.matchAll(new RegExp(field+'="([^"]+)"','g'))].map(m=>{const n=node(selector+m[1]);n.dataset[attr]=m[1];return n;});};
 const root={isConnected:true,querySelector:node,querySelectorAll:selector=>select(selector,html)};Object.defineProperty(root,'innerHTML',{get:()=>html,set:v=>{html=v;nodes=new Map();}});return {root,node};}

test('opening a receipt locks its actions until the chosen invoice has been read',async()=>{
 const create=await controller(),d=dom(),store=storage(),original=done(store),calls=[],navigation=[];
 let resolveReceipt;
 const ui=create({root:d.root,user:{id:16,permissions:['finance.collection']},storage:store,navigate:r=>navigation.push(r),session:{media:async()=>{},work:async(p,o)=>{
  calls.push({p,o});if(p==='/api/work-sales/context')return context();
  if(p.endsWith('/34617'))return calls.filter(c=>c.p===p).length===1?invoice('34617'):new Promise(resolve=>{resolveReceipt=resolve;});
  throw {status:503};
 }}});
 try{
  ui.mount();await tick();const collect=d.node('[data-sale-collect]').onclick;
  d.node('[data-sale-reopen]').onclick();await tick();
  assert.equal(ui.requestClose(),false,'a selected receipt read must block leaving or acting on the old receipt');
  assert.match(d.root.innerHTML,/data-sale-collect disabled/);
  collect();assert.deepEqual(navigation,[]);assert.equal(store.getItem('melisa-work-selected-invoice:16'),null);
  d.node('[data-sale-reopen]').onclick();assert.equal(calls.filter(c=>c.p.endsWith('/34617')).length,2,'a second receipt read must not overlap the first');
  resolveReceipt(invoice('34617'));await tick();
  assert.equal(ui.requestClose(),true);d.node('[data-sale-collect]').onclick();assert.deepEqual(navigation,['collections']);
  assert.equal(store.getItem(key),original);assert.ok(calls.every(c=>c.o?.method!=='POST'));
 }finally{ui.dispose();}
});

test('receipt read failure releases the lock and removes stale collection actions without changing the journal',async()=>{
 const create=await controller(),d=dom(),store=storage(),original=done(store),navigation=[];let rejectReceipt,reads=0;
 const ui=create({root:d.root,user:{id:16,permissions:['finance.collection']},storage:store,navigate:r=>navigation.push(r),session:{media:async()=>{},work:async p=>{
  if(p==='/api/work-sales/context')return context();
  if(p.endsWith('/34617'))return ++reads===1?invoice('34617'):new Promise((resolve,reject)=>{rejectReceipt=reject;});
  throw {status:503};
 }}});
 try{
  ui.mount();await tick();const collect=d.node('[data-sale-collect]').onclick;
  d.node('[data-sale-reopen]').onclick();await tick();assert.equal(ui.requestClose(),false);
  rejectReceipt({status:503});await tick();assert.equal(ui.requestClose(),true);
  assert.match(d.root.innerHTML,/Fiş şu anda okunamıyor/);assert.doesNotMatch(d.root.innerHTML,/data-sale-collect/);
  collect();assert.deepEqual(navigation,[]);assert.equal(store.getItem(key),original);
 }finally{ui.dispose();}
});

test('disposed receipt read never repaints or unlocks a replacement screen',async()=>{
 const create=await controller(),d=dom(),store=storage(),original=done(store);let finish,reads=0;
 const ui=create({root:d.root,user:{id:16,permissions:[]},storage:store,session:{media:async()=>{},work:async p=>{
  if(p==='/api/work-sales/context')return context();
  if(p.endsWith('/34617'))return ++reads===1?invoice('34617'):new Promise(resolve=>{finish=resolve;});
  throw {status:503};
 }}});
 ui.mount();await tick();d.node('[data-sale-reopen]').onclick();await tick();ui.dispose();
 d.root.innerHTML='Replacement screen';finish(invoice('34617'));await tick();
 assert.equal(d.root.innerHTML,'Replacement screen');assert.equal(store.getItem(key),original);
});

test('receipt list cannot start overlapping selections whose responses could target another collection',async()=>{
 const create=await controller(),d=dom(),store=storage(),calls=[],navigation=[];let finish;
 const ui=create({root:d.root,receiptOnly:true,user:{id:16,permissions:['finance.collection']},storage:store,navigate:r=>navigation.push(r),session:{media:async()=>{},work:async p=>{
  calls.push(p);if(p==='/api/work-sales/context')return context();
  if(p==='/api/work-sales/invoices')return {data:[invoice('34621'),invoice('34622')]};
  if(p.endsWith('/34621'))return new Promise(resolve=>{finish=resolve;});
  if(p.endsWith('/34622'))return invoice('34622');
  throw {status:503};
 }}});
 try{
  ui.mount();await tick();const first=d.node('[data-sale-open-invoice]34621').onclick,second=d.node('[data-sale-open-invoice]34622').onclick;
  first();await tick();second();await tick();assert.equal(calls.includes('/api/work-sales/invoices/34622'),false);
  assert.match(d.root.innerHTML,/data-sale-open-invoice="34622" disabled/);assert.equal(ui.requestClose(),false);
  finish(invoice('34621'));await tick();assert.match(d.root.innerHTML,/<h2>SAT-34621<\/h2>/);
  d.node('[data-sale-collect]').onclick();assert.deepEqual(navigation,['collections']);assert.equal(store.getItem('melisa-work-selected-invoice:16'),'34621');
  assert.equal(store.getItem(key),null);
 }finally{ui.dispose();}
});
