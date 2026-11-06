import test from 'node:test';import assert from 'node:assert/strict';
import {desktopInitialCostParity as cost} from './desktopInitialCostParity.mjs';
import {createRequire} from 'node:module';import path from 'node:path';
const require=createRequire(import.meta.url),driver=require(path.join(path.dirname(require.resolve('tedious')),'data-types','decimal.js'));
const calc=(purchasePriceExact4,purchaseDiscountRateExact4,currency='TRY')=>cost({currency,purchasePriceExact4,purchaseDiscountRateExact4});
test('common valid TRY prices and discounts match exact PR54/Tedious storage',()=>{
 assert.equal(calc('5.3000','0.0000'),'5.3000');assert.equal(calc('10.0000','10.0000'),'9.0000');
 assert.equal(calc('123.4500','15.0000'),'104.9325');assert.equal(calc('1.0000','100.0000'),'0.0000');
 assert.equal(calc('0.0000','3.1250'),'0.0000');
});
test('exact half-unit and PR54 floating point disagreeing cases are rejected',()=>{
 for(const [amount,rate] of [['0.0003','50.0000'],['0.0029','50.0000'],['0.0050','81.0000'],['0.0096','1.5625']])
  assert.throws(()=>calc(amount,rate),{code:'LOCAL_MASTER_COST_UNVERIFIED'});
});
test('safe integer boundary and malformed or overflow decimals fail closed',()=>{
 for(const amount of ['900719925474.0992','99999999999999.9999','1.00001','-1.0000','1e3','NaN'])
  assert.throws(()=>calc(amount,'0.0000'),{code:'LOCAL_MASTER_COST_UNVERIFIED'});
 for(const rate of ['100.0001','-1.0000','0.00001','NaN'])assert.throws(()=>calc('5.3000',rate),{code:'LOCAL_MASTER_COST_UNVERIFIED'});
 assert.throws(()=>calc('5.3000','0.0000','try'),{code:'LOCAL_MASTER_COST_UNVERIFIED'});
});
test('non-TRY follows PR54 zero initialization without asserting actual converted cost',()=>{
 assert.equal(calc('5.3000','10.0000','USD'),'0.0000');assert.throws(()=>calc('99999999999999.9999','0.0000','EUR'));
});
test('accepted and divergent examples agree with actual installed Tedious decimal bytes',()=>{
 const packed=(amount,rate)=>{const raw=Number(amount)*(1-Number(rate)/100),validated=driver.validate(raw);
  const chunks=[...driver.generateParameterData({value:validated,precision:18,scale:4},{})];return chunks[0].readBigUInt64LE(1);};
 for(const [amount,rate] of [['5.3000','0.0000'],['123.4500','15.0000'],['5.0000','10.0000']])
  assert.equal(packed(amount,rate),BigInt(calc(amount,rate).replace('.','')));
 assert.equal(packed('0.0003','50.0000'),1n);assert.throws(()=>calc('0.0003','50.0000'),{code:'LOCAL_MASTER_COST_UNVERIFIED'});
});
