import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTradeJournal} from './workTradeModel.mjs';
const revision='a'.repeat(64),requestId='00000000-0000-4000-8000-000000000001',tick=()=>new Promise(r=>setImmediate(r));
async function controller(financeBuilder){let s=await readFile(new URL('./workCollections.js',import.meta.url),'utf8');s=s.replace("import './workSales.css';",'');if(financeBuilder)s=s.replace("import {buildWorkFinanceMovements} from './workFinanceMovements.mjs';",'const buildWorkFinanceMovements='+financeBuilder.toString()+';');for(const file of ['workOpenAccountPresentation.mjs','isolatedOperationCopyModel.mjs','workCopyPresentation.mjs','workTradeModel.mjs','workFinanceMovements.mjs'])s=s.replace("'./"+file+"'",JSON.stringify(new URL('./'+file,import.meta.url).href));return (await import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'))).createWorkCollections;}
const invoice=id=>({id,documentNo:'SAT-'+id,documentDate:'2026-10-07',status:'finalized',customerId:'501',currency:'TRY',revision,subtotalExact4:'120.0000',grandTotalExact4:'120.0000',amountTryExact4:'120.0000',customerBalanceExact4:'120.0000',collections:{revision,receivedExact4:'0.0000',outstandingExact4:'120.0000',items:[]},items:[{productId:'325503',stockCode:'TEST-P2',name:'Sentetik ürün',quantityExact3:'1.000',unitPriceExact8:'120.00000000',unitPriceExact4:'120.0000',lineTotalExact4:'120.0000',currency:'TRY'}]});
const context=id=>({invoice:invoice(id),revision,customer:{id:'501',name:'Deneme müşterisi',synthetic:true,writeEligible:true},accounts:[{id:'99',name:'Nakit',synthetic:true,currency:'TRY'}],capabilities:{canCollect:true,canCancelCollection:true}});
function storage(){const values=new Map(),removed=[];return {removed,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>{removed.push(k);values.delete(k);}};}
// A paint creates fresh nodes as root.innerHTML does in a browser. In particular
// the invoice box loses its old markup, so the original finance-paint bug fails.
function dom(){let html='',nodes=new Map();const list=/<div data-collection-invoices>([\s\S]*?)<\/div><\/section>/;
 const node=key=>{if(nodes.has(key))return nodes.get(key);let inner=key==='[data-collection-invoices]'?(list.exec(html)?.[1]??''):'';const n={isConnected:true,dataset:{},value:'',setAttribute(k,v){this[k]=v;},addEventListener(k,f){this['on'+k]=f;},closest(){return {insertAdjacentHTML(_where,value){html=value+html;}};},querySelectorAll(selector){if(selector!=='[data-collection-select]')return [];return [...inner.matchAll(/data-collection-select="([^"]+)"/g)].map(m=>{const b=node('[data-collection-select="'+m[1]+'"]');b.dataset.collectionSelect=m[1];return b;});}};if(key==='[data-collection-finance-panel]'&&html.includes('data-collection-finance-panel'))n.open=/<details[^>]*data-collection-finance-panel[^>]*\bopen\b/.test(html);Object.defineProperty(n,'innerHTML',{get:()=>inner,set:v=>{inner=v;if(key==='[data-collection-invoices]')html=html.replace(list,()=>'<div data-collection-invoices>'+v+'</div></section>');}});nodes.set(key,n);return n;};
 const root={isConnected:true,querySelector:node,querySelectorAll:()=>[]};Object.defineProperty(root,'innerHTML',{get:()=>html,set:v=>{html=v;nodes=new Map();}});return {root,node};}
test('validated invoice rows and selection buttons survive finance loading and failure paints without reload loop',async()=>{const create=await controller(),d=dom(),store=storage(),calls=[];let rejectFinance;const session={work:async p=>{calls.push(p);if(p==='/api/work-sales/invoices')return {data:[invoice('42')]};if(p==='/api/work-sales/context')return {};if(p.includes('/context?invoiceId='))return context(p.split('=').at(-1));throw Error(p);},supplierPayments:()=>new Promise((_r,reject)=>{rejectFinance=reject;})};const ui=create({root:d.root,session,user:{id:16},storage:store});ui.mount();await tick();assert.match(d.root.innerHTML,/SAT-42/);assert.doesNotMatch(d.root.innerHTML,/Fişler açılıyor/);assert.equal(typeof d.node('[data-collection-select="42"]').onclick,'function');assert.equal(calls.filter(p=>p==='/api/work-sales/invoices').length,1);rejectFinance({status:403});await tick();assert.match(d.root.innerHTML,/SAT-42/);assert.equal(calls.filter(p=>p==='/api/work-sales/invoices').length,1);d.node('[data-collection-select="42"]').onclick();await tick();assert.equal(store.getItem('melisa-work-selected-invoice:16'),'42');assert.ok(calls.includes('/api/work-collections/context?invoiceId=42'));assert.match(d.root.innerHTML,/Fiş toplamı/);ui.dispose();});
test('refresh invalidates cached rows and ignores an older list response after the new generation',async()=>{const create=await controller(),d=dom(),responses=[],session={work:()=>new Promise(resolve=>responses.push(resolve))},ui=create({root:d.root,session,user:{id:16},storage:storage()});ui.mount();await tick();responses[0]({data:[invoice('42')]});await tick();assert.match(d.root.innerHTML,/SAT-42/);ui.refresh();await tick();assert.doesNotMatch(d.root.innerHTML,/SAT-42/);assert.match(d.root.innerHTML,/Fişler açılıyor/);ui.refresh();await tick();assert.equal(responses.length,3);responses[2]({data:[invoice('44')]});await tick();assert.match(d.root.innerHTML,/SAT-44/);responses[1]({data:[invoice('43')]});await tick();assert.doesNotMatch(d.root.innerHTML,/SAT-43/);assert.match(d.root.innerHTML,/SAT-44/);const rendered=d.root.innerHTML;ui.dispose();assert.equal(d.root.innerHTML,rendered);});

for(const replayed of [false,true])test(`confirmed cancellation uses cancellation language after successful refresh (replay=${replayed})`,async()=>{
 const create=await controller(),d=dom(),store=storage(),journal=createTradeJournal({storage:store,key:'melisa-work-collection-v1:local:16'});
 const body={requestId,expectedRevision:revision,reason:'Yanlış örnek tahsilat',documentDate:'2026-10-07'},entry={id:'77',invoiceId:'42',accountId:'99',amountExact4:'50.0000',currency:'TRY',documentDate:'2026-10-07',status:'active',revision};
 const before={...invoice('42'),customerBalanceExact4:'70.0000',collections:{revision,receivedExact4:'50.0000',outstandingExact4:'70.0000',items:[entry]}},cancelled={...entry,status:'cancelled'},after={...invoice('42'),collections:{revision,receivedExact4:'0.0000',outstandingExact4:'120.0000',items:[cancelled]}};
 store.setItem('melisa-work-selected-invoice:16','42');journal.begin('/api/work-collections/77/cancel',body);let writes=0;
 const ui=create({root:d.root,user:{id:16},storage:store,session:{work:async(path,options)=>{
  if(options?.method==='POST'){writes++;assert.equal(path,'/api/work-collections/77/cancel');assert.deepEqual(options.body,body);return {collection:cancelled,invoice:after,requestId,replayed};}
  if(path.includes('/context?'))return {...context('42'),invoice:writes?after:before};return {data:[writes?after:before]};
 }}});ui.mount();await tick();d.node('[data-collection-retry]').onclick();await tick();
 assert.equal(writes,1);assert.equal(journal.read().status,'done');assert.match(d.root.innerHTML,replayed?/aynı iptal tekrar oluşturulmadı/:/Tahsilat iptal edildi/);assert.doesNotMatch(d.root.innerHTML,/Tahsilat kaydedildi/);assert.match(d.root.innerHTML,/Kalan: 120,00 TRY/);assert.equal(ui.requestClose(),true);ui.dispose();
});
test('stale stored selection 404 clears only that key and allows another validated invoice without writes',async()=>{const create=await controller(),d=dom(),store=storage(),calls=[];store.setItem('melisa-work-selected-invoice:16','999');store.setItem('keep-user-preference','value');const session={work:async(p,o)=>{calls.push({p,o});if(p.endsWith('invoiceId=999'))throw {status:404};if(p==='/api/work-sales/invoices')return {data:[invoice('42')]};if(p.endsWith('invoiceId=42'))return context('42');throw Error(p);}};const ui=create({root:d.root,session,user:{id:16},storage:store});ui.mount();await tick();assert.equal(store.getItem('melisa-work-selected-invoice:16'),null);assert.equal(store.getItem('keep-user-preference'),'value');assert.deepEqual(store.removed,['melisa-work-selected-invoice:16']);assert.match(d.root.innerHTML,/Listeden başka bir fiş seçin/);assert.match(d.root.innerHTML,/SAT-42/);ui.refresh();await tick();assert.equal(calls.filter(c=>c.p.endsWith('invoiceId=999')).length,1);d.node('[data-collection-select="42"]').onclick();await tick();assert.equal(store.getItem('melisa-work-selected-invoice:16'),'42');assert.match(d.root.innerHTML,/Fiş toplamı/);assert.ok(calls.every(c=>c.o?.method!=='POST'));ui.dispose();});
test('404 cannot discard an unresolved payment journal or unlock another invoice',async()=>{const create=await controller(),d=dom(),store=storage(),calls=[],body={invoiceId:'999',accountId:'99',amountExact4:'1.0000',documentDate:'2026-10-07',requestId};store.setItem('melisa-work-selected-invoice:16','999');const journal=createTradeJournal({storage:store,key:'melisa-work-collection-v1:local:16'});journal.begin('/api/work-collections',body);const session={work:async(p,o)=>{calls.push({p,o});if(p.includes('/context?'))throw {status:404};return {data:[invoice('42')]};}};const ui=create({root:d.root,session,user:{id:16},storage:store});ui.mount();await tick();assert.deepEqual(journal.read().body,body);assert.equal(journal.read().status,'pending');assert.equal(store.getItem('melisa-work-selected-invoice:16'),'999');assert.match(d.root.innerHTML,/data-collection-select="42" disabled/);d.node('[data-collection-select="42"]').onclick();assert.equal(store.getItem('melisa-work-selected-invoice:16'),'999');assert.equal(ui.requestClose(),false);assert.ok(calls.every(c=>c.o?.method!=='POST'));ui.dispose();});
test('late finance completion after disposal cannot repaint retained rows',async()=>{const create=await controller(),d=dom();let finish;const session={work:async p=>p==='/api/work-sales/invoices'?{data:[invoice('42')]}:{},supplierPayments:()=>new Promise(resolve=>{finish=resolve;})},ui=create({root:d.root,session,user:{id:16},storage:storage()});ui.mount();await tick();const rendered=d.root.innerHTML;ui.dispose();finish({});await tick();assert.equal(d.root.innerHTML,rendered);});

test('a completed older journal cannot supply the date of a newly selected invoice',async()=>{const create=await controller(),d=dom(),store=storage();store.setItem('melisa-work-selected-invoice:16','42');const j=createTradeJournal({storage:store,key:'melisa-work-collection-v1:local:16'}),p=j.begin('/api/work-collections',{invoiceId:'41',accountId:'99',amountExact4:'1.0000',documentDate:'2026-10-06',requestId});j.done(p,{invoice:invoice('41')});const original=store.getItem('melisa-work-collection-v1:local:16');const session={work:async path=>path.includes('/context?')?context('42'):{data:[invoice('42')]}};const ui=create({root:d.root,session,user:{id:16},storage:store});ui.mount();await tick();assert.match(d.root.innerHTML,/data-collection-date value="2026-10-07"/);assert.equal(store.getItem('melisa-work-collection-v1:local:16'),original);ui.dispose();});

for(const operation of ['partial','full','cancel','replay'])for(const refreshFailure of ['network',403,404,409])test(`successful ${operation} result survives follow-up ${refreshFailure} without another payment`,async()=>{
 const create=await controller(),d=dom(),store=storage(),journal=createTradeJournal({storage:store,key:'melisa-work-collection-v1:local:16'}),amount=operation==='full'?'120.0000':'50.0000',cancel=operation==='cancel';
 const body=cancel?{requestId,expectedRevision:revision,reason:'Yanlış tahsilat',documentDate:'2026-10-07'}:{requestId,invoiceId:'42',accountId:'99',amountExact4:amount,documentDate:'2026-10-07',previewHash:revision,expectedRevision:revision};
 const path=cancel?'/api/work-collections/77/cancel':'/api/work-collections',entry={id:'77',invoiceId:'42',accountId:'99',amountExact4:amount,currency:'TRY',documentDate:'2026-10-07',status:cancel?'cancelled':'active',revision};
 const remaining=cancel?'120.0000':operation==='full'?'0.0000':'70.0000',received=cancel?'0.0000':amount;
 const updated={...invoice('42'),customerBalanceExact4:remaining,collections:{revision,receivedExact4:received,outstandingExact4:remaining,items:[entry]}},result={collection:entry,invoice:updated,requestId,replayed:operation==='replay'};
 store.setItem('melisa-work-selected-invoice:16','42');if(cancel||operation==='replay')journal.begin(path,body);
 let contextReads=0;const writes=[];
 const session={work:async(p,o)=>{
  if(p==='/api/work-collections/preview')return {selection:o.body,previewHash:revision,revision,currency:'TRY',amountExact4:amount,receivedAfterExact4:amount,outstandingAfterExact4:remaining};
  if(o?.method==='POST'){writes.push({path:p,body:structuredClone(o.body)});assert.equal(p,path);return structuredClone(result);}
  if(p.includes('/context?')){contextReads++;if(contextReads===2)throw refreshFailure==='network'?new Error('private transport detail'):{status:refreshFailure};return {...context('42'),invoice:contextReads>2?updated:invoice('42')};}
  return {data:contextReads>1?[]:[invoice('42')]};
 }};
 const ui=create({root:d.root,session,user:{id:16},storage:store,uuid:()=>requestId});ui.mount();await tick();
 if(cancel||operation==='replay')d.node('[data-collection-retry]').onclick();else{
  for(const [selector,value] of [['[data-collection-account]','99'],['[data-collection-amount]',amount],['[data-collection-date]','2026-10-07']])d.node(selector).value=value;
  d.node('[data-collection-preview]').onclick();await tick();assert.match(d.root.innerHTML,/data-collection-save/);d.node('[data-collection-save]').onclick();
 }
 await tick();
 assert.equal(writes.length,1);assert.deepEqual(writes[0],{path,body});assert.equal(journal.read().status,'done');assert.deepEqual(journal.read().result,result);
 assert.doesNotMatch(d.root.innerHTML,/data-collection-save|data-collection-preview|data-collection-retry|Fiş toplamı:|private transport detail/);
 assert.match(d.root.innerHTML,/İşlem kaydedildi|Kayıt doğrulandı/);assert.equal(ui.requestClose(),true);
 await ui.refresh();await tick();assert.match(d.root.innerHTML,new RegExp('Kalan: '+remaining.replace('.0000',',00')+' TRY'));assert.equal(writes.length,1);assert.deepEqual(journal.read().result,result);ui.dispose();
});

test('a pre-payment list response cannot restore the old amount after a confirmed payment',async()=>{
 const create=await controller(),d=dom(),store=storage(),journal=createTradeJournal({storage:store,key:'melisa-work-collection-v1:local:16'});
 const body={requestId,invoiceId:'42',accountId:'99',amountExact4:'50.0000',documentDate:'2026-10-07',previewHash:revision,expectedRevision:revision};
 const entry={id:'77',invoiceId:'42',accountId:'99',amountExact4:'50.0000',currency:'TRY',documentDate:'2026-10-07',status:'active',revision},updated={...invoice('42'),customerBalanceExact4:'70.0000',collections:{revision,receivedExact4:'50.0000',outstandingExact4:'70.0000',items:[entry]}};
 journal.begin('/api/work-collections',body);let oldList,lists=0,reads=0,posts=0;
 const session={work:async(path,o)=>{
  if(o?.method==='POST'){posts++;return {collection:entry,invoice:updated,requestId,replayed:true};}
  if(path.includes('/context?')){if(++reads===2)throw {status:403};return context('42');}
  if(++lists===1)return new Promise(resolve=>{oldList=resolve;});return {data:[updated]};
 }};
 const ui=create({root:d.root,session,user:{id:16},storage:store});ui.mount();await tick();d.node('[data-collection-retry]').onclick();await tick();
 assert.match(d.root.innerHTML,/Kalan 70,00 TRY/);oldList({data:[invoice('42')]});await tick();
 assert.match(d.root.innerHTML,/Kalan 70,00 TRY/);assert.doesNotMatch(d.root.innerHTML,/Kalan 120,00 TRY|data-collection-save|data-collection-retry/);assert.equal(posts,1);assert.equal(journal.read().result.replayed,true);ui.dispose();
});

test('failed success storage keeps the original pending request locked until the same UUID is replayed',async()=>{
 const create=await controller(),d=dom(),backing=storage();let failed=false;
 const store={...backing,setItem(key,value){if(key==='melisa-work-collection-v1:local:16'&&JSON.parse(value).status==='done'&&!failed){failed=true;throw Error('storage unavailable');}backing.setItem(key,value);}};
 const journal=createTradeJournal({storage:store,key:'melisa-work-collection-v1:local:16'}),body={requestId,invoiceId:'42',accountId:'99',amountExact4:'50.0000',documentDate:'2026-10-07',previewHash:revision,expectedRevision:revision},sent=journal.begin('/api/work-collections',body),original=store.getItem('melisa-work-collection-v1:local:16');
 const entry={id:'77',invoiceId:'42',accountId:'99',amountExact4:'50.0000',currency:'TRY',documentDate:'2026-10-07',status:'active',revision},updated={...invoice('42'),customerBalanceExact4:'70.0000',collections:{revision,receivedExact4:'50.0000',outstandingExact4:'70.0000',items:[entry]}},writes=[];
 const session={work:async(path,o)=>{
  if(o?.method==='POST'){writes.push({path,body:structuredClone(o.body)});return {collection:entry,invoice:updated,requestId,replayed:writes.length>1};}
  if(path.includes('/context?'))return {...context('42'),invoice:writes.length?updated:invoice('42')};return {data:[writes.length?updated:invoice('42')]};
 }};
 const ui=create({root:d.root,session,user:{id:16},storage:store});ui.mount();await tick();d.node('[data-collection-retry]').onclick();await tick();
 assert.equal(failed,true);assert.equal(writes.length,1);assert.equal(store.getItem('melisa-work-collection-v1:local:16'),original);assert.deepEqual(journal.read(),sent);assert.equal(ui.requestClose(),false);
 assert.match(d.root.innerHTML,/data-collection-retry/);assert.doesNotMatch(d.root.innerHTML,/İşlem kaydedildi|Tahsilat kaydedildi|Kayıt doğrulandı/);
 d.node('[data-collection-retry]').onclick();await tick();
 assert.deepEqual(writes,[{path:sent.path,body},{path:sent.path,body}]);assert.equal(journal.read().status,'done');assert.equal(journal.read().result.replayed,true);assert.equal(journal.read().result.collection.id,'77');assert.equal(ui.requestClose(),true);assert.match(d.root.innerHTML,/Kalan: 70,00 TRY/);assert.doesNotMatch(d.root.innerHTML,/data-collection-retry/);ui.dispose();
});

test('a pre-payment finance failure cannot replace the new finance result after a confirmed payment',async()=>{
 const create=await controller(),d=dom(),store=storage(),journal=createTradeJournal({storage:store,key:'melisa-work-collection-v1:local:16'}),body={requestId,invoiceId:'42',accountId:'99',amountExact4:'50.0000',documentDate:'2026-10-07',previewHash:revision,expectedRevision:revision};
 journal.begin('/api/work-collections',body);let oldFinance,financeReads=0,posts=0;
 const entry={id:'77',invoiceId:'42',accountId:'99',amountExact4:'50.0000',currency:'TRY',documentDate:'2026-10-07',status:'active',revision},updated={...invoice('42'),customerBalanceExact4:'70.0000',collections:{revision,receivedExact4:'50.0000',outstandingExact4:'70.0000',items:[entry]}};
 const session={work:async(path,o)=>{if(o?.method==='POST'){posts++;return {collection:entry,invoice:updated,requestId,replayed:true};}if(path.includes('/context?'))return {...context('42'),invoice:posts?updated:invoice('42')};if(path==='/api/work-sales/context')return {};return {data:[posts?updated:invoice('42')]};},supplierPayments:()=>++financeReads===1?new Promise((_resolve,reject)=>{oldFinance=reject;}):Promise.reject({status:403})};
 const ui=create({root:d.root,session,user:{id:16},storage:store});ui.mount();await tick();assert.equal(financeReads,1);d.node('[data-collection-retry]').onclick();await tick();assert.equal(financeReads,2);
 assert.match(d.root.innerHTML,/Finans hareketlerini görüntüleme yetkiniz yok/);oldFinance(new Error('old transport failure'));await tick();
 assert.match(d.root.innerHTML,/Finans hareketlerini görüntüleme yetkiniz yok/);assert.doesNotMatch(d.root.innerHTML,/Hareket bilgileri şu anda açılamıyor|old transport failure/);assert.match(d.root.innerHTML,/Kalan: 70,00 TRY/);assert.equal(posts,1);ui.dispose();
});

test('finance disclosure preserves the user choice through its own refresh and asynchronous failure',async()=>{
 const create=await controller(),d=dom(),pending=[],calls=[];
 const session={work:async(path,options)=>{calls.push({path,options});return path==='/api/work-sales/invoices'?{data:[invoice('42')]}:{};},supplierPayments:()=>new Promise((_resolve,reject)=>pending.push(reject))};
 const ui=create({root:d.root,session,user:{id:16},storage:storage()});ui.mount();await tick();
 d.node('[data-collection-finance-panel]').open=true;pending[0]({status:403});await tick();
 assert.match(d.root.innerHTML,/<details[^>]*data-collection-finance-panel open>/);assert.match(d.root.innerHTML,/Finans hareketlerini görüntüleme yetkiniz yok/);
 d.node('[data-collection-finance-refresh]').onclick();await tick();assert.match(d.root.innerHTML,/<details[^>]*data-collection-finance-panel open>/);
 pending[1]({status:500});await tick();assert.match(d.root.innerHTML,/<details[^>]*data-collection-finance-panel open>/);assert.match(d.root.innerHTML,/Hareket bilgileri şu anda açılamıyor/);
 d.node('[data-collection-finance-panel]').open=false;ui.refresh();await tick();pending[2]({status:500});await tick();
 assert.doesNotMatch(d.root.innerHTML,/<details[^>]*data-collection-finance-panel open>/);assert.ok(calls.every(c=>!c.options?.method));ui.dispose();
});

// Controller tests isolate request/generation orchestration. Exact arithmetic,
// source bindings and reversal validation use the real model in its own tests.
const panelBuilder=({invoices,collectionContexts})=>{if(collectionContexts?.length!==invoices.length||collectionContexts.some(c=>c.customer.id!==c.invoice.customerId))throw Error('Incomplete source');return {summary:[],bankAccounts:[],rows:collectionContexts.map(c=>({kind:'Müşteri tahsilatı',partyName:c.customer.name,date:c.invoice.documentDate,reference:c.invoice.documentNo,accountName:c.accounts[0].name,status:'Aktif',direction:'in',currency:c.invoice.currency,amountExact4:'1.0000'}))};};
function panelFixture(){
 const currencies=['TRY','TRY','USD','EUR'],rows=currencies.map((currency,n)=>{const i=invoice(String(n+1));return {...i,customerId:String(501+n),currency,items:i.items.map(item=>({...item,currency}))};});
 const contexts=new Map(rows.map((i,n)=>[i.id,{...context(i.id),invoice:structuredClone(i),customer:{id:i.customerId,name:'Yapay kişi '+i.customerId,synthetic:true,writeEligible:true},accounts:[{id:String(91+n),name:i.currency+' hesap',currency:i.currency,synthetic:true}]}]));
 return {rows,contexts,list:{data:rows,meta:{total:4,page:1,limit:25}},sales:{meta:{cleanSaleReadOnly:true}}};
}

test('clean panel reads every existing invoice context once and never publishes a partial source set',async()=>{
 const create=await controller(panelBuilder),d=dom(),f=panelFixture(),pending=new Map(),calls=[];
 const session={work:async(path,options)=>{calls.push({path,options});if(path==='/api/work-sales/invoices')return f.list;if(path==='/api/work-sales/context')return f.sales;const id=path.split('=').at(-1);return new Promise(resolve=>pending.set(id,resolve));},supplierPayments:async()=>({})};
 const ui=create({root:d.root,session,user:{id:16},storage:storage()});ui.mount();await tick();assert.deepEqual([...pending.keys()],['1','2','3','4']);
 for(const id of ['4','2','1'])pending.get(id)(f.contexts.get(id));await tick();assert.doesNotMatch(d.root.innerHTML,/class="finance-movement"/);assert.match(d.root.innerHTML,/Hareketler yükleniyor/);
 pending.get('3')(f.contexts.get('3'));await tick();for(const id of ['501','502','503','504'])assert.match(d.root.innerHTML,new RegExp('Yapay kişi '+id));assert.equal(calls.filter(c=>c.path.startsWith('/api/work-collections/context?')).length,4);assert.ok(calls.every(c=>!c.options?.method));ui.dispose();
});

for(const failure of ['denied','malformed','partial-page'])test('clean panel keeps invoices but no movement totals after '+failure,async()=>{
 const create=await controller(panelBuilder),d=dom(),f=panelFixture(),calls=[];if(failure==='partial-page')f.list.meta.total=5;
 const session={work:async path=>{calls.push(path);if(path==='/api/work-sales/invoices')return f.list;if(path==='/api/work-sales/context')return f.sales;const id=path.split('=').at(-1);if(id==='3'&&failure==='denied')throw {status:403};const c=structuredClone(f.contexts.get(id));if(id==='3'&&failure==='malformed')c.customer.id='999';return c;},supplierPayments:async()=>({})};
 const ui=create({root:d.root,session,user:{id:16},storage:storage()});ui.mount();await tick();assert.match(d.root.innerHTML,/SAT-4/);assert.doesNotMatch(d.root.innerHTML,/class="finance-movement"|finance-movement-summary/);assert.match(d.root.innerHTML,failure==='denied'?/Finans hareketlerini görüntüleme yetkiniz yok/:/Hareket bilgileri şu anda açılamıyor/);assert.equal(calls.filter(p=>p.startsWith('/api/work-collections/context?')).length,failure==='partial-page'?0:4);ui.dispose();
});

test('clean context responses from an old generation cannot replace a refreshed panel',async()=>{
 const create=await controller(panelBuilder),d=dom(),f=panelFixture(),pending=[];let pass=0;
 const session={work:async path=>{if(path==='/api/work-sales/invoices'){pass++;return f.list;}if(path==='/api/work-sales/context')return f.sales;const generation=pass,id=path.split('=').at(-1);return new Promise(resolve=>pending.push(()=>{const c=structuredClone(f.contexts.get(id));c.customer.name=generation===1?'Ancak eski kaynak':'Yeni kaynak '+id;resolve(c);}));},supplierPayments:async()=>({})};
 const ui=create({root:d.root,session,user:{id:16},storage:storage()});ui.mount();await tick();assert.equal(pending.length,4);ui.refresh();await tick();assert.equal(pending.length,8);pending.slice(4).forEach(resolve=>resolve());await tick();assert.match(d.root.innerHTML,/Yeni kaynak 4/);pending.slice(0,4).forEach(resolve=>resolve());await tick();assert.match(d.root.innerHTML,/Yeni kaynak 4/);assert.doesNotMatch(d.root.innerHTML,/Ancak eski kaynak/);ui.dispose();
});

test('dispose before clean source admission prevents further detail reads',async()=>{
 const create=await controller(panelBuilder),d=dom(),f=panelFixture(),calls=[];let resolveSales;
 const ui=create({root:d.root,user:{id:16},storage:storage(),session:{work:async path=>{calls.push(path);if(path==='/api/work-sales/invoices')return f.list;if(path==='/api/work-sales/context')return new Promise(r=>{resolveSales=r;});throw Error('No detail read after dispose');},supplierPayments:async()=>({})}});ui.mount();await tick();const rendered=d.root.innerHTML;ui.dispose();resolveSales(f.sales);await tick();assert.equal(d.root.innerHTML,rendered);assert.equal(calls.filter(p=>p.startsWith('/api/work-collections/context?')).length,0);
});

test('legacy finance does not add clean detail reads',async()=>{
 const create=await controller(),d=dom(),calls=[];const ui=create({root:d.root,user:{id:16},storage:storage(),session:{work:async path=>{calls.push(path);return path==='/api/work-sales/invoices'?{data:[invoice('42')]}:{};},supplierPayments:async()=>({})}});ui.mount();await tick();assert.deepEqual(calls,['/api/work-sales/invoices','/api/work-sales/context']);ui.dispose();
});
