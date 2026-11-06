// Optional creation audit detail. No SQL, listeners or credentials.
export const DESKTOP_PRODUCT_OPENING_DEFAULT_REASON='Yeni ürün kartı başlangıç stok girişi';
const names=['kind','productId','movementId','actorId','requestId','reason','quantityExact3','costExact4','amountTryExact4','documentDate','currency'];
const id=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
export function desktopOpeningReason(v){if(typeof v!=='string'||!v||v.trim()!==v||v.length>250||/[\u0000-\u001f\u007f]/.test(v))throw Object.assign(Error('PRODUCT_OPENING_REASON_INVALID'),{code:'PRODUCT_OPENING_REASON_INVALID'});return v;}
export function isDesktopProductOpening(value,productId){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).length!==names.length||names.some(k=>{const d=Object.getOwnPropertyDescriptor(value,k);return !d?.enumerable||!Object.hasOwn(d,'value');}))return false;
 const v=value;if(v.kind!=='desktop-product-opening-v1'||!id(productId)||v.productId!==productId||!id(v.movementId)||!id(v.actorId)||typeof v.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v.requestId)||v.currency!=='TRY')return false;
 try{desktopOpeningReason(v.reason);}catch{return false;}
 if(typeof v.quantityExact3!=='string'||!/^(?:0|[1-9]\d{0,12})\.\d{3}$/.test(v.quantityExact3)||BigInt(v.quantityExact3.replace('.',''))===0n||!['costExact4','amountTryExact4'].every(k=>typeof v[k]==='string'&&/^(?:0|[1-9]\d{0,13})\.\d{4}$/.test(v[k]))||BigInt(v.costExact4.replace('.',''))===0n||typeof v.documentDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v.documentDate))return false;
 const [y,m,d]=v.documentDate.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d));return y>=1900&&date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;
}
