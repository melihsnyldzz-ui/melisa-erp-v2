import test from 'node:test';import assert from 'node:assert/strict';
import {desktopSaleQuote} from './desktopSaleQuote.mjs';
import {normalizeSalesPayload} from './invoiceDraftService.js';
function fixture({q='2.000',p='12.0000',q2='1.000',p2='10.0000',rate='3.0000',cost='8.0000'}={}){
 const rows=[['8',q,p],['1',q2,p2]],items=rows.map(([id,quantity,unitPrice])=>({productId:Number(id),quantity:Number(quantity),unitPrice:Number(unitPrice),currency:'TRY'}));
 return {normalizeSalesPayload,discountRateExact4:rate,maxDiscountRateExact4:'3.0000',prepared:{invoice:{documentNo:'PREVIEW',documentDate:'2026-11-06',customerId:2,documentCurrency:'TRY',customerCurrency:'TRY',exchangeRate:1,accountExchangeRate:1,items},expected:{lines:rows.map(([productId,quantityExact3,unitPriceExact4])=>({productId,quantityExact3,unitPriceExact4,lineTotalExact4:(Number(quantityExact3)*Number(unitPriceExact4)).toFixed(4)}))}},locked:{products:rows.map(([, ,priceExact4])=>({priceExact4,averageCostTryExact4:cost}))}};
}
test('PR54 native normalization agrees with the independent exact invoice percentage',()=>{
 const result=desktopSaleQuote(fixture());assert.equal(result.subtotalExact4,'34.0000');assert.equal(result.discountTotalExact4,'1.0200');assert.equal(result.totalExact4,'32.9800');assert.equal(result.lines[0].quantityExact3,'2.000');assert.equal(result.lines[0].unitPriceExact4,'12.0000');assert.equal(result.lines[0].lineTotalExact4,'24.0000');assert.equal(result.writeSupported,false);assert.equal(result.belowCostWarning,false);
 const series=desktopSaleQuote(fixture({q:'12.000'}));assert.equal(series.subtotalExact4,'154.0000');assert.equal(series.discountTotalExact4,'4.6200');assert.equal(series.totalExact4,'149.3800');
});
test('zero, fractional quantities, fractional prices and percentage precision use unrounded native subtotal',()=>{
 for(const v of [{rate:'0.0000'},{q:'1.125',p:'12.3456',q2:'0.750',p2:'0.5555',rate:'2.1250'},{q:'0.001',p:'0.1500',q2:'0.001',p2:'0.1500',rate:'3.0000'}]){
  const input=fixture(v),out=desktopSaleQuote(input),native=normalizeSalesPayload({...input.prepared.invoice,discountRate:Number(input.discountRateExact4)});
  assert.equal(Math.round(Number(out.subtotalExact4)*10000),Math.round(native.subtotal*10000));assert.equal(Math.round(Number(out.totalExact4)*10000),Math.round(native.grandTotal*10000));assert.equal(out.writeSupported,input.discountRateExact4==='0.0000');
 }
});
test('staff limit is exact, higher authority is never inferred, and unsafe numeric/native results fail closed',()=>{
 for(const rate of ['3.0001','5.0000','100.0000'])assert.throws(()=>desktopSaleQuote(fixture({rate})),{code:'DESKTOP_SALE_DISCOUNT_APPROVAL_REQUIRED'});
 for(const rate of [3,'3','-1.0000','NaN','101.0000'])assert.throws(()=>desktopSaleQuote(fixture({rate})));
 const manager=desktopSaleQuote({...fixture({rate:'5.0000'}),maxDiscountRateExact4:'5.0000'});assert.equal(manager.discountRateExact4,'5.0000');
 assert.throws(()=>desktopSaleQuote({...fixture({rate:'5.0001'}),maxDiscountRateExact4:'5.0000'}),{code:'DESKTOP_SALE_DISCOUNT_APPROVAL_REQUIRED'});
 assert.throws(()=>desktopSaleQuote({...fixture(),normalizeSalesPayload:payload=>({...normalizeSalesPayload(payload),grandTotal:33})}));
 const cost=desktopSaleQuote(fixture({cost:'12.0000'}));assert.equal(cost.belowCostWarning,true);assert.equal('averageCostTryExact4' in cost,false);
});
