import {tradeUuid} from './workTradeModel.mjs';
const fields=['customerCode','customerName','customerType'],types=['customer','wholesale','retail','mixed'];
const limits={customerCode:50,customerName:250};
const labels={customer:'Müşteri',wholesale:'Toptan',retail:'Perakende',mixed:'Karma'};
const key='melisa.customer-master.pending.v1';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const hash=v=>typeof v==='string'&&/^[A-F0-9]{64}$/.test(v);
const text=(v,max)=>typeof v==='string'&&v.length>0&&v===v.trim()&&v.length<=max&&!/[\u0000-\u001f\u007f-\u009f]/.test(v);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fail=()=>{throw Error('Müşteri kartı doğrulanamadı.');};
function context(value,card,actorId){
 const v2=value?.schemaVersion==='melisa-customer-master-context.v2';
 const keys=['actorId','copyId','currency','customerCode','customerId','customerName','customerType','revision','schemaVersion','sealHash',...(v2?['original']:[])];
 if(v2&&(!value.original||Object.keys(value.original).sort().join()!=='customerCode,customerName'||!text(value.original.customerCode,50)||!text(value.original.customerName,250)))fail();
 if(!value||Object.keys(value).sort().join()!==keys.sort().join()||!['melisa-customer-master-context.v1','melisa-customer-master-context.v2'].includes(value.schemaVersion)||value.customerId!==String(card?.id)||value.actorId!==actorId||!uuid(value.copyId)||!hash(value.sealHash)||!hash(value.revision)||!['TRY','USD','EUR'].includes(value.currency)||!text(value.customerCode,50)||!text(value.customerName,250)||!types.includes(value.customerType))fail();
 return Object.freeze({...value});
}
function markerValid(v){return v&&Object.keys(v).sort().join()==='actorId,copyId,customerId,requestId,sealHash'&&Number.isSafeInteger(v.actorId)&&v.actorId>0&&typeof v.customerId==='string'&&/^[1-9]\d{0,18}$/.test(v.customerId)&&uuid(v.copyId)&&uuid(v.requestId)&&hash(v.sealHash);}
// Only scope and UUID persist across refresh, never names, form bodies or tokens.
function markers(storage){return {
 read(){const raw=storage?.getItem(key);if(raw===null)return null;const value=JSON.parse(raw);if(!markerValid(value))fail();return value;},
 put(value){const old=this.read();if(!markerValid(value)||old&&JSON.stringify(old)!==JSON.stringify(value))fail();storage.setItem(key,JSON.stringify(value));if(storage.getItem(key)!==JSON.stringify(value))fail();},
 clear(value){const old=this.read();if(old&&JSON.stringify(old)===JSON.stringify(value))storage.removeItem(key);}
};}
export function createCustomerMasterEditor({read,write,recover,storage,actorId,onChange=()=>{},requestId=tradeUuid}={}){
 const journal=markers(storage);let card=null,current=null,draft=null,pending=null,marker=null,recoveryOnly=false,status='closed',message='',version=0,disposed=false;
 const state=()=>({status,message,context:current,draft:draft&&{...draft},changed:!!current&&!!draft&&fields.some(k=>draft[k]!==current[k])});
 const notify=()=>{if(!disposed)onChange(state());};
 const locked=()=>status==='saving'||status==='uncertain';
 const accept=value=>{const next=context(value,card,actorId);if(current&&(next.copyId!==current.copyId||next.sealHash!==current.sealHash||next.currency!==current.currency||next.schemaVersion!==current.schemaVersion||JSON.stringify(next.original)!==JSON.stringify(current.original)))fail();return next;};
 const clear=()=>{if(marker)journal.clear(marker);marker=null;pending=null;recoveryOnly=false;};
 return Object.freeze({state,locked,
  select(next){if(String(card?.id)===String(next?.id)){card=next;return;}if(locked())return;version++;card=next;current=null;draft=null;status='closed';message='';},
  async open(){if(disposed||!card||status==='saving'||status==='uncertain')return;const n=++version;status='loading';message='Kart bilgileri açılıyor…';notify();try{
   const next=context(await read(String(card.id)),card,actorId);if(disposed||n!==version)return;
   if(next.customerCode!==card.customerCode||next.customerName!==card.customerName)fail();
   current=next;draft=Object.fromEntries(fields.map(k=>[k,next[k]]));const stored=journal.read();
   if(stored){if(stored.actorId!==actorId||stored.customerId!==String(card.id)||stored.copyId!==next.copyId||stored.sealHash!==next.sealHash)fail();marker=stored;recoveryOnly=true;status='uncertain';message='Önceki kaydın sonucunu kontrol edin. Yeni kayıt gönderilmedi.';}
   else {status='ready';message='';}notify();
  }catch{if(!disposed&&n===version){status='error';current=null;draft=null;message='Kart düzenleme bağlantısı açılamadı. Bilgiler değiştirilmedi.';notify();}}},
  edit(field,value){if(status!=='ready'||!fields.includes(field)||typeof value!=='string')return;if(field==='customerType'?!types.includes(value):value.length>limits[field])return;draft[field]=value;},
  async save(){if(disposed||!card||!['ready','uncertain'].includes(status)||status==='ready'&&!state().changed)return;const n=version;
   if(recoveryOnly){status='saving';message='Önceki kayıt kontrol ediliyor…';notify();try{const result=await recover(String(card.id),marker.requestId);if(disposed||n!==version)return;if(typeof result?.committed!=='boolean')fail();const next=accept(result.context);if(!result.committed)throw Error();clear();current=next;draft=Object.fromEntries(fields.map(k=>[k,next[k]]));status='ready';message='Önceki kayıt doğrulandı.';}catch{if(disposed||n!==version)return;status='uncertain';message='Önceki kayıt doğrulanamadı. Yeni kayıt gönderilmedi.';}notify();return;}
   if(!pending){try{if(!text(draft.customerCode,50)||!text(draft.customerName,250)||!types.includes(draft.customerType))fail();const id=requestId();if(!uuid(id))fail();pending=Object.freeze({requestId:id,expectedRevision:current.revision,...draft});marker={actorId,copyId:current.copyId,customerId:String(card.id),requestId:id,sealHash:current.sealHash};journal.put(marker);}catch{pending=null;marker=null;message='Kod, ad ve türü kontrol edin. Kayıt gönderilmedi veya önceki kayıt bekliyor.';notify();return;}}
   status='saving';message='Kaydediliyor…';notify();try{const result=await write(String(card.id),pending);if(disposed||n!==version)return;if(typeof result?.replayed!=='boolean')fail();const next=accept(result.context);clear();current=next;draft=Object.fromEntries(fields.map(k=>[k,next[k]]));status='ready';message='Müşteri kartı kaydedildi.';}catch(error){if(disposed||n!==version)return;
    if(error?.status===400||error?.status===409&&['CUSTOMER_MASTER_STALE','CUSTOMER_MASTER_CODE_CONFLICT'].includes(error?.code)){try{clear();status=error.code==='CUSTOMER_MASTER_STALE'?'stale':'ready';message=error.code==='CUSTOMER_MASTER_STALE'?'Kart değişmiş. Formu kapatıp yenileyin; kaydınız uygulanmadı.':error.code==='CUSTOMER_MASTER_CODE_CONFLICT'?'Bu müşteri kodu kullanılıyor. Başka bir kod yazın.':'Kod, ad ve türü kontrol edin.';}catch{status='uncertain';message='Kaydın sonucu yeniden kontrol edilmeli.';}}
    else {status='uncertain';message='Kayıt sonucu doğrulanamadı. Aynı kaydı tekrar kontrol edin; yeni kayıt gönderilmedi.';}
   }notify();
  },
  close(){if(locked())return;version++;current=null;draft=null;status='closed';message='';notify();},
  dispose(){disposed=true;version++;card=null;current=null;draft=null;pending=null;}
 });
}
export function customerMasterCard(card,value){const next=context(value,card,value?.actorId);return {...card,customerCode:next.customerCode,customerName:next.customerName,customerType:next.customerType,...(next.original?{masterIdentity:{schemaVersion:'melisa-customer-master-identity.v1',customerId:String(card.id),...next.original}}:{})};}
export function customerMasterHtml(editor,{allowed=false}={}){
 if(!allowed)return '';const s=editor.state();
 if(s.status==='closed')return '<button class="btn" data-customer-master-open>Kart bilgilerini düzenle</button>';
 const locked=s.status!=='ready';
 return `<section class="trade-panel"><h3>Kart bilgileri</h3><p role="status">${esc(s.message)}</p>${s.draft?`<form data-customer-master-form><label>Müşteri kodu<input data-customer-master-field="customerCode" value="${esc(s.draft.customerCode)}" maxlength="50" ${locked?'disabled':''}></label><label>Müşteri adı<input data-customer-master-field="customerName" value="${esc(s.draft.customerName)}" maxlength="250" ${locked?'disabled':''}></label><label>Müşteri türü<select data-customer-master-field="customerType" ${locked?'disabled':''}>${types.map(t=>`<option value="${t}" ${s.draft.customerType===t?'selected':''}>${labels[t]}</option>`).join('')}</select></label><p class="trade-note">Döviz hesapları ve bakiyeler bu formda değişmez.</p><div class="trade-actions"><button class="btn primary" data-customer-master-save ${s.status==='uncertain'||s.status==='ready'&&s.changed?'':'disabled'}>${s.status==='uncertain'?'Kaydı tekrar kontrol et':'Kaydet'}</button><button class="btn" type="button" data-customer-master-close ${editor.locked()?'disabled':''}>Vazgeç</button></div></form>`:'<button class="btn" data-customer-master-close>Kapat</button>'}</section>`;
}
export function bindCustomerMaster(root,editor){
 root.querySelector('[data-customer-master-open]')?.addEventListener('click',()=>editor.open());
 root.querySelector('[data-customer-master-close]')?.addEventListener('click',()=>editor.close());
 root.querySelector('[data-customer-master-form]')?.addEventListener('submit',e=>{e.preventDefault();void editor.save();});
 root.querySelectorAll('[data-customer-master-field]').forEach(input=>input.addEventListener('input',()=>{editor.edit(input.dataset.customerMasterField,input.value);const s=editor.state(),button=root.querySelector('[data-customer-master-save]');if(button)button.disabled=s.status!=='ready'||!s.changed;}));
}
