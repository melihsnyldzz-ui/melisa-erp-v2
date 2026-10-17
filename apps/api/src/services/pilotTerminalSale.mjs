import {assertOperationQuarantineAllowed,quarantineTransactionContext} from './operationQuarantineService.js';
import {pilotProductScopeSql} from './pilotProductScope.mjs';
import {getSqlPool,getSqlDriver} from '../config/database.js';
import {assertMelisaWriteEnabled} from './writeGuardService.js';
import {getTerminalOperatorContext} from './terminalService.js';
import {createSalesDraft,finalizeSalesInvoice,getSalesDraft} from './invoiceDraftService.js';
import {writeAuditLog} from './auditService.js';
import {pilotDigest,pilotError,verifyPilotCard,pilotScope} from './pilotTerminalCatalog.mjs';
import {assertPilotCashCustomer} from './pilotCashPolicy.mjs';

const id=value=>Number.isSafeInteger(Number(value))&&Number(value)>0;
function identity(payload,actor){
 const permissions=actor?.permissions||[];
 if(!id(actor?.id)||(!permissions.includes('terminal.sales.create')&&!(permissions.includes('sales.create')&&permissions.includes('sales.finalize'))))pilotError('PILOT_SALE_PERMISSION','Terminal satış yetkisi gerekli.',403);
 if(!/^[A-Za-z0-9._:-]{6,120}$/.test(payload?.clientEventId||'')||!/^[A-Za-z0-9._:-]{1,80}$/.test(payload?.terminalCode||''))pilotError('PILOT_REQUEST_ID','Geçerli işlem ve terminal kimliği gerekli.',400);
 if(payload.sourceContract!=='melisa-pilot-v1'||payload.customerSource!=='melisa'||payload.company!==pilotScope.company||payload.period!==pilotScope.period||payload.testMode===true)pilotError('PILOT_SOURCE_MISMATCH','Yalnız Melisa pilot fişi kabul edilir.',400);
 if(!id(payload.customerId)||!Array.isArray(payload.items)||!payload.items.length||payload.items.length>200||!['TRY','USD','EUR'].includes(payload.documentCurrency))pilotError('PILOT_SALE_INVALID','Cari, para birimi veya satırlar geçersiz.',400);
 for(const item of payload.items)if(!id(item.productId)||item.productSource!=='melisa'||!Number.isSafeInteger(item.quantity)||item.quantity<1||!Number.isFinite(item.unitPrice)||item.unitPrice<=0||item.currency!==payload.documentCurrency||typeof item.barcode!=='string')pilotError('PILOT_LINE_INVALID','Melisa ürünü, adet, fiyat veya satır para birimi geçersiz.',400);
 const business={terminalCode:payload.terminalCode,customerId:Number(payload.customerId),documentCurrency:payload.documentCurrency,exchangeRate:payload.exchangeRate,note:payload.note||'',items:payload.items.map(i=>({productId:Number(i.productId),barcode:i.barcode,quantity:i.quantity,unitPrice:i.unitPrice,currency:i.currency})),rateSnapshot:payload.rateSnapshot,offlineContext:payload.offlineContext,customerOfflineCard:payload.customerOfflineCard,productCards:payload.items.map(i=>i.offlineCard)};
 return {business,digest:pilotDigest(business)};
}
async function verifiedResponse(invoiceId,payload,{duplicate=false,ctx=null}={}){
 const invoice=await getSalesDraft(invoiceId,ctx),pool=ctx?.pool||await getSqlPool(),sql=getSqlDriver();
 const request=()=>ctx?new ctx.sqlDriver.Request(ctx.transaction):pool.request();
 if(invoice.status!=='FINALIZED')return {state:invoice.status==='CANCELLED'?'CANCELLED':'REVIEW_REQUIRED',invoiceId:Number(invoice.id),documentId:Number(invoice.id),documentNumber:invoice.documentNo,mayResend:false,submissionAttempted:true,commercialEffect:null};
 const effects=(await request().input('invoice',sql.BigInt,invoiceId).query(`SELECT SUM(quantity_net) AS net FROM dbo.stock_movements WHERE source_type=N'sales_invoice' AND source_id=@invoice;
 SELECT movement_type,amount,balance_effect,currency_code FROM dbo.customer_movements WHERE sales_invoice_id=@invoice;
 SELECT fam.id,fam.amount,fam.direction FROM dbo.finance_account_movements fam JOIN dbo.customer_movements cm ON cm.id=fam.party_movement_id AND fam.party_type=N'customer' WHERE cm.sales_invoice_id=@invoice AND fam.source_type=N'collection';`)).recordsets;
 const quantity=invoice.items.reduce((n,i)=>n+Number(i.quantity),0),saleEffects=effects[1].filter(r=>r.movement_type==='sales_invoice'),collections=effects[1].filter(r=>r.movement_type==='collection');
 if(Math.abs(Number(effects[0][0]?.net)+quantity)>0.0001||saleEffects.length!==1||Math.abs(Number(saleEffects[0].amount)-Number(invoice.grandTotal))>0.0001)pilotError('PILOT_EFFECTS_UNVERIFIED','Fişin stok/cari etkisi doğrulanamadı. Yeni fiş oluşturmayın.',503);
 const collectionConfirmed=collections.length===1&&effects[2].length===1&&Number(effects[2][0].amount)===Number(invoice.grandTotal)&&effects[2][0].direction==='in';
 const receipt={version:1,source:'melisa-pilot-sql',clientEventId:payload.clientEventId,documentId:Number(invoice.id),documentNumber:invoice.documentNo,documentDate:new Date(invoice.documentDate).toISOString().slice(0,10),customerId:Number(invoice.customerId),customerCode:invoice.customerCode,customerName:invoice.customerName,terminalCode:invoice.terminalCode,personnelCode:invoice.employeeCode,currency:invoice.documentCurrency,baseCurrency:'TRY',exchangeRate:String(invoice.exchangeRate),subtotal:String(invoice.subtotal),discountTotal:String(invoice.discountTotal),taxTotal:'0',grandTotal:String(invoice.grandTotal),baseTotal:String(invoice.amountTry),collectionConfirmed,
  lines:invoice.items.map(i=>({stockId:Number(i.productId),stockCode:i.stockCode,productName:i.productName,barcode:i.barcode,unit:'ADET',quantity:String(i.quantity),unitPrice:String(i.unitPrice),subtotal:String(i.lineTotal),discountTotal:'0',taxAmount:'0',lineTotal:String(i.lineTotal)}))};
 return {state:'VERIFIED',source:'melisa-pilot-sql',duplicate,invoiceId:Number(invoice.id),documentId:Number(invoice.id),documentNumber:invoice.documentNo,status:'finalized',mayResend:false,submissionAttempted:true,commercialEffect:true,receipt,stockEffects:invoice.items.map(i=>({productId:Number(i.productId),quantity:Number(i.quantity),effect:-Number(i.quantity)})),customerEffect:{customerId:Number(invoice.customerId),amount:Number(invoice.grandTotal),currency:invoice.documentCurrency},collectionConfirmed};
}
export async function pilotSaleStatus(payload,actor){
 const {digest}=identity(payload,actor);await getTerminalOperatorContext(payload.terminalCode,actor.id);
 const pool=await getSqlPool(),sql=getSqlDriver();
 const row=(await pool.request().input('key',sql.NVarChar(120),payload.clientEventId).query('SELECT * FROM dbo.terminal_sync_queue WHERE client_request_id=@key')).recordset[0];
 if(!row)return {state:'NOT_FOUND',source:'melisa-pilot-sql',mayResend:true,submissionAttempted:false,commercialEffect:false,clientEventId:payload.clientEventId};
 if(Number(row.user_id)!==Number(actor.id)||JSON.parse(row.payload_json).digest!==digest)pilotError('PILOT_IDEMPOTENCY_CONFLICT','Bu işlem kimliği farklı personele veya farklı fişe ait.',409);
 if(!row.target_entity_id||row.target_entity!=='sales_invoice')return {state:'REVIEW_REQUIRED',mayResend:false,submissionAttempted:true,commercialEffect:null};
 return verifiedResponse(Number(row.target_entity_id),payload,{duplicate:true});
}
export async function submitPilotSale(payload,actor){
  assertMelisaWriteEnabled();
  if(process.env.PILOT_RATE_APPROVED!=='true')pilotError('PILOT_RATE_APPROVAL_REQUIRED','Pilot döviz kuru henüz doğrulanmadı. Fiş taslakta korunuyor.');
 const {business,digest}=identity(payload,actor),operator=await getTerminalOperatorContext(payload.terminalCode,actor.id);
 const context=verifyPilotCard(payload.offlineContext,'context');
 if(Number(context.actorUserId)!==Number(actor.id)||context.username!==actor.username.toLowerCase()||context.terminalCode!==payload.terminalCode)pilotError('PILOT_CONTEXT_OWNER','Fişin personeli veya terminali farklı.',403);
 const customerCard=verifyPilotCard(payload.customerOfflineCard,'customer');
 if(customerCard.id!==Number(payload.customerId)||customerCard.currency!==payload.documentCurrency)pilotError('PILOT_CUSTOMER_CARD','Cari kaynak kaydı farklı.');
  const rateSet=verifyPilotCard(payload.rateSnapshot,'rates'),rates=new Map(rateSet.rates.filter(r=>r.defined&&r.rateToTry>0).map(r=>[r.currency,Number(r.rateToTry)]));
  if(rates.get('USD')!==Number(process.env.PILOT_APPROVED_USD)||rates.get('EUR')!==Number(process.env.PILOT_APPROVED_EUR))pilotError('PILOT_RATE_NOT_APPROVED','Fiş kur kaydı onaylanan pilot kurlarıyla eşleşmiyor. Verileri güncelleyin.');
 if(!rates.has(payload.documentCurrency)||Number(payload.exchangeRate)!==rates.get(payload.documentCurrency))pilotError('PILOT_RATE_CHANGED','Fiş kuru imzalı kur kaydıyla aynı değil.');
 const pool=await getSqlPool(),sql=getSqlDriver(),transaction=new sql.Transaction(pool),ctx={pool,sqlDriver:sql,transaction};
 await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 let commitStarted=false,committed=false;
 try {
  await assertOperationQuarantineAllowed([{entity:'customer',nativeId:business.customerId},...business.items.map(i=>({entity:'product',nativeId:i.productId}))],quarantineTransactionContext(sql,transaction));
  const identityRow=(await new sql.Request(transaction).query("SELECT DB_NAME() AS db,OBJECT_ID(N'dbo.finance_account_movements',N'U') AS finance")).recordset[0];
  if(identityRow.db!=='MELISA_ERP_V2'||!identityRow.finance)pilotError('PILOT_DATABASE_GUARD','Pilot veritabanı veya finans şeması doğrulanamadı.',503);
  // SQL unique key + key-range lock serializes even different API processes.
  const existing=(await new sql.Request(transaction).input('key',sql.NVarChar(120),payload.clientEventId).query('SELECT * FROM dbo.terminal_sync_queue WITH(UPDLOCK,HOLDLOCK) WHERE client_request_id=@key')).recordset[0];
  if(existing){
   if(Number(existing.user_id)!==Number(actor.id)||JSON.parse(existing.payload_json).digest!==digest)pilotError('PILOT_IDEMPOTENCY_CONFLICT','İşlem kimliği farklı içerikle tekrar kullanılamaz.');
   if(!existing.target_entity_id)pilotError('PILOT_EXISTING_INCOMPLETE','Mevcut işlemi yönetici kontrol etmeli. Yeni fiş oluşturmayın.');
   const response=await verifiedResponse(Number(existing.target_entity_id),payload,{duplicate:true,ctx});await transaction.commit();return response;
  }
  const customer=(await new sql.Request(transaction).input('id',sql.BigInt,payload.customerId).query('SELECT * FROM dbo.customers WITH(UPDLOCK,HOLDLOCK) WHERE id=@id AND is_active=1 AND is_deleted=0')).recordset[0];
  if(!customer||customer.currency_code!==payload.documentCurrency||customer.customer_code!==customerCard.code)pilotError('PILOT_CUSTOMER_CHANGED','Cari veya para birimi değişmiş.');
  await assertPilotCashCustomer(new sql.Request(transaction), payload.customerId, payload.documentCurrency);
  const productMap=new Map();
  // Lock products in stable order and check aggregate quantities, including repeated barcodes.
  for(const productId of [...new Set(business.items.map(i=>i.productId))].sort((a,b)=>a-b)){
   const p=(await new sql.Request(transaction).input('id',sql.BigInt,productId).query(`SELECT p.* FROM dbo.products p WITH(UPDLOCK,HOLDLOCK) WHERE p.id=@id AND p.is_active=1 AND p.is_deleted=0 AND ${pilotProductScopeSql('p.id')}`)).recordset[0];
   if(!p)pilotError('PILOT_PRODUCT_OUT_OF_SCOPE','Ürün pilot setinde aktif değil.');
   const total=business.items.filter(i=>i.productId===productId).reduce((n,i)=>n+i.quantity,0);
   if(Number(p.current_stock_qty)<total)pilotError('PILOT_STOCK_INSUFFICIENT','Pilot ürününün stoğu yetersiz. Fiş taslakta kaldı.');
   productMap.set(productId,p);
  }
  for(const item of payload.items){
   const card=verifyPilotCard(item.offlineCard,'product'),p=productMap.get(Number(item.productId));
   const signedBarcodes=card.barcodes||[card.barcode].filter(Boolean);
   if(card.id!==Number(p.id)||card.stockCode!==p.stock_code||card.currency!==p.currency_code||card.price!==Number(p.sales_price)||(item.barcode?!signedBarcodes.includes(item.barcode):signedBarcodes.length>0)||card.unit!=='ADET'||card.factor!==1||card.taxRate!==0)pilotError('PILOT_PRODUCT_CHANGED','Ürün, barkod veya fiyat değişmiş. Verileri güncelleyin.');
   const barcode=(await new sql.Request(transaction).input('id',sql.BigInt,p.id).input('barcode',sql.NVarChar(80),item.barcode).query('SELECT id FROM dbo.product_barcodes WHERE product_id=@id AND barcode=@barcode AND is_active=1')).recordset;
   if(item.barcode?barcode.length!==1:(await new sql.Request(transaction).input('id',sql.BigInt,p.id).query('SELECT id FROM dbo.product_barcodes WHERE product_id=@id AND is_active=1')).recordset.length>0)pilotError('PILOT_BARCODE_CHANGED','Barkod eşleştirmesi doğrulanamadı.');
   if(!rates.has(p.currency_code))pilotError('PILOT_PRODUCT_RATE_REQUIRED','Ürün para biriminin kuru eksik.');
   const reference=Number((Number(p.sales_price)*rates.get(p.currency_code)/rates.get(payload.documentCurrency)).toFixed(2));
   if(Math.abs(item.unitPrice-reference)>0.005&&(!operator.canChangeSalePrice||(reference-item.unitPrice)/reference*100>operator.maxSaleDiscountPercent+0.0001))pilotError('TERMINAL_EMPLOYEE_PRICE_CHANGE_RESTRICTED','Bu personelin fiyat değişikliği yetkisi yok.',403);
  }
  await new sql.Request(transaction).input('device',sql.BigInt,operator.terminalDeviceId).input('user',sql.BigInt,actor.id).input('key',sql.NVarChar(120),payload.clientEventId).input('body',sql.NVarChar(sql.MAX),JSON.stringify({version:1,digest,business})).query("INSERT dbo.terminal_sync_queue(terminal_device_id,user_id,event_type,client_request_id,payload_json,status) VALUES(@device,@user,N'invoice_created',@key,@body,N'processing')");
  const draft=await createSalesDraft({documentNo:'MP-'+pilotDigest(payload.clientEventId).slice(0,26),documentDate:new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Istanbul'}),customerId:Number(customer.id),terminalDeviceId:operator.terminalDeviceId,employeeId:operator.employeeId,customerCurrency:customer.currency_code,documentCurrency:payload.documentCurrency,exchangeRate:payload.exchangeRate,description:`Melisa pilot ${payload.clientEventId} | ${String(payload.note||'').slice(0,200)}`,items:business.items.map(i=>({...i,stockCode:productMap.get(i.productId).stock_code,productName:productMap.get(i.productId).name,averageCostTry:0,stockStatus:'Melisa pilot'}))},actor,ctx);
  await finalizeSalesInvoice(Number(draft.id),actor,ctx);
  await new sql.Request(transaction).input('key',sql.NVarChar(120),payload.clientEventId).input('invoice',sql.BigInt,draft.id).query("UPDATE dbo.terminal_sync_queue SET status=N'synced',target_entity=N'sales_invoice',target_entity_id=@invoice,processed_at=SYSUTCDATETIME() WHERE client_request_id=@key");
  await writeAuditLog(new sql.Request(transaction),{action:'pilot_terminal_sale_finalized',entityType:'sales_invoice',entityId:Number(draft.id),actor,afterSnapshot:{clientEventId:payload.clientEventId,digest,terminalCode:payload.terminalCode,source:'melisa',valuationAccepted:false}});
  const response=await verifiedResponse(Number(draft.id),payload,{ctx});
  commitStarted=true;await transaction.commit();committed=true;return response;
 }catch(error){
  let rolledBack=false;if(!committed)try{await transaction.rollback();rolledBack=true;}catch{}
  if(!commitStarted&&rolledBack){error.submissionAttempted=false;error.commercialEffect=false;}
  else {error.code='PILOT_COMMIT_OUTCOME_UNVERIFIED';error.statusCode=503;error.message='İşlem sonucu belirsiz. Aynı işlem kimliğiyle Melisa sonucunu kontrol edin.';}
  throw error;
 }
}
