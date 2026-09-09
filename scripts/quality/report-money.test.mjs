import test from 'node:test';
import assert from 'node:assert/strict';
import { nullableReportAmount, sumReportAmounts, reportBalanceFields, reportConversion, historicalFinanceSummary } from '../../apps/api/src/services/reportMoney.js';

test('missing report money stays unknown, including invalid numeric inputs', () => {
  for (const value of [null, undefined, '', NaN, Infinity, 'not money']) assert.equal(nullableReportAmount(value), null);
  assert.equal(nullableReportAmount('12.25'), 12.25);
});
test('known zero, negative balance and empty total retain their meaning', () => {
  assert.equal(nullableReportAmount(0), 0);
  assert.equal(sumReportAmounts([100, -20, 0]), 80);
  assert.equal(sumReportAmounts([]), 0);
});
test('one missing amount poisons the full total instead of being skipped', () => {
  assert.equal(sumReportAmounts([...Array(100).fill(12), null]), null);
});
test('party mapping never substitutes native currency for missing TRY', () => {
  const result = reportBalanceFields({ balance: -7, currency_code: 'EUR', balance_try: null, rate_to_try: null });
  assert.equal(result.balance, -7); assert.equal(result.currency, 'EUR'); assert.equal(result.balanceTry, null);
});
test('unknown currency is not labelled TRY', () => {
  assert.equal(reportBalanceFields({ balance: 5 }).currency, 'UNKNOWN');
});
test('conversion metadata covers groups outside visible top ten', () => {
  const result = reportConversion([{ party:'customer', currency_code:'USD', balance:5, missing_count:1 }, { party:'supplier', currency_code:'USD', balance:2, missing_count:1 }, { currency_code:'EUR', balance:0, missing_count:0 }], '2026-09-09');
  assert.deepEqual(result.missingCurrencies,['USD']); assert.equal(result.status,'MISSING_RATES'); assert.equal(result.balancesByCurrency.length,3);
});
test('rate date and value are retained for a converted balance', () => {
  const result=reportBalanceFields({ balance:5,currency_code:'USD',balance_try:200,rate_to_try:40,rate_date:new Date('2026-09-08T00:00:00Z') });
  assert.equal(result.rateDate,'2026-09-08'); assert.equal(result.rateToTry,40); assert.equal(result.balanceTry,200);
});
test('historical finance only TRY can yield a combined TRY total', () => {
  const result=historicalFinanceSummary([{currency_code:'TRY',collections:20,payments:10}]);
  assert.equal(result.collections,20); assert.equal(result.payments,10); assert.equal(result.netCash,10);
});
test('foreign historical collection does not become TRY even if payments are known', () => {
  const result=historicalFinanceSummary([{currency_code:'TRY',collections:20,payments:10},{currency_code:'USD',collections:5,payments:0}]);
  assert.equal(result.collections,null); assert.equal(result.payments,10); assert.equal(result.netCash,null);
  assert.deepEqual(result.missingSnapshotCurrencies,['USD']); assert.equal(result.currencySummary[1].collections,5);
});
test('same foreign collection and payment cannot masquerade as known zero TRY', () => {
  const result=historicalFinanceSummary([{currency_code:'EUR',collections:5,payments:5}]);
  assert.equal(result.netCash,null);
});
test('offsetting foreign entries still lack their historical rate even with zero native net', () => {
  const result=historicalFinanceSummary([{currency_code:'USD',collections:0,payments:0,collection_activity:10,payment_activity:0}]);
  assert.equal(result.collections,null); assert.equal(result.payments,0); assert.equal(result.netCash,null);
  assert.deepEqual(result.missingSnapshotCurrencies,['USD']);
});
test('no finance activity and zero foreign exposure are known zero', () => {
  assert.equal(historicalFinanceSummary([]).netCash,0);
  assert.equal(historicalFinanceSummary([{currency_code:'JPY',collections:0,payments:0}]).netCash,0);
});
