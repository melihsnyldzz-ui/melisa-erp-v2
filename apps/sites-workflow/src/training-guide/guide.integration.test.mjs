import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {lessons,trainingCompletionNotice} from './lessons.mjs';
import {escapeHtml,readProgress,saveProgress,progressKey} from './progress.mjs';

// Execute the actual entry point with its pure imports and an inert DOM. No
// browser, authentication adapter, API server or business controller is loaded.
const entry=readFileSync(new URL('./main.js',import.meta.url),'utf8')
 .replace(/^import[^\n]+\n/gm,'');

function guide({storageMode='available',hash='#receiving'}={}){
 const records=new Map([['ordinary-auth','preserved-token'],['ordinary-draft','preserved-draft']]);
 const reads=[],writes=[],windowEvents=new Map();
 let html='',buttons=new Map(),networkCalls=0,sessionAccesses=0;
 const storage={getItem(key){reads.push(key);return records.get(key)??null;},setItem(key,value){writes.push({key,value});records.set(key,value);}};
 const forbidden=()=>{networkCalls++;throw Error('Guide must not call a transport');};
 const root={
  get innerHTML(){return html;},
  set innerHTML(value){
   html=value;buttons=new Map();
   for(const match of html.matchAll(/<button\b([^>]*)>/g)){
    const attributes=match[1],answer=/data-answer="(\d+)"/.exec(attributes),action=/data-action="([a-z]+)"/.exec(attributes);
    if(!answer&&!action)continue;
    const key=answer?'answer:'+answer[1]:'action:'+action[1];
    buttons.set(key,{dataset:answer?{answer:answer[1]}:{action:action[1]},disabled:/\bdisabled\b/.test(attributes),addEventListener(event,handler){assert.equal(event,'click');this.click=handler;}});
   }
  },
  querySelectorAll(selector){assert.equal(selector,'[data-answer]');return [...buttons.entries()].filter(([key])=>key.startsWith('answer:')).map(([,button])=>button);},
  querySelector(selector){
   if(selector==='img')return {addEventListener(event){assert.equal(event,'error');}};
   const match=/^\[data-action="([a-z]+)"\]$/.exec(selector);
   assert.ok(match,'Unexpected guide DOM query');return buttons.get('action:'+match[1]);
  }
 };
 const win={addEventListener(event,handler){windowEvents.set(event,handler);}};
 if(storageMode!=='missing')Object.defineProperty(win,'localStorage',{get(){if(storageMode==='blocked')throw Object.assign(Error('Storage access denied'),{name:'SecurityError'});return storage;}});
 Object.defineProperty(win,'sessionStorage',{get(){sessionAccesses++;throw Error('Guide must not read an authentication session');}});
 const location={hash,search:''};
 runInNewContext(entry,{document:{querySelector(selector){assert.equal(selector,'#training-guide');return root;}},window:win,location,URLSearchParams,lessons,trainingCompletionNotice,escapeHtml,readProgress,saveProgress,fetch:forbidden,XMLHttpRequest:forbidden},{filename:'training-guide/main.js'});
 return {
  root,records,reads,writes,location,
  button:key=>buttons.get(key),
  click(key,{force=false}={}){const button=buttons.get(key);assert.ok(button,'Expected guide button '+key);if(force||!button.disabled)button.click();},
  changeHash(value){location.hash='#'+value;windowEvents.get('hashchange')();},
  assertIsolated(){assert.equal(networkCalls,0);assert.equal(sessionAccesses,0);assert.equal(records.get('ordinary-auth'),'preserved-token');assert.equal(records.get('ordinary-draft'),'preserved-draft');}
 };
}

function reachQuiz(ui,id){const lesson=lessons.find(item=>item.id===id);for(let n=0;n<lesson.steps.length;n++)ui.click('action:next');return lesson;}

for(const storageMode of ['blocked','missing'])test(`${storageMode} browser storage still renders and retains completion in memory`,()=>{
 const ui=guide({storageMode});
 assert.match(ui.root.innerHTML,/Gelen malı say ve kontrole gönder/);
 const lesson=reachQuiz(ui,'receiving');ui.click('answer:'+lesson.quiz.answer);ui.click('action:next');
 assert.equal(ui.location.hash,'sale');
 ui.changeHash('receiving');
 assert.match(ui.root.innerHTML,/İncelendi/);
 assert.ok(ui.root.innerHTML.includes(trainingCompletionNotice));
 assert.deepEqual(ui.reads,[]);assert.deepEqual(ui.writes,[]);assert.equal(ui.records.size,2);ui.assertIsolated();
});

test('wrong answer cannot complete; corrected answer writes only isolated guide progress',()=>{
 const ui=guide(),lesson=reachQuiz(ui,'receiving');
 ui.click('answer:'+((lesson.quiz.answer+1)%lesson.quiz.options.length));
 assert.match(ui.root.innerHTML,/Bu noktayı tekrar düşün/);
 assert.equal(ui.button('action:next').disabled,true);
 ui.click('action:next',{force:true});
 assert.equal(ui.location.hash,'#receiving');assert.deepEqual(ui.writes,[]);
 ui.click('answer:'+lesson.quiz.answer);
 assert.equal(ui.button('action:next').disabled,false);
 ui.click('action:next');
 assert.deepEqual(ui.reads,[progressKey]);assert.equal(ui.writes.length,1);assert.equal(ui.writes[0].key,progressKey);
 assert.deepEqual(JSON.parse(ui.writes[0].value),{completed:['receiving']});assert.equal(ui.records.size,3);
 assert.equal(ui.location.hash,'sale');ui.assertIsolated();
});

test('hash navigation resets quiz state without reading auth or writing progress or drafts',()=>{
 const ui=guide(),lesson=reachQuiz(ui,'receiving');ui.click('answer:'+lesson.quiz.answer);
 ui.changeHash('count');assert.match(ui.root.innerHTML,/Fiziksel sayım ve stok farkı/);assert.match(ui.root.innerHTML,/Adım 1 \/ 4/);
 reachQuiz(ui,'count');assert.equal(ui.button('action:next').disabled,true);
 ui.changeHash('crm-order');assert.match(ui.root.innerHTML,/Müşteri ürünleri ve taslak sipariş/);
 ui.changeHash('unrecognized');assert.match(ui.root.innerHTML,/Gelen malı say ve kontrole gönder/);
 assert.deepEqual(ui.reads,[progressKey]);assert.deepEqual(ui.writes,[]);assert.equal(ui.records.size,2);ui.assertIsolated();
});
