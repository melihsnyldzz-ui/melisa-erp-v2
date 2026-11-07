// Pure purchase preparation only. A caller must lock and authorize every input
// in the owning transaction; this module never issues a native capability.
import {planDesktopLinkedPurchase} from '../../../../packages/shared/src/desktopGoodsReceiptModel.mjs';

const fail=()=>{throw Error('DESKTOP_NATIVE_PURCHASE_PREPARATION_REJECTED');};
const text=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max&&v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v);
function object(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).length!==keys.length||keys.some(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !d?.enumerable||!Object.hasOwn(d,'value');}))fail();}
function array(v){if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||Reflect.ownKeys(v).length!==v.length+1)fail();return Array.from({length:v.length},(_,i)=>{const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))fail();return d.value;});}

export function prepareDesktopNativePurchase({phase,command,locked,products}={}){
 if(!['draft','finalize'].includes(phase))fail();object(locked,['receipt','account','rates']);object(locked.receipt,['id','state','supplierId','lines']);
 if(locked.receipt.state!==(phase==='draft'?'draft':'accepted'))fail();
 // For draft calculation only, accepted is prospective; no state or authority
 // is created by this temporary in-memory projection.
 const projected=phase==='draft'?{...locked,receipt:{...locked.receipt,state:'accepted'}}:locked;
 const plan=planDesktopLinkedPurchase(command,projected);
 if(plan.documentCurrency!=='TRY'||plan.accountCurrency!=='TRY'||plan.documentRateExact8!=='1.00000000'||plan.accountRateExact8!=='1.00000000')fail();
 const lockedLines=array(locked.receipt.lines);if(lockedLines.length!==plan.lines.length||plan.projection.lines.length!==plan.lines.length)fail();
 for(let i=0;i<plan.lines.length;i++){const matches=lockedLines.filter(line=>line.lineId===plan.lines[i].receiptLineId);if(matches.length!==1||matches[0].costTryExact4!==plan.projection.lines[i].unitCostTryExact4)fail();}
 const cards=array(products),lines=plan.lines;if(cards.length!==lines.length)fail();for(const card of cards)object(card,['id','stockCode','name','barcode','active']);
 const items=lines.map(line=>{const matches=cards.filter(card=>card.id===line.productId);if(matches.length!==1)fail();const card=matches[0];if(card.active!==true||!text(card.stockCode,50)||!text(card.name,250)||(card.barcode!==null&&!text(card.barcode,80)))fail();return Object.freeze({productId:Number(line.productId),stockCode:card.stockCode,productName:card.name,barcode:card.barcode??'',quantity:Number(line.quantityBaseExact3),currency:'TRY',purchasePrice:Number(line.purchasePriceExact4),lineDiscountRate:Number(line.lineDiscountRateExact4)});});
 const invoice=Object.freeze({supplierId:Number(plan.supplierId),supplierCurrency:'TRY',documentCurrency:'TRY',documentNo:plan.documentNo,documentDate:plan.documentDate,exchangeRate:1,accountExchangeRate:1,invoiceDiscountType:plan.invoiceDiscountType,invoiceDiscountRate:Number(plan.invoiceDiscountRateExact4),invoiceDiscountAmount:Number(plan.invoiceDiscountAmountExact4),supplierDiscountRate:Number(plan.supplierDiscountRateExact4),items:Object.freeze(items)});
 return Object.freeze({invoice,expected:plan,sourceOnly:true});
}
