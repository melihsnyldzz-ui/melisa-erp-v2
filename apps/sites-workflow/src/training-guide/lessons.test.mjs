import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {lessons,trainingCompletionNotice} from './lessons.mjs';

test('eight short lessons have complete steps, one answer and local screen/image references',()=>{
 assert.deepEqual(lessons.map(l=>l.id),['receiving','sale','purchase','collection','payment','return','count','crm-order']);
 const images=['01-receiving.png','02-sales.png','03-purchases.png','04-collection.png','05-payment.png','06-return.png','07-count.png','08-crm.png'];
 for(const [index,lesson] of lessons.entries()){
  assert.deepEqual(Object.keys(lesson).sort(),['id','title','role','duration','screen','image','steps','quiz'].sort());
  assert.ok(lesson.steps.length>=3&&lesson.steps.length<=4);
  for(const key of ['id','title','role','duration','image'])assert.ok(typeof lesson[key]==='string'&&lesson[key].trim());
  assert.equal(lesson.image,images[index]);
  if(lesson.id==='crm-order')assert.equal(lesson.screen,null);else assert.match(lesson.screen,/^\/ornek-akis\.html#[a-z-]+$/);
  for(const step of lesson.steps){assert.deepEqual(Object.keys(step).sort(),['title','text','watch','stop'].sort());for(const value of Object.values(step))assert.ok(typeof value==='string'&&value.trim());}
  assert.deepEqual(Object.keys(lesson.quiz).sort(),['question','options','answer','explanation'].sort());
  assert.ok(lesson.quiz.question&&lesson.quiz.explanation);
  assert.equal(lesson.quiz.options.length,3);
  assert.equal(new Set(lesson.quiz.options).size,3);
  assert.ok(Number.isInteger(lesson.quiz.answer)&&lesson.quiz.answer>=0&&lesson.quiz.answer<lesson.quiz.options.length);
 }
});

test('lesson content preserves approval boundaries, separate currencies and draft versus sale',()=>{
 const lesson=id=>lessons.find(l=>l.id===id),text=id=>JSON.stringify(lesson(id));
 assert.match(text('receiving'),/Kaydetmek ve kontrole göndermek henüz stoğu artırmaz/);
 assert.match(text('receiving'),/mal kabulü onayında bir kez artar/);
 assert.match(text('purchase'),/stoğu ikinci kez artırmaz/);
 for(const id of ['receiving','purchase','return','count']){assert.match(lesson(id).role,/Personel → İlker → Muhasebe/);assert.match(text(id),/mevcut.*yetki|mevcut stok yetkisi/);}
 for(const id of ['collection','payment'])assert.match(text(id),/TRY, USD ve EUR/);
 assert.match(text('payment'),/Doğrulanmamış geçmiş açılış borcu/);
 assert.match(text('crm-order'),/taslağı satış, tahsilat veya stok çıkışı değildir/);
 assert.match(trainingCompletionNotice,/gerçek işyeri veya cihaz kabulü değildir/);
});

test('metadata contains no transport, authentication, database, storage or real business fixture',async()=>{
 const source=await readFile(new URL('./lessons.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|document|window)\b|\/api\/|https?:\/\/|requestId|sqlPassword|sqlUser/);
 assert.doesNotMatch(JSON.stringify(lessons),/\b\d+(?:[.,]\d+)\s*(?:TRY|USD|EUR|ADET)\b/);
 assert.match(source,/PR #27 attribution/);
});
