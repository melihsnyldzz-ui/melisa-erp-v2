import test from 'node:test';
import assert from 'node:assert/strict';
import {productRejectionRecord,productRejectionOutcome} from '../../../api/src/services/desktopProductRejection.mjs';
import {createDesktopWriteGreenCore} from './desktopWriteGreenCore.mjs';
import {productCardFixture} from '../../../api/src/services/test-fixtures/desktopProductCard.fixture.mjs';
test('normal facade binds full product card to selection and discards late logout results',async()=>{
 const x=fixture(['product.view','product.edit']);let finish,late=false;const original=x.deps.fetch;x.deps.richCards=true;x.deps.fetch=async(url,opts)=>{if(url.endsWith('/api/products/6')){if(late)await new Promise(r=>{finish=r;});return {ok:true,json:async()=>({success:true,data:productCardFixture()})};}if(url.endsWith('/api/products/7'))return {ok:true,json:async()=>({success:true,data:productCardFixture()})};return original(url,opts);};
 const core=createDesktopWriteGreenCore(x.deps);await core.login('normal','secret');assert.equal((await core.productCard('6')).barcodes[1].barcode,'000000000051');await assert.rejects(core.productCard('7'));await assert.rejects(core.productCard('06'));late=true;const waiting=core.productCard('6');await core.logout();finish();await assert.rejects(waiting);
 const view=fixture(['product.view']);const read=createDesktopWriteGreenCore({...view.deps,richCards:true});await read.login('normal','secret');await assert.rejects(read.productCard('6'));assert.equal(view.calls.some(c=>c.url.includes('/api/products/')),false);
});
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
function fixture(perms=['customer.view','customer.edit','product.view']){
 const calls=[],sessionStorage=memory(),localStorage=memory(),user={id:7,username:'normal',displayName:'Normal',permissions:perms};
 const f=async(url,opts)=>{calls.push({url,opts});let data;
  if(url.endsWith('/api/auth/login'))data={accessToken:'one.two.three',user};
  else if(url.endsWith('/api/auth/me'))data=user;
  else if(url.endsWith('/api/auth/logout'))data={loggedOut:true};
  else if(url.includes('/api/customers?'))return {ok:true,json:async()=>({success:true,data:[{id:'1',customerName:'Ada',customerCode:'A'}],meta:{page:2,total:101,hasNextPage:false}})};
  else if(url.endsWith('/api/desktop-local/customers')){const b=JSON.parse(opts.body);return {ok:true,status:201,json:async()=>({success:true,data:{state:'COMMITTED',operation:'customer.create',requestId:b.requestId,replayed:false,entity:{kind:'local',id:'1',entityId:'2',selectedCurrency:'TRY',accounts:[{id:'3',customerId:'1',currency:'TRY',currentBalanceExact8:'0.00000000'}]}}})};}
  else throw Error('unexpected fetch');return {ok:true,json:async()=>({success:true,data})};};
 const deps={location:{origin:'http://127.0.0.1:5294'},fetch:f,sessionStorage,localStorage,locks:{request:async(_k,_o,cb)=>cb({})},newId:()=> 'da171000-6f42-4f19-8cab-9f4539618647'};
 return {core:createDesktopWriteGreenCore(deps),deps,calls};
}
test('normal login enables permitted lists, paging and customer transport; no other edit capability',async()=>{
 const {core,calls}=fixture();await core.login('normal','secret');assert.equal(core.can('customers'),true);assert.equal(core.can('products','edit'),false);assert.throws(()=>core.create('products'));assert.equal(core.can('suppliers'),false);
 const list=await core.list('customers',2);assert.equal(list.data[0].customerName,'Ada');assert.match(calls.at(-1).url,/page=2&limit=100/);
 const customer=core.create('customers');const result=await customer.create({customerCode:'A',name:'Ada',phone:'555',customerType:'customer',currency:'TRY',city:'Yalova',country:'Türkiye'});
 assert.equal(result.state,'COMMITTED');assert.match(calls.at(-1).url,/api\/desktop-local\/customers$/);assert.equal(calls.at(-1).opts.headers.Authorization,'Bearer one.two.three');
 await core.logout();assert.equal(core.can('customers'),false);await assert.rejects(core.list('customers'));assert.throws(()=>core.create('customers'));
});
test('view-only session cannot create; server list failures never become empty data',async()=>{
 const {core}=fixture(['customer.view']);await core.login('normal','secret');assert.throws(()=>core.create('customers'));await assert.rejects(core.list('products'));await assert.rejects(core.list('customers',1));
});
test('restored current account uses server result and logout invalidates existing controller',async()=>{
 const {core,deps}=fixture();await core.login('normal','secret');const writer=core.create('customers');const fresh=createDesktopWriteGreenCore(deps);assert.equal((await fresh.restore()).username,'normal');await core.logout();
 await assert.rejects(writer.create({customerCode:'A',name:'Ada',phone:'555',customerType:'customer',currency:'TRY',city:null,country:null}));
});

test('normal green-core facade restores durable product rejection fields and revokes draft access on logout',async()=>{
 const {deps}=fixture(['product.view','product.edit','supplier.view']);deps.richCards=true;
 const original=deps.fetch;deps.fetch=async(url,opts)=>{
  if(url.endsWith('/api/desktop-local/products')){const p=JSON.parse(opts.body),data=productRejectionOutcome(productRejectionRecord(p.requestId,'PRODUCT_BARCODE_IN_USE'),false);return {status:409,ok:false,json:async()=>({success:false,data,error:{code:data.reason}})};}
  return original(url,opts);
 };
 const core=createDesktopWriteGreenCore(deps);await core.login('normal','secret');
 const input={stockCode:'P1',name:'Ürün',brand:'B',category:'C',supplierId:'9',barcode:'0001',unit:'ADET',currency:'TRY',salePriceExact4:'12.0000',purchasePriceExact4:'8.0000',purchaseDiscountRateExact4:'0.0000',saleTier:null};
 const writer=core.create('products');assert.equal((await writer.create(input)).state,'NOT_COMMITTED');assert.equal(writer.pending(),null);assert.equal(writer.draft().supplierId,'9');
 const fresh=createDesktopWriteGreenCore(deps);await fresh.restore();const restored=fresh.create('products');assert.deepEqual(restored.draft(),{requestId:deps.newId(),...input});assert.equal(restored.rejected().reason,'PRODUCT_BARCODE_IN_USE');
 await fresh.logout();assert.throws(()=>restored.draft());assert.throws(()=>restored.rejected());
});
test('foreign origin fails before dispatch',()=>{const {deps}=fixture();deps.location.origin='https://example.com';assert.throws(()=>createDesktopWriteGreenCore(deps));});
test('server search preserves Turkish text and leading-zero product/customer codes',async()=>{
 const {core,calls}=fixture();await core.login('normal','secret');await core.list('customers',2,'0089 Şule');assert.match(calls.at(-1).url,/search=0089%20%C5%9Eule$/);await assert.rejects(core.list('customers',2,'bad\nquery'));
});

test('supplier creation and rich product require supplier view as well as edit authority',async()=>{
 const a=fixture(['supplier.edit','product.edit']);const core=createDesktopWriteGreenCore({...a.deps,richCards:true});await core.login('normal','secret');const supplier=core.create('suppliers');await assert.rejects(supplier.create({supplierCode:'S',name:'N',phone:'1',city:'A',country:'B',currency:'TRY',purchaseDiscountRateExact4:'0.0000'}));const product=core.create('products');await assert.rejects(product.create({stockCode:'P',name:'N',barcode:'1',unit:'ADET',currency:'TRY',salePriceExact4:'1.0000',purchasePriceExact4:'1.0000',purchaseDiscountRateExact4:'0.0000',saleTier:null,brand:'B',category:'C',supplierId:'1'}));assert.equal(a.calls.filter(x=>x.url.includes('desktop-local')).length,0);
});
