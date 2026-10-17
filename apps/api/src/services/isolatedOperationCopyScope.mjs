import {AsyncLocalStorage} from 'node:async_hooks';
import {assertIsolatedCopyContext,assertIsolatedCopyIdentity,assertIsolatedCopyReadProof,copyAssert} from './isolatedOperationCopyContext.mjs';
const scope=new AsyncLocalStorage();
// Only a same-transaction owner-procedure proof unlocks the existing native
// entrypoints. A returned DTO or an arbitrary JSON object is never a grant.
export async function withIsolatedOperationCopyScope({context,identity,transaction,readProof,write=false},operation){
 assertIsolatedCopyContext(context);assertIsolatedCopyIdentity(context,identity);assertIsolatedCopyReadProof(context,readProof);
 copyAssert(transaction&&typeof operation==='function','ISOLATED_COPY_TRANSACTION_REQUIRED');
 const parent=scope.getStore();copyAssert(!parent||parent.active&&parent.transaction===transaction&&parent.context===context&&parent.write===write,'ISOLATED_COPY_NESTED_TRANSACTION');
 const value={context,transaction,identity,active:true,write};
 try{return await scope.run(value,operation);}finally{value.active=false;}
}
export function isIsolatedOperationCopyMutation(runtime,transaction){
 const v=scope.getStore(),t=v?.context.target;
 return !!(v?.active&&v.write&&(!transaction||transaction===v.transaction)&&runtime?.database===t.database&&runtime.server===t.server&&runtime.user===t.login&&runtime.readOnly===false);
}
export function isolatedCopyTransactionContext(transaction,{writeRequired=true}={}){const v=scope.getStore();copyAssert(v?.active&&(!writeRequired||v.write)&&v.transaction===transaction,'ISOLATED_COPY_TRANSACTION_REQUIRED');return v.context;}
export function isIsolatedCopyProduct(id,transaction){const v=scope.getStore();return !!(v?.active&&v.write&&v.transaction===transaction&&v.context.products.some(p=>p.id===String(id)));}
export function isIsolatedCopyCustomer(id,currency,transaction){const v=scope.getStore();return !!(v?.active&&v.write&&v.transaction===transaction&&v.context.customers.some(p=>p.id===String(id)&&p.currency===currency));}

export function normalizeIsolatedCopyCountLines(input,products){
 const fail=(code,message,statusCode=400)=>{throw Object.assign(new Error(message),{code,statusCode});};
 if(!Array.isArray(input)||input.length<1||input.length>2)fail('COUNT_LINES','Bir veya iki kapsam ürünü sayın.');
 const seen=new Set();return input.map(line=>{const p=products.find(p=>p.id===String(line.productId));if(!p||p.stockCode!==line.stockCode||seen.has(p.id)||Object.keys(line).some(k=>!['productId','stockCode','physical','system','reason','movementFingerprint'].includes(k)))fail('COUNT_PRODUCT_SCOPE','Sayım ürünü kapsam dışında.',403);seen.add(p.id);
 if(!Number.isSafeInteger(line.physical)||line.physical<0||!Number.isSafeInteger(line.system)||line.system<0||Math.abs(line.physical-line.system)>5)fail('COUNT_QUANTITY','Sayım farkı ayrılmış prova kapsamını aşıyor.');
 if(typeof line.movementFingerprint!=='string'||! /^[a-f0-9]{64}$/i.test(line.movementFingerprint))fail('COUNT_FINGERPRINT','Stok kontrolü yenilenmeli.',409);
 const reason=typeof line.reason==='string'?line.reason.trim():'';if(line.physical!==line.system&&(reason.length<3||reason.length>500))fail('COUNT_REASON','Fark gerekçesi gerekli.');return{productId:p.id,stockCode:p.stockCode,physical:line.physical,system:line.system,reason,fingerprint:line.movementFingerprint};});
}
