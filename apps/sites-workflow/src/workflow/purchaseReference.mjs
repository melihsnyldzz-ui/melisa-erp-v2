const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const exact=value=>value===null||typeof value==='string'&&/^\d{1,20}\.\d{8,18}$/.test(value);
export function purchaseReferenceEnvelope(payload,productId,stockCode){
 const r=payload?.data;
 if(payload?.success!==true||payload.meta?.readOnly!==true||payload.meta?.financialEffect!==false||!r||r.productId!==productId||r.stockCode!==stockCode
  ||!['cardAmountExact','referenceExact','discountExact'].every(k=>exact(r[k]))||r.currency!==null&&!['TRY','USD','EUR'].includes(r.currency)
  ||r.unitLabel!==null&&typeof r.unitLabel!=='string'||typeof r.status!=='string'||!Array.isArray(r.reasons)
  ||r.referenceExact!==null&&(r.currency===null||r.unitLabel===null))throw Error('PURCHASE_REFERENCE_INVALID');
 return r;
}
function amount(value,currency){
 if(value===null)return 'Bilinmiyor';
 const [whole,fraction]=value.split('.');return `${esc(whole.replace(/\B(?=(\d{3})+(?!\d))/g,'.'))},${esc(fraction.replace(/0+$/,'').padEnd(2,'0'))} ${currency===null?'· Döviz bilinmiyor':esc(currency)}`;
}
export function renderPurchaseReference(r){
 const protectedValue=r.status.startsWith('PROTECTED_');
 const explanation=protectedValue?'Elle düzenlenmiş alış bilgisi korunuyor.':r.referenceExact!==null?r.priceBasis==='NET'?'Kaynakta net kayıtlı alış tutarıdır; ikinci iskonto uygulanmadı.':'Kayıtlı alış iskontosu bir kez uygulanmıştır.':r.priceBasis==='NET'||r.priceBasis==='GROSS'?r.unitLabel===null?'Birim doğrulanmadığı için alış referansı hesaplanmadı.':r.currency===null?'Döviz doğrulanmadığı için alış referansı hesaplanmadı.':'Alış referansı henüz doğrulanmadı.':r.discountExact===null?'Kart alış fiyatı, iskonto bilgisi yok.':'Brüt veya net olduğu doğrulanmadığından iskonto uygulanmadı.';
 return `<h3>Alış referansı</h3>${protectedValue?'<p>Mevcut doğrulanmış veya elle düzenlenmiş değer korunuyor.</p>':''}<dl><div><dt>Kart alış fiyatı</dt><dd>${amount(r.cardAmountExact,r.currency)}</dd></div><div><dt>Birim</dt><dd>${r.unitLabel===null?'Bilinmiyor':esc(r.unitLabel)}</dd></div><div><dt>Kayıtlı iskonto</dt><dd>${r.discountExact===null?'Bilinmiyor':esc(r.discountExact.replace(/0+$/,'').replace(/\.$/,'').replace('.',','))+' %'}</dd></div><div><dt>Alış referansı</dt><dd>${amount(r.referenceExact,r.currency)}</dd></div></dl><p class="sub">${explanation}</p><p class="sub">Bu değer muhasebe maliyeti veya gerçekleşmiş kâr hesabı değildir.</p>`;
}
