import {createHash} from 'node:crypto';
import {assertCustomerContactActor,parseCustomerContactId,parseCustomerContactRequestId} from './customerContactModel.mjs';

export const CUSTOMER_MASTER_TYPES=Object.freeze(['customer','wholesale','retail','mixed']);
export const customerMasterError=(code='CUSTOMER_MASTER_UNAVAILABLE',statusCode=503)=>Object.assign(new Error('Müşteri kartı bilgileri doğrulanamadı.'),{code,statusCode});
const invalid=()=>customerMasterError('CUSTOMER_VALIDATION_FAILED',400);
const text=(value,max)=>typeof value==='string'&&value.length>0&&value===value.trim()&&value.length<=max&&!/[\u0000-\u001f\u007f-\u009f]/.test(value);
const hash=value=>typeof value==='string'&&/^[A-F0-9]{64}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
export const assertCustomerMasterActor=assertCustomerContactActor;
export const customerMasterId=parseCustomerContactId;
export const customerMasterRequestId=parseCustomerContactRequestId;

// This contract edits the three source-supported master fields only. It grants
// no native authority and cannot change currencies, accounts, holds or balances.
export function parseCustomerMaster(id,body){
 const customerId=customerMasterId(id),keys=['requestId','expectedRevision','customerCode','customerName','customerType'];
 if(!body||![Object.prototype,null].includes(Object.getPrototypeOf(body)))throw invalid();
 const descriptors=Object.getOwnPropertyDescriptors(body),own=Reflect.ownKeys(body);
 if(own.length!==keys.length||own.some(key=>!keys.includes(key))||keys.some(key=>!descriptors[key]?.enumerable||!Object.hasOwn(descriptors[key],'value')))throw invalid();
 const fields=Object.fromEntries(keys.map(key=>[key,descriptors[key].value]));
 if(!uuid(fields.requestId)||!hash(fields.expectedRevision)||!text(fields.customerCode,50)||!text(fields.customerName,250)||!CUSTOMER_MASTER_TYPES.includes(fields.customerType))throw invalid();
 const value={customerId,...fields},payloadJson=JSON.stringify(value);
 return Object.freeze({...value,payloadJson,payloadHash:createHash('sha256').update(payloadJson,'utf16le').digest('hex').toUpperCase()});
}

export function validateCustomerMasterContext(value,{customerId,actorId}={}){
 const keys=['schemaVersion','copyId','sealHash','actorId','customerId','customerCode','customerName','customerType','currency','revision'];
 if(value?.schemaVersion==='melisa-customer-master-context.v2'){keys.push('original');if(Object.keys(value.original??{}).sort().join()!=='customerCode,customerName'||!text(value.original.customerCode,50)||!text(value.original.customerName,250))throw customerMasterError();}
 if(!value||Object.keys(value).sort().join()!==keys.sort().join()||!['melisa-customer-master-context.v1','melisa-customer-master-context.v2'].includes(value.schemaVersion)||!uuid(value.copyId)||!hash(value.sealHash)||value.actorId!==actorId||value.customerId!==customerId||!text(value.customerCode,50)||!text(value.customerName,250)||!CUSTOMER_MASTER_TYPES.includes(value.customerType)||!['TRY','USD','EUR'].includes(value.currency)||!hash(value.revision))throw customerMasterError();
 return Object.freeze({...value});
}
