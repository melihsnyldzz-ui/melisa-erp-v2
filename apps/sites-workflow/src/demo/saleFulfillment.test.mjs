import test from 'node:test';
import assert from 'node:assert/strict';
import { seedOperations, transitionOperations, today } from './operationsStore.js';
import { saleStatus } from './saleFulfillment.js';
const step = transitionOperations;
function posted(state, input) { const draft = step(state, { type: 'save', input: { date: today(), currency: 'USD', ...input } }); return step(draft, { type: 'approve', id: draft.nextId - 1 }); }
function sale() { return posted(seedOperations(), { kind: 'sale', partyId: '201', fulfillmentPolicyVersion: 1, items: [{ productId: '101', quantity: '10', unitPrice: '100' }] }); }
const propose = state => step(state, { type: 'propose-sale-credit', id: 1, actorRole: 'muhasebe', dueDate: today(), reason: 'Kalan tutar vadeli' });
const approve = state => step(state, { type: 'approve-sale-credit', id: 1, actorRole: 'yonetici', approver: 'Angela', reason: 'Uygundur' });
const ship = state => step(state, { type: 'ship-sale', id: 1, actorRole: 'muhasebe', reason: 'Taşıyıcıya teslim' });
test('1000 USD sale, 400 collection, 600 credit approval: dispatch never posts stock or debt twice', () => {
  let state = sale(); assert.equal(state.products[0].stock, 10);
  state = posted(state, { kind: 'collection', partyId: '201', amount: '400', channel: 'BANK', settlementDocumentId: 1 });
  assert.deepEqual([saleStatus(state, state.documents[0]).paid, saleStatus(state,state.documents[0]).remaining], [40000,60000]);
  assert.equal(saleStatus(state,state.documents[0]).payment,'PARTIAL'); assert.throws(()=>ship(state),/Ödeme tamamlanmadan/);
  state=propose(state); assert.equal(saleStatus(state,state.documents[0]).shipping,'APPROVAL');
  assert.throws(()=>step(state,{type:'approve-sale-credit',id:1,actorRole:'muhasebe',approver:'Angela',reason:'test'}),/Semih veya Angela/);
  state=approve(state); const count=state.movements.length; state=ship(state);
  assert.equal(state.movements.length,count); assert.equal(state.products[0].stock,10); assert.equal(saleStatus(state,state.documents[0]).remaining,60000); assert.equal(saleStatus(state,state.documents[0]).shipping,'SHIPPED'); assert.throws(()=>ship(state));
});
test('full settlement permits dispatch and cancellation of collection reopens payment',()=>{
  let state=posted(sale(),{kind:'collection',partyId:'201',amount:'1000',channel:'BANK',settlementDocumentId:1});
  assert.equal(saleStatus(state,state.documents[0]).payment,'PAID'); assert.equal(saleStatus(state,state.documents[0]).shipping,'READY');
  state=step(state,{type:'cancel',id:2,reason:'Yanlış tahsilat'}); assert.equal(saleStatus(state,state.documents[0]).remaining,100000); assert.throws(()=>ship(state));
});
test('payment reversal cannot reuse an approval for a smaller remaining debt',()=>{
  let state=posted(sale(),{kind:'collection',partyId:'201',amount:'400',channel:'BANK',settlementDocumentId:1}); state=approve(propose(state));
  state=step(state,{type:'cancel',id:2,reason:'Yanlış kayıt'}); assert.equal(saleStatus(state,state.documents[0]).shipping,'WAITING'); assert.throws(()=>ship(state));
});
test('returns are labelled as adjustment, never received money',()=>{
  const state=sale(); state.documents.push({id:2,kind:'sales-return',status:'APPROVED',partyId:'201',currency:'USD',amount:100000,referenceId:1,items:[{productId:"101",quantity:10}],approvedRevision:999});
  const result=saleStatus(state,state.documents[0]); assert.equal(result.paid,0); assert.equal(result.adjusted,100000); assert.equal(result.payment,'OFFSET'); assert.equal(result.shipping,'RETURNED'); assert.throws(()=>ship(state));
});
test('settings change presentation only; unknown approver, sales role and draft cannot authorize dispatch',()=>{
  let state=propose(sale()); state=step(state,{type:'save-workflow-settings',mode:'BILL',actorRole:'yonetici'}); assert.throws(()=>ship(state));
  assert.throws(()=>step(state,{type:'approve-sale-credit',id:1,actorRole:'yonetici',approver:'İlker',reason:'test'}));
  assert.throws(()=>step(state,{type:'propose-sale-credit',id:1,actorRole:'satis',dueDate:today(),reason:'test'}));
  assert.throws(()=>step(state,{type:'save-workflow-settings',mode:'BOTH',actorRole:'satis'}));
});
test('new terminal sale can finalize before collection without inventing a credit limit',()=>{
  const state=seedOperations();state.products[0].prices={USD:10000};state.exchangeRates=[{date:today(),currency:'EUR',value:1},{date:today(),currency:'USD',value:1}];
  const result=step(state,{type:'terminal-submit',actorRole:'muhasebe',requestId:'audit-terminal',kind:'sale',input:{kind:'sale',date:today(),currency:'USD',partyId:'201',salesPolicyVersion:2,fulfillmentPolicyVersion:1,dueDate:today(),items:[{productId:'101',quantity:'10',unitPrice:'100'}]}});
  assert.equal(result.documents[0].status,'APPROVED');assert.equal(result.products[0].stock,10);assert.equal(saleStatus(result,result.documents[0]).shipping,'WAITING');assert.equal(saleStatus(result,result.documents[0]).remaining,100000);
});

test('terminal price exception remains a draft without posting stock or receivables',()=>{
  const state=seedOperations();
  const result=step(state,{type:'terminal-submit',actorRole:'satis',requestId:'audit-exception',kind:'sale',input:{kind:'sale',date:today(),currency:'TRY',partyId:'201',salesPolicyVersion:2,fulfillmentPolicyVersion:1,dueDate:today(),minimumExceptionReason:'Küçük örnek satış',priceExceptionReason:'Kur bulunamadı',items:[{productId:'101',quantity:'4',unitPrice:'285'}]}});
  assert.equal(result.documents[0].status,'DRAFT'); assert.equal(result.documents[0].approvedRevision,undefined); assert.equal(result.products[0].stock,state.products[0].stock); assert.equal(result.movements.length,state.movements.length);
});
