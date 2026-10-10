import './workSupplierReturns.css';
import {purchaseReturnSources} from './testDailyPurchaseModel.js';
import {tradeUuid} from './workTradeModel.mjs';
import {createSupplierReturnJournal} from './supplierReturnJournal.mjs';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(v,c)=>Number.isFinite(Number(v))?`${Number(v).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})} ${esc(c)}`:'Bilinmiyor';
const day=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(new Date());
const parse=v=>{try{return typeof v==='string'?JSON.parse(v):v||{};}catch{return {};}};
const states={pending:'İnceleme bekliyor',approved:'İade tamamlandı',rejected:'İade reddedildi',cancelled:'Ters kayıtla geri alındı'};

export function createWorkSupplierReturns({root,session,user,storage=globalThis.localStorage,uuid=tradeUuid}){
 let active=true,loading=false,data=null,feedback='',alert=false,cancelId=null,generation=0;
 const alive=()=>active&&root.isConnected;
 const permissions=user?.permissions||[],review=Number(user?.id)===16||(Number(user?.id)===1&&user?.role?.code==='admin'&&['purchase.cancel','purchase.finalize'].every(p=>permissions.includes(p)));
 const journal=createSupplierReturnJournal({storage,key:`melisa-work-supplier-return:${globalThis.location?.host||'local'}:${user?.id}`,send:(path,options)=>session.inbound(path,options),refresh:load});
 const pending=()=>{try{return journal.read();}catch(error){feedback=error.message;alert=true;return true;}};
 const sources=()=>purchaseReturnSources(data||{});
 const choices=()=>sources().flatMap(p=>p.items.filter(l=>l.returnableQuantity>0).map(l=>({key:`${p.id}:${l.id}`,purchase:p,line:l})));
 function draw(){
  if(!alive())return;
  const recovering=pending(),locked=loading||journal.busy||!!recovering,options=choices();
  const rows=(data?.drafts||[]).filter(d=>['invoice-return','uninvoiced'].includes(d.kind)).map(d=>{
   const payload=parse(d.payload_json),plan=parse(d.plan_json),line=payload.items?.[0],source=sources().find(p=>p.id===String(payload.sourceInvoiceId)),item=source?.items.find(l=>l.id===String(line?.sourceItemId));
   const canDecide=review&&!locked&&d.kind==='invoice-return',quantity=payload.quantity??line?.quantity;
   return `<article class="return-record"><div><strong>${esc(plan.sourceDocumentNo||source?.number||'Alış kaydı')} · ${esc(states[d.state]||'İnceleme gerekli')}</strong><p>${esc(plan.items?.[0]?.stockCode||item?.code||'Ürün bilgisi incelenmeli')} · ${esc(quantity??'Bilinmiyor')} adet${plan.amount!==undefined?' · '+money(plan.amount,plan.documentCurrency||source?.currency):''}</p><details><summary>Açıklama</summary><p>${esc(payload.reason||'Gerekçe kaydedilmedi')}</p></details></div><div class="return-actions">${canDecide&&d.state==='pending'?`<button class="btn primary" data-return-approve="${esc(d.id)}">Onayla</button><button class="btn" data-return-reject="${esc(d.id)}">Reddet</button>`:''}${canDecide&&d.state==='approved'?`<button class="btn" data-return-cancel="${esc(d.id)}">Ters kayıt</button>`:''}</div>${cancelId===Number(d.id)?`<form class="return-cancel-form" data-return-cancel-form="${esc(d.id)}"><label>Geri alma gerekçesi<input name="reason" required minlength="5" maxlength="500"></label><button class="btn primary" ${locked?'disabled':''}>İadeyi geri al</button></form>`:''}</article>`;
  }).join('');
  root.innerHTML=`<div class="work-supplier-returns"><div class="heading"><div><div class="eyebrow">STOK VE TEDARİKÇİ</div><h1>Tedarikçiye iade</h1><p class="sub">Fiziksel olarak geri gönderilen malı kaynak alış satırıyla kaydedin.</p><a class="btn" href="/kullanim-egitimi.html#return" style="display:inline-flex;align-items:center;min-height:44px">Kısa eğitim</a></div><button class="btn" data-return-refresh ${loading||journal.busy?'disabled':''}>Yenile</button></div><section class="card panel" style="padding:20px"><h2>Yeni iade</h2>${options.length?`<form data-return-form class="return-source-grid"><label data-return-source>Kaynak alış satırı<select name="source" ${locked?'disabled':''}>${options.map(o=>`<option value="${esc(o.key)}">${esc(o.purchase.number)} · ${esc(o.line.code)} · kalan ${esc(o.line.returnableQuantity)} adet · ${money(o.line.priceCents/100,o.purchase.currency)}/adet</option>`).join('')}</select></label><label>İade miktarı<input name="quantity" type="number" min="1" max="${options[0].line.returnableQuantity}" step="1" value="1" required ${locked?'disabled':''}></label><label>Gerekçe<input name="reason" required minlength="3" maxlength="500" placeholder="Neden geri gönderiliyor?" ${locked?'disabled':''}></label><button class="btn primary" ${locked?'disabled':''}>İncelemeye gönder</button></form>`:`<p class="return-source-note">${loading?'Alış bilgileri açılıyor…':'İadeye uygun bağlı alış satırı bulunmuyor.'}</p>`}<p class="return-source-note">Taslak stoğu değiştirmez. Yetkili onayından sonra stok ve tedarikçi hesabı güncellenir. Para iadesi ayrı bir işlemdir.</p>${feedback?`<p class="return-feedback" role="${alert?'alert':'status'}">${esc(feedback)}</p>`:''}${recovering?`<p class="return-source-note">Önceki işlemin sonucu doğrulanmalı.</p><button class="btn primary" data-return-retry ${journal.busy?'disabled':''}>Yeniden doğrula</button>`:''}</section><section class="card panel" style="padding:20px"><h2>İade geçmişi</h2><div class="return-list">${rows||'<p>Henüz iade kaydı yok.</p>'}</div></section></div>`;
  if(loading)root.querySelector('[data-return-retry]')?.setAttribute('disabled','');
  root.querySelector('[data-return-refresh]')?.addEventListener('click',refresh);
  root.querySelector('[data-return-retry]')?.addEventListener('click',()=>{if(!loading)perform(()=>journal.retry());});
  const form=root.querySelector('[data-return-form]');
  form?.addEventListener('submit',event=>{event.preventDefault();if(locked||journal.busy)return;const choice=options.find(o=>o.key===form.elements.source.value),quantity=Number(form.elements.quantity.value),reason=form.elements.reason.value.trim();if(!choice||!Number.isInteger(quantity)||quantity<1||quantity>choice.line.returnableQuantity||reason.length<3)return;perform(()=>journal.begin('/api/test-daily/purchase/draft',{requestId:uuid(),sourceInvoiceId:Number(choice.purchase.id),sourceItemId:Number(choice.line.id),quantity,date:day(),reason}));});
  form?.elements?.source?.addEventListener('change',()=>{const choice=options.find(o=>o.key===form.elements.source.value);if(choice)form.elements.quantity.max=String(choice.line.returnableQuantity);});
  root.querySelectorAll('[data-return-approve]').forEach(b=>b.addEventListener('click',()=>decision('approve',Number(b.dataset.returnApprove))));
  root.querySelectorAll('[data-return-reject]').forEach(b=>b.addEventListener('click',()=>decision('reject',Number(b.dataset.returnReject))));
  root.querySelectorAll('[data-return-cancel]').forEach(b=>b.addEventListener('click',()=>{if(locked||journal.busy)return;cancelId=Number(b.dataset.returnCancel);draw();}));
  root.querySelectorAll('[data-return-cancel-form]').forEach(f=>f.addEventListener('submit',event=>{event.preventDefault();const reason=f.elements.reason.value.trim();if(reason.length>=5)decision('cancel',Number(f.dataset.returnCancelForm),reason);}));
 }
 async function load(){const n=++generation,next=await session.inbound('/api/test-daily/purchase');if(!next||!Array.isArray(next.availablePurchaseSources)||!Array.isArray(next.drafts))throw Error('İade bilgileri doğrulanamadı.');if(active&&n===generation)data=next;}
 async function refresh(){if(loading||journal.busy)return;loading=true;draw();try{await load();feedback='';alert=false;}catch(error){data=null;feedback=error?.status===403?'İade kayıtlarını görüntüleme yetkiniz yok.':'İade bilgileri açılamadı. Yenileyip tekrar deneyin.';alert=true;}finally{loading=false;draw();}}
 async function perform(action){if(loading||journal.busy)return;feedback='İşlem kaydediliyor…';alert=false;try{const work=action();draw();await work;feedback='İşlem kaydedildi. Güncel kayıtlar yenilendi.';cancelId=null;}catch(error){data=null;feedback=error?.status===403?'Bu işlem için yetkiniz yok.':error?.status===409?'Alış veya iade bilgisi değişti. Güncel kayıtları kontrol edin.':error?.status===400?'İşlem bilgilerini kontrol edin.':'İşlem sonucu henüz doğrulanamadı. Yeniden doğrulayın.';alert=true;}draw();}
 function decision(action,id,reason){if(!review||loading||journal.busy||pending()||!Number.isSafeInteger(id))return;const body={requestId:uuid(),id,date:day(),...(action==='approve'?{}:{reason:reason||'Kaynak ve fiziksel iade kontrolü gerekli.'})};perform(()=>journal.begin(`/api/test-daily/purchase/${action}`,body));}
 return {mount(){draw();refresh();},requestClose(){return !journal.busy&&!pending();},dispose(){active=false;generation++;data=null;}};
}
