// TEST-only explicit native writer. Importing is inert; no Vega connection exists here.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {TARGET,digest,sqlJsonHash,quantity,validateIdentity,validateCaptureSource,validateBackup,fileDigest,privateEvidencePath} from './goal7-test-delta.mjs';
import {decimal,roundDecimal,requireRule as check} from './mapping-opening.mjs';
import {payloadHash} from './goal7-decision-model.mjs';
import * as version from './goal7-source-version.mjs';
export const NATIVE_SCHEMA='melisa-goal7.source-native.v1';
export const NATIVE_TABLES=Object.freeze(['products','product_prices','product_barcodes','product_source_aliases','stock_movements']);
export const NATIVE_MUTABLE=Object.freeze({products:['stock_code','name','brand','category','is_active','sales_price','purchase_price'],product_prices:['price']});
const PACKAGE='C:/Sirket/ERP/releases/CANONICAL-GOAL6-TEST-20261006-77/apps/api/package.json';
const BASE_RUN='VEGA-OPENING-TEST-20261004-06';
const BASE_HASH='36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400';
const FROZEN='C:/Sirket/ERP/evidence/VEGA-MIGRATION-TEST-20261004/private/source-capture-06/source-snapshot.json';
const hex=v=>typeof v==='string'&&/^[0-9a-f]{64}$/i.test(v);
const id=v=>typeof v==='string'&&/^[1-9]\d{0,17}$/.test(v);
const literal=v=>"N'"+String(v).replaceAll("'","''")+"'";
export const identifier=v=>{check(typeof v==='string'&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(v),'SOURCE_NATIVE_IDENTIFIER');return '['+v+']';};
export function nativeSqlType(c){
 check(c&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(c.name),'SOURCE_NATIVE_COLUMN');
 check(['decimal','numeric','nvarchar','varchar','char','int','bigint','bit','date','datetime','datetime2','uniqueidentifier'].includes(c.type),'SOURCE_NATIVE_COLUMN_TYPE');
 if(['decimal','numeric'].includes(c.type)){check(Number.isInteger(c.precision)&&Number.isInteger(c.scale)&&c.precision<=38&&c.scale<=c.precision,'SOURCE_NATIVE_DECIMAL_SCHEMA');return `decimal(${c.precision},${c.scale})`;}
 if(['nvarchar','varchar','char'].includes(c.type)){check(c.max_length===-1||Number.isInteger(c.max_length)&&c.max_length>0,'SOURCE_NATIVE_TEXT_SCHEMA');return `${c.type}(${c.max_length===-1?'max':c.type==='nvarchar'?c.max_length/2:c.max_length})`;}
 return c.type;
}
export function insertRepresentationDiagnostic(m,schema){
 check(m.targetId===null&&NATIVE_TABLES.includes(m.table),'SOURCE_NATIVE_INSERT_DIAGNOSTIC');
 return schema.filter(c=>c.table===m.table&&!c.is_identity&&!c.is_computed&&c.type!=='timestamp'&&c.name!=='created_at').filter(c=>!Object.hasOwn(m.fields,c.name)&&(c.default_definition!==null||c.is_nullable===false)).map(c=>({table:m.table,sourceKey:m.sourceKey,column:c.name,reason:c.default_definition!==null?'SQL_DEFAULT_NOT_EXPLICIT':'REQUIRED_COLUMN_MISSING'}));
}
const key=p=>`VEGA2026/F0102TBLSTOKLAR/${p.sourceId}`;
const tuple=p=>JSON.stringify([String(p.product_id),p.price_type,String(p.source_unit_id??''),Number(p.price_tier),p.currency_code]);
const barcodeKey=b=>String(b).trimEnd().toLocaleUpperCase('tr-TR');
const read=file=>JSON.parse(fs.readFileSync(privateEvidencePath(file),'utf8'));
export function sourceNativeMutations(changes,evidence,contract){
 check(contract.stockHandledSeparately===true&&id(contract.actorId),'SOURCE_NATIVE_STOCK_OWNER');
 const rows=[];
 const image=(table,targetId)=>{const found=evidence.beforeImages.filter(r=>r.table===table&&r.id===targetId);check(found.length===1,'SOURCE_NATIVE_EXACT_PREIMAGE');return found[0];};
 const add=(table,sourceKey,fields,targetId=null,productSourceKey=null)=>{
  const before=targetId?image(table,targetId):null;
  rows.push({table,sourceKey,targetId,productSourceKey,fields,beforeHash:before?.before_hash??null,beforeImageJSON:before?.before_json??null});
 };
 for(const c of changes){
  const p=c.afterSource,productId=c.nativeId;
  check(p.unit==='ADET'&&p.unitStatus==='VERIFIED_ADET_FACTOR_1'&&decimal(p.unitFactor)==='1.00000000'&&quantity(decimal(p.quantity,3))>=0n,'SOURCE_NATIVE_UNIT_STOCK');
  const sale=p.prices.filter(x=>String(x.unitSourceId)===String(p.mainUnitSourceId)&&x.tier===1);
  let currency,fields;
  if(c.change==='NEW'){
   check(sale.length===1&&['TRY','USD','EUR'].includes(sale[0].currency)&&sale[0].price!==null,'SOURCE_NATIVE_MAIN_PRICE');currency=sale[0].currency;
   check(p.purchasePrice?.currency===currency&&p.purchasePrice.price!==null,'SOURCE_NATIVE_SCALAR_PURCHASE_CURRENCY');
   fields={stock_code:p.stockCode,name:p.name,category:p.category,brand:p.brand,unit:'ADET',currency_code:currency,sales_price:roundDecimal(sale[0].price,4),purchase_price:roundDecimal(p.purchasePrice.price,4),average_cost_try:c.cost.value,current_stock_qty:decimal(p.quantity,3),is_active:p.isActive,is_deleted:false,passive_at:null,passive_reason:null,created_by:contract.actorId,updated_at:null,updated_by:null,purchase_discount_rate:'0.0000',supplier_id:null,source_record_key:key(p),migration_run_id:contract.runId,source_payload_hash:digest(p),source_payload_json:JSON.stringify(p),source_document_key:null,original_document_date:null,source_notes:'Goal7 TEST verified new source card',source_sales_currency:currency,source_purchase_currency:p.purchasePrice.currency,migration_scope_status:'IN_SCOPE'};
  }else{
   const b=JSON.parse(image('products',productId).before_json);currency=b.currency_code;
   check(b.unit==='ADET'&&b.source_record_key===key(p),'SOURCE_NATIVE_EXISTING_BINDING');
   fields=Object.fromEntries(c.masterFields.map(f=>[{stockCode:'stock_code',name:'name',brand:'brand',category:'category',isActive:'is_active'}[f],p[f]]));
   if(sale.length===1&&sale[0].currency===currency&&sale[0].price!==null)fields.sales_price=roundDecimal(sale[0].price,4);
   if(p.purchasePrice?.currency===currency&&p.purchasePrice.price!==null)fields.purchase_price=roundDecimal(p.purchasePrice.price,4);
  }
  if(c.change==='CHANGED'){
   const before=JSON.parse(image('products',productId).before_json);
   const exact=evidence.productScalars?.filter(r=>r.id===productId);check(exact?.length===1,'SOURCE_NATIVE_EXACT_SCALARS');
   for(const f of Object.keys(fields))if(['sales_price','purchase_price'].includes(f)?decimal(exact[0][f])===decimal(fields[f]):before[f]===fields[f])delete fields[f];
  }
  if(c.change==='NEW'||Object.keys(fields).length)add('products',p.sourceKey,fields,productId,p.sourceKey);
  if(c.change==='NEW'){
   add('product_source_aliases',p.sourceKey+'/ALIAS',{product_id:null,source_product_id:String(p.sourceId),stock_code:p.stockCode,source_name:p.name,source_status:null,quantity_exact:decimal(p.quantity),unit_status:p.unitStatus,source_record_key:p.sourceKey,migration_run_id:contract.runId,source_payload_hash:digest(p),source_payload_json:JSON.stringify(p),source_document_key:null,original_document_date:null,migration_scope_status:'IN_SCOPE'},null,p.sourceKey);
   if(quantity(decimal(p.quantity,3))!==0n)add('stock_movements',contract.runId+'/NEW-STOCK/'+p.sourceId,{product_id:null,movement_type:'adjustment',source_type:'stock_adjustment',source_id:null,quantity_in:decimal(p.quantity,3),quantity_out:'0.000',quantity_net:decimal(p.quantity,3),unit_cost_try:c.cost.value,average_cost_try_after:c.cost.value,document_date:contract.documentDate,customer_id:null,supplier_id:null,created_by:contract.actorId,unit_price:null,currency_code:null,amount_try:null,affects_inventory:true,inventory_cutover_id:null,source_record_key:contract.runId+'/NEW-STOCK/'+p.sourceId,migration_run_id:contract.runId,source_payload_hash:digest(p),source_payload_json:JSON.stringify({sourceKey:p.sourceKey,sourceHash:contract.sourceHash,quantity:p.quantity,kind:'NEW_CARD_OPENING'}),source_document_key:null,original_document_date:null,source_document_no:null,source_product_id:String(p.sourceId),source_stock_code:p.stockCode,quantity_in_exact:decimal(p.quantity),quantity_out_exact:'0.00000000',source_notes:'Goal7 TEST new card opening',source_warehouse:null,warehouse_name:'MERKEZ',history_effective:true},null,p.sourceKey);
  }
  for(const delta of c.prices){
   check(delta.change!=='REMOVE','SOURCE_NATIVE_PRICE_REMOVE_FORBIDDEN');const v=delta.after;
   const matches=productId?evidence.priceTuples.filter(x=>tuple(x)===tuple({product_id:productId,price_type:v.type,source_unit_id:v.unitSourceId,price_tier:v.tier,currency_code:v.currency})):[];
   check(matches.length===(delta.change==='UPDATE'?1:0),'SOURCE_NATIVE_PRICE_TUPLE_DRIFT');
   if(delta.change==='UPDATE'){check(decimal(matches[0].price)===delta.before.priceExact,'SOURCE_NATIVE_LOCAL_PRICE_CONFLICT');add('product_prices',v.sourceKey,{price:v.priceExact},String(matches[0].id),p.sourceKey);}
   else add('product_prices',v.sourceKey,{product_id:productId,price_type:v.type,price_tier:v.tier,currency_code:v.currency,price:v.priceExact,source_unit_id:v.unitSourceId,source_record_key:v.sourceKey,migration_run_id:contract.runId,source_payload_hash:digest(v),source_payload_json:JSON.stringify(v),source_document_key:null,original_document_date:null},null,p.sourceKey);
  }
  for(const barcode of new Set(p.barcodes.map(b=>b.barcode))){
   const owners=evidence.barcodeOwners.filter(b=>barcodeKey(b.barcode)===barcodeKey(barcode));
   check(owners.every(b=>productId!==null&&String(b.product_id)===productId),'SOURCE_NATIVE_BARCODE_WRONG_OWNER');
   if(owners.length){check(owners.some(b=>b.is_active===true),'SOURCE_NATIVE_INACTIVE_BARCODE');continue;}
   add('product_barcodes',p.sourceKey+'/BARCODE/'+barcode,{product_id:productId,barcode,barcode_type:'extra',is_primary:false,is_active:true,created_by:contract.actorId,updated_at:null,updated_by:null},null,p.sourceKey);
  }
 }
 return rows;
}
export function validateNativePlan(plan){
 check(plan?.schemaVersion===NATIVE_SCHEMA,'SOURCE_NATIVE_SCHEMA');const {planHash,...body}=plan;check(hex(planHash)&&digest(body)===planHash,'SOURCE_NATIVE_PLAN_HASH');
 check(/^GOAL7-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(plan.runId)&&plan.runKind==='SOURCE_SAFE','SOURCE_NATIVE_RUN');
 check(plan.server===TARGET.server&&plan.database===TARGET.database&&hex(plan.sourceHash)&&plan.stockHandledSeparately===true,'SOURCE_NATIVE_TARGET');
 check(plan.changes.length===61&&digest(plan.mutations)===plan.mutationsHash&&plan.sourceAsOf==='2026-10-07','SOURCE_NATIVE_COUNTS');
 const expected=version.planSourceVersions(plan.decisions,plan.frozenProducts);check(digest(expected.products)===digest(plan.changes),'SOURCE_NATIVE_DECISION_DRIFT');
 check(digest(sourceNativeMutations(plan.changes,plan.evidence,plan))===plan.mutationsHash,'SOURCE_NATIVE_MUTATION_DRIFT');
 check(digest(expected.counts)===digest({newProducts:49,changedProducts:12,priceInserts:241,priceUpdates:16,priceRemovals:0}),'SOURCE_NATIVE_COUNTS');
 const seen=new Set();for(const m of plan.mutations){
  check(NATIVE_TABLES.includes(m.table)&&typeof m.sourceKey==='string'&&!seen.has(m.table+'/'+m.sourceKey),'SOURCE_NATIVE_MUTATION_IDENTITY');seen.add(m.table+'/'+m.sourceKey);
  if(m.targetId){check(id(m.targetId)&&typeof m.beforeImageJSON==='string'&&sqlJsonHash(m.beforeImageJSON)===m.beforeHash.toUpperCase(),'SOURCE_NATIVE_PREIMAGE_HASH');check(Object.keys(m.fields).every(f=>(NATIVE_MUTABLE[m.table]??[]).includes(f)),'SOURCE_NATIVE_UPDATE_COLUMN');}
  else check(!Object.hasOwn(m.fields,'id'),'SOURCE_NATIVE_IDENTITY_INSERT_FORBIDDEN');
  if(!m.targetId)check(insertRepresentationDiagnostic(m,plan.evidence.schema).length===0,'SOURCE_NATIVE_INSERT_DEFAULT_REQUIRED');
  if(m.table==='stock_movements')check(plan.changes.some(c=>c.change==='NEW'&&c.sourceKey===m.productSourceKey)&&m.targetId===null,'SOURCE_NATIVE_EXISTING_STOCK_FORBIDDEN');
 }
 check(plan.guardBefore.length>0&&plan.evidence.twoPassStable===true&&hex(plan.schemaHash)&&digest(plan.evidence.schema)===plan.schemaHash,'SOURCE_NATIVE_BEFORE_EVIDENCE');
 check(plan.changes.filter(c=>c.change==='NEW'&&c.cost.value===null).length===29,'SOURCE_NATIVE_UNKNOWN_COST_COUNT');return plan;
}
const rowHash=a=>`CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT ${a}.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2)`;
// Whole-table protection excludes only exact mutation IDs, never arbitrary products.
export async function nativeProtectedFingerprints(request,plan,inserted=[]){
 const base=['sales_invoices','sales_invoice_items','purchase_invoices','purchase_invoice_items','invoice_returns','invoice_return_items','finance_accounts','finance_account_movements','cash_adjustments','cash_drawer_accounts','cash_drawers','cash_expenses','cash_session_counts','cash_sessions','cash_transfers','terminal_sync_queue','inventory_cutovers','inventory_cutover_items','inventory_documents','inventory_document_items','financial_documents','financial_document_items','document_links','stock_movements','customer_movements','supplier_movements','audit_logs','products','customers','suppliers','product_prices','product_barcodes','party_currency_accounts','product_source_aliases','party_source_links','party_entities'];
 const evidence={runs:['run_id'],records:['run_id','entity','source_key'],accepted_price_manifest:['run_id'],accepted_price_products:['product_id'],accepted_price_values:['price_id'],operation_quarantine_manifest:['run_id'],operation_quarantine_holds:['source_key'],goal7_delta_runs:['run_id'],goal7_delta_atoms:['run_id','atom_id'],goal7_delta_effects:['run_id','atom_id']};const result={};
 for(const [schema,table,keys] of [...base.map(t=>['dbo',t,['id']]),...Object.entries(evidence).map(([t,k])=>['erp_migration',t,k])]){
  const excluded=[...plan.mutations.filter(m=>m.table===table&&m.targetId).map(m=>m.targetId),...inserted.filter(m=>m.table===table).map(m=>m.id)];check(excluded.every(id),'SOURCE_NATIVE_PROTECTION_ID');
  const filter=excluded.length?` WHERE x.id NOT IN(${excluded.join(',')})`:'';
  result[schema+'.'+table]=(await request().query(`SELECT CONVERT(varchar(30),COUNT_BIG(*)) [count],CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CAST(h AS varchar(max)),'') WITHIN GROUP(ORDER BY ${keys.map(identifier).join(',')})),2) hash FROM(SELECT ${keys.map(k=>'x.'+identifier(k)).join(',')},${rowHash('x')} h FROM ${identifier(schema)}.${identifier(table)} x${filter}) hashes`)).recordset[0];
 }return result;
}
export function nativeGuardBranch(table,columns,plan){
 check(NATIVE_TABLES.includes(table),'SOURCE_NATIVE_GUARD_TABLE');
 const writable=columns.filter(c=>!c.is_identity&&!c.is_computed&&c.type!=='timestamp'&&c.name!=='created_at');
 const checks=writable.map(c=>`EXISTS(SELECT i.${identifier(c.name)} EXCEPT SELECT v.${identifier(c.name)})`).join(' OR ');
 const projection=writable.map(c=>`${identifier(c.name)} ${nativeSqlType(c)} '$.${c.name}'`).join(',');
 // Updates stage a full expected image merged from exact SQL preimage, preventing
 // every unplanned field change including cost, stock, identity and provenance.
 return `IF CONVERT(nvarchar(80),SESSION_CONTEXT(N'goal7_source_run'))=${literal(plan.runId)} BEGIN
 IF COALESCE(IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN()),0)<>1 OR OBJECT_ID(N'tempdb..#goal7_native_rows') IS NULL OR OBJECT_ID(N'tempdb..#goal7_source_guard_hashes') IS NULL OR CONVERT(char(64),SESSION_CONTEXT(N'goal7_source_plan'))<>${literal(plan.planHash)} THROW 51171,'SOURCE_NATIVE_EXACT_PLAN_REQUIRED',1;
 IF (SELECT COUNT(*) FROM sys.triggers)<>(SELECT COUNT(*) FROM #goal7_source_guard_hashes) OR EXISTS(SELECT 1 FROM #goal7_source_guard_hashes g LEFT JOIN sys.triggers t ON t.object_id=g.object_id WHERE t.object_id IS NULL OR g.hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(t.object_id)),2) OR g.disabled<>t.is_disabled OR g.first_i<>COALESCE(OBJECTPROPERTY(t.object_id,'ExecIsFirstInsertTrigger'),0) OR g.first_u<>COALESCE(OBJECTPROPERTY(t.object_id,'ExecIsFirstUpdateTrigger'),0) OR g.first_d<>COALESCE(OBJECTPROPERTY(t.object_id,'ExecIsFirstDeleteTrigger'),0) OR g.last_i<>COALESCE(OBJECTPROPERTY(t.object_id,'ExecIsLastInsertTrigger'),0) OR g.last_u<>COALESCE(OBJECTPROPERTY(t.object_id,'ExecIsLastUpdateTrigger'),0) OR g.last_d<>COALESCE(OBJECTPROPERTY(t.object_id,'ExecIsLastDeleteTrigger'),0)) THROW 51171,'SOURCE_NATIVE_TEMP_GUARD_DRIFT',1;
 IF EXISTS(SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id=d.id WHERE i.id IS NULL) THROW 51171,'SOURCE_NATIVE_DELETE_FORBIDDEN',1;
 IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN deleted d ON d.id=i.id LEFT JOIN #goal7_native_rows j ON j.table_name=${literal(table)} AND ((d.id IS NOT NULL AND j.id=i.id) OR (d.id IS NULL AND j.insert_key=${table==='product_barcodes'?"CONCAT(N'BARCODE/',i.product_id,N'/',i.barcode)":'i.source_record_key'})) OUTER APPLY OPENJSON(j.after_json) WITH(${projection}) v WHERE j.table_name IS NULL OR (d.id IS NOT NULL AND (j.before_hash<>${rowHash('d')} OR j.id IS NULL${columns.some(c=>c.name==='created_at')?' OR EXISTS(SELECT i.created_at EXCEPT SELECT d.created_at)':''})) OR (d.id IS NULL AND j.id IS NOT NULL) OR (${checks})) THROW 51171,'SOURCE_NATIVE_ROW_OUTSIDE_PLAN',1;
 RETURN;END;`;
}
export function restoreNativeGuard(g){
 check(temporaryNativeWrapper(g)&&/^CREATE\s+TRIGGER\b/i.test(g.definition),'SOURCE_NATIVE_ORIGINAL_CREATE_REQUIRED');
 const statements=[`DROP TRIGGER dbo.${identifier(g.name)}`,g.definition];for(const [op,k] of [['INSERT','i'],['UPDATE','u'],['DELETE','d']])if(g['first_'+k]||g['last_'+k])statements.push(`EXEC sys.sp_settriggerorder @triggername=${literal('dbo.'+g.name)},@order=${literal(g['first_'+k]?'First':'Last')},@stmttype=${literal(op)}`);return statements;
}
export function temporaryNativeWrapper(g){return NATIVE_TABLES.includes(g.table)&&(g.name==='test_guard_'+g.table||['c03_guard_products','c03_guard_stock','c09_guard_current_price_products','c09_guard_current_price_stock','c09_guard_native_product_prices'].includes(g.name));}
export const nativeGuardQuery=`SELECT t.name,OBJECT_NAME(t.parent_id) [table],OBJECT_DEFINITION(t.object_id) definition,${"CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(t.object_id)),2)"} hash,t.is_disabled disabled,OBJECTPROPERTY(t.object_id,'ExecIsFirstInsertTrigger') first_i,OBJECTPROPERTY(t.object_id,'ExecIsFirstUpdateTrigger') first_u,OBJECTPROPERTY(t.object_id,'ExecIsFirstDeleteTrigger') first_d,OBJECTPROPERTY(t.object_id,'ExecIsLastInsertTrigger') last_i,OBJECTPROPERTY(t.object_id,'ExecIsLastUpdateTrigger') last_u,OBJECTPROPERTY(t.object_id,'ExecIsLastDeleteTrigger') last_d FROM sys.triggers t WHERE t.parent_id IN(${NATIVE_TABLES.map(t=>'OBJECT_ID('+literal('dbo.'+t)+')').join(',')}) ORDER BY t.name`;
export const nativeSchemaQuery=`SELECT OBJECT_NAME(c.object_id) [table],c.name,TYPE_NAME(c.user_type_id) type,c.max_length,c.precision,c.scale,c.is_nullable,c.is_identity,c.is_computed,OBJECT_DEFINITION(c.default_object_id) default_definition FROM sys.columns c WHERE c.object_id IN(${NATIVE_TABLES.map(t=>'OBJECT_ID('+literal('dbo.'+t)+')').join(',')}) ORDER BY OBJECT_NAME(c.object_id),c.column_id`;
export const nativeConstraintQuery=`SELECT o.type,o.name,OBJECT_NAME(o.parent_object_id) [table],OBJECT_DEFINITION(o.object_id) definition,CONVERT(bit,COALESCE(cc.is_disabled,fk.is_disabled,0)) is_disabled,CONVERT(bit,COALESCE(cc.is_not_trusted,fk.is_not_trusted,0)) is_not_trusted FROM sys.objects o LEFT JOIN sys.check_constraints cc ON cc.object_id=o.object_id LEFT JOIN sys.foreign_keys fk ON fk.object_id=o.object_id WHERE o.parent_object_id IN(${NATIVE_TABLES.map(t=>'OBJECT_ID('+literal('dbo.'+t)+')').join(',')}) AND o.type IN(N'C',N'F',N'D',N'PK',N'UQ') ORDER BY o.type,o.name`;
export function validateNativeGuards(actual,expected){
 check(digest(actual)===digest(expected),'SOURCE_NATIVE_GUARD_DRIFT');
 for(const t of NATIVE_TABLES){if(['products','stock_movements'].includes(t))check(actual.some(g=>g.table===t&&g.name==='test_guard_'+t&&!g.disabled),'SOURCE_NATIVE_TEST_GUARD_REQUIRED');const q=actual.filter(g=>g.table===t&&g.name==='operation_quarantine_'+t);check(q.length===1&&!q[0].disabled&&['i','u','d'].every(k=>q[0]['first_'+k]===1),'SOURCE_NATIVE_QUARANTINE_FIRST_REQUIRED');}
}
export async function executeNative(planPath,mode){
 check(['--apply-test','--replay-test'].includes(mode),'SOURCE_NATIVE_EXPLICIT_MODE');const plan=validateNativePlan(read(planPath));
 const capture=validateCaptureSource(read(plan.sourceCaptureFile));check(digest(capture)===plan.sourceHash,'SOURCE_NATIVE_CAPTURE_DRIFT');
 for(const p of capture.captures){check(/^[A-Za-z0-9_-]+$/.test(p.name),'SOURCE_NATIVE_CAPTURE_PROJECTION_NAME');check(digest(read(path.join(path.dirname(plan.sourceCaptureFile),p.name+'.json')))===p.hash,'SOURCE_NATIVE_CAPTURE_PROJECTION_DRIFT');}
 const frozen=read(FROZEN);check(digest(frozen)===BASE_HASH&&digest(frozen.products)===digest(plan.frozenProducts),'SOURCE_NATIVE_BASELINE_DRIFT');
 for(const c of plan.changes){const p=capture.products.filter(p=>p.sourceKey===c.sourceKey);check(p.length===1&&payloadHash(p[0])===c.sourcePayloadHash&&digest(p[0])===digest(c.afterSource),'SOURCE_NATIVE_CURRENT_SOURCE_DRIFT');}
 const backup=read(plan.backupReceiptPath);validateBackup(backup,plan);check(await fileDigest(backup.file)===backup.sha256.toLowerCase(),'SOURCE_NATIVE_BACKUP_DRIFT');
 const sql=createRequire(PACKAGE)('mssql/msnodesqlv8.js');class Pool extends sql.ConnectionPool{request(){return new sql.Request(this);}}
 const pool=await new Pool({connectionString:`Driver={ODBC Driver 17 for SQL Server};Server=.\\MELISADEV;Database=${TARGET.database};Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=Yes`,requestTimeout:180000}).connect();let tx;
 try{
  validateIdentity((await pool.request().query("SELECT @@SERVERNAME server,DB_NAME() [database],IS_SRVROLEMEMBER(N'sysadmin') admin")).recordset[0]);
  tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);const request=()=>new sql.Request(tx),q=async s=>(await request().query(s)).recordset;
  await q("SET XACT_ABORT ON;DECLARE @l int;EXEC @l=sys.sp_getapplock @Resource=N'GOAL7-TEST-DELTA',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=10000;IF @l<0 THROW 51171,'SOURCE_NATIVE_LOCK',1;");
  const actor=await q(`SELECT u.id FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id AND r.is_active=1 JOIN dbo.permissions p ON p.role_id=u.role_id WHERE u.id=${plan.actorId} AND u.is_active=1 AND p.permission_key=N'stock.adjust' AND p.can_view=1`);check(actor.length===1,'SOURCE_NATIVE_ACTOR_PERMISSION');
  check(digest(await q(nativeSchemaQuery))===plan.schemaHash,'SOURCE_NATIVE_SCHEMA_DRIFT');const guards=await q(nativeGuardQuery);validateNativeGuards(guards,plan.guardBefore);
  check(digest(await q(nativeConstraintQuery))===digest(plan.evidence.constraints),'SOURCE_NATIVE_CONSTRAINT_DRIFT');
  check(typeof version.buildResolvedSourceVersion==='function','SOURCE_NATIVE_VERSION_RESOLVER_REQUIRED');
  const manifestExists=(await q(`SELECT OBJECT_ID(${literal(version.SOURCE_VERSION_TABLES.manifest)}) id`))[0].id;
  if(manifestExists){
   const prior=await q(`SELECT * FROM ${version.SOURCE_VERSION_TABLES.manifest} WHERE run_id=${literal(plan.runId)}`);
   if(prior.length){
    check(prior.length===1&&prior[0].source_hash===plan.sourceHash&&prior[0].plan_hash===plan.planHash&&prior[0].sealed===true&&prior[0].product_count===16671&&prior[0].price_count===64015,'SOURCE_NATIVE_RUN_PAYLOAD_CONFLICT');
    for(const table of Object.values(version.SOURCE_VERSION_TABLES)){const found=await q(`SELECT OBJECT_DEFINITION(object_id) definition,is_disabled FROM sys.triggers WHERE object_id=OBJECT_ID(${literal('erp_migration.immutable_'+table.split('.')[1])})`);check(found.length===1&&!found[0].is_disabled&&found[0].definition===version.sourceVersionImmutableSql(table),'SOURCE_NATIVE_VERSION_GUARD_DRIFT');}
    for(const [table,fields,n] of [[version.SOURCE_VERSION_TABLES.products,version.SOURCE_VERSION_PRODUCT_FIELDS,16671],[version.SOURCE_VERSION_TABLES.prices,version.SOURCE_VERSION_PRICE_FIELDS,64015]]){const proof=(await q(`SELECT COUNT_BIG(*) n,SUM(CASE WHEN binding_hash<>${version.sourceVersionRowHash('x',fields)} THEN 1 ELSE 0 END) bad FROM ${table} x WHERE version_run_id=${literal(plan.runId)}`))[0];check(BigInt(proof.n)===BigInt(n)&&BigInt(proof.bad)===0n,'SOURCE_NATIVE_REPLAY_BINDING');}
    const mismatches=(await q(`SELECT COUNT_BIG(*) n FROM ${version.SOURCE_VERSION_TABLES.prices} v LEFT JOIN dbo.product_prices p ON p.id=v.price_id WHERE v.version_run_id=${literal(plan.runId)} AND (p.id IS NULL OR v.native_row_hash<>${rowHash('p')})`))[0];check(BigInt(mismatches.n)===0n,'SOURCE_NATIVE_REPLAY_PRICE_EFFECT');
    const lineage=(await q(`SELECT COUNT_BIG(*) n FROM ${version.SOURCE_VERSION_TABLES.products} WHERE version_run_id=${literal(plan.runId)} AND lineage_run_id=${literal(plan.runId)}`))[0];check(BigInt(lineage.n)===61n,'SOURCE_NATIVE_REPLAY_LINEAGE');
    const effectRows=await q(`SELECT source_key,payload_hash,payload_json FROM ${version.SOURCE_VERSION_TABLES.records} WHERE run_id=${literal(plan.runId)} AND entity=N'native_effects' ORDER BY source_key`),effects=[];
    check(effectRows.length===plan.mutations.length,'SOURCE_NATIVE_REPLAY_EFFECT_COUNT');
    for(const r of effectRows){check(digest(r.payload_json)===r.payload_hash,'SOURCE_NATIVE_REPLAY_EFFECT_PAYLOAD');const e=JSON.parse(r.payload_json);check(e.runId===plan.runId&&e.planHash===plan.planHash&&e.sourceHash===plan.sourceHash&&id(e.id)&&NATIVE_TABLES.includes(e.table)&&sqlJsonHash(e.afterJSON)===e.afterHash,'SOURCE_NATIVE_REPLAY_EFFECT_BINDING');const m=plan.mutations.filter(m=>m.table===e.table&&m.sourceKey===e.sourceKey);check(m.length===1&&(!m[0].targetId||m[0].targetId===e.id),'SOURCE_NATIVE_REPLAY_EFFECT_SCOPE');
     const columns=plan.evidence.schema.filter(c=>c.table===e.table);const protectedFields=columns.filter(c=>e.table!=='products'||!['current_stock_qty','average_cost_try','row_version','updated_at','updated_by'].includes(c.name));
     const state=await q(`SELECT ${rowHash('x')} hash,CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT ${protectedFields.map(c=>'x.'+identifier(c.name)).join(',')} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) semantic_hash FROM dbo.${identifier(e.table)} x WHERE x.id=${e.id}`);
     check(state.length===1&&(e.table==='products'?state[0].semantic_hash===e.semanticHash:state[0].hash===e.afterHash),'SOURCE_NATIVE_REPLAY_NATIVE_EFFECT');effects.push(e);
    }
    const inserted=effects.filter(e=>!plan.mutations.find(m=>m.table===e.table&&m.sourceKey===e.sourceKey).targetId).map(e=>({table:e.table,id:e.id}));
    check(digest(await nativeProtectedFingerprints(request,plan,inserted))===digest(plan.protectedBefore),'SOURCE_NATIVE_REPLAY_PROTECTION');
    for(const c of plan.changes){const rows=await q(`SELECT CONVERT(varchar(20),p.id) id,p.stock_code,p.name,p.brand,p.category,p.unit,p.currency_code,CONVERT(varchar(100),p.current_stock_qty) qty,CONVERT(varchar(100),(SELECT COALESCE(SUM(quantity_net),0) FROM dbo.inventory_effective_movements WHERE product_id=p.id)) ledger FROM dbo.products p WHERE p.source_record_key=${literal(key(c.afterSource))}`);check(rows.length===1&&rows[0].stock_code===c.afterSource.stockCode&&rows[0].name===c.afterSource.name&&rows[0].brand===c.afterSource.brand&&rows[0].category===c.afterSource.category&&rows[0].unit==='ADET'&&quantity(rows[0].qty)===quantity(rows[0].ledger),'SOURCE_NATIVE_REPLAY_PRODUCT_LEDGER');const a=await q(`SELECT CONVERT(varchar(20),product_id) product_id,source_product_id FROM dbo.product_source_aliases WHERE product_id=${rows[0].id} OR source_product_id=${String(c.afterSource.sourceId)}`);check(a.length===1&&a[0].product_id===rows[0].id&&String(a[0].source_product_id)===String(c.afterSource.sourceId),'SOURCE_NATIVE_REPLAY_ALIAS');for(const b of new Set(c.afterSource.barcodes.map(b=>b.barcode))){const owners=await q(`SELECT CONVERT(varchar(20),product_id) product_id,is_active FROM dbo.product_barcodes WHERE barcode=${literal(b)}`);check(owners.length>0&&owners.every(o=>o.product_id===rows[0].id)&&owners.some(o=>o.is_active),'SOURCE_NATIVE_REPLAY_BARCODE');}}
    const openings=(await q(`SELECT COUNT_BIG(*) n FROM dbo.stock_movements WHERE migration_run_id=${literal(plan.runId)}`))[0];check(BigInt(openings.n)===BigInt(plan.mutations.filter(m=>m.table==='stock_movements').length),'SOURCE_NATIVE_REPLAY_OPENING_SCOPE');
    await tx.commit();return {status:'REPLAY_NOOP',runId:plan.runId,sourceHash:plan.sourceHash,planHash:plan.planHash,bindingsHash:prior[0].bindings_hash,commercialWrites:0};
   }
   throw Error('SOURCE_NATIVE_FIRST_VERSION_ONLY');
  }
  check(mode==='--apply-test','SOURCE_NATIVE_REPLAY_RUN_NOT_FOUND');
  check(digest(await nativeProtectedFingerprints(request,plan))===digest(plan.protectedBefore),'SOURCE_NATIVE_PROTECTED_BEFORE_DRIFT');
  for(const c of plan.changes){const p=c.afterSource;
   const hold=await q(`SELECT source_key FROM erp_migration.operation_quarantine_holds WITH(HOLDLOCK) WHERE entity=N'product' AND (source_id=${literal(String(p.sourceId))}${c.nativeId?' OR native_id='+c.nativeId:''})`);check(hold.length===0,'SOURCE_NATIVE_HELD');
   const aliases=await q(`SELECT CONVERT(varchar(20),a.product_id) product_id FROM dbo.product_source_aliases a WITH(UPDLOCK,HOLDLOCK) WHERE a.source_product_id=${String(p.sourceId)}${c.nativeId?' OR a.product_id='+c.nativeId:''}`);check(c.change==='NEW'?aliases.length===0:aliases.length===1&&aliases[0].product_id===c.nativeId,'SOURCE_NATIVE_ALIAS_DRIFT');
   const codes=await q(`SELECT CONVERT(varchar(20),id) id FROM dbo.products WITH(UPDLOCK,HOLDLOCK) WHERE stock_code=${literal(p.stockCode)}`);check(c.change==='NEW'?codes.length===0:codes.length===1&&codes[0].id===c.nativeId,'SOURCE_NATIVE_CODE_OWNER');
   if(c.nativeId){const state=await q(`SELECT ${rowHash('p')} hash,CONVERT(varchar(100),p.current_stock_qty) scalar_qty,CONVERT(varchar(100),(SELECT COALESCE(SUM(quantity_net),0) FROM dbo.inventory_effective_movements WHERE product_id=p.id)) ledger_qty FROM dbo.products p WITH(UPDLOCK,HOLDLOCK) WHERE p.id=${c.nativeId}`);check(state.length===1&&quantity(state[0].scalar_qty)===quantity(state[0].ledger_qty),'SOURCE_NATIVE_EXISTING_LEDGER');}
   for(const b of new Set(p.barcodes.map(b=>b.barcode))){const owners=await q(`SELECT CONVERT(varchar(20),product_id) product_id,is_active FROM dbo.product_barcodes WITH(UPDLOCK,HOLDLOCK) WHERE barcode=${literal(b)}`);check(owners.every(o=>o.product_id===c.nativeId)&&(!owners.length||owners.some(o=>o.is_active)),'SOURCE_NATIVE_BARCODE_OWNER');}
  }
  await q("CREATE TABLE #goal7_native_rows(table_name sysname NOT NULL,id bigint NULL,insert_key nvarchar(400) NULL,before_hash varchar(64) NULL,after_json nvarchar(max) NOT NULL);CREATE UNIQUE INDEX IX_goal7_native_updates ON #goal7_native_rows(table_name,id) WHERE id IS NOT NULL;CREATE UNIQUE INDEX IX_goal7_native_inserts ON #goal7_native_rows(table_name,insert_key) WHERE insert_key IS NOT NULL;");
  await request().input('r',sql.NVarChar(80),plan.runId).input('p',sql.Char(64),plan.planHash).query("EXEC sys.sp_set_session_context @key=N'goal7_source_run',@value=@r;EXEC sys.sp_set_session_context @key=N'goal7_source_plan',@value=@p;");
  for(const g of guards.filter(temporaryNativeWrapper)){check(/^CREATE\s+TRIGGER\b/i.test(g.definition)&&/AS\s+BEGIN\b/i.test(g.definition),'SOURCE_NATIVE_GUARD_FORMAT');await q(g.definition.replace(/^CREATE\s+TRIGGER/i,'ALTER TRIGGER').replace(/AS\s+BEGIN\b/i,m=>m+'\n'+nativeGuardBranch(g.table,plan.evidence.schema.filter(c=>c.table===g.table),plan)+'\n'));}
  const addedGuards=[];for(const table of NATIVE_TABLES.filter(t=>!guards.some(g=>g.table===t&&temporaryNativeWrapper(g)))){const name='goal7_source_exact_'+table;check(!(await q(`SELECT OBJECT_ID(${literal('dbo.'+name)}) id`))[0].id,'SOURCE_NATIVE_TEMP_GUARD_EXISTS');await q(`CREATE TRIGGER dbo.${identifier(name)} ON dbo.${identifier(table)} AFTER INSERT,UPDATE,DELETE AS BEGIN ${nativeGuardBranch(table,plan.evidence.schema.filter(c=>c.table===table),plan)} THROW 51171,'SOURCE_NATIVE_EXPLICIT_SESSION_REQUIRED',1;END`);addedGuards.push(name);}
  await q("SELECT t.object_id,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(t.object_id)),2) hash,t.is_disabled disabled,COALESCE(OBJECTPROPERTY(t.object_id,'ExecIsFirstInsertTrigger'),0) first_i,COALESCE(OBJECTPROPERTY(t.object_id,'ExecIsFirstUpdateTrigger'),0) first_u,COALESCE(OBJECTPROPERTY(t.object_id,'ExecIsFirstDeleteTrigger'),0) first_d,COALESCE(OBJECTPROPERTY(t.object_id,'ExecIsLastInsertTrigger'),0) last_i,COALESCE(OBJECTPROPERTY(t.object_id,'ExecIsLastUpdateTrigger'),0) last_u,COALESCE(OBJECTPROPERTY(t.object_id,'ExecIsLastDeleteTrigger'),0) last_d INTO #goal7_source_guard_hashes FROM sys.triggers t");
  const products=new Map(plan.changes.filter(c=>c.nativeId).map(c=>[c.sourceKey,c.nativeId])),inserted=[];
  for(const m of plan.mutations){
   const columns=plan.evidence.schema.filter(c=>c.table===m.table),fields={...m.fields};if(Object.hasOwn(fields,'product_id')&&fields.product_id===null){fields.product_id=products.get(m.productSourceKey);check(id(fields.product_id),'SOURCE_NATIVE_CREATED_PRODUCT_BINDING');}
   // SQL renders the merged full row; parsing SQL decimals through JS would lose
   // unchanged precision and invalidate the exact guard image.
   const names=Object.keys(fields);for(const n of names){const c=columns.find(c=>c.name===n);check(c&&!c.is_identity&&!c.is_computed,'SOURCE_NATIVE_COLUMN_BINDING');nativeSqlType(c);if(typeof fields[n]==='string'&&['nvarchar','varchar','char'].includes(c.type)&&c.max_length!==-1)check(fields[n].length<=(c.type==='nvarchar'?c.max_length/2:c.max_length),'SOURCE_NATIVE_TEXT_OVERFLOW');}
   const projection=names.map(n=>`${identifier(n)} ${nativeSqlType(columns.find(c=>c.name===n))} '$.${n}'`).join(',');
   let expectedJSON=JSON.stringify(fields);
   if(m.targetId){const expectedRows=(await request().input('j',sql.NVarChar(sql.MAX),JSON.stringify(fields)).query(`SELECT (SELECT ${columns.map(c=>(names.includes(c.name)?'v.':'x.')+identifier(c.name)).join(',')} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) after_json FROM dbo.${identifier(m.table)} x CROSS APPLY OPENJSON(@j) WITH(${projection}) v WHERE x.id=${m.targetId}`)).recordset;check(expectedRows.length===1,'SOURCE_NATIVE_UPDATE_ROW_REQUIRED');expectedJSON=expectedRows[0].after_json;}
   const insertKey=m.table==='product_barcodes'?`BARCODE/${fields.product_id}/${fields.barcode}`:fields.source_record_key;
   await request().input('t',sql.NVarChar(128),m.table).input('id',sql.BigInt,m.targetId).input('k',sql.NVarChar(400),m.targetId?null:insertKey).input('h',sql.VarChar(64),m.beforeHash).input('j',sql.NVarChar(sql.MAX),expectedJSON).query('INSERT #goal7_native_rows VALUES(@t,@id,@k,@h,@j)');
   if(m.targetId){
    const current=await q(`SELECT ${rowHash('x')} hash FROM dbo.${identifier(m.table)} x WITH(UPDLOCK,HOLDLOCK) WHERE id=${m.targetId}`);check(current.length===1&&current[0].hash===m.beforeHash.toUpperCase(),'SOURCE_NATIVE_PREIMAGE_DRIFT');
    await request().input('j',sql.NVarChar(sql.MAX),JSON.stringify(fields)).query(`UPDATE x SET ${names.map(n=>`${identifier(n)}=v.${identifier(n)}`).join(',')} FROM dbo.${identifier(m.table)} x CROSS APPLY OPENJSON(@j) WITH(${projection}) v WHERE x.id=${m.targetId}`);
   }else{const output=(await request().input('j',sql.NVarChar(sql.MAX),JSON.stringify(fields)).query(`DECLARE @made TABLE(id bigint);INSERT dbo.${identifier(m.table)}(${names.map(identifier).join(',')}) OUTPUT inserted.id INTO @made SELECT ${names.map(identifier).join(',')} FROM OPENJSON(@j) WITH(${projection});SELECT CONVERT(varchar(20),id) id FROM @made`)).recordset;check(output.length===1&&id(output[0].id),'SOURCE_NATIVE_INSERT_ID');inserted.push({table:m.table,id:output[0].id,sourceKey:m.sourceKey});if(m.table==='products')products.set(m.sourceKey,output[0].id);}
  }
  for(const g of guards.filter(temporaryNativeWrapper))for(const s of restoreNativeGuard(g))await q(s);
  for(const name of addedGuards)await q(`DROP TRIGGER dbo.${identifier(name)}`);
  validateNativeGuards(await q(nativeGuardQuery),guards);
  check(digest(await nativeProtectedFingerprints(request,plan,inserted))===digest(plan.protectedBefore),'SOURCE_NATIVE_PROTECTED_AFTER_DRIFT');
  const nativeProducts=await q(`SELECT p.* FROM dbo.products p WHERE p.id IN(${[...products.values()].join(',')})`);
  const nativePrices=await q(`SELECT CONVERT(varchar(20),p.id) id,CONVERT(varchar(20),p.product_id) product_id,p.price_type,p.price_tier,p.currency_code,CONVERT(varchar(100),p.price) price,p.source_unit_id,p.source_record_key,${rowHash('p')} __row_hash FROM dbo.product_prices p WHERE p.product_id IN(${[...products.values()].join(',')})`);
  const snapshot=version.buildResolvedSourceVersion({context:{runId:plan.runId,sourceHash:plan.sourceHash,planHash:plan.planHash,sourceAsOf:plan.sourceAsOf,productCount:16671,priceCount:64015},baselineProducts:plan.evidence.baselineProducts,baselinePrices:plan.evidence.baselinePrices,baselineRecords:plan.evidence.baselineRecords,changes:plan.changes,nativeBindings:{products:nativeProducts,prices:nativePrices}});
  check(snapshot.products.length===16671&&snapshot.prices.length===64015,'SOURCE_NATIVE_VERSION_COUNTS');
  for(const m of plan.mutations){
   const effectId=m.targetId??inserted.find(e=>e.table===m.table&&e.sourceKey===m.sourceKey)?.id;check(id(effectId),'SOURCE_NATIVE_EFFECT_ID');
   const protectedFields=plan.evidence.schema.filter(c=>c.table===m.table&&(m.table!=='products'||!['current_stock_qty','average_cost_try','row_version','updated_at','updated_by'].includes(c.name)));
   const actual=await q(`SELECT (SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) afterJSON,${rowHash('x')} afterHash,CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT ${protectedFields.map(c=>'x.'+identifier(c.name)).join(',')} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) semanticHash FROM dbo.${identifier(m.table)} x WHERE x.id=${effectId}`);check(actual.length===1&&sqlJsonHash(actual[0].afterJSON)===actual[0].afterHash,'SOURCE_NATIVE_EFFECT_SQL_HASH');
   const payload_json=JSON.stringify({runId:plan.runId,sourceHash:plan.sourceHash,planHash:plan.planHash,table:m.table,id:effectId,sourceKey:m.sourceKey,beforeHash:m.beforeHash,beforeImageJSON:m.beforeImageJSON,...actual[0]});snapshot.records.push({run_id:plan.runId,entity:'native_effects',source_key:m.table+'/'+effectId,payload_hash:digest(payload_json),payload_json});
  }
  await q(version.SOURCE_VERSION_DDL_SQL);
  for(const [table,rows] of [[version.SOURCE_VERSION_TABLES.products,snapshot.products],[version.SOURCE_VERSION_TABLES.prices,snapshot.prices],[version.SOURCE_VERSION_TABLES.records,snapshot.records]]){
   const cols=await q(`SELECT c.name,TYPE_NAME(c.user_type_id) type,c.max_length,c.precision,c.scale FROM sys.columns c WHERE c.object_id=OBJECT_ID(${literal(table)}) ORDER BY c.column_id`);
   for(let i=0;i<rows.length;i+=250){const chunk=rows.slice(i,i+250),names=Object.keys(chunk[0]);check(chunk.every(r=>digest(Object.keys(r).sort())===digest([...names].sort())),'SOURCE_NATIVE_VERSION_ROW_SHAPE');const defs=names.map(n=>`${identifier(n)} ${nativeSqlType(cols.find(c=>c.name===n))} '$.${n}'`).join(',');await request().input('j',sql.NVarChar(sql.MAX),JSON.stringify(chunk)).query(`INSERT ${table}(${names.map(identifier).join(',')}) SELECT ${names.map(identifier).join(',')} FROM OPENJSON(@j) WITH(${defs})`);}
  }
  for(const [table,fields] of [[version.SOURCE_VERSION_TABLES.products,version.SOURCE_VERSION_PRODUCT_FIELDS],[version.SOURCE_VERSION_TABLES.prices,version.SOURCE_VERSION_PRICE_FIELDS]]){
   const bad=await q(`SELECT COUNT_BIG(*) n FROM ${table} x WHERE version_run_id=${literal(plan.runId)} AND binding_hash<>${version.sourceVersionRowHash('x',fields)}`);check(BigInt(bad[0].n)===0n,'SOURCE_NATIVE_SQL_BINDING_HASH');
  }
  await request().input('r',sql.NVarChar(80),plan.runId).input('s',sql.Char(64),plan.sourceHash).input('p',sql.Char(64),plan.planHash).input('b',sql.Char(64),snapshot.bindingsHash).input('a',sql.NVarChar(40),plan.sourceAsOf).query(`INSERT ${version.SOURCE_VERSION_TABLES.manifest} VALUES(@r,@s,@p,@b,@a,16671,64015,1)`);
  for(const table of Object.values(version.SOURCE_VERSION_TABLES)){const trigger='erp_migration.immutable_'+table.split('.')[1];const found=await q(`SELECT OBJECT_DEFINITION(object_id) definition,is_disabled FROM sys.triggers WHERE object_id=OBJECT_ID(${literal(trigger)})`);if(found.length)check(!found[0].is_disabled&&found[0].definition===version.sourceVersionImmutableSql(table),'SOURCE_NATIVE_VERSION_GUARD_DRIFT');else await q(version.sourceVersionImmutableSql(table));}
  const newIds=inserted.filter(x=>x.table==='products').map(x=>x.id);const ledgers=await q(`SELECT CONVERT(varchar(20),p.id) id,CONVERT(varchar(100),p.current_stock_qty) qty,CONVERT(varchar(100),(SELECT COALESCE(SUM(quantity_net),0) FROM dbo.inventory_effective_movements WHERE product_id=p.id)) ledger FROM dbo.products p WHERE p.id IN(${newIds.join(',')})`);check(ledgers.length===49&&ledgers.every(r=>quantity(r.qty)===quantity(r.ledger)),'SOURCE_NATIVE_NEW_LEDGER');
  await q("EXEC sys.sp_set_session_context @key=N'goal7_source_run',@value=NULL;EXEC sys.sp_set_session_context @key=N'goal7_source_plan',@value=NULL;");await tx.commit();
  return {status:'COMMITTED',runId:plan.runId,planHash:plan.planHash,sourceHash:plan.sourceHash,bindingsHash:snapshot.bindingsHash,newProducts:49,changedProducts:12,typedPriceInserts:241,typedPriceUpdates:16,typedPriceRemovals:0,unknownCosts:29,verifiedCosts:20,existingStockEffects:0,inserted};
 }catch(e){if(tx)await tx.rollback().catch(()=>{});throw e;}finally{await pool.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){executeNative(process.argv[2],process.argv[3]).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(/^[A-Z0-9_]+$/.test(e.message)?e.message:'SOURCE_NATIVE_FAILED');process.exitCode=1;});}
