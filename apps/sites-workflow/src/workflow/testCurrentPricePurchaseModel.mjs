const fail=()=>{throw Error('Kayıtlı fiyatla TEST alış kaynağı doğrulanamadı.');};
const hex=/^[a-f0-9]{64}$/i;
export function currentPurchaseSelection(value){
 if(value?.productId!=='301986'||!['priceId','versionId'].every(k=>typeof value[k]==='string'&&/^[1-9]\d*$/.test(value[k]))||!hex.test(value.revision||'')||Object.keys(value).length!==4)fail();
 return {productId:value.productId,priceId:value.priceId,versionId:value.versionId,revision:value.revision};
}
export function currentPurchaseContext(value){
 const f=value?.fixture;
 if(value?.environment!=='ISOLATED_TEST'||String(f?.productId)!=='301986'||String(f?.supplierId)!=='13373'||f.unit!=='ADET'||f.factorExact8!=='1.00000000'||f.supplierCurrency!=='TRY'||f.maxQuantity!==5||f.maxAmountTryExact4!=='200.0000'||!/^\d{4}-\d{2}-\d{2}$/.test(f.date||'')||!Array.isArray(value.quotes)||!Array.isArray(value.receipts)||!Array.isArray(value.invoiceDrafts)||!Array.isArray(value.rates))fail();
 for(const q of value.quotes){currentPurchaseSelection(q.selection);if(!['TRY','USD','EUR'].includes(q.currency)||!(q.priceExact===null||typeof q.priceExact==='string'&&/^(0|[1-9]\d*)\.\d{8}$/.test(q.priceExact)))fail();}
 return value;
}
export function currentPurchaseBody(context,quoteIndex,quantity){
 currentPurchaseContext(context);const quote=context.quotes[Number(quoteIndex)];
 if(!/^\d+$/.test(String(quoteIndex))||!quote||quote.priceExact===null||!/^\d+$/.test(String(quantity))||Number(quantity)<1||Number(quantity)>context.fixture.maxQuantity)throw Error('Kayıtlı alış fiyatını ve 1–5 tam adedi seçin.');
 return {selection:currentPurchaseSelection(quote.selection),quantity:Number(quantity),date:context.fixture.date,rateVersion:'1'};
}
export function currentPurchasePreview(value,body){
 currentPurchaseSelection(value?.selection);
 if(value.writable===false){const messages={PRICE_UNKNOWN:'Alış fiyatı bilinmiyor. Önce kayıtlı fiyat oluşturun.',PRICE_ZERO:'Fiyat gerçek sıfırdır; bu TEST alışında sıfır fiyatla belge oluşturulamaz.',QUANTITY_SCOPE:'Bu TEST alışında 1–5 tam adet kullanın.',AMOUNT_SCOPE:'Seçilen tutar 200 TRY TEST sınırını aşıyor.',PRICE_OVERFLOW:'Bu fiyat belge tutarı sınırını aşıyor.',PRICE_NUMBER_BOUNDARY:'Bu fiyatın belge hassasiyeti güvenle korunamıyor.'};throw Error(messages[value.blockedCode]||'Seçilen fiyat bu TEST alışında kullanılamaz.');}
 if(JSON.stringify(value.selection)!==JSON.stringify(body.selection)||value.quantity!==body.quantity||value.date!==body.date||value.writable!==true||!hex.test(value.previewHash||'')||!['TRY','USD','EUR'].includes(value.currency)||['nativePriceExact4','documentAmountExact4','accountAmountExact4','amountTryExact4'].some(k=>typeof value[k]!=='string'||!/^\d+\.\d{4}$/.test(value[k])))fail();
 return value;
}
export function currentPurchaseJournal(value){
 if(!value||!['pending','saved','rejected'].includes(value.status)||typeof value.path!=='string'||!/^\/api\/test-current-price-purchase\/(receipts(?:\/[1-9]\d*\/(?:approve|reject))?|invoice-drafts(?:\/[1-9]\d*\/(?:finalize|cancel))?)$/.test(value.path)||!value.body||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.body.requestId||'')))fail();
 return value;
}
export function currentPurchaseCompletionMatches(current,sent,next){
 try{currentPurchaseJournal(current);currentPurchaseJournal(sent);}catch{return false;}
 return current.path===sent.path&&JSON.stringify(current.body)===JSON.stringify(sent.body)&&!(current.status==='saved'&&next!=='saved');
}
