import test from 'node:test';
import assert from 'node:assert/strict';
import {createCountUI} from './countUI.js';
import {testDaily} from './testDaily.js';

const state=()=>({products:[['A-01','Ürün','ADET',3,60]],goods:[],supplierReturns:[],counts:[{id:'39-1',batchId:'39',code:'A-01',system:3,physical:4,difference:1,reason:'Raf yeniden sayıldı',state:'pending',countedBy:'Satış ekibi'}],audit:[],countSessions:[]});
function reviewFixture({allowed=true,onApprove=()=>{},data=state(),normalScreen=false}={}){
 let body,callback;const submit={},footer={insertAdjacentHTML(){}},modal={classList:{add(){}},querySelector:q=>q==='[type=submit]'?submit:footer};
 const oldDocument=globalThis.document;globalThis.document={getElementById:()=>modal};
 const ui=createCountUI({getState:()=>data,receipts:()=>[],actor:()=> 'İlker',allowed:()=>allowed,normalScreen,form:(_t,b,cb)=>{body=b;callback=cb},esc:String,btn:()=>'',table:(_h,r)=>r.join(''),td:(...v)=>v.join(' '),onApprove});
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
test('normal cancelled count shows stored undo reason while keeping original quantity/reason and lab defaults unchanged',()=>{
 const data=state();data.counts[0]={...data.counts[0],state:'cancelled',reversalReason:'Hatalı deneme geri alındı'};const before=JSON.stringify(data),calls=[],normal=reviewFixture({data,normalScreen:true,onApprove:(...args)=>calls.push(args)});assert.match(normal.body,/Geri alma gerekçesi: Hatalı deneme geri alındı/);assert.match(normal.body,/Raf yeniden sayıldı/);assert.match(normal.body,/Özgün sayım değerleri geçmişte korunur/);assert.doesNotMatch(normal.body,/Onay bütün ürünleri birlikte günceller|name="reason"/);assert.equal(normal.submit.disabled,true);assert.equal(normal.submit.textContent,'Salt okunur kayıt');assert.throws(()=>normal.apply({reason:'Yeni onay gerekçesi'}),/onay yetkisi/);assert.deepEqual(calls,[]);assert.equal(JSON.stringify(data),before);const lab=reviewFixture({data,normalScreen:false});assert.doesNotMatch(lab.body,/Geri alma gerekçesi:|Özgün sayım değerleri/);assert.match(lab.body,/Onay bütün ürünleri birlikte günceller/);assert.equal(lab.submit.textContent,'Bütün farkları uygula');
});
test('normal history and readonly review use only top-level cancelled reason, escape it and close without API or journal writes',()=>{
 const savedGlobals=Object.fromEntries(['document','localStorage','FormData'].map(k=>[k,globalThis[k]])),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 try{for(const reversalReason of ['Hata <&> geri alındı',undefined,'  ',{reason:'Yanlış biçim'}])for(const userId of [15,16]){
  const store=new Map([['melisa-daily-count-'+userId,JSON.stringify({op:'approve',body:{id:7,reason:'Önceki kayıt'},result:{id:7}})],['melisa-test-count-staging-count-'+userId,'[]']]),beforeStore=JSON.stringify([...store]),calls=[],close={},submit={},footer={insertAdjacentHTML(){}},form={},status={textContent:'',setAttribute(){}},back={style:{}},button={dataset:{dailyAction:'review-count',id:'7'}},modal={innerHTML:'',classList:{add(){}},querySelector:q=>q==='[type=submit]'?submit:q==='[data-demo-action=close]'?close:footer};
  globalThis.document={getElementById:id=>({modal,'demo-form':form,'daily-status':status,modalback:back,'daily-close':close,'demo-error':status})[id],querySelectorAll:q=>q==='[data-daily-action]'?[button]:[]};globalThis.localStorage={getItem:k=>store.get(k)??null,setItem(){assert.fail('readonly must not save');}};globalThis.FormData=class{constructor(){return []}};
  const data={scope:{flow:'count',stock_code:'TEST-LEGACY',product_id:1,current_stock_qty:3},items:[],drafts:[{id:7,kind:'count',state:'cancelled',created_by:15,decided_by:16,reason:reversalReason,payload_json:JSON.stringify({lines:[{productId:2,stockCode:'A-01',system:3,physical:4,reason:'Özgün raf gerekçesi'}]}),result_json:JSON.stringify({reversal:{reason:'Eski alternatif alan kullanılmaz'}})}],countProducts:[{id:2,stockCode:'A-01',name:'Ürün',unit:'ADET',stockQuantity:3}]},beforeData=JSON.stringify(data),ui=testDaily({api:(...args)=>calls.push(args),user:{id:userId,displayName:'Test kullanıcısı',permissions:userId===16?['stock.adjust']:[]},data,flow:'count',refresh:()=>{},esc,normalScreen:true}),html=ui.html();ui.bind();button.onclick();
  const expected=typeof reversalReason==='string'&&reversalReason.trim()?'Geri alma gerekçesi: Hata &lt;&amp;&gt; geri alındı':'Geri alma gerekçesi kayıtlı değil.';for(const text of [html,modal.innerHTML]){assert.ok(text.includes(expected));assert.ok(!text.includes('Eski alternatif alan kullanılmaz'));assert.ok(!text.includes('<&>'));}assert.match(modal.innerHTML,/Özgün raf gerekçesi/);assert.match(modal.innerHTML,/A-01 · Ürün/);assert.ok(modal.innerHTML.includes('<td>3</td><td>4</td><td>1</td>'));assert.equal(submit.disabled,true);assert.equal(close.textContent,'Kapat');const handler=close.onclick;handler();assert.equal(back.style.display,'none');assert.equal(close.onclick,handler);form.onsubmit({preventDefault(){},target:form});assert.deepEqual(calls,[]);assert.equal(JSON.stringify([...store]),beforeStore);assert.equal(JSON.stringify(data),beforeData);
 }}finally{for(const [key,value]of Object.entries(savedGlobals))if(value===undefined)delete globalThis[key];else globalThis[key]=value}
});
