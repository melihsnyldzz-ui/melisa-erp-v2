import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogProductDto,parseCatalogQuery,parseCatalogId} from './catalogModel.mjs';
import {createCatalogProductService} from './catalogProductService.mjs';
const source='VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/12';
const card=()=>({id:'12',stockCode:'0012',productName:'Ürün',isActive:true,stockQuantityExact:null,unit:{label:null,sourceId:null,factorExact8:null,verified:false},barcodes:[{id:'77',value:'000012',isPrimary:true,sourceKey:null}],imageUrl:null,provenance:{kind:'accepted-opening',sourceKey:source,runId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30',verified:true},hold:{blocked:false,reasons:[]},salePrices:[],photo:{status:'missing',url:null,sourceKey:null,verified:false}});
const price=(currency='TRY',priceExact='0.00000000')=>({id:currency==='TRY'?'81':'82',type:'sale',unitSourceId:'7',tier:1,currency,priceExact,isMainUnit:true,sourceKey:`${source}/PRICE/sale/7/1/${currency}`});
const actor={id:14,permissions:['product.view']};
const response=()=>({actorId:'14',canViewSalesPrices:false,total:1,page:1,limit:25,readAt:'2026-10-05T08:00:00.000Z',acceptedCount:16622,syntheticCount:0,quarantinedCount:54,rows:[card()]});
const serviceFor=r=>createCatalogProductService({getStore:async()=>({readCatalogProducts:async({options})=>({...r,limit:options.limit})})});
test('stock-only role can read catalog without purchase or sales permission; source/counts/photo explicit',async()=>{
 const r=response(),s=serviceFor(r),out=await s.list({},actor);assert.equal(out.meta.schemaVersion,'melisa-catalog.v1');assert.equal(out.meta.scopeCounts.syntheticTest,0);assert.equal(out.data[0].stockQuantityExact,null);assert.equal(out.data[0].unit.factorExact8,null);assert.equal(out.data[0].barcodes[0].value,'000012');assert.deepEqual(out.data[0].photo,card().photo);assert.deepEqual(out.data[0].salePrices,[]);assert.equal(Object.hasOwn(out.data[0],'financial'),false);assert.equal(Object.hasOwn(out.data[0],'imageUrl'),false);
 await assert.rejects(()=>s.list({}, {id:14,permissions:['sales.view']}),{statusCode:403});
});
test('catalog defaults to 50 without changing explicit limits or strict query validation',async()=>{
 assert.equal(parseCatalogQuery().limit,50);assert.equal(parseCatalogQuery({}).limit,50);assert.equal(parseCatalogQuery({limit:undefined}).limit,50);
 for(const limit of ['1','25','50'])assert.equal(parseCatalogQuery({limit}).limit,Number(limit));
 for(const query of [null,[],['25'],'',{limit:'025'},{limit:'050'},{limit:'51'},{limit:'0'},{limit:50},{limit:null},{unknown:'x'},{search:['x']}])assert.throws(()=>parseCatalogQuery(query),{code:'CATALOG_QUERY_INVALID',statusCode:400});
 const s=serviceFor(response());assert.equal((await s.list({},actor)).meta.limit,50);assert.equal((await s.list({limit:'25'},actor)).meta.limit,25);
});
test('DB current sales permission AND authenticated sales permission gate sales values independently',async()=>{
 const r=response(),s=serviceFor(r),sales={...actor,permissions:['product.view','sales.view']};r.canViewSalesPrices=true;r.rows[0].salePrices=[price(),price('USD',null)];
 assert.deepEqual((await s.list({},actor)).data[0].salePrices,[]);const out=await s.list({},sales);assert.equal(out.meta.canViewSalesPrices,true);assert.equal(out.data[0].salePrices[0].priceExact,'0.00000000');assert.equal(out.data[0].salePrices[1].priceExact,null);
 r.canViewSalesPrices=false;r.rows[0].salePrices=[];assert.equal((await s.list({},sales)).meta.canViewSalesPrices,false);
 r.rows[0].salePrices=[price()];await assert.rejects(()=>s.list({},sales));
});
test('money floats, wrong tuple/source, purchase values and duplicate typedprices fail closed',()=>{
 const r=card();for(const mutate of [p=>{p.priceExact=1.2;},p=>{p.priceExact='1.20';},p=>{p.type='purchase';},p=>{p.currency='GBP';},p=>{p.sourceKey='other';},p=>{p.unitSourceId=null;}]){const p=price();mutate(p);r.salePrices=[p];assert.throws(()=>catalogProductDto(r,{sqlSales:true,canViewSalesPrices:true}));}
 r.salePrices=[price(),price()];assert.throws(()=>catalogProductDto(r,{sqlSales:true}));r.salePrices=[];r.financial={averageCostTryExact:'1.00000000'};assert.throws(()=>catalogProductDto(r));
});
test('held card readonly prices empty; synthetic fixtures cannot enter real catalog',()=>{
 const r=card();r.provenance.kind='quarantined-source';r.hold={blocked:true,reasons:['IDENTITY_AMBIGUOUS']};assert.deepEqual(catalogProductDto(r).salePrices,[]);r.salePrices=[price()];assert.throws(()=>catalogProductDto(r,{sqlSales:true}));
 r.salePrices=[];r.id='301986';r.stockCode='TEST-DAILY-PURCHASE';r.provenance={kind:'synthetic-test',sourceKey:null,runId:null,sourceAsOf:null,verified:true};assert.throws(()=>catalogProductDto(r));
});
test('strict search/bigint bounds, page/detail not-found, duplicates and incomplete page reject',async()=>{
 assert.equal(parseCatalogQuery({barcode:'000012'}).barcode,'000012');for(const q of [{limit:'51'},{purchase:'1'},{page:1},{barcode:'a'.repeat(161)}])assert.throws(()=>parseCatalogQuery(q),{statusCode:400});assert.equal(parseCatalogId('9223372036854775807'),'9223372036854775807');assert.throws(()=>parseCatalogId('9223372036854775808'));
 const r=response(),s=serviceFor(r);assert.equal((await s.detail('12',actor)).data.id,'12');r.total=0;r.rows=[];await assert.rejects(()=>s.detail('12',actor),{statusCode:404});r.total=2;r.rows=[card(),card()];await assert.rejects(()=>s.list({},actor));r.rows=[card()];await assert.rejects(()=>s.list({},actor));
});
test('output whitelist drops unrelated nested data; explicit purchase finance input rejects',()=>{
 const r=card();r.unit.secretCost='7';r.barcodes[0].purchaseCost='8';r.provenance.cost='9';r.photo.cost='10';r.salePrices=[{...price(),averageCostTryExact:'11'}];const out=catalogProductDto(r,{sqlSales:true,canViewSalesPrices:true});assert.equal(JSON.stringify(out).includes('Cost'),false);assert.equal(JSON.stringify(out).includes('"cost"'),false);r.purchasePrices=[];assert.throws(()=>catalogProductDto(r,{sqlSales:true}));
});
