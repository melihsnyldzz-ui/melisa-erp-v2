import test from 'node:test';import assert from 'node:assert/strict';
import {cleanRecordedInvoiceBasis} from './cleanStoreDayStore.mjs';
const row=()=>({invoiceId:'4',supplierId:'1',receiptId:'3',documentCurrency:'TRY',documentExchangeRateExact8:'1.00000000',accountCurrency:'TRY',accountExchangeRateExact8:'1.00000000',accountAmountExact4:'120.0000',amountTryExact4:'120.0000',totalExact4:'120.0000',linkCount:1,itemCount:1,receiptState:'accepted'});
test('clean purchase read uses the stored invoice currency snapshot and one accepted native receipt',()=>{
 const actual=cleanRecordedInvoiceBasis(row());assert.equal(actual.source,'stored-native-invoice');assert.equal(actual.accountAmountExact4,'120.0000');assert.equal(Object.hasOwn(actual,'totalExact4'),false);
 for(const patch of [{supplierId:'2'},{linkCount:2},{itemCount:0},{receiptState:'pending'},{accountCurrency:'USD'},{documentExchangeRateExact8:'1.00000001'},{amountTryExact4:'119.9999'},{accountAmountExact4:null}])assert.throws(()=>cleanRecordedInvoiceBasis({...row(),...patch}));
});

import {cleanSalesReadContext,cleanSalesInvoiceList} from './cleanStoreDayStore.mjs';
import {cleanCustomerCard} from './cleanCustomerCards.mjs';
import {tradeContext,tradeSelection} from '../../../sites-workflow/src/workflow/workTradeModel.mjs';
import {validateCustomerCard} from '../../../sites-workflow/src/workflow/testCustomersModel.mjs';

test('B4 invoice listing preserves the original receipt and applies pagination and currency per invoice',()=>{
 const invoices=[{id:'1',customerId:'1',currency:'TRY'},{id:'2',customerId:'2',currency:'TRY'}];
 assert.deepEqual(cleanSalesInvoiceList(invoices).data,invoices);
 assert.deepEqual(cleanSalesInvoiceList(invoices,{customerId:'2',currency:'TRY'}).data,[invoices[1]]);
 assert.deepEqual(cleanSalesInvoiceList(invoices,{limit:'1',page:'2'}).data,[invoices[1]]);
 assert.equal(cleanSalesInvoiceList(invoices,{customerId:'2',currency:'USD'}).meta.total,0);
});
test('clean sale reader enables existing receipt navigation but cannot manufacture a sale selection',()=>{const c={meta:{date:'2026-10-22',timeZone:'Europe/Istanbul',source:'native-test',environmentId:'e662fd94-d797-4b3b-938a-d143ad758b67'},scope:{customer:{id:'1',code:'C1',name:'Örnek',currency:'TRY',balanceExact4:'0.0000',synthetic:true,writeEligible:true},accounts:[]},capabilities:{canCollect:true}};const v=cleanSalesReadContext(c);assert.equal(tradeContext(v),v);assert.throws(()=>tradeContext({...v,capabilities:{...v.capabilities,canCreate:true}}));assert.throws(()=>tradeSelection({customerId:'1',documentDate:'2026-10-22',currency:'TRY',items:[{productId:'1'}]},v));const invoice={id:'1',customerId:'1',currency:'TRY'};assert.equal(cleanSalesInvoiceList(invoice).data.length,1);assert.equal(cleanSalesInvoiceList(invoice,{customerId:'2',currency:'TRY'}).data.length,0);assert.equal(cleanSalesInvoiceList(invoice,{page:'2'}).data.length,0);assert.throws(()=>cleanSalesInvoiceList(invoice,{customerId:'1'}));});
test('clean customer reads distinguish native synthetic ledger proof from Vega and unknown balances',()=>{const r={id:1,code:'C1',name:'Örnek',active:true,currency:'TRY',balance:'0.00000000',ledger:'0.00000000',foreignMovements:0,held:0},c=cleanCustomerCard(r);assert.equal(validateCustomerCard(c,{detail:true}),c);assert.equal(c.source.status,'synthetic');assert.equal(c.accounts[0].accountId,null);assert.equal(c.accounts[0].balanceExact,'0.00000000');for(const patch of [{ledger:'1.00000000'},{foreignMovements:1},{held:1},{currency:'LL'}])assert.equal(cleanCustomerCard({...r,...patch}).accounts[0].balanceExact,null);});
