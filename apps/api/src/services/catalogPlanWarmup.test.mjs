import test from 'node:test';
import assert from 'node:assert/strict';
import {warmCatalogPlan} from './catalogPlanWarmup.mjs';
import {readFile} from 'node:fs/promises';
import {createContext,SourceTextModule,SyntheticModule} from 'node:vm';
const db='MELISA_ERP_SIRKET_TEST_20260929_01',login='melisa_sirket_sales_test_20260929_01';
const context=()=>({mode:'erp',port:4144,writes:true,env:{sql:{database:db}},identity:{databaseName:db,serverName:'Semih\\MELISADEV',loginName:login,databaseUser:login,sysadmin:0,databaseControl:0,liveDatabaseAccess:0}});
const card=id=>({id:String(id),stockCode:'P'+id,displayCode:'P'+id,classification:{brand:null,productType:null,sourceName:'Ürün',verified:true},productName:'Ürün',isActive:true,stockQuantityExact:null,unit:{label:null,sourceId:null,factorExact8:null,verified:false},barcodes:[],imageUrl:null,provenance:{kind:'accepted-opening',sourceKey:`VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/${id}`,runId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30',verified:true},hold:{blocked:false,reasons:[]},salePrices:[],photo:{status:'missing',url:null,sourceKey:null,verified:false}});
function fixture(){const calls=[],user={id:16,permissions:['product.view','sales.view']},state={user,listRows:Array.from({length:50},(_,i)=>card(i+100)),detailError:false,sqlSales:true};
 const dependencies={getUser:async id=>{calls.push({actorLookup:id});return state.user;},getStore:async()=>({readCatalogProducts:async input=>{calls.push(input);if(input.productId!==null&&state.detailError)throw Error('PRIVATE SQL failure');return {actorId:input.actorId,canViewSalesPrices:state.sqlSales,total:input.productId===null?16676:1,page:1,limit:input.options.limit,readAt:'2026-10-05T08:00:00.000Z',acceptedCount:16622,syntheticCount:0,quarantinedCount:54,filters:{brands:[],productTypes:[]},rows:input.productId===null?state.listRows:[card(input.productId)]};}})};return {calls,state,dependencies};}
test('same guarded reader warms list50 then one dynamic accepted detail; results not cached',async()=>{const f=fixture();f.state.listRows[0].hold={blocked:true,reasons:['IDENTITY_AMBIGUOUS']};f.state.listRows[0].provenance.kind='quarantined-source';f.state.listRows[0].classification={brand:null,productType:null,sourceName:null,verified:false};assert.deepEqual(await warmCatalogPlan(context(),f.dependencies),{warmed:true});assert.equal(f.calls[0].actorLookup,'16');assert.equal(f.calls[1].productId,null);assert.equal(f.calls[1].options.limit,50);assert.equal(f.calls[2].productId,'101');assert.equal(f.calls[2].options.limit,1);assert.equal(f.calls[2].actorId,'16');assert.equal(f.calls.length,3);});
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
test('ODBC retain-min1 applies to canonical writable ERP4144 and registered copy4154; readonly/LIVE configs unchanged',async()=>{
 // Execute the actual config source with inert drivers; no native addon or SQL.
 const source=await readFile(new URL('../config/database.js',import.meta.url),'utf8'),env={port:4144,sql:{database:db,user:login,readOnly:false,trustedConnection:false,server:'127.0.0.1',port:1433,odbcDriver:'ODBC Driver 18 for SQL Server',password:'fixture-only',encrypt:false,trustServerCertificate:true}},process={env:{MELISA_CANONICAL_TEST:'true',MELISA_TEST_SCOPED_SALES:'true'}};
 const copyState={write:false,read:false},sqlDefault={},sqlTrusted={};
 const sandbox=createContext({process}),dependencies=new Map();
 const dependency=(specifier,exports)=>{const module=new SyntheticModule(Object.keys(exports),function(){for(const [key,value]of Object.entries(exports))this.setExport(key,value);},{context:sandbox});dependencies.set(specifier,module);return module;};
 dependency('mssql',{default:sqlDefault});dependency('./env.js',{env});
 dependency('./isolatedOperationCopyRuntime.mjs',{isIsolatedOperationCopyRuntime:()=>copyState.write,getIsolatedOperationCopyConfig:()=>{throw Error('Config-only test must not open a pool');},isIsolatedCopyReadonlyRuntime:()=>copyState.read,getIsolatedCopyReadonlyRuntime:()=>{throw Error('Config-only test must not open a pool');}});
 const topology=dependency('../services/isolatedOperationCopyContext.mjs',{isolatedCopyTopology:()=>{throw Error('Config-only test must not open a pool');}});
 dependency('../services/crmOrderCurrentContext.mjs',{getCrmOrderCurrentContext:()=>null,assertCrmOrderCurrentIdentity:()=>{throw Error('Config-only test must not open a pool');}});
 dependency('../services/cleanSyntheticContext.mjs',{getCleanContext:()=>null,assertRegisteredCleanContext:()=>{throw Error('Config-only test must not open a pool');},assertCleanIdentity:()=>{throw Error('Config-only test must not open a pool');},CLEAN_IDENTITY_SQL:'config-only-no-query'});
 const native=dependency('mssql/msnodesqlv8.js',{default:sqlTrusted});for(const inert of [native,topology]){await inert.link(()=>{throw Error('No native imports allowed');});await inert.evaluate();}
 const module=new SourceTextModule(source,{context:sandbox,importModuleDynamically:async specifier=>{assert.ok(['mssql/msnodesqlv8.js','../services/isolatedOperationCopyContext.mjs'].includes(specifier),'Unknown dynamic database dependency: '+specifier);return dependencies.get(specifier);}});
 await module.link(specifier=>{assert.ok(dependencies.has(specifier),'Unknown database dependency: '+specifier);return dependencies.get(specifier);});await module.evaluate();
 const {getSqlConfig,getSqlDriver}=module.namespace;
  assert.deepEqual(JSON.parse(JSON.stringify(getSqlConfig().pool)),{max:10,min:1,idleTimeoutMillis:30000});
  env.port=4146;env.sql.user='melisa_sirket_test_20260929_01';env.sql.readOnly=true;assert.equal(getSqlConfig().pool,undefined);
  env.sql.database='MELISA_ERP_PROD_CANDIDATE_20260917_01';env.port=4114;assert.equal(getSqlConfig().pool,undefined);
  env.sql.database=db;env.sql.user=login;env.sql.readOnly=false;env.port=4144;process.env.MELISA_CANONICAL_TEST='false';assert.deepEqual(JSON.parse(JSON.stringify(getSqlConfig().pool)),{max:5,min:0,idleTimeoutMillis:30000});
  env.sql.database='MELISA_ERP_STAGE04_COPY_TEST_20261008_01';env.sql.user='melisa_stage4_copy_rw_20261008_01';env.port=4154;copyState.write=true;
  assert.deepEqual(JSON.parse(JSON.stringify(getSqlConfig().pool)),{max:10,min:1,idleTimeoutMillis:30000});assert.equal(getSqlDriver(),sqlTrusted);
  copyState.write=false;copyState.read=true;env.sql.user='melisa_stage4_copy_ro_20261008_01';env.sql.readOnly=true;env.port=4156;
  assert.equal(getSqlConfig().pool,undefined);assert.equal(getSqlDriver(),sqlTrusted);
});
