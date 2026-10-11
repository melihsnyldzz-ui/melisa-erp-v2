import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedSaleWriteHarness} from './businessSelectedSaleWriteScope.test-fixture.mjs';
import {isolatedCopyRequestBody,isolatedCopySelectedSaleRequestBody} from './isolatedOperationCopyStoreFactory.mjs';
import {isolatedCopyHash,isolatedCopyJSON} from './isolatedOperationCopyContext.mjs';

test('selected request derives exact canonical SOURCE identity and policy after client-field rejection',async()=>{
 const h=await selectedSaleWriteHarness(),payload={requestId:h.requestId,expectedRevision:'a'.repeat(64),customerId:'100',currency:'USD',items:[{productId:'444',quoteId:'777',quantityExact3:'6.000'}]};
 const body=isolatedCopySelectedSaleRequestBody(h.copy,h.actor,'sale_draft',payload,h.selected),value=JSON.parse(body.json);
 assert.equal(body.json,isolatedCopyJSON(value));assert.equal(body.hash,isolatedCopyHash(value));
 assert.equal(value.businessCustomerId,'100');assert.equal(value.businessAccountId,h.selected.customerAccountId);
 assert.equal(value.businessCurrency,'USD');assert.deepEqual(value.businessProductIds,['444']);
 assert.equal(value.businessSelectedSalePolicyHash,h.selected.policyHash);assert.equal(value.sourceSelectionHash,h.selected.sourceSelectionHash);
 assert.equal(value.actorId,h.actor.id);assert.equal(value.copyId,h.copy.copyId);assert.equal(value.sealHash,h.copy.sealHash);
 assert.equal(body.requestId,payload.requestId);assert.equal(value.items[0].quantityExact3,'6.000');
 // Body preparation is not a native transaction, permission grant or mutation.
 assert.equal(h.calls.length,0);
});

test('selected request rejects every client-owned native witness and coherent selection tampering',async()=>{
 const h=await selectedSaleWriteHarness(),payload={requestId:h.requestId};
 for(const field of ['copyId','actorId','sealHash','operation','operationOrigin','businessDailyScopeHash','businessCustomerId','businessAccountId','businessCurrency','businessProductIds','businessSelectedSalePolicyHash','sourceSelectionHash','selectedSaleIntent']){
  assert.throws(()=>isolatedCopySelectedSaleRequestBody(h.copy,h.actor,'sale_draft',{...payload,[field]:'client'},h.selected),{code:'ISOLATED_COPY_CLIENT_PROFILE'});
 }
 for(const [field,value] of [['customerAccountId','999'],['partyId','999'],['sourceSelectionHash','0'.repeat(64)],['policyHash','0'.repeat(64)],['rateExact8','99.00000000'],['maxItems',2],['maxInvoiceAmountExact4','500.0000'],['productIds',['444','444']]]){
  assert.throws(()=>isolatedCopySelectedSaleRequestBody(h.copy,h.actor,'sale_draft',payload,{...h.selected,[field]:value}));
 }
 assert.throws(()=>isolatedCopySelectedSaleRequestBody(h.copy,h.actor,'payment',payload,h.selected),{code:'SELECTED_SALE_INTENT_OPERATION'});
 assert.equal(h.calls.length,0);
});

test('selected body hash separates currency account, lifecycle invoice and changed body without altering inbound serialization',async()=>{
 const usd=await selectedSaleWriteHarness(),tryh=await selectedSaleWriteHarness({currency:'TRY'}),payload={requestId:usd.requestId,expectedRevision:'a'.repeat(64)};
 const body=(h,op,p)=>isolatedCopySelectedSaleRequestBody(h.copy,h.actor,op,p,h.selected);
 assert.notEqual(body(usd,'sale_draft',payload).hash,body(tryh,'sale_draft',payload).hash);
 assert.notEqual(body(usd,'sale_finalize',{...payload,id:'501'}).hash,body(usd,'sale_finalize',{...payload,id:'502'}).hash);
 assert.notEqual(body(usd,'sale_cancel',{...payload,id:'501',reason:'ilk'}).hash,body(usd,'sale_cancel',{...payload,id:'501',reason:'ikinci'}).hash);
 const inbound=JSON.parse(isolatedCopyRequestBody(usd.copy,usd.actor,'purchase_draft',{requestId:usd.requestId,businessAccountId:'900',businessCurrency:'TRY'}).json);
 assert.equal(inbound.businessAccountId,'900');assert.equal(inbound.businessCurrency,'TRY');assert.equal(inbound.businessSelectedSalePolicyHash,undefined);
});

test('verified intent callback receives bound native DTO while malformed DTO fails before engine execution',async()=>{
 const h=await selectedSaleWriteHarness();let ran=false;
 await h.withScope(dto=>{ran=true;assert.equal(dto.meta.copyId,h.copy.copyId);assert.equal(dto.scope.customer.accountId,h.selected.customerAccountId);});
 assert.equal(ran,true);
 const bad=await selectedSaleWriteHarness({mutate(kind,row){if(kind==='execute'){const dto=JSON.parse(row.context_json);dto.meta.copyId='not-the-copy';row.context_json=JSON.stringify(dto);}}});
 let effects=0;await assert.rejects(bad.withScope(()=>{effects++;}),{code:'ISOLATED_COPY_DTO_META'});assert.equal(effects,0);
});
