import test from 'node:test';import assert from 'node:assert/strict';
import {cleanRecordedInvoiceBasis} from './cleanStoreDayStore.mjs';
const row=()=>({invoiceId:'4',supplierId:'1',receiptId:'3',documentCurrency:'TRY',documentExchangeRateExact8:'1.00000000',accountCurrency:'TRY',accountExchangeRateExact8:'1.00000000',accountAmountExact4:'120.0000',amountTryExact4:'120.0000',totalExact4:'120.0000',linkCount:1,itemCount:1,receiptState:'accepted'});
test('clean purchase read uses the stored invoice currency snapshot and one accepted native receipt',()=>{
 const actual=cleanRecordedInvoiceBasis(row());assert.equal(actual.source,'stored-native-invoice');assert.equal(actual.accountAmountExact4,'120.0000');assert.equal(Object.hasOwn(actual,'totalExact4'),false);
 for(const patch of [{supplierId:'2'},{linkCount:2},{itemCount:0},{receiptState:'pending'},{accountCurrency:'USD'},{documentExchangeRateExact8:'1.00000001'},{amountTryExact4:'119.9999'},{accountAmountExact4:null}])assert.throws(()=>cleanRecordedInvoiceBasis({...row(),...patch}));
});
