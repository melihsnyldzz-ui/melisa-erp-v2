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
function screen(){
 const run=runtime(),opened=[];let tree;
 const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})},module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./SupplierReturnReadScreen.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs'}).code,{module,exports:module.exports,require:s=>s==='react'?react:s.includes('ReceiptProductPicker')?{ReceiptProductPicker:'Picker'}:{SupplierReturnPricePanel:'Price'}});
 function render(){for(let i=0;i<20;i++){run.start();tree=module.exports.SupplierReturnReadScreen({onOpenScreen:(...args)=>opened.push(args)});if(!run.finish())return;}throw Error('loop');}render();
 return{opened,get price(){return nodes(tree,n=>n.type==='Price')[0];},get unit(){return nodes(tree,n=>n.type==='input')[0].props.value;},get currency(){return nodes(tree,n=>n.type==='select')[0].props.value;},product(id){nodes(tree,n=>n.type==='Picker')[0].props.onSelect(id);render();},unitChange(v){nodes(tree,n=>n.type==='input')[0].props.onChange({target:{value:v}});render();},currencyChange(v){nodes(tree,n=>n.type==='select')[0].props.onChange({target:{value:v}});render();},submit(){nodes(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});render();},back(){nodes(tree,n=>n.type==='button')[0].props.onClick();}};
}
test('actual return screen composes selected identity only after explicit read and clears price on any context edit',()=>{
 const h=screen();h.submit();assert.equal(h.price,undefined);h.product('9007199254740993');h.unitChange('Adet');h.currencyChange('USD');assert.equal(h.price,undefined);h.submit();assert.equal(h.price.props.productId,'9007199254740993');assert.equal(h.price.props.unit,'Adet');assert.equal(h.price.props.currency,'USD');assert.equal(h.price.props.source,source);
 h.unitChange('Koli');assert.equal(h.price,undefined);h.submit();assert.equal(h.price.props.unit,'Koli');h.currencyChange('EUR');assert.equal(h.price,undefined);h.submit();h.product('2');assert.equal(h.price,undefined);assert.equal(h.unit,'');assert.equal(h.currency,'');h.submit();assert.equal(h.price,undefined);h.back();assert.equal(h.opened[0][0],'purchase-invoice-list');assert.equal(Object.keys(h.opened[0][1]).length,0);
});

