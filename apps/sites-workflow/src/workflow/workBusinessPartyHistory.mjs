import {parsePartyHistoryQuery,validatePartyHistoryEnvelope} from '../../../api/src/services/canonicalBusinessPartyHistoryModel.mjs';
import {moneyDisplay} from './moneyDisplay.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
const currencies=['TRY','USD','EUR'];
const labels={sales_invoice:'Satış faturası',sales_invoice_cancel:'Satış faturası iptali',collection:'Tahsilat',collection_cancel:'Tahsilat iptali',purchase_invoice:'Alış faturası',purchase_invoice_cancel:'Alış faturası iptali',payment:'Ödeme',payment_cancel:'Ödeme iptali',sales_return:'Satış iadesi',sales_return_cancel:'Satış iadesi iptali',purchase_return:'Alış iadesi',purchase_return_cancel:'Alış iadesi iptali'};
const movementLabel=kind=>Object.hasOwn(labels,kind)?labels[kind]:'Kayıtlı hareket';
// Existing two-decimal presentation leaves the exact transport untouched.
// A movement sign never supplies a B/A direction or a current balance.
const amount=(value,currency)=>{const displayed=moneyDisplay(value);return displayed==='Bilinmiyor'?displayed:displayed+' '+(currencies.includes(currency)?currency:'· Döviz bilinmiyor');};
export function createBusinessPartyHistory({kind,session,onChange=()=>{},locked=()=>false}={}){
 if(!['customer','supplier'].includes(kind)||typeof session?.partyHistory!=='function'||typeof onChange!=='function'||typeof locked!=='function')throw Error('Hesap hareketi bağlantısı doğrulanamadı.');
 let disposed=false,card=null,lastCardId='',accountId='',currency='',dateFrom='',dateTo='',page=1,result=null,busy=false,note='',version=0,binding=0;
 const notify=()=>{if(!disposed)onChange();};
 const invalidate=()=>{version++;result=null;busy=false;note='';};
 const usable=a=>id(a.accountId)&&currencies.includes(a.currency)&&card.accounts.filter(v=>v.accountId===a.accountId).length===1;
 const selected=()=>{if(!card)return null;const matches=card.accounts.filter(a=>a.accountId===accountId&&a.currency===currency&&usable(a));return matches.length===1?matches[0]:null;};
 const allowed=()=>!disposed&&card!==null&&!locked();
 function select(next){
  if(disposed)return;
  if(next===null){if(card!==null){invalidate();binding++;card=null;}return;}
  const nextId=typeof next?.id==='number'&&Number.isSafeInteger(next.id)?String(next.id):next?.id;
  if(!id(nextId)||!Array.isArray(next.accounts))throw Error('Hesap kartı doğrulanamadı.');
  const changed=lastCardId!==nextId,hidden=card===null;
  if(changed){invalidate();accountId='';currency='';dateFrom='';dateTo='';page=1;}
  card={id:nextId,name:kind==='customer'?next.customerName:next.supplierName,accounts:next.accounts.map(a=>({accountId:a?.accountId??null,currency:a?.currency??null}))};lastCardId=nextId;
  if(!changed&&accountId&&!selected()){invalidate();accountId='';currency='';page=1;note='Hesap bağlantısı değişti. Hesabı yeniden seçin.';}
  else if(hidden)invalidate();
  // select() is silent and never fetches: parents can call it during paint.
  // Reopening the same card retains filters; the parent explicitly refreshes.
 }
 async function load(){
  if(!allowed())return;
  const a=selected();if(!a){invalidate();note='Hareketleri görmek için hesap seçin.';notify();return;}
  const query={kind,partyId:card.id,accountId:a.accountId,currency:a.currency,page,dateFrom,dateTo};
  try{parsePartyHistoryQuery({...query,page:String(page)});}catch{invalidate();note='Geçerli başlangıç ve bitiş tarihini kontrol edin.';notify();return;}
  const n=++version;result=null;busy=true;note='';notify();
  try{
   const next=validatePartyHistoryEnvelope(await session.partyHistory(query),query);
   if(!disposed&&card!==null&&n===version)result=next;
  }catch(e){if(!disposed&&card!==null&&n===version)note=e?.status===403||e?.statusCode===403?'Bu hesabın hareketlerini görüntüleme yetkiniz yok.':e?.status===409||e?.statusCode===409?'Hesap bağlantısı doğrulanamadı. Kartı yenileyip hesabı yeniden seçin.':e?.status===404||e?.code==='BUSINESS_WORKFACE_SCOPE_UNAVAILABLE'?'Hesap hareketleri bu bağlantıda henüz açık değil.':'Hesap hareketleri şu anda okunamıyor. Yenileyerek tekrar deneyin.';}
  finally{if(!disposed&&card!==null&&n===version){busy=false;notify();}}
 }
 function html(){
  if(disposed||card===null)return '';
  const a=selected(),disabled=locked(),meta=result?.meta;
  const status=note||(busy?'Hesap hareketleri okunuyor…':!a?'Hareketleri görmek için hesap seçin.':result?meta.total===0?'Seçilen hesapta bu aralıkta kayıtlı hareket yok.':`${meta.total} hareket · Sayfa ${page}`:'Seçilen hesabın hareketlerini yenileyin.');
  return `<section class="card trade-panel trade-receipt" data-business-party-history="${kind}"><h2>Hesap hareketleri</h2><p>${esc(card.name??'Cari kartı')} · ${a?esc(a.currency)+' · Hesap #'+esc(a.accountId):'Hesap seçilmedi'}</p><label>Döviz hesabı<select data-bph-account ${disabled?'disabled':''}><option value="">Hesap seçin</option>${card.accounts.map(v=>`<option value="${esc(v.accountId??'')}" ${v.accountId===accountId&&v.currency===currency?'selected':''} ${!usable(v)?'disabled':''}>${esc(v.currency??'Döviz bilinmiyor')} · ${v.accountId?'Hesap #'+esc(v.accountId):'Hesap kimliği bilinmiyor'}</option>`).join('')}</select></label><form data-bph-dates><div class="trade-actions"><label>Başlangıç<input type="date" name="dateFrom" data-bph-from value="${esc(dateFrom)}" ${disabled?'disabled':''}></label><label>Bitiş<input type="date" name="dateTo" data-bph-to value="${esc(dateTo)}" ${disabled?'disabled':''}></label><button class="btn" ${disabled||!a?'disabled':''}>Tarihi uygula</button><button type="button" class="btn" data-bph-all-dates ${disabled||!a?'disabled':''}>Tüm tarihler</button></div></form><p class="trade-note">${dateFrom||dateTo?'Belge tarihi: '+esc(dateFrom||'Başlangıç sınırı yok')+' – '+esc(dateTo||'Bitiş sınırı yok'):'Kayıtlı tüm tarihler gösterilir.'} Bu liste güncel hesap bakiyesi hesaplamaz.</p><p role="status">${esc(status)}</p>${meta?.unassignedCount?`<p class="trade-note">Tüm kayıtlı tarihlerde bu carinin hesaba bağlanmamış ${meta.unassignedCount} hareketi var. Bu listeye eklenmedi.</p>`:''}<div class="office-review-list">${result?result.data.map(r=>`<article class="trade-preview"><h3>${esc(movementLabel(r.kind))} · #${esc(r.id)}</h3><p>${esc(r.documentDate)} · Belge: ${esc(r.invoiceNumber??'Bilinmiyor')}${r.returnId!==null?' · İade #'+esc(r.returnId):''}</p><p>Belge tutarı: <strong>${esc(amount(r.documentAmountExact,r.documentCurrency))}</strong><br>Cari tutarı: <strong>${esc(amount(r.accountAmountExact,r.accountCurrency))}</strong><br>Kayıtlı bakiye etkisi: ${esc(amount(r.balanceEffectExact,r.accountCurrency))}<br>Bakiyeyi etkiler: ${r.affectsBalance===null?'Bilinmiyor':r.affectsBalance?'Evet':'Hayır'}</p></article>`).join('')||'<p>Bu sayfada hareket yok.</p>':''}</div><div class="trade-actions"><button class="btn" data-bph-prev ${disabled||busy||!a||page<=1?'disabled':''}>Önceki 25 hareket</button><span>Sayfa ${page}</span><button class="btn" data-bph-next ${disabled||busy||!meta||page*25>=meta.total||page>=100000?'disabled':''}>Sonraki 25 hareket</button><button class="btn" data-bph-refresh ${disabled||busy||!a?'disabled':''}>Hareketleri yenile</button></div></section>`;
 }
 function bind(root){
  const selector=`[data-business-party-history="${kind}"]`,host=root?.matches?.(selector)?root:root?.querySelector(selector);if(!host||disposed||card===null)return;
  const n=++binding,current=()=>n===binding&&allowed();
  host.querySelector('[data-bph-account]')?.addEventListener('change',e=>{if(!current())return;const matches=card.accounts.filter(a=>a.accountId===e.target.value&&usable(a));invalidate();page=1;if(matches.length===1){accountId=matches[0].accountId;currency=matches[0].currency;return load();}accountId='';currency='';notify();});
  const form=host.querySelector('[data-bph-dates]');
  for(const [selector,key] of [['[data-bph-from]','dateFrom'],['[data-bph-to]','dateTo']]){
   const input=host.querySelector(selector),edit=e=>{if(!current())return;const value=e.target.value;if((key==='dateFrom'?dateFrom:dateTo)===value)return;if(key==='dateFrom')dateFrom=value;else dateTo=value;page=1;invalidate();note='Tarih aralığını uygulayın.';notify();};
   input?.addEventListener('input',edit);input?.addEventListener('change',edit);
  }
  form?.addEventListener('submit',e=>{e.preventDefault();if(!current())return;dateFrom=form.elements.dateFrom.value;dateTo=form.elements.dateTo.value;page=1;return load();});
  host.querySelector('[data-bph-all-dates]')?.addEventListener('click',()=>{if(!current())return;dateFrom='';dateTo='';page=1;return load();});
  host.querySelector('[data-bph-prev]')?.addEventListener('click',()=>{if(!current()||busy||!selected()||page<=1)return;page--;return load();});
  host.querySelector('[data-bph-next]')?.addEventListener('click',()=>{if(!current()||busy||!result||page*25>=result.meta.total||page>=100000)return;page++;return load();});
  host.querySelector('[data-bph-refresh]')?.addEventListener('click',()=>{if(!current()||busy)return;return load();});
 }
 return {select,html,bind,refresh:load,dispose(){disposed=true;invalidate();binding++;card=null;}};
}
