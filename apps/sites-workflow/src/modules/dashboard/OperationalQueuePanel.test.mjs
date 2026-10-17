import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{transformSync}=require('esbuild');
function harness(){
 const run=runtime(),calls=[],opened=[],props={permissions:['dashboard.view'],onOpenScreen:(...a)=>opened.push(a)};let tree;
 const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})},module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./OperationalQueuePanel.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs'}).code,
 {module,exports:module.exports,AbortController,require:s=>s==='react'?react:{get:(...args)=>{const d=deferred();calls.push({...d,args});return d.promise;}}});
 function render(){for(let i=0;i<20;i++){run.start();tree=module.exports.OperationalQueuePanel(props);if(!run.finish())return;}throw Error('loop');}
 render();return {run,calls,props,opened,render,get text(){return text(tree)},buttons:()=>nodes(tree,n=>n.type==='button'),read(){const p=nodes(tree,n=>n.type==='button')[0].props.onClick();render();return p;}};
}
const result=()=>({data:{source:'PROMPT-2-20260923-01',readOnly:true,complete:false,scope:'TASK_RECEIPTS_NOTICES_CHEQUES_COUNTS_ONLY',groups:[{key:'receipts',state:'read',total:1,readAt:'2026-09-24T14:00:00Z',visibilityScope:'all_task_receipts',items:[{id:'9',kind:'receipt',status:'submitted',source:'PROMPT-2-20260923-01',link:{kind:'receipt',documentId:'9',source:'/api/inventory-receipts'}}]},{key:'notices',state:'read',total:0,items:[],readAt:'2026-09-24T14:00:00Z'},{key:'cheques',state:'not_connected',total:null,items:[]},{key:'counts',state:'not_connected',total:null,items:[]}]}});
test('actual queue JSX reads explicitly, hides known zero and opens exact receipt',async()=>{const h=harness();assert.equal(h.calls.length,0);const p=h.read();h.calls[0].resolve(result());await p;h.render();assert.match(h.text,/Kabul #9/);assert.doesNotMatch(h.text,/Tahsilat bildirimleri/);h.buttons()[1].props.onClick();assert.equal(h.opened[0][0],'inventory-receipt-list');assert.equal(h.opened[0][1].receiptId,'9');});
test('actual queue JSX does not render missing or failed reads as zero',async()=>{const h=harness();const p=h.read();h.calls[0].reject(Error('private'));await p;h.render();assert.match(h.text,/sayı bilinmiyor/);assert.doesNotMatch(h.text,/private/);const q=h.read();const r=result();r.data.groups[0].total=null;h.calls[1].resolve(r);await q;h.render();assert.match(h.text,/sayı bilinmiyor/);assert.doesNotMatch(h.text,/Kabul #9/);});
test('actual queue JSX ignores old response, permission change and unmount error',async()=>{const h=harness();const old=h.read(),fresh=h.read();h.calls[1].resolve(result());await fresh;h.calls[0].reject(Error('old'));await old;h.render();assert.match(h.text,/Kabul #9/);const late=h.read();h.props.permissions=[];h.render();h.calls[2].resolve(result());await late;h.render();assert.doesNotMatch(h.text,/Kabul #9/);h.props.permissions=['dashboard.view'];h.render();const closing=h.read();h.run.unmount();const writes=h.run.writes;h.calls[3].reject(Error('closed'));await closing;assert.equal(h.run.writes,writes);});
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



test('draft cheque queue entry opens the same cheque identity through existing finance workspace',async()=>{const h=harness(),p=h.read(),r=result();r.data.groups[2]={key:'cheques',state:'read',total:1,readAt:'2026-09-24T14:00:00Z',items:[{id:'77',kind:'cheque',status:'draft',source:r.data.source,link:{kind:'cheque',documentId:'77',source:'/api/cheques'}}]};h.calls[0].resolve(r);await p;h.render();h.buttons()[2].props.onClick();assert.equal(h.opened[0][0],'collections-overview');assert.equal(h.opened[0][1].mode,'cheque');assert.equal(h.opened[0][1].cheque.documentId,'77');});

test('subpermission removal clears cached queue and aborts pending reads while dashboard permission remains',async()=>{
 const h=harness();h.props.permissions=['dashboard.view','purchase.view'];h.render();let p=h.read();h.calls[0].resolve(result());await p;h.render();assert.match(h.text,/Kabul #9/);
 p=h.read();h.props.permissions=['dashboard.view'];h.render();assert.equal(h.calls[1].args[2].signal.aborted,true);const writes=h.run.writes;h.calls[1].resolve(result());await p;assert.equal(h.run.writes,writes);h.render();assert.doesNotMatch(h.text,/Kabul #9/);
});
test('queue refuses a mismatched document kind or status even with a matching ID and route source',async()=>{
 for(const patch of [i=>i.kind='cheque',i=>i.link.kind='cheque',i=>i.status='approved']){const h=harness(),p=h.read(),r=result();patch(r.data.groups[0].items[0]);h.calls[0].resolve(r);await p;h.render();assert.doesNotMatch(h.text,/Kabul #9/);assert.match(h.text,/sayı bilinmiyor/);}
});

test('submitted count opens exact count kind/source/id and rejects a foreign link',async()=>{
 for(const foreign of [false,true]){
  const h=harness(),p=h.read(),r=result();
  r.data.groups[3]={key:'counts',state:'read',total:1,readAt:'2026-09-24T14:00:00Z',visibilityScope:'OWN_ASSIGNED_COUNTS',items:[{id:'99',source:r.data.source,status:'submitted',kind:'stock_count',link:{kind:'stock_count',source:foreign?'/api/cheques':'/api/stock-counts',documentId:'99'}}]};
  h.calls[0].resolve(r);await p;h.render();
  if(foreign){assert.match(h.text,/sayı bilinmiyor/);assert.equal(h.opened.length,0);}
  else{h.buttons().find(b=>text(b).includes('Sayım #99')).props.onClick();assert.equal(h.opened[0][0],'stock-count');assert.equal(h.opened[0][1].count.documentId,'99');assert.equal(h.opened[0][1].count.source,'/api/stock-counts');}
 }
});

