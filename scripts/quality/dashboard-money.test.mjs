import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPatronKpis, buildAccountingKpis, mapReceivables, mapAlerts } from '../../apps/web-admin/src/modules/dashboard/dashboardMetrics.js';
const card=(rows,label)=>rows.find(row=>row.label===label);
test('missing balance and concentration stay unknown despite ten known displayed rows',()=>{
  const rows=buildPatronKpis({patron:{customerReceivablesTry:null},melisa:{top20ReceivablesTry:null,top20ReceivableShare:null},receivables:Array(10).fill({balanceTry:100})});
  assert.equal(card(rows,'Açık hesap toplam').value,'Hesaplanamadı');
  assert.equal(card(rows,'İlk 20 alacak').value,'Hesaplanamadı');
  assert.equal(card(rows,'İlk 20 alacak').detail,'Yoğunluk hesaplanamadı');
});
test('server top twenty total wins over the ten-row preview',()=>{
  const rows=buildPatronKpis({patron:{customerReceivablesTry:3000},melisa:{top20ReceivablesTry:2500,top20ReceivableShare:83.3333},receivables:Array(10).fill({balanceTry:100})});
  assert.match(card(rows,'İlk 20 alacak').value,/2\.500/);assert.match(card(rows,'İlk 20 alacak').detail,/83%/);
});
test('missing server concentration is not fabricated from a partial list',()=>{
  assert.equal(card(buildPatronKpis({receivables:[{balanceTry:100}]}),'İlk 20 alacak').value,'Veri yok');
});
test('known empty receivables are zero and not missing',()=>{
  const rows=buildPatronKpis({patron:{customerReceivablesTry:0},melisa:{top20ReceivablesTry:0,top20ReceivableShare:0}});
  assert.match(card(rows,'İlk 20 alacak').value,/0/);assert.equal(card(rows,'İlk 20 alacak').detail,'0% yoğunluk');
});
test('unprovided country and overstock metrics are not fake zero',()=>{
  const rows=buildPatronKpis({});assert.equal(card(rows,'Romanya açık hesap').value,'Veri yok');assert.equal(card(rows,'Stokta fazla').value,'Veri yok');
});
test('null daily historical collections and payments render unknown',()=>{
  const rows=buildAccountingKpis({accounting:{todayCollectionsTry:null,todayPaymentsTry:null}});
  assert.equal(card(rows,'Günlük tahsilat').value,'Hesaplanamadı');assert.equal(card(rows,'Günlük ödeme').value,'Hesaplanamadı');
});
test('native USD and unknown TRY remain distinct in receivable rows',()=>{
  const [row]=mapReceivables({receivables:[{customerId:7,customerName:'Same name',currency:'USD',balance:3000,balanceTry:null,risk:'Kur eksik'}]});
  assert.equal(row.customerId,7);assert.equal(row.balance,'3000 USD / TRY: Hesaplanamadı');assert.equal(row.risk,'Kur eksik');
});
test('alerts carry currency while stock counts remain unitless',()=>{
  const rows=mapAlerts([{value:3000,currency:'USD'},{value:120000,currency:'TRY'},{value:-2}]);
  assert.equal(rows[0].value,'3.000 USD');assert.equal(rows[1].value,'120.000 TRY');assert.equal(rows[2].value,'-2');
});
