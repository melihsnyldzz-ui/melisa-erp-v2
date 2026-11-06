// Immutable customer/currency command and durable result; no currency conversion.
export const CUSTOMER_ACCOUNT_OPERATION='customer.account.create';
export const CUSTOMER_ACCOUNT_CURRENCIES=Object.freeze(['TRY','USD','EUR']);
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const id=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
const label=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max&&v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v);
function own(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).length!==keys.length)return false;return keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value');});}
export function desktopCustomerAccountCommand(v){
 const keys=['requestId','customerId','entityId','customerCode','customerName','currency'];
 if(!own(v,keys)||!uuid(v.requestId)||!id(v.customerId)||!id(v.entityId)||!label(v.customerCode,50)||!label(v.customerName,250)||!CUSTOMER_ACCOUNT_CURRENCIES.includes(v.currency))throw Error('CUSTOMER_ACCOUNT_INPUT_INVALID');
 return Object.freeze(Object.fromEntries(keys.map(k=>[k,v[k]])));
}
export function isDesktopCustomerAccount(v,c){return own(v,['id','customerId','entityId','currency','balanceExact8'])&&id(v.id)&&v.customerId===c.customerId&&v.entityId===c.entityId&&v.currency===c.currency&&v.balanceExact8==='0.00000000';}
export function customerAccountRecord(c,account){if(!isDesktopCustomerAccount(account,c))throw Error('CUSTOMER_ACCOUNT_READBACK_INVALID');return Object.freeze({requestId:c.requestId,operation:CUSTOMER_ACCOUNT_OPERATION,state:'COMMITTED',account:Object.freeze({...account})});}
export function customerAccountDuplicateRecord(c){return Object.freeze({requestId:c.requestId,operation:CUSTOMER_ACCOUNT_OPERATION,state:'NOT_COMMITTED',reason:'CUSTOMER_ACCOUNT_EXISTS'});}
export function isCustomerAccountRecord(v,c){
 const state=v&&typeof v==='object'?Object.getOwnPropertyDescriptor(v,'state')?.value:null;
 return own(v,['requestId','operation','state',...(state==='COMMITTED'?['account']:['reason'])])&&v.requestId===c.requestId&&v.operation===CUSTOMER_ACCOUNT_OPERATION&&(state==='COMMITTED'?isDesktopCustomerAccount(v.account,c):state==='NOT_COMMITTED'&&v.reason==='CUSTOMER_ACCOUNT_EXISTS');
}
export function isCustomerAccountOutcome(v,c){const state=v&&typeof v==='object'?Object.getOwnPropertyDescriptor(v,'state')?.value:null;if(!own(v,['requestId','operation','state','replayed',...(state==='COMMITTED'?['account']:['reason'])])||typeof v.replayed!=='boolean')return false;const {replayed,...record}=v;return isCustomerAccountRecord(record,c);}
