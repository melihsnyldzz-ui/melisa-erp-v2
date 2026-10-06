// Explicit private-plan TEST writer. Importing this module performs no I/O or SQL.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
export const TARGET=Object.freeze({server:'Semih\\MELISADEV',database:'MELISA_ERP_SIRKET_TEST_20260929_01'});
const PACKAGE='C:/Sirket/ERP/releases/CANONICAL-GOAL6-TEST-20261006-77/apps/api/package.json';
const rule=(yes,code)=>{if(!yes)throw Error(code);};
export const digest=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
export const sqlJsonHash=value=>crypto.createHash('sha256').update(value,'utf16le').digest('hex').toUpperCase();
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const id=v=>typeof v==='string'&&/^[1-9]\d{0,17}$/.test(v);
const ident=v=>{rule(/^[A-Za-z_][A-Za-z0-9_]*$/.test(v),'DELTA_IDENTIFIER_REJECTED');return '['+v+']';};
const literal=v=>"N'"+String(v).replaceAll("'","''")+"'";
export const GUARD_WRAPPERS=Object.freeze({test_guard_products:'products',test_guard_stock_movements:'stock_movements',c03_guard_products:'products',c03_guard_stock:'stock_movements',c09_guard_current_price_products:'products',c09_guard_current_price_stock:'stock_movements'});
export function quantity(value){
 rule(typeof value==='string'&&/^-?\d{1,15}(\.\d{1,3})?$/.test(value),'DELTA_QUANTITY_PRECISION');
 const [whole,fraction='']=value.replace(/^-/,'').split('.');
 return (BigInt(whole)*1000n+BigInt(fraction.padEnd(3,'0')))*(value.startsWith('-')?-1n:1n);
}
export function sourceQuantity(value){
 rule(typeof value==='string'&&/^-?\d{1,15}(\.\d{1,8})?$/.test(value),'DELTA_SOURCE_QUANTITY_PRECISION');
 const [whole,fraction='']=value.split('.');rule(/^0*$/.test(fraction.slice(3)),'DELTA_SOURCE_QUANTITY_PRECISION');return quantity(whole+(fraction?'.'+fraction.slice(0,3):''));
}
export function barcodeBindingHash(rows){
 rule(Array.isArray(rows),'DELTA_BARCODE_BINDING');
 // Only the SQL integer serialization changes across adapters. Barcode bytes,
 // unit text, factor and every remaining field retain their exact values.
 const normalized=rows.map(row=>{rule(row&&typeof row==='object'&&!Array.isArray(row)&&(typeof row.sourceId==='string'||Number.isSafeInteger(row.sourceId))&&/^[1-9]\d*$/.test(String(row.sourceId)),'DELTA_BARCODE_SOURCE_ID');return {...row,sourceId:String(row.sourceId)};});
 normalized.sort((a,b)=>BigInt(a.sourceId)<BigInt(b.sourceId)?-1:BigInt(a.sourceId)>BigInt(b.sourceId)?1:JSON.stringify(a).localeCompare(JSON.stringify(b)));
 return digest(normalized);
}
const formatted=v=>`${v<0n?'-':''}${(v<0n?-v:v)/1000n}.${String((v<0n?-v:v)%1000n).padStart(3,'0')}`;
export function effectQuantity(native,delta){return formatted(quantity(native)+quantity(delta));}
export function validateIdentity(identity){rule(identity?.server===TARGET.server&&identity?.database===TARGET.database&&Number(identity.admin)===1,'DELTA_WRONG_TEST_TARGET');}
export function validateCaptureSource(capture){
 const s=capture?.source;rule(s?.server==='DESKTOP-KSRK0EQ'&&s.database==='VEGA2026'&&s.sourceSELECTOnly===true&&s.freshLiveSource===true&&s.permissionProof?.effectiveDMLDenied===true&&s.permissionProof.tables===29&&s.permissionProof.permissions&&['admin','controlServer','dbControl','dbInsert','dbUpdate','dbDelete'].every(k=>s.permissionProof.permissions[k]===0),'DELTA_CAPTURE_SOURCE_IDENTITY');
 rule(Array.isArray(capture.captures)&&capture.captures.length===8&&capture.captures.every(c=>c.twoPassStable===true&&hex(c.hash)&&c.secondHash===c.hash),'DELTA_CAPTURE_TWO_PASS');
 return capture;
}
export function validatePlan(plan){
 rule(plan&&plan.schemaVersion==='melisa-goal7.stock-delta.v1','DELTA_PLAN_SCHEMA');
 const {planHash,...body}=plan;rule(hex(planHash)&&digest(body)===planHash.toLowerCase(),'DELTA_PLAN_HASH');
 rule(typeof plan.runId==='string'&&plan.runId.startsWith('GOAL7-')&&uuid(plan.runId.slice(6)),'DELTA_RUN_UUID');
 rule(['SOURCE_SAFE','SYNTHETIC_FIXTURE','FIXTURE_COMPENSATION'].includes(plan.runKind),'DELTA_RUN_KIND');
 rule(plan.server===TARGET.server&&plan.database===TARGET.database,'DELTA_WRONG_TEST_TARGET');
 rule(hex(plan.sourceHash)&&plan.sourceSELECTOnly===true&&plan.atomicCutoverSnapshot===false,'DELTA_SOURCE_CONTRACT');
 rule(typeof plan.actorId==='string'&&id(plan.actorId)&&/^2026-\d{2}-\d{2}$/.test(plan.documentDate),'DELTA_ACTOR_DATE');
 rule(plan.protectedBefore&&Object.keys(plan.protectedBefore).length>0&&Array.isArray(plan.guardBefore)&&plan.guardBefore.length>0,'DELTA_BEFORE_EVIDENCE_REQUIRED');
 rule(Array.isArray(plan.atoms)&&plan.atoms.length>0&&plan.atoms.length<=20000,'DELTA_ATOM_COUNT');
 const targets=new Set(),keys=new Set(),ids=new Set();
 for(const a of plan.atoms){
  rule(uuid(a.atomId)&&!ids.has(a.atomId),'DELTA_ATOM_UUID');ids.add(a.atomId);
  rule(id(a.productId)&&!targets.has(a.productId),'DELTA_DUPLICATE_TARGET');targets.add(a.productId);
  const sourceSafe=plan.runKind==='SOURCE_SAFE';
  rule(typeof a.sourceKey==='string'&&(sourceSafe?/^VEGA2026\/F0102\/TBLSTOKLAR\/[1-9]\d*$/.test(a.sourceKey):a.sourceKey==='TEST/GOAL7/STOCK/301985')&&!keys.has(a.sourceKey),'DELTA_SOURCE_KEY');keys.add(a.sourceKey);
  if(sourceSafe)rule(a.acceptedSourceKey===a.sourceKey.replace('VEGA2026/','VEGA_CAPTURE_20260930_01/'),'DELTA_ACCEPTED_SOURCE_KEY');
  else rule(plan.atoms.length===1&&a.productId==='301985'&&a.stockCode==='TEST-V70-GOODS-P'&&a.acceptedSourceKey===null&&plan.actorId==='16','DELTA_CONTROLLED_FIXTURE_IDENTITY');
  rule(typeof a.stockCode==='string'&&a.stockCode.length>0&&a.stockCode.length<=250&&hex(a.sourcePayloadHash),'DELTA_PRODUCT_IDENTITY');
  rule(a.classification==='GREEN'&&(!sourceSafe||(a.proof?.aliasCount===1&&a.proof?.reverseAliasCount===1))&&a.proof?.held===false&&a.proof?.unit==='ADET'&&a.proof?.unitFactor==='1','DELTA_NOT_SOURCE_SAFE');
  const old=sourceQuantity(a.beforeSourceQty),now=sourceQuantity(a.afterSourceQty),delta=quantity(a.deltaQty);
  rule(old>=0n&&now>=0n,'DELTA_NEGATIVE_SOURCE_STOCK');
  if(plan.runKind==='FIXTURE_COMPENSATION')rule(id(a.parentEffectId)&&delta===-quantity(a.parentDeltaQty),'DELTA_ROLLBACK_INVERSE');
  else rule(delta===now-old&&delta!==0n,'DELTA_SOURCE_EFFECT_MISMATCH');
  rule(typeof a.beforeImageJSON==='string'&&hex(a.beforeHash)&&sqlJsonHash(a.beforeImageJSON)===a.beforeHash.toUpperCase(),'DELTA_BEFORE_IMAGE_HASH');
  const before=JSON.parse(a.beforeImageJSON);rule(String(before.id)===a.productId&&before.stock_code===a.stockCode&&before.source_record_key===a.nativeSourceKey&&before.unit==='ADET','DELTA_BEFORE_IDENTITY');
  if(sourceSafe)rule(a.nativeSourceKey==='VEGA2026/F0102TBLSTOKLAR/'+a.sourceKey.split('/').at(-1),'DELTA_NATIVE_SOURCE_KEY'); // Public Vega source key, no credential; gitleaks:allow
  else rule((a.nativeSourceKey===null||typeof a.nativeSourceKey==='string')&&(delta===2000n||delta===-2000n)&&quantity(a.beforeNativeQty)>=0n&&quantity(a.beforeNativeQty)<=30000n&&quantity(effectQuantity(a.beforeNativeQty,a.deltaQty))>=0n&&quantity(effectQuantity(a.beforeNativeQty,a.deltaQty))<=30000n&&before.currency_code==='TRY'&&String(before.average_cost_try)==='60','DELTA_CONTROLLED_FIXTURE_BOUNDS');
  rule(quantity(String(before.current_stock_qty))===quantity(a.beforeNativeQty),'DELTA_BEFORE_QUANTITY');
  quantity(effectQuantity(a.beforeNativeQty,a.deltaQty));
 }
 if(plan.runKind==='FIXTURE_COMPENSATION')rule(typeof plan.parentRunId==='string'&&plan.parentRunId!==plan.runId&&uuid(plan.parentRunId.slice(6)),'DELTA_ROLLBACK_PARENT');
 for(const g of plan.guardBefore)rule(['products','stock_movements'].includes(g.table)&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(g.name)&&hex(g.hash)&&g.enabled===true,'DELTA_GUARD_EVIDENCE');
 return plan;
}
export function replayDecision(existing,plan){if(!existing)return 'APPLY';rule(existing.plan_hash.toLowerCase()===plan.planHash.toLowerCase()&&existing.source_hash.toLowerCase()===plan.sourceHash.toLowerCase()&&existing.status==='COMMITTED','DELTA_RUN_PAYLOAD_CONFLICT');return 'REPLAY_NOOP';}
export function validateBackup(receipt,plan){
 rule(receipt?.server===TARGET.server&&receipt.sourceDatabase===TARGET.database&&receipt.copyOnly===true&&receipt.checksum===true&&receipt.verifyOnlyPassed===true&&hex(receipt.sha256)&&typeof receipt.backupSetGuid==='string'&&receipt.file?.toUpperCase().includes('GOAL7'),'DELTA_GOAL7_BACKUP_REQUIRED');
 rule(receipt.sha256.toLowerCase()===plan.backupHash?.toLowerCase(),'DELTA_BACKUP_HASH');
}
export async function fileDigest(file){const sum=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))sum.update(chunk);return sum.digest('hex');}
const privateRoots=['C:/Sirket/ERP/evidence/ERP-GOAL7-20261007/sql-private','C:/Sirket/ERP/evidence/ERP-GOAL7-20261007/analysis-private'];
const frozenCapture='C:/Sirket/ERP/evidence/VEGA-MIGRATION-TEST-20261004/private/source-capture-06/source-snapshot.json';
export function privateEvidencePath(p,checkLinks=true){
 rule(typeof p==='string'&&path.isAbsolute(p),'DELTA_PRIVATE_PATH_REQUIRED');const resolved=path.resolve(p);
 rule(resolved.toLowerCase()===path.resolve(frozenCapture).toLowerCase()||privateRoots.some(root=>resolved.toLowerCase().startsWith(path.resolve(root).toLowerCase()+path.sep)),'DELTA_PRIVATE_PATH_REQUIRED');
 if(checkLinks)for(let segment=resolved;segment!==path.parse(segment).root;segment=path.dirname(segment))rule(!fs.lstatSync(segment).isSymbolicLink(),'DELTA_REPARSE_PATH_REJECTED');
 return resolved;
}
const privatePath=privateEvidencePath;
const businessTables=['sales_invoices','sales_invoice_items','purchase_invoices','purchase_invoice_items','invoice_returns','invoice_return_items','finance_accounts','finance_account_movements','cash_adjustments','cash_drawer_accounts','cash_drawers','cash_expenses','cash_session_counts','cash_sessions','cash_transfers','terminal_sync_queue','inventory_cutovers','inventory_cutover_items','inventory_documents','inventory_document_items','financial_documents','financial_document_items','document_links','stock_movements','customer_movements','supplier_movements','audit_logs','products','customers','suppliers','product_prices','product_barcodes','party_currency_accounts','product_source_aliases','party_source_links'];
const evidenceTables={runs:['run_id'],records:['run_id','entity','source_key'],accepted_price_manifest:['run_id'],accepted_price_products:['product_id'],accepted_price_values:['price_id'],operation_quarantine_manifest:['run_id'],operation_quarantine_holds:['source_key']};
export async function protectedFingerprints(request,runId,productIds=[]){
 rule(productIds.every(id),'DELTA_FINGERPRINT_IDS');const result={};
 const scopes=[...businessTables.map(table=>({schema:'dbo',table,keys:['id']})),...Object.entries(evidenceTables).map(([table,keys])=>({schema:'erp_migration',table,keys}))];
 for(const {schema,table,keys} of scopes){
  const filter=table==='stock_movements'?` WHERE ISNULL(x.migration_run_id,N'')<>${literal(runId)}`:table==='products'&&productIds.length?` WHERE x.id NOT IN(${productIds.join(',')})`:'';
  const order=keys.map(ident).join(','),inner=keys.map(k=>'x.'+ident(k)).join(',');
  const row=(await request().query(`SELECT CONVERT(varchar(30),COUNT_BIG(*)) [count],CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CAST(h AS varchar(max)),'') WITHIN GROUP(ORDER BY ${order})),2) hash FROM(SELECT ${inner},CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT x.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) h FROM ${ident(schema)}.${ident(table)} x${filter}) hashes`)).recordset[0];result[schema+'.'+table]=row;
 }return result;
}
function type(c){ident(c.name);rule(['decimal','numeric','nvarchar','varchar','char','int','bigint','bit','date','datetime','datetime2','uniqueidentifier'].includes(c.type),'DELTA_COLUMN_TYPE');if(['decimal','numeric'].includes(c.type))return `decimal(${Number(c.precision)},${Number(c.scale)})`;if(['nvarchar','varchar','char'].includes(c.type))return `${c.type}(${c.max_length===-1?'max':c.type==='nvarchar'?c.max_length/2:c.max_length})`;return c.type;}
function movement(plan,a){const delta=quantity(a.deltaQty),before=JSON.parse(a.beforeImageJSON);return {product_id:a.productId,movement_type:'adjustment',source_type:'stock_adjustment',source_id:null,quantity_in:formatted(delta>0n?delta:0n),quantity_out:formatted(delta<0n?-delta:0n),quantity_net:formatted(delta),unit_cost_try:before.average_cost_try??null,average_cost_try_after:before.average_cost_try??null,document_date:plan.documentDate,customer_id:null,supplier_id:null,created_by:plan.actorId,affects_inventory:true,inventory_cutover_id:null,source_record_key:plan.runId+'/STOCK/'+a.atomId,migration_run_id:plan.runId,source_payload_hash:a.sourcePayloadHash,source_payload_json:JSON.stringify({atomId:a.atomId,sourceKey:a.sourceKey,sourceHash:plan.sourceHash,planHash:plan.planHash,deltaQty:a.deltaQty,parentEffectId:a.parentEffectId??null}),source_product_id:plan.runKind==='SOURCE_SAFE'?a.sourceKey.split('/').at(-1):null,source_stock_code:a.stockCode,source_notes:'Goal7 TEST source delta; native local effects preserved',warehouse_name:'MERKEZ'};}
export function guardBranch(table,columns,plan){
 rule(['products','stock_movements'].includes(table),'DELTA_GUARD_TABLE');columns.forEach(c=>ident(c.name));
 const unchanged=columns.filter(c=>!['row_version','current_stock_qty'].includes(c.name)).map(c=>ident(c.name));
 const insertion=columns.filter(c=>!['id','created_at','row_version'].includes(c.name)).map(c=>`(EXISTS(SELECT 1 FROM OPENJSON(j.after_json) z WHERE z.[key]=${literal(c.name)}) AND EXISTS(SELECT i.${ident(c.name)} EXCEPT SELECT CONVERT(${type(c)},JSON_VALUE(j.after_json,${literal('$.'+c.name)})))) OR (NOT EXISTS(SELECT 1 FROM OPENJSON(j.after_json) z WHERE z.[key]=${literal(c.name)}) AND i.${ident(c.name)} IS NOT NULL)`).join(' OR ');
 return `IF CONVERT(nvarchar(80),SESSION_CONTEXT(N'goal7_delta_run'))=${literal(plan.runId)} BEGIN
 IF COALESCE(IS_SRVROLEMEMBER(N'sysadmin',ORIGINAL_LOGIN()),0)<>1 OR OBJECT_ID(N'tempdb..#goal7_products') IS NULL OR OBJECT_ID(N'tempdb..#goal7_inserts') IS NULL OR OBJECT_ID(N'tempdb..#goal7_plan') IS NULL OR OBJECT_ID(N'tempdb..#goal7_guard_hashes') IS NULL THROW 51170,'DELTA_EXACT_PLAN_REQUIRED',1;
 IF NOT EXISTS(SELECT 1 FROM #goal7_plan WHERE run_id=${literal(plan.runId)} AND source_hash=${literal(plan.sourceHash)} AND plan_hash=${literal(plan.planHash)}) THROW 51170,'DELTA_EXACT_PLAN_REQUIRED',1;
 IF(SELECT COUNT(*) FROM #goal7_guard_hashes)<>(SELECT COUNT(*) FROM sys.triggers WHERE parent_id IN(OBJECT_ID(N'dbo.products'),OBJECT_ID(N'dbo.stock_movements'))) OR EXISTS(SELECT 1 FROM #goal7_guard_hashes g LEFT JOIN sys.triggers t ON t.object_id=g.object_id WHERE t.object_id IS NULL OR t.name<>g.name OR CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(t.object_id)),2)<>g.hash OR t.is_disabled<>g.disabled OR OBJECTPROPERTY(t.object_id,'ExecIsFirstInsertTrigger')<>g.first_i OR OBJECTPROPERTY(t.object_id,'ExecIsFirstUpdateTrigger')<>g.first_u OR OBJECTPROPERTY(t.object_id,'ExecIsFirstDeleteTrigger')<>g.first_d OR OBJECTPROPERTY(t.object_id,'ExecIsLastInsertTrigger')<>g.last_i OR OBJECTPROPERTY(t.object_id,'ExecIsLastUpdateTrigger')<>g.last_u OR OBJECTPROPERTY(t.object_id,'ExecIsLastDeleteTrigger')<>g.last_d) THROW 51170,'DELTA_TEMP_GUARD_DRIFT',1;
 IF EXISTS(SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id=d.id WHERE i.id IS NULL) THROW 51170,'DELTA_DELETE_FORBIDDEN',1;
 ${table==='products'?`IF (SELECT COUNT(*) FROM inserted)<>(SELECT COUNT(*) FROM deleted) OR EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.id=i.id LEFT JOIN #goal7_products j ON j.id=i.id WHERE j.id IS NULL OR j.before_hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT d.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) OR i.current_stock_qty<>j.after_qty OR EXISTS(SELECT ${unchanged.map(c=>'i.'+c).join(',')} EXCEPT SELECT ${unchanged.map(c=>'d.'+c).join(',')})) THROW 51170,'DELTA_UPDATE_OUTSIDE_PLAN',1;`:`IF EXISTS(SELECT 1 FROM deleted) OR EXISTS(SELECT 1 FROM inserted i LEFT JOIN #goal7_inserts j ON j.source_key=i.source_record_key WHERE j.source_key IS NULL OR (${insertion})) THROW 51170,'DELTA_INSERT_OUTSIDE_PLAN',1;`}
 RETURN; END;`;
}
const ddl=`CREATE TABLE erp_migration.goal7_delta_runs(run_id nvarchar(80) PRIMARY KEY,source_hash char(64) NOT NULL,plan_hash char(64) NOT NULL,run_kind nvarchar(30) NOT NULL,parent_run_id nvarchar(80) NULL,status nvarchar(20) NOT NULL CHECK(status=N'COMMITTED'),receipt_json nvarchar(max) NOT NULL);
CREATE TABLE erp_migration.goal7_delta_atoms(run_id nvarchar(80) NOT NULL,atom_id uniqueidentifier NOT NULL,source_key nvarchar(250) NOT NULL,product_id bigint NOT NULL,payload_hash char(64) NOT NULL,before_hash char(64) NOT NULL,before_json nvarchar(max) NOT NULL,delta_qty decimal(18,3) NOT NULL,source_capture_hash char(64) NOT NULL,before_source_qty decimal(18,3) NOT NULL,after_source_qty decimal(18,3) NOT NULL,source_effect_key nvarchar(400) NOT NULL UNIQUE,PRIMARY KEY(run_id,atom_id),UNIQUE(run_id,product_id));
CREATE TABLE erp_migration.goal7_delta_effects(run_id nvarchar(80) NOT NULL,atom_id uniqueidentifier NOT NULL,effect_id bigint NOT NULL UNIQUE,parent_effect_id bigint NULL,after_hash char(64) NOT NULL,PRIMARY KEY(run_id,atom_id));CREATE UNIQUE INDEX IX_goal7_compensated_effect ON erp_migration.goal7_delta_effects(parent_effect_id) WHERE parent_effect_id IS NOT NULL;`;
const deltaTables=['goal7_delta_runs','goal7_delta_atoms','goal7_delta_effects'];
const immutableDefinition=t=>`CREATE TRIGGER erp_migration.${ident('immutable_'+t)} ON erp_migration.${ident(t)} AFTER INSERT,UPDATE,DELETE AS BEGIN IF EXISTS(SELECT 1 FROM deleted) OR OBJECT_ID(N'tempdb..#goal7_products') IS NULL OR EXISTS(SELECT 1 FROM inserted i WHERE i.run_id<>CONVERT(nvarchar(80),SESSION_CONTEXT(N'goal7_delta_run'))) OR SESSION_CONTEXT(N'goal7_delta_run') IS NULL THROW 51170,'DELTA_EVIDENCE_IMMUTABLE',1;END;`;
export function restoreGuardStatements(g){
 rule(GUARD_WRAPPERS[g.name]===g.table&&/^CREATE\s+TRIGGER\b/i.test(g.definition),'DELTA_ORIGINAL_CREATE_GUARD_REQUIRED');
 const statements=[`DROP TRIGGER dbo.${ident(g.name)}`,g.definition];
 for(const [op,key] of [['INSERT','i'],['UPDATE','u'],['DELETE','d']]){const order=g['first_'+key]?'First':g['last_'+key]?'Last':null;if(order)statements.push(`EXEC sys.sp_settriggerorder @triggername=${literal('dbo.'+g.name)},@order=${literal(order)},@stmttype=${literal(op)}`);}
 return statements;
}
export async function executeDelta(planPath,mode){
 rule(['--apply-test','--rollback-test'].includes(mode),'DELTA_EXPLICIT_MODE_REQUIRED');
 const plan=validatePlan(JSON.parse(fs.readFileSync(privatePath(planPath),'utf8')));
 rule(mode!=='--rollback-test'||plan.runKind==='FIXTURE_COMPENSATION','DELTA_NATURAL_ROLLBACK_FORBIDDEN');
 rule(mode!=='--apply-test'||plan.runKind!=='FIXTURE_COMPENSATION','DELTA_ROLLBACK_MODE_REQUIRED');
 const capture=JSON.parse(fs.readFileSync(privatePath(plan.sourceCaptureFile),'utf8'));rule(digest(capture)===plan.sourceHash,'DELTA_SOURCE_CAPTURE_DRIFT');
 if(plan.runKind==='SOURCE_SAFE'){
  validateCaptureSource(capture);for(const c of capture.captures){rule(/^[A-Za-z0-9_-]+$/.test(c.name),'DELTA_CAPTURE_FILE_IDENTIFIER');const rows=JSON.parse(fs.readFileSync(privateEvidencePath(path.join(path.dirname(plan.sourceCaptureFile),c.name+'.json')),'utf8'));rule(digest(rows)===c.hash,'DELTA_CAPTURE_PROJECTION_HASH');}
  const frozen=JSON.parse(fs.readFileSync(privateEvidencePath(frozenCapture),'utf8'));rule(digest(frozen)==='36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400','DELTA_ACCEPTED_CAPTURE_DRIFT');
  const owners=new Map(),codes=new Map();for(const p of capture.products){codes.set(p.stockCode,(codes.get(p.stockCode)??0)+1);for(const bc of p.barcodes??[]){const k=String(bc.barcode).trimEnd().toLocaleUpperCase('tr-TR'),set=owners.get(k)??new Set();set.add(String(p.sourceId));owners.set(k,set);}}
  for(const a of plan.atoms){const p=capture.products?.filter(p=>p.sourceKey===a.sourceKey),b=frozen.products?.filter(p=>p.sourceKey===a.acceptedSourceKey);rule(p?.length===1&&digest(p[0])===a.sourcePayloadHash&&sourceQuantity(p[0].quantity)===sourceQuantity(a.afterSourceQty)&&p[0].unitStatus==='VERIFIED_ADET_FACTOR_1'&&b?.length===1&&sourceQuantity(b[0].quantity)===sourceQuantity(a.beforeSourceQty)&&p[0].stockCode===a.stockCode&&b[0].stockCode===a.stockCode&&String(p[0].mainUnitSourceId)===String(b[0].mainUnitSourceId)&&codes.get(p[0].stockCode)===1&&barcodeBindingHash(p[0].barcodes)===barcodeBindingHash(b[0].barcodes)&&p[0].barcodes.every(bc=>owners.get(String(bc.barcode).trimEnd().toLocaleUpperCase('tr-TR'))?.size===1),'DELTA_CAPTURE_ATOM_MISMATCH');}
 }
 const backup=JSON.parse(fs.readFileSync(privatePath(plan.backupReceiptPath),'utf8'));validateBackup(backup,plan);rule(await fileDigest(backup.file)===backup.sha256.toLowerCase(),'DELTA_BACKUP_FILE_DRIFT');
 const sql=createRequire(PACKAGE)('mssql/msnodesqlv8.js');class Pool extends sql.ConnectionPool{request(){return new sql.Request(this);}}
 const pool=await new Pool({connectionString:`Driver={ODBC Driver 17 for SQL Server};Server=.\\MELISADEV;Database=${TARGET.database};Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=Yes`,requestTimeout:180000}).connect();let tx;
 try{
  validateIdentity((await pool.request().query("SELECT @@SERVERNAME server,DB_NAME() [database],IS_SRVROLEMEMBER(N'sysadmin') admin")).recordset[0]);
  tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);const request=()=>new sql.Request(tx),q=async s=>(await request().query(s)).recordset;
  await q(`SET XACT_ABORT ON;DECLARE @l int;EXEC @l=sys.sp_getapplock @Resource=N'GOAL7-TEST-DELTA',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=10000;IF @l<0 THROW 51170,'DELTA_LOCK_FAILED',1;`);
  const actor=(await request().input('a',sql.BigInt,plan.actorId).query("SELECT u.id FROM dbo.users u JOIN dbo.roles r ON r.id=u.role_id AND r.is_active=1 JOIN dbo.permissions p ON p.role_id=u.role_id WHERE u.id=@a AND u.is_active=1 AND p.permission_key=N'stock.adjust' AND p.can_view=1")).recordset;rule(actor.length===1,'DELTA_ACTOR_STOCK_PERMISSION');
  const installed=(await q("SELECT OBJECT_ID(N'erp_migration.goal7_delta_runs',N'U') id"))[0].id;
  if(installed)for(const t of deltaTables){const rows=await q(`SELECT OBJECT_DEFINITION(object_id) definition,is_disabled FROM sys.triggers WHERE object_id=OBJECT_ID(${literal('erp_migration.immutable_'+t)})`);rule(rows.length===1&&rows[0].is_disabled===false&&rows[0].definition===immutableDefinition(t),'DELTA_IMMUTABLE_GUARD_DRIFT');}
  if(installed){const existing=(await request().input('r',sql.NVarChar(80),plan.runId).query('SELECT plan_hash,source_hash,status,receipt_json FROM erp_migration.goal7_delta_runs WHERE run_id=@r')).recordset[0];if(replayDecision(existing,plan)==='REPLAY_NOOP'){
   const actual=(await request().input('r',sql.NVarChar(80),plan.runId).query('SELECT CONVERT(varchar(36),a.atom_id) atom_id,a.product_id,CONVERT(varchar(100),a.delta_qty) atom_delta,CONVERT(varchar(100),m.quantity_net) movement_delta,m.source_record_key,m.migration_run_id,m.source_payload_hash,a.payload_hash,a.before_json,a.before_hash,e.effect_id FROM erp_migration.goal7_delta_atoms a JOIN erp_migration.goal7_delta_effects e ON e.run_id=a.run_id AND e.atom_id=a.atom_id LEFT JOIN dbo.stock_movements m ON m.id=e.effect_id WHERE a.run_id=@r')).recordset;
   rule(actual.length===plan.atoms.length&&actual.every(x=>{const a=plan.atoms.find(p=>p.atomId.toLowerCase()===x.atom_id.toLowerCase());return a&&String(x.product_id)===a.productId&&quantity(x.atom_delta)===quantity(a.deltaQty)&&x.movement_delta!==null&&quantity(x.movement_delta)===quantity(a.deltaQty)&&x.migration_run_id===plan.runId&&x.source_record_key===plan.runId+'/STOCK/'+a.atomId&&x.source_payload_hash===a.sourcePayloadHash&&x.payload_hash===a.sourcePayloadHash&&x.before_json===a.beforeImageJSON&&x.before_hash===a.beforeHash;}),'DELTA_REPLAY_EFFECT_DRIFT');
   const total=(await request().input('r',sql.NVarChar(80),plan.runId).query('SELECT COUNT_BIG(*) n FROM dbo.stock_movements WHERE migration_run_id=@r')).recordset[0];rule(Number(total.n)===plan.atoms.length,'DELTA_REPLAY_EXTRA_EFFECT');await tx.commit();return {status:'REPLAY_NOOP',runId:plan.runId,commercialWrites:0,effectsVerified:actual.length};}}
  if(plan.runKind==='FIXTURE_COMPENSATION'){
   rule(installed,'DELTA_PARENT_NOT_FOUND');const parent=(await request().input('r',sql.NVarChar(80),plan.parentRunId).query('SELECT run_kind,status FROM erp_migration.goal7_delta_runs WHERE run_id=@r')).recordset[0];rule(parent?.run_kind==='SYNTHETIC_FIXTURE'&&parent.status==='COMMITTED','DELTA_NATURAL_ROLLBACK_FORBIDDEN');
   for(const a of plan.atoms){const row=(await request().input('r',sql.NVarChar(80),plan.parentRunId).input('e',sql.BigInt,a.parentEffectId).query('SELECT a.product_id,CONVERT(varchar(100),a.delta_qty) delta_qty,CONVERT(varchar(100),m.quantity_net) native_delta,m.product_id native_product_id,m.migration_run_id,m.source_record_key,CONVERT(varchar(36),a.atom_id) atom_id FROM erp_migration.goal7_delta_effects e JOIN erp_migration.goal7_delta_atoms a ON a.run_id=e.run_id AND a.atom_id=e.atom_id LEFT JOIN dbo.stock_movements m ON m.id=e.effect_id WHERE e.run_id=@r AND e.effect_id=@e')).recordset[0];rule(row&&String(row.product_id)===a.productId&&quantity(row.delta_qty)===quantity(a.parentDeltaQty)&&String(row.native_product_id)===a.productId&&row.native_delta!==null&&quantity(row.native_delta)===quantity(a.parentDeltaQty)&&row.migration_run_id===plan.parentRunId&&row.source_record_key?.toLowerCase()===(plan.parentRunId+'/STOCK/'+row.atom_id).toLowerCase(),'DELTA_PARENT_EFFECT_MISMATCH');}
  }
  if(installed&&plan.runKind==='SOURCE_SAFE')for(const a of plan.atoms){const prior=(await request().input('p',sql.BigInt,a.productId).query("SELECT TOP(1) a.run_id FROM erp_migration.goal7_delta_atoms a JOIN erp_migration.goal7_delta_runs r ON r.run_id=a.run_id WHERE a.product_id=@p AND r.run_kind=N'SOURCE_SAFE' AND r.status=N'COMMITTED'")).recordset;rule(prior.length===0,'DELTA_SOURCE_BASIS_ALREADY_ADVANCED');}
  rule(digest(await protectedFingerprints(request,plan.runId,plan.atoms.map(a=>a.productId)))===digest(plan.protectedBefore),'DELTA_PROTECTED_BEFORE_DRIFT');
  const original=(await q("SELECT t.name,OBJECT_NAME(t.parent_id) [table],OBJECT_DEFINITION(t.object_id) definition,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(t.object_id)),2) hash,t.is_disabled disabled,OBJECTPROPERTY(t.object_id,'ExecIsFirstInsertTrigger') first_i,OBJECTPROPERTY(t.object_id,'ExecIsFirstUpdateTrigger') first_u,OBJECTPROPERTY(t.object_id,'ExecIsFirstDeleteTrigger') first_d,OBJECTPROPERTY(t.object_id,'ExecIsLastInsertTrigger') last_i,OBJECTPROPERTY(t.object_id,'ExecIsLastUpdateTrigger') last_u,OBJECTPROPERTY(t.object_id,'ExecIsLastDeleteTrigger') last_d FROM sys.triggers t WHERE t.parent_id IN(OBJECT_ID(N'dbo.products'),OBJECT_ID(N'dbo.stock_movements')) ORDER BY t.name"));
  rule(original.length===plan.guardBefore.length&&original.every(g=>{const p=plan.guardBefore.find(x=>x.name===g.name&&x.table===g.table);return p&&!g.disabled&&p.hash.toUpperCase()===g.hash;}),'DELTA_GUARD_DRIFT');
  rule(Object.entries(GUARD_WRAPPERS).every(([name,table])=>original.some(g=>g.table===table&&g.name===name)),'DELTA_BASE_GUARD_REQUIRED');
  const updates=[];for(const a of plan.atoms){
   const projection="SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) h,CONVERT(varchar(100),p.current_stock_qty) qty,CONVERT(varchar(100),(SELECT COALESCE(SUM(quantity_net),0) FROM dbo.inventory_effective_movements WHERE product_id=p.id)) ledger_qty FROM dbo.products p WITH(UPDLOCK,HOLDLOCK) ";
   const sourceBinding="JOIN erp_migration.accepted_price_products b ON b.product_id=p.id WHERE p.id=@i AND b.product_source_key=@s AND p.stock_code=b.stock_code COLLATE Latin1_General_100_BIN2 AND p.unit=N'ADET' AND p.source_record_key=b.native_source_key COLLATE Latin1_General_100_BIN2 AND NOT EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N'product' AND h.native_id=p.id) AND(SELECT COUNT(*) FROM dbo.product_source_aliases WHERE product_id=p.id)=1 AND(SELECT COUNT(*) FROM dbo.product_source_aliases WHERE source_product_id=TRY_CONVERT(int,b.source_id))=1 AND EXISTS(SELECT 1 FROM dbo.product_source_aliases a WHERE a.product_id=p.id AND a.source_product_id=TRY_CONVERT(int,b.source_id))";
   const fixtureBinding="JOIN dbo.test_purchase_batch_scope b ON b.product_id=p.id WHERE p.id=@i AND p.id=301985 AND p.stock_code=N'TEST-V70-GOODS-P' AND p.unit=N'ADET' AND p.currency_code=N'TRY' AND p.average_cost_try=60 AND p.supplier_id=13370 AND p.is_active=1 AND p.is_deleted=0 AND b.stock_code=p.stock_code AND b.supplier_id=p.supplier_id AND b.warehouse_id=1 AND b.unit=N'ADET' AND b.unit_factor=1 AND b.unit_cost=60 AND(p.source_record_key=@k OR(p.source_record_key IS NULL AND @k IS NULL)) AND NOT EXISTS(SELECT 1 FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N'product' AND h.native_id=p.id) AND NOT EXISTS(SELECT 1 FROM erp_migration.accepted_price_products b WHERE b.product_id=p.id)";
   const row=(await request().input('i',sql.BigInt,a.productId).input('s',sql.NVarChar(250),a.acceptedSourceKey).input('k',sql.NVarChar(400),a.nativeSourceKey).query(projection+(plan.runKind==='SOURCE_SAFE'?sourceBinding:fixtureBinding))).recordset[0];rule(row&&row.h===a.beforeHash.toUpperCase(),'DELTA_NATIVE_PREIMAGE_DRIFT');rule(quantity(row.qty)===quantity(row.ledger_qty),'DELTA_NATIVE_LEDGER_BEFORE_DRIFT');updates.push({id:a.productId,before_hash:a.beforeHash.toUpperCase(),after_qty:effectQuantity(row.qty,a.deltaQty)});
   if(plan.runKind==='SOURCE_SAFE'){const source=capture.products.find(p=>p.sourceKey===a.sourceKey);for(const b of new Set(source.barcodes.map(b=>b.barcode))){const ownership=(await request().input('b',sql.NVarChar(160),b).query('SELECT product_id,is_active FROM dbo.product_barcodes WITH(UPDLOCK,HOLDLOCK) WHERE barcode=@b')).recordset;rule(ownership.length>0&&ownership.every(o=>String(o.product_id)===a.productId)&&ownership.some(o=>o.is_active===true),'DELTA_NATIVE_BARCODE_OWNERSHIP');}}
  }
  if(!installed){rule((await q("SELECT SCHEMA_ID(N'erp_migration') id"))[0].id,'DELTA_EXISTING_SCHEMA_REQUIRED');await q(ddl);for(const t of deltaTables)await q(immutableDefinition(t));}
  await q("CREATE TABLE #goal7_products(id bigint PRIMARY KEY,before_hash char(64),after_qty decimal(18,3));CREATE TABLE #goal7_inserts(source_key nvarchar(250) PRIMARY KEY,after_json nvarchar(max));CREATE TABLE #goal7_plan(run_id nvarchar(80) PRIMARY KEY,source_hash char(64),plan_hash char(64));CREATE TABLE #goal7_guard_hashes(object_id int PRIMARY KEY,name sysname,hash char(64),disabled bit,first_i int,first_u int,first_d int,last_i int,last_u int,last_d int);");
  await request().input('r',sql.NVarChar(80),plan.runId).input('s',sql.Char(64),plan.sourceHash).input('p',sql.Char(64),plan.planHash).query('INSERT #goal7_plan VALUES(@r,@s,@p)');
  await request().input('j',sql.NVarChar(sql.MAX),JSON.stringify(updates)).query("INSERT #goal7_products SELECT id,before_hash,after_qty FROM OPENJSON(@j) WITH(id bigint,before_hash char(64),after_qty decimal(18,3))");
  const movements=plan.atoms.map(a=>movement(plan,a));for(const m of movements)await request().input('k',sql.NVarChar(250),m.source_record_key).input('j',sql.NVarChar(sql.MAX),JSON.stringify(m)).query('INSERT #goal7_inserts VALUES(@k,@j)');
  await request().input('r',sql.NVarChar(80),plan.runId).query("EXEC sys.sp_set_session_context @key=N'goal7_delta_run',@value=@r;");
  const columns={};for(const table of ['products','stock_movements'])columns[table]=await q(`SELECT c.name,TYPE_NAME(c.user_type_id) type,c.max_length,c.precision,c.scale FROM sys.columns c WHERE c.object_id=OBJECT_ID(${literal('dbo.'+table)}) ORDER BY c.column_id`);
  const extended=[];for(const g of original.filter(x=>GUARD_WRAPPERS[x.name]===x.table)){const changed=g.definition.replace(/^CREATE\s+TRIGGER/i,'ALTER TRIGGER').replace(/AS\s+BEGIN\b/i,m=>m+'\n'+guardBranch(g.table,columns[g.table],plan)+'\n');rule(changed!==g.definition,'DELTA_GUARD_FORMAT');await q(changed);extended.push(g);}
  await q("INSERT #goal7_guard_hashes SELECT t.object_id,t.name,CONVERT(char(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(t.object_id)),2),t.is_disabled,OBJECTPROPERTY(t.object_id,'ExecIsFirstInsertTrigger'),OBJECTPROPERTY(t.object_id,'ExecIsFirstUpdateTrigger'),OBJECTPROPERTY(t.object_id,'ExecIsFirstDeleteTrigger'),OBJECTPROPERTY(t.object_id,'ExecIsLastInsertTrigger'),OBJECTPROPERTY(t.object_id,'ExecIsLastUpdateTrigger'),OBJECTPROPERTY(t.object_id,'ExecIsLastDeleteTrigger') FROM sys.triggers t WHERE t.parent_id IN(OBJECT_ID(N'dbo.products'),OBJECT_ID(N'dbo.stock_movements'))");
  await q('UPDATE p SET current_stock_qty=j.after_qty FROM dbo.products p JOIN #goal7_products j ON j.id=p.id;');
  const keys=Object.keys(movements[0]);const defs=keys.map(k=>`${ident(k)} ${type(columns.stock_movements.find(c=>c.name===k)??{})} ${literal('$.'+k)}`).join(',');
  for(const m of movements)await request().input('j',sql.NVarChar(sql.MAX),JSON.stringify(m)).query(`INSERT dbo.stock_movements(${keys.map(ident).join(',')}) SELECT ${keys.map(ident).join(',')} FROM OPENJSON(@j) WITH(${defs})`);
  for(const g of extended)for(const statement of restoreGuardStatements(g))await q(statement);
  const restored=await q("SELECT name,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(object_id)),2) hash,is_disabled disabled,OBJECTPROPERTY(object_id,'ExecIsFirstInsertTrigger') first_i,OBJECTPROPERTY(object_id,'ExecIsFirstUpdateTrigger') first_u,OBJECTPROPERTY(object_id,'ExecIsFirstDeleteTrigger') first_d,OBJECTPROPERTY(object_id,'ExecIsLastInsertTrigger') last_i,OBJECTPROPERTY(object_id,'ExecIsLastUpdateTrigger') last_u,OBJECTPROPERTY(object_id,'ExecIsLastDeleteTrigger') last_d FROM sys.triggers WHERE parent_id IN(OBJECT_ID(N'dbo.products'),OBJECT_ID(N'dbo.stock_movements')) ORDER BY name");rule(restored.length===original.length&&restored.every(g=>{const p=original.find(x=>x.name===g.name);return p&&g.hash===p.hash&&g.disabled===p.disabled&&g.first_i===p.first_i&&g.first_u===p.first_u&&g.first_d===p.first_d&&g.last_i===p.last_i&&g.last_u===p.last_u&&g.last_d===p.last_d;}),'DELTA_GUARD_RESTORE_DRIFT');
  rule(digest(await protectedFingerprints(request,plan.runId,plan.atoms.map(a=>a.productId)))===digest(plan.protectedBefore),'DELTA_PRIOR_HISTORY_CHANGED');
  const effects=[];for(const [i,a] of plan.atoms.entries()){
   const effect=(await request().input('k',sql.NVarChar(250),movements[i].source_record_key).input('p',sql.BigInt,a.productId).query("SELECT m.id effect_id,CONVERT(varchar(100),m.quantity_net) delta_qty,CONVERT(varchar(100),p.current_stock_qty) after_qty,CONVERT(varchar(100),(SELECT COALESCE(SUM(quantity_net),0) FROM dbo.inventory_effective_movements WHERE product_id=p.id)) ledger_qty,CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES)),2) after_hash FROM dbo.stock_movements m JOIN dbo.products p ON p.id=m.product_id WHERE m.source_record_key=@k AND m.product_id=@p")).recordset;rule(effect.length===1&&quantity(effect[0].delta_qty)===quantity(a.deltaQty)&&quantity(effect[0].after_qty)===quantity(updates[i].after_qty)&&quantity(effect[0].after_qty)===quantity(effect[0].ledger_qty),'DELTA_EFFECT_RECONCILIATION');effects.push(effect[0]);
   const sourceEffectKey=plan.runKind==='SOURCE_SAFE'?plan.sourceHash+'/'+a.sourceKey:plan.runId+'/'+a.atomId;
   await request().input('r',sql.NVarChar(80),plan.runId).input('a',sql.UniqueIdentifier,a.atomId).input('s',sql.NVarChar(250),a.sourceKey).input('p',sql.BigInt,a.productId).input('h',sql.Char(64),a.sourcePayloadHash).input('b',sql.Char(64),a.beforeHash).input('j',sql.NVarChar(sql.MAX),a.beforeImageJSON).input('d',sql.VarChar(100),a.deltaQty).input('c',sql.Char(64),plan.sourceHash).input('o',sql.VarChar(100),a.beforeSourceQty).input('n',sql.VarChar(100),a.afterSourceQty).input('k',sql.NVarChar(400),sourceEffectKey).query('INSERT erp_migration.goal7_delta_atoms VALUES(@r,@a,@s,@p,@h,@b,@j,CONVERT(decimal(18,3),@d),@c,CONVERT(decimal(18,3),@o),CONVERT(decimal(18,3),@n),@k)');
   await request().input('r',sql.NVarChar(80),plan.runId).input('a',sql.UniqueIdentifier,a.atomId).input('e',sql.BigInt,effect[0].effect_id).input('p',sql.BigInt,a.parentEffectId??null).input('h',sql.Char(64),effect[0].after_hash).query('INSERT erp_migration.goal7_delta_effects VALUES(@r,@a,@e,@p,@h)');
  }
  const receipt={status:'COMMITTED',runId:plan.runId,planHash:plan.planHash,sourceHash:plan.sourceHash,products:plan.atoms.length,movements:effects.length,commercialWrites:plan.atoms.length+effects.length,guardsRestored:true,priorHistoryPreserved:true,effects};
  await request().input('r',sql.NVarChar(80),plan.runId).input('s',sql.Char(64),plan.sourceHash).input('p',sql.Char(64),plan.planHash).input('k',sql.NVarChar(30),plan.runKind).input('b',sql.NVarChar(80),plan.parentRunId??null).input('j',sql.NVarChar(sql.MAX),JSON.stringify(receipt)).query("INSERT erp_migration.goal7_delta_runs VALUES(@r,@s,@p,@k,@b,N'COMMITTED',@j);EXEC sys.sp_set_session_context @key=N'goal7_delta_run',@value=NULL;");
  await tx.commit();return receipt;
 }catch(error){if(tx)await tx.rollback().catch(()=>{});throw error;}finally{await pool.close();}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){executeDelta(process.argv[3],process.argv[2]).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(/^[A-Z0-9_]+$/.test(error.message)?error.message:'GOAL7_DELTA_FAILED');process.exitCode=1;});}
