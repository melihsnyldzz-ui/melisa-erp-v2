import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_LAYOUTS, catalogPages, buildCatalogHtml, catalogImageUrl, toCatalogProduct, catalogPrice } from '../../apps/web-admin/src/modules/catalog/catalogPdf.js';
const raw={imageIdentityStatus:'VERIFIED',sourceId:12,stockCode:'Ş-12',productName:'İğne & Örgü',brand:'Marka',salePrice:12.5,currency:'USD',currencyTrustState:'TRUSTED',currencySource:'ERP_SALE_UNIT',stockQuantity:-2,imageUrl:'http://host.docker.internal:4100/uploads/vega-products/12.jpg',purchasePrice:99,customer:'private'};
const product=toCatalogProduct(raw,'http://127.0.0.1:4100');

test('catalog excludes blocked, unavailable and legacy images even when raw URLs remain',()=>{
  for(const imageIdentityStatus of ['CONFLICT','STALE','UNREVIEWED','UNAVAILABLE',undefined]) {
    const projected=toCatalogProduct({...raw,imageIdentityStatus},'http://127.0.0.1:4100');
    assert.equal(projected.image,'');
    assert.ok(!buildCatalogHtml({products:[projected]}).includes('<img '));
    assert.equal(projected.price,12.5);
  }
});
test('projects only catalog fields and retains trusted price, currency and negative stock',()=>{assert.equal(product.price,12.5);assert.equal(product.currency,'USD');assert.equal(product.stock,-2);assert.equal(product.purchasePrice,undefined);assert.equal(product.customer,undefined);assert.match(product.image,/127.0.0.1/);});
test('unknown, zero and untrusted prices are never silently TRY or zero',()=>{for(const patch of [{salePrice:null},{salePrice:''},{salePrice:0},{currency:''},{currencyTrustState:'UNTRUSTED'},{currencySource:'DEFAULT'}]){const p=toCatalogProduct({...raw,...patch},'http://127.0.0.1:4100');assert.equal(p.price,null);assert.equal(catalogPrice(p),'Fiyat teyit edilecek');}});
test('identity gaps fail closed',()=>{assert.throws(()=>toCatalogProduct({...raw,sourceId:null},'http://localhost'));assert.throws(()=>toCatalogProduct({...raw,productName:''},'http://localhost'));});
test('unsafe image paths and protocols excluded',()=>{for(const path of ['javascript:alert(1)','data:image/png;base64,x','https://example.com/private.png','http://a/uploads/vega-products/a.jpg?token=secret','http://a/uploads/vega-products/a%2fb.jpg'])assert.equal(catalogImageUrl(path,'http://127.0.0.1:4100'),'');});
for(const layout of CATALOG_LAYOUTS)test(`${layout.name}: all 97 selected products exactly once, including final page`,()=>{const rows=Array.from({length:97},(_,i)=>({...product,id:String(i),code:`SKU-${i}`}));const pages=catalogPages(rows,layout.id);assert.equal(pages.length,Math.ceil(97/layout.count));assert.deepEqual(pages.flat(),rows);const html=buildCatalogHtml({products:rows,layoutId:layout.id,cover:true});assert.equal((html.match(/data-product-id=/g)||[]).length,97);assert.equal((html.match(/<section class="page/g)||[]).length,pages.length+1);assert.match(html,/SKU-96/);});
test('sorting never mutates selection and duplicates fail',()=>{const rows=[{...product,id:'2',code:'20'},{...product,id:'1',code:'3'}];assert.equal(catalogPages(rows,'grid','code')[0][0].code,'3');assert.equal(rows[0].code,'20');assert.throws(()=>catalogPages([product,product],'grid'));});
test('HTML injection escaped; prices absent by default and no totals across currencies',()=>{const html=buildCatalogHtml({products:[{...product,code:'<script>alert(1)</script>'}],title:'<img src=x>',subtitle:'" onload="bad'});assert.ok(!html.includes('<script>'));assert.ok(!html.includes('12,50'));assert.ok(html.includes('&lt;script&gt;'));const priced=buildCatalogHtml({products:[product],showPrices:true,showStock:true});assert.ok(priced.includes('12,50 USD'));assert.ok(priced.includes('Stok: -2'));});
test('empty selection cannot produce an empty PDF',()=>assert.throws(()=>buildCatalogHtml({products:[]})));
