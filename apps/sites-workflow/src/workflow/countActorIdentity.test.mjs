import test from 'node:test';
import assert from 'node:assert/strict';
import {initialOperations,stockQuantity} from './demoOperationsModel.js';
import {createCountSession,updateCountSession,submitCountSession,approveCountBatch} from './countModel.js';
const seed=()=>initialOperations([['A-01','Örnek ürün','ADET',3,10,'Aktif']]);

test('personal count name is preserved separately from the existing draft authority',()=>{
 const s=seed(),before=stockQuantity(s,'A-01'),name='Ahmet Örnek';
 const d=createCountSession(s,{requestId:'count-personal-1'},'Satış ekibi',name);
 assert.equal(d.actor,name);assert.equal(s.audit.at(-1).actor,name);
 updateCountSession(s,d.id,d.revision,{type:'scan',input:'A-01',quantity:2},'Satış ekibi',[],name);
 assert.equal(d.updatedBy,name);
 updateCountSession(s,d.id,d.revision,{type:'reason',code:'A-01',reason:'Raf yeniden sayıldı'},'Satış ekibi',[],name);
 const rows=submitCountSession(s,d.id,d.revision,'Satış ekibi',name);
 assert.equal(rows[0].countedBy,name);assert.equal(s.audit.at(-1).actor,name);assert.equal(stockQuantity(s,'A-01'),before);
 assert.throws(()=>approveCountBatch(s,d.id,'Satış ekibi'),/İlker veya Semih/);assert.equal(stockQuantity(s,'A-01'),before);
});

test('personal name never replaces count authority or grants approval',()=>{
 const s=seed(),before=structuredClone(s);
 for(const role of ['Ahmet Örnek','',null,'admin'])assert.throws(()=>createCountSession(s,{requestId:'count-personal-2'},role,'Semih'),/çalışma görünümünü/);
 assert.deepEqual(s,before);
 for(const label of ['', ' '.repeat(3),'x'.repeat(151),'Ahmet\nÖrnek'])assert.throws(()=>createCountSession(s,{requestId:'count-personal-3'},'Satış ekibi',label),/kullanıcı adı/);
 assert.deepEqual(s,before);
});

test('record labels preserve legacy calls and do not bypass revisions or replay identity',()=>{
 const s=seed(),d=createCountSession(s,{requestId:'count-personal-4'},'Satış ekibi');
 assert.equal(d.actor,'Satış ekibi');assert.equal(createCountSession(s,{requestId:'count-personal-4'},'Satış ekibi','Başka isim'),d);assert.equal(d.actor,'Satış ekibi');assert.equal(s.countSessions.length,1);
 updateCountSession(s,d.id,0,{type:'scan',input:'A-01',quantity:1},'Satış ekibi',[],'Ahmet Örnek');
 assert.throws(()=>updateCountSession(s,d.id,0,{type:'scan',input:'A-01',quantity:1},'Satış ekibi',[],'Ahmet Örnek'),/başka bir ekranda/);assert.equal(d.lines[0].physical,1);
});
