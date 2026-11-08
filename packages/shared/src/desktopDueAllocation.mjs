// Pure DES-07 calculation. No account authority, persistence or posting is issued.
const fail=()=>{throw Error('DESKTOP_DUE_ALLOCATION_INVALID');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
function shape(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).length!==keys.length||keys.some(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !d?.enumerable||!Object.hasOwn(d,'value');}))fail();}
function calendar(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))fail();const [y,m,d]=value.split('-').map(Number),x=new Date(Date.UTC(y,m-1,d));if(y<1900||x.getUTCFullYear()!==y||x.getUTCMonth()!==m-1||x.getUTCDate()!==d)fail();return x;}
function amount(value){if(typeof value!=='string'||!/^(?:0|[1-9]\d{0,13})\.\d{4}$/.test(value))fail();return BigInt(value.replace('.',''));}
const fixed=n=>{if(n<0n||n>=10n**18n)fail();const s=n.toString().padStart(5,'0');return s.slice(0,-4)+'.'+s.slice(-4);};
export function desktopDueDate(documentDate,termDays){const date=calendar(documentDate);if(termDays===null)return null;if(!Number.isSafeInteger(termDays)||termDays<0)fail();date.setUTCDate(date.getUTCDate()+termDays);if(!Number.isFinite(date.getTime())||date.getUTCFullYear()>9999)fail();return date.toISOString().slice(0,10);}
export function desktopAllocateEarliestDue(input){
 shape(input,['customerId','accountId','currency','amountExact4','invoices']);const {customerId,accountId,currency,amountExact4,invoices}=input;
 if(!id(customerId)||!id(accountId)||typeof currency!=='string'||!/^[A-Z]{3}$/.test(currency)||!Array.isArray(invoices)||invoices.length>10000)fail();
 const requested=amount(amountExact4);if(requested<=0n)fail();const ids=new Set(),ordered=invoices.map(row=>{shape(row,['invoiceId','customerId','accountId','currency','documentDate','dueDate','remainingExact4']);if(!id(row.invoiceId)||ids.has(row.invoiceId)||row.customerId!==customerId||row.accountId!==accountId||row.currency!==currency)fail();ids.add(row.invoiceId);calendar(row.documentDate);calendar(row.dueDate);if(row.dueDate<row.documentDate)fail();const remaining=amount(row.remainingExact4);return {...row,remaining};}).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||a.documentDate.localeCompare(b.documentDate)||(BigInt(a.invoiceId)<BigInt(b.invoiceId)?-1:1));
 let left=requested;const rows=ordered.map(row=>{const allocated=left<row.remaining?left:row.remaining;left-=allocated;return Object.freeze({invoiceId:row.invoiceId,documentDate:row.documentDate,dueDate:row.dueDate,beforeExact4:row.remainingExact4,allocatedExact4:fixed(allocated),remainingExact4:fixed(row.remaining-allocated)});});
 // The posting owner must reject a nonzero unallocated amount until an advance
 // policy is explicitly supported; this calculation never invents that policy.
 return Object.freeze({customerId,accountId,currency,amountExact4,allocatedExact4:fixed(requested-left),unallocatedExact4:fixed(left),rows:Object.freeze(rows)});
}
