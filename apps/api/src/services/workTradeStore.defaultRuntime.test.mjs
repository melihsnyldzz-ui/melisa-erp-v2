import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import * as model from './workSalesModel.mjs';
import {GOAL8_DAY_SQL_PROFILE_META} from './goal8DaySqlProof.mjs';

// The real private default factory, owner availability predicate and Goal8
// validator run together. Only driver/engine imports and startup witnesses are
// synthetic inside this disposable VM. No production grant/export is added.
const source=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
const code=source('./canonicalBusinessSessionContext.mjs')+'\n'+source('./goal8DayProfile.mjs')+'\n'+source('./workTradeStore.mjs').replace(/\bimport\(/g,'__import(');
function fixture({admission=true,session=true,writesEnabled=true,canonicalDatabase=true}={}){
 const events=[],actor={id:'17',username:'unified-semih-test',role:{id:'17',code:'unified_test_semih'},isActive:true,isAdmin:false,permissions:['sales.view','sales.create','sales.finalize','sales.cancel']};
 const hash='A'.repeat(64),profile={schemaVersion:'melisa-canonical-business-sale-admission.v1',profileHash:hash,assertDefinitionHash:hash,beginDefinitionHash:hash,contextDefinitionHash:hash,effectsDefinitionHash:hash,legacyProof:{readyHash:hash,contextHash:hash,effectsHash:hash}};
 const env={MELISA_CANONICAL_TEST:'true',SQL_DATABASE:'MELISA_ERP_SIRKET_TEST_20260929_01',SQL_SERVER:'127.0.0.1',SQL_PORT:'1433',SQL_USER:'melisa_sirket_sales_test_20260929_01',SQL_READ_ONLY:'false',SQL_TRUSTED_CONNECTION:'false',API_PORT:'4144',MELISA_TEST_PROTECTED_SESSION_PATH:'C:\\Sirket\\ERP\\runtime\\UNIFIED-5244-SEMIH-20261027\\grants.json',MELISA_BUSINESS_SESSION_SECRET:'F'.repeat(64),JWT_ACCESS_SECRET:'different-fixture-only',MELISA_GOAL8_SYNTHETIC_DAY:'true',MELISA_GOAL8_SQL_PROFILE_INSTALLED:'true',MELISA_GOAL8_SYNTHETIC_DAY_SEAL:JSON.stringify({...GOAL8_DAY_SQL_PROFILE_META,sourceCommit:'a'.repeat(40),packageId:'CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029'})};
 const unavailable=name=>()=>{events.push(name);assert.fail('Native SQL or invoice engine is unavailable in this fixture');};
 const pool={fixtureOnly:true},driver={Transaction:unavailable('transaction'),Request:unavailable('request')},database={isIsolatedOperationCopyRuntime:()=>false,isCanonicalTest:()=>canonicalDatabase,getSqlPool:async()=>{events.push('pool');return pool;},getSqlDriver:()=>driver};
 const modules={
  '../config/database.js':database,
  './invoiceDraftService.js':{createSalesDraft:unavailable('invoice-create')},
  './financeService.js':{writeFinanceAccountMovement:unavailable('finance-write')},
  './auditService.js':{writeAuditLog:unavailable('audit-write')},
  './testSalesScope.mjs':{withTestSalesMutation:unavailable('mutation')},
  './periodLockService.js':{assertPeriodOpen:unavailable('period')},
  './workTradeSqlProof.mjs':{WORK_TRADE_SQL_PROOF:profile.legacyProof}
 };
 const sandbox={...model,createHash,Buffer,structuredClone,GOAL8_DAY_SQL_PROFILE_META,process:{env},__actor:actor,__env:env,__profile:profile,__admission:admission,__session:session,__writes:writesEnabled,__trace:events,__import:async name=>{events.push('import:'+name);assert(Object.hasOwn(modules,name),'Unexpected production import '+name);return modules[name];}};
 vm.createContext(sandbox);vm.runInContext(code+String.raw`
if(__session){registered=Object.freeze({username:BUSINESS_SESSION.username,roleCode:BUSINESS_SESSION.roleCode,permissions:Object.freeze([...__actor.permissions])});environments.set(registered,__env);}
__profile.readerDefinitions=Object.fromEntries(CANONICAL_BUSINESS_SALE_READER_MODULES.map(n=>[n,__profile.profileHash]));
registeredLegacySaleProof=__profile.legacyProof;registeredSaleDefinitionHashes=__profile.readerDefinitions;
if(__session&&__admission)configureCanonicalBusinessSaleAdmission(registered,__profile,{writesEnabled:__writes});
const originalGoal8DayEnabled=goal8DayEnabled,originalGoal8SqlProfileInstalled=goal8SqlProfileInstalled;
goal8DayEnabled=(...args)=>{__trace.push('goal8-day');return originalGoal8DayEnabled(...args);};
goal8SqlProfileInstalled=(...args)=>{__trace.push('goal8-sql');return originalGoal8SqlProfileInstalled(...args);};
globalThis.api={defaultRuntime,createWorkTradeStore,isCanonicalBusinessSaleAvailable,getCanonicalBusinessSaleAdmission};
`,sandbox);
 return {api:sandbox.api,actor,events,pool,env};
}
const legacyError={code:'GOAL8_PROFILE_UNAVAILABLE',statusCode:503};
test('actual default factory admits protected normal17 context without consulting an incompatible legacy Goal8 day seal',async()=>{
 const f=fixture();assert.equal(f.api.isCanonicalBusinessSaleAvailable(f.actor),true);
 const runtime=await f.api.defaultRuntime(f.actor);assert.equal(runtime.goal8DayProfile,false);assert.equal(runtime.pool,f.pool);assert.equal(f.events.includes('goal8-day'),false);assert.equal(f.events.includes('goal8-sql'),false);
 f.events.length=0;const context=await f.api.createWorkTradeStore().context(f.actor);
 assert.equal(context.meta.source,'canonical-business-test');assert.equal(context.capabilities.canCreate,true);assert.equal(context.revision,'0'.repeat(64));assert.equal(context.scope.customer,null);assert.deepEqual(f.events.filter(e=>!e.startsWith('import:')),['pool']);
});
test('actual default native factory cannot replace the SQL owner proof, enable finance, or widen a readonly native profile',async()=>{
 const f=fixture(),store=f.api.createWorkTradeStore();
 await assert.rejects(store.read(f.actor,c=>c.selectedSaleContext({customerId:'155',customerAccountId:'7',currency:'USD',documentDate:'2026-10-28',items:[{productId:'12',quoteId:'81',quantityExact3:'1.000'}]})),{code:'CANONICAL_BUSINESS_SALE_ADMISSION_REQUIRED'});
 await assert.rejects(store.mutate(f.actor,'collection_create',{},()=>assert.fail('Foreign writer callback')),{code:'WORK_FORBIDDEN'});
 assert.equal(f.events.some(e=>e==='goal8-day'||e==='goal8-sql'||e==='transaction'||e==='request'||e.endsWith('-write')||e==='invoice-create'||e==='mutation'),false);
 const readonly=fixture({writesEnabled:false}),context=await readonly.api.createWorkTradeStore().context(readonly.actor);assert.equal(context.capabilities.canCreate,false);assert.equal(context.capabilities.canFinalize,false);assert.equal(context.capabilities.canCancel,false);
});
test('actor16, missing actor, wrong normal17 identity or stale permissions retain the original strict legacy seal in the actual factory',async()=>{
 const f=fixture();
 const wrong=[undefined,{...f.actor,id:'16',testAdminSession:true},{...f.actor,username:'other'},{...f.actor,role:{id:'17',code:'other'}},{...f.actor,permissions:['sales.view']},{...f.actor,isAdmin:true}];
 for(const actor of wrong){f.events.length=0;assert.equal(f.api.isCanonicalBusinessSaleAvailable(actor),false);await assert.rejects(f.api.defaultRuntime(actor),legacyError);assert.equal(f.events.filter(e=>e==='goal8-day').length,1);assert.equal(f.events.includes('pool'),false);}
 for(const opts of [{admission:false},{session:false}]){const missing=fixture(opts);assert.equal(missing.api.isCanonicalBusinessSaleAvailable(missing.actor),false);await assert.rejects(missing.api.defaultRuntime(missing.actor),legacyError);assert.equal(missing.events.includes('pool'),false);}
 const valid=fixture();valid.env.MELISA_GOAL8_SYNTHETIC_DAY_SEAL=JSON.stringify({...GOAL8_DAY_SQL_PROFILE_META,sourceCommit:'a'.repeat(40),packageId:'CANONICAL-TEST-FIXTURE'});
 const legacy=await valid.api.defaultRuntime({...valid.actor,id:'16'});assert.equal(legacy.goal8DayProfile,true);assert.equal(valid.events.filter(e=>e==='goal8-day').length,1);assert.equal(valid.events.filter(e=>e==='pool').length,1);
});
test('registered but unadmitted normal17 fails before default runtime and native target drift never becomes a legacy bypass',async()=>{
 for(const actorPatch of [{username:'other'},{role:{id:'17',code:'other'}},{permissions:['sales.view']}]){const f=fixture(),actor={...f.actor,...actorPatch};await assert.rejects(f.api.createWorkTradeStore().context(actor),{code:'WORK_UNAVAILABLE'});assert.deepEqual(f.events,[]);}
 const missing=fixture({admission:false});await assert.rejects(missing.api.createWorkTradeStore().context(missing.actor),{code:'WORK_UNAVAILABLE'});assert.deepEqual(missing.events,[]);
 const wrongDatabase=fixture({canonicalDatabase:false});await assert.rejects(wrongDatabase.api.createWorkTradeStore().context(wrongDatabase.actor),{code:'WORK_UNAVAILABLE'});assert.equal(wrongDatabase.events.includes('pool'),false);assert.equal(wrongDatabase.events.includes('goal8-day'),false);
 const drift=fixture();drift.env.SQL_DATABASE='outside';await assert.rejects(drift.api.defaultRuntime(drift.actor),{code:'AUTH_BUSINESS_TEST_TARGET_INVALID'});assert.equal(drift.events.includes('pool'),false);
});
test('injected legacy runtime keeps its original zero-argument contract while canonical runtime receives the verified actor',async()=>{
 const f=fixture(),calls=[],sentinel=Error('fixture runtime boundary');
 const legacy=f.api.createWorkTradeStore({getRuntime:async(...args)=>{calls.push(args);throw sentinel;}});
 await assert.rejects(legacy.context({...f.actor,id:'16'}),e=>e===sentinel);assert.equal(calls.length,1);assert.equal(calls[0].length,0);
 const native=f.api.createWorkTradeStore({getRuntime:async(...args)=>{calls.push(args);return {sql:{},pool:{}};}});const context=await native.context(f.actor);assert.equal(context.meta.source,'canonical-business-test');assert.equal(calls[1].length,1);assert.equal(calls[1][0],f.actor);assert.deepEqual(f.events,[]);
});
