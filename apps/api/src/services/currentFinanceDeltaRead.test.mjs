import test from 'node:test';
import assert from 'node:assert/strict';
import {CURRENT_FINANCE_PARTY_PROC,CURRENT_FINANCE_PARTY_PROC_HASH,CURRENT_FINANCE_PARTY_PROC_SQL,CURRENT_FINANCE_PARTY_PROOF_QUERY_SQL,currentFinanceContext,configureCurrentFinanceContext,configuredCurrentFinanceContext,readCurrentFinanceProof,attachCurrentFinanceProof} from './currentFinanceDeltaRead.mjs';
import {attachFinalPartyProof,FINAL_PARTY_READ_SQL} from './finalPartyDeltaRead.mjs';
import {assembleCustomerCardRaw} from './customerCardReadStore.mjs';
import {assembleSupplierCardRaw} from './supplierCardReadStore.mjs';
import {customerCardDto} from './customerCardModel.mjs';
import {supplierCardDto} from './supplierCardModel.mjs';
const context={schemaVersion:'melisa-current-finance-read-context.v1',cutoverId:'33333333-3333-4333-8333-333333333333',planHash:'a'.repeat(64),partyBindingsHash:'b'.repeat(64),packetHash:'c'.repeat(64),accountIds:['10']};
function runtime(rows,definition=CURRENT_FINANCE_PARTY_PROC_HASH){class Request{constructor(tx){assert.equal(tx,'same-tx');}input(){return this;}async execute(name){assert.equal(name,CURRENT_FINANCE_PARTY_PROC);return {recordset:[{readerDefinitionHash:definition,rowsJson:JSON.stringify(rows)}]};}}return {sql:{Request,NVarChar:n=>n,Char:n=>n,MAX:-1},tx:'same-tx',ids:['10'],context};}
function fixture(role,currency){const supplier=role==='supplier',id='10',party='40',company=supplier?'F0103':'F0102';return {[role]:{id,[role+'Code']:'SYN-CURRENT',[role+'Name']:'Synthetic amount approval',currency,partyEntityId:party,isActive:true},sourceLinks:[{sourceId:'100',sourceCompany:company,partyEntityId:party}],sourceParties:[{sourceKey:'SYN/PARTY',sourceId:'100',company,role,code:'SYN-CURRENT',name:'Synthetic amount approval',currency,scope:'IN_SCOPE_ACTIVE',balanceStatus:'SOURCE',globalSourceLinkCount:1}],sourceAccounts:[{sourceKey:'SYN/'+currency,partySourceKey:'SYN/PARTY',role,currency,balanceStatus:'SOURCE',sourceOpeningBalanceExact:'100.00000000'}],nativeAccounts:[{id,[role+'Id']:id,['nativeOwner'+(supplier?'Supplier':'Customer')+'Id']:id,partyEntityId:party,currency,nativeBalanceExact:'92.00000001',localDeltaExact:'5.00000000',ledgerBalanceExact:'92.00000001',...(supplier?{sourceDeltaExact:'-20.00000000',sourceDeltaVerified:true}:{})}],quarantineHolds:[]};}
test('current receipt is a separate amount-approved TEST context; real cutover is not implied',()=>{assert.equal(currentFinanceContext(null),null);assert.throws(()=>currentFinanceContext({...context,schemaVersion:'melisa-final-catalog-context.v1'}),/CONTEXT/);assert.throws(()=>currentFinanceContext({...context,accountIds:['10','10']}),/CONTEXT/);assert.match(CURRENT_FINANCE_PARTY_PROC_SQL,/CURRENT_RECONCILED/);assert.match(CURRENT_FINANCE_PARTY_PROC_SQL,/actualT1.*false/);assert.match(CURRENT_FINANCE_PARTY_PROC_SQL,/packetHash.*packet_hash/);assert.match(CURRENT_FINANCE_PARTY_PROC_SQL,/source_payload_hash<>r.plan_hash/);});
test('configuration cannot activate on LIVE, native, or privileged application connection',()=>{const r={identity:{serverName:'Semih\\MELISADEV',databaseName:'MELISA_ERP_SIRKET_TEST_20260929_01',sysadmin:0},mode:'erp',port:4144,writes:true};for(const bad of [{mode:'native'},{writes:false},{port:4146},{identity:{...r.identity,sysadmin:1}},{identity:{...r.identity,databaseName:'LIVE'}}])assert.throws(()=>configureCurrentFinanceContext(context,{...r,...bad}),/RUNTIME/);configureCurrentFinanceContext(context,r);assert.equal(configuredCurrentFinanceContext().packetHash,context.packetHash);configureCurrentFinanceContext(null);assert.equal(configuredCurrentFinanceContext(),null);});
test('missing, duplicate, foreign, and definition-drift proof fail closed in the same transaction',async()=>{assert.deepEqual(await readCurrentFinanceProof(runtime([{accountId:'10',sourceDeltaExact:'0.00000000',verified:true}])),[{accountId:'10',sourceDeltaExact:'0.00000000',verified:true}]);await assert.rejects(readCurrentFinanceProof(runtime([])),/MISSING/);await assert.rejects(readCurrentFinanceProof(runtime([{accountId:'10'},{accountId:'10'}])),/READBACK/);await assert.rejects(readCurrentFinanceProof(runtime([{accountId:'11'}])),/READBACK/);await assert.rejects(readCurrentFinanceProof(runtime([],'drift')),/READER_DRIFT/);});
test('both roles retain opening, prior Goal73, FINAL, and local effects separately; current delta is added once',()=>{for(const role of ['customer','supplier'])for(const currency of ['TRY','USD','EUR']){const raw=fixture(role,currency);attachFinalPartyProof([raw],[{accountId:'10',sourceDeltaExact:'2.00000000',verified:true}]);attachCurrentFinanceProof([raw],[{accountId:'10',sourceDeltaExact:role==='supplier'?'5.00000001':'-14.99999999',verified:true}]);const dto=(role==='customer'?customerCardDto:supplierCardDto)((role==='customer'?assembleCustomerCardRaw:assembleSupplierCardRaw)(raw));assert.equal(dto.accounts[0].reconciled,true);assert.equal(dto.accounts[0].balanceExact,'92.00000001');assert.equal(dto.accounts[0].localDeltaExact,'5.00000000');}});
test('no-op proof changes no existing value and bad source proof cannot mask earlier failure',()=>{const raw=fixture('customer','USD');attachFinalPartyProof([raw],[{accountId:'10',sourceDeltaExact:'-13.00000001',verified:true}]);attachCurrentFinanceProof([raw],[{accountId:'10',sourceDeltaExact:'0.00000000',verified:true}]);assert.equal(raw.nativeAccounts[0].finalSourceDeltaExact,'-13.00000001');raw.nativeAccounts[0].finalSourceDeltaVerified=false;attachCurrentFinanceProof([raw],[{accountId:'10',sourceDeltaExact:'1.00000000',verified:true}]);assert.equal(raw.nativeAccounts[0].finalSourceDeltaExact,null);assert.equal(raw.nativeAccounts[0].finalSourceDeltaVerified,false);assert.throws(()=>attachCurrentFinanceProof([raw],[{accountId:'10'},{accountId:'10'}]),/DUPLICATE/);});

test('materialized proof preserves every original native role/currency/amount/audit validation expression',()=>{
 const prefix=sql=>sql.slice(0,sql.indexOf('\nFROM '));
 const restored=CURRENT_FINANCE_PARTY_PROOF_QUERY_SQL.replace('r.parent_plan_hash','p.plan_hash')
  .replace('r.parsed_receipt_hash',"JSON_VALUE(r.receipt_json,'$.receiptHash')")
  .replace('r.parsed_plan_hash',"JSON_VALUE(r.receipt_json,'$.planHash')")
  .replace('r.parsed_actor_id',"JSON_VALUE(r.receipt_json,'$.actorId')");
 assert.equal(prefix(restored),prefix(FINAL_PARTY_READ_SQL));
 assert.doesNotMatch(CURRENT_FINANCE_PARTY_PROOF_QUERY_SQL,/receipt_json|OPENJSON|JSON_VALUE/);
 assert.match(CURRENT_FINANCE_PARTY_PROOF_QUERY_SQL,/JOIN #current_finance_effects e ON e.child_id=r.child_id/);
 assert.match(CURRENT_FINANCE_PARTY_PROOF_QUERY_SQL,/JOIN #current_finance_ids ids ON a.id=ids.account_id/);
 assert.match(CURRENT_FINANCE_PARTY_PROOF_QUERY_SQL,/r.parsed_status=N'COMMITTED'/);
});
test('large receipt metadata/effects are materialized before page joins on each call, with missing metadata rejected',()=>{
 const sql=CURRENT_FINANCE_PARTY_PROC_SQL;
 assert.match(sql,/^CREATE OR ALTER PROCEDURE/);
 assert.equal((sql.match(/OPENJSON\(r.receipt_json\)/g)||[]).length,1);
 assert.equal((sql.match(/OPENJSON\(r.effects_json\)/g)||[]).length,1);
 assert.equal((sql.match(/INTO #current_finance_/g)||[]).length,3);
 assert.ok(sql.indexOf('INTO #current_finance_receipts')<sql.indexOf('INTO #current_finance_effects'));
 assert.ok(sql.indexOf('INTO #current_finance_effects')<sql.indexOf('JOIN #current_finance_ids ids'));
 assert.match(sql,/parsed_receipt_hash IS NULL OR parsed_plan_hash IS NULL OR parsed_actor_id IS NULL OR parsed_status IS NULL OR effects_json IS NULL/);
 // Extraction must not truncate an invalid suffix into a valid hash/actor.
 // JSON_VALUE's old 4000-character scalar boundary is kept fail-closed.
 for(const name of ['parsed_receipt_hash','parsed_plan_hash','parsed_actor_id','parsed_status']) {
  assert.match(sql,new RegExp(name+' nvarchar\\(max\\)'));
  assert.match(sql,new RegExp('DATALENGTH\\('+name+'\\)>8000'));
 }
 assert.match(sql,/CURRENT_FINANCE_PARTY_RECEIPT_METADATA/);
 assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|GRANT|DISABLE)\b/);
});
test('unverified or numerically mismatching current source evidence never becomes a reconciled balance',()=>{
 for(const role of ['customer','supplier'])for(const currency of ['TRY','USD','EUR']) {
  for(const bad of [{sourceDeltaExact:role==='supplier'?'7.00000001':'-12.99999999',verified:false},{sourceDeltaExact:'1.00000000',verified:true}]) {
   const raw=fixture(role,currency);attachCurrentFinanceProof([raw],[{accountId:'10',...bad}]);
   const dto=(role==='customer'?customerCardDto:supplierCardDto)((role==='customer'?assembleCustomerCardRaw:assembleSupplierCardRaw)(raw));
   assert.notEqual(dto.accounts[0].reconciled,true);assert.equal(dto.accounts[0].balanceExact,null);
  }
  assert.throws(()=>attachCurrentFinanceProof([fixture(role,currency)],[{accountId:'10',sourceDeltaExact:null,verified:true}]),/EXACT/);
 }
});
