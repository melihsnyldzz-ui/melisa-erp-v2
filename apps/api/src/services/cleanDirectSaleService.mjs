// Persist the existing B6 basket through the existing native invoice motor.
import {createHash} from 'node:crypto';
import {assertRegisteredCleanContext,assertCleanIdentity,CLEAN_IDENTITY_SQL,isCleanAdministrator} from './cleanSyntheticContext.mjs';
import {workActor,workFail,workHash,workDraftInput,workActionInput,workSelection,workSalePreview} from './workSalesModel.mjs';
import {canonical} from './workInboundModel.mjs';
import {withCleanDirectSaleMutation} from './cleanOrderSaleScope.mjs';
import {cleanStoreDayStore,cleanSalesReadContext,cleanSalesInvoiceList} from './cleanStoreDayStore.mjs';
import {isCleanPersonalWorkCandidate,proveCleanPersonalWorkActor} from './cleanPersonnelManagement.mjs';
const defaults=async()=>import('../config/database.js');
const directActor=actor=>isCleanAdministrator(actor)||isCleanPersonalWorkCandidate(actor,'sale');
export function cleanDirectSaleActor(actor,permission){actor=workActor(actor,permission);if(!directActor(actor))workFail('WORK_FORBIDDEN','Bu işlem için yetkiniz bulunmuyor.',403);return actor;}
export function directSaleContext(rows,actor,personal=null){
 const [users,permissions,customers,products,quotes,barcodes,holds]=rows;
 const u=users?.[0];if(users?.length!==1||!(isCleanAdministrator({...u,id:Number(u.id),role:{id:u.roleId,code:u.roleCode},permissions:permissions.map(r=>r.permission_key)})||personal&&personal.actorId===String(u.id)&&String(u.id)===String(actor.id)&&u.username===actor.username&&String(u.roleId)===String(actor.role.id)&&u.roleCode===actor.role.code)||customers?.length!==1||customers[0].id!=='1'||customers[0].code!=='ORNEK-M01'||customers[0].currency!=='TRY'||products?.length!==2||holds.length)workFail('WORK_UNAVAILABLE','Satış kaynağı doğrulanamadı.',503);
 const has=k=>actor.permissions.includes(k)&&permissions.some(p=>p.permission_key===k),customer={...customers[0],synthetic:true,writeEligible:true};customer.revision=workHash(customer);
 const scope={synthetic:true,customer,accounts:[],products:products.map(p=>{
  const bs=barcodes.filter(b=>b.productId===p.id),qs=quotes.filter(q=>q.productId===p.id);
  if(!['1','2'].includes(p.id)||p.unit!=='ADET'||p.active!==true||p.deleted!==false||bs.length!==1||qs.length!==1||!['TRY','USD','EUR'].includes(qs[0].currency)||qs[0].sourceKey!==`SYNTHETIC/20261022/products/${p.id}/PRICE/sale/1/1/${qs[0].currency}`)workFail('WORK_UNAVAILABLE','Ürün bilgileri doğrulanamadı.',503);
  const value={id:p.id,stockCode:p.stockCode,name:p.name,barcode:bs[0].barcode,stockQuantityExact3:p.stockQuantityExact3,synthetic:true,writeEligible:true,unit:{label:'ADET',factorExact8:'1.00000000'},prices:[{quoteId:qs[0].quoteId,currency:qs[0].currency,unitPriceExact8:qs[0].unitPriceExact8,source:{kind:'synthetic-test'},revision:workHash(qs[0])}]};return {...value,revision:workHash(value)};
 })};
 const value={meta:{...assertRegisteredCleanContext(),schemaVersion:'melisa-work-trade.v1',date:'2026-10-22',timeZone:'Europe/Istanbul',source:'native-test',directSaleProfile:'B6-20261024'},scope,capabilities:{canCreate:has('sales.create'),canFinalize:has('sales.finalize'),canCancel:false,canCollect:false,canCancelCollection:false},supportedCurrencies:['TRY'],limits:{maxItems:2,maxQuantityPerLine:5,maxInvoiceAmountExact4:'500.0000',maxOperations:30}};
 return {...value,revision:workHash(value)};
}
export function createCleanDirectSaleService({dependencies=defaults,invoices=()=>import('./invoiceDraftService.js'),legacy=cleanStoreDayStore}={}){
 async function run(actor,write,fn){
  assertRegisteredCleanContext();if(process.env.API_PORT!=='4194'||process.env.MELISA_CLEAN_SALES!=='20261022')workFail('WORK_UNAVAILABLE','Satış bağlantısı kullanılamıyor.',503);
  let tx;try{const db=await dependencies(),pool=await db.getSqlPool(),q=db.getSqlDriver();assertCleanIdentity((await pool.request().query(CLEAN_IDENTITY_SQL)).recordset[0]);tx=new q.Transaction(pool);await tx.begin(q.ISOLATION_LEVEL.SERIALIZABLE);const req=()=>new q.Request(tx);
   await req().input('mode',q.NVarChar(16),write?'Exclusive':'Shared').query("DECLARE @n int;EXEC @n=sys.sp_getapplock @Resource=N'CLEAN_STORE_DAY_20261022',@LockMode=@mode,@LockOwner=N'Transaction',@LockTimeout=5000;IF @n<0 THROW 51966,'CLEAN_DIRECT_SALE_BUSY',1;");
   // A cold SQL compile can exceed the ordinary 10s query budget. Only this
   // sealed checkpoint has a bounded 30s budget; no retry or guard is removed.
   await new q.Request(tx,{requestTimeout:30000}).execute('dbo.usp_clean_store_day_ready');await req().execute('dbo.usp_clean_direct_sale_ready');
   const personal=await proveCleanPersonalWorkActor(tx,q,actor,'sale');
   const context=async()=>directSaleContext((await req().input('actor',q.BigInt,Number(actor.id)).query("SELECT id,username,role_id roleId,(SELECT code FROM dbo.roles WHERE id=role_id) roleCode FROM dbo.users WHERE id=@actor AND is_active=1;SELECT permission_key FROM dbo.permissions WHERE role_id=(SELECT role_id FROM dbo.users WHERE id=@actor) AND(can_view=1 OR can_create=1 OR can_approve=1);SELECT CONVERT(varchar(20),id) id,customer_code code,name,currency_code currency,CONVERT(varchar(40),balance) balanceExact4 FROM dbo.customers WHERE id=1 AND is_active=1 AND is_deleted=0;SELECT CONVERT(varchar(20),id) id,stock_code stockCode,name,unit,is_active active,is_deleted deleted,CONVERT(varchar(40),current_stock_qty) stockQuantityExact3 FROM dbo.products WHERE id IN(1,2) ORDER BY id;SELECT CONVERT(varchar(20),product_id) productId,CONVERT(varchar(20),id) quoteId,currency_code currency,CONVERT(varchar(40),price) unitPriceExact8,source_record_key sourceKey FROM dbo.product_prices WHERE product_id IN(1,2) AND price_type=N'sale' AND price_tier=1 AND currency_code IN(N'TRY',N'USD',N'EUR') AND source_unit_id=1 AND is_main_unit=1 ORDER BY product_id;SELECT CONVERT(varchar(20),product_id) productId,barcode FROM dbo.product_barcodes WHERE product_id IN(1,2) AND is_primary=1 AND is_active=1;SELECT entity,native_id FROM erp_migration.operation_quarantine_holds WHERE(entity=N'product' AND native_id IN(1,2))OR(entity=N'customer' AND native_id=1);")).recordsets,actor,personal);
   async function invoice(id){
    const sets=(await req().input('id',q.BigInt,id).query("SELECT CONVERT(varchar(20),i.id) id,i.document_no documentNo,CONVERT(char(10),i.document_date,23) documentDate,i.status,CONVERT(varchar(20),i.customer_id) customerId,i.document_currency currency,CONVERT(varchar(40),i.subtotal) subtotalExact4,CONVERT(varchar(40),i.grand_total) grandTotalExact4,CONVERT(varchar(40),i.amount_try) amountTryExact4,CONVERT(varchar(40),c.balance) customerBalanceExact4,l.preview_json previewJson,l.actor_id actorId FROM dbo.clean_direct_sale_links l JOIN dbo.sales_invoices i ON i.id=l.invoice_id JOIN dbo.customers c ON c.id=i.customer_id WHERE l.invoice_id=@id;SELECT CONVERT(varchar(20),product_id) productId,stock_code_snapshot stockCode,product_name_snapshot name,barcode_snapshot barcode,CONVERT(varchar(40),quantity) quantityExact3,CONVERT(varchar(40),unit_price) unitPriceExact4,CONVERT(varchar(40),CONVERT(decimal(28,8),unit_price)) unitPriceExact8,CONVERT(varchar(40),line_total) lineTotalExact4,currency_code currency FROM dbo.sales_invoice_items WHERE sales_invoice_id=@id ORDER BY id;")).recordsets;
    if(sets[0].length!==1)return null;const {previewJson,actorId,...header}=sets[0][0];if(String(actorId)!==String(actor.id))workFail('WORK_FORBIDDEN','Bu kayıt başka kullanıcıya ait.',403);const collections={receivedExact4:'0.0000',outstandingExact4:header.grandTotalExact4,items:[]};collections.revision=workHash({id,collections});const value={...header,createdBy:String(actorId),items:sets[1].map(r=>({...r,unit:{label:'ADET',factorExact8:'1.00000000'}})),collections};return {...value,revision:workHash(value),previewJson};
   }
   const value=await fn({q,tx,pool,req,context,invoice});await tx.commit();return value;
  }catch(e){if(tx)try{await tx.rollback();}catch{}if(e.statusCode)throw e;throw Object.assign(new Error('Satış bilgileri şu anda doğrulanamıyor.'),{code:'WORK_UNAVAILABLE',statusCode:503,cause:e});}
 }
 const publicInvoice=({previewJson,...row})=>row;
 async function mutate(operation,input,id,actor){
  actor=cleanDirectSaleActor(actor,operation==='sale_draft'?'sales.create':'sales.finalize');const payload=operation==='sale_draft'?workDraftInput(input):{...workActionInput(input),id};
  return run(actor,true,async c=>{
   const payloadJson=JSON.stringify(canonical({...payload,actorId:actor.id,operation})),payloadHash=createHash('sha256').update(payloadJson,'utf16le').digest('hex').toUpperCase();
   const previous=(await c.req().input('id',c.q.UniqueIdentifier,payload.requestId).query('SELECT actor_id,operation,payload_json,payload_hash,response_json FROM dbo.clean_direct_sale_requests WITH(UPDLOCK,HOLDLOCK) WHERE request_id=@id')).recordset[0];
   if(previous){if(String(previous.actor_id)!==actor.id||previous.operation!==operation||previous.payload_json!==payloadJson||previous.payload_hash!==payloadHash)workFail('WORK_REQUEST_CONFLICT','İşlem kimliği farklı içerikle kullanılamaz.',409);return {...JSON.parse(previous.response_json),replayed:true};}
   const context=await c.context();let preview,current=null;
   if(operation==='sale_draft'){if(!context.capabilities.canCreate)workFail('WORK_FORBIDDEN','Yetkiniz yok.',403);if(payload.expectedRevision!==context.revision)workFail('WORK_STALE','Bilgiler değişti.',409);const {requestId,previewHash,expectedRevision,...selection}=payload;preview=workSalePreview(selection,context);if(preview.previewHash!==previewHash)workFail('WORK_PREVIEW_CHANGED','Fiyatı yeniden kontrol edin.',409);}
   else{current=await c.invoice(id);if(!current)workFail('WORK_INVOICE_NOT_FOUND','Satış bulunamadı.',404);if(current.revision!==payload.expectedRevision||current.status!=='draft')workFail('WORK_STALE','Fiş değişti.',409);preview=JSON.parse(current.previewJson);}
   const previewJson=JSON.stringify(canonical(preview));
   return withCleanDirectSaleMutation({transaction:c.tx,driver:c.q,actorId:Number(actor.id),operation,requestId:payload.requestId,payloadHash,payloadJson,previewJson,invoiceId:current?Number(id):null},async()=>{
    const api=await invoices(),native={pool:c.pool,transaction:c.tx,sqlDriver:c.q};let invoiceId=id;
    if(operation==='sale_draft'){
     const documentNo='DS-'+payload.requestId.slice(0,25),result=await api.createSalesDraft({documentNo,documentDate:preview.selection.documentDate,customerId:1,customerCurrency:'TRY',documentCurrency:'TRY',exchangeRate:1,accountExchangeRate:1,discountRate:0,description:'Örnek doğrudan satış',items:preview.items.map(p=>({productId:Number(p.productId),stockCode:p.stockCode,productName:p.name,barcode:context.scope.products.find(v=>v.id===p.productId).barcode,quantity:Number(p.quantityExact3),currency:'TRY',unitPrice:Number(p.unitPriceExact4)}))},actor,native);invoiceId=String(result.id);
     await c.req().input('id',c.q.BigInt,invoiceId).input('uuid',c.q.UniqueIdentifier,payload.requestId).input('actor',c.q.BigInt,Number(actor.id)).input('number',c.q.NVarChar(30),documentNo).input('preview',c.q.NVarChar(c.q.MAX),previewJson).query('INSERT dbo.clean_direct_sale_links(invoice_id,request_id,actor_id,document_no,preview_json)VALUES(@id,@uuid,@actor,@number,@preview)');
    }else await api.finalizeSalesInvoice(Number(id),actor,native);
    const result={invoice:publicInvoice(await c.invoice(invoiceId)),requestId:payload.requestId,replayed:false};
    await c.req().input('uuid',c.q.UniqueIdentifier,payload.requestId).input('actor',c.q.BigInt,Number(actor.id)).input('operation',c.q.NVarChar(20),operation).input('hash',c.q.Char(64),payloadHash).input('payload',c.q.NVarChar(c.q.MAX),payloadJson).input('response',c.q.NVarChar(c.q.MAX),JSON.stringify(result)).query('INSERT dbo.clean_direct_sale_requests(request_id,actor_id,operation,payload_hash,payload_json,response_json)VALUES(@uuid,@actor,@operation,@hash,@payload,@response)');return result;
   });
  });
 }
 return {
  context:actor=>directActor(actor)?run(cleanDirectSaleActor(actor,'sales.view'),false,c=>c.context()):legacy.readFinance(actor,c=>cleanSalesReadContext(c.context)),
  selectionOptions:async()=>({enabled:false}),
  preview:(input,actor)=>run(cleanDirectSaleActor(actor,'sales.create'),false,async c=>workSalePreview(workSelection(input),await c.context())),
  createDraft:(input,actor)=>mutate('sale_draft',input,null,actor),
  finalize:(id,input,actor)=>mutate('sale_finalize',input,id,actor),
  invoice:async(id,actor)=>directActor(actor)?run(cleanDirectSaleActor(actor,'sales.view'),false,async c=>{const own=await c.invoice(id);if(own)return publicInvoice(own);if(isCleanPersonalWorkCandidate(actor,'sale'))workFail('WORK_NOT_FOUND','Satış kaydı bulunamadı.',404);return legacy.readFinance(actor,x=>x.invoice(id));}):legacy.readFinance(actor,c=>c.invoice(id)),
  list:async(query,actor)=>{const old=isCleanPersonalWorkCandidate(actor,'sale')?[]:await legacy.readFinance(actor,async c=>c.invoices?c.invoices():[await c.invoice('1')]);if(!directActor(actor))return cleanSalesInvoiceList(old,query);return run(cleanDirectSaleActor(actor,'sales.view'),false,async c=>{const rows=(await c.req().input('actor',c.q.BigInt,Number(actor.id)).query('SELECT CONVERT(varchar(20),invoice_id) id FROM dbo.clean_direct_sale_links WHERE actor_id=@actor ORDER BY invoice_id DESC')).recordset;const direct=[];for(const r of rows)direct.push(publicInvoice(await c.invoice(r.id)));return cleanSalesInvoiceList([...direct,...old],query);});},
  request:(id,actor)=>run(cleanDirectSaleActor(actor,'sales.view'),false,async c=>{const row=(await c.req().input('id',c.q.UniqueIdentifier,id).input('actor',c.q.BigInt,Number(actor.id)).query('SELECT operation,response_json FROM dbo.clean_direct_sale_requests WHERE request_id=@id AND actor_id=@actor')).recordset[0];if(!row)workFail('WORK_REQUEST_NOT_FOUND','İşlem bulunamadı.',404);return {requestId:id,operation:row.operation,response:JSON.parse(row.response_json)};})
 };
}
