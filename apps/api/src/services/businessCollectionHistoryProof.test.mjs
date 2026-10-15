import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionHistoryCompilerFixture} from '../../../../scripts/canonical/shared-business-collection-history-sql.test.mjs';
import {getRegisteredBusinessCollectionHistoryRevision} from '../../../../scripts/canonical/shared-business-collection-history-bootstrap.mjs';
import {validateBusinessCollectionHistoryReadProof} from './businessCollectionHistoryProof.mjs';
import {isolatedCopyHash,validateIsolatedOperationCopyContext} from './isolatedOperationCopyContext.mjs';
import {readBusinessSelectedSaleNativeContext} from './businessSelectedSaleNativeContext.mjs';
import {bindBusinessProductPriceSaleDTO,getBusinessProductPriceSaleDTO} from './businessProductPriceSaleScope.mjs';
import {withIsolatedOperationCopyScope} from './isolatedOperationCopyScope.mjs';
import {fixtureIdentity,fixtureProof} from './isolatedOperationCopyContext.test.mjs';

async function fixture(){
 const {copy,bundle,priceSaleBundle}=await collectionHistoryCompilerFixture(),options={invoiceId:'500',pricingHash:'D'.repeat(64)};
 const proof={schemaVersion:'melisa-business-collection-history-proof.v1',copyId:copy.copyId,sealHash:copy.sealHash,profileHash:isolatedCopyHash(copy),saleRevisionHash:bundle.revision.baseSaleRevisionHash,adjunctRevisionHash:bundle.revision.revisionHash,readerDefinitionHash:bundle.historyArtifact.definitionHash,collectorId:'16',creatorId:'15',invoiceId:options.invoiceId,creationRequestId:'10000000-0000-4000-8000-000000000001',creationPayloadHash:'C'.repeat(64),pricingHash:options.pricingHash};
 return {copy,bundle,priceSaleBundle,options,proof};
}

test('collection history content binds distinct collector creator invoice and historical price lineage without native authority',async()=>{
 const f=await fixture(),value=validateBusinessCollectionHistoryReadProof(f.copy,f.bundle,f.proof,f.options);
 assert.deepEqual(value,f.proof);assert(Object.isFrozen(value));assert.notEqual(value,f.proof);
 assert.equal(getRegisteredBusinessCollectionHistoryRevision(f.copy),null);
 f.proof.creationPayloadHash='E'.repeat(64);assert.equal(value.creationPayloadHash,'C'.repeat(64));
});

test('collection history rejects foreign scope swapped actors new reader-as-sale lineage and changed request bindings',async()=>{
 const f=await fixture();
 for(const change of [p=>p.copyId='10000000-0000-4000-8000-000000000002',p=>p.sealHash='E'.repeat(64),p=>p.profileHash='E'.repeat(64),p=>p.saleRevisionHash=p.adjunctRevisionHash,p=>p.adjunctRevisionHash=p.saleRevisionHash,p=>p.readerDefinitionHash='E'.repeat(64),p=>p.collectorId='15',p=>p.creatorId='16',p=>p.invoiceId='501',p=>p.creationRequestId='not-a-uuid',p=>p.creationPayloadHash=null,p=>p.creationPayloadHash='f'.repeat(64),p=>p.pricingHash='E'.repeat(64),p=>p.extra=true,p=>delete p.creationRequestId]){
  const proof={...f.proof};change(proof);assert.throws(()=>validateBusinessCollectionHistoryReadProof(f.copy,f.bundle,proof,f.options),{code:'COLLECTION_HISTORY_READ_PROOF'});
 }
 assert.equal(getRegisteredBusinessCollectionHistoryRevision(f.copy),null);
});

test('collection history proof alone cannot register serialized artifacts or change the expected native invoice and pricing hash',async()=>{
 const f=await fixture();
 assert.throws(()=>validateBusinessCollectionHistoryReadProof(f.copy,{...f.bundle,historyArtifact:{...f.bundle.historyArtifact}},f.proof,f.options),{code:'COLLECTION_HISTORY_SERVER_ARTIFACT_REQUIRED'});
 for(const options of [{invoiceId:'501',pricingHash:f.options.pricingHash},{invoiceId:'500',pricingHash:'E'.repeat(64)},{invoiceId:500,pricingHash:f.options.pricingHash},{invoiceId:'0',pricingHash:f.options.pricingHash}])assert.throws(()=>validateBusinessCollectionHistoryReadProof(f.copy,f.bundle,f.proof,options),{code:'COLLECTION_HISTORY_READ_PROOF'});
});

test('collection history flags and a genuine offline artifact cannot open a native request or mint the pricing DTO brand',async()=>{
 const f=await fixture(),transaction={},actor={id:'16',role:{code:'isolated_test_ilker'},permissions:['sales.view','finance.view','customer.view','finance.collection']};let calls=0;
 const request=()=>{calls++;throw Error('UNEXPECTED_NATIVE_QUERY');};
 const options={copy:f.copy,transaction,sql:{},request,actor,invoiceId:'500',selection:{},collectionHistoryConsumer:{readOnly:true,canCollect:false,canCancelCollection:false,bundle:f.bundle}};
 await assert.rejects(readBusinessSelectedSaleNativeContext(options),{code:'PRICE_SALE_HISTORY_CONSUMER_REQUIRED'});
 await assert.rejects(readBusinessSelectedSaleNativeContext({...options,priceConsumer:{revision:{version:13}}}),{code:'PRICE_SALE_SERVER_CONSUMER'});
 assert.equal(calls,0);
 // Use a fresh branded baseline, not the compiler fixture's separately earned
 // historical copy revisions. Neither profile has native consumer admission.
 const scopeCopy=validateIsolatedOperationCopyContext(f.copy);
 await withIsolatedOperationCopyScope({context:scopeCopy,identity:fixtureIdentity(scopeCopy),transaction,readProof:fixtureProof(scopeCopy),write:false},async()=>{
  const dto={};assert.throws(()=>bindBusinessProductPriceSaleDTO({copy:scopeCopy,transaction,artifact:f.bundle.historyArtifact,dto,pricingJson:'[]',mode:'HISTORY',invoiceId:'500',collectionHistoryProof:f.proof}),{code:'PRICE_SALE_DTO_REGISTERED_ARTIFACT'});
  assert.equal(getBusinessProductPriceSaleDTO(scopeCopy,dto),null);
 });
 assert.equal(getRegisteredBusinessCollectionHistoryRevision(f.copy),null);
});
