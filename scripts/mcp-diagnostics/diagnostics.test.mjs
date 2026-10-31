import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessRuntime,assessSale,createDiagnostics,database,diagnosticTools,serverName,summarizeEvents,validateArguments} from './diagnostics.mjs';
import {extendControl} from './server.mjs';
const requestId='11111111-2222-4333-8444-555555555555';
function snapshot(status='finalized') {
  return {readOnly:true,requestId,consistency:'serializable-bounded-read',identity:{databaseName:database,serverName,loginName:'melisa_sirket_test_20260929_01',sysadmin:0,databaseControl:0,elevatedPermissions:0},
    permissions:Array.from({length:7},()=>({canRead:1,canInsert:0,canUpdate:0,canDelete:0})),
    journal:[{operation:status==='draft'?'sale_draft':status==='cancelled'?'sale_cancel':'sale_finalize',recordedStatus:status,actorId:'17',invoiceId:'123'}],linkCount:0,
    invoices:[{header:{invoiceId:'123',status,customerId:'1',accountId:'2',currency:'USD',totalExact:'2.40000000'},
      creation:[{verified:true}],
      items:[{productId:'3',rowCount:1,quantityExact:'2.00000000'}],
      stock:status==='draft'?[]:[{productId:'3',kind:'out',affectsInventory:true,rowCount:1,quantityExact:'-2.00000000'}],
      ledger:status==='draft'?[]:[{kind:'sales_invoice',customerId:'1',accountId:'2',currency:'USD',affectsBalance:true,rowCount:1,amountExact:'2.40000000'}],
      account:[{accountId:'2',customerId:'1',currency:'USD'}]}]};
}
test('only UUID and exact tool arguments are accepted, before any read',async()=>{
  for(const args of [{requestId:'x; DROP TABLE sales'}, {requestId,url:'http://evil'}, {requestId,sql:'SELECT 1'},null,[]])assert.throws(()=>validateArguments('verify_sale_effects',args));
  assert.equal(validateArguments('diagnose_sale_request',{requestId:requestId.toUpperCase()}),requestId);
  let reads=0;const run=createDiagnostics({readSql:()=>{reads++;}});
  await assert.rejects(run('verify_sale_effects',{requestId:'bad'}));assert.equal(reads,0);
  for(const tool of diagnosticTools)assert.deepEqual(tool.annotations,{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false});
});
test('finalize UUID maps via journal invoice ID without a draft link',()=>{
  assert.equal(assessSale(snapshot(),requestId).saleCompleted,true);
  assert.equal(assessSale(snapshot(),requestId).normalScreenAcceptance,'not_assessed');
});
test('missing journal is unknown, never a sale or rollback success',()=>{
  const s=snapshot();s.journal=[];s.invoices=[];
  const result=assessSale(s,requestId);assert.equal(result.state,'unknown');assert.equal(result.saleCompleted,false);
});
test('draft has no commercial effects and is not a completed sale',()=>{
  const r=assessSale(snapshot('draft'),requestId);assert.equal(r.state,'consistent');assert.equal(r.saleCompleted,false);
  const s=snapshot('draft');s.invoices[0].stock=snapshot().invoices[0].stock;assert.equal(assessSale(s,requestId).state,'mismatch');
});
test('finalized cancellation requires both original and exact reversing movements',()=>{
  const s=snapshot('cancelled'),i=s.invoices[0];
  assert.equal(assessSale(s,requestId).state,'mismatch');
  i.stock.push({...i.stock[0],kind:'in',quantityExact:'2.00000000'});
  i.ledger.push({...i.ledger[0],kind:'sales_invoice_cancel',amountExact:'-2.40000000'});
  const r=assessSale(s,requestId);assert.equal(r.state,'consistent');assert.equal(r.saleCompleted,false);assert.equal(r.cancellation,'reversed_movements');
  i.stock=[];i.ledger=[];assert.equal(assessSale(s,requestId).state,'unknown');
  assert.equal(assessSale(s,requestId).reason,'CANCELLATION_ORIGIN_NOT_ESTABLISHED');
});
test('wrong account/currency, incorrect signs, duplicates, missing or inert movements never pass',()=>{
  for(const mutate of [i=>i.ledger[0].accountId='999',i=>i.ledger[0].currency='TRY',i=>i.ledger[0].amountExact='-2.40000000',i=>i.stock[0].quantityExact='2.00000000',i=>i.stock[0].rowCount=2,i=>i.stock.push({...i.stock[0]}),i=>i.stock[0].productId='4',i=>i.stock[0].affectsInventory=false,i=>i.ledger[0].affectsBalance=false,i=>i.stock=[],i=>i.account=[]]){
    const s=snapshot();mutate(s.invoices[0]);assert.equal(assessSale(s,requestId).state,'mismatch');
  }
});
test('money is compared without floating point loss',()=>{
  const s=snapshot();s.invoices[0].header.totalExact='9007199254740993.12345678';s.invoices[0].ledger[0].amountExact='9007199254740993.12345677';assert.equal(assessSale(s,requestId).state,'mismatch');
});
test('privileged readers, other actors, malformed values and mixed request links fail closed',()=>{
  for(const mutate of [s=>s.identity.sysadmin=1,s=>s.permissions[0].canUpdate=1,s=>s.identity.databaseName='LIVE',s=>s.journal[0].actorId='99',s=>s.journal[0].invoiceId='124',s=>s.invoices[0].items[0].quantityExact='NaN',s=>s.journal[0].recordedStatus='draft',s=>s.invoices[0].creation[0].verified=false,s=>s.consistency='read-committed']){
    const s=snapshot();mutate(s);assert.throws(()=>assessSale(s,requestId));
  }
});
test('redaction only emits exact-correlated allowlisted error codes',()=>{
  const raw=JSON.stringify({requestId,code:'EREQUEST',sqlNumber:51917,sql:'SELECT secret',token:'secret',payload:{name:'customer'}});
  const texts=[raw,JSON.stringify({requestId:'other',code:'EREQUEST'}),JSON.stringify({requestId,code:'secretCustomerName'}),`prose ${requestId} password`];
  assert.deepEqual(summarizeEvents(texts,requestId),[{code:'EREQUEST',sqlNumber:51917}]);
});
test('read errors and concurrent-change signals are unknown and hide raw exceptions',async()=>{
  for(const error of ['DIAGNOSTIC_SALE_CHANGED_DURING_READ','DIAGNOSTIC_TLS_VALIDATION_FAILED','password=secret']){
    const run=createDiagnostics({readSql:async()=>({error,readOnly:true})});
    const r=await run('verify_sale_effects',{requestId});assert.equal(r.state,'unknown');assert.equal(r.saleCompleted,false);assert.equal(JSON.stringify(r).includes('secret'),false);
  }
});
test('runtime requires matching processes and current health, not the legacy test mapping',()=>{
  const processes=['erp','native','web'].map((role,n)=>({role,port:[4144,4146,5244][n],pid:n+1,startedAt:'2026-10-31',verified:true}));
  const health=Object.fromEntries(processes.map(s=>[s.role,s.role==='web'?{httpOk:true}:{ok:true,environment:'CANONICAL_TEST',mode:s.role,port:s.port,databaseName:database,serverName,sysadmin:0,databaseControl:0,sqlReadOnly:s.role==='native',actualT1:false}]));
  assert.equal(assessRuntime(processes,health,processes).verified,true);
  const after=structuredClone(processes);after[0].pid=100;assert.equal(assessRuntime(processes,health,after).verified,false);
  health.erp.databaseName='MELISA_ERP_CRM_SHARED_TEST_20261009_02';assert.equal(assessRuntime(processes,health,processes).verified,false);
});
test('extension preserves existing write rejection and other legacy methods',async()=>{
  const blocked=async()=>{throw Error('EXTERNAL_TEST_OBSERVE_ONLY');};const legacy={execute:blocked,prepare:blocked,smoke:()=>42,status:async()=>({hostDeploymentEnabled:false})};
  const tools=[],run=async(name,args)=>({name,args}),control=extendControl(legacy,tools,run);
  assert.equal(tools.length,3);assert.equal(control.smoke(),42);await assert.rejects(control.execute('deploy_test',{}),/EXTERNAL_TEST_OBSERVE_ONLY/);
  assert.equal((await control.execute('get_runtime_status',{})).name,'get_runtime_status');assert.equal((await control.status()).hostDeploymentEnabled,false);
});
test('SQL helper uses verified TLS, typed UUID and fixed SELECTs without a writer credential',()=>{
  const script=fs.readFileSync(new URL('./read-only-probe.ps1',import.meta.url),'utf8');
  assert.match(script,/\['Encrypt'\]=\$true/);assert.match(script,/\['TrustServerCertificate'\]=\$false/);
  assert.match(script,/SqlDbType\]::UniqueIdentifier/);assert.doesNotMatch(script,/salesSqlPassword|Integrated Security|TrustServerCertificate.*\$true/);
  assert.match(script,/DIAGNOSTIC_SALE_CHANGED_DURING_READ/);
});
