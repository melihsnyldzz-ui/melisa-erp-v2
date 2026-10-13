import './testProductPriceEditor.css';
import {businessPriceContext,businessPriceDisplay,businessPriceRequest,businessPricePending,canonicalPrice,tupleKey} from './businessProductPriceModel.mjs';

export function createBusinessProductPriceEditor({api,esc,productId,actorId,storage,onSaved,uuid=()=>crypto.randomUUID()}){
  const path=`/api/products/${encodeURIComponent(productId)}/current-prices`;
  const key=`melisa-business-price:${actorId}:${productId}`;
  let host=null,context=null,pending=null,editing=null,busy=false,loading=false,generation=0,disposed=false,message='';
  const alive=n=>!disposed&&host?.isConnected&&generation===n;
  const persist=value=>{if(!storage?.setItem)throw Error('Kayıt sonucu korunamıyor. Lütfen bu ekranı yeniden açın.');storage.setItem(key,JSON.stringify(value));pending=value;};
  const e=value=>esc(String(value??''));
  const label=p=>`Kademe ${p.tuple.tier} · ${p.tuple.currency}`;
  function paint(){
    if(!host?.isConnected||disposed||!context)return;
    const retainedReadOnly=pending?.status==='pending'&&context.canEdit===false;
    const locked=busy||pending?.status==='pending'&&!retainedReadOnly;
    host.innerHTML=`<section class="current-price-workspace"><div class="current-price-heading"><h3>Satış fiyatları</h3><button class="btn" data-business-price-refresh ${locked?'disabled':''}>Yenile</button></div>${message?`<p role="status">${e(message)}</p>`:''}<div class="current-price-cards">${context.prices.map(p=>`<article class="current-price-card"><h3>${e(label(p))}</h3><strong>${e(businessPriceDisplay(p.priceExact))}${p.priceExact===null?'':` ${e(p.tuple.currency)}`}</strong>${context.canEdit?`<button class="btn" data-business-price-edit="${e(p.priceId)}" ${locked||editing?'disabled':''}>Fiyatı düzenle</button>`:''}</article>`).join('')}</div>${!context.canEdit?'<p>Bu oturumda fiyatlar görüntülenebilir.</p>':''}${editing?`<form class="current-price-form" data-business-price-form><label>Fiyat<input name="price" inputmode="decimal" value="${e(editing.price)}" ${locked||editing.unknown?'disabled':''}></label><label class="unknown"><input type="checkbox" name="unknown" ${editing.unknown?'checked':''} ${locked?'disabled':''}> Bilinmiyor</label><label class="full">Değişiklik gerekçesi<textarea name="reason" minlength="3" maxlength="500" ${locked?'disabled':''}>${e(editing.reason)}</textarea></label><p class="full">${e(label(context.prices.find(p=>p.priceId===editing.priceId)))}. Geçmiş belgelerin fiyatları değişmez.</p><div class="full current-price-actions"><button class="btn primary" ${locked?'disabled':''}>Fiyatı kaydet</button><button type="button" class="btn" data-business-price-cancel ${locked?'disabled':''}>Vazgeç</button></div></form>`:''}${retainedReadOnly?'<p role="status">Bu oturumda fiyat kaydetme yetkisi yok. Bekleyen isteğiniz aynı haliyle korunuyor; bu ekrandan çıkabilirsiniz.</p>':pending?.status==='pending'?'<p>Önceki kaydın sonucu henüz doğrulanmadı. Aynı isteği kontrol ederek devam edin.</p><button class="btn primary" data-business-price-retry>Kaydın sonucunu kontrol et</button>':''}</section>`;
    host.querySelectorAll('[data-business-price-edit]').forEach(button=>button.onclick=()=>{
      const row=context.prices.find(p=>p.priceId===button.dataset.businessPriceEdit);
      editing={priceId:row.priceId,price:row.priceExact??'',unknown:row.priceExact===null,reason:''};paint();
    });
    const form=host.querySelector('[data-business-price-form]');
    form?.addEventListener('input',()=>{
      if(locked)return;
      editing={...editing,price:form.elements.price.value,unknown:form.elements.unknown.checked,reason:form.elements.reason.value};
      form.elements.price.disabled=editing.unknown;
    });
    form?.addEventListener('submit',event=>{
      event.preventDefault();if(locked||!context.canEdit)return;
      try{
        const body=businessPriceRequest(context,{priceId:editing.priceId,priceExact:canonicalPrice(editing.price,editing.unknown),reason:editing.reason},uuid());
        persist({actorId:String(actorId),productId,copyId:context.copyId,sealHash:context.sealHash,status:'pending',body});
        editing=null;send();
      }catch(error){message=error.message;paint();}
    });
    host.querySelector('[data-business-price-cancel]')?.addEventListener('click',()=>{editing=null;message='';paint();});
    host.querySelector('[data-business-price-refresh]')?.addEventListener('click',()=>{if(locked||loading)return;if(editing){message='Önce fiyat düzenlemesini kaydedin veya Vazgeç düğmesine basın.';paint();return;}load();});
    const retry=host.querySelector('[data-business-price-retry]');if(retry){retry.disabled=busy;retry.onclick=send;}
  }
  async function load(notice=''){
    const n=++generation;loading=true;host.textContent='Satış fiyatları okunuyor…';
    try{
      const value=businessPriceContext(await api(path),productId);if(!alive(n))return;
      context=value;const saved=storage?.getItem(key);
      pending=saved?businessPricePending(JSON.parse(saved),context,actorId):null;
      message=notice;paint();return true;
    }catch{if(alive(n)){context=null;host.innerHTML=`<p role="alert">${notice?'Fiyat kaydı doğrulandı. Güncel fiyatlar henüz yüklenemedi.':'Fiyat kaydı şu anda doğrulanamıyor.'}</p><button class="btn" data-business-price-load-retry>Güncel fiyatları yükle</button>`;host.querySelector('[data-business-price-load-retry]').onclick=()=>load(notice);}return false;}
    finally{if(generation===n)loading=false;}
  }
  async function send(){
    if(busy||pending?.status!=='pending'||!context?.canEdit)return;
    const sent=pending,n=generation;let confirmed=false;busy=true;message='Fiyat kaydı kontrol ediliyor…';paint();
    try{
      const result=businessPriceContext(await api(path,{method:'POST',body:sent.body}),productId);
      const changed=result.recentChanges.some(r=>r.requestId===sent.body.requestId&&r.actorId===String(actorId)&&r.priceId===sent.body.priceId&&tupleKey(r.tuple)===tupleKey(sent.body.tuple)&&r.priceExact===sent.body.priceExact&&r.reason===sent.body.reason);
      if(typeof result.replayed!=='boolean'||!changed)throw Error('RESULT_UNVERIFIED');
      const latest=businessPricePending(JSON.parse(storage.getItem(key)),context,actorId);
      if(JSON.stringify(latest.body)!==JSON.stringify(sent.body))throw Error('REQUEST_CHANGED');
      persist({...sent,status:'saved'});
      confirmed=true;
      if(alive(n)){context=result;message='Fiyat kaydı doğrulandı. Güncel liste ve kart yükleniyor…';}
    }catch(error){
      if([400,403,409].includes(error.status??error.statusCode)){
        persist({...sent,status:'rejected'});
        if(alive(n))message='İstek kabul edilmedi. Güncel fiyatları yükleyip yeniden kontrol edin.';
      }else if(alive(n))message='Sonuç henüz doğrulanamadı. Aynı istek korunuyor; kaydın sonucunu kontrol edin.';
    }finally{busy=false;if(alive(n))paint();}
    if(confirmed&&alive(n)){
      // Persistence is already confirmed. A failed display refresh must never
      // convert it back to a pending request or send another POST.
      try{if(typeof onSaved==='function'){if(await onSaved({productId})===false)throw Error('REFRESH_FAILED');}else await load('Fiyat kaydı doğrulandı. Güncel fiyatlar yüklendi.');}
      catch{if(alive(n)){context=null;host.innerHTML='<p role="alert">Fiyat kaydı doğrulandı. Güncel liste ve kart henüz yüklenemedi. Yenile düğmesiyle tekrar okuyun.</p>';}}
    }
  }
  return {
    mount(slot){host=slot;if(host)load();},
    requestClose(){if(busy||loading||pending?.status==='pending'&&context?.canEdit!==false||editing){message='Önce düzenlemeyi tamamlayın, vazgeçin veya bekleyen kaydın sonucunu kontrol edin.';paint();return false;}return true;},
    dispose(){disposed=true;generation++;host=null;},
  };
}
