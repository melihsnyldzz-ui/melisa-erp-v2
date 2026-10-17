import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{transformSync}=require('esbuild');
const source='PROMPT-2-20260923-01';
function fixture(){const run=runtime(),calls=[],pending=deferred(),storage=new Map();let tree;
 const data={source,invoiceId:'1',invoiceVersion:'0x0000000000000007',items:[{invoiceLineId:'2',receiptLineId:'3',receiptVersion:1,unit:'Adet',invoiceRemaining:'2.000',receiptRemaining:'1.000'}]};
 const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})},module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./ReceiptAllocationForm.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsxFactory:'React.createElement'}).code,
 {module,exports:module.exports,crypto:{randomUUID:()=> 'allocation-request-1'},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},require:s=>s==='react'?react:{allocatePurchaseReceiptLines:(...args)=>{calls.push(args);return pending.promise;}}});
 function render(){for(let i=0;i<20;i++){run.start();tree=module.exports.ReceiptAllocationForm({context:data});if(!run.finish())return;}throw Error('loop');}
 render();return{run,calls,pending,storage,data,render,enable(){data.commands={allocate:{enabled:true,source,invoiceId:data.invoiceId,invoiceVersion:data.invoiceVersion}};render()},change(i,v){nodes(tree,n=>n.type==='input')[i].props.onChange({target:{value:v}});render()},submit(){return nodes(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}})},get text(){return text(tree)}};
}
test('allocation form defaults closed, then exact versioned command validates zero stock result before clearing pending',async()=>{
 const h=fixture();h.change(0,'0.125');await h.submit();assert.equal(h.calls.length,0);h.enable();const p=h.submit();await h.submit();assert.equal(h.calls.length,1);
 const c=h.calls[0][1];assert.equal(c.expectedInvoiceVersion,h.data.invoiceVersion);assert.equal(c.allocations[0].quantity,'0.125');assert.equal(c.allocations[0].expectedReceiptVersion,1);
 h.pending.resolve({success:true,data:{source,invoiceId:'1',invoiceVersion:'0x0000000000000008',inventoryEffect:'0.000',allocations:[{...c.allocations[0],unit:'Adet'}]}});await p;assert.equal(h.storage.size,0);
});
test('shared receipt capacity is summed across pairs and unknown capacity cannot be posted',async()=>{
 const h=fixture();h.data.items.push({...h.data.items[0],invoiceLineId:'4'});h.enable();h.change(0,'0.750');h.change(1,'0.750');await h.submit();assert.equal(h.calls.length,0);h.render();assert.match(h.text,/aşıyor/);
 const g=fixture();g.data.items[0].receiptRemaining=null;g.enable();g.change(0,'0.125');await g.submit();assert.equal(g.calls.length,0);
});
test('unchanged version or stock effect retains pending; late error after close cannot update state',async()=>{
 const h=fixture();h.enable();h.change(0,'0.125');const p=h.submit();h.pending.resolve({success:true,data:{source,invoiceId:'1',invoiceVersion:h.data.invoiceVersion,inventoryEffect:'1',allocations:[]}});await p;assert.equal(h.storage.size,1);
 const g=fixture();g.enable();g.change(0,'0.125');const late=g.submit();g.run.unmount();const writes=g.run.writes;g.pending.reject(Error('late'));await late;assert.equal(g.run.writes,writes);assert.equal(g.storage.size,1);
});
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


