import test from 'node:test';
import assert from 'node:assert/strict';
import {isolatedCopyHash,isolatedCopyJSON} from './isolatedOperationCopyContext.mjs';
import {isolatedCopyRequestBody} from './isolatedOperationCopyStoreFactory.mjs';
import {selectedSaleWriteHarness} from './businessSelectedSaleWriteScope.test-fixture.mjs';
import {getBusinessSelectedSaleWriteScope,withBusinessSelectedSaleWriteScope} from './businessSelectedSaleWriteScope.mjs';
import {selectBusinessSaleWriteIntent} from './businessSelectedSaleWriteIntent.mjs';

test('selected native scope enters only same write transaction, leaves no escaped grant',async()=>{
 const h=await selectedSaleWriteHarness();assert.equal(getBusinessSelectedSaleWriteScope(h.copy,h.tx),null);let delayed;
 await h.withScope(()=>{const s=getBusinessSelectedSaleWriteScope(h.copy,h.tx);assert.equal(s.customerAccountId,'5100');assert.equal(s.currency,'USD');assert.equal(s.maxItems,200);assert.equal(s.maxInvoiceAmountExact4,'20000.0000');assert.equal(s.rateExact8,'47.80000000');assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.productIds));assert.throws(()=>getBusinessSelectedSaleWriteScope(h.copy,{}),{code:'SELECTED_SALE_SCOPE_TRANSACTION_CHANGED'});delayed=()=>getBusinessSelectedSaleWriteScope(h.copy,h.tx);});
 assert.equal(delayed(),null);assert.equal(h.calls.length,3);
 await assert.rejects(withBusinessSelectedSaleWriteScope(h,()=>{}),{code:'ISOLATED_COPY_TRANSACTION_REQUIRED'});
});
test('selected scope rejects Shared/read/identity/module/connection and unsafe native TX witnesses',async()=>{
 const cases=[['copyLockMode','Shared'],['transactionCount',2],['transactionState',-1],['isolationLevel',2],['live',1],['readerDefinitionHash','E'.repeat(64)],['transactionId',9007199254740992]];
 for(const [key,value] of cases){let entered=false;const h=await selectedSaleWriteHarness({mutate:(kind,row)=>{if(kind==='metadata')row[key]=value;}});await assert.rejects(h.withScope(()=>{entered=true;}));assert.equal(entered,false,key);}
 for(const key of ['sessionId','transactionId']){const h=await selectedSaleWriteHarness({mutate:(kind,row,n)=>{if(kind==='metadata'&&n===2)row[key]=key==='sessionId'?92:'9007199254740995';}});await assert.rejects(h.withScope(()=>{}),{code:'SELECTED_SALE_SAME_NATIVE_TRANSACTION'});}
});
test('selected scope rejects missing owner before-image, revision, price, account and coherent payload forgery',async()=>{
 for(const change of [
  row=>{row.intent_json='{}';},
  row=>{const i=JSON.parse(row.intent_json);i.selectedRevision='b'.repeat(64);row.intent_json=JSON.stringify(i);},
  row=>{const p=JSON.parse(row.payload_json);p.businessAccountId='1100';row.payload_json=isolatedCopyJSON(p);row.payloadHash=isolatedCopyHash(p);const i=JSON.parse(row.intent_json);i.payloadHash=row.payloadHash;i.customerAccountId='1100';row.intent_json=JSON.stringify(i);},
  row=>{const d=JSON.parse(row.context_json);d.scope.products[0].prices[0].unitPriceExact8='99.00000000';row.context_json=JSON.stringify(d);},
  row=>{const a=JSON.parse(row.actor_json);a.permissions=[];row.actor_json=JSON.stringify(a);}
 ]){let entered=false;const h=await selectedSaleWriteHarness({mutate:(kind,row)=>{if(kind==='execute')change(row);}});await assert.rejects(h.withScope(()=>{entered=true;}));assert.equal(entered,false);}
});
test('scope finalization/cancel bind operation and exact invoice; exceptions revoke scope',async()=>{
 for(const operation of ['sale_finalize','sale_cancel']){const h=await selectedSaleWriteHarness({operation,invoiceId:'501'});await assert.rejects(h.withScope(()=>{const s=getBusinessSelectedSaleWriteScope(h.copy,h.tx);assert.equal(s.operation,operation);assert.equal(s.invoiceId,'501');throw Error('native failure');}),/native failure/);assert.equal(getBusinessSelectedSaleWriteScope(h.copy,h.tx),null);}
 const h=await selectedSaleWriteHarness({operation:'sale_finalize',mutate:(kind,row)=>{if(kind==='execute'){const i=JSON.parse(row.intent_json);i.invoiceId='502';row.intent_json=JSON.stringify(i);}}});await assert.rejects(h.withScope(()=>{}),{code:'SELECTED_SALE_OWNER_ACCOUNT_POLICY'});
});
test('SOURCE selection is deterministic and remains no-grant; client cannot stamp native fields',async()=>{
 const h=await selectedSaleWriteHarness(),input={customerId:'100',currency:'USD',productIds:['444']};
 const selected=selectBusinessSaleWriteIntent(h.copy,input);assert.equal(selected.writeAuthorized,undefined);assert.equal(selected.sourceSelectionHash,h.selected.sourceSelectionHash);assert.throws(()=>selectBusinessSaleWriteIntent(h.copy,{...input,customerId:'591'}));assert.throws(()=>selectBusinessSaleWriteIntent(h.copy,{...input,productIds:['444','444']}));
 for(const key of ['businessCustomerId','businessProductIds','businessSelectedSalePolicyHash','sourceSelectionHash','selectedSaleIntent'])assert.throws(()=>isolatedCopyRequestBody(h.copy,h.actor,'sale_draft',{requestId:h.requestId,[key]:'forged'}),{code:'ISOLATED_COPY_CLIENT_PROFILE'});
 // Existing inbound domain stamps these shared fields on the server before
 // calling the generic journal. Do not break its native guarded write path.
 const body=isolatedCopyRequestBody(h.copy,h.actor,'count_create',{requestId:h.requestId,businessSupplierId:'200',businessAccountId:'1200',businessCurrency:'TRY'});
 assert.equal(JSON.parse(body.json).businessAccountId,'1200');assert.equal(JSON.parse(body.json).businessCurrency,'TRY');
});
