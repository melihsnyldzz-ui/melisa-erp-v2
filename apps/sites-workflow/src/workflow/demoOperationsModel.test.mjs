import test from 'node:test';
import assert from 'node:assert/strict';
import {initialOperations,stockQuantity,addCount,acceptCount,acceptGoods,addGoodsBatch,addPurchase} from './demoOperationsModel.js';
const seed=()=>initialOperations([['M-100','Triko','3–6 ay',24,10.5,'Aktif','Takım']]);
test('multi-product delivery validates atomically and posts every line once',()=>{
 const s=seed();s.products.push(['M-142','Body','0–3 ay',10,8,'Aktif','Body']);
 const before=structuredClone(s);
 assert.throws(()=>addGoodsBatch(s,{supplier:'Concept',lines:[{code:'M-100',quantity:6},{code:'missing',quantity:8}]},'Satış'));
 assert.deepEqual(s,before);
 assert.throws(()=>addGoodsBatch(s,{supplier:'Concept',lines:[{code:'M-100',quantity:6},{code:'M-100',quantity:8}]},'Satış'));
 assert.deepEqual(s,before);
 const rows=addGoodsBatch(s,{supplier:'Concept',lines:[{code:'M-100',quantity:6},{code:'M-142',quantity:8}]},'Satış');
 assert.equal(stockQuantity(s,'M-100'),24);assert.equal(stockQuantity(s,'M-142'),10);
 assert.equal(rows[0].batchId,rows[1].batchId);
 assert.throws(()=>acceptGoods(s,rows[0].id,'Satış'));assert.ok(rows.every(r=>r.state==='pending'));
 acceptGoods(s,rows[0].id,'İlker');assert.equal(stockQuantity(s,'M-100'),30);assert.equal(stockQuantity(s,'M-142'),18);
 assert.throws(()=>acceptGoods(s,rows[1].id,'İlker'));assert.equal(stockQuantity(s,'M-142'),18);
 addPurchase(s,{goodsId:rows[1].id,number:'MULTI-1',date:'2026-09-28',currency:'USD',quantity:8,priceCents:800,vatCents:0},'İlker');
 assert.equal(stockQuantity(s,'M-142'),18);assert.equal(s.purchases[0].total,6400);
 const restored=JSON.parse(JSON.stringify(s));assert.equal(stockQuantity(restored,'M-100'),30);assert.equal(stockQuantity(restored,'M-142'),18);
});
test('acceptance, sales and count share stock; purchase and retries do not duplicate it',()=>{
 const s=seed();assert.equal(stockQuantity(s,'M-100'),24);
 assert.throws(()=>acceptGoods(s,'MK-00418','Satış ekibi'));
 acceptGoods(s,'MK-00418','İlker');assert.equal(stockQuantity(s,'M-100'),144);
 assert.throws(()=>acceptGoods(s,'MK-00418','İlker'));assert.equal(stockQuantity(s,'M-100'),144);
 const input={goodsId:'MK-00418',number:'TEST-1',date:'2026-09-28',currency:'USD',quantity:72,priceCents:1000,vatCents:120};
 addPurchase(s,input,'İlker');assert.equal(s.purchases[0].total,72120);assert.equal(stockQuantity(s,'M-100'),144);
 assert.throws(()=>addPurchase(s,input,'İlker'));assert.throws(()=>addPurchase(s,{...input,number:'TEST-2',quantity:49},'İlker'));
 const sales=[{items:[{code:'M-100',qty:6}]}];assert.equal(stockQuantity(s,'M-100',sales),138);
 const count=addCount(s,{code:'M-100',physical:136,reason:'Tekrar sayıldı'},'Satış ekibi',sales);
 acceptCount(s,count.id,'İlker',sales);assert.equal(stockQuantity(s,'M-100',sales),136);assert.throws(()=>acceptCount(s,count.id,'İlker',sales));
});
test('count cannot overwrite a movement recorded after counting',()=>{
 const s=seed();const c=addCount(s,{code:'M-100',physical:23,reason:'Tekrar sayım'},'İlker');
 acceptGoods(s,'MK-00418','İlker');assert.throws(()=>acceptCount(s,c.id,'İlker'),/Yeniden sayım/);assert.equal(stockQuantity(s,'M-100'),144);
});
