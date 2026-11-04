import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

async function controller(){
 let source=await readFile(new URL('./workCustomers.js',import.meta.url),'utf8');source=source.replace("import './workSales.css';",'');
 source=source.replace(/from (['"])(\.\/[^'"]+)\1/g,(_,quote,spec)=>'from '+JSON.stringify(new URL(spec,import.meta.url).href));
 return (await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).createWorkCustomers;
}
function dom(){
 const nodes=new Map(),node=k=>{if(!nodes.has(k))nodes.set(k,{dataset:{},elements:{search:{value:''}},addEventListener(event,fn){this['on'+event]=fn;},querySelector:node,querySelectorAll:()=>[]});return nodes.get(k);};
 const root={isConnected:true,innerHTML:'',querySelector:node,querySelectorAll(selector){const field=selector.slice(1,-1),key=field.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),re=new RegExp(field+'="([^"]+)"','g');return [...root.innerHTML.matchAll(re)].map(m=>{const n=node(selector+m[1]);n.dataset[key]=m[1];return n;});}};
 return {root,node};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const card=id=>({id,customerCode:'REAL-'+id,customerName:'Müşteri '+id,isPassive:false,quarantine:{blocked:false,reasons:[]},source:{status:'accepted-opening',sourceAsOf:'2026-09-30',freshLive:false},accounts:[],accountCount:0,hasUnknownAccounts:false,fields:{phoneMasked:null,city:null,country:null,note:null}});
const list=(rows,{page=1,total=rows.length}={})=>({success:true,data:rows,meta:{total,page,limit:25,readOnly:true,sourceAsOf:'2026-09-30',freshLive:false}});
function fixture(){
 const d=dom(),requests=[];const session={customers(path){const pending=deferred();requests.push({path,...pending});return pending.promise;}};
 return {d,requests,session,search(value){d.node('[data-customer-search]').onsubmit({preventDefault(){},target:{elements:{search:{value}}}});}};
}

test('new search/page hides stale rows, fences stale success/errors and distinguishes loading, empty, denied and failure',async()=>{
 const create=await controller(),f=fixture(),ui=create({root:f.d.root,session:f.session,user:{id:14,permissions:['customer.view']}});ui.mount();
 assert.match(f.d.root.innerHTML,/Müşteriler yükleniyor/);assert.doesNotMatch(f.d.root.innerHTML,/Bu aramada müşteri bulunamadı/);
 ui.refresh();ui.refresh();assert.equal(f.requests.length,1);
 f.requests[0].resolve(list([card('155')],{total:26}));await tick();const stale=f.d.root.querySelectorAll('[data-customer-card]')[0];assert.match(f.d.root.innerHTML,/REAL-155/);
 f.d.node('[data-customer-next]').onclick();assert.equal(f.requests.length,2);assert.match(f.d.root.innerHTML,/Müşteriler yükleniyor/);assert.doesNotMatch(f.d.root.innerHTML,/REAL-155/);
 stale.onclick();f.d.node('[data-customer-next]').onclick();assert.equal(f.requests.length,2);
 f.search('Ada');assert.equal(f.requests.length,3);assert.match(f.requests[2].path,/search=Ada/);f.requests[1].resolve(list([card('156')],{page:2,total:26}));await tick();assert.doesNotMatch(f.d.root.innerHTML,/REAL-156/);
 f.requests[2].resolve(list([]));await tick();assert.match(f.d.root.innerHTML,/Bu aramada müşteri bulunamadı/);
 f.search('Ece');assert.equal(f.requests.length,4);f.search('Ece');assert.equal(f.requests.length,4);f.search('Deniz');assert.equal(f.requests.length,5);
 f.requests[3].reject(Error('old failure'));await tick();assert.match(f.d.root.innerHTML,/Müşteriler yükleniyor/);assert.doesNotMatch(f.d.root.innerHTML,/şu anda açılamıyor/);
 f.requests[4].reject(Error('new failure'));await tick();assert.match(f.d.root.innerHTML,/Müşteri listesi görüntülenemiyor/);assert.doesNotMatch(f.d.root.innerHTML,/Bu aramada müşteri bulunamadı/);
 f.search('Deniz');assert.equal(f.requests.length,6);f.requests[5].resolve(list([card('157')]));await tick();assert.match(f.d.root.innerHTML,/REAL-157/);ui.dispose();
 const denied=fixture(),noPermission=create({root:denied.d.root,session:denied.session,user:{id:14,permissions:[]}});noPermission.mount();assert.equal(denied.requests.length,0);assert.match(denied.d.root.innerHTML,/görüntüleme yetkiniz yok/);assert.doesNotMatch(denied.d.root.innerHTML,/Bu aramada müşteri bulunamadı/);noPermission.dispose();
});

test('card double click, old card result, close and dispose cannot revive a previous customer',async()=>{
 const create=await controller(),f=fixture(),ui=create({root:f.d.root,session:f.session,user:{id:14,permissions:['customer.view']}});ui.mount();f.requests[0].resolve(list([card('155'),card('156')]));await tick();
 const [a,b]=f.d.root.querySelectorAll('[data-customer-card]');a.onclick();a.onclick();assert.equal(f.requests.filter(r=>r.path.includes('/155/card')).length,1);b.onclick();assert.equal(f.requests.filter(r=>r.path.includes('/156/card')).length,1);
 f.search('Yeni');assert.match(f.d.root.innerHTML,/Müşteriler yükleniyor/);f.requests.find(r=>r.path.includes('/155/card')).resolve(card('155'));f.requests.find(r=>r.path.includes('/156/card')).resolve(card('156'));await tick();assert.doesNotMatch(f.d.root.innerHTML,/Gerçek müşteri kartı/);
 f.requests.at(-1).resolve(list([card('157')]));await tick();a.onclick();assert.equal(f.requests.filter(r=>r.path.includes('/155/card')).length,1);
 f.d.root.querySelectorAll('[data-customer-card]')[0].onclick();const pending=f.requests.at(-1);assert.match(pending.path,/\/157\/card/);f.d.node('[data-customer-card-close]').onclick();pending.resolve(card('157'));await tick();assert.doesNotMatch(f.d.root.innerHTML,/Gerçek müşteri kartı/);
 f.search('Bekleyen');const last=f.requests.at(-1),html=f.d.root.innerHTML;ui.dispose();last.resolve(list([card('158')]));await tick();assert.equal(f.d.root.innerHTML,html);
});

test('refresh rereads the selected card rather than choosing another row',async()=>{
 const create=await controller(),f=fixture(),ui=create({root:f.d.root,session:f.session,user:{id:14,permissions:['customer.view']}});ui.mount();f.requests[0].resolve(list([card('155')]));await tick();f.d.root.querySelectorAll('[data-customer-card]')[0].onclick();f.requests.at(-1).resolve(card('155'));await tick();assert.match(f.d.root.innerHTML,/REAL-155 · Gerçek müşteri kartı/);
 ui.refresh();assert.doesNotMatch(f.d.root.innerHTML,/REAL-155/);f.requests.at(-1).resolve(list([card('156')]));await tick();const detail=f.requests.at(-1);assert.match(detail.path,/\/155\/card/);detail.resolve(card('155'));await tick();assert.match(f.d.root.innerHTML,/REAL-155 · Gerçek müşteri kartı/);ui.dispose();
});
test('detached or disposed screen callbacks never start another customer request',async()=>{
 const create=await controller();
 for(const mode of ['detached','disposed']){
  const f=fixture(),ui=create({root:f.d.root,session:f.session,user:{id:14,permissions:['customer.view']}});ui.mount();f.requests[0].resolve(list([card('155')]));await tick();
  const cardClick=f.d.root.querySelectorAll('[data-customer-card]')[0].onclick,refresh=f.d.node('[data-customer-refresh]').onclick,search=f.d.node('[data-customer-search]').onsubmit,html=f.d.root.innerHTML;
  if(mode==='detached')f.d.root.isConnected=false;else ui.dispose();
  cardClick();refresh();ui.refresh();search({preventDefault(){},target:{elements:{search:{value:'Yeni'}}}});await tick();assert.equal(f.requests.length,1);assert.equal(f.d.root.innerHTML,html);
  if(mode==='detached')ui.dispose();
 }
});
test('refresh preserves the selected customer, currency and history page',async()=>{
 const create=await controller(),d=dom(),historyCalls=[],revision='a'.repeat(64),account=(id,currency)=>({accountId:id,currency,balanceExact:'1.00000000',nativeBalanceExact:'1.00000000',sourceOpeningBalanceExact:'1.00000000',confidence:'source-matched',sourceStatus:'SOURCE',reconciled:true,sourceAsOf:'2026-09-30'});
 const selected={...card('155'),accounts:[account('1','TRY'),account('2','USD')],accountCount:2};
 const invoice=(id,currency)=>({id:String(id),documentNo:'SAT-'+id,documentDate:'2026-10-06',status:'finalized',customerId:'155',currency,subtotalExact4:'1.0000',grandTotalExact4:'1.0000',amountTryExact4:'1.0000',customerBalanceExact4:'1.0000',revision,collections:{receivedExact4:'0.0000',outstandingExact4:'1.0000',revision,items:[]},items:[{productId:'1',stockCode:'X',name:'Ürün',quantityExact3:'1.000',unitPriceExact8:'1.00000000',unitPriceExact4:'1.0000',lineTotalExact4:'1.0000',currency,unit:{label:'ADET',factorExact8:'1.00000000'}}]});
 const session={customers:async path=>path.startsWith('/api/customer-cards?')?list([selected]):selected,work:async path=>{if(path.endsWith('/context'))throw Error('no synthetic context');historyCalls.push(path);const query=new URL(path,'http://test').searchParams,page=Number(query.get('page')),currency=query.get('currency');return {data:page===1?Array.from({length:25},(_,i)=>invoice(i+1,currency)):[invoice(26,currency)],meta:{page,limit:25,total:26}};}};
 const ui=create({root:d.root,session,user:{id:14,permissions:['customer.view','sales.view']}});ui.mount();await tick();d.root.querySelectorAll('[data-customer-card]')[0].onclick();await tick();
 d.node('[data-customer-history-currency]').onchange({target:{value:'USD'}});await tick();d.node('[data-customer-history-next]').onclick();await tick();assert.match(historyCalls.at(-1),/page=2.*currency=USD/);
 ui.refresh();await tick();assert.match(historyCalls.at(-1),/page=2.*currency=USD/);assert.match(d.root.innerHTML,/REAL-155 · Gerçek müşteri kartı/);assert.match(d.root.innerHTML,/Geçmiş sayfası 2/);ui.dispose();
});
