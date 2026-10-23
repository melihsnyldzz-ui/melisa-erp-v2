import {createCustomerContactPendingMarker} from './customerContactPendingMarker.mjs';
import {tradeUuid} from './workTradeModel.mjs';
const fields=['phone','city','country'];
const limits={phone:40,city:100,country:100};
const fail=()=>{throw Error('İletişim bilgileri doğrulanamadı.');};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function customerContactContext(value,card,kind='customer'){
 if(!['customer','supplier'].includes(kind)||!value||value.schemaVersion!==`melisa-${kind}-contact-context.v1`||value[kind+'Id']!==String(card?.id)||value[kind+'Code']!==card[kind+'Code']||value[kind+'Name']!==card[kind+'Name']||typeof value.revision!=='string'||!/^[A-F0-9]{64}$/.test(value.revision)||!value.contact||Object.keys(value.contact).sort().join()!==fields.toSorted().join())fail();
 for(const key of fields){const v=value.contact[key];if(v!==null&&(typeof v!=='string'||v.length>limits[key]||/[\u0000-\u001f\u007f-\u009f]/.test(v)))fail();}
 if(value.contact.phone?.includes('*'))fail();
 return value;
}

// Only a validated server context may refresh the visible contact summary.
export function contactCardFromContext(card,context,kind='customer'){
 customerContactContext(context,card,kind);
 const value=context.contact.phone,digits=String(value??'').replace(/\D/g,'');
 const phoneMasked=!value?null:digits.length>=7?digits.slice(0,4)+'****'+digits.slice(-2):value.length<=3?'*'.repeat(value.length):value.slice(0,2)+'*'.repeat(value.length-3)+value.slice(-1);
 return {...card,fields:{...card.fields,phoneMasked,city:context.contact.city,country:context.contact.country}};
}

// Contact bodies remain only in memory. The optional storage keeps scope/UUID
// markers, never plaintext contact PII. Reload recovery is read-only and
// deliberate; an unresolved journal lookup never creates a replacement POST.
export function createCustomerContactEditor({read,write,requestId=()=>tradeUuid(),onChange=()=>{},recover,storage,actorId,kind='customer'}){
 if(!['customer','supplier'].includes(kind))fail();
 const markers=storage?createCustomerContactPendingMarker(storage,kind):null;
 const validate=(value,card)=>customerContactContext(value,card,kind);
 let marker=null,recoveryOnly=false;
 const clearMarker=()=>{if(marker&&markers)markers.clear(marker);marker=null;recoveryOnly=false;};
 let card=null,context=null,draft=null,pending=null,status='closed',message='',version=0,disposed=false;
 const changed=()=>context&&draft&&fields.some(k=>draft[k]!==context.contact[k]);
 const state=()=>({card,context,draft:draft&&{...draft},pending:pending&&{...pending},status,message,changed:!!changed()});
 const notify=()=>{if(!disposed)onChange(state());};
 return Object.freeze({
  state,
  select(next){if(card&&String(card.id)===String(next?.id)){card=next;return;}version++;card=next;context=null;draft=null;pending=null;status='closed';message='';},
  async open(){if(disposed||!card||status==='saving')return;const n=++version,selected=card;status='loading';message='İletişim bilgileri açılıyor…';notify();try{const result=validate(await read(String(selected.id)),selected);if(disposed||n!==version)return;context=result;draft={...result.contact};pending=null;
 const stored=markers?.read();
 if(stored){
  if(stored.actorId!==actorId||stored.customerId!==String(selected.id)||stored.copyId!==result.copyId||stored.sealHash!==result.sealHash)throw Error('Unresolved contact request scope mismatch');
  marker=stored;recoveryOnly=true;status='uncertain';message='Önceki kaydın sonucu kontrol edilmeli. Yeni kayıt gönderilmedi.';notify();return;
 }
 status='ready';message='';notify();}catch{if(!disposed&&n===version){status='error';message='İletişim bilgileri açılamadı. Yeniden deneyin.';notify();}}},
  edit(key,value){if(status!=='ready'||!fields.includes(key)||typeof value!=='string'||value.length>limits[key])return;draft[key]=value===''?null:value;},
  async save(){if(disposed||!card||!['ready','uncertain'].includes(status)||status==='ready'&&!changed())return;const n=version,selected=card;
 if(recoveryOnly){
  if(typeof recover!=='function')return;
  status='saving';message='Önceki kayıt kontrol ediliyor…';notify();
  try{const result=await recover(String(selected.id),marker.requestId);if(disposed||n!==version)return;if(typeof result?.committed!=='boolean')fail();const restored=validate(result.context,selected);if(restored.copyId!==marker.copyId||restored.sealHash!==marker.sealHash)fail();
   if(result.committed){clearMarker();context=restored;draft={...context.contact};status='ready';message='Önceki kayıt sunucuda doğrulandı.';}else{status='uncertain';message='Önceki kayıt henüz doğrulanamadı. Yeni kayıt gönderilmedi; tekrar kontrol edin veya kaydı açıkça bırakın.';}
  }catch{if(disposed||n!==version)return;status='uncertain';message='Önceki kayıt kontrol edilemedi. Yeni kayıt gönderilmedi.';}notify();return;
 }
 try{if(!pending){const id=requestId();if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw Error();pending=Object.freeze({requestId:id,expectedRevision:context.revision,...draft});}}catch{message='İşlem hazırlanamadı. Bilgiler gönderilmedi; yeniden deneyin.';status='ready';notify();return;}const body=pending;
 if(markers&&!marker){try{marker={actorId,copyId:context.copyId,customerId:String(selected.id),requestId:body.requestId,sealHash:context.sealHash};markers.put(marker);}catch{marker=null;pending=null;status='ready';message='Kayıt güvenle hazırlanamadı; bilgiler gönderilmedi. Önceki bekleyen kaydı kontrol edin.';notify();return;}}
 status='saving';message='Kaydediliyor…';notify();try{const result=await write(String(selected.id),body);if(disposed||n!==version)return;if(typeof result?.replayed!=='boolean')fail();context=validate(result.context,selected);draft={...context.contact};clearMarker();pending=null;status='ready';message='İletişim bilgileri kaydedildi.';notify();}catch(error){if(disposed||n!==version)return;if(error?.status===409){status='stale';message='Kart değişmiş. Güncel bilgileri açıp yeniden kontrol edin.';}else if(error?.status===403||error?.status===401){status='error';message='Bu bilgileri kaydetme yetkiniz doğrulanamadı.';}else if(error?.status===400){clearMarker();pending=null;status='ready';message='Telefon, şehir ve ülke bilgilerini kontrol edin.';}else{status='uncertain';message='Kaydın yanıtı alınamadı. Aynı kaydı tekrar kontrol edebilirsiniz.';}notify();}},
  close(){if(status==='saving')return;if(recoveryOnly||pending)clearMarker();version++;context=null;draft=null;pending=null;status='closed';message='';notify();},
  dispose(){disposed=true;version++;card=null;context=null;draft=null;pending=null;}
 });
}

export function customerContactHtml(editor,{allowed=false}={}){
 if(!allowed)return '';const s=editor.state();
 if(s.status==='closed')return '<button class="btn" data-customer-contact-open>İletişim bilgilerini düzenle</button>';
 const locked=s.status!=='ready',labels={phone:'Telefon',city:'Şehir',country:'Ülke'};
 return `<section class="trade-panel"><h3>İletişim bilgileri</h3><p role="status">${esc(s.message)}</p>${s.draft?`<form data-customer-contact-form>${fields.map(key=>`<label>${labels[key]}<input data-customer-contact-field="${key}" value="${esc(s.draft[key])}" maxlength="${limits[key]}" ${key==='phone'?'type="tel" autocomplete="tel"':'type="text"'} ${locked?'disabled':''}></label>`).join('')}<div class="trade-actions"><button class="btn primary" data-customer-contact-save ${s.status==='uncertain'||s.status==='ready'&&s.changed?'':'disabled'}>${s.status==='uncertain'?'Kaydı tekrar kontrol et':'Kaydet'}</button><button class="btn" type="button" data-customer-contact-close ${s.status==='saving'?'disabled':''}>${s.status==='uncertain'?'Formu kapat':'Vazgeç'}</button></div></form>`:''}${['error','stale'].includes(s.status)?'<button class="btn" data-customer-contact-open>Güncel bilgileri aç</button>':''}</section>`;
}

export function bindCustomerContact(root,editor){
 root.querySelector('[data-customer-contact-open]')?.addEventListener('click',()=>editor.open());
 root.querySelector('[data-customer-contact-close]')?.addEventListener('click',()=>editor.close());
 root.querySelector('[data-customer-contact-form]')?.addEventListener('submit',e=>{e.preventDefault();void editor.save();});
 root.querySelectorAll('[data-customer-contact-field]').forEach(input=>input.addEventListener('input',()=>{editor.edit(input.dataset.customerContactField,input.value);const s=editor.state(),button=root.querySelector('[data-customer-contact-save]');if(button)button.disabled=s.status!=='ready'||!s.changed;}));
}

