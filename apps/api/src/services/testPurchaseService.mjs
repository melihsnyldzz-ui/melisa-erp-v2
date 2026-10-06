import {assertOperationQuarantineAllowed,quarantineTransactionContext} from './operationQuarantineService.js';
import {createHash} from 'node:crypto';
import {getSqlPool,getSqlDriver} from '../config/database.js';
import {withTestSalesMutation} from './testSalesScope.mjs';
import {addGoodsBatch,acceptGoods,rejectGoods,addPurchase,invoiceableQuantity} from './sitesGoodsRules.mjs';
import {createPurchaseDraft,finalizePurchaseInvoice,cancelPurchaseInvoice,getPurchaseDraft,normalizePurchasePayload} from './invoiceDraftService.js';
import {writeAuditLog} from './auditService.js';
import {assertPurchaseReturnClear} from './testPurchaseReturnGuard.mjs';
import {AsyncLocalStorage} from 'node:async_hooks';
const adapterContext=new AsyncLocalStorage();
import {normalizeTestBatch,normalizeTestInvoiceDraft,validateTestBatchDecision,strictFields,positiveId,validateRequestId,testPurchaseRequestHash,testPurchaseReplay,publicBatchContext,publicTestBatch,requiredTestBatch,testBatchPurchasePayload} from './testPurchaseBatchModel.mjs';
const fail=(code,message,statusCode=400)=>{throw Object.assign(new Error(message),{code,statusCode})};
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const checkKeys=(v,keys)=>{if(Object.keys(v).some(k=>!keys.includes(k)))fail('TEST_PAYLOAD','Kapsam dışı alan gönderildi.')};
async function load(ctx){
 const req=()=>new ctx.sql.Request(ctx.tx);
 const s=(await req().query("SELECT t.*,DB_NAME() db,p.stock_code,p.name product_name,p.current_stock_qty,p.average_cost_try,p.unit,p.supplier_id product_supplier,s.name supplier_name,s.supplier_code,s.currency_code,s.balance,w.code warehouse_code,w.name warehouse_name FROM dbo.test_purchase_scope t JOIN dbo.products p ON p.id=t.product_id JOIN dbo.suppliers s ON s.id=t.supplier_id JOIN dbo.test_purchase_warehouses w ON w.id=t.warehouse_id WHERE t.id=1")).recordset[0];
 if(s?.db!=='MELISA_ERP_SIRKET_TEST_20260929_01'||s.stock_code!=='TEST-V70-GOODS-P'||s.supplier_code!=='TEST-V70-GOODS-S'||s.unit!=='ADET'||s.currency_code!=='TRY'||Number(s.average_cost_try)!==60||Number(s.product_supplier)!==Number(s.supplier_id))fail('TEST_IDENTITY','TEST mal kabul kapsamı değişti.',503);
 const goods=(await req().query('SELECT * FROM dbo.test_goods_receipts ORDER BY id')).recordset;
 const invoices=(await req().query('SELECT p.id,p.document_no,p.status,p.document_date,p.grand_total,p.document_currency,p.exchange_rate_snapshot,p.account_amount,p.account_currency,p.account_exchange_rate_snapshot,l.goods_id,l.quantity FROM dbo.test_purchase_links l JOIN dbo.purchase_invoices p ON p.id=l.invoice_id ORDER BY p.id')).recordset;
 const state={products:[[s.stock_code,s.product_name,'ADET',20,60]],goods:goods.map(g=>({...g,id:String(g.id),code:s.stock_code,supplier:s.supplier_name,qty:Number(g.quantity)})),purchases:invoices.filter(p=>p.status==='finalized').map(p=>({id:String(p.id),goodsId:String(p.goods_id),supplier:s.supplier_name,number:p.document_no,code:s.stock_code,qty:Number(p.quantity),currency:p.document_currency,total:Number(p.grand_total)*100,priceCents:6000,vatCents:0})),sequence:goods.length,audit:[]};
 return {s,goods,invoices,state};
}
async function atomic(actor,fn,write=true,isBatch=false){return withTestSalesMutation(async()=>{
 const inherited=adapterContext.getStore();
 if(inherited){if(!inherited.active||String(actor.id)!==inherited.actorId||(write&&!inherited.write))fail('TEST_ADAPTER_CONTEXT','Aynı doğrulanmış işlem kapsamı gerekli.',403);return fn(inherited.ctx,inherited.loaded);}
 const pool=await getSqlPool(),sql=getSqlDriver(),tx=new sql.Transaction(pool);await tx.begin(isBatch?sql.ISOLATION_LEVEL.SERIALIZABLE:undefined);const ctx={pool,sql,tx};
 try{await new sql.Request(tx).query("DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000; IF @r<0 THROW 51071,'TEST_LOCK_TIMEOUT',1;");
  const loaded=await load(ctx);if(write&&![15,16].includes(Number(actor.id)))fail('TEST_ACTOR','TEST oturumu gerekli.',403);
  if(write)await assertOperationQuarantineAllowed([{entity:'product',nativeId:loaded.s.product_id},{entity:'supplier',nativeId:loaded.s.supplier_id}],quarantineTransactionContext(sql,tx));
  const result=await fn(ctx,loaded);await tx.commit();return result;
 }catch(e){try{await tx.rollback()}catch{}if(e.number===51070)fail('TEST_DATABASE_BOUNDARY','TEST sınırı aşıldı; işlem geri alındı.',409);if(!e.statusCode&&!e.code){e.statusCode=409;e.code='SITES_WORKFLOW_RULE'}throw e}
});}
const batchAtomic=(actor,fn,write=true)=>atomic(actor,fn,write,true);
async function journal(ctx,actor,input,operation,fn){
 const {sql,tx}=ctx,hash=testPurchaseRequestHash(input,operation);
 const old=(await new sql.Request(tx).input('id',sql.NVarChar(64),input.requestId).query('SELECT * FROM dbo.test_purchase_requests WHERE request_id=@id')).recordset[0];
 if(old)return testPurchaseReplay(old,hash,actor.id);
 // Request history is the idempotency journal. Its lifetime size must not
 // prevent reversing an accepted invoice; named-fixture SQL guards bound writes.
 const value=await fn();await new sql.Request(tx).input('id',sql.NVarChar(64),input.requestId).input('hash',sql.Char(64),hash).input('actor',sql.BigInt,actor.id).input('op',sql.NVarChar(30),operation).input('entity',sql.BigInt,value.id).input('json',sql.NVarChar(sql.MAX),JSON.stringify(value)).query('INSERT dbo.test_purchase_requests(request_id,payload_hash,actor_id,operation,entity_id,response_json) VALUES(@id,@hash,@actor,@op,@entity,@json)');return {...value,replayed:false};
}
function office(actor){if(Number(actor.id)!==16)fail('TEST_APPROVER','İlker TEST onayı gerekli.',403)}
export async function createTestGoods(input,actor){return atomic(actor,async(ctx,d)=>journal(ctx,actor,input,'goods_create',async()=>{
 checkKeys(input,['requestId','productId','supplierId','warehouseId','quantity','unit','note']);
 if(Number(input.productId)!==Number(d.s.product_id)||Number(input.supplierId)!==Number(d.s.supplier_id)||Number(input.warehouseId)!==Number(d.s.warehouse_id)||input.unit!=='ADET')fail('TEST_SCOPE','Yalnız izinli TEST ürün, tedarikçi ve depo.',403);
 if(!Number.isInteger(input.quantity)||input.quantity<1||input.quantity>5)fail('TEST_QUANTITY','Bu kabulde 1–5 fiziksel ADET gerekli.');
 if(d.goods.length>=d.s.max_receipts)fail('TEST_LIMIT','En fazla 5 mal kabul kaydı.',409);
 addGoodsBatch(d.state,{supplier:d.s.supplier_name,lines:[{code:d.s.stock_code,quantity:input.quantity}],note:input.note},Number(actor.id)===16?'İlker':'Satış ekibi');
 const {sql,tx}=ctx;const r=await new sql.Request(tx).input('product',sql.BigInt,d.s.product_id).input('supplier',sql.BigInt,d.s.supplier_id).input('qty',sql.Decimal(18,3),input.quantity).input('note',sql.NVarChar(500),String(input.note||'').slice(0,500)).input('actor',sql.BigInt,actor.id).query("INSERT dbo.test_goods_receipts(product_id,supplier_id,warehouse_id,quantity,unit,unit_factor,state,note,created_by) VALUES(@product,@supplier,1,@qty,N'ADET',1,N'pending',@note,@actor); SELECT CAST(SCOPE_IDENTITY() AS bigint) id;");
 const id=Number(r.recordset[0].id);await writeAuditLog(new sql.Request(tx),{actor,action:'test_goods_counted',entityType:'test_goods_receipt',entityId:id,afterSnapshot:{quantity:input.quantity,state:'pending',warehouseId:1}});return {id,state:'pending',stock:Number(d.s.current_stock_qty)};
}));}
export async function decideTestGoods(id,input,actor,approve){return atomic(actor,async(ctx,d)=>journal(ctx,actor,{...input,id:Number(id)},approve?'goods_approve':'goods_reject',async()=>{
 office(actor);checkKeys(input,['requestId','reason']);const g=d.state.goods.find(g=>g.id===String(id));if(!g)fail('GOODS_NOT_FOUND','TEST kabulü bulunamadı.',404);
 if(approve&&g.state==='accepted')return {id:Number(id),state:'accepted',alreadyApplied:true,stock:Number(d.s.current_stock_qty)};
 if(approve)acceptGoods(d.state,String(id),'İlker');else rejectGoods(d.state,String(id),input.reason,'İlker');
 const {sql,tx}=ctx;await new sql.Request(tx).input('id',sql.BigInt,id).input('state',sql.NVarChar(20),approve?'accepted':'rejected').input('reason',sql.NVarChar(500),input.reason||null).input('actor',sql.BigInt,actor.id).query('UPDATE dbo.test_goods_receipts SET state=@state,reason=@reason,decided_by=@actor,decided_at=SYSUTCDATETIME() WHERE id=@id');
 if(approve)await new sql.Request(tx).input('id',sql.BigInt,id).input('actor',sql.BigInt,actor.id).query(`UPDATE p SET current_stock_qty=current_stock_qty+g.quantity,updated_at=SYSUTCDATETIME() FROM dbo.products p JOIN dbo.test_goods_receipts g ON g.product_id=p.id WHERE g.id=@id;
 INSERT dbo.stock_movements(product_id,movement_type,source_type,source_id,quantity_in,quantity_out,quantity_net,unit_cost_try,average_cost_try_after,document_date,supplier_id,created_by,unit_price,currency_code,amount_try,warehouse_name,source_warehouse)
 SELECT product_id,N'in',N'goods_receipt',id,quantity,0,quantity,60,60,CONVERT(date,GETDATE()),supplier_id,@actor,60,N'TRY',quantity*60,N'TEST V70 MAL KABUL DEPOSU',N'TEST-V70-GOODS-WH' FROM dbo.test_goods_receipts WHERE id=@id;`);
 await writeAuditLog(new sql.Request(tx),{actor,action:approve?'test_goods_approved':'test_goods_rejected',entityType:'test_goods_receipt',entityId:Number(id),afterSnapshot:{state:g.state,quantity:g.qty,reason:input.reason||null}});
 return {id:Number(id),state:g.state,stock:Number(d.s.current_stock_qty)+(approve?g.qty:0)};
}));}
export async function createTestPurchase(input,actor){return atomic(actor,async(ctx,d)=>journal(ctx,actor,input,'purchase_create',async()=>{
 office(actor);checkKeys(input,['requestId','goodsId','number','date','currency','quantity','price','vat']);
 if(input.currency!=='TRY'||Number(input.price)!==60||Number(input.vat)!==0)fail('TEST_COST_SCOPE','Bu kabulde TRY, 60 TRY birim maliyet, açık KDV 0 kapsamı geçerlidir.');
 if(!/^TSTG-[A-Za-z0-9-]{1,24}$/.test(input.number||''))fail('DOCUMENT_NUMBER','TEST fatura numarası TSTG- ile başlamalıdır.');
 if(d.invoices.some(p=>p.document_no===input.number))fail('DUPLICATE_DOCUMENT','Bu tedarikçi faturası zaten kayıtlı.',409);
 const p=addPurchase(d.state,{goodsId:String(input.goodsId),number:input.number,date:input.date,currency:input.currency,quantity:input.quantity,priceCents:6000,vatCents:0},'İlker');
 const context={pool:ctx.pool,sqlDriver:ctx.sql,transaction:ctx.tx,stockAlreadyReceived:true};
 const invoice=await createPurchaseDraft({documentNo:p.number,documentDate:p.date,supplierId:Number(d.s.supplier_id),supplierName:d.s.supplier_name,supplierCurrency:'TRY',documentCurrency:'TRY',exchangeRate:1,accountExchangeRate:1,description:`TEST mal kabul #${input.goodsId}; stok daha önce onaylandı`,items:[{productId:Number(d.s.product_id),stockCode:d.s.stock_code,productName:d.s.product_name,quantity:p.qty,currency:'TRY',purchasePrice:60,stockEffect:'goods_receipt_already_posted'}]},actor,context);
 await new ctx.sql.Request(ctx.tx).input('invoice',ctx.sql.BigInt,invoice.id).input('goods',ctx.sql.BigInt,Number(input.goodsId)).input('qty',ctx.sql.Decimal(18,3),p.qty).query('INSERT dbo.test_purchase_links(invoice_id,goods_id,quantity) VALUES(@invoice,@goods,@qty)');
 await finalizePurchaseInvoice(invoice.id,actor,context);
 await new ctx.sql.Request(ctx.tx).input('invoice',ctx.sql.BigInt,invoice.id).input('actor',ctx.sql.BigInt,actor.id).query("UPDATE dbo.purchase_invoices SET created_by=@actor,updated_by=@actor WHERE id=@invoice; UPDATE dbo.supplier_movements SET created_by=@actor WHERE purchase_invoice_id=@invoice AND movement_type=N'purchase_invoice'");
 return {id:Number(invoice.id),goodsId:Number(input.goodsId),invoice:await getPurchaseDraft(invoice.id,context)};
}));}
export async function cancelTestPurchase(id,input,actor){return atomic(actor,async(ctx,d)=>journal(ctx,actor,{...input,id:Number(id)},'purchase_cancel',async()=>{
 office(actor);checkKeys(input,['requestId','reason']);const p=d.invoices.find(p=>Number(p.id)===Number(id));if(!p)fail('TEST_INVOICE','TEST bağlantılı alış bulunamadı.',404);
 if(p.status==='cancelled')return {id:Number(id),alreadyApplied:true};
 await assertPurchaseReturnClear(new ctx.sql.Request(ctx.tx),ctx.sql,Number(id));
 const context={pool:ctx.pool,sqlDriver:ctx.sql,transaction:ctx.tx,stockAlreadyReceived:true};await cancelPurchaseInvoice(id,input,actor,context);return {id:Number(id),goodsId:Number(p.goods_id),invoice:await getPurchaseDraft(id,context)};
}));}
export async function testPurchaseContext(actor){return atomic(actor,async(ctx,d)=>{
 const movements=(await new ctx.sql.Request(ctx.tx).query('SELECT id,source_type,source_id,quantity_in,quantity_out,quantity_net,unit_cost_try,amount_try,warehouse_name,created_by FROM dbo.stock_movements WHERE product_id=(SELECT product_id FROM dbo.test_purchase_scope) ORDER BY id')).recordset;
 const supplierMovements=(await new ctx.sql.Request(ctx.tx).query('SELECT id,purchase_invoice_id,movement_type,amount,currency_code,balance_effect,account_amount,amount_try,document_exchange_rate_snapshot,account_exchange_rate_snapshot,created_by FROM dbo.supplier_movements WHERE supplier_id=(SELECT supplier_id FROM dbo.test_purchase_scope) ORDER BY id')).recordset;
 const batchContext=publicBatchContext(await loadBatchContext(ctx,d,false),actor.permissions?.includes('purchase.view')===true);
 return {environment:'ISOLATED_TEST',scope:d.s,goods:d.state.goods.map(g=>({...g,invoiceableQuantity:invoiceableQuantity(d.state,g.id)})),invoices:d.invoices,stockMovements:movements,supplierMovements,...batchContext,partialDeliverySupported:true,unitFactor:1,remainingMeaning:'received but not yet invoiced; active drafts reserve their receipt quantities'};
},false);}

async function loadBatchContext(ctx,d,required=true,sourceBatchId=null){
 const req=()=>new ctx.sql.Request(ctx.tx);
 const identity=(await req().query("SELECT CASE WHEN DB_NAME() COLLATE Latin1_General_100_BIN2=N'MELISA_ERP_SIRKET_TEST_20260929_01' COLLATE Latin1_General_100_BIN2 AND CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) COLLATE Latin1_General_100_BIN2=N'Semih\\MELISADEV' COLLATE Latin1_General_100_BIN2 THEN 1 ELSE 0 END valid")).recordset[0]?.valid;
 if(Number(identity)!==1)fail('TEST_BATCH_IDENTITY','Exact sentetik TEST server/database kimliği gerekli.',503);
 const ready=(await req().query("SELECT CASE WHEN OBJECT_ID(N'dbo.test_purchase_batch_scope',N'U') IS NOT NULL AND OBJECT_ID(N'dbo.test_goods_batches',N'U') IS NOT NULL AND OBJECT_ID(N'dbo.test_goods_batch_lines',N'U') IS NOT NULL AND OBJECT_ID(N'dbo.test_purchase_batch_links',N'U') IS NOT NULL AND OBJECT_ID(N'dbo.test_purchase_batch_drafts',N'U') IS NOT NULL AND OBJECT_ID(N'dbo.test_purchase_batch_intent_lines',N'U') IS NOT NULL THEN 1 ELSE 0 END ready")).recordset[0]?.ready;
 if(!ready){if(required)fail('TEST_BATCH_NOT_READY','Çok satırlı sentetik TEST kurulumu hazır değil.',503);return {products:[],batches:[],invoiceDrafts:[]};}
 const rows=(await req().query(`SELECT s.*,p.name product_name,p.current_stock_qty,p.average_cost_try actual_cost,p.stock_code actual_code,p.unit actual_unit,p.supplier_id actual_supplier FROM dbo.test_purchase_batch_scope s JOIN dbo.products p ON p.id=s.product_id ORDER BY s.product_id`)).recordset;
 if(rows.length!==2||!rows.every(r=>Number(r.supplier_id)===Number(d.s.supplier_id)&&Number(r.warehouse_id)===Number(d.s.warehouse_id)&&r.unit==='ADET'&&r.actual_unit==='ADET'&&Number(r.unit_factor)===1&&Number(r.actual_supplier)===Number(d.s.supplier_id)&&Number(r.actual_cost)===Number(r.unit_cost)&&r.stock_code===r.actual_code&&((r.stock_code==='TEST-V70-GOODS-P'&&Number(r.product_id)===Number(d.s.product_id)&&Number(r.unit_cost)===60)||(r.stock_code==='TEST-FINISH-GOODS-P2'&&Number(r.unit_cost)===80))))fail('TEST_BATCH_IDENTITY','İki sentetik ürünün kimliği veya fiyat bağı değişti.',503);
 const products=rows.map(r=>({id:Number(r.product_id),stockCode:r.stock_code,name:r.product_name,unit:'ADET',purchasePrice:Number(r.unit_cost),currentStockQuantity:Number(r.current_stock_qty)}));
 // The recent list is bounded. A named source remains usable after it ages out
 // of that list; invoice reservations still include every linked draft.
 const headers=(await req().input('source',ctx.sql.BigInt,sourceBatchId).query('SELECT * FROM dbo.test_goods_batches WHERE id=@source OR id IN(SELECT TOP(100) id FROM dbo.test_goods_batches ORDER BY id DESC) ORDER BY id DESC')).recordset;
 const receiptRows=(await req().input('source',ctx.sql.BigInt,sourceBatchId).query(`SELECT l.*,b.state FROM dbo.test_goods_batch_lines l JOIN dbo.test_goods_batches b ON b.id=l.batch_id WHERE b.id=@source OR b.id IN(SELECT TOP(100) id FROM dbo.test_goods_batches ORDER BY id DESC)`)).recordset;
 const links=(await req().query(`SELECT l.*,p.status FROM dbo.test_purchase_batch_links l JOIN dbo.purchase_invoices p ON p.id=l.invoice_id`)).recordset;
 const batches=headers.map(b=>({id:Number(b.id),supplierId:Number(b.supplier_id),warehouseId:Number(b.warehouse_id),state:b.state,note:b.note,lines:receiptRows.filter(l=>Number(l.batch_id)===Number(b.id)).sort((a,b)=>Number(a.id)-Number(b.id)).map(l=>{
  const p=products.find(p=>p.id===Number(l.product_id));if(!p)fail('TEST_BATCH_IDENTITY','Kabul satırı sentetik scope dışında.',503);
  const reserved=links.filter(x=>Number(x.receipt_line_id)===Number(l.id)&&x.status!=='cancelled').reduce((n,x)=>n+Number(x.quantity),0);
  if(reserved>Number(l.quantity))fail('TEST_BATCH_RESERVATION','Fatura rezervasyonu kabul miktarını aşmış.',409);
  return {id:Number(l.id),clientLineId:l.client_line_id,productId:p.id,stockCode:p.stockCode,productName:p.name,quantity:Number(l.quantity),unit:'ADET',purchasePrice:p.purchasePrice,receivedQuantity:b.state==='accepted'?Number(l.quantity):0,invoiceableQuantity:b.state==='accepted'?Number(l.quantity)-reserved:0};
 })}));
 const invoiceIds=[...new Set(links.map(l=>Number(l.invoice_id)))];const invoiceDrafts=[];
 for(const id of invoiceIds.slice(-100)){invoiceDrafts.push(await batchInvoiceDetail(ctx,id,links,products));}
 return {products,batches,invoiceDrafts};
}
async function assertBatchEntities(ctx,batch){await assertOperationQuarantineAllowed([{entity:'supplier',nativeId:batch.supplierId},...batch.lines.map(l=>({entity:'product',nativeId:l.productId}))],quarantineTransactionContext(ctx.sql,ctx.tx));}
function nativeBatchContext(ctx){return {pool:ctx.pool,sqlDriver:ctx.sql,transaction:ctx.tx,stockAlreadyReceived:true,testBatchReceived:true};}
async function batchInvoiceDetail(ctx,id,providedLinks){
 const req=()=>new ctx.sql.Request(ctx.tx);
 const links=providedLinks||((await req().input('id',ctx.sql.BigInt,id).query('SELECT * FROM dbo.test_purchase_batch_links WHERE invoice_id=@id')).recordset);
 const selected=links.filter(l=>Number(l.invoice_id)===Number(id));if(!selected.length)fail('TEST_INVOICE_NOT_FOUND','Sentetik batch faturası bulunamadı.',404);
 const header=(await req().input('id',ctx.sql.BigInt,id).query("SELECT p.id,p.document_no,p.document_date,p.status,p.document_currency,p.subtotal,p.discount_total,p.grand_total FROM dbo.purchase_invoices p JOIN dbo.test_purchase_batch_drafts d ON d.invoice_id=p.id AND d.document_no=p.document_no AND d.subtotal=p.subtotal AND d.grand_total=p.grand_total JOIN dbo.test_goods_batches b ON b.id=d.batch_id AND b.supplier_id=p.supplier_id WHERE p.id=@id AND d.state IN(N'linked',N'cancelled')")).recordset[0];
 const items=(await req().input('id',ctx.sql.BigInt,id).query(`SELECT i.id,i.product_id,i.quantity,i.purchase_price,i.line_discount_rate,i.line_total,l.receipt_line_id,g.batch_id,p.stock_code,p.name product_name FROM dbo.purchase_invoice_items i JOIN dbo.test_purchase_batch_links l ON l.invoice_item_id=i.id AND l.invoice_id=i.purchase_invoice_id JOIN dbo.test_goods_batch_lines g ON g.id=l.receipt_line_id JOIN dbo.products p ON p.id=i.product_id WHERE i.purchase_invoice_id=@id ORDER BY i.id`)).recordset;
 const itemCount=Number((await req().input('id',ctx.sql.BigInt,id).query('SELECT COUNT(*) n FROM dbo.purchase_invoice_items WHERE purchase_invoice_id=@id')).recordset[0].n);
 if(!header||itemCount!==items.length||items.length!==selected.length||items.length<1||items.length>2||new Set(items.map(i=>Number(i.batch_id))).size!==1||header.document_currency!=='TRY'||Number(header.discount_total)!==0||items.some(i=>Number(i.line_discount_rate)!==0)||items.reduce((n,i)=>n+Number(i.line_total),0)!==Number(header.grand_total))fail('TEST_INVOICE_LINK','Fatura kabul satırları ve toplamları tam eşleşmiyor.',409);
 return {id:Number(header.id),batchId:Number(items[0].batch_id),status:header.status,number:header.document_no,date:header.document_date instanceof Date?header.document_date.toISOString().slice(0,10):String(header.document_date).slice(0,10),currency:header.document_currency,lines:items.map(i=>({id:Number(i.id),receiptLineId:Number(i.receipt_line_id),productId:Number(i.product_id),stockCode:i.stock_code,productName:i.product_name,quantity:Number(i.quantity),purchasePrice:Number(i.purchase_price),lineDiscountRate:Number(i.line_discount_rate),lineTotal:Number(i.line_total)})),totals:{subtotal:Number(header.subtotal),discountTotal:Number(header.discount_total),taxableTotal:Number(header.subtotal)-Number(header.discount_total),vatTotal:0,grandTotal:Number(header.grand_total)}};
}
export async function createTestBatchInContext(ctx,d,input,actor){return journal(ctx,actor,input,'batch_create',async()=>{
 const c=await loadBatchContext(ctx,d);const v=normalizeTestBatch(input,c.products,{supplierId:Number(d.s.supplier_id),warehouseId:Number(d.s.warehouse_id)});
 await assertOperationQuarantineAllowed([{entity:'supplier',nativeId:v.supplierId},...v.lines.map(l=>({entity:'product',nativeId:l.productId}))],quarantineTransactionContext(ctx.sql,ctx.tx));
 const id=Number((await new ctx.sql.Request(ctx.tx).input('s',ctx.sql.BigInt,v.supplierId).input('w',ctx.sql.BigInt,v.warehouseId).input('note',ctx.sql.NVarChar(500),v.note).input('actor',ctx.sql.BigInt,actor.id).query("DECLARE @new TABLE(id bigint); INSERT dbo.test_goods_batches(supplier_id,warehouse_id,state,note,created_by) OUTPUT INSERTED.id INTO @new VALUES(@s,@w,N'pending',@note,@actor); SELECT id FROM @new")).recordset[0].id);
 for(const line of v.lines)await new ctx.sql.Request(ctx.tx).input('batch',ctx.sql.BigInt,id).input('key',ctx.sql.NVarChar(64),line.clientLineId).input('p',ctx.sql.BigInt,line.productId).input('qty',ctx.sql.Decimal(18,3),line.quantity).query("INSERT dbo.test_goods_batch_lines(batch_id,client_line_id,product_id,quantity,unit,unit_factor) VALUES(@batch,@key,@p,@qty,N'ADET',1)");
 await writeAuditLog(new ctx.sql.Request(ctx.tx),{actor,action:'test_batch_counted',entityType:'test_goods_batch',entityId:id,afterSnapshot:{state:'pending',lines:v.lines}});
 return (await loadBatchContext(ctx,d)).batches.find(b=>b.id===id);
});}
export async function createTestBatch(input,actor){return batchAtomic(actor,(ctx,d)=>createTestBatchInContext(ctx,d,input,actor)).then(result=>publicTestBatch(result,actor.permissions?.includes('purchase.view')===true));}
// Internal adapter shares the existing SERIALIZABLE transaction and global lock.
// Never pass a context from HTTP or start another transaction from this callback.
export async function withTestPurchaseBatchContext(actor,operation,{write=true}={}){return batchAtomic(actor,async(ctx,d)=>{const scope={ctx,loaded:d,actorId:String(actor.id),write,active:true};try{return await adapterContext.run(scope,()=>operation(ctx,d));}finally{scope.active=false;}},write);}
export async function testBatchContextInContext(ctx,d,sourceBatchId=null){return loadBatchContext(ctx,d,true,sourceBatchId);}
export async function decideTestBatch(id,input,actor,approve){id=positiveId(Number(id));return batchAtomic(actor,async(ctx,d)=>journal(ctx,actor,{...input,id},approve?'batch_approve':'batch_reject',async()=>{
 office(actor);validateTestBatchDecision(input,!approve);const {batch}=await requiredTestBatch(source=>loadBatchContext(ctx,d,true,source),id);
 await assertBatchEntities(ctx,batch);const state=approve?'accepted':'rejected';if(batch.state===state)return {...batch,alreadyApplied:true};if(batch.state!=='pending')fail('TEST_RECEIPT_STATE','Sonuçlanmış kabul yeniden değiştirilemez.',409);
 await new ctx.sql.Request(ctx.tx).input('id',ctx.sql.BigInt,id).input('state',ctx.sql.NVarChar(20),state).input('reason',ctx.sql.NVarChar(500),input.reason||null).input('actor',ctx.sql.BigInt,actor.id).query('UPDATE dbo.test_goods_batches SET state=@state,reason=@reason,decided_by=@actor,decided_at=SYSUTCDATETIME() WHERE id=@id');
 if(approve)for(const l of batch.lines){
  await new ctx.sql.Request(ctx.tx).input('p',ctx.sql.BigInt,l.productId).input('qty',ctx.sql.Decimal(18,3),l.quantity).query('UPDATE dbo.products SET current_stock_qty=current_stock_qty+@qty,updated_at=SYSUTCDATETIME() WHERE id=@p');
  await new ctx.sql.Request(ctx.tx).input('p',ctx.sql.BigInt,l.productId).input('line',ctx.sql.BigInt,l.id).input('qty',ctx.sql.Decimal(18,3),l.quantity).input('cost',ctx.sql.Decimal(18,4),l.purchasePrice).input('supplier',ctx.sql.BigInt,batch.supplierId).input('actor',ctx.sql.BigInt,actor.id).query("INSERT dbo.stock_movements(product_id,movement_type,source_type,source_id,quantity_in,quantity_out,quantity_net,unit_cost_try,average_cost_try_after,document_date,supplier_id,created_by,unit_price,currency_code,amount_try,warehouse_name,source_warehouse) VALUES(@p,N'in',N'goods_receipt_batch',@line,@qty,0,@qty,@cost,@cost,CONVERT(date,GETDATE()),@supplier,@actor,@cost,N'TRY',@qty*@cost,N'TEST V70 MAL KABUL DEPOSU',N'TEST-V70-GOODS-WH')");
 }
 await writeAuditLog(new ctx.sql.Request(ctx.tx),{actor,action:approve?'test_batch_approved':'test_batch_rejected',entityType:'test_goods_batch',entityId:id,afterSnapshot:{state,lines:batch.lines,reason:input.reason||null}});
 return (await loadBatchContext(ctx,d,true,id)).batches.find(b=>b.id===id);
})).then(result=>publicTestBatch(result,actor.permissions?.includes('purchase.view')===true));}
export async function createTestBatchInvoiceDraft(input,actor){return batchAtomic(actor,async(ctx,d)=>journal(ctx,actor,input,'draft_create',async()=>{
 office(actor);const {batch}=await requiredTestBatch(source=>loadBatchContext(ctx,d,true,source),positiveId(input?.batchId));
 const v=normalizeTestInvoiceDraft(input,batch);await assertBatchEntities(ctx,batch);
 const duplicate=(await new ctx.sql.Request(ctx.tx).input('no',ctx.sql.NVarChar(30),v.number).input('s',ctx.sql.BigInt,batch.supplierId).query("SELECT id FROM dbo.purchase_invoices WHERE document_no=@no AND supplier_id=@s")).recordset;if(duplicate.length)fail('DUPLICATE_DOCUMENT','Tedarikçi fatura numarası zaten kayıtlı.',409);
 const context=nativeBatchContext(ctx),payload=testBatchPurchasePayload(v,batch,d.s.supplier_name);
 const normalized=normalizePurchasePayload(payload),payloadHash=createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
 const intentId=Number((await new ctx.sql.Request(ctx.tx).input('b',ctx.sql.BigInt,batch.id).input('request',ctx.sql.NVarChar(64),v.requestId).input('actor',ctx.sql.BigInt,actor.id).input('no',ctx.sql.NVarChar(30),v.number).input('date',ctx.sql.Date,v.date).input('total',ctx.sql.Decimal(18,4),normalized.grandTotal).input('hash',ctx.sql.Char(64),payloadHash).query("DECLARE @new TABLE(id bigint); INSERT dbo.test_purchase_batch_drafts(batch_id,request_id,actor_id,document_no,document_date,subtotal,grand_total,currency,state,payload_hash) OUTPUT INSERTED.id INTO @new VALUES(@b,@request,@actor,@no,@date,@total,@total,N'TRY',N'registered',@hash); SELECT id FROM @new")).recordset[0].id);
 for(const l of v.lines)await new ctx.sql.Request(ctx.tx).input('draft',ctx.sql.BigInt,intentId).input('receipt',ctx.sql.BigInt,l.receiptLineId).input('p',ctx.sql.BigInt,l.productId).input('qty',ctx.sql.Decimal(18,3),l.quantity).input('price',ctx.sql.Decimal(18,4),l.purchasePrice).input('total',ctx.sql.Decimal(18,4),l.quantity*l.purchasePrice).query('INSERT dbo.test_purchase_batch_intent_lines(draft_id,receipt_line_id,product_id,quantity,purchase_price,line_discount_rate,line_total) VALUES(@draft,@receipt,@p,@qty,@price,0,@total)');
 const invoice=await createPurchaseDraft(payload,actor,context);
 const items=(await new ctx.sql.Request(ctx.tx).input('id',ctx.sql.BigInt,invoice.id).query('SELECT id,product_id,quantity FROM dbo.purchase_invoice_items WHERE purchase_invoice_id=@id')).recordset;
 if(items.length!==v.lines.length)fail('TEST_INVOICE_LINK','Native fatura satırları farklı.',409);
 for(const l of v.lines){const item=items.find(i=>Number(i.product_id)===l.productId);if(!item||Number(item.quantity)!==l.quantity)fail('TEST_INVOICE_LINK','Native fatura satır bağı farklı.',409);await new ctx.sql.Request(ctx.tx).input('invoice',ctx.sql.BigInt,invoice.id).input('item',ctx.sql.BigInt,item.id).input('line',ctx.sql.BigInt,l.receiptLineId).input('qty',ctx.sql.Decimal(18,3),l.quantity).query('INSERT dbo.test_purchase_batch_links(invoice_id,invoice_item_id,receipt_line_id,quantity) VALUES(@invoice,@item,@line,@qty)');}
 await new ctx.sql.Request(ctx.tx).input('intent',ctx.sql.BigInt,intentId).input('invoice',ctx.sql.BigInt,invoice.id).query("UPDATE dbo.test_purchase_batch_drafts SET invoice_id=@invoice,state=N'linked' WHERE id=@intent AND state=N'registered' AND invoice_id IS NULL");
 return await batchInvoiceDetail(ctx,Number(invoice.id));
}));}
export async function getTestBatchInvoiceDraft(id,actor){id=positiveId(Number(id));return batchAtomic(actor,async(ctx,d)=>{await loadBatchContext(ctx,d);return batchInvoiceDetail(ctx,id);},false);}
export async function finalizeTestBatchInvoiceDraft(id,input,actor){id=positiveId(Number(id));return batchAtomic(actor,async(ctx,d)=>journal(ctx,actor,{...input,id},'draft_finalize',async()=>{
 office(actor);strictFields(input,['requestId']);validateRequestId(input.requestId);const detail=await batchInvoiceDetail(ctx,id),{batch}=await requiredTestBatch(source=>loadBatchContext(ctx,d,true,source),detail.batchId);await assertBatchEntities(ctx,batch);
 if(detail.status==='finalized')return {...detail,alreadyApplied:true};if(detail.status!=='draft')fail('TEST_INVOICE_STATE','Yalnız taslak kesinleşebilir.',409);
 await finalizePurchaseInvoice(id,actor,nativeBatchContext(ctx));return batchInvoiceDetail(ctx,id);
}));}
export async function cancelTestBatchInvoiceDraft(id,input,actor){id=positiveId(Number(id));return batchAtomic(actor,async(ctx,d)=>journal(ctx,actor,{...input,id},'draft_cancel',async()=>{
 office(actor);validateTestBatchDecision(input,true);const detail=await batchInvoiceDetail(ctx,id),{batch}=await requiredTestBatch(source=>loadBatchContext(ctx,d,true,source),detail.batchId);await assertBatchEntities(ctx,batch);if(detail.status==='cancelled')return {...detail,alreadyApplied:true};
 if(detail.status==='finalized')await cancelPurchaseInvoice(id,input,actor,nativeBatchContext(ctx));
 else if(detail.status==='draft'){
  await new ctx.sql.Request(ctx.tx).input('id',ctx.sql.BigInt,id).input('actor',ctx.sql.BigInt,actor.id).query("UPDATE dbo.purchase_invoices SET status=N'cancelled',updated_by=@actor,updated_at=SYSUTCDATETIME() WHERE id=@id AND status=N'draft'");
  await writeAuditLog(new ctx.sql.Request(ctx.tx),{actor,action:'test_batch_purchase_draft_cancelled',entityType:'purchase_invoice',entityId:id,beforeSnapshot:detail,afterSnapshot:{...detail,status:'cancelled',reason:input.reason}});
 }else fail('TEST_INVOICE_STATE','Taslak durumu desteklenmiyor.',409);
 await new ctx.sql.Request(ctx.tx).input('id',ctx.sql.BigInt,id).query("UPDATE dbo.test_purchase_batch_drafts SET state=N'cancelled' WHERE invoice_id=@id AND state=N'linked'");
 return batchInvoiceDetail(ctx,id);
}));}
