import test from 'node:test';
import assert from 'node:assert/strict';
import {OPENING_PRICE_RUN as run,createOpeningPriceService,parseOpeningPriceListQuery} from './openingPriceService.js';
const sourceKey='VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/123';
const header=()=>({database_name:run.database,run_id:run.runId,run_status:'COMMITTED',source_hash:run.sourceHash,plan_hash:run.planHash,source_as_of:'2026-09-30',accepted:true,product_id:'15',product_source_key:sourceKey,main_unit_source_id:'42',price_count:3,total:1,page:1,page_size:50});
const sale=(unit='42',currency='TRY',value='0.00000000',id='71')=>({product_id:'15',price_id:id,product_source_key:sourceKey,price_source_key:`${sourceKey}/PRICE/sale/${unit}/1/${currency}`,source_unit_id:unit,price_type:'sale',price_tier:1,currency_code:currency,price_exact:value,is_main_unit:unit==='42'});
const purchase=()=>({product_id:'15',price_id:'73',product_source_key:sourceKey,price_source_key:`${sourceKey}/PRICE/purchase/CARD/0/USD`,source_unit_id:null,price_type:'purchase',price_tier:0,currency_code:'USD',price_exact:'90071992547409.00000001',is_main_unit:false});
const product=()=>({product_id:'15',stock_code:'000123',product_name:'Fixture product',product_source_key:sourceKey,main_unit_source_id:'42',is_active:true,stock_quantity_exact:'-2.00000000',average_cost_try_exact:null,price_count:3});
function harness(response,{testOnly=true,fail,getSourceVersion=()=>null}={}){
 const calls=[],sql={BigInt:'bigint',NVarChar:n=>'nvarchar'+n,Bit:'bit',Int:'int'};
 const service=createOpeningPriceService({getPool:async()=>({request:()=>({input(name,type,value){calls.push({name,type,value});return this;},async execute(procedure){calls.push({procedure});if(fail)throw fail;return response;}})}),sql,isTest:()=>testOnly,getSourceVersion});
 return {service,calls};
}
const detail=()=>({recordsets:[[header()],[sale(),sale('43','EUR','12.34000000','72'),purchase()]]});
test('v2 native typedprices use configured snapshot/procedure proof, mixedcurrencies intact and no oldseal downgrade',async()=>{const v={runId:'GOAL7-00000000-0000-4000-8000-000000000001',sourceHash:'a'.repeat(64),planHash:'b'.repeat(64),sourceAsOf:'2026-10-07',openingDetailDefinitionHash:'D'.repeat(64),openingListDefinitionHash:'E'.repeat(64)},r=detail();Object.assign(r.recordsets[0][0],{run_id:v.runId,source_hash:v.sourceHash,plan_hash:v.planHash,source_as_of:v.sourceAsOf,readerDefinitionHash:v.openingDetailDefinitionHash,product_lineage_run_id:v.runId});const f=harness(r,{getSourceVersion:()=>v}),out=await f.service.detail('15');assert.equal(f.calls.at(-1).procedure,'dbo.usp_get_source_version_prices_goal7');assert.deepEqual(out.data.prices.map(p=>p.currency),['TRY','EUR','USD']);assert.equal(out.meta.runId,v.runId);r.recordsets[0][0].product_lineage_run_id=run.runId;assert.equal((await f.service.detail('15')).meta.sourceHash,run.sourceHash);assert.equal((await f.service.detail('15')).meta.source,'accepted-native-opening-prices');r.recordsets[0][0].readerDefinitionHash='bad';await assert.rejects(()=>f.service.detail('15'));assert.equal(f.calls.at(-1).procedure,'dbo.usp_get_source_version_prices_goal7');});
test('accepted prices use procedure only and preserve exact currency/unit identities, zero and large amounts',async()=>{
 const {service,calls}=harness(detail()),result=await service.detail('15');
 assert.equal(calls.at(-1).procedure,'dbo.usp_get_accepted_opening_prices');
 assert.deepEqual(calls[0],{name:'product_id',type:'bigint',value:'15'});
 assert.equal(result.data.prices[0].priceExact,'0.00000000');
 assert.equal(result.data.prices[1].unitSourceId,'43');
 assert.equal(result.data.prices[1].isMainUnit,false);
 assert.equal(result.data.prices[2].currency,'USD');
 assert.equal(result.data.prices[2].priceExact,'90071992547409.00000001');
 assert.equal(result.meta.sourceFreshLive,false);
 assert.equal(result.meta.cutoverAccepted,false);
});
test('quarantined/unaccepted product cannot return a legacy scalar or staged price',async()=>{
 const response={recordsets:[[{...header(),accepted:false,product_source_key:null,main_unit_source_id:null,price_count:0}],[]]};
 assert.deepEqual((await harness(response).service.detail('15')).data.prices,[]);
 response.recordsets[1].push(sale());
 await assert.rejects(harness(response).service.detail('15'),{code:'OPENING_PRICE_BINDING_DRIFT'});
});
test('wrong run, changed identity/currency/tier/unit, missing prices and float values fail closed',async()=>{
 const corruptions=[r=>r.recordsets[0][0].main_unit_source_id=null,r=>r.recordsets[0][0].run_status='PREPARED',r=>r.recordsets[0][0].plan_hash='a'.repeat(64),r=>r.recordsets[0][0].database_name='LIVE',r=>r.recordsets[1][0].product_id='16',r=>r.recordsets[1][0].currency_code='EUR',r=>r.recordsets[1][0].price_tier=2,r=>r.recordsets[1][0].source_unit_id='43',r=>r.recordsets[1][0].price_exact=0,r=>r.recordsets[1].pop(),r=>r.recordsets[1][1]={...r.recordsets[1][0]}];
 for(const corrupt of corruptions){const response=detail();corrupt(response);await assert.rejects(harness(response).service.detail('15'),{code:'OPENING_PRICE_BINDING_DRIFT'});}
});
test('list is bounded, parameterized and joins only the accepted page with exact price counts',async()=>{
 const response={recordsets:[[header()],[product()],detail().recordsets[1]]},context=harness(response),result=await context.service.list({search:'000123',positive:'1'});
 assert.equal(context.calls.at(-1).procedure,'dbo.usp_list_accepted_opening_products');
 assert.deepEqual(context.calls.slice(0,4).map(c=>[c.name,c.value]),[['search','000123'],['positive_only',true],['page',1],['page_size',50]]);
 assert.equal(result.data[0].stockCode,'000123');
 assert.equal(result.data[0].averageCostTryExact,null);
 assert.equal(result.data[0].prices.length,3);
 const extra={...sale(),product_id:'16'};response.recordsets[2].push(extra);
 await assert.rejects(harness(response).service.list({}),{code:'OPENING_PRICE_BINDING_DRIFT'});
 response.recordsets[2].pop();response.recordsets[1][0].price_count=4;
 await assert.rejects(harness(response).service.list({}),{code:'OPENING_PRICE_BINDING_DRIFT'});
});
test('client cannot override accepted run, exceed limits or supply unsafe IDs and non-TEST cannot connect',async()=>{
 for(const query of [{run:'LIVE'},{limit:'101'},{page:'0'},{positive:'yes'},{search:['x']},{search:'x'.repeat(121)}])assert.throws(()=>parseOpeningPriceListQuery(query),{code:'OPENING_PRICE_QUERY_INVALID'});
 const context=harness(detail(),{testOnly:false});await assert.rejects(context.service.detail('15'),{code:'OPENING_PRICES_TEST_ONLY'});assert.equal(context.calls.length,0);
 for(const value of ['15 OR 1=1','9223372036854775808',15])await assert.rejects(harness(detail()).service.detail(value),{code:'OPENING_PRICE_PRODUCT_ID_INVALID'});
});
test('SQL drift and unavailable-procedure failures disclose only stable safe errors',async()=>{
 const context=harness(null,{fail:{message:'driver failed',originalError:{message:'[SQL Server]OPENING_PRICE_BINDING_DRIFT private record'}}});
 await assert.rejects(context.service.detail('15'),e=>e.code==='OPENING_PRICE_BINDING_DRIFT'&&!e.message.includes('private'));
 await assert.rejects(harness(null,{fail:{number:2812,message:'missing dbo procedure with private detail'}}).service.detail('15'),e=>e.code==='OPENING_PRICES_NOT_READY'&&!e.message.includes('private'));
});
