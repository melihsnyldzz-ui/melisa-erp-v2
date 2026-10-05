import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogProductReadStore} from './catalogProductReadStore.mjs';
import {CATALOG_SQL_PROOF} from './catalogSqlProof.mjs';
import {parseCatalogQuery} from './catalogModel.mjs';
function fixture(){const state={commit:0,rollback:0,inputs:{},identity:{db:'MELISA_ERP_SIRKET_TEST_20260929_01',server:'Semih\\MELISADEV'},row:{...CATALOG_SQL_PROOF,actorId:'14',canView:true,canViewSalesPrices:false,total:0,page:1,limit:50,readAt:'2026-10-05T08:00:00.000Z',rowsJson:'[]',filtersJson:'{"brands":[],"productTypes":[]}',acceptedCount:16622,syntheticCount:0,quarantinedCount:54}};
 class Transaction{async begin(level){state.level=level;}async commit(){state.commit++;}async rollback(){state.rollback++;}}
 class Request{input(k,type,v){state.inputs[k]=v;return this;}async query(){return {recordset:[state.identity]};}async execute(proc){state.proc=proc;return {recordset:[state.row]};}}
 const classificationStore={selection:()=>({candidatesJson:'[["12",1]]',filters:state.filters??{brands:[],productTypes:[]}}),assertRow:()=>{if(state.assertMismatch)throw Error('mismatch');}};
 const sql={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:4},BigInt:'bigint',Int:'int',Bit:'bit',NVarChar:n=>n};return {state,store:createCatalogProductReadStore({getRuntime:async()=>({pool:{},sql}),classificationStore})};}
const input=()=>({actorId:'14',options:parseCatalogQuery({barcode:'000012'})});
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
