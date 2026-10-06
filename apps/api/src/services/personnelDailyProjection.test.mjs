import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPersonnelDailyContext} from './personnelDailyProjection.mjs';
const fixture=()=>({scope:{flow:'count',product_id:1,stock_code:'0007',current_stock_qty:4,average_cost_try:60,settings_json:'private'},drafts:[{id:1,state:'approved',created_by:15,payload_json:JSON.stringify({system:4,physical:3,reason:'count',lines:[{productId:'1',stockCode:'0007',physical:3,system:4,reason:'count',movementFingerprint:'a'.repeat(64)}]}),plan_json:'{"cost":60}',result_json:'{"id":1,"stockAfter":3,"unit_cost_try":60}'}],countProducts:[{id:'1',stockCode:'0007',stockQuantity:4,costExact4:'60.0000',barcode:'0000007',movementFingerprint:'a'.repeat(64)}],accounts:[{id:1,balance:100}],party:{id:2,name:'Party',balance:200,currency_code:'TRY'},source:{grand_total:60},items:[{line_total:60}],availablePurchaseSources:[],movementFingerprint:'b'.repeat(64)});
test('personnel count DTO retains scan, quantities, UUID context and removes cost/finance at server',()=>{
 const original=fixture(),out=projectPersonnelDailyContext('count',{id:15,permissions:['product.view']},original);
 assert.equal(out.scope.stock_code,'0007');assert.equal(out.countProducts[0].barcode,'0000007');assert.equal(out.countProducts[0].stockQuantity,4);assert.equal(out.countProducts[0].movementFingerprint,'a'.repeat(64));
 assert.equal(JSON.parse(out.drafts[0].payload_json).lines[0].physical,3);
 assert.equal(out.drafts[0].plan_json,null);assert.deepEqual(out.accounts,[]);assert.equal(out.source,null);
 assert.doesNotMatch(JSON.stringify(out),/average_cost|costExact|unit_cost|balance|grand_total|line_total|settings_json/);
 assert.equal(original.scope.average_cost_try,60);
});
test('authorized office DTO and unrelated flows retain their established contract',()=>{
 const data=fixture();assert.equal(projectPersonnelDailyContext('count',{permissions:['stock.adjust']},data),data);assert.equal(projectPersonnelDailyContext('count',{permissions:['finance.view']},data),data);assert.equal(projectPersonnelDailyContext('purchase',{permissions:['purchase.view']},data),data);
});
