import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Fake the original transport before the network wrapper loads: no network I/O.
globalThis.fetch=async input=>({destination:String(input)});
const {networkPolicy,enableCrmOrderTestGateway}=await import('../../canonical-test-network.mjs');
test('ordinary TEST rejects CRM, dedicated verified draft runtime opens only loopback 62401',async()=>{
 assert.equal(networkPolicy.ports.includes(62401),false);
 assert.throws(()=>fetch('http://127.0.0.1:62401/auth/me'),{code:'TEST_EXTERNAL_OPERATION_DISABLED'});
 assert.throws(()=>enableCrmOrderTestGateway({}),{code:'TEST_EXTERNAL_OPERATION_DISABLED'});
 Object.assign(process.env,{MELISA_CANONICAL_TEST:'true',SQL_DATABASE:'MELISA_ERP_SIRKET_TEST_20260929_01',SQL_READ_ONLY:'false',MELISA_TEST_SCOPED_SALES:'true'});
 const identity={databaseName:process.env.SQL_DATABASE,loginName:'melisa_sirket_sales_test_20260929_01',databaseUser:'melisa_sirket_sales_test_20260929_01',serverName:'Semih\\MELISADEV',sysadmin:0,databaseControl:0,liveDatabaseAccess:0};
 assert.throws(()=>enableCrmOrderTestGateway({...identity,liveDatabaseAccess:1}),{code:'TEST_EXTERNAL_OPERATION_DISABLED'});
 const policy=enableCrmOrderTestGateway(identity);
 assert.deepEqual(policy.ports,[1433,4144,4146,5194,62401]);
 assert.deepEqual(await fetch('http://127.0.0.1:62401/auth/me'),{destination:'http://127.0.0.1:62401/auth/me'});
 for(const url of ['http://127.0.0.1:4200/auth/me','http://127.0.0.1:62403/crm/erp/drafts','https://example.com:62401/auth/me','http://example.com:62401/auth/me'])assert.throws(()=>fetch(url),{code:'TEST_EXTERNAL_OPERATION_DISABLED'});
 const launcher=readFileSync(new URL('../../start-crm-order-test.mjs',import.meta.url),'utf8');
 assert.ok(launcher.indexOf('enableCrmOrderTestGateway(identity)')>launcher.indexOf("await configureCanonicalTest(process.argv[2],'erp')"));
});
