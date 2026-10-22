// Exact clean TEST persistence adapter for the existing workInboundService and
// invoiceDraftService. Domain validation, invoice totals and posting stay there.
import {createHash} from 'node:crypto';
import {assertRegisteredCleanContext,assertCleanIdentity,CLEAN_IDENTITY_SQL,CLEAN_ENVIRONMENT_ID} from './cleanSyntheticContext.mjs';
import {withCleanStoreDayMutation} from './cleanStoreDayScope.mjs';
import {canonical,countDto,reject,inboundError} from './workInboundModel.mjs';
import {normalizeTestBatch,normalizeTestInvoiceDraft} from './testPurchaseBatchModel.mjs';
import {workInboundSupplierMovement} from './workInboundStore.mjs';
export function cleanInboundActor(actor){assertRegisteredCleanContext();if(!actor||!['18','19'].includes(String(actor.id))||!Array.isArray(actor.permissions))reject('INBOUND_FORBIDDEN','Bu işlem için yetkiniz bulunmuyor.',403);return {...actor,id:String(actor.id)};}
export function cleanInboundCapabilities(actor,c,key){
 const has=k=>actor.permissions.includes(k)&&c.actual.permissions.includes(k),staff=actor.id==='18',office=actor.id==='19';
 const cap={canView:has('goods.view'),canCount:staff&&has('goods.create'),canSubmit:staff&&has('goods.create'),canApprove:office&&has('goods.approve'),canReject:office&&has('goods.reject'),canViewPurchase:office&&has('purchase.view'),canCreatePurchase:office&&has('purchase.view')&&has('purchase.create'),canFinalizePurchase:office&&has('purchase.view')&&has('purchase.finalize'),canCancelPurchase:false,canViewSupplier:office&&has('supplier.view')&&has('purchase.view')};
 if(cap[key]!==true)reject('INBOUND_FORBIDDEN','Bu işlem için yetkiniz bulunmuyor.',403);return cap;
}
const defaultDependencies=async()=>import('../config/database.js');
export function cleanRecordedInvoiceBasis(row){
 const positive=v=>typeof v==='string'&&/^[1-9]\d*$/.test(v);
 if(!row||!positive(row.invoiceId)||!positive(row.receiptId)||row.supplierId!=='1'||row.documentCurrency!=='TRY'||row.accountCurrency!=='TRY'||row.documentExchangeRateExact8!=='1.00000000'||row.accountExchangeRateExact8!=='1.00000000'||!/^[1-9]\d*\.\d{4}$/.test(row.accountAmountExact4??'')||row.accountAmountExact4!==row.amountTryExact4||row.accountAmountExact4!==row.totalExact4||row.linkCount!==1||row.itemCount!==1||row.receiptState!=='accepted')throw inboundError();
 const {totalExact4,linkCount,itemCount,receiptState,...basis}=row;return {source:'stored-native-invoice',...basis};
}
export function createCleanStoreDayStore({dependencies=defaultDependencies,invoices=()=>import('./invoiceDraftService.js')}={}){
 async function run(actor,write,callback){
  actor=cleanInboundActor(actor);let tx;
  try{
   if(process.env.API_PORT!=='4194'||process.env.MELISA_CLEAN_STORE_DAY!=='20261022')throw inboundError();
   const db=await dependencies(),pool=await db.getSqlPool(),q=db.getSqlDriver();assertCleanIdentity((await pool.request().query(CLEAN_IDENTITY_SQL)).recordset[0]);
   tx=new q.Transaction(pool);await tx.begin(q.ISOLATION_LEVEL.SERIALIZABLE);const req=()=>new q.Request(tx);
   await req().input('mode',q.NVarChar(16),write?'Exclusive':'Shared').query("DECLARE @n int;EXEC @n=sys.sp_getapplock @Resource=N'CLEAN_STORE_DAY_20261022',@LockMode=@mode,@LockOwner=N'Transaction',@LockTimeout=5000;IF @n<0 THROW 51962,'CLEAN_INBOUND_BUSY',1;");
   await req().execute('dbo.usp_clean_store_day_ready');
   const sets=(await req().input('actor',q.BigInt,Number(actor.id)).query("SELECT u.id,u.username,r.code FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id WHERE u.id=@actor AND u.is_active=1;SELECT p.permission_key FROM dbo.permissions p JOIN dbo.users u ON u.role_id=p.role_id WHERE u.id=@actor AND u.is_active=1 AND(p.can_view=1 OR p.can_create=1 OR p.can_approve=1);SELECT CONVERT(varchar(20),p.id) id,p.stock_code stockCode,p.name,CONVERT(varchar(40),p.current_stock_qty) stockQuantityExact3,(SELECT TOP(1)barcode FROM dbo.product_barcodes WHERE product_id=p.id AND is_primary=1) barcode FROM dbo.products p WHERE p.id=1;SELECT CONVERT(varchar(20),id) id,supplier_code code,name,currency_code currency,CONVERT(varchar(40),balance) balanceExact4 FROM dbo.suppliers WHERE id=1;")).recordsets;
   const u=sets[0]?.[0];if(sets[0]?.length!==1||u.username!==(actor.id==='18'?'ornek-depo':'ornek-kontrol')||u.code!==(actor.id==='18'?'clean_test_warehouse':'clean_test_inbound_supervisor')||sets[2]?.length!==1||sets[3]?.length!==1)throw inboundError();
   const c={actual:{permissions:sets[1].map(x=>x.permission_key)},cleanMeta:{environment:'CLEAN_SYNTHETIC_TEST',environmentId:CLEAN_ENVIRONMENT_ID},products:sets[2].map(p=>({...p,purchasePriceExact8:'60.00000000'})),supplier:sets[3][0],warehouse:{id:'1',label:'Örnek mal kabul deposu'}};
   const nativeContext={pool,transaction:tx,sqlDriver:q,stockAlreadyReceived:true,cleanStoreDayReceived:true};
   c.draft=async id=>{const rows=(await req().input('id',q.BigInt,Number(id)).query('SELECT * FROM dbo.work_inbound_counts WITH(UPDLOCK,HOLDLOCK) WHERE id=@id')).recordset;if(rows.length!==1)reject('INBOUND_NOT_FOUND','Sayım kaydı bulunamadı.',404);if(actor.id!=='19'&&String(rows[0].created_by)!==actor.id)reject('INBOUND_FORBIDDEN','Bu kayıt başka bir personele ait.',403);return countDto(rows[0]);};
   c.list=async()=>((await req().input('actor',q.BigInt,Number(actor.id)).query('SELECT TOP(20)* FROM dbo.work_inbound_counts WHERE created_by=@actor OR @actor=19 ORDER BY id DESC')).recordset).map(countDto);
   c.request=async id=>{const r=(await req().input('id',q.UniqueIdentifier,id).input('actor',q.BigInt,Number(actor.id)).query('SELECT operation,response_json FROM dbo.work_inbound_requests WHERE request_id=@id AND actor_id=@actor')).recordset[0];if(!r)reject('INBOUND_NOT_FOUND','İşlem kaydı bulunamadı.',404);return {requestId:id,operation:r.operation,response:JSON.parse(r.response_json)};};
   c.save=async(id,payload,state,receiptId=null)=>{
    const r=req().input('actor',q.BigInt,Number(actor.id)).input('state',q.NVarChar(20),state).input('note',q.NVarChar(500),payload.note).input('lines',q.NVarChar(q.MAX),JSON.stringify(payload.lines)).input('receipt',q.BigInt,receiptId==null?null:Number(receiptId));
    if(id){await r.input('id',q.BigInt,Number(id)).query("UPDATE dbo.work_inbound_counts SET state=@state,version=version+1,note=@note,lines_json=@lines,receipt_id=@receipt,updated_at=SYSUTCDATETIME() WHERE id=@id AND state IN(N'draft',N'needs_review');IF @@ROWCOUNT<>1 THROW 51963,'CLEAN_INBOUND_STALE',1;");return c.draft(id);}
    return c.draft(String((await r.query('DECLARE @ids TABLE(id bigint);INSERT dbo.work_inbound_counts(created_by,state,version,note,lines_json,receipt_id)OUTPUT inserted.id INTO @ids VALUES(@actor,@state,1,@note,@lines,@receipt);SELECT id FROM @ids')).recordset[0].id));
   };
   async function invoice(id){
    const sets=(await req().input('id',q.BigInt,Number(id)).query("SELECT p.* FROM dbo.purchase_invoices p WHERE p.id=@id AND p.supplier_id=1;SELECT i.*,l.receipt_line_id,g.batch_id FROM dbo.purchase_invoice_items i JOIN dbo.test_purchase_batch_links l ON l.invoice_item_id=i.id AND l.invoice_id=i.purchase_invoice_id JOIN dbo.test_goods_batch_lines g ON g.id=l.receipt_line_id WHERE i.purchase_invoice_id=@id ORDER BY i.id;")).recordsets;
    const p=sets[0][0],items=sets[1];if(!p||sets[0].length!==1||items.length!==1||Number(items[0].product_id)!==1||p.document_currency!=='TRY')throw inboundError();
    return {id:Number(p.id),batchId:Number(items[0].batch_id),status:p.status,number:p.document_no,date:p.document_date instanceof Date?p.document_date.toISOString().slice(0,10):String(p.document_date).slice(0,10),currency:p.document_currency,lines:items.map(i=>({id:Number(i.id),receiptLineId:Number(i.receipt_line_id),productId:Number(i.product_id),stockCode:i.stock_code_snapshot,productName:i.product_name_snapshot,quantity:Number(i.quantity),purchasePrice:Number(i.purchase_price),lineTotal:Number(i.line_total)})),totals:{subtotal:Number(p.subtotal),grandTotal:Number(p.grand_total)}};
   }
   c.batches=async()=>{
    const sets=(await req().query("SELECT * FROM dbo.test_goods_batches ORDER BY id;SELECT l.*,COALESCE((SELECT SUM(x.quantity) FROM dbo.test_purchase_batch_links x JOIN dbo.purchase_invoices i ON i.id=x.invoice_id WHERE x.receipt_line_id=l.id AND i.status<>N'cancelled'),0) reserved FROM dbo.test_goods_batch_lines l ORDER BY l.id;SELECT DISTINCT invoice_id FROM dbo.test_purchase_batch_links ORDER BY invoice_id;")).recordsets;
    const batches=sets[0].map(b=>({id:Number(b.id),supplierId:Number(b.supplier_id),warehouseId:Number(b.warehouse_id),state:b.state,note:b.note??'',lines:sets[1].filter(l=>String(l.batch_id)===String(b.id)).map(l=>({id:Number(l.id),clientLineId:l.client_line_id,productId:1,stockCode:c.products[0].stockCode,productName:c.products[0].name,quantity:Number(l.quantity),unit:'ADET',purchasePrice:60,receivedQuantity:b.state==='accepted'?Number(l.quantity):0,invoiceableQuantity:b.state==='accepted'?Number(l.quantity)-Number(l.reserved):0}))}));
    const invoiceDrafts=[];for(const row of sets[2])invoiceDrafts.push(await invoice(row.invoice_id));return {batches,invoiceDrafts};
   };
   c.journal=async(operation,payload,execute)=>{
    if(!write)reject('INBOUND_FORBIDDEN','Bu bağlantı salt okunur.',403);
    const payloadJson=JSON.stringify(canonical({...payload,operation,actorId:actor.id})),payloadHash=createHash('sha256').update(payloadJson,'utf16le').digest('hex');
    const old=(await req().input('id',q.UniqueIdentifier,payload.requestId).query('SELECT * FROM dbo.work_inbound_requests WITH(UPDLOCK,HOLDLOCK) WHERE request_id=@id')).recordset[0];
    if(old){if(String(old.actor_id)!==actor.id||old.operation!==operation||old.payload_hash.toLowerCase()!==payloadHash||old.payload_json!==payloadJson)reject('INBOUND_REQUEST_CONFLICT','İşlem kimliği farklı içerikle kullanılamaz.',409);return {...JSON.parse(old.response_json),replayed:true};}
    let receiptId=null,invoiceId=null;
    if(operation.startsWith('goods_'))receiptId=Number(payload.id);
    if(operation==='purchase_draft')receiptId=Number(payload.batchId);
    if(operation==='purchase_finalize'){invoiceId=Number(payload.id);receiptId=(await invoice(invoiceId)).batchId;}
    return withCleanStoreDayMutation({transaction:tx,sqlDriver:q,actor:{...actor,id:Number(actor.id)},operation,requestId:payload.requestId,payloadJson,payloadHash,receiptId,invoiceId},async()=>{
     const value=await execute();
     await req().input('id',q.UniqueIdentifier,payload.requestId).input('actor',q.BigInt,Number(actor.id)).input('op',q.NVarChar(30),operation).input('hash',q.Char(64),payloadHash.toUpperCase()).input('payload',q.NVarChar(q.MAX),payloadJson).input('response',q.NVarChar(q.MAX),JSON.stringify(value)).input('count',q.BigInt,value.draft?.id??null).query('INSERT dbo.work_inbound_requests(request_id,actor_id,operation,payload_hash,payload_json,response_json,count_id)VALUES(@id,@actor,@op,@hash,@payload,@response,@count)');return value;
    });
   };
   c.createBatch=async input=>{
    const v=normalizeTestBatch(input,c.products.map(p=>({...p,id:Number(p.id)})),{supplierId:1,warehouseId:1});
    const batchId=Number((await req().input('note',q.NVarChar(500),v.note).input('actor',q.BigInt,Number(actor.id)).query("DECLARE @ids TABLE(id bigint);INSERT dbo.test_goods_batches(supplier_id,warehouse_id,state,note,created_by)OUTPUT inserted.id INTO @ids VALUES(1,1,N'pending',@note,@actor);SELECT id FROM @ids")).recordset[0].id);
    for(const l of v.lines)await req().input('batch',q.BigInt,batchId).input('key',q.NVarChar(64),l.clientLineId).input('qty',q.Decimal(18,3),l.quantity).query("INSERT dbo.test_goods_batch_lines(batch_id,client_line_id,product_id,quantity,unit,unit_factor)VALUES(@batch,@key,1,@qty,N'ADET',1)");
    return (await c.batches()).batches.find(x=>x.id===batchId);
   };
   c.decideBatch=async(id,input,approve)=>c.journal(approve?'goods_accept':'goods_reject',{...input,id:String(id)},async()=>{
    const batch=(await c.batches()).batches.find(b=>b.id===Number(id)),state=approve?'accepted':'rejected';if(!batch)reject('INBOUND_NOT_FOUND','Mal kabulü bulunamadı.',404);if(batch.state===state)return {...batch,replayed:true};if(batch.state!=='pending')reject('INBOUND_STATE','Mal kabulü zaten sonuçlandı.',409);
    await req().input('id',q.BigInt,Number(id)).input('state',q.NVarChar(20),state).input('reason',q.NVarChar(500),input.reason??null).input('actor',q.BigInt,Number(actor.id)).query('UPDATE dbo.test_goods_batches SET state=@state,reason=@reason,decided_by=@actor,decided_at=SYSUTCDATETIME() WHERE id=@id');
    if(approve)for(const l of batch.lines){await req().input('qty',q.Decimal(18,3),l.quantity).query('UPDATE dbo.products SET current_stock_qty=current_stock_qty+@qty,updated_at=SYSUTCDATETIME() WHERE id=1');await req().input('line',q.BigInt,l.id).input('qty',q.Decimal(18,3),l.quantity).input('actor',q.BigInt,Number(actor.id)).query("INSERT dbo.stock_movements(product_id,movement_type,source_type,source_id,quantity_in,quantity_out,quantity_net,unit_cost_try,average_cost_try_after,document_date,supplier_id,created_by,unit_price,currency_code,amount_try,warehouse_name,source_warehouse)VALUES(1,N'in',N'goods_receipt_batch',@line,@qty,0,@qty,60,NULL,CONVERT(date,'20261022',112),1,@actor,60,N'TRY',@qty*60,N'Örnek mal kabul deposu',N'ORNEK-20261022')");}
    return (await c.batches()).batches.find(b=>b.id===Number(id));
   });
   c.createPurchase=async input=>c.journal('purchase_draft',input,async()=>{
    const batch=(await c.batches()).batches.find(b=>b.id===Number(input.batchId));if(!batch)throw inboundError();const v=normalizeTestInvoiceDraft(input,batch),native=await invoices();
    const result=await native.createPurchaseDraft({documentNo:v.number,documentDate:v.date,supplierId:1,supplierName:c.supplier.name,supplierCurrency:'TRY',documentCurrency:'TRY',exchangeRate:1,accountExchangeRate:1,invoiceDiscountRate:0,supplierDiscountRate:0,description:'Mal kabulüne bağlı örnek alış',items:v.lines.map(l=>({productId:1,stockCode:c.products[0].stockCode,productName:c.products[0].name,barcode:null,quantity:l.quantity,currency:'TRY',purchasePrice:60,lineDiscountRate:0,stockEffect:'goods_receipt_already_posted'}))},actor,nativeContext);
    const item=(await req().input('id',q.BigInt,Number(result.id)).query('SELECT id FROM dbo.purchase_invoice_items WHERE purchase_invoice_id=@id')).recordset;
    if(item.length!==1)throw inboundError();await req().input('invoice',q.BigInt,Number(result.id)).input('item',q.BigInt,Number(item[0].id)).input('line',q.BigInt,v.lines[0].receiptLineId).input('qty',q.Decimal(18,3),v.lines[0].quantity).query('INSERT dbo.test_purchase_batch_links(invoice_id,invoice_item_id,receipt_line_id,quantity)VALUES(@invoice,@item,@line,@qty)');
    await req().input('id',q.BigInt,Number(result.id)).input('actor',q.BigInt,Number(actor.id)).query('UPDATE dbo.purchase_invoices SET created_by=@actor,updated_by=@actor WHERE id=@id');return invoice(result.id);
   });
   c.getPurchase=invoice;
   if(!write)c.recordedInvoiceBases=async values=>{const result=new Map();for(const v of values){
    const rows=(await req().input('id',q.BigInt,Number(v.id)).query("SELECT CONVERT(varchar(20),p.id) invoiceId,CONVERT(varchar(20),p.supplier_id) supplierId,CONVERT(varchar(20),b.id) receiptId,p.document_currency documentCurrency,CONVERT(varchar(40),p.exchange_rate_snapshot) documentExchangeRateExact8,p.account_currency accountCurrency,CONVERT(varchar(40),p.account_exchange_rate_snapshot) accountExchangeRateExact8,CONVERT(varchar(40),p.account_amount) accountAmountExact4,CONVERT(varchar(40),p.amount_try) amountTryExact4,CONVERT(varchar(40),p.grand_total) totalExact4,b.state receiptState,(SELECT COUNT(*) FROM dbo.test_purchase_batch_links WHERE invoice_id=p.id) linkCount,(SELECT COUNT(*) FROM dbo.purchase_invoice_items WHERE purchase_invoice_id=p.id) itemCount FROM dbo.purchase_invoices p JOIN dbo.test_purchase_batch_links l ON l.invoice_id=p.id JOIN dbo.purchase_invoice_items i ON i.id=l.invoice_item_id AND i.purchase_invoice_id=p.id JOIN dbo.test_goods_batch_lines g ON g.id=l.receipt_line_id AND g.product_id=i.product_id JOIN dbo.test_goods_batches b ON b.id=g.batch_id AND b.supplier_id=p.supplier_id WHERE p.id=@id AND p.supplier_id=1 AND b.warehouse_id=1 AND i.quantity=l.quantity AND l.quantity<=g.quantity")).recordset;
    if(rows.length!==1||String(v.batchId)!==rows[0].receiptId)throw inboundError();result.set(String(v.id),cleanRecordedInvoiceBasis(rows[0]));
   }return result;};
   c.decidePurchase=async(id,input,cancel)=>{if(cancel)reject('INBOUND_FORBIDDEN','Bu adımda fatura iptali kapalı.',403);return c.journal('purchase_finalize',{...input,id:String(id)},async()=>{const current=await invoice(id);if(current.status==='finalized')return {...current,replayed:true};if(current.status!=='draft')reject('INBOUND_STATE','Yalnız taslak alış onaylanabilir.',409);await(await invoices()).finalizePurchaseInvoice(Number(id),actor,nativeContext);await req().input('id',q.BigInt,Number(id)).input('actor',q.BigInt,Number(actor.id)).query('UPDATE dbo.supplier_movements SET created_by=@actor WHERE purchase_invoice_id=@id');return invoice(id);});};
  c.supplierHistory=async()=>{const rows=(await req().query(`SELECT TOP(50) CONVERT(varchar(20),m.id) id,CONVERT(varchar(20),m.purchase_invoice_id) invoiceId,m.movement_type type,CONVERT(char(10),m.document_date,23) documentDate,m.currency_code currency,CONVERT(varchar(40),CAST(m.amount AS decimal(18,4))) amountExact4,CONVERT(varchar(40),CAST(m.balance_effect AS decimal(18,4))) balanceEffectExact4,CONVERT(varchar(40),CAST(m.amount_try AS decimal(18,4))) amountTryExact4,
 p.document_no invoiceNumber,p.status invoiceStatus,chain.linkCount,chain.batchCount,CASE WHEN p.id IS NULL AND chain.linkCount>0 THEN chain.invalidLinks+1 ELSE chain.invalidLinks END invalidLinks,(SELECT COUNT_BIG(*) FROM dbo.purchase_invoice_items allItems WHERE allItems.purchase_invoice_id=m.purchase_invoice_id) invoiceItemCount,CASE WHEN chain.batchCount=1 THEN CONVERT(varchar(20),chain.singleBatchId) ELSE NULL END receiptId
 FROM dbo.supplier_movements m LEFT JOIN dbo.purchase_invoices p ON p.id=m.purchase_invoice_id AND p.supplier_id=m.supplier_id
 OUTER APPLY(SELECT COUNT_BIG(*) linkCount,COUNT(DISTINCT g.batch_id) batchCount,MAX(g.batch_id) singleBatchId,
 COALESCE(SUM(CASE WHEN i.id IS NULL OR g.id IS NULL OR b.id IS NULL OR b.supplier_id<>1 OR i.product_id<>g.product_id OR i.quantity<>l.quantity OR l.quantity<=0 OR l.quantity>g.quantity THEN 1 ELSE 0 END),0) invalidLinks
 FROM dbo.test_purchase_batch_links l LEFT JOIN dbo.purchase_invoice_items i ON i.id=l.invoice_item_id AND i.purchase_invoice_id=l.invoice_id LEFT JOIN dbo.test_goods_batch_lines g ON g.id=l.receipt_line_id LEFT JOIN dbo.test_goods_batches b ON b.id=g.batch_id WHERE l.invoice_id=m.purchase_invoice_id) chain
 WHERE m.supplier_id=1 ORDER BY m.id DESC`)).recordset;return rows.map(workInboundSupplierMovement);};
   c.home=async canViewPurchase=>{const data=await c.batches();return {countDrafts:(await c.list()).map(x=>({id:x.id,state:x.state})),receipts:data.batches.map(b=>({id:String(b.id),state:b.state})),drafts:canViewPurchase?data.invoiceDrafts.map(i=>({id:String(i.id),status:i.status})):[]};};
   const value=await callback(c);await tx.commit();return value;
  }catch(e){if(tx)try{await tx.rollback();}catch{}if(e.statusCode)throw e;const failure=inboundError();Object.defineProperty(failure,'cause',{value:e});throw failure;}
 }
 return {read:(actor,fn)=>run(actor,false,fn),mutate:(actor,fn)=>run(actor,true,fn)};
}
export const cleanStoreDayStore=createCleanStoreDayStore();
