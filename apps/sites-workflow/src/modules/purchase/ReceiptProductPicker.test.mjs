import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{transformSync}=require('esbuild');
const source='PROMPT-2-20260923-01';
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const eq=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
function runtime(){
 const slots=[];let cursor=0,dirty=false,effects=[],writes=0;
 const hooks={
  useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:typeof initial==='function'?initial():initial};return [slots[i].value,value=>{writes++;const next=typeof value==='function'?value(slots[i].value):value;if(!Object.is(next,slots[i].value)){slots[i].value=next;dirty=true;}}];},
  useRef(initial){const i=cursor++;if(!slots[i])slots[i]={value:{current:initial}};return slots[i].value;},
  useEffect(effect,deps){const i=cursor++,old=slots[i];if(!old||!eq(old.deps,deps)){effects.push({i,effect,cleanup:old?.cleanup});slots[i]={deps,cleanup:old?.cleanup};}},
  useMemo(fn,deps){const i=cursor++;if(!slots[i]||!eq(slots[i].deps,deps))slots[i]={deps,value:fn()};return slots[i].value;}
 };
 return {hooks,start(){cursor=0;dirty=false;effects=[];},finish(){for(const e of effects){e.cleanup?.();slots[e.i].cleanup=e.effect();}return dirty;},unmount(){for(const s of slots)s.cleanup?.();},get writes(){return writes;}};
}
function nodes(tree,predicate,out=[]){if(Array.isArray(tree)){for(const t of tree)nodes(t,predicate,out);}else if(tree&&typeof tree==='object'){if(predicate(tree))out.push(tree);nodes(tree.props?.children,predicate,out);}return out;}
function text(tree){if(tree==null||typeof tree==='boolean')return '';if(Array.isArray(tree))return tree.map(text).join(' ');if(typeof tree!=='object')return String(tree);return text(tree.props?.children);}
function picker(){
 const run=runtime(),calls=[],selected=[];let tree;const context={environment:'TEST',server:'TEST-SERVER',database:'TEST-DB'};
 const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})},module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./ReceiptProductPicker.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsxFactory:'React.createElement'}).code,{module,exports:module.exports,AbortController,require:spec=>spec==='react'?react:{fetchProducts:(...args)=>{const d=deferred();calls.push({...d,args});return d.promise;}}});
 function render(){for(let i=0;i<20;i++){run.start();tree=module.exports.ReceiptProductPicker({context,onSelect:id=>selected.push(id)});if(!run.finish())return;}throw Error('loop');}
 render();return{calls,selected,run,context,get tree(){return tree;},render,query(value){nodes(tree,n=>n.type==='input')[0].props.onChange({target:{value}});render();},search(){return nodes(tree,n=>n.type==='button')[0].props.onClick();},select(value){nodes(tree,n=>n.type==='select')[0].props.onChange({target:{value}});},result(id='9007199254740993',source=context){return{success:true,data:[{id,name:'Ürün',purchasePrice:'PRIVATE'}],meta:{sourceContext:source,readAt:'2026-09-24T12:00:00Z'}};}};
}
test('real picker uses existing product API, validates context, only returns exact ID',async()=>{const h=picker();h.query('00012');const p=h.search();assert.equal(h.calls[0].args[0].search,'00012');assert.equal(h.calls[0].args[0].limit,20);h.calls[0].resolve(h.result());await p;h.render();h.select('9007199254740993');assert.equal(h.selected.at(-1),'9007199254740993');assert.doesNotMatch(text(h.tree),/PRIVATE/);h.select('999');assert.equal(h.selected.at(-1),'');});
test('real picker ignores late old result/error and aborts on close',async()=>{const h=picker();h.query('old');const old=h.search();h.query('new');const next=h.search();h.calls[1].resolve(h.result('2'));await next;h.render();h.calls[0].reject(Error('old failure'));await old;h.render();assert.doesNotMatch(text(h.tree),/old failure/);h.select('2');assert.equal(h.selected.at(-1),'2');h.query('closing');const p=h.search();h.run.unmount();const writes=h.run.writes;h.calls[2].resolve(h.result('3'));await p;assert.equal(h.run.writes,writes);});
test('real picker rejects foreign source and rounded numeric ID',async()=>{for(const bad of ['source','id']){const h=picker();h.query('x');const p=h.search();h.calls[0].resolve(bad==='source'?h.result('2',{...h.context,database:'OTHER'}):h.result(9007199254740992));await p;h.render();assert.equal(nodes(h.tree,n=>n.type==='select').length,0);assert.match(text(h.tree),/doğrulanamadı/);}});

