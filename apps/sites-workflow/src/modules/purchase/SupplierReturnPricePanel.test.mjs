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
function panel(){
 const run=runtime(),calls=[],props={source,productId:'1',unit:'Adet',currency:'USD',context:{environment:'TEST',server:'TEST-SERVER',database:'TEST-DB'}};let tree;
 const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})},module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./SupplierReturnPricePanel.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs'}).code,{module,exports:module.exports,AbortController,require:s=>s==='react'?react:{fetchSupplierReturnPrice:(...args)=>{const p=deferred();calls.push({...p,args});return p.promise;}}});
 function render(){for(let i=0;i<20;i++){run.start();tree=module.exports.SupplierReturnPricePanel(props);if(!run.finish())return;}throw Error('loop');}render();
 return{run,calls,props,render,get text(){return text(tree);},result(productId='1'){return{success:true,meta:{readOnly:true,sourceContext:props.context},data:{source,productId,unit:'Adet',currency:'USD',readOnly:true,unitPrice:'12345678901234.12340000',purpose:'COMMERCIAL_RETURN_PRICE_ONLY',inventoryCostIncluded:false,selectionBasis:'invoiceDraftService.recalculateProductAverageCostTry:document_date,id,item_id',priceInvoiceId:'2',priceItemId:'3',priceSupplierId:'4',priceInvoiceVersion:'0x0000000000000001',priceDocumentDate:'2026-09-23',readAtUtc:'2026-09-24T12:00:00Z'}};}};
}
const flush=()=>new Promise(r=>setImmediate(r));
test('actual return panel preserves exact recorded price including zero, rejects missing price and foreign identity',async()=>{
 for(const variant of ['exact','zero','null','foreign']){const h=panel();await flush();const r=h.result();if(variant==='zero')r.data.unitPrice='0.00000000';if(variant==='null')r.data.unitPrice=null;if(variant==='foreign')r.data.productId='9';h.calls[0].resolve(r);await flush();h.render();if(variant==='exact')assert.match(h.text,/12345678901234,12340000/);else if(variant==='zero')assert.match(h.text,/0,00000000/);else{assert.match(h.text,/Tutar doğrulanmadı/);assert.doesNotMatch(h.text,/12345678901234/);}}
});
test('actual return effect ignores late old success/error and updates nothing after unmount',async()=>{
 for(const oldError of [false,true]){const h=panel();await flush();h.props.productId='5';h.render();await flush();assert.equal(h.calls[0].args[1].signal.aborted,true);h.calls[1].resolve(h.result('5'));await flush();h.render();const before=h.text,writes=h.run.writes;if(oldError)h.calls[0].reject(Error('OLD'));else h.calls[0].resolve(h.result('1'));await flush();assert.equal(h.run.writes,writes);h.render();assert.equal(h.text,before);h.props.productId='6';h.render();await flush();h.run.unmount();const closed=h.run.writes;h.calls[2].reject(Error('CLOSED'));await flush();assert.equal(h.run.writes,closed);}
});

