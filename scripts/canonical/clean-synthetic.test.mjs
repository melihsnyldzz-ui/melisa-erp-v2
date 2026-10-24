import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCleanSyntheticOrderSql} from './clean-synthetic-sql.mjs';
import {buildCrmV2InstallSql} from './crm-order-v2-sql.mjs';
import {assertCleanEnvironment,assertCleanIdentity,parseCleanMediaVariant,CLEAN_DATABASE,CLEAN_LOGIN,CLEAN_ENVIRONMENT_ID} from '../../apps/api/src/services/cleanSyntheticContext.mjs';
import {isCleanCatalogMeta,cleanCatalogEnvelope} from '../../apps/sites-workflow/src/workflow/cleanSyntheticCatalogModel.mjs';
import {resolveTestApiBase,shouldAutoOpenTestAdmin} from '../../apps/sites-workflow/src/workflow/testAdminSession.mjs';
import {cleanOrderDocument} from '../../apps/sites-workflow/src/workflow/cleanNativeOrders.js';
import {createWorkingCatalogSession} from '../../apps/sites-workflow/src/workflow/workingCatalogSession.mjs';
import {cleanPreviewRequestAllowed,cleanPreviewNetwork,cleanPreviewTailPeers} from '../../apps/sites-workflow/vite.config.mjs';
import {isCleanFinancePaymentTarget} from '../../apps/sites-workflow/src/workflow/workSupplierPaymentsModel.mjs';
import {cleanDailyControls} from '../../apps/sites-workflow/src/workflow/workDailyCopyModel.mjs';
const environment={MELISA_CLEAN_TEST:'20261022',SQL_SERVER:'127.0.0.1',SQL_PORT:'1433',SQL_DATABASE:CLEAN_DATABASE,SQL_USER:CLEAN_LOGIN,SQL_READ_ONLY:'false',API_PORT:'4194'};
const identity={databaseName:CLEAN_DATABASE,serverName:'Semih\\MELISADEV',loginName:CLEAN_LOGIN,databaseUser:CLEAN_LOGIN,sysadmin:0,databaseControl:0,originalDatabaseAccess:0,liveDatabaseAccess:0,environmentId:CLEAN_ENVIRONMENT_ID};
test('exact new target only; old or privileged identities fail closed',()=>{
 assert.doesNotThrow(()=>assertCleanEnvironment(environment));assert.doesNotThrow(()=>assertCleanIdentity(identity));
 for(const [key,value] of Object.entries({SQL_DATABASE:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',SQL_SERVER:'Semih\\MELISADEV',SQL_PORT:'1434',SQL_USER:'sa',API_PORT:'4184',SQL_READ_ONLY:'true',VEGA_SQL_SERVER:'anything',OPENAI_API_KEY:'example'}))assert.throws(()=>assertCleanEnvironment({...environment,[key]:value}));
 for(const key of ['sysadmin','databaseControl','originalDatabaseAccess','liveDatabaseAccess'])assert.throws(()=>assertCleanIdentity({...identity,[key]:1}));
 assert.throws(()=>assertCleanIdentity({...identity,environmentId:'different'}));
});
test('clean media accepts the requested original without URL/path or query aliases',()=>{
 for(const variant of ['original','preview','thumbnail'])assert.equal(parseCleanMediaVariant({variant}),variant);
 for(const query of [{},{variant:'../original'},{variant:'original',path:'other'},{variant:['original']},null,[],{variant:'ORIGINAL'}])assert.throws(()=>parseCleanMediaVariant(query));
});
test('existing SQL engine keeps transaction/replay/immutable guards and no business-source claim',()=>{
 const legacy=buildCrmV2InstallSql(),clean=buildCleanSyntheticOrderSql();assert.equal(buildCrmV2InstallSql(),legacy);
 assert.match(legacy,/MELISA_ERP_SIRKET_TEST_20260929_01/);assert.doesNotMatch(clean,/MELISA_ERP_SIRKET_TEST_20260929_01|accepted_price_|VEGA_CAPTURE_|melisa_sirket_sales_test/);
 for(const text of ['SERIALIZABLE','sp_getapplock','CRM_V2_REQUEST_CONFLICT','CRM_V2_CUSTOMER_CHANGED','CRM_V2_PRODUCT_CHANGED','INSERT dbo.sales_orders','INSERT dbo.sales_order_items','crm_order_v2_requests_immutable','SYNTHETIC/20261022/products/'])assert.ok(clean.includes(text),text);
 assert.match(clean,/CREATE PROCEDURE dbo.usp_test_crm_order_v2_create/);assert.match(clean,/environment_id='e662fd94/);
});
test('new UI pair is finite and never opens test admin automatically',()=>{
 const location={protocol:'http:',hostname:'127.0.0.1',port:'5244'};
 assert.equal(resolveTestApiBase({location,apiBase:'http://127.0.0.1:4194'}),'http://127.0.0.1:4194');
 assert.equal(resolveTestApiBase({location,apiBase:'http://127.0.0.1:4184'}),null);
 assert.equal(shouldAutoOpenTestAdmin({location,apiBase:'http://127.0.0.1:4194'}),false);
 for(const hostname of ['192.168.1.46','100.87.188.3']){
  assert.equal(resolveTestApiBase({location:{...location,hostname},apiBase:'http://127.0.0.1:4194'}),`http://${hostname}:5244`);
  assert.equal(shouldAutoOpenTestAdmin({location:{...location,hostname},apiBase:'http://127.0.0.1:4194'}),false);
 }
 for(const hostname of ['192.168.1.47','100.87.188.4','example.com'])assert.equal(resolveTestApiBase({location:{...location,hostname},apiBase:'http://127.0.0.1:4194'}),null);
});
test('clean network gate requires the installed profile and both exact interfaces',()=>{
 const env={MELISA_CLEAN_TEST:'20261022',MELISA_CLEAN_UI_NETWORK:'lan-tailscale-20261022',MELISA_CLEAN_UI_TAILSCALE_PEERS:'100.120.1.2'},interfaces={lan:[{family:'IPv4',internal:false,address:'192.168.1.46',netmask:'255.255.255.0'}],tail:[{family:'IPv4',internal:false,address:'100.87.188.3',netmask:'255.255.255.255'}]};
 assert.equal(cleanPreviewNetwork({},{}),false);assert.equal(cleanPreviewNetwork(env,interfaces),true);
 for(const bad of [{...env,MELISA_CLEAN_TEST:'old'},{...env,MELISA_CLEAN_UI_NETWORK:'0.0.0.0'}])assert.throws(()=>cleanPreviewNetwork(bad,interfaces));
 assert.throws(()=>cleanPreviewNetwork(env,{lan:interfaces.lan}));
 assert.throws(()=>cleanPreviewNetwork(env,{...interfaces,tail:[{...interfaces.tail[0],netmask:'255.192.0.0'}]}));
 for(const value of ['',undefined,'100.128.0.1','100.64.00.1','100.64.0.999','100.64.0.1,100.64.0.1','100.64.0.0/10','192.168.1.50'])assert.throws(()=>cleanPreviewTailPeers(value));
});
test('network UI rejects cross-network, forged host, forwarded and cross-origin requests before proxy',()=>{
 const allowed=req=>cleanPreviewRequestAllowed(req,['100.120.1.2']);
 for(const [local,remote] of [['192.168.1.46','192.168.1.50'],['100.87.188.3','100.120.1.2'],['127.0.0.1','127.0.0.1']]){
  const req={method:'GET',url:'/api/catalog/products',socket:{localAddress:local,remoteAddress:remote},headers:{host:local+':5244','sec-fetch-site':'same-origin'}};
  assert.equal(allowed(req),true);
  assert.equal(allowed({...req,method:'POST'}),false);
  assert.equal(allowed({...req,method:'POST',headers:{...req.headers,origin:'http://'+local+':5244'}}),true);
  for(const [key,value] of [['host','evil.example'],['origin','http://evil.example'],['sec-fetch-site','cross-site'],['x-forwarded-for','127.0.0.1'],['forwarded','for=127.0.0.1'],['x-real-ip','127.0.0.1'],['x-forwarded-host',local+':5244'],['x-forwarded-proto','http']])assert.equal(allowed({...req,headers:{...req.headers,[key]:value}}),false,key);
  for(const remoteAddress of ['8.8.8.8','192.168.2.50','100.128.1.1','100.120.1.3','::1'])assert.equal(allowed({...req,socket:{...req.socket,remoteAddress}}),false);
  assert.equal(allowed({...req,url:'//evil.example'}),false);
 }
});
test('LAN and Tailscale normal session reads stay same-origin; role and clean scope stay exact',async()=>{
 for(const hostname of ['192.168.1.46','100.87.188.3']){
  const location={protocol:'http:',hostname,port:'5244'},apiBase='http://127.0.0.1:4194',resolved=resolveTestApiBase({location,apiBase}),calls=[],user={id:15,username:'ornek-satis',permissions:['product.view','sales.view']};
  const session=createWorkingCatalogSession({location,apiBase,protectedDevice:null,storage:{getItem:()=>null,setItem(){},removeItem(){}},fetchImpl:async(url,options)=>{calls.push({url,method:options.method});return{ok:true,status:200,json:async()=>url.endsWith('/auth/login')?{success:true,data:{accessToken:'fixture',user}}:{success:true,data:[]}};}});
  await session.login({username:'ornek-satis',password:'fixture'});await session.orders();await session.orderSale(3);
  await assert.rejects(()=>session.orderSale(3,{operation:'finalize',body:{requestId:'fixture'}}));
  assert.ok(calls.every(c=>c.url.startsWith(resolved+'/api/')));assert.equal(calls.filter(c=>c.method==='POST').length,1);
  assert.equal(isCleanFinancePaymentTarget({location,apiBase:resolved,actorId:20}),true);
  assert.equal(isCleanFinancePaymentTarget({location,apiBase:resolved,actorId:15}),false);
  assert.equal(isCleanFinancePaymentTarget({location,apiBase,actorId:20}),false);
  const meta={environment:'CLEAN_SYNTHETIC_TEST',environmentId:CLEAN_ENVIRONMENT_ID,synthetic:true,actualT1:false,externalOperations:false,cleanDaily:{date:'2026-10-22',actorId:'21',canDraft:true,canReview:false}},counter={id:21,role:{code:'clean_test_counter'},permissions:['product.view']};
  assert.equal(cleanDailyControls(meta,counter,'count',{location}).canReview,false);
  assert.throws(()=>cleanDailyControls({...meta,actualT1:true},counter,'count',{location}));
 }
});
test('synthetic catalog cannot masquerade as accepted Vega catalog',()=>{
 const location={protocol:'http:',hostname:'127.0.0.1',port:'5244'},meta={environment:'CLEAN_SYNTHETIC_TEST',environmentId:CLEAN_ENVIRONMENT_ID,synthetic:true,actualT1:false,externalOperations:false};
 assert.equal(isCleanCatalogMeta(meta,location),true);assert.equal(isCleanCatalogMeta(meta,{...location,port:'5234'}),false);assert.equal(isCleanCatalogMeta({...meta,actualT1:true},location),false);
 assert.throws(()=>cleanCatalogEnvelope({success:true,data:[],meta:{...meta,schemaVersion:'melisa-catalog.v1',scopeCounts:{acceptedOpening:16622,quarantinedSource:54,syntheticTest:0}}}));
});
test('native draft projection never mixes currencies or accepts completed/invalid money',()=>{
 const draft={id:1,documentNo:'CR2-example',customerName:'Örnek Mağaza',status:'DRAFT',documentCurrency:'TRY',grandTotal:251};assert.equal(cleanOrderDocument(draft),draft);
 assert.deepEqual(cleanOrderDocument({...draft,id:'1'}),draft);
 for(const id of ['01','1.0','1e0','9007199254740992',true,null])assert.throws(()=>cleanOrderDocument({...draft,id}));
 for(const change of [{status:'FINALIZED'},{id:0},{documentCurrency:'LL'},{grandTotal:NaN},{grandTotal:-1}])assert.throws(()=>cleanOrderDocument({...draft,...change}));
});
test('normal session confines SQL order reads to new browser/API pair',async()=>{
 const values=new Map([['melisaTestSessionMode','manual']]),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};const seen=[];
 const fetchImpl=async url=>{
  seen.push(url);
  return {ok:true,status:200,json:async()=>url.endsWith('/api/auth/login')?{success:true,data:{accessToken:'new-synthetic-token',user:{id:15,username:'ornek-satis',permissions:['product.view','sales.view']}}}:{success:true,data:[],meta:{source:'sql-sales_orders'}}};
 };
 for(const port of ['5244','5234']){const session=createWorkingCatalogSession({location:{protocol:'http:',hostname:'127.0.0.1',port},apiBase:port==='5244'?'http://127.0.0.1:4194':'http://127.0.0.1:4184',storage,fetchImpl,protectedDevice:null});await session.login({username:'ornek-satis',password:'synthetic-fixture-only'});if(port==='5244'){await session.orders();await session.orders(1);await assert.rejects(session.orders('../1'));}else await assert.rejects(session.orders());session.dispose();}
 assert.equal(seen.filter(url=>url.includes('/api/sales-orders')).length,2);assert.ok(seen.includes('http://127.0.0.1:4194/api/sales-orders?limit=50&status=draft'));
});
