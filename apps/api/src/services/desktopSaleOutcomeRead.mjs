// Source-only post-finalization readback for the first synthetic TRY sale.
// The caller must keep the verified sale transaction open through commit.
const fail=()=>{throw Error('DESKTOP_SALE_OUTCOME_UNAVAILABLE');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
export const DESKTOP_SALE_OUTCOME_READ_SQL=`SET NOCOUNT ON;
SELECT CONVERT(varchar(20),i.id) invoiceId,CONVERT(varchar(20),i.id) receiptInvoiceId,UPPER(i.status COLLATE Latin1_General_100_BIN2) status,CONVERT(varchar(20),i.customer_id) invoiceCustomerId,
 CONVERT(varchar(20),ii.product_id) productId,CONVERT(varchar(20),i.party_entity_id) entityId,CONVERT(varchar(20),i.party_currency_account_id) accountId,i.document_currency currency,
 CONVERT(varchar(20),sm.source_id) stockMovementInvoiceId,CONVERT(varchar(20),sm.product_id) stockMovementProductId,sm.movement_type stockMovementType,sm.currency_code stockMovementCurrency,CONVERT(char(10),sm.document_date,23) stockMovementDocumentDate,CONVERT(varchar(40),sm.quantity_in) stockMovementInExact3,CONVERT(varchar(40),sm.quantity_net) stockMovementNetExact3,CONVERT(varchar(20),cm.sales_invoice_id) customerMovementInvoiceId,CONVERT(varchar(20),cm.customer_id) movementCustomerId,
 CONVERT(varchar(20),cm.party_entity_id) movementEntityId,CONVERT(varchar(20),cm.party_currency_account_id) movementAccountId,a.currency_code accountCurrency,cm.currency_code movementCurrency,
 CONVERT(varchar(40),ii.quantity) quantityExact3,CONVERT(varchar(40),sm.quantity_out) stockMovementOutExact3,CONVERT(varchar(40),ii.unit_price) unitPriceExact4,CONVERT(varchar(40),i.grand_total) totalExact4,
 CONVERT(varchar(40),cm.amount) customerMovementAmountExact4,CONVERT(varchar(40),CONVERT(decimal(28,8),cm.balance_effect)) accountPostingAmountExact8,
 CONVERT(varchar(40),i.subtotal) subtotalExact4,CONVERT(varchar(40),i.discount_rate) discountRateExact4,CONVERT(varchar(40),i.discount_total) discountTotalExact4,CONVERT(varchar(40),i.estimated_profit_try) estimatedProfitTryExact4,
 CONVERT(varchar(40),sm.amount_try) stockMovementAmountTryExact4,CONVERT(varchar(40),sm.unit_cost_try) stockMovementUnitCostTryExact4,CONVERT(varchar(40),sm.average_cost_try_after) stockMovementAverageCostTryAfterExact4,CONVERT(varchar(40),ii.average_cost_try_snapshot) unitCostTryExact4,CONVERT(varchar(40),ii.gross_profit_try) grossProfitTryExact4,
 i.account_currency invoiceAccountCurrency,CONVERT(varchar(40),i.account_amount) invoiceAccountAmountExact4,CONVERT(varchar(40),i.amount_try) invoiceAmountTryExact4,CONVERT(varchar(40),i.exchange_rate_snapshot) documentRateExact8,CONVERT(varchar(40),i.account_exchange_rate_snapshot) accountRateExact8,c.currency_code customerCurrency,cm.account_currency movementAccountCurrency,CONVERT(varchar(40),cm.account_amount) movementAccountAmountExact4,CONVERT(varchar(40),cm.amount_try) movementAmountTryExact4,CONVERT(varchar(40),cm.document_exchange_rate_snapshot) movementDocumentRateExact8,CONVERT(varchar(40),cm.account_exchange_rate_snapshot) movementAccountRateExact8,
 @stockBefore stockBeforeExact3,CONVERT(varchar(40),p.current_stock_qty) stockAfterExact3,@customerBefore customerBeforeExact4,CONVERT(varchar(40),c.balance) customerAfterExact4,
 @accountBefore accountBeforeExact8,CONVERT(varchar(40),a.current_balance) accountAfterExact8,
 (SELECT COUNT(*) FROM dbo.sales_invoice_items x WHERE x.sales_invoice_id=i.id) invoiceItemCount,
 (SELECT COUNT(*) FROM dbo.stock_movements x WHERE x.source_type=N'sales_invoice' AND x.source_id=i.id) stockMovementCount,
 (SELECT COUNT(*) FROM dbo.customer_movements x WHERE x.sales_invoice_id=i.id AND x.movement_type=N'sales_invoice') customerMovementCount,
 (SELECT COUNT(*) FROM dbo.customer_movements x WHERE x.sales_invoice_id=i.id AND x.movement_type=N'sales_invoice' AND x.party_currency_account_id=a.id AND x.party_entity_id=c.party_entity_id) accountPostingCount
FROM dbo.sales_invoices i WITH(HOLDLOCK) JOIN dbo.sales_invoice_items ii WITH(HOLDLOCK) ON ii.sales_invoice_id=i.id
JOIN dbo.customers c WITH(HOLDLOCK) ON c.id=i.customer_id JOIN dbo.party_currency_accounts a WITH(HOLDLOCK) ON a.id=i.party_currency_account_id AND a.customer_id=c.id AND a.party_entity_id=c.party_entity_id AND a.supplier_id IS NULL
JOIN dbo.products p WITH(HOLDLOCK) ON p.id=ii.product_id
JOIN dbo.stock_movements sm WITH(HOLDLOCK) ON sm.source_type=N'sales_invoice' AND sm.source_id=i.id AND sm.product_id=p.id
JOIN dbo.customer_movements cm WITH(HOLDLOCK) ON cm.sales_invoice_id=i.id AND cm.customer_id=c.id AND cm.movement_type=N'sales_invoice'
WHERE i.id=TRY_CONVERT(bigint,@invoiceId);`;
export function createDesktopSaleOutcomeRead({sql,verifyScope}={}){
 if(typeof sql?.Request!=='function'||typeof sql?.NVarChar!=='function'||typeof verifyScope!=='function')fail();
 return async function read({transaction,scope,invoiceId}={}){
  if(!transaction||!scope||!id(invoiceId)||typeof scope.stockBeforeExact3!=='string'||typeof scope.customerBeforeExact4!=='string'||typeof scope.accountBeforeExact8!=='string'||await verifyScope({transaction,scope,invoiceId})!==true)fail();
  const r=await new sql.Request(transaction).input('invoiceId',sql.NVarChar(20),invoiceId).input('stockBefore',sql.NVarChar(40),scope.stockBeforeExact3).input('customerBefore',sql.NVarChar(40),scope.customerBeforeExact4).input('accountBefore',sql.NVarChar(40),scope.accountBeforeExact8).query(DESKTOP_SALE_OUTCOME_READ_SQL);
  if(!Array.isArray(r?.recordset)||r.recordset.length!==1)fail();return r.recordset[0];
 };
}
export const DESKTOP_SALE_OUTCOME_READ_LIMITS=Object.freeze({sourceOnly:true,receiptIsNativeInvoice:true,initialSyntheticAcceptanceCurrency:'TRY',requiresRegisteredBoundScope:true,realSqlVerified:false});
