// Reuses draft arithmetic with persisted prices. Reservation/packing admission
// must be checked separately from locked rows before invoking native finalize.
import {desktopTwoItemRevision,prepareDesktopTwoItemSale} from './desktopTwoItemSalePreparation.mjs';
import {prepareDesktopDiscountedTwoItemSale} from './desktopDiscountedTwoItemSale.mjs';
const fail=()=>{throw Error('DESKTOP_PERSISTED_DISPATCH_REJECTED');};
export function prepareDesktopPersistedDispatch({requestId,persisted,locked,maxDiscountRateExact4,normalizeSalesPayload}={}){
 const h=persisted?.header,items=persisted?.items;
 if(!h||!Array.isArray(items)||items.length<1||items.length>2||!locked||!Array.isArray(locked.products)||locked.products.length!==items.length||h.currency!=='TRY'||h.accountCurrency!=='TRY'||h.documentRate!=='1.00000000'||h.accountRate!=='1.00000000'||typeof h.discountRate!=='string'||!/^(?:0|[1-9]\d?)\.\d{4}$/.test(h.discountRate)||typeof h.documentNo!=='string'||!h.documentNo||h.documentNo.length>30)fail();
 const selected={customer:locked.customer,products:items.map((item,i)=>{
  const p=locked.products[i];if(!p||item.productId!==p.id)fail();
  return {...p,priceExact4:item.unitPriceExact4,stockCode:item.stockCode,name:item.name,barcode:item.barcode,averageCostTryExact4:h.discountRate==='0.0000'?item.averageCostTryExact4:p.averageCostTryExact4};
 }),reservedExact3:items.map(()=>'0.000')};
 const request={requestId,customerId:h.customerId,documentDate:h.documentDate,expectedRevision:desktopTwoItemRevision(selected),items:items.map(i=>({productId:i.productId,quantityExact3:i.quantityExact3}))};
 const prepared=h.discountRate==='0.0000'?prepareDesktopTwoItemSale(request,selected):prepareDesktopDiscountedTwoItemSale({request:{...request,discountRateExact4:h.discountRate},locked:selected,maxDiscountRateExact4,normalizeSalesPayload});
 if(h.discountTotal!==(prepared.expected.discountTotalExact4??'0.0000')||h.subtotalExact4!==(prepared.expected.subtotalExact4??prepared.expected.totalExact4))fail();
 if(prepared.expected.totalExact4!==h.totalExact4||items.some((item,i)=>item.lineTotalExact4!==prepared.expected.lines[i].lineTotalExact4))fail();
 prepared.invoice.documentNo=h.documentNo;return h.discountRate==='0.0000'?prepared:Object.freeze({...prepared,persistedAverageCostsExact4:Object.freeze(items.map(i=>i.averageCostTryExact4))});
}
