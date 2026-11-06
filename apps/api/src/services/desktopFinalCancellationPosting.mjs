// Not mounted. Completes selected-account posting only AFTER private native
// cancellation. verifyPlan must attest this exact frozen plan, private native
// phase and current physical scope; a plain calculation grants no authority.
const fail=()=>{throw Error('DESKTOP_FINAL_CANCEL_POST_UNAVAILABLE');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
export const DESKTOP_FINAL_CANCELLATION_POST_SQL=`SET NOCOUNT ON;
IF CONVERT(varbinary(256),DB_NAME())<>CONVERT(varbinary(256),@targetDatabase)
 OR CONVERT(varchar(20),@@SPID)<>@sessionId OR CONVERT(varchar(20),CURRENT_TRANSACTION_ID())<>@transactionId OR @@TRANCOUNT<>1 OR XACT_STATE()<>1
 THROW 51981,'DESKTOP_FINAL_CANCEL_PHYSICAL',1;
DECLARE @invoice bigint=CONVERT(bigint,@invoiceId),@customer bigint=CONVERT(bigint,@customerId),@entity bigint=CONVERT(bigint,@entityId),@account bigint=CONVERT(bigint,@accountId),@actor bigint=CONVERT(bigint,@actorId),@originalMovement bigint=CONVERT(bigint,@originalCustomerMovementId),
 @total decimal(18,4)=CONVERT(decimal(18,4),@documentAmountExact4),@amount decimal(18,4)=CONVERT(decimal(18,4),@accountAmountExact4),@try decimal(18,4)=CONVERT(decimal(18,4),@amountTryExact4),@effect decimal(18,4)=CONVERT(decimal(18,4),@negativeBalanceEffectExact4),
 @accountBefore decimal(28,8)=CONVERT(decimal(28,8),@accountBeforeExact8),@accountAfter decimal(28,8)=CONVERT(decimal(28,8),@accountAfterExact8),@customerBefore decimal(18,4)=CONVERT(decimal(18,4),@customerBeforeExact4),@customerAfter decimal(18,4)=CONVERT(decimal(18,4),@customerAfterExact4),@preserve bit=CONVERT(bit,@preserveLegacyBalance);
DECLARE @lines TABLE(product bigint NOT NULL PRIMARY KEY,item bigint NOT NULL UNIQUE,original bigint NOT NULL UNIQUE,quantity decimal(18,3) NOT NULL,stockBefore decimal(18,3) NOT NULL,stockAfter decimal(18,3) NOT NULL,cost decimal(18,4) NOT NULL,reverseTry decimal(18,4) NOT NULL);
INSERT @lines SELECT productId,itemId,originalMovementId,quantityInExact3,stockBeforeExact3,stockAfterExact3,unitCostTryExact4,amountTryExact4 FROM OPENJSON(@stockJson) WITH(productId bigint,itemId bigint,originalMovementId bigint,quantityInExact3 decimal(18,3),stockBeforeExact3 decimal(18,3),stockAfterExact3 decimal(18,3),unitCostTryExact4 decimal(18,4),amountTryExact4 decimal(18,4));
IF @total<=0 OR @amount<=0 OR @try<=0 OR @effect<>-@amount OR @accountAfter<>@accountBefore-CONVERT(decimal(28,8),@amount)
 OR (@preserve=1 AND (@accountCurrency=@customerCurrency OR @customerAfter<>@customerBefore)) OR (@preserve=0 AND (@accountCurrency<>@customerCurrency OR @customerAfter<>@customerBefore-@amount))
 OR (SELECT COUNT(*) FROM @lines)<>2 OR EXISTS(SELECT 1 FROM @lines WHERE quantity<=0 OR cost<=0 OR reverseTry>0 OR stockAfter<>stockBefore+quantity)
 OR (SELECT SUM(reverseTry) FROM @lines)<>-@try
 OR NOT EXISTS(SELECT 1 FROM dbo.sales_invoices WITH(UPDLOCK,HOLDLOCK) WHERE id=@invoice AND customer_id=@customer AND party_entity_id=@entity AND party_currency_account_id=@account AND status=N'cancelled' AND document_currency=@currency AND account_currency=@accountCurrency AND customer_currency=@customerCurrency AND grand_total=@total AND account_amount=@amount AND amount_try=@try AND cancelled_at IS NOT NULL AND updated_by=@actor AND DATALENGTH(cancel_reason)=DATALENGTH(@reason) AND CONVERT(varbinary(max),cancel_reason)=CONVERT(varbinary(max),@reason))
 OR NOT EXISTS(SELECT 1 FROM dbo.customers WITH(UPDLOCK,HOLDLOCK) WHERE id=@customer AND party_entity_id=@entity AND currency_code=@customerCurrency AND balance=@customerAfter)
 OR NOT EXISTS(SELECT 1 FROM dbo.party_currency_accounts WITH(UPDLOCK,HOLDLOCK) WHERE id=@account AND customer_id=@customer AND supplier_id IS NULL AND party_entity_id=@entity AND currency_code=@accountCurrency AND current_balance=@accountBefore)
 OR (SELECT COUNT_BIG(*) FROM dbo.customer_movements WITH(UPDLOCK,HOLDLOCK) WHERE sales_invoice_id=@invoice)<>2
 OR NOT EXISTS(SELECT 1 FROM dbo.customer_movements WITH(UPDLOCK,HOLDLOCK) WHERE id=@originalMovement AND sales_invoice_id=@invoice AND customer_id=@customer AND party_entity_id=@entity AND party_currency_account_id=@account AND movement_type=N'sales_invoice' AND currency_code=@currency AND account_currency=@accountCurrency AND amount=@total AND account_amount=@amount AND balance_effect=@amount AND amount_try=@try)
 OR (SELECT COUNT_BIG(*) FROM dbo.stock_movements WITH(UPDLOCK,HOLDLOCK) WHERE source_type=N'sales_invoice' AND source_id=@invoice)<>4
 OR (SELECT COUNT_BIG(*) FROM dbo.sales_invoice_items WITH(UPDLOCK,HOLDLOCK) WHERE sales_invoice_id=@invoice)<>2
 THROW 51982,'DESKTOP_FINAL_CANCEL_NATIVE_OUTCOME',1;
IF EXISTS(SELECT 1 FROM @lines l WHERE
 NOT EXISTS(SELECT 1 FROM dbo.products p WITH(UPDLOCK,HOLDLOCK) WHERE p.id=l.product AND p.current_stock_qty=l.stockAfter)
 OR NOT EXISTS(SELECT 1 FROM dbo.sales_invoice_items x WITH(UPDLOCK,HOLDLOCK) WHERE x.id=l.item AND x.sales_invoice_id=@invoice AND x.product_id=l.product AND x.quantity=l.quantity AND x.average_cost_try_snapshot=l.cost)
 OR NOT EXISTS(SELECT 1 FROM dbo.stock_movements old WITH(UPDLOCK,HOLDLOCK) WHERE old.id=l.original AND old.product_id=l.product AND old.source_type=N'sales_invoice' AND old.source_id=@invoice AND old.movement_type=N'out' AND old.quantity_in=0 AND old.quantity_out=l.quantity AND old.quantity_net=-l.quantity AND old.unit_cost_try=l.cost AND old.amount_try=-l.reverseTry)
 OR (SELECT COUNT_BIG(*) FROM dbo.stock_movements m WITH(UPDLOCK,HOLDLOCK) JOIN dbo.stock_movements old WITH(UPDLOCK,HOLDLOCK) ON old.id=l.original WHERE m.product_id=l.product AND m.source_type=N'sales_invoice' AND m.source_id=@invoice AND m.movement_type=N'in' AND m.quantity_in=l.quantity AND m.quantity_out=0 AND m.quantity_net=l.quantity AND m.unit_cost_try=l.cost AND m.average_cost_try_after=l.cost AND m.amount_try=l.reverseTry AND m.created_by=@actor AND m.customer_id=@customer AND m.currency_code=old.currency_code AND m.unit_price=old.unit_price AND m.document_date=old.document_date)<>1)
 THROW 51983,'DESKTOP_FINAL_CANCEL_STOCK_OUTCOME',1;
IF (SELECT COUNT_BIG(*) FROM dbo.customer_movements m WITH(UPDLOCK,HOLDLOCK) JOIN dbo.customer_movements old WITH(UPDLOCK,HOLDLOCK) ON old.id=@originalMovement
 WHERE m.sales_invoice_id=@invoice AND m.customer_id=@customer AND m.movement_type=N'sales_invoice_cancel' AND m.created_by=@actor AND m.currency_code=@currency AND m.account_currency=@accountCurrency AND m.amount=@total AND m.account_amount=@amount AND m.balance_effect=@effect AND m.amount_try=@try AND m.document_exchange_rate_snapshot=old.document_exchange_rate_snapshot AND m.account_exchange_rate_snapshot=old.account_exchange_rate_snapshot AND m.document_date=old.document_date AND m.party_entity_id IS NULL AND m.party_currency_account_id IS NULL)<>1
 OR (SELECT COUNT_BIG(*) FROM dbo.audit_logs WITH(UPDLOCK,HOLDLOCK) WHERE action=N'sales_invoice_cancelled' AND entity_type=N'sales_invoice' AND entity_id=@invoice AND actor_user_id=@actor AND DATALENGTH(JSON_VALUE(CASE WHEN ISJSON(after_json)=1 THEN after_json ELSE N'{}' END,N'$.reason'))=DATALENGTH(@reason) AND CONVERT(varbinary(max),JSON_VALUE(CASE WHEN ISJSON(after_json)=1 THEN after_json ELSE N'{}' END,N'$.reason'))=CONVERT(varbinary(max),@reason) AND JSON_VALUE(CASE WHEN ISJSON(after_json)=1 THEN after_json ELSE N'{}' END,N'$.desktopCancellationRequestId')=@requestId)<>1
 THROW 51984,'DESKTOP_FINAL_CANCEL_LEDGER_OUTCOME',1;
UPDATE dbo.customer_movements SET party_entity_id=@entity,party_currency_account_id=@account WHERE sales_invoice_id=@invoice AND movement_type=N'sales_invoice_cancel' AND created_by=@actor AND party_entity_id IS NULL AND party_currency_account_id IS NULL;
IF @@ROWCOUNT<>1 THROW 51985,'DESKTOP_FINAL_CANCEL_MOVEMENT_STAMP',1;
UPDATE dbo.party_currency_accounts SET current_balance=current_balance-CONVERT(decimal(28,8),@amount) WHERE id=@account AND customer_id=@customer AND party_entity_id=@entity AND supplier_id IS NULL AND currency_code=@accountCurrency AND current_balance=@accountBefore;
IF @@ROWCOUNT<>1 THROW 51986,'DESKTOP_FINAL_CANCEL_ACCOUNT_CAS',1;
IF NOT EXISTS(SELECT 1 FROM dbo.party_currency_accounts WHERE id=@account AND current_balance=@accountAfter) THROW 51986,'DESKTOP_FINAL_CANCEL_ACCOUNT_READBACK',1;
UPDATE dbo.desktop_sale_workflows SET state='CANCELLED' OUTPUT CONVERT(varchar(18),CONVERT(binary(8),inserted.version),1) version WHERE invoice_id=@invoice AND state='COMPLETED' AND version=CONVERT(binary(8),@expectedVersion,1);
IF @@ROWCOUNT<>1 THROW 51987,'DESKTOP_FINAL_CANCEL_WORKFLOW_CAS',1;`;
export function createDesktopFinalCancellationPosting({sql,verifyPlan}={}){
 if(typeof sql?.Request!=='function'||typeof sql?.NVarChar!=='function'||typeof verifyPlan!=='function')fail();
 return async function post({transaction,scope,plan}={}){
  if(!transaction||!scope||!plan||!Object.isFrozen(plan)||!id(plan.invoiceId)||await verifyPlan({transaction,scope,plan})!==true)fail();
  const m=plan.customerMovement,values={targetDatabase:scope.targetDatabase,sessionId:String(scope.sessionId),transactionId:scope.transactionId,actorId:scope.actorId,requestId:scope.requestId,invoiceId:plan.invoiceId,customerId:plan.customerId,entityId:plan.entityId,accountId:plan.accountId,currency:plan.currency,accountCurrency:plan.accountCurrency,customerCurrency:plan.customerCurrency,documentAmountExact4:m?.amountExact4,accountAmountExact4:m?.accountAmountExact4,amountTryExact4:m?.amountTryExact4,negativeBalanceEffectExact4:m?.balanceEffectExact4,originalCustomerMovementId:m?.originalMovementId,accountBeforeExact8:plan.accountBeforeExact8,accountAfterExact8:plan.accountAfterExact8,customerBeforeExact4:plan.customerBeforeExact4,customerAfterExact4:plan.customerAfterExact4,preserveLegacyBalance:plan.preserveLegacyBalance?'1':'0',reason:plan.reason,expectedVersion:plan.expectedVersion,stockJson:JSON.stringify(plan.stock)};
  const request=new sql.Request(transaction);for(const [key,value] of Object.entries(values)){if(typeof value!=='string'||value.length>(key==='stockJson'?8192:key==='reason'?250:128))fail();request.input(key,sql.NVarChar(key==='stockJson'?sql.MAX:key==='reason'?250:128),value);}
  const rows=(await request.query(DESKTOP_FINAL_CANCELLATION_POST_SQL))?.recordset;
  if(!Array.isArray(rows)||rows.length!==1||typeof rows[0]?.version!=='string'||!/^0x[0-9A-F]{16}$/.test(rows[0].version))fail();
  if(await verifyPlan({transaction,scope,plan})!==true)fail();return rows[0].version;
 };
}
