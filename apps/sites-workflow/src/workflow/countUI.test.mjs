import test from 'node:test';
import assert from 'node:assert/strict';
import {createCountUI} from './countUI.js';
import {testDaily} from './testDaily.js';

const state=()=>({products:[['A-01','Ürün','ADET',3,60]],goods:[],supplierReturns:[],counts:[{id:'39-1',batchId:'39',code:'A-01',system:3,physical:4,difference:1,reason:'Raf yeniden sayıldı',state:'pending',countedBy:'Satış ekibi'}],audit:[],countSessions:[]});
function reviewFixture({allowed=true,onApprove=()=>{},data=state()}={}){
 let body,callback;const submit={},footer={insertAdjacentHTML(){}},modal={classList:{add(){}},querySelector:q=>q==='[type=submit]'?submit:footer};
 const oldDocument=globalThis.document;globalThis.document={getElementById:()=>modal};
 const ui=createCountUI({getState:()=>data,receipts:()=>[],actor:()=> 'İlker',allowed:()=>allowed,form:(_t,b,cb)=>{body=b;callback=cb},esc:String,btn:()=>'',table:(_h,r)=>r.join(''),td:(...v)=>v.join(' '),onApprove});
 try{ui.review('39')}finally{globalThis.document=oldDocument}
 return {body,submit,apply:d=>callback(data,d),data};
}
test('normal count approval requires a separate bounded justification and forwards it without changing the count',()=>{
 const calls=[],f=reviewFixture({onApprove:(id,reason)=>calls.push({id,reason})}),before=structuredClone(f.data);
 assert.match(f.body,/Onay gerekçesi<input name="reason" minlength="3" maxlength="500" required>/);
 assert.equal(f.submit.disabled,false);
 for(const reason of [undefined,'','  ab  ','a'.repeat(501)])assert.throws(()=>f.apply({reason}),/Onay gerekçesi/);
 assert.deepEqual(calls,[]);assert.deepEqual(f.data,before);
 f.apply({reason:'  İkinci kontrolde fark doğrulandı  '});
 assert.deepEqual(calls,[{id:'39',reason:'İkinci kontrolde fark doğrulandı'}]);assert.deepEqual(f.data,before);
});
test('personnel, stale and unresolved counts cannot submit an approval or see an editable approval reason',()=>{
 const stale=state();stale.products[0][3]=4;
 const unknown=state();unknown.counts[0].unknownScans=[{value:'0000098765432'}];
 for(const options of [{allowed:false},{data:stale},{data:unknown}]){
  const calls=[],f=reviewFixture({...options,onApprove:(...args)=>calls.push(args)});
  assert.equal(f.submit.disabled,true);assert.doesNotMatch(f.body,/name="reason"/);
  assert.throws(()=>f.apply({reason:'Kontrol edildi'}),/onay yetkisi veya güncel stok/);assert.deepEqual(calls,[]);
 }
});
test('saved native approval is readable after refresh and demo approval keeps its existing optional callback contract',()=>{
 const approved=state();approved.counts[0]={...approved.counts[0],state:'accepted',actor:'İlker',approvalReason:'Yetkili rafı tekrar kontrol etti'};
 const saved=reviewFixture({allowed:false,data:approved});
 assert.match(saved.body,/Onay: İlker/);assert.match(saved.body,/Onay gerekçesi: Yetkili rafı tekrar kontrol etti/);
 assert.doesNotMatch(saved.body,/name="reason"/);assert.equal(saved.submit.disabled,true);
 const demo=reviewFixture({onApprove:null});assert.doesNotMatch(demo.body,/name="reason"/);demo.apply();
 assert.equal(demo.data.counts[0].state,'accepted');assert.equal(demo.data.counts[0].actor,'İlker');
});

test('normal count transport persists the entered approver reason in the exact request body and renders saved reason',async()=>{
 const savedGlobals=Object.fromEntries(['document','localStorage','FormData'].map(k=>[k,globalThis[k]])),store=new Map(),calls=[];
 const submit={},footer={insertAdjacentHTML(){}},modal={innerHTML:'',classList:{add(){}},querySelector:q=>q==='[type=submit]'?submit:footer};
 const form={},status={textContent:'',setAttribute(){}},back={style:{}},close={},button={dataset:{dailyAction:'review-count',id:'39'}};
 globalThis.document={getElementById:id=>({modal,'demo-form':form,'daily-status':status,modalback:back,'daily-close':close,'demo-error':status})[id],querySelectorAll:q=>q==='[data-daily-action]'?[button]:[]};
 globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 globalThis.FormData=class{constructor(){return [['reason','  Yetkili stok farkını doğruladı  ']]}};
 const data={scope:{flow:'count',stock_code:'LEGACY',product_id:1,current_stock_qty:3},items:[],drafts:[{id:39,kind:'count',state:'pending',created_by:15,payload_json:JSON.stringify({lines:[{productId:2,stockCode:'A-01',system:3,physical:4,reason:'Raf yeniden sayıldı'}]})}],countProducts:[{id:2,stockCode:'A-01',name:'Ürün',unit:'ADET',stockQuantity:3}]};
 const user={id:16,displayName:'İlker',permissions:['stock.adjust']},options={api:async(path,p)=>{calls.push({path,...p});return {id:39}},user,data,flow:'count',refresh:async()=>{},esc:String,normalScreen:true};
 try{
  testDaily(options).bind();button.onclick();assert.match(modal.innerHTML,/Onay gerekçesi<input/);
  form.onsubmit({preventDefault(){},target:form});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/test-daily/count/approve');assert.equal(calls[0].body.id,39);assert.equal(calls[0].body.reason,'Yetkili stok farkını doğruladı');
  const pending=JSON.parse(store.get('melisa-daily-count-16'));assert.deepEqual(pending.body,calls[0].body);
  data.drafts[0]={...data.drafts[0],state:'approved',decided_by:16,reason:'Yetkili stok farkını doğruladı'};data.countProducts[0].stockQuantity=4;
  testDaily(options).bind();button.onclick();assert.match(modal.innerHTML,/Onay: İlker/);assert.match(modal.innerHTML,/Onay gerekçesi: Yetkili stok farkını doğruladı/);assert.doesNotMatch(modal.innerHTML,/name="reason"/);assert.equal(submit.disabled,true);
 }finally{for(const [key,value] of Object.entries(savedGlobals))if(value===undefined)delete globalThis[key];else globalThis[key]=value}
});
