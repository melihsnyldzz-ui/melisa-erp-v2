import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {readProgress,saveProgress,progressKey,escapeHtml,inlineProgressKey,readInlineProgress,saveInlineProgress} from './progress.mjs';
test('guide progress is isolated from auth, drafts and business records',()=>{const map=new Map([['melisaTestSalesAccessToken','unchanged']]);const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};saveProgress(storage,{completed:['receiving','fake','count','receiving']});assert.deepEqual(readProgress(storage),{completed:['receiving','count']});assert.equal(map.get('melisaTestSalesAccessToken'),'unchanged');assert.equal(map.size,2);assert.ok(progressKey.startsWith('melisa-readonly-training:'));});
test('unavailable or invalid local storage does not block the lesson',()=>{assert.deepEqual(readProgress({getItem:()=>{throw Error('blocked');}}),{completed:[]});assert.equal(saveProgress({setItem:()=>{throw Error('blocked');}},{completed:[]}),false);assert.equal(escapeHtml('<script>'), '&lt;script&gt;');});
test('guide has no commercial transport, session, frame or embedded trade form',()=>{const text=fs.readFileSync(new URL('./main.js',import.meta.url),'utf8');assert.doesNotMatch(text,/\bfetch\s*\(|XMLHttpRequest|\/api\/|<iframe|<form|accessToken|method:\s*['"]POST/);assert.match(text,/İlker \/ yetkili sorumlu/);assert.match(text,/answer!==l\.quiz\.answer/);});

test('inline preparation keeps each account and environment separate without completing the lesson',()=>{
 const values=new Map([[progressKey,JSON.stringify({completed:['count']})],['existing-draft','unchanged']]),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},identity={scope:'http://test:5244:synthetic-a',userId:15,lesson:'receiving'};
 assert.equal(saveInlineProgress(storage,identity,{step:3,reviewed:true,token:'not-stored'}),true);
 assert.deepEqual(readInlineProgress(storage,identity),{step:3,reviewed:true});
 for(const other of [{...identity,userId:16},{...identity,scope:'http://test:5244:synthetic-b'},{...identity,lesson:'sale'}])assert.deepEqual(readInlineProgress(storage,other),{step:0,reviewed:false});
 assert.deepEqual(readProgress(storage),{completed:['count']});assert.equal(values.get('existing-draft'),'unchanged');
 assert.equal(values.get(inlineProgressKey(identity)),JSON.stringify({step:3,reviewed:true}));
 assert.equal(saveInlineProgress(storage,identity,{step:0,reviewed:false}),true);assert.deepEqual(readInlineProgress(storage,identity),{step:0,reviewed:false});
});

test('inline progress rejects unknown identity and invalid steps and tolerates unavailable storage',()=>{
 const identity={scope:'test',userId:'15',lesson:'receiving'},values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 assert.equal(inlineProgressKey(null),null);assert.deepEqual(readInlineProgress(storage,null),{step:0,reviewed:false});
 for(const patch of [{userId:null},{userId:'name'},{userId:0},{scope:''},{lesson:'__proto__'},{lesson:'sale'}]){assert.equal(inlineProgressKey({...identity,...patch}),null);assert.equal(saveInlineProgress(storage,{...identity,...patch},{step:1,reviewed:false}),false);}
 for(const value of [{step:-1,reviewed:false},{step:4,reviewed:false},{step:1.5,reviewed:false},{step:2,reviewed:true},{step:3,reviewed:'yes'}]){
  assert.equal(saveInlineProgress(storage,identity,value),false);values.set(inlineProgressKey(identity),JSON.stringify(value));assert.deepEqual(readInlineProgress(storage,identity),{step:0,reviewed:false});
 }
 assert.deepEqual(readInlineProgress({getItem(){throw Error();}},identity),{step:0,reviewed:false});
 assert.equal(saveInlineProgress({setItem(){throw Error();}},identity,{step:1,reviewed:false}),false);
});
