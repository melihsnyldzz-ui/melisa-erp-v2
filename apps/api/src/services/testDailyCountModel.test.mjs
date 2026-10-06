import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDailyCountLines,normalizeUnknownCountScans,normalizeDailyCountApprovalReason} from './testDailyCountModel.mjs';

const products=[{id:'301985',stockCode:'TEST-V70-GOODS-P',stockQuantity:8},{id:'325503',stockCode:'TEST-FINISH-GOODS-P2',stockQuantity:3}];
const line=(productId='301985',stockCode='TEST-V70-GOODS-P',physical=7,reason='Eksik raf',movementFingerprint='a'.repeat(64))=>({productId,stockCode,physical,system:8,reason,movementFingerprint});

test('approver justification is bounded text and cannot be silently absent',()=>{
 assert.equal(normalizeDailyCountApprovalReason('  Raf tekrar kontrol edildi  '),'Raf tekrar kontrol edildi');
 for(const input of [undefined,null,15,'','  ','ok','x'.repeat(501)])assert.throws(()=>normalizeDailyCountApprovalReason(input),{code:'COUNT_APPROVAL_REASON'});
});

test('count batch accepts only unique exact allowlisted products and preserves zero and leading barcode text',()=>{
 assert.deepEqual(normalizeDailyCountLines([line(),line('325503','TEST-FINISH-GOODS-P2',0,'Ürün rafta yok')],products),[
  {productId:'301985',stockCode:'TEST-V70-GOODS-P',physical:7,system:8,reason:'Eksik raf',fingerprint:'a'.repeat(64)},
  {productId:'325503',stockCode:'TEST-FINISH-GOODS-P2',physical:0,system:8,reason:'Ürün rafta yok',fingerprint:'a'.repeat(64)},
 ]);
});

test('count batch rejects duplicate, out-of-scope, stale-shape, invalid quantity, missing reason and weak fingerprint',()=>{
 assert.throws(()=>normalizeDailyCountLines([line(),line()],products),{code:'COUNT_PRODUCT_SCOPE'});
 assert.throws(()=>normalizeDailyCountLines([line('301986','LIVE-PRODUCT')],products),{code:'COUNT_PRODUCT_SCOPE'});
 assert.throws(()=>normalizeDailyCountLines([{...line(),extra:true}],products),{code:'COUNT_LINE'});
 assert.throws(()=>normalizeDailyCountLines([line('301985','TEST-V70-GOODS-P',-1)],products),{code:'COUNT_QUANTITY'});
 assert.throws(()=>normalizeDailyCountLines([line('301985','TEST-V70-GOODS-P',7,'')],products),{code:'COUNT_REASON'});
 assert.throws(()=>normalizeDailyCountLines([line('301985','TEST-V70-GOODS-P',7,'ok','bad')],products),{code:'COUNT_FINGERPRINT'});
});

test('unknown barcode scans stay explicitly needs-review and never resolve to a product',()=>{
 assert.deepEqual(normalizeUnknownCountScans([{value:'0000098765432',quantity:2,status:'needs_review'}]),[{value:'0000098765432',quantity:2,status:'needs_review'}]);
 assert.throws(()=>normalizeUnknownCountScans([{value:'unknown',quantity:0,status:'needs_review'}]),{code:'COUNT_UNKNOWN'});
 assert.throws(()=>normalizeUnknownCountScans([{value:'unknown',quantity:1,status:'accepted'}]),{code:'COUNT_UNKNOWN'});
 assert.throws(()=>normalizeUnknownCountScans([{value:'unknown',quantity:1,status:'needs_review',productId:'301985'}]),{code:'COUNT_UNKNOWN'});
});
