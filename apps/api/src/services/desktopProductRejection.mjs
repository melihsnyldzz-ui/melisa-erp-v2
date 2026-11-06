// Exact wire/journal contract. A rejection is authoritative only when persisted
// under the same locked UUID, actor, operation and normalized body hash.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const reasons=new Set(['PRODUCT_STOCK_CODE_IN_USE','PRODUCT_BARCODE_IN_USE','PRODUCT_BARCODE_DUPLICATE_INPUT']);
function exact(v,keys){return v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value');});}
export function productRejectionRecord(requestId,reason){
 if(typeof requestId!=='string'||!uuid.test(requestId)||!reasons.has(reason))throw Error('PRODUCT_REJECTION_INVALID');
 return Object.freeze({kind:'desktop-product-rejection-v1',requestId,operation:'product.create',reason});
}
export function isProductRejectionRecord(v,requestId){return !!(exact(v,['kind','requestId','operation','reason'])&&v.kind==='desktop-product-rejection-v1'&&typeof v.requestId==='string'&&v.requestId===requestId&&uuid.test(v.requestId)&&v.operation==='product.create'&&reasons.has(v.reason));}
export function productRejectionOutcome(record,replayed){
 if(!isProductRejectionRecord(record,record?.requestId)||typeof replayed!=='boolean')throw Error('PRODUCT_REJECTION_INVALID');
 return Object.freeze({state:'NOT_COMMITTED',requestId:record.requestId,operation:record.operation,reason:record.reason,resolution:'DURABLE_REJECTION',replayed});
}
export function isDurableProductRejection(v,requestId){return !!(exact(v,['state','requestId','operation','reason','resolution','replayed'])&&v.state==='NOT_COMMITTED'&&typeof v.requestId==='string'&&v.requestId===requestId&&uuid.test(v.requestId)&&v.operation==='product.create'&&reasons.has(v.reason)&&v.resolution==='DURABLE_REJECTION'&&typeof v.replayed==='boolean');}
