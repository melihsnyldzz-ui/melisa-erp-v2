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
function formHarness(enabled=true){
 const run=runtime(),pending=deferred(),calls=[],reads=[],storage=new Map();let tree,saved=0;
 const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})};
 const module={exports:{}};
 const code=transformSync(readFileSync(new URL('./ReceiptDraftLineForm.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsxFactory:'React.createElement'}).code;
 vm.runInNewContext(code,{AbortController,module,exports:module.exports,sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:{randomUUID:()=> 'request-00000001'},require:spec=>spec==='react'?react:spec.endsWith('/receiptApi.js')?{fetchReceiptLineIdentity:(...args)=>{const pending=deferred();reads.push({args,pending});return pending.promise;}}:spec.endsWith('ReceiptProductPicker.jsx')?{ReceiptProductPicker:()=>null}:{resolveInventoryReceiptLine:(...args)=>{calls.push(args);return pending.promise;},captureInventoryReceiptLine:(...args)=>{calls.push(args);return pending.promise;},appendInventoryReceiptLine:(...args)=>{calls.push(args);return pending.promise;},editInventoryReceiptQuantities:(...args)=>{calls.push(args);return pending.promise;}}});
 const props={receipt:{id:'1',source,version:0,status:'draft',lines:[{id:'9',productId:'8',quantity:'2.000',unit:'adet'}]},meta:{source,sourceContext:{server:'Semih\\MELISADEV',database:'MELISA_ERP_FULL_TEST_20260916'},readOnly:!enabled,commands:{capture:true,append:true,edit:true,resolve:true,receiptId:'1',version:0}},onSaved:()=>saved++};
 function render(){for(let i=0;i<20;i++){run.start();tree=module.exports.ReceiptDraftLineForm(props);if(!run.finish())return;}throw Error('loop');}
 render();return {run,pending,calls,reads,storage,props,read(){return nodes(tree,n=>n.type==='button'&&text(n)==='Adayları oku')[0].props.onClick();},check(value){nodes(tree,n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:value}});render();},product(value){nodes(tree,n=>typeof n.type==='function')[0].props.onSelect(value);render();},select(i,value){nodes(tree,n=>n.type==='select')[i].props.onChange({target:{value}});render();},get saved(){return saved;},get tree(){return tree;},render,input(i,value){nodes(tree,n=>n.type==='input')[i].props.onChange({target:{value}});render();},submit(){return tree.props.onSubmit({preventDefault(){}});}};
}

function identityResponse(h,lineId='9'){
 return {success:true,data:{source,receiptId:'1',lineId,version:0,quantity:'2.000',unit:null,productIds:['8','10'],classification:'conflicting_candidates',evidenceHash:'a'.repeat(64),automaticallyResolved:false},meta:{source,...h.props.meta.sourceContext,readAt:'2026-09-24T20:00:00Z'}};
}
test('resolution form requires reviewed candidate/unit/reason, preserves request and validates exact resolved line',async()=>{
 const h=formHarness();h.select(0,'resolve');h.select(1,'9');const read=h.read();assert.equal(h.reads[0].args[1],'9');h.reads[0].pending.resolve(identityResponse(h));await read;h.render();
 await h.submit();assert.equal(h.calls.length,0);h.select(2,'8');h.input(0,'adet');h.input(1,'Satır ve birim incelendi');h.check(true);
 h.input(0,'kutu');await h.submit();assert.equal(h.calls.length,0);h.input(0,'adet');h.check(true);
 const pending=h.submit();assert.equal(h.calls.length,1);assert.equal(h.calls[0][1],'9');assert.equal(h.calls[0][2].confirmedUnitMultiplier,'1');assert.equal(h.calls[0][2].observedEvidenceHash,'a'.repeat(64));assert.equal(h.calls[0][2].quantity,undefined);
 h.pending.resolve({success:true,data:{id:'1',source,version:1,lineId:'OTHER',productId:'8',unit:'adet',resolution:'verified',resolutionEvidenceHash:'a'.repeat(64)}});await pending;assert.equal(h.storage.size,1);assert.equal(h.saved,0);
});
test('identity preview cancels obsolete line reads and closed TEST metadata never enables resolution',async()=>{
 const h=formHarness(false);h.props.receipt.lines.push({id:'11',resolution:'unresolved'});h.render();h.select(0,'resolve');h.select(1,'9');const old=h.read();
 h.select(1,'11');assert.equal(h.reads[0].args[3].signal.aborted,true);const current=h.read();h.reads[1].pending.resolve(identityResponse(h,'11'));await current;h.render();
 h.reads[0].pending.resolve(identityResponse(h));await old;h.render();h.select(2,'8');h.input(0,'adet');h.input(1,'incelendi');h.check(true);await h.submit();assert.equal(h.calls.length,0);
 const next=h.read();h.run.unmount();const writes=h.run.writes;h.reads[2].pending.reject(Error('late error'));await next;assert.equal(h.run.writes,writes);
});
test('actual form: read-only metadata blocks direct submit as well as button',async()=>{const h=formHarness(false);h.input(0,'000123');h.input(2,'1');await h.submit();assert.equal(h.calls.length,0);assert.equal(nodes(h.tree,n=>n.type==='button')[0].props.disabled,true);});
test('actual form: one request, preserved codes, exact identity, success refresh',async()=>{const h=formHarness();h.input(0,'000123');h.input(2,'1.001');const p=h.submit();await h.submit();assert.equal(h.calls.length,1);assert.equal(h.calls[0][1].barcode,'000123');assert.equal(h.calls[0][1].quantity,'1.001');h.pending.resolve({success:true,data:{id:'1',source,version:1}});await p;assert.equal(h.saved,1);assert.equal(h.storage.size,0);});
test('actual form: ambiguous failure retains request and prevents resend',async()=>{const h=formHarness();h.input(1,'0009');h.input(2,'0');const p=h.submit();h.pending.reject(Error('network'));await p;await h.submit();assert.equal(h.calls.length,1);assert.equal(h.storage.size,1);assert.equal(h.saved,0);});
test('actual form: closing panel ignores delayed result',async()=>{const h=formHarness();h.input(0,'12');h.input(2,'2');const p=h.submit();h.run.unmount();const writes=h.run.writes;h.pending.resolve({success:true,data:{id:'1',source,version:1}});await p;assert.equal(h.run.writes,writes);assert.equal(h.saved,0);});

test('append uses selected receipt revision and exact product identity',async()=>{const h=formHarness();h.select(0,'append');h.product('9223372036854775807');h.input(0,'0.001');const p=h.submit();assert.equal(h.calls.length,1);assert.equal(h.calls[0][1].productId,'9223372036854775807');assert.equal(h.calls[0][1].expectedVersion,0);assert.equal('barcode' in h.calls[0][1],false);h.pending.resolve({success:true,data:{id:'1',source,version:1}});await p;assert.equal(h.saved,1);});
test('edit only submits a recorded line, preserves zero, and rejects foreign line',async()=>{const h=formHarness();h.select(0,'edit');h.select(1,'88');h.input(0,'0');await h.submit();assert.equal(h.calls.length,0);h.select(1,'9');const p=h.submit();assert.equal(h.calls[0][1].quantities[0].lineId,'9');assert.equal(h.calls[0][1].quantities[0].quantity,'0');h.pending.resolve({success:true,data:{id:'1',source,version:1}});await p;assert.equal(h.saved,1);});
test('capture capability does not imply append or edit capability',async()=>{const h=formHarness();h.props.meta.commands.append=false;h.select(0,'append');h.product('8');h.input(0,'1');await h.submit();assert.equal(h.calls.length,0);});
test('wrong receipt success retains pending command and never refreshes',async()=>{const h=formHarness();h.select(0,'append');h.product('8');h.input(0,'1');const p=h.submit();h.pending.resolve({success:true,data:{id:'2',source,version:1}});await p;assert.equal(h.saved,0);assert.equal(h.storage.size,1);});


