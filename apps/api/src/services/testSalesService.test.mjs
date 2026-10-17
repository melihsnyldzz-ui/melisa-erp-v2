import test from 'node:test';
import assert from 'node:assert/strict';
import {canWriteTestSale,testCostSnapshot,validateTestOrder} from './testSalesService.mjs';
import {isTestSalesMutation,withTestSalesMutation} from './testSalesScope.mjs';
test('TEST writer scope does not leak across asynchronous operations',async()=>{
 assert.equal(isTestSalesMutation(),false);
 await Promise.all([withTestSalesMutation(async()=>{await new Promise(r=>setTimeout(r,5));assert.equal(isTestSalesMutation(),true)}),Promise.resolve().then(()=>assert.equal(isTestSalesMutation(),false))]);
 assert.equal(isTestSalesMutation(),false);
});
test('fixture boundary rejects alternate customer, product, quantity and price injection',()=>{
 const scope={customer_id:593,product_id:301984};
 const valid={requestId:'acceptance-request-001',customerId:593,items:[{productId:301984,quantity:2}]};
 assert.deepEqual(validateTestOrder(valid,scope),{customerId:593,productId:301984,quantity:2});
 for(const order of [{...valid,customerId:1},{...valid,items:[{productId:1,quantity:2}]},{...valid,items:[{productId:301984,quantity:6}]},{...valid,items:[{productId:301984,quantity:2,unitPrice:1}]},{...valid,documentCurrency:'USD'},{...valid,requestId:''}])assert.throws(()=>validateTestOrder(order,scope));
});
test('TEST writer accepts the scoped seller and fully authorized admin only',()=>{
 const scope={seller_id:15};
 assert.equal(canWriteTestSale({id:15,role:{code:'isolated_test_sales'}},scope),true);
 assert.equal(canWriteTestSale({id:1,role:{code:'admin'},permissions:['sales.create','sales.finalize']},scope),true);
 assert.equal(canWriteTestSale({id:1,role:{code:'admin'},permissions:['sales.create']},scope),false);
 assert.equal(canWriteTestSale({id:3,role:{code:'salesperson'},permissions:['sales.create','sales.finalize']},scope),false);
});
test('unknown TEST unit cost remains unknown, not zero',()=>{
 assert.equal(testCostSnapshot(null),null);
 assert.equal(testCostSnapshot(undefined),null);
 assert.equal(testCostSnapshot(0),0);
 assert.equal(testCostSnapshot(60),60);
});
