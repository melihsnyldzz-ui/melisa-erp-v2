import {AsyncLocalStorage} from 'node:async_hooks';
import {assertRegisteredCleanContext} from './cleanSyntheticContext.mjs';
const scope=new AsyncLocalStorage();
const denied=()=>{throw Object.assign(new Error('Satış işlem kapsamı doğrulanamadı.'),{code:'CLEAN_SALE_SCOPE_REQUIRED',statusCode:403});};
export function isCleanOrderSaleMutation(){
 const s=scope.getStore();if(!s)return false;
 assertRegisteredCleanContext();
 if(process.env.API_PORT!=='4194'||process.env.MELISA_CLEAN_SALES!=='20261022'||!s.transaction||!['convert','finalize'].includes(s.operation)||!Number.isSafeInteger(s.orderId)||s.orderId<1)denied();
 return true;
}
export async function withCleanOrderSaleMutation(binding,fn){
 if(scope.getStore()||!binding?.transaction||!['convert','finalize'].includes(binding.operation)||!Number.isSafeInteger(binding.orderId)||binding.orderId<1||typeof fn!=='function')denied();
 return scope.run(Object.freeze({...binding}),async()=>{isCleanOrderSaleMutation();return fn();});
}
