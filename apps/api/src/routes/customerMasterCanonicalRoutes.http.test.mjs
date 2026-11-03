import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

if(!process.execArgv.includes('--experimental-test-module-mocks')){
 test('canonical customer HTTP fixture runs with isolated module mocks and offline guard',()=>{
  const guard=fileURLToPath(new URL('../../../../scripts/ci/offline-guard.cjs',import.meta.url));
  const result=spawnSync(process.execPath,['--require',guard,'--experimental-test-module-mocks','--test',fileURLToPath(import.meta.url)],{encoding:'utf8',windowsHide:true,timeout:30000});
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 });
}else{

// Only external providers are substituted. The production requireAuth,
// permission middleware, quarantine gate and Express router stack are real.
// No Windows process, native SQL, protected credential or server is used.
const editor={id:17,username:'unified-semih-test',role:{id:17,code:'unified_test_semih'},permissions:['customer.view','customer.edit']};
const users={editor,viewer:{id:18,permissions:['customer.view']},native:{...editor},admin:{...editor,isAdmin:true},wrongRole:{...editor,role:{id:2,code:'admin'}},changed:{...editor,permissions:[...editor.permissions,'product.edit']}};
let held=false;const holds=[];let writes=0;
mock.module('../services/authService.js',{namedExports:{
 verifyAccessToken(token){if(!users[token])throw Object.assign(Error('invalid'),{statusCode:401,code:'AUTH_INVALID'});return {sub:token,...(token==='native'?{nativeTerminalCode:'fixture-zebra'}:{})};},
 async getUserById(id){return users[id];},verifyNormalTestAccessSession(payload,user){if(users[payload.sub]!==user)throw Error('actor mismatch');}
}});
const originalBusiness=await import('../services/canonicalBusinessSessionContext.mjs');
let sessionAvailable=true;
const business={...originalBusiness.BUSINESS_SESSION,actualT1:false,externalOperations:false,permissions:editor.permissions};
mock.module('../services/canonicalBusinessSessionContext.mjs',{namedExports:{...originalBusiness,getCanonicalBusinessSession:()=>sessionAvailable?business:null,assertCanonicalBusinessSession:context=>{if(context!==business||!sessionAvailable)throw Error('not registered');return context;}}});
mock.module('../services/operationQuarantineService.js',{namedExports:{
 async assertOperationQuarantineAllowed(rows){holds.push(rows);if(held)throw Object.assign(Error('held'),{statusCode:409,code:'MIGRATION_ENTITY_QUARANTINED'});},
 operationQuarantineService:{},quarantineTransactionContext(){throw Error('not used');}
}});
const legacy=(_req,res)=>res.status(503).json({source:'legacy'});
const oldNames=['getCustomer','getCustomerCard','getCustomerCards','getCustomerContact','getCustomerContactRequest','postCustomerContact','getCustomers','getVegaCustomers','patchCustomerPassive','postCashCustomersEnsure','postCustomer','putCustomer'];
const legacyRead=(_req,res)=>res.json({source:'legacy-readonly'});
mock.module('../controllers/customerController.js',{namedExports:Object.fromEntries(oldNames.map(name=>[name,['getCustomerCard','getCustomerCards'].includes(name)?legacyRead:legacy]))});
const {createCustomerMasterCanonicalRoutes}=await import('./customerMasterCanonicalRoutes.mjs');
const {customerRoutes}=await import('./customerRoutes.js');
const {prepareCanonicalCustomerMasterMetadata,prepareCanonicalCustomerMasterWriter}=await import('../services/customerMasterMetadataBootstrap.mjs');
const {customerMasterMetadataFixture}=await import('../services/customerMasterMetadata.test-fixture.mjs');
const {customerMasterSqlFixture}=await import('../services/customerMasterSql.test-fixture.mjs');
const {isCanonicalTestWriteAllowed}=await import('../services/canonicalTestRoutePolicy.mjs');
const binding={service:{context:async()=>({source:'canonical'}),recover:async()=>({source:'canonical'}),update:async()=>{writes++;return {source:'canonical'};}},cards:{list:async()=>({data:[{source:'canonical'}]}),detail:async()=>({data:{source:'canonical'}})}};
async function server(order){const app=express();app.use(express.json());for(const name of order)app.use('/api',name==='canonical'?createCustomerMasterCanonicalRoutes(binding):customerRoutes);app.use((e,_q,s,_n)=>s.status(e.statusCode??500).json({code:e.code}));const s=app.listen(0,'127.0.0.1');await new Promise(r=>s.once('listening',r));return {fetch:(path,options={})=>fetch(`http://127.0.0.1:${s.address().port}/api${path}`,options),async close(){s.closeAllConnections();await new Promise(r=>s.close(r));}};}
const auth=token=>({authorization:`Bearer ${token}`,'content-type':'application/json'});
test('real HTTP auth and enabled quarantine gate reject before the canonical handler',async()=>{
 const beforeEnv=process.env.MELISA_CANONICAL_TEST;process.env.MELISA_CANONICAL_TEST='true';held=true;holds.length=0;writes=0;const s=await server(['canonical']);
 try{
  assert.equal((await s.fetch('/customers/100/master',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,401);
  assert.equal((await s.fetch('/customers/100/master',{method:'POST',headers:auth('viewer'),body:'{}'})).status,403);
  assert.equal(holds.length,0);assert.equal(writes,0);
  const rejected=await s.fetch('/customers/100/master',{method:'POST',headers:auth('editor'),body:'{}'});assert.equal(rejected.status,409);assert.equal((await rejected.json()).code,'MIGRATION_ENTITY_QUARANTINED');assert.deepEqual(holds,[[{entity:'customer',nativeId:'100'}]]);assert.equal(writes,0);
  held=false;assert.equal((await s.fetch('/customers/100/master',{method:'POST',headers:auth('editor'),body:'{}'})).status,200);assert.equal(writes,1);
 }finally{await s.close();if(beforeEnv===undefined)delete process.env.MELISA_CANONICAL_TEST;else process.env.MELISA_CANONICAL_TEST=beforeEnv;}
});
test('canonical route must be mounted before overlapping legacy routes',async()=>{
 for(const [order,expected] of [[['canonical','legacy'],'canonical'],[['legacy','canonical'],'legacy-readonly']]){const s=await server(order);try{const r=await s.fetch('/customers/100/card',{headers:auth('viewer')});const body=await r.json();assert.equal(expected==='canonical'?body.data.source:body.source,expected);assert.equal(r.status,200);}finally{await s.close();}}
});
test('direct master API denies terminal, admin, wrong role, permission drift and missing registered session',async()=>{
 const s=await server(['canonical']);const paths=[['GET','/customers/100/master'],['GET','/customers/100/master/requests/11111111-1111-4111-8111-111111111111'],['POST','/customers/100/master']];const before=writes;holds.length=0;held=false;
 try{for(const token of ['native','admin','wrongRole','changed'])for(const [method,path] of paths){const options={method,headers:auth(token),...(method==='POST'?{body:'{}'}:{})};assert.equal((await s.fetch(path,options)).status,403,token+' '+path);}
  sessionAvailable=false;for(const [method,path] of paths)assert.equal((await s.fetch(path,{method,headers:auth('editor'),...(method==='POST'?{body:'{}'}:{})})).status,403);sessionAvailable=true;
  assert.equal(holds.length,0);assert.equal(writes,before);assert.equal((await s.fetch('/customers/100/master',{headers:auth('editor')})).status,200);
 }finally{sessionAvailable=true;await s.close();}
});
test('explicit startup selection additionally requires the registered actor and two unchanged normal transaction frames',async()=>{
 async function startupFixture(){const metadata=await customerMasterMetadataFixture(),native=customerMasterSqlFixture({normal:true}),o=native.normalOptions;native.modes.dbRole={id:17,code:'unified_test_semih'};
  const MetadataRequest=metadata.runtime.sql.Request,nativeSql=o.database.getSqlDriver(),NativeRequest=nativeSql.Request;
  class Request extends MetadataRequest{constructor(parent){super(parent);this.delegate=parent===metadata.pool?null:new NativeRequest(parent);}input(...args){this.delegate.input(...args);return this;}query(sql){return this.delegate?this.delegate.query(sql):super.query(sql);}execute(name){return this.delegate.execute(name);}}
  const driver={...nativeSql,Request};metadata.pool.request=()=>new Request(metadata.pool);o.database.getSqlDriver=()=>driver;o.database.getSqlPool=async()=>{throw Error('new pool forbidden');};o.startup={...o.startup,pool:metadata.pool,config:{customerMasterWritesEnabled:true},businessSession:business};return {metadata,native,o};}
 const yes=await startupFixture(),before=yes.native.snapshot(),router=await prepareCanonicalCustomerMasterWriter(yes.o);assert(router?.stack?.some(l=>l.route?.path==='/customers/:id/master'&&l.route.methods.post));assert.deepEqual(yes.native.snapshot(),before);assert.equal(yes.metadata.calls.length,3);assert.equal(yes.native.calls.filter(c=>c[0]==='query'&&c[1].includes('customer-master:normal-frame')).length,2);assert(!yes.native.calls.some(c=>c[0]==='reader'||c[0]==='finance'));
 const no=await startupFixture(),snapshot=no.native.snapshot();no.native.modes.frame={schemaValid:false};assert.equal(await prepareCanonicalCustomerMasterWriter(no.o),null);assert.deepEqual(no.native.snapshot(),snapshot);assert.equal(no.native.calls.filter(c=>c[0]==='query'&&c[1].includes('customer-master:normal-frame')).length,1);
 const missing=await startupFixture();sessionAvailable=false;try{assert.equal(await prepareCanonicalCustomerMasterWriter(missing.o),null);assert.equal(missing.native.calls.length,0);}finally{sessionAvailable=true;}
});
test('unknown startup metadata leaves the existing read-only card and blocks POST even after a later GET',async()=>{
 const f=await customerMasterMetadataFixture(),o=customerMasterSqlFixture({normal:true}).normalOptions;o.database.getSqlPool=async()=>{throw Error('new pool forbidden');};o.database.getSqlDriver=()=>f.runtime.sql;o.startup={...o.startup,pool:f.pool,config:{customerMasterWritesEnabled:true}};
 f.catalog[1][0].objectId=null;const reader=await prepareCanonicalCustomerMasterMetadata(o),router=await prepareCanonicalCustomerMasterWriter(o);assert.equal(router,null);
 const app=express();app.use(express.json());app.get('/api/fixture-metadata',async(_q,s)=>s.json(await reader.read()));app.use((req,res,next)=>{if(req.method==='POST'&&!isCanonicalTestWriteAllowed(req.method,req.path,{mode:'erp',writes:true,protectedNormalAuth:true,customerMasterWriterReady:!!router}))return res.status(405).json({code:'TEST_WRITE_OUTSIDE_SCOPE'});next();});if(router)app.use('/api',router);app.use('/api',customerRoutes);app.use((e,_q,s,_n)=>s.status(e.statusCode??500).json({code:e.code}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 try{assert.equal((await (await fetch(base+'/api/customers/100/card',{headers:auth('viewer')})).json()).source,'legacy-readonly');assert.equal((await fetch(base+'/api/customers/100/master',{method:'POST',headers:auth('editor'),body:'{}'})).status,405);assert.equal((await fetch(base+'/api/fixture-metadata')).status,200);assert.equal((await (await fetch(base+'/api/customers/100/card',{headers:auth('viewer')})).json()).source,'legacy-readonly');assert.equal((await fetch(base+'/api/customers/100/master',{method:'POST',headers:auth('editor'),body:'{}'})).status,405);assert.equal(router,null);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
}
