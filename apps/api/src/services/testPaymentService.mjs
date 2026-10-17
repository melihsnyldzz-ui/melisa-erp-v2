import {legacyPaymentScope,assertLegacyPaymentScope,filterLegacyPaymentContext} from './workSupplierPaymentLegacyScope.mjs';
import {assertOperationQuarantineAllowed,quarantineTransactionContext} from './operationQuarantineService.js';
import {createHash} from 'node:crypto';
import {getSqlPool,getSqlDriver} from '../config/database.js';
import {withTestSalesMutation} from './testSalesScope.mjs';
import {createSupplierPayment,resolveFinanceAccount,writeFinanceAccountMovement} from './financeService.js';
import {assertAccountingPeriodOpen} from './periodLockService.js';
import {writeAuditLog} from './auditService.js';
import {recordSupplierPayment,cancelSupplierPayment} from './sitesGoodsRules.mjs';
const fail=(code,message,statusCode=400)=>{throw Object.assign(new Error(message),{code,statusCode})};
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const keys=(i,k)=>{if(Object.keys(i).some(x=>!k.includes(x)))fail('TEST_PAYLOAD','Kapsam dışı alan gönderildi.')};
const date=v=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(v||'')||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)fail('DATE_INVALID','Geçerli işlem tarihi gerekli.');return v};
async function atomic(actor,fn,write=true){return withTestSalesMutation(async()=>{
 const pool=await getSqlPool(),sqlDriver=getSqlDriver(),transaction=new sqlDriver.Transaction(pool);await transaction.begin();
 const ctx={pool,sqlDriver,transaction},req=()=>new sqlDriver.Request(transaction);
 try{
  await req().query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;IF @r<0 THROW 51071,'TEST_LOCK_TIMEOUT',1;IF DB_NAME()<>N'MELISA_ERP_SIRKET_TEST_20260929_01' THROW 51070,'WRONG_DATABASE',1;");
  if(write&&Number(actor.id)!==16)fail('TEST_PAYMENT_ACTOR','Ödeme yalnız yetkili İlker TEST oturumuna açıktır.',403);
  ctx.workPaymentScope=await legacyPaymentScope(ctx,actor);
  const value=await fn(ctx,req);await transaction.commit();return value;
 }catch(e){try{await transaction.rollback()}catch{}if(e.number===51070||e.originalError?.info?.number===51070)fail('TEST_DATABASE_BOUNDARY','TEST SQL sınırı işlemi tamamen geri aldı.',409);throw e}
});}
async function journal(ctx,actor,i,op,fn){
 if(!/^[a-zA-Z0-9-]{16,64}$/.test(i.requestId||''))fail('REQUEST_ID_REQUIRED','Kalıcı istek kimliği gerekli.');
 const {sqlDriver:s,transaction:t}=ctx,hash=createHash('sha256').update(JSON.stringify(canonical({...i,operation:op}))).digest('hex');
 const old=(await new s.Request(t).input('id',s.NVarChar(64),i.requestId).query('SELECT * FROM dbo.test_payment_requests WHERE request_id=@id')).recordset[0];
 if(old){if(old.payload_hash!==hash||Number(old.actor_id)!==Number(actor.id))fail('REQUEST_CONFLICT','Aynı istek kimliği farklı ödeme için kullanılamaz.',409);return {...JSON.parse(old.response_json),replayed:true}}
 if((await new s.Request(t).query('SELECT COUNT(*) n FROM dbo.test_payment_requests')).recordset[0].n>=30)fail('TEST_LIMIT','30 ödeme işlemi sınırı doldu.',409);
 const v=await fn();await new s.Request(t).input('id',s.NVarChar(64),i.requestId).input('hash',s.Char(64),hash).input('actor',s.BigInt,actor.id).input('op',s.NVarChar(30),op).input('movement',s.BigInt,v.id).input('original',s.BigInt,v.originalId||null).input('json',s.NVarChar(s.MAX),JSON.stringify(v)).query('INSERT dbo.test_payment_requests(request_id,payload_hash,actor_id,operation,movement_id,original_id,response_json)VALUES(@id,@hash,@actor,@op,@movement,@original,@json)');return {...v,replayed:false};
}
export async function paymentContext(actor){return atomic(actor,async(ctx,req)=>{
 const suppliers=(await req().query('SELECT s.id,s.supplier_code,s.name,s.currency_code,s.balance,t.opening_balance FROM dbo.test_payment_suppliers t JOIN dbo.suppliers s ON s.id=t.supplier_id ORDER BY s.id')).recordset;
 const accounts=(await req().query('SELECT a.id,a.account_code,a.account_name,a.account_type,a.currency_code,a.opening_balance,a.current_balance FROM dbo.test_payment_accounts t JOIN dbo.finance_accounts a ON a.id=t.account_id ORDER BY a.id')).recordset;
 const invoices=(await req().query('SELECT p.id,p.supplier_id,p.document_no,p.status,p.document_currency,p.grand_total,p.document_date,u.display_name actor,i.quantity,i.purchase_price,i.line_total,i.stock_code_snapshot stock_code FROM dbo.test_payment_invoices t JOIN dbo.purchase_invoices p ON p.id=t.invoice_id JOIN dbo.purchase_invoice_items i ON i.purchase_invoice_id=p.id JOIN dbo.users u ON u.id=p.created_by ORDER BY p.id')).recordset;
 const movements=(await req().query(`SELECT m.*,j.request_id,j.operation,j.original_id,r.movement_id reversed_by,f.id finance_movement_id,f.account_id,f.direction,f.document_no,f.description,u.display_name actor FROM dbo.test_payment_requests j JOIN dbo.supplier_movements m ON m.id=j.movement_id JOIN dbo.finance_account_movements f ON f.party_movement_id=m.id AND f.party_type=N'supplier' AND f.source_type=m.movement_type JOIN dbo.users u ON u.id=m.created_by LEFT JOIN dbo.test_payment_requests r ON r.original_id=m.id ORDER BY m.id`)).recordset;
 return filterLegacyPaymentContext(ctx.workPaymentScope,{environment:'ISOLATED_TEST',suppliers,accounts,invoices,movements,maximumOperations:30});
},false);}
export async function payTestSupplier(i,actor){return atomic(actor,async(ctx,req)=>{if(!ctx.actualPaymentPermissions.includes('finance.payment')||!actor.permissions?.includes('finance.payment'))fail('TEST_PAYMENT_ACTOR','Bu işlem için yetkiniz bulunmuyor.',403);assertLegacyPaymentScope(ctx.workPaymentScope,i);return journal(ctx,actor,i,'payment',async()=>{
 keys(i,['requestId','supplierId','accountId','purchaseInvoiceId','amount','currency','documentDate','description']);date(i.documentDate);
 const amount=Number(i.amount);if(!Number.isFinite(amount)||amount<=0||amount>500||Math.abs(amount*100-Math.round(amount*100))>1e-7)fail('AMOUNT_INVALID','Tutar 0–500 arasında ve en fazla iki ondalık olmalı.');
 const {sqlDriver:s,transaction:t}=ctx;
 const supplier=(await req().input('id',s.BigInt,Number(i.supplierId)).query('SELECT s.* FROM dbo.test_payment_suppliers t JOIN dbo.suppliers s ON s.id=t.supplier_id WHERE s.id=@id')).recordset[0];
 const account=(await req().input('id',s.BigInt,Number(i.accountId)).query('SELECT a.* FROM dbo.test_payment_accounts t JOIN dbo.finance_accounts a ON a.id=t.account_id WHERE a.id=@id AND a.is_active=1')).recordset[0];
 if(!supplier||!account||supplier.currency_code!==i.currency||account.currency_code!==i.currency)fail('TEST_SCOPE','Yalnız tanımlı TEST tedarikçi ve aynı dövizli TEST hesabı kullanılabilir.',403);
 if(i.purchaseInvoiceId!=null){
  const p=(await req().input('id',s.BigInt,Number(i.purchaseInvoiceId)).query("SELECT p.* FROM dbo.test_payment_invoices t JOIN dbo.purchase_invoices p ON p.id=t.invoice_id WHERE p.id=@id AND p.status=N'finalized'")).recordset[0];
  if(!p||Number(p.supplier_id)!==Number(supplier.id))fail('TEST_INVOICE','Bu ödeme için yeni TEST faturası uygun değil.',409);
  const paid=(await req().input('id',s.BigInt,p.id).query("SELECT COALESCE(SUM(-balance_effect),0) paid FROM dbo.supplier_movements WHERE purchase_invoice_id=@id AND movement_type IN(N'payment',N'payment_cancel')")).recordset[0].paid;
  const state={sequence:0,audit:[],purchases:[{id:String(p.id),supplier:supplier.name,currency:p.document_currency,total:Math.round(Number(p.grand_total)*100)}],supplierPayments:paid?[{purchaseId:String(p.id),amount:Math.round(Number(paid)*100)}]:[]};
  try{recordSupplierPayment(state,{purchaseId:String(p.id),amount:Math.round(amount*100),currency:i.currency,method:{cash:'Nakit',bank:'Banka',card:'Kart'}[account.account_type],date:i.documentDate,note:i.description,requestId:i.requestId},'İlker')}catch(e){fail('SITES_PAYMENT_RULE',e.message,409)}
 }
 const result=await createSupplierPayment({...i,amount,paymentMethod:account.account_type},actor,{...ctx,linkedInvoiceId:i.purchaseInvoiceId?Number(i.purchaseInvoiceId):null});
 return {...result,purchaseInvoiceId:i.purchaseInvoiceId?Number(i.purchaseInvoiceId):null,requestId:i.requestId};
});});}
export async function cancelTestPayment(id,i,actor){return atomic(actor,async(ctx,req)=>{if(!ctx.actualPaymentPermissions.includes('finance.payment.cancel')||!actor.permissions?.includes('finance.payment.cancel'))fail('TEST_PAYMENT_ACTOR','Bu işlem için yetkiniz bulunmuyor.',403);return journal(ctx,actor,{...i,originalId:Number(id)},'payment_cancel',async()=>{
 keys(i,['requestId','reason','documentDate']);date(i.documentDate);if(typeof i.reason!=='string'||i.reason.trim().length<3||i.reason.length>300)fail('REASON_REQUIRED','En az 3 karakter iptal gerekçesi gerekli.');
 const {sqlDriver:s,transaction:t}=ctx;
 const m=(await req().input('id',s.BigInt,Number(id)).query("SELECT m.*,f.account_id,f.payment_method FROM dbo.test_payment_requests j JOIN dbo.supplier_movements m ON m.id=j.movement_id JOIN dbo.finance_account_movements f ON f.party_movement_id=m.id AND f.party_type=N'supplier' AND f.source_type=N'payment' WHERE j.operation=N'payment' AND m.id=@id")).recordset[0];
 if(m)assertLegacyPaymentScope(ctx.workPaymentScope,{supplierId:m.supplier_id,accountId:m.account_id,purchaseInvoiceId:m.purchase_invoice_id});
 if(!m)fail('TEST_ORIGINAL','Asıl TEST ödemesi bulunamadı.',404);
 await assertOperationQuarantineAllowed([{entity:'supplier',nativeId:m.supplier_id}],quarantineTransactionContext(s,t));
 if((await req().input('id',s.BigInt,Number(id)).query('SELECT original_id FROM dbo.test_payment_requests WHERE original_id=@id')).recordset.length)fail('ALREADY_CANCELLED','Ödeme zaten iptal edildi.',409);
 try{cancelSupplierPayment({audit:[],supplierPayments:[{id:String(id)}]},String(id),i.reason,'İlker')}catch(e){fail('SITES_PAYMENT_RULE',e.message,409)}
 if(m.account_amount==null||m.amount_try==null||m.document_exchange_rate_snapshot==null||m.account_exchange_rate_snapshot==null)fail('SNAPSHOT_REQUIRED','Özgün kur kaydı olmadan ters hareket oluşturulamaz.',409);
 await assertAccountingPeriodOpen(req(),i.documentDate,'Tedarikçi ödeme iptali');
 const result=await req().input('id',s.BigInt,id).input('date',s.Date,i.documentDate).input('actor',s.BigInt,actor.id).query(`DECLARE @ids TABLE(id bigint);INSERT dbo.supplier_movements(supplier_id,purchase_invoice_id,movement_type,amount,currency_code,balance_effect,document_date,created_by,account_currency,account_amount,document_exchange_rate_snapshot,account_exchange_rate_snapshot,amount_try) OUTPUT inserted.id INTO @ids SELECT supplier_id,purchase_invoice_id,N'payment_cancel',amount,currency_code,account_amount,@date,@actor,account_currency,account_amount,document_exchange_rate_snapshot,account_exchange_rate_snapshot,amount_try FROM dbo.supplier_movements WHERE id=@id; UPDATE s SET balance=s.balance+m.account_amount,updated_at=SYSUTCDATETIME() FROM dbo.suppliers s JOIN dbo.supplier_movements m ON m.supplier_id=s.id WHERE m.id=@id; SELECT id FROM @ids;`);
 const movementId=Number(result.recordset[0].id),account=await resolveFinanceAccount(t,s,{accountId:Number(m.account_id),currency:m.currency_code,paymentMethod:m.payment_method});
 const updated=await writeFinanceAccountMovement(t,s,{account,sourceType:'payment_cancel',partyType:'supplier',partyMovementId:movementId,amount:Number(m.amount),currency:m.currency_code,paymentMethod:m.payment_method,documentNo:`ODI-${movementId}`,documentDate:i.documentDate,description:i.reason,actor});
 await writeAuditLog(req(),{actor,action:'supplier_payment_cancelled',entityType:'supplier_movement',entityId:movementId,afterSnapshot:{originalId:Number(id),reason:i.reason,amount:Number(m.amount),currency:m.currency_code,accountId:Number(m.account_id)}});
 return {id:movementId,originalId:Number(id),amount:Number(m.amount),currency:m.currency_code,account:updated,requestId:i.requestId};
});});}


