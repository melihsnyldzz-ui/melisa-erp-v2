import {assertIsolatedCopyContext,copyAssert,isolatedCopyHash,isolatedCopyUUID} from './isolatedOperationCopyContext.mjs';
import {assertPreparedBusinessCollectionHistoryArtifact} from '../../../../scripts/canonical/shared-business-collection-history-sql.mjs';

const keys=['schemaVersion','copyId','sealHash','profileHash','saleRevisionHash','adjunctRevisionHash','readerDefinitionHash','collectorId','creatorId','invoiceId','creationRequestId','creationPayloadHash','pricingHash'];
// Content validation only. Native admission and the fresh restricted transaction
// are separate requirements; this function cannot mint a pricing DTO or reader.
export function validateBusinessCollectionHistoryReadProof(copy,bundle,value,{invoiceId,pricingHash}={}){
 assertIsolatedCopyContext(copy);
 assertPreparedBusinessCollectionHistoryArtifact(bundle?.historyArtifact,copy,'history');
 copyAssert(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join()===keys.toSorted().join(),'COLLECTION_HISTORY_READ_PROOF');
 copyAssert(typeof invoiceId==='string'&&/^[1-9]\d{0,18}$/.test(invoiceId)&&BigInt(invoiceId)<=9223372036854775807n,'COLLECTION_HISTORY_READ_PROOF');
 copyAssert(value.schemaVersion==='melisa-business-collection-history-proof.v1'&&value.copyId===copy.copyId&&value.sealHash===copy.sealHash&&value.profileHash===isolatedCopyHash(copy)&&value.profileHash===bundle.historyArtifact.profileHash&&value.saleRevisionHash===bundle.revision.baseSaleRevisionHash&&value.saleRevisionHash===bundle.historyArtifact.saleRevisionHash&&value.adjunctRevisionHash===bundle.revision.revisionHash&&value.readerDefinitionHash===bundle.historyArtifact.definitionHash,'COLLECTION_HISTORY_READ_PROOF');
 copyAssert(value.collectorId==='16'&&value.creatorId==='15'&&value.invoiceId===invoiceId&&isolatedCopyUUID(value.creationRequestId)&&value.creationRequestId===value.creationRequestId.toLowerCase()&&typeof value.creationPayloadHash==='string'&&/^[A-F0-9]{64}$/.test(value.creationPayloadHash)&&typeof pricingHash==='string'&&/^[A-F0-9]{64}$/.test(pricingHash)&&value.pricingHash===pricingHash,'COLLECTION_HISTORY_READ_PROOF');
 return Object.freeze({...value});
}
