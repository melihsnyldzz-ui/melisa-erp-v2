// Pure readonly card contract shared by SQL and normal GUI consumers.
import {isDesktopProductOpening} from './desktopProductOpening.mjs';
import {isDesktopProductUnits} from './desktopSeriesUnits.mjs';
import {isDesktopStockAvailability} from './desktopStockAvailability.mjs';
const keys=['id','stockCode','name','brand','category','unit','currency','salePriceExact4','purchasePriceExact4','purchaseDiscountRateExact4','averageCostTryExact4','currentStockExact3','supplierId','supplierName','isActive','barcodes'];
function exact(v,names){return !!(v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===names.length&&names.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value');}));}
export const desktopProductCardId=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
const text=(v,n)=>typeof v==='string'&&v.length>0&&v.length<=n&&!/[\u0000-\u001f\u007f]/.test(v);
const money=v=>typeof v==='string'&&/^(?:0|[1-9]\d{0,13})\.\d{4}$/.test(v);
export function isDesktopProductCard(v,id){
 const stockFields=['reservedExact3','availableExact3'].some(k=>Object.hasOwn(v??{},k))?['reservedExact3','availableExact3']:[];
 if(!exact(v,[...keys,...['stockOpening','units'].filter(k=>Object.hasOwn(v??{},k)),...stockFields])||stockFields.length&&!isDesktopStockAvailability(v)||!desktopProductCardId(id)||v.id!==id||!text(v.stockCode,50)||!text(v.name,250)||!text(v.unit,20)||typeof v.currency!=='string'||!/^[A-Z]{3}$/.test(v.currency)||typeof v.isActive!=='boolean'||Object.hasOwn(v,'stockOpening')&&!isDesktopProductOpening(v.stockOpening,id)||Object.hasOwn(v,'units')&&!isDesktopProductUnits(v.units,id,v.unit))return false;
 if(!['brand','category'].every(k=>v[k]===null||text(v[k],120))||!(v.supplierId===null||desktopProductCardId(v.supplierId))||!(v.supplierName===null||text(v.supplierName,250))||!['salePriceExact4','purchasePriceExact4','purchaseDiscountRateExact4','averageCostTryExact4'].every(k=>money(v[k]))||BigInt(v.purchaseDiscountRateExact4.replace('.',''))>1000000n||typeof v.currentStockExact3!=='string'||!/^\-?(?:0|[1-9]\d{0,14})\.\d{3}$/.test(v.currentStockExact3))return false;
 if(!Array.isArray(v.barcodes)||v.barcodes.length>100||v.barcodes.some(b=>!exact(b,['id','productId','barcode','type','isPrimary'])||!desktopProductCardId(b.id)||b.productId!==id||!text(b.barcode,80)||!['primary','extra','package'].includes(b.type)||typeof b.isPrimary!=='boolean'||b.isPrimary!==(b.type==='primary')))return false;
 return new Set(v.barcodes.map(b=>b.id)).size===v.barcodes.length&&new Set(v.barcodes.map(b=>b.barcode)).size===v.barcodes.length&&v.barcodes.filter(b=>b.isPrimary).length<=1;
}
