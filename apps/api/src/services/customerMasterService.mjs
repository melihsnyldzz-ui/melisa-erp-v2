import {assertCustomerMasterActor,customerMasterId,customerMasterRequestId,parseCustomerMaster,validateCustomerMasterContext,customerMasterError} from './customerMasterModel.mjs';

// Native contact-only procedures do not authorize master edits. Until an exact
// master writer is registered, the real API fails closed. An injected isolated
// store must atomically bind actor/scope/hold, replay, CAS, unique code and audit.
const unavailable=()=>{throw customerMasterError();};
export function createCustomerMasterService({getStore=unavailable}={}){
 const run=async(id,actor,operation,body)=>{
  assertCustomerMasterActor(actor);const customerId=customerMasterId(id);
  const input=operation==='update'?parseCustomerMaster(customerId,body):operation==='recover'?customerMasterRequestId(body):null;
  const store=await getStore();
  return store.withCustomerMaster({customerId,actor,write:operation==='update'},async session=>{
   const validate=value=>validateCustomerMasterContext(value,{customerId,actorId:actor.id});
   const current=validate(session.context);
   if(operation==='context')return current;
   const result=operation==='update'?await session.update(input):await session.recover(input);
   if(typeof result?.replayed!=='boolean')throw customerMasterError();
   const context=validate(result.context);
   if(context.copyId!==current.copyId||context.sealHash!==current.sealHash||context.currency!==current.currency||context.schemaVersion!==current.schemaVersion||JSON.stringify(context.original)!==JSON.stringify(current.original))throw customerMasterError();
   return operation==='update'?{context,replayed:result.replayed}:{context,committed:result.replayed};
  });
 };
 const query=value=>{if(!value||typeof value!=='object'||Array.isArray(value)||Reflect.ownKeys(value).length)throw customerMasterError('CUSTOMER_VALIDATION_FAILED',400);};
 return Object.freeze({context:(id,actor,q={})=>{query(q);return run(id,actor,'context');},update:(id,body,actor)=>run(id,actor,'update',body),recover:(id,key,actor,q={})=>{query(q);return run(id,actor,'recover',key);}});
}
export const customerMasterService=createCustomerMasterService();
