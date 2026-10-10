import {createHash} from 'node:crypto';
import {isolatedCopyOperationDTOContext,ISOLATED_COPY_ORIGIN,assertIsolatedCopyContext,BUSINESS_COPY_DATABASE} from './isolatedOperationCopyContext.mjs';
export const workError=(code='WORK_UNAVAILABLE',message='İşlem şu anda doğrulanamıyor.',statusCode=503)=>Object.assign(new Error(message),{code,statusCode});
export const workFail=(code,message,status=400)=>{throw workError(code,message,status);};
export function workId(value){if(typeof value!=='string'||!/^[1-9]\d{0,18}$/.test(value)||BigInt(value)>9223372036854775807n)workFail('WORK_ID_INVALID','Kayıt bilgisi geçersiz.');return value;}
export function workKeys(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))workFail('WORK_INPUT_INVALID','İşlem bilgisi geçersiz.');return value;}
export const workHash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function workRevision(value){if(typeof value!=='string'||!/^([a-fA-F0-9]{64})$/.test(value))workFail('WORK_REVISION_INVALID','Güncel kayıt bilgisi gerekli.');return value.toLowerCase();}
export function workRequestId(value){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))workFail('WORK_REQUEST_REQUIRED','Kalıcı işlem kimliği gerekli.');return value.toLowerCase();}
export function workDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)workFail('WORK_DATE_INVALID','İşlem tarihi geçersiz.');return value;}
export function workScaled(value,places){if(typeof value!=='string'||!new RegExp(`^(?:0|[1-9]\\d{0,13})\\.\\d{${places}}$`).test(value))workFail('WORK_AMOUNT_INVALID','Tutar veya miktar bilgisi geçersiz.');const [whole,fraction]=value.split('.');return BigInt(whole)*10n**BigInt(places)+BigInt(fraction);}
export function workExact(value,places){const scale=10n**BigInt(places);return `${value/scale}.${String(value%scale).padStart(places,'0')}`;}
export function workReason(value){if(typeof value!=='string'||value.trim().length<5||value.length>500)workFail('WORK_REASON_REQUIRED','En az 5 karakter açıklama gerekli.');return value.trim();}
// A selector is only an exact source lookup. It is not a write grant: the same
// transaction owner proof and sealed journal still authorize native operations.
export function workBusinessDailySelection(copy,input){
 assertIsolatedCopyContext(copy);workKeys(input,['customerId','accountId','currency','productIds']);
 if(copy.target.database!==BUSINESS_COPY_DATABASE||!['TRY','USD','EUR'].includes(input.currency))workFail('WORK_CURRENCY_UNSUPPORTED','Günlük işlem için doğrulanmış döviz hesabı gerekli.',409);
 const customerId=workId(input.customerId),accountId=workId(input.accountId),customers=copy.customers.filter(p=>p.id===customerId&&p.currency===input.currency),accounts=copy.financeAccounts.filter(a=>a.id===accountId&&a.currency===input.currency);
 if(customers.length!==1||customers[0].sourceKnown!==true||accounts.length!==1)workFail('WORK_CUSTOMER_SCOPE','Müşteri veya kasa hesabı bu işlem kapsamında değil.',403);
 if(!Array.isArray(input.productIds)||input.productIds.length<1||input.productIds.length>2||new Set(input.productIds).size!==input.productIds.length)workFail('WORK_ITEMS_INVALID','Bir veya iki farklı ürün seçin.');
 const productIds=input.productIds.map(workId);for(const id of productIds){const p=copy.products.find(p=>p.id===id);if(!p||p.unit!=='ADET'||p.unitFactorExact8!=='1.00000000'||!Array.isArray(p.quotes)||!p.quotes.some(q=>q.currency===input.currency&&q.verified===true&&q.mainUnit===true&&q.type==='sale'&&p.priceIds.includes(q.quoteId)&&workScaled(q.priceExact8,8)>0n))workFail('WORK_PRODUCT_SCOPE','Seçilen ürün için doğrulanmış kaynak fiyatı yok.',409);}
 return Object.freeze({customerId,customerAccountId:customers[0].accountId,financeAccountId:accountId,currency:input.currency,productIds:Object.freeze(productIds),copyId:copy.copyId,sealHash:copy.sealHash});
}
export function workBusinessCurrencyRate(copy,currency){
 assertIsolatedCopyContext(copy);if(copy.target.database!==BUSINESS_COPY_DATABASE||!['TRY','USD','EUR'].includes(currency))workFail('WORK_CURRENCY_UNSUPPORTED','İşlem dövizi doğrulanamadı.',409);
 const rates=copy.currencyRates.filter(r=>r.currency===currency);if(rates.length!==1||workScaled(rates[0].rateExact8,8)<=0n||rates[0].date>copy.date||currency==='TRY'&&rates[0].rateExact8!=='1.00000000')workFail('WORK_RATE_UNAVAILABLE','Kaynak kur bilgisi doğrulanamadı.',409);
 return rates[0];
}
export function workSelection(input,{allowBusinessCurrencies=false}={}){
 workKeys(input,['customerId','documentDate','currency','items']);
 if(!(allowBusinessCurrencies?['TRY','USD','EUR'].includes(input.currency):input.currency==='TRY'))workFail('WORK_CURRENCY_UNSUPPORTED','Bu işlem için doğrulanmış kaynak fiyatı gerekli.',409);
 if(!Array.isArray(input.items)||input.items.length<1||input.items.length>2)workFail('WORK_ITEMS_INVALID','1–2 ürün kalemi gerekli.');
 const ids=new Set();const items=input.items.map(row=>{
  workKeys(row,['productId','quoteId','quantityExact3']);const productId=workId(row.productId),quoteId=workId(row.quoteId),quantity=workScaled(row.quantityExact3,3);
  if(ids.has(productId)||quantity<1000n||quantity>5000n||quantity%1000n!==0n)workFail('WORK_QUANTITY_INVALID','Her üründen 1–5 tam adet seçilebilir.');ids.add(productId);
  return {productId,quoteId,quantityExact3:row.quantityExact3};
 });
 return {customerId:workId(input.customerId),documentDate:workDate(input.documentDate),currency:input.currency,items};
}
export function workSalePreview(selection,context){
 const copy=isolatedCopyOperationDTOContext(context),business=copy?.target.database===BUSINESS_COPY_DATABASE,s=workSelection(selection,{allowBusinessCurrencies:business}),scope=context.scope;
 if(s.documentDate!==context.meta?.date)workFail('WORK_DATE_SCOPE','Bu işlem için geçerli günün tarihi gerekli.',409);
 const scoped=value=>copy?value?.synthetic===false&&value.operationOrigin===ISOLATED_COPY_ORIGIN:value?.synthetic===true;
 if(!scoped(scope)||scope.customer?.id!==s.customerId||!scoped(scope.customer)||scope.customer.writeEligible!==true||scope.customer.currency!==s.currency||copy&&!copy.customers.some(p=>p.id===s.customerId&&p.currency===s.currency))workFail('WORK_CUSTOMER_SCOPE','Bu müşteri için kayıt oluşturulamıyor.',403);
 if(copy?.target.database===BUSINESS_COPY_DATABASE){const matched=copy.customers.filter(p=>p.id===s.customerId&&p.currency===s.currency);if(matched.length!==1||scope.customer.accountId!==matched[0].accountId||scope.customer.partyId!==matched[0].partyId||scope.customer.sourceKey!==matched[0].sourceKey)workFail('WORK_CUSTOMER_SCOPE','Müşterinin döviz hesabı doğrulanamadı.',403);}
 const items=s.items.map(row=>{
  const p=scope.products.find(product=>product.id===row.productId),quote=p?.prices.find(price=>price.quoteId===row.quoteId&&price.currency===s.currency);
  if(!p||!scoped(p)||p.writeEligible!==true||p.unit?.label!=='ADET'||p.unit.factorExact8!=='1.00000000'||!quote||copy&&!copy.products.some(v=>v.id===p.id&&v.stockCode===p.stockCode&&v.priceIds.includes(quote.quoteId)))workFail('WORK_PRODUCT_SCOPE','Seçilen ürün veya fiyat artık uygun değil.',409);
  if(copy?.target.database===BUSINESS_COPY_DATABASE){const source=copy.products.find(v=>v.id===p.id),witnesses=source.quotes?.filter(q=>q.quoteId===quote.quoteId&&q.currency===s.currency&&q.verified===true&&q.mainUnit===true&&q.type==='sale');if(witnesses?.length!==1||witnesses[0].priceExact8!==quote.unitPriceExact8)workFail('WORK_PRODUCT_SCOPE','Kaynak satış fiyatı değişti. Yeniden okuyun.',409);}
  const quantity=workScaled(row.quantityExact3,3),stock=workScaled(p.stockQuantityExact3,3),price8=workScaled(quote.unitPriceExact8,8);
  const price4=(price8+5000n)/10000n;
  if(price8<=0n||price4<=0n||stock<quantity)workFail('WORK_STOCK_OR_PRICE','Ürün fiyatı veya stok miktarı uygun değil.',409);
  const line=(quantity*price4+500n)/1000n;
  return {...row,stockCode:p.stockCode,name:p.name,unit:p.unit,unitPriceExact8:quote.unitPriceExact8,unitPriceExact4:workExact(price4,4),lineTotalExact4:workExact(line,4)};
 });
 const total=items.reduce((sum,row)=>sum+workScaled(row.lineTotalExact4,4),0n);
 if(total<=0n||total>workScaled(context.limits.maxInvoiceAmountExact4,4))workFail('WORK_TOTAL_LIMIT','Satış tutarı işlem sınırını aşıyor.',409);
 const rate=business?workBusinessCurrencyRate(copy,s.currency):null,amountTry=rate?(total*workScaled(rate.rateExact8,8)+50000000n)/100000000n:total;
 const value={selection:s,scopeRevision:workRevision(context.revision),currency:s.currency,subtotalExact4:workExact(total,4),grandTotalExact4:workExact(total,4),amountTryExact4:workExact(amountTry,4),items,writable:true,...(business?{settlement:{documentCurrency:s.currency,accountCurrency:s.currency,accountId:scope.customer.accountId,documentRateExact8:rate.rateExact8,accountRateExact8:rate.rateExact8,rateSource:rate}}:{})};
 return {...value,previewHash:workHash(value)};
}
export function workDraftInput(input,options){
 workKeys(input,['requestId','previewHash','expectedRevision','customerId','documentDate','currency','items']);
 const {requestId,previewHash,expectedRevision,...selection}=input;
 return {requestId:workRequestId(requestId),previewHash:workRevision(previewHash),expectedRevision:workRevision(expectedRevision),...workSelection(selection,options)};
}
export function workActionInput(input,{cancel=false}={}){workKeys(input,cancel?['requestId','expectedRevision','reason']:['requestId','expectedRevision']);return {requestId:workRequestId(input.requestId),expectedRevision:workRevision(input.expectedRevision),...(cancel?{reason:workReason(input.reason)}:{})};}
export function workActor(actor,permission){
 const id=workId(typeof actor?.id==='number'&&Number.isSafeInteger(actor.id)?String(actor.id):actor?.id);
 if(!Array.isArray(actor?.permissions)||!actor.permissions.includes(permission))workFail('WORK_FORBIDDEN','Bu işlem için yetkiniz bulunmuyor.',403);
 return {...actor,id};
}
