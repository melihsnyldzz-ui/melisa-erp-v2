import test from 'node:test';import assert from 'node:assert/strict';
import {createDesktopWriteListService} from './desktopWriteListService.mjs';
import {productCardFixture} from './test-fixtures/desktopProductCard.fixture.mjs';
function setup({allow=true,target=true,missing=false,wrongParent=false,richCards=true,stockOpening=null,badOpening=false,reserved='0.500'}={}){
 const calls=[],card={...productCardFixture(),reservedExact3:reserved,availableExact3:'1.500',salePrices:[{id:'6',productId:'6',unitId:'6',type:'sale',tier:null,currency:'TRY',priceExact8:'12.00000000'}]};let commits=0,rollbacks=0;
 class Transaction{async begin(){calls.push('begin');}async commit(){commits++;}async rollback(){rollbacks++;}}
 class Request{constructor(tx){this.tx=tx;this.params={};}input(k,_t,v){this.params[k]=v;return this;}async query(q){calls.push({q,params:this.params,tx:this.tx});
  if(q.includes('DESKTOP_LIST_TARGET_REJECTED'))return {recordset:[{ok:target?1:0}]};
  if(q.includes('COUNT_BIG(*)'))return {recordset:[{total:'1'}]};
  if(q.includes('FROM dbo.product_prices q WITH(HOLDLOCK)'))return {recordset:card.salePrices};
  if(q.includes('OFFSET @offset'))return {recordset:[{id:card.id,stockCode:card.stockCode,productName:card.name,unit:card.unit,currency:card.currency,currentStockExact3:card.currentStockExact3,salePriceExact4:card.salePriceExact4,brand:card.brand,category:card.category,supplierId:card.supplierId,supplierName:card.supplierName,reservedExact3:card.reservedExact3}]};
  if(q.includes('FROM dbo.products p WITH(HOLDLOCK)')){const {barcodes,availableExact3,...header}=card;return {recordset:missing?[]:[header]};}
  if(q.includes('SELECT TOP(101)'))return {recordset:card.barcodes.map(b=>wrongParent?{...b,productId:'7'}:b)};
  if(q.includes('FROM dbo.desktop_local_product_units WITH(HOLDLOCK)')){const recordset=[...card.units];Object.defineProperty(recordset,'columns',{value:{id:{type:'varchar'}}});Object.defineProperty(recordset,'toTable',{value:()=>{throw Error('driver helper must not be copied');}});return {recordset};}
  if(q.includes('FROM dbo.audit_logs WITH(HOLDLOCK)'))return {recordset:stockOpening?[{openingJson:JSON.stringify(stockOpening),requestId:stockOpening.requestId,actorId:stockOpening.actorId}]:[]};
  if(q.includes('FROM dbo.stock_movements WITH(HOLDLOCK)')){const {movementId,productId,actorId,quantityExact3,costExact4,amountTryExact4,documentDate,currency}=stockOpening;return {recordset:[{movementId,productId,actorId,quantityExact3:badOpening?'99.000':quantityExact3,costExact4,amountTryExact4,documentDate,currency}]};}
  throw Error('unexpected readonly SQL');}}
 const sql={Transaction,Request,NVarChar:()=>null,Int:{},ISOLATION_LEVEL:{SERIALIZABLE:4}};
 const service=createDesktopWriteListService({pool:{},sql,richCards,verifySession:async ctx=>{calls.push(ctx);return allow;}});
 return {service,calls,card,get commits(){return commits;},get rollbacks(){return rollbacks;}};
}
test('product card and all barcode parents use one verified readonly transaction',async()=>{
 const x=setup(),result=await x.service.readProduct('7','6');assert.deepEqual(result,x.card);assert.deepEqual(x.calls.find(c=>c?.permission)?.permission,['product.view','product.edit']);
 const sql=x.calls.filter(c=>c?.q);assert.equal(new Set(sql.map(c=>c.tx)).size,1);assert.ok(sql.slice(1).every(c=>c.params.productId==='6'));assert.equal(x.commits,1);assert.equal(x.rollbacks,0);
 assert.ok(sql.every(c=>!/^\s*(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP)\b/i.test(c.q)));assert.equal(result.barcodes[0].barcode,'000000000005');
});

test('card and list read active reservations in the same product snapshot; malformed totals fail closed',async()=>{
 for(const kind of ['card','list']){
  const x=setup(),result=kind==='card'?await x.service.readProduct('7','6'):(await x.service.list('7','products')).data[0];assert.equal(result.currentStockExact3,'2.000');assert.equal(result.reservedExact3,'0.500');assert.equal(result.availableExact3,'1.500');
  const q=x.calls.find(c=>c?.q?.includes(kind==='card'?'FROM dbo.products p WITH(HOLDLOCK)':'OFFSET @offset'));assert.match(q.q,/r\.product_id=(?:p|products)\.id AND r\.state='ACTIVE'/);assert.match(q.q,/SUM\(r\.quantity\)/);assert.match(q.q,/WITH\(HOLDLOCK,INDEX\(IX_desktop_active_reservations\)\)/);assert.equal(x.commits,1);
  for(const reserved of [null,undefined,-1,'-0.001','0.00','bad']){const bad=setup({reserved});if(reserved===undefined)bad.card.reservedExact3=undefined;await assert.rejects(kind==='card'?bad.service.readProduct('7','6'):bad.service.list('7','products'));assert.equal(bad.commits,0);assert.equal(bad.rollbacks,1);}
 }
});
test('opening audit is returned only when its actual stock movement matches the selected product and actor',async()=>{
 const opening={kind:'desktop-product-opening-v1',productId:'6',movementId:'11',actorId:'7',requestId:'6508625b-b648-421b-b7b9-35d4be7c7263',reason:'Açılış sayımı',quantityExact3:'2.000',costExact4:'8.0000',amountTryExact4:'16.0000',documentDate:'2026-11-06',currency:'TRY'};
 const good=setup({stockOpening:opening});assert.deepEqual((await good.service.readProduct('7','6')).stockOpening,opening);assert.equal(good.commits,1);
 for(const options of [{stockOpening:opening,badOpening:true},{stockOpening:{...opening,productId:'7'}},{stockOpening:{...opening,reason:''}}]){const bad=setup(options);await assert.rejects(bad.service.readProduct('7','6'));assert.equal(bad.commits,0);assert.equal(bad.rollbacks,1);}
});
test('wrong target, authority, selected parent or legacy profile never yield a card',async()=>{
 for(const option of [{target:false},{allow:false},{wrongParent:true}]){const x=setup(option);await assert.rejects(x.service.readProduct('7','6'));assert.equal(x.commits,0);assert.equal(x.rollbacks,1);if(!option.wrongParent)assert.equal(x.calls.some(c=>c?.q?.includes('FROM dbo.products p WITH(HOLDLOCK)')),false);}
 const old=setup({richCards:false});await assert.rejects(old.service.readProduct('7','6'));assert.equal(old.calls.length,0);
 for(const id of ['0','06','6;DROP TABLE products','9223372036854775808']){const x=setup();await assert.rejects(x.service.readProduct('7',id));assert.equal(x.calls.length,0);}
 const missing=setup({missing:true});assert.equal(await missing.service.readProduct('7','6'),null);assert.equal(missing.commits,1);
});
test('known exact barcode has priority over fuzzy names and escaped paging uses the same predicate',async()=>{
 for(const search of ['000000000051','%_[']){const x=setup();const result=await x.service.list('7','products',{page:1,limit:10,search});assert.equal(result.data[0].id,'6');const queries=x.calls.filter(c=>c?.q?.startsWith('SELECT ')&&(c.q.includes('COUNT_BIG(*)')||c.q.includes('OFFSET @offset')));assert.equal(queries.length,2);for(const q of queries){assert.equal(q.params.exactSearch,search);assert.match(q.q,/NOT EXISTS\(SELECT 1 FROM dbo\.product_barcodes/);assert.match(q.q,/b\.product_id=products\.id/);assert.match(q.q,/b\.is_active=1/);}if(search==='%_[')assert.equal(queries[0].params.search,'%~%~_~[%');}
});
