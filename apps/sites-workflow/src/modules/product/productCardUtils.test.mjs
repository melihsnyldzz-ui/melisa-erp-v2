import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProduct360,emptyProductForm,formatCost,formatMoney,mapDetailToForm,mapStockSummary} from './productCardUtils.js';

test('loaded unknown cost stays unknown, explicit zero stays zero, and a new card keeps its draft preview',()=>{
  const detail={stockCode:'000123',currency:'TRY',salePrice:90,purchasePrice:45,averageCostTry:null,averageCostCurrency:null};
  const unknown=mapDetailToForm(detail),zero=mapDetailToForm({...detail,averageCostTry:0,averageCostCurrency:0});
  assert.equal(unknown.averageCostTry,null);
  assert.equal(buildProduct360(unknown,[]).averageCostTry,null);
  assert.equal(buildProduct360(unknown,[]).averageCostCurrency,null);
  assert.equal(buildProduct360(unknown,[]).unitProfit,null);
  assert.equal(buildProduct360(unknown,[]).lastNetPurchaseCostTry,null);
  assert.equal(buildProduct360(unknown,[{sourceType:'purchase_invoice',quantityIn:1,unitCostTry:null}]).lastNetPurchaseCostTry,null);
  assert.equal(buildProduct360(unknown,[{sourceType:'purchase_invoice',quantityIn:1,unitCostTry:0}]).lastNetPurchaseCostTry,0);
  assert.equal(mapStockSummary(unknown).averageCostTry,'Bilinmiyor');
  assert.equal(formatCost(unknown.averageCostTry),'Bilinmiyor');
  assert.equal(zero.averageCostTry,0);
  assert.equal(buildProduct360(zero,[]).averageCostTry,0);
  assert.equal(mapStockSummary(zero).averageCostTry,formatMoney(0));
  assert.equal(formatCost(zero.averageCostTry),formatMoney(0));
  assert.equal(mapStockSummary({...emptyProductForm,purchasePrice:'45'}).averageCostTry,formatMoney(45));
});
