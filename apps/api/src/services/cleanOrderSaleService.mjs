import {assertRegisteredCleanContext,CLEAN_IDENTITY_SQL,assertCleanIdentity} from './cleanSyntheticContext.mjs';
import {saleId,saleActor,saleAction,saleHash,saleFail,assertSaleLines,CLEAN_ORDER_RECEIPT_PROOF_SQL} from './cleanOrderSaleModel.mjs';
import {crmV2Fingerprint} from './crmOrderV2Contract.mjs';
import {withCleanOrderSaleMutation} from './cleanOrderSaleScope.mjs';
const statement=`${CLEAN_ORDER_RECEIPT_PROOF_SQL}
 SELECT CONVERT(varchar(20),o.id) id,o.document_no documentNo,CONVERT(char(10),o.document_date,23) documentDate,CONVERT(varchar(20),o.customer_id) customerId,c.name customerName,c.currency_code customerCurrency,o.document_currency currency,CONVERT(varchar(64),o.grand_total) totalExact4,CONVERT(varchar(64),o.exchange_rate_snapshot) rateExact8,CONVERT(varchar(64),c.balance) balanceExact4,CONVERT(varchar(64),o.row_version,2) orderVersion,CONVERT(varchar(64),c.row_version,2) customerVersion,CONVERT(varchar(36),r.request_id) requestId,r.body_json bodyJson,r.payload_hash receiptHash,r.actor_id sourceActor,r.crm_actor_id sourceCrmActor,c.is_active active,c.is_deleted deleted FROM dbo.sales_orders o WITH(UPDLOCK,HOLDLOCK) JOIN dbo.crm_order_v2_requests r ON r.order_id=o.id JOIN dbo.customers c WITH(UPDLOCK,HOLDLOCK) ON c.id=o.customer_id WHERE o.id=@orderId;
 SELECT CONVERT(varchar(20),l.product_id) productId,l.stock_code_snapshot stockCode,l.product_name_snapshot name,l.barcode_snapshot barcode,CONVERT(varchar(64),l.quantity) quantityExact3,CONVERT(varchar(64),l.unit_price) unitPriceExact4,l.currency_code currency,p.stock_code currentStockCode,p.name currentName,p.unit,p.is_active active,p.is_deleted deleted,CONVERT(varchar(64),p.current_stock_qty) stockExact3,CONVERT(varchar(64),v.price) currentPriceExact8,v.source_record_key priceSourceKey,CONVERT(varchar(64),p.row_version,2) productVersion,(SELECT COUNT(*) FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N'product' AND h.native_id=p.id) held,(SELECT TOP(1)b.barcode FROM dbo.product_barcodes b WHERE b.product_id=p.id AND b.is_primary=1 ORDER BY b.id) mainBarcode,(SELECT COUNT(*) FROM dbo.product_barcodes b WHERE b.product_id=p.id AND b.is_primary=1) primaryBarcodes FROM dbo.sales_order_items l JOIN dbo.products p WITH(UPDLOCK,HOLDLOCK) ON p.id=l.product_id JOIN dbo.crm_order_v2_requests r ON r.order_id=l.sales_order_id OUTER APPLY(SELECT TOP(1)j.value FROM OPENJSON(r.body_json,'$.items')j WHERE TRY_CONVERT(bigint,JSON_VALUE(j.value,'$.productId'))=p.id)b LEFT JOIN dbo.product_prices v WITH(HOLDLOCK) ON v.id=TRY_CONVERT(bigint,JSON_VALUE(b.value,'$.priceId')) AND v.product_id=p.id WHERE l.sales_order_id=@orderId ORDER BY l.id;
 SELECT CONVERT(varchar(20),l.invoice_id) id,i.document_no documentNo,i.status,CONVERT(varchar(20),i.customer_id) customerId,i.document_currency currency,CONVERT(varchar(64),i.grand_total) totalExact4,CONVERT(varchar(64),i.row_version,2) invoiceVersion,l.status linkStatus FROM dbo.clean_order_sale_links l JOIN dbo.sales_invoices i WITH(UPDLOCK,HOLDLOCK) ON i.id=l.invoice_id WHERE l.order_id=@orderId;`;
const noDb=async()=>import('../config/database.js');
export function createCleanOrderSaleService({dependencies=noDb,invoices=()=>import('./invoiceDraftService.js')}={}){
 async function runtime(){assertRegisteredCleanContext();const db=await dependencies(),pool=await db.getSqlPool(),driver=db.getSqlDriver();assertCleanIdentity((await pool.request().query(CLEAN_IDENTITY_SQL)).recordset[0]);return {db,pool,driver};}
 const request=(runtime,tx)=>tx?new runtime.driver.Request(tx):runtime.pool.request();
 async function snapshot(runtime,tx,id){
  const sets=(await request(runtime,tx).input('orderId',runtime.driver.BigInt,id).query(statement)).recordsets;
  if(sets?.[0]?.length!==1)saleFail('CLEAN_SALE_ORDER_NOT_FOUND','Sipariş bulunamadı.',404);
  const raw=sets[0][0];if(raw.active!==true||raw.deleted!==false)saleFail('CLEAN_SALE_CUSTOMER_CHANGED','Müşteri kullanıma uygun değil.');
  let body;try{body=JSON.parse(raw.bodyJson);if(crmV2Fingerprint(body,Number(raw.sourceActor),raw.sourceCrmActor)!==raw.receiptHash.toLowerCase())throw Error();}catch{saleFail('CLEAN_SALE_SOURCE','Sipariş kaynağı doğrulanamadı.',503);}
  const lines=sets[1].map(l=>({...l,active:l.active===true&&l.deleted===false,orderPriceExact8:body.items?.find(i=>String(i.productId)===l.productId)?.priceExact8}));
  if(lines.length!==body.items?.length||new Set(lines.map(l=>l.productId)).size!==lines.length)saleFail('CLEAN_SALE_SOURCE','Sipariş satırları uyuşmuyor.',503);
  const order={id:raw.id,documentNo:raw.documentNo,documentDate:raw.documentDate,customerId:raw.customerId,customerName:raw.customerName,currency:raw.currency,totalExact4:raw.totalExact4};
  const linked=sets[2];if(linked.length>1)saleFail('CLEAN_SALE_SOURCE','Satış bağlantısı tekil değil.',503);
  let sale=null,state='NOT_CONVERTED';
  if(linked.length){const l=linked[0];if(l.customerId!==order.customerId||l.currency!==order.currency||l.totalExact4!==order.totalExact4||l.status!==l.linkStatus||!['draft','finalized'].includes(l.status))saleFail('CLEAN_SALE_SOURCE','Bağlı satış doğrulanamadı.',503);state=l.status==='finalized'?'FINALIZED':'DRAFT';sale={id:l.id,documentNo:l.documentNo,status:l.status,customerId:l.customerId,currency:l.currency,totalExact4:l.totalExact4,stockEffect:state==='FINALIZED',ledgerEffect:state==='FINALIZED',collectionEffect:false,reservationEffect:false};}
  return {raw,lines,order,sale,state,revision:saleHash({order:raw,lines,linked})};
 }
 function view(s,actor){const c=assertRegisteredCleanContext();return {schemaVersion:'melisa-order-sale.v1',environment:c.environment,environmentId:c.environmentId,requestId:s.raw.requestId.toLowerCase(),order:s.order,state:s.state,sale:s.sale,revision:s.revision,capabilities:{canConvert:s.state==='NOT_CONVERTED'&&[15,17].includes(Number(actor.id))&&actor.permissions.includes('sales.create'),canFinalize:s.state==='DRAFT'&&Number(actor.id)===17&&actor.permissions.includes('sales.finalize')}};}
 const translate=e=>{if(e.statusCode&&typeof e.code==='string'&&e.code.startsWith('CLEAN_'))throw e;if(e.number>=51951&&e.number<=51954)saleFail(e.number===51951?'CLEAN_SALE_FORBIDDEN':e.number===51953?'CLEAN_SALE_CHANGED':'CLEAN_SALE_CONFLICT','Satış bilgileri veya işlem kapsamı değişti. Güncel kaydı yeniden açın.',e.number===51951?403:409);saleFail('CLEAN_SALE_UNAVAILABLE','Siparişin satış bilgileri şu anda doğrulanamıyor.',503);};
 return {
  async get(orderId,actor){saleActor(actor,'sales.view');const id=saleId(orderId);let tx;try{const r=await runtime();tx=new r.driver.Transaction(r.pool);await tx.begin(r.driver.ISOLATION_LEVEL.SERIALIZABLE);const value=view(await snapshot(r,tx,id),actor);await tx.commit();return value;}catch(e){if(tx)try{await tx.rollback();}catch{}translate(e);}},
  async mutate(orderId,operation,input,actor){
   if(!['convert','finalize'].includes(operation))saleFail('CLEAN_SALE_INPUT','İşlem geçersiz.',400);
   const actorId=saleActor(actor,operation==='convert'?'sales.create':'sales.finalize'),id=saleId(orderId),body=saleAction(input);
   if(process.env.API_PORT!=='4194'||process.env.MELISA_CLEAN_SALES!=='20261022')saleFail('CLEAN_SALE_FORBIDDEN','Bu bağlantıda satış işlemi kapalı.',403);
   const payloadHash=saleHash({actorId,id,operation,...body});let tx;
   try{
    const r=await runtime();tx=new r.driver.Transaction(r.pool);await tx.begin(r.driver.ISOLATION_LEVEL.SERIALIZABLE);
    const lock=await request(r,tx).input('resource',r.driver.NVarChar(255),'CLEAN_ORDER_SALE/'+id).query("DECLARE @n int;EXEC @n=sys.sp_getapplock @Resource=@resource,@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=5000;IF @n<0 THROW 51952,'CLEAN_SALE_BUSY',1;");
    const existing=(await request(r,tx).input('uuid',r.driver.UniqueIdentifier,body.requestId).query('SELECT payload_hash payloadHash,order_id orderId FROM dbo.clean_order_sale_requests WITH(UPDLOCK,HOLDLOCK) WHERE request_id=@uuid;')).recordset;
    if(existing.length&&(existing[0].payloadHash!==payloadHash||Number(existing[0].orderId)!==id))saleFail('CLEAN_SALE_REQUEST_CONFLICT','Aynı işlem kimliği farklı içerikle kullanılamaz.');
    let s=await snapshot(r,tx,id);
    if(existing.length||operation==='convert'&&s.sale||operation==='finalize'&&s.state==='FINALIZED'){await tx.commit();return {...view(s,actor),replayed:true,actionRequestId:body.requestId};}
    if(operation==='finalize'&&s.state!=='DRAFT')saleFail('CLEAN_SALE_STATE','Önce siparişi satış taslağına aktarın.');
    if(s.revision!==body.expectedRevision)saleFail('CLEAN_SALE_CHANGED','Kayıt değişti. Güncel kaydı yeniden açın.');
    assertSaleLines({...s.order,customerCurrency:s.raw.customerCurrency,rateExact8:s.raw.rateExact8},s.lines);
    if(s.lines.some(l=>l.primaryBarcodes>1||l.barcode!==null&&l.primaryBarcodes!==1))saleFail('CLEAN_SALE_CHANGED','Ürünün ana barkodu doğrulanamadı.');
    await request(r,tx).input('order_id',r.driver.BigInt,id).input('actor_id',r.driver.BigInt,actorId).input('operation',r.driver.NVarChar(10),operation).input('request_id',r.driver.UniqueIdentifier,body.requestId).input('payload_hash',r.driver.Char(64),payloadHash).execute('dbo.usp_clean_order_sale_begin_v2');
    await withCleanOrderSaleMutation({transaction:tx,actorId,orderId:id,operation},async()=>{
     const api=await invoices(),context={transaction:tx,pool:r.pool,sqlDriver:r.driver};
     if(operation==='convert')await api.createSalesDraft({documentNo:'CRS-20261022-'+id,documentDate:s.order.documentDate,customerId:Number(s.order.customerId),customerCurrency:s.order.currency,documentCurrency:s.order.currency,exchangeRate:1,accountExchangeRate:1,discountRate:0,description:'CRM siparişi '+s.order.documentNo,items:s.lines.map(l=>({productId:Number(l.productId),stockCode:l.stockCode,barcode:l.barcode,productName:l.name,quantity:Number(l.quantityExact3),currency:l.currency,unitPrice:Number(l.unitPriceExact4)}))},actor,context);
     else await api.finalizeSalesInvoice(Number(s.sale.id),actor,context);
     await request(r,tx).execute('dbo.usp_clean_order_sale_finish');
    });
    s=await snapshot(r,tx,id);await tx.commit();return {...view(s,actor),replayed:false,actionRequestId:body.requestId};
   }catch(e){if(tx)try{await tx.rollback();}catch{}translate(e);}
  },
 };
}
let instance;export const cleanOrderSaleService=()=>instance??=createCleanOrderSaleService();
