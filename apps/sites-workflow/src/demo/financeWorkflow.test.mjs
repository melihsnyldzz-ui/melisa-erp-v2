import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedOperations, transitionOperations as run, financePosition, accountBalance, balance } from './operationsStore.js';

const date = '2026-09-26';
function post(state, kind, input = {}) {
  const saved = run(state,{type:'save',input:{kind,date,currency:'TRY',partyId:'201',reason:'Kontrol',amount:'0',items:[],...input}});
  return run(saved,{type:'approve',id:saved.nextId-1});
}
const sale = (s, amount='100') => post(s,'sale',{items:[{productId:'101',quantity:'1',unitPrice:amount}],dueDate:'2026-10-01'});

test('partial invoice settlement follows selected document and preserves the other invoice',()=>{
  let s=sale(seedOperations());s=sale(s,'200');
  s=post(s,'collection',{amount:'80',channel:'BANK',settlementDocumentId:2});
  const p=financePosition(s,'201','TRY');
  assert.deepEqual(p.invoices.map(i=>i.open),[10000,12000]);
  assert.equal(p.allocations.at(-1).invoiceId,2);
  assert.equal(accountBalance(s,'BANK','TRY'),8000);
  assert.equal(s.cash.TRY,0);
  assert.throws(()=>post(s,'collection',{amount:'130',channel:'BANK',settlementDocumentId:2}),/mahsup/);
});

test('cash sessions record opening, adjustments, closing, and carry forward without duplicate money',()=>{
  let s=post(seedOperations(),'cash-open',{amount:'100'});
  assert.equal(s.cashSessions[0].opening.TRY,0);
  assert.throws(()=>post(s,'cash-close',{counted:{TRY:'95',USD:'0',EUR:'0'}}),/sayımları/);
  s=post(s,'cash-adjustment',{counted:{TRY:'95',USD:'0',EUR:'0'},reason:'Sayım eksiği'});
  s=post(s,'cash-close',{counted:{TRY:'95',USD:'0',EUR:'0'}});
  assert.equal(s.cashSessions[0].closing.TRY,9500);
  assert.equal(s.cashSessions[0].adjustments.length,1);
  s=post(s,'cash-open',{amount:'95'});
  assert.equal(s.cash.TRY,9500);
  assert.equal(s.cashSessions[1].opening.TRY,9500);
});

test('a registered same-day rate creates two balanced FX account legs, with no customer posting',()=>{
  let s=sale(seedOperations(),'100');s=post(s,'collection',{amount:'100',channel:'BANK'});
  s=run(s,{type:'save-rate',date,currency:'USD',value:'40'});
  s=post(s,'cash-open',{amount:'0'});
  s=post(s,'transfer',{date,from:'BANK',to:'CASH',sourceCurrency:'TRY',targetCurrency:'USD',amount:'80',reason:'Bozdurma'});
  assert.equal(accountBalance(s,'BANK','TRY'),2000);
  assert.equal(s.cash.USD,200);
  assert.equal(balance(s,'201','TRY'),0);
  assert.equal(s.movements.filter(m=>m.documentId===s.documents.at(-1).id).length,2);
  assert.throws(()=>post(s,'transfer',{date,from:'BANK',to:'CASH',sourceCurrency:'TRY',targetCurrency:'EUR',amount:'1'}),/kuru/);
});

test('reversal posts a new dated compensating movement and reopens the invoice',()=>{
  let s=sale(seedOperations());s=post(s,'collection',{amount:'100',channel:'BANK'});
  const receiptId=s.documents.at(-1).id;
  s=run(s,{type:'reverse-finance',id:receiptId,reason:'Banka iadesi'});
  assert.equal(s.documents.find(d=>d.id===receiptId).status,'REVERSED');
  assert.equal(financePosition(s,'201','TRY').invoices[0].open,10000);
  assert.equal(accountBalance(s,'BANK','TRY'),0);
  assert.throws(()=>run(s,{type:'reverse-finance',id:receiptId,reason:'Tekrar'}),/onaylı/);
});

test('cheque creates no settlement until maturity and bank clearance',()=>{
  let s=sale(seedOperations());
  s=run(s,{type:'register-cheque',partyId:'201',currency:'TRY',amount:'100',number:'CHK-1',bank:'Örnek Banka',dueDate:'2020-01-01'});
  assert.equal(balance(s,'201','TRY'),10000);
  assert.equal(accountBalance(s,'BANK','TRY'),0);
  s=run(s,{type:'clear-cheque',id:s.cheques[0].id});
  assert.equal(balance(s,'201','TRY'),0);
  assert.equal(accountBalance(s,'BANK','TRY'),10000);
  assert.equal(s.cheques[0].status,'CLEARED');
  assert.throws(()=>run(s,{type:'clear-cheque',id:s.cheques[0].id}),/Bekleyen/);
});

test('closed cash receipts require a new cash session for dated reversal',()=>{
  let s=sale(seedOperations());s=post(s,'cash-open',{amount:'0'});
  s=post(s,'collection',{amount:'100',channel:'CASH'});
  const receipt=s.documents.at(-1).id;
  s=post(s,'cash-close',{counted:{TRY:'100',USD:'0',EUR:'0'}});
  assert.throws(()=>run(s,{type:'cancel',id:receipt,reason:'Düzelt'}),/Kapalı kasa/);
  assert.throws(()=>run(s,{type:'reverse-finance',id:receipt,reason:'Düzelt'}),/kasasını açın/);
  s=post(s,'cash-open',{amount:'100'});
  s=run(s,{type:'reverse-finance',id:receipt,reason:'Hatalı tahsilat'});
  assert.equal(s.cash.TRY,0);
  assert.equal(financePosition(s,'201','TRY').open,10000);
});

test('old bank movements and cash opening are reconstructed when existing records load',()=>{
  let s=sale(seedOperations());s=post(s,'collection',{amount:'50',channel:'BANK'});
  s=post(s,'cash-open',{amount:'5'});
  delete s.accounts;delete s.accountBalancesInitialized;delete s.cashSessions;delete s.activeCashSessionId;
  s=run(s,{type:'save',input:{kind:'expense',date,currency:'TRY',amount:'1',reason:'Masraf',channel:'BANK'}});
  assert.equal(s.accounts.BANK.TRY,5000);
  assert.equal(s.cashSessions.length,1);
  assert.equal(s.cashSessions[0].opening.TRY,0);
});
