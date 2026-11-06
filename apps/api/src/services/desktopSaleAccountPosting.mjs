// Source-only, first synthetic TRY acceptance. Must execute inside the same
// already-open desktop sale transaction after native finalization. The
// desktop SQL store and its verifyScope implementation are not installed.
const fail=()=>{throw Error('DESKTOP_SALE_ACCOUNT_SCOPE_INVALID');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const dec=(v,scale)=>typeof v==='string'&&new RegExp(`^-?(?:0|[1-9]\\d{0,13})\\.\\d{${scale}}$`).test(v);
export const DESKTOP_SALE_ACCOUNT_POST_SQL=`SET NOCOUNT ON;
IF DB_NAME()<>@targetDatabase OR @@SPID<>@sessionId OR CURRENT_TRANSACTION_ID()<>@transactionId OR @@TRANCOUNT<>1 OR XACT_STATE()<>1
 THROW 51981,'DESKTOP_SALE_TRANSACTION_MISMATCH',1;
IF (SELECT COUNT_BIG(*) FROM dbo.customer_movements WITH(UPDLOCK,HOLDLOCK) WHERE sales_invoice_id=@invoiceId AND movement_type=N'sales_invoice')<>1
 OR NOT EXISTS(SELECT 1 FROM dbo.sales_invoices WITH(UPDLOCK,HOLDLOCK) WHERE id=@invoiceId AND customer_id=@customerId AND status=N'finalized' AND document_currency=N'TRY' AND grand_total=@amount AND party_entity_id IS NULL AND party_currency_account_id IS NULL)
 OR NOT EXISTS(SELECT 1 FROM dbo.customers WITH(UPDLOCK,HOLDLOCK) WHERE id=@customerId AND party_entity_id=@entityId AND currency_code=N'TRY' AND is_active=1 AND is_deleted=0 AND balance=@customerAfter)
 OR NOT EXISTS(SELECT 1 FROM dbo.party_currency_accounts WITH(UPDLOCK,HOLDLOCK) WHERE id=@accountId AND customer_id=@customerId AND supplier_id IS NULL AND party_entity_id=@entityId AND currency_code=N'TRY' AND current_balance=@accountBefore)
 OR (SELECT COUNT_BIG(*) FROM dbo.party_currency_accounts WITH(UPDLOCK,HOLDLOCK) WHERE customer_id=@customerId AND party_entity_id=@entityId AND currency_code=N'TRY')<>1
 THROW 51982,'DESKTOP_SALE_ACCOUNT_IDENTITY',1;
UPDATE dbo.customer_movements SET party_entity_id=@entityId,party_currency_account_id=@accountId
 WHERE sales_invoice_id=@invoiceId AND customer_id=@customerId AND movement_type=N'sales_invoice' AND created_by=@actorId AND currency_code=N'TRY' AND account_currency=N'TRY' AND account_amount=@amount AND balance_effect=@amount AND party_entity_id IS NULL AND party_currency_account_id IS NULL;
IF @@ROWCOUNT<>1 THROW 51983,'DESKTOP_SALE_MOVEMENT_LINK',1;
UPDATE dbo.sales_invoices SET party_entity_id=@entityId,party_currency_account_id=@accountId WHERE id=@invoiceId AND customer_id=@customerId AND party_entity_id IS NULL AND party_currency_account_id IS NULL;
IF @@ROWCOUNT<>1 THROW 51984,'DESKTOP_SALE_INVOICE_LINK',1;
UPDATE dbo.party_currency_accounts SET current_balance=current_balance+CONVERT(decimal(28,8),@amount) WHERE id=@accountId AND customer_id=@customerId AND party_entity_id=@entityId AND currency_code=N'TRY' AND current_balance=@accountBefore;
IF @@ROWCOUNT<>1 THROW 51985,'DESKTOP_SALE_ACCOUNT_UPDATE',1;
IF NOT EXISTS(SELECT 1 FROM dbo.party_currency_accounts WHERE id=@accountId AND current_balance=@accountAfter)
 THROW 51986,'DESKTOP_SALE_ACCOUNT_READBACK',1;
SELECT 1 ok;`;
export function createDesktopSaleAccountPosting({sql,verifyScope}={}){
 if(typeof sql?.Request!=='function'||typeof sql?.NVarChar!=='function'||typeof sql?.Decimal!=='function'||!sql?.BigInt||!sql?.Int||typeof verifyScope!=='function')fail();
 return async function post({transaction,scope,invoiceId}={}){
  if(!transaction||!scope||![scope.actorId,scope.customerId,scope.entityId,scope.accountId,scope.transactionId,invoiceId].every(id)||!Number.isInteger(scope.sessionId)||scope.sessionId<1||!scope.targetDatabase||typeof scope.targetDatabase!=='string'||scope.targetDatabase.length>128||scope.currency!=='TRY'||!dec(scope.totalExact4,4)||scope.totalExact4.startsWith('-')||!dec(scope.customerAfterExact4,4)||!dec(scope.accountBeforeExact8,8)||!dec(scope.accountAfterExact8,8))fail();
  if(await verifyScope({transaction,scope,invoiceId})!==true)fail();
  const r=new sql.Request(transaction).input('targetDatabase',sql.NVarChar(128),scope.targetDatabase).input('sessionId',sql.Int,scope.sessionId).input('transactionId',sql.BigInt,scope.transactionId)
   .input('invoiceId',sql.BigInt,invoiceId).input('actorId',sql.BigInt,scope.actorId).input('customerId',sql.BigInt,scope.customerId).input('entityId',sql.BigInt,scope.entityId).input('accountId',sql.BigInt,scope.accountId)
   .input('amount',sql.Decimal(18,4),scope.totalExact4).input('customerAfter',sql.Decimal(18,4),scope.customerAfterExact4).input('accountBefore',sql.Decimal(28,8),scope.accountBeforeExact8).input('accountAfter',sql.Decimal(28,8),scope.accountAfterExact8);
  const result=await r.query(DESKTOP_SALE_ACCOUNT_POST_SQL);if(!Array.isArray(result?.recordset)||result.recordset.length!==1||result.recordset[0].ok!==1)fail();return true;
 };
}
export const DESKTOP_SALE_ACCOUNT_POSTING_LIMITS=Object.freeze({sourceOnly:true,initialSyntheticAcceptanceCurrency:'TRY',multiCurrencySalesImplemented:false,storeScopeNotImplemented:true,realSqlVerified:false});
