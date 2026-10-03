import test from 'node:test';import assert from 'node:assert/strict';
import {readExampleSettings,saveExampleSettings,exampleSettingDefaults} from './settingsModel.js';
const seed=()=>({audit:[],counts:[{physical:3}],supplierPayments:[{method:'Nakit',amount:100}],products:[['A']]});
const next={displayName:'Melisa Baby · Merkez',paymentMethod:'Banka',countScanQuantity:2};
test('Semih saves validated settings with immutable before/after history and restart persistence',()=>{
 const s=seed(),original=structuredClone(s);assert.deepEqual(readExampleSettings(s).values,exampleSettingDefaults);
 saveExampleSettings(s,next,0,'Örnek ayar kabulü','Semih');const saved=readExampleSettings(JSON.parse(JSON.stringify(s)));assert.deepEqual(saved.values,next);assert.equal(saved.revision,1);assert.equal(saved.history[0].actor,'Semih');assert.deepEqual(saved.history[0].before,exampleSettingDefaults);assert.deepEqual(s.counts,original.counts);assert.deepEqual(s.supplierPayments,original.supplierPayments);assert.deepEqual(s.products,original.products);
 saved.values.displayName='Dış değişiklik';saved.history[0].before.displayName='Değişiklik';assert.equal(readExampleSettings(s).values.displayName,next.displayName);assert.equal(s.exampleSettings.history[0].before.displayName,'Melisa Baby');
 saveExampleSettings(s,exampleSettingDefaults,1,'Varsayılanlara dönüş','Semih');assert.equal(s.exampleSettings.history.length,2);assert.equal(s.exampleSettings.history[1].before.paymentMethod,'Banka');
});
test('all other roles, stale revision and invalid input leave settings and audit unchanged',()=>{
 const s=seed();for(const actor of ['Satış ekibi','İlker','Angela','unknown']){const before=structuredClone(s);assert.throws(()=>saveExampleSettings(s,next,0,'Deneme nedeni',actor));assert.deepEqual(s,before)}
 for(const patch of [{displayName:''},{displayName:'a'.repeat(81)},{paymentMethod:'GBP'},{countScanQuantity:0},{countScanQuantity:1.5},{countScanQuantity:1000001}]){const before=structuredClone(s);assert.throws(()=>saveExampleSettings(s,{...next,...patch},0,'Deneme nedeni','Semih'));assert.deepEqual(s,before)}
 assert.throws(()=>saveExampleSettings(s,next,0,'','Semih'));saveExampleSettings(s,next,0,'Deneme nedeni','Semih');const before=structuredClone(s);assert.throws(()=>saveExampleSettings(s,exampleSettingDefaults,0,'Eski ekran','Semih'),/başka/);assert.deepEqual(s,before);
});
test('unchanged saves do not create duplicate history, and malformed stored settings are surfaced',()=>{
 const s=seed();saveExampleSettings(s,next,0,'İlk kayıt','Semih');const before=structuredClone(s);saveExampleSettings(s,next,1,'Tekrar kayıt','Semih');assert.deepEqual(s,before);s.exampleSettings.values.countScanQuantity=-1;assert.throws(()=>readExampleSettings(s),/Okutma/);
});
