import test from 'node:test';import assert from 'node:assert/strict';
import {normalizePurchasePayload} from './invoiceDraftService.js';
import {normalizeTestInvoiceDraft,testBatchPurchasePayload} from './testPurchaseBatchModel.mjs';
const batch={id:4,supplierId:3,state:'accepted',lines:[{id:8,productId:1,purchasePrice:60,stockCode:'TEST-V70-GOODS-P',productName:'TEST bir',invoiceableQuantity:5},{id:9,productId:2,purchasePrice:80,stockCode:'TEST-FINISH-GOODS-P2',productName:'TEST iki',invoiceableQuantity:5}]};
const input=qty=>({requestId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',batchId:4,number:'TSTB-01',date:'2026-10-04',currency:'TRY',invoiceDiscountRate:0,vatRate:0,lines:[{receiptLineId:8,quantity:qty[0],purchasePrice:60,lineDiscountRate:0},{receiptLineId:9,quantity:qty[1],purchasePrice:80,lineDiscountRate:0}]});
test('native normalizer owns different-product totals, including maximum700 and partial220',()=>{
 for(const [quantities,total] of [[[5,5],700],[[1,2],220],[[2,3],360]]){
  const payload=testBatchPurchasePayload(normalizeTestInvoiceDraft(input(quantities),batch),batch,'TEST supplier');const normalized=normalizePurchasePayload(payload);
  assert.equal(normalized.items.length,2);assert.equal(normalized.subtotal,total);assert.equal(normalized.grandTotal,total);assert.equal(normalized.discountTotal,0);assert.equal(normalized.amountTry,total);assert.equal(normalized.accountExchangeRate,1);assert.equal(normalized.items[1].purchasePrice,80);
 }
});
