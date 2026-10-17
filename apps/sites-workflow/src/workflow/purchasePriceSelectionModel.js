const SCALE=100000000n,FOUR=10000n;
const fail=message=>{throw Error(message)};
export function exactDecimal(value,places=8){
 if(typeof value!=='string'||!new RegExp(`^\\d+\\.\\d{${places}}$`).test(value))fail('Kesin değer bilinmiyor veya biçimi doğrulanamadı.');
 return BigInt(value.replace('.',''));
}
function decimal(value,places){const negative=value<0n;if(negative)value=-value;const s=value.toString().padStart(places+1,'0');return `${negative?'-':''}${s.slice(0,-places)}.${s.slice(-places)}`}
const round=(value,divisor)=>(value+divisor/2n)/divisor;
export function nativePriceProjection(priceExact){const raw=exactDecimal(priceExact),native=round(raw,FOUR);return {priceExact,priceNative:decimal(native,4),roundingExact:decimal(native*FOUR-raw,8)}}
export function validTransactionDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value}
export function eligiblePurchaseQuotes(product,quotes=[]){
 if(product?.accepted!==true)return [];
 return quotes.filter(q=>String(q.productId)===String(product.id)&&q.accepted===true&&q.type==='purchase'&&q.unitKind==='CARD'&&q.tier===0&&['TRY','USD','EUR'].includes(q.currency)&&(q.sourceKind==='synthetic'||(q.sourceKind==='accepted-opening'&&q.sourceAsOf==='2026-09-30')));
}
function selectedInputs({product,quotes,rates,quoteId,documentRateId,accountRateId,date,quantity,accountCurrency,quantityPolicy}){
 if(!validTransactionDate(date))fail('Geçerli işlem tarihini seçin.');
 if(!['TRY','USD','EUR'].includes(accountCurrency))fail('Cari dövizini seçin.');
 const quote=eligiblePurchaseQuotes(product,quotes).find(q=>String(q.id)===String(quoteId));if(!quote)fail('Bu ürün için kabul edilmiş kart alış fiyatını seçin.');
 const projection=nativePriceProjection(quote.priceExact);
 if(typeof quantity!=='string'||!/^\d+(?:\.\d{1,3})?$/.test(quantity))fail('Pozitif adet girin; en fazla üç ondalık basamak kullanılabilir.');
 const [whole,fraction='']=quantity.split('.');const qty=BigInt(whole)*1000n+BigInt(fraction.padEnd(3,'0'));if(qty<=0n)fail('Pozitif adet girin.');
 if(quantityPolicy?.integer===true&&(fraction||qty<1000n||qty>5000n))fail('Bu TEST alışında 1–5 tam adet girin.');
 function selectedRate(id,currency){const r=(rates||[]).find(r=>String(r.id)===String(id));if(!r||r.currency!==currency||r.date!==date||r.stale===true||r.verified!==true||!r.source)fail('İşlem için kur seçin. Seçilen kurun dövizi ve tarihi işlemle eşleşmeli.');const value=exactDecimal(r.rateToTryExact);if(value<=0n)fail('Kur bilinmiyor; işlem için kur seçin.');return {record:r,value}}
 const doc=selectedRate(documentRateId,quote.currency),account=selectedRate(accountRateId,accountCurrency);
 if((quote.currency==='TRY'&&doc.value!==SCALE)||(accountCurrency==='TRY'&&account.value!==SCALE))fail('TRY kuru 1 olmalıdır.');
 if(quote.currency===accountCurrency&&doc.value!==account.value)fail('Aynı döviz için iki farklı kur kullanılamaz.');
 return {quote,projection,qty,doc,account,selection:{productId:product.id,quoteId:quote.id,quantity,date,documentCurrency:quote.currency,accountCurrency,documentRateId:doc.record.id,accountRateId:account.record.id}};
}
export function purchaseSelectionRequest(state){return selectedInputs(state).selection;}
export function purchaseSelectionPreview(state){
 const {quote,projection,qty,doc,account,selection}=selectedInputs(state);
 const {product,units,unitId}=state;
 const unit=(units||[]).find(u=>String(u.id)===String(unitId));if(unit?.verified!==true||String(unit.productId)!==String(product.id)||!unit.label||!unit.source)fail('Doğrulanmış işlem birimini seçin.');
 const factor=exactDecimal(unit.factorExact);if(factor<=0n)fail('İşlem birimi dönüşümü bilinmiyor.');
 if(factor!==SCALE)fail('Bu kart fiyatıyla yalnız doğrulanmış ana birim kullanılabilir.');
 const stockQuantity=round(qty*factor,1000n);
 const documentAmount=round(exactDecimal(projection.priceNative,4)*qty*factor,1000n*SCALE);
 const amountTry=round(documentAmount*doc.value,SCALE),accountAmount=round(documentAmount*doc.value,account.value);
 return {selection:{...selection,unitId:unit.id},quote,unit,documentRate:doc.record,accountRate:account.record,...projection,stockQuantityExact:decimal(stockQuantity,8),documentAmountNative:decimal(documentAmount,4),amountTryNative:decimal(amountTry,4),accountAmountNative:decimal(accountAmount,4)};
}
export function displayExact(value){
 if(value===null||value===undefined)return 'Bilinmiyor';
 if(typeof value!=='string'||! /^-?\d+\.\d+$/.test(value))return 'Bilinmiyor';
 const [whole,fraction]=value.split('.');return whole.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+fraction;
}

export function openingPurchaseSelection(product,price,meta){
 if(product?.accepted!==true||price?.type!=='purchase'||price.unitSourceId!==null||price.tier!==0||String(price.productId)!==String(product.productId))fail('Kabul edilmiş kart alış fiyatı seçilmedi.');
 nativePriceProjection(price.priceExact);
 return {productId:product.productId,priceId:price.id,productSourceKey:product.productSourceKey,priceSourceKey:price.sourceKey,runId:meta.runId,sourceHash:meta.sourceHash,planHash:meta.planHash,type:'purchase',unitSourceId:null,tier:0,currency:price.currency,priceExact:price.priceExact};
}
export function fxRatesForWidget(rates){
 if(!Array.isArray(rates))fail('İşlem için kur seçin.');
 return rates.map(r=>({id:`${r.currency}:${r.sourceId}`,currency:r.currency,date:r.asOf,rateToTryExact:r.rateToTryExact8,source:r.source==='synthetic-test'?'Sentetik TEST kuru · piyasa kuru değildir':r.source,verified:r.version==='1'&&r.source==='synthetic-test'&&typeof r.sourceId==='string'&&r.sourceId.length>0&&/^[a-f0-9]{64}$/i.test(r.hash || ''),raw:r}));
}
export function fxPreviewBody(selection,request,rates){
 const document=rates.find(r=>r.id===request.documentRateId),account=rates.find(r=>r.id===request.accountRateId);
 if(selection?.currency!==request.documentCurrency||document?.currency!==selection.currency||account?.currency!==request.accountCurrency||document?.verified!==true||account?.verified!==true)fail('Seçilmiş fiyat ve kur kayıtları eşleşmiyor.');
 if(!document||!account||document.raw.version!=='1'||account.raw.version!=='1'||request.accountCurrency!=='TRY'||request.date!=='2026-10-04')fail('Bu TEST önizlemesi 4 Ekim tarihli seçilmiş kurlar ve TRY cari ile kullanılabilir.');
 if(!/^[1-5]$/.test(request.quantity))fail('Bu TEST alışında 1–5 tam adet girin.');
 return {selection,quantity:Number(request.quantity),date:request.date,rateVersion:'1'};
}
