import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFinanceSummary} from '../../apps/api/src/services/financeSummaryRates.js';
const asOf='2026-09-09';
const balance=(currency_code,amount,metric='financeBalances')=>({currency_code,amount,metric});
const rate=(currency_code,rate_to_try,rate_date=asOf)=>({currency_code,rate_to_try,rate_date});

test('missing FX never adds foreign amounts to TRY while retaining native balances',()=>{
 const result=buildFinanceSummary([balance('TRY',106),balance('USD',18),balance('EUR',26)],[],asOf);
 assert.equal(result.financeTryBalance,null);assert.deepEqual(result.currencySummary.financeBalances,{TRY:106,USD:18,EUR:26});
 assert.deepEqual(result.conversion.missingByMetric,{financeTryBalance:['EUR','USD']});assert.equal(result.customerReceivables,0);
});
test('valid selected rates convert each amount and retain provenance',()=>{
 const result=buildFinanceSummary([balance('TRY',106),balance('USD',18),balance('EUR',26)],[rate('USD','40'),rate('EUR',45)],asOf,{collection_count:'2',payment_count:'3'});
 assert.equal(result.financeTryBalance,1996);assert.equal(result.conversion.status,'COMPLETE');assert.equal(result.conversion.asOfDate,asOf);assert.equal(result.collectionCount,2);assert.equal(result.paymentCount,3);
 assert.equal(result.conversion.rates[0].rateToTry,40);
});
for(const invalid of [0,-1,null,'invalid'])test(`invalid selected rate ${invalid} cannot silently become one`,()=>{
 const result=buildFinanceSummary([balance('USD',2)],[rate('USD',invalid)],asOf);
 assert.equal(result.financeTryBalance,null);assert.deepEqual(result.conversion.missingCurrencies,['USD']);
});
test('future rates cannot value the current report',()=>{
 const result=buildFinanceSummary([balance('USD',2)],[rate('USD',99,'2026-09-10')],asOf);assert.equal(result.financeTryBalance,null);
});
test('zero foreign balance needs no fabricated exchange rate',()=>{
 const result=buildFinanceSummary([balance('USD',0),balance('TRY',5)],[],asOf);assert.equal(result.financeTryBalance,5);assert.equal(result.conversion.status,'COMPLETE');
});
test('missing rate blocks only affected metrics and retains negative account balances',()=>{
 const result=buildFinanceSummary([balance('TRY',8,'customerReceivables'),balance('USD',3,'supplierPayables'),balance('EUR',-2)],[rate('EUR',10)],asOf);
 assert.equal(result.customerReceivables,8);assert.equal(result.supplierPayables,null);assert.equal(result.financeTryBalance,-20);
});
test('unknown currency is never labeled TRY',()=>{
 const result=buildFinanceSummary([balance(null,3)],[],asOf);assert.equal(result.financeTryBalance,null);assert.deepEqual(result.currencySummary.financeBalances,{UNKNOWN:3});
});
test('malformed aggregate is not converted to a zero total',()=>{
 assert.throws(()=>buildFinanceSummary([balance('TRY',null)],[],asOf),/Invalid finance summary amount/);
});
