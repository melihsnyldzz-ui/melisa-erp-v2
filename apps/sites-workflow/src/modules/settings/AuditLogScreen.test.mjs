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
function screen(){const run=runtime(),calls=[],exports=[];let tree;const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})},module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./AuditLogScreen.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs'}).code,{module,exports:module.exports,AbortController,require:s=>s==='react'?react:s.includes('auditApi')?{fetchAuditLogs:(...args)=>{const d=deferred();calls.push({...d,args});return d.promise;},fetchAuditCoverage:()=>Promise.resolve({success:true,data:{coverage:[],summary:{coveredAreas:0,totalAreas:0,partialAreas:0,missingAreas:0}}})}:{exportRowsToExcel:()=>exports.push('excel'),printRowsReport:()=>exports.push('print')}});
 function render(){for(let i=0;i<20;i++){run.start();tree=module.exports.AuditLogScreen();if(!run.finish())return;}throw Error('loop');}render();return{calls,exports,run,render,get text(){return text(tree);},button(label){return nodes(tree,n=>n.type==='button'&&text(n)===label)[0];}};}
const flush=()=>new Promise(r=>setImmediate(r));
test('actual audit screen distinguishes failed read from zero and blocks exports during replacement request',async()=>{const h=screen();h.calls[0].reject(Error('unavailable'));await flush();h.render();assert.match(h.text,/Doğrulanmadı/);assert.equal(h.button('Excel').props.disabled,true);h.button('Yenile').props.onClick();h.calls[1].resolve({success:true,data:[{action:'new'}],meta:{}});await flush();h.render();assert.equal(h.button('Excel').props.disabled,false);h.button('Yenile').props.onClick();h.render();h.button('Excel').props.onClick();assert.equal(h.exports.length,0);});
test('actual audit screen ignores replaced success/error and unmounted requests',async()=>{for(const fail of [true,false]){const h=screen();h.button('Yenile').props.onClick();h.calls[1].resolve({success:true,data:[{action:'CURRENT'}],meta:{}});await flush();h.render();const writes=h.run.writes;if(fail)h.calls[0].reject(Error('OLD'));else h.calls[0].resolve({success:true,data:[{action:'OLD'}],meta:{}});await flush();assert.equal(h.run.writes,writes);h.render();assert.match(h.text,/CURRENT/);assert.doesNotMatch(h.text,/OLD/);h.button('Yenile').props.onClick();h.run.unmount();const closed=h.run.writes;h.calls[2].reject(Error('CLOSED'));await flush();assert.equal(h.run.writes,closed);}});

