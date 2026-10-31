import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPersonnelDailyContext,projectPersonnelDailyResponse} from './personnelDailyProjection.mjs';
import {purchaseReturnSources} from '../../../sites-workflow/src/workflow/testDailyPurchaseModel.js';
const fixture=()=>({scope:{flow:'count',product_id:1,stock_code:'0007',current_stock_qty:4,average_cost_try:60,settings_json:'private'},drafts:[{id:1,state:'approved',created_by:15,payload_json:JSON.stringify({system:4,physical:3,reason:'count',lines:[{productId:'1',stockCode:'0007',physical:3,system:4,reason:'count',movementFingerprint:'a'.repeat(64)}]}),plan_json:'{"cost":60}',result_json:'{"id":1,"stockAfter":3,"unit_cost_try":60}'}],countProducts:[{id:'1',stockCode:'0007',stockQuantity:4,costExact4:'60.0000',barcode:'0000007',movementFingerprint:'a'.repeat(64)}],accounts:[{id:1,balance:100}],party:{id:2,name:'Party',balance:200,currency_code:'TRY'},source:{grand_total:60},items:[{line_total:60}],availablePurchaseSources:[],movementFingerprint:'b'.repeat(64)});
test('personnel count DTO retains scan, quantities, UUID context and removes cost/finance at server',()=>{
 const original=fixture(),out=projectPersonnelDailyContext('count',{id:15,permissions:['product.view']},original);
 assert.equal(out.scope.stock_code,'0007');assert.equal(out.countProducts[0].barcode,'0000007');assert.equal(out.countProducts[0].stockQuantity,4);assert.equal(out.countProducts[0].movementFingerprint,'a'.repeat(64));
 assert.equal(JSON.parse(out.drafts[0].payload_json).lines[0].physical,3);
 assert.equal(out.drafts[0].plan_json,null);assert.deepEqual(out.accounts,[]);assert.equal(out.source,null);
 assert.doesNotMatch(JSON.stringify(out),/average_cost|costExact|unit_cost|balance|grand_total|line_total|settings_json/);
 assert.equal(original.scope.average_cost_try,60);
});
test('finance-authorized office DTO and unrelated flows retain their established contract',()=>{
 const data=fixture();assert.equal(projectPersonnelDailyContext('count',{permissions:['stock.adjust','finance.view']},data),data);assert.equal(projectPersonnelDailyContext('purchase',{permissions:['finance.view']},data),data);assert.equal(projectPersonnelDailyContext('sales',{permissions:['sales.view']},data),data);
});
test('personnel projection retains joined creator and decision names without exposing user credentials',()=>{
 const data=fixture();Object.assign(data.drafts[0],{created_by_name:'Örnek sayım personeli',decided_by:22,decided_by_name:'Örnek stok sorumlusu',password_hash:'private'});
 const out=projectPersonnelDailyContext('count',{permissions:['product.view']},data);
 assert.equal(out.drafts[0].created_by_name,'Örnek sayım personeli');assert.equal(out.drafts[0].decided_by_name,'Örnek stok sorumlusu');assert.doesNotMatch(JSON.stringify(out),/password_hash|private|costExact/);
});
const purchaseFixture=()=>({
 scope:{flow:'purchase',product_id:1,stock_code:'0007',product_name:'Source product',unit:'ADET',current_stock_qty:4,average_cost_try:60,source_id:11,source_kind:'purchase',supplier_id:2,settings_json:'private'},
 drafts:[{id:31,flow:'purchase',kind:'invoice-return',state:'pending',created_by:15,payload_json:JSON.stringify({requestId:'fixture-uuid',kind:'purchase',sourceInvoiceId:11,reason:'Physical return',documentDate:'2026-10-06',items:[{productId:1,sourceItemId:21,quantity:1,unitCostTry:60}]}),plan_json:JSON.stringify({sourceDocumentNo:'PURCHASE-11',documentCurrency:'TRY',partyName:'Supplier',amount:60,accountAmount:60,amountTry:60,exchangeRate:1,cashEffect:0,items:[{productId:1,sourceItemId:21,stockCode:'0007',quantity:1,stockBefore:4,stockAfter:3,unitCostTry:60,averageCostBefore:60,averageCostAfter:60}]}),result_json:JSON.stringify({id:401,stockAfter:3,balanceEffect:60,supplierEffect:60,account:{id:5,balance:300},reversal:{id:402,reversal_stock_movement_id:501,amount:60}})}],
 accounts:[{id:5,balance:300}],party:{id:2,name:'Supplier',code:'SUP-2',currency_code:'TRY',balance:200},source:{id:11,document_no:'PURCHASE-11',document_currency:'TRY',status:'finalized',grand_total:120},items:[{id:21,product_id:1,quantity:2,line_total:120}],
 availablePurchaseSources:[{id:11,document_no:'PURCHASE-11',status:'finalized',document_currency:'TRY',grand_total:120,supplierId:2,supplierName:'Supplier',supplierBalance:200,supplierCurrency:'TRY',items:[{id:21,product_id:1,stock_code:'0007',product_name:'Source product',current_stock_qty:4,quantity:2,line_total:120,returnedQuantity:0,pendingQuantity:1,returnableQuantity:1,movementFingerprint:'a'.repeat(64)}]}],countProducts:[],movementFingerprint:null,
});
test('seller purchase-return GET excludes financial/cost fields including nested stored plans',()=>{
 const data=purchaseFixture(),out=projectPersonnelDailyContext('purchase',{id:15,permissions:['purchase.view']},data),text=JSON.stringify(out);
 assert.doesNotMatch(text,/average_cost|unitCost|averageCost|supplierBalance|balanceEffect|supplierEffect|grand_total|line_total|accountAmount|amountTry|exchangeRate|cashEffect|settings_json|"balance"/);
 assert.deepEqual(out.accounts,[]);assert.equal(out.party.currency_code,'TRY');assert.equal(out.scope.source_id,11);assert.equal(out.source.document_no,'PURCHASE-11');assert.equal(out.items[0].quantity,2);
 const source=out.availablePurchaseSources[0];assert.equal(source.items[0].returnableQuantity,1);assert.equal(source.items[0].movementFingerprint,'a'.repeat(64));
 const plan=JSON.parse(out.drafts[0].plan_json);assert.equal(plan.items[0].stockCode,'0007');assert.equal(plan.items[0].stockAfter,3);assert.equal(plan.sourceDocumentNo,'PURCHASE-11');
 assert.equal(JSON.parse(out.drafts[0].payload_json).items[0].sourceItemId,21);assert.equal(JSON.parse(out.drafts[0].result_json).reversal.reversal_stock_movement_id,501);
 assert.equal(data.scope.average_cost_try,60);assert.equal(JSON.parse(data.drafts[0].plan_json).items[0].unitCostTry,60);
});
test('projected return source still supports current source/quantity/reason UI without fabricated cost',()=>{
 const out=projectPersonnelDailyContext('purchase',{permissions:['purchase.view']},purchaseFixture()),sources=purchaseReturnSources(out);
 assert.equal(sources[0].id,'11');assert.equal(sources[0].number,'PURCHASE-11');assert.equal(sources[0].currency,'TRY');assert.equal(sources[0].items[0].id,'21');assert.equal(sources[0].items[0].code,'0007');assert.equal(sources[0].items[0].returnableQuantity,1);assert.equal(sources[0].items[0].pendingQuantity,1);
 assert.equal(Number.isFinite(sources[0].items[0].priceCents),false);assert.equal(Number.isFinite(sources[0].balance),false);
});
test('stock adjustment permission alone is not a finance disclosure permission',()=>{
 for(const flow of ['count','count-cancel','purchase','return-cancel']){const data=purchaseFixture(),out=projectPersonnelDailyContext(flow,{permissions:['stock.adjust']},data);assert.notEqual(out,data);assert.doesNotMatch(JSON.stringify(out),/average_cost|unitCost|"balance"|grand_total|line_total/);}
});
test('mutation and UUID replay DTO projection removes monetary plan but retains source and replay identity',()=>{
 const input={id:31,state:'pending',kind:'invoice-return',replayed:true,payload:JSON.parse(purchaseFixture().drafts[0].payload_json),plan:JSON.parse(purchaseFixture().drafts[0].plan_json)},actor={id:15,permissions:['purchase.view']},out=projectPersonnelDailyResponse('purchase',actor,input);
 assert.equal(out.id,31);assert.equal(out.replayed,true);assert.equal(out.payload.requestId,'fixture-uuid');assert.equal(out.payload.items[0].sourceItemId,21);assert.equal(out.plan.items[0].stockBefore,4);assert.doesNotMatch(JSON.stringify(out),/unitCost|averageCost|accountAmount|amountTry|"amount"/);assert.equal(input.plan.amount,60);
 assert.equal(projectPersonnelDailyResponse('purchase',{permissions:['finance.view']},input),input);
});
test('nested count line and fingerprint fields cannot smuggle costs in a personnel GET',()=>{
 const data=fixture();data.drafts[0].payload_json=JSON.stringify({physical:3,lines:[{productId:1,stockCode:'0007',physical:3,system:4,unitCostTry:60}],fingerprint:[{id:101,quantity_net:4,source_type:'purchase',source_id:11,amount_try:60}],unknownScans:[{value:'0000000',quantity:1,status:'needs_review',cost:60}]});
 const out=projectPersonnelDailyContext('count',{permissions:[]},data),p=JSON.parse(out.drafts[0].payload_json);assert.equal(p.lines[0].stockCode,'0007');assert.equal(p.fingerprint[0].id,101);assert.equal(p.unknownScans[0].value,'0000000');assert.doesNotMatch(JSON.stringify(out),/unitCost|amount_try|"cost"/);
});

test('reviewer without finance visibility retains count inverse identifiers in decision and replay while nested costs stay private',()=>{
 const actor={id:22,permissions:['product.view','stock.adjust']},native={id:8,result:{id:8,lines:[{productId:1,stockBefore:23,stockAfter:24,difference:1,movementCreated:true,movementId:11,unitCostTry:60,amountTry:60}],unit_cost_try:60}};
 for(const replayed of [false,true]){const result=projectPersonnelDailyResponse('count',actor,{...native,replayed});assert.equal(result.result.lines[0].difference,1);assert.equal(result.result.lines[0].movementId,11);assert.equal(result.replayed,replayed);assert.doesNotMatch(JSON.stringify(result),/unitCost|unit_cost|amountTry/);}
});
