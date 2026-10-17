import {getSqlDriver} from '../config/database.js';
import {fullStockHash} from './fullStockSnapshot.mjs';
import {writeAuditLog} from './auditService.js';

export async function applyFullStock(pool,snapshot,{execute=false,expectedHash,actor,runId='FULL-STOCK-CASH-20260913'}={}){
 const hash=fullStockHash(snapshot);
 if(hash!==expectedHash||snapshot.source!=='VEGA2026/F0102/D0007'||!snapshot.sourceReadOnly||snapshot.issues.length||snapshot.products.length<5000||snapshot.products.length>20000||!Number.isSafeInteger(Number(actor?.id)))throw Error('FULL_STOCK_REVIEW_GUARD');
 if(execute&&Date.now()-Date.parse(snapshot.at)>15*60*1000)throw Error('FULL_STOCK_SOURCE_STALE');
 const sql=getSqlDriver(),tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 try{
  const request=()=>new sql.Request(tx);
  const identity=(await request().query('SELECT DB_NAME() AS db')).recordset[0];if(identity.db!=='MELISA_ERP_V2')throw Error('FULL_STOCK_TARGET_GUARD');
  if((await request().input('run',sql.NVarChar(120),runId).query("SELECT id FROM dbo.audit_logs WHERE action=N'full_stock_import_completed' AND JSON_VALUE(after_json,'$.runId')=@run")).recordset.length)throw Error('FULL_STOCK_ALREADY_IMPORTED');
  // Keep the existing cards, movements and commercial history. Only add missing cards/barcodes and audited opening deltas.
  const original=(await request().query('SELECT * FROM dbo.products WITH(UPDLOCK,HOLDLOCK) ORDER BY id;SELECT * FROM dbo.product_barcodes WITH(UPDLOCK,HOLDLOCK) ORDER BY id;SELECT id,customer_code,name,currency_code,balance,is_active,is_deleted FROM dbo.customers ORDER BY id;SELECT id,currency_code,current_balance FROM dbo.finance_accounts ORDER BY id;SELECT id,status FROM dbo.sales_invoices WITH(UPDLOCK,HOLDLOCK) ORDER BY id;SELECT id,status FROM dbo.terminal_sync_queue WITH(UPDLOCK,HOLDLOCK) ORDER BY id;')).recordsets;
  const oldProducts=original[0],oldBarcodes=original[1];
  if(original[5].some(q=>!['synced','failed'].includes(q.status)))throw Error('FULL_STOCK_PENDING_TERMINAL_OPERATIONS');
  const mappingAudit=(await request().query("SELECT entity_id,after_json FROM dbo.audit_logs WHERE action=N'pilot_product_opening_imported' AND JSON_VALUE(after_json,'$.runId')=N'PILOT-20260913'")).recordset;
  const desiredCodes=new Map(snapshot.products.map(p=>[p.stockCode.toLocaleUpperCase('tr'),p]));
  if(oldProducts.some(p=>!desiredCodes.has(p.stock_code.toLocaleUpperCase('tr'))))throw Error('FULL_STOCK_EXISTING_SCOPE_CHANGED');
  const productChanges=[];
  for(const p of snapshot.products){
   const m=oldProducts.filter(x=>x.stock_code.toLocaleUpperCase('tr')===p.stockCode.toLocaleUpperCase('tr'));
   if(m.length>1)throw Error('FULL_STOCK_TARGET_DUPLICATE_CODE');
   if(m.length){const old=m[0],audit=mappingAudit.find(a=>Number(a.entity_id)===Number(old.id));if(!audit||JSON.parse(audit.after_json).sourceId!==p.sourceId||!old.is_active||old.is_deleted||old.currency_code!==p.currency)throw Error('FULL_STOCK_EXISTING_IDENTITY_CONFLICT');
    const oldCodes=oldBarcodes.filter(b=>Number(b.product_id)===Number(old.id)&&b.is_active).map(b=>b.barcode);
    if(oldCodes.some(b=>!p.barcodes.includes(b)))throw Error('FULL_STOCK_EXISTING_BARCODE_CHANGED');
    productChanges.push({id:Number(old.id),sourceId:p.sourceId,stockCode:p.stockCode,before:old,after:p});
   }
   for(const b of p.barcodes)if(oldBarcodes.some(x=>x.is_active&&x.barcode===b&&Number(x.product_id)!==Number(m[0]?.id)))throw Error('FULL_STOCK_TARGET_BARCODE_CONFLICT');
  }
  const openSales=(await request().query("SELECT COUNT(*) AS n FROM dbo.sales_invoices s JOIN dbo.sales_invoice_items i ON i.sales_invoice_id=s.id JOIN dbo.products p ON p.id=i.product_id WHERE s.status IN(N'finalized',N'draft') AND p.is_deleted=0")).recordset[0].n;
  if(openSales)throw Error('FULL_STOCK_LIVE_OR_DRAFT_SALES_EXIST');
  const report={at:new Date().toISOString(),runId,sourceAt:snapshot.at,snapshotHash:hash,execute,selection:snapshot.selection,adjustments:snapshot.adjustments,missingBarcodes:snapshot.missingBarcodes,excluded:snapshot.excluded,original:{products:oldProducts,barcodes:oldBarcodes,customers:original[2],accounts:original[3],invoices:original[4],queue:original[5]},existingChanges:productChanges,newCount:snapshot.products.length-oldProducts.length};
  if(!execute){await tx.rollback();return report;}
  const dataRequest=request().input('products',sql.NVarChar(sql.MAX),JSON.stringify(snapshot.products)).input('run',sql.NVarChar(120),runId).input('sourceAt',sql.NVarChar(40),snapshot.at).input('actor',sql.BigInt,actor.id);
  dataRequest.timeout=180000;
  const result=await dataRequest.query(`
   CREATE TABLE #FullStock(sourceId int NOT NULL,stockCode nvarchar(50) COLLATE DATABASE_DEFAULT NOT NULL,name nvarchar(250),brand nvarchar(120),category nvarchar(120),quantity decimal(18,3),price decimal(18,4),currency nvarchar(3),primaryBarcode nvarchar(80),barcodes nvarchar(max),sourceRow nvarchar(max));
   INSERT #FullStock SELECT j.sourceId,j.stockCode,j.name,j.brand,j.category,j.quantity,j.price,j.currency,j.primaryBarcode,j.barcodes,r.value
   FROM OPENJSON(@products) r CROSS APPLY OPENJSON(r.value) WITH(sourceId int,stockCode nvarchar(50),name nvarchar(250),brand nvarchar(120),category nvarchar(120),quantity decimal(18,3),price decimal(18,4),currency nvarchar(3),primaryBarcode nvarchar(80),barcodes nvarchar(max) AS JSON) j;
   IF (SELECT COUNT(*) FROM #FullStock)<>${snapshot.products.length} THROW 51000,'FULL_STOCK_STAGE_INCOMPLETE',1;
   SELECT p.id,p.stock_code,p.name,p.brand,p.category,p.currency_code,p.unit,p.sales_price,p.current_stock_qty INTO #BeforeStock FROM dbo.products p;
   INSERT dbo.products(stock_code,name,brand,category,unit,currency_code,sales_price,purchase_price,average_cost_try,current_stock_qty,is_active,is_deleted)
   SELECT s.stockCode,s.name,s.brand,s.category,N'ADET',s.currency,s.price,0,0,s.quantity,1,0 FROM #FullStock s WHERE NOT EXISTS(SELECT 1 FROM dbo.products p WHERE p.stock_code=s.stockCode);
   UPDATE p SET name=s.name,brand=s.brand,category=s.category,unit=N'ADET',sales_price=s.price,current_stock_qty=s.quantity,updated_at=SYSUTCDATETIME()
   FROM dbo.products p JOIN #FullStock s ON s.stockCode=p.stock_code JOIN #BeforeStock b ON b.id=p.id;
   INSERT dbo.product_barcodes(product_id,barcode,barcode_type,is_primary,is_active)
   SELECT p.id,b.value,CASE WHEN b.value=s.primaryBarcode THEN N'primary' ELSE N'extra' END,CASE WHEN b.value=s.primaryBarcode THEN 1 ELSE 0 END,1
   FROM #FullStock s JOIN dbo.products p ON p.stock_code=s.stockCode CROSS APPLY OPENJSON(s.barcodes) b
   WHERE NOT EXISTS(SELECT 1 FROM dbo.product_barcodes old WHERE old.product_id=p.id AND old.barcode=b.value AND old.is_active=1);
   INSERT dbo.stock_movements(product_id,movement_type,source_type,quantity_in,quantity_out,quantity_net,unit_cost_try,average_cost_try_after,document_date,currency_code,unit_price,amount_try)
   SELECT p.id,CASE WHEN s.quantity-ISNULL(b.current_stock_qty,0)>=0 THEN N'in' ELSE N'out' END,N'stock_adjustment',
   CASE WHEN s.quantity-ISNULL(b.current_stock_qty,0)>0 THEN s.quantity-ISNULL(b.current_stock_qty,0) ELSE 0 END,
   CASE WHEN s.quantity-ISNULL(b.current_stock_qty,0)<0 THEN ISNULL(b.current_stock_qty,0)-s.quantity ELSE 0 END,
   s.quantity-ISNULL(b.current_stock_qty,0),0,0,CONVERT(date,@sourceAt),s.currency,0,0
   FROM #FullStock s JOIN dbo.products p ON p.stock_code=s.stockCode LEFT JOIN #BeforeStock b ON b.id=p.id
   WHERE s.quantity-ISNULL(b.current_stock_qty,0)<>0;
   INSERT dbo.audit_logs(actor_user_id,action,entity_type,entity_id,before_json,after_json,reason,source,created_at)
   SELECT @actor,N'full_stock_product_imported',N'product',p.id,(SELECT old.* FROM #BeforeStock old WHERE old.id=p.id FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),
   (SELECT @run AS runId,N'VEGA2026/F0102/D0007' AS source,@sourceAt AS sourceAt,s.sourceId,p.id AS id,p.stock_code AS stockCode,p.current_stock_qty AS quantity,p.sales_price AS price,p.currency_code AS currency,JSON_QUERY(s.sourceRow) AS sourceAndAdaptedRecord,N'NOT_IMPORTED' AS costValuation FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),
   N'Owner approved full active stock, negative opening balances, rounding and primary unit normalization; no Vega writes',N'pilot-approved-import',SYSUTCDATETIME()
   FROM #FullStock s JOIN dbo.products p ON p.stock_code=s.stockCode;
   SELECT p.id,s.sourceId,p.stock_code,p.current_stock_qty,p.sales_price,p.currency_code FROM #FullStock s JOIN dbo.products p ON p.stock_code=s.stockCode ORDER BY p.id;
   SELECT COUNT(*) AS productCount,(SELECT COUNT(*) FROM dbo.product_barcodes WHERE is_active=1) AS barcodeCount FROM dbo.products;
  `);
  report.products=result.recordsets[0];report.counts=result.recordsets[1][0];
  if(report.products.length!==snapshot.products.length||report.counts.barcodeCount!==snapshot.selection.barcodes)throw Error('FULL_STOCK_RESULT_COUNT_MISMATCH');
  const beforeAfter=(await request().query('SELECT id,customer_code,name,currency_code,balance,is_active,is_deleted FROM dbo.customers ORDER BY id;SELECT id,currency_code,current_balance FROM dbo.finance_accounts ORDER BY id;')).recordsets;
  if(JSON.stringify(beforeAfter[0])!==JSON.stringify(original[2])||JSON.stringify(beforeAfter[1])!==JSON.stringify(original[3]))throw Error('FULL_STOCK_FINANCIAL_PRESERVATION_FAILED');
  await writeAuditLog(request(),{action:'full_stock_import_completed',entityType:'import',actor,afterSnapshot:{runId,snapshotHash:hash,sourceAt:snapshot.at,selection:snapshot.selection,adjustments:snapshot.adjustments,approvedBy:'Owner full stock cash pilot and anomaly adaptation instructions',costValuation:'NOT_IMPORTED'}});
  await tx.commit();report.status='PASS_IMPORTED';return report;
 }catch(e){await tx.rollback().catch(()=>{});throw e;}
}
