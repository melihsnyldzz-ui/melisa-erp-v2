import test from 'node:test';
import assert from 'node:assert/strict';
import {amountInTurkish,buildTerminalA4Model} from './terminalReceiptA4.mjs';
const fixture=()=>({id:1,documentNo:'MN-TEST',documentDate:'2026-09-14',customerName:'İŞIK ÇOCUK',documentCurrency:'USD',subtotal:100,discountTotal:5,grandTotal:95,
 items:[{stockCode:'001 ÖRNEK',productName:'İşlemeli Ürün',quantity:2,unitPrice:50,lineTotal:100,currency:'USD'}]});
test('A4 preserves invoice identity, line values, discount and final total',()=>{
 const model=buildTerminalA4Model(fixture());
 assert.equal(model.format,'A4');assert.equal(model.documentNumber,'MN-TEST');assert.equal(model.date,'14.09.2026');assert.equal(model.customer,'İŞIK ÇOCUK');
 assert.deepEqual(model.rows[0],['001 ÖRNEK','İşlemeli Ürün','2','ADET','50,00 $','100,00 $']);
 assert.equal(model.grandTotal,'95,00 $');assert.equal(model.discount,'5,00 $');assert.equal(model.hasDiscount,true);
});
test('amount words use Turkish hundred/thousand grammar and receipt currency',()=>{
 assert.equal(amountInTurkish(13747.75,'USD'),'Yalnız: ON ÜÇ BİN YEDİ YÜZ KIRK YEDİ DOLAR YETMİŞ BEŞ CENT');
 assert.equal(amountInTurkish(1000.01,'TRY'),'Yalnız: BİN TÜRK LİRASI BİR KURUŞ');
 assert.equal(amountInTurkish(100.00,'EUR'),'Yalnız: YÜZ EURO SIFIR CENT');
 assert.equal(amountInTurkish(1000001.05,'USD'),'Yalnız: BİR MİLYON BİR DOLAR BEŞ CENT');
});
test('invalid money, dates, currency mismatch and empty receipt fail before printing',()=>{
 for(const bad of [{grandTotal:NaN},{grandTotal:-1},{grandTotal:null},{documentDate:'bad'},{documentCurrency:'ZZZ'},{items:[]},
 {items:[{...fixture().items[0],currency:'EUR'}]},{items:[{...fixture().items[0],quantity:0}]}]){
  assert.throws(()=>buildTerminalA4Model({...fixture(),...bad}));
 }
});
test('zero discount is hidden, monetary symbols follow document currency',()=>{
 for(const [currency,symbol] of [['TRY','₺'],['EUR','€'],['USD','$']]){
  const f=fixture();f.documentCurrency=currency;f.items[0].currency=currency;f.discountTotal=0;
  const model=buildTerminalA4Model(f);assert.equal(model.hasDiscount,false);assert.ok(model.grandTotal.endsWith(symbol));
 }
});
test('long names and all rows are retained for measured pagination without truncation',()=>{
 const f=fixture();f.items=Array.from({length:120},(_,i)=>({...f.items[0],stockCode:'ROW-'+i,productName:'Çok uzun ürün açıklaması '.repeat(8)}));
 const model=buildTerminalA4Model(f);assert.equal(model.rows.length,120);assert.equal(model.rows[119][0],'ROW-119');assert.equal(model.rows[0][1],f.items[0].productName.trim());
});
