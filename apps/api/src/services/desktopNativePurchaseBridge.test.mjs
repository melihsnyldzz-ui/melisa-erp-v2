// Source integration test: no registered goods transaction exists here.
// The real issuer, SQL engine and stock/account atomicity require separate tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPurchaseDraft,finalizePurchaseInvoice,assertPurchaseItemsBelongToSupplier,assertReceivedPurchaseContext,readDesktopPurchaseFinalizeSnapshot} from './invoiceDraftService.js';

test('forged desktop flags never permit native purchase draft, finalize, supplier override or stock skipping',async()=>{
 const transaction={},sqlDriver={};const context={pool:{},sqlDriver,transaction,desktopPrivatePurchase:true,stockAlreadyReceived:true,receiptId:'4'};const actor={id:'7'};
 const payload={supplierId:8,supplierCurrency:'TRY',documentCurrency:'TRY',documentNo:'TEST',documentDate:'2026-11-06',exchangeRate:1,accountExchangeRate:1,items:[{productId:5,quantity:1,purchasePrice:10,lineDiscountRate:0,currency:'TRY',stockCode:'P5',productName:'Test'}]};
 await assert.rejects(createPurchaseDraft(payload,actor,context),/DESKTOP_PRIVATE_PURCHASE_UNAVAILABLE/);
 await assert.rejects(finalizePurchaseInvoice('2',actor,context),/DESKTOP_PRIVATE_PURCHASE_UNAVAILABLE/);
 await assert.rejects(assertPurchaseItemsBelongToSupplier(sqlDriver,transaction,8,payload.items,{actor,receiptId:'4',invoice:payload}),/DESKTOP_PRIVATE_PURCHASE_UNAVAILABLE/);
 await assert.rejects(assertReceivedPurchaseContext(context,2,actor,payload),/DESKTOP_PRIVATE_PURCHASE_UNAVAILABLE/);
 let queried=false;class Request{constructor(){queried=true;throw Error('must not query');}}await assert.rejects(readDesktopPurchaseFinalizeSnapshot({transaction,sqlDriver:{Request},actor,receiptId:'4',invoiceId:'2'}),/DESKTOP_PRIVATE_PURCHASE_UNAVAILABLE/);assert.equal(queried,false);
});
