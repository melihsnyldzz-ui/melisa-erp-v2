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
 const api={fetchInventoryReceipts:(...args)=>{const d=deferred();lists.push({...d,args});return d.promise;},fetchInventoryReceipt:(...args)=>{const d=deferred();details.push({...d,args});return d.promise;}};
 const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})};
 function compile(url){
  if(cache.has(url.href))return cache.get(url.href);const module={exports:{}};
  const code=transformSync(readFileSync(url,'utf8'),{loader:'jsx',format:'cjs',target:'es2022',jsxFactory:'React.createElement'}).code;
  vm.runInNewContext(code,{module,exports:module.exports,AbortController,Intl,Date,console,require:spec=>{
   if(spec==='react')return react;if(spec.endsWith('receiptApi.js'))return api;
   if(spec.endsWith('ReceiptTransitionForm.jsx'))return {ReceiptTransitionForm:()=>null};
   if(spec.endsWith('ReceiptCreateForm.jsx'))return {ReceiptCreateForm:()=>null};
   if(spec.endsWith('ReceiptDraftLineForm.jsx'))return {ReceiptDraftLineForm:()=>null};
   if(spec.endsWith('SalesInverseContext.jsx'))return {SalesInverseContext:()=>null};
   if(spec.endsWith('ReceiptAllocationContext.jsx'))return {ReceiptAllocationContext:()=>null};
   if(spec.endsWith('ReadOnlyInvoiceListScreen.jsx'))return compile(new URL('../shared/ReadOnlyInvoiceListScreen.jsx',import.meta.url));
   if(spec.endsWith('invoiceDraftApi.js'))return {};throw Error('Unexpected import '+spec);
  }});cache.set(url.href,module.exports);return module.exports;
 }
 const Component=compile(new URL('./ReceiptReadScreen.jsx',import.meta.url)).ReceiptReadScreen;
 function render(){for(let i=0;i<30;i++){run.start();tree=Component(props);if(!run.finish())return tree;}throw Error('Render did not settle');}
 render();return {lists,details,run,render,get tree(){return tree;},get text(){return text(tree).replace(/\s+/g,' ').trim();},find:p=>nodes(tree,p),setProps(p){props={...props,...p};render();},async flush(){for(let i=0;i<8;i++)await Promise.resolve();render();}};
}
function row(id,label='Kabul '+id){return {id,source,supplierId:'2',documentNo:label,documentDate:'2026-09-24',status:'draft'};}
function response(data,meta={}){return {success:true,data,meta:{source,readAt:'2026-09-24T00:20:00Z',sourceContext:{environment:'TEST',server:'SYNTHETIC',database:'SYNTHETIC'},page:1,pageSize:4,total:Array.isArray(data)?data.length:1,hasNextPage:false,outOfRange:false,...meta}};}
function detail(id,label){return response({...row(id,label),dispatchNumberState:'unverified',dispatchNumber:null,lineScope:'own_personnel_lines',billingStatus:null,lines:[{id:'11',productId:'12',countedBy:'7',quantity:'0.00000000',allocatedQuantity:'0.000',unit:'adet',resolution:'verified'}]});}
function filter(h,value){h.find(n=>n.type==='select'&&n.props['aria-label']==='Kabul durumu')[0].props.onChange({target:{value}});h.render();}
function choose(h,id){const n=h.find(n=>n.type==='tr'&&n.props.onClick&&new RegExp('Kaynak ID #\\s*'+id+'(?:\\s|$)').test(text(n)))[0];assert.ok(n);n.props.onClick();h.render();}
test('actual receipt component ignores old list success and error after a newer filter response',async()=>{
 const h=harness();filter(h,'submitted');h.lists[1].resolve(response([row('2','NEW-RESULT')]));await h.flush();const writes=h.run.writes;
 h.lists[0].resolve(response([row('1','OLD-RESULT')]));await h.flush();assert.equal(h.run.writes,writes);assert.match(h.text,/NEW-RESULT/);assert.doesNotMatch(h.text,/OLD-RESULT/);assert.equal(h.lists[0].args[1].signal.aborted,true);
 filter(h,'draft');const old=h.lists[2];filter(h,'approved');h.lists[3].resolve(response([row('3','LAST-RESULT')]));await h.flush();const after=h.run.writes;
 old.reject(Error('OLD-ERROR'));await h.flush();assert.equal(h.run.writes,after);assert.match(h.text,/LAST-RESULT/);assert.doesNotMatch(h.text,/OLD-ERROR/);
});
test('actual receipt component protects selected detail from old success/error and close prevents it reopening',async()=>{
 const h=harness();h.lists[0].resolve(response([row('1'),row('2')]));await h.flush();choose(h,'1');choose(h,'2');h.details[1].resolve(detail('2','DETAIL-NEW'));await h.flush();const writes=h.run.writes;
 h.details[0].resolve(detail('1','DETAIL-OLD'));await h.flush();assert.equal(h.run.writes,writes);assert.match(h.text,/DETAIL-NEW/);assert.doesNotMatch(h.text,/DETAIL-OLD/);
 choose(h,'1');const late=h.details[2];h.find(n=>n.props?.['aria-label']==='Kabul ayrıntısını kapat')[0].props.onClick();h.render();const closed=h.run.writes;
 late.reject(Error('CLOSED-OLD-ERROR'));await h.flush();assert.equal(h.run.writes,closed);assert.equal(h.find(n=>n.type==='aside').length,0);assert.doesNotMatch(h.text,/CLOSED-OLD-ERROR/);
});
test('actual receipt component clears selection on source change and unmount cancels pending setters',async()=>{
 const h=harness();h.lists[0].resolve(response([row('1')]));await h.flush();choose(h,'1');const late=h.details[0];h.setProps({source:'SECOND-SYNTHETIC'});
 const before=h.run.writes;late.resolve(detail('1','WRONG-SOURCE'));await h.flush();assert.equal(h.run.writes,before);assert.equal(h.find(n=>n.type==='aside').length,0);assert.doesNotMatch(h.text,/WRONG-SOURCE/);
 const pending=h.lists.at(-1);h.run.unmount();const stopped=h.run.writes;pending.reject(Error('AFTER-UNMOUNT'));for(let i=0;i<8;i++)await Promise.resolve();assert.equal(h.run.writes,stopped);assert.equal(pending.args[1].signal.aborted,true);
});
test('actual receipt component keeps out-of-range total, resets filter page and distinguishes source failure from empty results',async()=>{
 const h=harness();h.lists[0].resolve(response([row('1')],{total:5,hasNextPage:true}));await h.flush();h.find(n=>n.type==='button'&&text(n)==='Sonraki')[0].props.onClick();h.render();assert.equal(h.lists[1].args[0].page,2);
 h.lists[1].resolve(response([],{page:2,total:5,outOfRange:true}));await h.flush();assert.match(h.text,/5 kayıt/);assert.match(h.text,/toplam korunuyor/);filter(h,'draft');assert.equal(h.lists[2].args[0].page,1);
 h.lists[2].reject(Error('SOURCE-NOT-READY'));await h.flush();assert.match(h.text,/SOURCE-NOT-READY/);assert.doesNotMatch(h.text,/Bu filtrelerde kabul kaydı yok/);
});
test('actual receipt detail displays zero and unresolved unit snapshot without purchase/cost or mutation controls',async()=>{
 const h=harness();h.lists[0].resolve(response([row('1')]));await h.flush();choose(h,'1');const d=detail('1','READ-ONLY');d.data.lines.push({id:'22',productId:null,unit:null,quantity:'0.000',allocatedQuantity:'0',resolution:'unresolved',countedBy:'7',barcode:'0000123',supplierModelCode:'000AB'});h.details[0].resolve(d);await h.flush();
 assert.match(h.text,/0 adet/);assert.match(h.text,/Birim doğrulanmadı/);assert.match(h.text,/Ürün kimliği çözülmedi/);assert.match(h.text,/0000123/);assert.match(h.text,/000AB/);assert.doesNotMatch(h.text,/Ürün #null/);assert.match(h.text,/Ürün eşleştirmesi çözülmedi/);assert.match(h.text,/Yalnız kendi sayım satırlarınız/);assert.match(h.text,/Doğrulanmadı/);
 assert.equal(h.find(n=>n.type==='button'&&/Kaydet|Onayla|Gönder|İptal|Yeni kabul/.test(text(n))).length,0);
});
test('actual receipt component rejects a successful response for the wrong selected ID or source',async()=>{
 const h=harness();h.lists[0].resolve(response([row('1')]));await h.flush();choose(h,'1');h.details[0].resolve(detail('2','WRONG-ID'));await h.flush();
 assert.match(h.text,/ayrıntı kimliği eşleşmedi/);assert.doesNotMatch(h.text,/WRONG-ID/);
 filter(h,'submitted');h.lists[1].resolve(response([row('1')],{source:'OTHER'}));await h.flush();assert.match(h.text,/Okuma kaynağı doğrulanamadı/);assert.equal(h.find(n=>n.type==='tr'&&n.props.onClick).length,0);
});
test('selecting the same receipt or same filter preserves current data instead of cancelling its active gate',async()=>{
 const h=harness();h.lists[0].resolve(response([row('1')]));await h.flush();choose(h,'1');choose(h,'1');assert.equal(h.details.length,1);
 h.details[0].resolve(detail('1','SAME-DETAIL'));await h.flush();choose(h,'1');assert.match(h.text,/SAME-DETAIL/);assert.equal(h.details.length,1);
 filter(h,'');assert.match(h.text,/SAME-DETAIL/);assert.equal(h.lists.length,1);
});
test('receipt screen distinguishes own visibility from whole task scope and unknown metadata',async()=>{
 for(const [scope,expected]of [['own_receipts_or_lines',/bütün açık kabulleri değildir/],['all_task_receipts',/açık filtre ve sayfalama geçerlidir/],[undefined,/görünürlük kapsamı doğrulanmadı/]]){
  const h=harness();h.lists[0].resolve(response([row('1')],{visibilityScope:scope}));await h.flush();assert.match(h.text,expected);
 }
});



