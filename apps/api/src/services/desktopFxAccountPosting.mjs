// Only a registered, same-transaction finalized invoice scope may post the
// selected currency ledger. The legacy main balance is verified separately.
const fail=()=>{throw Error('DESKTOP_FX_ACCOUNT_REJECTED');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
export const DESKTOP_FX_ACCOUNT_POST_SQL=`SET NOCOUNT ON;
DECLARE @invoice bigint=CONVERT(bigint,@invoiceId),@customer bigint=CONVERT(bigint,@customerId),@entity bigint=CONVERT(bigint,@entityId),@account bigint=CONVERT(bigint,@accountId),@actor bigint=CONVERT(bigint,@actorId),
 @total decimal(18,4)=CONVERT(decimal(18,4),@totalExact4),@accountAmount decimal(18,4)=CONVERT(decimal(18,4),@accountAmountExact4),@amountTry decimal(18,4)=CONVERT(decimal(18,4),@amountTryExact4),
 @customerAfter decimal(18,4)=CONVERT(decimal(18,4),@customerAfterExact4),@accountBefore decimal(28,8)=CONVERT(decimal(28,8),@accountBeforeExact8),@accountAfter decimal(28,8)=CONVERT(decimal(28,8),@accountAfterExact8),@documentRate decimal(18,8)=CONVERT(decimal(18,8),@documentRateExact8),@accountRate decimal(18,8)=CONVERT(decimal(18,8),@accountRateExact8);
IF CONVERT(varbinary(256),DB_NAME())<>CONVERT(varbinary(256),@targetDatabase) OR CONVERT(varchar(20),@@SPID)<>@sessionId OR CONVERT(varchar(20),CURRENT_TRANSACTION_ID())<>@transactionId OR @@TRANCOUNT<>1 OR XACT_STATE()<>1
 THROW 51981,'DESKTOP_FX_ACCOUNT_REJECTED',1;
IF (SELECT COUNT_BIG(*) FROM dbo.customer_movements WITH(UPDLOCK,HOLDLOCK) WHERE sales_invoice_id=@invoice)<>1
 OR NOT EXISTS(SELECT 1 FROM dbo.sales_invoices WITH(UPDLOCK,HOLDLOCK) WHERE id=@invoice AND customer_id=@customer AND customer_currency=@customerCurrency AND document_currency=@currency AND status=N'finalized' AND grand_total=@total AND amount_try=@amountTry AND account_currency=@accountCurrency AND account_amount=@accountAmount AND exchange_rate_snapshot=@documentRate AND account_exchange_rate_snapshot=@accountRate AND party_entity_id=@entity AND party_currency_account_id=@account)
 OR NOT EXISTS(SELECT 1 FROM dbo.customers WITH(UPDLOCK,HOLDLOCK) WHERE id=@customer AND party_entity_id=@entity AND currency_code=@customerCurrency AND is_active=1 AND is_deleted=0 AND balance=@customerAfter)
 OR NOT EXISTS(SELECT 1 FROM dbo.party_currency_accounts WITH(UPDLOCK,HOLDLOCK) WHERE id=@account AND customer_id=@customer AND supplier_id IS NULL AND party_entity_id=@entity AND currency_code=@accountCurrency AND current_balance=@accountBefore)
 OR (SELECT COUNT_BIG(*) FROM dbo.party_currency_accounts WITH(UPDLOCK,HOLDLOCK) WHERE customer_id=@customer AND party_entity_id=@entity AND currency_code=@accountCurrency)<>1
 THROW 51982,'DESKTOP_FX_ACCOUNT_REJECTED',1;
UPDATE dbo.customer_movements SET party_entity_id=@entity,party_currency_account_id=@account
 WHERE sales_invoice_id=@invoice AND customer_id=@customer AND movement_type=N'sales_invoice' AND created_by=@actor AND currency_code=@currency AND amount=@total AND account_currency=@accountCurrency AND account_amount=@accountAmount AND balance_effect=@accountAmount AND amount_try=@amountTry AND document_exchange_rate_snapshot=@documentRate AND account_exchange_rate_snapshot=@accountRate AND party_entity_id IS NULL AND party_currency_account_id IS NULL;
IF @@ROWCOUNT<>1 THROW 51983,'DESKTOP_FX_ACCOUNT_REJECTED',1;
UPDATE dbo.party_currency_accounts SET current_balance=current_balance+CONVERT(decimal(28,8),@accountAmount) WHERE id=@account AND customer_id=@customer AND party_entity_id=@entity AND supplier_id IS NULL AND currency_code=@accountCurrency AND current_balance=@accountBefore;
IF @@ROWCOUNT<>1 THROW 51985,'DESKTOP_FX_ACCOUNT_REJECTED',1;
IF NOT EXISTS(SELECT 1 FROM dbo.party_currency_accounts WHERE id=@account AND current_balance=@accountAfter) THROW 51986,'DESKTOP_FX_ACCOUNT_REJECTED',1;
SELECT 1 ok;`;
export function createDesktopFxAccountPosting({sql,verifyScope}={}){
 if(typeof sql?.Request!=='function'||typeof sql?.NVarChar!=='function'||typeof verifyScope!=='function')fail();
 return async function post({transaction,scope,invoiceId}={}){
  if(!scope?.fx||!transaction||![invoiceId,scope.actorId,scope.customerId,scope.entityId,scope.accountId,scope.transactionId].every(id)||!Number.isSafeInteger(scope.sessionId)||scope.sessionId<1||typeof scope.targetDatabase!=='string'||![scope.currency,scope.customerCurrency,scope.accountCurrency].every(code=>['TRY','USD','EUR'].includes(code))||await verifyScope({transaction,scope,invoiceId})!==true)fail();
  const request=new sql.Request(transaction),values={invoiceId,actorId:scope.actorId,customerId:scope.customerId,entityId:scope.entityId,accountId:scope.accountId,targetDatabase:scope.targetDatabase,sessionId:String(scope.sessionId),transactionId:scope.transactionId,currency:scope.currency,customerCurrency:scope.customerCurrency,accountCurrency:scope.accountCurrency};
  for(const field of ['totalExact4','accountAmountExact4','amountTryExact4','customerAfterExact4','accountBeforeExact8','accountAfterExact8','documentRateExact8','accountRateExact8']){if(typeof scope[field]!=='string'||!new RegExp(`^${field.startsWith('customer')||field.startsWith('accountBefore')||field.startsWith('accountAfter')?'-?':''}(?:0|[1-9]\\d{0,13})\\.\\d{${field.endsWith('8')?8:4}}$`).test(scope[field]))fail();values[field]=scope[field];}
  for(const [key,value] of Object.entries(values))request.input(key,sql.NVarChar(key==='targetDatabase'?128:40),value);const result=await request.query(DESKTOP_FX_ACCOUNT_POST_SQL);if(result?.recordset?.length!==1||result.recordset[0].ok!==1)fail();return true;
 };
}
