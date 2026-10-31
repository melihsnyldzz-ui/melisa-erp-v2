// Preparation only: SQL execution requires separate approval for the exact target.
// This is not ready_v1, native admission, a sale endpoint, or a migration runner.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

export const TARGET=Object.freeze({server:'127.0.0.1',port:15439,database:'MELISA_B6_SUBPATH_20261031_1234',serverIdentity:'MELISA-B6-DISPOSABLE',purpose:'B6-SELECTED-ITEMS-1234'});
const sourceURL=new URL('../../apps/api/src/services/invoiceDraftService.js',import.meta.url);
const SOURCE_SHA='1ef305949fd860157d4e472fd83f7499c5581177f34844b2c6aaa26a1a6dcdf1';
const digest=v=>createHash('sha256').update(v).digest('hex');
const reject=code=>{throw Object.assign(new Error(code),{code});};
export function assertTarget(target){
 if(!target||Object.keys(target).sort().join(',')!=='database,port,server'||target.server!==TARGET.server||target.port!==TARGET.port||target.database!==TARGET.database)reject('B6_SUBPATH_TARGET_REJECTED');
 return target;
}
export function selectedItemsSQL(){
 const bytes=fs.readFileSync(sourceURL);if(digest(bytes)!==SOURCE_SHA)reject('B6_SUBPATH_SOURCE_CHANGED');
 const body=bytes.toString('utf8').split('async function insertSelectedSourceSalesItems(')[1]?.split('\nasync function ')[0];
 const sql=body?.match(/\.query\(`([\s\S]*?)`\);/)?.[1];
 if(!sql||sql.split('dbo.sales_invoice_items').length!==2||!sql.includes('FROM OPENJSON(@selectedItemsJSON) j'))reject('B6_SUBPATH_SQL_SHAPE_CHANGED');
 return {sourceSha256:SOURCE_SHA,sql:sql.replace('dbo.sales_invoice_items','b6_subpath_fixture.items'),originalSQLSha256:digest(sql)};
}
export function syntheticItems(scenario='valid'){
 if(!['valid','bad-quantity','unknown-product'].includes(scenario))reject('B6_SUBPATH_SCENARIO_REJECTED');
 const items=[900001,900002].map((id,i)=>({productId:String(id),stockCode:`SYNTHETIC-${i+1}`,barcode:i?'0000000000002':'0000000000001',productName:`Synthetic product ${i+1}`,quantity:'1.000',currency:'USD',unitPrice:'1.2500',lineTotal:'1.2500',averageCostTry:'0.5000',stockStatus:null,note:null}));
 if(scenario==='bad-quantity')items[1].quantity='not-a-decimal';
 if(scenario==='unknown-product')items[1].productId='999999';
 return items;
}
export function plan(scenario='valid'){
 const source=selectedItemsSQL();
 return {schema:'b6-selected-items-subpath.v1',target:TARGET,sourceSha256:source.sourceSha256,originalSQLSha256:source.originalSQLSha256,scenario,items:syntheticItems(scenario),sqlExecuted:false,requiresSeparateExecutionApproval:true,admissionEquivalent:false,scope:'Selected-source-items OPENJSON, decimal conversion and FK only; no ready/begin/guard or production tables'};
}
const schemaSQL=`CREATE SCHEMA b6_subpath_fixture AUTHORIZATION dbo;`;
const seedSQL=`
CREATE TABLE b6_subpath_fixture.products(id bigint PRIMARY KEY);
CREATE TABLE b6_subpath_fixture.invoices(id bigint PRIMARY KEY);
CREATE TABLE b6_subpath_fixture.items(
 id bigint IDENTITY PRIMARY KEY,sales_invoice_id bigint NOT NULL REFERENCES b6_subpath_fixture.invoices(id),
 product_id bigint NULL REFERENCES b6_subpath_fixture.products(id),stock_code_snapshot nvarchar(50) NOT NULL,
 barcode_snapshot nvarchar(80) NULL,product_name_snapshot nvarchar(250) NOT NULL,quantity decimal(18,3) NOT NULL,
 currency_code nvarchar(3) NOT NULL,unit_price decimal(18,4) NOT NULL,line_total decimal(18,4) NOT NULL,
 average_cost_try_snapshot decimal(18,4) NULL,stock_status_snapshot nvarchar(50) NULL,note nvarchar(250) NULL,
 CHECK(product_id IS NOT NULL));
INSERT b6_subpath_fixture.products(id)VALUES(900001),(900002);
INSERT b6_subpath_fixture.invoices(id)VALUES(900010);`;
export function assertIdentity(row){
 if(!row||row.databaseName!==TARGET.database||row.serverName!==TARGET.serverIdentity||row.purpose!==TARGET.purpose||row.userTableCount!==0||row.fixtureSchemaCount!==0||row.transactionCount!==0)reject('B6_SUBPATH_IDENTITY_REJECTED');
}
export function numericFailure(error,stage){
 const info=error?.originalError?.info;const out={stage};
 for(const [key,max]of [['number',2147483647],['state',255],['class',25],['lineNumber',1000000]]){const value=error?.[key]??info?.[key];if(Number.isInteger(value)&&value>=0&&value<=max)out[key]=value;}
 return out;
}
export function assertOutcome({scenario,failure,insertedCount,rollbackVerified}){
 if(rollbackVerified!==true)reject('B6_SUBPATH_ROLLBACK_UNCONFIRMED');
 if(!['valid','bad-quantity','unknown-product'].includes(scenario)||failure&&failure.stage!=='selected-items'||scenario==='valid'&&(failure||insertedCount!==2)||scenario==='unknown-product'&&failure?.number!==547||scenario==='bad-quantity'&&failure?.number!==8114)reject('B6_SUBPATH_UNEXPECTED_RESULT');
 return failure?'EXPECTED_FAILURE_OBSERVED':'SUBPATH_ONLY_VERIFIED';
}
// No production config import, environment-derived host, certificate bypass,
// CREATE DATABASE, credential provisioning or persistent seed is provided.
export async function execute({target,scenario,approvedExecution,username,password}){
 assertTarget(target);const p=plan(scenario);
 if(approvedExecution!==true)reject('B6_SUBPATH_SEPARATE_APPROVAL_REQUIRED');
 if(typeof username!=='string'||!username||typeof password!=='string'||!password)reject('B6_SUBPATH_EXISTING_CREDENTIAL_REQUIRED');
 const require=createRequire(new URL('../../apps/api/package.json',import.meta.url));
 const sql=require('mssql');
 const pool=new sql.ConnectionPool({...target,user:username,password,options:{encrypt:true,trustServerCertificate:false},pool:{min:0,max:1}});
 let tx,stage='connect',failure=null,insertedCount=null,rollbackVerified=false;
 try{
  await pool.connect();stage='identity';
  const identity=(await pool.request().query(`SELECT DB_NAME() databaseName,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName,CONVERT(nvarchar(128),(SELECT value FROM sys.extended_properties WHERE class=0 AND name=N'MELISA_DISPOSABLE_SCOPE')) purpose,(SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0) userTableCount,(SELECT COUNT(*) FROM sys.schemas WHERE name=N'b6_subpath_fixture') fixtureSchemaCount,@@TRANCOUNT transactionCount;`)).recordset;
  if(identity?.length!==1)reject('B6_SUBPATH_IDENTITY_REJECTED');assertIdentity(identity[0]);
  tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  const request=()=>new sql.Request(tx);
  try{
   stage='schema';await request().query(schemaSQL);
   stage='synthetic-seed';await request().query(seedSQL);
   stage='selected-items';await request().input('invoiceId',sql.BigInt,'900010').input('selectedItemsJSON',sql.NVarChar(sql.MAX),JSON.stringify(p.items)).query(selectedItemsSQL().sql);
   stage='read-result';const rows=(await request().query('SELECT COUNT(*) rowCount FROM b6_subpath_fixture.items;')).recordset;
   insertedCount=rows?.[0]?.rowCount;if(insertedCount!==2)reject('B6_SUBPATH_ROW_COUNT');
  }catch(error){failure=numericFailure(error,stage);if(!Number.isInteger(failure.number))throw error;}
  finally{await tx.rollback();tx=null;}
  stage='verify-rollback';const after=(await pool.request().query("SELECT (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped=0) userTableCount,(SELECT COUNT(*) FROM sys.schemas WHERE name=N'b6_subpath_fixture') fixtureSchemaCount,@@TRANCOUNT transactionCount;")).recordset?.[0];
  if(after?.userTableCount!==0||after?.fixtureSchemaCount!==0||after?.transactionCount!==0)reject('B6_SUBPATH_ROLLBACK_UNCONFIRMED');rollbackVerified=true;
  const status=assertOutcome({scenario,failure,insertedCount,rollbackVerified});
  return {...p,items:undefined,sqlExecuted:true,rollbackVerified,insertedCount,failure,status};
 }finally{if(tx)await tx.rollback().catch(()=>{});await pool.close();}
}
export async function main(args=process.argv.slice(2)){
 const options={};for(let i=0;i<args.length;i++){const key=args[i];if(['--execute','--approved-execution'].includes(key))options[key]=true;else if(['--server','--port','--database','--scenario'].includes(key)&&args[i+1]&&!args[i+1].startsWith('--'))options[key]=args[++i];else reject('B6_SUBPATH_ARGUMENT_REJECTED');}
 const target={server:options['--server']??TARGET.server,port:Number(options['--port']??TARGET.port),database:options['--database']??TARGET.database};assertTarget(target);
 const scenario=options['--scenario']??'valid';
 return options['--execute']?execute({target,scenario,approvedExecution:options['--approved-execution']===true,username:process.env.MELISA_B6_SUBPATH_SQL_USER,password:process.env.MELISA_B6_SUBPATH_SQL_PASSWORD}):plan(scenario);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===fs.realpathSync(process.argv[1]))main().then(x=>process.stdout.write(JSON.stringify(x)+'\n')).catch(error=>{process.stderr.write(JSON.stringify({status:'REJECTED',code:/^B6_SUBPATH_[A-Z_]+$/.test(error.code??'')?error.code:'B6_SUBPATH_EXECUTION_FAILED'})+'\n');process.exitCode=1;});
