import test from 'node:test';
import assert from 'node:assert/strict';
import {createTradeJournal,tradeCanonicalSaleRequest,tradeCanonicalSaleJournal,tradeCanonicalSaleInvoice,tradeUuid} from './workTradeModel.mjs';
import {saleNativeInvoice,saleReadProduct,saleReadSelection,saleNativeResult} from './workBusinessSalesRead.test-fixture.mjs';
import {emptyBusinessSalesBasket,addBusinessSalesBasketLine,businessSalesNativeSelection,validateBusinessSalesNativePreview} from './workBusinessSalesBasketModel.mjs';
const ids=[1,2,3].map(n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'));
const scope={customerId:'155',customerAccountId:'7',currency:'USD'};
function draft(){const product=saleReadProduct();product.stockQuantityExact='8.00000000';const q={customerId:'155',accountId:'7',currency:'USD',productId:'12',priceId:'81',unitSourceId:'9',tier:'1'},basket=addBusinessSalesBasketLine(emptyBusinessSalesBasket(),saleReadSelection(q,{product}),'2'),selection=businessSalesNativeSelection(basket,'2026-10-28'),preview=validateBusinessSalesNativePreview(saleNativeResult(selection),selection,basket);return {selection,preview};}
function storage(){const values=new Map();let writes=0;return {values,get writes(){return writes;},getItem:k=>values.get(k)??null,setItem(k,v){writes++;values.set(k,v);},removeItem(){assert.fail('No automatic clear');}};}
const receipt=(status='draft')=>saleNativeInvoice({status,creationRequestId:ids[0],revision:({draft:'c',finalized:'e',cancelled:'f'})[status].repeat(64)});
const envelope=(requestId,operation,invoice,replayed=false)=>({requestId,operation,response:{requestId,invoice,replayed}});
test('existing UUID journal supports source draft→reopen/replay→finalize→cancel typed chain without a new engine or write grant',()=>{
 const store=storage(),journal=createTradeJournal({storage:store,key:'existing-sale-key'}),d=tradeCanonicalSaleRequest({operation:'sale_draft',requestId:tradeUuid({randomUUID:()=>ids[0]}),...draft()});assert.equal(d.canSend,false);assert(Object.isFrozen(d.body.items[0]));
 const dp=journal.begin(d.path,d.body),before=store.writes;assert.equal(journal.read().body.customerAccountId,'7');assert.equal(store.writes,before);
 const di=tradeCanonicalSaleJournal(envelope(ids[0],'sale_draft',receipt()),journal.read(),scope);journal.done(dp,{requestId:ids[0],invoice:di,replayed:false});assert.equal(tradeCanonicalSaleJournal(envelope(ids[0],'sale_draft',receipt(),true),journal.read(),scope).creationRequestId,ids[0]);
 const f=tradeCanonicalSaleRequest({operation:'sale_finalize',requestId:ids[1],invoice:di,scope});assert.deepEqual(Object.keys(f.body).sort(),['expectedRevision','requestId']);const fp=journal.begin(f.path,f.body,{invoiceWitness:f.invoiceWitness});
 const fi=tradeCanonicalSaleJournal(envelope(ids[1],'sale_finalize',receipt('finalized')),journal.read(),scope);journal.done(fp,{requestId:ids[1],invoice:fi,replayed:false});assert.equal(fi.revision,'e'.repeat(64));assert.notEqual(fi.revision,f.body.expectedRevision);
 const c=tradeCanonicalSaleRequest({operation:'sale_cancel',requestId:ids[2],invoice:fi,scope,reason:'  Sentetik iptal  '});assert.deepEqual(Object.keys(c.body).sort(),['expectedRevision','reason','requestId']);assert.equal(c.body.reason,'Sentetik iptal');const cp=journal.begin(c.path,c.body,{invoiceWitness:c.invoiceWitness}),ci=tradeCanonicalSaleJournal(envelope(ids[2],'sale_cancel',receipt('cancelled')),journal.read(),scope);journal.done(cp,{requestId:ids[2],invoice:ci,replayed:false});assert.equal(journal.read().result.invoice.status,'cancelled');assert.equal(ci.creationRequestId,ids[0]);
});
test('draft cancellation reuses original creation witness and same journal while finalize/cancel cannot target a completed cancellation',()=>{
 const d=receipt(),p=tradeCanonicalSaleRequest({operation:'sale_cancel',requestId:ids[2],invoice:d,scope,reason:'Sentetik iptal'}),pending={version:1,status:'pending',path:p.path,body:p.body,invoiceWitness:p.invoiceWitness};assert.equal(tradeCanonicalSaleJournal(envelope(ids[2],'sale_cancel',receipt('cancelled')),pending,scope).status,'cancelled');
 for(const operation of ['sale_finalize','sale_cancel'])assert.throws(()=>tradeCanonicalSaleRequest({operation,requestId:ids[2],invoice:receipt('cancelled'),scope,reason:'Sentetik iptal'}));
});
test('account/party/origin/creation and source selection drift cannot supply a typed request or journal result',()=>{
 const d=tradeCanonicalSaleRequest({operation:'sale_draft',requestId:ids[0],...draft()}),pending={version:1,status:'pending',path:d.path,body:d.body};
 for(const patch of [{customerAccountId:'9'},{customerId:'156'},{currency:'EUR'},{partyEntityId:null},{creationRequestId:ids[1]},{operationOrigin:'ISOLATED_TEST_COPY'},{customerBalanceExact8:undefined}])assert.throws(()=>tradeCanonicalSaleJournal(envelope(ids[0],'sale_draft',{...receipt(),...patch}),pending,scope));
 for(const change of [x=>x.preview.selection.customerAccountId='9',x=>x.preview.canSave=true,x=>x.preview.previewHash='bad',x=>x.selection.items[0].quoteId='82']){const x=structuredClone(draft());change(x);assert.throws(()=>tradeCanonicalSaleRequest({operation:'sale_draft',requestId:ids[0],...x}));}
 assert.throws(()=>tradeCanonicalSaleRequest({operation:'sale_finalize',requestId:ids[0],invoice:receipt(),scope}));
 for(const reason of ['', '1234', ' '.repeat(5),'x'.repeat(501)])assert.throws(()=>tradeCanonicalSaleRequest({operation:'sale_cancel',requestId:ids[2],invoice:receipt(),scope,reason}));
});
test('missing old action witness or substituted UUID/operation/body/invoice/party/revision remains unknown rather than adopted',()=>{
 const plan=tradeCanonicalSaleRequest({operation:'sale_finalize',requestId:ids[1],invoice:receipt(),scope}),p={version:1,status:'pending',path:plan.path,body:plan.body,invoiceWitness:plan.invoiceWitness},valid=envelope(ids[1],'sale_finalize',receipt('finalized'));
 for(const change of [x=>delete x.invoiceWitness,x=>x.invoiceWitness.customerAccountId='9',x=>x.invoiceWitness.partyEntityId='4',x=>x.invoiceWitness.creationRequestId=ids[2],x=>x.body.expectedRevision='a'.repeat(64),x=>x.body.actorId='17',x=>x.path='/api/work-sales/drafts/52/finalize']){const bad=structuredClone(p);change(bad);assert.throws(()=>tradeCanonicalSaleJournal(valid,bad,scope));}
 for(const change of [x=>x.requestId=ids[2],x=>x.response.requestId=ids[2],x=>x.operation='sale_cancel',x=>x.response.invoice.id='52',x=>x.response.invoice.status='draft']){const bad=structuredClone(valid);change(bad);assert.throws(()=>tradeCanonicalSaleJournal(bad,p,scope));}
 const i=receipt();assert.throws(()=>tradeCanonicalSaleInvoice({...i,partyEntityId:'4'},{...scope,partyEntityId:'3'}));
});
test('existing journal key/version/body and legacy records are unchanged; reads do not migrate or normalize optional witness',()=>{
 const store=storage(),journal=createTradeJournal({storage:store,key:'legacy-key'}),legacy={version:1,status:'pending',path:'/api/work-sales/drafts',body:{requestId:ids[0],legacy:'preserved'}};store.values.set('legacy-key',JSON.stringify(legacy));const before=store.values.get('legacy-key');assert.deepEqual(journal.read(),legacy);assert.equal(store.values.get('legacy-key'),before);assert.equal(store.writes,0);
 const p=tradeCanonicalSaleRequest({operation:'sale_finalize',requestId:ids[1],invoice:receipt(),scope});journal.begin(p.path,p.body,{invoiceWitness:p.invoiceWitness});const bytes=store.values.get('legacy-key'),writes=store.writes;journal.read();journal.read();assert.equal(store.values.get('legacy-key'),bytes);assert.equal(store.writes,writes);
});
