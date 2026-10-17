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
function text(tree){if(tree==null||typeof tree==='boolean')return '';if(Array.isArray(tree))return tree.map(text).join('');if(typeof tree!=='object')return String(tree);return text(tree.props?.children);}
function review(){const run=runtime(),calls=[],pending=deferred(),storage=new Map();let tree,saved=0;
 const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})},module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./CollectionNoticeReviewForm.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsxFactory:'React.createElement'}).code,{module,exports:module.exports,sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:{randomUUID:()=> 'review-request-1'},require:spec=>spec==='react'?react:{reviewCollectionNotice:(...args)=>{calls.push(args);return pending.promise;}}});
 const props={notice:{id:'8',source,version:0,status:'pending',reportedAmount:'10.1234',currency:'USD'},meta:{source,review:{noticeId:'8',version:0,reject:true,approve:true,correct_and_approve:true}},onSaved:()=>saved++};
 function render(){for(let i=0;i<20;i++){run.start();tree=module.exports.CollectionNoticeReviewForm(props);if(!run.finish())return;}throw Error('loop');}
 render();return{run,calls,pending,storage,props,get saved(){return saved;},render,change(type,index,value){nodes(tree,n=>n.type===type)[index].props.onChange({target:{value,checked:value}});render();},submit(){return tree.props.onSubmit({preventDefault(){}});}};
}
test('reject carries reason/date only and preserves normal version identity',async()=>{const h=review();h.change('input',0,'2026-09-24');h.change('textarea',0,'Yanlış bildirim');h.change('input',1,true);const p=h.submit();assert.equal(h.calls.length,1);assert.equal(h.calls[0][1],'reject');assert.equal('approvedAmount' in h.calls[0][2],false);h.pending.resolve({success:true,data:{source,noticeId:'8',version:1,status:'rejected'}});await p;assert.equal(h.saved,1);});
test('approve requires amount-bound duplicate evidence; exact correction stays string',async()=>{const h=review();h.change('select',0,'correct_and_approve');h.change('input',0,'10.1235');h.change('input',1,'2026-09-24');h.change('textarea',0,'Kayıtlı tutar düzeltmesi');h.change('input',2,true);await h.submit();assert.equal(h.calls.length,0);h.props.meta.review.duplicateEvidence={verified:true,source,noticeId:'8',currency:'USD',amount:'10.1235',ids:['9']};h.render();await h.submit();assert.equal(h.calls.length,0);h.change('input',2,true);const p=h.submit();assert.equal(h.calls[0][2].approvedAmount,'10.1235');assert.equal(h.calls[0][2].acknowledgedDuplicateIds[0],'9');h.pending.reject(Error('unknown'));await p;await h.submit();assert.equal(h.calls.length,1);assert.equal(h.storage.size,1);});
test('unmount prevents delayed error state changes',async()=>{const h=review();h.change('input',0,'2026-09-24');h.change('textarea',0,'Yanlış');h.change('input',1,true);const p=h.submit();h.run.unmount();const writes=h.run.writes;h.pending.reject(Error('late'));await p;assert.equal(h.run.writes,writes);});


