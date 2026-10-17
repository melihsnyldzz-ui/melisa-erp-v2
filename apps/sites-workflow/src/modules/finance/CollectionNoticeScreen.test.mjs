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
 const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})},module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./CollectionNoticeScreen.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsxFactory:'React.createElement'}).code,{module,exports:module.exports,sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:{randomUUID:()=> 'notice-request-1'},require:spec=>spec==='react'?react:spec.endsWith('CollectionNoticeList.jsx')?{CollectionNoticeList:()=>null}:{createCollectionNotice:body=>{calls.push(body);return pending.promise;}}});
 const capability=enabled?{enabled:true,source,sourceContext:{environment:'TEST',server:'Semih\\MELISADEV',database:'MELISA_ERP_FULL_TEST_20260916'}}:null;
 function render(){for(let i=0;i<20;i++){run.start();tree=module.exports.CollectionNoticeScreen({capability,initialNotice:initialDocument});if(!run.finish())return;}throw Error('loop');}
 render();return{run,calls,pending,storage,get selection(){return nodes(tree,n=>Object.hasOwn(n.props,"initialNotice"))[0].props.initialNotice;},navigate(value){initialDocument=value;render();},get text(){return text(tree);},render,input(i,value){nodes(tree,n=>n.type==='input')[i].props.onChange({target:{value}});render();},submit(){return nodes(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});}};
}
test('default TEST screen issues no startup or submit request',async()=>{const h=notice();h.input(0,'8');h.input(1,'0.1250');h.input(2,'2026-09-24');await h.submit();assert.equal(h.calls.length,0);assert.match(h.text,/gönderim kapalı/);});
test('notice uses exact amount and one request, success stays pending not paid',async()=>{const h=notice(true);h.input(0,'9007199254740993');h.input(1,'0.1250');h.input(2,'2026-09-24');const p=h.submit();await h.submit();assert.equal(h.calls.length,1);assert.equal(h.calls[0].reportedAmount,'0.1250');h.pending.resolve({success:true,data:{source,noticeId:'9',status:'pending',version:0}});await p;h.render();assert.equal(h.storage.size,0);assert.match(h.text,/Tahsilat kesinleşmedi/);});
test('closed screen ignores late error and keeps unresolved request',async()=>{const h=notice(true);h.input(0,'8');h.input(1,'1');h.input(2,'2026-09-24');const p=h.submit();h.run.unmount();const writes=h.run.writes;h.pending.reject(Error('unknown'));await p;assert.equal(h.run.writes,writes);assert.equal(h.storage.size,1);});

test('verified create selects its exact native notice reader; late create cannot replace navigation',async()=>{
 for(const navigate of [false,true]){
  const h=notice(true);h.input(0,'8');h.input(1,'1');h.input(2,'2026-09-24');const p=h.submit();
  if(navigate){h.navigate({kind:'collection_notice',source:'/api/collection-notices',documentId:'12'});h.navigate(null);}
  h.pending.resolve({success:true,data:{source,noticeId:'9',status:'pending',version:0}});await p;h.render();
  assert.equal(h.selection?.documentId,navigate?undefined:'9');
  if(!navigate){assert.equal(h.selection.source,'/api/collection-notices');assert.equal(h.selection.kind,'collection_notice');}
  assert.equal(h.storage.size,0);
 }
});


