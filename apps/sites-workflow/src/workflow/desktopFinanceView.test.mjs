import test from 'node:test';import assert from 'node:assert/strict';import {mountDesktopFinance} from './desktopFinanceView.mjs';
import {createDesktopFinanceController} from './desktopFinanceController.mjs';
// These surfaces are synthetic DOM fixtures, not real browser acceptance.
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function surface(){
 let html='',elements={};
 const element=(dataset={})=>({dataset,handlers:{},addEventListener(n,fn){this.handlers[n]=fn;},focus(){root.lastFocus=this;}});
 const root={isConnected:true,set innerHTML(v){
  html=v;elements=Object.fromEntries(['[data-prev]','[data-next]','[data-history-prev]','[data-history-next]','[data-retry]','[data-confirm]','[data-cancel-confirm]'].map(n=>[n,element()]));
  elements.form={elements:Object.fromEntries(['party','cash','amount','date','note'].map(n=>[n,element()]))};
  for(const name of ['data-finance-close','data-finance-receipt-title'])if(v.includes(name))elements['['+name+']']=element();
  this.buttons=['collection','payment'].map(op=>element({op}));
  this.receiptButtons=[...v.matchAll(/data-finance-open="(\d+)"/g)].map(m=>element({financeOpen:m[1]}));
 },get innerHTML(){return html;},querySelector(s){const m=s.match(/^\[data-finance-open="(\d+)"\]$/);return m?this.receiptButtons.find(b=>b.dataset.financeOpen===m[1])??null:elements[s]??null;},querySelectorAll(s){return s==='[data-op]'?this.buttons:s==='[data-finance-open]'?this.receiptButtons:[];},replaceChildren(){html='';elements={};this.receiptButtons=[];}};
 return root;
}

const savedPayment=()=>({movementId:'21',partyId:'2',entityId:'6',partyAccountId:'9',financeAccountId:'1',financeMovementId:'8',operation:'payment',currency:'TRY',accountCurrency:'TRY',financeCurrency:'TRY',direction:'out',amountExact4:'1.0000',accountAmountExact4:'1.0000',balanceEffectExact4:'-1.0000',amountTryExact4:'1.0000',documentRateExact8:'1.00000000',accountRateExact8:'1.00000000',financeAmountExact4:'1.0000',documentDate:'2026-11-10',financeDate:'2026-11-10',invoiceId:null});
function receiptHarness({row=savedPayment(),scope='current_actor',hasNext=false}={}){
 const root=surface(),calls={options:0,list:0,submit:0,retry:0,preflight:0,newId:0,storageWrite:0};
 const state={allowed:true,sessionGone:false,collectionAllowed:false};
 const forbidden=name=>()=>{calls[name]++;throw Error('unexpected '+name);};
 const controller={can:op=>{if(state.sessionGone)throw Error('stale actor');return state.allowed&&(op==='payment'||state.collectionAllowed);},pending:()=>{if(state.sessionGone)throw Error('stale actor');return null;},
  options:async()=>{calls.options++;return {parties:[],cash:[],hasNext:false};},
  list:async(op,page)=>{calls.list++;const receipt=structuredClone(row);if(op==='collection'&&receipt){receipt.operation='collection';receipt.direction='in';}return {data:[receipt],page,hasNext,scope};},
  submit:forbidden('submit'),retry:forbidden('retry'),preflight:forbidden('preflight'),newId:forbidden('newId'),storage:{setItem:forbidden('storageWrite'),removeItem:forbidden('storageWrite')}};
 return {root,calls,state,controller,mount:()=>mountDesktopFinance({root,controller})};
}
const openReceipt=root=>root.querySelectorAll('[data-finance-open]')[0].handlers.click();
const detail=/aria-label="Finans fişi ayrıntısı"/;

test('saved own payment reopens from GET history after a new mount with no write or extra request',async()=>{
 const f=receiptHarness(),first=f.mount();await tick();const oldOpen=f.root.receiptButtons[0].handlers.click;
 const before={...f.calls};openReceipt(f.root);assert.deepEqual(f.calls,before);
 assert.match(f.root.innerHTML,detail);assert.match(f.root.innerHTML,/Ödeme fişi #21/);
 for(const text of ['2026-11-10','<dt>Tedarikçi</dt><dd>#2</dd>','<dt>Kasa</dt><dd>#1</dd>','1.0000 TRY','-1.0000 TRY','Kasa çıkışı','güncel cari bakiyesi değildir'])assert(f.root.innerHTML.includes(text),text);
 assert.doesNotMatch(f.root.innerHTML,/UUID|current_actor|journal|generation|Cari kimlik|Belge kuru/);
 assert.equal(f.root.lastFocus,f.root.querySelector('[data-finance-receipt-title]'));
 const close=f.root.querySelector('[data-finance-close]');close.handlers.click();assert.doesNotMatch(f.root.innerHTML,detail);assert.equal(f.root.lastFocus,f.root.receiptButtons[0]);
 first.dispose();assert.equal(f.root.innerHTML,'');f.mount();await tick();oldOpen();assert.doesNotMatch(f.root.innerHTML,detail);
 const reloaded={...f.calls};openReceipt(f.root);assert.match(f.root.innerHTML,detail);assert.deepEqual(f.calls,reloaded);
 assert.equal(f.calls.list,2);assert.equal(f.calls.options,2);for(const name of ['submit','retry','preflight','newId','storageWrite'])assert.equal(f.calls[name],0);
});

test('history page and operation changes clear selection and reject old open/close callbacks',async()=>{
 const f=receiptHarness({hasNext:true});f.mount();await tick();const oldOpen=f.root.receiptButtons[0].handlers.click;openReceipt(f.root);const oldClose=f.root.querySelector('[data-finance-close]').handlers.click;
 f.root.querySelector('[data-history-next]').handlers.click();assert.doesNotMatch(f.root.innerHTML,detail);oldOpen();await tick();assert.doesNotMatch(f.root.innerHTML,detail);
 openReceipt(f.root);oldClose();assert.match(f.root.innerHTML,detail);
 const pageOpen=f.root.receiptButtons[0].handlers.click;f.state.collectionAllowed=true;f.root.buttons[0].onclick();assert.doesNotMatch(f.root.innerHTML,detail);pageOpen();await tick();assert.doesNotMatch(f.root.innerHTML,detail);
 openReceipt(f.root);assert.match(f.root.innerHTML,/Tahsilat fişi #21/);assert.match(f.root.innerHTML,/Kasa girişi/);
});

test('permission loss or an expired actor clears open receipt without a request or write',async()=>{
 for(const sessionGone of [false,true]){
  const f=receiptHarness();f.mount();await tick();openReceipt(f.root);const staleOpen=f.root.receiptButtons[0].handlers.click,before={...f.calls};
  if(sessionGone)f.state.sessionGone=true;else f.state.allowed=false;
  staleOpen();assert.doesNotMatch(f.root.innerHTML,detail);assert.deepEqual(f.calls,before);
  assert.doesNotMatch(f.root.innerHTML,/Ödeme fişi #21/);
 }
});

test('receipt amounts keep their exact four decimals without floating point rounding',async()=>{
 const amount='12345678901234.1250',row={...savedPayment(),amountExact4:amount,accountAmountExact4:amount,financeAmountExact4:amount,amountTryExact4:amount,balanceEffectExact4:'-'+amount};
 const f=receiptHarness({row});f.mount();await tick();openReceipt(f.root);
 assert.match(f.root.innerHTML,detail);assert(f.root.innerHTML.includes(amount+' TRY'));assert(f.root.innerHTML.includes('-'+amount+' TRY'));
 assert.doesNotMatch(f.root.innerHTML,/12345678901234\.1251|12345678901234\.13/);
});

test('malformed or unscoped history never offers a receipt to open and text remains escaped',async()=>{
 const changes=[null,{},...[
  {direction:'in'},{operation:'collection'},{currency:'USD'},{accountCurrency:'USD'},{financeCurrency:'USD'},
  {amountExact4:'0.0000'},{amountExact4:1},{financeAmountExact4:'2.0000'},{balanceEffectExact4:'1.0000'},
  {documentRateExact8:'2.00000000'},{financeDate:'2026-11-11'},{documentDate:'2026-02-30',financeDate:'2026-02-30'},
  {partyId:'0'},{financeAccountId:'9007199254740992'},{invoiceId:'0'},{description:'invented'},
  {documentDate:'<img src=x onerror=bad>',financeDate:'<img src=x onerror=bad>'},
  {amountExact4:'<script>bad</script>'}
 ].map(change=>({...savedPayment(),...change}))];
 for(const row of changes){const f=receiptHarness({row});f.mount();await tick();assert.equal(f.root.receiptButtons.length,0);assert.doesNotMatch(f.root.innerHTML,detail);assert.doesNotMatch(f.root.innerHTML,/<img|<script>/);}
 const unscoped=receiptHarness({scope:'all'});unscoped.mount();await tick();assert.equal(unscoped.root.receiptButtons.length,0);
});

test('history-row mutation, old close handlers and disposed callbacks cannot select a different receipt',async()=>{
 const f=receiptHarness(),mount=f.mount();let returned;
 const original=f.controller.list;f.controller.list=async(...args)=>(returned=await original(...args));await tick();
 // The first mount has already called list; remount to retain its response for the mutation check.
 mount.dispose();const next=f.mount();await tick();const open=f.root.receiptButtons[0].handlers.click;
 returned.data[0].partyId='3';open();assert.doesNotMatch(f.root.innerHTML,detail);
 returned.data[0].partyId='2';open();assert.match(f.root.innerHTML,detail);const close=f.root.querySelector('[data-finance-close]').handlers.click;
 close();openReceipt(f.root);close();assert.match(f.root.innerHTML,detail);
 next.dispose();const before={...f.calls};open();close();assert.equal(f.root.innerHTML,'');assert.deepEqual(f.calls,before);
});
test('failed mode change clears former data, closes form, and distinguishes an unread history',async()=>{const root=surface(),controller={can:()=>true,preflight:async()=>({status:'ready'}),pending:()=>null,options:async op=>{if(op==='payment')throw Error('offline');return {parties:[{id:'8',code:'M1',name:'Müşteri'}],cash:[],hasNext:false};},list:async op=>{if(op==='payment')throw Error('offline');return {data:[{documentDate:'2026-11-07',amountExact4:'1.0000',movementId:'1'}],hasNext:false};}};mountDesktopFinance({root,controller});await tick();assert.match(root.innerHTML,/Müşteri/);root.buttons[1].onclick();await tick();assert.doesNotMatch(root.innerHTML,/M1/);assert.match(root.innerHTML,/Cariler okunamadı/);assert.match(root.innerHTML,/Fişler okunamadı/);assert.doesNotMatch(root.innerHTML,/Henüz işlem yok/);assert.match(root.innerHTML,/<fieldset disabled>/);});
test('receipt pages are independent and a stale earlier response cannot overwrite them',async()=>{const root=surface(),calls=[];let resolveOld;const controller={can:()=>true,preflight:async()=>({status:'ready'}),pending:()=>null,options:async()=>({parties:[],cash:[],hasNext:false}),list:async(op,page)=>{calls.push([op,page]);if(op==='collection')return new Promise(r=>{resolveOld=r;});return {data:[{documentDate:'2026-11-07',amountExact4:page===1?'1.0000':'2.0000',movementId:String(page)}],hasNext:page===1};}};mountDesktopFinance({root,controller});root.buttons[1].onclick();await tick();assert.match(root.innerHTML,/1.0000/);resolveOld({data:[{documentDate:'2026-11-07',amountExact4:'9.0000',movementId:'9'}],hasNext:false});await tick();assert.doesNotMatch(root.innerHTML,/9.0000/);root.querySelector('[data-history-next]').handlers.click();await tick();assert.match(root.innerHTML,/2.0000/);assert.deepEqual(calls,[['collection',1],['payment',1],['payment',2]]);});
test('pending payment displays its own details and cannot retry without its permissions',async()=>{const root=surface();let retries=0;const controller={can:op=>op==='collection',pending:()=>({operation:'payment',body:{amountExact4:'12.0000',partyId:'18',financeAccountId:'10'}}),options:async()=>{throw Error('denied');},list:async()=>{throw Error('denied');},retry:async()=>{retries++;}};mountDesktopFinance({root,controller});await tick();assert.match(root.innerHTML,/tedarikçi ödemesinin/);assert.match(root.innerHTML,/12.0000 TRY, cari 18, kasa 10/);assert.match(root.innerHTML,/yazma ve cari görüntüleme yetkileri gerekir/);assert.match(root.innerHTML,/data-retry disabled/);await root.querySelector('[data-retry]').handlers.click();assert.equal(retries,0);});
test('two fast submits yield one UUID and one POST even after the first succeeds',async()=>{const root=surface();let saved=null,newIds=0,posts=0,finish;const c=createDesktopFinanceController({actorId:'7',storage:{getItem:()=>saved,setItem:(_k,v)=>{saved=v;},removeItem:()=>{saved=null;}},locks:{request:(_k,_o,fn)=>fn({})},newId:()=>{newIds++;return '12345678-1234-4234-8234-123456789abc';},transport:async(operation,b)=>{posts++;await new Promise(r=>{finish=r;});return {state:'COMMITTED',replayed:false,requestId:b.requestId,operation,movementId:'11',receipt:{movementId:'11',partyId:b.partyId,partyAccountId:b.partyAccountId,financeAccountId:b.financeAccountId,invoiceId:b.invoiceId,amountExact4:b.amountExact4,documentDate:b.documentDate,currency:'TRY',allocationRows:[{invoiceId:'15',dueDate:'2026-11-10',allocatedExact4:'20.0000',remainingExact4:'0.0000'}]}};}});const controller={...c,can:()=>true,preflight:async()=>({status:'ready'}),options:async()=>({parties:[{id:'8',accountId:'9',code:'C',name:'Cari'}],cash:[{id:'10',name:'Kasa'}],hasNext:false}),list:async()=>({data:[],hasNext:false})};mountDesktopFinance({root,controller});await tick();const form=root.querySelector('form');for(const [name,value] of Object.entries({party:'8',cash:'10',amount:'20',date:'2026-11-07'}))form.elements[name].handlers.input({target:{value}});await form.onsubmit({preventDefault(){}});const confirm=root.querySelector('[data-confirm]');const first=confirm.handlers.click();const second=confirm.handlers.click();assert.equal(newIds,1);assert.equal(posts,1);finish();await Promise.all([first,second]);assert.equal(newIds,1);assert.equal(posts,1);assert.equal(c.pending(),null);assert.match(root.innerHTML,/Tahsilat dağılımı/);assert.match(root.innerHTML,/2026-11-10/);assert.match(root.innerHTML,/20.0000 TRY/);});

test('cash collection and payment require confirmation of the selected party, cash and exact amount',async()=>{
 for(const operation of ['collection','payment']){const root=surface(),calls=[];let ids=0;
  const controller={can:()=>true,preflight:async()=>({status:'ready'}),pending:()=>null,options:async()=>({parties:[{id:'8',accountId:'9',code:'C01',name:'Örnek Cari'}],cash:[{id:'10',name:'Merkez Kasa'}],hasNext:false}),list:async()=>({data:[],hasNext:false}),submit:async(...args)=>{ids++;calls.push(args);return {state:'UNKNOWN'}}};
  mountDesktopFinance({root,controller});await tick();if(operation==='payment'){root.buttons[1].onclick();await tick();}
  let form=root.querySelector('form');for(const [name,v] of Object.entries({party:'8',cash:'10',amount:'20,5',date:'2026-11-07'}))form.elements[name].handlers.input({target:{value:v}});
  await form.onsubmit({preventDefault(){}});assert.equal(ids,0);assert.match(root.innerHTML,/C01 · Örnek Cari/);assert.match(root.innerHTML,/Merkez Kasa/);assert.match(root.innerHTML,/20\.5000 TRY/);assert.match(root.innerHTML,operation==='collection'?/Kasa artacak, müşteri alacağı azalacak/:/Kasa azalacak, tedarikçi borcu azalacak/);root.querySelector('[data-cancel-confirm]').handlers.click();assert.equal(ids,0);form=root.querySelector('form');await form.onsubmit({preventDefault(){}});await root.querySelector('[data-confirm]').handlers.click();assert.equal(ids,1);assert.equal(calls[0][0],operation);assert.equal(calls[0][1].amountExact4,'20.5000');
 }
});

test('disposed finance confirmation cannot submit',async()=>{const root=surface(),calls=[];const c={pending:()=>null,can:()=>true,preflight:async()=>({status:'ready'}),options:async()=>({parties:[{id:'8',accountId:'9',code:'C',name:'Cari'}],cash:[{id:'10',name:'Kasa'}],hasNext:false}),list:async()=>({data:[],hasNext:false}),submit:async(...v)=>calls.push(v)};const v=mountDesktopFinance({root,controller:c});await tick();const form=root.querySelector('form');for(const [name,value] of Object.entries({party:'8',cash:'10',amount:'20',date:'2026-11-07'}))form.elements[name].handlers.input({target:{value}});await form.onsubmit({preventDefault(){}});const old=root.querySelector('[data-confirm]').handlers.click;v.dispose();await old();assert.deepEqual(calls,[])});
test('unavailable collection preflight blocks confirmation and allocates no request',async()=>{const root=surface();let calls=0;const controller={can:()=>true,pending:()=>null,preflight:async input=>{assert.equal(input.amountExact4,'20.0000');return {status:'unavailable'};},options:async()=>({parties:[{id:'8',accountId:'9',code:'C',name:'Cari'}],cash:[{id:'10',name:'Kasa'}],hasNext:false}),list:async()=>({data:[],hasNext:false}),submit:async()=>{calls++;}};mountDesktopFinance({root,controller});await tick();const form=root.querySelector('form');for(const [name,value] of Object.entries({party:'8',cash:'10',amount:'20',date:'2026-11-07'}))form.elements[name].handlers.input({target:{value}});await form.onsubmit({preventDefault(){}});assert.equal(calls,0);assert.match(root.innerHTML,/Vade\/dağılım verisi doğrulanamadı/);assert.doesNotMatch(root.innerHTML,/İşlemi onaylayın/);});


test('closing a valid receipt after a malformed history row restores focus by its row key',async()=>{
 const f=receiptHarness(),list=f.controller.list;
 f.controller.list=async(...args)=>{const history=await list(...args);return {...history,data:[{},...history.data]};};
 f.mount();await tick();assert.equal(f.root.receiptButtons.length,1);assert.equal(f.root.receiptButtons[0].dataset.financeOpen,'1');
 openReceipt(f.root);assert.match(f.root.innerHTML,detail);
 f.root.querySelector('[data-finance-close]').handlers.click();assert.doesNotMatch(f.root.innerHTML,detail);
 assert.equal(f.root.lastFocus,f.root.querySelector('[data-finance-open="1"]'));
 assert.equal(f.root.lastFocus,f.root.receiptButtons[0]);
});
