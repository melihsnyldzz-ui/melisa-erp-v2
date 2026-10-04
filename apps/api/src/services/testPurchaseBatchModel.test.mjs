import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeTestBatch,normalizeTestInvoiceDraft,validateTestBatchDecision,testPurchaseRequestHash,testPurchaseReplay,publicBatchContext,publicTestBatch,requiredTestBatch} from './testPurchaseBatchModel.mjs';
const requestId='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const products=[{id:1},{id:2}],scope={supplierId:3,warehouseId:1};
const batchInput=()=>({requestId,supplierId:3,warehouseId:1,note:'Sayım',lines:[{clientLineId:'a',productId:1,quantity:2,unit:'ADET'},{clientLineId:'b',productId:2,quantity:3,unit:'ADET'}]});
const batch={id:4,state:'accepted',lines:[{id:8,productId:1,purchasePrice:60,invoiceableQuantity:2},{id:9,productId:2,purchasePrice:80,invoiceableQuantity:3}]};
const draftInput=()=>({requestId,batchId:4,number:'TSTB-01',date:'2026-10-04',currency:'TRY',invoiceDiscountRate:0,vatRate:0,lines:[{receiptLineId:8,quantity:2,purchasePrice:60,lineDiscountRate:0},{receiptLineId:9,quantity:3,purchasePrice:80,lineDiscountRate:0}]});
test('two distinct product receipt rows and exact partial invoice rows',()=>{assert.equal(normalizeTestBatch(batchInput(),products,scope).lines.length,2);const d=draftInput();d.lines[1].quantity=1;assert.equal(normalizeTestInvoiceDraft(d,batch).lines[1].quantity,1);});
test('duplicate product or client key and out-of-scope mixed receipt rejected',()=>{for(const mutate of [v=>v.lines[1].productId=1,v=>v.lines[1].clientLineId='a',v=>v.lines[1].productId=99,v=>v.lines[1].quantity=0,v=>v.lines[1].quantity=6,v=>v.lines[1].quantity=1.5,v=>v.lines[1].unit='KOLI',v=>v.lines[1].amount=0,v=>v.supplierId=99]){const v=batchInput();mutate(v);assert.throws(()=>normalizeTestBatch(v,products,scope));}});
test('stale reservations and forged receipt/price/totals are rejected',()=>{for(const mutate of [v=>v.lines[1].receiptLineId=77,v=>v.lines[1].receiptLineId=8,v=>v.lines[1].quantity=4,v=>v.lines[0].purchasePrice=80,v=>v.lines[0].lineDiscountRate=5,v=>v.grandTotal=0,v=>v.invoiceDiscountRate=2,v=>v.vatRate=20,v=>v.currency='USD',v=>v.date='2026-02-30',v=>v.requestId='short']){const v=draftInput();mutate(v);assert.throws(()=>normalizeTestInvoiceDraft(v,batch));}assert.throws(()=>normalizeTestInvoiceDraft(draftInput(),{...batch,state:'pending'}));assert.throws(()=>normalizeTestInvoiceDraft(draftInput(),{...batch,lines:batch.lines.map(l=>({...l,invoiceableQuantity:0}))}));});
test('null objects, string quantities, extra fields and missing reject reason rejected',()=>{assert.throws(()=>normalizeTestBatch(null,products,scope));const v=batchInput();v.lines[0].quantity='2';assert.throws(()=>normalizeTestBatch(v,products,scope));assert.throws(()=>validateTestBatchDecision({requestId},true));validateTestBatchDecision({requestId,reason:'Yanlış teslim'},true);});
test('same UUID is replayable only for the same exact operation, actor and rows',()=>{
 const input=batchInput(),hash=testPurchaseRequestHash(input,'batch_create'),record={payload_hash:hash,actor_id:15,response_json:JSON.stringify({id:12,state:'pending'})};
 assert.deepEqual(testPurchaseReplay(record,testPurchaseRequestHash({...input,lines:input.lines.map(l=>({unit:l.unit,quantity:l.quantity,productId:l.productId,clientLineId:l.clientLineId}))},'batch_create'),15),{id:12,state:'pending',replayed:true});
 assert.throws(()=>testPurchaseReplay(record,hash,16));assert.throws(()=>testPurchaseReplay(record,testPurchaseRequestHash(input,'batch_approve'),15));
 input.lines[1].quantity=1;assert.throws(()=>testPurchaseReplay(record,testPurchaseRequestHash(input,'batch_create'),15));
});
test('goods-only context cannot expose purchase prices or native invoice drafts',()=>{
 const context={products:[{id:1,purchasePrice:60}],batches:[{id:2,lines:[{id:3,purchasePrice:80}]}],invoiceDrafts:[{id:9,totals:{grandTotal:80}}]},limited=publicBatchContext(context,false);
 assert.equal(limited.products[0].purchasePrice,undefined);assert.equal(limited.batches[0].lines[0].purchasePrice,undefined);assert.deepEqual(limited.invoiceDrafts,[]);assert.equal(publicBatchContext(context,true),context);assert.equal(context.products[0].purchasePrice,60);
});
test('goods mutation and journal replay are projected by current purchase visibility',()=>{
 const raw={id:4,state:'accepted',lines:[{id:8,productId:1,quantity:2,purchasePrice:60},{id:9,productId:2,quantity:1,purchasePrice:80}]};
 const hash=testPurchaseRequestHash(batchInput(),'batch_approve'),replay=testPurchaseReplay({payload_hash:hash,actor_id:16,response_json:JSON.stringify(raw)},hash,16);
 for(const result of [raw,replay]){const limited=publicTestBatch(result,false);assert.equal(limited.lines.length,2);assert.equal(limited.lines[0].purchasePrice,undefined);assert.equal(limited.lines[1].purchasePrice,undefined);assert.equal(limited.replayed,result.replayed);assert.equal(publicTestBatch(result,true).lines[1].purchasePrice,80);}
 assert.equal(raw.lines[0].purchasePrice,60);
});
test('required source lookup passes explicit old batch ID beyond a100-row recent window',async()=>{
 const old={id:1,state:'accepted',lines:[{id:8,invoiceableQuantity:2}]},recent=Array.from({length:100},(_,i)=>({id:i+2,lines:[]}));let queriedId;
 const lookup=async id=>{queriedId=id;return {batches:recent.some(b=>b.id===id)?recent:[...recent,old]};};
 const found=await requiredTestBatch(lookup,1);assert.equal(queriedId,1);assert.equal(found.context.batches.length,101);assert.equal(found.batch,old);
 await assert.rejects(()=>requiredTestBatch(async()=>({batches:recent}),1),{code:'GOODS_NOT_FOUND'});await assert.rejects(()=>requiredTestBatch(lookup,0),{code:'TEST_ID'});
});
