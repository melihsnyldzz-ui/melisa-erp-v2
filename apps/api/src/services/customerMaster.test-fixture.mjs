import {createHash} from 'node:crypto';
import {assertCustomerMasterActor,customerMasterError} from './customerMasterModel.mjs';
export const masterActor=Object.freeze({id:17,permissions:['customer.view','customer.edit']});
export const masterCopyId='12345678-1234-4234-8234-123456789012';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').toUpperCase();
// An explicit in-memory fixture, never selected by runtime configuration or API.
// Its atomicity/replay result is not evidence of a native SQL writer.
export function customerMasterFixture(){
 let rows=[{id:'155',customerCode:'OFFLINE-155',customerName:'Örnek Müşteri',customerType:'customer',currency:'TRY',phone:'001000000',city:'İstanbul',country:'Türkiye',sourceKey:'OFFLINE-155',blocked:false,accounts:[{currency:'TRY',balanceExact:'15.12500000',direction:'B'},{currency:'USD',balanceExact:'5.00000000',direction:'A'}],version:1},{id:'156',customerCode:'OFFLINE-156',customerName:'Diğer Müşteri',customerType:'retail',currency:'EUR',blocked:false,accounts:[],version:1}],journal=new Map(),writes=0,tail=Promise.resolve(),failCommit=false;
 const context=(row,actor)=>({schemaVersion:'melisa-customer-master-context.v1',copyId:masterCopyId,sealHash:'C'.repeat(64),actorId:actor.id,customerId:row.id,customerCode:row.customerCode,customerName:row.customerName,customerType:row.customerType,currency:row.currency,revision:digest(row)});
 const store={async withCustomerMaster({customerId,actor},callback){
  const before=tail;let unlock;tail=new Promise(resolve=>{unlock=resolve;});await before;
  try{assertCustomerMasterActor(actor);const transaction=structuredClone(rows),row=transaction.find(r=>r.id===customerId),nextJournal=new Map(journal);let changed=false;
   if(!row||row.blocked)throw customerMasterError('CUSTOMER_MASTER_FORBIDDEN',403);
   const session={context:context(row,actor),async update(input){
    const key=actor.id+'/'+input.requestId,prior=nextJournal.get(key);
    if(prior){if(prior.payloadHash!==input.payloadHash)throw customerMasterError('CUSTOMER_MASTER_REQUEST_CONFLICT',409);return {context:context(row,actor),replayed:true};}
    if(input.expectedRevision!==context(row,actor).revision)throw customerMasterError('CUSTOMER_MASTER_STALE',409);
    if(transaction.some(other=>other.id!==row.id&&other.customerCode.toUpperCase()===input.customerCode.toUpperCase()))throw customerMasterError('CUSTOMER_MASTER_CODE_CONFLICT',409);
    row.customerCode=input.customerCode;row.customerName=input.customerName;row.customerType=input.customerType;row.version++;changed=true;
    nextJournal.set(key,{customerId,payloadHash:input.payloadHash});return {context:context(row,actor),replayed:false};
   },async recover(key){const prior=nextJournal.get(actor.id+'/'+key);if(prior&&prior.customerId!==customerId)throw customerMasterError('CUSTOMER_MASTER_REQUEST_CONFLICT',409);return {context:context(row,actor),replayed:!!prior};}};
   const result=await callback(session);if(failCommit)throw customerMasterError();rows=transaction;journal=nextJournal;if(changed)writes++;return result;
  }finally{unlock();}
 }};
 return {store,snapshot:()=>structuredClone({rows,journal:[...journal],writes}),change:(id,fields)=>Object.assign(rows.find(r=>r.id===id),fields),failNextCommit:value=>{failCommit=value;}};
}
