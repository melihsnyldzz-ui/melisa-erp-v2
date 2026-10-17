import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fixtureContext} from './isolatedOperationCopyContext.test.mjs';
import {validateIsolatedOperationCopyContext,isolatedCopyHash,BUSINESS_COPY_DATABASE} from './isolatedOperationCopyContext.mjs';
import {createProductCopyPurchaseReferenceService,configureProductCopyPurchaseReferenceRead,validateProductCopyPurchaseReferencePin,registeredProductCopyPurchaseReferenceRead} from './productCopyPurchaseReferenceService.mjs';
import {lastPurchaseSqlHash} from './productLastPurchaseReferenceService.mjs';
import {PURCHASE_REFERENCE_SQL_PROOF} from '../../../../scripts/migration/product-purchase-reference-sql.mjs';
import {LAST_PURCHASE_SQL_PROOF} from '../../../../scripts/migration/product-last-purchase-sql.mjs';

const sourceDate='2026-10-08T06:43:39.841Z',selectedDate='2026-10-08T10:39:21.010Z',id='36655',code='051 PAKEL';
const hash=char=>char.repeat(64),sha=value=>createHash('sha256').update(value).digest('hex');
const keys=['product.view','purchase.view','finance.view'];
function copy(){
 const raw=fixtureContext();raw.date='2026-10-09';raw.target.database=BUSINESS_COPY_DATABASE;raw.target.login=raw.target.databaseUser='melisa_shared_test_rw_20261009_02';raw.suppliers[0].currency='TRY';raw.products=[{...raw.products[0],id:'29980'},{...raw.products[0],id:'30003'}];raw.scopeKind='VERIFIED_BUSINESS_TEST';raw.businessScopeHash=hash('d');raw.businessInvoiceMaxExact4='20000.0000';raw.currencyRates=[{currency:'TRY',rateExact8:'1.00000000',source:'IDENTITY_TRY',date:raw.date,id:null},{currency:'USD',rateExact8:'47.80000000',source:'dated-fixture',date:'2026-09-12',id:'2'}];raw.externalOperations=false;raw.humanAccepted=false;
 for(const kind of ['customers','suppliers'])raw[kind].forEach(p=>Object.assign(p,{sourceKnown:true,sourceWitnessHash:hash('e')}));
 const {sealHash,...body}=raw;return validateIsolatedOperationCopyContext({...body,sealHash:isolatedCopyHash(body)});
}
function pin(c){
 const body={schemaVersion:'melisa-copy-purchase-reference-read.v1',copyId:c.copyId,copySealHash:c.sealHash,server:c.target.server,database:c.target.database,parent:{runId:'PARENT',manifestHash:hash('a'),rowCount:16668,rowsHash:hash('b'),sourceHash:hash('c'),sourceAsOf:sourceDate},selected:{runId:'SELECTED',manifestHash:hash('d'),rowCount:16667,rowsHash:hash('e'),sourceHash:hash('f'),sourceAsOf:selectedDate,parentRunId:'PARENT',parentManifestHash:hash('a'),parentRowsHash:hash('b')}};
 return {...body,descriptorHash:sha(JSON.stringify(body))};
}
function parentRaw(){return {schemaVersion:'melisa-product-purchase-reference.v1',productId:id,stockCode:code,productHash:hash('1'),bindingHash:hash('2'),cardAmountExact:'8.00000000',referenceExact:null,discountExact:'10.00000000',currency:'USD',unitLabel:'ADET',status:'CARD_AMOUNT_ONLY',method:'SOURCE_CARD_AMOUNT',priceBasis:'UNKNOWN',sourceAsOf:sourceDate,reasons:['DISCOUNT_BASIS_UNVERIFIED'],protectedExistingCost:true,protectedManual:false,accountingCost:false,financialWrites:0,rawSource:{secret:'not public'}};}
function selectedRaw(parentHash){return {schemaVersion:'melisa-product-last-purchase.v2',productId:id,stockCode:code,parentRecordHash:parentHash,productHash:hash('1'),bindingHash:hash('2'),referenceExact:'388.000000000000000000',referenceCurrency:'TRY',referenceUnitLabel:'ADET',referenceDate:'2026-10-07T00:00:00',sourceKind:'PURCHASE_DOCUMENT',selectionReason:'LATEST_VERIFIED_PURCHASE_DOCUMENT',reasons:[],status:'NET_REFERENCE',sourceAsOf:selectedDate,accountingCost:false,financialWrites:0,referenceNumerator:'388',referenceDenominator:'1',precisionStatus:'EXACT',alternatives:[{sourceKind:'CARD',amountExact:'8.00000000',currency:'USD',unitLabel:'ADET',date:null,reason:'PRESERVED_CARD_VALUE'}],rawSource:{secret:'not public'}};}
function fixture({module=x=>x,proof=x=>x,run=x=>x,product=x=>x,identity=x=>x,current=x=>x}={}){
 const c=copy(),p=pin(c),queries=[];let committed=0,rolledBack=0;
 const actor={id:'16',role:{code:c.actors.find(x=>x.id==='16').role},permissions:keys};
 const expected={...PURCHASE_REFERENCE_SQL_PROOF.moduleHashes,...LAST_PURCHASE_SQL_PROOF.moduleHashes};
 const modules=Object.entries(expected).map(([object_name,definition_hash])=>({object_name,definition_hash,trigger_disabled:0}));
 const manifest=(entry,selected=false)=>({run_id:entry.runId,manifest_hash:entry.manifestHash,row_count:entry.rowCount,rows_hash:entry.rowsHash,source_hash:entry.sourceHash,source_as_of:entry.sourceAsOf,status:'COMMITTED',sealed:true,manifest_json:'{}',manifest_sql_hash:lastPurchaseSqlHash('{}'),...(selected?{parent_run_id:entry.parentRunId,parent_manifest_hash:entry.parentManifestHash,parent_rows_hash:entry.parentRowsHash}:{})});
 const a=parentRaw(),aJson=JSON.stringify(a),b=selectedRaw(lastPurchaseSqlHash(aJson)),bJson=JSON.stringify(b);
 class Transaction{async begin(){}async commit(){committed++;}async rollback(){rolledBack++;}}
 class Request{input(){return this;}async query(sqlText){queries.push(sqlText);if(sqlText.includes('SUSER_SNAME()'))return {recordset:[identity({db:c.target.database,server:c.target.server,login:c.target.login,databaseUser:c.target.databaseUser,sysadmin:0,control:0,live:0,originalDatabaseAccess:0})]};if(sqlText.includes('FROM sys.objects o'))return {recordset:module(modules)};if(sqlText.startsWith('SELECT object_name,definition_hash'))return {recordset:proof(modules.map(({object_name,definition_hash})=>({object_name,definition_hash})))};if(sqlText.startsWith('SELECT run_id,manifest_hash'))return {recordsets:run([[manifest(p.parent)],[manifest(p.selected,true)]])};if(sqlText.includes('FROM dbo.users u JOIN dbo.roles r')){const fresh=current({id:'16',role:actor.role.code,active:true,permissions:keys});return {recordsets:[fresh.active===false?[]:[{id:fresh.id,role_code:fresh.role,user_active:1,role_active:1}],fresh.permissions.map(permission_key=>({permission_key,can_view:true,can_create:false,can_update:false,can_approve:false}))]};}if(sqlText.includes('SELECT CONVERT(varchar(20),p.id) requestedProductId'))return {recordsets:product([[{requestedProductId:id,stockCode:code}],[{rowJson:aJson,rowHash:lastPurchaseSqlHash(aJson)}],[{rowJson:bJson,rowHash:lastPurchaseSqlHash(bJson)}]])};return {recordsets:[]};}}
 const sql={Transaction,Request,BigInt:'BigInt',ISOLATION_LEVEL:{SERIALIZABLE:4}};
 const service=createProductCopyPurchaseReferenceService({getRuntime:async()=>({copy:c,pin:p,sql,pool:{}})});
 return {c,p,sql,actor,service,queries,state:()=>({committed,rolledBack})};
}

test('DB02 descriptor accepts only the exact copy, parent and selected seal',()=>{
 const f=fixture();assert.equal(validateProductCopyPurchaseReferencePin(f.c,f.p).descriptorHash,f.p.descriptorHash);
 for(const change of [x=>x.copyId='different',x=>x.database='MELISA_ERP_PROD_CANDIDATE_20260917_01',x=>x.parent.rowsHash=hash('0'),x=>x.selected.parentRowsHash=hash('0'),x=>x.parent.rowCount=16667,x=>x.selected.rowCount=16668,x=>x.extra=true]){const bad=structuredClone(f.p);change(bad);assert.throws(()=>validateProductCopyPurchaseReferencePin(f.c,bad));}
});
test('startup proves all metadata through SELECT in a serializable transaction before registration',async()=>{
 const f=fixture();await configureProductCopyPurchaseReferenceRead({copy:f.c,pin:f.p,pool:{},sql:f.sql});assert.equal(registeredProductCopyPurchaseReferenceRead()?.pin.descriptorHash,f.p.descriptorHash);assert.deepEqual(f.state(),{committed:1,rolledBack:0});
 const body=f.queries.join('\n');for(const needed of ['product_purchase_reference_proof','product_last_purchase_proof','STRING_AGG','parent_record_hash','manifest_sql_hash','record_json','sourceAsOf'])assert.ok(body.includes(needed),needed);
 assert.doesNotMatch(body,/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?(?:dbo|erp_migration)\./i);
 assert.doesNotMatch(body,/\bEXEC\s+dbo\.usp_assert_product_(?:last_purchase|purchase_reference)/i);
});
test('one guarded GET preserves card currency, document currency, source precision and private fields',async()=>{
 const f=fixture(),result=await f.service.read(id,{},f.actor);assert.equal(result.data.cardCurrency,'USD');assert.equal(result.data.referenceCurrency,'TRY');assert.equal(result.data.referenceExact,'388.000000000000000000');assert.deepEqual(result.meta,{readOnly:true,financialEffect:false});assert.ok(!JSON.stringify(result).includes('not public'));assert.deepEqual(f.state(),{committed:1,rolledBack:0});
 const sql=f.queries.join('\n');for(const guard of ['FROM dbo.users u JOIN dbo.roles r','PURCHASE_REFERENCE_NATIVE_DRIFT','PURCHASE_REFERENCE_HELD','PURCHASE_REFERENCE_BINDING_DRIFT','LAST_PURCHASE_MANUAL_DRIFT','SELECT p.* FOR JSON PATH','product_last_purchase_rows'])assert.ok(sql.includes(guard),guard);assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?(?:dbo|erp_migration)\./i);
});
test('missing selected metadata, changed pin/module/actor, wrong identity and corrupt row remain unavailable',async()=>{
 const cases=[{product:s=>[s[0],s[1],[]]},{product:s=>[s[0],s[1],[{...s[2][0],rowHash:hash('0')}]]},{module:rows=>rows.map((r,i)=>i? r:{...r,definition_hash:hash('0')})},{run:sets=>[[{...sets[0][0],rows_hash:hash('0')}],sets[1]]},{identity:r=>({...r,live:1})},{current:u=>({...u,permissions:[]})}];
 for(const options of cases){const f=fixture(options);await assert.rejects(f.service.read(id,{},f.actor));assert.deepEqual(f.state(),{committed:0,rolledBack:1});}
});
test('bad request and missing effective permission stop before runtime, a missing native card remains 404',async()=>{
 let calls=0;const service=createProductCopyPurchaseReferenceService({getRuntime:async()=>{calls++;throw Error();}});
 for(const bad of ['0','01','9223372036854775808'])await assert.rejects(service.read(bad,{}, {permissions:keys}),{statusCode:400});
 await assert.rejects(service.read(id,{force:'1'},{permissions:keys}),{statusCode:400});await assert.rejects(service.read(id,{},null),{statusCode:401});await assert.rejects(service.read(id,{}, {permissions:['product.view']}),{statusCode:403});assert.equal(calls,0);
 const f=fixture({product:s=>[[],s[1],s[2]]});await assert.rejects(f.service.read(id,{},f.actor),{statusCode:404});
});
