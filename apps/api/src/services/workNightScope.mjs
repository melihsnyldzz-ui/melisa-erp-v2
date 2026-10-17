import {AsyncLocalStorage} from 'node:async_hooks';
const scope=new AsyncLocalStorage();
const fail=()=>{throw Object.assign(new Error('İşlem kapsamı doğrulanamadı.'),{statusCode:503,code:'WORK_SCOPE_UNAVAILABLE'});};
// Only the guarded server store supplies this proof after owner-procedure and
// current native row checks in the same open transaction. Never accept it from JSON.
export function withWorkNightScope(proof,operation){
 if(proof?.database!=='MELISA_ERP_SIRKET_TEST_20260929_01'||proof.server!=='Semih\\MELISADEV'||!proof.transaction||proof.validated!==true||!Array.isArray(proof.products)||proof.products.length!==2)fail();
 const ids=new Set();
 for(const product of proof.products){
  if(typeof product.id!=='string'||!/^[1-9]\d*$/.test(product.id)||product.synthetic!==true||product.writeEligible!==true||product.unit?.label!=='ADET'||product.unit.factorExact8!=='1.00000000'||ids.has(product.id))fail();
  ids.add(product.id);
 }
 return scope.run(Object.freeze({ids,transaction:proof.transaction}),operation);
}
export const isWorkNightProduct=(id,transaction)=>{const proof=scope.getStore();return !!transaction&&proof?.transaction===transaction&&proof.ids.has(String(id));};
