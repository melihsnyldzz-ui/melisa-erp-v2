import test from 'node:test';import assert from 'node:assert/strict';
import {productRejectionRecord,isProductRejectionRecord,productRejectionOutcome,isDurableProductRejection} from './desktopProductRejection.mjs';
const requestId='455de269-8e1f-4f24-9c4a-9677eaad8c63';
test('only the exact durable product rejection contract can release a pending request',()=>{
 const record=productRejectionRecord(requestId,'PRODUCT_BARCODE_IN_USE'),result=productRejectionOutcome(record,true);
 assert.equal(isProductRejectionRecord(record,requestId),true);assert.equal(isDurableProductRejection(result,requestId),true);
 for(const change of [{state:'UNKNOWN'},{resolution:'ROLLBACK_ASSUMED'},{reason:'SQL_DUPLICATE'},{operation:'customer.create'},{replayed:1},{requestId:'455de269-8e1f-4f24-9c4a-9677eaad8c64'},{entity:{} }])assert.equal(isDurableProductRejection({...result,...change},requestId),false);
 assert.equal(isProductRejectionRecord({...record,entity:{}},requestId),false);assert.equal(isProductRejectionRecord({...record,operation:'supplier.create'},requestId),false);
 assert.throws(()=>productRejectionRecord(requestId,'anything'));assert.throws(()=>productRejectionOutcome(record,1));
 const getter={...result};Object.defineProperty(getter,'reason',{enumerable:true,get(){throw Error('must not read getter');}});assert.equal(isDurableProductRejection(getter,requestId),false);
});
