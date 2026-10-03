import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogFeed} from './nativeCatalogFeed.mjs';
const actor={id:8},query={terminalCode:'TC21'};
function fixture(){
 let time=1000,data={rows:[{id:1,price:10,barcodes:['001']},{id:2,price:20,barcodes:['002']}],rates:[{currency:'USD',rateToTry:40}],customers:[{id:3,currency:'USD'}]};
 const feed=createCatalogFeed({load:async()=>structuredClone(data),now:()=>time,cacheMs:0,ttlMs:100,
 quote:(row,customer)=>({...row,productId:row.id,customerId:customer.id,quotedAt:time})});
 return {feed,get data(){return data;},advance:()=>time+=101,
 version:baseRevision=>feed.version({...query,baseRevision},actor),
 page:(plan,params={},who=actor)=>feed.page({...query,planId:plan.planId,customerId:3,...params},who)};
}
test('unchanged business data returns unchanged despite quote timestamps',async()=>{
 const f=fixture(),first=await f.version();f.advance();
 assert.deepEqual(await f.version(first.revision),{changed:false,revision:first.revision});
});
test('delta includes added and changed cards and removed ids',async()=>{
 const f=fixture(),first=await f.version();
 f.data.rows=[{id:1,price:11,barcodes:['009']},{id:3,price:30,barcodes:[]}];
 const next=await f.version(first.revision);
 assert.equal(next.mode,'delta');assert.equal(next.changedCount,2);assert.deepEqual(next.removedIds,[2]);
 assert.deepEqual(f.page(next).quotes.map(q=>q.productId),[1,3]);
});

test('a category-only change advances revision and updates just that product while old plans stay stable',async()=>{
 const f=fixture();f.data.rows[0].category='Takım';f.data.rows[1].category='Tulum';
 const first=await f.version();
 f.data.rows[0].category='Yeni kategori';
 const next=await f.version(first.revision);
 assert.notEqual(next.revision,first.revision);assert.equal(next.mode,'delta');assert.equal(next.changedCount,1);
 assert.deepEqual(f.page(next).quotes.map(q=>({productId:q.productId,category:q.category})),[{productId:1,category:'Yeni kategori'}]);
 assert.equal(f.page(first).quotes[0].category,'Takım');
 assert.deepEqual(await f.version(next.revision),{changed:false,revision:next.revision});
});
test('removal-only and empty catalogs contain no replacement quotes',async()=>{
 const f=fixture(),first=await f.version();f.data.rows=[];
 const next=await f.version(first.revision);
 assert.equal(next.changedCount,0);assert.equal(next.total,0);assert.deepEqual(next.removedIds,[1,2]);assert.deepEqual(f.page(next).quotes,[]);
});
test('rate and customer changes force full reprice',async()=>{
 const f=fixture(),first=await f.version();f.data.rates[0].rateToTry=45;
 const next=await f.version(first.revision);assert.equal(next.mode,'full');assert.equal(next.changedCount,2);
 f.data.customers[0].name='Changed';assert.equal((await f.version(next.revision)).mode,'full');
});

test('common-currency pricing capability changes force a full package even with unchanged products',async()=>{
 const f=fixture(),first=await f.version();
 f.data.priceScope='currency-v1';
 const next=await f.version(first.revision);
 assert.notEqual(next.revision,first.revision);assert.equal(next.mode,'full');assert.equal(next.changedCount,2);
});
test('an existing plan keeps its snapshot while another client sees newer cards',async()=>{
 const f=fixture(),first=await f.version();assert.equal(f.page(first,{limit:1}).nextId,1);
 f.data.rows[1].price=99;f.data.rows.push({id:3,price:30});await f.version();
 const page=f.page(first,{afterId:1,limit:1});assert.equal(page.quotes[0].price,20);assert.equal(page.nextId,null);assert.equal(page.revision,first.revision);
});
test('plan is bound to personnel and terminal, with valid customer and cursor',async()=>{
 const f=fixture(),plan=await f.version();
 for(const [params,who] of [[{}, {id:9}],[{terminalCode:'OTHER'},actor],[{customerId:99},actor],[{afterId:-1},actor],[{limit:201},actor]]){
  assert.throws(()=>f.page(plan,params,who),e=>e.statusCode===409);
 }
});
test('expired plan is rejected; missing base falls back to full',async()=>{
 const f=fixture(),plan=await f.version();f.advance();
 assert.throws(()=>f.page(plan),e=>e.code==='NATIVE_CATALOG_EXPIRED');
 assert.equal((await f.version('missing')).mode,'full');
});
test('simultaneous version checks share the database read',async()=>{
 let reads=0;
 const feed=createCatalogFeed({load:async()=>{reads++;await new Promise(r=>setTimeout(r,5));return {rows:[],rates:[],customers:[]};},quote:x=>x});
 await Promise.all([feed.version(query,actor),feed.version(query,actor)]);assert.equal(reads,1);
});
