// Source-only journal contract. No SQL, service routes or runtime authority.
import {createHash} from 'node:crypto';
export {prepareDesktopGoodsReceipt,planDesktopGoodsReceiptApproval,planDesktopLinkedPurchase} from '../../../../packages/shared/src/desktopGoodsReceiptModel.mjs';
const fail=()=>{throw Object.assign(Error('DESKTOP_GOODS_JOURNAL_INVALID'),{code:'DESKTOP_GOODS_JOURNAL_INVALID'});};
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
function stable(v,depth=0){
 if(depth>12)fail();if(v===null||typeof v==='boolean'||typeof v==='string')return v;
 if(typeof v==='number'){if(!Number.isSafeInteger(v))fail();return v;}
 if(Array.isArray(v)){if(Object.getPrototypeOf(v)!==Array.prototype||Reflect.ownKeys(v).length!==v.length+1)fail();return Array.from({length:v.length},(_,i)=>{const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))fail();return stable(d.value,depth+1);});}
 if(!v||typeof v!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail();
 const descriptors=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(v);if(keys.some(k=>typeof k!=='string'||!descriptors[k].enumerable||!Object.hasOwn(descriptors[k],'value')))fail();
 return Object.fromEntries(keys.sort().map(k=>[k,stable(descriptors[k].value,depth+1)]));
}
export function desktopGoodsRequestBinding({actorId,operation,body}={}){
 if(!id(actorId)||!['goods_draft','goods_approval','purchase_finalize'].includes(operation)||!body)fail();
 const data=stable({actorId,operation,body});if(!uuid(data.body.requestId))fail();return Object.freeze({requestId:data.body.requestId,actorId,operation,bodyHash:createHash('sha256').update(JSON.stringify(data),'utf8').digest('hex')});
}
// This is a pure decision, not an idempotency guarantee. `new` is meaningful
// only after a store resolves UNKNOWN/concurrent attempts and confirms absence
// in the same SERIALIZABLE transaction that reserves and performs the change.
// No such store/admission is implemented here. An UNKNOWN record never grants
// a second dispatch.
export function desktopGoodsRequestDisposition(binding,record){
 if(!binding||!uuid(binding.requestId)||!id(binding.actorId)||!['goods_draft','goods_approval','purchase_finalize'].includes(binding.operation)||typeof binding.bodyHash!=='string'||!/^[a-f0-9]{64}$/.test(binding.bodyHash))fail();
 if(record===null)return Object.freeze({kind:'new'});
 if(typeof record!=='object'||record.requestId!==binding.requestId||record.actorId!==binding.actorId||record.operation!==binding.operation||record.bodyHash!==binding.bodyHash)fail();
 if(record.state==='pending')return Object.freeze({kind:'unknown_same_request_only'});
 if(record.state!=='committed'||!id(record.entityId))fail();return Object.freeze({kind:'replay',entityId:record.entityId});
}
export const DESKTOP_GOODS_JOURNAL_LIMITS=Object.freeze({sourceOnly:true,requiresAtomicJournal:true,requiresNativePurchaseAdapter:true,requiresLockedSessionAndPermissions:true,realSqlVerified:false});
// The native purchase engine takes stockCode/productName, numeric amounts,
// account selection and a transaction-bound stockAlreadyReceived proof. This
// model deliberately does not manufacture that context or bypass its guard.
export const DESKTOP_GOODS_NATIVE_ADAPTER_REQUIREMENTS=Object.freeze({
 sourceModule:'apps/api/src/services/invoiceDraftService.js',
 draftExport:'createPurchaseDraft',finalizeExport:'finalizePurchaseInvoice',
 receiptProofExport:'assertReceivedPurchaseContext',requiresLockedReceiptLink:true,
 requiresNativeNumericParity:true,requiresAccountPostingReadback:true,implemented:false,
});
