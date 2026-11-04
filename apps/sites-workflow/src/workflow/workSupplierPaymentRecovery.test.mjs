import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPaymentJournal} from './workSupplierPaymentsModel.mjs';
import {supplierPaymentContext,supplierPaymentPreview} from '../../../api/src/services/workSupplierPaymentModel.mjs';

// All records, responses and storage below are synthetic, in-memory fixtures.
const base='/api/work-supplier-payments',apiBase='http://127.0.0.1:4144';
const requestId='00000000-0000-4000-8000-000000000001';
const actor={id:'16',permissions:['finance.view','supplier.view','finance.payment','finance.payment.cancel']};
const selection={supplierId:'101',invoiceId:'139',accountId:'201',currency:'TRY',amountExact4:'50.0000',documentDate:'2026-10-06',description:'Yapay ödeme <not>'};
function payment(){return {id:'701',...selection,receiptId:'105',receiptKind:'work-finops-physical-receipt',invoiceNumber:'TSTB-PAY',ownership:'work',canCancel:true,kind:'payment',direction:'out',accountCurrency:'TRY',accountAmountExact4:'50.0000',amountTryExact4:'50.0000',documentRateExact8:'1.00000000',accountRateExact8:'1.00000000',number:'OD-701',originalId:null,reversedById:null};}
function context(){return supplierPaymentContext({actorId:'16',roleCode:'isolated_test_ilker',permissions:actor.permissions,documentDate:selection.documentDate,maxAmountExact4:'500.0000',maxPayments:30,
 suppliers:[{id:'101',code:'SUP-TRY',name:'Yapay tedarikçi',currency:'TRY',balanceExact4:'140.0000',debtKind:'invoice',snapshotVerified:true,invoices:[{id:'139',receiptId:'105',number:'TSTB-PAY',status:'finalized',documentDate:selection.documentDate,receiptKind:'work-finops-physical-receipt',documentCurrency:'TRY',documentAmountExact4:'140.0000',accountCurrency:'TRY',accountAmountExact4:'140.0000',paidExact4:'0.0000',returnedExact4:'0.0000',remainingExact4:'140.0000'}]},...['USD','EUR'].map((currency,i)=>({id:String(102+i),code:'SUP-'+currency,name:'Yapay '+currency,currency,balanceExact4:'20.0000',debtKind:'opening',snapshotVerified:true,invoices:[]}))],
 accounts:['TRY','USD','EUR'].map((currency,i)=>({id:String(201+i),code:'ACC-'+currency,name:'Yapay kasa '+currency,type:i?'bank':'cash',currency,openingVerified:true,openingBalanceExact4:'1000.0000',balanceExact4:'1000.0000'})),rates:[],payments:[payment()]},actor);}
function receiving(){return {meta:{schemaVersion:'melisa-work-inbound.v1',source:'native-test',timeZone:'Europe/Istanbul'},capabilities:Object.fromEntries(['canCount','canSubmit','canApprove','canReject','canViewPurchase','canViewSupplier','canCreatePurchase','canFinalizePurchase','canCancelPurchase'].map(k=>[k,k==='canViewPurchase'])),scope:{synthetic:true,supplier:{id:'1',code:'S',name:'S'},warehouse:{id:'1',label:'Depo'},products:['2','3'].map(id=>({id,stockCode:id,name:id,barcode:null,unit:{label:'ADET',factorExact8:'1.00000000'},stockQuantityExact3:null,writeEligible:true}))},countDrafts:[],receipts:[]};}
function storage(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
function dom(){let html='';const nodes=new Map(),node=k=>{if(!nodes.has(k))nodes.set(k,{value:'',dataset:{},elements:{reason:{value:'Yapay düzeltme'},date:{value:selection.documentDate}},setAttribute(){},remove(){},querySelector:node,addEventListener(e,f){this['on'+e]=f;}});return nodes.get(k);};return {node,root:{isConnected:true,get innerHTML(){return html;},set innerHTML(v){html=v;},querySelector:node,querySelectorAll(selector){return [...html.matchAll(/data-sp-cancel="(\d+)"/g)].map(m=>{const n=node(selector+m[1]);n.dataset.spCancel=m[1];return n;});}}};}
async function controller(){let source=await readFile(new URL('./workSupplierPayments.js',import.meta.url),'utf8');source=source.replace("import './workSupplierPayments.css';",'').replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,import.meta.url).href));return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));}
const tick=()=>new Promise(r=>setImmediate(r));
function intent(kind,c){if(kind==='cancel')return {path:base+'/payments/701/cancel',body:{reason:'Yapay düzeltme',documentDate:selection.documentDate}};const p=supplierPaymentPreview(selection,c);return {path:base+'/payments',body:{...selection,expectedRevision:p.revision,previewHash:p.previewHash}};}
function response(kind,body,replayed=true){const p=payment();return {requestId:body.requestId,replayed,payment:kind==='cancel'?{...p,id:'702',kind:'payment_cancel',direction:'in',canCancel:false,originalId:'701',description:body.reason}:p};}
async function harness(kind,{restored=false,error={status:409},refreshError=false,lookup=null,lookupRefreshStatus=null}={}){
 const {createWorkSupplierPayments}=await controller(),d=dom(),store=storage(),c=context(),calls=[];
 let uuids=0,writes=0,nextError=error,lookupRead=false;
 const journal=createPaymentJournal({storage:store,actorId:'16',apiBase,makeUuid:()=>requestId});
 if(restored){journal.backup({supplierId:'101',invoiceId:'139',accountId:'201',amount:'50',date:selection.documentDate,description:selection.description});const p=intent(kind,c);journal.begin(p.path,p.body);}
 const session={inbound:async()=>receiving(),supplierPayments:async(path,options)=>{
  calls.push({path,options:structuredClone(options)});
  if(!options){if(path.includes('/requests/')){if(lookup){lookupRead=true;return lookup;}throw {status:404};}if(lookupRead&&lookupRefreshStatus)throw {status:lookupRefreshStatus};if(refreshError&&writes)throw {status:403};return c;}
  if(path.endsWith('/preview'))return supplierPaymentPreview(options.body,c);
  writes++;if(nextError)throw nextError;return response(kind,options.body);
 }};
 const ui=createWorkSupplierPayments({root:d.root,session,user:{id:16},storage:store,apiBase,uuid(){uuids++;return requestId;}});
 ui.mount();await tick();
 async function start(){d.node('[data-sp-supplier]').onchange({target:{value:'101'}});if(kind==='cancel'){d.node('[data-sp-cancel]701').onclick();d.node('form').onsubmit({preventDefault(){}});}else{
  d.node('[data-sp-invoice]').onchange({target:{value:'139'}});
  for(const [field,value] of [['account','201'],['amount','50'],['date',selection.documentDate],['description',selection.description]]){const n=d.node(`[data-sp-${field}]`);n.value=value;n.oninput({target:n});}
  d.node('[data-sp-check]').onclick();await tick();assert.match(d.root.innerHTML,/Ödemeyi onayla ve kaydet/);d.node('[data-sp-save]').onclick();
 }await tick();}
 async function retry(){d.node('[data-sp-retry]').onclick();await tick();}
 return {d,ui,journal,calls,start,retry,uuids:()=>uuids,writes:()=>writes,setError:e=>nextError=e};
}

for(const kind of ['payment','cancel'])for(const status of [403,503])test(`${kind}: confirmed restored GET keeps its receipt but disables stale context after refresh HTTP ${status}`,async t=>{
 const c=context(),p=intent(kind,c),body={...p.body,requestId};
 const h=await harness(kind,{restored:true,lookupRefreshStatus:status,lookup:{requestId,operation:kind==='cancel'?'payment_cancel':'payment',response:response(kind,body)}});t.after(()=>h.ui.dispose());
 const confirmed=h.journal.read();assert.equal(confirmed.request.status,'confirmed');assert.equal(h.writes(),0);assert.equal(h.uuids(),0);
 assert.match(h.d.root.innerHTML,/Ödeme sonucu kaydedildi; güncel borç okunamadı/);assert.doesNotMatch(h.d.root.innerHTML,/data-sp-(?:check|save|cancel)/);
 await h.ui.refresh();assert.deepEqual(h.journal.read(),confirmed);assert.equal(h.writes(),0);assert.equal(h.uuids(),0);assert.match(h.d.root.innerHTML,/Ödeme sonucu kaydedildi; güncel borç okunamadı/);assert.doesNotMatch(h.d.root.innerHTML,/data-sp-(?:check|save|cancel)/);
});

for(const kind of ['payment','cancel'])for(const status of [400,403,404,409,422]){
 test(`${kind}: restored unknown request survives explicit retry HTTP ${status} with exact original body`,async t=>{
  const h=await harness(kind,{restored:true,error:{status}});t.after(()=>h.ui.dispose());
  const original=h.journal.read();assert.equal(h.writes(),0);assert.equal(h.uuids(),0);
  await h.retry();assert.deepEqual(h.journal.read(),original);assert.equal(h.ui.requestClose(),false);
  assert.match(h.d.root.innerHTML,/Son işlemi doğrula/);assert.equal(h.writes(),1);
  assert.deepEqual(h.calls.filter(c=>c.options)[0],{path:original.request.path,options:{method:'POST',body:original.request.body}});
  h.setError(null);await h.retry();assert.equal(h.journal.read().request.status,'confirmed');assert.equal(h.ui.requestClose(),true);
  assert.equal(h.writes(),2);assert.equal(h.uuids(),0);assert.match(h.d.root.innerHTML,/ikinci kez kaydedilmedi/);
  assert.deepEqual(h.calls.filter(c=>c.options)[1].options.body,original.request.body);
 });
 test(`${kind}: same-screen lost ACK then HTTP ${status} cannot close the unknown original`,async t=>{
  const h=await harness(kind,{error:new Error('Synthetic lost ACK')});t.after(()=>h.ui.dispose());await h.start();
  const original=h.journal.read();assert.equal(original.request.status,'pending');assert.equal(h.writes(),1);
  h.setError({status});await h.retry();assert.deepEqual(h.journal.read(),original);assert.equal(h.ui.requestClose(),false);assert.equal(h.writes(),2);assert.equal(h.uuids(),1);
 });
 test(`${kind}: first send definitive HTTP ${status} still closes only its new request`,async t=>{
  const h=await harness(kind,{error:{status}});t.after(()=>h.ui.dispose());await h.start();
  assert.equal(h.journal.read().request.status,'rejected');assert.equal(h.ui.requestClose(),true);assert.equal(h.writes(),1);assert.equal(h.uuids(),1);
 });
}

for(const kind of ['payment','cancel']){
 test(`${kind}: first-send request conflict stays pending and never auto-retries`,async t=>{
  const h=await harness(kind,{error:{status:409,code:'WORK_PAYMENT_REQUEST_CONFLICT'}});t.after(()=>h.ui.dispose());await h.start();
  assert.equal(h.journal.read().request.status,'pending');assert.equal(h.ui.requestClose(),false);assert.equal(h.writes(),1);await tick();assert.equal(h.writes(),1);
 });
 test(`${kind}: confirmed result survives a rejected context refresh without another POST`,async t=>{
  const h=await harness(kind,{error:null,refreshError:true});t.after(()=>h.ui.dispose());await h.start();
  const confirmed=h.journal.read();assert.equal(confirmed.request.status,'confirmed');assert.equal(h.ui.requestClose(),true);
  assert.match(h.d.root.innerHTML,/Ödeme sonucu kaydedildi; güncel borç okunamadı/);
  h.ui.refresh();await tick();assert.deepEqual(h.journal.read(),confirmed);assert.equal(h.writes(),1);assert.equal(h.uuids(),1);
 });
 test(`${kind}: matching restored lookup confirms read-only without new UUID or POST`,async t=>{
  const c=context(),p=intent(kind,c),body={...p.body,requestId};
  const h=await harness(kind,{restored:true,lookup:{requestId,operation:kind==='cancel'?'payment_cancel':'payment',response:response(kind,body)}});t.after(()=>h.ui.dispose());
  assert.equal(h.journal.read().request.status,'confirmed');assert.equal(h.writes(),0);assert.equal(h.uuids(),0);assert.equal(h.ui.requestClose(),true);
 });
 test(`${kind}: mismatched restored lookup cannot unlock or rewrite the pending request`,async t=>{
  const h=await harness(kind,{restored:true,lookup:{requestId:'00000000-0000-4000-8000-000000000099',operation:'payment',response:{}}});t.after(()=>h.ui.dispose());
  const original=h.journal.read();assert.equal(original.request.status,'pending');assert.equal(h.ui.requestClose(),false);h.ui.refresh();await tick();
  assert.deepEqual(h.journal.read(),original);assert.equal(h.writes(),0);assert.equal(h.uuids(),0);
 });
}
