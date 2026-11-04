import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
process.env.NODE_ENV='production';
const {errorHandler,isolatedSqlNumericDiagnostics}=await import('./errorHandler.js');
const native=()=>Object.assign(new Error('PRIVATE_SQL_MESSAGE_CANARY'),{code:'EREQUEST',number:51904,state:1,class:16,lineNumber:30,query:'PRIVATE_QUERY_CANARY',parameters:{password:'PRIVATE_PASSWORD_CANARY'},procName:'PRIVATE_PROCEDURE_CANARY',originalError:{code:51904,sqlstate:'42000',severity:16,message:'PRIVATE_ORIGINAL_CANARY',lineNumber:30}});

// The disposable VM supplies only a protected-runtime predicate and logger.
// No application runtime, credential, SQL connection or actor grant is created.
function canonicalDiagnosticFixture(available=true){
 const logs=[],predicateActors=[];
 const source=fs.readFileSync(new URL('./errorHandler.js',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'').replaceAll('export ','');
 const context=vm.createContext({env:{nodeEnv:'production'},logger:{error:(_message,value)=>logs.push(value)},requestLogPath:req=>req.originalUrl,normalizeOperationQuarantineError:e=>e,isIsolatedOperationCopyRuntime:()=>false,selectedSaleSqlDiagnostics:()=>({}),isCanonicalBusinessSaleAvailable:actor=>{predicateActors.push(actor);if(available instanceof Error)throw available;return available;}});
 vm.runInContext(source+'\nthis.api={errorHandler,canonicalBusinessSqlNumericDiagnostics};',context);
 return {api:context.api,logs,predicateActors};
}
const canonicalRequest=path=>({method:'POST',originalUrl:path,user:{id:17},requestId:'11111111-2222-4333-8444-555555555555'});

test('B6 diagnostics require protected runtime and only exact sale mutation routes',()=>{
 for(const path of ['/api/work-sales/drafts','/api/work-sales/drafts/42/finalize','/api/work-sales/drafts/42/cancel']){
  const fixture=canonicalDiagnosticFixture();const req=canonicalRequest(path);
  assert.deepEqual({...fixture.api.canonicalBusinessSqlNumericDiagnostics(native(),req)},{sqlNumber:51904,sqlState:1,sqlClass:16,sqlLineNumber:30});assert.deepEqual(fixture.predicateActors,[req.user]);
 }
 for(const available of [false,new Error('PRIVATE_RUNTIME_CANARY')])assert.deepEqual({...canonicalDiagnosticFixture(available).api.canonicalBusinessSqlNumericDiagnostics(native(),canonicalRequest('/api/work-sales/drafts'))},{});
 for(const path of ['/api/work-sales/preview','/api/work-sales/selected-context','/api/work-sales/drafts?debug=1','/api/work-sales/drafts/0/finalize','/api/work-sales/drafts/42/finalize/','/api/work-collections','/api/auth/login','/api/work-sales/requests/42']){
  const fixture=canonicalDiagnosticFixture();assert.deepEqual({...fixture.api.canonicalBusinessSqlNumericDiagnostics(native(),canonicalRequest(path))},{});assert.equal(fixture.predicateActors.length,0);
 }
 for(const method of ['GET','HEAD','PUT','DELETE'])assert.deepEqual({...canonicalDiagnosticFixture().api.canonicalBusinessSqlNumericDiagnostics(native(),{...canonicalRequest('/api/work-sales/drafts'),method})},{});
});

test('B6 diagnostic fields stay bounded and never include SQL text, body or procedure',()=>{
 const {api}=canonicalDiagnosticFixture(),req=canonicalRequest('/api/work-sales/drafts');
 for(const [field,values] of Object.entries({number:[0,-1,2147483648,'51904',1.1,NaN],state:[-1,256,'1',1.1],class:[-1,26,'16',16.5],lineNumber:[-1,1000001,'30',30.5]}))for(const value of values){const e=native();e[field]=value;const key={number:'sqlNumber',state:'sqlState',class:'sqlClass',lineNumber:'sqlLineNumber'}[field];assert.equal(Object.hasOwn(api.canonicalBusinessSqlNumericDiagnostics(e,req),key),false);}
 const flat=native();delete flat.number;delete flat.state;delete flat.class;delete flat.lineNumber;flat.originalError={info:{number:50000,state:255,class:25,lineNumber:1000000,message:'PRIVATE_INFO_CANARY'}};
 assert.deepEqual({...api.canonicalBusinessSqlNumericDiagnostics(flat,req)},{sqlNumber:50000,sqlState:255,sqlClass:25,sqlLineNumber:1000000});
 for(const code of ['ETIMEOUT','EABORT',undefined])assert.deepEqual({...api.canonicalBusinessSqlNumericDiagnostics({...native(),code},req)},{});
});

test('B6 SQL failure retains original HTTP error while server log gets numeric fields only',()=>{
 const {api,logs}=canonicalDiagnosticFixture(),error=native(),req={...canonicalRequest('/api/work-sales/drafts'),body:{password:'PRIVATE_BODY_CANARY'}};let payload;
 api.errorHandler(error,req,{headersSent:false,status(value){assert.equal(value,500);return this;},json(value){payload=value;return value;}},()=>assert.fail());
 assert.equal(logs.length,1);assert.deepEqual(Object.keys(logs[0]).sort(),['category','code','method','path','requestId','sqlClass','sqlLineNumber','sqlNumber','sqlState','statusCode'].sort());
 assert.equal(payload.error.code,'EREQUEST');assert.equal(payload.error.message,'Unexpected server error');assert.equal(Object.keys(payload.meta).join(','),'requestId');assert.equal(error.code,'EREQUEST');
 for(const text of [JSON.stringify(logs),JSON.stringify(payload)])for(const canary of ['PRIVATE_SQL','PRIVATE_QUERY','PRIVATE_PASSWORD','PRIVATE_PROCEDURE','PRIVATE_ORIGINAL','PRIVATE_BODY','sqlCall'])assert.equal(text.includes(canary),false);
 for(const key of ['sqlNumber','sqlState','sqlClass','sqlLineNumber'])assert.equal(Object.hasOwn(payload.error,key),false);
});

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
