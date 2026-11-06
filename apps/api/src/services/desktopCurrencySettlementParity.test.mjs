import test from 'node:test';import assert from 'node:assert/strict';import Decimal from 'tedious/lib/data-types/decimal.js';
import {desktopCurrencySettlementParity as settle,desktopCurrencyAccountProjection as project} from './desktopCurrencySettlementParity.mjs';
const base={documentAmountExact4:'82.0000',documentCurrency:'TRY',accountCurrency:'USD',documentRateToTryExact8:'1.00000000',accountRateToTryExact8:'40.00000000'};
const wire=(value,scale)=>{const b=Buffer.concat(Array.from(Decimal.generateParameterData({value,scale,precision:18},{})));let n=0n;for(let i=b.length-1;i>=1;i--)n=(n<<8n)+BigInt(b[i]);return b[0]===0?-n:n;};
test('exact cross-currency amounts preserve PR54 policy and actual pinned Decimal wire values',()=>{
 for(const [documentCurrency,accountCurrency,documentAmountExact4,documentRateToTryExact8,accountRateToTryExact8,accountAmountExact4,amountTryExact4]of [
  ['TRY','USD','82.0000','1.00000000','40.00000000','2.0500','82.0000'],['TRY','EUR','82.0000','1.00000000','50.00000000','1.6400','82.0000'],
  ['USD','TRY','10.0000','40.00000000','1.00000000','400.0000','400.0000'],['USD','EUR','10.0000','40.00000000','50.00000000','8.0000','400.0000'],
  ['EUR','USD','10.0000','50.00000000','40.00000000','12.5000','500.0000'],['USD','USD','10.0000','40.00000000','40.00000000','10.0000','400.0000'],
 ]){const r=settle({documentCurrency,accountCurrency,documentAmountExact4,documentRateToTryExact8,accountRateToTryExact8});assert.equal(r.accountAmountExact4,accountAmountExact4);assert.equal(r.amountTryExact4,amountTryExact4);assert.equal(wire(r.native.accountAmount,4),BigInt(accountAmountExact4.replace('.','')));assert.equal(wire(r.native.amountTry,4),BigInt(amountTryExact4.replace('.','')));assert.equal(wire(r.native.accountRateToTry,8),BigInt(accountRateToTryExact8.replace('.','')));assert(Object.isFrozen(r)&&Object.isFrozen(r.native));}
});
test('missing/ambiguous rates, same-currency mismatch, overflow, getters and real native decimal divergence fail closed',()=>{
 for(const change of [{accountRateToTryExact8:null},{accountRateToTryExact8:'0.00000000'},{accountRateToTryExact8:'-40.00000000'},{accountRateToTryExact8:40},{accountRateToTryExact8:'40.000000001'},{documentRateToTryExact8:'2.00000000'},{accountCurrency:'usd'},{accountCurrency:'GBP'},{documentAmountExact4:'-0.0000'},{documentAmountExact4:82},{extra:'ignored'}])assert.throws(()=>settle({...base,...change}));
 assert.throws(()=>settle({...base,documentCurrency:'USD',documentRateToTryExact8:'50.00000000'}));
 assert.throws(()=>settle({...base,accountCurrency:'TRY',accountRateToTryExact8:'1.00000000',documentAmountExact4:'900719925474.0987'}));
 assert.throws(()=>settle({...base,documentAmountExact4:'900719925474.0991',documentCurrency:'USD',documentRateToTryExact8:'40.00000000',accountCurrency:'TRY',accountRateToTryExact8:'1.00000000'}));
 let touched=false;const g={...base};Object.defineProperty(g,'documentCurrency',{enumerable:true,get(){touched=true;return 'TRY';}});assert.throws(()=>settle(g));assert.equal(touched,false);
});
test('foreign account posting cannot add its amount to another-currency legacy customer balance; primary account retains exact parity',()=>{
 const foreign=project({customerCurrency:'TRY',accountCurrency:'USD',customerBalanceExact4:'176.0000',accountBalanceExact8:'0.00000000',accountAmountExact4:'2.0500'});assert.equal(foreign.updatesLegacyBalance,false);assert.equal(foreign.customerEffectExact4,'0.0000');assert.equal(foreign.customerAfterExact4,'176.0000');assert.equal(foreign.accountAfterExact8,'2.05000000');
 const primary=project({customerCurrency:'USD',accountCurrency:'USD',customerBalanceExact4:'10.0000',accountBalanceExact8:'10.00000000',accountAmountExact4:'2.0500'});assert.equal(primary.updatesLegacyBalance,true);assert.equal(primary.customerAfterExact4,'12.0500');assert.equal(primary.accountAfterExact8,'12.05000000');
 const negative=project({customerCurrency:'TRY',accountCurrency:'USD',customerBalanceExact4:'-1.0000',accountBalanceExact8:'-0.50000000',accountAmountExact4:'2.0500'});assert.equal(negative.customerAfterExact4,'-1.0000');assert.equal(negative.accountAfterExact8,'1.55000000');
 for(const change of [{customerCurrency:'USD'},{accountBalanceExact8:'-0.00000000'},{accountAmountExact4:'-1.0000'},{accountBalanceExact8:'99999999999999999999.00000000'}])assert.throws(()=>project({customerCurrency:'TRY',accountCurrency:'USD',customerBalanceExact4:'176.0000',accountBalanceExact8:'0.00000000',accountAmountExact4:'2.0500',...change}));
});
