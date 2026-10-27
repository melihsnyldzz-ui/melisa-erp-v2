import test from 'node:test';
import assert from 'node:assert/strict';
import {createBusinessPartyHistory} from './workBusinessPartyHistory.mjs';
import {parsePartyHistoryQuery,partyHistoryResult} from '../../../api/src/services/canonicalBusinessPartyHistoryModel.mjs';
const card=(id='155')=>({id,customerName:'Sentetik müşteri',supplierName:'Sentetik tedarikçi',accounts:[{accountId:'7',currency:'USD'},{accountId:'9',currency:'USD'},{accountId:'8',currency:'EUR'},{accountId:null,currency:'TRY'}]});
function envelope(query,{total=1,unassigned=2,edit=()=>{}}={}){
 const q=parsePartyHistoryQuery({...query,page:String(query.page)}),length=Math.min(25,Math.max(0,total-q.offset)),day=q.dateFrom??(q.dateTo&&q.dateTo<'2026-01-02'?q.dateTo:'2026-01-02');
 const rows=Array.from({length},(_,n)=>({id:String(1000-q.offset-n),kind:'collection',documentDate:day,documentAmountExact:'100.0000',documentCurrencyRaw:'TRY',accountAmountExact:'2.1234',accountCurrency:q.currency,balanceEffectExact:'-2.12345678',legacyBalanceEffectExact:'-2.1234',affectsBalance:true,invoiceId:'51',invoiceNumber:'SYNTHETIC-ONLY',returnId:null}));
 rows.forEach(edit);
 return {success:true,...partyHistoryResult({account:{id:q.accountId,partyId:q.partyId,oppositePartyId:null,partyEntityId:'3',currency:q.currency},total:String(total),unassignedCount:String(unassigned),conflictCount:'0',rows},q,{readAt:'2026-10-28T00:00:00.000Z'})};
}
function dom(){
 let markup='',nodes=new Map();
 const host={querySelector:node},root={querySelector:selector=>selector.startsWith('[data-business-party-history=')&&markup?host:null};
 Object.defineProperty(root,'innerHTML',{set(){assert.fail('Controller must not own parent root');}});
 function node(selector){
  const attr=selector.slice(1,-1);if(!markup.includes(attr))return null;
  if(!nodes.has(selector)){
   const n={value:'',addEventListener(e,f){this['on'+e]=f;}};
   nodes.set(selector,n);
   if(selector==='[data-bph-from]'||selector==='[data-bph-to]')n.value=new RegExp(attr+' value="([^"]*)"').exec(markup)?.[1]??'';
   if(selector==='[data-bph-dates]')n.elements={dateFrom:node('[data-bph-from]'),dateTo:node('[data-bph-to]')};
  }
  return nodes.get(selector);
 }
 return {root,node,render(value){markup=value;nodes=new Map();},html:()=>markup};
}
function fixture({kind='customer',read=q=>envelope(q),isLocked=()=>false}={}){
 const d=dom(),calls=[];let selectedCard=null,ui,paints=0;
 const paint=()=>{paints++;ui.select(selectedCard);d.render(ui.html());ui.bind(d.root);};
 ui=createBusinessPartyHistory({kind,session:{partyHistory:async query=>{calls.push({...query});return read(query);}},onChange:paint,locked:isLocked});
 const select=c=>{selectedCard=c;ui.select(c);paint();};
 const emit=(selector,event,value)=>{const n=d.node(selector);assert(n,'Expected '+selector);if(value!==undefined)n.value=value;return n['on'+event]?.({target:n,preventDefault(){}});};
 return {ui,d,calls,select,emit,paint,paints:()=>paints};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('account selection is explicit and exact even for two USD accounts; select/paint never fetch or recurse',async()=>{
 const f=fixture();f.select(card());assert.equal(f.calls.length,0);assert.match(f.d.html(),/Hesap hareketleri|Hesap seçin|Hesap #9/);assert.doesNotMatch(f.d.html(),/<option[^>]*selected/);
 const before=f.paints();f.paint();assert.equal(f.paints(),before+1);assert.equal(f.calls.length,0);
 await f.emit('[data-bph-account]','change','9');assert.deepEqual(f.calls,[{kind:'customer',partyId:'155',accountId:'9',currency:'USD',page:1,dateFrom:'',dateTo:''}]);
 assert.match(f.d.html(),/Hesap #9/);assert.doesNotMatch(f.d.html(),/data-sale-draft|data-sale-finalize|data-sale-collect|data-sp-save|localStorage/);f.ui.dispose();
});
test('document/account amounts use existing two-decimal display while exact transport, unknowns and unassigned records are preserved',async()=>{
 let original;const f=fixture({read:q=>{original=envelope(q);return original;}});f.select(card());await f.emit('[data-bph-account]','change','7');assert.match(f.d.html(),/100,00 TRY/);assert.match(f.d.html(),/2,12 USD/);assert.match(f.d.html(),/−2,12 USD/);assert.equal(original.data[0].balanceEffectExact,'-2.12345678');assert.equal(original.data[0].accountAmountExact,'2.1234');assert.match(f.d.html(),/hesaba bağlanmamış 2 hareketi/);assert.doesNotMatch(f.d.html(),/Müşterinin borcu|Müşterinin alacağı|Borç \/ alacak/);
 const unknown=fixture({read:q=>envelope(q,{edit:r=>Object.assign(r,{documentCurrencyRaw:'$2',accountAmountExact:null,accountCurrency:null,balanceEffectExact:null,legacyBalanceEffectExact:'987.6543',affectsBalance:null})})});unknown.select(card());await unknown.emit('[data-bph-account]','change','7');assert.match(unknown.d.html(),/Cari tutarı: <strong>Bilinmiyor<\/strong>/);assert.match(unknown.d.html(),/Kayıtlı bakiye etkisi: Bilinmiyor/);assert.doesNotMatch(unknown.d.html(),/987|Cari tutarı: <strong>0,00/);f.ui.dispose();unknown.ui.dispose();
});
test('dates are explicit, invalid filters send nothing, paging uses 25 and all-dates resets page and filters',async()=>{
 const f=fixture({read:q=>envelope(q,{total:26})});f.select(card());await f.emit('[data-bph-account]','change','7');await f.emit('[data-bph-next]','click');assert.equal(f.calls.at(-1).page,2);assert.match(f.d.html(),/Sayfa 2/);
 await f.emit('[data-bph-prev]','click');assert.equal(f.calls.at(-1).page,1);
 f.emit('[data-bph-from]','input','2026-01-01');f.emit('[data-bph-to]','change','2026-12-31');await f.emit('[data-bph-dates]','submit');assert.deepEqual(f.calls.at(-1),{kind:'customer',partyId:'155',accountId:'7',currency:'USD',page:1,dateFrom:'2026-01-01',dateTo:'2026-12-31'});
 const before=f.calls.length;f.emit('[data-bph-from]','input','2026-02-30');await f.emit('[data-bph-dates]','submit');assert.equal(f.calls.length,before);assert.match(f.d.html(),/Geçerli başlangıç/);
 await f.emit('[data-bph-all-dates]','click');assert.equal(f.calls.at(-1).dateFrom,'');assert.equal(f.calls.at(-1).dateTo,'');assert.equal(f.calls.at(-1).page,1);assert.match(f.d.html(),/Kayıtlı tüm tarihler/);f.ui.dispose();
});
test('account or date changes revoke pending results without replay or cross-currency rendering',async()=>{
 let finish;const f=fixture({read:q=>q.accountId==='7'?new Promise(r=>{finish=()=>r(envelope(q));}):envelope(q,{edit:r=>{r.invoiceNumber='EUR-ONLY';}})});f.select(card());const pending=f.emit('[data-bph-account]','change','7');await tick();await f.emit('[data-bph-account]','change','8');finish();await pending;
 assert.equal(f.calls.length,2);assert.equal(f.calls.at(-1).currency,'EUR');assert.match(f.d.html(),/EUR-ONLY/);assert.doesNotMatch(f.d.html(),/SYNTHETIC-ONLY/);
 let complete;const g=fixture({read:q=>new Promise(r=>{complete=()=>r(envelope(q));})});g.select(card());const waiting=g.emit('[data-bph-account]','change','7');await tick();g.emit('[data-bph-from]','input','2026-01-01');complete();await waiting;assert.doesNotMatch(g.d.html(),/SYNTHETIC-ONLY/);assert.match(g.d.html(),/Tarih aralığını uygulayın/);f.ui.dispose();g.ui.dispose();
});
test('hide invalidates pending reads; same card retains account/date/page for one explicit refresh and another card clears them',async()=>{
 let finish;const f=fixture({read:q=>q.page===2?new Promise(r=>{finish=()=>r(envelope(q,{total:26}));}):envelope(q,{total:26})});const c=card();f.select(c);await f.emit('[data-bph-account]','change','7');f.emit('[data-bph-from]','input','2026-01-01');await f.emit('[data-bph-dates]','submit');const pending=f.emit('[data-bph-next]','click');await tick();f.select(null);assert.equal(f.d.html(),'');finish();await pending;assert.equal(f.d.html(),'');
 f.select(c);assert.match(f.d.html(),/Sayfa 2/);assert.match(f.d.html(),/value="2026-01-01"/);assert.match(f.d.html(),/value="7" selected/);const before=f.calls.length;const refresh=f.ui.refresh();await tick();assert.equal(f.calls.length,before+1);finish();await refresh;assert.match(f.d.html(),/SYNTHETIC-ONLY/);
 f.select(card('156'));assert.doesNotMatch(f.d.html(),/value="7" selected|value="2026-01-01"|SYNTHETIC-ONLY/);assert.match(f.d.html(),/Sayfa 1/);f.ui.dispose();
});
test('same-ID card currency changes revoke the saved account; duplicate/unknown IDs never select a guessed account',async()=>{
 const f=fixture();f.select(card());await f.emit('[data-bph-account]','change','7');const changed=card();changed.accounts[0].currency='EUR';f.select(changed);assert.doesNotMatch(f.d.html(),/SYNTHETIC-ONLY|value="7" selected/);assert.match(f.d.html(),/Hesap bağlantısı değişti/);
 const duplicate=card();duplicate.accounts.push({...duplicate.accounts[0]});f.select(duplicate);const before=f.calls.length;await f.emit('[data-bph-account]','change','7');await f.emit('[data-bph-account]','change','');await f.emit('[data-bph-account]','change','USD');assert.equal(f.calls.length,before);f.ui.dispose();
});
test('errors reveal no stale financial rows or private error details, and substituted account envelopes reject',async()=>{
 for(const error of [{status:403,message:'PRIVATE'}, {statusCode:409,message:'PRIVATE'}, {status:404,message:'PRIVATE'}]){
  let fail=false;const f=fixture({read:q=>{if(fail)throw error;return envelope(q);}});f.select(card());await f.emit('[data-bph-account]','change','7');assert.match(f.d.html(),/SYNTHETIC-ONLY/);fail=true;await f.ui.refresh();assert.doesNotMatch(f.d.html(),/SYNTHETIC-ONLY|PRIVATE/);assert.match(f.d.html(),/yetkiniz yok|bağlantısı doğrulanamadı|henüz açık değil/);f.ui.dispose();
 }
 const f=fixture({read:q=>{const out=envelope(q);out.meta.scope.accountId='8';return out;}});f.select(card());await f.emit('[data-bph-account]','change','7');assert.match(f.d.html(),/şu anda okunamıyor/);assert.doesNotMatch(f.d.html(),/SYNTHETIC-ONLY/);f.ui.dispose();
});
test('escapes card/invoice strings and uses a generic label for unknown kinds; supplier scope never invents B/A',async()=>{
 const f=fixture({kind:'supplier',read:q=>envelope(q,{edit:r=>{r.kind='<img src=x onerror=bad>';r.invoiceNumber='<script>bad</script>';}})}),c=card();c.supplierName='A <img src=x> & B';f.select(c);await f.emit('[data-bph-account]','change','8');assert.equal(f.calls[0].kind,'supplier');assert.equal(f.calls[0].currency,'EUR');assert.match(f.d.html(),/A &lt;img src=x&gt; &amp; B/);assert.match(f.d.html(),/&lt;script&gt;bad&lt;\/script&gt;/);assert.match(f.d.html(),/Kayıtlı hareket/);assert.doesNotMatch(f.d.html(),/<script|<img|onerror|Melisa’nın|Müşterinin/);f.ui.dispose();
});
test('locked and disposed controllers reject even forced handlers; late completion cannot paint or write',async()=>{
 let lock=true,finish;const f=fixture({isLocked:()=>lock,read:q=>new Promise(r=>{finish=()=>r(envelope(q));})});f.select(card());assert.match(f.d.html(),/data-bph-account disabled/);await f.emit('[data-bph-account]','change','7');await f.ui.refresh();assert.equal(f.calls.length,0);
 lock=false;f.paint();const pending=f.emit('[data-bph-account]','change','7');await tick();const before=f.paints();f.ui.dispose();finish();await pending;assert.equal(f.paints(),before);assert.equal(f.ui.html(),'');await f.ui.refresh();assert.equal(f.calls.length,1);
 for(const kind of [undefined,'finance',[],{},'Customer'])assert.throws(()=>createBusinessPartyHistory({kind,session:{partyHistory(){assert.fail();}}}));
});
