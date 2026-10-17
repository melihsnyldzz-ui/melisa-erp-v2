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
function transitionHarness(status='submitted'){
 const run=runtime(),pending=deferred(),calls=[],storage=new Map();let tree,saved=0;
 const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})},module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./ReceiptTransitionForm.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsxFactory:'React.createElement'}).code,{module,exports:module.exports,sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:{randomUUID:()=> 'transition-request-1'},require:spec=>spec==='react'?react:{transitionInventoryReceipt:(...args)=>{calls.push(args);return pending.promise;}}});
 const props={receipt:{id:'42',source,version:2,status,lines:[{id:'8',quantity:'1.000',unit:'adet'}]},meta:{source,readOnly:false,commands:{receiptId:'42',version:2,submit:true,return:true,approve:true,correct:true}},onSaved:()=>saved++};
 function render(){for(let i=0;i<20;i++){run.start();tree=module.exports.ReceiptTransitionForm(props);if(!run.finish())return;}throw Error('loop');}
 render();return{run,pending,calls,storage,props,get saved(){return saved;},get text(){return text(tree);},render,change(type,index,value){nodes(tree,n=>n.type===type)[index].props.onChange({target:{value,checked:value}});render();},submit(){return tree.props.onSubmit({preventDefault(){}});}};
}
test('approve uses exact revision and one pending request; success clears it',async()=>{const h=transitionHarness();h.change('select',0,'approve');h.change('input',0,true);const p=h.submit();await h.submit();assert.equal(h.calls.length,1);assert.equal(h.calls[0][1],'approve');assert.equal(h.calls[0][2].expectedVersion,2);h.pending.resolve({success:true,data:{id:'42',source,version:3,status:'approved'}});await p;assert.equal(h.saved,1);assert.equal(h.storage.size,0);});
test('correction requires a recorded line and reason; preserves exact zero',async()=>{const h=transitionHarness('approved');h.change('input',1,true);await h.submit();assert.equal(h.calls.length,0);h.change('textarea',0,'Kayıt düzeltmesi');h.change('select',1,'8');h.change('input',0,'0.000');h.change('input',1,true);const p=h.submit();assert.equal(h.calls[0][2].quantities[0].quantity,'0.000');h.pending.reject(Error('unknown'));await p;assert.equal(h.storage.size,1);assert.equal(h.saved,0);await h.submit();assert.equal(h.calls.length,1);});
test('closed capability and another pending command prevent transition',async()=>{const h=transitionHarness();h.change('select',0,'approve');h.change('input',0,true);h.props.meta.commands.approve=false;h.render();await h.submit();assert.equal(h.calls.length,0);h.props.meta.commands.approve=true;h.render();h.storage.set(`melisa.receipt.pending:${source}:42`,'other command');await h.submit();assert.equal(h.calls.length,0);});
test('closing panel ignores late success without replaying',async()=>{const h=transitionHarness();h.change('select',0,'approve');h.change('input',0,true);const p=h.submit();h.run.unmount();const writes=h.run.writes;h.pending.resolve({success:true,data:{id:'42',source,version:3,status:'approved'}});await p;assert.equal(h.run.writes,writes);assert.equal(h.saved,0);});
test('correction displays exact delta, distinguishes missing quantity and requires acknowledgment after edits',async()=>{
 const h=transitionHarness('approved');h.props.receipt.lines[0].quantity='12345678901234.1234';h.render();
 h.change('select',1,'8');h.change('input',0,'12345678901234.124');
 assert.match(h.text,/Miktar farkı: \+0\.00060000 adet/);
 h.change('textarea',0,'Düzeltme');h.change('input',1,true);h.change('input',0,'0.000');
 assert.match(h.text,/Miktar farkı: -12345678901234\.12340000/);await h.submit();assert.equal(h.calls.length,0);
 h.props.receipt.lines[0].quantity=null;h.render();assert.match(h.text,/Miktar farkı doğrulanmadı/);
});

