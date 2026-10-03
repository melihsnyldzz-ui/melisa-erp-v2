import {createHash} from 'node:crypto';
import {ADMIN_MODE,assertAdminCancel} from './adminSaleCancel.mjs';
import {getSqlPool,getSqlDriver} from '../config/database.js';
import {createSalesDraft,finalizeSalesInvoice,cancelSalesInvoice,getSalesDraft} from './invoiceDraftService.js';
import {withTestSalesMutation} from './testSalesScope.mjs';
const reject=(code,message,statusCode=409)=>{throw Object.assign(new Error(message),{code,statusCode})};
export function canWriteTestSale(actor,scope){
 return Number(actor?.id)===Number(scope.seller_id)||actor?.role?.code==='admin'&&actor?.permissions?.includes('sales.create')&&actor?.permissions?.includes('sales.finalize');
}
export const testCostSnapshot=value=>value==null?null:Number(value);
export function validateTestOrder(input,scope){
 if(!/^[a-zA-Z0-9-]{16,64}$/.test(input.requestId||''))reject('TEST_REQUEST_ID_REQUIRED','Kalıcı istek kimliği gerekli.',400);
 if(Number(input.customerId)!==Number(scope.customer_id)||!Array.isArray(input.items)||input.items.length!==1)reject('TEST_SCOPE_REQUIRED','Yalnız tanımlı TEST cari/ürünü kullanılabilir.',403);
 const item=input.items[0];
 if(Number(item.productId)!==Number(scope.product_id)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>5)reject('TEST_SCOPE_REQUIRED','Yalnız TEST ürünü ve 1–5 adet kabul edilir.',403);
 if(Object.keys(input).some(k=>!['requestId','customerId','items'].includes(k))||Object.keys(item).some(k=>!['productId','quantity'].includes(k)))reject('TEST_PAYLOAD_UNSUPPORTED','Fiyat, döviz ve ticari alanlar bu kabulde sunucu tarafından belirlenir.',400);
 return {customerId:Number(scope.customer_id),productId:Number(scope.product_id),quantity:item.quantity};
}
async function readScope(request){
 const r=(await request.query("SELECT s.*,DB_NAME() databaseName,p.stock_code,p.name product_name,p.sales_price,p.current_stock_qty,p.average_cost_try,c.customer_code,c.name customer_name,c.balance FROM dbo.test_sales_scope s JOIN dbo.products p ON p.id=s.product_id JOIN dbo.customers c ON c.id=s.customer_id WHERE s.id=1")).recordset[0];
 if(!r||r.databaseName!=='MELISA_ERP_SIRKET_TEST_20260929_01'||r.stock_code!=='TEST-V70-20260929-P'||r.customer_code!=='TEST-V70-20260929-C'||Number(r.sales_price)!==100)reject('TEST_SCOPE_IDENTITY_CHANGED','TEST kimliği değişti; yazma kapalı.',503);
 return r;
}
export async function testSalesContext(){
 const pool=await getSqlPool(),scope=await readScope(pool.request());
 return {environment:'ISOLATED_TEST',database:scope.databaseName,customerId:Number(scope.customer_id),productId:Number(scope.product_id),maximumQuantity:5,maximumSales:scope.max_sales,unitPrice:100,currency:'TRY',externalOperations:false};
}
async function transactionTask(actor,operation){
 return withTestSalesMutation(async()=>{
  const pool=await getSqlPool(),sqlDriver=getSqlDriver(),transaction=new sqlDriver.Transaction(pool);await transaction.begin();
  const ctx={pool,sqlDriver,transaction};
  try{
   await new sqlDriver.Request(transaction).query("DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000; IF @r<0 THROW 51071,'TEST_LOCK_TIMEOUT',1;");
   const scope=await readScope(new sqlDriver.Request(transaction));
   if(!canWriteTestSale(actor,scope))reject('TEST_ACTOR_NOT_ALLOWED','Bu oturum TEST satış yazıcısı değil.',403);
   const value=await operation(ctx,scope);await transaction.commit();return value;
  }catch(e){try{await transaction.rollback()}catch{}console.error(JSON.stringify({event:'TEST_SALES_ROLLED_BACK',code:e.code,number:e.number,message:e.message}));if(e.number===51070||e.originalError?.info?.number===51070)reject('TEST_DATABASE_BOUNDARY','TEST SQL sınırı işlemi bütünüyle geri aldı.',409);throw e}
 });
}
export async function completeTestSale(input,actor){
 return transactionTask(actor,async(ctx,scope)=>{
  const order=validateTestOrder(input,scope),{sqlDriver:sql,transaction}=ctx;
  const digest=createHash('sha256').update(JSON.stringify(order)).digest('hex');
  const previous=(await new sql.Request(transaction).input('request',sql.NVarChar(64),input.requestId).query('SELECT * FROM dbo.test_sales_requests WHERE request_id=@request')).recordset[0];
  if(previous){
   if(previous.payload_hash!==digest||Number(previous.actor_id)!==Number(actor.id))reject('TEST_REQUEST_CONFLICT','Bu istek kimliği farklı bir işlem için kullanılmış.');
   return {invoice:await getSalesDraft(previous.invoice_id,ctx),requestId:input.requestId,replayed:true};
  }
  const count=(await new sql.Request(transaction).query("SELECT COUNT(*) n FROM dbo.test_sales_requests r JOIN dbo.sales_invoices i ON i.id=r.invoice_id WHERE i.status<>N'cancelled'")).recordset[0].n;
  if(count>=scope.max_sales)reject('TEST_SALES_LIMIT','Açık TEST satış sınırı doldu; önce mevcut deneme fişini iptal edin.');
  const documentNo='TST70-'+createHash('sha256').update(input.requestId).digest('hex').slice(0,20);
  const draft=await createSalesDraft({documentNo,customerId:order.customerId,documentDate:new Date().toISOString().slice(0,10),customerCurrency:'TRY',documentCurrency:'TRY',exchangeRate:1,accountExchangeRate:1,description:'ISOLATED TEST V70 — gerçek ticari işlem değildir',items:[{productId:order.productId,stockCode:scope.stock_code,productName:scope.product_name,quantity:order.quantity,currency:'TRY',unitPrice:100,averageCostTry:testCostSnapshot(scope.average_cost_try)}]},actor,ctx);
  await finalizeSalesInvoice(draft.id,actor,ctx);
  await new sql.Request(transaction).input('id',sql.BigInt,draft.id).input('actor',sql.BigInt,actor.id).query('UPDATE dbo.sales_invoices SET created_by=@actor,updated_by=@actor WHERE id=@id');
  await new sql.Request(transaction).input('request',sql.NVarChar(64),input.requestId).input('hash',sql.Char(64),digest).input('actor',sql.BigInt,actor.id).input('invoice',sql.BigInt,draft.id).query('INSERT dbo.test_sales_requests(request_id,payload_hash,actor_id,invoice_id) VALUES(@request,@hash,@actor,@invoice)');
  return {invoice:await getSalesDraft(draft.id,ctx),requestId:input.requestId,replayed:false};
 });
}
export async function cancelTestSale(id,input,actor){
 return transactionTask(actor,async(ctx,scope)=>{
  const {sqlDriver:sql,transaction}=ctx;
  if(!Number.isSafeInteger(Number(id))||Number(id)<1)reject('TEST_INVOICE_INVALID','Fiş kimliği geçersiz.',400);
  if(typeof input.reason!=='string'||input.reason.trim().length<5)reject('TEST_CANCEL_REASON_REQUIRED','En az 5 karakter iptal nedeni gerekli.',400);
  const row=(await new sql.Request(transaction).input('id',sql.BigInt,Number(id)).query('SELECT invoice_id FROM dbo.test_sales_requests WHERE invoice_id=@id')).recordset[0];
  if(!row)reject('TEST_SCOPE_REQUIRED','Yalnız bu TEST akışının fişi iptal edilebilir.',403);
  const invoice=await getSalesDraft(Number(id),ctx);
  if(Number(invoice.customerId)!==Number(scope.customer_id))reject('TEST_SCOPE_REQUIRED','TEST cari kimliği uyuşmuyor.',403);
  if(input.acceptanceMode!==undefined){
   if(input.acceptanceMode!==ADMIN_MODE||Object.keys(input).some(k=>!['reason','acceptanceMode'].includes(k)))reject('TEST_ADMIN_CANCEL_BOUNDARY','Admin kabul tipi geçersiz.');
   const request=(await new sql.Request(transaction).input('id',sql.BigInt,Number(id)).query('SELECT r.request_id,r.payload_hash,r.actor_id,r.invoice_id,i.created_by invoice_actor_id FROM dbo.test_sales_requests r WITH(UPDLOCK,HOLDLOCK) JOIN dbo.sales_invoices i WITH(UPDLOCK,HOLDLOCK) ON i.id=r.invoice_id WHERE r.invoice_id=@id')).recordset[0];
   const collections=(await new sql.Request(transaction).input('id',sql.BigInt,Number(id)).query("SELECT id FROM dbo.customer_movements WITH(UPDLOCK,HOLDLOCK) WHERE sales_invoice_id=@id AND (movement_type IS NULL OR movement_type NOT IN(N'sales_invoice',N'sales_invoice_cancel'))")).recordset;
   const cashRow=(await new sql.Request(transaction).query('SELECT current_balance FROM dbo.finance_accounts WITH(UPDLOCK,HOLDLOCK) WHERE id=28 AND currency_code=N\'TRY\'')).recordset[0];
   assertAdminCancel({actor,request,invoice,id,collections,stock:Number(scope.current_stock_qty),balance:Number(scope.balance),cash:cashRow?Number(cashRow.current_balance):null});
  }
  if(invoice.status==='CANCELLED')return {invoice,replayed:true};
  await cancelSalesInvoice(Number(id),{reason:input.reason},actor,ctx);
  return {invoice:await getSalesDraft(Number(id),ctx),replayed:false};
 });
}
