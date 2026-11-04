import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createBusinessSalesRead,businessSaleRateDisplay} from './workBusinessSalesRead.mjs';
import {saleReadActor,saleReadCustomer,saleReadProduct,saleReadCustomerList,saleReadCatalog,saleReadSelection,saleNativeActor,saleNativeResult,saleNativeInvoice} from './workBusinessSalesRead.test-fixture.mjs';
const tick=()=>new Promise(r=>setImmediate(r)),settle=async()=>{await tick();await tick();},event=()=>({preventDefault(){}});
function dom(){let html='',nodes=new Map();const make=key=>{if(!nodes.has(key)){const node={isConnected:true,elements:{search:{value:''}},dataset:{},innerHTML:'',value:'',addEventListener(e,f){this['on'+e]=f;},querySelector:k=>make(key+k),querySelectorAll:()=>[]};nodes.set(key,node);}return nodes.get(key);};const root={isConnected:true,querySelector:make,querySelectorAll(selector){const field=selector.slice(1,-1),key=field.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return [...html.matchAll(new RegExp(field+'="([^"]*)"','g'))].map(m=>{const n=make(selector+m[1]);n.dataset[key]=m[1];return n;});}};Object.defineProperty(root,'innerHTML',{get:()=>html,set:v=>{html=v;for(const n of nodes.values())n.isConnected=false;nodes=new Map();}});return {root,node:make};}
function fixture(overrides={},actor=saleReadActor(),journal=null,readOptions={}){const d=dom(),calls=[],navigation=[],session={customers:async(path,options)=>{calls.push({kind:'customers',path,options});return path.includes('/card')?saleReadCustomer():saleReadCustomerList();},api:async(path,options)=>{calls.push({kind:'catalog',path,options});return path.includes('?')?saleReadCatalog():saleReadCatalog(saleReadProduct(),{detail:true});},businessSaleSelection:async query=>{calls.push({kind:'selection',query});return saleReadSelection(query);},work(){assert.fail('No trade API is allowed in the read controller');},media(){assert.fail('Missing-photo fixtures must not download media');},...overrides};const ui=createBusinessSalesRead({root:d.root,session,user:actor,navigate:p=>navigation.push(p),journal,...readOptions});return {...d,ui,calls,session,navigation};}
async function choose(d,{currency='USD'}={}){d.node('[data-bsr-customer]').onchange({target:{value:'155'}});await settle();d.node('[data-bsr-account]').onchange({target:{value:currency==='USD'?'7':'8'}});const form=d.node('[data-bsr-product-search]');form.elements.search.value='0000120000';form.onsubmit(event());await settle();d.node('[data-bsr-price]').onchange({target:{value:currency==='USD'?'81':'82'}});}
function deviceBasketStorage(){const values=new Map(),writes=[],locks={request:async(_k,_o,fn)=>fn()};return {values,writes,locks,storage:{getItem:k=>values.get(k)??null,setItem(k,v){writes.push(k);values.set(k,v);},removeItem(k){writes.push(k);values.delete(k);}}};}
function savedBasketReads(p={...saleReadProduct(),stockQuantityExact:'8.00000000'}){return {api:async path=>path.includes('?')?saleReadCatalog([p]):saleReadCatalog(p,{detail:true}),businessSaleSelection:async q=>saleReadSelection(q,{product:p})};}
async function fillSavedBasket(d){d.ui.mount();await settle();await choose(d);await d.node('[data-bsr-check]').onclick();d.node('[data-bsr-quantity]').oninput({target:{value:'2'}});d.node('[data-bsr-add]').onclick();d.node('[data-bsr-native-date]').onchange({target:{value:'2026-11-02'}});}
test('actual sales screen saves a two-product device basket, reopens after reload and still requires fresh checkout',async()=>{
 const disk=deviceBasketStorage(),p={...saleReadProduct(),stockQuantityExact:'8.00000000'},second={...saleReadProduct(),stockQuantityExact:'8.00000000'};second.id='13';second.stockCode='0013 MARKA';second.displayCode='0013';second.productName='İkinci sentetik ürün';second.barcode='0000130000';second.barcodes=[{...second.barcodes[0],id:'73',value:second.barcode}];second.provenance.sourceKey=second.provenance.sourceKey.replace('/12','/13');second.salePrices=second.salePrices.map(q=>({...q,id:q.currency==='USD'?'83':'84',sourceKey:q.sourceKey.replace('/12/','/13/')}));
 const reads={api:async path=>path.includes('?')?saleReadCatalog([path.includes(second.barcode)?second:p]):saleReadCatalog(path.includes('/13')?second:p,{detail:true}),businessSaleSelection:async q=>saleReadSelection(q,{product:q.productId==='13'?second:p})};
 const d=fixture(reads,saleReadActor(),null,{basketStorage:disk.storage,basketLocks:disk.locks});await fillSavedBasket(d);const search=d.node('[data-bsr-product-search]');search.elements.search.value=second.barcode;search.onsubmit(event());await settle();d.node('[data-bsr-price]').onchange({target:{value:'83'}});await d.node('[data-bsr-check]').onclick();d.node('[data-bsr-quantity]').oninput({target:{value:'1'}});d.node('[data-bsr-add]').onclick();assert(d.root.innerHTML.includes('data-bsr-basket-quantity="13:83:9:1"'),JSON.stringify(d.root.innerHTML.match(/<p[^>]*>(?:[^<]|<(?!\/p>))*<\/p>/g)));assert.equal(d.ui.requestClose(),false);await d.node('[data-bsr-basket-save]').onclick();assert.match(d.root.innerHTML,/Sepet bu cihazda saklandı/);assert.equal(d.ui.requestClose(),true);assert.equal(disk.writes.length,1);d.ui.dispose();
 const fresh=fixture(reads,saleReadActor(),null,{basketStorage:disk.storage,basketLocks:disk.locks});fresh.ui.mount();await settle();assert.match(fresh.root.innerHTML,/Saklanan sepeti aç/);assert.doesNotMatch(fresh.root.innerHTML,/data-bsr-basket-quantity=/);await fresh.node('[data-bsr-basket-restore]').onclick();assert.match(fresh.root.innerHTML,/0012 MARKA/);assert.match(fresh.root.innerHTML,/0013 MARKA/);assert.match(fresh.root.innerHTML,/quantity="12:81:9:1"/);assert.match(fresh.root.innerHTML,/quantity="13:83:9:1"/);assert.match(fresh.root.innerHTML,/Sepet açıldı/);assert.match(fresh.root.innerHTML,/Önizleme için|önizlemesinden önce/);assert.equal(disk.writes.length,1);assert(fresh.calls.every(c=>c.kind!=='work'));fresh.ui.dispose();
});
test('customer list loading blocks even a retained restore handler, then restores the correct customer after success or failure',async()=>{
 for(const outcome of ['success','error','dispose']){
  const disk=deviceBasketStorage(),journal={read:()=>null,done(){assert.fail('No journal write');}},options={basketStorage:disk.storage,basketLocks:disk.locks};
  const initial=fixture(savedBasketReads(),saleReadActor(),journal,options);await fillSavedBasket(initial);await initial.node('[data-bsr-basket-save]').onclick();initial.ui.dispose();
  const saved=[...disk.values.entries()],writes=disk.writes.length;let listCalls=0,cardCalls=0,finish,fail;
  const current=fixture({...savedBasketReads(),customers:async path=>{
   if(path.includes('/card')){cardCalls++;return saleReadCustomer();}
   if(++listCalls===1)return saleReadCustomerList();
   return new Promise((resolve,reject)=>{finish=resolve;fail=reject;});
  }},saleReadActor(),journal,options);
  current.ui.mount();await settle();const oldRestore=current.node('[data-bsr-basket-restore]').onclick;
  current.node('[data-bsr-refresh]').onclick();assert.match(current.root.innerHTML,/data-bsr-basket-restore disabled/);
  await oldRestore();assert.equal(cardCalls,0);assert.equal(disk.writes.length,writes);assert.deepEqual([...disk.values.entries()],saved);
  if(outcome==='dispose'){
   current.ui.dispose();const before=current.root.innerHTML;finish(saleReadCustomerList([]));await settle();await oldRestore();
   assert.equal(current.root.innerHTML,before);assert.equal(cardCalls,0);
  }else{
   if(outcome==='error')fail(Error('synthetic list failure'));else finish(saleReadCustomerList([]));
   await settle();assert.doesNotMatch(current.root.innerHTML,/data-bsr-basket-restore disabled/);
   await current.node('[data-bsr-basket-restore]').onclick();assert.equal(cardCalls,1);
   assert.match(current.root.innerHTML,/<option value="155" selected>/);assert.match(current.root.innerHTML,/Sentetik müşteri/);assert.match(current.root.innerHTML,/data-bsr-basket-quantity="12:81:9:1"/);
   assert.equal(disk.writes.length,writes);assert.deepEqual([...disk.values.entries()],saved);current.ui.dispose();
  }
 }
});
test('a retained customer selector cannot unlock basket restore before a delayed customer list settles',async()=>{
 for(const selected of ['', '155']){
  const disk=deviceBasketStorage(),journal={read:()=>null,done(){assert.fail('No journal write');}},options={basketStorage:disk.storage,basketLocks:disk.locks};
  const initial=fixture(savedBasketReads(),saleReadActor(),journal,options);await fillSavedBasket(initial);await initial.node('[data-bsr-basket-save]').onclick();initial.ui.dispose();
  let listCalls=0,cardCalls=0,finish;const saved=[...disk.values.entries()],writes=disk.writes.length;
  const current=fixture({...savedBasketReads(),customers:async path=>{
   if(path.includes('/card')){cardCalls++;return saleReadCustomer();}
   if(++listCalls===1)return saleReadCustomerList();return new Promise(resolve=>{finish=resolve;});
  }},saleReadActor(),journal,options);
  current.ui.mount();await settle();const oldSelect=current.node('[data-bsr-customer]').onchange,oldRestore=current.node('[data-bsr-basket-restore]').onclick;
  current.node('[data-bsr-refresh]').onclick();oldSelect({target:{value:selected}});await settle();
  const before=cardCalls;assert.equal(before,selected?1:0);assert.match(current.root.innerHTML,/data-bsr-basket-restore disabled/);
  await oldRestore();assert.equal(cardCalls,before);assert.doesNotMatch(current.root.innerHTML,/data-bsr-basket-quantity=/);assert.deepEqual([...disk.values.entries()],saved);assert.equal(disk.writes.length,writes);
  finish(saleReadCustomerList([]));await settle();await current.node('[data-bsr-basket-restore]').onclick();
  assert.equal(cardCalls,before+1);assert.match(current.root.innerHTML,/<option value="155" selected>/);assert.match(current.root.innerHTML,/data-bsr-basket-quantity="12:81:9:1"/);assert.equal(disk.writes.length,writes);current.ui.dispose();
 }
});
test('a customer refresh invalidates a delayed saved-basket customer response without changing the journal or saved basket',async()=>{
 const disk=deviceBasketStorage(),journal={read:()=>null,done(){assert.fail('No journal write');}},options={basketStorage:disk.storage,basketLocks:disk.locks};
 const initial=fixture(savedBasketReads(),saleReadActor(),journal,options);await fillSavedBasket(initial);await initial.node('[data-bsr-basket-save]').onclick();initial.ui.dispose();
 const saved=[...disk.values.entries()],writes=disk.writes.length;let finish,selectionReads=0;
 const current=fixture({...savedBasketReads(),customers:async path=>path.includes('/card')?new Promise(resolve=>{finish=resolve;}):saleReadCustomerList([]),businessSaleSelection:async()=>{selectionReads++;throw Error('Unexpected selection read');}},saleReadActor(),journal,options);
 current.ui.mount();await settle();const restoring=current.node('[data-bsr-basket-restore]').onclick();await tick();assert.equal(typeof finish,'function');
 current.node('[data-bsr-refresh]').onclick();await settle();finish(saleReadCustomer());await restoring;
 assert.doesNotMatch(current.root.innerHTML,/<option value="155" selected>|data-bsr-basket-quantity=/);assert.equal(selectionReads,0);assert.equal(disk.writes.length,writes);assert.deepEqual([...disk.values.entries()],saved);current.ui.dispose();
});
test('changed source price, pending operation and another tab revoke restore without replacing saved basket or journal',async()=>{
 for(const change of ['price','pending','other-tab','dispose']){
  const disk=deviceBasketStorage(),d=fixture(savedBasketReads(),saleReadActor(),null,{basketStorage:disk.storage,basketLocks:disk.locks});await fillSavedBasket(d);await d.node('[data-bsr-basket-save]').onclick();const [key,raw]=[...disk.values][0];d.ui.dispose();let release;
  const p={...saleReadProduct(),stockQuantityExact:'8.00000000'};if(change==='price')p.salePrices[0].priceExact='3.00000000';
  const next=fixture({businessSaleSelection:q=>['other-tab','dispose'].includes(change)?new Promise(r=>{release=()=>r(saleReadSelection(q,{product:p}));}):saleReadSelection(q,{product:p})},saleReadActor(),change==='pending'?{read:()=>({status:'pending'})}:null,{basketStorage:disk.storage,basketLocks:disk.locks});next.ui.mount();await settle();const attempt=next.node('[data-bsr-basket-restore]').onclick();await settle();
  if(release){if(change==='other-tab')disk.values.set(key,raw+' ');else next.ui.dispose();const before=next.root.innerHTML;release();await attempt;if(change==='dispose')assert.equal(next.root.innerHTML,before);}else await attempt;
  assert.doesNotMatch(next.root.innerHTML,/data-bsr-basket-quantity=/);assert.equal(disk.writes.length,1);assert.equal(disk.values.get(key),change==='other-tab'?raw+' ':raw);if(change!=='dispose'){assert.match(next.root.innerHTML,/Saklanan sepet açılamadı/);next.ui.dispose();}
 }
});
test('device save failure retains unsaved navigation warning and never clears a native journal',async()=>{
 const disk=deviceBasketStorage(),d=fixture(savedBasketReads(),saleReadActor(),{read:()=>null,done(){assert.fail('No journal mutation');}},{basketStorage:{...disk.storage,setItem(){throw Error('quota');}},basketLocks:disk.locks});await fillSavedBasket(d);await d.node('[data-bsr-basket-save]').onclick();assert.match(d.root.innerHTML,/Sepet saklanamadı/);assert.equal(d.ui.requestClose(),false);assert.equal(disk.values.size,0);d.ui.dispose();
});
test('disposed reader and disposed queued browser-lock callback cannot save, remove or fetch a device basket',async()=>{
 const disk=deviceBasketStorage(),d=fixture(savedBasketReads(),saleReadActor(),null,{basketStorage:disk.storage,basketLocks:disk.locks});await fillSavedBasket(d);await d.node('[data-bsr-basket-save]').onclick();const save=d.node('[data-bsr-basket-save]').onclick,forget=d.node('[data-bsr-basket-forget]').onclick,restore=d.node('[data-bsr-basket-restore]').onclick,writes=disk.writes.length,calls=d.calls.length;d.ui.dispose();await save();await forget();await restore();assert.equal(disk.writes.length,writes);assert.equal(d.calls.length,calls);
 let run;const queued={request:(_k,_o,fn)=>new Promise((resolve,reject)=>{run=()=>Promise.resolve().then(fn).then(resolve,reject);})},other=fixture(savedBasketReads(),saleReadActor(),null,{basketStorage:disk.storage,basketLocks:queued});await fillSavedBasket(other);const pending=other.node('[data-bsr-basket-save]').onclick();other.ui.dispose();try{run();}catch{}await pending;assert.equal(disk.writes.length,writes);
});
test('explicit forget removes only the device preparation and leaves the live basket and native journal unchanged',async()=>{
 const disk=deviceBasketStorage(),d=fixture(savedBasketReads(),saleReadActor(),{read:()=>null,done(){assert.fail('No native journal writes');}},{basketStorage:disk.storage,basketLocks:disk.locks});await fillSavedBasket(d);await d.node('[data-bsr-basket-save]').onclick();await d.node('[data-bsr-basket-forget]').onclick();assert.equal(disk.values.size,0);assert.equal(disk.writes.length,2);assert.match(d.root.innerHTML,/Yalnız bu cihazdaki saklanan sepet kaldırıldı/);assert.match(d.root.innerHTML,/data-bsr-basket-quantity="12:81:9:1"/);assert.equal(d.ui.requestClose(),false);d.ui.dispose();
});
test('initial read loads only customer names, preserves explicit account/tier selection and has no trade controls',async()=>{
 const d=fixture();d.ui.mount();await settle();assert.equal(d.calls.length,1);assert.match(d.calls[0].path,/^\/api\/customer-cards\?/);assert.match(d.root.innerHTML,/Müşteri adı|Barkodu okutun|Satış kaydetme henüz açık değil/);assert.doesNotMatch(d.root.innerHTML,/data-sale-draft|data-sale-finalize|data-sale-collect|TEST|SQL|PASS|migration/);
 await choose(d);await d.node('[data-bsr-check]').onclick();assert.deepEqual(d.calls.find(c=>c.kind==='selection').query,{customerId:'155',accountId:'7',currency:'USD',productId:'12',priceId:'81',unitSourceId:'9',tier:'1'});assert.match(d.root.innerHTML,/Müşteri hesabı ve fiyat bilgileri eşleşti/);assert.match(d.root.innerHTML,/0012 MARKA|0000120000|0000120001|2,12 USD|Müşterinin alacağı/);assert.match(d.calls.find(c=>c.kind==='catalog').path,/barcode=0000120000/);assert(d.calls.filter(c=>c.kind==='catalog'||c.kind==='customers'&&!c.path.endsWith('/card')).every(c=>c.options.envelope===true));assert.equal(d.ui.requestClose(),true);d.ui.dispose();
});
test('customer name search and code search use the existing sizes; paging follows exact response pages',async()=>{
 const d=fixture();d.ui.mount();await settle();const customerForm=d.node('[data-bsr-customer-search]');customerForm.elements.search.value='İsim';customerForm.onsubmit(event());await settle();assert(d.calls.some(c=>c.path?.includes('search=%C4%B0sim')&&c.path.includes('limit=25')));const productForm=d.node('[data-bsr-product-search]');productForm.elements.search.value='0012 MARKA';d.node('[data-bsr-code]').onclick();await settle();assert(d.calls.some(c=>c.kind==='catalog'&&c.path.includes('search=0012+MARKA')&&c.path.includes('limit=50')));d.ui.dispose();
});
test('unknown or contradictory barcode never auto-opens a random product',async()=>{
 for(const result of [saleReadCatalog([]),saleReadCatalog([{...saleReadProduct(),barcodes:[]}])]){const d=fixture({api:async path=>{assert(path.includes('?'));return result;}});d.ui.mount();await settle();const form=d.node('[data-bsr-product-search]');form.elements.search.value='0000120000';form.onsubmit(event());await settle();assert.match(d.root.innerHTML,/ürün bulunamadı|barkod ürün kartında doğrulanamadı/);assert.doesNotMatch(d.root.innerHTML,/data-bsr-price/);d.ui.dispose();}
});
test('changing account revokes an in-flight selection; EUR never reuses the USD account or quote',async()=>{
 let finish;const d=fixture({businessSaleSelection:async query=>{d.calls.push({kind:'selection',query});return query.currency==='USD'?new Promise(r=>finish=r):saleReadSelection(query);}});d.ui.mount();await settle();await choose(d);const pending=d.node('[data-bsr-check]').onclick();await tick();d.node('[data-bsr-account]').onchange({target:{value:'8'}});d.node('[data-bsr-price]').onchange({target:{value:'82'}});finish(saleReadSelection({customerId:'155',accountId:'7',currency:'USD',productId:'12',priceId:'81',unitSourceId:'9',tier:'1'}));await pending;assert.doesNotMatch(d.root.innerHTML,/Müşteri hesabı ve fiyat bilgileri eşleşti/);await d.node('[data-bsr-check]').onclick();assert.deepEqual(d.calls.filter(c=>c.kind==='selection').at(-1).query,{customerId:'155',accountId:'8',currency:'EUR',productId:'12',priceId:'82',unitSourceId:'9',tier:'2'});assert.match(d.root.innerHTML,/Müşteri hesabı ve fiyat bilgileri eşleşti/);d.ui.dispose();
});
test('a changed price behind the same quote ID is not silently accepted as the displayed price',async()=>{
 const p=saleReadProduct();p.salePrices[0].priceExact='3.00000000';const d=fixture({businessSaleSelection:async query=>saleReadSelection(query,{product:p})});d.ui.mount();await settle();await choose(d);await d.node('[data-bsr-check]').onclick();assert.match(d.root.innerHTML,/Hesap, stok veya fiyat değişti/);assert.doesNotMatch(d.root.innerHTML,/Müşteri hesabı ve fiyat bilgileri eşleşti/);d.ui.dispose();
});
test('unknown stock and zero price remain blocked; refresh rereads cards and never saves anything',async()=>{
 const p=saleReadProduct();p.stockQuantityExact=null;p.salePrices[0].priceExact='0.00000000';const d=fixture({api:async path=>path.includes('?')?saleReadCatalog([p]):saleReadCatalog(p,{detail:true}),businessSaleSelection:async query=>saleReadSelection(query,{product:p})});d.ui.mount();await settle();await choose(d);await d.node('[data-bsr-check]').onclick();assert.match(d.root.innerHTML,/Stok miktarı bilinmiyor|Bu fiyatla satış hazırlığı yapılamaz/);assert.doesNotMatch(d.root.innerHTML,/Müşteri hesabı ve fiyat bilgileri eşleşti/);const before=d.calls.length;d.ui.refresh();await settle();assert(d.calls.length>before);assert.doesNotMatch(d.root.innerHTML,/Müşteri hesabı ve fiyat bilgileri eşleşti/);d.ui.dispose();
});
test('late result after disposal cannot update or persist the read selection',async()=>{
 let finish;const d=fixture({businessSaleSelection:query=>new Promise(r=>finish=()=>r(saleReadSelection(query)))});d.ui.mount();await settle();await choose(d);const pending=d.node('[data-bsr-check]').onclick();await tick();const before=d.root.innerHTML;d.ui.dispose();finish();await pending;assert.equal(d.root.innerHTML,before);
});
test('normal sales controller enters the reader only on explicit business scope rejection; it never mutates saved drafts',async()=>{
 let source=await readFile(new URL('./workSales.js',import.meta.url),'utf8');source=source.replace(/^import ['"]\.\/[^'"]+\.css['"];\s*$/gm,'').replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,import.meta.url).href));const {createWorkSales}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const d=dom(),calls=[],values=new Map([['saved-draft','preserve']]);const session=fixture().session;session.work=async(path,options)=>{calls.push({path,options});throw {status:403,code:'BUSINESS_WORKFACE_SCOPE_UNAVAILABLE'};};const ui=createWorkSales({root:d.root,user:saleReadActor(),session,storage:{getItem:k=>values.get(k)??null,setItem(){assert.fail('No draft write');},removeItem(){assert.fail('No draft removal');}}});ui.mount();await settle();assert.match(d.root.innerHTML,/data-business-sales-read/);assert.match(d.node('[data-business-sales-read]').innerHTML,/Müşteri ve hesap/);assert.deepEqual(calls,[{path:'/api/work-sales/context',options:undefined}]);assert.equal(values.get('saved-draft'),'preserve');assert.equal(ui.requestClose(),true);ui.dispose();
});

test('read-only basket keeps exact account, whole quantity and product-only totals without trade writes',async()=>{
 const product=saleReadProduct();product.stockQuantityExact='8.00000000';const d=fixture({api:async path=>path.includes('?')?saleReadCatalog([product]):saleReadCatalog(product,{detail:true}),businessSaleSelection:async q=>{d.calls.push({kind:'selection',query:q});return saleReadSelection(q,{product});}});
 d.ui.mount();await settle();await choose(d);await d.node('[data-bsr-check]').onclick();d.node('[data-bsr-quantity]').oninput({target:{value:'3'}});d.node('[data-bsr-add]').onclick();assert.match(d.root.innerHTML,/Ürün toplamı: <b>6,37 USD/);assert.match(d.root.innerHTML,/Fatura tutarı henüz hesaplanmadı/);assert.equal(d.ui.requestClose(),false);
 d.node('[data-bsr-account]').onchange({target:{value:'8'}});assert.match(d.root.innerHTML,/Hesap değiştirmeden önce sepeti temizleyin/);assert.match(d.root.innerHTML,/6,37 USD/);
 await d.node('[data-bsr-basket-check]').onclick();assert.match(d.root.innerHTML,/Ürün ve hesap bilgileri kontrol edildi/);assert(d.calls.filter(c=>c.kind==='selection').every(c=>c.query.accountId==='7'&&c.query.currency==='USD'));
 d.node('[data-bsr-basket-clear]').onclick();assert.equal(d.ui.requestClose(),true);assert.doesNotMatch(d.root.innerHTML,/6,37 USD/);d.ui.dispose();
});
test('insufficient stock, zero and fractional quantities never create a basket line',async()=>{
 const product=saleReadProduct();product.stockQuantityExact='2.00000000';const d=fixture({api:async path=>path.includes('?')?saleReadCatalog([product]):saleReadCatalog(product,{detail:true}),businessSaleSelection:async q=>saleReadSelection(q,{product})});d.ui.mount();await settle();await choose(d);await d.node('[data-bsr-check]').onclick();
 for(const value of ['0','1.5','3']){d.node('[data-bsr-quantity]').oninput({target:{value}});d.node('[data-bsr-add]').onclick();assert.match(d.root.innerHTML,/Pozitif tam adet ve kullanılabilir stok/);assert.doesNotMatch(d.root.innerHTML,/data-bsr-basket-remove=/);}
 d.ui.dispose();
});
test('basket revalidation rejects a changed server price and preserves the existing line without saving',async()=>{
 const product=saleReadProduct();product.stockQuantityExact='8.00000000';const d=fixture({api:async path=>path.includes('?')?saleReadCatalog([product]):saleReadCatalog(product,{detail:true}),businessSaleSelection:async q=>saleReadSelection(q,{product})});d.ui.mount();await settle();await choose(d);await d.node('[data-bsr-check]').onclick();d.node('[data-bsr-quantity]').oninput({target:{value:'1'}});d.node('[data-bsr-add]').onclick();product.salePrices[0].priceExact='9.00000000';await d.node('[data-bsr-basket-check]').onclick();assert.match(d.root.innerHTML,/bilgisi değişmiş ya da okunamadı/);assert.doesNotMatch(d.root.innerHTML,/bilgileri kontrol edildi/);assert.match(d.root.innerHTML,/2,12 USD/);d.ui.dispose();
});
test('late basket verification cannot restore success after the user changes the product search',async()=>{
 const product=saleReadProduct();product.stockQuantityExact='8.00000000';let finish,defer=false;const d=fixture({api:async path=>path.includes('?')?saleReadCatalog([product]):saleReadCatalog(product,{detail:true}),businessSaleSelection:async q=>defer?new Promise(r=>{finish=()=>r(saleReadSelection(q,{product}));}):saleReadSelection(q,{product})});d.ui.mount();await settle();await choose(d);await d.node('[data-bsr-check]').onclick();d.node('[data-bsr-add]').onclick();defer=true;const pending=d.node('[data-bsr-basket-check]').onclick();await tick();const form=d.node('[data-bsr-product-search]');form.elements.search.value='başka ürün';d.node('[data-bsr-code]').onclick();await settle();finish();await pending;assert.match(d.root.innerHTML,/sepeti yeniden kontrol edin/);assert.doesNotMatch(d.root.innerHTML,/Ürün ve hesap bilgileri kontrol edildi/);assert.match(d.root.innerHTML,/data-bsr-basket-remove=/);d.ui.dispose();
});
test('a later single-product drift invalidates previously checked basket status',async()=>{
 const product=saleReadProduct();product.stockQuantityExact='8.00000000';const changed=structuredClone(product);changed.salePrices[0].priceExact='9.00000000';let drift=false;const d=fixture({api:async path=>path.includes('?')?saleReadCatalog([product]):saleReadCatalog(product,{detail:true}),businessSaleSelection:async q=>saleReadSelection(q,{product:drift?changed:product})});d.ui.mount();await settle();await choose(d);await d.node('[data-bsr-check]').onclick();d.node('[data-bsr-add]').onclick();await d.node('[data-bsr-basket-check]').onclick();assert.match(d.root.innerHTML,/Ürün ve hesap bilgileri kontrol edildi/);drift=true;await d.node('[data-bsr-check]').onclick();assert.match(d.root.innerHTML,/Hesap, stok veya fiyat değişti/);assert.match(d.root.innerHTML,/sepeti yeniden kontrol edin/);assert.doesNotMatch(d.root.innerHTML,/Ürün ve hesap bilgileri kontrol edildi/);d.ui.dispose();
});
test('an unsaved basket warns on browser reload and unregisters the warning on dispose',async()=>{
 const previous=globalThis.window,listeners=new Map();globalThis.window={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}};const product=saleReadProduct();product.stockQuantityExact='8.00000000';const d=fixture({api:async path=>path.includes('?')?saleReadCatalog([product]):saleReadCatalog(product,{detail:true}),businessSaleSelection:async q=>saleReadSelection(q,{product})});try{d.ui.mount();await settle();await choose(d);await d.node('[data-bsr-check]').onclick();d.node('[data-bsr-add]').onclick();let prevented=false;const event={preventDefault(){prevented=true;},returnValue:undefined};listeners.get('beforeunload')(event);assert.equal(prevented,true);assert.equal(event.returnValue,'');d.ui.dispose();assert.equal(listeners.has('beforeunload'),false);}finally{globalThis.window=previous;}
});
test('single-product and basket checks cannot race into a stale successful basket',async()=>{
 const product=saleReadProduct();product.stockQuantityExact='8.00000000';const changed=structuredClone(product);changed.salePrices[0].priceExact='9.00000000';let defer=false,finish,calls=0;const d=fixture({api:async path=>path.includes('?')?saleReadCatalog([product]):saleReadCatalog(product,{detail:true}),businessSaleSelection:async q=>{calls++;return defer?new Promise(r=>{finish=()=>r(saleReadSelection(q,{product:changed}));}):saleReadSelection(q,{product});}});d.ui.mount();await settle();await choose(d);await d.node('[data-bsr-check]').onclick();d.node('[data-bsr-add]').onclick();await d.node('[data-bsr-basket-check]').onclick();assert.match(d.root.innerHTML,/Ürün ve hesap bilgileri kontrol edildi/);defer=true;const pending=d.node('[data-bsr-check]').onclick();await tick();assert.match(d.root.innerHTML,/data-bsr-basket-check disabled/);const before=calls;await d.node('[data-bsr-basket-check]').onclick();assert.equal(calls,before);finish();await pending;assert.match(d.root.innerHTML,/sepeti yeniden kontrol edin/);assert.doesNotMatch(d.root.innerHTML,/Ürün ve hesap bilgileri kontrol edildi/);d.ui.dispose();
});
test('a basket check disables and guards a parallel single-product check',async()=>{
 const product=saleReadProduct();product.stockQuantityExact='8.00000000';let defer=false,finish,calls=0;const d=fixture({api:async path=>path.includes('?')?saleReadCatalog([product]):saleReadCatalog(product,{detail:true}),businessSaleSelection:async q=>{calls++;return defer?new Promise(r=>{finish=()=>r(saleReadSelection(q,{product}));}):saleReadSelection(q,{product});}});d.ui.mount();await settle();await choose(d);await d.node('[data-bsr-check]').onclick();d.node('[data-bsr-add]').onclick();defer=true;const pending=d.node('[data-bsr-basket-check]').onclick();await tick();assert.match(d.root.innerHTML,/data-bsr-check disabled/);const before=calls;await d.node('[data-bsr-check]').onclick();assert.equal(calls,before);finish();await pending;assert.match(d.root.innerHTML,/Ürün ve hesap bilgileri kontrol edildi/);d.ui.dispose();
});
function nativeFixture(preview){
 const product=saleReadProduct();product.stockQuantityExact='8.00000000';
 return fixture({api:async path=>path.includes('?')?saleReadCatalog([product]):saleReadCatalog(product,{detail:true}),businessSaleSelection:async q=>saleReadSelection(q,{product}),businessSalePreview:preview},saleNativeActor());
}
test('exchange-rate presentation preserves eight decimal digits without changing money formatting',()=>{
 for(const [input,expected] of [['32.12345678','32,12345678'],['0.00000001','0,00000001'],['1.00000000','1,00000000'],['1234.50000000','1.234,50000000'],['0.00000000','0,00000000']])assert.equal(businessSaleRateDisplay(input),expected);
 for(const invalid of [null,undefined,'','-1.00000000','1.1','1.000000001','01.00000000','1.00000000\n',1])assert.equal(businessSaleRateDisplay(invalid),'Bilinmiyor');
});
async function nativeBasket(d){
 d.ui.mount();await settle();await choose(d);await d.node('[data-bsr-check]').onclick();d.node('[data-bsr-quantity]').oninput({target:{value:'2'}});d.node('[data-bsr-add]').onclick();await d.node('[data-bsr-basket-check]').onclick();d.node('[data-bsr-native-date]').onchange({target:{value:'2026-10-28'}});
}
test('normal business basket shows only verified native preview and keeps draft/save permanently disabled',async()=>{
 const calls=[],d=nativeFixture(async s=>{calls.push(s);return saleNativeResult(s);});await nativeBasket(d);await d.node('[data-bsr-native-preview]').onclick();
 assert.deepEqual(calls,[{customerId:'155',customerAccountId:'7',documentDate:'2026-10-28',currency:'USD',items:[{productId:'12',quoteId:'81',quantityExact3:'2.000'}]}]);
 assert.match(d.root.innerHTML,/Satış önizlemesi doğrulandı/);assert.match(d.root.innerHTML,/4,25.*USD|4,247/);assert.match(d.root.innerHTML,/data-bsr-native-save disabled/);assert.equal(d.node('[data-bsr-native-save]').onclick,undefined);assert.doesNotMatch(d.root.innerHTML,/data-sale-draft|data-sale-finalize|data-sale-cancel/);
 d.node('[data-bsr-native-date]').onchange({target:{value:'2026-10-29'}});assert.doesNotMatch(d.root.innerHTML,/Satış toplamı:/);d.ui.dispose();
});
test('verified sales preview shows the exact source exchange rate and monetary totals to two decimals',async()=>{
 const d=nativeFixture(async selection=>{
  const r=saleNativeResult(selection),rate='32.12345678';
  r.context.rate.rateExact8=rate;r.preview.settlement.documentRateExact8=rate;r.preview.settlement.accountRateExact8=rate;
  const scaled=(42470n*3212345678n+50000000n)/100000000n;
  r.preview.amountTryExact4=(scaled/10000n)+'.'+(scaled%10000n).toString().padStart(4,'0');return r;
 });
 await nativeBasket(d);await d.node('[data-bsr-native-preview]').onclick();
 assert.match(d.root.innerHTML,/Kur: 32,12345678/);assert.match(d.root.innerHTML,/Satış toplamı: <b>4,25 USD/);assert.match(d.root.innerHTML,/TL karşılığı: 136,43 TRY/);assert.match(d.root.innerHTML,/data-bsr-native-save disabled/);d.ui.dispose();
});
test('native preview failures and a late response after date change never leave a verified amount or writable control',async()=>{
 let finish;const d=nativeFixture(s=>new Promise(r=>{finish=()=>r(saleNativeResult(s));}));await nativeBasket(d);const pending=d.node('[data-bsr-native-preview]').onclick();await tick();d.node('[data-bsr-native-date]').onchange({target:{value:'2026-10-29'}});finish();await pending;assert.doesNotMatch(d.root.innerHTML,/Satış toplamı:|Satış önizlemesi doğrulandı/);assert.match(d.root.innerHTML,/data-bsr-native-save disabled/);d.ui.dispose();
 const failed=nativeFixture(async s=>{const r=saleNativeResult(s);r.preview.amountTryExact4='1.0000';return r;});await nativeBasket(failed);await failed.node('[data-bsr-native-preview]').onclick();assert.match(failed.root.innerHTML,/Satış önizlemesi doğrulanamadı/);assert.doesNotMatch(failed.root.innerHTML,/Satış toplamı:/);assert.match(failed.root.innerHTML,/data-bsr-native-save disabled/);failed.ui.dispose();
});

const journalActor=()=>({...saleNativeActor(),permissions:[...saleNativeActor().permissions,'finance.view','sales.finalize','sales.cancel']});
const ownedPending=()=>({version:1,status:'pending',path:'/api/work-sales/drafts',body:{requestId:'00000000-0000-4000-8000-000000000001'}});
function readonlyJournal(){let reads=0;return {get reads(){return reads;},read(){reads++;return ownedPending();},begin(){assert.fail('Closed UI cannot begin');},done(){assert.fail('Read does not rewrite journal');},clear(){assert.fail('Read does not clear');}};}
test('normal UI explicitly reads the existing journal only and displays a witnessed draft with every mutation closed',async()=>{
 const journal=readonlyJournal(),calls=[],d=fixture({businessSalePreview:async s=>saleNativeResult(s),businessSaleRequest:async(q,p)=>{calls.push({q,p});return {invoice:saleNativeInvoice(),requestId:p.body.requestId,operation:'sale_draft',replayed:false};}},journalActor(),journal);d.ui.mount();await settle();assert.equal(journal.reads,0);await choose(d);assert.equal(calls.length,0);
 await d.node('[data-bsr-last-request]').onclick();assert.equal(journal.reads,2);assert.equal(calls.length,1);assert.equal(calls[0].q.accountId,'7');assert.match(d.root.innerHTML,/Son kaydın fişi doğrulandı|SYNTHETIC-RECEIPT/);assert.match(d.root.innerHTML,/data-business-sale-finalize disabled/);assert.match(d.root.innerHTML,/data-business-sale-cancel disabled/);assert.match(d.root.innerHTML,/data-bsr-native-save disabled/);
 for(const selector of ['[data-business-sale-finalize]','[data-business-sale-cancel]','[data-bsr-native-save]'])assert.equal(d.node(selector).onclick,undefined);assert.doesNotMatch(d.root.innerHTML,/data-sale-collect/);d.ui.dispose();
});
test('same-currency account switch revokes a late journal receipt; failures leave unknown state without retry or journal edits',async()=>{
 let finish;const journal=readonlyJournal(),c=saleReadCustomer();c.accounts.push({...c.accounts[0],accountId:'9'});c.accountCount=3;const d=fixture({customers:async path=>path.endsWith('/card')?c:saleReadCustomerList(),businessSaleRequest:(q,p)=>new Promise(resolve=>{finish=()=>resolve({invoice:saleNativeInvoice(),requestId:p.body.requestId,operation:'sale_draft'});})},journalActor(),journal);d.ui.mount();await settle();await choose(d);const pending=d.node('[data-bsr-last-request]').onclick();await tick();d.node('[data-bsr-account]').onchange({target:{value:'9'}});finish();await pending;assert.doesNotMatch(d.root.innerHTML,/SYNTHETIC-RECEIPT|Son kaydın fişi doğrulandı/);assert.equal(journal.reads,1);d.ui.dispose();
 const j=readonlyJournal(),g=fixture({businessSaleRequest:async()=>{throw {status:404};}},journalActor(),j);g.ui.mount();await settle();await choose(g);await g.node('[data-bsr-last-request]').onclick();assert.match(g.root.innerHTML,/Son işlem doğrulanamadı/);assert.doesNotMatch(g.root.innerHTML,/SYNTHETIC-RECEIPT/);assert.equal(j.reads,1);g.ui.dispose();
});

test('another tab replacing, deleting or invalidating the retained journal prevents publishing its late receipt without writing',async()=>{
 for(const changed of ['replace','missing','read-error']){
  let finish,state=ownedPending(),reads=0;const journal={read(){reads++;if(state==='invalid')throw Error('unreadable');return state;},begin(){assert.fail('No begin');},done(){assert.fail('No rewrite');},clear(){assert.fail('No clear');}},d=fixture({businessSaleRequest:(q,p)=>new Promise(resolve=>{finish=()=>resolve({invoice:saleNativeInvoice(),requestId:p.body.requestId,operation:'sale_draft'});})},journalActor(),journal);
  d.ui.mount();await settle();await choose(d);const pending=d.node('[data-bsr-last-request]').onclick();await tick();state=changed==='replace'?{...ownedPending(),status:'done',body:{requestId:'00000000-0000-4000-8000-000000000002'},invoiceWitness:{id:'52'},result:{requestId:'00000000-0000-4000-8000-000000000002'}}:changed==='missing'?null:'invalid';finish();await pending;assert.equal(reads,2);assert.match(d.root.innerHTML,/Son işlem doğrulanamadı/);assert.doesNotMatch(d.root.innerHTML,/SYNTHETIC-RECEIPT|Son kaydın fişi doğrulandı/);d.ui.dispose();
 }
});

test('receipt UI distinguishes only exact not-found status/code without retry, success or journal mutation',async()=>{
 for(const [status,code,classified] of [[404,'WORK_REQUEST_NOT_FOUND',true],[404,'OTHER_NOT_FOUND',false],[404,undefined,false],[401,'WORK_REQUEST_NOT_FOUND',false],[403,'WORK_REQUEST_NOT_FOUND',false],[500,'WORK_REQUEST_NOT_FOUND',false],[undefined,undefined,false]]){
  const journal=readonlyJournal(),bytes=JSON.stringify(journal.read()),calls=[],d=fixture({businessSaleRequest:async(q,p)=>{calls.push({q,p});throw Object.assign(new Error('read failed'),{status,code});}},journalActor(),journal);d.ui.mount();await settle();await choose(d);await d.node('[data-bsr-last-request]').onclick();
  assert.equal(calls.length,1);assert.equal(JSON.stringify(journal.read()),bytes);assert.equal(calls[0].p.body.requestId,ownedPending().body.requestId);assert.equal(calls[0].q.accountId,'7');assert.equal(journal.reads,3);
  if(classified){assert.match(d.root.innerHTML,/Bu isteğe bağlı kayıt bulunamadı/);assert.match(d.root.innerHTML,/Önceki deneme geçmişi korunuyor; yeniden kayıt gönderilmedi/);assert.doesNotMatch(d.root.innerHTML,/Son işlem doğrulanamadı/);}else{assert.match(d.root.innerHTML,/Son işlem doğrulanamadı/);assert.doesNotMatch(d.root.innerHTML,/Bu isteğe bağlı kayıt bulunamadı/);}
  assert.doesNotMatch(d.root.innerHTML,/Son kaydın fişi doğrulandı|SYNTHETIC-RECEIPT/);for(const selector of ['[data-bsr-native-save]','[data-business-sale-finalize]','[data-business-sale-cancel]'])assert.equal(d.node(selector).onclick,undefined);d.ui.dispose();
 }
});
