import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePartyHistoryQuery,partyHistoryResult} from '../../../api/src/services/canonicalBusinessPartyHistoryModel.mjs';

// Load the real parent and its real history/model imports. Only the CSS side
// effect is omitted, following the existing supplier controller test loader.
let source=await readFile(new URL('./workSuppliers.js',import.meta.url),'utf8');
source=source.replace(/^import ['"]\.\/[^'"]+\.css['"];\s*$/gm,'')
 .replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,import.meta.url).href));
const {createWorkSuppliers}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

function supplier(id='155'){
 const accountIds=id==='155'?['7','9','8']:['17','19','18'];
 return {id,supplierCode:'SYN-SUPPLIER-'+id,supplierName:'Sentetik tedarikçi '+id,isPassive:false,
  quarantine:{blocked:false,reasons:[]},source:{status:'accepted-opening',sourceAsOf:'2026-09-30',freshLive:false},
  accounts:accountIds.map((accountId,i)=>({accountId,currency:i===2?'EUR':'USD',confidence:'unknown',
   sourceStatus:'unknown',sourceAsOf:null,reconciled:null,balanceExact:null,nativeBalanceExact:null,sourceOpeningBalanceExact:null})),
  accountCount:3,hasUnknownAccounts:true,fields:{phoneMasked:null,city:null,country:null}};
}
function history(input,{total=26,marker='SUPPLIER-HISTORY'}={}){
 const q=parsePartyHistoryQuery({...input,page:String(input.page)});
 const rows=Array.from({length:Math.min(25,Math.max(0,total-q.offset))},(_,i)=>({
  id:String(1000-q.offset-i),kind:['purchase_invoice','payment','payment_cancel'][i%3],documentDate:'2026-06-15',
  documentAmountExact:'100.0000',documentCurrencyRaw:'TRY',accountAmountExact:'2.1234',accountCurrency:q.currency,
  balanceEffectExact:i%3===1?'-2.12345678':'2.12345678',legacyBalanceEffectExact:'2.1234',affectsBalance:true,
  invoiceId:'51',invoiceNumber:marker+'-'+q.partyId+'-'+q.accountId,returnId:null
 }));
 return {success:true,...partyHistoryResult({account:{id:q.accountId,partyId:q.partyId,oppositePartyId:null,
  partyEntityId:'3',currency:q.currency},total:String(total),unassignedCount:'2',conflictCount:'0',rows},q,
  {readAt:'2026-10-30T00:00:00.000Z'})};
}

function dom(){
 let markup='',nodes=new Map(),writes=0;
 function matches(selector){
  const match=/^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
  assert(match,'Unexpected test DOM selector: '+selector);
  const [,attribute,value]=match;
  return [...markup.matchAll(/<[^>]+>/g)].map(m=>m[0]).filter(tag=>
   new RegExp('\\s'+attribute+(value===undefined?'(?:[\\s=>])':'="'+value+'"')).test(tag));
 }
 function node(selector,tag=matches(selector)[0]){
  if(!tag)return null;
  if(!nodes.has(selector)){
   const n={value:/\svalue="([^"]*)"/.exec(tag)?.[1]??'',dataset:{},addEventListener(event,handler){this['on'+event]=handler;},
    querySelector,querySelectorAll};
   for(const [,key,value]of tag.matchAll(/data-([\w-]+)="([^"]*)"/g))n.dataset[key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;
   nodes.set(selector,n);
   if(selector==='[data-bph-dates]')n.elements={dateFrom:node('[data-bph-from]'),dateTo:node('[data-bph-to]')};
   if(selector==='[data-supplier-search]')n.elements={search:{value:''}};
  }
  return nodes.get(selector);
 }
 function querySelector(selector){return node(selector);}
 function querySelectorAll(selector){return matches(selector).map(tag=>{
  const attr=/^\[([\w-]+)/.exec(selector)[1],value=new RegExp(attr+'="([^"]*)"').exec(tag)?.[1];
  return node(value===undefined?selector:`[${attr}="${value}"]`,tag);
 });}
 const root={isConnected:true,querySelector,querySelectorAll};
 Object.defineProperty(root,'innerHTML',{get:()=>markup,set:value=>{markup=value;nodes=new Map();writes++;}});
 return {root,node,html:()=>markup,writes:()=>writes,async emit(selector,event,value){
  const n=node(selector);assert(n,'Visible control missing: '+selector);
  assert.equal(typeof n['on'+event],'function','Unbound control: '+selector);
  if(value!==undefined)n.value=value;
  await n['on'+event]({target:n,preventDefault(){}});await tick();
 }};
}

function fixture({readHistory=input=>history(input),readDetail=null}={}){
 const d=dom(),cards=new Map(['155','156'].map(id=>[id,supplier(id)])),calls=[],forbidden=[];
 const deny=name=>async()=>{forbidden.push(name);assert.fail('Unrelated service invoked: '+name);};
 const session={partyHistoryAvailable:kind=>kind==='supplier',
  suppliers:async(path,options)=>{
   calls.push({service:'suppliers',path,options:structuredClone(options)});
   if(options?.method&&options.method!=='GET')assert.fail('Supplier write requested');
   if(path.startsWith('/api/supplier-cards?'))return {success:true,data:[...cards.values()].map(c=>structuredClone(c)),
    meta:{readOnly:true,sourceAsOf:'2026-09-30',freshLive:false,total:cards.size,page:1,limit:25}};
   const match=/^\/api\/suppliers\/(155|156)\/card$/.exec(path);assert(match,'Unexpected supplier path: '+path);
   return readDetail?readDetail(match[1],cards):structuredClone(cards.get(match[1]));
  },
  partyHistory:async input=>{calls.push({service:'history',query:{...input}});return readHistory(input);},
  inbound:deny('inbound'),supplierPayments:deny('supplierPayments'),work:deny('work'),
  supplierContact:deny('supplierContact'),supplierContactRecovery:deny('supplierContactRecovery'),
  businessSaleInvoiceAvailable:()=>true,businessSaleInvoice:deny('businessSaleInvoice')};
 const ui=createWorkSuppliers({root:d.root,session,user:{id:17,permissions:['supplier.view','finance.view','goods.view']}});
 return {d,ui,cards,calls,forbidden,reads:()=>calls.filter(c=>c.service==='history').map(c=>c.query),
  async mount(){ui.mount();await tick();},open:id=>d.emit(`[data-supplier-card="${id}"]`,'click')};
}

test('D2 supplier parent refresh retains the second USD account, dates and history page without synthetic finance reads',async t=>{
 const f=fixture();t.after(()=>f.ui.dispose());await f.mount();await f.open('155');
 assert.equal(f.reads().length,0,'Opening a card must not guess an account');
 await f.d.emit('[data-bph-account]','change','9');
 assert.match(f.d.html(),/Alış faturası|Ödeme iptali/);
 assert.match(f.d.html(),/100,00 TRY/);assert.match(f.d.html(),/2,12 USD/);
 assert.doesNotMatch(f.d.html(),/data-bph-invoice/,'Supplier history cannot open customer sale receipts');
 await f.d.emit('[data-bph-from]','input','2026-01-01');
 await f.d.emit('[data-bph-to]','change','2026-12-31');
 await f.d.emit('[data-bph-dates]','submit');await f.d.emit('[data-bph-next]','click');
 const before=f.reads().length;await f.ui.refresh();await tick();
 assert.equal(f.reads().length,before+1);
 assert.deepEqual(f.reads().at(-1),{kind:'supplier',partyId:'155',accountId:'9',currency:'USD',page:2,dateFrom:'2026-01-01',dateTo:'2026-12-31'});
 assert.match(f.d.html(),/value="9" selected/);assert.match(f.d.html(),/value="2026-01-01"/);
 assert.match(f.d.html(),/Sayfa 2/);assert.match(f.d.html(),/SUPPLIER-HISTORY-155-9/);
 assert.deepEqual(f.forbidden,[]);
});

test('D2 supplier parent rejects another account, party, role or currency envelope instead of retaining old financial rows',async t=>{
 for(const patch of [{accountId:'7'},{partyId:'156'},{kind:'customer'},{currency:'EUR'}])await t.test(JSON.stringify(patch),async t=>{
  let wrong=false;
  const f=fixture({readHistory:q=>history(wrong?{...q,...patch}:q,{marker:wrong?'WRONG-SCOPE':'PREVIOUS-SCOPE'})});
  t.after(()=>f.ui.dispose());await f.mount();await f.open('155');await f.d.emit('[data-bph-account]','change','9');
  assert.match(f.d.html(),/PREVIOUS-SCOPE-155-9/);wrong=true;
  await f.d.emit('[data-bph-refresh]','click');
  assert.match(f.d.html(),/Hesap hareketleri şu anda okunamıyor/);
  assert.doesNotMatch(f.d.html(),/WRONG-SCOPE|PREVIOUS-SCOPE/);
  assert.equal(f.reads().at(-1).accountId,'9');assert.deepEqual(f.forbidden,[]);
 });
});

test('D2 late supplier card detail cannot replace the newer selected card or its account history',async t=>{
 const pending=deferred();
 const f=fixture({readDetail:(id,cards)=>id==='155'?pending.promise:structuredClone(cards.get(id))});
 t.after(()=>f.ui.dispose());await f.mount();
 const old=f.open('155');await tick();await f.open('156');await f.d.emit('[data-bph-account]','change','19');
 pending.resolve(supplier('155'));await old;
 assert.match(f.d.html(),/SUPPLIER-HISTORY-156-19/);
 assert.doesNotMatch(f.d.html(),/SUPPLIER-HISTORY-155|value="9" selected/);
 assert.deepEqual(f.reads().map(q=>[q.partyId,q.accountId]),[['156','19']]);assert.deepEqual(f.forbidden,[]);
});

test('D2 old history cannot cross a parent card switch or write to the disposed parent',async t=>{
 const oldRead=deferred(),disposedRead=deferred();let finishOnDispose=false;
 const f=fixture({readHistory:q=>q.partyId==='155'?oldRead.promise:finishOnDispose?disposedRead.promise:history(q)});
 t.after(()=>f.ui.dispose());await f.mount();await f.open('155');
 const pending=f.d.emit('[data-bph-account]','change','9');await tick();
 await f.open('156');await f.d.emit('[data-bph-account]','change','19');
 oldRead.resolve(history(f.reads()[0],{marker:'STALE-SUPPLIER'}));await pending;
 assert.match(f.d.html(),/SUPPLIER-HISTORY-156-19/);assert.doesNotMatch(f.d.html(),/STALE-SUPPLIER/);
 finishOnDispose=true;const refreshing=f.ui.refresh();await tick();
 assert.equal(f.reads().length,3);f.ui.dispose();const before=f.d.writes(),markup=f.d.html();
 disposedRead.resolve(history(f.reads().at(-1),{marker:'DISPOSED-SUPPLIER'}));await refreshing;await tick();
 assert.equal(f.d.writes(),before);assert.equal(f.d.html(),markup);assert.deepEqual(f.forbidden,[]);
});

test('D2 removing the selected account on parent refresh clears history without choosing another USD account',async t=>{
 const f=fixture();t.after(()=>f.ui.dispose());await f.mount();await f.open('155');
 await f.d.emit('[data-bph-account]','change','9');assert.match(f.d.html(),/SUPPLIER-HISTORY-155-9/);
 const changed=f.cards.get('155');changed.accounts=changed.accounts.filter(a=>a.accountId!=='9');changed.accountCount=2;
 const before=f.reads().length;await f.ui.refresh();await tick();
 assert.equal(f.reads().length,before);assert.match(f.d.html(),/Hareketleri görmek için hesap seçin/);
 assert.doesNotMatch(f.d.html(),/SUPPLIER-HISTORY|value="7" selected|value="9" selected/);assert.deepEqual(f.forbidden,[]);
});
