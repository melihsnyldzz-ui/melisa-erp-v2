import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBusinessSalesBasket,addBusinessSalesBasketLine,setBusinessSalesBasketQuantity,removeBusinessSalesBasketLine} from './workBusinessSalesBasketModel.mjs';
import {saleReadSelection,saleReadCustomer,saleReadProduct} from './workBusinessSalesRead.test-fixture.mjs';
const selection=patch=>({customerId:'155',accountId:'7',currency:'USD',productId:'12',priceId:'81',unitSourceId:'9',tier:'1',...patch});
function verified({query={},price='2.12345678',stock='100.00000000'}={}){
 const q=selection(query),customer=saleReadCustomer(),product=saleReadProduct();customer.id=q.customerId;customer.accounts=[{...customer.accounts[0],accountId:q.accountId,currency:q.currency}];customer.accountCount=1;
 product.id=q.productId;product.unit.sourceId=q.unitSourceId;product.stockQuantityExact=stock;product.salePrices=[{...product.salePrices[0],id:q.priceId,unitSourceId:q.unitSourceId,tier:Number(q.tier),currency:q.currency,priceExact:price,sourceKey:product.provenance.sourceKey+'/PRICE/sale/'+q.unitSourceId+'/'+q.tier+'/'+q.currency}];
 return saleReadSelection(q,{customer,product});
}
const rejects=(fn,suffix)=>assert.throws(fn,{code:'BUSINESS_SALE_BASKET_'+suffix});
test('empty and added baskets are immutable, exact and explicitly products-only without invoice or write authority',()=>{
 const empty=emptyBusinessSalesBasket(),proof=verified(),before=structuredClone(proof),basket=addBusinessSalesBasketLine(empty,proof,'3');
 assert.equal(empty.scope,null);assert.equal(empty.lines.length,0);assert.equal(empty.productTotalExact8,'0.00000000');
 assert.deepEqual(basket.scope,{customerId:'155',accountId:'7',currency:'USD'});assert.equal(basket.lines[0].key,'12:81:9:1');assert.equal(basket.lines[0].quantity,'3');assert.equal(basket.lines[0].unitPriceExact8,'2.12345678');assert.equal(basket.lines[0].productTotalExact8,'6.37037034');assert.equal(basket.productTotalExact8,'6.37037034');assert.equal(basket.totalKind,'PRODUCTS_ONLY');assert.equal(basket.nativeInvoiceTotalVerified,false);assert.equal(basket.writeAuthorized,false);assert.deepEqual(proof,before);
 assert(Object.isFrozen(basket));assert(Object.isFrozen(basket.lines));assert(Object.isFrozen(basket.lines[0].evidence.data.customer.account));assert.throws(()=>{basket.lines[0].evidence.data.price.priceExact='9.00000000';});assert.equal(empty.lines.length,0);
});
test('positive whole quantity strings only; no Number, exponent, fractional or padded input is accepted',()=>{
 for(const qty of [0,1,NaN,1n,null,undefined,'','0','-1','1.0','1.5','01',' 1','1 ','1e3','+1','1,000','999999999999999999999'])rejects(()=>addBusinessSalesBasketLine(emptyBusinessSalesBasket(),verified(),qty),'QUANTITY_INVALID');
});
test('selection verification is not stock availability; null, missing, negative, zero and fractional shortages reject',()=>{
 for(const stock of ['-3.00000000','0.00000000','-0.00000000'])rejects(()=>addBusinessSalesBasketLine(emptyBusinessSalesBasket(),verified({stock}),'1'),'STOCK_UNAVAILABLE');
 const unknown=verified();unknown.data.product.stockQuantityExact=null;rejects(()=>addBusinessSalesBasketLine(emptyBusinessSalesBasket(),unknown,'1'),'EVIDENCE_INVALID');
 const missing=verified();delete missing.data.product.stockQuantityExact;rejects(()=>addBusinessSalesBasketLine(emptyBusinessSalesBasket(),missing,'1'),'EVIDENCE_INVALID');
 rejects(()=>addBusinessSalesBasketLine(emptyBusinessSalesBasket(),verified({stock:'0.99999999'}),'1'),'STOCK_EXCEEDED');
 const exact=addBusinessSalesBasketLine(emptyBusinessSalesBasket(),verified({stock:'2.99999999'}),'2');assert.equal(exact.lines[0].quantity,'2');
});
test('unverified/held/passive/unknown-price selections and invalid units never enter the basket',()=>{
 for(const issue of ['CUSTOMER_PASSIVE','CUSTOMER_HOLD_OR_UNVERIFIED','CUSTOMER_ACCOUNT_UNVERIFIED','PRODUCT_PASSIVE','PRODUCT_HOLD','PRODUCT_SOURCE_UNVERIFIED','PRICE_UNKNOWN']){
  const proof=verified();proof.data.selectionVerified=false;proof.data.issues=[issue];rejects(()=>addBusinessSalesBasketLine(emptyBusinessSalesBasket(),proof,'1'),'SELECTION_UNVERIFIED');
 }
 for(const mutate of [p=>{p.data.price.priceExact=null;},p=>{p.data.price.priceExact='0.00000000';},p=>{p.data.price.priceExact='-1.00000000';},p=>{p.data.product.unit.factorExact8='6.00000000';},p=>{p.data.product.unit.label='KOLI';},p=>{p.data.product.unit.verified=false;},p=>{p.data.price.currency='EUR';},p=>{p.meta.writeAuthorized=true;},p=>{p.data.capabilities.canSave=true;}]){
  const proof=verified();mutate(proof);rejects(()=>addBusinessSalesBasketLine(emptyBusinessSalesBasket(),proof,'1'),'EVIDENCE_INVALID');
 }
});
test('same exact tuple adds quantities; different tiers of the same product share one stock ceiling',()=>{
 const first=verified({stock:'10.00000000'}),other=verified({query:{priceId:'82',tier:'2'},stock:'10.00000000',price:'3.00000000'});
 const one=addBusinessSalesBasketLine(emptyBusinessSalesBasket(),first,'3'),two=addBusinessSalesBasketLine(one,first,'2');assert.equal(two.lines.length,1);assert.equal(two.lines[0].quantity,'5');assert.equal(one.lines[0].quantity,'3');
 const three=addBusinessSalesBasketLine(two,other,'5');assert.equal(three.lines.length,2);assert.equal(three.productTotalExact8,'25.61728390');rejects(()=>addBusinessSalesBasketLine(three,other,'1'),'STOCK_EXCEEDED');rejects(()=>setBusinessSalesBasketQuantity(three,three.lines[0].key,'6'),'STOCK_EXCEEDED');
});
test('one exact customer/account/currency owns the entire basket; a same-ID customer balance/name drift rejects',()=>{
 const basket=addBusinessSalesBasketLine(emptyBusinessSalesBasket(),verified(),'1');
 for(const query of [{customerId:'156'},{accountId:'9'},{accountId:'8',currency:'EUR'}]){
  const proof=verified({query});Object.assign(proof.data.customer,{id:proof.data.selection.customerId});Object.assign(proof.data.customer.account,{id:proof.data.selection.accountId,currency:proof.data.selection.currency});rejects(()=>addBusinessSalesBasketLine(basket,proof,'1'),'SCOPE_CHANGED');
 }
 for(const mutate of [p=>{p.data.customer.name='Changed';},p=>{p.data.customer.account.balanceExact='-3.00000000';p.data.customer.account.amountExact='3.00000000';}]){const proof=verified();mutate(proof);rejects(()=>addBusinessSalesBasketLine(basket,proof,'1'),'CUSTOMER_CHANGED');}
});
test('changed source price, stock or product identity cannot silently update an existing basket',()=>{
 const basket=addBusinessSalesBasketLine(emptyBusinessSalesBasket(),verified(),'1');rejects(()=>addBusinessSalesBasketLine(basket,verified({price:'3.00000000'}),'1'),'PRICE_CHANGED');
 for(const mutate of [p=>{p.data.product.stockQuantityExact='101.00000000';},p=>{p.data.product.stockCode='NEW-CODE';},p=>{p.data.product.name='Changed name';}]){const proof=verified();mutate(proof);rejects(()=>addBusinessSalesBasketLine(basket,proof,'1'),'PRODUCT_CHANGED');}
});
test('set/remove are pure and respect aggregate stock; removing the last line clears its scope',()=>{
 const first=addBusinessSalesBasketLine(emptyBusinessSalesBasket(),verified(),'2'),changed=setBusinessSalesBasketQuantity(first,first.lines[0].key,'4');assert.equal(first.lines[0].quantity,'2');assert.equal(changed.lines[0].quantity,'4');assert.equal(changed.productTotalExact8,'8.49382712');
 const empty=removeBusinessSalesBasketLine(changed,changed.lines[0].key);assert.deepEqual(empty,emptyBusinessSalesBasket());rejects(()=>removeBusinessSalesBasketLine(first,'foreign'),'LINE_NOT_FOUND');rejects(()=>setBusinessSalesBasketQuantity(first,'foreign','2'),'LINE_NOT_FOUND');rejects(()=>setBusinessSalesBasketQuantity(first,first.lines[0].key,'0'),'QUANTITY_INVALID');
});
test('exact arithmetic does not reproduce native unit-price4 rounding or use binary floating point',()=>{
 const basket=addBusinessSalesBasketLine(emptyBusinessSalesBasket(),verified({price:'0.12345678',stock:'1000.00000000'}),'1000');assert.equal(basket.productTotalExact8,'123.45678000');assert.notEqual(basket.productTotalExact8,'123.50000000');assert.equal(basket.nativeInvoiceTotalVerified,false);
 const big=addBusinessSalesBasketLine(emptyBusinessSalesBasket(),verified({price:'9007199254740993.12345678',stock:'10.00000000'}),'3');assert.equal(big.productTotalExact8,'27021597764222979.37037034');
});
test('original envelopes remain caller-owned; later caller mutation cannot change retained evidence or totals',()=>{
 const proof=verified(),basket=addBusinessSalesBasketLine(emptyBusinessSalesBasket(),proof,'1');proof.data.product.stockCode='caller-changed';proof.data.price.priceExact='99.00000000';assert.equal(basket.lines[0].product.stockCode,'0012 MARKA');assert.equal(basket.lines[0].evidence.data.price.priceExact,'2.12345678');assert.equal(basket.productTotalExact8,'2.12345678');
});
test('tampered derived basket state is rejected instead of becoming a different total, scope or line',()=>{
 const basket=addBusinessSalesBasketLine(emptyBusinessSalesBasket(),verified(),'1');
 for(const mutate of [b=>{b.productTotalExact8='0.00000000';},b=>{b.scope.accountId='8';},b=>{b.lines[0].unitPriceExact8='9.00000000';},b=>{b.lines[0].quantity='2';},b=>{b.writeAuthorized=true;}]){const bad=structuredClone(basket);mutate(bad);rejects(()=>addBusinessSalesBasketLine(bad,verified(),'1'),'STATE_INVALID');}
 const empty=structuredClone(emptyBusinessSalesBasket());empty.productTotalExact8='1.00000000';rejects(()=>addBusinessSalesBasketLine(empty,verified(),'1'),'STATE_INVALID');
});
