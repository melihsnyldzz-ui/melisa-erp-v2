import {postNativeCurrencyAccount,verifyNativeCurrencyAccount} from './nativeCurrencyAccount.mjs';
import {pilotProductScopeSql} from './pilotProductScope.mjs';
import {getSqlPool,getSqlDriver} from '../config/database.js';
import {assertMelisaWriteEnabled} from './writeGuardService.js';
import {createSalesDraft,finalizeSalesInvoice,getSalesDraft,cancelSalesInvoice} from './invoiceDraftService.js';
import {authenticateUserCredentials,getUserById} from './authService.js';
import {writeAuditLog} from './auditService.js';
import {nativeSigner,nativeRequestContext} from './nativeTerminalCatalog.mjs';
import {nativeError,positiveId,saleIdentity,validateQuotedLines} from './nativeTerminalPolicy.mjs';
import {assertNativeCustomerAccess,withNativeCustomerAccess,lockNativeCustomerRoutes} from './nativeCustomerRoutes.mjs';

const receiptDto=invoice=>({invoiceId:Number(invoice.id),documentNumber:invoice.documentNo,documentDate:new Date(invoice.documentDate).toISOString(),status:invoice.status,customerName:invoice.customerName,currency:invoice.documentCurrency,grandTotal:Number(invoice.grandTotal).toFixed(2)});
async function transaction(work){
 const pool=await getSqlPool(),sqlDriver=getSqlDriver(),transaction=new sqlDriver.Transaction(pool);
 const ctx={pool,sqlDriver,transaction,nativeTerminalV1:true},request=()=>new sqlDriver.Request(transaction);
 await transaction.begin(sqlDriver.ISOLATION_LEVEL.SERIALIZABLE);
 let committing=false;
 try {const result=await work(ctx,request);committing=true;await transaction.commit();return result;}
 catch(error){try{await transaction.rollback();}catch{}if(committing)nativeError('NATIVE_COMMIT_UNCONFIRMED','Satış sonucu belirsiz; aynı fiş kimliğiyle sonucu kontrol edin.',503);throw error;}
}
function assertRow(row,actor,terminalCode,digest=null){
 if(row.event_type!=='invoice_created'||Number(row.user_id)!==Number(actor.id))nativeError('NATIVE_RECEIPT_OWNER','Fiş başka personele veya uygulamaya ait.',403);
 const saved=JSON.parse(row.payload_json);
 if(saved.kind!=='native_sale_v1')nativeError('NATIVE_RECEIPT_OWNER','Fiş başka personele veya uygulamaya ait.',403);
 if(saved.business.terminalCode!==terminalCode||(digest&&saved.digest!==digest))nativeError('NATIVE_IDEMPOTENCY_CONFLICT','Aynı fiş kimliği farklı içerik veya cihazla kullanılamaz.',409);
 if(!row.target_entity_id||row.target_entity!=='sales_invoice')nativeError('NATIVE_RECEIPT_REVIEW','Fiş yönetici kontrolü gerektiriyor.',409);
}
async function verifiedReceipt(row,ctx,request){
 const invoice=await getSalesDraft(Number(row.target_entity_id),ctx);
 if(!['FINALIZED','CANCELLED'].includes(invoice.status))return {state:'REVIEW_REQUIRED',mayResend:false};
 const sql=getSqlDriver();
 const effects=(await request().input('nativeReceipt',sql.BigInt,invoice.id).query(`
  SELECT product_id,SUM(quantity_net) AS quantity,COUNT(*) AS movement_count FROM dbo.stock_movements WHERE source_type=N'sales_invoice' AND source_id=@nativeReceipt GROUP BY product_id;
  SELECT movement_type,amount,balance_effect,currency_code FROM dbo.customer_movements WHERE sales_invoice_id=@nativeReceipt;
 `)).recordsets;
 const cancelled=invoice.status==='CANCELLED';
 const equal=(a,b)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<0.0001;
 const expected=new Map(invoice.items.map(i=>[Number(i.productId),cancelled?0:-Number(i.quantity)]));
 const stockValid=effects[0].length===expected.size&&effects[0].every(r=>expected.has(Number(r.product_id))&&equal(r.quantity,expected.get(Number(r.product_id)))&&Number(r.movement_count)===(cancelled?2:1));
 const sales=effects[1].filter(r=>r.movement_type==='sales_invoice'),cancellations=effects[1].filter(r=>r.movement_type==='sales_invoice_cancel');
 if(!stockValid||sales.length!==1||!equal(sales[0].amount,invoice.grandTotal)||!equal(sales[0].balance_effect,invoice.grandTotal)||sales[0].currency_code!==invoice.documentCurrency||cancellations.length!==(cancelled?1:0)||effects[1].some(r=>r.currency_code!==invoice.documentCurrency))nativeError('NATIVE_EFFECT_UNVERIFIED','Fişin stok veya cari etkisi doğrulanamadı; yönetici kontrol etmeli.',503);
 if(cancelled&&(!equal(cancellations[0].amount,invoice.grandTotal)||!equal(cancellations[0].balance_effect,-Number(invoice.grandTotal))))nativeError('NATIVE_REVERSAL_UNVERIFIED','Cari ters kaydı doğrulanamadı.',503);
 if(cancelled&&Math.abs(effects[1].filter(r=>r.movement_type!=='collection').reduce((n,r)=>n+Number(r.balance_effect),0))>0.0001)nativeError('NATIVE_REVERSAL_UNVERIFIED','Cari ters kaydı doğrulanamadı.',503);
 await verifyNativeCurrencyAccount(invoice.id,request,{required:row.requireCurrencyAccount===true||(row.payload_json&&JSON.parse(row.payload_json).version>=2),cancelled});
 return {state:cancelled?'CANCELLED':'COMPLETED',mayResend:false,receipt:receiptDto(invoice)};
}
export async function nativeSaleStatus(payload,actor){
 await nativeRequestContext(payload.terminalCode,actor);
 if(!/^[a-f0-9-]{36}$/i.test(payload.clientEventId||''))nativeError('NATIVE_KEY_INVALID','Fiş kimliği geçersiz.',400);
 const pool=await getSqlPool(),sql=getSqlDriver();
 const row=(await pool.request().input('key',sql.NVarChar(120),payload.clientEventId).query('SELECT * FROM dbo.terminal_sync_queue WHERE client_request_id=@key')).recordset[0];
 if(!row)return {state:'NOT_FOUND',mayResend:true};
 assertRow(row,actor,payload.terminalCode);return verifiedReceipt(row,null,()=>pool.request());
}
async function manager(body,permission){
 const user=await authenticateUserCredentials({username:body.username,password:body.password});
 if(!user.permissions.includes(permission))nativeError('NATIVE_APPROVAL_PERMISSION','Bu kullanıcının gerekli onay yetkisi yok.',403);
 return user;
}
export async function nativeDiscountApproval(body,actor){
 assertMelisaWriteEnabled();await nativeRequestContext(body.terminalCode,actor);
 const approvedBy=await manager(body,'sales.edit');
 if(!approvedBy.permissions.includes('sales.finalize'))nativeError('NATIVE_APPROVAL_PERMISSION','Satış onay yetkisi gerekli.',403);
 const {business,digest}=saleIdentity(body.sale,actor);
 if(body.terminalCode!==business.terminalCode||body.kind!=='discount'||business.discountRate<=5)nativeError('NATIVE_APPROVAL_INVALID','Onay kapsamı geçersiz.',400);
 const pool=await getSqlPool();await writeAuditLog(pool.request(),{action:'native_discount_approved',entityType:'terminal_sale',entityId:null,actor:approvedBy,afterSnapshot:{clientEventId:business.clientEventId,requestedBy:actor.id,discountRate:business.discountRate,digest}});
 return {approvalToken:nativeSigner().issue('discount',{digest,actorId:Number(actor.id),approvedBy:Number(approvedBy.id)},5*60*1000)};
}
export async function nativeSubmitSale(payload,actor){
 assertMelisaWriteEnabled();const {business,digest}=saleIdentity(payload,actor),operator=await nativeRequestContext(business.terminalCode,actor),signer=nativeSigner();
 // Resolve a previous commit before validating today's permissions/rates/approval expiry.
 const previous=await nativeSaleStatus(business,actor);
 if(previous.state!=='NOT_FOUND'){
  const pool=await getSqlPool(),sql=getSqlDriver();
  const row=(await pool.request().input('key',sql.NVarChar(120),business.clientEventId).query('SELECT * FROM dbo.terminal_sync_queue WHERE client_request_id=@key')).recordset[0];
  assertRow(row,actor,business.terminalCode,digest);nativeError('ALREADY_FINALIZED','Bu fiş daha önce kesinleştirildi. Sonucu Kontrol Et ile mevcut fişi açın.',409);
 }
 const priced=validateQuotedLines(business,actor,operator,signer);let approvedBy=null;
 if(business.discountRate>5){
  const approval=signer.verify(payload.approvalToken,'discount');
  if(approval.digest!==digest||approval.actorId!==Number(actor.id))nativeError('NATIVE_APPROVAL_CHANGED','Fiş değişmiş; yetkili onayı yenilenmeli.',403);
  const approver=await getUserById(approval.approvedBy);
  if(!approver.permissions.includes('sales.edit')||!approver.permissions.includes('sales.finalize'))nativeError('NATIVE_APPROVAL_REVOKED','Yetkilinin onay yetkisi artık geçerli değil.',403);
  approvedBy=approval.approvedBy;
 }
 return transaction(async(ctx,request)=>{
  const sql=ctx.sqlDriver;
  const existing=(await request().input('key',sql.NVarChar(120),business.clientEventId).query('SELECT * FROM dbo.terminal_sync_queue WITH(UPDLOCK,HOLDLOCK) WHERE client_request_id=@key')).recordset[0];
  if(existing){assertRow(existing,actor,business.terminalCode,digest);nativeError('ALREADY_FINALIZED','Bu fiş daha önce kesinleştirildi. Sonucu Kontrol Et ile mevcut fişi açın.',409);}
  await lockNativeCustomerRoutes(request);
  const customer=(await request().input('customer',sql.BigInt,business.customerId).query('SELECT id,customer_code,currency_code FROM dbo.customers WITH(UPDLOCK,HOLDLOCK) WHERE id=@customer AND is_active=1 AND is_deleted=0')).recordset[0];
  const customerAccess=await assertNativeCustomerAccess(customer,business.documentCurrency,operator,request);
  for(const item of [...priced.items].sort((a,b)=>a.productId-b.productId)){
   const p=(await request().input('product',sql.BigInt,item.productId).query(`SELECT id,stock_code FROM dbo.products WITH(UPDLOCK,HOLDLOCK) WHERE id=@product AND is_active=1 AND is_deleted=0 AND ${pilotProductScopeSql('@product')}`)).recordset[0];
   if(!p||p.stock_code!==item.quote.stockCode)nativeError('NATIVE_PRODUCT_CHANGED','Ürün pasif veya kimliği değişmiş.');
  }
  await request().input('device',sql.BigInt,operator.terminalDeviceId).input('user',sql.BigInt,actor.id).input('key',sql.NVarChar(120),business.clientEventId).input('payload',sql.NVarChar(sql.MAX),JSON.stringify({version:2,kind:'native_sale_v1',digest,business})).query("INSERT dbo.terminal_sync_queue(terminal_device_id,user_id,event_type,client_request_id,payload_json,status) VALUES(@device,@user,N'invoice_created',@key,@payload,N'processing')");
  const draft=await withNativeCustomerAccess(customerAccess,async()=>{
   const created=await createSalesDraft({documentNo:'MN-'+business.clientEventId.replaceAll('-','').slice(0,26),documentDate:new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Istanbul'}),customerId:business.customerId,customerCurrency:business.documentCurrency,documentCurrency:business.documentCurrency,exchangeRate:priced.exchangeRate,terminalDeviceId:operator.terminalDeviceId,employeeId:operator.employeeId,discountRate:business.discountRate,description:`Native V1 ${business.clientEventId} | ${business.note}`,items:priced.items.map(i=>({productId:i.productId,quantity:i.quantity,unitPrice:i.unitPrice,currency:business.documentCurrency,stockCode:i.quote.stockCode,productName:i.quote.productName,barcode:i.quote.barcode,averageCostTry:0}))},actor,ctx);
   await finalizeSalesInvoice(Number(created.id),actor,ctx);
   await postNativeCurrencyAccount(Number(created.id),ctx,actor);
   return created;
  });
  await request().input('key',sql.NVarChar(120),business.clientEventId).input('invoice',sql.BigInt,draft.id).query("UPDATE dbo.terminal_sync_queue SET status=N'synced',target_entity=N'sales_invoice',target_entity_id=@invoice,processed_at=SYSUTCDATETIME() WHERE client_request_id=@key");
  for(const item of priced.items)if(Math.abs(item.unitPrice-Number(item.quote.unitPrice))>0.005)await writeAuditLog(request(),{action:'native_receipt_price_overridden',entityType:'sales_invoice',entityId:Number(draft.id),actor,beforeSnapshot:{productId:item.productId,price:item.quote.unitPrice,quotedAt:item.quote.quotedAt},afterSnapshot:{productId:item.productId,price:item.unitPrice,employeeId:operator.employeeId,changes:business.changes.filter(c=>c.productId===item.productId)}});
  await writeAuditLog(request(),{action:'native_sale_finalized',entityType:'sales_invoice',entityId:Number(draft.id),actor,afterSnapshot:{clientEventId:business.clientEventId,digest,discountRate:business.discountRate,approvedBy,changes:business.changes,collectionMode:'none',negativeStockAllowed:true,source:'melisa'}});
  const collections=(await request().input('invoice',sql.BigInt,draft.id).query("SELECT id FROM dbo.customer_movements WHERE sales_invoice_id=@invoice AND movement_type=N'collection'")).recordset;
  if(collections.length)nativeError('NATIVE_COLLECTION_UNEXPECTED','Terminal satışı tahsilat oluşturamaz. İşlem geri alındı.',503);
  return verifiedReceipt({target_entity_id:draft.id,requireCurrencyAccount:true},ctx,request);
 });
}
export async function nativeCancelSale(body,actor){
 assertMelisaWriteEnabled();const operator=await nativeRequestContext(body.terminalCode,actor),approvedBy=await manager(body,'sales.cancel'),invoiceId=positiveId(body.invoiceId);
 return transaction(async(ctx,request)=>{
  const sql=ctx.sqlDriver;
  const row=(await request().input('invoice',sql.BigInt,invoiceId).query("SELECT * FROM dbo.terminal_sync_queue WITH(UPDLOCK,HOLDLOCK) WHERE event_type=N'invoice_created' AND JSON_VALUE(CASE WHEN ISJSON(payload_json)=1 THEN payload_json ELSE N'{}' END,N'$.kind')=N'native_sale_v1' AND target_entity=N'sales_invoice' AND target_entity_id=@invoice")).recordset[0];
  if(!row)nativeError('NATIVE_RECEIPT_NOT_FOUND','Native fiş bulunamadı.',404);
  assertRow(row,actor,body.terminalCode);
  const invoice=await getSalesDraft(invoiceId,ctx);
  if(invoice.status!=='CANCELLED'){
   await cancelSalesInvoice(invoiceId,{reason:'Native terminal iptal/düzeltme talebi; yetkili şifre onayı.'},approvedBy,{...ctx,nativeApproval:true});
   if(JSON.parse(row.payload_json).version>=2)await postNativeCurrencyAccount(invoiceId,ctx,approvedBy,{cancel:true});
   await writeAuditLog(request(),{action:'native_cancel_approved',entityType:'sales_invoice',entityId:invoiceId,actor:approvedBy,afterSnapshot:{requestedBy:Number(actor.id),employeeId:operator.employeeId,terminalCode:body.terminalCode}});
  }
  return verifiedReceipt(row,ctx,request);
 });
}
export async function nativeOwnedInvoice(invoiceId,terminalCode,actor){
 await nativeRequestContext(terminalCode,actor);const pool=await getSqlPool(),sql=getSqlDriver();
 const row=(await pool.request().input('invoice',sql.BigInt,positiveId(invoiceId)).query("SELECT * FROM dbo.terminal_sync_queue WHERE event_type=N'invoice_created' AND JSON_VALUE(CASE WHEN ISJSON(payload_json)=1 THEN payload_json ELSE N'{}' END,N'$.kind')=N'native_sale_v1' AND target_entity=N'sales_invoice' AND target_entity_id=@invoice")).recordset[0];
 if(!row)nativeError('NATIVE_RECEIPT_NOT_FOUND','Fiş bulunamadı.',404);assertRow(row,actor,terminalCode);return row;
}
