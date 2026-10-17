import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sumCashAmounts,formatCashMoney} from './cashReadMoney.js';
// Runs the actual screen's account aggregation expression, not a copied
// implementation. Source-expression unit test; not a browser/component claim.
const source=await readFile(new URL('./CashBankLedgerScreen.jsx',import.meta.url),'utf8');
const start=source.indexOf('  const accountTotals = useMemo('),end=source.indexOf('  const selectedAccount =',start);
assert.ok(start>=0&&end>start);
const aggregate=new Function('accounts','sumCashAmounts','useMemo',source.slice(start,end)+'\nreturn accountTotals;');
const run=accounts=>aggregate(accounts,sumCashAmounts,fn=>fn());
const movementStart=source.indexOf('  const rowCurrencyTotals = useMemo('),movementEnd=source.indexOf('  const readStateText =',movementStart);
assert.ok(movementStart>=0&&movementEnd>movementStart);
const movementAggregate=new Function('rows','sumCashAmounts','useMemo',source.slice(movementStart,movementEnd)+'\nreturn rowCurrencyTotals;');
test('actual movement summary expression separates currencies and preserves unknown net',()=>{
 const result=movementAggregate([
  {currency:'USD',movementType:'collection',amount:'12345678901234.1234'},
  {currency:'USD',movementType:'payment',amount:'0.0001'},
  {currency:'EUR',movementType:'payment',amount:'2'},
  {currency:'TRY',movementType:'collection',amount:null},
  {currency:'TRY',movementType:'collection',amount:'5'},
  {currency:null,movementType:'collection',amount:'7'}
 ],sumCashAmounts,fn=>fn());
 assert.equal(result.USD.net,'12345678901234.12330000');assert.equal(result.EUR.net,'-2.00000000');
 assert.equal(result.TRY.in,null);assert.equal(result.TRY.net,null);assert.equal(result['Döviz doğrulanmadı'].net,'7.00000000');
});
test('screen account totals retain exact per-currency amounts and unknown values',()=>{
 const totals=run([{currency:'USD',currentBalance:'12345678901234.1234'},{currency:'USD',currentBalance:'0.0001'},
  {currency:'EUR',currentBalance:'0'},{currency:null,currentBalance:'7'}]);
 assert.equal(totals.USD,'12345678901234.12350000');assert.equal(totals.EUR,'0.00000000');
 assert.equal(totals['Döviz doğrulanmadı'],'7.00000000');assert.equal(totals.TRY,undefined);
 assert.equal(formatCashMoney(totals.USD,'USD'),'$12.345.678.901.234,12');
 assert.deepEqual(run([]),{});
 for(const rows of [[null,'5'],['5',null],[null,'5','8']]){
  const value=run(rows.map(currentBalance=>({currency:'TRY',currentBalance}))).TRY;
  assert.equal(value,null);assert.equal(formatCashMoney(value,'TRY'),'Doğrulanmadı');
 }
});

