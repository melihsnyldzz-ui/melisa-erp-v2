// Accepted opening prices only; scalar card prices are not a fallback.
export function exactAmount(value){
 if(value===null||value===undefined)return 'Bilinmiyor';
 if(typeof value!=='string'||! /^-?\d+\.\d{8}$/.test(value))throw Error('Kesin fiyat değeri doğrulanamadı.');
 const [whole,fraction]=value.split('.');
 return whole.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+fraction;
}
export function acceptedPriceEnvelope(payload){
 const m=payload?.meta;
 if(payload?.success!==true||!Array.isArray(payload.data)||m?.readOnly!==true||m?.sourceFreshLive!==false||m?.cutoverAccepted!==false||m?.runId!=='VEGA-OPENING-TEST-20261004-06'||m?.sourceAsOf!=='2026-09-30'||m?.sourceHash!=='36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400'||m?.planHash!=='18639c27f276f4263d5e9a6b5037753c78f2c3d341a053055db7cb7b00da2f0a')throw Error('Kabul edilmiş TEST fiyat kaynağı doğrulanamadı.');
 return payload;
}
export function testPrices({api,esc}){
 const priceTable=prices=>`<div class="tablewrap"><table><thead><tr><th>Tür</th><th>Birim / kademe</th><th>Kesin fiyat</th><th>Döviz</th></tr></thead><tbody>${prices.map(p=>`<tr><td>${p.type==='purchase'?'Alış':'Satış'}</td><td>${p.unitSourceId===null?'Kart alış birimi':`Kaynak birim #${esc(p.unitSourceId)}`} · ${esc(p.tier)}${p.isMainUnit?' · Ana birim':''}</td><td>${esc(exactAmount(p.priceExact))}</td><td>${esc(p.currency)}</td></tr>`).join('')||'<tr><td colspan="4">Kabul edilmiş fiyat yok; Bilinmiyor.</td></tr>'}</tbody></table></div>`;
 return {
 html:()=>`<h1>Fiyat & maliyet</h1><section class="card panel"><p class="pill green">TEST · Kabul edilmiş Vega açılışı · Salt okunur</p><p>Kaynak kesimi: <b>30 Eylül 2026</b>. Güncel Vega deltası uygulanmadı. Fiyatlar kendi dövizi, birimi ve kademesiyle gösterilir; bilinmeyen alış fiyatının yerine eski kart değeri kullanılmaz.</p><form id="price-filter" class="test-price-filter"><label>Ürün kodu / adı<input name="search" maxlength="120" placeholder="Kabul edilmiş ürün ara"></label><label><input type="checkbox" name="positive" checked> Yalnız pozitif stok</label><button class="btn primary">Listele</button></form><p id="price-summary"></p><div id="price-results" aria-live="polite">Kabul edilmiş fiyatlar okunuyor…</div><div id="price-detail" aria-live="polite"></div><div><button id="price-prev" class="btn" disabled>Önceki</button> <button id="price-next" class="btn" disabled>Sonraki</button></div></section>`,
 bind(){
  const form=document.getElementById('price-filter'),target=document.getElementById('price-results'),summary=document.getElementById('price-summary'),detail=document.getElementById('price-detail'),prev=document.getElementById('price-prev'),next=document.getElementById('price-next');let generation=0,detailGeneration=0,page=1;
  async function load(){const current=++generation;++detailGeneration;target.textContent='Kabul edilmiş fiyatlar okunuyor…';summary.textContent='';detail.textContent='';prev.disabled=next.disabled=true;const f=new FormData(form);try{
   const payload=acceptedPriceEnvelope(await api('/api/migration-opening-prices?'+new URLSearchParams({search:f.get('search'),positive:f.has('positive')?'1':'0',page:String(page),limit:'25'}),{envelope:true}));
   if(current!==generation||!target.isConnected)return;
   const {data:items,meta}=payload;summary.textContent=`${meta.total} kabul edilmiş ürün · Sayfa ${meta.page} · Kaynak kesimi 30 Eylül 2026`;
   target.innerHTML=`<div class="tablewrap"><table class="test-price-table"><thead><tr><th>Ürün / stok</th><th>Kabul edilmiş fiyatlar</th><th>Kanıtlı net maliyet</th></tr></thead><tbody>${items.map(r=>`<tr><td><button class="link" data-opening-product="${esc(r.productId)}">${esc(r.stockCode)}</button><br>${esc(r.productName)}<br><small>${esc(exactAmount(r.stockQuantityExact))} · ${r.isActive?'Aktif':'Pasif'}</small></td><td>${priceTable(r.prices)}${r.prices.some(p=>p.type==='purchase')?'':'<p>Alış fiyatı: Bilinmiyor</p>'}</td><td>${esc(exactAmount(r.averageCostTryExact))}${r.averageCostTryExact===null?'':' TRY'}<br><small>Native maliyet projeksiyonu (4 basamak); son doğrulanmış net alış, ağırlıklı ortalama değildir.</small></td></tr>`).join('')||'<tr><td colspan="3">Bu filtrede kabul edilmiş ürün yok.</td></tr>'}</tbody></table></div>`;
   prev.disabled=page<=1;next.disabled=page*meta.limit>=Number(meta.total);
   target.querySelectorAll('[data-opening-product]').forEach(b=>b.onclick=async()=>{const detailCurrent=++detailGeneration;detail.textContent='Ürünün kabul edilmiş fiyatları okunuyor…';try{const p=await api(`/api/products/${encodeURIComponent(b.dataset.openingProduct)}/opening-prices`,{envelope:true});if(current!==generation||detailCurrent!==detailGeneration||!detail.isConnected)return;acceptedPriceEnvelope({...p,data:[]});if(p.data.accepted!==true)throw Error('Ürün açılış kabulü dışında.');detail.innerHTML=`<h2>Ürün #${esc(p.data.productId)} · Açılış fiyatları</h2><p>30 Eylül 2026 kesimi · Salt okunur</p>${priceTable(p.data.prices)}${p.data.prices.some(x=>x.type==='purchase')?'':'<p>Alış fiyatı: Bilinmiyor</p>'}<div id="opening-purchase-selector">Alış önizlemesi hazırlanıyor…</div><div id="opening-purchase-preview" aria-live="polite"></div>`;
     const [{createPurchasePriceSelection,renderPurchaseFxPreview},{openingPurchaseSelection,fxRatesForWidget,fxPreviewBody},context]=await Promise.all([import('./purchasePriceSelection.js'),import('./purchasePriceSelectionModel.js'),api('/api/test-purchase-fx/context')]);
     if(current!==generation||detailCurrent!==detailGeneration||!detail.isConnected)return;
     if(context.environment!=='ISOLATED_TEST')throw Error('Dövizli alış TEST kaynağı doğrulanamadı.');
     const rates=fxRatesForWidget(context.rates),host=detail.querySelector('#opening-purchase-selector'),out=detail.querySelector('#opening-purchase-preview'),listed=items.find(r=>String(r.productId)===String(p.data.productId));let previewGeneration=0;
     const widget=createPurchasePriceSelection({api,esc,onChange:()=>{previewGeneration++;out.innerHTML='';},onSelection:async selection=>{
       const version=++previewGeneration,price=p.data.prices.find(q=>String(q.id)===String(selection.quoteId));
       const body=fxPreviewBody(openingPurchaseSelection(p.data,price,p.meta),selection,rates);
       const result=await api('/api/test-purchase-fx/preview',{method:'POST',body});
       if(current!==generation||detailCurrent!==detailGeneration||version!==previewGeneration||!out.isConnected)return;
       out.innerHTML=renderPurchaseFxPreview(result,esc)+(result.writable===true?'<p><a class="btn primary" href="#purchases">Dövizli TEST alışını aç</a></p>':'');
     }});
     widget.update({product:{id:p.data.productId,accepted:true,name:listed?.productName || 'Kabul edilmiş ürün',stockCode:listed?.stockCode},quotes:p.data.prices.filter(q=>q.type==='purchase'&&q.unitSourceId===null&&q.tier===0&&['USD','EUR'].includes(q.currency)).map(q=>({...q,accepted:true,unitKind:'CARD',sourceKind:'accepted-opening',sourceAsOf:p.meta.sourceAsOf,source:'Kabul edilmiş Vega açılış fiyatı',sourceHash:p.meta.sourceHash})),rates,units:[],authoritativeOnly:true,date:context.fixture.date,fixedDate:true,quantity:'1',quantityPolicy:{integer:true},accountCurrency:'TRY',fixedAccountCurrency:true});widget.bind(host);host.insertAdjacentHTML('afterbegin','<p>Bu salt okunur TEST önizlemesi USD ve EUR kart alış fiyatları içindir. Piyasa kuru kullanılmaz.</p>');
    }catch(e){if(current===generation&&detailCurrent===detailGeneration&&detail.isConnected){const errorTarget=detail.querySelector('#opening-purchase-selector') || detail;errorTarget.innerHTML=`<p class="test-error" role="alert">${esc(e.message)}</p>`;}}});
  }catch(e){if(current===generation&&target.isConnected){target.innerHTML=`<p class="test-error" role="alert">${esc(e.message)}</p>`;summary.textContent='Fiyat kabulü doğrulanamadı; eski kart fiyatı gösterilmiyor.';detail.textContent='';prev.disabled=next.disabled=true;}}}
  form.onsubmit=e=>{e.preventDefault();page=1;load()};prev.onclick=()=>{if(page>1){page--;load()}};next.onclick=()=>{page++;load()};load();
 }
 };
}
