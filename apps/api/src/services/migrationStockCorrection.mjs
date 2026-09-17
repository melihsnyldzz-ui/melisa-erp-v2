import {createHash} from 'node:crypto';

export const RUN_ID='stock-audit-3-20260917-01';
export const TARGET_DATABASE='MELISA_ERP_FULL_TEST_20260916';
export const PACKAGE_HASH='6aacc8a3567e14b127525993ad254c82a2b6d38b27f3dd2e48883aadfbbed708';
export const CORRECTION_TYPE='MIGRATION_STOCK_CORRECTION';
export const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const sameTimestamp=(a,b)=>a==null||b==null?a===b:new Date(a).getTime()===new Date(b).getTime();
const assert=(ok,code)=>{if(!ok)throw Error(code);};

// Deliberately not exposed as a general web route. Only the approved TEST runner
// can invoke this service; it cannot accept a different target or arbitrary batch.
export function validateApproval(pkg,rows,approval){
 const {packageSha256,...body}=pkg;
 assert(packageSha256===PACKAGE_HASH&&hash(body)===PACKAGE_HASH,'FROZEN_PACKAGE_CHANGED');
 assert(approval.runId===RUN_ID&&approval.packageSha256===PACKAGE_HASH&&approval.targetDatabase===TARGET_DATABASE&&approval.commitTest===true,'EXACT_TEST_APPROVAL_REQUIRED');
 assert(pkg.targetDatabase===TARGET_DATABASE&&pkg.targetServer==='Semih\\MELISADEV','WRONG_PACKAGE_TARGET');
 assert(rows.length===131&&rows.reduce((s,r)=>s+r.quantityIn,0)===12464,'SCOPE_OR_QUANTITY_CHANGED');
 assert(new Set(rows.map(r=>r.idempotencyKey)).size===131&&new Set(rows.map(r=>String(r.target.productId))).size===131,'DUPLICATE_PACKAGE_KEY');
 for(const row of rows){
  const original=pkg.candidates.find(c=>c.idempotencyKey===row.idempotencyKey);
  assert(original&&Object.keys(original).every(k=>hash(original[k])===hash(row[k])),'CANDIDATE_CHANGED');
  assert(row.quantityIn>0&&Number.isInteger(row.quantityIn)&&row.quantityOut===0&&row.unit==='ADET','INVALID_QUANTITY');
  assert(row.expectedAfterQty===row.beforeQty+row.quantityIn&&row.financialPostingAllowed===false,'FINANCIAL_EFFECT_FORBIDDEN');
  assert(row.classification==='SAFE_STOCK_CORRECTION'&&row.sourceDocuments.length>0,'SAFE_EVIDENCE_REQUIRED');
  assert(row.purchaseQty-row.stockEntryQty===row.quantityIn,'GAP_MISMATCH');
  assert(row.target.server==='Semih\\MELISADEV'&&row.target.database===TARGET_DATABASE,'WRONG_ROW_TARGET');
 }
 assert(rows.find(r=>r.source.productId===160564)?.quantityIn===3200,'MINIKIDS_DECISION_CHANGED');
 assert(rows.filter(r=>[161091,161092,161093,161094].includes(r.source.productId)).reduce((s,r)=>s+r.quantityIn,0)===1944,'PAKEL_DECISION_CHANGED');
 assert(!rows.some(r=>r.source.productId===119889),'BERCO_MUST_NOT_BE_POSTED');
 return true;
}

export async function applyApprovedStockCorrections({pool,sql,pkg,rows,approval,verifyBefore,verifyAfter}){
 validateApproval(pkg,rows,approval);
 const identity=(await pool.request().query('SELECT DB_NAME() db,@@SERVERNAME server')).recordset[0];
 assert(identity.db===TARGET_DATABASE&&identity.server.toLowerCase()==='semih\\melisadev','EXACT_TEST_TARGET_REQUIRED');
 const tx=new sql.Transaction(pool);
 await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 let committed=false;
 const request=()=>new sql.Request(tx);
 try{
  await request().query("SET XACT_ABORT ON; DECLARE @lockResult int; EXEC @lockResult=sys.sp_getapplock @Resource=N'STOCK-AUDIT-3-20260917',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0; IF @lockResult<0 THROW 51000,'CORRECTION_ALREADY_RUNNING',1;");
  const existing=(await request().query("SELECT id,product_id,quantity_in,quantity_out,source_record_key,source_payload_hash,migration_run_id FROM dbo.stock_movements WITH(UPDLOCK,HOLDLOCK) WHERE source_record_key LIKE N'STOCK-AUDIT-1/VEGA2026/F0102/D0007/%' OR migration_run_id=N'stock-audit-3-20260917-01'")).recordset;
  if(existing.length){
   assert(existing.length===131,'PARTIAL_OR_CONFLICTING_PRIOR_CORRECTION');
   for(const row of rows){const old=existing.find(x=>x.source_record_key===row.idempotencyKey);assert(old&&String(old.product_id)===String(row.target.productId)&&old.quantity_in===row.quantityIn&&old.quantity_out===0&&old.source_payload_hash===hash(row)&&old.migration_run_id===RUN_ID,'IDEMPOTENCY_PAYLOAD_CONFLICT');}
   await tx.commit();committed=true;
   return {status:'ALREADY_APPLIED',inserted:0,quantityAdded:0,runId:RUN_ID};
  }
  const before=await verifyBefore(request);
  const inserted=[];
  for(const row of rows){
   const pid=Number(row.target.productId);
   const actual=(await request().input('pid',sql.BigInt,pid).query("SELECT p.id,p.stock_code,p.brand,p.unit,p.current_stock_qty,p.is_deleted,CONVERT(varchar(18),CONVERT(varbinary(8),p.row_version),1) row_version_hex,COALESCE((SELECT SUM(sm.quantity_net) FROM dbo.inventory_effective_movements sm WHERE sm.product_id=p.id),0) effective_qty FROM dbo.products p WITH(UPDLOCK,HOLDLOCK) WHERE p.id=@pid")).recordset[0];
   assert(actual&&!actual.is_deleted&&actual.stock_code===row.target.stockCode&&actual.brand===row.brand&&actual.unit==='ADET','PRODUCT_IDENTITY_CHANGED');
   assert(actual.row_version_hex===row.target.expectedRowVersion&&actual.current_stock_qty===row.beforeQty&&actual.effective_qty===row.beforeQty,'PRODUCT_BASELINE_CHANGED');
   const mapping=(await request().input('sid',sql.Int,row.source.productId).query("SELECT target_id FROM dbo.migration_map WITH(HOLDLOCK) WHERE source_system=N'VEGA2026' AND entity_type=N'product' AND company=N'F0102' AND source_id=@sid")).recordset;
   assert(mapping.length===1&&String(mapping[0].target_id)===String(pid),'SOURCE_MAPPING_CHANGED');
   // Native quantity adjustment. Source documents are provenance only, never
   // foreign keys to invoices/party ledgers. Unknown valuation remains NULL.
   const movement=(await request()
    .input('pid',sql.BigInt,pid).input('quantity',sql.Decimal(18,3),row.quantityIn)
    .input('key',sql.NVarChar(250),row.idempotencyKey).input('run',sql.NVarChar(80),RUN_ID)
    .input('payload',sql.NVarChar(sql.MAX),JSON.stringify(row)).input('payloadHash',sql.Char(64),hash(row))
    .input('sourceProduct',sql.NVarChar(40),String(row.source.productId)).input('code',sql.NVarChar(250),row.source.stockCode)
    .input('notes',sql.NVarChar(sql.MAX),JSON.stringify({type:CORRECTION_TYPE,runId:RUN_ID,packageSha256:PACKAGE_HASH,valuationStatus:'NOT_REVALUED_EXISTING_COST_PRESERVED',sourceDocuments:row.sourceDocuments}))
    .query("INSERT INTO dbo.stock_movements(product_id,movement_type,source_type,source_id,quantity_in,quantity_out,quantity_net,unit_cost_try,average_cost_try_after,document_date,customer_id,supplier_id,created_by,unit_price,currency_code,amount_try,affects_inventory,inventory_cutover_id,source_record_key,migration_run_id,source_payload_hash,source_payload_json,source_product_id,source_stock_code,quantity_in_exact,quantity_out_exact,source_notes,warehouse_name) OUTPUT INSERTED.id VALUES(@pid,N'adjustment',N'stock_adjustment',NULL,@quantity,0,@quantity,NULL,NULL,CONVERT(date,GETDATE()),NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,@key,@run,@payloadHash,@payload,@sourceProduct,@code,@quantity,0,@notes,N'MERKEZ');")).recordset[0];
   const updated=await request().input('pid',sql.BigInt,pid).input('quantity',sql.Decimal(18,3),row.quantityIn).input('rv',sql.VarBinary(8),Buffer.from(row.target.expectedRowVersion.slice(2),'hex')).query('UPDATE dbo.products SET current_stock_qty=current_stock_qty+@quantity,updated_at=SYSUTCDATETIME() WHERE id=@pid AND row_version=@rv;');
   assert(updated.rowsAffected[0]===1,'CONCURRENT_PRODUCT_CHANGE');
   const detail={type:CORRECTION_TYPE,runId:RUN_ID,movementId:String(movement.id),packageSha256:PACKAGE_HASH,productId:pid,stockCode:row.source.stockCode,brand:row.brand,quantityIn:row.quantityIn,beforeQty:row.beforeQty,afterQty:row.expectedAfterQty,sourceDocuments:row.sourceDocuments,purchaseQty:row.purchaseQty,stockEntryQty:row.stockEntryQty,gap:row.quantityIn,idempotencyKey:row.idempotencyKey,financialEffect:0,costRecalculated:false,authority:'USER_APPROVED_STOCK_AUDIT_3'};
   await request().input('id',sql.BigInt,movement.id).input('before',sql.NVarChar(sql.MAX),JSON.stringify(actual)).input('after',sql.NVarChar(sql.MAX),JSON.stringify(detail)).input('run',sql.NVarChar(80),RUN_ID).query("INSERT INTO dbo.audit_logs(action,entity_type,entity_id,before_json,after_json,reason,source) VALUES(N'MIGRATION_STOCK_CORRECTION',N'stock_movement',@id,@before,@after,@run,N'STOCK-AUDIT-3');");
   inserted.push(detail);
  }
  // Commit only after financial fingerprints, complete inventory delta and
  // movement/audit invariants have been independently checked inside the tx.
  const verification=await verifyAfter(request,before,inserted);
  await tx.commit();committed=true;
  return {status:'COMMITTED_TEST',runId:RUN_ID,inserted:inserted.length,quantityAdded:inserted.reduce((s,r)=>s+r.quantityIn,0),movements:inserted,verification};
 }catch(error){
  // Atomic abort only for an unsuccessful batch; a successful committed TEST
  // batch is never rolled back or automatically replayed after uncertainty.
  if(!committed)try{await tx.rollback();}catch{}
  throw error;
 }
}
