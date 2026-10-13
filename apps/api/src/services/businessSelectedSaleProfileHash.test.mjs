import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedSaleFixture} from './businessSelectedSalePreview.test.mjs';
import {selectBusinessSaleWriteIntent} from './businessSelectedSaleWriteIntent.mjs';
import {isolatedCopyHash} from './isolatedOperationCopyContext.mjs';

const input=currency=>({customerId:'100',currency,productIds:['444']});
function expectedHashes(copy,currency){
 const customer=copy.customers.find(c=>c.id==='100'&&c.currency===currency),rate=copy.currencyRates.find(r=>r.currency===currency),p=copy.products.find(p=>p.id==='444');
 const quotes=p.quotes.filter(q=>q.currency===currency&&q.type==='sale'&&q.verified===true&&q.mainUnit===true).toSorted((a,b)=>BigInt(a.quoteId)<BigInt(b.quoteId)?-1:1);
 const products=[{id:p.id,sourceKey:p.sourceKey,sourceWitnessHash:p.sourceWitnessHash,costExact4:p.costExact4,quotes:structuredClone(quotes)}];
 const policy={schemaVersion:'melisa-selected-sale-intent-policy.v1',copyId:copy.copyId,sealHash:copy.sealHash,profileHash:isolatedCopyHash(copy),maxItems:200,maxInvoiceAmountExact4:copy.businessInvoiceMaxExact4,quantity:'POSITIVE_WHOLE_MAIN_UNIT',currency,role:'customer',operations:['sale_draft','sale_finalize','sale_cancel']};
 const source={copyId:copy.copyId,sealHash:copy.sealHash,customer:structuredClone(customer),currency,productIds:['444'],products,rate:structuredClone(rate)};
 return {policyHash:isolatedCopyHash(policy),sourceSelectionHash:isolatedCopyHash(source)};
}

test('cold and repeated selections preserve exact uncached SOURCE and policy hashes across currencies',()=>{
 const {c}=selectedSaleFixture();
 for(const currency of ['TRY','USD','TRY','USD']){
  const actual=selectBusinessSaleWriteIntent(c,input(currency)),expected=expectedHashes(c,currency);
  assert.equal(actual.policyHash,expected.policyHash);assert.equal(actual.sourceSelectionHash,expected.sourceSelectionHash);
 }
});

test('same copyId separately registered sealed profiles cannot share their SOURCE profile hash',()=>{
 const first=selectedSaleFixture().c,second=selectedSaleFixture(raw=>{raw.customers[0].name='Different immutable SOURCE name';}).c;
 assert.equal(first.copyId,second.copyId);assert.notEqual(first.sealHash,second.sealHash);
 for(const copy of [first,second,first,second]){
  const actual=selectBusinessSaleWriteIntent(copy,input('TRY')),expected=expectedHashes(copy,'TRY');
  assert.equal(actual.policyHash,expected.policyHash);assert.equal(actual.sourceSelectionHash,expected.sourceSelectionHash);
 }
 assert.notEqual(selectBusinessSaleWriteIntent(first,input('TRY')).policyHash,selectBusinessSaleWriteIntent(second,input('TRY')).policyHash);
});

test('memoized SOURCE hash grants no registration authority and no mutation or invalid selection bypass',()=>{
 const {c}=selectedSaleFixture();const before=selectBusinessSaleWriteIntent(c,input('TRY'));
 assert(Object.isFrozen(c)&&Object.isFrozen(c.products)&&Object.isFrozen(c.products[0].quotes[0]));
 assert.throws(()=>{c.products[0].quotes[0].priceExact8='0.00000000';},TypeError);
 for(const copy of [{},structuredClone(c),Object.freeze(structuredClone(c))])assert.throws(()=>selectBusinessSaleWriteIntent(copy,input('TRY')),{code:'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED'});
 const changed=structuredClone(c);changed.products[0].quarantined=true;
 assert.throws(()=>selectBusinessSaleWriteIntent(changed,input('TRY')),{code:'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED'});
 for(const selection of [{...input('TRY'),productIds:['999']},{...input('TRY'),productIds:['444','444']},{...input('TRY'),currency:'EUR'},{...input('TRY'),customerId:'999'}])assert.throws(()=>selectBusinessSaleWriteIntent(c,selection));
 assert.deepEqual(selectBusinessSaleWriteIntent(c,input('TRY')),before);
});

test('registered frozen Date extras retain uncached policy hash parity after internal date mutation',()=>{
 const {c}=selectedSaleFixture(raw=>{raw.extraSourceDate=new Date('2026-10-09T00:00:00.000Z');});
 assert(Object.isFrozen(c.extraSourceDate));
 const before=selectBusinessSaleWriteIntent(c,input('TRY'));
 assert.equal(before.policyHash,expectedHashes(c,'TRY').policyHash);
 c.extraSourceDate.setTime(Date.parse('2026-10-10T00:00:00.000Z'));
 const after=selectBusinessSaleWriteIntent(c,input('TRY'));
 assert.equal(after.policyHash,expectedHashes(c,'TRY').policyHash);
 assert.notEqual(after.policyHash,before.policyHash);
 assert.equal(after.sourceSelectionHash,before.sourceSelectionHash);
});
