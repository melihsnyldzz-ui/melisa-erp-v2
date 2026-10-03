import test from 'node:test';
import assert from 'node:assert/strict';
import { mapStockValuation, mapStockValuationSummary } from '../../apps/api/src/services/stockValuationMapping.js';
const row = (values = {}) => ({id:1, stock_code:'TEST', currency_code:'USD', stock_quantity:2, average_cost_try:3, sale_price:5, sale_rate_to_try:null, ...values});
for (const rate of [null, 0, -1, 'bad']) test(`missing or invalid FX ${rate} leaves sales and margin unknown`, () => {
  const actual = mapStockValuation(row({sale_rate_to_try:rate}));
  assert.equal(actual.stockValueTry, 6); assert.equal(actual.salePrice, 5);
  assert.equal(actual.potentialSaleValueTry, null); assert.equal(actual.potentialGrossProfitTry, null);
  assert.equal(actual.profitMargin, null); assert.equal(actual.missingRate, true);
});
test('valid FX converts current sale price without converting recorded TRY cost again', () => {
  const actual = mapStockValuation(row({sale_rate_to_try:40, sale_rate_date:'2026-09-09'}));
  assert.equal(actual.potentialSaleValueTry,400); assert.equal(actual.potentialGrossProfitTry,394);
  assert.equal(actual.saleRateDate,'2026-09-09'); assert.equal(actual.profitMargin,394/400);
});
test('TRY needs no rate-table record', () => assert.equal(mapStockValuation(row({currency_code:'TRY'})).potentialGrossProfitTry,4));
test('zero stock needs no fabricated rate', () => {
  const actual=mapStockValuation(row({stock_quantity:0}));assert.equal(actual.saleRateToTry,null);assert.equal(actual.potentialGrossProfitTry,0);assert.equal(actual.missingRate,false);
});
test('zero sale price retains stock cost and known potential loss', () => assert.equal(mapStockValuation(row({sale_price:0})).potentialGrossProfitTry,-6));
test('negative stock is retained in valuation and warning', () => {
  const actual=mapStockValuation(row({stock_quantity:-1,sale_rate_to_try:40}));assert.equal(actual.potentialGrossProfitTry,-197);assert.equal(actual.negativeStock,true);
});
test('unknown currency is never relabeled TRY', () => {const actual=mapStockValuation(row({currency_code:null}));assert.equal(actual.currency,'UNKNOWN');assert.equal(actual.potentialSaleValueTry,null);});
test('malformed source amount is not silently zero', () => assert.throws(()=>mapStockValuation(row({average_cost_try:null})),/Invalid stock valuation amount/));
test('unknown row outside visible page prevents partial sales and profit totals', () => {
  const summary=mapStockValuationSummary({total_count:103,total_stock_quantity:1201,total_stock_value_try:3603,total_potential_sale_value_try:12000,total_potential_gross_profit_try:8400,low_stock_count:3,negative_stock_count:1,missing_rate_count:2,as_of_date:'2026-09-09'},[{currency_code:'EUR',missing_rate_count:1},{currency_code:'TRY',missing_rate_count:0,sale_rate_to_try:1},{currency_code:'USD',missing_rate_count:1}]);
  assert.equal(summary.totalStockValueTry,3603);assert.equal(summary.totalPotentialSaleValueTry,null);assert.equal(summary.totalPotentialGrossProfitTry,null);assert.equal(summary.totalProductCount,103);assert.deepEqual(summary.conversion.missingCurrencies,['EUR','USD']);
});
