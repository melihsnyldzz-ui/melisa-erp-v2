// PR54 cart rule: another read of the same product adds exactly one main unit.
// Price, stock, line limits and permissions remain the caller's responsibility.
export function incrementSalesMainQuantity(value){
 if(typeof value!=='string'||!/^(?:0|[1-9]\d{0,15})\.\d{3}$/.test(value))throw new RangeError('SALE_CART_QUANTITY_INVALID');
 const next=BigInt(value.replace('.',''))+1000n;return next/1000n+'.'+String(next%1000n).padStart(3,'0');
}
