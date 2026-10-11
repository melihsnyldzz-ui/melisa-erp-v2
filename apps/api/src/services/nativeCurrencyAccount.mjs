import {getSqlDriver} from '../config/database.js';
import {nativeError} from './nativeTerminalPolicy.mjs';
import {writeAuditLog} from './auditService.js';
import {isolatedCopyTransactionContext} from './isolatedOperationCopyScope.mjs';
import {copyAssert,BUSINESS_COPY_DATABASE,getBusinessDailySelection,getBusinessDailyScopeHash} from './isolatedOperationCopyContext.mjs';
import {getBusinessSelectedSaleWriteScope} from './businessSelectedSaleWriteScope.mjs';
import {getBusinessInboundSelection} from '../middleware/businessInboundSelection.mjs';

// Complete a just-created legacy native effect in the selected copy's currency
// account. The native engine already changed the main card: never add it again.
export async function postIsolatedCopyCurrencyMovement({role,partyId,currency,movementId,effectExact8},ctx,actor){
 const copy=isolatedCopyTransactionContext(ctx?.transaction);
 copyAssert(['customer','supplier'].includes(role)&&typeof effectExact8==='string'&&/^-?(?:0|[1-9]\d{0,18})\.\d{8}$/.test(effectExact8)&&!/^[-]?0\.00000000$/.test(effectExact8),'ISOLATED_COPY_ACCOUNT_EFFECT',409);
 const account=(role==='customer'?copy.customers:copy.suppliers).find(a=>a.id===String(partyId)&&a.currency===currency);
 copyAssert(account&&copy.actors.some(a=>a.id===String(actor?.id))&&/^[1-9]\d*$/.test(String(movementId)),'ISOLATED_COPY_ACCOUNT_SCOPE',403);
 const business=copy.target.database===BUSINESS_COPY_DATABASE,sql=ctx.sqlDriver??getSqlDriver(),request=()=>new sql.Request(ctx.transaction);
 const selectedSale=business&&role==='customer'?getBusinessSelectedSaleWriteScope(copy,ctx.transaction):null;
 let operation=selectedSale?.operation??null,inbound=null,daily=selectedSale?null:business?getBusinessDailySelection(copy):null;
 if(selectedSale)copyAssert(['sale_finalize','sale_cancel'].includes(operation)&&selectedSale.actorId===String(actor?.id)&&selectedSale.customerId===String(partyId)&&selectedSale.customerAccountId===account.accountId&&selectedSale.partyId===account.partyId&&selectedSale.currency===currency&&/^[1-9]\d*$/.test(selectedSale.invoiceId??'')&&(operation==='sale_cancel'?effectExact8.startsWith('-'):!effectExact8.startsWith('-'))&&Number(effectExact8.replace('-',''))<=Number(selectedSale.maxInvoiceAmountExact4),'ISOLATED_COPY_ACCOUNT_SCOPE',403);
 if(business&&role==='supplier'){
  // Inbound middleware also surrounds daily routes. Only the immutable same-TX
  // intent can choose which registered account scope owns this native effect.
  const intents=(await request().input('copy',sql.UniqueIdentifier,copy.copyId).input('actor',sql.BigInt,actor.id).query(`SELECT operation,JSON_VALUE(payload_json,'$.businessDailyScopeHash') dailyScopeHash FROM dbo.stage4_copy_intents WHERE copy_id=@copy AND session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID() AND actor_id=@actor;`)).recordset;
  copyAssert(intents?.length===1,'ISOLATED_COPY_ACCOUNT_SCOPE',403);operation=intents[0].operation;
  if(operation==='purchase_finalize'){inbound=getBusinessInboundSelection(copy);daily=null;copyAssert(inbound,'ISOLATED_COPY_ACCOUNT_SCOPE',403);}
  else copyAssert(['payment','payment_cancel','purchase_return_approve','purchase_return_cancel','purchase_cancel'].includes(operation)&&daily&&intents[0].dailyScopeHash===getBusinessDailyScopeHash(copy),'ISOLATED_COPY_ACCOUNT_SCOPE',403);
 }
 const scopeHash=daily?getBusinessDailyScopeHash(copy):null,rates=business?copy.currencyRates?.filter(r=>r.currency===currency):[],rate=rates?.[0];
 if(business){
  const selected=selectedSale?selectedSale.customerAccountId===account.accountId&&selectedSale.currency===currency&&selectedSale.rateExact8===rate?.rateExact8:inbound?inbound.supplierId===account.id&&inbound.accountId===account.accountId&&inbound.currency===currency:daily&&daily[role+'AccountId']===account.accountId&&daily.currency===currency&&/^[a-f0-9]{64}$/i.test(scopeHash??'');
  copyAssert(selected&&rates.length===1&&/^\d+\.\d{8}$/.test(rate.rateExact8)&&Number(rate.rateExact8)>0&&/^\d{4}-\d{2}-\d{2}$/.test(rate.date)&&rate.date<=copy.date&&(currency!=='TRY'||rate.rateExact8==='1.00000000'),'ISOLATED_COPY_ACCOUNT_SCOPE',403);
 }
 const table=role==='customer'?'customer_movements':'supplier_movements';
 const result=await request().input('copyDatabase',sql.NVarChar(128),copy.target.database).input('copy',sql.UniqueIdentifier,copy.copyId).input('actor',sql.BigInt,actor.id).input('movement',sql.BigInt,movementId).input('party',sql.BigInt,partyId).input('entity',sql.BigInt,account.partyId).input('account',sql.BigInt,account.accountId).input('currency',sql.NVarChar(3),currency).input('effect',sql.Decimal(28,8),effectExact8).input('copyAccountRate',sql.Decimal(28,8),business?rate.rateExact8:'1.00000000').input('businessDailyScopeHash',sql.NVarChar(64),scopeHash).input('copyAccountOperation',sql.NVarChar(40),operation).input('selectedSaleInvoice',sql.BigInt,selectedSale?.invoiceId??null).input('selectedSalePolicyHash',sql.NVarChar(64),selectedSale?.policyHash??null).input('selectedSaleRequestId',sql.NVarChar(100),selectedSale?.requestId??null).query(`
 IF DB_NAME() COLLATE Latin1_General_100_BIN2<>@copyDatabase COLLATE Latin1_General_100_BIN2
 OR NOT EXISTS(SELECT 1 FROM dbo.stage4_copy_intents WHERE copy_id=@copy AND session_id=@@SPID AND transaction_id=CURRENT_TRANSACTION_ID() AND actor_id=@actor ${operation?'AND operation=@copyAccountOperation':''})
  THROW 51411,'ISOLATED_COPY_ACCOUNT_INTENT_REQUIRED',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.party_currency_accounts WITH(UPDLOCK,HOLDLOCK) WHERE id=@account AND party_entity_id=@entity AND ${role}_id=@party AND ${role==='customer'?'supplier':'customer'}_id IS NULL AND currency_code=@currency AND current_balance IS NOT NULL)
 OR (SELECT COUNT(*) FROM dbo.party_currency_accounts WHERE ${role}_id=@party AND party_entity_id=@entity AND currency_code=@currency)<>1
 OR NOT EXISTS(SELECT 1 FROM dbo.${role==='customer'?'customers':'suppliers'} WHERE id=@party AND party_entity_id=@entity ${business?'':'AND currency_code=@currency'} AND is_active=1 AND is_deleted=0)
  THROW 51412,'ISOLATED_COPY_ACCOUNT_IDENTITY',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.${table} m WITH(UPDLOCK,HOLDLOCK) JOIN dbo.stage4_copy_intents n ON n.copy_id=@copy AND n.session_id=@@SPID AND n.transaction_id=CURRENT_TRANSACTION_ID() AND n.actor_id=@actor ${operation?'AND n.operation=@copyAccountOperation':''}
  WHERE m.id=@movement AND m.${role}_id=@party AND m.created_by=@actor AND m.created_at>=n.created_at AND m.account_currency=@currency AND m.currency_code=@currency
  AND CONVERT(decimal(28,8),m.balance_effect)=@effect AND m.account_amount IS NOT NULL AND m.document_exchange_rate_snapshot=@copyAccountRate AND m.account_exchange_rate_snapshot=@copyAccountRate
  ${business?"AND m.account_amount=m.amount AND m.amount_try=ROUND(m.amount*@copyAccountRate,4) "+(selectedSale?"AND m.sales_invoice_id=@selectedSaleInvoice AND m.movement_type=CASE WHEN @copyAccountOperation=N'sale_cancel' THEN N'sales_invoice_cancel' ELSE N'sales_invoice' END AND JSON_VALUE(n.payload_json,'$.businessCustomerId')=CONVERT(nvarchar(20),@party) AND JSON_VALUE(n.payload_json,'$.businessAccountId')=CONVERT(nvarchar(20),@account) AND JSON_VALUE(n.payload_json,'$.businessCurrency')=@currency AND JSON_VALUE(n.payload_json,'$.businessSelectedSalePolicyHash')=@selectedSalePolicyHash AND JSON_VALUE(n.payload_json,'$.requestId')=@selectedSaleRequestId":inbound?"AND JSON_VALUE(n.payload_json,'$.businessSupplierId')=CONVERT(nvarchar(20),@party) AND JSON_VALUE(n.payload_json,'$.businessAccountId')=CONVERT(nvarchar(20),@account) AND JSON_VALUE(n.payload_json,'$.businessCurrency')=@currency":"AND JSON_VALUE(n.payload_json,'$.businessDailyScopeHash')=@businessDailyScopeHash"):''}
  AND m.party_entity_id IS NULL AND m.party_currency_account_id IS NULL
  AND m.movement_type IN(N'${role==='customer'?'sales_invoice\',N\'sales_invoice_cancel\',N\'collection\',N\'collection_cancel\',N\'sales_return\',N\'sales_return_cancel':'purchase_invoice\',N\'purchase_invoice_cancel\',N\'payment\',N\'payment_cancel\',N\'purchase_return\',N\'purchase_return_cancel'}'))
  THROW 51413,'ISOLATED_COPY_ACCOUNT_MOVEMENT',1;
 DECLARE @before decimal(28,8)=(SELECT current_balance FROM dbo.party_currency_accounts WHERE id=@account);
 UPDATE dbo.${table} SET party_entity_id=@entity,party_currency_account_id=@account,balance_effect_exact=@effect,affects_balance=1
  WHERE id=@movement AND party_entity_id IS NULL AND party_currency_account_id IS NULL;
 IF @@ROWCOUNT<>1 THROW 51414,'ISOLATED_COPY_ACCOUNT_ALREADY_LINKED',1;
 UPDATE dbo.party_currency_accounts SET current_balance=current_balance+@effect WHERE id=@account;
 IF @@ROWCOUNT<>1 THROW 51415,'ISOLATED_COPY_ACCOUNT_BALANCE',1;
 SELECT CONVERT(varchar(20),@account) accountId,CONVERT(varchar(20),@entity) partyId,CONVERT(varchar(20),@movement) movementId,@currency currency,
 CONVERT(varchar(60),@before) beforeBalance,CONVERT(varchar(60),@effect) effect,CONVERT(varchar(60),current_balance) afterBalance FROM dbo.party_currency_accounts WHERE id=@account;
 `);
 copyAssert(result.recordset?.length===1,'ISOLATED_COPY_ACCOUNT_RESULT');
 const posting=result.recordset[0];
 // Registered daily callers retain their business operation audit. The same
 // transaction's immutable copy request/effect components bind this completed
 // native movement, selected account and exact balance effect; a second bridge
 // event would be outside the daily audit contract. Legacy/inbound keep it.
 // `daily` comes from the registered context WeakMap, never a client flag, and
 // the SQL above already verified its scope hash against the active intent.
 if(!daily&&!selectedSale)await writeAuditLog(request(),{actor,action:'isolated_copy_currency_account_posted',entityType:role+'_movement',entityId:movementId,beforeSnapshot:{accountId:posting.accountId,balance:posting.beforeBalance},afterSnapshot:{...posting,copyId:copy.copyId,operationOrigin:copy.operationOrigin}});
 return posting;
}

// Runs inside the native sale's SERIALIZABLE transaction. Never guesses an
// account, creates a currency account, or backfills an old commercial document.
export async function postNativeCurrencyAccount(invoiceId,ctx,actor,{cancel=false}={}) {
 if(!ctx?.transaction||!ctx.nativeTerminalV1)nativeError('NATIVE_ACCOUNT_TRANSACTION_REQUIRED','Cari hesabı için satış işlemi gerekli.',503);
 const sql=getSqlDriver(),request=()=>new sql.Request(ctx.transaction);
 const result=await request().input('invoice',sql.BigInt,invoiceId).input('cancel',sql.Bit,cancel).query(`
  DECLARE @customer bigint,@party bigint,@currency nvarchar(10),@amount decimal(28,8),@linked bigint,@status nvarchar(30);
  SELECT @customer=customer_id,@currency=document_currency,@amount=account_amount,@linked=party_currency_account_id,@status=status
   FROM dbo.sales_invoices WITH(UPDLOCK,HOLDLOCK) WHERE id=@invoice AND document_currency=account_currency AND account_amount=grand_total;
  IF @customer IS NULL OR @amount IS NULL OR @amount<=0 OR @status<>CASE WHEN @cancel=1 THEN N'cancelled' ELSE N'finalized' END
   THROW 51101,'NATIVE_ACCOUNT_INVOICE_INVALID',1;
  SELECT @party=party_entity_id FROM dbo.customers WITH(UPDLOCK,HOLDLOCK) WHERE id=@customer AND currency_code=@currency;
  DECLARE @account bigint,@matches int;
  SELECT @matches=COUNT(*),@account=MIN(id) FROM dbo.party_currency_accounts WITH(UPDLOCK,HOLDLOCK)
   WHERE customer_id=@customer AND party_entity_id=@party AND currency_code=@currency AND current_balance IS NOT NULL;
  IF @party IS NULL OR @matches<>1 THROW 51102,'NATIVE_CURRENCY_ACCOUNT_NOT_UNIQUE',1;
  IF (@cancel=0 AND @linked IS NOT NULL) OR (@cancel=1 AND (@linked IS NULL OR @linked<>@account))
   THROW 51103,'NATIVE_CURRENCY_ACCOUNT_CHANGED',1;
  IF @cancel=1 AND NOT EXISTS(SELECT 1 FROM dbo.customer_movements WHERE sales_invoice_id=@invoice AND movement_type=N'sales_invoice'
    AND party_currency_account_id=@account AND party_entity_id=@party AND balance_effect_exact=@amount AND affects_balance=1)
   THROW 51104,'NATIVE_CURRENCY_ORIGINAL_EFFECT_MISSING',1;
  DECLARE @type nvarchar(40)=CASE WHEN @cancel=1 THEN N'sales_invoice_cancel' ELSE N'sales_invoice' END;
  DECLARE @effect decimal(28,8)=CASE WHEN @cancel=1 THEN -@amount ELSE @amount END;
  IF (SELECT COUNT(*) FROM dbo.customer_movements WHERE sales_invoice_id=@invoice AND movement_type=@type)<>1
   THROW 51105,'NATIVE_CURRENCY_MOVEMENT_INVALID',1;
  UPDATE dbo.customer_movements SET party_entity_id=@party,party_currency_account_id=@account,balance_effect_exact=@effect,affects_balance=1
   WHERE sales_invoice_id=@invoice AND movement_type=@type AND customer_id=@customer AND currency_code=@currency
    AND account_currency=@currency AND account_amount=@amount AND balance_effect=@effect
    AND party_currency_account_id IS NULL AND party_entity_id IS NULL;
  IF @@ROWCOUNT<>1 THROW 51106,'NATIVE_CURRENCY_EFFECT_ALREADY_LINKED',1;
  IF @cancel=0 BEGIN
   UPDATE dbo.sales_invoices SET party_entity_id=@party,party_currency_account_id=@account WHERE id=@invoice AND party_currency_account_id IS NULL;
   IF @@ROWCOUNT<>1 THROW 51107,'NATIVE_CURRENCY_INVOICE_ALREADY_LINKED',1;
  END;
  DECLARE @before decimal(28,8)=(SELECT current_balance FROM dbo.party_currency_accounts WHERE id=@account);
  UPDATE dbo.party_currency_accounts SET current_balance=current_balance+@effect WHERE id=@account;
  IF @@ROWCOUNT<>1 THROW 51108,'NATIVE_CURRENCY_BALANCE_FAILED',1;
  SELECT @account AS accountId,@party AS partyId,@customer AS customerId,@currency AS currency,
   CONVERT(varchar(60),@before) AS beforeBalance,CONVERT(varchar(60),@effect) AS effect,
   CONVERT(varchar(60),current_balance) AS afterBalance FROM dbo.party_currency_accounts WHERE id=@account;
 `).catch(error=>{
  if(error.number>=51101&&error.number<=51108)nativeError(error.message?.match(/NATIVE_[A-Z_]+/)?.[0]||'NATIVE_CURRENCY_ACCOUNT_INVALID','Cari döviz hesabı doğrulanamadı; satış işlemi geri alındı.',409);
  throw error;
 });
 const posting=result.recordset[0];
 await writeAuditLog(request(),{action:cancel?'native_currency_account_reversed':'native_currency_account_posted',entityType:'sales_invoice',entityId:invoiceId,actor,
  beforeSnapshot:{accountId:posting.accountId,balance:posting.beforeBalance},afterSnapshot:posting});
 return posting;
}

export async function verifyNativeCurrencyAccount(invoiceId,request,{required=false,cancelled=false}={}) {
 const sql=getSqlDriver();
 const r=await request().input('accountInvoice',sql.BigInt,invoiceId).query(`
  SELECT i.party_currency_account_id AS linkedAccount,i.party_entity_id AS linkedParty,i.customer_id,i.document_currency,i.account_amount,
   a.id AS accountId,a.party_entity_id AS partyId,a.customer_id AS accountCustomer,a.currency_code AS accountCurrency
  FROM dbo.sales_invoices i LEFT JOIN dbo.party_currency_accounts a ON a.id=i.party_currency_account_id WHERE i.id=@accountInvoice;
  SELECT movement_type,party_currency_account_id AS accountId,party_entity_id AS partyId,balance_effect_exact AS effect,affects_balance AS affects,
   currency_code,customer_id FROM dbo.customer_movements WHERE sales_invoice_id=@accountInvoice;
 `);
 const i=r.recordsets[0][0];
 if(!required&&!i?.linkedAccount)return; // Existing pre-upgrade receipts remain readable.
 const movements=r.recordsets[1];
 const same=(a,b)=>a!=null&&b!=null&&String(a)===String(b);
 const valid=i&&same(i.linkedAccount,i.accountId)&&same(i.linkedParty,i.partyId)&&same(i.customer_id,i.accountCustomer)&&i.document_currency===i.accountCurrency&&
  movements.length===(cancelled?2:1)&&movements.every(m=>same(m.accountId,i.accountId)&&same(m.partyId,i.partyId)&&same(m.customer_id,i.customer_id)&&m.currency_code===i.accountCurrency&&m.affects===true&&
   ['sales_invoice','sales_invoice_cancel'].includes(m.movement_type)&&Number(m.effect)===(m.movement_type==='sales_invoice'?1:-1)*Number(i.account_amount));
 if(!valid)nativeError('NATIVE_CURRENCY_EFFECT_UNVERIFIED','Fişin cari döviz hesabı etkisi doğrulanamadı.',503);
}
