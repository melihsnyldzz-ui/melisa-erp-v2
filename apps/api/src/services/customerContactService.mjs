import {assertCustomerContactActor,parseCustomerContactId,parseCustomerContact,parseCustomerContactRequestId} from './customerContactModel.mjs';
import {customerContactContext,customerContactError} from './customerContactStore.mjs';

export function createCustomerContactService({getStore=()=>import('./customerContactStore.mjs').then(module=>module.customerContactStore)}={}){
 const execute=async(id,actor,body,write)=>{
  assertCustomerContactActor(actor);const customerId=parseCustomerContactId(id),input=write?parseCustomerContact(customerId,body):null,store=await getStore();
  return store.withCustomerContact({customerId,actor,write},async session=>{
   const current=customerContactContext(session.copy,session.context,customerId);
   if(!write)return current;
   // The owner resolves historical UUID replay before CAS. Do not compare an
   // old successful request's expectedRevision against the current GET here.
   const result=await session.update(input.payloadJson);
   if(typeof result?.replayed!=='boolean')throw customerContactError();
   return Object.freeze({context:customerContactContext(session.copy,result.context,customerId),replayed:result.replayed});
  });
 };
 return Object.freeze({recover:async(id,requestId,actor,query={})=>{
  assertCustomerContactActor(actor);const customerId=parseCustomerContactId(id),key=parseCustomerContactRequestId(requestId);
  if(!query||typeof query!=='object'||Array.isArray(query)||Reflect.ownKeys(query).length)throw customerContactError('CUSTOMER_VALIDATION_FAILED',400);
  const store=await getStore();return store.withCustomerContact({customerId,actor,write:false},async session=>{const result=await session.recover(key);if(typeof result?.replayed!=='boolean')throw customerContactError();return Object.freeze({committed:result.replayed,context:customerContactContext(session.copy,result.context,customerId)});});
 },context:async(id,actor,query={})=>{assertCustomerContactActor(actor);parseCustomerContactId(id);if(!query||typeof query!=='object'||Array.isArray(query)||Reflect.ownKeys(query).length)throw customerContactError('CUSTOMER_VALIDATION_FAILED',400);return execute(id,actor,null,false);},update:(id,body,actor)=>execute(id,actor,body,true)});
}
export const customerContactService=createCustomerContactService();

