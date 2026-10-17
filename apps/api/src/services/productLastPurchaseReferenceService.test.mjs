import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductLastPurchaseReferenceService,lastPurchaseSqlHash} from './productLastPurchaseReferenceService.mjs';
import {PURCHASE_REFERENCE_SQL_PROOF as parentProof} from '../../../../scripts/migration/product-purchase-reference-sql.mjs';

const h='a'.repeat(64),parent='b'.repeat(64),date='2026-10-08T07:00:00.000Z',id='36724',code='0161 MODEL';
const actor={permissions:['product.view','purchase.view','finance.view']};
const proof={readerDefinitionHash:'c'.repeat(64),moduleHashes:Object.fromEntries(['dbo.usp_assert_product_last_purchase','dbo.usp_get_product_last_purchase',...['runs','rows','proof'].map(k=>'erp_migration.immutable_product_last_purchase_'+k)].map(n=>[n,'c'.repeat(64)]))};
const card=()=>({schemaVersion:'melisa-product-purchase-reference.v1',productId:id,stockCode:code,productHash:h,bindingHash:parent,cardAmountExact:'25.00000000',referenceExact:null,discountExact:'10.00000000',currency:'USD',unitLabel:'ADET',status:'CARD_AMOUNT_ONLY',method:'SOURCE_CARD_AMOUNT',priceBasis:'UNKNOWN',sourceAsOf:date,reasons:['DISCOUNT_BASIS_UNVERIFIED'],protectedExistingCost:true,protectedManual:false,accountingCost:false,financialWrites:0,rawSource:{private:'NEVER-PUBLIC'},nativeKey:'PRIVATE-ID'});
const selected=c=>({schemaVersion:'melisa-product-last-purchase.v2',productId:id,stockCode:code,parentRecordHash:lastPurchaseSqlHash(JSON.stringify(c)),productHash:h,bindingHash:parent,referenceExact:'12.50000000',referenceCurrency:'TRY',referenceUnitLabel:'ADET',referenceDate:'2026-10-01T00:00:00',sourceKind:'PURCHASE_DOCUMENT',selectionReason:'LATEST_VERIFIED_PURCHASE_DOCUMENT',reasons:[],status:'NET_REFERENCE',sourceAsOf:date,accountingCost:false,financialWrites:0,referenceNumerator:'25',referenceDenominator:'2',precisionStatus:'EXACT',alternatives:[{sourceKind:'CARD',amountExact:'25.00000000',currency:'USD',unitLabel:'ADET',date:null,reason:'LOWER_PRIORITY',sourceId:'PRIVATE-ALTERNATIVE-ID'}],rawSource:{private:'NEVER-PUBLIC'},headerSourceId:'PRIVATE-HEADER'});
function fixture({changeCard=x=>x,changeSelected=x=>x,changeHeader=x=>x,changeModules=x=>x,changeSets=x=>x,changeIdentity=x=>x,changeRuntime=x=>x}={}){
 const calls=[];let committed=0,rolledBack=0;const c=changeCard(card()),s=changeSelected(selected(c));
 class Transaction{async begin(){calls.push('begin');}async commit(){committed++;}async rollback(){rolledBack++;}}
 class Request{input(name,type,value){calls.push({name,value});return this;}async query(sql){calls.push(sql);return {recordset:sql.includes('SUSER_SNAME')?[changeIdentity({databaseName:'MELISA_ERP_SIRKET_TEST_20260929_01',serverName:'Semih\\MELISADEV',login:'melisa_sirket_sales_test_20260929_01',databaseUser:'melisa_sirket_sales_test_20260929_01',sysadmin:0,control:0,live:0})]:changeModules(Object.entries({...parentProof.moduleHashes,...proof.moduleHashes}).map(([object_name,definition_hash])=>({object_name,definition_hash})))};}async execute(proc){calls.push(proc);const row=v=>({rowJson:JSON.stringify(v),rowHash:lastPurchaseSqlHash(JSON.stringify(v))});return {recordsets:changeSets([[changeHeader({databaseName:'MELISA_ERP_SIRKET_TEST_20260929_01',serverName:'Semih\\MELISADEV',readerDefinitionHash:proof.readerDefinitionHash,manifestHash:h,parentManifestHash:parent,parentRowsHash:h,sourceHash:parent,sourceAsOf:date,runStatus:'COMMITTED',runId:'ERP-LAST-PURCHASE-FIXTURE',metadataRows:16668,requestedProductId:id,stockCode:code})],[row(c)],[row(s)]])};}}
 const service=createProductLastPurchaseReferenceService({getRuntime:async()=>changeRuntime({canonicalTest:true,manifestHash:h,parentManifestHash:parent,proof,parentProof,sql:{Transaction,Request,BigInt:'BigInt',ISOLATION_LEVEL:{SERIALIZABLE:4}}})});
 return {service,calls,state:()=>({committed,rolledBack})};
}
test('document currency and net are separate from immutable card and no private proof leaks',async()=>{
 const f=fixture(),r=await f.service.read(id,{},actor);assert.equal(r.data.referenceExact,'12.50000000');assert.equal(r.data.referenceCurrency,'TRY');assert.equal(r.data.cardCurrency,'USD');assert.equal(r.data.cardAmountExact,'25.00000000');assert.equal(r.data.discountExact,'10.00000000');assert.equal(r.data.protectedExistingCost,true);assert.deepEqual(r.meta,{readOnly:true,financialEffect:false});assert.ok(!JSON.stringify(r).includes('PRIVATE'));assert.ok(!JSON.stringify(r).includes('NEVER-PUBLIC'));for(const k of ['productHash','bindingHash','parentRecordHash','rawSource','headerSourceId'])assert.equal(k in r.data,false);assert.deepEqual(f.state(),{committed:1,rolledBack:0});
});
test('all three permissions required before runtime lookup; exact ID/query gate retained',async()=>{
 let calls=0;const service=createProductLastPurchaseReferenceService({getRuntime:async()=>{calls++;throw Error();}});
 for(const p of [[],['product.view'],['purchase.view'],['finance.view'],['product.view','purchase.view'],['product.view','finance.view'],['purchase.view','finance.view']])await assert.rejects(service.read(id,{}, {permissions:p}),e=>e.statusCode===403);
 await assert.rejects(service.read(id,{},null),e=>e.statusCode===401);for(const value of ['0','01','1 OR 1=1','9223372036854775808'])await assert.rejects(service.read(value,{},actor),e=>e.statusCode===400);await assert.rejects(service.read(id,{version:'1'},actor),e=>e.statusCode===400);assert.equal(calls,0);
});
test('both SQL generations are independently pinned before reader executes',async()=>{
 for(const target of Object.keys({...parentProof.moduleHashes,...proof.moduleHashes})){const f=fixture({changeModules:rows=>rows.map(r=>r.object_name===target?{...r,definition_hash:'0'.repeat(64)}:r)});await assert.rejects(f.service.read(id,{},actor),e=>e.statusCode===503);assert.ok(!f.calls.includes('dbo.usp_get_product_last_purchase'));assert.equal(f.state().rolledBack,1);}
});
test('TEST identity, pins and parent witnesses fail closed without old reader fallback',async()=>{
 for(const patch of [{databaseName:'LIVE'},{serverName:'other'},{login:'sa'},{databaseUser:'dbo'},{sysadmin:1},{control:1},{live:1}]){const f=fixture({changeIdentity:v=>({...v,...patch})});await assert.rejects(f.service.read(id,{},actor));assert.ok(!f.calls.includes('dbo.usp_get_product_last_purchase'));}
 for(const patch of [{manifestHash:'0'.repeat(64)},{parentManifestHash:'0'.repeat(64)},{parentRowsHash:null},{readerDefinitionHash:'0'.repeat(64)},{requestedProductId:'1'},{runStatus:'PREPARED'}]){const f=fixture({changeHeader:v=>({...v,...patch})});await assert.rejects(f.service.read(id,{},actor));assert.equal(f.state().committed,0);assert.ok(!f.calls.includes('dbo.usp_get_product_purchase_reference'));}
 const missing=fixture({changeRuntime:r=>({...r,manifestHash:null})});await assert.rejects(missing.service.read(id,{},actor));assert.equal(missing.calls.length,0);
});
test('tampered hashes, parent linkage and card arithmetic cannot become accepted metadata',async()=>{
 for(const changeSelected of [v=>({...v,parentRecordHash:'0'.repeat(64)}),v=>({...v,productHash:'0'.repeat(64)}),v=>({...v,bindingHash:'0'.repeat(64)})]){const f=fixture({changeSelected});await assert.rejects(f.service.read(id,{},actor));}
 for(const changeCard of [v=>({...v,schemaVersion:'wrong'}),v=>({...v,discountExact:'101.00000000'}),v=>({...v,priceBasis:'NET',referenceExact:'24.00000000',status:'REFERENCE_AVAILABLE',method:'SOURCE_ALREADY_NET_NO_SECOND_DISCOUNT'}),v=>({...v,priceBasis:'GROSS',referenceExact:'22.510000000000000000',status:'REFERENCE_AVAILABLE',method:'GROSS_CARD_LESS_RECORDED_DISCOUNT_ONCE'})]){const f=fixture({changeCard});await assert.rejects(f.service.read(id,{},actor));}
 const f=fixture({changeSets:sets=>{sets[2][0].rowHash='0'.repeat(64);return sets;}});await assert.rejects(f.service.read(id,{},actor));
});
test('missing V2 row stays unavailable; deleted native identity is 404',async()=>{
 const f=fixture({changeSets:sets=>[sets[0],sets[1],[]]});await assert.rejects(f.service.read(id,{},actor),e=>e.statusCode===503);
 const g=fixture({changeHeader:h=>({...h,requestedProductId:null,stockCode:null}),changeSets:s=>[s[0],[],[]]});await assert.rejects(g.service.read(id,{},actor),e=>e.statusCode===404);
});
test('rational exact division and explicit 18-place truncation preserve source precision',async()=>{
 const recurring=fixture({changeSelected:s=>({...s,referenceExact:'0.333333333333333333',referenceNumerator:'1',referenceDenominator:'3',precisionStatus:'TRUNCATED_18'})});assert.equal((await recurring.service.read(id,{},actor)).data.referenceNumerator,'1');
 for(const patch of [{referenceNumerator:'24'},{referenceDenominator:'0'},{referenceExact:'12.50000001'},{precisionStatus:'TRUNCATED_18'},{referenceNumerator:null,referenceDenominator:null,precisionStatus:null}]){const f=fixture({changeSelected:s=>({...s,...patch})});await assert.rejects(f.service.read(id,{},actor));}
 const claimedExact=fixture({changeSelected:s=>({...s,referenceExact:'0.333333333333333333',referenceNumerator:'1',referenceDenominator:'3',precisionStatus:'EXACT'})});await assert.rejects(claimedExact.service.read(id,{},actor));
});
test('invalid source, currency, unit, date and manual override fail before response',async()=>{
 for(const patch of [{sourceKind:'SALES'},{referenceCurrency:'GBP'},{referenceCurrency:null},{referenceUnitLabel:null},{referenceDate:null},{referenceDate:'2026-02-30'},{referenceDate:'2026-10-01T25:00:00'},{referenceExact:'0.00000000'},{status:'CARD_ONLY'},{alternatives:Array(4).fill({})}]){const f=fixture({changeSelected:s=>({...s,...patch})});await assert.rejects(f.service.read(id,{},actor));}
 const manual=fixture({changeCard:c=>({...c,protectedManual:true,cardAmountExact:null,referenceExact:null,status:'PROTECTED_MANUAL_PURCHASE',method:'PRESERVE_MANUAL_PURCHASE'})});await assert.rejects(manual.service.read(id,{},actor));
});
test('known card amount survives missing currency when selected net is unknown',async()=>{
 const f=fixture({changeCard:c=>({...c,currency:null,status:'PARTIAL_CARD_AMOUNT'}),changeSelected:s=>({...s,referenceExact:null,referenceCurrency:null,referenceUnitLabel:null,referenceDate:null,sourceKind:'CARD',status:'PARTIAL_CARD',selectionReason:'CARD_FALLBACK_NO_VERIFIED_NET_SOURCE',referenceNumerator:null,referenceDenominator:null,precisionStatus:null})});const r=await f.service.read(id,{},actor);assert.equal(r.data.cardAmountExact,'25.00000000');assert.equal(r.data.cardCurrency,null);assert.equal(r.data.referenceExact,null);
});
