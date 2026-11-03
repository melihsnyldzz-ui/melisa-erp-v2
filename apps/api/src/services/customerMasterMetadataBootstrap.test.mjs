import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {prepareCanonicalCustomerMasterMetadata} from './customerMasterMetadataBootstrap.mjs';
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
