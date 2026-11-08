// Read-only local supplier agreement and currency-account contract.
const plain=(value,keys)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>{const d=Object.getOwnPropertyDescriptor(value,key);return d?.enumerable&&Object.hasOwn(d,'value');});
const dense=value=>Array.isArray(value)&&Reflect.ownKeys(value).length===value.length+1&&Array.from({length:value.length},(_,i)=>Object.getOwnPropertyDescriptor(value,String(i))).every(d=>d?.enumerable&&Object.hasOwn(d,'value'));
const text=(value,max,required=false)=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value)&&(!required||value.trim().length>0);
const currency=value=>['TRY','USD','EUR'].includes(value);
export const desktopSupplierCardId=value=>typeof value==='string'&&/^[1-9]\d{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n;
export function isDesktopSupplierCard(value,supplierId){
 try{
  if(!plain(value,['id','supplierCode','name','phone','city','country','currency','purchaseDiscountRateExact4','isActive','entityId','accounts'])||!desktopSupplierCardId(supplierId)||value.id!==supplierId||!text(value.supplierCode,50,true)||!text(value.name,250,true)||!currency(value.currency)||typeof value.isActive!=='boolean'||!desktopSupplierCardId(value.entityId)||!['phone','city','country'].every(key=>value[key]===null||text(value[key],key==='phone'?40:100)))return false;
  if(typeof value.purchaseDiscountRateExact4!=='string'||!/^(?:0|[1-9]\d{0,2})\.\d{4}$/.test(value.purchaseDiscountRateExact4)||BigInt(value.purchaseDiscountRateExact4.replace('.',''))>1000000n||!dense(value.accounts)||value.accounts.length<1||value.accounts.length>3)return false;
  const ids=new Set(),currencies=new Set();
  for(const account of value.accounts){
   if(!plain(account,['id','supplierId','entityId','currency','currentBalanceExact8'])||!desktopSupplierCardId(account.id)||ids.has(account.id)||account.supplierId!==supplierId||account.entityId!==value.entityId||!currency(account.currency)||currencies.has(account.currency)||typeof account.currentBalanceExact8!=='string'||!/^-?(?:0|[1-9]\d{0,19})\.\d{8}$/.test(account.currentBalanceExact8)||account.currentBalanceExact8==='-0.00000000')return false;
   ids.add(account.id);currencies.add(account.currency);
  }
  return currencies.has(value.currency);
 }catch{return false;}
}
