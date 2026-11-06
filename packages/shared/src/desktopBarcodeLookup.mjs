import {desktopProductCardId} from './desktopProductCard.mjs';
import {isDesktopStockAvailability} from './desktopStockAvailability.mjs';
const plain=(v,keys)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value');});
const text=(v,n)=>typeof v==='string'&&v.length>0&&v.length<=n&&v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v);
export const isDesktopBarcode=value=>text(value,100);
export function isDesktopBarcodeLookup(value,barcode){
 return isDesktopBarcode(barcode)&&plain(value,['barcode','product'])&&value.barcode===barcode&&plain(value.product,['id','stockCode','productName','unit','currentStockExact3','reservedExact3','availableExact3'])&&desktopProductCardId(value.product.id)&&text(value.product.stockCode,100)&&text(value.product.productName,250)&&text(value.product.unit,50)&&isDesktopStockAvailability(value.product);
}
