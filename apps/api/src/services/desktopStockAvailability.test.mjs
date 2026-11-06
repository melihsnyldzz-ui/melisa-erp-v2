import test from 'node:test';import assert from 'node:assert/strict';
import {desktopAvailableStock,isDesktopStockAvailability} from '../../../../packages/shared/src/desktopStockAvailability.mjs';
test('base stock minus reservations stays exact through fractional, negative and large amounts',()=>{
 for(const [physical,reserved,available] of [['48.000','0.000','48.000'],['48.000','12.000','36.000'],['2.001','0.999','1.002'],['0.000','0.001','-0.001'],['-2.000','3.500','-5.500'],['999999999999999.999','0.001','999999999999999.998'],['-999999999999999.999','999999999999999.999','-1999999999999999.998']]){assert.equal(desktopAvailableStock(physical,reserved),available);assert.equal(isDesktopStockAvailability({currentStockExact3:physical,reservedExact3:reserved,availableExact3:available}),true);}
});
test('unknown, malformed, negative reservation and mismatched availability never become zero',()=>{
 for(const value of [null,undefined,0,'','0','0.00','01.000','1,000','NaN','-0.000','1000000000000000.000']){assert.throws(()=>desktopAvailableStock(value,'0.000'));assert.throws(()=>desktopAvailableStock('2.000',value));}
 assert.throws(()=>desktopAvailableStock('2.000','-1.000'));for(const change of [{},{reservedExact3:'1.000'},{availableExact3:'2.000'},{reservedExact3:'0.000',availableExact3:'0.000'}])assert.equal(isDesktopStockAvailability({currentStockExact3:'2.000',...change}),false);
});
