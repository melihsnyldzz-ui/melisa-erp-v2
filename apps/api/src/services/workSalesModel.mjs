import {createHash} from 'node:crypto';
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
export function workSelection(input){
 workKeys(input,['customerId','documentDate','currency','items']);
 if(input.currency!=='TRY')workFail('WORK_CURRENCY_UNSUPPORTED','Bu işlem için TRY fiyatı gerekli.',409);
 if(!Array.isArray(input.items)||input.items.length<1||input.items.length>2)workFail('WORK_ITEMS_INVALID','1–2 ürün kalemi gerekli.');
 const ids=new Set();const items=input.items.map(row=>{
  workKeys(row,['productId','quoteId','quantityExact3']);const productId=workId(row.productId),quoteId=workId(row.quoteId),quantity=workScaled(row.quantityExact3,3);
  if(ids.has(productId)||quantity<1000n||quantity>5000n||quantity%1000n!==0n)workFail('WORK_QUANTITY_INVALID','Her üründen 1–5 tam adet seçilebilir.');ids.add(productId);
  return {productId,quoteId,quantityExact3:row.quantityExact3};
 });
 return {customerId:workId(input.customerId),documentDate:workDate(input.documentDate),currency:'TRY',items};
}
export function workSalePreview(selection,context){
 const s=workSelection(selection),scope=context.scope;
 if(s.documentDate!==context.meta?.date)workFail('WORK_DATE_SCOPE','Bu işlem için geçerli günün tarihi gerekli.',409);
 if(scope?.synthetic!==true||scope.customer?.id!==s.customerId||scope.customer.synthetic!==true||scope.customer.writeEligible!==true||scope.customer.currency!=='TRY')workFail('WORK_CUSTOMER_SCOPE','Bu müşteri için kayıt oluşturulamıyor.',403);
 const items=s.items.map(row=>{
  const p=scope.products.find(product=>product.id===row.productId),quote=p?.prices.find(price=>price.quoteId===row.quoteId&&price.currency==='TRY');
  if(!p||p.synthetic!==true||p.writeEligible!==true||p.unit?.label!=='ADET'||p.unit.factorExact8!=='1.00000000'||!quote)workFail('WORK_PRODUCT_SCOPE','Seçilen ürün veya fiyat artık uygun değil.',409);
  const quantity=workScaled(row.quantityExact3,3),stock=workScaled(p.stockQuantityExact3,3),price8=workScaled(quote.unitPriceExact8,8);
  const price4=(price8+5000n)/10000n;
  if(price8<=0n||price4<=0n||stock<quantity)workFail('WORK_STOCK_OR_PRICE','Ürün fiyatı veya stok miktarı uygun değil.',409);
  const line=(quantity*price4+500n)/1000n;
  return {...row,stockCode:p.stockCode,name:p.name,unit:p.unit,unitPriceExact8:quote.unitPriceExact8,unitPriceExact4:workExact(price4,4),lineTotalExact4:workExact(line,4)};
 });
 const total=items.reduce((sum,row)=>sum+workScaled(row.lineTotalExact4,4),0n);
 if(total<=0n||total>workScaled(context.limits.maxInvoiceAmountExact4,4))workFail('WORK_TOTAL_LIMIT','Satış tutarı işlem sınırını aşıyor.',409);
 const value={selection:s,scopeRevision:workRevision(context.revision),currency:'TRY',subtotalExact4:workExact(total,4),grandTotalExact4:workExact(total,4),amountTryExact4:workExact(total,4),items,writable:true};
 return {...value,previewHash:workHash(value)};
}
export function workDraftInput(input){
 workKeys(input,['requestId','previewHash','expectedRevision','customerId','documentDate','currency','items']);
 const {requestId,previewHash,expectedRevision,...selection}=input;
 return {requestId:workRequestId(requestId),previewHash:workRevision(previewHash),expectedRevision:workRevision(expectedRevision),...workSelection(selection)};
}
export function workActionInput(input,{cancel=false}={}){workKeys(input,cancel?['requestId','expectedRevision','reason']:['requestId','expectedRevision']);return {requestId:workRequestId(input.requestId),expectedRevision:workRevision(input.expectedRevision),...(cancel?{reason:workReason(input.reason)}:{})};}
export function workActor(actor,permission){
 const id=workId(typeof actor?.id==='number'&&Number.isSafeInteger(actor.id)?String(actor.id):actor?.id);
 if(!Array.isArray(actor?.permissions)||!actor.permissions.includes(permission))workFail('WORK_FORBIDDEN','Bu işlem için yetkiniz bulunmuyor.',403);
 return {...actor,id};
}
