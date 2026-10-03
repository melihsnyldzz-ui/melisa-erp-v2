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
function createHarness(enabled=true,observed=[{id:'7',version:2}]){
 const run=runtime(),calls=[],storage=new Map();let tree,created=null,selected=null;
 const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})},module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./ReceiptCreateForm.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsxFactory:'React.createElement'}).code,{module,exports:module.exports,AbortController,sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:{randomUUID:()=> 'create-request-1'},require:spec=>spec==='react'?react:spec.endsWith('receiptApi.js')?{fetchInventoryReceipts:async()=>({success:true,meta:{source,readAt:'2026-09-24T12:00:00Z',creation:{supplierId:'8',enabled,observedOpenReceipts:observed}}})}:{createInventoryReceipt:async body=>{calls.push(body);return{success:true,data:{id:'9',source,supplierId:'8',version:0,status:'draft'}};}}});
 function render(){for(let i=0;i<20;i++){run.start();tree=module.exports.ReceiptCreateForm({source,supplierId:'8',onCreated:id=>created=id,onSelectExisting:row=>selected=row});if(!run.finish())return;}throw Error('loop');}
 render();return{calls,storage,get created(){return created;},get selected(){return selected;},openExisting(){const button=nodes(tree,n=>n.type==='button'&&text(n).includes('Mevcut kabul'))[0];button?.props.onClick();render();},async inspect(){await nodes(tree,n=>n.type==='button')[0].props.onClick();render();},input(type,value){nodes(tree,n=>n.type==='input'&&n.props.type===type)[0].props.onChange({target:{value,checked:value}});render();},submit(){return nodes(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});}};
}
test('actual create form uses complete observed revisions, date and one stable command',async()=>{const h=createHarness();await h.inspect();h.input('checkbox',true);h.input('date','2026-09-24');await h.submit();assert.equal(h.calls.length,1);assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].observedOpenReceipts)),[{id:'7',version:2}]);assert.equal(h.calls[0].supplierId,'8');assert.equal(h.created,'9');assert.equal(h.storage.size,0);await h.submit();assert.equal(h.calls.length,1);});
test('actual create form needs explicit capability and acknowledgment',async()=>{for(const enabled of [false,true]){const h=createHarness(enabled);await h.inspect();h.input('date','2026-09-24');if(!enabled)h.input('checkbox',true);await h.submit();assert.equal(h.calls.length,0);}});
test('existing receipt selection carries source and identity without creating or authorizing a new receipt',async()=>{
 const h=createHarness();await h.inspect();h.input('checkbox',true);h.input('date','2026-09-24');h.openExisting();
 assert.deepEqual(JSON.parse(JSON.stringify(h.selected)),{source,id:'7'});await h.submit();assert.equal(h.calls.length,0);
 const readOnly=createHarness(false);await readOnly.inspect();readOnly.openExisting();assert.equal(readOnly.selected.id,'7');assert.equal(readOnly.calls.length,0);
});
test('invalid or duplicate observed receipt identity cannot become a navigation or create target',async()=>{
 for(const rows of [[{id:'9223372036854775808',version:0}],[{id:'7',version:-1}],[{id:'7',version:0},{id:'7',version:1}]]){
  const h=createHarness(true,rows);await h.inspect();h.openExisting();await h.submit();assert.equal(h.selected,null);assert.equal(h.calls.length,0);
 }
});

