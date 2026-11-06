import test from 'node:test';import assert from 'node:assert/strict';import {incrementSalesMainQuantity} from './salesCartQuantity.mjs';
test('PR54 repeat adds exactly one main unit with exact fractional precision and carry; malformed input never becomes zero',()=>{
 for(const [before,after]of [['0.000','1.000'],['1.000','2.000'],['1.125','2.125'],['999.999','1000.999'],['9999999999999999.999','10000000000000000.999']])assert.equal(incrementSalesMainQuantity(before),after);
 for(const value of [null,1,'1','01.000','-1.000','1,000','0.0000','1.00','broken'])assert.throws(()=>incrementSalesMainQuantity(value),RangeError);
});
