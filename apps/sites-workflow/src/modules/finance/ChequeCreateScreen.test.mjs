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
function notice(enabled=false){
 const run=runtime(),pending=deferred(),calls=[],storage=new Map();let tree,initialDocument=null;
 const client={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('../../services/chequeApi.js',import.meta.url),'utf8'),{loader:'js',format:'cjs'}).code,{module:client,exports:client.exports,structuredClone,require:()=>({post:(path,body)=>{assert.equal(path,'/api/cheques');calls.push(body);return pending.promise;}})});
 const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})},module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./ChequeCreateScreen.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsxFactory:'React.createElement'}).code,{module,exports:module.exports,sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:{randomUUID:()=> 'notice-request-1'},require:spec=>spec==='react'?react:spec.endsWith('ChequeList.jsx')?{ChequeList:()=>null}:client.exports});
 const capability=enabled?{enabled:true,source,directions:['received'],sourceContext:{environment:'TEST',server:'Semih\\MELISADEV',database:'MELISA_ERP_FULL_TEST_20260916'}}:null;
 function render(){for(let i=0;i<20;i++){run.start();tree=module.exports.ChequeCreateScreen({capability,initialCheque:initialDocument});if(!run.finish())return;}throw Error('loop');}
 render();return{run,calls,pending,storage,get selection(){return nodes(tree,n=>Object.hasOwn(n.props,"initialCheque"))[0].props.initialCheque;},navigate(value){initialDocument=value;render();},get text(){return text(tree);},render,input(i,value){nodes(tree,n=>n.type==='input')[i].props.onChange({target:{value}});render();},submit(){return nodes(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});}};
}
test('cheque form is closed by default and sends no request',async()=>{const h=notice();await h.submit();assert.equal(h.calls.length,0);assert.match(h.text,/gönderim kapalı/);});
test('cheque form keeps draft separate from financial posting and retains unresolved request',async()=>{const h=notice(true);h.input(0,'8');h.input(1,'1.2345');h.input(2,'2026-10-01');h.input(3,'TEST');h.input(4,'00012');const p=h.submit();await h.submit();assert.equal(h.calls.length,1);assert.equal(h.calls[0].number,'00012');h.pending.resolve({success:true,data:{source,chequeId:'9',direction:'received',status:'draft',version:0}});await p;h.render();assert.equal(h.storage.size,0);assert.match(h.text,/Cari ve banka etkisi kesinleşmedi/);});
test('closed cheque form ignores late errors but keeps pending identity',async()=>{const h=notice(true);h.input(0,'8');h.input(1,'1');h.input(2,'2026-10-01');h.input(3,'TEST');h.input(4,'00012');const p=h.submit();h.run.unmount();const n=h.run.writes;h.pending.reject(Error('old'));await p;assert.equal(h.run.writes,n);assert.equal(h.storage.size,1);});

test('verified cheque create selects the native detail reader without overriding later navigation',async()=>{
 for(const navigate of [false,true]){
  const h=notice(true);h.input(0,'8');h.input(1,'1');h.input(2,'2026-10-01');h.input(3,'TEST');h.input(4,'00012');const p=h.submit();
  if(navigate){h.navigate({kind:'cheque',source:'/api/cheques',documentId:'12'});h.navigate(null);}
  h.pending.resolve({success:true,data:{source,chequeId:'9',direction:'received',status:'draft',version:0}});await p;h.render();
  assert.equal(h.selection?.documentId,navigate?undefined:'9');
  if(!navigate){assert.equal(h.selection.source,'/api/cheques');assert.equal(h.selection.kind,'cheque');}
  assert.equal(h.storage.size,0);
 }
});

test('actual client validation leaves invalid form editable and stores no pending command',async()=>{const h=notice(true);await h.submit();h.render();assert.equal(h.calls.length,0);assert.equal(h.storage.size,0);assert.match(h.text,/alanlarını kontrol edin/);h.input(0,'8');h.input(1,'0.0001');h.input(2,'2026-10-01');h.input(3,'TEST');h.input(4,'0001');const p=h.submit();assert.equal(h.calls.length,1);h.pending.reject(Error('unknown'));await p;assert.equal(h.storage.size,1);});

