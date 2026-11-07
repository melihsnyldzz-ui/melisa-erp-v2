// Pure validation/projection only. The caller must supply locked, authorized
// records from the same transaction; client claims are never authority.
import {desktopSeriesPieces} from './desktopSeriesUnits.mjs';
import {getPurchaseTotals} from './purchaseDiscounts.mjs';
import {calculateCurrencySettlement} from './currencySettlement.mjs';

const fail=()=>{throw Object.assign(Error('DESKTOP_GOODS_RECEIPT_INVALID'),{code:'DESKTOP_GOODS_RECEIPT_INVALID'});};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const currency=v=>['TRY','USD','EUR'].includes(v);
const text=(v,max)=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
function shape(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).length!==keys.length||keys.some(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !d?.enumerable||!Object.hasOwn(d,'value');}))fail();}
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))fail();const [y,m,d]=v.split('-').map(Number),t=new Date(Date.UTC(y,m-1,d));if(y<1900||t.getUTCFullYear()!==y||t.getUTCMonth()!==m-1||t.getUTCDate()!==d)fail();return v;}
function decimal(v,scale,{positive=false,max=9007199254740991n}={}){if(typeof v!=='string'||!new RegExp(`^(0|[1-9]\\d{0,15})\\.\\d{${scale}}$`).test(v))fail();const n=BigInt(v.replace('.',''));if(n>max||positive&&n===0n)fail();return n;}
function fixed(v,scale){const s=v.toString().padStart(scale+1,'0');return `${s.slice(0,-scale)}.${s.slice(-scale)}`;}
function rate(v,code){const n=decimal(v,8,{positive:true});if(code==='TRY'&&n!==100000000n)fail();return n;}
function percent(v){const n=decimal(v,4);if(n>1000000n)fail();return n;}
function array(v){if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length<1||Reflect.ownKeys(v).length!==v.length+1||Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).some(d=>!d?.enumerable||!Object.hasOwn(d,'value')))fail();return v;}
const MAX_SAFE=9007199254740991n;
const sum=values=>values.reduce((a,b)=>a+b,0n);
function bounded(n){if(n<0n||n>MAX_SAFE)fail();return n;}
const half=(n,d)=>(n+d/2n)/d;
function representable(n,scale){bounded(n);const s=fixed(n,scale),v=Number(s);if(!Number.isFinite(v)||v.toFixed(scale)!==s)fail();return s;}
function sameNative(value,n,scale=4){if(typeof value!=='number'||!Number.isFinite(value)||value.toFixed(scale)!==representable(n,scale))fail();}
// Mirrors purchaseDiscounts.mjs largest remainder allocation, including the
// input-order tie break. No float is used for authoritative projections.
function allocate(total,weights){
 const base=sum(weights);if(base===0n){if(total!==0n)fail();return weights.map(()=>0n);}
 const shares=weights.map(w=>total*w/base);let left=total-sum(shares);
 const order=weights.map((w,i)=>({i,remainder:total*w%base})).sort((a,b)=>a.remainder===b.remainder?a.i-b.i:a.remainder>b.remainder?-1:1);
 for(const row of order){if(left===0n)break;shares[row.i]++;left--;}
 if(left!==0n)fail();return shares;
}
function exactPurchaseProjection(lines,{invoiceDiscountType,invoiceRate,invoiceAmount,supplierRate,documentRate,accountRate}){
 const gross=lines.map(l=>bounded(half(decimal(l.quantityBaseExact3,3,{positive:true})*decimal(l.purchasePriceExact4,4),1000n)));
 const lineDiscount=gross.map((g,i)=>half(g*percent(lines[i].lineDiscountRateExact4),1000000n));
 const afterLine=gross.map((g,i)=>g-lineDiscount[i]);
 const subtotal=bounded(sum(gross)),lineDiscountTotal=bounded(sum(lineDiscount)),afterLineTotal=bounded(sum(afterLine));
 const invoiceDiscount=invoiceDiscountType==='amount'?invoiceAmount:half(afterLineTotal*invoiceRate,1000000n);
 if(invoiceDiscount>afterLineTotal)fail();const invoiceShares=allocate(invoiceDiscount,afterLine);
 const afterInvoice=afterLine.map((v,i)=>v-invoiceShares[i]);
 const supplierDiscount=half(sum(afterInvoice)*supplierRate,1000000n),supplierShares=allocate(supplierDiscount,afterInvoice);
 const nets=afterInvoice.map((v,i)=>v-supplierShares[i]),total=bounded(sum(nets));
 const amountTry=bounded(half(total*documentRate,100000000n)),accountAmount=bounded(half(total*documentRate,accountRate));
 const tryShares=allocate(amountTry,nets);
 const items=lines.map((line,i)=>{const qty=decimal(line.quantityBaseExact3,3,{positive:true});return {lineTotal:afterLine[i],invoiceDiscountShare:invoiceShares[i],supplierDiscountShare:supplierShares[i],documentDiscountShare:invoiceShares[i]+supplierShares[i],netLineTotal:nets[i],lineTotalTry:tryShares[i],netUnitPrice:bounded(half(nets[i]*1000n,qty)),unitCostTry:bounded(half(tryShares[i]*1000n,qty))};});
 return {subtotal,lineDiscountTotal,afterLineDiscounts:afterLineTotal,invoiceDiscountTotal:invoiceDiscount,supplierDiscountTotal:supplierDiscount,discountTotal:bounded(lineDiscountTotal+invoiceDiscount+supplierDiscount),grandTotal:total,amountTry,accountAmount,items};
}

// One center only: no warehouse picker, identity or location authority is
// represented here. Product ids are products.id; selected/base unit ids are
// desktop_local_product_units.id BIGINT keys, not legacy source_unit_id.
// costTryExact4 is TRY per base unit,
// not a line total. Native FKs, amount TRY, valuation and reconciliation are
// future adapter responsibilities and are not implemented or verified here.
// Product/unit ids, factor, costs and supplier/account ownership are locked
// database snapshots. lineId is a stable client-generated UUID, not the
// numeric native receipt-line key. The future adapter must persist and resolve
// that binding under lock. Real transaction and readback are explicitly absent.
export function prepareDesktopGoodsReceipt(command,locked){
 shape(command,['requestId','supplierId','documentDate','lines']);
 shape(locked,['supplier','products']);
 if(!uuid(command.requestId)||!id(command.supplierId))fail();date(command.documentDate);
 shape(locked.supplier,['id','active']);
 if(locked.supplier.id!==command.supplierId||locked.supplier.active!==true)fail();
 const products=array(locked.products),seen=new Set();for(const p of products)shape(p,['id','active','unitId','unitProductId','unitLabel','unitFactorExact8','costTryExact4']);
 const lines=array(command.lines).map(line=>{
  shape(line,['lineId','productId','unitId','quantityExact3']);if(!uuid(line.lineId)||!id(line.productId)||!id(line.unitId)||seen.has(line.lineId))fail();seen.add(line.lineId);
  const matches=products.filter(p=>p?.id===line.productId);if(matches.length!==1)fail();const p=matches[0];
  if(p.active!==true||p.unitId!==line.unitId||p.unitProductId!==p.id||!text(p.unitLabel,20))fail();
  decimal(p.costTryExact4,4);const q=decimal(line.quantityExact3,3,{positive:true});
  let base;if(p.unitFactorExact8==='1.00000000')base=fixed(q,3);else {if(p.unitLabel!=='SERİ')fail();base=desktopSeriesPieces(line.quantityExact3,p.unitFactorExact8);}
  return Object.freeze({lineId:line.lineId,productId:p.id,unitId:p.unitId,unitLabel:p.unitLabel,unitFactorExact8:p.unitFactorExact8,quantityExact3:line.quantityExact3,stockBaseQuantityExact3:base,costTryExact4:p.costTryExact4});
 });
 return Object.freeze({kind:'goods_draft',requestId:command.requestId,supplierId:command.supplierId,documentDate:command.documentDate,lines:Object.freeze(lines),stockEffects:Object.freeze([]),supplierCharges:0});
}

export function planDesktopGoodsReceiptApproval(command,lockedReceipt){
 shape(command,['requestId','receiptId']);if(!uuid(command.requestId)||!id(command.receiptId))fail();
 shape(lockedReceipt,['id','state','supplierId','documentDate','lines']);
 if(lockedReceipt.id!==command.receiptId||lockedReceipt.state!=='draft'||!id(lockedReceipt.supplierId))fail();date(lockedReceipt.documentDate);
 const seen=new Set();const stockEffects=array(lockedReceipt.lines).map(l=>{shape(l,['lineId','productId','stockBaseQuantityExact3','costTryExact4']);if(!uuid(l.lineId)||seen.has(l.lineId)||!id(l.productId))fail();seen.add(l.lineId);decimal(l.stockBaseQuantityExact3,3,{positive:true});decimal(l.costTryExact4,4);return Object.freeze({source:'goods_receipt',lineId:l.lineId,productId:l.productId,quantityInExact3:l.stockBaseQuantityExact3,costTryExact4:l.costTryExact4});});
 return Object.freeze({kind:'goods_approval',requestId:command.requestId,receiptId:command.receiptId,stockEffects:Object.freeze(stockEffects),supplierCharges:0});
}

// Amount preview only: no receipt identity, database state or authority is
// asserted here. Callers must independently authorize and lock selections.
export function projectDesktopPurchaseAmounts(input){
 shape(input,['lines','invoiceDiscountType','invoiceDiscountRateExact4','invoiceDiscountAmountExact4','supplierDiscountRateExact4','documentCurrency','accountCurrency','documentRateExact8','accountRateExact8']);
 if(!currency(input.documentCurrency)||!currency(input.accountCurrency))fail();
 const documentRate=rate(input.documentRateExact8,input.documentCurrency),accountRate=rate(input.accountRateExact8,input.accountCurrency);representable(documentRate,8);representable(accountRate,8);
 if(input.documentCurrency===input.accountCurrency&&input.documentRateExact8!==input.accountRateExact8)fail();
 const ir=percent(input.invoiceDiscountRateExact4),sr=percent(input.supplierDiscountRateExact4),ia=decimal(input.invoiceDiscountAmountExact4,4);
 representable(ir,4);representable(sr,4);representable(ia,4);
 if(!['rate','amount'].includes(input.invoiceDiscountType)||input.invoiceDiscountType==='rate'&&ia!==0n||input.invoiceDiscountType==='amount'&&ir!==0n)fail();
 const lines=array(input.lines).map(l=>{shape(l,['quantityBaseExact3','purchasePriceExact4','lineDiscountRateExact4']);const qty=decimal(l.quantityBaseExact3,3,{positive:true}),price=decimal(l.purchasePriceExact4,4),lineRate=percent(l.lineDiscountRateExact4);representable(qty,3);representable(price,4);representable(lineRate,4);const gross=(qty*price+500n)/1000n,native=Math.round((Number(l.quantityBaseExact3)*Number(l.purchasePriceExact4)+Number.EPSILON)*10000);if(!Number.isSafeInteger(native)||BigInt(native)!==gross)fail();return l;});
 const exact=exactPurchaseProjection(lines,{invoiceDiscountType:input.invoiceDiscountType,invoiceRate:ir,invoiceAmount:ia,supplierRate:sr,documentRate,accountRate});
 const totals=getPurchaseTotals({items:lines.map(l=>({quantity:Number(l.quantityBaseExact3),purchasePrice:Number(l.purchasePriceExact4),lineDiscountRate:Number(l.lineDiscountRateExact4)})),invoiceDiscountType:input.invoiceDiscountType,invoiceDiscountRate:Number(input.invoiceDiscountRateExact4),invoiceDiscountAmount:Number(input.invoiceDiscountAmountExact4),supplierDiscountRate:Number(input.supplierDiscountRateExact4),exchangeRate:Number(input.documentRateExact8)});
 if(totals.invoiceDiscountType!==input.invoiceDiscountType)fail();sameNative(totals.invoiceDiscountRate,ir);sameNative(totals.invoiceDiscountAmount,ia);sameNative(totals.supplierDiscountRate,sr);
 for(const key of ['subtotal','lineDiscountTotal','afterLineDiscounts','invoiceDiscountTotal','supplierDiscountTotal','discountTotal','grandTotal','amountTry'])sameNative(totals[key],exact[key]);
 sameNative(totals.stockCostEffectTry,exact.amountTry);if(totals.items.length!==exact.items.length)fail();
 for(let i=0;i<exact.items.length;i++)for(const [key,value] of Object.entries(exact.items[i]))sameNative(totals.items[i]?.[key],value);
 const totalExact4=representable(exact.grandTotal,4),amountTryExact4=representable(exact.amountTry,4),accountAmountExact4=representable(exact.accountAmount,4);
 const settlement=calculateCurrencySettlement({documentAmount:totalExact4,documentCurrency:input.documentCurrency,accountCurrency:input.accountCurrency,documentRateToTry:input.documentRateExact8,accountRateToTry:input.accountRateExact8});
 sameNative(settlement.documentAmount,exact.grandTotal);sameNative(settlement.amountTry,exact.amountTry);sameNative(settlement.accountAmount,exact.accountAmount);sameNative(settlement.documentRateToTry,documentRate,8);sameNative(settlement.accountRateToTry,accountRate,8);
 const projection=Object.freeze({subtotalExact4:representable(exact.subtotal,4),lineDiscountTotalExact4:representable(exact.lineDiscountTotal,4),invoiceDiscountTotalExact4:representable(exact.invoiceDiscountTotal,4),supplierDiscountTotalExact4:representable(exact.supplierDiscountTotal,4),lines:Object.freeze(exact.items.map(item=>Object.freeze(Object.fromEntries(Object.entries(item).map(([key,value])=>[`${key}Exact4`,representable(value,4)])))))});
 return Object.freeze({projection,totalExact4,accountAmountExact4,amountTryExact4});
}

// An accepted receipt and account/quote are server-owned locked snapshots.
// Ordered native discounts are line, invoice, supplier (purchaseDiscounts).
export function planDesktopLinkedPurchase(command,locked){
 shape(command,['requestId','receiptId','supplierId','accountId','documentNo','documentDate','documentCurrency','lines','invoiceDiscountType','invoiceDiscountRateExact4','invoiceDiscountAmountExact4','supplierDiscountRateExact4','documentRateExact8','accountRateExact8']);
 shape(locked,['receipt','account','rates']);const r=locked.receipt,a=locked.account,rates=locked.rates;
 if(!uuid(command.requestId)||!id(command.receiptId)||!id(command.supplierId)||!id(command.accountId)||!text(command.documentNo,30)||!currency(command.documentCurrency))fail();date(command.documentDate);
 shape(r,['id','state','supplierId','lines']);shape(a,['id','supplierId','currency','active']);shape(rates,['documentCurrency','accountCurrency','documentDate','documentRateExact8','accountRateExact8']);
 if(r.id!==command.receiptId||r.state!=='accepted'||r.supplierId!==command.supplierId||a.id!==command.accountId||a.supplierId!==command.supplierId||a.active!==true||!currency(a.currency)||rates.documentCurrency!==command.documentCurrency||rates.accountCurrency!==a.currency||rates.documentDate!==command.documentDate||rates.documentRateExact8!==command.documentRateExact8||rates.accountRateExact8!==command.accountRateExact8)fail();
 const available=array(r.lines),seen=new Set();for(const x of available)shape(x,['lineId','productId','unitId','baseUnitId','priceUnitId','priceUnitFactorExact8','remainingBaseExact3','costTryExact4','purchasePriceExact4','documentCurrency','lineDiscountRateExact4']);
 const lines=array(command.lines).map(l=>{shape(l,['receiptLineId','quantityBaseExact3','purchasePriceExact4','lineDiscountRateExact4']);if(!uuid(l.receiptLineId)||seen.has(l.receiptLineId))fail();seen.add(l.receiptLineId);
  const found=available.filter(x=>x.lineId===l.receiptLineId);if(found.length!==1)fail();const x=found[0];if(!id(x.productId)||!id(x.unitId)||!id(x.baseUnitId)||x.priceUnitId!==x.baseUnitId||x.priceUnitFactorExact8!=='1.00000000'||x.purchasePriceExact4!==l.purchasePriceExact4||x.documentCurrency!==command.documentCurrency||x.lineDiscountRateExact4!==l.lineDiscountRateExact4)fail();
  const qty=decimal(l.quantityBaseExact3,3,{positive:true}),remaining=decimal(x.remainingBaseExact3,3,{positive:true});decimal(x.costTryExact4,4);if(qty>remaining)fail();
  return Object.freeze({receiptLineId:l.receiptLineId,productId:x.productId,unitId:x.baseUnitId,receiptSelectedUnitId:x.unitId,quantityBaseExact3:l.quantityBaseExact3,purchasePriceExact4:l.purchasePriceExact4,lineDiscountRateExact4:l.lineDiscountRateExact4});});
 const {projection,totalExact4,accountAmountExact4,amountTryExact4}=projectDesktopPurchaseAmounts({lines:lines.map(({quantityBaseExact3,purchasePriceExact4,lineDiscountRateExact4})=>({quantityBaseExact3,purchasePriceExact4,lineDiscountRateExact4})),invoiceDiscountType:command.invoiceDiscountType,invoiceDiscountRateExact4:command.invoiceDiscountRateExact4,invoiceDiscountAmountExact4:command.invoiceDiscountAmountExact4,supplierDiscountRateExact4:command.supplierDiscountRateExact4,documentCurrency:command.documentCurrency,accountCurrency:a.currency,documentRateExact8:command.documentRateExact8,accountRateExact8:command.accountRateExact8});
 return Object.freeze({kind:'purchase_finalize',requestId:command.requestId,receiptId:r.id,supplierId:a.supplierId,accountId:a.id,documentNo:command.documentNo,documentDate:command.documentDate,documentCurrency:command.documentCurrency,accountCurrency:a.currency,documentRateExact8:command.documentRateExact8,accountRateExact8:command.accountRateExact8,invoiceDiscountType:command.invoiceDiscountType,invoiceDiscountRateExact4:command.invoiceDiscountRateExact4,invoiceDiscountAmountExact4:command.invoiceDiscountAmountExact4,supplierDiscountRateExact4:command.supplierDiscountRateExact4,lines:Object.freeze(lines),projection,totalExact4,accountAmountExact4,amountTryExact4,stockEffects:Object.freeze([]),supplierCharges:1});
}
// supplierCharges counts the single planned native movement, not a persisted
// row or a nonzero balance effect. Zero amount has zero balance effect; SQL
// row constraints and native transaction behavior remain unverified.
export const DESKTOP_GOODS_RECEIPT_MODEL_LIMITS=Object.freeze({sourceOnly:true,inventoryScope:'single_center',warehousePicker:false,warehouseIdentityImplemented:false,requiresLockedAuthorizedSnapshots:true,requiresNativeParityAndReadback:true,sqlExecutor:false,api:false,gui:false,realSqlVerified:false});
