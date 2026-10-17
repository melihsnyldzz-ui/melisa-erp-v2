import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestProductPriceStore,PRODUCT_PRICE_GET_PROC,PRODUCT_PRICE_SET_PROC} from './testProductPriceStore.mjs';
import {PRODUCT_PRICE_SQL_PROOF} from './testProductPriceSqlProof.mjs';
const context={product:{id:'301986',stockCode:'TEST-DAILY-PURCHASE',name:'Sentetik ürün',unit:'ADET',synthetic:true},capabilities:{currencies:['TRY'],units:[{id:'7',label:'ADET',factorExact8:'1.00000000',isMainUnit:true}],purchaseTier:0,saleTiers:[1],supportedTuples:[{type:'purchase',unitId:null,tier:0,currency:'TRY'}],canEdit:true},revision:'A'.repeat(64),prices:[],recentChanges:[]};
function fixture(){
 const state={commits:0,rollbacks:0,executed:[],identity:{db:'MELISA_ERP_SIRKET_TEST_20260929_01',server:'Semih\\MELISADEV'},result:{recordset:[{context_json:JSON.stringify(context),replayed:false,...PRODUCT_PRICE_SQL_PROOF}]}};
 class Transaction{async begin(level){assert.equal(level,'SERIALIZABLE');}async commit(){state.commits++;}async rollback(){state.rollbacks++;}}
 class Request{constructor(){this.inputs={};}input(name,type,value){this.inputs[name]=value;return this;}async query(){return {recordset:[state.identity]};}async execute(name){state.executed.push({name,inputs:this.inputs});if(state.error)throw state.error;return state.result;}}
 const sql={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:'SERIALIZABLE'},BigInt:'bigint',NVarChar:()=>'',MAX:-1};
 return {state,store:createTestProductPriceStore({getRuntime:async()=>({pool:{},sql})})};
}
test('store binds reader actor14 and writer payload to owner procedures inside serializable transaction',async()=>{
 const {state,store}=fixture();await store.readTestProductPrices('301986','14');assert.deepEqual(state.executed[0],{name:PRODUCT_PRICE_GET_PROC,inputs:{product_id:'301986',actor_id:'14'}});
 state.result.recordset[0].replayed=true;const result=await store.setTestProductPrice('301986','16','{"immutable":"payload"}');
 assert.equal(state.executed[1].name,PRODUCT_PRICE_SET_PROC);assert.equal(state.executed[1].inputs.payload_json,'{"immutable":"payload"}');assert.equal(result.replayed,true);assert.equal(state.commits,2);
});
test('wrong environment stops before owner execution; malformed DTO rolls back',async()=>{
 const {state,store}=fixture();state.identity.db='LIVE';await assert.rejects(()=>store.readTestProductPrices('301986','14'),{statusCode:503});assert.equal(state.executed.length,0);assert.equal(state.rollbacks,1);
 state.identity.db='MELISA_ERP_SIRKET_TEST_20260929_01';state.result.recordset[0].context_json='{}';await assert.rejects(()=>store.readTestProductPrices('301986','14'),{statusCode:503});assert.equal(state.commits,0);assert.equal(state.rollbacks,2);
});
test('owner stale and full-payload request conflicts map409 after rollback',async()=>{
 for(const [number,code] of [[51098,'TEST_PRODUCT_PRICE_STALE'],[51099,'TEST_PRODUCT_PRICE_REQUEST_CONFLICT']]){const {state,store}=fixture();state.error={originalError:{info:{number}}};await assert.rejects(()=>store.setTestProductPrice('301986','16','{}'),{code,statusCode:409});assert.equal(state.rollbacks,1);assert.equal(state.commits,0);}
});
test('restricted writer never permits another actor',async()=>{const {state,store}=fixture();await assert.rejects(()=>store.setTestProductPrice('301986','14','{}'),{statusCode:503});assert.equal(state.executed.length,0);});
test('valid DTO cannot mask getter, setter or any companion guard definition drift',async()=>{
 for(const key of Object.keys(PRODUCT_PRICE_SQL_PROOF)){
  const {state,store}=fixture();state.result.recordset[0][key]='0'.repeat(64);
  await assert.rejects(()=>store.readTestProductPrices('301986','16'),{statusCode:503});assert.equal(state.commits,0);assert.equal(state.rollbacks,1);
 }
});
