import {desktopDueDate} from './desktopDueAllocation.mjs';
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const shape=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===names.length&&names.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value');});
const reason=v=>typeof v==='string'&&v===v.trim()&&v.length>=3&&v.length<=500&&!/[\u0000-\u001f\u007f]/.test(v);
const days=v=>Number.isSafeInteger(v)&&v>=0;
const amount=v=>typeof v==='string'&&/^(?:0|[1-9]\d{0,13})\.\d{4}$/.test(v)&&BigInt(v.replace('.',''))>0n;
const invoiceKeys=['invoiceId','expectedVersion','customerId','accountId','currency','documentDate','amountExact4','termsDefinition'];
function invoice(v,requested){
 if(!shape(v,[...invoiceKeys,...(requested?['requestedTermDays','requestedDueDate']:[])])||![v.invoiceId,v.customerId,v.accountId].every(id)||typeof v.expectedVersion!=='string'||!/^0x[A-F0-9]{16}$/.test(v.expectedVersion)||!['TRY','USD','EUR'].includes(v.currency)||!amount(v.amountExact4))return false;
 desktopDueDate(v.documentDate,0);
 if(v.termsDefinition!==null&&(!shape(v.termsDefinition,['termDays','revision'])||!days(v.termsDefinition.termDays)||!hash(v.termsDefinition.revision)))return false;
 if(v.termsDefinition!==null)desktopDueDate(v.documentDate,v.termsDefinition.termDays);
 return !requested||days(v.requestedTermDays)&&v.requestedDueDate===desktopDueDate(v.documentDate,v.requestedTermDays);
}
export function isDesktopDueInvoice(v,invoiceId,version){try{return !!invoice(v,false)&&(!invoiceId||v.invoiceId===invoiceId)&&(!version||v.expectedVersion===version);}catch{return false;}}
export function isDesktopDueRequestSnapshot(v){try{return !!invoice(v,true);}catch{return false;}}
export function normalizeDesktopDueRequest(v){
 if(!shape(v,['requestId','invoiceId','expectedVersion','expectedTermsRevision','requestedTermDays','reason'])||!uuid(v.requestId)||!id(v.invoiceId)||typeof v.expectedVersion!=='string'||!/^0x[A-F0-9]{16}$/.test(v.expectedVersion)||!(v.expectedTermsRevision===null||hash(v.expectedTermsRevision))||!days(v.requestedTermDays)||!reason(v.reason))throw Error('DESKTOP_DUE_EXCEPTION_INVALID');
 return {requestId:v.requestId,invoiceId:v.invoiceId,expectedVersion:v.expectedVersion,expectedTermsRevision:v.expectedTermsRevision,requestedTermDays:v.requestedTermDays,reason:v.reason};
}
export function isDesktopDueRequestList(v,actorId){try{if(!shape(v,['requests','limited','canApprove'])||v.limited!==true||typeof v.canApprove!=='boolean'||!Array.isArray(v.requests)||v.requests.length>50)return false;const seen=new Set();return v.requests.every(r=>{if(!shape(r,['id','actorId','snapshot','reason','status','expiresAt'])||!id(r.id)||seen.has(r.id)||!id(r.actorId)||!isDesktopDueRequestSnapshot(r.snapshot)||!reason(r.reason)||!['PENDING','APPROVED','CONSUMED','EXPIRED','STALE'].includes(r.status)||!Number.isSafeInteger(r.expiresAt)||r.expiresAt<0||r.actorId!==actorId&&(!v.canApprove||r.status!=='PENDING'))return false;seen.add(r.id);return true;});}catch{return false;}}
// V1 remains the exact historic twelve-field record. V2 explicitly preserves
// the account's base terms revision separately from the invoice-only decision.
export function isDesktopInvoiceDueSnapshot(v){try{
 const base=['version','actorId','requestId','invoiceId','customerId','accountId','currency','documentDate','dueDate','termDays','termsRevision','amountExact4'];
 if(!shape(v,[...base,...(v?.version===2?['exception']:[])])||![1,2].includes(v.version)||![v.actorId,v.invoiceId,v.customerId,v.accountId].every(id)||!uuid(v.requestId)||!['TRY','USD','EUR'].includes(v.currency)||!amount(v.amountExact4))return false;
 desktopDueDate(v.documentDate,0);
 if(v.version===1)return v.termDays===null&&v.termsRevision===null&&v.dueDate===null||days(v.termDays)&&hash(v.termsRevision)&&v.dueDate===desktopDueDate(v.documentDate,v.termDays);
 const e=v.exception;
 return days(v.termDays)&&v.dueDate===desktopDueDate(v.documentDate,v.termDays)&&shape(e,['requestRecordId','approvalId','consumeId','snapshotHash','approverId','authorityRevision','approvedAt','expiresAt','baseTermDays'])&&[e.requestRecordId,e.approvalId,e.consumeId,e.approverId].every(id)&&new Set([e.requestRecordId,e.approvalId,e.consumeId]).size===3&&hash(e.snapshotHash)&&hash(e.authorityRevision)&&Number.isSafeInteger(e.approvedAt)&&e.approvedAt>=0&&Number.isSafeInteger(e.expiresAt)&&e.expiresAt-e.approvedAt===600000&&(e.baseTermDays===null?v.termsRevision===null:days(e.baseTermDays)&&hash(v.termsRevision)&&desktopDueDate(v.documentDate,e.baseTermDays)!==undefined);
 }catch{return false;}}
