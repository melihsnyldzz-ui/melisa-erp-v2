import test from 'node:test';
import assert from 'node:assert/strict';
import {parseStockProductQuery,parseStockProductId,stockProductDto} from './stockProductModel.mjs';
import {createStockProductService} from './stockProductService.mjs';
const actor={id:14,permissions:['product.view']};
const card=()=>({id:'12',stockCode:'00012',productName:'Ürün',isActive:true,stockQuantityExact:null,unit:{label:'ADET',sourceId:'7',factorExact8:null,verified:false},barcodes:[{id:'91',value:'000012',isPrimary:true,sourceKey:null}],imageUrl:null,provenance:{kind:'accepted-opening',sourceKey:'VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/12',runId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30',verified:true},hold:{blocked:false,reasons:[]}});
const result=()=>({actorId:'14',canViewFinance:false,total:1,page:1,limit:25,readAt:'2026-10-05T08:00:00.000Z',rows:[card()],acceptedCount:16622,syntheticCount:3,quarantinedCount:54});
test('strict bounded filters preserve literal barcode and reject broad/coerced queries',()=>{
  assert.equal(parseStockProductQuery({barcode:'000012'}).barcode,'000012');
  assert.equal(parseStockProductQuery({barcode:' 000012 '}).barcode,' 000012 ');
  assert.equal(parseStockProductQuery().limit,25);
  for(const q of [{limit:'51'},{page:'0'},{page:1},{barcode:12},{search:['a']},{barcode:'1'.repeat(161)},{stock:'unknown'},{status:'deleted'},{financial:'1'}])assert.throws(()=>parseStockProductQuery(q),{code:'STOCK_PRODUCT_QUERY_INVALID'});
  assert.equal(parseStockProductId('9223372036854775807'),'9223372036854775807');
  for(const id of ['9223372036854775808',9007199254740992,'01'])assert.throws(()=>parseStockProductId(id));
});
test('DTO unknown, actual zero, negative and unit unknown survive distinctly',()=>{
  for(const qty of [null,'0.00000000','-2.00000000']){const c=card();c.stockQuantityExact=qty;const dto=stockProductDto(c);assert.equal(dto.stockQuantityExact,qty);assert.equal(dto.unit.factorExact8,null);assert.equal(dto.barcodes[0].value,'000012');}
  const c=card();c.unit.factorExact8='1.00000000';assert.throws(()=>stockProductDto(c));
  c.unit.verified=true;assert.equal(stockProductDto(c).unit.verified,true);
  c.stockQuantityExact=0;assert.throws(()=>stockProductDto(c));
});
test('finance is DB permission gated and additionally suppressed after auth revocation',async()=>{
  const response=result();response.canViewFinance=true;response.rows[0].financial={averageCostTryExact:null,prices:[{id:'77',type:'purchase',unitSourceId:null,tier:0,currency:'USD',priceExact:'0.00000000',isMainUnit:false,sourceKey:`${response.rows[0].provenance.sourceKey}/PRICE/purchase/CARD/0/USD`}]};
  const service=createStockProductService({getStore:async()=>({readStockProducts:async({options})=>({...response,limit:options.limit})})});
  assert.equal(Object.hasOwn((await service.detail('12',actor)).data,'financial'),false);
  const financialActor={...actor,permissions:['product.view','purchase.view']};
  assert.equal((await service.detail('12',financialActor)).data.financial.averageCostTryExact,null);
  const price=response.rows[0].financial.prices[0];price.sourceKey='C09/301986/purchase/CARD/0/USD';await assert.rejects(()=>service.detail('12',financialActor));price.sourceKey=`${response.rows[0].provenance.sourceKey}/PRICE/purchase/CARD/0/USD`;
  response.canViewFinance=false;await assert.rejects(()=>service.detail('12',financialActor),{code:'STOCK_PRODUCT_UNAVAILABLE'});
});
test('finance-authorized list omits finance while authorized detail requires it',async()=>{
  const response=result();response.canViewFinance=true;
  const service=createStockProductService({getStore:async()=>({readStockProducts:async({options})=>({...response,limit:options.limit})})});
  const user={...actor,permissions:['product.view','purchase.view']};
  const list=await service.list({},user);assert.equal(list.meta.canViewFinance,true);assert.equal(Object.hasOwn(list.data[0],'financial'),false);
  await assert.rejects(()=>service.detail('12',user),{code:'STOCK_PRODUCT_UNAVAILABLE'});
  response.rows[0].financial={averageCostTryExact:null,prices:[]};
  await assert.rejects(()=>service.list({},user),{code:'STOCK_PRODUCT_UNAVAILABLE'});
  assert.equal((await service.detail('12',user)).data.financial.averageCostTryExact,null);
  response.canViewFinance=false;await assert.rejects(()=>service.list({},actor),{code:'STOCK_PRODUCT_UNAVAILABLE'});await assert.rejects(()=>service.detail('12',actor),{code:'STOCK_PRODUCT_UNAVAILABLE'});
});
test('authorization rejects before reading; actor drift, corrupt metadata and source cannot become empty success',async()=>{
  let calls=0;const response=result();const service=createStockProductService({getStore:async()=>({readStockProducts:async()=>{calls++;return response;}})});
  await assert.rejects(()=>service.list({}, {id:14,permissions:['purchase.view']}),{statusCode:403});assert.equal(calls,0);
  response.actorId='16';await assert.rejects(()=>service.list({},actor));response.actorId='14';response.total=2;await assert.rejects(()=>service.list({},actor));response.total=1;response.rows[0].provenance.sourceAsOf='2026-10-05';await assert.rejects(()=>service.list({},actor));
});
test('hold reasons and separate named synthetic provenance are explicit readonly DTOs',()=>{
  const c=card();c.provenance.kind='quarantined-source';assert.throws(()=>stockProductDto(c));c.hold={blocked:true,reasons:['IDENTITY_AMBIGUOUS']};assert.equal(stockProductDto(c).hold.blocked,true);
  c.id='301986';c.stockCode='TEST-DAILY-PURCHASE';c.provenance={kind:'synthetic-test',sourceKey:null,runId:null,sourceAsOf:null,verified:true};assert.equal(stockProductDto(c).provenance.sourceAsOf,null);c.provenance.sourceAsOf='2026-09-30';assert.throws(()=>stockProductDto(c));
});
test('detail preserves id strings, not-found and multiple barcode cards remain selectable',async()=>{
  const response=result(),service=createStockProductService({getStore:async()=>({readStockProducts:async({options})=>({...response,limit:options.limit})})});
  assert.equal((await service.detail('12',actor)).data.id,'12');response.total=0;response.rows=[];await assert.rejects(()=>service.detail('12',actor),{statusCode:404});
  response.total=2;response.rows=[card(),{...card(),id:'13'}];assert.equal((await service.list({barcode:'000012'},actor)).data.length,2);
});
