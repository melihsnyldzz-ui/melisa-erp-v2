import test from 'node:test';
import assert from 'node:assert/strict';
import {buildJournalLines} from './financeService.js';
import {calculateCurrencySettlement} from './currencySettlement.mjs';
test('collection reversal posts customer debit and cash credit from stored TRY value',()=>{
 for(const type of ['collection_cancel','collection_refund']){
  const rows=buildJournalLines({id:1,partyType:'customer',partyCode:'TEST',movementType:type,amount:1.01,currency:'USD',amountTry:48.278,accountAmount:48.278,accountCurrency:'TRY',accountName:'TEST USD Kasa'});
  assert.equal(rows.length,2);assert.equal(rows[0].debit,48.278);assert.ok(rows[0].accountName.startsWith('120'));assert.equal(rows[1].credit,48.278);assert.equal(rows[1].accountName,'TEST USD Kasa');assert.equal(rows[0].documentCurrency,'USD');
 }
});
test('existing rate engine uses four-place rounded account amount and rejects missing rate',()=>{
 const r=calculateCurrencySettlement({documentAmount:1.03,documentCurrency:'EUR',accountCurrency:'USD',documentRateToTry:55.7,accountRateToTry:47.8});assert.equal(r.accountAmount,1.2002);assert.equal(r.amountTry,57.371);
 assert.throws(()=>calculateCurrencySettlement({documentAmount:1,documentCurrency:'EUR',accountCurrency:'TRY',accountRateToTry:1}));
});
