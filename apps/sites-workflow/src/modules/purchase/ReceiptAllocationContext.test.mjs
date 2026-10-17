import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{transformSync}=require('esbuild');
const source='PROMPT-2-20260923-01';
function harness(){
 const run=runtime(),calls=[],invoice={id:'1',supplierId:'2',invoiceVersion:'0x0000000000000007',status:'DRAFT',documentCurrency:'TRY'};let tree;
 const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})},module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./ReceiptAllocationContext.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsxFactory:'React.createElement'}).code,
  {module,exports:module.exports,AbortController,require:s=>s==='react'?react:{get:(...args)=>{const d=deferred();calls.push({...d,args});return d.promise;}}});
 function render(){for(let i=0;i<20;i++){run.start();tree=module.exports.ReceiptAllocationContext({invoice});if(!run.finish())return;}throw Error('loop');}
 render();return{run,calls,invoice,render,get text(){return text(tree)},read(){const p=nodes(tree,n=>n.type==='button')[0].props.onClick();render();return p}};
}
const result=(patch={})=>({success:true,data:{source,invoiceId:'1',supplierId:'2',invoiceVersion:'0x0000000000000007',currency:'TRY',readOnly:true,
 sourceContext:{environment:'TEST',server:'Semih\\MELISADEV',database:'MELISA_ERP_FULL_TEST_20260916'},readAt:'2026-09-24T14:00:00Z',capacityScope:'RECORDED_ACTIVE_ALLOCATIONS_AT_READ_TIME',
 items:[{invoiceLineId:'3',receiptLineId:'4',receiptId:'5',productId:'6',unit:'Adet',invoiceRemaining:'0.000',receiptRemaining:null}],...patch}});
test('actual allocation context loads only explicitly and preserves zero/unknown with source time',async()=>{
 const h=harness();assert.equal(h.calls.length,0);const p=h.read();assert.equal(h.calls[0].args[1].invoiceVersion,h.invoice.invoiceVersion);
 h.calls[0].resolve(result());await p;h.render();assert.match(h.text,/Alışta kalan: 0.000/);assert.match(h.text,/Kabulde kalan: Doğrulanmadı/);assert.match(h.text,/2026-09-24T14:00:00Z/);assert.match(h.text,/gönderimi kapalı/);
});
test('changed document or closed panel rejects late success and error; mismatched identity stays error',async()=>{
 const h=harness(),old=h.read();h.invoice.id='9';h.render();h.calls[0].resolve(result());await old;h.render();assert.doesNotMatch(h.text,/Alışta kalan/);
 h.invoice.id='1';h.render();const bad=h.read();h.calls[1].resolve(result({supplierId:'999'}));await bad;h.render();assert.match(h.text,/doğrulanamadı/);assert.doesNotMatch(h.text,/eşleşme bulunamadı/);
 const late=h.read();h.run.unmount();const writes=h.run.writes;h.calls[2].reject(Error('old'));await late;assert.equal(h.run.writes,writes);
});
test('missing version or finalized invoice cannot read',async()=>{const h=harness();h.invoice.invoiceVersion=undefined;h.render();await h.read();assert.equal(h.calls.length,0);h.invoice.invoiceVersion='0x0000000000000007';h.invoice.status='FINALIZED';h.render();await h.read();assert.equal(h.calls.length,0)});
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


