import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createBusinessBrowserSessionTransport,businessSessionCookie} from '../../business-preview-session.mjs';
import {createWorkingCatalogSession,workingCatalogTokenKey} from './workingCatalogSession.mjs';
import {businessWorkfaceId,businessWorkfaceRequestAllowed,businessSaleOperationInputAllowed,businessSaleOperationRequestAllowed,businessSaleNativeOperationPreviewAllowed} from './businessWorkface.mjs';
import {createTradeJournal,tradeCanonicalSaleRequest} from './workTradeModel.mjs';
import {saleNativeActor,saleNativeBase,saleNativeResult,saleNativeInvoice} from './workBusinessSalesRead.test-fixture.mjs';
const ids=[1,2,3].map(n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'));
const selection={customerId:'155',customerAccountId:'7',documentDate:'2026-10-28',currency:'USD',items:[{productId:'12',quoteId:'81',quantityExact3:'2.000'}]};
const scope={customerId:'155',customerAccountId:'7',currency:'USD'};
const actor=()=>({...saleNativeActor(),permissions:[...saleNativeActor().permissions,'finance.view','sales.finalize','sales.cancel']});
function plan(operation='sale_draft',invoice=saleNativeInvoice()){
 const result=saleNativeResult(selection),preview={...result.preview,scopeRevision:result.context.revision,documentDate:selection.documentDate,readOnly:true,canSave:false};
 return tradeCanonicalSaleRequest({operation,requestId:ids[operation==='sale_draft'?0:operation==='sale_finalize'?1:2],selection,preview,invoice,scope,reason:'Sentetik iptal'});
}
function fixture({user=actor(),base=saleNativeBase(),selected=s=>saleNativeResult(s),invoice=saleNativeInvoice(),mutation=null}={}){
 const values=new Map([[workingCatalogTokenKey,'fixture-access']]),calls=[];let writes=0,record=null,current=invoice,access='fixture-access';
 const storage={getItem:k=>values.get(k)??null,setItem(k,v){writes++;values.set(k,v);},removeItem:k=>values.delete(k)};
 const reply=data=>({ok:true,status:200,json:async()=>({success:true,data})});
 const session=createWorkingCatalogSession({location:{protocol:'http:',hostname:'127.0.0.1',port:'5244',origin:'http://127.0.0.1:5244'},apiBase:'http://127.0.0.1:4144',businessProfile:businessWorkfaceId,protectedDevice:null,storage,fetchImpl:async(url,o)=>{
  const path=new URL(url).pathname,body=o.body?JSON.parse(o.body):undefined;
  assert.equal(o.credentials,'same-origin');assert.equal(o.redirect,'error');assert.equal(o.headers.Authorization,'Bearer '+access);
  if(path==='/api/auth/session-confirm')return reply({confirmed:true,user,expiresAt:Date.now()+900000});
  calls.push({path,method:o.method,body,signal:o.signal});
  if(path==='/api/auth/refresh'){assert.deepEqual(body,{});access='fixture-renewed';return reply({browserSession:true,user,accessToken:access,expiresAt:Date.now()+900000});}
  if(path==='/api/work-sales/context')return reply(structuredClone(base));
  if(path==='/api/work-sales/selected-context')return reply((await selected(body)).context);
  if(path==='/api/work-sales/preview')return reply((await selected(body)).preview);
  if(path==='/api/work-sales/invoices/51')return reply(current);
  if(path.startsWith('/api/work-sales/requests/'))return reply(record);
  if(o.method==='POST'){
   const operation=path.endsWith('/finalize')?'sale_finalize':path.endsWith('/cancel')?'sale_cancel':'sale_draft';
   current=saleNativeInvoice({status:{sale_draft:'draft',sale_finalize:'finalized',sale_cancel:'cancelled'}[operation],revision:{sale_draft:'c',sale_finalize:'e',sale_cancel:'f'}[operation].repeat(64)});
   const result={requestId:body.requestId,invoice:current,replayed:false};record={requestId:body.requestId,operation,response:result};
   if(mutation)return mutation(result,o,reply);return reply(result);
  }
  assert.fail('Unexpected endpoint '+path);
 }});
 const journal=createTradeJournal({storage,key:'existing-sale-key'});
 return {session,calls,values,journal,get writes(){return writes;},setCurrent(value){current=value;},pending:p=>journal.begin(p.path,p.body,p.invoiceWitness?{invoiceWitness:p.invoiceWitness}:undefined)};
}

test('normal session obtains an opaque one-use draft admission only after fresh native selection and preview',async()=>{
 const f=fixture(),p=plan();assert.equal(f.session.businessSaleOperationAvailable('sale_draft'),false);
 await assert.rejects(f.session.businessSalePrepareOperation(p));assert.equal(f.calls.length,0);await f.session.start();
 const before=f.writes,cap=await f.session.businessSalePrepareOperation(p);
 assert.deepEqual(cap,{});assert(Object.isFrozen(cap));assert.equal(f.writes,before);assert.equal(p.canSend,false);
 assert.deepEqual(f.calls.map(c=>c.path),['/api/work-sales/context','/api/work-sales/selected-context','/api/work-sales/preview']);
 assert.equal(f.session.businessSaleOperationAvailable('sale_draft'),true);assert.equal(f.session.businessSaleOperationCurrent(cap,p),true);
 assert.equal(f.session.businessSaleOperationCurrent({...cap},p),false);
 const pending=f.pending(p),bytes=JSON.stringify(pending),writes=f.writes,result=await f.session.businessSaleSendOperation(cap,pending);
 assert.equal(result.invoice.customerAccountId,'7');assert.equal(result.requestId,ids[0]);assert.equal(JSON.stringify(pending),bytes);assert.equal(f.writes,writes);
 assert.equal(f.session.businessSaleOperationCurrent(cap,p),false);await assert.rejects(f.session.businessSaleSendOperation(cap,pending));await assert.rejects(f.session.businessSalePrepareOperation(p));
 assert.equal(f.calls.filter(c=>c.path==='/api/work-sales/drafts').length,1);f.session.dispose();
});

for(const operation of ['sale_finalize','sale_cancel'])test('owned invoice '+operation+' binds original account, creation UUID and fresh revision without repricing',async()=>{
 const invoice=saleNativeInvoice({status:operation==='sale_cancel'?'finalized':'draft'}),f=fixture({invoice}),p=plan(operation,invoice);await f.session.start();
 const cap=await f.session.businessSalePrepareOperation(p);assert.deepEqual(f.calls.map(c=>c.path),['/api/work-sales/context','/api/work-sales/invoices/51']);
 const result=await f.session.businessSaleSendOperation(cap,f.pending(p));assert.equal(result.invoice.status,operation==='sale_cancel'?'cancelled':'finalized');assert.equal(result.invoice.creationRequestId,ids[0]);assert.notEqual(result.invoice.revision,p.body.expectedRevision);assert.equal(result.invoice.documentDate,invoice.documentDate);f.session.dispose();
});

test('unpublished live profile and operation permission deny before native preparation or journal writes',async()=>{
 for(const edit of ['unpublished','permission','other-role']){
  const user=actor(),base=saleNativeBase();if(edit==='unpublished')base.capabilities={...base.capabilities,canCreate:false,canFinalize:false,canCancel:false};if(edit==='permission')user.permissions=user.permissions.filter(p=>p!=='sales.finalize');if(edit==='other-role')user.role={id:17,code:'admin'};
  const f=fixture({user,base});if(edit==='other-role')await assert.rejects(f.session.start());else await f.session.start();const n=f.writes;await assert.rejects(f.session.businessSalePrepareOperation(plan(edit==='permission'?'sale_finalize':'sale_draft')));assert.equal(f.writes,n);assert.equal(f.calls.some(c=>c.method==='POST'&&c.path.startsWith('/api/work-sales/')),false);assert.equal(f.session.businessSaleOperationAvailable('sale_draft'),false);f.session.dispose();
 }
});

test('input flags, unknown operations, malformed DTO and non-owned invoice witness never issue admission',async()=>{
 const f=fixture();await f.session.start();const original=plan();
 for(const p of [{...original,canSend:true},{...original,operation:'sale_cancel'},{...original,authority:true},{...original,body:{...original.body,actorId:'17'}},{...original,body:{...original.body,items:[{...original.body.items[0],quantityExact3:'6.000'}]}}])await assert.rejects(f.session.businessSalePrepareOperation(p));
 assert.equal(f.calls.length,0);
 for(const patch of [{customerAccountId:'8'},{partyEntityId:'9'},{creationRequestId:ids[2]},{revision:'e'.repeat(64)},{status:'finalized'}]){
  const p=plan('sale_finalize');await assert.rejects(f.session.businessSalePrepareOperation({...p,invoiceWitness:{...p.invoiceWitness,...patch}}));
 }
 assert.equal(f.calls.some(c=>c.method==='POST'),false);f.session.dispose();
});

test('fresh preview account, product, stock, price, FX, amount and hash drift close admission',async()=>{
 const changes=[r=>r.context.scope.customer.accountId='8',r=>r.context.scope.products[0].id='13',r=>r.context.scope.products[0].stockQuantityExact3='1.000',r=>r.context.scope.products[0].prices[0].quoteId='82',r=>r.preview.items[0].unit.sourceId='0',r=>r.preview.items[0].unitPriceExact4='2.1234',r=>r.context.rate.rateExact8='3.00000000',r=>r.preview.amountTryExact4='8.4939',r=>r.preview.grandTotalExact4='501.0000',r=>r.preview.previewHash='e'.repeat(64),r=>r.context.revision='d'.repeat(64)];
 for(const change of changes){const f=fixture({selected:s=>{const r=saleNativeResult(s);change(r);return r;}});await f.session.start();await assert.rejects(f.session.businessSalePrepareOperation(plan()));assert.equal(f.calls.some(c=>c.path==='/api/work-sales/drafts'),false);f.session.dispose();}
});

test('replaced plan, account scope, disposed session and foreign session invalidate private admission',async()=>{
 const f=fixture(),other=fixture();await f.session.start();await other.session.start();const p=plan(),cap=await f.session.businessSalePrepareOperation(p);
 assert.equal(other.session.businessSaleOperationCurrent(cap,p),false);assert.equal(f.session.businessSaleOperationCurrent(cap,{...p,body:{...p.body,customerAccountId:'8'}}),false);
 const newer=await f.session.businessSalePrepareOperation(p);assert.equal(f.session.businessSaleOperationCurrent(cap,p),false);assert.equal(f.session.businessSaleOperationCurrent(newer,p),true);
 f.session.dispose();assert.equal(f.session.businessSaleOperationCurrent(newer,p),false);await assert.rejects(f.session.businessSaleSendOperation(newer,f.pending(p)));other.session.dispose();
});

test('pending body/witness/status mismatch cannot consume or post the registered operation',async()=>{
 const f=fixture();await f.session.start();const p=plan('sale_finalize'),cap=await f.session.businessSalePrepareOperation(p),pending=f.pending(p);
 for(const bad of [{...pending,status:'done'},{...pending,body:{...pending.body,requestId:ids[2]}},{...pending,invoiceWitness:{...pending.invoiceWitness,customerAccountId:'8'}},{...pending,canSend:true},{...pending,path:'/api/work-collections'}])await assert.rejects(f.session.businessSaleSendOperation(cap,bad));
 assert.equal(f.session.businessSaleOperationCurrent(cap,p),true);assert.equal(f.calls.some(c=>c.method==='POST'),false);await f.session.businessSaleSendOperation(cap,pending);f.session.dispose();
});

test('one in-flight POST rejects duplicates; lost ACK preserves journal and only read-only recovery resolves result',async()=>{
 let rejectPost;const f=fixture({mutation:()=>new Promise((_,reject)=>{rejectPost=reject;})});await f.session.start();const p=plan(),cap=await f.session.businessSalePrepareOperation(p),pending=f.pending(p),bytes=f.values.get('existing-sale-key'),writes=f.writes;
 const sending=f.session.businessSaleSendOperation(cap,pending),rejected=assert.rejects(sending);await new Promise(r=>setImmediate(r));
 assert.equal(f.session.businessSaleOperationCurrent(cap,p),true);await assert.rejects(f.session.businessSaleSendOperation(cap,pending));await assert.rejects(f.session.businessSalePrepareOperation(p));rejectPost(Error('fixture lost ACK'));await rejected;
 assert.equal(f.values.get('existing-sale-key'),bytes);assert.equal(f.writes,writes);await assert.rejects(f.session.businessSaleSendOperation(cap,pending));await assert.rejects(f.session.businessSalePrepareOperation(p));
 const result=await f.session.businessSaleRequest({kind:'customer',partyId:'155',accountId:'7',currency:'USD',page:1,dateFrom:'',dateTo:''},pending);assert.equal(result.invoice.creationRequestId,ids[0]);assert.equal(f.calls.filter(c=>c.path==='/api/work-sales/drafts').length,1);assert(f.calls.slice(-2).every(c=>c.method==='GET'));assert.equal(f.values.get('existing-sale-key'),bytes);f.session.dispose();
});

test('explicit lost-ACK lookup retains the original draft journal response while showing the later current invoice',async()=>{
 const f=fixture({mutation:()=>{throw Error('fixture lost ACK');}});await f.session.start();const p=plan(),cap=await f.session.businessSalePrepareOperation(p),pending=f.pending(p);await assert.rejects(f.session.businessSaleSendOperation(cap,pending));
 f.setCurrent(saleNativeInvoice({status:'finalized',revision:'e'.repeat(64)}));const writes=f.writes;
 const result=await f.session.businessSaleRequest({kind:'customer',partyId:'155',accountId:'7',currency:'USD',page:1,dateFrom:'',dateTo:''},pending);
 assert.equal(result.invoice.status,'finalized');assert.equal(result.journalResponse.invoice.status,'draft');assert.equal(result.journalResponse.invoice.revision,'c'.repeat(64));assert.deepEqual(Object.keys(result.journalResponse).sort(),['invoice','replayed','requestId']);assert.equal(f.writes,writes);assert.equal(f.journal.read().status,'pending');f.session.dispose();
});

test('supported renewal precedes opaque issuance; nearing expiry closes current() before any journal or POST',async t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);const f=fixture();await f.session.start();now+=870000;
 const p=plan(),cap=await f.session.businessSalePrepareOperation(p);assert.equal(f.calls[0].path,'/api/auth/refresh');assert.equal(f.calls.filter(c=>c.path==='/api/auth/refresh').length,1);assert.equal(f.session.businessSaleOperationCurrent(cap,p),true);
 const writes=f.writes;now+=870000;assert.equal(f.session.businessSaleOperationCurrent(cap,p),false);
 await assert.rejects(f.session.businessSaleSendOperation(cap,{version:1,status:'pending',path:p.path,body:p.body}));assert.equal(f.writes,writes);assert.equal(f.calls.some(c=>c.path==='/api/work-sales/drafts'),false);f.session.dispose();
});

test('disposal during native preparation cannot publish a cap or continue to preview or mutation',async()=>{
 let finish;const f=fixture({selected:s=>new Promise(resolve=>{finish=()=>resolve(saleNativeResult(s));})});await f.session.start();const preparing=f.session.businessSalePrepareOperation(plan()),rejected=assert.rejects(preparing);await new Promise(r=>setImmediate(r));f.session.dispose();finish();await rejected;
 assert.deepEqual(f.calls.map(c=>c.path),['/api/work-sales/context','/api/work-sales/selected-context']);assert.equal(f.session.businessSaleOperationAvailable('sale_draft'),false);
});

test('actual session, BFF, typed journal and public DTO seams complete draft/finalize/cancel against one offline native fixture',async()=>{
 const values=new Map([[workingCatalogTokenKey,'fixture-access']]),user=actor(),upstream=[],records=new Map();let invoice=null;
 const reply=data=>({ok:true,status:200,text:async()=>JSON.stringify(data)});
 const transport=createBusinessBrowserSessionTransport({fetchImpl:async(url,o)=>{
  const path=new URL(url).pathname;upstream.push({path,method:o.method,body:o.body});assert.equal(new URL(url).origin,'http://127.0.0.1:4144');assert.equal(o.headers.Authorization,'Bearer fixture-access');assert.equal(o.headers.cookie,undefined);
  if(path==='/api/auth/session-confirm')return reply({success:true,data:{confirmed:true,user,expiresAt:Date.now()+900000}});
  if(path==='/api/auth/me')return reply({success:true,data:user,meta:{source:'jwt-auth'}});
  if(path==='/api/work-sales/context')return reply({success:true,data:saleNativeBase()});
  if(path==='/api/work-sales/selected-context')return reply({success:true,data:saleNativeResult(JSON.parse(o.body)).context});
  if(path==='/api/work-sales/preview')return reply({success:true,data:saleNativeResult(JSON.parse(o.body)).preview});
  if(path==='/api/work-sales/invoices/51')return reply({success:true,data:invoice});
  assert.equal(o.method,'POST');const body=JSON.parse(o.body),operation=path.endsWith('finalize')?'sale_finalize':path.endsWith('cancel')?'sale_cancel':'sale_draft';
  invoice=saleNativeInvoice({status:{sale_draft:'draft',sale_finalize:'finalized',sale_cancel:'cancelled'}[operation],revision:{sale_draft:'c',sale_finalize:'e',sale_cancel:'f'}[operation].repeat(64)});
  const result={requestId:body.requestId,invoice,replayed:false};records.set(body.requestId,result);return reply({success:true,data:result});
 }});
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const session=createWorkingCatalogSession({location:{protocol:'http:',hostname:'127.0.0.1',port:'5244',origin:'http://127.0.0.1:5244'},apiBase:'http://127.0.0.1:4144',businessProfile:businessWorkfaceId,protectedDevice:null,storage,fetchImpl:async(url,o)=>{
  assert.equal(new URL(url).origin,'http://127.0.0.1:5244');const path=new URL(url).pathname,req=Readable.from(o.body?[Buffer.from(o.body)]:[]);Object.assign(req,{method:o.method,url:path,headers:{authorization:o.headers.Authorization,...(path.startsWith('/api/auth/')?{cookie:businessSessionCookie+'='+'A'.repeat(43)}:{})}});
  let status,payload;await transport(req,{writeHead(s){status=s;},end(raw){payload=JSON.parse(raw);}},()=>assert.fail('Finite BFF dispatch required'));
  return {ok:status===200,status,json:async()=>payload};
 }});
 const journal=createTradeJournal({storage,key:'existing-sale-key'});await session.start();
 for(const operation of ['sale_draft','sale_finalize','sale_cancel']){
  const p=plan(operation,invoice??saleNativeInvoice()),cap=await session.businessSalePrepareOperation(p);assert.equal(p.canSend,false);assert(session.businessSaleOperationCurrent(cap,p));
  const pending=journal.begin(p.path,p.body,p.invoiceWitness?{invoiceWitness:p.invoiceWitness}:undefined),result=await session.businessSaleSendOperation(cap,pending);journal.done(pending,result);assert.equal(result.invoice.customerAccountId,'7');assert.equal(result.invoice.creationRequestId,ids[0]);assert.equal(result.invoice.status,operation==='sale_draft'?'draft':operation==='sale_finalize'?'finalized':'cancelled');
 }
 assert.equal(journal.read().result.invoice.status,'cancelled');assert.equal(records.size,3);const mutations=upstream.filter(c=>c.method==='POST'&&/\/drafts(?:\/51\/(?:finalize|cancel))?$/.test(c.path));assert.equal(mutations.length,3);
 for(const call of mutations){const index=upstream.indexOf(call);assert.equal(upstream[index-1].path,'/api/auth/me');assert.equal(upstream[index-1].method,'GET');}session.dispose();
});

test('canonical POST predicates preserve generic read gate and reject extra authority, route and body fields',()=>{
 for(const op of ['sale_draft','sale_finalize','sale_cancel']){const p=plan(op);assert(businessSaleOperationInputAllowed(p.path,p.body));assert(businessSaleOperationRequestAllowed('POST',p.path,actor()));assert.equal(businessWorkfaceRequestAllowed('POST',p.path),false);
  for(const suffix of ['?actorId=17','/extra','/../cancel'])assert.equal(businessSaleOperationInputAllowed(p.path+suffix,p.body),false);
  for(const patch of [{actorId:'17'},{verified:true},{permission:'sales.create'}])assert.equal(businessSaleOperationInputAllowed(p.path,{...p.body,...patch}),false);
 }
 for(const permission of ['sales.create','sales.finalize','sales.cancel','finance.view']){const u=actor();u.permissions=u.permissions.filter(p=>p!==permission);const op=permission==='sales.finalize'?'sale_finalize':permission==='sales.cancel'?'sale_cancel':'sale_draft';assert.equal(businessSaleOperationRequestAllowed('POST',plan(op).path,u),false);}
 const r=saleNativeResult(selection);assert(businessSaleNativeOperationPreviewAllowed(r,selection));r.preview.items[0].lineTotalExact4='0.0000';assert.equal(businessSaleNativeOperationPreviewAllowed(r,selection),false);
});

test('operation scalars and paths reject terminal LF/CRLF before admission, native reads or journal writes',async()=>{
 const f=fixture();await f.session.start();const writes=f.writes;
 for(const tail of ['\n','\r\n']){
  const d=plan(),changes=[p=>p.path+=tail,p=>p.body.requestId+=tail,p=>p.body.expectedRevision+=tail,p=>p.body.previewHash+=tail,p=>p.body.customerId+=tail,p=>p.body.customerAccountId+=tail,p=>p.body.items[0].productId+=tail,p=>p.body.items[0].quoteId+=tail,p=>p.body.items[0].quantityExact3+=tail];
  for(const change of changes){const p=structuredClone(d);change(p);assert.equal(businessSaleOperationInputAllowed(p.path,p.body),false);await assert.rejects(f.session.businessSalePrepareOperation(p));}
  for(const operation of ['sale_finalize','sale_cancel']){
   const base=plan(operation);for(const change of [p=>p.path+=tail,p=>p.body.requestId+=tail,p=>p.body.expectedRevision+=tail,p=>p.invoiceWitness.id+=tail,p=>p.invoiceWitness.customerId+=tail,p=>p.invoiceWitness.customerAccountId+=tail,p=>p.invoiceWitness.partyEntityId+=tail,p=>p.invoiceWitness.creationRequestId+=tail,p=>p.invoiceWitness.revision+=tail]){const p=structuredClone(base);change(p);await assert.rejects(f.session.businessSalePrepareOperation(p));}
   assert.equal(businessSaleOperationRequestAllowed('POST',base.path+tail,actor()),false);
  }
 }
 assert.equal(f.calls.length,0);assert.equal(f.writes,writes);f.session.dispose();
});

test('new native operation preview boundary rejects terminal line endings in amounts, rates, hashes, units and quantities',()=>{
 const changes=[r=>r.context.revision+='TAIL',r=>r.preview.previewHash+='TAIL',r=>r.preview.subtotalExact4+='TAIL',r=>r.preview.grandTotalExact4+='TAIL',r=>r.preview.amountTryExact4+='TAIL',r=>r.context.rate.rateExact8+='TAIL',r=>r.context.scope.products[0].stockQuantityExact3+='TAIL',r=>r.context.scope.products[0].prices[0].unitPriceExact8+='TAIL',r=>r.preview.items[0].unitPriceExact4+='TAIL',r=>r.preview.items[0].lineTotalExact4+='TAIL',r=>r.preview.items[0].unit.sourceId+='TAIL',r=>r.preview.items[0].quantityExact3+='TAIL'];
 for(const tail of ['\n','\r\n'])for(const change of changes){const r=saleNativeResult(selection);change(r);const replace=v=>JSON.parse(JSON.stringify(v).replaceAll('TAIL',JSON.stringify(tail).slice(1,-1)));assert.equal(businessSaleNativeOperationPreviewAllowed(replace(r),selection),false);}
});
