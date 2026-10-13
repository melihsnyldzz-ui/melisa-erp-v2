import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {catalogStockDisplay,catalogExact} from './workCatalogModel.mjs';
const row=(stockQuantityExact='0.00000000',blocked=false,verified=true)=>({stockQuantityExact,hold:{blocked},unit:{verified}});
test('stock trust precedence keeps unknown distinct from unverified and verified zero',()=>{
 for(const blocked of [false,true])for(const verified of [false,true])assert.equal(catalogStockDisplay(row(null,blocked,verified)),'Bilinmiyor');
 for(const [blocked,verified] of [[true,true],[true,false],[false,false]])for(const quantity of ['0.00000000','5.00000000','-5.00000000'])assert.equal(catalogStockDisplay(row(quantity,blocked,verified)),'Doğrulanmadı');
 assert.equal(catalogStockDisplay(row()),'0');
});
test('verified signed quantity and all eight source decimals retain existing formatter and input',()=>{
 for(const [quantity,expected] of [['-443.00000000','-443'],['-0.00000001','-0,00000001'],['12345678901234567890.12345678','12.345.678.901.234.567.890,12345678'],['2.50000000','2,5']]){
  const r=row(quantity),before=JSON.stringify(r);assert.equal(catalogStockDisplay(r),expected);assert.equal(catalogStockDisplay(r),catalogExact(quantity));assert.equal(JSON.stringify(r),before);
 }
});
test('malformed quantity or trust flags fail before masking even held and null rows',()=>{
 for(const value of [undefined,0,'0','0.0000','01.00000000','NaN','<bad>','1.000000000','1e2',{},'100000000000000000000.00000000'])assert.throws(()=>catalogStockDisplay({...row(value,true,false),stockQuantityExact:value}));
 for(const blocked of [undefined,null,0,'false'])for(const quantity of [null,'0.00000000'])assert.throws(()=>catalogStockDisplay({...row(quantity),hold:{blocked}}));
 for(const verified of [undefined,null,1,'true'])for(const quantity of [null,'0.00000000'])assert.throws(()=>catalogStockDisplay({...row(quantity),unit:{verified}}));
 for(const value of [null,undefined,{}, {...row(),hold:null},{...row(),unit:null}])assert.throws(()=>catalogStockDisplay(value));
});
test('actual list and card rendering share stock trust display without changing unit factor',()=>{
 const source=readFileSync(new URL('./workCatalog.js',import.meta.url),'utf8'),from=source.indexOf(' function table(rows,m)'),to=source.indexOf('\n function mount(host)',from);
 assert.ok(from>0&&to>from);
 // Execute the production render functions, with unrelated presentation dependencies bounded.
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const render=Function('esc','known','unit','priceSummary','status','catalogStockDisplay','catalogExact','money','purchasePermission',source.slice(from,to)+';return {table,card};')(esc,esc,r=>r.unit.verified?'ADET':'Bilinmiyor',()=>'',()=>'',catalogStockDisplay,catalogExact,()=>'',false);
 for(const [quantity,blocked,verified,expected] of [[null,false,true,'Bilinmiyor'],['0.00000000',true,false,'Doğrulanmadı'],['0.00000000',false,true,'0'],['-443.00000000',false,true,'-443']]){
  const r={...row(quantity,blocked,verified),id:'1',stockCode:'0001',displayCode:'0001',productName:'<Ürün>',isActive:true,classification:{brand:null,productType:null,sourceName:null},barcodes:[],salePrices:[],photo:{status:'missing'},provenance:{sourceAsOf:'2026-09-30'}};r.unit.factorExact8='1.12345678';const before=JSON.stringify(r),meta={canViewSalesPrices:false,readAt:'2026-10-13T09:00:00Z'};
  assert.ok(render.table([r],meta).includes(`<td data-label="Stok">${expected}<small`));const card=render.card(r,meta);assert.ok(card.includes(`<small>Mevcut stok</small><strong>${expected}</strong>`));if(verified)assert.ok(card.includes('<dt>Birim çarpanı</dt><dd>1,12345678</dd>'));assert.ok(card.includes('&lt;Ürün&gt;'));assert.equal(JSON.stringify(r),before);
 }
});
