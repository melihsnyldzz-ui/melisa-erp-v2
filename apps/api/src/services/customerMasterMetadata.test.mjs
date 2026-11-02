import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';
import {customerMasterMetadataFixture,metadataIdentity,metadataCatalog} from './customerMasterMetadata.test-fixture.mjs';
import {createCustomerMasterMetadataReader} from './customerMasterMetadata.mjs';
import {CUSTOMER_MASTER_METADATA_IDENTITY_SQL as IDENTITY,CUSTOMER_MASTER_METADATA_SQL as CATALOG,CUSTOMER_MASTER_METADATA_LIMITS as LIMITS} from './customerMasterMetadataSql.mjs';
import {createCustomerMasterService} from './customerMasterService.mjs';
const object=(report,i=0)=>report.objects[i];
test('fixed SELECT reader reuses admitted connected pool, verifies identity around bounded catalog and returns required shape',async()=>{
 const f=await customerMasterMetadataFixture(),before=f.poolCalls(),r=await f.reader.read();assert.equal(r.status,'OBSERVED');assert.equal(r.queryCount,3);assert.deepEqual(f.calls,[IDENTITY,CATALOG,IDENTITY]);assert.equal(f.poolCalls(),before);assert.equal(r.commercialRowsRead,false);assert.equal(r.writeStatements,0);assert.match(r.consistency,/NON_TRANSACTIONAL/);
 assert.equal(r.objects.length,4);for(const o of r.objects){assert.equal(o.status,'PRESENT');assert.equal(o.visibility,'COMPLETE');for(const v of Object.values(o.compatibility))assert(['MATCH','NOT_APPLICABLE'].includes(v),o.name+':'+v);}
 assert.equal(object(r).observed.columns.find(c=>c.columnName==='customer_code').maxLength,100);assert.equal(object(r,2).observed.defaults[0].kind,'UTC_NOW');assert.equal(object(r).observed.permissions.find(p=>p.columnName==='identity_hash'&&p.permissionName==='UPDATE').status,'DENIED');assert(Buffer.byteLength(JSON.stringify(r))<=LIMITS.bytes);assert(Object.isFrozen(r.objects));
});
test('wrong actual DB, server, login, original login, database user, elevated/control/LIVE identity stops before catalog',async()=>{
 for(const identity of [{databaseName:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'},{serverName:'Other'},{loginName:'other'},{originalLogin:'sa'},{databaseUser:'dbo'},{sysadmin:1},{databaseControl:1},{liveDatabaseAccess:1}]){const f=await customerMasterMetadataFixture();f.modes.identity=identity;const r=await f.reader.read();assert.equal(r.status,'REJECTED');assert.equal(r.reason,'IDENTITY_REJECTED');assert.equal(f.calls.length,1);assert.deepEqual(r.objects,[]);}
 const f=await customerMasterMetadataFixture();f.catalog[0][0].databaseName='OTHER';const r=await f.reader.read();assert.equal(r.status,'REJECTED');assert.equal(f.calls.length,2);assert.deepEqual(r.objects,[]);
});
test('final identity drift never exposes a successful catalog and same pool does not claim one SQL session',async()=>{
 const f=await customerMasterMetadataFixture();f.modes.lastIdentity={loginName:'other'};const r=await f.reader.read();assert.equal(r.status,'REJECTED');assert.equal(r.stage,'identity-after');assert.deepEqual(r.objects,[]);assert.equal(r.queryCount,3);
});
test('metadata invisibility stays UNKNOWN even with enclosing definition grants; object-level DENY is not absence',async()=>{
 for(const visible of [null,0,1]){const f=await customerMasterMetadataFixture();Object.assign(f.catalog[1][0],{objectId:null,objectType:null,databaseVisible:visible,schemaVisible:0,objectVisible:null,totalColumns:0,totalDefaults:0,totalChecks:0});for(const set of f.catalog.slice(2))for(let i=set.length-1;i>=0;i--)if(set[i].objectName==='dbo.customer_master_local_v1'&&!('permissionValue'in set[i]))set.splice(i,1);for(const p of f.catalog[7])if(p.objectName==='dbo.customer_master_local_v1')p.permissionValue=null;
  const r=await f.reader.read();assert.equal(r.status,'OBSERVED');assert.equal(object(r).status,'UNKNOWN');assert.equal(object(r).compatibility.columns,'UNKNOWN');assert(object(r).observed.permissions.every(p=>p.status==='UNKNOWN'));
 }
 for(const objectVisible of [0,null]){const f=await customerMasterMetadataFixture();Object.assign(f.catalog[1][0],{databaseVisible:1,schemaVisible:1,objectVisible});const r=await f.reader.read();assert.equal(object(r).visibility,'PARTIAL');assert(Object.values(object(r).compatibility).every(v=>v==='UNKNOWN'));}
});
test('partial visibility, unsupported object kind and missing resultset cannot masquerade as complete compatible metadata',async()=>{
 let f=await customerMasterMetadataFixture();Object.assign(f.catalog[1][0],{databaseVisible:0,schemaVisible:0,objectVisible:0});let r=await f.reader.read();assert.equal(object(r).visibility,'PARTIAL');assert(Object.values(object(r).compatibility).every(v=>v==='UNKNOWN'));
 f=await customerMasterMetadataFixture();f.catalog[1][0].objectType='V';r=await f.reader.read();assert.equal(object(r).status,'UNSUPPORTED');
 f=await customerMasterMetadataFixture();f.catalog[1].pop();r=await f.reader.read();assert.equal(r.status,'FAILED');assert.deepEqual(r.objects,[]);
});
test('nullable/type/byte width, native FK type and source collation drift are separately reported',async()=>{
 for(const change of [c=>c.nullable=true,c=>c.maxLength=160,c=>c.aliasType=true,c=>c.computedColumn=true]){const f=await customerMasterMetadataFixture();change(f.catalog[2].find(c=>c.objectName==='dbo.customer_master_local_v1'&&c.columnName==='customer_code'));const r=await f.reader.read();assert.equal(object(r).compatibility.columns,'MISMATCH');}
 let f=await customerMasterMetadataFixture();f.catalog[2].find(c=>c.objectName==='dbo.customers'&&c.columnName==='id').typeName='int';let r=await f.reader.read();assert.equal(object(r).compatibility.foreignKeys,'MISMATCH');
 f=await customerMasterMetadataFixture();f.catalog[2].find(c=>c.objectName==='dbo.customer_master_local_v1'&&c.columnName==='customer_code').collation='Latin1_General_100_CI_AS';r=await f.reader.read();assert.equal(object(r).compatibility.collation,'MISMATCH');
});
test('PK/UQ/index filter and FK trust/cascade/column order remain distinct compatibility facets',async()=>{
 let f=await customerMasterMetadataFixture();f.catalog[3].find(i=>i.primaryKey&&i.objectName==='dbo.customer_master_local_v1').disabled=true;let r=await f.reader.read();assert.equal(object(r).compatibility.primaryKey,'MISMATCH');
 f=await customerMasterMetadataFixture();for(const i of f.catalog[3])if(i.objectName==='dbo.customer_master_local_v1'&&!i.primaryKey)i.filtered=true;r=await f.reader.read();assert.equal(object(r).compatibility.uniqueCode,'MISMATCH');
 for(const [key,value]of [['disabled',true],['notTrusted',true],['deleteAction',1],['updateAction',2],['ordinal',2]]){f=await customerMasterMetadataFixture();f.catalog[4][0][key]=value;r=await f.reader.read();assert.equal(object(r).compatibility.foreignKeys,'MISMATCH');}
});
test('defaults/checks retain safe kind/hash/enable/trust without exposing raw definition text',async()=>{
 let f=await customerMasterMetadataFixture();f.catalog[5][0].kind='OTHER';let r=await f.reader.read();assert.equal(object(r,2).compatibility.defaults,'UNKNOWN');assert(!JSON.stringify(r).includes('definition"'));
 f=await customerMasterMetadataFixture();f.catalog[6][0].notTrusted=true;r=await f.reader.read();assert.equal(object(r).compatibility.checks,'MISMATCH');
 f=await customerMasterMetadataFixture();f.catalog[6][0].kind='UNAVAILABLE';f.catalog[6][0].definitionHash=null;r=await f.reader.read();assert.equal(object(r).compatibility.checks,'UNKNOWN');
});
test('effective permission zero and null are DENIED and UNKNOWN; missing permission rows are failed observations',async()=>{
 const f=await customerMasterMetadataFixture();f.catalog[7][0].permissionValue=0;f.catalog[7][1].permissionValue=null;const r=await f.reader.read();assert.equal(object(r).observed.permissions[0].status,'DENIED');assert.equal(object(r).observed.permissions[1].status,'UNKNOWN');assert.equal(object(r).observed.permissions[1].permissionValue,null);
 f.catalog[7].pop();assert.equal((await f.reader.read()).status,'FAILED');
});
test('row limits, duplicate rows, unexpected PII fields and accessors fail closed without leaking values',async()=>{
 const canary='PRIVATE_PHONE_PASSWORD_CANARY_0099';
 for(const mutate of [f=>f.catalog[3].push(...Array.from({length:129},(_,n)=>({...f.catalog[3][0],indexId:100+n}))),f=>f.catalog[2].push({...f.catalog[2][0]}),f=>f.catalog[1][0].customerName=canary,f=>Object.defineProperty(f.catalog[2][0],'typeName',{get(){throw Error(canary);},enumerable:true})]){const f=await customerMasterMetadataFixture();mutate(f);const r=await f.reader.read();assert.equal(r.status,'FAILED');assert.deepEqual(r.objects,[]);assert(!JSON.stringify(r).includes(canary));}
 const f=await customerMasterMetadataFixture();f.modes.error=Object.assign(Error(canary),{number:229});const r=await f.reader.read();assert.equal(r.reason,'QUERY_PERMISSION_DENIED');assert(!JSON.stringify(r).includes(canary));
});
test('generic SQL, object/database/limit and credential arguments are rejected before runtime or query use',async()=>{
 for(const options of [{query:'SELECT 1'},{database:'other'},{objects:['dbo.other']},{password:'CANARY'},{limit:1000}])assert.throws(()=>createCustomerMasterMetadataReader(options),{code:'CUSTOMER_VALIDATION_FAILED'});
 let called=false;assert.throws(()=>createCustomerMasterMetadataReader(Object.defineProperty({},'getRuntime',{get(){called=true;}})));assert.equal(called,false);
 const f=await customerMasterMetadataFixture();for(const input of [{query:IDENTITY},{database:'x'},{objects:[]},{limit:1},null])await assert.rejects(f.reader.read(input),{code:'CUSTOMER_VALIDATION_FAILED'});assert.equal(f.calls.length,0);
});
test('unregistered runtime/JSON flags, disconnected pool, wrong request driver, host and executable continuity reject without query',async()=>{
 const none=await createCustomerMasterMetadataReader().read();assert.equal(none.status,'UNAVAILABLE');assert.equal(none.queryCount,0);
 const f=await customerMasterMetadataFixture();for(const runtime of [{...f.runtime},metadataCatalog(),{verified:true,pool:f.pool,sql:f.runtime.sql}]){const r=await createCustomerMasterMetadataReader({getRuntime:()=>runtime}).read();assert.equal(r.status,'UNAVAILABLE');assert.equal(r.queryCount,0);}
 f.pool.connected=false;assert.equal((await f.reader.read()).reason,'POOL_NOT_READY');f.pool.connected=true;f.pool.config.requestTimeout=10001;assert.equal((await f.reader.read()).reason,'POOL_NOT_READY');f.pool.config.requestTimeout=10000;
 const request=f.pool.request;f.pool.request=()=>({parent:f.pool,query(){throw Error('Wrong driver');}});assert.equal((await f.reader.read()).reason,'DRIVER_REJECTED');f.pool.request=request;
 const executable=process.execPath;try{process.execPath='C:\\Wrong\\node.exe';assert.equal((await f.reader.read()).reason,'NO_ADMITTED_IN_PROCESS_RUNTIME');}finally{process.execPath=executable;}
 const hostname=os.hostname;try{os.hostname=()=>hostname()+'-other';assert.equal((await f.reader.read()).reason,'NO_ADMITTED_IN_PROCESS_RUNTIME');}finally{os.hostname=hostname;}
 assert.equal(f.calls.length,0);
});
test('readonly SQL contains only fixed SELECT statements; no connect/credential/start/transaction/EXEC path or writer activation',async()=>{
 for(const sql of [IDENTITY,CATALOG]){const tokens=sql.replace(/N?'(?:''|[^'])*'/g,"''").replace(/\/\*[\s\S]*?\*\//g,' ').replace(/--[^\n]*/g,' ');assert.match(tokens.trim(),/^SELECT\b/);assert.doesNotMatch(tokens,/\b(?:INSERT|UPDATE|DELETE|MERGE|EXEC|EXECUTE|GRANT|REVOKE|ALTER|CREATE|DROP|TRUNCATE|DECLARE|BEGIN|COMMIT|ROLLBACK|SET|INTO|OPENROWSET|OPENDATASOURCE|OPENQUERY)\b/i);}
 assert.equal((CATALOG.match(/SELECT DB_NAME\(\)/g)??[]).length,1);assert((CATALOG.match(/ORIGINAL_LOGIN\(\)/g)??[]).length>7);
 const source=fs.readFileSync(new URL('./customerMasterMetadata.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/\.connect\(|new (?:sql\.)?(?:ConnectionPool|Transaction)|readFile|process\.env|dotenv|child_process|listen\(|\.execute\(/);
 await assert.rejects(createCustomerMasterService().context('100',{id:17,role:{id:2,code:'admin'},permissions:['customer.view','customer.edit']}),{code:'CUSTOMER_MASTER_UNAVAILABLE'});
});
