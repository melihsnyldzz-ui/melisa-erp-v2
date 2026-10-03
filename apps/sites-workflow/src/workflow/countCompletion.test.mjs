import test from 'node:test';
import assert from 'node:assert/strict';
import {initialOperations,stockQuantity,acceptGoods,acceptCount} from './demoOperationsModel.js';
import {createCountSession,updateCountSession,submitCountSession,approveCountBatch,rejectCountBatch,countRows} from './countModel.js';
const seed=()=>initialOperations([['M-100','Triko','6 ay',24,10,'Aktif','Takım'],['M-142','Body','6 ay',10,8,'Aktif','Body']]);
const create=(s,id='count-0001',repeatOf=null)=>createCountSession(s,{requestId:id,repeatOf},'Satış ekibi');
const edit=(s,d,action,receipts=[])=>updateCountSession(s,d.id,d.revision,action,'Satış ekibi',receipts);
const scan=(s,d,input,quantity,receipts=[])=>edit(s,d,{type:'scan',input,quantity},receipts);
const reason=(s,d,code,reason='İkinci kontrolde eksik bulundu')=>edit(s,d,{type:'reason',code,reason});
test('batch scans aggregate barcode/model, persist draft, then approve every row once',()=>{
 let s=seed(),d=create(s);scan(s,d,'8690000000101',10);scan(s,d,'M-100',12);scan(s,d,'M-142',10);reason(s,d,'M-100');
 assert.equal(d.lines.length,2);assert.equal(d.lines[0].physical,22);assert.equal(stockQuantity(s,'M-100'),24);
 s=JSON.parse(JSON.stringify(s));d=s.countSessions[0];assert.equal(d.lines[0].reason,'İkinci kontrolde eksik bulundu');
 submitCountSession(s,d.id,d.revision,'Satış ekibi');for(const role of ['Satış ekibi','Angela'])assert.throws(()=>approveCountBatch(s,d.id,role));
 assert.throws(()=>acceptCount(s,s.counts[0].id,'İlker'),/bütün satır/);approveCountBatch(s,d.id,'İlker');assert.equal(stockQuantity(s,'M-100'),22);assert.equal(stockQuantity(s,'M-142'),10);
 const before=structuredClone(s);assert.throws(()=>approveCountBatch(s,d.id,'Semih'));assert.deepEqual(s,before);assert.throws(()=>submitCountSession(s,d.id,d.revision,'Satış ekibi'));
});
test('invalid scans, empty reason, unknown product and stale draft never partially mutate',()=>{
 const s=seed(),d=create(s);scan(s,d,'M-100',1);
 for(const action of [{type:'scan',input:'UNKNOWN',quantity:1},{type:'scan',input:'M-142',quantity:-1},{type:'quantity',code:'M-100',quantity:1.5},{type:'scan',input:'M-100',quantity:1000000}]){const before=structuredClone(s);assert.throws(()=>edit(s,d,action));assert.deepEqual(s,before)}
 let before=structuredClone(s);assert.throws(()=>submitCountSession(s,d.id,d.revision,'Satış ekibi'),/neden/);assert.deepEqual(s,before);
 assert.throws(()=>updateCountSession(s,d.id,0,{type:'quantity',code:'M-100',quantity:24},'İlker'),/başka/);assert.deepEqual(s,before);
 assert.equal(create(s).id,d.id);assert.equal(s.countSessions.length,1);
 edit(s,d,{type:'quantity',code:'M-100',quantity:0});reason(s,d,'M-100','Ürün rafta bulunamadı');submitCountSession(s,d.id,d.revision,'Satış ekibi');approveCountBatch(s,d.id,'Semih');assert.equal(stockQuantity(s,'M-100'),0);
});
test('movement during counting or approval blocks the entire batch without overwriting stock',()=>{
 const s=seed(),d=create(s);scan(s,d,'M-142',9);reason(s,d,'M-142');scan(s,d,'M-100',23);reason(s,d,'M-100');
 acceptGoods(s,'MK-00418','İlker');submitCountSession(s,d.id,d.revision,'Satış ekibi');const before=structuredClone(s);
 assert.throws(()=>approveCountBatch(s,d.id,'İlker'),/stok hareketi/);assert.deepEqual(s,before);assert.equal(stockQuantity(s,'M-142'),10);assert.equal(stockQuantity(s,'M-100'),144);
});
test('net zero stock movement invalidates count while payment-only changes do not',()=>{
 const s=seed(),d=create(s),receipts=[{id:'SF-1',items:[{code:'M-100',qty:1}],payments:[]}];scan(s,d,'M-100',23,receipts);submitCountSession(s,d.id,d.revision,'Satış ekibi');
 receipts[0].payments.push({amount:100});approveCountBatch(s,d.id,'İlker',receipts);
 const second=create(s,'count-0002');scan(s,second,'M-142',10,receipts);submitCountSession(s,second.id,second.revision,'Satış ekibi');receipts.push({id:'SF-2',cancelled:true,items:[{code:'M-142',qty:1}]});
 assert.equal(stockQuantity(s,'M-142',receipts),10);assert.throws(()=>approveCountBatch(s,second.id,'İlker',receipts),/stok hareketi/);
});
test('recount retains original history, replaces pending count, and requires every previous product',()=>{
 const s=seed(),d=create(s);scan(s,d,'M-100',22);reason(s,d,'M-100');scan(s,d,'M-142',10);submitCountSession(s,d.id,d.revision,'Satış ekibi');
 const repeat=create(s,'count-repeat',d.id);scan(s,repeat,'M-100',24);assert.throws(()=>submitCountSession(s,repeat.id,repeat.revision,'Satış ekibi'),/bütün ürün/);
 assert.equal(countRows(s,d.id)[0].state,'pending');scan(s,repeat,'M-142',10);submitCountSession(s,repeat.id,repeat.revision,'Satış ekibi');
 assert.equal(countRows(s,d.id)[0].state,'superseded');assert.equal(countRows(s,d.id)[0].physical,22);assert.throws(()=>approveCountBatch(s,d.id,'İlker'));
 approveCountBatch(s,repeat.id,'İlker');assert.equal(stockQuantity(s,'M-100'),24);assert.equal(countRows(s,repeat.id)[0].repeatOf,d.id);
 const third=create(s,'count-third',repeat.id);scan(s,third,'M-100',23);reason(s,third,'M-100');scan(s,third,'M-142',10);submitCountSession(s,third.id,third.revision,'Satış ekibi');approveCountBatch(s,third.id,'Semih');assert.equal(stockQuantity(s,'M-100'),23);
});
test('rejection preserves explanation, author and quantity without changing inventory',()=>{
 const s=seed(),d=create(s);scan(s,d,'M-100',23);reason(s,d,'M-100');submitCountSession(s,d.id,d.revision,'Satış ekibi');
 for(const actor of ['Satış ekibi','Angela'])assert.throws(()=>rejectCountBatch(s,d.id,'Tekrar sayılmalı',actor));assert.throws(()=>rejectCountBatch(s,d.id,'','İlker'));
 rejectCountBatch(s,d.id,'Eksik raf sayılmış','Semih');assert.equal(stockQuantity(s,'M-100'),24);assert.equal(countRows(s,d.id)[0].rejection.actor,'Semih');assert.throws(()=>approveCountBatch(s,d.id,'İlker'));assert.throws(()=>rejectCountBatch(s,d.id,'Tekrar ret','İlker'));
});
