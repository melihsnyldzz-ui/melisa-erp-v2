import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createTradeJournal} from './workTradeModel.mjs';

const revision='a'.repeat(64),requestId='00000000-0000-4000-8000-000000000001';
const key='melisa-work-collection-v1:local:16',base='/api/work-collections';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function controller(){
 let source=await readFile(new URL('./workCollections.js',import.meta.url),'utf8');
 source=source.replace("import './workSales.css';",'');
 for(const file of ['workOpenAccountPresentation.mjs','isolatedOperationCopyModel.mjs','workCopyPresentation.mjs','workTradeModel.mjs','workFinanceMovements.mjs'])source=source.replace("'./"+file+"'",JSON.stringify(new URL('./'+file,import.meta.url).href));
 return (await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).createWorkCollections;
}
function storage(){
 const values=new Map(),removed=[];
 return {removed,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>{removed.push(k);values.delete(k);}};
}
// In-memory event/paint harness only. It does not claim native browser or human acceptance.
function dom(){
 let html='',nodes=new Map();
 const node=selector=>{
  if(nodes.has(selector))return nodes.get(selector);
  const n={value:'',dataset:{},innerHTML:'',setAttribute(k,v){this[k]=v;},remove(){},addEventListener(event,fn){this['on'+event]=fn;},querySelector:node,querySelectorAll:()=>[],closest:()=>({insertAdjacentHTML(_position,value){html=value+html;}})};
  nodes.set(selector,n);return n;
 };
 const root={isConnected:true,querySelector:node,querySelectorAll(selector){
  if(selector!=='[data-collection-cancel]')return [];
  return [...html.matchAll(/data-collection-cancel="([^"]+)"/g)].map(m=>{const n=node(selector+m[1]);n.dataset.collectionCancel=m[1];return n;});
 }};
 Object.defineProperty(root,'innerHTML',{get:()=>html,set:value=>{html=value;nodes=new Map();}});
 return {root,node};
}
// All identities below are invented fixture data; no connection is opened.
function businessCopy(){
 const origin='ISOLATED_TEST_COPY';
 return {schemaVersion:'melisa-stage4-isolated-operation-copy.v1',operationOrigin:origin,copyId:requestId,sealHash:revision,backupSHA:'B'.repeat(64),sourceDatabase:'MELISA_ERP_SIRKET_TEST_20260929_01',target:{server:'Semih\\MELISADEV',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'},date:'2026-10-09',scopeKind:'VERIFIED_BUSINESS_TEST',businessScopeHash:revision,businessInvoiceMaxExact4:'20000.0000',actors:[{id:'15',role:'isolated_test_sales'},{id:'16',role:'isolated_test_ilker'}],products:[{id:'444',supplierId:'601',sourceKey:['VEGA2026','F0102TBLSTOKLAR','444'].join('/'),stockCode:'OFFLINE-444',unit:'ADET',unitFactorExact8:'1.00000000',priceIds:['801'],barcodes:[]}],customers:[{id:'501',partyId:'901',accountId:'1001',currency:'TRY',sourceKey:['VEGA2026','F0102TBLCARI','501'].join('/')}],suppliers:[{id:'601',partyId:'902',accountId:'1002',currency:'TRY',sourceKey:['VEGA2026','F0103TBLCARI','601'].join('/')}],financeAccounts:[{id:'99',currency:'TRY'}],businessDaily:{scopeHash:'c'.repeat(64),selection:{productIds:['444'],customerAccountId:'1001',supplierAccountId:'1002',financeAccountId:'99',currency:'TRY'}}};
}
function fixture({copy=false,cancel=false,currency='TRY'}={}){
 const profile=copy?businessCopy():null,date=profile?.date??'2026-10-07';
 const path=cancel?base+'/77/cancel':base;
 const body=cancel?{expectedRevision:revision,reason:'Offline cancellation reason',documentDate:date,requestId}:{invoiceId:'42',accountId:'99',amountExact4:'50.0000',documentDate:date,previewHash:revision,expectedRevision:revision,requestId};
 const entry=()=>({id:'77',invoiceId:'42',accountId:'99',amountExact4:'50.0000',currency,documentDate:date,status:'active',revision});
 let records=cancel?[entry()]:[],received=cancel?50:0,effects=0;
 const requests=new Map();
 const invoice=()=>({id:'42',documentNo:'OFFLINE-42',documentDate:date,status:'finalized',customerId:'501',currency,revision,subtotalExact4:'120.0000',grandTotalExact4:'120.0000',amountTryExact4:'120.0000',customerBalanceExact4:(500-received).toFixed(4),collections:{revision,receivedExact4:received.toFixed(4),outstandingExact4:(120-received).toFixed(4),items:structuredClone(records)},items:[{productId:'444',stockCode:'OFFLINE-444',name:'Offline item',quantityExact3:'1.000',unitPriceExact8:'120.00000000',unitPriceExact4:'120.0000',lineTotalExact4:'120.0000',currency}]});
 const context=()=>({invoice:invoice(),revision,customer:copy?{...profile.customers[0],name:'Offline customer',synthetic:false,writeEligible:true,operationOrigin:profile.operationOrigin}:{id:'501',name:'Offline customer',synthetic:true,writeEligible:true},accounts:[{id:'99',name:'Offline cash',currency,synthetic:!copy,...(copy?{operationOrigin:profile.operationOrigin}:{})}],capabilities:{canCollect:true,canCancelCollection:true},...(copy?{meta:{date,operationOrigin:profile.operationOrigin,copyId:profile.copyId,sealHash:profile.sealHash,businessDailyScopeHash:profile.businessDaily.scopeHash}}:{})});
 return {profile,path,body,invoice,context,effects:()=>effects,commit(p,b){
  assert.equal(p,path);assert.deepEqual(b,body);
  const prior=requests.get(b.requestId);
  if(prior)return {...structuredClone(prior),replayed:true};
  if(cancel){records[0].status='cancelled';received=0;}else{records.push(entry());received=50;}
  effects++;
  const result={collection:structuredClone(records[0]),invoice:invoice(),requestId:b.requestId,replayed:false};
  requests.set(b.requestId,result);return structuredClone(result);
 }};
}
async function setup(options={}){
 const f=fixture(options),store=storage(),d=dom(),journal=createTradeJournal({storage:store,key}),writes=[];
 let behavior='lost',denial=403,refreshFailure=false,uuidCalls=0,ui;
 const previousWindow=globalThis.window,previousFormData=globalThis.FormData;
 if(f.profile)globalThis.window={location:{protocol:'http:',hostname:'127.0.0.1',port:'5234'},__MELISA_OPERATION_COPY__:f.profile};
 globalThis.FormData=class{get(){return f.body.reason;}};
 const create=await controller();
 const session={work:async(path,o)=>{
  if(path===base+'/preview')return {selection:o.body,previewHash:revision,revision,currency:f.invoice().currency,amountExact4:o.body.amountExact4,receivedAfterExact4:'50.0000',outstandingAfterExact4:'70.0000'};
  if(o?.method==='POST'){
   writes.push({path,body:structuredClone(o.body)});
   if(behavior==='denied')throw {status:denial};
   const response=f.commit(path,o.body);
   if(behavior==='lost')throw Error('offline lost acknowledgement');
   if(behavior==='malformed')return {...response,requestId:'00000000-0000-4000-8000-000000000002'};
   return response;
  }
  if(path===base+'/context?invoiceId=42'){if(refreshFailure)throw {status:403};return f.context();}
  assert.equal(path,'/api/work-sales/invoices');return {data:[f.invoice()]};
 }};
 const mount=async()=>{ui=create({root:d.root,session,user:{id:16},storage:store,uuid:()=>{uuidCalls++;return requestId;}});ui.mount();await tick();};
 store.setItem('melisa-work-selected-invoice:16','42');await mount();
 return {f,store,d,journal,writes,uuidCalls:()=>uuidCalls,ui:()=>ui,setBehavior(value,status=403){behavior=value;denial=status;},setRefreshFailure(value){refreshFailure=value;},async reload(){ui.dispose();await mount();},async start(){
  if(options.cancel){d.node('[data-collection-cancel]77').onclick();d.node('form').onsubmit({preventDefault(){},target:{}});}
  else{
   for(const [selector,value] of [['[data-collection-account]','99'],['[data-collection-amount]','50'],['[data-collection-date]',f.body.documentDate]]){d.node(selector).value=value;d.node(selector).onchange({target:{value}});}
   d.node('[data-collection-preview]').onclick();await tick();assert.match(d.root.innerHTML,/data-collection-save/);d.node('[data-collection-save]').onclick();
  }
  await tick();
 },async retry(){d.node('[data-collection-retry]').onclick();await tick();},close(){ui.dispose();if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;globalThis.FormData=previousFormData;}};
}

for(const copy of [false,true])for(const cancel of [false,true])for(const status of [400,403,404,409,422])test(`${copy?'business daily copy':'synthetic'} ${cancel?'cancel':'collect'} lost ACK stays pending without retry even if backend would return ${status}`,async()=>{
 const h=await setup({copy,cancel});
 try{
  await h.start();assert.equal(h.f.effects(),1);assert.equal(h.journal.read().status,'pending');
  const original=h.store.getItem(key);assert.deepEqual(h.writes,[{path:h.f.path,body:h.f.body}]);
  h.setBehavior('denied',status);await h.retry();
  assert.equal(h.journal.read().status,'pending');assert.equal(h.store.getItem(key),original);assert.match(h.d.root.innerHTML,/Önceki işlem doğrulanamadı/);assert.equal(h.ui().requestClose(),false);
  assert.match(h.d.root.innerHTML,/data-collection-retry/);assert.match(h.d.root.innerHTML,/data-collection-preview disabled/);
  assert.equal(h.writes.length,1);await h.reload();assert.equal(h.writes.length,1);
  await h.ui().refresh();await tick();assert.equal(h.writes.length,1);
  await h.retry();assert.equal(h.journal.read().status,'pending');assert.equal(h.store.getItem(key),original);
  h.setBehavior('confirmed');await h.retry();
  assert.equal(h.journal.read().status,'pending');assert.equal(h.f.effects(),1);assert.equal(h.ui().requestClose(),false);
  assert.equal(h.uuidCalls(),1);assert.deepEqual(h.writes,[{path:h.f.path,body:h.f.body}]);
  assert.deepEqual(h.store.removed,[]);assert.match(h.d.root.innerHTML,/data-collection-retry/);
  assert.doesNotMatch(h.d.root.innerHTML,/Kayıt doğrulandı|aynı tahsilat tekrar oluşturulmadı|aynı iptal tekrar oluşturulmadı/);
  await h.reload();assert.equal(h.writes.length,1);assert.equal(h.journal.read().status,'pending');assert.equal(h.store.getItem(key),original);
 }finally{h.close();}
});

for(const copy of [false,true])for(const cancel of [false,true])test(`${copy?'business daily copy':'synthetic'} restored ${cancel?'cancel':'collect'} request is preserved without a second POST`,async()=>{
 const h=await setup({copy,cancel});
 try{
  h.journal.begin(h.f.path,h.f.body);h.f.commit(h.f.path,h.f.body);
  const original=h.store.getItem(key);h.setBehavior('denied',403);await h.reload();
  assert.equal(h.writes.length,0);assert.equal(h.uuidCalls(),0);await h.retry();
  assert.equal(h.journal.read().status,'pending');assert.equal(h.store.getItem(key),original);assert.equal(h.ui().requestClose(),false);
  h.setBehavior('confirmed');await h.retry();assert.equal(h.journal.read().status,'pending');assert.equal(h.store.getItem(key),original);
  assert.equal(h.f.effects(),1);assert.equal(h.uuidCalls(),0);assert.deepEqual(h.writes,[]);assert.deepEqual(h.store.removed,[]);
 }finally{h.close();}
});

for(const copy of [false,true])for(const cancel of [false,true])for(const status of [400,403,404,409,422])test(`${copy?'business daily copy':'synthetic'} fresh ${cancel?'cancel':'collect'} rejection ${status} remains definitive`,async()=>{
 const h=await setup({copy,cancel});
 try{
  h.setBehavior('denied',status);await h.start();
  assert.equal(h.f.effects(),0);assert.equal(h.writes.length,1);assert.equal(h.uuidCalls(),1);
  assert.equal(h.journal.read().status,'done');assert.deepEqual(h.journal.read().result,{rejected:true,status});assert.equal(h.ui().requestClose(),true);
  assert.doesNotMatch(h.d.root.innerHTML,/data-collection-retry|data-collection-preview disabled/);
  await h.reload();assert.equal(h.writes.length,1);assert.equal(h.journal.read().status,'done');
 }finally{h.close();}
});

for(const currency of ['USD','EUR'])test(`unknown ${currency} collection preserves its original body and separate currency without replay`,async()=>{
 const h=await setup({currency});
 try{
  await h.start();const original=h.store.getItem(key);h.setBehavior('denied',409);await h.retry();assert.equal(h.journal.read().status,'pending');
  h.setBehavior('confirmed');await h.retry();assert.equal(h.f.effects(),1);assert.equal(h.uuidCalls(),1);
  assert.equal(h.f.invoice().currency,currency);assert.equal(h.f.invoice().collections.items[0].currency,currency);assert.equal(h.store.getItem(key),original);
  assert.deepEqual(h.writes,[{path:h.f.path,body:h.f.body}]);assert.deepEqual(h.store.removed,[]);
 }finally{h.close();}
});

for(const cancel of [false,true])test(`fresh confirmed ${cancel?'cancel':'collect'} stays done when follow-up refresh is denied`,async()=>{
 const h=await setup({cancel});
 try{
  h.setBehavior('confirmed');h.setRefreshFailure(true);await h.start();
  const done=h.store.getItem(key);assert.equal(h.journal.read().status,'done');assert.equal(h.journal.read().result.replayed,false);
  assert.match(h.d.root.innerHTML,/İşlem kaydedildi/);assert.doesNotMatch(h.d.root.innerHTML,/data-collection-retry|data-collection-save/);
  assert.equal(h.ui().requestClose(),true);h.setRefreshFailure(false);await h.ui().refresh();await tick();
  assert.equal(h.store.getItem(key),done);assert.equal(h.writes.length,1);assert.equal(h.f.effects(),1);
 }finally{h.close();}
});

test('generic check never replays a committed lost response, generates an id or removes the retained journal',async()=>{
 const h=await setup();
 try{
  await h.start();assert.equal(h.f.effects(),1);const original=h.store.getItem(key),before=h.writes.length;
  const stale=h.d.node('[data-collection-retry]').onclick;await h.retry();await stale();await tick();
  assert.equal(h.writes.length,before);assert.equal(h.uuidCalls(),1);assert.equal(h.f.effects(),1);assert.equal(h.store.getItem(key),original);assert.deepEqual(h.store.removed,[]);
  assert.equal(h.journal.read().status,'pending');assert.match(h.d.root.innerHTML,/Önceki işlem doğrulanamadı/);assert.equal(h.ui().requestClose(),false);
  await h.reload();await h.retry();assert.equal(h.writes.length,before);assert.equal(h.store.getItem(key),original);assert.equal(h.journal.read().status,'pending');
 }finally{h.close();}
});

for(const change of ['replaced','removed','invalid','disposed'])test(`old generic verification handler cannot alter ${change} journal or send`,async()=>{
 const h=await setup();
 try{
  await h.start();const old=h.d.node('[data-collection-retry]').onclick,original=h.store.getItem(key),before=h.writes.length;
  if(change==='replaced')h.store.setItem(key,JSON.stringify({...h.journal.read(),body:{...h.journal.read().body,requestId:'00000000-0000-4000-8000-000000000002'}}));
  if(change==='removed')h.store.removeItem(key);if(change==='invalid')h.store.setItem(key,'invalid');
  if(change==='disposed')h.ui().dispose();const current=h.store.getItem(key),html=h.d.root.innerHTML;await old();await tick();
  assert.equal(h.writes.length,before);assert.equal(h.f.effects(),1);assert.equal(h.uuidCalls(),1);assert.equal(h.store.getItem(key),current);
  if(change==='disposed'){assert.equal(current,original);assert.equal(h.d.root.innerHTML,html);}else assert.match(h.d.root.innerHTML,/Bekleyen kayıt değişmiş veya okunamıyor/);
 }finally{h.close();}
});

test('an unverified response cannot complete an unknown request or authorize a new UUID',async()=>{
 const h=await setup();
 try{
  h.setBehavior('malformed');await h.start();assert.equal(h.journal.read().status,'pending');assert.equal(h.ui().requestClose(),false);
  h.setBehavior('denied',422);await h.retry();assert.equal(h.journal.read().status,'pending');assert.equal(h.uuidCalls(),1);
  h.setBehavior('confirmed');await h.retry();assert.equal(h.journal.read().status,'pending');assert.equal(h.writes.length,1);assert.equal(h.f.effects(),1);
 }finally{h.close();}
});
