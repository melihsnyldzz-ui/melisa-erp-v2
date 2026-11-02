import {createHash} from 'node:crypto';
import {customerMasterError,CUSTOMER_MASTER_TYPES} from './customerMasterModel.mjs';
const proofs=new WeakMap();
const hash=value=>createHash('sha256').update(JSON.stringify(value),'utf16le').digest('hex').toUpperCase();
const check=ok=>{if(!ok)throw customerMasterError();};
const text=(v,n)=>typeof v==='string'&&v.length>0&&v===v.trim()&&v.length<=n&&!/[\u0000-\u001f\u007f-\u009f]/.test(v);
// Amounts/contact revision are intentionally outside stable source identity.
// Fresh read DTO validation remains responsible for balance/ledger confidence.
export function customerMasterIdentity(raw,scope,baseType){
 const c=raw?.customer;check(c&&c.id===scope.customerId&&CUSTOMER_MASTER_TYPES.includes(baseType)&&text(c.customerCode,50)&&text(c.customerName,250)&&typeof c.partyEntityId==='string'&&typeof c.sourceRecordKey==='string');
 check(/^[1-9]\d*$/.test(c.partyEntityId)&&/^VEGA2026\/F0102TBLCARI\/[1-9]\d*$/.test(c.sourceRecordKey));
 check(Array.isArray(raw.nativeAccounts)&&raw.nativeAccounts.length>0&&raw.nativeAccounts.every(a=>/^[1-9]\d*$/.test(a.id)&&a.customerId===c.id&&a.nativeOwnerCustomerId===c.id&&a.partyEntityId===c.partyEntityId&&['TRY','USD','EUR'].includes(a.currency)&&text(a.sourceAccountKey,250)));
 const identity={copyId:scope.copyId,sealHash:scope.sealHash,customerId:c.id,partyEntityId:c.partyEntityId,sourceRecordKey:c.sourceRecordKey,customerCode:c.customerCode,customerName:c.customerName,customerType:baseType,currency:c.currency,accounts:raw.nativeAccounts.map(a=>({accountId:a.id,currency:a.currency,partyEntityId:a.partyEntityId,sourceAccountKey:a.sourceAccountKey})).sort((a,b)=>BigInt(a.accountId)<BigInt(b.accountId)?-1:1)};
 check(new Set(identity.accounts.map(a=>a.accountId)).size===identity.accounts.length&&new Set(identity.accounts.map(a=>a.currency)).size===identity.accounts.length);
 return {identity,identityHash:hash(identity)};
}
export function customerMasterRevision(sourceRevision,localVersion,identityHash){check(/^[A-F0-9]{64}$/.test(sourceRevision)&&Number.isSafeInteger(localVersion)&&localVersion>=0&&/^[A-F0-9]{64}$/.test(identityHash));return createHash('sha256').update(`${sourceRevision}|${localVersion}|${identityHash}`,'utf16le').digest('hex').toUpperCase();}
export function validateMasterProjection(row,scope,identityHash){
 check(row&&Object.keys(row).sort().join()==='copyId,customerCode,customerId,customerName,customerType,identityHash,version'&&row.copyId===scope.copyId&&row.customerId===scope.customerId&&row.identityHash===identityHash&&text(row.customerCode,50)&&text(row.customerName,250)&&CUSTOMER_MASTER_TYPES.includes(row.customerType)&&Number.isSafeInteger(row.version)&&row.version>=1);return Object.freeze({...row});
}
// Server-only read receipt. A JSON verified:true flag or cloned object is never
// a receipt. The SQL adapter binds it only after a coherent, validated read.
export function bindCustomerMasterProjection(raw,{scope,baseType,projection,sourceRevision,transactionId}){
 check(typeof transactionId==='string'&&/^[1-9]\d*$/.test(transactionId)&&!Object.hasOwn(raw,'masterProjection'));
 check(raw?.customer?.id===scope.customerId);
 const identityHash=projection===null?null:customerMasterIdentity(raw,scope,baseType).identityHash,row=projection===null?null:validateMasterProjection(projection,scope,identityHash);
 raw.masterProjection={schemaVersion:'melisa-customer-master-read.v1'};
 check(/^[A-F0-9]{64}$/.test(sourceRevision));
 const receipt={snapshot:hash(raw),scope:{...scope},identityHash,sourceRevision,transactionId,row,baseType,committed:false};
 proofs.set(raw,receipt);return Object.freeze({commit(){receipt.committed=true;},revoke(){proofs.delete(raw);}});
}
export function applyCustomerMasterProjection(raw,dto){
 if(!Object.hasOwn(raw,'masterProjection'))return dto;
 const proof=proofs.get(raw);check(proof?.committed===true&&proof.snapshot===hash(raw)&&dto.id===proof.scope.customerId);
 if(proof.row===null)return dto;
 check(dto.source.status==='accepted-opening'&&dto.quarantine.blocked===false&&dto.accounts.length>0&&dto.accounts.every(a=>a.reconciled===true&&a.balanceExact!==null));
 return {...dto,customerCode:proof.row.customerCode,customerName:proof.row.customerName,customerType:proof.row.customerType,masterIdentity:{schemaVersion:'melisa-customer-master-identity.v1',customerId:dto.id,customerCode:raw.customer.customerCode,customerName:raw.customer.customerName}};
}
