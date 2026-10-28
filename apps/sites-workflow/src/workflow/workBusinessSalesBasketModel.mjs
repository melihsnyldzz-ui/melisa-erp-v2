import {validateBusinessSaleReadEnvelope} from '../../../api/src/services/canonicalBusinessSaleReadModel.mjs';
const schema='melisa-business-sales-basket.v1',scale=100000000n;
const error=code=>Object.assign(new Error('Sepet bilgileri doğrulanamadı.'),{code});
const fail=code=>{throw error('BUSINESS_SALE_BASKET_'+code);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const quantity=v=>{if(typeof v!=='string'||! /^[1-9]\d{0,19}$/.test(v))fail('QUANTITY_INVALID');return BigInt(v);};
const exact=v=>typeof v==='string'&&/^-?(?:0|[1-9]\d{0,19})\.\d{8}$/.test(v);
const units=v=>BigInt(v.replace('.',''));
const format=n=>{const whole=(n/scale).toString();if(whole.length>34)fail('TOTAL_RANGE');return whole+'.'+(n%scale).toString().padStart(8,'0');};
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const snapshot=v=>freeze(JSON.parse(JSON.stringify(v)));
const keyOf=s=>[s.productId,s.priceId,s.unitSourceId,s.tier].join(':');
const sameScope=(a,b)=>a.customerId===b.customerId&&a.accountId===b.accountId&&a.currency===b.currency;
const customerFingerprint=d=>JSON.stringify([d.customer.id,d.customer.code,d.customer.name,d.customer.account.id,d.customer.account.currency,d.customer.account.balanceExact,d.customer.account.debitCreditDirection,d.customer.account.amountExact,d.customer.account.reconciled]);
const productFingerprint=d=>JSON.stringify([d.product.id,d.product.stockCode,d.product.name,d.product.stockQuantityExact,d.product.unit.sourceId,d.product.unit.label,d.product.unit.factorExact8,d.product.unit.verified]);
function evidence(value){
 try{validateBusinessSaleReadEnvelope(value,value?.data?.selection);}catch{fail('EVIDENCE_INVALID');}
 const d=value.data;
 if(d.selectionVerified!==true||d.issues.length!==0)fail('SELECTION_UNVERIFIED');
 if(d.product.unit.label!=='ADET'||d.product.unit.factorExact8!=='1.00000000'||d.product.unit.verified!==true||d.product.unit.sourceId!==d.selection.unitSourceId)fail('UNIT_UNSUPPORTED');
 if(!exact(d.price.priceExact)||units(d.price.priceExact)<=0n)fail('PRICE_UNAVAILABLE');
 if(!exact(d.product.stockQuantityExact))fail('STOCK_UNKNOWN');
 if(units(d.product.stockQuantityExact)<=0n)fail('STOCK_UNAVAILABLE');
 return d;
}
function build(entries){
 let scope=null,customer=null,total=0n;
 const lines=new Map(),products=new Map(),quantities=new Map();
 for(const entry of entries){
  const q=quantity(entry.quantity),d=evidence(entry.envelope),s=d.selection;
  const nextScope={customerId:s.customerId,accountId:s.accountId,currency:s.currency},fingerprint=customerFingerprint(d);
  if(scope&&!sameScope(scope,nextScope))fail('SCOPE_CHANGED');
  if(customer!==null&&customer!==fingerprint)fail('CUSTOMER_CHANGED');
  scope??=nextScope;customer??=fingerprint;
  const product=products.get(s.productId),productProof=productFingerprint(d);
  if(product&&product.fingerprint!==productProof)fail('PRODUCT_CHANGED');
  products.set(s.productId,{fingerprint:productProof,stock:units(d.product.stockQuantityExact)});
  quantities.set(s.productId,(quantities.get(s.productId)??0n)+q);
  const key=keyOf(s),prior=lines.get(key);
  if(prior&&prior.data.price.priceExact!==d.price.priceExact)fail('PRICE_CHANGED');
  lines.set(key,{key,data:d,quantity:(prior?.quantity??0n)+q,envelope:entry.envelope});
 }
 for(const [id,q] of quantities)if(q>products.get(id).stock/scale)fail('STOCK_EXCEEDED');
 const rows=[...lines.values()].map(line=>{
  const d=line.data,amount=line.quantity*units(d.price.priceExact);total+=amount;
  return {key:line.key,selection:{...d.selection},quantity:line.quantity.toString(),unitPriceExact8:d.price.priceExact,productTotalExact8:format(amount),stockQuantityExact8:d.product.stockQuantityExact,product:{id:d.product.id,stockCode:d.product.stockCode,name:d.product.name,unit:{...d.product.unit}},evidence:snapshot(line.envelope)};
 });
 // Exact source price8 * whole quantity is a PRODUCTS-ONLY arithmetic view.
 // The native invoice path rounds its unit price to4 first; these totals do
 // not claim that policy, tax/discount/FX, stock reservation or write authority.
 return freeze({schemaVersion:schema,scope,lines:rows,productTotalExact8:format(total),totalKind:'PRODUCTS_ONLY',nativeInvoiceTotalVerified:false,writeAuthorized:false});
}
function entries(basket){
 if(!object(basket)||basket.schemaVersion!==schema||!Array.isArray(basket.lines)||basket.totalKind!=='PRODUCTS_ONLY'||basket.nativeInvoiceTotalVerified!==false||basket.writeAuthorized!==false)fail('STATE_INVALID');
 const input=basket.lines.map(line=>{if(!object(line))fail('STATE_INVALID');return {envelope:line.evidence,quantity:line.quantity};});
 const checked=build(input);
 if(checked.productTotalExact8!==basket.productTotalExact8||checked.lines.length!==basket.lines.length||(checked.scope===null?basket.scope!==null:!object(basket.scope)||!sameScope(checked.scope,basket.scope)))fail('STATE_INVALID');
 for(let i=0;i<checked.lines.length;i++){
  const a=checked.lines[i],b=basket.lines[i];
  if(a.key!==b.key||a.quantity!==b.quantity||a.unitPriceExact8!==b.unitPriceExact8||a.productTotalExact8!==b.productTotalExact8||a.stockQuantityExact8!==b.stockQuantityExact8||JSON.stringify(a.selection)!==JSON.stringify(b.selection)||JSON.stringify(a.product)!==JSON.stringify(b.product))fail('STATE_INVALID');
 }
 return input;
}
export function emptyBusinessSalesBasket(){return build([]);}
export function addBusinessSalesBasketLine(basket,envelope,quantityString){return build([...entries(basket),{envelope,quantity:quantityString}]);}
export function setBusinessSalesBasketQuantity(basket,lineKey,quantityString){
 const input=entries(basket),index=basket.lines.findIndex(line=>line.key===lineKey);if(index<0)fail('LINE_NOT_FOUND');quantity(quantityString);
 return build(input.map((entry,i)=>i===index?{...entry,quantity:quantityString}:entry));
}
export function removeBusinessSalesBasketLine(basket,lineKey){
 const input=entries(basket),index=basket.lines.findIndex(line=>line.key===lineKey);if(index<0)fail('LINE_NOT_FOUND');return build(input.filter((_entry,i)=>i!==index));
}
