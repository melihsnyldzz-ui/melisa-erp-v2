import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sql from 'mssql/msnodesqlv8.js';
import {applyApprovedStockCorrections,validateApproval,hash,sameTimestamp,RUN_ID,TARGET_DATABASE,PACKAGE_HASH} from '../src/services/migrationStockCorrection.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const dir=path.join(root,'artifacts/stock-audit-3-20260917'),prior=path.join(root,'artifacts/stock-audit-2-20260917');
const read=(name,base=dir)=>JSON.parse(fs.readFileSync(path.join(base,name+'.json'),'utf8'));
const save=(name,data)=>fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(data,null,2));
const assert=(condition,code)=>{if(!condition)throw Error(code);};
const mode=process.argv[2];
assert(['--preflight','--commit-test','--verify','--replay-test'].includes(mode)&&process.argv.length===3,'EXPLICIT_TEST_MODE_REQUIRED');
const pkg=read('safe-test-package',prior),classes=read('classification',prior),lines=read('line-audit',prior);
assert(hash(classes)===pkg.classificationSha256,'CLASSIFICATION_CHANGED');
const approval={runId:RUN_ID,packageSha256:PACKAGE_HASH,targetDatabase:TARGET_DATABASE,commitTest:true,authority:'USER_EXPLICIT_STOCK_AUDIT_3',approvedProducts:131,approvedQuantity:12464};
const rows=pkg.candidates.map(c=>{
 const r=classes.find(x=>x.sourceProductId===c.source.productId);
 assert(r?.classification==='SAFE_STOCK_CORRECTION','NOT_SAFE');
 return {...c,classification:r.classification,brand:r.brand,purchaseQty:r.purchaseQty,stockEntryQty:r.stockEntryQty,sourceDocuments:r.purchaseLineIds.map(id=>{
  const line=lines.find(x=>x.lineId===id);assert(line?.productId===c.source.productId,'SOURCE_LINE_CHANGED');
  return {database:'VEGA2026',company:'F0103',period:'D0007',table:'F0103D0007TBLALFATHAREKET',headerId:line.headerId,lineId:id,documentNo:line.doc,sourceDate:line.date,supplierId:line.supplierId,supplierCode:line.supplierCode,supplierName:line.supplierName,purchaseQuantity:line.qty,allocatedStockEntryQuantity:line.allocatedQty,quantityGap:line.quantityGap,unit:line.unit,purchasePriceRaw:line.purchasePriceRaw,currency:line.currency,entryLinks:line.entryLinks};})};
});
validateApproval(pkg,rows,approval);
const fresh=read('evidence'),old=read('evidence',prior),source=read('movements');
assert(read('identity')[0].db==='VEGA2026'&&['ins','upd','del','alt','exe'].every(k=>read('identity')[0][k]===0),'SOURCE_READONLY_REQUIRED');
assert(fresh.purchasesStable&&fresh.movementsStable,'SOURCE_UNSTABLE');
for(const name of ['products','units','movements','purchases'])assert(fresh.queries.find(q=>q.name===name).hash===old.queries.find(q=>q.name===name).hash,'SOURCE_CHANGED_'+name);
const sourceBalance=new Map();for(const m of source)sourceBalance.set(m.productId,(sourceBalance.get(m.productId)||0)+m.inbound-m.outbound);
const protectedTables=['customers','suppliers','customer_movements','supplier_movements','party_currency_accounts','party_entities','party_source_links','finance_accounts','finance_account_movements','financial_documents','financial_document_items','cash_adjustments','cash_drawer_accounts','cash_drawers','cash_expenses','cash_session_counts','cash_sessions','cash_transfers','purchase_invoices','purchase_invoice_items','sales_invoices','sales_invoice_items','invoice_returns','invoice_return_items','inventory_cutovers','inventory_cutover_items','inventory_documents','inventory_document_items','product_prices','migration_map','terminal_sync_queue'];
const pool=await new sql.ConnectionPool({connectionString:`Driver={ODBC Driver 17 for SQL Server};Server=Semih\\MELISADEV;Database=${TARGET_DATABASE};Trusted_Connection=Yes;TrustServerCertificate=Yes;Encrypt=No`,requestTimeout:180000,connectionTimeout:15000}).connect();
const request=()=>pool.request();
async function fingerprint(req,table,where=''){
 assert(/^[a-z_]+$/.test(table),'TABLE_NAME');
 const data=(await req().query(`SELECT t.id,CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT t.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) h FROM dbo.[${table}] t ${where} ORDER BY t.id`)).recordset;
 return {count:data.length,sha256:hash(data)};
}
async function snapshot(req,phase){
 const identity=(await req().query('SELECT DB_NAME() db,@@SERVERNAME server')).recordset[0];
 assert(identity.db===TARGET_DATABASE&&identity.server.toLowerCase()==='semih\\melisadev','WRONG_TEST_IDENTITY');
 const columns=(await req().query("SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.products') AND name NOT IN ('current_stock_qty','row_version','updated_at') ORDER BY column_id")).recordset.map(c=>{assert(/^[a-z_]+$/.test(c.name),'COLUMN_NAME');return 'p.['+c.name+']';}).join(',');
 const products=(await req().query(`SELECT p.id,p.stock_code,p.current_stock_qty,CONVERT(varchar(18),CONVERT(varbinary(8),p.row_version),1) row_version_hex,p.updated_at,CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT ${columns} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) immutable_hash,COALESCE(s.qty,0) effective_qty FROM dbo.products p OUTER APPLY(SELECT SUM(quantity_net) qty FROM dbo.inventory_effective_movements sm WHERE sm.product_id=p.id)s ORDER BY p.id`)).recordset;
 const mappings=(await req().query("SELECT source_id,target_id FROM dbo.migration_map WHERE source_system=N'VEGA2026' AND entity_type=N'product' AND company=N'F0102' ORDER BY source_id,target_id")).recordset;
 const fingerprints={};for(const table of protectedTables)fingerprints[table]=await fingerprint(req,table);
 fingerprints.original_stock_movements=await fingerprint(req,'stock_movements',"WHERE t.migration_run_id IS NULL OR t.migration_run_id<>N'stock-audit-3-20260917-01'");
 const corrections=(await req().query("SELECT * FROM dbo.stock_movements WHERE migration_run_id=N'stock-audit-3-20260917-01' ORDER BY id")).recordset;
 const audits=(await req().query("SELECT id,entity_id,action,after_json FROM dbo.audit_logs WHERE source=N'STOCK-AUDIT-3' AND reason=N'stock-audit-3-20260917-01' ORDER BY id")).recordset;
 const snap={at:new Date().toISOString(),phase,identity,products,mappings,fingerprints,corrections,audits};save(phase,snap);
 console.log(JSON.stringify({phase,products:products.length,protectedTables:protectedTables.length,corrections:corrections.length}));
 return snap;
}
function baselineCheck(before){
 const byId=new Map(before.products.map(p=>[String(p.id),p]));
 for(const c of classes){const p=byId.get(String(c.testTargetId));assert(p&&p.current_stock_qty===c.testBeforeQty&&p.effective_qty===c.testBeforeQty&&p.row_version_hex===c.expectedRowVersion,'BASELINE_DRIFT_'+c.stockCode);}
 assert(before.corrections.length===0&&before.audits.length===0,'PRIOR_CORRECTION_EXISTS');
 const targetIds=new Set(rows.map(r=>String(r.target.productId)));
 const differences=before.mappings.flatMap(m=>{const p=byId.get(String(m.target_id)),vega=sourceBalance.get(m.source_id)||0;return Math.abs(p.effective_qty-vega)>1e-6?[{sourceProductId:m.source_id,targetProductId:m.target_id,stockCode:p.stock_code,vegaMovementQty:vega,testQty:p.effective_qty,difference:p.effective_qty-vega,inApprovedScope:targetIds.has(String(m.target_id))}]:[];});
 assert(!differences.some(r=>r.inApprovedScope),'APPROVED_SCOPE_SOURCE_MISMATCH');
 save('preexisting-vega-differences',differences);
 return {products:rows.length,quantity:12464,sourceUnchanged:true,scopeBaselineMatch:161,globalMappedProducts:before.mappings.length,preexistingGlobalDifferences:differences.length};
}
function verify(before,after){
 assert(hash(before.fingerprints)===hash(after.fingerprints),'PROTECTED_BUSINESS_OR_OLD_STOCK_CHANGED');
 assert(hash(before.mappings)===hash(after.mappings),'MAPPINGS_CHANGED');
 assert(before.products.length===after.products.length,'PRODUCT_COUNT_CHANGED');
 const oldById=new Map(before.products.map(p=>[String(p.id),p]));
 const approved=new Map(rows.map(r=>[String(r.target.productId),r]));
 let reduced=0,closed=0,remaining=0,unitsReduced=0,newNegative=0;const result=[];
 for(const p of after.products){const b=oldById.get(String(p.id)),r=approved.get(String(p.id));assert(b,'UNEXPECTED_PRODUCT');assert(p.immutable_hash===b.immutable_hash,'PRODUCT_NON_STOCK_CHANGED');
  const delta=r?.quantityIn||0;assert(Math.abs(p.current_stock_qty-b.current_stock_qty-delta)<1e-6&&Math.abs(p.effective_qty-b.effective_qty-delta)<1e-6,'UNEXPLAINED_STOCK_DELTA_'+p.id);
  if(!r)assert(p.row_version_hex===b.row_version_hex&&sameTimestamp(p.updated_at,b.updated_at),'OUT_OF_SCOPE_PRODUCT_CHANGED');
  if(b.effective_qty>=0&&p.effective_qty<0)newNegative++;
  if(r){if(b.effective_qty<0){reduced++;unitsReduced+=Math.min(-b.effective_qty,delta);if(p.effective_qty>=0)closed++;else remaining++;}result.push({productId:p.id,stockCode:p.stock_code,before:b.effective_qty,adjustment:delta,after:p.effective_qty});}
 }
 assert(newNegative===0,'NEW_NEGATIVE_STOCK');
 assert(after.corrections.length===131&&new Set(after.corrections.map(m=>m.source_record_key)).size===131,'MOVEMENT_COUNT_OR_DUPLICATE');
 assert(after.corrections.reduce((s,m)=>s+m.quantity_net,0)===12464,'MOVEMENT_TOTAL_MISMATCH');
 assert(after.audits.length===131&&new Set(after.audits.map(a=>String(a.entity_id))).size===131,'AUDIT_COUNT_MISMATCH');
 for(const m of after.corrections){const r=approved.get(String(m.product_id));assert(r&&m.source_record_key===r.idempotencyKey&&m.source_payload_hash===hash(r)&&m.source_payload_json===JSON.stringify(r),'MOVEMENT_PROVENANCE_MISMATCH');assert(m.movement_type==='adjustment'&&m.source_type==='stock_adjustment'&&m.quantity_in===r.quantityIn&&m.quantity_out===0&&m.affects_inventory===true,'MOVEMENT_EFFECT_MISMATCH');assert([m.source_id,m.customer_id,m.supplier_id,m.unit_cost_try,m.average_cost_try_after,m.unit_price,m.amount_try,m.currency_code,m.inventory_cutover_id].every(x=>x===null),'UNEXPECTED_FINANCIAL_OR_INVOICE_LINK');const a=after.audits.find(a=>String(a.entity_id)===String(m.id));assert(a?.action==='MIGRATION_STOCK_CORRECTION'&&JSON.parse(a.after_json).runId===RUN_ID,'AUDIT_LINK_MISSING');}
 const byId=new Map(after.products.map(p=>[String(p.id),p]));
 const reconciliation=after.mappings.map(m=>{const b=oldById.get(String(m.target_id)),p=byId.get(String(m.target_id)),vega=sourceBalance.get(m.source_id)||0,r=approved.get(String(m.target_id));return {sourceProductId:m.source_id,targetProductId:m.target_id,stockCode:p.stock_code,vegaMovementQty:vega,before:b.effective_qty,after:p.effective_qty,priorDifference:b.effective_qty-vega,approvedCorrection:r?.quantityIn||0,unexplainedNewDifference:p.effective_qty-b.effective_qty-(r?.quantityIn||0),residualVsVega:p.effective_qty-vega-(r?.quantityIn||0)};});
 const unexplained=reconciliation.filter(r=>Math.abs(r.unexplainedNewDifference)>1e-6);assert(unexplained.length===0,'UNEXPLAINED_NEW_VEGA_DIFFERENCE');
 save('applied-products',result);save('vega-reconciliation',reconciliation);
 return {status:'PASS_APPROVED_TEST_SCOPE',appliedProducts:131,totalQuantity:12464,negativeProductsReduced:reduced,negativeUnitsReduced:unitsReduced,fullyResolved:closed,stillNegativeInCorrectedScope:remaining,totalNegativeBefore:before.products.filter(p=>p.effective_qty<0).length,totalNegativeAfter:after.products.filter(p=>p.effective_qty<0).length,newNegatives:newNegative,partyEffect:0,financialEffect:0,newPurchaseInvoices:0,costFieldsChanged:0,duplicate:0,unexplainedNewStockDifferences:unexplained.length,ambiguousPreserved:classes.filter(c=>c.classification==='AMBIGUOUS').length,bercoAdjustment:0,allMappedProducts:reconciliation.length,preexistingDifferencesOutsideScope:reconciliation.filter(r=>Math.abs(r.priorDifference)>1e-6).length,residualGlobalDifferencesAfterApprovedCorrections:reconciliation.filter(r=>Math.abs(r.residualVsVega)>1e-6).length,globalVegaEquality:'FAIL_PREEXISTING_DIFFERENCES',protectedTableHashesUnchanged:true,originalMovementsUnchanged:true};
}
try{
 if(mode==='--preflight'){
  save('approved-package',{pkg,rows,approval});const before=await snapshot(request,'preflight');const check=baselineCheck(before);save('preflight-result',check);console.log(JSON.stringify(check));
 }else if(mode==='--verify'){
  const before=read('before'),after=await snapshot(request,'after-independent');const result=verify(before,after);save('verification',result);console.log(JSON.stringify(result));
 }else{
  const backup=read('backup-receipt');assert(backup.status==='PASS_VERIFIED_TEST_BACKUP'&&backup.database===TARGET_DATABASE&&backup.run===RUN_ID,'VERIFIED_TEST_BACKUP_REQUIRED');
  assert(Date.now()-new Date(backup.finishedAt)<2*60*60*1000,'FRESH_TEST_BACKUP_REQUIRED');
  assert(Date.now()-new Date(fresh.finishedAt)<30*60*1000,'FRESH_SOURCE_REQUIRED');
  if(mode==='--commit-test')assert(!fs.existsSync(path.join(dir,'commit-attempt.json')),'ATTEMPT_EXISTS_VERIFY_DO_NOT_RETRY');
  if(mode==='--commit-test')save('commit-attempt',{runId:RUN_ID,at:new Date().toISOString(),approval});
  if(mode==='--replay-test'){const committed=read('commit-receipt');assert(committed.status==='COMMITTED_TEST','REPLAY_REQUIRES_CONFIRMED_COMMIT');}
  const result=await applyApprovedStockCorrections({pool,sql,pkg,rows,approval,verifyBefore:async req=>{assert(mode==='--commit-test','REPLAY_MUST_NOT_POST');const before=await snapshot(req,'before');baselineCheck(before);return before;},verifyAfter:async(req,before)=>verify(before,await snapshot(req,'after-in-transaction'))});
  if(mode==='--replay-test')assert(result.status==='ALREADY_APPLIED'&&result.inserted===0,'REPLAY_PROTECTION_FAILED');
  save(mode==='--commit-test'?'commit-receipt':'replay-receipt',result);console.log(JSON.stringify({status:result.status,inserted:result.inserted,quantityAdded:result.quantityAdded,verification:result.verification}));
 }
}catch(e){console.error(JSON.stringify({status:'FAIL',mode,code:e.code||e.message,message:e.message}));process.exitCode=1;}
finally{await pool.close();}
