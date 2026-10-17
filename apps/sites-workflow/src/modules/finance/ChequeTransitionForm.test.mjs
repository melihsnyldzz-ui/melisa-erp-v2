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
function form({enabled=true,deposit=false}={}){
 const run=runtime(),pending=deferred(),calls=[],storage=new Map();let tree,saved=0;
 const cheque={id:'9',source,direction:'received',status:deposit?'portfolio':'draft',version:deposit?1:0};
 const meta={source,commands:enabled?{source,chequeId:'9',version:cheque.version,finalize:true,deposit:true,duplicatesVerified:true,duplicateIds:[]}:null};
 const client={exports:{}};vm.runInNewContext(transformSync(readFileSync(new URL('../../services/chequeApi.js',import.meta.url),'utf8'),{loader:'js',format:'cjs'}).code,{module:client,exports:client.exports,structuredClone,require:()=>({post:(path,body)=>{calls.push({path,body});return pending.promise;}})});
 const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})},module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./ChequeTransitionForm.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs'}).code,{module,exports:module.exports,sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:{randomUUID:()=> 'cheque-request-1'},require:s=>s==='react'?react:client.exports});
 function render(){for(let i=0;i<20;i++){run.start();tree=module.exports.ChequeTransitionForm({cheque,meta,onSaved:()=>saved++});if(!run.finish())return;}throw Error('loop');}render();
 return{run,pending,calls,storage,cheque,meta,render,choose(v){nodes(tree,n=>n.type==='select')[0].props.onChange({target:{value:v}});render();},reason(v){nodes(tree,n=>n.type==='textarea')[0].props.onChange({target:{value:v}});render();},get saved(){return saved;},get text(){return text(tree);},date(v){nodes(tree,n=>n.type==='input'&&n.props.type==='date')[0].props.onChange({target:{value:v}});render();},ack(){nodes(tree,n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:true}});render();},submit(){return nodes(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});}};
}
test('actual transition JSX/client keeps absent or mismatched capability closed and requires current acknowledgment',async()=>{
 const h=form({enabled:false});h.date('2026-09-24');h.ack();await h.submit();assert.equal(h.calls.length,0);
 const f=form();f.date('2026-09-24');f.ack();f.date('2026-09-25');await f.submit();assert.equal(f.calls.length,0);f.ack();f.meta.commands.chequeId='8';f.render();await f.submit();assert.equal(f.calls.length,0);
});
test('finalize sends one exact request with verified duplicate list; response mismatch retains pending',async()=>{
 const h=form();h.date('2026-09-24');h.ack();const p=h.submit();await h.submit();assert.equal(h.calls.length,1);assert.equal(h.calls[0].path,'/api/cheques/9/finalize');assert.equal(h.calls[0].body.expectedVersion,0);assert.equal(h.calls[0].body.acknowledgedDuplicateIds.length,0);h.pending.resolve({success:true,data:{source,chequeId:'8',direction:'received',version:1,status:'portfolio'}});await p;h.render();assert.equal(h.saved,0);assert.equal(h.storage.size,1);assert.match(h.text,/otomatik tekrar yok/);
});
test('deposit accepts only next bank-deposited state, and closed panel ignores late callback',async()=>{
 const h=form({deposit:true});h.date('2026-09-24');h.ack();const p=h.submit();assert.equal(h.calls[0].path,'/api/cheques/9/deposit');assert.equal(h.calls[0].body.acknowledgedDuplicateIds,undefined);h.pending.resolve({success:true,data:{source,chequeId:'9',direction:'received',version:2,status:'bank_deposited',eventId:'7'}});await p;assert.equal(h.saved,1);assert.equal(h.storage.size,0);
 const closed=form();closed.date('2026-09-24');closed.ack();const late=closed.submit();closed.run.unmount();const writes=closed.run.writes;closed.pending.reject(Error('old'));await late;assert.equal(closed.run.writes,writes);assert.equal(closed.saved,0);assert.equal(closed.storage.size,1);
});

test('actual reverse UI/client requires separate server proof, reason and renewed acknowledgement; pending survives mismatch',async()=>{
 for(const action of ['cancel','dishonour','return']){
  const h=form({deposit:true});h.meta.commands[action]=true;h.choose(action);h.date('2026-09-25');h.reason('Fixture inverse');h.ack();
  await h.submit();assert.equal(h.calls.length,0);
  h.meta.commands.unsettledReversalVerified=true;h.render();const p=h.submit();await h.submit();assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].path,'/api/cheques/9/'+action);assert.equal(h.calls[0].body.expectedVersion,1);assert.equal(h.calls[0].body.reason,'Fixture inverse');
  h.pending.resolve({success:true,data:{source,chequeId:'9',direction:'received',status:action==='cancel'?'cancelled':action==='dishonour'?'dishonoured':'returned',version:2,eventId:'7'}});
  await p;assert.equal(h.saved,1);assert.equal(h.storage.size,0);
 }
 const h=form({deposit:true});Object.assign(h.meta.commands,{cancel:true,unsettledReversalVerified:true});h.choose('cancel');h.date('2026-09-25');h.ack();
 await h.submit();assert.equal(h.calls.length,0);h.reason('Fixture');await h.submit();assert.equal(h.calls.length,0);h.ack();const p=h.submit();
 h.pending.resolve({success:true,data:{source,chequeId:'9',direction:'received',status:'bank_deposited',version:2}});await p;
 assert.equal(h.saved,0);assert.equal(h.storage.size,1);
});

test('settlement form/client requires the bank event date and fresh acknowledgment and does not send evidence flags',async()=>{
 for(const direction of ['received','given']){
  const h=form({deposit:true});h.cheque.direction=direction;h.cheque.status=direction==='received'?'bank_deposited':'issued';h.cheque.version=direction==='received'?2:1;
  Object.assign(h.meta.commands,{version:h.cheque.version,settle:true});h.render();h.choose('settle');h.date('2026-09-25');h.ack();
  await h.submit();assert.equal(h.calls.length,0);
  Object.assign(h.meta.commands,{settlementEvidenceVerified:true,bankEventId:'71',settlementEventDate:'2026-09-26'});h.render();h.ack();
  await h.submit();assert.equal(h.calls.length,0);h.date('2026-09-26');h.ack();h.meta.commands.bankEventId='72';h.render();
  await h.submit();assert.equal(h.calls.length,0);h.ack();const p=h.submit();await h.submit();assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].path,'/api/cheques/9/settle');assert.equal(h.calls[0].body.eventDate,'2026-09-26');
  assert.equal(h.calls[0].body.bankEventId,undefined);assert.equal(h.calls[0].body.acknowledgedDuplicateIds,undefined);
  h.pending.resolve({success:true,data:{source,chequeId:'9',direction,status:direction==='received'?'collected':'paid',version:h.cheque.version+1,eventId:'7'}});
  await p;assert.equal(h.saved,1);assert.equal(h.storage.size,0);
 }
});

test('changing selected cheque ignores late result/error and clears the prior acknowledgment',async()=>{
 for(const failed of [false,true]){
  const h=form({deposit:true});h.date('2026-09-25');h.ack();const p=h.submit();h.cheque.id='10';h.meta.commands.chequeId='10';h.render();const writes=h.run.writes;
  if(failed)h.pending.reject(Error('late'));else h.pending.resolve({success:true,data:{source,chequeId:'9',direction:'received',status:'bank_deposited',version:2,eventId:'7'}});
  await p;assert.equal(h.saved,0);assert.equal(h.run.writes,writes);await h.submit();assert.equal(h.calls.length,1);
 }
});

test('settled inverse form requires bank reversal proof/date and retains ambiguous request without retry',async()=>{
 for(const direction of ['received','given'])for(const result of ['valid','wrong-status','unknown']){
  const h=form({deposit:true});Object.assign(h.cheque,{direction,status:direction==='received'?'collected':'paid',version:direction==='received'?3:2});
  Object.assign(h.meta.commands,{version:h.cheque.version,cancel:true,unsettledReversalVerified:true});h.render();h.choose('cancel');h.date('2026-09-25');h.reason('SYNTHETIC bank inverse');h.ack();
  await h.submit();assert.equal(h.calls.length,0);
  Object.assign(h.meta.commands,{settledReversalVerified:true,bankReversalEventId:'72',bankReversalDate:'2026-09-26'});h.render();h.ack();
  await h.submit();assert.equal(h.calls.length,0);h.date('2026-09-26');h.ack();h.meta.commands.bankReversalEventId='73';h.render();
  await h.submit();assert.equal(h.calls.length,0);h.ack();const p=h.submit();await h.submit();assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].path,'/api/cheques/9/cancel');assert.equal(h.calls[0].body.expectedVersion,direction==='received'?3:2);
  assert.equal(h.calls[0].body.bankReversalEventId,undefined);assert.equal(h.calls[0].body.settled,undefined);
  if(result==='unknown')h.pending.reject(Error('unknown'));
  else h.pending.resolve({success:true,data:{source,chequeId:'9',direction,status:result==='valid'?'cancelled':'paid',version:h.cheque.version+1,eventId:'75'}});
  await p;assert.equal(h.saved,result==='valid'?1:0);assert.equal(h.storage.size,result==='valid'?0:1);await h.submit();assert.equal(h.calls.length,1);
 }
});

