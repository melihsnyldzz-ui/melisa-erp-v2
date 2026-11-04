import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyActorName,testDaily} from './testDaily.js';

test('recorded actor identity uses its own server name and never guesses a role or current user',()=>{
 assert.equal(dailyActorName(21,' Örnek sayım personeli '),'Örnek sayım personeli');
 assert.equal(dailyActorName(10018,'Semih'),'Semih');
 for(const id of [15,16,21,22,10018])for(const name of [null,undefined,'',' ', 'x'.repeat(151),'bad\nname'])assert.equal(dailyActorName(id,name),'Kullanıcı #'+id);
 for(const id of [null,undefined,0,-1,'other','9223372036854775808'])assert.equal(dailyActorName(id,'Semih'),'Kullanıcı bilinmiyor');
});

test('normal count review shows database creator for legacy, multi-line and unknown scans without writes',()=>{
 const saved=Object.fromEntries(['window','document','localStorage'].map(k=>[k,globalThis[k]]));
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 try{for(const payload of [{physical:24,system:23,reason:'Raf kontrolü'},{lines:[{productId:'1',stockCode:'0007',physical:24,system:23,reason:'Raf kontrolü'}],unknownScans:[]},{lines:[],unknownScans:[{value:'0000000',quantity:1,status:'needs_review'}]}]){
  let calls=0,writes=0;const modal={innerHTML:'',classList:{add(){}},querySelector:()=>({textContent:'',disabled:false,insertAdjacentHTML(){}})},button={dataset:{dailyAction:'review-count',id:'10'}};
  globalThis.window={location:{protocol:'http:',hostname:'127.0.0.1',port:'5194'}};
  globalThis.localStorage={getItem:()=>null,setItem(){writes++;}};
  globalThis.document={getElementById:id=>id==='modal'?modal:id==='modalback'?{style:{}}:{},querySelectorAll:q=>q==='[data-daily-action]'?[button]:[]};
  const data={scope:{flow:'count',stock_code:'0007',product_id:1,current_stock_qty:23},items:[],accounts:[],availablePurchaseSources:[],countProducts:[{id:'1',stockCode:'0007',name:'Ürün',unit:'ADET',stockQuantity:23}],drafts:[{id:10,kind:'count',state:'cancelled',created_by:21,created_by_name:'Örnek sayım personeli',decided_by:22,decided_by_name:'Örnek stok sorumlusu',payload_json:JSON.stringify({...payload,countedBy:'Semih'}),result_json:null,reason:'Geri alındı'}]};
  const ui=testDaily({api:async()=>{calls++;},user:{id:10018,displayName:'Semih',permissions:['product.view','stock.adjust']},data,flow:'count',refresh:async()=>{},esc,normalScreen:true});ui.bind();button.onclick();
  assert.match(modal.innerHTML,/Sayan: Örnek sayım personeli/);assert.doesNotMatch(modal.innerHTML,/Sayan: (?:Satış ekibi|Semih)/);assert.equal(calls,0);assert.equal(writes,0);
 }}finally{for(const[k,v]of Object.entries(saved))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
});
