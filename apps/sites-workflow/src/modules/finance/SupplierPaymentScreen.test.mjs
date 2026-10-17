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
function text(tree){if(tree==null||typeof tree==='boolean')return '';if(Array.isArray(tree))return tree.map(text).join('');if(typeof tree!=='object')return String(tree);return text(tree.props?.children);}
function payment(){const run=runtime(),calls=[],reads=[],outcomes=[],props={},pending=deferred(),inversePending=deferred(),inverseCalls=[],storage=new Map();let tree,requestSequence=0;
 const react={...run.hooks,createElement:(type,props,...children)=>({type,props:{...props,children}})},module={exports:{}};
 vm.runInNewContext(transformSync(readFileSync(new URL('./SupplierPaymentScreen.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsxFactory:'React.createElement'}).code,{module,exports:module.exports,AbortController,sessionStorage:{get length(){return storage.size;},key:i=>[...storage.keys()][i]??null,getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:{randomUUID:()=> 'payment-request-'+(++requestSequence)},require:spec=>spec==='react'?react:{fetchSupplierPaymentOutcome:(...args)=>{const d=deferred();outcomes.push({...d,args});return d.promise;},fetchSupplierPaymentAccounts:(...args)=>{const d=deferred();reads.push({...d,args});return d.promise;},postSupplierPayment:body=>{calls.push(body);return pending.promise;},compensateSupplierPayment:(id,body)=>{inverseCalls.push({id,body});return inversePending.promise;}}});
 const capability={enabled:true,source,supplierId:'8',eventDate:'2026-09-24',maximumLegs:2,sourceContext:{environment:'TEST',server:'Semih\\MELISADEV',database:'MELISA_ERP_FULL_TEST_20260916'},accounts:[{id:'9',type:'cash',currency:'USD'}],exchangeQuotes:[]};
 function render(){for(let i=0;i<20;i++){run.start();tree=module.exports.SupplierPaymentScreen({capability,...props});if(!run.finish())return;}throw Error('loop');}
 render();return{run,calls,reads,outcomes,props,pending,inversePending,inverseCalls,storage,capability,render,get text(){return text(tree);},click(label){const result=nodes(tree,n=>n.type==='button'&&text(n)===label)[0].props.onClick();render();return result;},change(type,index,value){nodes(tree,n=>n.type===type)[index].props.onChange({target:{value}});render();},submit(){return nodes(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});}};
}
test('payment screen preserves exact same-currency leg and stable request, unknown result retained',async()=>{const h=payment();h.change('input',0,'2026-09-24');h.change('select',0,'9');h.change('input',1,'0.1250');const p=h.submit();await h.submit();assert.equal(h.calls.length,1);assert.equal(h.calls[0].legs[0].paidAmount,'0.1250');assert.equal(h.calls[0].legs[0].debtAmount,'0.1250');assert.equal(h.calls[0].legs[0].method,'cash');h.pending.reject(Error('unknown'));await p;assert.equal(h.storage.size,1);});
test('payment screen uses recorded accounting quote without computing exchange rate',async()=>{const h=payment();h.capability.exchangeQuotes=[{id:'2',source,supplierId:'8',eventDate:'2026-09-24',paidCurrency:'USD',debtCurrency:'TRY',paidAmount:'2.1234',debtAmount:'84.9360',verified:true}];h.change('input',0,'2026-09-24');h.change('select',0,'9');h.change('select',1,'2');const p=h.submit();assert.equal(h.calls[0].legs[0].debtAmount,'84.9360');assert.equal(h.calls[0].legs[0].rateQuoteId,'2');h.run.unmount();const writes=h.run.writes;h.pending.resolve({success:true,data:{source,supplierId:'8',paymentId:'5',status:'posted',warnings:[]}});await p;assert.equal(h.run.writes,writes);});
test('payment capability is date-bound and inactive context cannot submit',async()=>{const h=payment();h.change('input',0,'2026-09-23');await h.submit();assert.equal(h.calls.length,0);h.change('input',0,'2026-09-24');h.capability.enabled=false;h.render();await h.submit();assert.equal(h.calls.length,0);});
test('payment compensation reuses only the confirmed original, needs its own capability and keeps ambiguous/late outcomes isolated',async()=>{
 for(const outcome of ['valid','wrong-original','switch','reject']){
  const h=payment();h.change('input',0,'2026-09-24');h.change('select',0,'9');h.change('input',1,'0.1250');
  const post=h.submit();h.pending.resolve({success:true,data:{source,supplierId:'8',paymentId:'5',status:'posted',warnings:[]}});await post;h.render();
  await h.click('Ödemeyi ters kayıtla telafi et');assert.equal(h.inverseCalls.length,0);
  h.capability.compensate=true;h.render();h.change('textarea',1,'SYNTHETIC inverse');
  const inverse=h.click('Ödemeyi ters kayıtla telafi et');await h.click('Ödemeyi ters kayıtla telafi et');assert.equal(h.inverseCalls.length,1);
  assert.equal(h.inverseCalls[0].id,'5');assert.equal(h.inverseCalls[0].body.requestId,'payment-request-2');
  assert.equal(h.inverseCalls[0].body.legs[0].paidAmount,'0.1250');assert.equal(h.inverseCalls[0].body.description,undefined);
  if(outcome==='switch'){h.capability.supplierId='10';h.render();}
  const writes=h.run.writes;
  if(outcome==='reject')h.inversePending.reject(Error('unknown'));
  else h.inversePending.resolve({success:true,data:{source,supplierId:'8',paymentId:'6',status:'posted',warnings:[],compensatesPaymentId:outcome==='wrong-original'?'4':'5'}});
  await inverse;if(outcome==='switch')assert.equal(h.run.writes,writes);h.render();
  if(outcome==='valid'){assert.match(h.text,/telafi #6/);assert.equal(h.storage.size,0);await h.click('Ödemeyi ters kayıtla telafi et');assert.equal(h.inverseCalls.length,1);}
  if(['reject','wrong-original'].includes(outcome)){assert.match(h.text,/Telafi sonucu doğrulanamadı/);assert.equal(h.storage.size,1);}
 }
});

test('cash and bank pieces retain separate currencies and exact amounts',async()=>{
 const h=payment();h.capability.accounts.push({id:'10',type:'bank',currency:'TRY'});
 h.change('input',0,'2026-09-24');h.change('select',0,'9');h.change('input',1,'0.1250');
 h.click('Nakit/banka parçası ekle');h.change('select',2,'10');h.change('input',2,'12345678901234.1234');
 const p=h.submit();assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].legs)),[
  {accountId:'9',method:'cash',paidCurrency:'USD',paidAmount:'0.1250',debtCurrency:'USD',debtAmount:'0.1250'},
  {accountId:'10',method:'bank',paidCurrency:'TRY',paidAmount:'12345678901234.1234',debtCurrency:'TRY',debtAmount:'12345678901234.1234'}]);
 h.pending.resolve({success:true,data:{source,supplierId:'8',paymentId:'5',status:'posted',warnings:[{code:'NEGATIVE_FINANCE_BALANCE',accountId:'10',currency:'TRY'}]}});
 await p;h.render();assert.equal(h.storage.size,0);assert.match(h.text,/negatif uyarısı/);
});

test('malformed or unrelated response warnings retain pending request and never claim saved',async()=>{
 for(const warnings of [undefined,{},[null],[{code:'OTHER'}],[{code:'NEGATIVE_FINANCE_BALANCE',accountId:'10',currency:'USD'}]]){
  const h=payment();h.change('input',0,'2026-09-24');h.change('select',0,'9');h.change('input',1,'1.0000');
  const p=h.submit();h.pending.resolve({success:true,data:{source,supplierId:'8',paymentId:'5',status:'posted',warnings}});
  await p;h.render();assert.equal(h.storage.size,1);assert.match(h.text,/sonucu doğrulanamadı/);assert.doesNotMatch(h.text,/kaydedildi/);
  await h.submit();assert.equal(h.calls.length,1);
 }
});


test('supplier context switch clears form and late old payment cannot write into the new supplier view',async()=>{
 for(const fail of [true,false]){
  const h=payment();h.change('input',0,'2026-09-24');h.change('select',0,'9');h.change('input',1,'1.0000');const p=h.submit();
  h.capability.supplierId='10';h.render();assert.match(h.text,/#10/);const writes=h.run.writes;
  if(fail)h.pending.reject(Error('old'));else h.pending.resolve({success:true,data:{source,supplierId:'8',paymentId:'5',status:'posted',warnings:[]}});
  await p;assert.equal(h.run.writes,writes);h.render();assert.doesNotMatch(h.text,/kaydedildi|İstek payment/);
  await h.submit();assert.equal(h.calls.length,1);h.change('input',0,'2026-09-24');await h.submit();assert.equal(h.calls.length,1);
  assert.equal(h.storage.has(`melisa.payment.pending:${source}:8`),fail);
 }
});

test('payment account read follows selected supplier and ignores late response after switch or unmount without enabling writes',async()=>{
 const h=payment();h.props.capability=null;h.props.source=source;h.props.supplierId='8';h.render();await Promise.resolve();
 assert.equal(h.reads.length,1);h.props.supplierId='10';h.render();await Promise.resolve();assert.equal(h.reads[0].args[2].signal.aborted,true);
 const reply=id=>({success:true,data:{source,supplierId:id,enabled:true,accounts:[{id:'91',type:'bank',currency:'USD'}],debtCurrencies:['USD']},meta:{source,readAt:'2026-09-24T18:00:00Z',sourceContext:{environment:'TEST',server:'Semih\\MELISADEV',database:'MELISA_ERP_FULL_TEST_20260916'}}});
 h.reads[1].resolve(reply('10'));for(let i=0;i<6;i++)await Promise.resolve();h.render();assert.match(h.text,/91/);
 const writes=h.run.writes;h.reads[0].resolve(reply('8'));for(let i=0;i<6;i++)await Promise.resolve();assert.equal(h.run.writes,writes);
 await h.submit();assert.equal(h.calls.length,0);
 h.props.supplierId='11';h.render();await Promise.resolve();h.run.unmount();const after=h.run.writes;
 h.reads[2].reject(Error('late'));for(let i=0;i<6;i++)await Promise.resolve();assert.equal(h.run.writes,after);
});

test('malformed account rows become a visible read error rather than a crashed or enabled form',async()=>{
 for(const accounts of [[null],[{id:'1',type:'bank',currency:'USD'},{id:'1',type:'cash',currency:'USD'}],[{id:9007199254740992,type:'bank',currency:'USD'}]]){
  const h=payment();h.props.capability=null;h.props.source=source;h.props.supplierId='8';h.render();await Promise.resolve();
  h.reads[0].resolve({success:true,data:{source,supplierId:'8',accounts,debtCurrencies:['USD']},meta:{source,readAt:'2026-09-24T18:00:00Z',sourceContext:{environment:'TEST',server:'Semih\\MELISADEV',database:'MELISA_ERP_FULL_TEST_20260916'}}});
  for(let i=0;i<6;i++)await Promise.resolve();h.render();assert.match(h.text,/Ödeme hesapları okunamadı/);await h.submit();assert.equal(h.calls.length,0);
 }
});

test('outcome read never clears pending; late response after party switch is ignored',async()=>{
 for(const state of ['RECORDED','NOT_FOUND','switch']){
  const h=payment();h.props.source=source;h.props.supplierId='8';h.render();
  const key='melisa.payment.pending:'+source+':8',pending=JSON.stringify({source,supplierId:'8',requestId:'pending-request-1'});
  h.storage.set(key,pending);const p=h.click('Bekleyen ödeme sonucunu oku');assert.equal(h.outcomes.length,1);
  if(state==='switch'){h.props.supplierId='10';h.render();}
  const writes=h.run.writes;
  h.outcomes[0].resolve({success:true,data:{source,supplierId:'8',requestId:'pending-request-1',state:state==='switch'?'RECORDED':state,
   paymentId:state==='NOT_FOUND'?null:'77',compensatesPaymentId:null,readAt:'2026-09-24T22:30:00Z',retryAllowed:false,pendingClearAllowed:false}});
  await p;if(state==='switch')assert.equal(h.run.writes,writes);h.render();
  assert.equal(h.storage.get(key),pending);assert.equal(h.calls.length,0);
  if(state!=='switch')assert.match(h.text,/yeniden gönderim kilidi korunuyor/);else assert.doesNotMatch(h.text,/ödeme #77/);
 }
});

test('pending inverse survives navigation and resolves only the selected original without resend or clearing',async()=>{
 for(const scenario of ['recorded','not-found','wrong-original','wrong-request','same-id','storage-changed','switch','unmount','late-error']){
  const h=payment();h.props.source=source;h.props.supplierId='8';h.render();
  const key=`melisa.payment.inverse.pending:${source}:5`,command={source,supplierId:'8',requestId:'inverse-request-1'};
  h.storage.set(key,JSON.stringify({paymentId:'5',command}));
  h.storage.set(`melisa.payment.inverse.pending:${source}:9`,JSON.stringify({paymentId:'9',command:{...command,supplierId:'10'}}));
  h.storage.set('unrelated-session-key','not JSON and must not be read');
  h.click('Bekleyen telafileri yükle');assert.match(h.text,/Özgün ödeme #5/);assert.doesNotMatch(h.text,/Özgün ödeme #9/);
  const pending=h.storage.get(key),p=h.click('Telafi sonucunu oku #5');
  await h.click('Telafi sonucunu oku #5');assert.equal(h.outcomes.length,1);
  assert.equal(h.outcomes[0].args[2],'inverse-request-1');
  if(scenario==='switch'){h.props.supplierId='10';h.render();}
  if(scenario==='unmount')h.run.unmount();
  if(scenario==='storage-changed')h.storage.set(key,JSON.stringify({paymentId:'5',command:{...command,requestId:'different-request'}}));
  const writes=h.run.writes;
  if(scenario==='late-error')h.outcomes[0].reject(Error('unconfirmed'));
  else h.outcomes[0].resolve({success:true,data:{source,supplierId:'8',requestId:scenario==='wrong-request'?'other-request':'inverse-request-1',
   state:scenario==='not-found'?'NOT_FOUND':'RECORDED',paymentId:scenario==='not-found'?null:scenario==='same-id'?'5':'6',
   compensatesPaymentId:scenario==='not-found'?null:scenario==='wrong-original'?'9':'5',
   readAt:'2026-09-25T06:00:00.1234567Z',retryAllowed:false,pendingClearAllowed:false}});
  await p;
  if(['switch','unmount'].includes(scenario)){assert.equal(h.run.writes,writes);assert.equal(h.outcomes[0].args[3].signal.aborted,true);}
  else{h.render();assert.match(h.text,/yeniden gönderim kilidi korunuyor/);
   if(scenario==='recorded')assert.match(h.text,/telafi #6 \(özgün ödeme #5\)/);
   else if(scenario!=='not-found')assert.match(h.text,/Sonuç doğrulanamadı/);
  }
  if(scenario!=='storage-changed')assert.equal(h.storage.get(key),pending);
  assert.equal(h.calls.length,0);assert.equal(h.inverseCalls.length,0);
 }
});

test('payment outcome never accepts a compensation as the original request',async()=>{
 const h=payment();h.props.source=source;h.props.supplierId='8';h.render();
 const key=`melisa.payment.pending:${source}:8`,pending=JSON.stringify({source,supplierId:'8',requestId:'pending-request-1'});h.storage.set(key,pending);
 const p=h.click('Bekleyen ödeme sonucunu oku');
 h.outcomes[0].resolve({success:true,data:{source,supplierId:'8',requestId:'pending-request-1',state:'RECORDED',paymentId:'6',compensatesPaymentId:'5',
  readAt:'2026-09-25T06:00:00Z',retryAllowed:false,pendingClearAllowed:false}});
 await p;h.render();assert.match(h.text,/Sonuç doğrulanamadı/);assert.equal(h.storage.get(key),pending);
});

test('unreadable and changed inverse pending identity is visible, preserves storage and issues no request',async()=>{
 const h=payment();h.props.source=source;h.props.supplierId='8';h.render();
 const key=`melisa.payment.inverse.pending:${source}:5`;h.storage.set(key,'broken');h.click('Bekleyen telafileri yükle');
 assert.match(h.text,/kayıtları okunamadı/);assert.equal(h.storage.get(key),'broken');assert.equal(h.outcomes.length,0);
 h.storage.set(key,JSON.stringify({paymentId:'5',command:{source,supplierId:'8',requestId:'inverse-request-1'}}));h.click('Bekleyen telafileri yükle');
 h.storage.set(key,JSON.stringify({paymentId:'5',command:{source,supplierId:'10',requestId:'inverse-request-1'}}));
 await h.click('Telafi sonucunu oku #5');assert.equal(h.outcomes.length,0);assert.match(h.text,/Sonuç doğrulanamadı/);
});

test('selected party change invalidates stale payment capability and late command state',async()=>{
 const h=payment();h.props.source=source;h.props.supplierId='8';h.render();h.change('input',0,'2026-09-24');h.change('select',0,'9');h.change('input',1,'1.0000');
 const p=h.submit();assert.equal(h.calls.length,1);
 h.props.supplierId='10';h.render();const writes=h.run.writes;
 h.pending.reject(Error('old'));await p;assert.equal(h.run.writes,writes);h.render();
 h.change('input',0,'2026-09-24');await h.submit();assert.equal(h.calls.length,1);
 assert.match(h.text,/gönderim kapalı/);assert.equal(h.storage.has(`melisa.payment.pending:${source}:8`),true);
});

