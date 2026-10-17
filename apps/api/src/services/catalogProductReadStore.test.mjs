import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogProductReadStore,catalogClassificationRequestBudget} from './catalogProductReadStore.mjs';
import {CATALOG_SQL_PROOF} from './catalogSqlProof.mjs';
import {parseCatalogQuery} from './catalogModel.mjs';
function fixture(){const state={commit:0,rollback:0,inputs:{},identity:{db:'MELISA_ERP_SIRKET_TEST_20260929_01',server:'Semih\\MELISADEV'},row:{...CATALOG_SQL_PROOF,actorId:'14',canView:true,canViewSalesPrices:false,total:0,page:1,limit:50,readAt:'2026-10-05T08:00:00.000Z',rowsJson:'[]',filtersJson:'{"brands":[],"productTypes":[]}',acceptedCount:16622,syntheticCount:0,quarantinedCount:54}};
 class Transaction{async begin(level){state.level=level;}async commit(){state.commit++;}async rollback(){state.rollback++;}}
 class Request{constructor(parent,overrides){this.overrides=overrides;(state.requests??=[]).push(this);}input(k,type,v){state.inputs[k]=v;return this;}async query(text){return text.includes('@exclusion_run')?{recordsets:state.exclusionWitness}:{recordset:[state.identity]};}async execute(proc){state.proc=proc;state.executeOverrides=this.overrides;return {recordset:[state.row]};}}
 const classificationStore={selection:()=>({candidatesJson:state.candidates??'[["12",1]]',filters:state.filters??{brands:[],productTypes:[]}}),assertRow:()=>{if(state.assertMismatch)throw Error('mismatch');}};
 const sql={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:4},BigInt:'bigint',Int:'int',Bit:'bit',NVarChar:n=>n};return {state,store:createCatalogProductReadStore({getRuntime:async()=>({pool:{},sql}),classificationStore,getCopyContext:()=>state.copy??null})};}
const input=()=>({actorId:'14',options:parseCatalogQuery({barcode:'000012'})});
const version=()=>({runId:'GOAL7-00000000-0000-4000-8000-000000000001',sourceHash:'a'.repeat(64),planHash:'b'.repeat(64),bindingsHash:'c'.repeat(64),readerDefinitionHash:'D'.repeat(64),sourceAsOf:'2026-10-07',productCount:16671,priceCount:64015});
function enableVersion(f){const v=version();f.store.configureSourceVersion(v);Object.assign(f.state.row,{readerDefinitionHash:v.readerDefinitionHash,acceptedCount:16671,sourceVersionRunId:v.runId,sourceVersionSourceHash:v.sourceHash,sourceVersionPlanHash:v.planHash,sourceVersionBindingsHash:v.bindingsHash});return v;}
test('opt-in sourceversion requires configured exact run/proof and never falls back after a bad version',async()=>{const f=fixture(),v=enableVersion(f),result=await f.store.readCatalogProducts(input());assert.equal(f.state.proc,'dbo.usp_read_work_catalog_goal7');assert.deepEqual(result.sourceVersion,v);for(const k of ['sourceVersionRunId','sourceVersionSourceHash','sourceVersionPlanHash','sourceVersionBindingsHash','readerDefinitionHash','acceptedCount']){const bad=fixture();enableVersion(bad);bad.state.row[k]='wrong';await assert.rejects(()=>bad.store.readCatalogProducts(input()),{statusCode:503});assert.equal(bad.state.commit,0);}assert.throws(()=>f.store.configureSourceVersion({...v,sourceHash:'bad'}));await assert.rejects(()=>f.store.readCatalogProducts(input()),{statusCode:503});assert.throws(()=>f.store.sourceVersion());});
test('single batched catalog read binds literal barcode and actor under serializable transaction',async()=>{const f=fixture();await f.store.readCatalogProducts(input());assert.equal(f.state.inputs.barcode,'000012');assert.equal(f.state.inputs.actor_id,'14');assert.equal(f.state.level,4);assert.equal(f.state.proc,'dbo.usp_read_work_catalog');assert.equal(f.state.commit,1);});
test('actual target, role, actor, every independent SQL proof and malformed/count drift rollback',async()=>{
 const changes=[f=>{f.state.identity.db='LIVE';},f=>{f.state.row.canView=false;},f=>{f.state.row.actorId='16';},f=>{f.state.row.rowsJson='{}';},f=>{f.state.row.syntheticCount=3;},...Object.keys(CATALOG_SQL_PROOF).map(k=>f=>{f.state.row[k]='BAD';})];
 for(const change of changes){const f=fixture();change(f);await assert.rejects(()=>f.store.readCatalogProducts(input()),{code:'CATALOG_UNAVAILABLE',statusCode:503});assert.equal(f.state.commit,0);assert.equal(f.state.rollback,1);}
});
test('literal classification, server-owned image bindings and global sort are bound into guarded SQL before commit',async()=>{
 const f=fixture();await f.store.readCatalogProducts({...input(),options:parseCatalogQuery({brand:'MY MİO ',productType:'YELEK',image:'available',sort:'stock-desc'}),mediaBindingsJson:'[]'});assert.equal(f.state.inputs.brand,'MY MİO ');assert.equal(f.state.inputs.product_type,'YELEK');assert.equal(f.state.inputs.image,'available');assert.equal(f.state.inputs.sort,'stock-desc');assert.equal(f.state.inputs.media_bindings,'[]');
 assert.equal(f.state.inputs.candidate_bindings,'[["12",1]]');f.state.filters={brands:[' '],productTypes:[]};await assert.rejects(()=>f.store.readCatalogProducts(input()),{statusCode:503});
});
test('one-time startup index validation has the same independent identity, actor, all SQL pins and serializable transaction',async()=>{
 const f=fixture();f.state.row.classificationValidated=true;assert.deepEqual(await f.store.validateCatalogClassification({actorId:'14',entriesJson:'[]'}),{validated:true});assert.equal(f.state.inputs.classification_validation,true);assert.equal(f.state.inputs.classification_bindings,'[]');assert.equal(f.state.level,4);assert.equal(f.state.commit,1);
 for(const change of [v=>v.state.identity.db='LIVE',v=>v.state.row.classificationValidated=false,v=>v.state.row.actorId='16',...Object.keys(CATALOG_SQL_PROOF).map(key=>v=>v.state.row[key]='bad')]){const bad=fixture();bad.state.row.classificationValidated=true;change(bad);await assert.rejects(()=>bad.store.validateCatalogClassification({actorId:'14',entriesJson:'[]'}),{statusCode:503});assert.equal(bad.state.commit,0);assert.equal(bad.state.rollback,1);}
});
test('only full startup classification execution has a 60-second budget; normal reads and identity keep pool defaults',async()=>{
 const startup=fixture();startup.state.row.classificationValidated=true;
 await startup.store.validateCatalogClassification({actorId:'14',entriesJson:'[]'});
 assert.deepEqual(startup.state.executeOverrides,{requestTimeout:60000});
 assert.equal(startup.state.requests[0].overrides,undefined);assert.equal(startup.state.requests.length,2);
 const normal=fixture();await normal.store.readCatalogProducts(input());
 assert.equal(normal.state.executeOverrides,undefined);assert.ok(normal.state.requests.every(request=>request.overrides===undefined));
 const bad=fixture();bad.state.row.classificationValidated=false;
 await assert.rejects(()=>bad.store.validateCatalogClassification({actorId:'14',entriesJson:'[]'}),{statusCode:503});
 assert.deepEqual(bad.state.executeOverrides,{requestTimeout:60000});assert.equal(bad.state.commit,0);assert.equal(bad.state.rollback,1);
});

test('expanded DB02 startup alone has a 180-second classification budget and no unregistered copy can broaden ordinary readers',()=>{
 assert.equal(catalogClassificationRequestBudget({scopeKind:'VERIFIED_BUSINESS_TEST',target:{database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'}}),180000);
 for(const copy of [null,{}, {scopeKind:'VERIFIED_BUSINESS_TEST',target:{database:'LIVE'}},{scopeKind:'VERIFIED_BUSINESS_TEST',target:{database:'MELISA_ERP_CRM_SHARED_TEST_20261009_01'}},{target:{database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'}}])assert.equal(catalogClassificationRequestBudget(copy),60000);
});
test('DB02 re-proves four exclusions in same transaction, filters before guarded SQL pagination, and details return reason-specific409',async()=>{
 const scoped=()=>{const f=fixture(),v=enableVersion(f);f.state.copy={scopeKind:'VERIFIED_BUSINESS_TEST',target:{database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'},currentProductSourceVersionRunId:v.runId};f.state.candidates='[["36961",1],["39169",2],["40331",3],["301991",4],["12",5]]';f.state.exclusionWitness=[[{...v,sealed:true}],['36961','39169','40331','301991'].flatMap((productId,i)=>[0,1,2].map(j=>({productId,quoteId:i===3&&j===0?'278235':String(10+i*3+j),priceExact:i===3&&j===0?'1.00000000':'0.00000000',nativeTupleCount:i===3&&j===0?2:1,sourceWitnessVerified:true}))),[{sourceActiveCatalog:12000}]];return f;};
 const f=scoped(),result=await f.store.readCatalogProducts(input());assert.equal(f.state.inputs.candidate_bindings,'[["12",5]]');assert.equal(f.state.inputs.exclusion_run,version().runId);assert.equal(result.priceExclusions.excludedCount,4);assert.equal(result.priceExclusions.sourceActiveCatalog,12000);assert.equal(result.priceExclusions.availableActiveCatalog,11996);assert.equal(f.state.commit,1);
 for(const productId of ['36961','39169','40331','301991']){const bad=scoped();await assert.rejects(()=>bad.store.readCatalogProducts({...input(),productId}),error=>error.statusCode===409&&error.code===(productId==='301991'?'DUPLICATE_SOURCE_SALE_PRICE':'ZERO_SOURCE_SALE_PRICE')&&error.details.productId===productId&&error.details.draftEligible===false);assert.equal(bad.state.proc,undefined);assert.equal(bad.state.commit,0);assert.equal(bad.state.rollback,1);}
 const changed=scoped();changed.state.exclusionWitness[1][0].sourceWitnessVerified=false;await assert.rejects(()=>changed.store.readCatalogProducts(input()),{code:'CATALOG_UNAVAILABLE'});assert.equal(changed.state.proc,undefined);assert.equal(changed.state.rollback,1);
 const sqlDrift=scoped();sqlDrift.state.row.readerDefinitionHash='changed';await assert.rejects(()=>sqlDrift.store.readCatalogProducts(input()),{code:'CATALOG_UNAVAILABLE'});assert.equal(sqlDrift.state.rollback,1);
 const old=scoped();old.state.copy.target.database='MELISA_ERP_CRM_SHARED_TEST_20261009_01';await old.store.readCatalogProducts(input());assert.equal(old.state.inputs.candidate_bindings,old.state.candidates);assert.equal(old.state.inputs.exclusion_run,undefined);
});
