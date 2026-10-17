import crypto from 'node:crypto';
import {getSqlDriver} from '../config/database.js';
import {writeAuditLog} from './auditService.js';

export function validatePilotSnapshot(snapshot) {
 if(snapshot.source!=='VEGA2026/F0102/D0007'||snapshot.sourceReadOnly!==true)throw Error('PILOT_SOURCE_GUARD');
 if(!Array.isArray(snapshot.products)||snapshot.products.length<100||snapshot.products.length>200||snapshot.customers.length!==394)throw Error('PILOT_SCOPE_GUARD');
 const codes=new Set(),barcodes=new Set(),ids=new Set();
 for(const p of snapshot.products){
  if(!Number.isSafeInteger(p.sourceId)||p.sourceId<1||!p.stockCode||p.stockCode.length>50||!p.name||p.name.length>250||!p.barcode||p.barcode.length>80||p.quantity<=0||!Number.isInteger(p.quantity)||!Number.isFinite(p.price)||p.price<=0||!['TRY','USD','EUR'].includes(p.currency)||Number(p.factor)!==1||String(p.unit).trim().toUpperCase()!=='ADET'||Number(p.taxRate)!==0||Number(p.reserved||0)!==0||p.saleProhibited)throw Error('PILOT_PRODUCT_INVALID');
  if(codes.has(p.stockCode.toUpperCase())||barcodes.has(p.barcode)||ids.has(p.sourceId))throw Error('PILOT_DUPLICATE');
  codes.add(p.stockCode.toUpperCase());barcodes.add(p.barcode);ids.add(p.sourceId);
 }
 if(snapshot.products.some(p=>p.brand!==snapshot.selection.brand))throw Error('PILOT_BRAND_GUARD');
 const customers=new Set();for(const c of snapshot.customers){if(!c.customerCode||customers.has(c.customerCode.toUpperCase())||!Number.isFinite(c.balance)||!['TRY','USD','EUR'].includes(c.currency))throw Error('PILOT_CUSTOMER_INVALID');customers.add(c.customerCode.toUpperCase());}
 return crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

export async function applyPilotData(pool,snapshot,{execute=false,expectedHash,runId='PILOT-20260913'}={}) {
 const hash=validatePilotSnapshot(snapshot);if(hash!==expectedHash)throw Error('PILOT_SNAPSHOT_HASH_MISMATCH');
 const identity=(await pool.request().query('SELECT DB_NAME() AS db')).recordset[0];
 if(identity.db!=='MELISA_ERP_V2')throw Error('PILOT_TARGET_GUARD');
 const sql=getSqlDriver(),tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 try{
  const already=(await new sql.Request(tx).input('run',sql.NVarChar(500),`%${runId}%`).query("SELECT COUNT(*) AS n FROM dbo.audit_logs WHERE action='pilot_data_import_completed' AND after_json LIKE @run")).recordset[0].n;
  if(already)throw Error('PILOT_ALREADY_APPLIED_USE_RECONCILIATION');
  const before=(await new sql.Request(tx).query('SELECT id,customer_code,name,currency_code,balance,is_active,is_deleted FROM dbo.customers WITH(UPDLOCK,HOLDLOCK) ORDER BY id')).recordset;
  const balanceChanges=[],nameDifferences=[],precisionOnlyDifferences=[];
  for(const s of snapshot.customers){
   const matches=before.filter(c=>c.customer_code.trim().toUpperCase()===s.customerCode.trim().toUpperCase());
   if(matches.length!==1)throw Error('PILOT_CUSTOMER_IDENTITY_CONFLICT');const c=matches[0];
   if(c.currency_code!==s.currency||!c.is_active||c.is_deleted)throw Error('PILOT_CUSTOMER_CURRENCY_OR_STATUS_CONFLICT');
   if(c.name.trim()!==s.customerName.trim())nameDifferences.push({id:Number(c.id),customerCode:c.customer_code,melisaName:c.name,vegaName:s.customerName,action:'PRESERVED_FOR_HUMAN_REVIEW'});
   const desired=Number(s.balance.toFixed(4));const difference=Math.abs(Number(c.balance)-desired);
   const change={id:Number(c.id),customerCode:c.customer_code,currency:c.currency_code,before:Number(c.balance),after:desired,sourceId:s.sourceId};
   // The approved audit's 44 differences used a half-cent tolerance. Preserve
   // sub-cent residuals rather than silently widening the approved update set.
   if(difference>0.005)balanceChanges.push(change);
   else if(difference>0.00005)precisionOnlyDifferences.push({...change,action:'PRESERVED_BELOW_ORIGINAL_AUDIT_TOLERANCE'});
  }
  if(balanceChanges.length!==44||nameDifferences.length!==2)throw Error(`PILOT_APPROVED_DIFFERENCE_COUNT_CHANGED:${balanceChanges.length}:${nameDifferences.length}`);
  for(const p of snapshot.products){
   const conflicts=(await new sql.Request(tx).input('code',sql.NVarChar(50),p.stockCode).input('barcode',sql.NVarChar(80),p.barcode).query('SELECT (SELECT COUNT(*) FROM dbo.products WHERE stock_code=@code)+(SELECT COUNT(*) FROM dbo.product_barcodes WHERE barcode=@barcode AND is_active=1) AS n')).recordset[0].n;
   if(conflicts)throw Error('PILOT_EXISTING_PRODUCT_PRESERVED_CONFLICT');
  }
  const report={runId,at:new Date().toISOString(),sourceAt:snapshot.at,snapshotHash:hash,target:identity.db,execute,selection:snapshot.selection,products:[],balanceChanges,nameDifferences,precisionOnlyDifferences,balanceTolerance:0.005,originalCustomers:before,valuation:'Opening quantity only; weighted cost is not imported or accepted. Do not use pilot margin as verified profit.'};
  if(!execute){await tx.rollback();return report;}
  for(const p of snapshot.products){
   // Preserve the source selling price. No foreign-cost conversion or inferred valuation.
   const purchasePrice=p.purchaseCurrency===p.currency?Number(p.currency==='TRY'?p.purchasePriceLocal:p.purchasePriceForeign):0;
   const result=await new sql.Request(tx).input('code',sql.NVarChar(50),p.stockCode).input('name',sql.NVarChar(250),p.name).input('brand',sql.NVarChar(120),p.brand).input('category',sql.NVarChar(120),p.category||null).input('currency',sql.NVarChar(3),p.currency).input('price',sql.Decimal(18,4),p.price).input('purchase',sql.Decimal(18,4),Number.isFinite(purchasePrice)&&purchasePrice>0?purchasePrice:0).input('qty',sql.Decimal(18,3),p.quantity).query("INSERT dbo.products(stock_code,name,brand,category,unit,currency_code,sales_price,purchase_price,average_cost_try,current_stock_qty,is_active,is_deleted) OUTPUT inserted.id VALUES(@code,@name,@brand,@category,N'ADET',@currency,@price,@purchase,0,@qty,1,0)");
   const id=Number(result.recordset[0].id);
   await new sql.Request(tx).input('id',sql.BigInt,id).input('barcode',sql.NVarChar(80),p.barcode).query("INSERT dbo.product_barcodes(product_id,barcode,barcode_type,is_primary,is_active) VALUES(@id,@barcode,N'primary',1,1)");
   await new sql.Request(tx).input('id',sql.BigInt,id).input('qty',sql.Decimal(18,3),p.quantity).input('date',sql.Date,new Date(snapshot.at)).input('currency',sql.NVarChar(3),p.currency).query("INSERT dbo.stock_movements(product_id,movement_type,source_type,quantity_in,quantity_out,quantity_net,unit_cost_try,average_cost_try_after,document_date,currency_code,unit_price,amount_try) VALUES(@id,N'in',N'stock_adjustment',@qty,0,@qty,0,0,@date,@currency,0,0)");
   const mapping={id,sourceId:p.sourceId,stockCode:p.stockCode,barcode:p.barcode,quantity:p.quantity,price:p.price,currency:p.currency};report.products.push(mapping);
   await writeAuditLog(new sql.Request(tx),{action:'pilot_product_opening_imported',entityType:'product',entityId:id,beforeSnapshot:null,afterSnapshot:{runId,source:snapshot.source,sourceAt:snapshot.at,...mapping,valuation:'NOT_IMPORTED',approvedBy:'Melih; locked pilot closeout instruction'}});
  }
  for(const change of balanceChanges){
   await new sql.Request(tx).input('id',sql.BigInt,change.id).input('value',sql.Decimal(18,4),change.after).query('UPDATE dbo.customers SET balance=@value,updated_at=SYSUTCDATETIME() WHERE id=@id');
   await writeAuditLog(new sql.Request(tx),{action:'pilot_customer_balance_reconciled',entityType:'customer',entityId:change.id,beforeSnapshot:{runId,balance:change.before,currency:change.currency},afterSnapshot:{runId,balance:change.after,currency:change.currency,source:snapshot.source,sourceId:change.sourceId,sourceAt:snapshot.at,reason:'Owner approved Vega opening balance as truth; identity fields preserved'}});
  }
  await writeAuditLog(new sql.Request(tx),{action:'pilot_data_import_completed',entityType:'import',entityId:null,afterSnapshot:{runId,snapshotHash:hash,products:report.products.length,balances:balanceChanges.length,namesPreserved:nameDifferences.length,source:snapshot.source,sourceAt:snapshot.at}});
  await tx.commit();return report;
 }catch(error){await tx.rollback().catch(()=>{});throw error;}
}
