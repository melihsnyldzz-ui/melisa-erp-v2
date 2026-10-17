// Server-only failure metadata. No error mutation, SQL text, request data or IO.
export const SELECTED_SALE_DIAGNOSTIC_CALLS=Object.freeze([
 'selectedSale.transaction','selectedSale.writeScope',
 'invoice.finalize','invoice.post','invoice.refresh','invoice.read',
]);
const calls=new Set(SELECTED_SALE_DIAGNOSTIC_CALLS),failures=new WeakMap();
const object=value=>value!==null&&(typeof value==='object'||typeof value==='function');
const own=(value,key)=>{try{if(!object(value))return undefined;const d=Object.getOwnPropertyDescriptor(value,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;}catch{return undefined;}};
export const isSelectedSaleDiagnosticCall=value=>typeof value==='string'&&calls.has(value);
export function selectedSaleSqlStateCode(error){
 const original=own(error,'originalError'),info=own(original,'info');
 for(const source of [error,original,info])for(const key of ['sqlstate','sqlState','state']){
  const value=own(source,key);if(typeof value==='string'&&/^[0-9A-Z]{5}$/.test(value))return value;
 }
 return null;
}
export function selectedSaleSqlDiagnostics(error){
 const value=object(error)?failures.get(error):null,state=selectedSaleSqlStateCode(error);
 return {...(state===null?{}:{sqlStateCode:state}),...(value??{})};
}
export async function selectedSaleDiagnosticProbe(call,fn){
 if(!isSelectedSaleDiagnosticCall(call)||typeof fn!=='function')throw new TypeError('Invalid diagnostic call');
 const started=performance.now();
 try{return await fn();}catch(error){
  if(object(error)&&!failures.has(error)){
   const elapsed=Math.floor(performance.now()-started);
   failures.set(error,Object.freeze({sqlCall:call,...(Number.isSafeInteger(elapsed)&&elapsed>=0&&elapsed<=86400000?{sqlCallDurationMs:elapsed}:{})}));
  }
  throw error;
 }
}
