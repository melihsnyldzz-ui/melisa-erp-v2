import test from 'node:test';
import assert from 'node:assert/strict';
import {tradeCanonicalSaleRequest} from './workTradeModel.mjs';
import {createWorkingCatalogSession,workingCatalogTokenKey} from './workingCatalogSession.mjs';
import {businessWorkfaceId,businessWorkfaceRequestAllowed,businessSaleBrowserRequestAllowed} from './businessWorkface.mjs';
import {parsePartyHistoryQuery,partyHistoryResult} from '../../../api/src/services/canonicalBusinessPartyHistoryModel.mjs';
const actor=()=>({id:17,username:'unified-semih-test',role:{id:17,code:'unified_test_semih'},permissions:['sales.view','customer.view','finance.view']});
const selection={kind:'customer',partyId:'155',accountId:'7',currency:'USD',page:1,dateFrom:'',dateTo:''};
const invoice=()=>({id:'51',customerAccountId:'7',partyEntityId:'3',creationRequestId:'00000000-0000-4000-8000-000000000001',operationOrigin:'CANONICAL_TEST_BUSINESS_SALE',documentNo:'SYNTHETIC-ONLY',documentDate:'2026-01-02',customerId:'155',currency:'USD',status:'finalized',subtotalExact4:'2.0000',grandTotalExact4:'2.0000',amountTryExact4:'4.0000',customerBalanceExact4:'-2.1235',customerBalanceExact8:'-2.12345678',customerBalanceDisplayOnly:true,revision:'a'.repeat(64),items:[{productId:'12',quoteId:'81',unit:{label:'ADET',factorExact8:'1.00000000',sourceId:'9'},stockCode:'SYNTHETIC',name:'Sentetik ürün',quantityExact3:'1.000',unitPriceExact8:'2.00000000',unitPriceExact4:'2.0000',lineTotalExact4:'2.0000',currency:'USD'}],collections:{revision:'b'.repeat(64),receivedExact4:'0.0000',outstandingExact4:'2.0000',items:[]}});
function history(input,change=()=>{}){
 const q=parsePartyHistoryQuery({...input,page:String(input.page)}),row={id:'101',kind:'sales_invoice',documentDate:'2026-01-02',documentAmountExact:'2.0000',documentCurrencyRaw:q.currency,accountAmountExact:'2.0000',accountCurrency:q.currency,balanceEffectExact:'2.00000000',legacyBalanceEffectExact:'2.0000',affectsBalance:true,invoiceId:'51',invoiceNumber:'DISPLAY-ONLY',returnId:null};change(row);
 return {success:true,...partyHistoryResult({account:{id:q.accountId,partyId:q.partyId,oppositePartyId:null,partyEntityId:'3',currency:q.currency},total:'1',unassignedCount:'0',conflictCount:'0',rows:[row]},q,{readAt:'2026-10-28T00:00:00.000Z'})};
}
function fixture({user=actor(),historyRead=q=>history(q),invoiceRead=()=>invoice(),requestRead=null,business=true}={}){
 const calls=[],values=new Map([[workingCatalogTokenKey,'fixture-access']]);
 const session=createWorkingCatalogSession({location:{protocol:'http:',hostname:'127.0.0.1',port:business?'5244':'5234',origin:business?'http://127.0.0.1:5244':'http://127.0.0.1:5234'},apiBase:'http://127.0.0.1:4144',businessProfile:businessWorkfaceId,storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},protectedDevice:null,fetchImpl:async(url,o)=>{
  const u=new URL(url),reply=data=>({ok:true,status:200,json:async()=>({success:true,data})});
  if(u.pathname==='/api/auth/session-confirm')return reply({confirmed:true,user,expiresAt:Date.now()+900000});
  calls.push({path:u.pathname,method:o.method,query:u.search});assert.equal(o.headers.Authorization,'Bearer fixture-access');
  if(u.pathname.startsWith('/api/business-party-history/')){const parts=u.pathname.split('/');return {ok:true,status:200,json:async()=>historyRead({kind:parts[3],partyId:parts[4],accountId:parts[5],...Object.fromEntries(u.searchParams)})};}
  if(u.pathname.startsWith('/api/work-sales/requests/')&&requestRead)return reply(await requestRead(u.pathname.slice(u.pathname.lastIndexOf('/')+1)));
  if(u.pathname==='/api/work-sales/invoices/51')return reply(await invoiceRead());
  assert.fail('Unexpected commercial endpoint');
 }});return {session,calls};
}
test('receipt read rechecks exact customer account movement and binds native invoice ID/customer/currency without opening list or writes',async()=>{
 const f=fixture();await f.session.start();assert.equal(f.session.businessSaleInvoiceAvailable(),true);
 const result=await f.session.businessSaleInvoice(selection,'101');assert.equal(result.id,'51');assert.equal(result.customerBalanceExact8,'-2.12345678');assert.equal(result.customerAccountId,'7');
 assert.deepEqual(f.calls.map(c=>c.path),['/api/business-party-history/customer/155/7','/api/work-sales/invoices/51']);assert(f.calls.every(c=>c.method==='GET'));
 for(const path of ['/api/work-sales/invoices','/api/work-sales/invoices/51'])await assert.rejects(f.session.work(path),{code:'BUSINESS_WORKFACE_SCOPE_UNAVAILABLE'});
 for(const path of ['/api/work-sales/drafts','/api/work-sales/drafts/51/finalize','/api/work-sales/drafts/51/cancel','/api/work-collections']){assert.equal(businessSaleBrowserRequestAllowed('POST',path),path.startsWith('/api/work-sales/drafts'));assert.equal(businessWorkfaceRequestAllowed('POST',path),false);}
 f.session.dispose();assert.equal(f.session.businessSaleInvoiceAvailable(),false);
});
test('same-currency account swap, non-sales movement, absent invoice and invented document number cannot authorize receipt fetch',async()=>{
 for(const change of [r=>{r.kind='collection';},r=>{r.invoiceId=null;r.invoiceNumber='51';},r=>{r.accountCurrency=null;}]){
  const f=fixture({historyRead:q=>history(q,change)});await f.session.start();await assert.rejects(f.session.businessSaleInvoice(selection,'101'));assert.equal(f.calls.length,1);f.session.dispose();
 }
 const f=fixture({historyRead:q=>{const h=history(q);h.meta.scope.accountId='9';return h;}});await f.session.start();await assert.rejects(f.session.businessSaleInvoice(selection,'101'));assert.equal(f.calls.length,1);f.session.dispose();
 const g=fixture();await g.session.start();await assert.rejects(g.session.businessSaleInvoice(selection,'51'));assert.equal(g.calls.length,1);await assert.rejects(g.session.businessSaleInvoice({...selection,invoiceId:'51'},'101'));assert.equal(g.calls.length,1);g.session.dispose();
});
test('invoice substitution or missing exact-balance display contract rejects; disposal fences late history/detail results',async()=>{
 for(const patch of [{status:'draft'},{id:'52'},{customerId:'156'},{currency:'EUR'},{customerBalanceExact8:undefined},{customerBalanceDisplayOnly:false}]){
  const f=fixture({invoiceRead:()=>({...invoice(),...patch})});await f.session.start();await assert.rejects(f.session.businessSaleInvoice(selection,'101'));f.session.dispose();
 }
 for(const stage of ['history','invoice']){
  let finish;const f=fixture(stage==='history'?{historyRead:q=>new Promise(resolve=>{finish=()=>resolve(history(q));})}:{invoiceRead:()=>new Promise(resolve=>{finish=()=>resolve(invoice());})});await f.session.start();const pending=f.session.businessSaleInvoice(selection,'101'),rejected=assert.rejects(pending);await new Promise(r=>setImmediate(r));f.session.dispose();finish();await rejected;assert.equal(f.calls.length,stage==='history'?1:2);
 }
});
test('non-normal role and missing finance permission keep receipt availability closed before any history read',async()=>{
 for(const user of [{...actor(),role:{id:17,code:'other'}},{...actor(),testAdminSession:true},{...actor(),permissions:['sales.view','customer.view']}]){
  const f=fixture({user});try{await f.session.start();}catch{}assert.equal(f.session.businessSaleInvoiceAvailable(),false);await assert.rejects(f.session.businessSaleInvoice(selection,'101'));assert.equal(f.calls.filter(c=>c.path.startsWith('/api/business-party-history/')||c.path.startsWith('/api/work-sales/')).length,0);f.session.dispose();
 }
});

const actionId='00000000-0000-4000-8000-000000000002',scope={customerId:'155',customerAccountId:'7',currency:'USD'};
function action(){const before=invoice();before.status='draft';before.collections.outstandingExact4='0.0000';const plan=tradeCanonicalSaleRequest({operation:'sale_finalize',requestId:actionId,invoice:before,scope});return {version:1,status:'pending',path:plan.path,body:plan.body,invoiceWitness:plan.invoiceWitness};}
const requestResult=()=>({requestId:actionId,operation:'sale_finalize',response:{requestId:actionId,invoice:invoice(),replayed:false}});
test('explicit journal read binds owned action UUID/witness then fresh current invoice revision without replaying a mutation',async()=>{
 const f=fixture({requestRead:id=>{assert.equal(id,actionId);return requestResult();}});await f.session.start();const pending=action(),bytes=JSON.stringify(pending),result=await f.session.businessSaleRequest(selection,pending);assert.equal(result.invoice.id,'51');assert.equal(result.invoice.creationRequestId,pending.invoiceWitness.creationRequestId);assert.equal(JSON.stringify(pending),bytes);assert.deepEqual(f.calls.map(c=>c.path),['/api/work-sales/requests/'+actionId,'/api/work-sales/invoices/51']);assert(f.calls.every(c=>c.method==='GET'));f.session.dispose();
});
test('journal wrong UUID/operation/account/creation and missing original action witness never adopt a result',async()=>{
 for(const change of [x=>x.requestId=actionId.replace(/2$/,'3'),x=>x.response.requestId=actionId.replace(/2$/,'3'),x=>x.operation='sale_cancel',x=>x.response.invoice.customerAccountId='9',x=>x.response.invoice.partyEntityId='4',x=>x.response.invoice.creationRequestId=actionId]){
  const f=fixture({requestRead:()=>{const out=requestResult();change(out);return out;}});await f.session.start();await assert.rejects(f.session.businessSaleRequest(selection,action()));assert.equal(f.calls.length,1);f.session.dispose();
 }
 const f=fixture({requestRead:requestResult});await f.session.start();const old=action();delete old.invoiceWitness;await assert.rejects(f.session.businessSaleRequest(selection,old));assert.equal(f.calls.length,1);f.session.dispose();
});
test('post-action fresh invoice revision/account/creation drift or missing journal stays unknown; no implicit retry occurs',async()=>{
 for(const patch of [{revision:'f'.repeat(64)},{customerAccountId:'9'},{partyEntityId:'4'},{creationRequestId:actionId}]){
  const f=fixture({requestRead:requestResult,invoiceRead:()=>({...invoice(),...patch})});await f.session.start();await assert.rejects(f.session.businessSaleRequest(selection,action()));assert.equal(f.calls.length,2);f.session.dispose();
 }
 const f=fixture({requestRead:()=>{throw {status:404};}});await f.session.start();await assert.rejects(f.session.businessSaleRequest(selection,action()));assert.equal(f.calls.length,1);f.session.dispose();
});
test('saved draft witness reopens directly by exact public account/party/creation binding without manufacturing a movement',async()=>{
 const draft={...invoice(),status:'draft',collections:{...invoice().collections,outstandingExact4:'0.0000'}},f=fixture({invoiceRead:()=>draft});await f.session.start();assert.equal((await f.session.businessSaleInvoice(selection,draft)).status,'draft');assert.deepEqual(f.calls.map(c=>c.path),['/api/work-sales/invoices/51']);await assert.rejects(f.session.businessSaleInvoice({...selection,accountId:'9'},draft));assert.equal(f.calls.length,1);f.session.dispose();
});
