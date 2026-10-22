import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCleanSyntheticOrderSql} from './clean-synthetic-sql.mjs';
import {buildCrmV2InstallSql} from './crm-order-v2-sql.mjs';
import {assertCleanEnvironment,assertCleanIdentity,CLEAN_DATABASE,CLEAN_LOGIN,CLEAN_ENVIRONMENT_ID} from '../../apps/api/src/services/cleanSyntheticContext.mjs';
import {isCleanCatalogMeta,cleanCatalogEnvelope} from '../../apps/sites-workflow/src/workflow/cleanSyntheticCatalogModel.mjs';
import {resolveTestApiBase,shouldAutoOpenTestAdmin} from '../../apps/sites-workflow/src/workflow/testAdminSession.mjs';
const environment={MELISA_CLEAN_TEST:'20261022',SQL_SERVER:'127.0.0.1',SQL_PORT:'1433',SQL_DATABASE:CLEAN_DATABASE,SQL_USER:CLEAN_LOGIN,SQL_READ_ONLY:'false',API_PORT:'4194'};
const identity={databaseName:CLEAN_DATABASE,serverName:'Semih\\MELISADEV',loginName:CLEAN_LOGIN,databaseUser:CLEAN_LOGIN,sysadmin:0,databaseControl:0,originalDatabaseAccess:0,liveDatabaseAccess:0,environmentId:CLEAN_ENVIRONMENT_ID};
test('exact new target only; old or privileged identities fail closed',()=>{
 assert.doesNotThrow(()=>assertCleanEnvironment(environment));assert.doesNotThrow(()=>assertCleanIdentity(identity));
 for(const [key,value] of Object.entries({SQL_DATABASE:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',SQL_SERVER:'Semih\\MELISADEV',SQL_PORT:'1434',SQL_USER:'sa',API_PORT:'4184',SQL_READ_ONLY:'true',VEGA_SQL_SERVER:'anything',OPENAI_API_KEY:'example'}))assert.throws(()=>assertCleanEnvironment({...environment,[key]:value}));
 for(const key of ['sysadmin','databaseControl','originalDatabaseAccess','liveDatabaseAccess'])assert.throws(()=>assertCleanIdentity({...identity,[key]:1}));
 assert.throws(()=>assertCleanIdentity({...identity,environmentId:'different'}));
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
 assert.equal(resolveTestApiBase({location:{...location,hostname:'192.168.1.46'},apiBase:'http://127.0.0.1:4194'}),null);
});
test('synthetic catalog cannot masquerade as accepted Vega catalog',()=>{
 const location={protocol:'http:',hostname:'127.0.0.1',port:'5244'},meta={environment:'CLEAN_SYNTHETIC_TEST',environmentId:CLEAN_ENVIRONMENT_ID,synthetic:true,actualT1:false,externalOperations:false};
 assert.equal(isCleanCatalogMeta(meta,location),true);assert.equal(isCleanCatalogMeta(meta,{...location,port:'5234'}),false);assert.equal(isCleanCatalogMeta({...meta,actualT1:true},location),false);
 assert.throws(()=>cleanCatalogEnvelope({success:true,data:[],meta:{...meta,schemaVersion:'melisa-catalog.v1',scopeCounts:{acceptedOpening:16622,quarantinedSource:54,syntheticTest:0}}}));
});
