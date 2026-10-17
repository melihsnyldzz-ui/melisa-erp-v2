import {createHash} from 'node:crypto';

// Pure preparation only: these validators confer no DB02/native write scope.
// The source customers DDL uses phone NVARCHAR(50), city/country NVARCHAR(100).
// Keep phone within the existing updater's narrower 40-character parameter.
export const CUSTOMER_CONTACT_LIMITS=Object.freeze({phone:40,city:100,country:100});
export function parseCustomerContactRequestId(value){
 if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value))throw invalid();
 return value;
}
const bodyKeys=['requestId','expectedRevision','phone','city','country'];
const error=(code,message,statusCode)=>Object.assign(new Error(message),{code,statusCode});
const invalid=()=>error('CUSTOMER_VALIDATION_FAILED','Telefon, şehir, ülke ve düzenleme bilgilerini kontrol edin.',400);

export function parseCustomerContactId(value){
 if(typeof value!=='string'||!/^[1-9]\d{0,18}$/.test(value)||BigInt(value)>9223372036854775807n)throw error('CUSTOMER_ID_INVALID','Müşteri kimliği geçersiz.',400);
 return value;
}

// authService.toUserDto supplies a numeric ID and the current user's expanded
// string array; role names, aliases and request-body permissions do not replace
// these fields. This shape check grants no native scope: a future store must
// independently recheck the authenticated user and native authority.
export function assertCustomerContactActor(actor){
 const permissions=actor?.permissions;
 if(!actor||typeof actor!=='object'||Array.isArray(actor)||!Number.isSafeInteger(actor.id)||actor.id<1||!Array.isArray(permissions)||!permissions.every(p=>typeof p==='string')||!permissions.includes('customer.view')||!permissions.includes('customer.edit'))throw error('AUTH_PERMISSION_DENIED','Müşteri iletişim bilgilerini düzenleme yetkiniz yok.',403);
}

function ownBody(body){
 try{
  if(!body||typeof body!=='object'||Array.isArray(body)||![Object.prototype,null].includes(Object.getPrototypeOf(body)))throw invalid();
  const keys=Reflect.ownKeys(body),descriptors=Object.getOwnPropertyDescriptors(body);
  if(keys.length!==bodyKeys.length||keys.some(k=>typeof k!=='string'||!bodyKeys.includes(k))||bodyKeys.some(k=>!descriptors[k]||!Object.hasOwn(descriptors[k],'value')||descriptors[k].enumerable!==true))throw invalid();
  return Object.fromEntries(bodyKeys.map(k=>[k,descriptors[k].value]));
 }catch{throw invalid();}
}

export function parseCustomerContact(customerId,body){
 const id=parseCustomerContactId(customerId),fields=ownBody(body);
 if(typeof fields.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fields.requestId)||typeof fields.expectedRevision!=='string'||!/^[0-9a-f]{64}$/i.test(fields.expectedRevision))throw invalid();
 for(const [key,max] of Object.entries(CUSTOMER_CONTACT_LIMITS)){
  const value=fields[key];
  if(value!==null&&(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f-\u009f]/.test(value)))throw invalid();
 }
 // customerCardModel uses maskPhone, whose masked representation contains '*'.
 if(fields.phone!==null&&fields.phone.includes('*'))throw invalid();
 const input={customerId:id,requestId:fields.requestId.toLowerCase(),expectedRevision:fields.expectedRevision.toUpperCase(),phone:fields.phone,city:fields.city,country:fields.country};
 const payloadJson=JSON.stringify(input),payloadHash=createHash('sha256').update(payloadJson,'utf16le').digest('hex').toUpperCase();
 return Object.freeze({...input,payloadJson,payloadHash});
}

