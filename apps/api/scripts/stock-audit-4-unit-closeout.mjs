import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sql from 'mssql/msnodesqlv8.js';

// Explicitly approved metadata-only closure. No Vega or MELISA_ERP_V2 connection.
const RUN='STOCK-AUDIT-4-UNIT-20260918-01';
const SERVER='Semih\\MELISADEV',DATABASE='MELISA_ERP_PROD_CANDIDATE_20260917_01';
const SOURCE_KEY='VEGA2026/F0102TBLSTOKLAR/102503';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const dir=path.join(root,'artifacts/stock-audit-4-unit-20260918');
const mode=process.argv[2]||'--dry-run';
if(!['--dry-run','--apply-approved-unit','--verify'].includes(mode))throw Error('INVALID_MODE');
fs.mkdirSync(dir,{recursive:true});
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const save=(name,value)=>fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(value,null,2));
const assert=(value,message)=>{if(!value)throw Error(message);};
const tables=['products','stock_movements','inventory_cutovers','inventory_cutover_items','customers','suppliers','party_currency_accounts','customer_movements','supplier_movements','finance_accounts','finance_account_movements','sales_invoices','sales_invoice_items','purchase_invoices','purchase_invoice_items','terminal_sync_queue'];
const pool=await new sql.ConnectionPool({connectionString:`Driver={ODBC Driver 17 for SQL Server};Server=${SERVER};Database=${DATABASE};Trusted_Connection=Yes;TrustServerCertificate=Yes;Encrypt=No`,requestTimeout:180000}).connect();
let tx;
const request=()=>new sql.Request(tx||pool);
const q=async text=>(await request().query(text)).recordset;
async function identity(){const r=(await q("SELECT DB_NAME() databaseName,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName"))[0];assert(r.databaseName===DATABASE&&r.serverName===SERVER,'CANDIDATE_ONLY_IDENTITY');return r;}
async function product(){return {product:(await q('SELECT id,stock_code,unit,current_stock_qty,is_active,is_deleted,migration_scope_status FROM dbo.products WHERE id=296542'))[0],aliases:await q('SELECT * FROM dbo.product_source_aliases WHERE source_product_id=102503'),movementNet:(await q('SELECT COALESCE(SUM(quantity_net),0) quantity,COUNT_BIG(*) movements FROM dbo.inventory_effective_movements WHERE product_id=296542'))[0]};}
function assertProduct(r){assert(r.product?.stock_code==='8031 MURAT BABY'&&r.product.unit==='ADET'&&r.product.current_stock_qty===20&&r.movementNet.quantity===20&&!r.product.is_active&&!r.product.is_deleted&&r.product.migration_scope_status==='IN_SCOPE','PRODUCT_IDENTITY_OR_BALANCE_CHANGED');assert(r.aliases.length===1&&r.aliases[0].id==='35324'&&r.aliases[0].product_id==='296542'&&r.aliases[0].source_record_key===SOURCE_KEY&&r.aliases[0].quantity_exact===20,'SOURCE_ALIAS_CHANGED');}
async function economicSnapshot(){
 const manifests=[];
 for(const table of tables){
  const columns=await q(`SELECT name FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.${table}') AND name<>N'source_payload_json' ORDER BY column_id`);
  assert(columns.some(c=>c.name==='id'),'ECONOMIC_TABLE_MISSING:'+table);
  const projection=columns.map(c=>'['+c.name.replaceAll(']',']]')+']').join(',');
  const r=(await q(`SELECT (SELECT COUNT_BIG(*) FROM dbo.[${table}]) [rowCount],CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT ${projection} FROM dbo.[${table}] ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES)),2) sha256`))[0];
  manifests.push({table,columns:columns.map(c=>c.name),...r});
 }
 const stock=(await q("SELECT COUNT_BIG(*) products,CONVERT(varchar(60),SUM(CONVERT(decimal(38,8),current_stock_qty))) quantity,SUM(CASE WHEN current_stock_qty<0 THEN 1 ELSE 0 END) negativeProducts FROM dbo.products"))[0];
 const stockMovements=(await q("SELECT COUNT_BIG(*) movements,CONVERT(varchar(60),SUM(CONVERT(decimal(38,8),quantity_net))) quantity FROM dbo.stock_movements"))[0];
 const party=await q("SELECT currency_code,COUNT_BIG(*) accounts,CONVERT(varchar(60),SUM(CONVERT(decimal(38,8),current_balance))) balance FROM dbo.party_currency_accounts GROUP BY currency_code ORDER BY currency_code");
 const finance=await q("SELECT currency_code,COUNT_BIG(*) accounts,CONVERT(varchar(60),SUM(CONVERT(decimal(38,8),current_balance))) balance FROM dbo.finance_accounts GROUP BY currency_code ORDER BY currency_code");
 return {manifests,stock,stockMovements,party,finance};
}
try{
 const databaseIdentity=await identity();
 tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 await q('SET LOCK_TIMEOUT 15000');
 const beforeProduct=await product();assertProduct(beforeProduct);
 const previous=await q(`SELECT id,details_json FROM dbo.migration_decisions WHERE source_record_key=N'${RUN}/102503'`);
 const previousAudits=await q(`SELECT id FROM dbo.audit_logs WHERE action=N'PRODUCT_UNIT_CONFIRMED' AND reason LIKE N'%${RUN}%'`);
 assert(previous.length<=1&&previousAudits.length<=1,'DUPLICATE_DECISION');
 const before=await economicSnapshot();
 const decision={runId:RUN,authority:'Explicit business decision delivered by source task 01a0afe3-47b9-7713-a817-30ce13b5443e',decision:'8031 MURAT BABY birimi ADET olarak doğrulandı.',sourceProductId:102503,productId:'296542',aliasId:'35324',unit:'ADET',quantity:20,conversionApplied:false,sourceUnitEvidencePreserved:true,previousClassification:'UNKNOWN',finalClassification:'HISTORICAL_ONLY_DIFFERENCE',economicEffects:0};
 let changed=0,auditId=null,decisionId=null;
 if(mode==='--apply-approved-unit'){
  assert(!fs.existsSync(path.join(dir,'receipt.json')),'RECEIPT_EXISTS_USE_VERIFY');
  assert(previous.length===0&&previousAudits.length===0&&beforeProduct.aliases[0].unit_status==='REVIEW','EXPECTED_UNRESOLVED_STATE');
  const triggers=await q("SELECT name FROM sys.triggers WHERE is_disabled=0 AND parent_id IN(OBJECT_ID('dbo.product_source_aliases'),OBJECT_ID('dbo.migration_decisions'),OBJECT_ID('dbo.audit_logs'))");
  assert(triggers.length===0,'UNREVIEWED_METADATA_TRIGGER');
  save('before',{at:new Date().toISOString(),databaseIdentity,product:beforeProduct,economic:before});
  const updated=await request().query("UPDATE dbo.product_source_aliases SET unit_status=N'VERIFIED' WHERE id=35324 AND product_id=296542 AND source_product_id=102503 AND source_record_key=N'VEGA2026/F0102TBLSTOKLAR/102503' AND unit_status=N'REVIEW' AND quantity_exact=20; SELECT @@ROWCOUNT changed");
  changed=updated.recordset[0].changed;assert(changed===1,'EXACTLY_ONE_UNIT_STATUS_UPDATE_REQUIRED');
  const inserted=await request().input('details',sql.NVarChar(sql.MAX),JSON.stringify(decision)).input('run',sql.NVarChar(80),RUN).input('key',sql.NVarChar(250),RUN+'/102503').input('source',sql.NVarChar(250),SOURCE_KEY).query("INSERT dbo.migration_decisions(record_type,reason,status,details_json,source_record_key,migration_run_id,related_source_key) OUTPUT inserted.id VALUES(N'product_unit_confirmation',N'BUSINESS_CONFIRMED_ADET',N'RESOLVED',@details,@key,@run,@source)");
  decisionId=inserted.recordset[0].id;
  const afterAlias={...beforeProduct.aliases[0],unit_status:'VERIFIED'};
  const audit=await request().input('before',sql.NVarChar(sql.MAX),JSON.stringify(beforeProduct.aliases[0])).input('after',sql.NVarChar(sql.MAX),JSON.stringify({alias:afterAlias,decision})).input('reason',sql.NVarChar(500),RUN+': Explicit business confirmation ADET; classification only; no conversion or economic effect.').query("INSERT dbo.audit_logs(actor_user_id,action,entity_type,entity_id,before_json,after_json,reason,source) OUTPUT inserted.id VALUES(NULL,N'PRODUCT_UNIT_CONFIRMED',N'product_source_alias',35324,@before,@after,@reason,N'stock-audit-4-unit')");
  auditId=audit.recordset[0].id;
 }else if(mode==='--verify'){
  assert(beforeProduct.aliases[0].unit_status==='VERIFIED'&&previous.length===1&&previousAudits.length===1,'DECISION_NOT_INCLUDED');
  assert(JSON.stringify(JSON.parse(previous[0].details_json))===JSON.stringify(decision),'DECISION_CONTENT_DRIFT');
 }
 const after=await economicSnapshot(),afterProduct=await product();assertProduct(afterProduct);
 assert(sha(before)===sha(after),'ECONOMIC_EFFECT_DETECTED_ROLLBACK');
 if(mode==='--verify')assert(sha(after)===JSON.parse(fs.readFileSync(path.join(dir,'receipt.json'),'utf8')).afterEconomicSha256,'ECONOMIC_DRIFT_AFTER_COMMIT');
 assert(sha({...beforeProduct.aliases[0],unit_status:afterProduct.aliases[0].unit_status})===sha(afterProduct.aliases[0]),'UNEXPECTED_ALIAS_CHANGE');
 if(mode==='--apply-approved-unit'){await tx.commit();tx=null;}else{await tx.rollback();tx=null;}
 const persisted=await product();assertProduct(persisted);
 if(mode!=='--dry-run')assert(persisted.aliases[0].unit_status==='VERIFIED','POSTCOMMIT_UNIT_NOT_VERIFIED');
 const result={runId:RUN,mode,at:new Date().toISOString(),databaseIdentity,status:'PASS',decision,metadataUpdated:changed,decisionId,auditId,before,after,beforeEconomicSha256:sha(before),afterEconomicSha256:sha(after),productBefore:beforeProduct,productAfter:persisted,economicEffects:{stock:0,party:0,finance:0,newMovements:0},sourceConnections:{vega:0,live:0,acceptedTest:0},sourceWrites:{vega:0,live:0,acceptedTest:0}};
 if(mode==='--apply-approved-unit')save('receipt',result);else save(mode==='--verify'?'independent-verification':'preflight',result);
 console.log(JSON.stringify({runId:RUN,mode,status:result.status,metadataUpdated:changed,decisionId,auditId,stock:after.stock,stockMovements:after.stockMovements,party:after.party,finance:after.finance,economicEffects:result.economicEffects,unit:persisted.product.unit,unitStatus:persisted.aliases[0].unit_status}));
}catch(error){if(tx)await tx.rollback().catch(()=>{});throw error;}finally{await pool.close();}
