import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{transformSync}=require('esbuild');
const source='PROMPT-2-20260923-01';
function fill(h){h.change('input',0,'2026-09-24');h.change('select',0,'9');h.change('select',1,'10');h.change('input',1,'12345678901234.1234');}

test('account read populates context without enabling writes and ignores old date results',async()=>{
 const h=payment(false);h.change('input',0,'2026-09-24');const p=h.click('TEST hesaplarını oku');
 const result={...h.capability,enabled:false,periodVerified:false,readAt:'2026-09-24T12:00:00Z'};
 h.reads[0].resolve({success:true,data:result});await p;h.render();assert.match(h.text,/Görev hesapları alındı/);await h.submit();assert.equal(h.calls.length,0);
 const old=h.click('TEST hesaplarını oku');h.change('input',0,'2026-09-25');h.reads[1].resolve({success:true,data:result});await old;h.render();
 assert.equal(h.reads[1].options.signal.aborted,true);assert.doesNotMatch(h.text,/Görev hesapları alındı/);assert.equal(h.calls.length,0);
});
test('actual transfer form preserves exact amount and single request until validated result',async()=>{
 const h=payment();fill(h);const p=h.submit();await h.submit();assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].amount,'12345678901234.1234');assert.equal(h.calls[0].currency,'USD');assert.equal(h.calls[0].fromAccountId,'9');assert.equal(h.calls[0].toAccountId,'10');
 h.pending.resolve({success:true,data:{source,transferId:'5',status:'posted',warnings:[{code:'NEGATIVE_FINANCE_BALANCE',accountId:'9',currency:'USD'}]}});
 await p;h.render();assert.equal(h.storage.size,0);assert.match(h.text,/negatif uyarısı/);
});
test('transfer rejects foreign currency, same account, unverified date and inactive capability without request',async()=>{
 for(const mutate of [h=>h.capability.accounts[1].currency='TRY',h=>h.change('select',1,'9'),h=>h.change('input',0,'2026-09-23'),h=>h.capability.enabled=false]){
  const h=payment();fill(h);mutate(h);h.render();await h.submit();assert.equal(h.calls.length,0);assert.equal(h.storage.size,0);
 }
});
test('transfer unknown response retains pending, and unmount ignores late result',async()=>{
 for(const warnings of [undefined,{},[{code:'NEGATIVE_FINANCE_BALANCE',accountId:'10',currency:'USD'}]]){
  const h=payment();fill(h);const p=h.submit();h.pending.resolve({success:true,data:{source,transferId:'5',status:'posted',warnings}});
  await p;h.render();assert.equal(h.storage.size,1);assert.match(h.text,/sonucu doğrulanamadı/);await h.submit();assert.equal(h.calls.length,1);
 }
 const h=payment();fill(h);const p=h.submit();h.run.unmount();const writes=h.run.writes;h.pending.reject(Error('unknown'));await p;assert.equal(h.run.writes,writes);assert.equal(h.storage.size,1);
});
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}

test('actual form compensates only its confirmed transfer with exact inverse and one distinct request (synthetic)',async()=>{
 const h=payment();fill(h);const p=h.submit();h.pending.resolve({success:true,data:{source,transferId:'5',status:'posted',warnings:[]}});await p;h.render();
 h.change('textarea',1,'SYNTHETIC correction');await h.click('Kayıtlı transferi telafi et');assert.equal(h.inverseCalls.length,0);
 h.capability.compensate=true;h.render();const inverse=h.click('Kayıtlı transferi telafi et');await h.click('Kayıtlı transferi telafi et');
 assert.equal(h.inverseCalls.length,1);const c=h.inverseCalls[0];assert.equal(c.id,'5');assert.equal(c.body.fromAccountId,'10');assert.equal(c.body.toAccountId,'9');
 assert.equal(c.body.amount,'12345678901234.1234');assert.equal(c.body.currency,'USD');assert.notEqual(c.body.requestId,h.calls[0].requestId);
 h.inverse.resolve({success:true,data:{source,transferId:'6',compensatesTransferId:'5',status:'posted',warnings:[]}});await inverse;h.render();
 assert.equal(h.storage.size,0);assert.match(h.text,/#5, #6 ile telafi edildi/);await h.click('Kayıtlı transferi telafi et');assert.equal(h.inverseCalls.length,1);
});

test('foreign compensation result retains pending and unmount cannot write state',async()=>{
 for(const unmount of [false,true]){
  const h=payment();fill(h);const p=h.submit();h.pending.resolve({success:true,data:{source,transferId:'5',status:'posted',warnings:[]}});await p;h.render();
  h.capability.compensate=true;h.change('textarea',1,'SYNTHETIC correction');const inverse=h.click('Kayıtlı transferi telafi et');
  if(unmount)h.run.unmount();const writes=h.run.writes;
  h.inverse.resolve({success:true,data:{source,transferId:'6',compensatesTransferId:'OTHER',status:'posted',warnings:[]}});await inverse;
  assert.equal(h.storage.size,1);assert.equal(h.inverseCalls.length,1);
  if(unmount)assert.equal(h.run.writes,writes);else {h.render();assert.match(h.text,/Telafi sonucu doğrulanamadı/);await h.click('Kayıtlı transferi telafi et');assert.equal(h.inverseCalls.length,1);}
 }
});
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
function payment(withCapability=true){const run=runtime(),calls=[],pending=deferred(),inverse=deferred(),inverseCalls=[],reads=[],storage=new Map();let tree,requestNumber=0;
 const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})},module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./FinanceTransferForm.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsxFactory:'React.createElement'}).code,{module,exports:module.exports,AbortController,sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:{randomUUID:()=> 'payment-request-'+(++requestNumber)},require:spec=>spec==='react'?react:{fetchFinanceTransferAccounts:(date,options)=>{const d=deferred();reads.push({...d,date,options});return d.promise;},compensateFinanceTransfer:(id,body)=>{inverseCalls.push({id,body});return inverse.promise;},postFinanceTransfer:body=>{calls.push(body);return pending.promise;}}});
 const capability={enabled:true,source,supplierId:'8',eventDate:'2026-09-24',maximumLegs:2,sourceContext:{environment:'TEST',server:'Semih\\MELISADEV',database:'MELISA_ERP_FULL_TEST_20260916'},accounts:[{id:'9',type:'cash',currency:'USD'},{id:'10',type:'bank',currency:'USD'}],exchangeQuotes:[]};
 function render(){for(let i=0;i<20;i++){run.start();tree=module.exports.FinanceTransferForm({capability:withCapability?capability:null});if(!run.finish())return;}throw Error('loop');}
 render();return{run,calls,pending,inverse,inverseCalls,reads,storage,capability,render,get text(){return text(tree);},click(label){const p=nodes(tree,n=>n.type==='button'&&text(n)===label)[0].props.onClick();render();return p;},change(type,index,value){nodes(tree,n=>n.type===type)[index].props.onChange({target:{value}});render();},submit(){return nodes(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});}};
}


