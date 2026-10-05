import test from 'node:test';
import assert from 'node:assert/strict';
import {createStockProductReadStore} from './stockProductReadStore.mjs';
import {STOCK_PRODUCT_SQL_PROOF} from './stockProductSqlProof.mjs';
import {parseStockProductQuery} from './stockProductModel.mjs';
function fixture(){const state={commit:0,rollback:0,execute:0,inputs:{},identity:{db:'MELISA_ERP_SIRKET_TEST_20260929_01',server:'Semih\\MELISADEV'},row:{...STOCK_PRODUCT_SQL_PROOF,actorId:'14',canView:true,canViewFinance:false,total:0,page:1,limit:25,readAt:'2026-10-05T08:00:00.000Z',rowsJson:'[]',acceptedCount:16622,syntheticCount:3,quarantinedCount:54}};
 class Transaction{async begin(level){state.level=level;}async commit(){state.commit++;}async rollback(){state.rollback++;}}
 class Request{input(k,type,v){state.inputs[k]=v;return this;}async query(){return {recordset:[state.identity]};}async execute(){state.execute++;return {recordset:[state.row]};}}
 const sql={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:4},BigInt:'bigint',Int:'int',NVarChar:n=>n};
 return {state,store:createStockProductReadStore({getRuntime:async()=>({pool:{},sql})})};}
const input=()=>({actorId:'14',options:parseStockProductQuery({barcode:'000012'})});
test('read transaction binds actor and literal barcode, validates every actual proof before commit',async()=>{const {state,store}=fixture();assert.deepEqual((await store.readStockProducts(input())).rows,[]);assert.equal(state.inputs.barcode,'000012');assert.equal(state.inputs.actor_id,'14');assert.equal(state.level,4);assert.equal(state.commit,1);});
test('identity, role, actor, each missing/drifted pin and malformed rows fail closed and rollback',async()=>{
 const changes=[f=>{f.state.identity.db='LIVE';},f=>{f.state.row.canView=false;},f=>{f.state.row.actorId='16';},f=>{f.state.row.rowsJson='{}';},f=>{f.state.row.quarantinedCount=0;},f=>{f.state.row.readAt='2026-02-30T08:00:00.000Z';},...Object.keys(STOCK_PRODUCT_SQL_PROOF).map(k=>f=>{f.state.row[k]='X';})];
 for(const change of changes){const f=fixture();change(f);await assert.rejects(()=>f.store.readStockProducts(input()),{code:'STOCK_PRODUCT_UNAVAILABLE'});assert.equal(f.state.commit,0);assert.equal(f.state.rollback,1);}
});
test('store decodes finance-authorized lists without financial but requires financial only for detail',async()=>{
 const card={id:'301986',stockCode:'TEST-DAILY-PURCHASE',productName:'Deneme',isActive:true,stockQuantityExact:null,unit:{label:null,sourceId:null,factorExact8:null,verified:false},barcodes:[],imageUrl:null,provenance:{kind:'synthetic-test',sourceKey:null,runId:null,sourceAsOf:null,verified:true},hold:{blocked:false,reasons:[]}};
 const list=fixture();Object.assign(list.state.row,{canViewFinance:true,total:1,rowsJson:JSON.stringify([card])});assert.equal((await list.store.readStockProducts(input())).rows.length,1);assert.equal(list.state.commit,1);
 const detail=fixture();Object.assign(detail.state.row,{canViewFinance:true,total:1,limit:1,rowsJson:JSON.stringify([card])});await assert.rejects(()=>detail.store.readStockProducts({...input(),productId:'301986',options:{...input().options,limit:1}}),{code:'STOCK_PRODUCT_UNAVAILABLE'});assert.equal(detail.state.commit,0);
 card.financial={averageCostTryExact:null,prices:[]};const unexpected=fixture();Object.assign(unexpected.state.row,{canViewFinance:true,total:1,rowsJson:JSON.stringify([card])});await assert.rejects(()=>unexpected.store.readStockProducts(input()),{code:'STOCK_PRODUCT_UNAVAILABLE'});assert.equal(unexpected.state.commit,0);
});
