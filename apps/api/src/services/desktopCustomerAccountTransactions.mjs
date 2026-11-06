import {createHash} from 'node:crypto';
import {desktopCustomerAccountCommand,CUSTOMER_ACCOUNT_OPERATION,isCustomerAccountOutcome} from '../../../../packages/shared/src/desktopCustomerAccount.mjs';
export function createDesktopCustomerAccountTransactions({store,authorize,onFailure=()=>{}}={}){
 if(typeof store?.create!=='function'||typeof authorize!=='function'||typeof onFailure!=='function')throw Error('CUSTOMER_ACCOUNT_CONFIGURATION');
 return Object.freeze({async createCustomerAccount(actorId,input){
  const d=input&&typeof input==='object'?Object.getOwnPropertyDescriptor(input,'requestId'):null,requestId=d&&Object.hasOwn(d,'value')&&typeof d.value==='string'?d.value:null;
  const unknown=()=>Object.freeze({state:'UNKNOWN',requestId,retry:'SAME_REQUEST_ONLY',requiresRecovery:true});
  try{
   const command=desktopCustomerAccountCommand(input);
   if(typeof actorId!=='string'||!/^[1-9]\d{0,18}$/.test(actorId)||BigInt(actorId)>9223372036854775807n||await authorize({actorId,permission:'customer.edit'})!==true)return unknown();
   const payloadHash=createHash('sha256').update(JSON.stringify({operation:CUSTOMER_ACCOUNT_OPERATION,actorId,payload:command})).digest('hex');
   const result=await store.create({actorId,command,payloadHash});
   if(!isCustomerAccountOutcome(result,command))return unknown();return Object.freeze(result);
  }catch(error){try{onFailure({requestId,error});}catch{}return unknown();}
 }});
}
