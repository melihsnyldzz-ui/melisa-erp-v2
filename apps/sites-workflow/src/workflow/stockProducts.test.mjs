import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {stockExact,stockSign,stockProductsPath,stockProduct,stockProductsEnvelope,stockImageSource} from './stockProductsModel.mjs';
import {stockProductDto} from '../../../api/src/services/stockProductModel.mjs';
const row=(id='12')=>({id,stockCode:'00012',productName:'Ürün',isActive:true,stockQuantityExact:null,unit:{label:'ADET',sourceId:'7',factorExact8:null,verified:false},barcodes:[{id:'91',value:'000012',isPrimary:true,sourceKey:null}],imageUrl:null,provenance:{kind:'accepted-opening',sourceKey:'VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/12',runId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30',verified:true},hold:{blocked:false,reasons:[]}});
const envelope=(data=[row()],more={})=>({success:true,data,meta:{total:data.length,page:1,limit:25,totalPages:data.length?1:0,readOnly:true,sourceAsOf:'2026-09-30',freshLive:false,readAt:'2026-10-05T08:00:00.000Z',canViewFinance:false,scopeCounts:{acceptedOpening:16622,syntheticTest:3,quarantinedSource:54},...more}});
const finance=()=>({averageCostTryExact:null,prices:[{id:'77',type:'purchase',unitSourceId:null,tier:0,currency:'USD',priceExact:'0.00000000',isMainUnit:false,sourceKey:row().provenance.sourceKey+'/PRICE/purchase/CARD/0/USD'}]});
test('exact amount keeps unknown, zero, negative and large value without Number rounding',()=>{
 assert.equal(stockExact(null),'Bilinmiyor');assert.equal(stockExact('0.00000000'),'0');assert.equal(stockExact('-2.00000000'),'-2');assert.equal(stockExact('9007199254740993.12345678'),'9.007.199.254.740.993,12345678');assert.equal(stockSign('0.00000000'),'Stok sıfır');assert.equal(stockSign(null),'Stok bilinmiyor');assert.equal(stockSign('-0.00000001'),'Negatif stok');
 for(const bad of [0,undefined,'1','01.00000000','1e8','1.123456789'])assert.throws(()=>stockExact(bad));
});
test('search barcode remains a literal with leading zeros, whitespace and all bounded filters',()=>{
 const q=new URL(stockProductsPath({barcode:' 000012 ',search:'çorap %',stock:'negative',status:'passive',page:2}),'https://test.invalid').searchParams;assert.equal(q.get('barcode'),' 000012 ');assert.equal(q.get('stock'),'negative');assert.equal(q.get('limit'),'25');
 for(const x of [{barcode:12},{barcode:'x'.repeat(161)},{search:'x'.repeat(121)},{page:0},{page:100001},{stock:'unknown'},{status:'deleted'}])assert.throws(()=>stockProductsPath(x));
});
test('API DTO passes UI and rejects provenance drift, invented unit factor and financial leakage',()=>{
 assert.equal(stockProduct(stockProductDto(row())).barcodes[0].value,'000012');
 const c=row();c.financial=finance();assert.throws(()=>stockProduct(c));assert.equal(stockProduct(stockProductDto(c,{sqlFinance:true,canViewFinance:true}),{canViewFinance:true}).financial.prices[0].priceExact,'0.00000000');
 for(const mutate of [r=>r.provenance.sourceAsOf='2026-10-05',r=>r.provenance.runId='OTHER',r=>r.unit.factorExact8='1.00000000',r=>r.stockQuantityExact=0]){const r=row();mutate(r);assert.throws(()=>stockProduct(r));}
 const held=row();held.provenance.kind='quarantined-source';held.hold={blocked:true,reasons:['IDENTITY_AMBIGUOUS']};assert.equal(stockProduct(stockProductDto(held)).hold.blocked,true);
 const synthetic=row('301986');synthetic.stockCode='TEST-DAILY-PURCHASE';synthetic.provenance={kind:'synthetic-test',sourceKey:null,runId:null,sourceAsOf:null,verified:true};assert.equal(stockProduct(stockProductDto(synthetic)).provenance.sourceAsOf,null);
});
test('envelope corrupt totals, native id coercion and source failure cannot become an empty success',()=>{
 assert.equal(stockProductsEnvelope(envelope()).data[0].id,'12');assert.equal(stockProductsEnvelope(envelope([])).meta.total,0);
 for(const p of [envelope([],{total:1,totalPages:1}),envelope([row()],{freshLive:true}),envelope([row()],{canViewFinance:true}),envelope([row()],{readAt:'now'}),envelope([row(),row()])])assert.throws(()=>stockProductsEnvelope(p));assert.throws(()=>stockProduct({...row(),id:12}));
});
test('only safe referenced images can be displayed',()=>{
 for(const v of ['javascript:alert(1)','data:image/svg+xml;base64,a','//evil.test/x','https://user:secret@example.test/x','/x\\y'])assert.equal(stockImageSource(v),null);assert.equal(stockImageSource('/images/product.jpg'),'/images/product.jpg');assert.equal(stockImageSource('https://example.test/product.jpg'),'https://example.test/product.jpg');
});
async function controller(){const source=(await readFile(new URL('./stockProducts.js',import.meta.url),'utf8')).replace("import './stockProducts.css';",'').replace("'./stockProductsModel.mjs'",JSON.stringify(new URL('./stockProductsModel.mjs',import.meta.url).href));return (await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).createStockProducts;}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function dom(){
 const nodes=new Map();const form={elements:Object.fromEntries(['search','barcode','stock','status'].map(k=>[k,{value:['stock','status'].includes(k)?'all':''}])),reset(){for(const [k,v] of Object.entries(this.elements))v.value=['stock','status'].includes(k)?'all':'';}};
 const node=s=>{if(s==='[data-stock-filter]')return form;if(!nodes.has(s))nodes.set(s,{isConnected:true,innerHTML:'',textContent:'',disabled:false,focus(){this.focused=true;},scrollIntoView(){},addEventListener(e,f){this['on'+e]=f;},querySelector:node,querySelectorAll(){return [...(this.innerHTML.matchAll(/data-stock-open="([^"]+)"/g))].map(m=>node('button:'+m[1]));}});return nodes.get(s);};
 const host={isConnected:true,querySelector:node,querySelectorAll:()=>[]};
 for(const i of ['12','13','301986'])node('button:'+i).dataset={stockOpen:i};
 return {host,form,nodes,node};
}
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
test('actual readonly controller requires product.view, yet works without finance permission',async()=>{
 const create=await controller();let reads=0;const denied=create({api:()=>reads++,esc:escape,permissions:['purchase.view']});assert.match(denied.html(),/görüntüleme yetkiniz yok/);denied.mount(dom().host);await tick();assert.equal(reads,0);
 const d=dom(),ui=create({api:async()=>{reads++;return envelope();},esc:escape,permissions:['product.view']});ui.mount(d.host);await tick();assert.equal(reads,1);assert.match(d.node('[data-stock-results]').innerHTML,/000012/);assert.doesNotMatch(d.node('[data-stock-results]').innerHTML,/Fiyat ve maliyet/);ui.dispose();
});
test('late list completion and dispose cannot replace newer results with stale or fixture fallback',async()=>{
 const create=await controller(),d=dom();const completions=[];const ui=create({api:()=>new Promise(resolve=>completions.push(resolve)),esc:escape,permissions:['product.view']});ui.mount(d.host);d.form.elements.search.value='new';d.form.onsubmit({preventDefault(){}});completions[1](envelope([{...row(),productName:'Yeni kart'}]));await tick();const current=d.node('[data-stock-results]').innerHTML;completions[0](envelope([{...row(),productName:'Eski kart'}]));await tick();assert.equal(d.node('[data-stock-results]').innerHTML,current);assert.match(current,/Yeni kart/);d.form.onsubmit({preventDefault(){}});const pending=d.node('[data-stock-results]').textContent;ui.dispose();completions[2](envelope());await tick();assert.equal(d.node('[data-stock-results]').textContent,pending);
});
test('multiple barcode cards remain selectable; detail close invalidates pending result',async()=>{
 const create=await controller(),d=dom();let finish;const ui=create({api:async(path)=>path.includes('?')?envelope([row(),row('13')]):new Promise(resolve=>finish=resolve),esc:escape,permissions:['product.view']});d.form.elements.barcode.value='000012';ui.mount(d.host);await tick();assert.match(d.node('[data-stock-summary]').textContent,/birden fazla/);d.node('button:12').onclick();d.form.onsubmit({preventDefault(){}});finish({success:true,data:row(),meta:envelope().meta});await tick();assert.equal(d.node('[data-stock-detail]').innerHTML,'');ui.dispose();
});
test('source error has a retry and never populates fake product rows; synthetic detail labels native prices',async()=>{
 const create=await controller(),d=dom();let failed=true;const synthetic=row('301986');synthetic.productName='<img>';synthetic.stockCode='TEST-DAILY-PURCHASE';synthetic.provenance={kind:'synthetic-test',sourceKey:null,runId:null,sourceAsOf:null,verified:true};synthetic.financial=finance();const ui=create({api:async path=>{if(failed)throw Error('Kaynak doğrulanamadı');return path.includes('?')?envelope([synthetic],{canViewFinance:true}):{success:true,data:synthetic,meta:envelope([],{canViewFinance:true}).meta};},esc:escape,permissions:['product.view','purchase.view']});ui.mount(d.host);await tick();assert.match(d.node('[data-stock-results]').innerHTML,/Kaynak doğrulanamadı/);assert.doesNotMatch(d.node('[data-stock-results]').innerHTML,/data-stock-open/);failed=false;d.node('[data-stock-retry]').onclick();await tick();assert.match(d.node('[data-stock-results]').innerHTML,/Sentetik TEST kartları/);assert.match(d.node('[data-stock-results]').innerHTML,/&lt;img>/);d.node('button:301986').onclick();await tick();assert.match(d.node('[data-stock-detail]').innerHTML,/yalnız sentetik TEST kaydıdır/);assert.match(d.node('[data-stock-detail]').innerHTML,/0 USD/);assert.match(d.node('[data-stock-detail]').innerHTML,/Bilinmiyor/);d.node('[data-stock-close]').onclick();assert.equal(d.node('[data-stock-detail]').innerHTML,'');assert.equal(d.node('button:301986').focused,true);ui.dispose();
});
