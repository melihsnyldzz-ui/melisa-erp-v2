import test from 'node:test';import assert from 'node:assert/strict';
import {mountDesktopProductCard} from './desktopProductCard.mjs';
import {productCardFixture} from '../../../api/src/services/test-fixtures/desktopProductCard.fixture.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('series display derives complete packs and remainder from physical ADET without inventing a series price',async()=>{const card=productCardFixture();card.currentStockExact3='61.500';card.units.push({id:'9',productId:'6',label:'SERİ',factorExact8:'6.00000000',isMain:false});const r=root();mountDesktopProductCard({root:r,productId:'6',load:async()=>card});await tick();assert.match(r.innerHTML,/61.500 ADET/);assert.match(r.innerHTML,/10 SERİ \+ 1.500 ADET/);assert.match(r.innerHTML,/Bir serideki adet/);assert.doesNotMatch(r.innerHTML,/SERİ fiyat/);});
function root(){let html='',paints=0,close;return {get innerHTML(){return html;},set innerHTML(v){html=v;paints++;},querySelector(){return {addEventListener:(_k,fn)=>{close=fn;}};},get paints(){return paints;},close(){close();}};}

test('physical, reserved and available quantities are separately labeled; missing legacy totals are unknown',async()=>{
 const card={...productCardFixture(),reservedExact3:'3.000',availableExact3:'-1.000'},r=root();mountDesktopProductCard({root:r,productId:'6',load:async()=>card});await tick();assert.match(r.innerHTML,/<dt>Fiziksel stok<\/dt><dd>2.000 ADET/);assert.match(r.innerHTML,/<dt>Rezerve stok<\/dt><dd>3.000 ADET/);assert.match(r.innerHTML,/<dt>Satılabilir stok<\/dt><dd>-1.000 ADET/);
 const old=root();mountDesktopProductCard({root:old,productId:'6',load:async()=>productCardFixture()});await tick();assert.match(old.innerHTML,/<dt>Rezerve stok<\/dt><dd>Bilinmiyor/);assert.match(old.innerHTML,/<dt>Satılabilir stok<\/dt><dd>Bilinmiyor/);
});
test('card displays exact barcode strings and escapes names',async()=>{
 const r=root(),card=productCardFixture();card.name='<script>bad</script>';let closed=0;mountDesktopProductCard({root:r,productId:'6',load:async()=>card,onClose:()=>closed++});await tick();assert.match(r.innerHTML,/000000000005/);assert.match(r.innerHTML,/000000000051/);assert.match(r.innerHTML,/Ana barkod/);assert.match(r.innerHTML,/Ek barkod/);assert.match(r.innerHTML,/&lt;script&gt;/);assert.doesNotMatch(r.innerHTML,/<script>/);r.close();assert.equal(closed,1);
});
test('late or foreign-product results cannot replace another selected view',async()=>{
 let finish;const r=root(),mounted=mountDesktopProductCard({root:r,productId:'6',load:()=>new Promise(resolve=>{finish=resolve;})});mounted.dispose();finish(productCardFixture());await tick();assert.equal(r.paints,1);
 const wrong=root();mountDesktopProductCard({root:wrong,productId:'7',load:async()=>productCardFixture()});await tick();assert.match(wrong.innerHTML,/okunamadı/);assert.doesNotMatch(wrong.innerHTML,/000000000005/);
});
test('persisted opening reason is escaped and displayed with its movement and actor; legacy card invents no reason',async()=>{
 const card=productCardFixture();card.stockOpening={kind:'desktop-product-opening-v1',productId:'6',movementId:'11',actorId:'7',requestId:'6508625b-b648-421b-b7b9-35d4be7c7263',reason:'<b>Açılış sayımı</b>',quantityExact3:'2.000',costExact4:'8.0000',amountTryExact4:'16.0000',documentDate:'2026-11-06',currency:'TRY'};const r=root();mountDesktopProductCard({root:r,productId:'6',load:async()=>card});await tick();assert.match(r.innerHTML,/Başlangıç stok gerekçesi/);assert.match(r.innerHTML,/&lt;b&gt;Açılış sayımı&lt;\/b&gt;/);assert.match(r.innerHTML,/Açılış hareketi/);assert.match(r.innerHTML,/Kaydeden kullanıcı/);assert.match(r.innerHTML,/16.0000 TRY/);
 const old=root();mountDesktopProductCard({root:old,productId:'6',load:async()=>productCardFixture()});await tick();assert.doesNotMatch(old.innerHTML,/Başlangıç stok gerekçesi/);
});

function movementSurface(){let html='',boxHtml='',handlers={};const box={set innerHTML(v){boxHtml=v;handlers={};},get innerHTML(){return boxHtml;},querySelector(s){return {addEventListener(_n,fn){handlers[s]=fn;}};},querySelectorAll(s){if(s!=='[data-movement-invoice]'||!boxHtml.includes('data-movement-invoice='))return [];return [{dataset:{movementInvoice:'15'},addEventListener(_n,fn){handlers.invoice=fn;}}];}};return {set innerHTML(v){html=v;},get innerHTML(){return html;},querySelector(s){if(s==='[data-movements]')return box;return {addEventListener(){}};},box,click(s){return handlers[s]?.();}};}
test('movement pages show only returned receipt links and ignore late responses after close',async()=>{
 const r=movementSurface(),opened=[],pending=[];const mounted=mountDesktopProductCard({root:r,productId:'6',load:async()=>productCardFixture(),loadMovements:(_id,page)=>new Promise(resolve=>pending.push({page,resolve})),onOpenInvoice:id=>opened.push(id)});await tick();assert.equal(pending[0].page,1);
 pending[0].resolve({rows:[{id:'1',documentDate:'2026-11-07',direction:'out',quantityExact3:'2.000',sourceType:'sales_invoice',invoiceId:'15',documentNo:'<fiş>'}],hasNext:true});await tick();assert.match(r.box.innerHTML,/&lt;fiş&gt;/);assert.match(r.box.innerHTML,/role="region" aria-label="Ürün hareketleri tablosu" tabindex="0"/);r.click('invoice');assert.deepEqual(opened,['15']);r.click('[data-movement-next]');assert.equal(pending[1].page,2);mounted.dispose();pending[1].resolve({rows:[],hasNext:false});await tick();assert.doesNotMatch(r.box.innerHTML,/Hareket yok/);
});
test('unavailable receipt stays unlinked and failed movement read is not rendered as empty history',async()=>{
 const r=movementSurface();mountDesktopProductCard({root:r,productId:'6',load:async()=>productCardFixture(),loadMovements:async()=>({rows:[{id:'1',documentDate:'2026-11-07',direction:'out',quantityExact3:'1.000',sourceType:'sales_invoice',invoiceId:null,documentNo:null}],hasNext:false}),onOpenInvoice:()=>assert.fail()});await tick();assert.doesNotMatch(r.box.innerHTML,/data-movement-invoice/);
 const failed=movementSurface();mountDesktopProductCard({root:failed,productId:'6',load:async()=>productCardFixture(),loadMovements:async()=>{throw Error('denied');}});await tick();assert.match(failed.box.innerHTML,/Hareketler okunamadı/);assert.doesNotMatch(failed.box.innerHTML,/Hareket yok/);
});
