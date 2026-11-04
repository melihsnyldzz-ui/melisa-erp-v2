import {isolatedCopyTransactionContext} from './isolatedOperationCopyScope.mjs';
import {copyAssert} from './isolatedOperationCopyContext.mjs';
import {stockAfterReturn} from './invoiceReturnPolicy.mjs';
import {assertAccountingPeriodOpen} from './periodLockService.js';
const fail=(code,message,statusCode=409)=>{throw Object.assign(new Error(message),{code,statusCode})};
export async function assertNoLaterIsolatedCopyCount(c,d,productId){
 copyAssert(isolatedCopyTransactionContext(c.transaction)===c.copyContext,'ISOLATED_COPY_REVERSAL_TRANSACTION');
 copyAssert(d.kind==='count'&&c.copyContext.products.some(p=>p.id===String(productId)),'ISOLATED_COPY_REVERSAL_PRODUCT',403);
 const q=c.sqlDriver;
 // Ownership comes from committed copy requests, not the old synthetic scope.
 // The immutable approval response and native audit establish approval order.
 const result=await c.req().input('copyCountCopyId',q.UniqueIdentifier,c.copyContext.copyId).input('copyCountOriginalId',q.BigInt,d.id).input('copyCountProductId',q.BigInt,productId).input('copyCountDate',q.Date,c.copyContext.date).query(`
 DECLARE @ownedCounts TABLE(id bigint PRIMARY KEY,approvalAuditId bigint);
 INSERT @ownedCounts(id,approvalAuditId)
 SELECT doc.id,MAX(a.id) FROM dbo.test_daily_drafts doc
 JOIN dbo.stage4_copy_requests approval ON approval.copy_id=@copyCountCopyId AND approval.operation=N'stock_count_approve'
  AND TRY_CONVERT(bigint,JSON_VALUE(approval.payload_json,'$.id'))=doc.id AND TRY_CONVERT(bigint,JSON_VALUE(approval.response_json,'$.id'))=doc.id
 JOIN dbo.audit_logs a ON a.entity_type=N'test_daily_draft' AND a.entity_id=doc.id AND a.action=N'test_daily_approved' AND a.actor_user_id=approval.actor_id
 WHERE doc.kind=N'count' AND doc.state=N'approved' AND doc.flow=N'count' AND TRY_CONVERT(date,JSON_VALUE(doc.payload_json,'$.date'))=@copyCountDate
  AND EXISTS(SELECT 1 FROM dbo.stage4_copy_requests created WHERE created.copy_id=@copyCountCopyId AND created.operation=N'stock_count_draft' AND TRY_CONVERT(bigint,JSON_VALUE(created.response_json,'$.id'))=doc.id)
  AND EXISTS(SELECT 1 FROM OPENJSON(doc.payload_json,'$.lines') WITH(productId bigint '$.productId') line WHERE line.productId=@copyCountProductId)
  AND EXISTS(SELECT 1 FROM OPENJSON(approval.response_json,'$.result.lines') WITH(productId bigint '$.productId') line WHERE line.productId=@copyCountProductId)
 GROUP BY doc.id;
 SELECT id FROM @ownedCounts WHERE id=@copyCountOriginalId;
 SELECT TOP(1) nextCount.id FROM @ownedCounts nextCount JOIN @ownedCounts originalCount ON originalCount.id=@copyCountOriginalId WHERE nextCount.id<>originalCount.id AND nextCount.approvalAuditId>originalCount.approvalAuditId ORDER BY nextCount.approvalAuditId;
 `);
 copyAssert(result.recordsets?.[0]?.length===1&&String(result.recordsets[0][0].id)===String(d.id),'ISOLATED_COPY_COUNT_APPROVAL_PROOF');
 const later=result.recordsets?.[1];copyAssert(Array.isArray(later)&&later.length<=1,'ISOLATED_COPY_COUNT_APPROVAL_PROOF');
 if(later.length)fail('LATER_APPROVED_COUNT',`Bu düzeltmeden sonra #${later[0].id} sayımı onaylanmış. Önce bağlı sayımın düzeltme sırasını çözün; stok değiştirilmedi.`);
}
export async function reverseStockDocument(c,d,input){
 if(c.cleanDaily&&d.kind==='count'&&Array.isArray(d.payload.lines)){if(d.payload.lines.length!==1||d.result?.lines?.length!==1||d.payload.lines[0].productId!=='1')fail('REVERSAL_KIND','Özgün tek sayım satırı gerekli.');const line=d.payload.lines[0];d={...d,payload:{...d.payload,physical:line.physical,system:line.system},result:d.result.lines[0]};}
 if(c.copyContext){copyAssert(isolatedCopyTransactionContext(c.transaction)===c.copyContext,'ISOLATED_COPY_REVERSAL_TRANSACTION');if(d.kind==='count'&&Array.isArray(d.payload.lines)){copyAssert(d.payload.lines.length===1&&d.result?.lines?.length===1,'ISOLATED_COPY_REVERSAL_SINGLE_LINE',409);const line=d.payload.lines[0];copyAssert(c.copyContext.products.some(p=>p.id===line.productId),'ISOLATED_COPY_REVERSAL_PRODUCT',403);c={...c,scope:{...c.scope,product_id:Number(line.productId)}};d={...d,payload:{...d.payload,physical:line.physical,system:line.system},result:d.result.lines[0]};}}
 const q=c.sqlDriver,s=c.scope,reason=String(input.reason||'').trim(),date=input.date;
 if(!['count','uninvoiced'].includes(d.kind))fail('REVERSAL_KIND','Bu belge stok ters kaydı kapsamında değil.');
 if(!c.actor.permissions?.includes(d.kind==='count'?'stock.adjust':'purchase.cancel'))fail('AUTH_PERMISSION_DENIED','İptal için sunucu yetkisi gerekli.',403);
 if(reason.length<5||reason.length>500)fail('REVERSAL_REASON_REQUIRED','İptal gerekçesi 5–500 karakter olmalıdır.',400);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail('DATE','Geçerli işlem tarihi gerekli.',400);
 if(d.kind==='uninvoiced'&&input.correctionType!=='entry_error')fail('NEW_GOODS_RECEIPT_REQUIRED','Gerçekten gönderilen mal geri geldiyse iptal yapılmaz; yeni mal kabulü açın. İptal yalnız hatalı kayıt düzeltmesidir.');
 const previous=(await c.req().input('id',q.BigInt,d.id).query('SELECT * FROM dbo.test_stock_reversals WHERE original_draft_id=@id')).recordset[0];
 if(previous)return {id:d.id,alreadyApplied:true,reversal:previous};
 if(d.state!=='approved')fail('REVERSAL_STATE','Yalnız onaylı belge iptal edilebilir.');
 await assertAccountingPeriodOpen(c.req(),date,'Stok belge iptali');
 const product=(await c.req().input('id',q.BigInt,s.product_id).query('SELECT id,current_stock_qty,average_cost_try FROM dbo.products WITH(UPDLOCK,HOLDLOCK) WHERE id=@id')).recordset[0];
 if(c.copyContext&&d.kind==='count')await assertNoLaterIsolatedCopyCount(c,d,s.product_id);
 else{
 const later=(await c.req().input('id',q.BigInt,d.id).input('p',q.BigInt,s.product_id).query(`SELECT TOP 1 nextDoc.id FROM dbo.test_daily_drafts nextDoc JOIN dbo.test_daily_scope nextScope ON nextScope.flow=nextDoc.flow JOIN dbo.audit_logs a ON a.entity_type=N'test_daily_draft' AND a.entity_id=nextDoc.id AND a.action=N'test_daily_approved' WHERE nextScope.product_id=@p AND nextDoc.kind=N'count' AND nextDoc.state=N'approved' AND nextDoc.id<>@id AND a.id>(SELECT MAX(id) FROM dbo.audit_logs WHERE entity_type=N'test_daily_draft' AND entity_id=@id AND action=N'test_daily_approved') ORDER BY a.id`)).recordset[0];
 if(later)fail('LATER_APPROVED_COUNT',`Bu düzeltmeden sonra #${later.id} sayımı onaylanmış. Önce bağlı sayımın düzeltme sırasını çözün; stok değiştirilmedi.`);
 }
 const noMovement=d.kind==='count'&&d.result?.movementCreated===false;
 let original=null,delta=0,next={quantity:Number(product.current_stock_qty),averageCostTry:Number(product.average_cost_try)},movementId=null;
 if(!noMovement){
  const rows=(await c.req().input('p',q.BigInt,s.product_id).input('id',q.BigInt,d.id).input('movement',q.BigInt,d.kind==='count'?Number(d.result?.movementId):null).input('kind',q.NVarChar(30),d.kind).query(`SELECT * FROM dbo.stock_movements WHERE product_id=@p AND ((@kind=N'count' AND id=@movement AND source_type=N'stock_count') OR (@kind=N'uninvoiced' AND source_id=@id AND source_type=N'stock_adjustment'))`)).recordset;
  if(rows.length!==1)fail('ORIGINAL_STOCK_MOVEMENT_REQUIRED','Özgün tek stok hareketi doğrulanamadı; inceleme gerekli.');original=rows[0];
  const expected=d.kind==='count'?Number(d.result.difference):-Number(d.payload.quantity);
  if(Number(original.quantity_net)!==expected||expected===0)fail('ORIGINAL_STOCK_MISMATCH','Belge ile özgün stok farkı uyuşmuyor.');
  delta=-Number(original.quantity_net);next=stockAfterReturn({quantity:Math.abs(delta),currentStock:Number(product.current_stock_qty),currentAverageCostTry:Number(product.average_cost_try),unitCostTry:Number(original.unit_cost_try),direction:Math.sign(delta)});
  if(next.quantity<0||(!c.copyContext&&next.quantity>40)||(c.copyContext&&(!Number.isSafeInteger(next.quantity)||Math.abs(delta)>5)))fail('TEST_STOCK_SCOPE','Ters kayıt tanımlı TEST stok aralığını aşıyor.');
 }
 let goodsId=null,remaining=null;
 if(d.kind==='uninvoiced'){
  goodsId=Number(d.payload.goodsId);const g=(await c.req().input('id',q.BigInt,goodsId).input('f',q.NVarChar(20),s.flow).query("SELECT payload_json FROM dbo.test_daily_drafts WHERE id=@id AND flow=@f AND kind=N'goods' AND state=N'approved'")).recordset[0];if(!g)fail('GOODS_LINK_REQUIRED','Özgün onaylı mal kabul bağlantısı bulunamadı.');
  const p=JSON.parse(g.payload_json);let invoiced=0;if(p.invoiceId)invoiced=(await c.req().input('id',q.BigInt,p.invoiceId).input('p',q.BigInt,s.product_id).query("SELECT COALESCE(SUM(i.quantity),0) qty FROM dbo.purchase_invoices v JOIN dbo.purchase_invoice_items i ON i.purchase_invoice_id=v.id WHERE v.id=@id AND v.status=N'finalized' AND i.product_id=@p")).recordset[0].qty;
  const other=(await c.req().input('g',q.BigInt,goodsId).input('id',q.BigInt,d.id).input('f',q.NVarChar(20),s.flow).query("SELECT COALESCE(SUM(TRY_CONVERT(decimal(18,3),JSON_VALUE(payload_json,'$.quantity'))),0) qty FROM dbo.test_daily_drafts WHERE flow=@f AND kind=N'uninvoiced' AND state IN(N'pending',N'approved') AND id<>@id AND TRY_CONVERT(bigint,JSON_VALUE(payload_json,'$.goodsId'))=@g")).recordset[0].qty;
  remaining=Number(p.quantity)-Number(invoiced)-Number(other);if(remaining<0)fail('GOODS_QUANTITY_CONFLICT','Faturalı/iade miktarları kabulü aşıyor; stok değiştirilmedi.');
 }
 if(original){
  const unchangedAverage=Number.isFinite(Number(product.average_cost_try))&&Number(product.average_cost_try)===next.averageCostTry;
  await c.req().input('p',q.BigInt,s.product_id).input('qty',q.Decimal(18,3),next.quantity).input('avg',q.Decimal(18,4),next.averageCostTry).query(`UPDATE dbo.products SET current_stock_qty=@qty,${unchangedAverage?'':'average_cost_try=@avg,'}updated_at=SYSUTCDATETIME() WHERE id=@p`);
  const r=await c.req().input('p',q.BigInt,s.product_id).input('source',q.NVarChar(40),d.kind==='count'?'stock_count_cancel':'uninvoiced_return_cancel').input('id',q.BigInt,d.id).input('delta',q.Decimal(18,3),delta).input('cost',q.Decimal(18,4),original.unit_cost_try).input('avg',q.Decimal(18,4),next.averageCostTry).input('date',q.Date,date).input('actor',q.BigInt,c.actor.id).input('supplier',q.BigInt,original.supplier_id||null).input('warehouse',q.NVarChar(80),original.warehouse_name||d.payload.warehouse||'TEST-DAILY-WH').input('amount',q.Decimal(18,4),Math.abs(Number(original.amount_try||0))).query(`DECLARE @ids TABLE(id bigint);INSERT dbo.stock_movements(product_id,movement_type,source_type,source_id,quantity_in,quantity_out,quantity_net,unit_cost_try,average_cost_try_after,document_date,created_by,supplier_id,unit_price,currency_code,amount_try,warehouse_name) OUTPUT inserted.id INTO @ids VALUES(@p,CASE WHEN @delta>0 THEN N'in' ELSE N'out' END,@source,@id,CASE WHEN @delta>0 THEN @delta ELSE 0 END,CASE WHEN @delta<0 THEN -@delta ELSE 0 END,@delta,@cost,@avg,@date,@actor,@supplier,0,N'TRY',@amount,@warehouse);SELECT id FROM @ids;`);movementId=Number(r.recordset[0].id);
 }
 const r=await c.req().input('flow',q.NVarChar(20),s.flow).input('kind',q.NVarChar(30),d.kind).input('id',q.BigInt,d.id).input('original',q.BigInt,original?.id||null).input('movement',q.BigInt,movementId).input('p',q.BigInt,s.product_id).input('delta',q.Decimal(18,3),delta).input('cost',q.Decimal(18,4),original?.unit_cost_try??product.average_cost_try).input('before',q.Decimal(18,3),product.current_stock_qty).input('after',q.Decimal(18,3),next.quantity).input('avgBefore',q.Decimal(18,4),product.average_cost_try).input('avgAfter',q.Decimal(18,4),next.averageCostTry).input('reason',q.NVarChar(500),reason).input('actor',q.BigInt,c.actor.id).input('date',q.Date,date).input('approvedBy',q.BigInt,d.decided_by).input('goods',q.BigInt,goodsId).query(`DECLARE @ids TABLE(id bigint);INSERT dbo.test_stock_reversals(flow,kind,original_draft_id,original_stock_movement_id,reversal_stock_movement_id,product_id,quantity_net,unit_cost_try,stock_before,stock_after,average_cost_before,average_cost_after,reason,created_by,document_date,original_approved_by,correction_type,goods_id) OUTPUT inserted.id INTO @ids VALUES(@flow,@kind,@id,@original,@movement,@p,@delta,@cost,@before,@after,@avgBefore,@avgAfter,@reason,@actor,@date,@approvedBy,N'entry_error',@goods);SELECT r.* FROM dbo.test_stock_reversals r JOIN @ids i ON i.id=r.id;`);
 return {id:d.id,reversal:r.recordset[0],remainingReturnableQuantity:remaining,originalPreserved:true};
}
