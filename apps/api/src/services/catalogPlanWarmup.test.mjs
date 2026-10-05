import test from 'node:test';
import assert from 'node:assert/strict';
import {warmCatalogPlan} from './catalogPlanWarmup.mjs';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const db='MELISA_ERP_SIRKET_TEST_20260929_01',login='melisa_sirket_sales_test_20260929_01';
const context=()=>({mode:'erp',port:4144,writes:true,env:{sql:{database:db}},identity:{databaseName:db,serverName:'Semih\\MELISADEV',loginName:login,databaseUser:login,sysadmin:0,databaseControl:0,liveDatabaseAccess:0}});
const card=id=>({id:String(id),stockCode:'P'+id,productName:'Ürün',isActive:true,stockQuantityExact:null,unit:{label:null,sourceId:null,factorExact8:null,verified:false},barcodes:[],imageUrl:null,provenance:{kind:'accepted-opening',sourceKey:`VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/${id}`,runId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30',verified:true},hold:{blocked:false,reasons:[]},salePrices:[],photo:{status:'missing',url:null,sourceKey:null,verified:false}});
function fixture(){const calls=[],user={id:16,permissions:['product.view','sales.view']},state={user,listRows:Array.from({length:50},(_,i)=>card(i+100)),detailError:false,sqlSales:true};
 const dependencies={getUser:async id=>{calls.push({actorLookup:id});return state.user;},getStore:async()=>({readCatalogProducts:async input=>{calls.push(input);if(input.productId!==null&&state.detailError)throw Error('PRIVATE SQL failure');return {actorId:input.actorId,canViewSalesPrices:state.sqlSales,total:input.productId===null?16676:1,page:1,limit:input.options.limit,readAt:'2026-10-05T08:00:00.000Z',acceptedCount:16622,syntheticCount:0,quarantinedCount:54,rows:input.productId===null?state.listRows:[card(input.productId)]};}})};return {calls,state,dependencies};}
test('same guarded reader warms list50 then one dynamic accepted detail; results not cached',async()=>{const f=fixture();f.state.listRows[0].hold={blocked:true,reasons:['IDENTITY_AMBIGUOUS']};f.state.listRows[0].provenance.kind='quarantined-source';assert.deepEqual(await warmCatalogPlan(context(),f.dependencies),{warmed:true});assert.equal(f.calls[0].actorLookup,'16');assert.equal(f.calls[1].productId,null);assert.equal(f.calls[1].options.limit,50);assert.equal(f.calls[2].productId,'101');assert.equal(f.calls[2].options.limit,1);assert.equal(f.calls[2].actorId,'16');assert.equal(f.calls.length,3);});
test('wrong mode, port, identity and SQL privilege info reject before actor/store reads',async()=>{
 for(const change of [{mode:'native'},{port:4114},{writes:false},{env:{sql:{database:'LIVE'}}}]){const f=fixture();await assert.rejects(()=>warmCatalogPlan({...context(),...change},f.dependencies),{code:'CATALOG_STARTUP_UNAVAILABLE'});assert.equal(f.calls.length,0);}
 for(const change of [{databaseName:'LIVE'},{serverName:'other'},{sysadmin:1},{databaseControl:1},{liveDatabaseAccess:1},{loginName:'other'},{databaseUser:'other'}]){const f=fixture(),c=context();Object.assign(c.identity,change);await assert.rejects(()=>warmCatalogPlan(c,f.dependencies));assert.equal(f.calls.length,0);}
});
test('existing actor and permissions are mandatory; no grants or fallback actor',async()=>{
 for(const user of [{id:14,permissions:['product.view','sales.view']},{id:16,permissions:['product.view']},{id:16,permissions:['sales.view']},{id:16,permissions:null}]){const f=fixture();f.state.user=user;await assert.rejects(()=>warmCatalogPlan(context(),f.dependencies));assert.equal(f.calls.length,1);}
});
test('SQL role revoke, malformed id/page and detail errors stop readiness with sanitized error',async()=>{
 for(const mutate of [f=>{f.state.sqlSales=false;},f=>{f.state.listRows[0].id='90071992547409930x';},f=>{f.state.listRows.pop();},f=>{f.state.detailError=true;}]){const f=fixture();mutate(f);await assert.rejects(()=>warmCatalogPlan(context(),f.dependencies),e=>e.code==='CATALOG_STARTUP_UNAVAILABLE'&&!e.message.includes('PRIVATE'));}
});
test('ODBC retain-min1 applies only canonical writable ERP4144; native/LIVE configs unchanged',async()=>{
 // Execute the actual config source with inert drivers; no native addon or SQL.
 const source=await readFile(new URL('../config/database.js',import.meta.url),'utf8'),env={port:4144,sql:{database:db,user:login,readOnly:false,trustedConnection:false,server:'127.0.0.1',port:1433,odbcDriver:'ODBC Driver 18 for SQL Server',password:'fixture-only',encrypt:false,trustServerCertificate:true}},process={env:{MELISA_CANONICAL_TEST:'true',MELISA_TEST_SCOPED_SALES:'true'}};
 const {getSqlConfig}=runInNewContext(source.replace(/^import .*;\r?$/gm,'').replace(/^export /gm,'')+'\n({getSqlConfig})',{env,process,sqlDefault:{},sqlTrusted:{}});
  assert.deepEqual(JSON.parse(JSON.stringify(getSqlConfig().pool)),{max:10,min:1,idleTimeoutMillis:30000});
  env.port=4146;env.sql.user='melisa_sirket_test_20260929_01';env.sql.readOnly=true;assert.equal(getSqlConfig().pool,undefined);
  env.sql.database='MELISA_ERP_PROD_CANDIDATE_20260917_01';env.port=4114;assert.equal(getSqlConfig().pool,undefined);
  env.sql.database=db;env.sql.user=login;env.sql.readOnly=false;env.port=4144;process.env.MELISA_CANONICAL_TEST='false';assert.deepEqual(JSON.parse(JSON.stringify(getSqlConfig().pool)),{max:5,min:0,idleTimeoutMillis:30000});
});
