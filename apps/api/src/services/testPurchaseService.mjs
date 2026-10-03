import {createHash} from 'node:crypto';
import {getSqlPool,getSqlDriver} from '../config/database.js';
import {withTestSalesMutation} from './testSalesScope.mjs';
import {addGoodsBatch,acceptGoods,rejectGoods,addPurchase,invoiceableQuantity} from './sitesGoodsRules.mjs';
import {createPurchaseDraft,finalizePurchaseInvoice,cancelPurchaseInvoice,getPurchaseDraft} from './invoiceDraftService.js';
import {writeAuditLog} from './auditService.js';
import {assertPurchaseReturnClear} from './testPurchaseReturnGuard.mjs';
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
async function atomic(actor,fn,write=true){return withTestSalesMutation(async()=>{
 const pool=await getSqlPool(),sql=getSqlDriver(),tx=new sql.Transaction(pool);await tx.begin();const ctx={pool,sql,tx};
 try{await new sql.Request(tx).query("DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=N'MELISA-TEST-V70-SALES',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000; IF @r<0 THROW 51071,'TEST_LOCK_TIMEOUT',1;");
  const loaded=await load(ctx);if(write&&![15,16].includes(Number(actor.id)))fail('TEST_ACTOR','TEST oturumu gerekli.',403);
  const result=await fn(ctx,loaded);await tx.commit();return result;
 }catch(e){try{await tx.rollback()}catch{}if(e.number===51070)fail('TEST_DATABASE_BOUNDARY','TEST sınırı aşıldı; işlem geri alındı.',409);if(!e.statusCode&&!e.code){e.statusCode=409;e.code='SITES_WORKFLOW_RULE'}throw e}
});}
async function journal(ctx,actor,input,operation,fn){
 if(!/^[a-zA-Z0-9-]{16,64}$/.test(input.requestId||''))fail('REQUEST_ID_REQUIRED','Kalıcı istek kimliği gerekli.');
 const {sql,tx}=ctx,hash=createHash('sha256').update(JSON.stringify(canonical({...input,operation}))).digest('hex');
 const old=(await new sql.Request(tx).input('id',sql.NVarChar(64),input.requestId).query('SELECT * FROM dbo.test_purchase_requests WHERE request_id=@id')).recordset[0];
 if(old){if(old.payload_hash!==hash||Number(old.actor_id)!==Number(actor.id))fail('REQUEST_CONFLICT','İstek kimliği farklı işlemde kullanıldı.',409);return {...JSON.parse(old.response_json),replayed:true}}
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
 return {environment:'ISOLATED_TEST',scope:d.s,goods:d.state.goods.map(g=>({...g,invoiceableQuantity:invoiceableQuantity(d.state,g.id)})),invoices:d.invoices,stockMovements:movements,supplierMovements,partialDeliverySupported:false,unitFactor:1,remainingMeaning:'received but not yet invoiced'};
},false);}
