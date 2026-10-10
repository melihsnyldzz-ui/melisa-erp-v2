import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

async function controller(){
 let source=await readFile(new URL('./workCount.js',import.meta.url),'utf8');
 source=source.replace("import {testDaily} from './testDaily.js';",'const testDaily=options=>{options.data.capture(options);return {html:()=>\'<p id="daily-status"></p>\',bind(){}};};')
  .replace("import {workTaskHandoff} from './workTaskHandoff.mjs';",'const workTaskHandoff=()=>"";')
  .replace("import './workTaskHandoff.css';",'');
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const request={op:'draft',body:{requestId:'unchanged-request',items:[{productId:7,quantity:2}]}};
function fixture(entries={}){
 const values=new Map(Object.entries(entries)),writes=[],calls=[];
 const storage={getItem:key=>values.get(key)??null,setItem(key,value){writes.push({key,value});values.set(key,value);}};
 const notice={textContent:'',setAttribute(){}},modal={style:{display:'none'}};
 const doc={getElementById:id=>id==='daily-status'?notice:id==='modalback'?modal:null};
 const root={isConnected:true,ownerDocument:doc,innerHTML:'',querySelector:()=>null,insertAdjacentHTML(){throw Error('Existing notice should be used');}};
 let options,post=async()=>({id:41});
 const session={inbound:async(path,init)=>{calls.push({path,init});if(init.method==='POST')return post(path,init);return {scope:{flow:'count'},capture(value){options=value;}};}};
 return {storage,values,writes,calls,notice,modal,root,session,get options(){return options;},setPost(value){post=value;}};
}
async function mounted(f,user={id:15}){
 const {createWorkCount}=await controller(),ui=createWorkCount({root:f.root,session:f.session,user,storage:f.storage});ui.mount();await tick();return ui;
}

test('count reads its bounded source and allows exit with no journal or completed journal',async()=>{
 for(const entry of [undefined,null,{...request,result:{id:41,replayed:false}}]){
  const f=fixture(entry===undefined?{}:{'melisa-daily-count-15':JSON.stringify(entry)}),ui=await mounted(f);
  assert.equal(ui.requestClose(),true);assert.equal(f.calls.length,1);assert.equal(f.calls[0].path,'/api/test-daily/count');assert.deepEqual(f.writes,[]);ui.dispose();
 }
});

test('in-flight count write blocks exit even before a pending journal is visible',async()=>{
 const f=fixture(),ui=await mounted(f);let resolve;f.setPost(()=>new Promise(done=>{resolve=done;}));
 const sending=f.options.api('/api/test-daily/count/draft',{method:'POST',body:request.body});
 assert.equal(ui.requestClose(),false);assert.match(f.notice.textContent,/Sonucu doğrulanmadan/);
 resolve({id:41});await sending;assert.equal(ui.requestClose(),true);assert.deepEqual(f.writes,[]);ui.dispose();
});

test('response loss remains blocked after request completion and recreation without automatic replay',async()=>{
 const journal=JSON.stringify(request),f=fixture({'melisa-daily-count-15':journal}),ui=await mounted(f);
 f.setPost(async()=>{throw Error('Response lost');});
 await assert.rejects(f.options.api('/api/test-daily/count/draft',{method:'POST',body:request.body}),/Response lost/);
 assert.equal(ui.requestClose(),false);ui.dispose();
 const again=await mounted(f);assert.equal(again.requestClose(),false);
 assert.equal(f.values.get('melisa-daily-count-15'),journal);assert.deepEqual(f.writes,[]);
 assert.equal(f.calls.filter(call=>call.init.method==='POST').length,1);again.dispose();
});

test('another actor journal is neither read as current uncertainty nor replayed or modified',async()=>{
 const journal=JSON.stringify(request),f=fixture({'melisa-daily-count-16':journal}),ui=await mounted(f);
 assert.equal(ui.requestClose(),true);assert.equal(f.values.get('melisa-daily-count-16'),journal);
 assert.equal(f.calls.filter(call=>call.init.method==='POST').length,0);assert.deepEqual(f.writes,[]);ui.dispose();
});

test('malformed, incomplete and inaccessible current journals fail closed without deletion',async()=>{
 for(const journal of ['broken','{}','[]',JSON.stringify({...request,result:null}),JSON.stringify({...request,result:false})]){
  const f=fixture({'melisa-daily-count-15':journal}),ui=await mounted(f);assert.equal(ui.requestClose(),false);
  assert.equal(f.values.get('melisa-daily-count-15'),journal);assert.deepEqual(f.writes,[]);ui.dispose();
 }
 const f=fixture(),ui=await mounted(f);f.storage.getItem=()=>{throw Error('Storage unavailable');};assert.equal(ui.requestClose(),false);assert.deepEqual(f.writes,[]);ui.dispose();
});

test('open count modal blocks navigation until explicitly closed while local staging is preserved',async()=>{
 const staging='[{"id":"draft-7","items":[{"quantity":2}]}]',f=fixture({'melisa-test-count-staging-count-15':staging}),ui=await mounted(f);
 f.modal.style.display='flex';assert.equal(ui.requestClose(),false);assert.match(f.notice.textContent,/taslağınız saklanır/);
 f.modal.style.display='none';assert.equal(ui.requestClose(),true);
 assert.equal(f.values.get('melisa-test-count-staging-count-15'),staging);assert.deepEqual(f.writes,[]);ui.dispose();
});

test('same actor confirmed retry unlocks exit without the guard replacing request body or result',async()=>{
 const f=fixture({'melisa-daily-count-15':JSON.stringify(request)}),ui=await mounted(f);assert.equal(ui.requestClose(),false);
 const confirmed=JSON.stringify({...request,result:{id:41,replayed:true}});f.values.set('melisa-daily-count-15',confirmed);
 assert.equal(ui.requestClose(),true);assert.equal(f.values.get('melisa-daily-count-15'),confirmed);assert.deepEqual(f.writes,[]);ui.dispose();
});
