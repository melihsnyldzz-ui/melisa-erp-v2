import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('green entry and generated screen templates do not require inline script or event permission',()=>{
 for(const path of ['index.html','is-akisi-taslagi.html']){
  const text=read(path);for(const [,attributes,body] of text.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
   assert.match(attributes,/\bsrc=/,path);assert.equal(body.trim(),'',path);
  }
 }
 for(const path of ['is-akisi-taslagi.html','public/workflow-screen.js','public/workflow-settlement-ui.js'])assert.doesNotMatch(read(path),/\bon(?:click|submit|input|change|keydown)="/);
 assert.doesNotMatch(read('public/workflow-events.js'),/\beval\s*\(|new Function/);
});
test('fixed event routing preserves dynamic row, input, form and navigation behavior without executing attribute text',()=>{
 const listeners={},seen=[];
 const context={document:{addEventListener:(type,fn)=>listeners[type]=fn},showProduct:n=>seen.push(['product',n]),go:n=>seen.push(['go',n]),greenCollect:e=>{e.preventDefault();seen.push(['collect'])}};
 vm.runInNewContext(read('public/workflow-events.js'),context);
 const source=read('public/workflow-events.js');
 const invoke=(code,type,dataset={})=>{
  const key=source.split('\n').find(x=>x.includes(code)).split(':')[0];
  const target={dataset,getAttribute:()=>key};let prevented=false;
  listeners[type]({target:{closest:()=>target},preventDefault:()=>prevented=true});return prevented;
 };
 invoke('showProduct(Number','click',{wfArg0:'3'});
 invoke('go(this.dataset','click',{wfArg0:'goods'});
 assert.equal(invoke('greenCollect(event)','submit'),true);
 assert.deepEqual(seen,[['product',3],['go','goods'],['collect']]);
 const target={getAttribute:()=>"go('danger')"};listeners.click({target:{closest:()=>target}});assert.equal(seen.length,3);
});
