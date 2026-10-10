import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import * as base from './isolatedOperationCopyContext.mjs';
import {fixtureContext,fixtureIdentity,fixtureProof} from './isolatedOperationCopyContext.test.mjs';
const selections=new WeakMap(),scopeHash='D'.repeat(64);
mock.module('./isolatedOperationCopyContext.mjs',{namedExports:{...base,getBusinessDailySelection:c=>{base.assertIsolatedCopyContext(c);return selections.get(c)??null;},getBusinessDailyScopeHash:c=>{base.assertIsolatedCopyContext(c);return selections.has(c)?scopeHash:null;}}});
mock.module('../config/database.js',{namedExports:{getSqlDriver:()=>({BigInt:0}),getSqlPool:async()=>{throw Error('Unit scope may not open a pool');},isCanonicalTest:()=>false,isIsolatedOperationCopyRuntime:()=>false,getIsolatedOperationCopyConfig:()=>null}});
mock.module('./auditService.js',{namedExports:{writeAuditLog:async()=>{}}});
const {resolveBusinessDailyScope,countProductScope}=await import('./testDailyService.mjs');
const {postIsolatedCopyCurrencyMovement}=await import('./nativeCurrencyAccount.mjs');
const {withIsolatedOperationCopyScope}=await import('./isolatedOperationCopyScope.mjs');
function fixture(){
 const raw=fixtureContext();Object.assign(raw,{target:{...raw.target,database:base.BUSINESS_COPY_DATABASE,login:'melisa_shared_test_rw_20261009_02',databaseUser:'melisa_shared_test_rw_20261009_02'},date:'2026-10-09',scopeKind:'VERIFIED_BUSINESS_TEST',businessScopeHash:'e'.repeat(64),businessInvoiceMaxExact4:'20000.0000',externalOperations:false,humanAccepted:false,currencyRates:[{currency:'TRY',rateExact8:'1.00000000',date:'2026-09-12',id:'1',source:'identity'},{currency:'USD',rateExact8:'47.80000000',date:'2026-09-12',id:'2',source:'dated-fixture'}]});
 for(const rows of [raw.customers,raw.suppliers])for(const p of rows)Object.assign(p,{sourceKnown:true,sourceWitnessHash:'f'.repeat(64)});
 raw.suppliers[0].currency='TRY';Object.assign(raw.products[0],{sourceKnown:true,costExact4:'9.2500'});
 raw.products.push({...raw.products[0],id:'999',stockCode:'OTHER',sourceKey:'VEGA2026/F0102TBLSTOKLAR/999'});
 const {sealHash,...body}=raw;raw.sealHash=base.isolatedCopyHash(body);const copy=base.validateIsolatedOperationCopyContext(raw);
 const selection={productIds:['34765'],customerAccountId:'22',supplierAccountId:'32',financeAccountId:'40',currency:'TRY'};selections.set(copy,selection);
 const product={id:'34765',stockCode:'0161 MOLLY',name:'Fixture',unit:{label:'ADET',factorExact8:'1.00000000'},costExact4:'9.2500',stockQuantityExact3:'10.000'};
 const context={meta:{businessDailyScopeHash:scopeHash},scope:{products:[product],supplier:{...copy.suppliers[0]}}};return {copy,context,selection};
}
test('daily scope pins exact registered product/party/account tuples and rejects unregistered or changed DTO',()=>{
 const {copy,context}=fixture(),result=resolveBusinessDailyScope(copy,context);assert.deepEqual(result.products.map(p=>p.id),['34765']);assert.equal(result.supplier.accountId,'32');
 for(const mutate of [c=>c.meta.businessDailyScopeHash='f'.repeat(64),c=>c.scope.products.push({...c.scope.products[0],id:'999',stockCode:'OTHER'}),c=>c.scope.supplier.accountId='999',c=>c.scope.products[0].stockCode='161']){const dto=structuredClone(context);mutate(dto);assert.throws(()=>resolveBusinessDailyScope(copy,dto));}
 assert.throws(()=>resolveBusinessDailyScope(structuredClone(copy),context),{code:'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED'});selections.delete(copy);assert.throws(()=>resolveBusinessDailyScope(copy,context),{code:'BUSINESS_DAILY_SCOPE_REQUIRED'});
});
test('count context reads only finite selected products, never the complete shared profile',async()=>{
 const {copy,context}=fixture(),tx={},lookups=[],calls=[];
 const driver={BigInt:0,UniqueIdentifier:0};
 const req=()=>({params:{},input(k,t,v){this.params[k]=v;return this;},async query(sql){calls.push(sql);if(sql.includes('FROM dbo.products')){lookups.push(this.params.p);return {recordset:[{id:'34765',stockCode:'0161 MOLLY',name:'Fixture',unit:'ADET',stockQuantityExact3:'10.000',costExact4:'9.2500'}]};}return {recordset:[]};},async execute(name){calls.push(name);return {recordset:[]};}});
 await withIsolatedOperationCopyScope({context:copy,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),transaction:tx,write:false},async()=>{const products=await countProductScope({copyContext:copy,context,transaction:tx,sqlDriver:driver,copyReadOnly:true,req});assert.equal(products.length,1);assert.equal(products[0].barcode,'00161');});
 assert.deepEqual(lookups,['34765']);assert.equal(calls.filter(s=>s.includes('FROM dbo.products')).length,1);assert.ok(calls.includes(base.ISOLATED_COPY_PROCEDURES.ready));
});
test('daily native customer and supplier effects bind exact account, rate and scope hash in the same transaction',async()=>{
 const {copy}=fixture(),tx={},calls=[];
 class Request{constructor(t){assert.equal(t,tx);this.params={};}input(k,t,v){this.params[k]=v;return this;}async query(sql){calls.push({sql,params:this.params});return {recordset:[{accountId:this.params.account,partyId:this.params.entity,movementId:this.params.movement,beforeBalance:'10.00000000',afterBalance:'11.00000000',effect:this.params.effect}]};}}
 const driver={Request,BigInt:0,UniqueIdentifier:0,NVarChar:()=>0,Decimal:()=>0};
 await withIsolatedOperationCopyScope({context:copy,identity:fixtureIdentity(copy),readProof:fixtureProof(copy),transaction:tx,write:true},async()=>{
  for(const [role,partyId,account] of [['customer','20','22'],['supplier','30','32']]){await postIsolatedCopyCurrencyMovement({role,partyId,currency:'TRY',movementId:'50',effectExact8:'1.00000000'},{transaction:tx,sqlDriver:driver},{id:'16'});assert.equal(calls.at(-1).params.account,account);assert.equal(calls.at(-1).params.businessDailyScopeHash,scopeHash);assert.equal(calls.at(-1).params.copyAccountRate,'1.00000000');assert.match(calls.at(-1).sql,/JSON_VALUE\(n.payload_json,'\$\.businessDailyScopeHash'\)=@businessDailyScopeHash/);assert.doesNotMatch(calls.at(-1).sql,/UPDATE dbo.(customers|suppliers)/);}
  await assert.rejects(postIsolatedCopyCurrencyMovement({role:'customer',partyId:'20',currency:'USD',movementId:'50',effectExact8:'1.00000000'},{transaction:tx,sqlDriver:driver},{id:'16'}));selections.delete(copy);await assert.rejects(postIsolatedCopyCurrencyMovement({role:'customer',partyId:'20',currency:'TRY',movementId:'50',effectExact8:'1.00000000'},{transaction:tx,sqlDriver:driver},{id:'16'}),{code:'ISOLATED_COPY_ACCOUNT_SCOPE'});
 });assert.equal(calls.length,2);
});
