import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {TARGET,assertTarget,assertIdentity,assertOutcome,syntheticItems,selectedItemsSQL,plan,execute,numericFailure,main} from '../../../../scripts/canonical/b6-selected-items-subpath.mjs';
const runnerURL=new URL('../../../../scripts/canonical/b6-selected-items-subpath.mjs',import.meta.url);
const target={server:TARGET.server,port:TARGET.port,database:TARGET.database};
test('exact disposable target only, rejects real systems and alternate hosts before connection',async()=>{
 for(const database of ['master','MELISA_ERP_SIRKET_TEST_20260929_01','VEGA2026','MELISA_ERP_CLEAN_TEST_20261022',TARGET.database+'x'])assert.throws(()=>assertTarget({...target,database}),{code:'B6_SUBPATH_TARGET_REJECTED'});
 for(const change of [{server:'Semih\\MELISADEV'},{server:'192.168.1.46'},{port:1433},{port:'15439'},{extra:true}])assert.throws(()=>assertTarget({...target,...change}),{code:'B6_SUBPATH_TARGET_REJECTED'});
 await assert.rejects(execute({target:{...target,database:'VEGA2026'},approvedExecution:true}),{code:'B6_SUBPATH_TARGET_REJECTED'});
});
test('SQL mode requires separate approval then existing credentials; imports no database configuration',async()=>{
 await assert.rejects(execute({target,scenario:'valid'}),{code:'B6_SUBPATH_SEPARATE_APPROVAL_REQUIRED'});
 await assert.rejects(execute({target,scenario:'valid',approvedExecution:true}),{code:'B6_SUBPATH_EXISTING_CREDENTIAL_REQUIRED'});
});
test('server identity, disposable purpose and entirely empty target required',()=>{
 const row={databaseName:TARGET.database,serverName:TARGET.serverIdentity,purpose:TARGET.purpose,userTableCount:0,fixtureSchemaCount:0,transactionCount:0};assert.doesNotThrow(()=>assertIdentity(row));
 for(const patch of [{databaseName:'VEGA2026'},{serverName:'Semih\\MELISADEV'},{purpose:null},{userTableCount:1},{fixtureSchemaCount:1},{transactionCount:1}])assert.throws(()=>assertIdentity({...row,...patch}),{code:'B6_SUBPATH_IDENTITY_REJECTED'});
});
test('exact actual selected-items SQL preserved except target table; synthetic leading zeros retained',()=>{
 const extracted=selectedItemsSQL();const source=fs.readFileSync(new URL('./invoiceDraftService.js',import.meta.url),'utf8');
 const start=source.indexOf('async function insertSelectedSourceSalesItems('),end=source.indexOf('\nasync function ',start+1),body=source.slice(start,end);const actual=body.slice(body.indexOf('.query(`')+8,body.indexOf('`);'));
 assert.equal(extracted.sql.replace('b6_subpath_fixture.items','dbo.sales_invoice_items'),actual);
 assert.match(extracted.sql,/quantity decimal\(18,3\)/);assert.match(extracted.sql,/currency nvarchar\(3\)/);assert.match(extracted.sql,/unitPrice decimal\(18,4\)/);
 const items=syntheticItems();assert.equal(items.length,2);assert.equal(items[0].barcode,'0000000000001');assert.equal(syntheticItems('bad-quantity')[1].quantity,'not-a-decimal');assert.equal(syntheticItems('unknown-product')[1].productId,'999999');assert.throws(()=>syntheticItems('real'),{code:'B6_SUBPATH_SCENARIO_REJECTED'});
});
test('plan is runnable preparation only, no SQL dependency or full admission claim',()=>{
 const p=plan();assert.equal(p.sqlExecuted,false);assert.equal(p.admissionEquivalent,false);assert.equal(p.requiresSeparateExecutionApproval,true);
 const src=fs.readFileSync(runnerURL,'utf8');assert.doesNotMatch(src,/await tx\.commit\(|\.execute\(|sp_getapplock|trustServerCertificate:true|from .*database\.js/);assert.match(src,/finally\{await tx\.rollback\(\);tx=null;\}/);assert.match(src,/B6_SUBPATH_ROLLBACK_UNCONFIRMED/);
});
test('failure output includes bounded numeric fields only',()=>{
 assert.deepEqual(numericFailure({number:547,state:0,class:16,lineNumber:2,message:'SECRET',originalError:{info:{message:'SECRET'}}},'selected-items'),{stage:'selected-items',number:547,state:0,class:16,lineNumber:2});
 assert.deepEqual(numericFailure({number:'547',state:-1,class:99,lineNumber:Infinity},'selected-items'),{stage:'selected-items'});
});
test('offline command entry and invalid execute arguments need no child process, network or credentials',async()=>{
 assert.equal((await main([])).sqlExecuted,false);
 await assert.rejects(main(['--execute','--approved-execution','--database','VEGA2026']),{code:'B6_SUBPATH_TARGET_REJECTED'});
 await assert.rejects(main(['--execute','--password','do-not-accept-secret-arguments']),{code:'B6_SUBPATH_ARGUMENT_REJECTED'});
});
test('expected SQL number is accepted only at selected-items after verified rollback',()=>{
 for(const [scenario,number]of [['unknown-product',547],['bad-quantity',8114]]){
  const base={scenario,insertedCount:null,rollbackVerified:true,failure:{stage:'selected-items',number}};
  assert.equal(assertOutcome(base),'EXPECTED_FAILURE_OBSERVED');
  for(const stage of ['schema','synthetic-seed','read-result','identity','connect'])assert.throws(()=>assertOutcome({...base,failure:{stage,number}}),{code:'B6_SUBPATH_UNEXPECTED_RESULT'});
  assert.throws(()=>assertOutcome({...base,rollbackVerified:false}),{code:'B6_SUBPATH_ROLLBACK_UNCONFIRMED'});
  assert.throws(()=>assertOutcome({...base,failure:{stage:'selected-items',number:999}}),{code:'B6_SUBPATH_UNEXPECTED_RESULT'});
 }
 assert.equal(assertOutcome({scenario:'valid',failure:null,insertedCount:2,rollbackVerified:true}),'SUBPATH_ONLY_VERIFIED');
 assert.throws(()=>assertOutcome({scenario:'valid',failure:null,insertedCount:1,rollbackVerified:true}),{code:'B6_SUBPATH_UNEXPECTED_RESULT'});
});
