import {assertOperationQuarantineAllowed,quarantineTransactionContext} from './operationQuarantineService.js';
import {createHash} from 'node:crypto';
import {getSqlPool,getSqlDriver} from '../config/database.js';
import {withTestSalesMutation} from './testSalesScope.mjs';
import {createSupplierPayment,resolveFinanceAccount,writeFinanceAccountMovement} from './financeService.js';
import {resolveCurrencySettlement} from './currencySettlementStore.mjs';
import {assertAccountingPeriodOpen} from './periodLockService.js';
import {writeAuditLog} from './auditService.js';
const fail=(code,message,statusCode=409)=>{throw Object.assign(new Error(message),{code,statusCode})};
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
async function atomic(actor,fn,permission){return withTestSalesMutation(async()=>{
 const pool=await getSqlPool(),s=getSqlDriver(),t=new s.Transaction(pool);await t.begin();const req=()=>new s.Request(t),c={pool,sqlDriver:s,transaction:t};
 try{await req().query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;IF @r<0 THROW 51071,'TEST_LOCK_TIMEOUT',1;IF DB_NAME()<>N'MELISA_ERP_SIRKET_TEST_20260929_01' THROW 51070,'WRONG_DATABASE',1;");
 if(permission&&(Number(actor.id)!==16||!actor.permissions?.includes(permission)))fail('REFUND_PERMISSION','Para dönüşü için yetkili İlker TEST oturumu gerekli.',403);
 const value=await fn(c,req,s);await t.commit();return value;
 }catch(e){try{await t.rollback()}catch{}if(e.number===51070||e.originalError?.info?.number===51070)fail('TEST_DATABASE_BOUNDARY','TEST SQL hatası: işlem tamamen geri alındı.');throw e}
});}
async function journal(c,req,s,i,actor,op,fn){
 if(!/^[a-zA-Z0-9-]{16,64}$/.test(i.requestId||''))fail('REQUEST_ID_REQUIRED','Kalıcı istek kimliği gerekli.',400);
 const hash=createHash('sha256').update(JSON.stringify(canonical({...i,operation:op}))).digest('hex');
 const old=(await req().input('id',s.NVarChar(64),i.requestId).query('SELECT * FROM dbo.test_refund_requests WHERE request_id=@id')).recordset[0];
 if(old){if(old.payload_hash!==hash||Number(old.actor_id)!==Number(actor.id))fail('REQUEST_CONFLICT','İstek kimliği başka içerikle kullanılamaz.');return {...JSON.parse(old.response_json),replayed:true}}
 if((await req().query('SELECT COUNT(*) n FROM dbo.test_refund_requests')).recordset[0].n>=40)fail('TEST_LIMIT','40 TEST işlemi sınırı doldu.');
 const v=await fn();if(v.alreadyApplied)return v;
 await req().input('id',s.NVarChar(64),i.requestId).input('hash',s.Char(64),hash).input('actor',s.BigInt,actor.id).input('op',s.NVarChar(30),op).input('movement',s.BigInt,v.id).input('source',s.BigInt,v.sourcePaymentId||null).input('original',s.BigInt,v.originalId||null).input('reason',s.NVarChar(500),i.reason).input('json',s.NVarChar(s.MAX),JSON.stringify(v)).query('INSERT dbo.test_refund_requests(request_id,payload_hash,actor_id,operation,movement_id,source_payment_id,original_id,reason,response_json)VALUES(@id,@hash,@actor,@op,@movement,@source,@original,@reason,@json)');return {...v,replayed:false};
}
function validate(i,allowed){if(Object.keys(i).some(k=>!allowed.includes(k)))fail('TEST_PAYLOAD','Kapsam dışı alan.',400);if(typeof i.reason!=='string'||i.reason.trim().length<5||i.reason.length>500)fail('REASON_REQUIRED','5–500 karakter gerekçe gerekli.',400);if(!/^\d{4}-\d{2}-\d{2}$/.test(i.documentDate||'')||!Number.isFinite(Date.parse(i.documentDate))||new Date(i.documentDate).toISOString().slice(0,10)!==i.documentDate)fail('DATE_INVALID','Geçerli işlem tarihi gerekli.',400);}
export async function refundContext(actor){return atomic(actor,async(c,req)=>{
 const scope=(await req().query('SELECT t.*,s.name,s.balance,a.account_name,a.account_type,a.opening_balance,a.current_balance FROM dbo.test_refund_scope t JOIN dbo.suppliers s ON s.id=t.supplier_id JOIN dbo.finance_accounts a ON a.id=t.account_id ORDER BY s.id')).recordset;
 const movements=(await req().query("SELECT m.*,j.request_id,j.source_payment_id,j.original_id,j.reason,j.created_at recorded_at,r.movement_id reversed_by,f.id finance_movement_id,f.account_id,f.direction,f.document_no,u.display_name actor FROM dbo.test_refund_requests j JOIN dbo.supplier_movements m ON m.id=j.movement_id JOIN dbo.finance_account_movements f ON f.party_type=N'supplier' AND f.party_movement_id=m.id AND f.source_type=m.movement_type JOIN dbo.users u ON u.id=m.created_by LEFT JOIN dbo.test_refund_requests r ON r.original_id=m.id ORDER BY m.id")).recordset;
 return {environment:'ISOLATED_TEST',scope,movements};
 });}
export async function prepareRefund(i,actor){validate(i,['requestId','supplierId','reason','documentDate']);return atomic(actor,(c,req,s)=>journal(c,req,s,i,actor,'payment',async()=>{
 const scope=(await req().input('id',s.BigInt,Number(i.supplierId)).query('SELECT t.*,a.account_type FROM dbo.test_refund_scope t JOIN dbo.finance_accounts a ON a.id=t.account_id WHERE supplier_id=@id')).recordset[0];if(!scope)fail('REFUND_SCOPE','Tanımlı yeni TEST tedarikçisi gerekli.',403);
 const old=(await req().input('id',s.BigInt,scope.supplier_id).query("SELECT j.response_json FROM dbo.test_refund_requests j JOIN dbo.supplier_movements m ON m.id=j.movement_id WHERE j.operation=N'payment' AND m.supplier_id=@id")).recordset[0];if(old)return {...JSON.parse(old.response_json),alreadyApplied:true};
 return createSupplierPayment({supplierId:Number(scope.supplier_id),accountId:Number(scope.account_id),amount:100,currency:scope.currency_code,paymentMethod:scope.account_type,documentDate:i.documentDate,description:i.reason},actor,c);
 }),'finance.payment');}
export async function supplierRefund(i,actor){validate(i,['requestId','sourcePaymentId','accountId','amount','currency','reason','documentDate']);return atomic(actor,(c,req,s)=>journal(c,req,s,i,actor,'supplier_refund',async()=>{
 const source=(await req().input('id',s.BigInt,Number(i.sourcePaymentId)).query("SELECT m.* FROM dbo.test_refund_requests j JOIN dbo.supplier_movements m ON m.id=j.movement_id WHERE j.operation=N'payment' AND m.id=@id")).recordset[0];if(!source)fail('REFUND_SOURCE','Özgün TEST ödemesi bulunamadı.');
 const scope=(await req().input('id',s.BigInt,source.supplier_id).input('a',s.BigInt,Number(i.accountId)).query('SELECT t.*,v.balance,a.account_type FROM dbo.test_refund_scope t JOIN dbo.suppliers v WITH(UPDLOCK,HOLDLOCK) ON v.id=t.supplier_id JOIN dbo.finance_accounts a ON a.id=t.account_id WHERE t.supplier_id=@id AND t.account_id=@a')).recordset[0];
 if(!scope||scope.currency_code!==i.currency||source.currency_code!==i.currency)fail('SAME_CURRENCY_REQUIRED','Yalnız tanımlı aynı dövizli tedarikçi ve hesabı; çapraz döviz kuralı yok.',403);
 const amount=Number(i.amount);if(!Number.isFinite(amount)||amount<=0||amount>100||Math.abs(amount*100-Math.round(amount*100))>1e-7)fail('AMOUNT_INVALID','Tutar pozitif, en fazla100 ve iki ondalık olmalı.',400);
 const used=Number((await req().input('id',s.BigInt,source.id).query("SELECT COALESCE(SUM(m.balance_effect),0) used FROM dbo.test_refund_requests j JOIN dbo.supplier_movements m ON m.id=j.movement_id WHERE j.source_payment_id=@id")).recordset[0].used);
 if(amount>Number(source.account_amount)-used+1e-8||amount>-Number(scope.balance)+1e-8)fail('REFUND_EXCEEDS_CREDIT','Para dönüşü açık alacak veya özgün ödemenin kalanını aşamaz.');
 await assertAccountingPeriodOpen(req(),i.documentDate,'Tedarikçiden para dönüşü');
 const settlement=await resolveCurrencySettlement(req(),{documentAmount:amount,documentCurrency:i.currency,accountCurrency:scope.currency_code,documentDate:i.documentDate});
 return writeReturn(c,req,s,actor,{...i,amount,supplierId:Number(source.supplier_id),sourcePaymentId:Number(source.id),purchaseInvoiceId:source.purchase_invoice_id,accountType:scope.account_type,settlement},false);
 }),'finance.payment');}
export async function cancelSupplierRefund(id,i,actor){validate(i,['requestId','reason','documentDate']);return atomic(actor,(c,req,s)=>journal(c,req,s,{...i,originalId:Number(id)},actor,'supplier_refund_cancel',async()=>{
 const m=(await req().input('id',s.BigInt,Number(id)).query("SELECT m.*,j.source_payment_id,f.account_id,f.payment_method FROM dbo.test_refund_requests j JOIN dbo.supplier_movements m ON m.id=j.movement_id JOIN dbo.finance_account_movements f ON f.party_type=N'supplier' AND f.party_movement_id=m.id AND f.source_type=m.movement_type WHERE j.operation=N'supplier_refund' AND m.id=@id")).recordset[0];if(!m)fail('REFUND_ORIGINAL','Özgün para dönüşü bulunamadı.',404);
 const old=(await req().input('id',s.BigInt,Number(id)).query('SELECT response_json FROM dbo.test_refund_requests WHERE original_id=@id')).recordset[0];if(old)return {...JSON.parse(old.response_json),alreadyApplied:true};
 if([m.account_amount,m.amount_try,m.document_exchange_rate_snapshot,m.account_exchange_rate_snapshot].some(v=>v==null))fail('SNAPSHOT_REQUIRED','Özgün kur kaydı olmadan iptal yapılamaz.');
 await assertAccountingPeriodOpen(req(),i.documentDate,'Tedarikçi para dönüş iptali');
 return writeReturn(c,req,s,actor,{...i,originalId:Number(id),sourcePaymentId:Number(m.source_payment_id),supplierId:Number(m.supplier_id),purchaseInvoiceId:m.purchase_invoice_id,accountId:Number(m.account_id),accountType:m.payment_method,amount:Number(m.amount),currency:m.currency_code,settlement:{accountCurrency:m.account_currency,accountAmount:Number(m.account_amount),documentRateToTry:Number(m.document_exchange_rate_snapshot),accountRateToTry:Number(m.account_exchange_rate_snapshot),amountTry:Number(m.amount_try)}},true);
 }),'finance.payment.cancel');}
async function writeReturn(c,req,s,actor,v,cancel){
 await assertOperationQuarantineAllowed([{entity:'supplier',nativeId:v.supplierId}],quarantineTransactionContext(s,c.transaction));
 const type=cancel?'supplier_refund_cancel':'supplier_refund',effect=(cancel?-1:1)*v.settlement.accountAmount,a=v.settlement;
 const account=await resolveFinanceAccount(c.transaction,s,{accountId:v.accountId,currency:v.currency,paymentMethod:v.accountType});
 const row=(await req().input('supplier',s.BigInt,v.supplierId).input('purchase',s.BigInt,v.purchaseInvoiceId||null).input('type',s.NVarChar(40),type).input('amount',s.Decimal(18,4),v.amount).input('currency',s.NVarChar(3),v.currency).input('effect',s.Decimal(18,4),effect).input('date',s.Date,v.documentDate).input('actor',s.BigInt,actor.id).input('ac',s.NVarChar(3),a.accountCurrency).input('aa',s.Decimal(18,4),a.accountAmount).input('dr',s.Decimal(18,8),a.documentRateToTry).input('ar',s.Decimal(18,8),a.accountRateToTry).input('try',s.Decimal(18,4),a.amountTry).query(`DECLARE @ids TABLE(id bigint);INSERT dbo.supplier_movements(supplier_id,purchase_invoice_id,movement_type,amount,currency_code,balance_effect,document_date,created_by,account_currency,account_amount,document_exchange_rate_snapshot,account_exchange_rate_snapshot,amount_try) OUTPUT inserted.id INTO @ids VALUES(@supplier,@purchase,@type,@amount,@currency,@effect,@date,@actor,@ac,@aa,@dr,@ar,@try);UPDATE dbo.suppliers SET balance=balance+@effect,updated_at=SYSUTCDATETIME() WHERE id=@supplier;SELECT id FROM @ids;`)).recordset[0];
 const id=Number(row.id),updated=await writeFinanceAccountMovement(c.transaction,s,{account,sourceType:type,partyType:'supplier',partyMovementId:id,amount:v.amount,currency:v.currency,paymentMethod:v.accountType,documentNo:`${cancel?'TDPI':'TDP'}-${id}`,documentDate:v.documentDate,description:v.reason,actor});
 const result={id,sourcePaymentId:v.sourcePaymentId,originalId:v.originalId||null,supplierId:v.supplierId,accountId:v.accountId,amount:v.amount,currency:v.currency,balanceEffect:effect,...a,account:updated};
 await writeAuditLog(req(),{actor,action:type,entityType:'supplier_movement',entityId:id,afterSnapshot:{...result,reason:v.reason}});return result;
}
