import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import * as cashMoney from './cashReadMoney.js';
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

function screen(readOnly=false){
 const run=runtime(),accounts=[],movements=[],outputs=[],previews=[];let tree;
 const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})},module={exports:{}};
 const api={fetchFinanceAccounts:(...args)=>{const d=deferred();accounts.push({...d,args});return d.promise;},
  fetchFinanceMovements:(...args)=>{const d=deferred();movements.push({...d,args});return d.promise;},fetchFinanceAccountCleanupPreview:async()=>{previews.push(1);return {success:true,data:null}}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./CashBankLedgerScreen.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs'}).code,
  {module,exports:module.exports,AbortController,require:s=>s==='react'?react:s.includes('financeApi')?api:s.includes('cashReadMoney')?cashMoney:s.includes('exportUtils')?{exportRowsToExcel:p=>outputs.push(p),printRowsReport:p=>outputs.push(p),printFinanceReceipt:p=>outputs.push(p)}:{}});
 function render(){for(let i=0;i<20;i++){run.start();tree=module.exports.CashBankLedgerScreen({readOnly});if(!run.finish())return;}throw Error('loop');}
 render();return{accounts,movements,outputs,previews,run,render,get text(){return text(tree)},button(label){return nodes(tree,n=>n.type==='button'&&text(n)===label)[0]}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const empty={success:true,data:[]};
test('actual JSX blocks stale exports at handler and button boundaries and states limited scope',async()=>{
 const h=screen();assert.equal(h.button('Excel').props.disabled,true);h.button('Excel').props.onClick();assert.equal(h.outputs.length,0);
 h.accounts[0].resolve(empty);await flush();for(const r of h.movements)r.resolve(empty);await flush();h.render();
 assert.equal(h.button('Excel').props.disabled,false);h.button('Excel').props.onClick();h.button('Yazdır').props.onClick();
 assert.equal(h.outputs.length,2);assert.match(h.outputs[0].title,/sınırlı/);assert.match(h.outputs[1].subtitle,/genel dönem toplamı değildir/);
 const oldExport=h.button('Excel').props.onClick;h.button('Yenile').props.onClick();oldExport();assert.equal(h.outputs.length,2);
 h.accounts[1].reject(Error('unavailable'));await flush();h.render();assert.equal(h.button('Yazdır').props.disabled,true);
 h.button('Yazdır').props.onClick();assert.equal(h.outputs.length,2);
});
test('actual JSX ignores obsolete account response/error and never launches its movement reads',async()=>{
 for(const reject of [false,true]){const h=screen();h.button('Yenile').props.onClick();assert.equal(h.accounts[0].args[1].signal.aborted,true);
  h.accounts[1].resolve(empty);await flush();assert.equal(h.movements.length,2);
  for(const call of h.movements)call.resolve(empty);await flush();h.render();const writes=h.run.writes;
  if(reject)h.accounts[0].reject(Error('OLD'));else h.accounts[0].resolve(empty);await flush();
  assert.equal(h.movements.length,2);assert.equal(h.run.writes,writes);h.render();assert.doesNotMatch(h.text,/OLD/);
 }
});
test('actual JSX rejects malformed read and ignores late movements after new read/unmount',async()=>{
 const h=screen();h.accounts[0].resolve(empty);await flush();const old=h.movements.slice();
 h.button('Yenile').props.onClick();h.accounts[1].resolve({success:false,data:[]});await flush();h.render();assert.match(h.text,/Doğrulanmadı/);
 const writes=h.run.writes;old[0].resolve(empty);old[1].reject(Error('OLD'));await flush();assert.equal(h.run.writes,writes);
 h.button('Yenile').props.onClick();h.accounts[2].resolve(empty);await flush();const pending=h.movements.slice(2);
 h.run.unmount();const closed=h.run.writes;for(const call of pending)call.resolve(empty);await flush();assert.equal(h.run.writes,closed);
});

test('TEST read-only ledger omits legacy account management and its preview request; failed read is not an empty account list',async()=>{
 const h=screen(true);assert.equal(h.previews.length,0);assert.equal(h.button('Hesap Aç'),undefined);
 assert.equal(h.button('Güvenli Temizle'),undefined);assert.equal(h.button('Standarda Aktar'),undefined);
 assert.ok(h.button('Tahsilat / Çek Görüntüle'));h.accounts[0].reject(Error('blocked'));await flush();h.render();
 assert.match(h.text,/Hesap sayısı doğrulanmadı/);assert.doesNotMatch(h.text,/Kasa\/banka hesabı yok/);
 const normal=screen();assert.equal(normal.previews.length,1);assert.ok(normal.button('Hesap Aç'));
 normal.accounts[0].resolve(empty);await flush();normal.movements.forEach(r=>r.resolve(empty));await flush();
});


