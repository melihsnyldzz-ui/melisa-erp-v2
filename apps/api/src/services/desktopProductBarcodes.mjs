// Native barcodes are strings. Preserve leading zeros and input order.
const fail=()=>{throw Object.assign(Error('PRODUCT_BARCODES_INVALID'),{code:'PRODUCT_BARCODES_INVALID'});};
function barcode(value){if(typeof value!=='string'||!value||value.length>80||value.trim()!==value||/[\u0000-\u001f\u007f]/.test(value))fail();return value;}
export function desktopAdditionalBarcodes(primary,value){
 barcode(primary);
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>10||Reflect.ownKeys(value).length!==value.length+1)fail();
 const result=[];for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))fail();result.push(barcode(d.value));}
 if(new Set([primary,...result]).size!==result.length+1)fail();
 return Object.freeze(result);
}
export function desktopAdditionalBarcodeText(primary,text){
 if(typeof text!=='string'||text.length>1000)fail();
 return desktopAdditionalBarcodes(primary,text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean));
}
