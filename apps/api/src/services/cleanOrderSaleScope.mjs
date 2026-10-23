import {AsyncLocalStorage} from 'node:async_hooks';
import {assertRegisteredCleanContext} from './cleanSyntheticContext.mjs';
import {isCleanStoreDayMutation} from './cleanStoreDayScope.mjs';
const scope=new AsyncLocalStorage();
const denied=()=>{throw Object.assign(new Error('Satış işlem kapsamı doğrulanamadı.'),{code:'CLEAN_SALE_SCOPE_REQUIRED',statusCode:403});};
export function cleanDirectSaleActorId(transaction,operation,actor){const s=scope.getStore();if(s?.direct!==true)return null;if(!isCleanOrderSaleMutation()||s.transaction!==transaction||s.operation!==operation||s.actorId!==Number(actor?.id))denied();return s.actorId;}
export function isCleanOrderSaleMutation(){
 const s=scope.getStore();if(!s)return false;
 assertRegisteredCleanContext();
 if(s.direct===true){if(process.env.API_PORT!=='4194'||process.env.MELISA_CLEAN_SALES!=='20261022'||!s.transaction||!['sale_draft','sale_finalize'].includes(s.operation)||s.actorId!==10018)denied();return true;}
 if(process.env.API_PORT!=='4194'||process.env.MELISA_CLEAN_SALES!=='20261022'||!s.transaction||!['convert','finalize'].includes(s.operation)||!Number.isSafeInteger(s.orderId)||s.orderId<1)denied();
 return true;
}
// Native admission, not a client capability, creates this transaction scope.
export async function withCleanDirectSaleMutation(binding,execute){
 if(scope.getStore()||isCleanStoreDayMutation()||typeof execute!=='function'||!binding?.transaction||!binding.driver||binding.actorId!==10018||!['sale_draft','sale_finalize'].includes(binding.operation))denied();
 assertRegisteredCleanContext();
 const {driver:q,transaction:tx}=binding;
 const accepted=(await new q.Request(tx).input('actor_id',q.BigInt,binding.actorId).input('operation',q.NVarChar(20),binding.operation).input('request_id',q.UniqueIdentifier,binding.requestId).input('payload_hash',q.Char(64),binding.payloadHash).input('payload_json',q.NVarChar(q.MAX),binding.payloadJson).input('preview_json',q.NVarChar(q.MAX),binding.previewJson).input('invoice_id',q.BigInt,binding.invoiceId).execute('dbo.usp_clean_direct_sale_bind')).recordset?.[0];
 const verify=(row,key)=>{if(row?.[key]!==true||String(row.actorId)!==String(binding.actorId)||row.operation!==binding.operation||row.requestId!==binding.requestId||row.payloadHash!==binding.payloadHash.toLowerCase())denied();};verify(accepted,'accepted');
 return scope.run(Object.freeze({...binding,direct:true}),async()=>{isCleanOrderSaleMutation();const result=await execute();const checked=(await new q.Request(tx).execute('dbo.usp_clean_direct_sale_finish')).recordset?.[0];verify(checked,'verified');return result;});
}
export async function withCleanOrderSaleMutation(binding,fn){
 if(scope.getStore()||isCleanStoreDayMutation()||!binding?.transaction||!['convert','finalize'].includes(binding.operation)||!Number.isSafeInteger(binding.orderId)||binding.orderId<1||typeof fn!=='function')denied();
 return scope.run(Object.freeze({...binding}),async()=>{isCleanOrderSaleMutation();return fn();});
}
