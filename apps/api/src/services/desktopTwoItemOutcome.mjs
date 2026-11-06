import {DESKTOP_SALE_OUTCOME_READ_SQL} from './desktopSaleOutcomeRead.mjs';
const fail=()=>{throw Error('DESKTOP_TWO_ITEM_OUTCOME_REJECTED');};
export function assertDesktopTwoItemOutcome(rows,{invoiceId,expected,documentDate}={}){
 if(!Array.isArray(rows)||rows.length!==2||!Array.isArray(expected?.lines)||expected.lines.length!==2)fail();
 const seen=new Set();for(const r of rows){const line=expected.lines.find(l=>l.productId===r.productId);if(!line||seen.has(r.productId))fail();seen.add(r.productId);
  if(r.invoiceId!==invoiceId||r.receiptInvoiceId!==invoiceId||r.stockMovementInvoiceId!==invoiceId||r.customerMovementInvoiceId!==invoiceId||r.status!=='FINALIZED'||r.invoiceCustomerId!==expected.customerId||r.movementCustomerId!==expected.customerId||r.entityId!==expected.entityId||r.accountId!==expected.accountId||r.movementEntityId!==expected.entityId||r.movementAccountId!==expected.accountId||r.stockMovementProductId!==line.productId||r.stockMovementType!=='out'||r.stockMovementInExact3!=='0.000'||r.stockMovementOutExact3!==line.quantityExact3||r.stockMovementNetExact3!=='-'+line.quantityExact3||r.stockMovementDocumentDate!==documentDate||[r.currency,r.accountCurrency,r.movementCurrency,r.stockMovementCurrency].some(c=>c!=='TRY')||r.quantityExact3!==line.quantityExact3||r.unitPriceExact4!==line.unitPriceExact4||r.totalExact4!==expected.totalExact4||r.customerMovementAmountExact4!==expected.totalExact4||r.accountPostingAmountExact8!==expected.totalExact4+'0000'||r.stockAfterExact3!==line.stockAfterExact3||r.customerAfterExact4!==expected.customerAfterExact4||r.accountAfterExact8!==expected.accountAfterExact8||r.invoiceItemCount!==2||r.stockMovementCount!==2||r.customerMovementCount!==1||r.accountPostingCount!==1)fail();
  if(expected.discountRateExact4!==undefined&&(r.subtotalExact4!==expected.subtotalExact4||r.discountRateExact4!==expected.discountRateExact4||r.discountTotalExact4!==expected.discountTotalExact4||r.estimatedProfitTryExact4!==expected.estimatedProfitTryExact4||r.stockMovementAmountTryExact4!==line.salesAmountTryExact4||r.stockMovementUnitCostTryExact4!==line.unitCostTryExact4||r.stockMovementAverageCostTryAfterExact4!==line.unitCostTryExact4||r.unitCostTryExact4!==line.unitCostTryExact4||r.grossProfitTryExact4!==line.grossProfitTryExact4))fail();
 }return true;
}
export function createDesktopTwoItemOutcomeReader({sql,verifyScope}={}){
 if(typeof sql?.Request!=='function'||typeof sql?.NVarChar!=='function'||typeof verifyScope!=='function')fail();
 return async function read({transaction,scope,invoiceId,documentDate}={}){
  if(await verifyScope({transaction,scope,invoiceId})!==true)fail();
  const result=await new sql.Request(transaction).input('invoiceId',sql.NVarChar(20),invoiceId).input('stockBefore',sql.NVarChar(40),'0.000').input('customerBefore',sql.NVarChar(40),scope.customerBeforeExact4).input('accountBefore',sql.NVarChar(40),scope.accountBeforeExact8).query(DESKTOP_SALE_OUTCOME_READ_SQL);
  assertDesktopTwoItemOutcome(result?.recordset,{invoiceId,expected:scope,documentDate});return true;
 };
}
