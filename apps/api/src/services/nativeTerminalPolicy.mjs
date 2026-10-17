import {createHash,createHmac,timingSafeEqual} from 'node:crypto';

export const nativeError=(code,message,statusCode=409)=>{throw Object.assign(new Error(message),{code,statusCode});};
export const nativeCashCodes=Object.freeze({'1-PEŞİN $':'USD','2-PEŞİN TL':'TRY','3-PEŞİN €':'EUR'});
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const nativeDigest=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
export function tokenCodec(secret,now=()=>Date.now()){
 if(typeof secret!=='string'||secret.length<32)nativeError('NATIVE_KEY_REQUIRED','Native terminal imza ayarı eksik.',503);
 const signature=value=>createHmac('sha256',secret).update('melisa-native-v1.'+value).digest();
 return {
  issue(kind,data,ttl=null){const raw=Buffer.from(JSON.stringify({version:1,kind,data,issuedAt:now(),expiresAt:ttl?now()+ttl:null})).toString('base64url');return raw+'.'+signature(raw).toString('base64url');},
  verify(token,kind){
   if(typeof token!=='string'||token.length>15000)nativeError('NATIVE_SNAPSHOT_INVALID','Fiyat/onay kaydı geçersiz.');
   const [raw,sig,extra]=token.split('.');const bytes=Buffer.from(sig||'','base64url'),expected=signature(raw||'');
   if(extra||bytes.length!==expected.length||!timingSafeEqual(bytes,expected))nativeError('NATIVE_SNAPSHOT_UNTRUSTED','Fiyat/onay imzası doğrulanamadı.');
   let record;try{record=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));}catch{nativeError('NATIVE_SNAPSHOT_INVALID','Fiyat/onay kaydı okunamadı.');}
   if(record.version!==1||record.kind!==kind||record.issuedAt>now()+300000||(record.expiresAt&&record.expiresAt<now()))nativeError('NATIVE_SNAPSHOT_EXPIRED','Onay süresi dolmuş veya kayıt geçersiz.');
   return record.data;
  }
 };
}
export function positiveId(v){const n=Number(v);if(!Number.isSafeInteger(n)||n<1)nativeError('NATIVE_ID_INVALID','Geçersiz kayıt kimliği.',400);return n;}
export function decimalValue(v,{max=99999999,min=0}={}){
 if(!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(String(v))||Number(v)<min||Number(v)>max)nativeError('NATIVE_VALUE_INVALID','Tutar veya oran geçersiz.',400);
 return Number(v);
}
export function saleIdentity(payload,actor){
 if(!/^[a-f0-9-]{36}$/i.test(payload?.clientEventId||'')||!/^[-\w]{1,80}$/.test(payload?.terminalCode||''))nativeError('NATIVE_IDENTITY_REQUIRED','Fiş veya cihaz kimliği geçersiz.',400);
 positiveId(actor?.id);const customerId=positiveId(payload.customerId);
 if(!['TRY','USD','EUR'].includes(payload.documentCurrency)||!Array.isArray(payload.items)||!payload.items.length||payload.items.length>250)nativeError('NATIVE_SALE_INVALID','Fiş para birimi veya satırları geçersiz.',400);
 const seen=new Set();
 const items=payload.items.map(i=>{const productId=positiveId(i.productId);if(seen.has(productId)||!Number.isSafeInteger(i.quantity)||i.quantity<1||i.quantity>99999)nativeError('NATIVE_QUANTITY_INVALID','Ürün adedi geçersiz veya aynı ürün iki satırda.',400);seen.add(productId);return {productId,quantity:i.quantity,unitPrice:decimalValue(i.unitPrice,{min:0.01}),quoteToken:String(i.quoteToken||'')};});
 if(typeof payload.note!=='string'||payload.note.length>200||!Array.isArray(payload.changes)||payload.changes.length>2000)nativeError('NATIVE_AUDIT_INVALID','Fiş notu veya değişiklik günlüğü geçersiz.',400);
 const changes=payload.changes.map(c=>{
  if(!['price','discount'].includes(c.field)||Number(c.actorId)!==Number(actor.id)||!Number.isFinite(Date.parse(c.at))||Date.parse(c.at)>Date.now()+300000||typeof c.id!=='string'||c.id.length>80)nativeError('NATIVE_AUDIT_OWNER','Değişiklik günlüğü personel veya zaman kaydı geçersiz.',400);
  return {id:c.id,field:c.field,productId:c.productId==null?null:positiveId(c.productId),oldValue:decimalValue(c.oldValue),newValue:decimalValue(c.newValue),actorId:Number(actor.id),at:c.at};
 });
 const business={version:1,clientEventId:payload.clientEventId,terminalCode:payload.terminalCode,customerId,documentCurrency:payload.documentCurrency,discountRate:decimalValue(payload.discountRate,{max:99.99}),note:payload.note,items,changes};
 return {business,digest:nativeDigest(business)};
}
export function validateQuotedLines(business,actor,operator,signer){
 let exchangeRate=null;
 const items=business.items.map(item=>{
  const q=signer.verify(item.quoteToken,'quote');
  // Only an explicitly signed common-currency catalog price may be reused for
  // another customer. The sale adapter checks current customer/device access.
  const commonCurrency=q.priceScope==='currency-v1';
  if(q.actorId!==Number(actor.id)||q.terminalCode!==business.terminalCode||(!commonCurrency&&q.customerId!==business.customerId)||q.currency!==business.documentCurrency||q.productId!==item.productId)nativeError('NATIVE_QUOTE_OWNER','Ürün fiyatı başka cari, personel veya cihaza ait.',403);
  if(!Number.isFinite(Number(q.exchangeRate))||Number(q.exchangeRate)<=0)nativeError('NATIVE_RATE_REQUIRED','ERP döviz kuru eksik.');
  if(exchangeRate==null)exchangeRate=Number(q.exchangeRate);
  // Each line keeps its captured sale price; the receipt's TRY snapshot is the first line's ERP rate.
  if(Math.abs(item.unitPrice-Number(q.unitPrice))>0.005){
   if(!operator.canChangeSalePrice)nativeError('NATIVE_PRICE_PERMISSION','Bu personelin fiyat değiştirme yetkisi yok.',403);
   if(!business.changes.some(c=>c.field==='price'&&c.productId===item.productId&&c.newValue===item.unitPrice))nativeError('NATIVE_PRICE_AUDIT_REQUIRED','Fiyat değişikliği günlüğü eksik.');
  }
  return {...item,quote:q};
 });
 return {items,exchangeRate};
}
