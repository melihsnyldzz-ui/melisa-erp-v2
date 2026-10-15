import test from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV='production';
const {errorHandler,isolatedSqlNumericDiagnostics}=await import('./errorHandler.js');
const native=()=>Object.assign(new Error('PRIVATE_SQL_MESSAGE_CANARY'),{code:'EREQUEST',number:51904,state:1,class:16,lineNumber:30,query:'PRIVATE_QUERY_CANARY',parameters:{password:'PRIVATE_PASSWORD_CANARY'},procName:'PRIVATE_PROCEDURE_CANARY',originalError:{code:51904,sqlstate:'42000',severity:16,message:'PRIVATE_ORIGINAL_CANARY',lineNumber:30}});

test('default unregistered runtime emits no SQL numeric diagnostic',()=>{assert.deepEqual(isolatedSqlNumericDiagnostics(native()),{});});
test('verified DB02 error logging retains only bounded SQL numbers; API and secrets remain unchanged',async()=>{
 const {businessInboundFixture}=await import('../services/businessInbound.test-fixture.mjs');
 const {registerIsolatedOperationCopyRuntime}=await import('../config/isolatedOperationCopyRuntime.mjs');
 const {isolatedCopyHash,validateIsolatedOperationCopyContext}=await import('../services/isolatedOperationCopyContext.mjs');
 const raw=JSON.parse(JSON.stringify(businessInboundFixture().copy));raw.copyId='e16b70f0-4057-428b-9abc-6bbcaf35fe82';delete raw.sealHash;raw.sealHash=isolatedCopyHash(raw);const copy=validateIsolatedOperationCopyContext(raw);registerIsolatedOperationCopyRuntime(copy,{database:copy.target.database,server:copy.target.server,user:copy.target.login,readOnly:false,trustedConnection:false,port:4184,externalProvidersDisabled:true});
 const lines=[],old=console.error;console.error=value=>lines.push(value);let payload;
 try{errorHandler(native(),{requestId:'11111111-2222-4333-8444-555555555555',method:'POST',route:{path:'/work-sales/drafts'}},{headersSent:false,status(v){assert.equal(v,500);return this;},json(v){payload=v;return v;}},()=>assert.fail());}finally{console.error=old;}
 assert.equal(lines.length,1);const logged=JSON.parse(lines[0]);for(const [key,value] of Object.entries({sqlNumber:51904,sqlState:1,sqlClass:16,sqlLineNumber:30}))assert.equal(logged[key],value);
 assert.equal(payload.error.code,'EREQUEST');assert.equal(payload.error.message,'Unexpected server error');assert.deepEqual(Object.keys(payload.meta),['requestId']);for(const key of ['sqlNumber','sqlState','sqlClass','sqlLineNumber'])assert.equal(JSON.stringify(payload).includes(key),false);
 for(const canary of ['PRIVATE_SQL','PRIVATE_QUERY','PRIVATE_PASSWORD','PRIVATE_PROCEDURE','PRIVATE_ORIGINAL'])assert.equal(lines[0].includes(canary),false);
});
test('flat and info driver shapes are supported, invalid types and bounds are never normalized',()=>{
 const error=native();delete error.state;delete error.class;delete error.lineNumber;error.originalError={info:{number:51904,state:255,class:25,lineNumber:1000000,message:'SECRET'}};assert.deepEqual(isolatedSqlNumericDiagnostics(error),{sqlNumber:51904,sqlState:255,sqlClass:25,sqlLineNumber:1000000});
 for(const [field,values] of Object.entries({number:[0,-1,2147483648,'51904',1.1,NaN],state:[-1,256,'1',1.1],class:[-1,26,'16',16.5],lineNumber:[-1,1000001,'30',30.5]}))for(const value of values){const e=native();e[field]=value;const key={number:'sqlNumber',state:'sqlState',class:'sqlClass',lineNumber:'sqlLineNumber'}[field];assert.equal(Object.hasOwn(isolatedSqlNumericDiagnostics(e),key),false);}
 for(const code of ['ETIMEOUT','EABORT','OTHER',undefined])assert.deepEqual(isolatedSqlNumericDiagnostics({...native(),code}),{});
});

test('10053 ODBC SQLSTATE survives separately from numeric SQL Server state',()=>{
 const error=Object.assign(new Error('PRIVATE_MESSAGE_CANARY'),{code:'EREQUEST',number:10053,state:'08S01',originalError:{code:10053,sqlstate:'08S01',severity:16,message:'PRIVATE_DRIVER_CANARY'}});
 const result=isolatedSqlNumericDiagnostics(error);
 assert.equal(result.sqlNumber,10053);assert.equal(result.sqlStateCode,'08S01');assert.equal(Object.hasOwn(result,'sqlState'),false);
 assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
});

test('tracked inner call and SQLSTATE reach only sanitized server log, never API response',async()=>{
 const {selectedSaleDiagnosticProbe}=await import('../services/selectedSaleSqlDiagnostic.mjs');
 const error=Object.assign(new Error('PRIVATE_MESSAGE_CANARY'),{code:'EREQUEST',number:10053,state:'08S01',originalError:{sqlstate:'08S01',message:'PRIVATE_DRIVER_CANARY'}});
 await assert.rejects(selectedSaleDiagnosticProbe('selectedSale.transaction',()=>selectedSaleDiagnosticProbe('invoice.refresh',()=>{throw error;})),e=>e===error);
 const lines=[],old=console.error;let payload;console.error=value=>lines.push(value);
 try{errorHandler(error,{requestId:'11111111-2222-4333-8444-555555555555',method:'POST',route:{path:'/work-sales/:id/finalize'}},{headersSent:false,status(v){assert.equal(v,500);return this;},json(v){payload=v;return v;}},()=>assert.fail());}finally{console.error=old;}
 const record=JSON.parse(lines[0]);assert.equal(record.sqlNumber,10053);assert.equal(record.sqlStateCode,'08S01');assert.equal(record.sqlCall,'invoice.refresh');assert(Number.isSafeInteger(record.sqlCallDurationMs));assert.equal(record.sqlState,undefined);assert(!lines[0].includes('PRIVATE'));assert.equal(payload.error.message,'Unexpected server error');for(const key of ['sqlCall','sqlStateCode','sqlCallDurationMs'])assert(!JSON.stringify(payload).includes(key));
});
