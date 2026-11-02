import test from 'node:test';import assert from 'node:assert/strict';
import {createSavedBusinessBasket,businessBasketOperationStamp,restoreSavedBusinessBasket} from './savedBusinessSalesBasket.mjs';
import {emptyBusinessSalesBasket,addBusinessSalesBasketLine} from './workBusinessSalesBasketModel.mjs';
import {saleReadSelection,saleReadProduct} from './workBusinessSalesRead.test-fixture.mjs';
const query={customerId:'155',accountId:'7',currency:'USD',productId:'12',priceId:'81',unitSourceId:'9',tier:'1'};
const positiveProduct=()=>({...saleReadProduct(),stockQuantityExact:'8.00000000'});
function fixture(){const values=new Map(),writes=[],storage={getItem:k=>values.get(k)??null,setItem(k,v){writes.push(k);values.set(k,v);},removeItem(k){writes.push(k);values.delete(k);}},store=createSavedBusinessBasket({storage,host:'127.0.0.1:5555',actorId:'17',locks:{request:async(_k,_o,fn)=>fn()}}),basket=addBusinessSalesBasketLine(emptyBusinessSalesBasket(),saleReadSelection(query,{product:positiveProduct()}),'2');return {values,writes,storage,store,basket};}
test('device preparation persists minimal selection and restores with real envelope and basket validators; no authority or personal data',async()=>{
 const f=fixture(),saved=await f.store.save(f.basket,'2026-11-02','none',null,()=>true),raw=saved.raw;
 assert.equal(f.writes.length,1);assert(f.writes[0].startsWith('melisa-work-sale-basket-v1:'));
 assert.doesNotMatch(raw,/barcode|sourceKey|balance|customerName|name|Bearer|requestId|capability|writeAuthorized|witness/);
 const calls=[],fresh=await restoreSavedBusinessBasket(f.store.read(),async q=>{calls.push(q);return saleReadSelection(q,{product:positiveProduct()});});
 assert.deepEqual(calls,[query]);assert.equal(fresh.lines[0].quantity,'2');assert.equal(fresh.productTotalExact8,f.basket.productTotalExact8);assert.equal(fresh.writeAuthorized,false);assert.equal(fresh.nativeInvoiceTotalVerified,false);
 assert.equal(f.store.current(saved),true);assert.equal(f.writes.length,1);
});
test('actor/host isolation, conflicting tabs, malformed data and exact readback are fail closed without clearing another saved draft',async()=>{
 const f=fixture(),saved=await f.store.save(f.basket,null,'none',null,()=>true),other=createSavedBusinessBasket({storage:f.storage,host:'127.0.0.1:5555',actorId:'18'});assert.equal(other.read(),null);
 assert.equal(createSavedBusinessBasket({storage:f.storage,host:'192.168.1.46:5555',actorId:'17'}).read(),null);
 await assert.rejects(f.store.save(f.basket,null,'none',null,()=>true),/Saklanan/);assert.equal(f.store.current(saved),true);
 const key=[...f.values.keys()][0];f.values.set(key,'invalid-json');const invalid=f.values.get(key);assert.throws(()=>f.store.read());await assert.rejects(f.store.save(f.basket,null,'none',saved,()=>true));assert.equal(f.values.get(key),invalid);
 await assert.rejects(f.store.remove(saved,()=>true));assert.equal(f.values.get(key),invalid);
});
test('pending, unknown and changed completed operation are distinguished without copying a native request or generating IDs',()=>{
 assert.equal(businessBasketOperationStamp(null),'none');assert.throws(()=>businessBasketOperationStamp({read:()=>({status:'pending'})}),e=>e.code==='SAVED_BASKET_OPERATION_PENDING');
 assert.throws(()=>businessBasketOperationStamp({read:()=>({status:'unknown'})}));
 const done=id=>({read:()=>({version:1,status:'done',path:'/api/work-sales/drafts',body:{requestId:id}})});
 assert.notEqual(businessBasketOperationStamp(done('first')),businessBasketOperationStamp(done('second')));
 assert.throws(()=>businessBasketOperationStamp({read(){throw Error('unreadable');}}));
});
test('restoration rejects repricing, hold, unknown stock, shortage, currency and unit changes using the production validator',async()=>{
 for(const change of ['price','hold','stock-null','shortage','currency','unit']){
  const f=fixture(),saved=await f.store.save(f.basket,null,'none',null,()=>true),p=positiveProduct();
  if(change==='price')p.salePrices[0].priceExact='3.00000000';if(change==='hold')p.hold={blocked:true,reasons:['fixture']};if(change==='stock-null')p.stockQuantityExact=null;if(change==='shortage')p.stockQuantityExact='1.00000000';if(change==='currency')p.salePrices[0].currency='EUR';if(change==='unit')p.unit.factorExact8='2.00000000';
  await assert.rejects(restoreSavedBusinessBasket(saved,async q=>saleReadSelection(q,{product:p})),undefined,change);assert.equal(f.store.read().raw,saved.raw);assert.equal(f.writes.length,1);
 }
});
test('corrupted scope, quantities, unknown fields and impossible dates never become a restored basket',async()=>{
 for(const mutate of [p=>p.scope.currency='LL',p=>p.items[0].quantity='0',p=>p.items[0].quantity='2.5',p=>p.items[0].selection.productId='013',p=>p.items[0].unitPriceExact8='0.00000000',p=>p.documentDate='2026-02-31',p=>p.items[0].capability=true]){
  const f=fixture(),saved=await f.store.save(f.basket,null,'none',null,()=>true);mutate(saved.record.preparation);let calls=0;await assert.rejects(restoreSavedBusinessBasket(saved,async()=>{calls++;}));assert.equal(calls,0);
 }
});
test('exclusive browser lock serializes two writers and a queued stale view cannot mutate device storage',async()=>{
 const f=fixture();let tail=Promise.resolve(),release;const gate=new Promise(r=>release=r);
 const locks={request(key,options,fn){assert.match(key,/^melisa-work-sale-basket-v1:/);assert.deepEqual(options,{mode:'exclusive'});const next=tail.then(()=>gate).then(fn);tail=next.catch(()=>{});return next;}};
 const a=createSavedBusinessBasket({storage:f.storage,host:'127.0.0.1:5555',actorId:'17',locks}),b=createSavedBusinessBasket({storage:f.storage,host:'127.0.0.1:5555',actorId:'17',locks});
 const first=a.save(f.basket,null,'none',null,()=>true),second=b.save(f.basket,'2026-11-02','none',null,()=>true);const denied=assert.rejects(second,e=>e.code==='SAVED_BASKET_CHANGED');release();const saved=await first;await denied;assert.equal(f.writes.length,1);assert.equal(a.read().raw,saved.raw);
 await assert.rejects(b.remove(saved,()=>false),e=>e.code==='SAVED_BASKET_VIEW_CHANGED');assert.equal(f.writes.length,1);
 const unsupported=createSavedBusinessBasket({storage:f.storage,host:'127.0.0.1:5555',actorId:'17',locks:{}});assert.equal(unsupported.writable,false);await assert.rejects(unsupported.remove(saved,()=>true),e=>e.code==='SAVED_BASKET_LOCK_UNAVAILABLE');assert.equal(f.writes.length,1);
});
