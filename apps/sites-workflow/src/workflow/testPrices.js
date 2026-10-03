const labels={INVOICE_VERIFIED:'Fatura neti doğrulandı',CARD_PROVISIONAL:'Kart kaynaklı geçici maliyet',EMPTY:'Maliyet eksik',CONFLICT:'Maliyet çelişkili'};
export function testPrices({api,esc}){
 const amount=(n,c)=>n===null||n===undefined?'Belirsiz':`${Number(n).toLocaleString('tr-TR',{maximumFractionDigits:4})} ${esc(c||'')}`;
 return {
  html:()=>`<h1>Fiyat & maliyet</h1><section class="card panel"><p class="pill green">TEST SQL · Vega kaynak kanıtı · Salt okunur</p><p>Son alış faturası neti, geçici kart maliyeti ve stok değerleme maliyeti ayrı gösterilir. Eksik maliyet sıfır değildir.</p><form id="price-filter" class="test-price-filter"><label>Ürün kodu / adı<input name="search" placeholder="Ürün ara"></label><label>Maliyet durumu<select name="state"><option value="">Tümü</option>${Object.entries(labels).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label><input type="checkbox" name="positive" checked> Yalnız pozitif stok</label><button class="btn primary">Listele</button></form><p id="price-summary"></p><div id="price-results" aria-live="polite">SQL kayıtları okunuyor…</div></section>`,
  bind(){
   const form=document.getElementById('price-filter'),target=document.getElementById('price-results'),summary=document.getElementById('price-summary');let generation=0;
   async function load(){const current=++generation;target.textContent='SQL kayıtları okunuyor…';summary.textContent='';const f=new FormData(form);try{
    const data=await api('/api/test-prices?'+new URLSearchParams({search:f.get('search'),state:f.get('state'),positive:f.has('positive')?'1':'0'}));
    if(current!==generation||!target.isConnected)return;
    if(data.database!=='MELISA_ERP_SIRKET_TEST_20260929_01'||data.readOnly!==true)throw Error('TEST fiyat hedefi doğrulanamadı.');
    summary.textContent=`${data.items.length} kayıt gösteriliyor (en fazla ${data.limit}). Pozitif stok: `+data.summary.map(x=>`${labels[x.state]} ${x.positiveCount}`).join(' · ');
    target.innerHTML=`<div class="tablewrap"><table class="test-price-table"><thead><tr><th>Ürün / stok</th><th>Satış fiyatı</th><th>Alış net maliyeti</th><th>Mevcut stok değerlemesi</th><th>Kaynak kanıtı</th></tr></thead><tbody>${data.items.map(r=>{const e=r.evidence,s=e.costSource;return `<tr><td>${esc(r.stock_code)}<br><small>#${r.id} · ${esc(r.current_stock_qty)} ${esc(e.unit)}</small></td><td>${amount(r.sales_price,r.currency_code)}<br><small>KDV ${esc(Number(e.saleVatRate))}% ${e.saleVatIncluded?'dahil':'hariç'} · ${e.saleState==='VERIFIED'?'Doğrulandı':'Eşleme belirsiz'}</small></td><td><b>${esc(labels[e.costState])}</b><br>${amount(e.costUnitNet,e.costCurrency)}<br><small>${esc(e.costReasons.join(', '))}</small></td><td>${amount(Number(r.average_cost_try)>0?r.average_cost_try:null,'TRY')}<br><small>Fatura netinden ayrı; bu aktarımda değiştirilmedi.</small></td><td>${esc(s?.invoiceKey||s?.sourceCardKey||'VEGA2026/F0102TBLSTOKLAR/'+e.sourceId)}<br><small>${esc(s?.lineKeys?.join(', ')||'')}<br>${esc(s?.date||'')} · Birim çarpanı ${esc(Number(e.multiplier))}</small></td></tr>`}).join('')||'<tr><td colspan="5">Bu filtrede SQL kaydı yok.</td></tr>'}</tbody></table></div>`;
   }catch(e){if(current===generation&&target.isConnected){target.innerHTML=`<p class="test-error" role="alert">${esc(e.message)}</p>`;summary.textContent='Veri alınamadı; örnek kayıt veya önceki sonuç gösterilmiyor.'}}}
   form.onsubmit=e=>{e.preventDefault();load()};load();
  }
 };
}

