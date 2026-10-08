import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from './party-currency-readonly-plan.mjs';
import {sqlHash,TARGET} from './goal73-supplier-delta.mjs';
import {CURRENT_APPROVED_PACKET_HASH,currentFinanceContext,validateCurrentExecutionApproval,
  currentSourceEligibility,currentNativeEligibility,currentFinancialMutations,currentLegacyFourProjection,prepareCurrentPrecisionPermit,verifyCurrentReceipt,createCurrentFinanceSqlStore} from './current-finance-test-application.mjs';

const ctx=currentFinanceContext();
function row(role='customer',currency='USD',delta='1.00000001') {
  const partyJSON='{"id":4,"name":"SYNTHETIC","balance":1.0000,"row_version":"AAAAAAABAAA="}';
  return {accountKey:'SYN/'+role+'/'+currency,source:{role,currency,rowsHash:'rows',closingWitness:{cardIdentityHash:'card'}},mainCurrency:currency,
    native:{id:'10',targetId:'4',partyEntityId:'6',captureMovementRows:[{id:'1',rowHash:'ledger1'}]},
    scalarWitness:{nativeAccountBeforeSqlHash:'account',nativePartyBeforeSqlHash:sqlHash(partyJSON)},
    proposal:{nativeBefore:'1.00000000',nativeDelta:delta,expectedAfter:delta==='0.00000000'?'1.00000000':'2.00000001',preservedLocalEffects:'0.00000000'}};
}
function native(r) {return {id:'10',partyId:'4',partyEntityId:'6',currency:r.source.currency,mainCurrency:r.mainCurrency,
  links:1,holds:0,ledgerMissing:0,value:'1.00000000',ledger:'1.00000000',localEffects:'0.00000000',witness:'account',
  beforeJSON:'{"id":10}',partyJSON:'{"id":4,"name":"SYNTHETIC","balance":1.0000,"row_version":"AAAAAAABAAA="}',movementHashes:[{id:'1',h:'ledger1'}]};}
function source(r) {return {identity:{server:'DESKTOP-KSRK0EQ',database:'VEGA2026',sysadmin:0},SELECTOnly:true,twoPassStable:true,endedAt:new Date().toISOString(),checks:[{accountKey:r.accountKey,eligible:true,twoPassStable:true,sourceRowsHash:'rows',cardIdentityHash:'card'},...Array.from({length:282},(_,i)=>({accountKey:'SYN/other/'+i,eligible:true,twoPassStable:true,sourceRowsHash:'rows',cardIdentityHash:'card'}))]};}
test('the current TEST approval is pinned independently of immutable preparation authorization',()=>{
  const packet={packetHash:CURRENT_APPROVED_PACKET_HASH,pendingAccountKeys:['a'],summary:{pendingNewAccounts:283,pendingDifferenceAccounts:59,pendingNoOpAccounts:224,scalarMirrorRepairAccounts:157,precisionUpgradeAccounts:159,priorAppliedAccounts:16,blockedOrExcludedAccounts:770}};
  const approval={schemaVersion:'melisa-current-finance-execution-approval.v1',packetHash:packet.packetHash,humanAmountApproved:true,testOnly:true,actorId:'13',target:TARGET,approvedAccountKeys:['a']};
  assert.deepEqual(validateCurrentExecutionApproval(packet,approval),ctx);
  for(const bad of [{...approval,target:{...TARGET,database:'LIVE'}},{...approval,approvedAccountKeys:['b']},{...approval,testOnly:false},{...approval,humanAmountApproved:false},{...approval,actorId:'1'}])assert.throws(()=>validateCurrentExecutionApproval(packet,bad));
  assert.equal(ctx.actualT1,false);assert.equal(ctx.cutoverId,'fbc08638-0ddd-44b9-8bc5-da9c0fd29551');
});
test('per-account source drift is separated, while wrong DB/admin/stale evidence fails closed',()=>{
  const r=row(),s=source(r);assert.equal(currentSourceEligibility(r,s),null);
  for(const field of ['sourceRowsHash','cardIdentityHash'])assert.equal(currentSourceEligibility(r,{...s,checks:[{...s.checks[0],[field]:'changed'},...s.checks.slice(1)]}),'SOURCE_CHANGED');
  assert.throws(()=>currentSourceEligibility(r,{...s,checks:[]}),/PROOF_FIXED_SCOPE/);
  for(const bad of [{...s,SELECTOnly:false},{...s,endedAt:'2020-01-01'},{...s,identity:{...s.identity,sysadmin:1}},{...s,identity:{...s.identity,database:'LIVE'}}])assert.throws(()=>currentSourceEligibility(r,bad),/BOUNDARY_OR_FRESHNESS/);
});
test('one unstable account among the fixed283 defers only that account; missing/duplicate/foreign scope fails closed',()=>{
  const r=row(),s=source(r),unstable={...s,twoPassStable:false,checks:s.checks.map((c,i)=>i===1?{...c,twoPassStable:false,eligible:false}:c)};
  const approvedKeys=s.checks.map(c=>c.accountKey);
  assert.equal(currentSourceEligibility(r,unstable,Date.now(),approvedKeys),null);
  const changedRow={...r,accountKey:s.checks[1].accountKey};
  assert.equal(currentSourceEligibility(changedRow,unstable,Date.now(),approvedKeys),'SOURCE_CHANGED');
  for(const bad of [{...s,checks:s.checks.slice(1)},{...s,checks:[s.checks[0],s.checks[0],...s.checks.slice(2)]},{...s,checks:[{...s.checks[0],accountKey:'foreign'},...s.checks.slice(1)]}])assert.throws(()=>currentSourceEligibility(r,bad,Date.now(),approvedKeys),/PROOF_FIXED_SCOPE/);
});
test('native CAS detects role/currency/holds, local drift and offsetting old-ledger tampering',()=>{
  const r=row(),n=native(r);assert.equal(currentNativeEligibility(r,n),null);
  assert.match(currentNativeEligibility(r,{...n,currency:'TRY'}),/IDENTITY/);
  assert.match(currentNativeEligibility(r,{...n,holds:1}),/HOLD/);
  assert.match(currentNativeEligibility(r,{...n,localEffects:'0.00000001'}),/LOCAL/);
  assert.match(currentNativeEligibility(r,{...n,partyJSON:n.partyJSON.replace('SYNTHETIC','OTHER')}),/BEFOREIMAGE/);
  assert.match(currentNativeEligibility(r,{...n,movementHashes:[{id:'1',h:'offsetting-tamper'}]}),/HISTORY/);
});
test('both role/currency deltas preserve eight decimals and exact source provenance without FX',()=>{
  for(const role of ['customer','supplier'])for(const currency of ['TRY','USD','EUR']) {
    const r=row(role,currency),m=currentFinancialMutations(r,native(r),ctx,'2026-10-08');
    assert.equal(m.length,4);assert.deepEqual(m[0].fields,{current_balance:'2.00000001'});
    const movement=m.find(m=>m.table===role+'_movements');assert.equal(movement.fields.balance_effect_exact,'1.00000001');
    assert.equal(movement.fields.balance_effect,'1.00000000');assert.equal(movement.fields.amount,'1.00000000');
    assert.equal(movement.fields.account_currency,currency);assert.equal(movement.fields.currency_code,currency);
    assert.equal(movement.fields[role+'_id'],'4');assert.equal(movement.fields.source_payload_hash,CURRENT_APPROVED_PACKET_HASH);
    assert.equal(JSON.parse(movement.fields.source_payload_json).actualT1,false);
    assert.deepEqual(m.find(m=>m.table===(role==='customer'?'customers':'suppliers')).fields,{balance:'2.00000001'});
  }
});
test('legacy four-place projections are explicit half-away, including tiny signed values, without affecting exact delta',()=>{
  for(const [before,after] of [['1.23444999','1.23440000'],['1.23445000','1.23450000'],['-1.23445000','-1.23450000'],['0.00004999','0.00000000'],['-0.00004999','0.00000000'],['-0.00005000','-0.00010000']])assert.equal(currentLegacyFourProjection(before),after);
  const r=row('supplier','EUR','-0.00005000');r.proposal.expectedAfter='0.99995000';const m=currentFinancialMutations(r,native(r),ctx,'2026-10-08').find(m=>m.table==='supplier_movements');
  assert.equal(m.fields.balance_effect_exact,'-0.00005000');assert.equal(m.fields.balance_effect,'-0.00010000');assert.equal(m.fields.amount,'0.00010000');
});
test('non-main accounts cannot change scalar and every ledger no-op produces zero mutations',()=>{
  const r=row();r.mainCurrency='TRY';assert.equal(currentFinancialMutations(r,native(r),ctx,'2026-10-08').length,3);
  for(const role of ['customer','supplier']) {const z=row(role,'USD','0.00000000');assert.deepEqual(currentFinancialMutations(z,native(z),ctx,'2026-10-08'),[]);}
});
test('receipt UUID/body binding rejects changed delta, duplicate native identity and noop fake audit',()=>{
  const body={id:ctx.cutoverId+'/account',planHash:ctx.planHash,status:'COMMITTED',actualT1:false,mode:'APPROVED_CURRENT_TEST_ACCOUNT_DELTA',actorId:'13',effects:[{nativeId:'10',delta:'0.00000000',movementId:null,auditId:null}]};
  const receipt={...body,receiptHash:hash(body)};assert.deepEqual(verifyCurrentReceipt(receipt,ctx),receipt);
  assert.throws(()=>verifyCurrentReceipt({...receipt,effects:[{...body.effects[0],delta:'1.00000000'}]},ctx),/BODY_CONFLICT/);
  for(const effects of [[{...body.effects[0],auditId:'2'}],[body.effects[0],body.effects[0]]])assert.throws(()=>verifyCurrentReceipt({...body,effects,receiptHash:hash({...body,effects})},ctx),/EFFECT_IDENTITY/);
});
test('SQL store cannot be created with a connection/pause-only driver',()=>{
  assert.throws(()=>createCurrentFinanceSqlStore({transaction:()=>{},verifyPause:()=>true}),/CONNECTED_GUARDED_DRIVER/);
});
test('precision permit survives parameterized RPC child scope and keeps the packet value bound',async()=>{
  const ownerTemp=new Set();let boundPacket=null;
  const q=async(op,sql,params={})=>{
    // SQL Server preserves owner-batch temps; child sp_executesql temps expire
    // on return. A combined parameterized CREATE+INSERT cannot authorize the
    // subsequent precision RPC, even if the INSERT succeeded inside it.
    const child=Object.keys(params).length>0,scope=child?new Set(ownerTemp):ownerTemp;
    if(sql.includes('CREATE TABLE #approved_current_finance_precision'))scope.add('permit');
    if(sql.includes('INSERT #approved_current_finance_precision')){assert.equal(scope.has('permit'),true);boundPacket=params.hash;}
  };
  await prepareCurrentPrecisionPermit(q,CURRENT_APPROVED_PACKET_HASH);
  assert.equal(ownerTemp.has('permit'),true);assert.equal(boundPacket,CURRENT_APPROVED_PACKET_HASH);
});
