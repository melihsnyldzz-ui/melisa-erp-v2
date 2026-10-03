import {createHash} from 'node:crypto';
import {getSqlPool,getSqlDriver} from '../config/database.js';
import {withTestSalesMutation} from './testSalesScope.mjs';
import {createCustomerCollection,resolveFinanceAccount,writeFinanceAccountMovement,buildJournalLines} from './financeService.js';
import {writeAuditLog} from './auditService.js';
import {assertAccountingPeriodOpen} from './periodLockService.js';
import {resolveCurrencySettlement} from './currencySettlementStore.mjs';
const fail=(code,message,statusCode=400)=>{throw Object.assign(new Error(message),{code,statusCode})};
async function scope(request){
 const s=(await request.query("SELECT s.*,DB_NAME() db,c.balance,c.currency_code,c.customer_code FROM dbo.test_sales_scope s JOIN dbo.customers c ON c.id=s.customer_id WHERE s.id=1")).recordset[0];
 if(s?.db!=='MELISA_ERP_SIRKET_TEST_20260929_01'||s.customer_code!=='TEST-V70-20260929-C'||s.currency_code!=='TRY')fail('TEST_IDENTITY','TEST hedefi değişti.',503);
 return s;
}
async function atomic(actor,fn,write=true){
 return withTestSalesMutation(async()=>{
  const pool=await getSqlPool(),sqlDriver=getSqlDriver(),transaction=new sqlDriver.Transaction(pool);await transaction.begin();
  try{
   await new sqlDriver.Request(transaction).query("DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000; IF @r<0 THROW 51071,'TEST_LOCK_TIMEOUT',1;");
   const ctx={pool,sqlDriver,transaction},s=await scope(new sqlDriver.Request(transaction));
   if(write&&Number(actor?.id)!==Number(s.ilker_id))fail('TEST_FINANCE_ACTOR','Tahsilat yalnız yetkili İlker TEST oturumuna açıktır.',403);
   const value=await fn(ctx,s);await transaction.commit();return value;
  }catch(e){try{await transaction.rollback()}catch{}if(e.number===51070||e.originalError?.info?.number===51070)fail('TEST_DATABASE_BOUNDARY','İşlem TEST kayıt/tutar sınırını aştı; hiçbir hareket kaydedilmedi.',409);throw e}
 });
}
function requestId(value){if(!/^[a-zA-Z0-9-]{16,64}$/.test(value||''))fail('REQUEST_ID_REQUIRED','Kalıcı istek kimliği gerekli.')}
function date(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||'')||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)fail('DATE_INVALID','İşlem tarihi geçersiz.');return value}
async function journal(ctx,actor,input,operation,fn){
 requestId(input.requestId);const {sqlDriver:sql,transaction}=ctx;
 const canonical=JSON.stringify(Object.fromEntries(Object.entries({...input,operation}).sort(([a],[b])=>a.localeCompare(b))));
 const hash=createHash('sha256').update(canonical).digest('hex');
 const old=(await new sql.Request(transaction).input('key',sql.NVarChar(64),input.requestId).query('SELECT * FROM dbo.test_finance_requests WHERE request_id=@key')).recordset[0];
 if(old){if(old.payload_hash!==hash||Number(old.actor_id)!==Number(actor.id))fail('REQUEST_CONFLICT','İstek kimliği farklı işlemde kullanılmış.',409);return {...JSON.parse(old.response_json),replayed:true}}
 const count=(await new sql.Request(transaction).query('SELECT COUNT(*) n FROM dbo.test_finance_requests')).recordset[0].n;
 if(count>=30)fail('TEST_FINANCE_LIMIT','Bu kabulün 30 finans işlemi sınırı doldu.',409);
 const value=await fn();
 await new sql.Request(transaction).input('key',sql.NVarChar(64),input.requestId).input('hash',sql.Char(64),hash).input('actor',sql.BigInt,actor.id).input('op',sql.NVarChar(30),operation).input('movement',sql.BigInt,value.id).input('original',sql.BigInt,value.originalMovementId||null).input('json',sql.NVarChar(sql.MAX),JSON.stringify(value)).query('INSERT dbo.test_finance_requests(request_id,payload_hash,actor_id,operation,customer_movement_id,original_movement_id,response_json) VALUES(@key,@hash,@actor,@op,@movement,@original,@json)');
 return {...value,replayed:false};
}
async function validateCollection(ctx,s,input){
 if(Object.keys(input).some(k=>!['requestId','customerId','accountId','amount','currency','documentDate','description','salesInvoiceId'].includes(k)))fail('TEST_PAYLOAD','Bu kabulde kur, yetki ve yön sunucudan alınır.');
 if(Number(input.customerId)!==Number(s.customer_id))fail('TEST_SCOPE','Yalnız tanımlı TEST carisi kullanılabilir.',403);
 const amount=Number(input.amount);if(!Number.isFinite(amount)||amount<=0||amount>500||Math.abs(amount*100-Math.round(amount*100))>1e-7)fail('AMOUNT_INVALID','Tutar 0–500 arasında ve en fazla iki ondalık olmalıdır.');
 date(input.documentDate);
 const {sqlDriver:sql,transaction}=ctx;
 const a=(await new sql.Request(transaction).input('id',sql.BigInt,Number(input.accountId)).query('SELECT a.* FROM dbo.finance_accounts a JOIN dbo.test_finance_accounts t ON t.account_id=a.id WHERE a.id=@id AND a.is_active=1')).recordset[0];
 if(!a||a.currency_code!==input.currency)fail('TEST_ACCOUNT','Seçilen TEST hesabı/işlem dövizi uyuşmuyor.',403);
 if(input.salesInvoiceId!=null){
  const i=(await new sql.Request(transaction).input('id',sql.BigInt,Number(input.salesInvoiceId)).query("SELECT s.id FROM dbo.sales_invoices s JOIN dbo.test_sales_requests t ON t.invoice_id=s.id WHERE s.id=@id AND s.status='finalized' AND s.customer_id=(SELECT customer_id FROM dbo.test_sales_scope)")).recordset[0];
  if(!i)fail('TEST_INVOICE','Bağlı TEST fişi uygun değil.',409);
 }
 return {...input,amount,customerId:Number(s.customer_id),accountId:Number(a.id),paymentMethod:a.account_type};
}
export async function previewTestCollection(input,actor){return atomic(actor,async(ctx,s)=>{
 const payload=await validateCollection(ctx,s,input),r=await resolveCurrencySettlement(new ctx.sqlDriver.Request(ctx.transaction),{documentAmount:payload.amount,documentCurrency:payload.currency,accountCurrency:s.currency_code,documentDate:payload.documentDate});
 return r;
});}
export async function collectTestCustomer(input,actor){return atomic(actor,async(ctx,s)=>journal(ctx,actor,input,'collection',async()=>{
 const payload=await validateCollection(ctx,s,input);
 const result=await createCustomerCollection(payload,actor,{...ctx,linkedInvoiceId:payload.salesInvoiceId||null});
 return {...result,requestId:input.requestId,salesInvoiceId:payload.salesInvoiceId||null};
}));}
export async function reverseTestCollection(id,input,actor,operation){return atomic(actor,async(ctx,s)=>journal(ctx,actor,{...input,originalMovementId:Number(id)},operation,async()=>{
 if(!['collection_cancel','collection_refund'].includes(operation)||Object.keys(input).some(k=>!['requestId','reason','documentDate'].includes(k)))fail('TEST_PAYLOAD','İptal/iade isteği geçersiz.');
 if(typeof input.reason!=='string'||input.reason.trim().length<5)fail('REASON_REQUIRED','En az 5 karakter gerekçe gerekli.');
 const documentDate=date(input.documentDate),{sqlDriver:sql,transaction}=ctx;
 await assertAccountingPeriodOpen(new sql.Request(transaction),documentDate,'Tahsilat iptal / iade');
 const m=(await new sql.Request(transaction).input('id',sql.BigInt,Number(id)).query("SELECT m.*,f.account_id,f.payment_method FROM dbo.test_finance_requests j JOIN dbo.customer_movements m ON m.id=j.customer_movement_id JOIN dbo.finance_account_movements f ON f.party_movement_id=m.id AND f.source_type='collection' WHERE m.id=@id AND j.operation='collection'")).recordset[0];
 if(!m||Number(m.customer_id)!==Number(s.customer_id))fail('TEST_ORIGINAL','Asıl TEST tahsilatı bulunamadı.',404);
 const reversed=(await new sql.Request(transaction).input('id',sql.BigInt,Number(id)).query('SELECT request_id FROM dbo.test_finance_requests WHERE original_movement_id=@id')).recordset[0];
 if(reversed)fail('ALREADY_REVERSED','Bu tahsilat daha önce iptal/iade edilmiş.',409);
 if(m.account_amount==null||m.amount_try==null||m.document_exchange_rate_snapshot==null||m.account_exchange_rate_snapshot==null)fail('SNAPSHOT_REQUIRED','Kayıtlı kur/tutar olmadan ters kayıt yapılamaz.',409);
 if(operation==='collection_refund'&&Number(s.balance)+Number(m.account_amount)>0.00001)fail('CUSTOMER_CREDIT_REQUIRED','Para iadesi için yeterli müşteri alacağı yok.',409);
 const account=await resolveFinanceAccount(transaction,sql,{accountId:Number(m.account_id),currency:m.currency_code,paymentMethod:m.payment_method});
 if(Number(account.currentBalance)<Number(m.amount))fail('ACCOUNT_FUNDS_REQUIRED','TEST hesabında yeterli bakiye yok.',409);
 const result=await new sql.Request(transaction).input('original',sql.BigInt,Number(id)).input('op',sql.NVarChar(40),operation).input('date',sql.Date,documentDate).input('actor',sql.BigInt,actor.id).query(`
 DECLARE @ids TABLE(id bigint);
 INSERT dbo.customer_movements(customer_id,sales_invoice_id,movement_type,amount,currency_code,balance_effect,document_date,created_by,account_currency,account_amount,document_exchange_rate_snapshot,account_exchange_rate_snapshot,amount_try)
 OUTPUT inserted.id INTO @ids
 SELECT customer_id,sales_invoice_id,@op,amount,currency_code,account_amount,@date,@actor,account_currency,account_amount,document_exchange_rate_snapshot,account_exchange_rate_snapshot,amount_try FROM dbo.customer_movements WHERE id=@original;
 UPDATE c SET balance=c.balance+m.account_amount,updated_at=SYSUTCDATETIME() FROM dbo.customers c JOIN dbo.customer_movements m ON m.customer_id=c.id WHERE m.id=@original;
 SELECT id FROM @ids;`);
 const movementId=Number(result.recordset[0].id);
 const updated=await writeFinanceAccountMovement(transaction,sql,{account,sourceType:operation,partyType:'customer',partyMovementId:movementId,amount:Number(m.amount),currency:m.currency_code,paymentMethod:m.payment_method,documentNo:`${operation==='collection_cancel'?'THI':'PI'}-${movementId}`,documentDate,description:input.reason,actor});
 await writeAuditLog(new sql.Request(transaction),{actor,action:operation,entityType:'customer_movement',entityId:movementId,afterSnapshot:{originalMovementId:Number(id),reason:input.reason,amount:Number(m.amount),currency:m.currency_code,accountId:Number(m.account_id)}});
 return {id:movementId,originalMovementId:Number(id),operation,amount:Number(m.amount),currency:m.currency_code,accountAmount:Number(m.account_amount),accountCurrency:m.account_currency,balanceEffect:Number(m.account_amount),account:updated,requestId:input.requestId};
}));}
export async function testFinanceContext(actor){return atomic(actor,async(ctx,s)=>{
 const req=()=>new ctx.sqlDriver.Request(ctx.transaction);
 const accounts=(await req().query('SELECT a.id,a.account_code,a.account_name,a.account_type,a.currency_code,a.current_balance FROM dbo.finance_accounts a JOIN dbo.test_finance_accounts t ON t.account_id=a.id ORDER BY a.id')).recordset;
 const movements=(await req().query(`SELECT m.id,m.sales_invoice_id,m.movement_type,m.amount,m.currency_code,m.balance_effect,m.account_currency,m.account_amount,m.document_exchange_rate_snapshot,m.account_exchange_rate_snapshot,m.amount_try,m.document_date,f.id finance_movement_id,f.account_id,f.direction,f.payment_method,f.document_no,f.description,u.display_name actor,j.request_id,j.original_movement_id,r.customer_movement_id reversed_by
 FROM dbo.customer_movements m JOIN dbo.test_finance_requests j ON j.customer_movement_id=m.id JOIN dbo.finance_account_movements f ON f.party_movement_id=m.id AND f.source_type=m.movement_type JOIN dbo.users u ON u.id=m.created_by LEFT JOIN dbo.test_finance_requests r ON r.original_movement_id=m.id ORDER BY m.id`)).recordset;
 const rates=(await req().query("WITH r AS(SELECT currency_code,rate_to_try,rate_date,ROW_NUMBER()OVER(PARTITION BY currency_code ORDER BY rate_date DESC,id DESC)n FROM dbo.currency_rates WHERE rate_date<=CONVERT(date,GETDATE())) SELECT currency_code,rate_to_try,rate_date FROM r WHERE n=1")).recordset;
 const journal=movements.flatMap(m=>buildJournalLines({id:m.id,partyType:'customer',partyId:Number(s.customer_id),partyCode:s.customer_code,movementType:m.movement_type,amount:Number(m.amount),amountTry:Number(m.amount_try),currency:m.currency_code,accountCurrency:m.account_currency,accountAmount:Number(m.account_amount),exchangeRate:Number(m.document_exchange_rate_snapshot),accountExchangeRate:Number(m.account_exchange_rate_snapshot),accountName:accounts.find(a=>String(a.id)===String(m.account_id))?.account_name,documentNo:m.document_no,documentDate:m.document_date}));
 return {environment:'ISOLATED_TEST',database:s.db,customerId:Number(s.customer_id),customerBalance:Number(s.balance),customerCurrency:s.currency_code,accounts,movements,rates,journal,maximumOperations:30,refundScope:'full original collection; sufficient customer credit; original account and currency'};
},false);}

