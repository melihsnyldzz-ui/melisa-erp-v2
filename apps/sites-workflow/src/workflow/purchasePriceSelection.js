import { eligiblePurchaseQuotes, purchaseSelectionPreview, purchaseSelectionRequest, nativePriceProjection, displayExact } from './purchasePriceSelectionModel.js';
import './purchasePriceSelection.css';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderPurchaseFxPreview(value,esc=escapeHtml){
 const e=x=>esc(String(x??'')),p=value?.projection,unit=value?.operationalUnit;
 const rate=r=>r?`${displayExact(r.rateToTryExact8)} · ${r.currency} · ${r.asOf || 'Tarih bilinmiyor'} · ${r.source==='synthetic-test'?'Sentetik TEST kuru; piyasa kuru değildir':r.source || 'Kaynak bilinmiyor'}`:'Bilinmiyor';
 const persisted=!!(value?.status||value?.state);
 return `<div class="purchase-fx-workspace"><h3>${persisted?'Kayıtlı alış fiyatı ve kur':'Doğrulanmış alış önizlemesi'}</h3><p>Kaynak kesimi 30 Eylül 2026 · eski açılış fiyatı, güncel fiyat değildir. ${value?.writable===true?'TEST ürünü için kabul edilmiş fiyat kopyası.':'Bu fiyat yalnız okunabilir; alış kaydı açılamaz.'}</p><div class="pps-fx-summary">Kaynak fiyat: <strong>${e(displayExact(p?.priceExact))} ${e(value?.currency)}</strong><br>${persisted?'Kayıtlı fiş fiyatı':'Fişe aktarılacak fiyat'}: ${e(displayExact(p?.nativePriceExact4))} ${e(value?.currency)} · Yuvarlama farkı: ${e(displayExact(p?.roundingDeltaExact8))}<br>İşlem tutarı: <strong>${e(displayExact(value?.documentAmountExact4))} ${e(value?.currency)}</strong><br>Cari tutarı / TL karşılığı: <strong>${e(displayExact(value?.accountAmountExact4))} TRY</strong> / ${e(displayExact(value?.amountTryExact4))} TRY<br>Miktar: ${e(value?.quantity)} · İşlem tarihi: ${e(value?.date)}<br>İşlem birimi: ${e(unit?.unit || 'Bilinmiyor')} · Stok dönüşümü: ${e(displayExact(unit?.factorExact8))}</div><p>İşlem kuru: ${e(rate(value?.rates?.document))}<br>Cari kuru: ${e(rate(value?.rates?.account))}</p>${persisted?'<p>Fiyat ve kurlar bu belgenin orijinal kaydından gösterilir; güncel kurla yeniden hesaplanmaz.</p>':'<p>Bu TEST akışında en fazla 5 tam adet ve 200 TRY karşılığı kullanılabilir. Kaydı hazırlamak stok veya borç oluşturmaz.</p>'}<details><summary>Kaynak doğrulama bilgileri</summary>${['productSourceKey','priceSourceKey','runId','sourceHash','planHash','bindingsHash'].map(k=>value?.sourceProof?.[k]?`<p>${e(value.sourceProof[k])}</p>`:'').join('')}<p>Birim kaynağı: ${e(unit?.sourceKey || 'Bilinmiyor')}</p></details></div>`;
}

/** Supplied data only: no endpoint or rate lookup is inferred here.
 * Product {id,name,stockCode,accepted}; quote {id,productId,type:'purchase',unitKind:'CARD',tier:0,
 * accepted,currency,priceExact,sourceKind:'accepted-opening'|'synthetic',sourceAsOf,source,sourceHash?}.
 * Unit {id,productId,label,verified,factorExact,source}; factor = stock units per operational unit.
 * Rate {id,currency,date,rateToTryExact,source,verified,stale?}; decimals use exact strings.
 * onSelection(selection, preview) may asynchronously fetch the authoritative preview.
 */
export function createPurchasePriceSelection({ api, esc = escapeHtml, onSelection, onChange } = {}) {
  let state = { quotes: [], units: [], rates: [], quantity: '', date: '', accountCurrency: '', loading: false, error: '', disabled: false };
  let pending = false, submissionError = '', revision = 0, authoritativeUnit = null;
  const e = value => esc(String(value ?? ''));
  const selected = (id, value) => String(id) === String(value) ? ' selected' : '';
  const option = (id, label, value, disabled = false) => `<option value="${e(id)}"${selected(id,value)}${disabled?' disabled':''}>${e(label)}</option>`;
  const choices = (items, value, label, placeholder) => `<option value="">${e(placeholder)}</option>${items.map(item=>option(item.id,label(item),value)).join('')}`;
  function preview() { try { return { value: purchaseSelectionPreview(state), error: '' }; } catch (error) { return { value: null, error: error.message }; } }
  function request(){try{return {value:state.authoritativeOnly?purchaseSelectionRequest(state):preview().value?.selection,error:''};}catch(error){return {value:null,error:error.message};}}
  function render() {
    const product = state.product, quotes = eligiblePurchaseQuotes(product,state.quotes);
    const quote = quotes.find(q=>String(q.id)===String(state.quoteId));
    const units = state.units.filter(u=>u.verified===true&&String(u.productId)===String(product?.id));
    const ratesFor = currency => state.rates.filter(r=>r.currency===currency);
    const rateLabel = r => `${r.date || 'Tarih bilinmiyor'} · ${r.source || 'Kaynak bilinmiyor'} · ${displayExact(r.rateToTryExact)}${r.stale===true||r.date!==state.date?' · Eski tarih':''}${r.verified!==true?' · Doğrulanmadı':''}`;
    const result = preview(), inputRequest=request(), locked = state.loading || state.disabled || pending;
    let projection; try { projection = nativePriceProjection(quote?.priceExact); } catch {}
    const source = quote?.copiedToTest===true ? 'TEST ürünü için kabul edilmiş fiyat kopyası · 30 Eylül 2026 kesimi · güncel fiyat değildir' : quote?.sourceKind==='synthetic' ? 'Sentetik ürün ve fiyat — TEST kaydı' : quote?.sourceKind==='accepted-opening' ? '30 Eylül 2026 kaynak kesimi — eski açılış fiyatı, güncel fiyat değildir' : 'Fiyat kaynağı bilinmiyor';
    const alert = state.error || submissionError;
    return `<section class="purchase-price-selector" aria-label="Alış fiyatı ve kur seçimi">
      <header><h3>Alış fiyatı ve kur</h3><p>${e(product?.name || 'Ürün seçilmedi')}${product?.stockCode?` · ${e(product.stockCode)}`:''}</p></header>
      ${state.loading?'<p role="status">Fiyatlar yükleniyor…</p>':''}${alert?`<p class="pps-error" role="alert">${e(alert)}</p>`:''}
      ${!state.loading&&!quotes.length?'<p role="status">Bu ürün için seçilebilir kart alış fiyatı bulunamadı.</p>':''}
      <fieldset${locked?' disabled':''}><div class="pps-fields">
      <label>Alış fiyatı<select data-pps="quoteId">${choices(quotes,state.quoteId,q=>`${displayExact(q.priceExact)} ${q.currency} · ${q.sourceKind==='synthetic'?'Sentetik':'30 Eylül açılışı'}`,'Fiyat seçin')}</select></label>
      <label>İşlem birimi<select data-pps="unitId"${state.authoritativeOnly?' disabled':''}>${state.authoritativeOnly?`<option selected>${authoritativeUnit?'ADET × 1 · Doğrulandı':'Bilinmiyor · önizlemede doğrulanacak'}</option>`:choices(units,state.unitId,u=>`${u.label} · ${displayExact(u.factorExact)} stok birimi`,'Doğrulanmış birim seçin')}</select></label>
      <label>Miktar<input data-pps="quantity" type="text" inputmode="decimal" value="${e(state.quantity)}" placeholder="Miktar girin"></label>
      <label>İşlem tarihi<input data-pps="date" type="date" value="${e(state.date)}"${state.fixedDate?' readonly':''}></label>
      <label>Cari dövizi<select data-pps="accountCurrency"${state.fixedAccountCurrency?' disabled':''}><option value="">Cari dövizini seçin</option>${['TRY','USD','EUR'].map(c=>option(c,c,state.accountCurrency)).join('')}</select></label>
      <label>İşlem dövizi kuru<select data-pps="documentRateId">${choices(ratesFor(quote?.currency),state.documentRateId,rateLabel,'İşlem için kur seçin')}</select></label>
      <label>Cari dövizi kuru<select data-pps="accountRateId">${choices(ratesFor(state.accountCurrency),state.accountRateId,rateLabel,'İşlem için kur seçin')}</select></label>
      </div><p class="pps-source">${e(source)}</p>
      <p class="pps-exact">Kaynak fiyat: <strong>${e(displayExact(projection?.priceExact))} ${e(quote?.currency)}</strong> · Fişe aktarılacak fiyat: <strong>${e(displayExact(projection?.priceNative))} ${e(quote?.currency)}</strong><br>Yuvarlama farkı: ${e(displayExact(projection?.roundingExact))} ${e(quote?.currency)}</p>
      ${result.value?`<div class="pps-results" aria-live="polite"><div>İşlem tutarı<strong>${e(displayExact(result.value.documentAmountNative))} ${e(quote.currency)}</strong></div><div>Cari tutarı<strong>${e(displayExact(result.value.accountAmountNative))} ${e(state.accountCurrency)}</strong></div><div>TL karşılığı<strong>${e(displayExact(result.value.amountTryNative))} TRY</strong></div></div><p>Stok miktarı: ${e(displayExact(result.value.stockQuantityExact))} · Doğrulanmış dönüşüm: ${e(result.value.unit.source)}</p>`:`<p class="pps-hint" aria-live="polite">${e(authoritativeUnit?'İşlem birimi kaynak kaydından doğrulandı. Tutarlar aşağıdaki önizlemede gösterilir.':state.authoritativeOnly&&inputRequest.value?'İşlem birimi ve tutar, önizlemede kaynak kaydından doğrulanacak.':inputRequest.error || result.error)}</p>`}
      <button type="button" class="pps-action" data-pps-preview${!inputRequest.value||locked||!!state.error||typeof onSelection!=='function'?' disabled':''}>${pending?'Önizleme hazırlanıyor…':'Seçimi önizle'}</button></fieldset>
      <details><summary>Kaynak bilgileri</summary><p>${e(quote?.source || 'Bilinmiyor')} · ${e(quote?.sourceAsOf || 'Tarih bilinmiyor')}</p>${quote?.sourceHash?`<p>${e(quote.sourceHash)}</p>`:''}<p>Fiyat seçimi: kart alış fiyatı. Birim dönüşümü: doğrulanmış stok dönüşümü. Tutarlar fişin dört ondalıklı fiyatı üzerinden hesaplanır.</p></details>
    </section>`;
  }
  function bind(container) {
    const paint = () => { container.innerHTML=render(); attach(); };
    function attach() {
      container.querySelectorAll('[data-pps]').forEach(input=>input.addEventListener('change',()=>{
        const key=input.dataset.pps; state={...state,[key]:input.value}; revision++; submissionError='';authoritativeUnit=null;
        if(key==='quoteId')state.documentRateId='';
        if(key==='accountCurrency')state.accountRateId='';
        if(key==='date'){state.documentRateId='';state.accountRateId='';}
        onChange?.();
        paint();
      }));
      container.querySelector('[data-pps-preview]')?.addEventListener('click',async()=>{
        const result=preview(),inputRequest=request(); if(!inputRequest.value||state.loading||state.disabled||state.error||pending)return;
        const version=revision; pending=true;submissionError='';authoritativeUnit=null;paint();
        try {
          const response=await onSelection?.(inputRequest.value,result.value),unit=response?.operationalUnit;
          if(version===revision&&unit?.unit==='ADET'&&unit.factorExact8==='1.00000000'&&unit.source==='accepted-opening-unit-evidence'&&unit.sourceKey&&/^[a-f0-9]{64}$/i.test(unit.hash || ''))authoritativeUnit=unit;
        } catch(error) { if(version===revision)submissionError=error?.message || 'Önizleme hazırlanamadı.'; }
        finally {pending=false;paint();}
      });
    }
    paint();return { update(data){update(data);paint();}, render:paint };
  }
  function update(data) { state={...state,...data};revision++;submissionError='';authoritativeUnit=null;return render(); }
  return { render, bind, update, getSelection:()=>request().value ?? null };
}
