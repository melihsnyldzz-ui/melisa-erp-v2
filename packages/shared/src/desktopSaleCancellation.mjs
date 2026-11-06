const fail=()=>{throw Error('DESKTOP_SALE_CANCELLATION_INVALID');};
export function desktopSaleCancellationReason(value){
 // The current schema stores nvarchar(250), measured in UTF-16 code units.
 if(typeof value!=='string'||value.length<1||value.length>250||value.trim()!==value||/[\u0000-\u001f\u007f]/.test(value))fail();return value;
}
export function normalizeDesktopSaleCancellation(raw){
 const keys=['requestId','invoiceId','expectedVersion','reason'];
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||![Object.prototype,null].includes(Object.getPrototypeOf(raw)))fail();
 const d=Object.getOwnPropertyDescriptors(raw);
 if(Reflect.ownKeys(raw).length!==keys.length||keys.some(k=>!d[k]?.enumerable||!Object.hasOwn(d[k],'value')))fail();
 const value=Object.fromEntries(keys.map(k=>[k,d[k].value]));
 if(typeof value.requestId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.requestId)||typeof value.invoiceId!=='string'||! /^[1-9]\d{0,15}$/.test(value.invoiceId)||BigInt(value.invoiceId)>9007199254740991n||typeof value.expectedVersion!=='string'||!/^0x[0-9A-F]{16}$/.test(value.expectedVersion))fail();
 desktopSaleCancellationReason(value.reason);return Object.freeze(value);
}
