import test from 'node:test';
import assert from 'node:assert/strict';
import {createPartyCurrencyComparisonStore,validatePartyCurrencyComparisonIndex,configurePartyCurrencyComparisonStore} from './partyCurrencyComparisonStore.mjs';
const account=()=>({currency:'USD',currencyRaw:'$',movementCount:2,openingCandidateCount:1,periodCount:1,excludedCodeCount:0,missingAmountCount:0,missingRateCount:0,recordedNetExact:'5.00000000',openingCandidateNetExact:'2.00000000',periodNetExact:'3.00000000',excludedNetExact:null,direction:'B',status:'RECORDED_NET_ONLY'});
const fixture=()=>({schemaVersion:'melisa-party-currency-comparison.v1',source:{server:'DESKTOP-KSRK0EQ',database:'VEGA2026',hash:'a'.repeat(64),capturedAt:'2026-10-07T09:00:00Z',dateFrom:'2026-01-01',dateToExclusive:'2026-10-08',atomicSnapshot:false},report:{sha256:'b'.repeat(64),dateVerified:false,filterVerified:false},parties:[{nativeId:'15',role:'customer',nativeCode:'SYNTHETIC-CUSTOMER',sourceCompany:'F0102',sourceId:'22',sourceKey:'synthetic-source-key',sourceRecordKey:'synthetic-record-key',identityBasis:'exact-source-link',identityVerified:true,accounts:[account()]}]});
const raw=()=>({customer:{id:'15',customerCode:'SYNTHETIC-CUSTOMER'},sourceLinks:[{customerId:'15',sourceId:'22',sourceCompany:'F0102',sourceRecordKey:'synthetic-record-key'}],sourceParties:[{globalSourceLinkCount:1}],quarantineHolds:[],provenance:{verified:true,quarantineVerified:true}});
test('comparison keeps each currency and diagnostic source separate from effective balance and raw card values',()=>{
 const index=fixture();index.parties[0].accounts.push({...account(),currency:'EUR',currencyRaw:'€',recordedNetExact:'-0.00000001',direction:'A'});
 const row=raw();row.customer.scalarBalanceExact='999999.0000';
 index.source.rawBAKIYE='999999.0000';index.report.GeneralBalance='999999.0000';index.parties[0].accounts[0].contact='private';
 const result=createPartyCurrencyComparisonStore(index)({role:'customer',raw:row});
 assert.equal(result.accounts.length,2);assert.equal(result.effectiveBalance,false);assert.equal(result.report.dateVerified,false);
 assert.equal(result.accounts[1].recordedNetExact,'-0.00000001');assert.equal(JSON.stringify(result).includes('999999'),false);
 assert.equal(JSON.stringify(result).includes('private'),false);
 result.accounts[0].recordedNetExact='999.0000';assert.equal(createPartyCurrencyComparisonStore(index)({role:'customer',raw:row}).accounts[0].recordedNetExact,'5.00000000');
});
test('wrong role/code/source owner, duplicate binding and ambiguous links fail closed',()=>{
 const store=createPartyCurrencyComparisonStore(fixture());
 for(const change of [r=>r.customer.customerCode='OTHER',r=>r.sourceLinks[0].sourceId='23',r=>r.sourceLinks[0].customerId='16',r=>r.sourceLinks[0].sourceRecordKey='other',r=>r.sourceParties[0].globalSourceLinkCount=2,r=>r.sourceLinks.push({...r.sourceLinks[0]}),r=>r.provenance.verified=false]){
  const r=raw();change(r);assert.equal(store({role:'customer',raw:r}),null);
 }
 assert.equal(store({role:'supplier',raw:raw()}),null);
 const duplicate=fixture();duplicate.parties.push({...duplicate.parties[0]});assert.throws(()=>validatePartyCurrencyComparisonIndex(duplicate));
});
test('exact hold identity may be inspected without unblocking or replacing effective balances',()=>{
 const index=fixture();index.parties[0].identityBasis='exact-hold-source-link';
 const r=raw();r.sourceLinks=[];r.quarantineHolds=[{entity:'customer',nativeId:'15',sourceKey:'synthetic-source-key'}];
 assert.equal(createPartyCurrencyComparisonStore(index)({role:'customer',raw:r}).effectiveBalance,false);
 r.quarantineHolds[0].entity='supplier';assert.equal(createPartyCurrencyComparisonStore(index)({role:'customer',raw:r}),null);
});
test('no movement is not zero; missing rate and unknown currency cannot produce proven net',()=>{
 const index=fixture(),a=index.parties[0].accounts[0];
 Object.assign(a,{movementCount:0,openingCandidateCount:0,periodCount:0,recordedNetExact:null,openingCandidateNetExact:null,periodNetExact:null,direction:null,status:'NO_MOVEMENT'});assert.doesNotThrow(()=>validatePartyCurrencyComparisonIndex(index));
 a.recordedNetExact='0.00000000';a.direction='ZERO';assert.throws(()=>validatePartyCurrencyComparisonIndex(index));
 for(const key of ['missingRateCount','missingAmountCount']){const f=fixture();f.parties[0].accounts[0][key]=1;assert.throws(()=>validatePartyCurrencyComparisonIndex(f));}
 const f=fixture();f.parties[0].accounts[0].currency=null;assert.throws(()=>validatePartyCurrencyComparisonIndex(f));
});
test('configuration rejects other roots, LIVE identity and forged hash without reading financial files',async()=>{
 for(const config of [{root:'C:\\LIVE',indexSha256:'a'.repeat(64)},{root:'C:\\Sirket\\ERP\\data\\TEST-20260929-01\\party-currency-comparison-goal71',indexSha256:'a'.repeat(64),identity:{serverName:'Semih\\MELISADEV',databaseName:'LIVE'},mode:'erp',port:4144}]){
  await assert.rejects(configurePartyCurrencyComparisonStore(config));
 }
 await configurePartyCurrencyComparisonStore({});
});
