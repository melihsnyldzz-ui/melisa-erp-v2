import test from 'node:test';import assert from 'node:assert/strict';import {normalizeDesktopSalePricing,isDesktopSalesPolicy} from './desktopSalePricing.mjs';
import {desktopSeriesDraftItems} from './desktopSalePreviewSelection.mjs';
const pricing={version:1,policyRevision:'a'.repeat(64),unitPricesExact4:['1.2300',null],approvalId:null},policy={version:1,actorId:'7',revision:'a'.repeat(64),canChangeSalePrice:true,maxDiscountRateExact4:'5.0000',canApproveAboveFive:false};
test('one selected product has exactly one dense optional price; empty, oversized and sparse price arrays fail closed',()=>{
 assert.deepEqual(normalizeDesktopSalePricing({...pricing,unitPricesExact4:[null]}).unitPricesExact4,[null]);
 assert.deepEqual(normalizeDesktopSalePricing({...pricing,unitPricesExact4:['12.0000']}).unitPricesExact4,['12.0000']);
 for(const unitPricesExact4 of [[],[null,null,null],new Array(1),[undefined]])assert.throws(()=>normalizeDesktopSalePricing({...pricing,unitPricesExact4}));
 const accessor=[];Object.defineProperty(accessor,'0',{enumerable:true,get(){throw Error('must not read accessor');}});assert.throws(()=>normalizeDesktopSalePricing({...pricing,unitPricesExact4:accessor}),/DESKTOP_SALE_PRICING_INVALID/);
});
test('singleton ADET or series selection cannot acquire an unselected second line or mismatched quantity array',()=>{
 const input={productIds:['7'],quantities:['2'],quantityUnits:['ADET'],preview:{products:[{productId:'7',unit:'ADET',seriesUnit:{unitId:'71',factorExact8:'6.00000000'}}]}};
 assert.deepEqual(desktopSeriesDraftItems(input),[{productId:'7',quantityExact3:'2.000'}]);
 assert.deepEqual(desktopSeriesDraftItems({...input,quantityUnits:['SERİ']}),[{productId:'7',quantityExact3:'12.000',series:{unitId:'71',factorExact8:'6.00000000',quantityExact3:'2.000'}}]);
 for(const patch of [{productIds:[]},{productIds:['7','7']},{productIds:['7','8','9']},{productIds:new Array(1)},{productIds:['']},{quantities:['2','1']},{quantities:new Array(1)},{quantityUnits:[]},{preview:{products:[]}}])assert.throws(()=>desktopSeriesDraftItems({...input,...patch}));
});
test('pricing requires exact positive prices, current revision and optional real approval id',()=>{assert.deepEqual(normalizeDesktopSalePricing(pricing),pricing);for(const p of [{...pricing,extra:1},{...pricing,approvalId:'0'},{...pricing,unitPricesExact4:['0.0000',null]},{...pricing,unitPricesExact4:['1,0000',null]},{...pricing,policyRevision:'A'.repeat(64)}])assert.throws(()=>normalizeDesktopSalePricing(p));});
test('policy binds actor, revision, actual capabilities and bounded rate',()=>{assert.equal(isDesktopSalesPolicy(policy,'7'),true);for(const p of [{...policy,actorId:'8'},{...policy,maxDiscountRateExact4:'5.0001'},{...policy,canChangeSalePrice:1},{...policy,unknown:true}])assert.equal(isDesktopSalesPolicy(p,'7'),false);});
test('manager approval capability is explicit and legacy policy never implies it',()=>{assert.equal(isDesktopSalesPolicy({...policy,canApproveUpToFive:true},'7'),true);assert.equal(isDesktopSalesPolicy({...policy,canApproveUpToFive:false},'7'),true);assert.equal(isDesktopSalesPolicy({...policy,canApproveAboveFive:true,canApproveUpToFive:true},'7'),true);for(const p of [{...policy,canApproveUpToFive:1},{...policy,canApproveAboveFive:true,canApproveUpToFive:false},{...policy,canApproveUpToFive:true,canApproveEverything:true}])assert.equal(isDesktopSalesPolicy(p,'7'),false);});
