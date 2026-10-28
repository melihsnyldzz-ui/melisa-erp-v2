import {validateBusinessSaleReadEnvelope} from '../../../api/src/services/canonicalBusinessSaleReadModel.mjs';
import {businessSalePreviewSelectionAllowed} from './businessWorkface.mjs';
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

// Source selection is input to the native owner, never a write grant. Keep the
// explicit account and exact quote; two tiers for one product cannot merge.
export function businessSalesNativeSelection(basket,documentDate){
 entries(basket);
 const value={customerId:basket.scope?.customerId,customerAccountId:basket.scope?.accountId,documentDate,currency:basket.scope?.currency,items:basket.lines.map(l=>({productId:l.selection.productId,quoteId:l.selection.priceId,quantityExact3:l.quantity+'.000'}))};
 if(!businessSalePreviewSelectionAllowed(value))fail('NATIVE_SELECTION_INVALID');
 return snapshot(value);
}
export function validateBusinessSalesNativePreview(result,selection,basket){
 const expected=businessSalesNativeSelection(basket,selection?.documentDate),same=(a,b)=>a?.customerId===b.customerId&&a.customerAccountId===b.customerAccountId&&a.currency===b.currency&&a.documentDate===b.documentDate&&JSON.stringify(a.items)===JSON.stringify(b.items);
 if(!businessSalePreviewSelectionAllowed(selection)||!same(selection,expected))fail('NATIVE_SELECTION_CHANGED');
 const c=result?.context,p=result?.preview,cap=c?.capabilities,customer=c?.scope?.customer,hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),amount=v=>typeof v==='string'&&/^(?:0|[1-9]\d{0,13})\.\d{4}$/.test(v),date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 const first=basket.lines[0].evidence.data;
 if(c?.meta?.schemaVersion!=='melisa-work-trade.v1'||c.meta.source!=='canonical-business-test'||c.meta.operationOrigin!=='CANONICAL_TEST_BUSINESS_SALE'||c.meta.date!==selection.documentDate||!hash(c.revision)||cap?.canCreate!==true||typeof cap.canFinalize!=='boolean'||typeof cap.canCancel!=='boolean'||cap.canCollect!==false||cap.canCancelCollection!==false||c.scope?.synthetic!==false||c.scope.operationOrigin!=='CANONICAL_TEST_BUSINESS_SALE'||customer?.id!==selection.customerId||customer.accountId!==selection.customerAccountId||customer.currency!==selection.currency||customer.writeEligible!==true||customer.balanceExact8!==first.customer.account.balanceExact||customer.name!==first.customer.name||!Array.isArray(c.scope.accounts)||c.scope.accounts.length!==0||!Array.isArray(c.scope.products)||c.scope.products.length!==selection.items.length||JSON.stringify(c.supportedCurrencies)!==JSON.stringify([selection.currency])||c.limits?.maxItems!==2||c.limits.maxQuantityPerLine!==5||c.limits.maxInvoiceAmountExact4!=='500.0000'||c.limits.maxAmountTryExact4!=='500.0000')fail('NATIVE_CONTEXT_INVALID');
 if(!p||!same(p.selection,selection)||p.scopeRevision!==c.revision||!hash(p.previewHash)||p.writable!==true||p.currency!==selection.currency||!Array.isArray(p.items)||p.items.length!==selection.items.length||!['subtotalExact4','grandTotalExact4','amountTryExact4'].every(k=>amount(p[k])))fail('NATIVE_PREVIEW_INVALID');
 const rate=c.rate,settlement=p.settlement;
 if(rate?.currency!==selection.currency||!exact(rate.rateExact8)||units(rate.rateExact8)<=0n||!date(rate.rateDate)||rate.rateDate>selection.documentDate||selection.currency==='TRY'&&rate.rateExact8!=='1.00000000'||settlement?.accountId!==selection.customerAccountId||settlement.documentCurrency!==selection.currency||settlement.accountCurrency!==selection.currency||settlement.documentRateExact8!==rate.rateExact8||settlement.accountRateExact8!==rate.rateExact8)fail('NATIVE_RATE_INVALID');
 let total=0n;
 for(let n=0;n<selection.items.length;n++){
  const selected=selection.items[n],line=basket.lines[n],product=c.scope.products[n],item=p.items[n],quote=product?.prices?.[0];
  const price4=(units(line.unitPriceExact8)+5000n)/10000n,quantity=BigInt(line.quantity),line4=price4*quantity;
  if(product?.id!==selected.productId||product.stockCode!==line.product.stockCode||product.name!==line.product.name||product.writeEligible!==true||product.unit?.label!=='ADET'||product.unit.factorExact8!=='1.00000000'||typeof product.stockQuantityExact3!=='string'||!/^\d+\.\d{3}$/.test(product.stockQuantityExact3)||BigInt(product.stockQuantityExact3.replace('.',''))<quantity*1000n||BigInt(product.stockQuantityExact3.replace('.',''))*100000n!==units(line.stockQuantityExact8)||!Array.isArray(product.prices)||product.prices.length!==1||quote.quoteId!==selected.quoteId||quote.currency!==selection.currency||quote.unitPriceExact8!==line.unitPriceExact8||item?.productId!==selected.productId||item.quoteId!==selected.quoteId||item.quantityExact3!==selected.quantityExact3||item.stockCode!==line.product.stockCode||item.name!==line.product.name||item.unitPriceExact8!==line.unitPriceExact8||item.unit?.label!=='ADET'||item.unit.factorExact8!=='1.00000000'||item.unit.sourceId!==line.selection.unitSourceId||!amount(item.unitPriceExact4)||BigInt(item.unitPriceExact4.replace('.',''))!==price4||!amount(item.lineTotalExact4)||BigInt(item.lineTotalExact4.replace('.',''))!==line4)fail('NATIVE_LINE_CHANGED');
  total+=line4;
 }
 if(total<=0n||total>5000000n||p.subtotalExact4!==p.grandTotalExact4||BigInt(p.grandTotalExact4.replace('.',''))!==total||BigInt(p.amountTryExact4.replace('.',''))!==(total*units(rate.rateExact8)+50000000n)/100000000n||BigInt(p.amountTryExact4.replace('.',''))<=0n||BigInt(p.amountTryExact4.replace('.',''))>5000000n)fail('NATIVE_TOTAL_INVALID');
 return snapshot({documentDate:selection.documentDate,currency:p.currency,grandTotalExact4:p.grandTotalExact4,amountTryExact4:p.amountTryExact4,rateExact8:rate.rateExact8,scopeRevision:c.revision,previewHash:p.previewHash,readOnly:true,canSave:false});
}
