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
function harness(){
 const run=runtime(),lists=[],details=[],cache=new Map();let props={},tree;
 const api={fetchProducts:(...args)=>{const d=deferred();lists.push({...d,args});return d.promise;},fetchProductDetail:(...args)=>{const d=deferred();details.push({...d,args});return d.promise;}};
 const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})};
 function compile(url){
  if(cache.has(url.href))return cache.get(url.href);const module={exports:{}};
  const code=transformSync(readFileSync(url,'utf8'),{loader:'jsx',format:'cjs',target:'es2022',jsxFactory:'React.createElement'}).code;
  vm.runInNewContext(code,{module,exports:module.exports,AbortController,Intl,Date,console,require:spec=>{
   if(spec==='react')return react;
   if(spec==='lucide-react')return new Proxy({}, {get:(_,key)=>key});
   if(spec.endsWith('productApi.js')||spec.endsWith('productDetailApi.js'))return api;
   if(spec.endsWith('.css'))return {};
   throw Error('Unexpected import '+spec);
  }});cache.set(url.href,module.exports);return module.exports;
 }
 const Component=compile(new URL('./ReadOnlyStockWorkbench.jsx',import.meta.url)).ReadOnlyStockWorkbench;
 function render(){for(let i=0;i<30;i++){run.start();tree=Component(props);if(!run.finish())return tree;}throw Error('Render did not settle');}
 render();return {lists,details,run,render,get tree(){return tree;},get text(){return text(tree).replace(/\s+/g,' ').trim();},find:p=>nodes(tree,p),setProps(p){props={...props,...p};render();},async flush(){for(let i=0;i<8;i++)await Promise.resolve();render();}};
}

const product=(id,name,stock)=>({id,productName:name,stockCode:`SKU-${id}`,stockQuantity:stock,unit:'adet',category:'A',brand:'B'});
const response=data=>({success:true,data,meta:{total:Array.isArray(data)?data.length:1}});
test('stock filtering replaces hidden selection and clears detail when no row matches',async()=>{
 const h=harness(),a=product(1,'POSITIVE',20),b=product(2,'NEGATIVE',-3);
 h.lists[0].resolve(response([a,b]));await h.flush();h.details[0].resolve(response(a));await h.flush();
 const select=h.find(n=>n.type==='select'&&n.props.value==='all')[2];select.props.onChange({target:{value:'negative'}});h.render();
 assert.equal(h.details.at(-1).args[0],2);h.details.at(-1).resolve(response(b));await h.flush();
 const panel=h.find(n=>n.props?.['aria-label']==='Seçili ürün ayrıntısı')[0];assert.match(text(panel),/NEGATIVE/);assert.doesNotMatch(text(panel),/POSITIVE/);
 h.find(n=>n.type==='select'&&n.props.value==='negative')[0].props.onChange({target:{value:'zero'}});h.render();
 assert.equal(h.find(n=>n.props?.['aria-label']==='Seçili ürün ayrıntısı').length,0);
});
test('stock detail rejects wrong identity and refresh reloads the selected detail',async()=>{
 const h=harness(),a=product(1,'PRODUCT',20);h.lists[0].resolve(response([a]));await h.flush();
 h.details[0].resolve(response(product(2,'WRONG',9)));await h.flush();assert.match(h.text,/ayrıntı kimliği eşleşmedi/);assert.doesNotMatch(h.text,/WRONG/);
 h.find(n=>n.type==='button'&&text(n).includes('Yenile'))[0].props.onClick();h.render();assert.equal(h.details.length,2);
});
