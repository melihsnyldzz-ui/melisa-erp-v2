// Additional explicit sale prices for a TRY master card. No rate conversion.
const fail=()=>{throw Object.assign(Error('PRODUCT_SALE_PRICES_INVALID'),{code:'PRODUCT_SALE_PRICES_INVALID'});};
function exact(v,keys){return !!(v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value');}));}
const validId=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
function dense(v){return Array.isArray(v)&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).every(d=>d?.enumerable&&Object.hasOwn(d,'value'));}
export function desktopAdditionalSalePrices(currency,values){
 if(currency!=='TRY'||!Array.isArray(values)||values.length<1||values.length>2||!dense(values))fail();
 let previous=-1;
 return Object.freeze(values.map(v=>{
  if(!exact(v,['currency','priceExact4']))fail();const index=['USD','EUR'].indexOf(v.currency);
  if(index<=previous||typeof v.priceExact4!=='string'||!/^(?:0|[1-9]\d{0,13})\.\d{4}$/.test(v.priceExact4)||BigInt(v.priceExact4.replace('.',''))===0n)fail();
  previous=index;return Object.freeze({currency:v.currency,priceExact4:v.priceExact4});
 }));
}
export function isDesktopProductSalePrices(rows,productId,mainUnitId){
 if(!validId(productId)||!validId(mainUnitId)||!Array.isArray(rows)||rows.length<1||rows.length>30||!dense(rows))return false;
 const ids=new Set(),currencies=new Set();
 return rows.every(p=>{
  const tuple=JSON.stringify([p?.currency,p?.tier]);
  if(!exact(p,['id','productId','unitId','type','tier','currency','priceExact8'])||!validId(p.id)||p.productId!==productId||p.unitId!==mainUnitId||p.type!=='sale'||p.tier!==null&&(!Number.isInteger(p.tier)||p.tier< -2147483648||p.tier>2147483647)||!['TRY','USD','EUR'].includes(p.currency)||typeof p.priceExact8!=='string'||!/^(?:0|[1-9]\d{0,19})\.\d{8}$/.test(p.priceExact8)||ids.has(p.id)||currencies.has(tuple))return false;
  ids.add(p.id);currencies.add(tuple);return true;
 });
}
