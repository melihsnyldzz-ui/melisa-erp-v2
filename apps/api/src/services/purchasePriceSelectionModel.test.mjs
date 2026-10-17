import test from 'node:test';import assert from 'node:assert/strict';
import {projectPurchasePriceExact8,selectPurchasePrice,selectRateQuote,calculatePurchasePriceSettlement,purchasePriceBindingHash} from './purchasePriceSelectionModel.mjs';
import {calculateCurrencySettlement} from '../../../../packages/shared/src/currencySettlement.mjs';
const A='a'.repeat(64),B='b'.repeat(64),C='c'.repeat(64);
const clone=value=>structuredClone(value);
function context(priceExact='1.23450000',quoteCurrency='USD'){
 const source={source:'synthetic-test',runId:'TEST-C03-SCOPE-01',sourceHash:A,planHash:B,sourceAsOf:'2026-10-04',readOnly:true,sourceFreshLive:false,cutoverAccepted:false};
 const product={productId:'101',mainUnitSourceId:'201',productSourceKey:'TEST-C03-SCOPE-01/PRODUCT/101'};
 const price={id:'301',productId:product.productId,productSourceKey:product.productSourceKey,sourceKey:`${product.productSourceKey}/PRICE/purchase/CARD/0/${quoteCurrency}`,unitSourceId:null,type:'purchase',tier:0,currency:quoteCurrency,priceExact,isMainUnit:false};
 const selection={productId:product.productId,priceId:price.id,productSourceKey:product.productSourceKey,priceSourceKey:price.sourceKey,runId:source.runId,sourceHash:A,planHash:B,type:'purchase',unitSourceId:null,tier:0,currency:quoteCurrency,priceExact};
 const unitEvidence={productId:'101',mainUnitSourceId:'201',unit:'ADET',factorExact8:'1.00000000',source:'synthetic-test',sourceKey:'TEST-C03-SCOPE-01/UNIT/201',version:'1',hash:C};
 return {selection,product,prices:[price],source,expectedSource:clone(source),unitEvidence,expectedUnitEvidence:clone(unitEvidence)};
}
function rate(currency='USD',value='48.00000000') {return {currency,rateToTryExact8:value,source:'synthetic-test',sourceId:`TEST-C03-RATE-${currency}`,asOf:'2026-10-04',version:'1',hash:A};}
function settlement(priceContext=context(),document=rate(),account=rate('EUR','40.00000000')){return {priceContext,quantityExact3:'2.000',documentCurrency:document.currency,accountCurrency:account.currency,documentRateQuote:document,accountRateQuote:account,expectedDocumentRateQuote:clone(document),expectedAccountRateQuote:clone(account),documentDate:'2026-10-04'};}
const expectCode=(fn,code)=>assert.throws(fn,{code});
test('exact8 HALF_UP native4 keeps source, signed delta and real zero',()=>{
 for(const [exact,native,delta] of [['1.23454999','1.2345','-0.00004999'],['1.23455000','1.2346','0.00005000'],['1.23450000','1.2345','0.00000000'],['0.00000000','0.0000','0.00000000'],['0.00005000','0.0001','0.00005000']]){
  const result=projectPurchasePriceExact8(exact);assert.equal(result.priceExact,exact);assert.equal(result.nativePriceExact4,native);assert.equal(result.roundingDeltaExact8,delta);assert.equal(result.knownZero,exact==='0.00000000');assert.equal(result.nativeNumberBoundary.safe,true);
 }
});
test('decimal18,4 cap is exact, carry overflow rejected and unsafe Number is flagged',()=>{
 const max=projectPurchasePriceExact8('99999999999999.99990000');assert.equal(max.nativePriceExact4,'99999999999999.9999');assert.equal(max.nativeNumberBoundary.safe,false);assert.equal(max.nativeNumberBoundary.value,null);
 expectCode(()=>projectPurchasePriceExact8('99999999999999.99995000'),'PURCHASE_PRICE_OVERFLOW');
 for(const v of [null,undefined,0,NaN,'NaN','1.0','-1.00000000','01.00000000','1e2','1.000000000'])expectCode(()=>projectPurchasePriceExact8(v),'PURCHASE_PRICE_DECIMAL_INVALID');
});
test('synthetic selection binds exact tuple without claiming fresh Vega or market data',()=>{
 const result=selectPurchasePrice(context('0.00000000'));assert.equal(result.unitSourceId,null);assert.equal(result.tier,0);assert.equal(result.source.synthetic,true);assert.equal(result.source.sourceFreshLive,false);assert.equal(result.operationalUnit.factorExact8,'1.00000000');assert.equal(result.knownZero,true);assert.equal(JSON.parse(JSON.stringify(result)).priceExact,'0.00000000');
});
test('real source requires exact immutable RUN06 metadata and Vega product tuple',()=>{
 const v=context();v.source={source:'accepted-native-opening-prices',runId:'VEGA-OPENING-TEST-20261004-06',sourceHash:'36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400',planHash:'18639c27f276f4263d5e9a6b5037753c78f2c3d341a053055db7cb7b00da2f0a',sourceAsOf:'2026-09-30',readOnly:true,sourceFreshLive:false,cutoverAccepted:false};v.expectedSource=clone(v.source);v.product.productSourceKey='VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/123';Object.assign(v.selection,{productSourceKey:v.product.productSourceKey,priceSourceKey:v.product.productSourceKey+'/PRICE/purchase/CARD/0/USD',runId:v.source.runId,sourceHash:v.source.sourceHash,planHash:v.source.planHash});Object.assign(v.prices[0],{productSourceKey:v.product.productSourceKey,sourceKey:v.selection.priceSourceKey});
 assert.equal(selectPurchasePrice(v).source.synthetic,false);
 v.source.sourceHash=A;v.expectedSource.sourceHash=A;v.selection.sourceHash=A;expectCode(()=>selectPurchasePrice(v),'PURCHASE_PRICE_SOURCE_INVALID');
});
test('type, unit, product, source, price, duplicate tuple and version forgery fail closed',()=>{
 for(const mutate of [v=>v.selection.type='sale',v=>v.selection.tier=1,v=>v.selection.unitSourceId='201',v=>v.selection.productId='999',v=>v.selection.priceId='999',v=>v.selection.priceExact='2.00000000',v=>v.selection.currency='EUR',v=>v.selection.sourceHash=B,v=>v.selection.planHash=A,v=>v.selection.runId='TEST-C03-OTHER',v=>v.selection.priceSourceKey+='x',v=>v.prices.push({...v.prices[0],id:'302'}),v=>v.prices[0].productId='999',v=>v.unitEvidence.version='2',v=>v.unitEvidence.hash=A,v=>v.unitEvidence.factorExact8='2.00000000',v=>v.source.sourceFreshLive=true,v=>v.selection.extra=true]){const v=context();mutate(v);assert.throws(()=>selectPurchasePrice(v));}
 const missing=context();missing.prices=[];expectCode(()=>selectPurchasePrice(missing),'PURCHASE_PRICE_UNKNOWN');
});
test('CARD price does not invent alternative unit conversion even with known factor',()=>{
 const v=context();v.unitEvidence.factorExact8=v.expectedUnitEvidence.factorExact8='2.00000000';assert.equal(selectPurchasePrice(v).operationalUnit.factorExact8,'2.00000000');expectCode(()=>calculatePurchasePriceSettlement(settlement(v)),'PURCHASE_PRICE_UNIT_UNSUPPORTED');
});
test('explicit quotes bind currency, rate, source, ID, date, version and hash',()=>{
 const quote=rate(),expected=clone(quote),options={quote,expectedQuote:expected,currency:'USD',documentDate:'2026-10-04'};
 assert.equal(selectRateQuote(options).claimsFreshMarket,false);assert.equal(selectRateQuote(options).synthetic,true);
 for(const mutate of [q=>q.currency='EUR',q=>q.rateToTryExact8='0.00000000',q=>q.rateToTryExact8='-1.00000000',q=>q.rateToTryExact8='49.00000000',q=>q.source='TCMB',q=>q.sourceId='other',q=>q.version='2',q=>q.hash=B,q=>q.asOf='2026-10-03',q=>q.asOf='2026-10-05',q=>q.asOf='2026-02-30']){const changed=clone(quote);mutate(changed);assert.throws(()=>selectRateQuote({...options,quote:changed}));}
 expectCode(()=>selectRateQuote({...options,quote:null}),'PURCHASE_PRICE_INPUT_INVALID');
 expectCode(()=>selectRateQuote({...options,documentDate:'2026-02-30'}),'PURCHASE_PRICE_DATE_INVALID');
 const old=rate();old.asOf='2026-10-03';assert.equal(selectRateQuote({...options,quote:old,expectedQuote:clone(old),maxAgeDays:1}).asOf,'2026-10-03');
});
test('BigInt cross-currency settlement agrees with existing4/8 native settlement',()=>{
 const input=settlement(),result=calculatePurchasePriceSettlement(input);
 assert.equal(result.documentAmountExact4,'2.4690');assert.equal(result.accountAmountExact4,'2.9628');assert.equal(result.amountTryExact4,'118.5120');
 const native=calculateCurrencySettlement({documentAmount:'2.4690',documentCurrency:'USD',accountCurrency:'EUR',documentRateToTry:'48.00000000',accountRateToTry:'40.00000000'});
 assert.equal(Number(result.accountAmountExact4),native.accountAmount);assert.equal(Number(result.amountTryExact4),native.amountTry);assert.equal(JSON.parse(JSON.stringify(result)).selectedPrice.priceExact,'1.23450000');
});
test('native projected price and total HALF_UP are distinct from exact source',()=>{
 const input=settlement(context('0.00005000'),rate('USD','1.50000000'),rate('TRY','1.00000000'));input.quantityExact3='1.000';const result=calculatePurchasePriceSettlement(input);
 assert.equal(result.selectedPrice.priceExact,'0.00005000');assert.equal(result.selectedPrice.nativePriceExact4,'0.0001');assert.equal(result.documentAmountExact4,'0.0001');assert.equal(result.amountTryExact4,'0.0002');assert.equal(result.accountAmountExact4,'0.0002');
});
test('mixed document currency, missing cross-rate, unsafe amounts and same-currency rate mismatch rejected',()=>{
 const mixed=settlement();mixed.documentCurrency='EUR';expectCode(()=>calculatePurchasePriceSettlement(mixed),'PURCHASE_PRICE_MIXED_CURRENCY');
 const missing=settlement();missing.accountRateQuote=null;expectCode(()=>calculatePurchasePriceSettlement(missing),'PURCHASE_PRICE_INPUT_INVALID');
 const mismatch=settlement(context(),rate('USD','48.00000000'),rate('USD','49.00000000'));expectCode(()=>calculatePurchasePriceSettlement(mismatch),'PURCHASE_RATE_MISMATCH');
 const big=settlement(context('99999999999999.99990000'));expectCode(()=>calculatePurchasePriceSettlement(big),'PURCHASE_PRICE_OVERFLOW');
 for(const value of ['0.000','-1.000',1,'1.0000']){const input=settlement();input.quantityExact3=value;assert.throws(()=>calculatePurchasePriceSettlement(input));}
 const tryRate=rate('TRY','2.00000000');expectCode(()=>selectRateQuote({quote:tryRate,expectedQuote:tryRate,currency:'TRY',documentDate:'2026-10-04'}),'PURCHASE_RATE_CURRENCY_INVALID');
});
test('canonical binding hashes ignore object key order but include price/rate revisions',()=>{
 const a={price:'1.00000000',version:'1'},b={version:'1',price:'1.00000000'};assert.equal(purchasePriceBindingHash(a),purchasePriceBindingHash(b));assert.notEqual(purchasePriceBindingHash(a),purchasePriceBindingHash({...b,version:'2'}));
});
