import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {CRM_OPENING as O,normalizeCrmOpeningBaseline,normalizeCrmOpeningMapping,projectCrmSalePrice} from './crmOrderOpeningMapping.mjs';
import {buildTestCrmOrdersSql,buildCrmOpeningProcedures,buildTestCrmOrderRecoverySql,normalizeCrmRecoveryDefinition,CRM_OPENING_BINDING_SQL,PRODUCT_HASH_FIELDS,PRICE_HASH_FIELDS} from './enable-test-crm-orders.mjs';
const baseline=()=>({schemaVersion:1,procedures:{context:'a'.repeat(64),create:'b'.repeat(64),read:'c'.repeat(64)}});
const product=(source='1001',native='2001',price='3001')=>({sourceId:'vega-'+source,stockCode:'FIXTURE-'+source,productName:'OFFLINE TEST PRODUCT '+source,
 nativeProductId:native,nativeStockCode:'FIXTURE-'+source,nativeProductName:'OFFLINE TEST PRODUCT '+source,nativePriceId:price,
 priceSourceKey:`VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/${source}/PRICE/sale/4001/1/TRY`,unitSourceId:'4001',mainUnitSourceId:'4001',tier:1,currency:'TRY',
 priceExact8:'1.23455000',nativePriceExact4:'1.2346',unit:'ADET',factorExact8:'1.00000000',productBindingHash:'d'.repeat(64),priceBindingHash:'e'.repeat(64),nativePriceRowHash:'f'.repeat(64),evidenceSha256:'1'.repeat(64)});
const mapping=()=>({schemaVersion:1,...Object.fromEntries(['runId','sourceHash','planHash','bindingsHash','sourceAsOf'].map(k=>[k,O[k]])),products:[product(),product('1002','2002','3002')]});
const render=()=>buildTestCrmOrdersSql({baseline:baseline(),mapping:mapping()});
test('offline price projection preserves exact8, known zero and HALF_UP native4 boundaries',()=>{
 assert.deepEqual(projectCrmSalePrice('1.23455000'),{priceExact8:'1.23455000',nativePriceExact4:'1.2346',roundingDeltaExact8:'0.00005000',roundingRule:'HALF_UP'});
 assert.equal(projectCrmSalePrice('1.23454999').nativePriceExact4,'1.2345');assert.equal(projectCrmSalePrice('0.00000000').nativePriceExact4,'0.0000');
 assert.equal(projectCrmSalePrice('1000000.00000000').nativePriceExact4,'1000000.0000');
 for(const x of [null,1.23455,'-1.00000000','1.2','NaN','1000000.00005000'])assert.throws(()=>projectCrmSalePrice(x));
});
test('only explicit metadata is normalized; IDs remain exact SQL bigint strings',()=>{
 const x=mapping();x.products[0].nativeProductId='9223372036854775807';x.products[0].evidenceSha256='A'.repeat(64);
 const normalized=normalizeCrmOpeningMapping(x);assert.equal(normalized.products[0].nativeProductId,'9223372036854775807');assert.equal(normalized.products[0].evidenceSha256,'a'.repeat(64));
 assert.throws(()=>normalizeCrmOpeningMapping({...x,autoSend:true}));assert.throws(()=>normalizeCrmOpeningBaseline({...baseline(),connectionString:'FORBIDDEN_FIELD'}));
 assert.throws(()=>normalizeCrmOpeningMapping({...x,products:[{...x.products[0],nativeProductId:2001}]}));
 assert.throws(()=>normalizeCrmOpeningBaseline({schemaVersion:1,procedures:{...baseline().procedures,read:'not-a-hash'}}));
});
test('wrong frozen source, ambiguous aliases, tuple, currency, unit or projection cannot provision',()=>{
 for(const field of ['runId','sourceHash','planHash','bindingsHash','sourceAsOf'])assert.throws(()=>normalizeCrmOpeningMapping({...mapping(),[field]:'changed'}),field);
 for(const change of [{sourceId:'vega-0'},{nativeProductId:'9223372036854775808'},{tier:2},{currency:'GBP'},{unitSourceId:'9999'},{unit:'KOLI'},{factorExact8:'2.00000000'},{nativePriceExact4:'1.2345'},{priceSourceKey:'wrong'},{nativePriceRowHash:null}]){
  const x=mapping();Object.assign(x.products[0],change);assert.throws(()=>normalizeCrmOpeningMapping(x),JSON.stringify(change));
 }
 for(const field of ['sourceId','stockCode','nativeProductId','nativePriceId']){const x=mapping();x.products[1][field]=x.products[0][field];assert.throws(()=>normalizeCrmOpeningMapping(x),field);}
});
test('committed SQL is unconfigured and exact deterministic output, with no DB runtime imports',()=>{
 const sql=buildTestCrmOrdersSql();assert.equal(fs.readFileSync(new URL('./enable-test-crm-orders.sql',import.meta.url),'utf8'),sql);
 assert.match(sql,/@mapping_json nvarchar\(max\)=NULL,@baseline_json nvarchar\(max\)=NULL/);
 assert.ok(sql.indexOf('CRM_TEST_ACTUAL_INSTALL_METADATA_REQUIRED')<sql.indexOf('CREATE TABLE dbo.'));
 assert.throws(()=>buildTestCrmOrdersSql({baseline:baseline()}),/PAIR_REQUIRED/);
 for(const filename of ['enable-test-crm-orders.mjs','crmOrderOpeningMapping.mjs']){
  const code=fs.readFileSync(new URL('./'+filename,import.meta.url),'utf8');assert.doesNotMatch(code,/from ['"].*(?:mssql|database|env|target-opening-runtime)|fetch\(|process\.env|\.execute\(|\.query\(/);
 }
});
test('install requires exact before hashes and preserves old tables, data, read procedure and grants',()=>{
 const sql=render();for(const k of ['context','create','read'])assert.ok(sql.includes(`'$.procedures.${k}'`));
 assert.match(sql,/before_definition nvarchar\(max\)/);assert.match(sql,/OBJECT_DEFINITION\(object_id\)/);
 assert.doesNotMatch(sql,/ALTER PROCEDURE dbo\.usp_test_crm_order_read/);assert.doesNotMatch(sql,/GRANT |ALTER LOGIN|CREATE USER|DISABLE TRIGGER|DROP TABLE|TRUNCATE TABLE/i);
 assert.doesNotMatch(sql,/(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?(?:dbo\.products|dbo\.product_prices|dbo\.test_crm_order_product_scope|erp_migration\.)\b/i);
 assert.equal((sql.match(/CRM_TEST_EXISTING_EXECUTE_REQUIRED/g)||[]).length,6);
 assert.ok(sql.indexOf('CRM_TEST_OLD_DEFINITION_MISMATCH')<sql.indexOf('CREATE TABLE dbo.test_crm_order_opening_manifest'));
 assert.ok(sql.indexOf("INSERT dbo.test_crm_order_opening_definitions(name,before_definition,before_hash,after_hash) VALUES(N'crm_opening_immutable_definitions'")<sql.indexOf('EXEC sys.sp_executesql N\'CREATE TRIGGER dbo.crm_opening_immutable_definitions'));
});
test('all accepted-opening product/price hash fields reuse existing canonical field order',()=>{
 const source=fs.readFileSync(new URL('../migration/accepted-opening-prices.mjs',import.meta.url),'utf8');
 for(const [name,fields]of [['productFields',PRODUCT_HASH_FIELDS],['priceFields',PRICE_HASH_FIELDS]]){
  const original=JSON.parse(source.match(new RegExp('const '+name+'=(\\[[^;]+\\]);'))[1].replaceAll("'",'"'));assert.deepEqual(fields,original);
 }
 for(const token of ['n.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES','b.stage_sql_hash','v.stage_sql_hash','b.binding_hash','v.binding_hash','source_product_id','price_tier','source_unit_id','VERIFIED_ADET_FACTOR_1','unitFactor','mainUnitSourceId'])assert.ok(CRM_OPENING_BINDING_SQL.includes(token),token);
 assert.doesNotMatch(CRM_OPENING_BINDING_SQL,/p\.sales_price|p\.source_sales_currency/);
});
test('create locks native permissions, selected typed facts and quarantine before any order insert',()=>{
 const {create,context}=buildCrmOpeningProcedures();
 for(const sql of [create,context]){
  assert.match(sql,/SET TRANSACTION ISOLATION LEVEL SERIALIZABLE/);assert.match(sql,/BEGIN TRANSACTION/);assert.match(sql,/dbo\.permissions a WITH\(HOLDLOCK\)/);
  assert.match(sql,/crm_actor_id IS NULL/);assert.match(sql,/source_id IN\(SELECT SUBSTRING/);assert.match(sql,/h\.native_id=593/);
  assert.match(sql,/operation_quarantine_holds h WITH\(HOLDLOCK\)/);assert.match(sql,/IF @@TRANCOUNT>0 ROLLBACK/);
 }
 const insert=create.indexOf('INSERT dbo.sales_orders');assert.ok(create.indexOf('CRM_TEST_OPENING_BINDING_DRIFT')<insert);assert.ok(create.indexOf('CRM_TEST_PRODUCT_QUARANTINED')<insert);
 assert.match(create,/customer_id<>593/);assert.match(create,/conversation_id<>N'55'/);assert.match(create,/N'905387217733'/);
 assert.match(create,/scope_row_hash,price_exact,native_price,price_id,price_source_key/);assert.match(create,/CAST\(0 AS bit\) stockEffect,CAST\(0 AS bit\) ledgerEffect/);
 assert.doesNotMatch(create,/INSERT dbo\.(?:stock_movements|customer_movements|reservations)/);
});
test('historical UUID replay precedes new scope checks and cannot widen actor or change request bytes',()=>{
 const {create}=buildCrmOpeningProcedures();const begin=create.indexOf('IF EXISTS(SELECT 1 FROM dbo.test_crm_order_requests'),exit=create.indexOf('RETURN; END;',begin),gate=create.indexOf('CRM_TEST_OPENING_NOT_READY',exit);
 assert.ok(begin>0&&exit>begin&&gate>exit);const replay=create.slice(begin,exit);
 for(const x of ['actor_id=@actor_id','CONVERT(varbinary(max),crm_actor_id)=CONVERT(varbinary(max),@crm_actor_id)','payload_hash=@payload_hash','CONVERT(varbinary(max),items_json)=CONVERT(varbinary(max),@items_json)','CRM_TEST_REQUEST_CONFLICT','usp_test_crm_order_read'])assert.ok(replay.includes(x),x);
 assert.doesNotMatch(replay,/opening_scope|accepted_price|operation_quarantine/);
});
test('context emits native IDs and exact decimals as strings with typed human-review provenance',()=>{
 const {context}=buildCrmOpeningProcedures();for(const field of ['nativeProductId','nativePriceId','unitSourceId','mainUnitSourceId','priceExact8','nativePriceExact4','factorExact8','runId','sourceHash','planHash','sourceAsOf'])assert.ok(context.includes(field),field);
 assert.match(context,/CONVERT\(varchar\(20\),s\.product_id\) nativeProductId/);assert.match(context,/CONVERT\(bit,1\) isMainUnit/);assert.match(context,/s\.price_tier tier/);assert.match(context,/WITH EXECUTE AS OWNER/);
});
test('generated definition hash is UTF16 SQL HASHBYTES compatible and unknown partial install fails',()=>{
 const sql=render(),objects=buildCrmOpeningProcedures();for(const definition of Object.values(objects))assert.ok(sql.includes(createHash('sha256').update(definition,'utf16le').digest('hex')));
 assert.match(sql,/CRM_TEST_UNKNOWN_PARTIAL_INSTALL/);assert.match(sql,/PASS_IDENTICAL_NOOP/);assert.match(sql,/CRM_TEST_EXISTING_INSTALL_MISMATCH/);
 assert.match(sql,/COUNT\(\*\) FROM dbo\.test_crm_order_opening_definitions\)<>7/);
 assert.doesNotMatch(sql,/LOWER\((?:DB_NAME|.*SERVERPROPERTY)/);
});
test('installer declares its temporary selection table only once before either branch',()=>{
 const sql=render(),installer=sql.slice(0,sql.indexOf('EXEC sys.sp_executesql'));
 assert.equal((installer.match(/CREATE TABLE #E02Selected/g)||[]).length,1);
 assert.ok(installer.indexOf('CREATE TABLE #E02Selected')<installer.indexOf("IF OBJECT_ID(N'dbo.test_crm_order_opening_manifest') IS NOT NULL BEGIN"));
 assert.equal((installer.match(/INSERT #E02Selected SELECT product_id/g)||[]).length,2);
});
test('offline CLI renders only explicit private input; output uses exclusive creation',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'crm-e02-offline-'));const script=fileURLToPath(new URL('./enable-test-crm-orders.mjs',import.meta.url));
 try{
  const base=path.join(directory,'baseline.json'),map=path.join(directory,'mapping.json'),output=path.join(directory,'reviewed.sql');fs.writeFileSync(base,JSON.stringify(baseline()));fs.writeFileSync(map,JSON.stringify(mapping()));
  const preload=['--require',fileURLToPath(new URL('../ci/offline-guard.cjs',import.meta.url))];
  const args=[...preload,script,'--baseline-json',base,'--mapping-json',map,'--output',output];const result=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.equal(fs.readFileSync(output,'utf8'),render());
  assert.notEqual(spawnSync(process.execPath,args,{encoding:'utf8'}).status,0);assert.equal(fs.readFileSync(output,'utf8'),render());
  assert.notEqual(spawnSync(process.execPath,[...preload,script,'--execute'],{encoding:'utf8'}).status,0);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('recovery changes bare CREATE verb only and rejects unknown headers or objects',()=>{
 const name='usp_test_crm_order_context',source=' \r\nCREATE   PROCEDURE dbo.'+name+' @actor_id BIGINT AS SELECT 1;';
 const result=normalizeCrmRecoveryDefinition(source,name);
 assert.equal(result,source.replace('CREATE','ALTER'));assert.notEqual(createHash('sha256').update(result,'utf16le').digest('hex'),createHash('sha256').update(source,'utf16le').digest('hex'));
 for(const verb of ['ALTER','CREATE OR ALTER','create\tOR\nALTER']){const x=verb+' PROCEDURE dbo.'+name+' AS SELECT 1;';assert.equal(normalizeCrmRecoveryDefinition(x,name),x);}
 for(const x of ['DROP PROCEDURE dbo.'+name,'CREATE TABLE dbo.'+name,'CREATE PROCEDURE dbo.other AS SELECT 1;'])assert.throws(()=>normalizeCrmRecoveryDefinition(x,name),/HEADER_UNSUPPORTED/);
});
test('definition-only recovery is pinned, reversible and retains original hashes, unchanged read and all data',()=>{
 assert.throws(()=>buildTestCrmOrderRecoverySql({direction:'restore-db'}),/DIRECTION_REQUIRED/);
 const before=buildTestCrmOrderRecoverySql({direction:'before'}),after=buildTestCrmOrderRecoverySql({direction:'after'});
 for(const sql of [before,after]){
  assert.match(sql,/MELISA-TEST-V70-SALES/);assert.match(sql,/SET TRANSACTION ISOLATION LEVEL SERIALIZABLE/);assert.match(sql,/COUNT\(\*\) FROM dbo.test_crm_order_opening_definitions WITH\(HOLDLOCK\)\)<>7/);
  assert.match(sql,/HASHBYTES\('SHA2_256',d.before_definition\)/);assert.match(sql,/STUFF\(@original,@first,6,N'ALTER'\)/);assert.match(sql,/headerNormalizedRecoveryHash/);
  assert.match(sql,/OBJECT_ID\(N'dbo.'\+d.name\) IS NULL OR OBJECT_DEFINITION\(OBJECT_ID\(N'dbo.'\+d.name\)\) IS NULL/);
  assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM|DISABLE TRIGGER|GRANT |RESTORE DATABASE|UPDATE dbo.test_crm_order_opening_definitions/i);
  assert.match(sql,/CRM_TEST_RECOVERY_READ_MISMATCH/);assert.doesNotMatch(sql,/EXEC sys.sp_executesql N'[^']*usp_test_crm_order_read/);
 }
 assert.match(before,/SELECT @statement=recovery_definition FROM @restore/);assert.match(before,/CRM_TEST_RECOVERY_BEFORE_MISMATCH/);
 assert.match(after,/SET @statement=N'ALTER PROCEDURE dbo.usp_test_crm_order_context/);assert.match(after,/CRM_TEST_RECOVERY_AFTER_MISMATCH/);
 assert.equal((before.match(/EXEC sys.sp_executesql @statement/g)||[]).length,2);assert.equal((after.match(/EXEC sys.sp_executesql @statement/g)||[]).length,2);
});
import {fileURLToPath} from 'node:url';
