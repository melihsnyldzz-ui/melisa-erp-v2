// A separate CLI process reuses the application's SQL driver/pool module.
// No running service/config is redirected; the SQL target must itself be READ_ONLY.
import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {RESTORE_DATABASE,RESTORE_SERVER,assertRestoreIdentity,assertRestoreRead} from './goal6-restore-contract.mjs';
const output='C:/Sirket/ERP/evidence/ERP-GOAL6-20261006/restore-application-read.json';
for(const [key,value] of Object.entries({SQL_SERVER:RESTORE_SERVER,SQL_DATABASE:RESTORE_DATABASE,SQL_TRUSTED_CONNECTION:'true',SQL_READ_ONLY:'true',SQL_ENCRYPT:'false',SQL_TRUST_SERVER_CERTIFICATE:'true',SQL_ODBC_DRIVER:'ODBC Driver 17 for SQL Server'}))process.env[key]=value;
delete process.env.SQL_USER;delete process.env.SQL_PASSWORD;delete process.env.MELISA_CANONICAL_TEST;delete process.env.MELISA_TEST_SCOPED_SALES;
// The accepted sealed package has its verified native ODBC addon installed.
// The source checkout intentionally is not a running deployment.
const applicationPackage='C:/Sirket/ERP/releases/CANONICAL-PERSONNEL-TEST-20261006-74';
const packageSource='5972f847fe4697db3386b4fe7fabd98a006d21c7';
let closeSqlPool=async()=>{};
let stage='package-verification';
const started=performance.now();
try {
 const manifest=JSON.parse(await fs.readFile(applicationPackage+'/release-manifest.json','utf8'));
 if(manifest.sourceCommit!==packageSource)throw Error('GOAL6_APPLICATION_PACKAGE_INVALID');
 for(const file of ['apps/api/src/config/database.js','apps/api/src/config/env.js']){
  const expected=manifest.files.find(row=>row.path===file)?.sha256;
  if(!expected||createHash('sha256').update(await fs.readFile(applicationPackage+'/'+file)).digest('hex')!==expected.toLowerCase())throw Error('GOAL6_APPLICATION_MODULE_INVALID');
 }
 const databaseModule=await import(pathToFileURL(applicationPackage+'/apps/api/src/config/database.js').href);
 closeSqlPool=databaseModule.closeSqlPool;
 const {getSqlPool}=databaseModule;
 stage='application-connector';const pool=await getSqlPool();
 const identityRow=(await pool.request().query("SELECT CAST(SERVERPROPERTY('ServerName') AS nvarchar(128)) serverName,DB_NAME() databaseName,is_read_only isReadOnly,state_desc state FROM sys.databases WHERE database_id=DB_ID()")).recordset[0];
 const identity={...identityRow,isReadOnly:identityRow?.isReadOnly===true||identityRow?.isReadOnly===1};
 stage='identity';assertRestoreIdentity(identity);
 // Fixed read statements only. Exact decimals/identifiers are returned as text.
 stage='fixed-select';const result=await pool.request().query(`
 SELECT CONVERT(varchar(20),COUNT_BIG(*)) count,CONVERT(varchar(20),SUM(CONVERT(bigint,CASE WHEN p.average_cost_try IS NULL THEN 1 ELSE 0 END))) unknownCost,(SELECT CONVERT(varchar(20),COUNT_BIG(*)) FROM erp_migration.accepted_price_values) prices FROM erp_migration.accepted_price_products a JOIN dbo.products p ON p.id=a.product_id;
 SELECT CONVERT(varchar(20),p.id) productId,p.stock_code stockCode,CONVERT(varchar(64),p.current_stock_qty) stock,b.barcode,CONVERT(varchar(64),v.price_exact) price,v.currency_code currency FROM dbo.products p JOIN erp_migration.accepted_price_values v ON v.product_id=p.id AND v.price_type='sale' AND v.price_tier=1 AND v.is_main_unit=1 AND v.currency_code='USD' OUTER APPLY(SELECT TOP(1) barcode FROM dbo.product_barcodes WHERE product_id=p.id ORDER BY is_primary DESC,id) b WHERE p.id IN(34765,36724) ORDER BY p.id;
 SELECT CONVERT(varchar(20),id) id,status,document_currency currency,CONVERT(varchar(64),grand_total) total FROM dbo.sales_orders WHERE id=9;
 SELECT CONVERT(varchar(20),product_id) productId,stock_code_snapshot stockCode,CONVERT(varchar(64),quantity) quantity,currency_code currency,CONVERT(varchar(64),unit_price) unitPrice FROM dbo.sales_order_items WHERE sales_order_id=9 ORDER BY id;
 SELECT CONVERT(varchar(20),id) id,flow,kind,state FROM dbo.test_daily_drafts WHERE id IN(43,44) ORDER BY id;
 SELECT CONVERT(varchar(20),id) id FROM dbo.work_inbound_counts WHERE id=7;
 SELECT (SELECT COUNT(*) FROM dbo.users) users,(SELECT COUNT(*) FROM dbo.roles) roles,(SELECT COUNT(*) FROM dbo.permissions) permissions;
 `);
 const sets=result.recordsets;
 const proof={schemaVersion:'melisa-goal6.restore-application-read.v1',capturedAt:new Date().toISOString(),identity,connector:'sealed TEST74 apps/api/src/config/database.js getSqlPool; msnodesqlv8 / integrated Windows authentication',applicationSource:packageSource,applicationPackage,temporaryProcess:true,runningServicesRedirected:false,sqlStatements:'SELECT only; database READ_ONLY asserted before business reads',catalog:sets[0][0],products:sets[1],nativeOrder:sets[2][0],nativeLines:sets[3],dailyDrafts:sets[4],inbound:sets[5][0],roles:sets[6][0],elapsedMs:Math.round(performance.now()-started)};
 stage='result-contract';assertRestoreRead(proof);await fs.writeFile(output,JSON.stringify(proof,null,2)+'\n');process.stdout.write(JSON.stringify({result:'RESTORE_APPLICATION_READ_PASS',database:RESTORE_DATABASE,elapsedMs:proof.elapsedMs,catalog:proof.catalog,products:proof.products.length,orderId:proof.nativeOrder.id,dailyDrafts:proof.dailyDrafts.map(d=>d.id),output})+'\n');
} catch(error) {const code=/^GOAL6_[A-Z_]+$/.test(error?.message??'')?error.message:/^[A-Z0-9_]+$/.test(error?.code??'')?error.code:'UNAVAILABLE';process.stderr.write(JSON.stringify({result:'GOAL6_RESTORE_APPLICATION_READ_FAILED',stage,code})+'\n');process.exitCode=1;} finally {await closeSqlPool();}
