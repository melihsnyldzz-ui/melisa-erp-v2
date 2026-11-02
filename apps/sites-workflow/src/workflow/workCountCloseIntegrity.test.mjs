import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {projectPersonnelDailyResponse} from '../../../api/src/services/personnelDailyProjection.mjs';

const storageSlot='melisa-daily-count-15',requestId='00000000-0000-4000-8000-000000000001';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const body=()=>({requestId,lines:[{productId:'1',stockCode:'OFFLINE-1',physical:4,system:3,reason:'Raf kontrolü',movementFingerprint:'a'.repeat(64)}],unknownScans:[],date:'2026-10-07',unit:'ADET',warehouse:'TEST-DAILY-WH'});
const draft=(result={id:41,kind:'count',state:'pending',replayed:false})=>({op:'draft',body:body(),result});
const decision=(op,result)=>({op,body:{requestId,id:41,reason:'Offline kontrol kararı'},result});
const approval=()=>({id:41,result:{id:41,lines:[{productId:1,difference:1,movementCreated:true,movementId:701}],unknownScans:[],movementCreated:true},replayed:false});
const reversal=()=>({id:41,reversal:{id:91,flow:'count',kind:'count',original_draft_id:41,reversal_stock_movement_id:702},originalPreserved:true,replayed:false});
async function controller(){
 let source=await readFile(new URL('./workCount.js',import.meta.url),'utf8');
 source=source.replace("import './workTaskHandoff.css';",'');
 for(const file of ['testDaily.js','workTaskHandoff.mjs'])source=source.replace("'./"+file+"'",JSON.stringify(new URL('./'+file,import.meta.url).href));
 return (await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).createWorkCount;
}
function data(){return {scope:{flow:'count',product_id:1,stock_code:'OFFLINE-1',current_stock_qty:3},items:[],accounts:[],availablePurchaseSources:[],source:null,countProducts:[{id:'1',stockCode:'OFFLINE-1',name:'Offline item',unit:'ADET',stockQuantity:3}],drafts:[]};}
// Production count controller + testDaily + models; only storage/DOM/transport are doubles.
async function fixture(entry,{raw,actor={id:15,displayName:'Semih',permissions:['product.view']},rows=[]}={}){
 const previous=Object.fromEntries(['localStorage','document','window','FormData'].map(name=>[name,globalThis[name]]));
 const values=new Map(),writes=[],calls=[],nodes=new Map();
 if(raw!==undefined)values.set(storageSlot,raw);else if(entry!==undefined)values.set(storageSlot,JSON.stringify(entry));
 const storage={getItem:k=>values.get(k)??null,setItem(k,value){writes.push({key:k,value});values.set(k,value);},removeItem(){throw Error('Journal must not be deleted');}};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{style:{display:'none'},textContent:'',innerHTML:'',disabled:false,classList:{add(){}},setAttribute(name,value){this[name]=value;},addEventListener(event,fn){this['on'+event]=fn;},querySelector:node,querySelectorAll:()=>[],insertAdjacentHTML(){}});return nodes.get(id);};
 const retry={dataset:{dailyAction:'retry'},disabled:false},review={dataset:{dailyAction:'review-count',id:'41'}};
 const root={isConnected:true,innerHTML:'',querySelector:()=>null,insertAdjacentHTML(){throw Error('Existing daily status is available');}};
 const doc={getElementById:node,querySelector:node,querySelectorAll(selector){
  if(selector==='[data-daily-action]')return [...(root.innerHTML.includes('data-daily-action="retry"')?[retry]:[]),...(rows.length?[review]:[])];
  if(selector==='[data-daily-action],[data-receipt-decision]'||selector==='[data-daily-action=retry]')return [retry];
  return [];
 }};root.ownerDocument=doc;
 globalThis.localStorage=storage;globalThis.document=doc;globalThis.window={location:{protocol:'http:',hostname:'127.0.0.1',port:'5194'}};
 globalThis.FormData=class{*[Symbol.iterator](){yield ['reason','Offline kontrol kararı'];}};
 let respond=async()=>({id:41,kind:'count',state:'pending',replayed:true}),readFailure=false;
 const session={inbound:async(path,options={})=>{calls.push({path,options:structuredClone(options)});if(options.method==='POST')return respond(path,options);if(readFailure)throw {status:403};return {...data(),drafts:structuredClone(rows)};}};
 const create=await controller();let ui;
 const mount=async()=>{ui=create({root,session,user:actor,storage});ui.mount();await tick();};await mount();
 return {values,writes,calls,storage,root,node,retry,review,ui:()=>ui,setResponse(fn){respond=fn;},setReadFailure(value){readFailure=value;},async reload(){ui.dispose();await mount();},async replay(){assert.equal(typeof retry.onclick,'function');retry.onclick();await tick();},close(){ui.dispose();for(const [name,value] of Object.entries(previous))if(value===undefined)delete globalThis[name];else globalThis[name]=value;}};
}

const invalid=[
 ['empty result',draft({})],['missing document id',draft({replayed:true})],['null id',draft({id:null})],['zero id',draft({id:0})],['negative id',draft({id:-1})],['fractional id',draft({id:1.5})],['unsafe id',draft({id:Number.MAX_SAFE_INTEGER+1})],['boolean id',draft({id:true})],['blank id',draft({id:' '})],
 ['missing operation',{body:body(),result:{id:41}}],['foreign operation',{...draft(),op:'collection'}],['missing body',{op:'draft',result:{id:41}}],['array body',{...draft(),body:[]}],['missing request UUID',{...draft(),body:{lines:body().lines}}],
 ['foreign kind',draft({id:41,kind:'invoice-return',state:'pending'})],['foreign flow',draft({id:41,flow:'purchase'})],['wrong response UUID',draft({id:41,requestId:'00000000-0000-4000-8000-000000000002'})],['invalid replay flag',draft({id:41,replayed:'yes'})],['invalid already-applied flag',draft({id:41,alreadyApplied:{}})],['wrong draft state',draft({id:41,state:'approved',kind:'count'})],
 ['approve wrong document',decision('approve',{...approval(),id:42})],['approve missing target',decision('approve',approval())],['approve missing receipt',decision('approve',{id:41})],['approve null receipt',decision('approve',{id:41,result:null})],['approve array receipt',decision('approve',{id:41,result:[]})],['approve wrong nested document',decision('approve',{id:41,result:{...approval().result,id:42}})],
 ['reject unconfirmed state',decision('reject',{id:41})],['reject wrong document',decision('reject',{id:42,state:'rejected'})],['cancel missing reversal',decision('cancel',{id:41})],['cancel empty reversal',decision('cancel',{id:41,reversal:{}})],['cancel foreign reversal',decision('cancel',{id:41,reversal:{...reversal().reversal,kind:'uninvoiced'}})],['cancel wrong original',decision('cancel',{id:41,reversal:{...reversal().reversal,original_draft_id:42}})],
];
const failures=[['explicit error',{error:{code:'FAILED'}}],['unsuccessful',{success:false}],['not ok',{ok:false}]];
for(const [op,entry] of [['draft',draft()],['approve',decision('approve',approval())],['reject',decision('reject',{id:41,state:'rejected'})],['cancel',decision('cancel',reversal())]])for(const [name,fields] of failures)invalid.push([`${op} ${name} with valid id`,{...entry,result:{...entry.result,...fields}}]);
for(const [op,entry,storageSlot] of [['approve',decision('approve',approval()),'result'],['cancel',decision('cancel',reversal()),'reversal']]){
 for(const [name,fields] of failures)invalid.push([`${op} nested ${name}`,{...entry,result:{...entry.result,[storageSlot]:{...entry.result[storageSlot],...fields}}}]);
 invalid.push([`${op} contradictory outer state`,{...entry,result:{...entry.result,state:op==='approve'?'rejected':'approved'}}]);
 invalid.push([`${op} contradictory nested state`,{...entry,result:{...entry.result,[storageSlot]:{...entry.result[storageSlot],state:op==='approve'?'rejected':'approved'}}}]);
}
invalid.find(([name])=>name==='approve missing target')[1].body={requestId};
for(const [name,entry] of invalid)test(`invalid ${name} keeps close blocked and preserves original journal across reload`,async()=>{
 const h=await fixture(entry);
 try{
  const original=h.values.get(storageSlot);assert.equal(h.ui().requestClose(),false);assert.match(h.node('daily-status').textContent,/Sonucu doğrulanmadan/);
  await h.reload();assert.equal(h.ui().requestClose(),false);assert.equal(h.values.get(storageSlot),original);assert.deepEqual(h.writes,[]);assert.equal(h.calls.filter(c=>c.options.method==='POST').length,0);
 }finally{h.close();}
});

const valid=[
 ['legacy minimal draft',draft({id:41,replayed:false})],['full draft',draft({id:41,kind:'count',state:'pending',payload:body(),plan:null,replayed:false})],['replayed draft',draft({id:41,kind:'count',state:'pending',replayed:true})],
 ['multi-line approval',decision('approve',approval())],['already-applied approval',decision('approve',{...approval(),alreadyApplied:true,replayed:true})],['zero-change legacy approval',decision('approve',{id:41,result:{productId:1,difference:0,movementCreated:false},replayed:false})],
 ['rejection',decision('reject',{id:41,state:'rejected',replayed:false})],['cancellation',decision('cancel',reversal())],['already-applied cancellation',decision('cancel',{...reversal(),alreadyApplied:true,replayed:true})],
];
for(const [name,entry] of valid)test(`valid ${name} permits close without rewriting the stored receipt`,async()=>{
 const h=await fixture(entry);
 try{const original=h.values.get(storageSlot);assert.equal(h.ui().requestClose(),true);await h.reload();assert.equal(h.ui().requestClose(),true);assert.equal(h.values.get(storageSlot),original);assert.deepEqual(h.writes,[]);assert.ok(h.calls.every(c=>!c.options.method));}finally{h.close();}
});

for(const [name,entry] of valid)test(`real personnel projection of ${name} remains a valid existing receipt`,async()=>{
 const projected={...entry,result:projectPersonnelDailyResponse('count',{permissions:['product.view','stock.adjust']},entry.result)},h=await fixture(projected);
 try{const original=h.values.get(storageSlot);assert.equal(h.ui().requestClose(),true);assert.equal(h.values.get(storageSlot),original);assert.deepEqual(h.writes,[]);}finally{h.close();}
});

test('production explicit retry preserves exact original operation UUID and body until valid acknowledgement',async()=>{
 const entry=draft();delete entry.result;const h=await fixture(entry);let resolve;
 try{
  h.setResponse(()=>new Promise(done=>{resolve=done;}));const before=h.values.get(storageSlot);assert.equal(h.ui().requestClose(),false);
  h.retry.onclick();await tick();assert.equal(h.ui().requestClose(),false);
  assert.deepEqual(h.calls.filter(c=>c.options.method==='POST'),[{path:'/api/test-daily/count/draft',options:{method:'POST',body:entry.body}}]);
  assert.equal(h.values.get(storageSlot),before);resolve({id:41,kind:'count',state:'pending',replayed:true});await tick();
  assert.equal(h.ui().requestClose(),true);const saved=JSON.parse(h.values.get(storageSlot));assert.deepEqual(saved.body,entry.body);assert.equal(saved.op,entry.op);assert.equal(saved.result.replayed,true);
  await h.reload();assert.equal(h.ui().requestClose(),true);assert.equal(h.calls.filter(c=>c.options.method==='POST').length,1);
 }finally{h.close();}
});

test('production successful HTTP response containing an empty object never unlocks close',async()=>{
 const entry=draft();delete entry.result;const h=await fixture(entry);
 try{h.setResponse(async()=>({}));await h.replay();assert.equal(h.ui().requestClose(),false);assert.deepEqual(JSON.parse(h.values.get(storageSlot)),{...entry,result:{}});await h.reload();assert.equal(h.ui().requestClose(),false);assert.equal(h.calls.filter(c=>c.options.method==='POST').length,1);}finally{h.close();}
});

test('a confirmed receipt remains valid when its following refresh fails without posting again',async()=>{
 const entry=draft();delete entry.result;const h=await fixture(entry);
 try{h.setReadFailure(true);await h.replay();assert.equal(h.ui().requestClose(),true);assert.match(h.root.innerHTML,/sayım kayıtlarını görüntüleme/);await h.reload();assert.equal(h.ui().requestClose(),true);assert.equal(h.calls.filter(c=>c.options.method==='POST').length,1);}finally{h.close();}
});

test('personal display name Semih does not confer count approval authority or clear an unresolved journal',async()=>{
 const entry=draft({}),row={id:41,kind:'count',state:'pending',created_by:15,created_by_name:'Semih',payload_json:JSON.stringify({lines:body().lines,unknownScans:[]}),result_json:null};
 const h=await fixture(entry,{rows:[row]});
 try{
  const original=h.values.get(storageSlot);h.review.onclick();assert.equal(h.node('[type=submit]').disabled,true);
  h.node('demo-form').onsubmit({preventDefault(){},target:{}});assert.match(h.node('demo-error').textContent,/onay yetkisi/);
  h.node('modalback').style.display='none';assert.equal(h.ui().requestClose(),false);assert.equal(h.values.get(storageSlot),original);assert.deepEqual(h.writes,[]);assert.ok(h.calls.every(c=>!c.options.method));
 }finally{h.close();}
});
