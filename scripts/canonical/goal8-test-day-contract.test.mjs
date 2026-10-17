import test from 'node:test';
import assert from 'node:assert/strict';
import {GOAL8_DAY_TARGET as target,GOAL8_DAY_IDENTITY_SQL,GOAL8_DAY_SNAPSHOT_SQL,auditGoal8TestDay,verifyGoal8LinkedDay,verifyGoal8Snapshot} from './goal8-test-day.mjs';
const baseline={productId:'325503',productCode:'TEST-FINISH-GOODS-P2',supplierId:'13370',supplierCode:'TEST-V70-GOODS-S',customerId:'30598',customerCode:'TEST-NIGHT-20261006-C',accountId:'38',accountCode:'TEST-NIGHT-20261006-K',unit:'ADET',productCurrency:'TRY',supplierCurrency:'TRY',customerCurrency:'TRY',accountCurrency:'TRY',stockExact3:'5.000',costExact4:'80.0000',supplierExact4:'200.0000',customerExact4:'40.0000',cashExact4:'100.0000',syntheticProvenance:true,holdCount:0};
const clone=value=>structuredClone(value);
function fixture(){
 const identity={databaseName:target.database,serverName:target.server,loginName:target.login,databaseUser:target.login,sysadmin:0,control:0,liveAccess:0,fixedActors:2};
 const health={ok:true,environment:'CANONICAL_TEST',mode:'erp',port:4144,databaseName:target.database,serverName:target.server,loginName:target.login,databaseUser:target.login,sysadmin:0,databaseControl:0,liveDatabaseAccess:0,sourceCommit:target.sourceCommit,packageId:target.packageId,sqlReadOnly:false,writes:true,externalOperations:false,automaticJobs:false};
 const product=id=>({id,synthetic:true,writeEligible:true});
 const scope={synthetic:true,supplier:{id:'13370'},products:[product('301985'),product('325503')]};
 const contexts={
  '/api/auth/me':{id:16,role:{code:'isolated_test_ilker'}},
  '/api/work-receiving/context':{scope:clone(scope)},
  '/api/work-purchases/context':{scope:clone(scope)},
  '/api/work-sales/context':{scope:{synthetic:true,customer:{id:'30598',synthetic:true},products:[product('345504'),product('345505')],accounts:[{id:'38',currency:'TRY',synthetic:true}]}},
  '/api/work-supplier-payments/context':{suppliers:[{id:'13380',currency:'TRY',synthetic:true,writeEligible:true,debtKind:'invoice',invoices:[{id:'21'}]}],accounts:[{id:'39',currency:'TRY',synthetic:true}]},
  '/api/test-daily/count':{countProducts:[product('301985'),product('325503')]}
 };
 const calls=[],snapshot=clone(baseline);
 const httpGet=async path=>{calls.push({method:'GET',path});return path==='/test-health'?clone(health):{success:true,data:clone(contexts[path])};};
 const sqlRead=async query=>{assert.ok([GOAL8_DAY_IDENTITY_SQL,GOAL8_DAY_SNAPSHOT_SQL].includes(query));assert.doesNotMatch(query,/\b(?:INSERT|UPDATE|DELETE|EXEC|ALTER|DROP|CREATE|GRANT|TRUNCATE)\b/i);calls.push({method:'SELECT'});return {recordset:[clone(query===GOAL8_DAY_IDENTITY_SQL?identity:snapshot)]};};
 return {identity,health,contexts,snapshot,calls,httpGet,sqlRead};
}
test('actual-shaped disconnected native scopes remain BLOCKED, with no HTTP/SQL write',async()=>{
 const f=fixture(),result=await auditGoal8TestDay(f);
 assert.equal(result.connected,false);assert.equal(result.chainExecuted,false);assert.equal(result.technicalPass,false);
 assert.deepEqual(result.breaks.map(b=>b.code),['RECEIVE_SALE_PRODUCT_DISCONNECTED','PURCHASE_PAYMENT_SUPPLIER_DISCONNECTED','COLLECTION_PAYMENT_CASH_DISCONNECTED','BATCH_PURCHASE_RETURN_SOURCE_UNSUPPORTED']);
 assert.ok(f.calls.every(c=>['GET','SELECT'].includes(c.method)));
});
test('explicit run flag refuses disconnected profile before any receiving write',async()=>{
 const f=fixture();await assert.rejects(auditGoal8TestDay({...f,runSyntheticDay:true}),{code:'GOAL8_CONNECTED_PROFILE_REQUIRED'});
 assert.ok(f.calls.every(c=>['GET','SELECT'].includes(c.method)));
});
for(const [key,value] of [['databaseName','LIVE'],['serverName','other'],['loginName','sa'],['databaseUser','dbo'],['sysadmin',1],['control',1],['liveAccess',1],['fixedActors',1]])test('SQL identity rejection: '+key,async()=>{
 const f=fixture();f.identity[key]=value;await assert.rejects(auditGoal8TestDay(f),{code:'GOAL8_SQL_TARGET_REJECTED'});assert.equal(f.calls.filter(c=>c.path?.startsWith('/api/')).length,0);
});
for(const [key,value] of [['sourceCommit','cbfff56'],['packageId','CANONICAL-GOAL73-TEST-20261007-86'],['port',4146],['loginName','sa'],['databaseUser','dbo'],['sysadmin',1],['databaseControl',1],['liveDatabaseAccess',1],['sqlReadOnly',true],['writes',false],['externalOperations',true],['automaticJobs',true]])test('runtime gate rejection: '+key,async()=>{
 const f=fixture();f.health[key]=value;await assert.rejects(auditGoal8TestDay(f),{code:'GOAL8_RUNTIME_TARGET_REJECTED'});
});
test('wrong HTTP actor rejected before native fixture read',async()=>{const f=fixture();f.contexts['/api/auth/me'].id=1;await assert.rejects(auditGoal8TestDay(f),{code:'GOAL8_HTTP_ACTOR_REJECTED'});assert.equal(f.calls.filter(c=>c.method==='SELECT').length,1);});
for(const [key,value] of [['syntheticProvenance',false],['holdCount',1],['supplierCode','REAL-S'],['productId','1'],['customerCurrency','USD']])test('synthetic snapshot rejection: '+key,()=>{assert.throws(()=>verifyGoal8Snapshot({...clone(baseline),[key]:value}),{code:'GOAL8_SYNTHETIC_OR_HOLD_REJECTED'});});
test('API synthetic flag cannot be omitted',async()=>{const f=fixture();delete f.contexts['/api/work-sales/context'].scope.synthetic;await assert.rejects(auditGoal8TestDay(f),{code:'GOAL8_SYNTHETIC_FLAG_REQUIRED'});});
test('collection cash must match the independently read native account',async()=>{const f=fixture();f.contexts['/api/work-sales/context'].scope.accounts[0].id='99';await assert.rejects(auditGoal8TestDay(f),{code:'GOAL8_COLLECTION_CASH_SCOPE_DRIFT'});});
test('duplicate product IDs cannot fake an intersecting scope',async()=>{const f=fixture();f.contexts['/api/work-sales/context'].scope.products[1].id='345504';await assert.rejects(auditGoal8TestDay(f),{code:'GOAL8_DUPLICATE_SCOPE'});});
test('HTTP connection failure carries no retry or mutation',async()=>{const f=fixture();f.httpGet=async()=>{throw Error('offline');};await assert.rejects(auditGoal8TestDay(f),/offline/);assert.equal(f.calls.length,0);});
function linkedDay(){
 const names=['baseline','receive','purchase','sale','collect','pay','count','return','daily-report'];
 const stocks=['5.000','7.000','7.000','6.000','6.000','6.000','6.000','5.000','5.000'];
 const suppliers=['200.0000','200.0000','360.0000','360.0000','360.0000','280.0000','280.0000','200.0000','200.0000'];
 const customers=['40.0000','40.0000','40.0000','160.0000','40.0000','40.0000','40.0000','40.0000','40.0000'];
 const cash=['100.0000','100.0000','100.0000','100.0000','220.0000','140.0000','140.0000','140.0000','140.0000'];
 return names.map((stage,i)=>({...clone(baseline),stage,currency:'TRY',synthetic:true,independentNativeReadback:true,stockExact3:stocks[i],supplierExact4:suppliers[i],customerExact4:customers[i],cashExact4:cash[i],requestId:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,replayed:true,replayAdditionalEffects:0,receiptId:'71',purchaseInvoiceId:'81',salesInvoiceId:'91',amountExact4:stage==='collect'?'120.0000':'80.0000',direction:stage==='collect'?'in':'out',quantityExact3:'1.000',reportVerified:true,reportSalesInvoiceId:'91',reportPurchaseInvoiceId:'81',reportReceiptId:'71',reportSalesExact4:'120.0000',reportPurchasesExact4:'160.0000',reportCollectionsExact4:'120.0000',reportPaymentsExact4:'80.0000',reportReturnsExact4:'80.0000'}));
}
test('injected linked native evidence verifies exact deltas with existing balances preserved',()=>{const result=verifyGoal8LinkedDay(linkedDay());assert.equal(result.cashDeltaExact4,'40.0000');assert.equal(result.humanAccepted,false);assert.equal(result.crmChainIncluded,false);});
for(const [index,key,value,code] of [[2,'stockExact3','9.000','GOAL8_STAGE_DELTA'],[4,'salesInvoiceId','999','GOAL8_COLLECTION_LINK'],[5,'purchaseInvoiceId','999','GOAL8_PAYMENT_LINK'],[5,'accountId','39','GOAL8_STAGE_SCOPE_OR_PROOF'],[6,'replayAdditionalEffects',1,'GOAL8_REPLAY_PROOF_REQUIRED'],[7,'receiptId','999','GOAL8_RETURN_LINK'],[8,'reportPurchaseInvoiceId','999','GOAL8_DAILY_REPORT_LINK']])test('linked day rejects disconnected/inconsistent stage '+index+'/'+key,()=>{const day=linkedDay();day[index][key]=value;assert.throws(()=>verifyGoal8LinkedDay(day),{code});});
test('missing independent native readback cannot be substituted with module predictions',()=>{const day=linkedDay();day[2].independentNativeReadback=false;assert.throws(()=>verifyGoal8LinkedDay(day),{code:'GOAL8_STAGE_SCOPE_OR_PROOF'});});
test('unrelated module ordering cannot be treated as a day',()=>{const day=linkedDay();[day[1],day[3]]=[day[3],day[1]];assert.throws(()=>verifyGoal8LinkedDay(day),{code:'GOAL8_STAGE_SEQUENCE'});});
test('reuse of another stage request ID is rejected',()=>{const day=linkedDay();day[5].requestId=day[1].requestId;assert.throws(()=>verifyGoal8LinkedDay(day),{code:'GOAL8_REQUEST_ID_REQUIRED'});});
