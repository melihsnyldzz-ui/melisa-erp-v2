import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorkFinanceMovements} from './workFinanceMovements.mjs';

const inputs=()=>({
 salesContext:{scope:{synthetic:true,customer:{id:'501',code:'NIGHT',name:'Deneme müşterisi',synthetic:true},accounts:[{id:'99',name:'TRY Kasa',currency:'TRY',synthetic:true}]}},
 invoices:[{id:'601',customerId:'501',documentNo:'NIGHT-601',collections:{items:[{id:'701',invoiceId:'601',accountId:'99',amountExact4:'50.0000',currency:'TRY',documentDate:'2026-10-06',status:'active'},{id:'702',invoiceId:'601',accountId:'99',amountExact4:'20.0000',currency:'TRY',documentDate:'2026-10-06',status:'cancelled',reversalId:'703',reversalAccountId:'99',reversalAmountExact4:'20.0000',reversalCurrency:'TRY',reversalDocumentDate:'2026-10-06',reversalCreatedAt:'2026-10-06 12:00:00'}]}}],
 paymentContext:{suppliers:[{id:'801',code:'SUP-1',name:'Tedarikçi A',currency:'USD'}],accounts:[{id:'901',name:'USD Kasa',type:'cash',currency:'USD'}],payments:[{id:'1001',supplierId:'801',accountId:'901',kind:'payment',direction:'out',currency:'USD',amountExact4:'10.0000',documentDate:'2026-10-06',number:'OD-1001',reversedById:'1002'},{id:'1002',supplierId:'801',accountId:'901',kind:'payment_cancel',direction:'in',currency:'USD',amountExact4:'10.0000',documentDate:'2026-10-06',number:'ODI-1002',reversedById:null}]}
});

test('finance ledger shows incoming and outgoing reversal rows and keeps currency totals separate',()=>{
 const ledger=buildWorkFinanceMovements(inputs());
 assert.equal(ledger.rows.length,5);
 assert.deepEqual(ledger.summary.map(({currency,incomingExact4,outgoingExact4,netExact4})=>({currency,incomingExact4,outgoingExact4,netExact4})),[
  {currency:'TRY',incomingExact4:'70.0000',outgoingExact4:'20.0000',netExact4:'50.0000'},
  {currency:'USD',incomingExact4:'10.0000',outgoingExact4:'10.0000',netExact4:'0.0000'},
  {currency:'EUR',incomingExact4:'0.0000',outgoingExact4:'0.0000',netExact4:'0.0000'},
 ]);
 assert.equal(ledger.rows.find(row=>row.id==='collection-reversal-703').at,'2026-10-06 12:00:00');
 assert.equal(ledger.rows.find(row=>row.id==='supplier-1001').status,'Geri alındı');
 assert.equal(ledger.rows.find(row=>row.id==='supplier-1002').direction,'in');
 assert.equal(ledger.bankAccounts.length,0);
});

test('finance ledger rejects an unlinked, wrong-currency, or mismatched reversal',()=>{
 const badInvoice=inputs();badInvoice.invoices[0].customerId='999';assert.throws(()=>buildWorkFinanceMovements(badInvoice));
 const badCurrency=inputs();badCurrency.paymentContext.payments[0].currency='TRY';assert.throws(()=>buildWorkFinanceMovements(badCurrency));
 const badReversal=inputs();badReversal.invoices[0].collections.items[1].reversalAmountExact4='19.0000';assert.throws(()=>buildWorkFinanceMovements(badReversal));
});
