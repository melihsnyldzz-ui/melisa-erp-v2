import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createCatalogClassificationStore} from './catalogClassificationStore.mjs';
import {parseCatalogQuery} from './catalogModel.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'melisa-class-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const index={schemaVersion:'melisa-erp.catalog-classification.v1',server:'Semih\\MELISADEV',database:'MELISA_ERP_SIRKET_TEST_20260929_01',runId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30',sourceHash:'36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400',entries:[
  {productId:'12',stockCode:'0010 MY MİO ',sourceKey:'VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/12',kind:'accepted-opening',brand:'MY MİO ',productType:'TAKIM',sourceName:'TAKIM',stagePayloadHash:'a'.repeat(64),stageSqlHash:'b'.repeat(64)},
  {productId:'13',stockCode:'0002 MOLLY',sourceKey:'VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/13',kind:'accepted-opening',brand:null,productType:null,sourceName:'Ürün',stagePayloadHash:'c'.repeat(64),stageSqlHash:'d'.repeat(64)},
  {productId:'14',stockCode:'0007 HELD',sourceKey:'VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/14',kind:'quarantined-source',brand:null,productType:null,sourceName:null,stagePayloadHash:null,stageSqlHash:null}
 ]};
 const state={validations:0,user:{id:16,permissions:['product.view','sales.view']},fail:false};const store=createCatalogClassificationStore({expectedRoot:root,acceptedCount:2,heldCount:1,getUser:async()=>state.user,validateIndex:async(j,actor)=>{assert.equal(actor,'16');assert.equal(JSON.parse(j).length,3);state.validations++;if(state.fail)throw Error('badstage');}});
 const context={root,indexSha256:'',mode:'erp',port:4144,writes:true,env:{sql:{database:index.database}},identity:{serverName:index.server,databaseName:index.database,loginName:'melisa_sirket_sales_test_20260929_01',databaseUser:'melisa_sirket_sales_test_20260929_01',sysadmin:0,databaseControl:0,liveDatabaseAccess:0}};
 const publish=async()=>{const raw=JSON.stringify(index);await fs.writeFile(path.join(root,'index.json'),raw);context.indexSha256=digest(raw);};await publish();return {root,index,state,store,context,publish};
}
test('immutable classification validates once, preserves literal facets and naturally merges held cards before pagination',async t=>{
 const f=await fixture(t);await f.store.configure(f.context);const selection=f.store.selection({options:parseCatalogQuery()});assert.deepEqual(JSON.parse(selection.candidatesJson),[['13',1],['14',2],['12',3]]);assert.deepEqual(selection.filters,{brands:['MY MİO '],productTypes:['TAKIM']});
 assert.deepEqual(JSON.parse(f.store.selection({options:parseCatalogQuery({brand:'MY MİO '})}).candidatesJson),[['12',3]]);assert.deepEqual(JSON.parse(f.store.selection({options:parseCatalogQuery({brand:'MY MİO'})}).candidatesJson),[]);assert.deepEqual(JSON.parse(f.store.selection({productId:'14',options:parseCatalogQuery()}).candidatesJson),[['14',2]]);assert.equal(f.state.validations,1);
 selection.filters.brands.push('wrong');assert.deepEqual(f.store.selection({options:parseCatalogQuery()}).filters.brands,['MY MİO ']);assert.equal(selection.candidatesJson.includes('stockQuantity'),false);
 const pairs=JSON.parse(selection.candidatesJson);assert.ok(pairs.every(p=>p.length===2&&typeof p[0]==='string'&&Number.isInteger(p[1])));
 assert.ok(Buffer.byteLength(selection.candidatesJson)<Buffer.byteLength(JSON.stringify(pairs.map(([productId,rank])=>({productId,rank}))))/2);
});
test('every fresh DTO must still match pinned source/classification; state is not reused from startup',async t=>{
 const f=await fixture(t);await f.store.configure(f.context);const row={id:'12',stockCode:'0010 MY MİO ',displayCode:'0010',provenance:{kind:'accepted-opening',sourceKey:f.index.entries[0].sourceKey,runId:f.index.runId,sourceAsOf:'2026-09-30',verified:true},hold:{blocked:false},classification:{brand:'MY MİO ',productType:'TAKIM',sourceName:'TAKIM',verified:true}};f.store.assertRow(row);
 for(const mutate of [r=>r.stockCode='changed',r=>r.provenance.sourceKey+='0',r=>r.classification.brand='MY MİO',r=>r.hold.blocked=true,r=>r.displayCode='10']){const changed=structuredClone(row);mutate(changed);assert.throws(()=>f.store.assertRow(changed),{statusCode:503});}
});
test('wrong pin, scope, revoked startup role, duplicate or mutable metadata and failed SQL proof cannot enable registry',async t=>{
 const f=await fixture(t);for(const override of [{indexSha256:'0'.repeat(64)},{port:4146},{writes:false},{root:os.tmpdir()}]){await assert.rejects(()=>f.store.configure({...f.context,...override}),{statusCode:503});assert.throws(()=>f.store.selection({options:parseCatalogQuery()}),{statusCode:503});}assert.equal(f.state.validations,0);
 f.state.user.permissions=[];await assert.rejects(()=>f.store.configure(f.context));f.state.user.permissions=['product.view','sales.view'];
 const baseline=structuredClone(f.index);for(const change of [i=>i.entries[0].stockQuantity='1',i=>i.entries[1].productId=i.entries[0].productId,i=>i.entries[2].brand='GUESS',i=>i.sourceHash='0'.repeat(64)]){f.index.entries=structuredClone(baseline.entries);f.index.sourceHash=baseline.sourceHash;change(f.index);await f.publish();await assert.rejects(()=>f.store.configure(f.context));}
 f.index.entries=structuredClone(baseline.entries);f.index.sourceHash=baseline.sourceHash;await f.publish();f.state.fail=true;await assert.rejects(()=>f.store.configure(f.context),{statusCode:503});assert.throws(()=>f.store.selection({options:parseCatalogQuery()}));
});
