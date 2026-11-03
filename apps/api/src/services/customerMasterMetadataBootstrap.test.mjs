import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {prepareCanonicalCustomerMasterMetadata,prepareCanonicalCustomerMasterWriter,customerMasterWriterMetadataCompatible} from './customerMasterMetadataBootstrap.mjs';
import {customerMasterMetadataFixture} from './customerMasterMetadata.test-fixture.mjs';
import {customerMasterSqlFixture} from './customerMasterSql.test-fixture.mjs';
import {createCustomerMasterService} from './customerMasterService.mjs';
async function fixture(){const f=await customerMasterMetadataFixture(),o=customerMasterSqlFixture({normal:true}).normalOptions;let acquisitions=0;o.database.getSqlPool=async()=>{acquisitions++;throw Error('Must reuse');};o.database.getSqlDriver=()=>f.runtime.sql;return {...f,database:o.database,startup:{...o.startup,pool:f.pool},getFinalContext:o.getFinalContext,getCurrentFinanceContext:o.getCurrentFinanceContext,acquisitions:()=>acquisitions};}
test('bootstrap prepares only the readonly capability from its already connected admitted pool, without query or writer activation',async()=>{
 const f=await fixture(),reader=await prepareCanonicalCustomerMasterMetadata(f);assert.deepEqual(Object.keys(reader),['read','checkAssets']);assert.equal(f.acquisitions(),0);assert.equal(f.calls.length,0);const r=await reader.read();assert.equal(r.status,'OBSERVED');assert.equal(f.acquisitions(),0);assert.equal(f.calls.length,3);
 await assert.rejects(createCustomerMasterService().context('100',{id:17,permissions:['customer.view','customer.edit']}),{code:'CUSTOMER_MASTER_UNAVAILABLE'});
});
test('bootstrap rejects wrong identity, transport, listener, disconnected and copy targets without reacquiring the pool',async()=>{
 for(const change of [f=>f.startup.identity.databaseName='OTHER',f=>f.startup.port=4146,f=>f.startup.env.sql.port=1434,f=>f.startup.mode='native',f=>f.pool.connected=false,f=>f.database.isIsolatedOperationCopyRuntime=()=>true]){const f=await fixture();change(f);await assert.rejects(prepareCanonicalCustomerMasterMetadata(f));assert.equal(f.acquisitions(),0);assert.equal(f.calls.length,0);}
});
test('normal entry mounts readonly route after context configuration and before dynamic customer-id routes, with no new writer setup',()=>{
 const source=fs.readFileSync(new URL('../../start-canonical-test.mjs',import.meta.url),'utf8');const call=source.indexOf('await prepareCanonicalCustomerMasterMetadata(');assert(call>source.indexOf('configureCurrentFinanceContext('));assert(call>source.indexOf('configureCatalogSourceVersion('));assert(source.indexOf("createApp()")==-1||call<source.indexOf('createApp()'));assert.match(source,/if\(mode==='erp'&&writes&&businessSession\)/);assert.doesNotMatch(source,/configureCustomerMaster(?:Service|Store)|customerMasterService\.configure/);
});
test('writer startup requires explicit true and cannot be activated by a metadata GET',async()=>{
 for(const value of [undefined,false,'true',1]){const f=await fixture();f.startup.config={customerMasterWritesEnabled:value};const reader=await prepareCanonicalCustomerMasterMetadata(f);assert.equal(await prepareCanonicalCustomerMasterWriter(f),null);assert.equal(f.calls.length,0);await reader.read();assert.equal(f.calls.length,3);assert.equal(await prepareCanonicalCustomerMasterWriter(f),null);assert.equal(f.calls.length,3);assert.equal(f.acquisitions(),0);}
});
test('metadata alone cannot select the writer without the registered business session',async()=>{
 const f=await fixture();f.startup.config={customerMasterWritesEnabled:true};assert.equal(await prepareCanonicalCustomerMasterWriter(f),null);assert.equal(f.calls.length,3);assert.equal(f.acquisitions(),0);
 for(const mutate of [f=>f.catalog[1][0].objectId=null,f=>f.catalog[1][3].objectVisible=0,f=>f.catalog[7].find(p=>p.objectName==='dbo.customer_master_requests_v1'&&p.columnName===null&&p.permissionName==='INSERT').permissionValue=0,f=>f.catalog[7].find(p=>p.objectName==='dbo.customer_master_local_v1'&&p.columnName==='customer_name'&&p.permissionName==='UPDATE').permissionValue=null,f=>f.catalog[6][0].kind='OTHER']){const g=await fixture();g.startup.config={customerMasterWritesEnabled:true};mutate(g);assert.equal(await prepareCanonicalCustomerMasterWriter(g),null);assert.equal(g.calls.length,3);assert.equal(g.acquisitions(),0);}
});
test('compatible observation rejects changed target, incomplete facets and missing exact permissions',async()=>{
 const f=await fixture(),result=await f.reader.read();assert.equal(customerMasterWriterMetadataCompatible(result),true);
 for(const mutate of [r=>r.status='FAILED',r=>r.queryCount=2,r=>r.identity.sysadmin=1,r=>r.target.database='OTHER',r=>r.objects[0].visibility='UNKNOWN',r=>r.objects[0].compatibility.checks='UNKNOWN',r=>delete r.objects[0].compatibility.columns,r=>r.objects[0].observed.permissions=[],r=>r.objects.pop()]){const copy=structuredClone(result);mutate(copy);assert.equal(customerMasterWriterMetadataCompatible(copy),false);}
});
test('normal startup puts an admitted router after write policy and before legacy createApp',()=>{
 const source=fs.readFileSync(new URL('../../start-canonical-test.mjs',import.meta.url),'utf8');const policy=source.indexOf('!isCanonicalTestWriteAllowed('),mount=source.indexOf("if(customerMasterWriterRoutes)app.use('/api',customerMasterWriterRoutes)"),legacy=source.indexOf('app.use(createApp())');assert(policy>0&&mount>policy&&legacy>mount);assert.match(source,/if\(config\.customerMasterWritesEnabled===true\)customerMasterWriterRoutes=await prepareCanonicalCustomerMasterWriter/);assert.match(source,/customerMasterWriterReady:!!customerMasterWriterRoutes/);
});
