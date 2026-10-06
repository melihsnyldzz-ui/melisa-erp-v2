import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

function context(drafts=[]){return {party:{name:'TEST tedarikçi'},availablePurchaseSources:[{id:139,document_no:'TSTB-PAY',status:'finalized',document_currency:'USD',supplierName:'TEST tedarikçi',supplierBalance:140,supplierCurrency:'TRY',items:[{id:701,stock_code:'TEST-V70-GOODS-P',product_name:'Ayrılmış TEST ürünü',quantity:5,line_total:350,returnableQuantity:5,pendingQuantity:0,returnedQuantity:0,current_stock_qty:7}]}],drafts};}
async function controller(){let source=await readFile(new URL('./workSupplierReturns.js',import.meta.url),'utf8');source=source.replace("import './workSupplierReturns.css';",'');for(const file of ['testDailyPurchaseModel.js','workTradeModel.mjs','supplierReturnJournal.mjs'])source=source.replace("'./"+file+"'",JSON.stringify(new URL('./'+file,import.meta.url).href));return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));}
function dom(){let html='';const root={isConnected:true,get innerHTML(){return html;},set innerHTML(v){html=v;},querySelector(){return {addEventListener(){},setAttribute(){}};},querySelectorAll(){return [];}};return root;}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('normal supplier return screen reads only its bounded TEST source and presents real invoice quantity and currency',async()=>{
 const {createWorkSupplierReturns}=await controller(),root=dom(),calls=[];const ui=createWorkSupplierReturns({root,session:{inbound:async(path,options)=>{calls.push({path,options});return context();}},user:{id:15,permissions:['purchase.view']},storage:null});ui.mount();await tick();
 assert.deepEqual(calls,[{path:'/api/test-daily/purchase',options:undefined}]);assert.match(root.innerHTML,/TSTB-PAY/);assert.match(root.innerHTML,/kalan 5 adet/);assert.match(root.innerHTML,/70,00 USD\/adet/);assert.match(root.innerHTML,/Kaynak alış satırı/);assert.doesNotMatch(root.innerHTML,/TEST SQL|UUID|fixture|debug/i);assert.doesNotMatch(root.innerHTML,/data-return-approve/);ui.dispose();
});

test('pending scoped return decisions are visible only to the server-designated reviewer role',async()=>{
 const {createWorkSupplierReturns}=await controller();const payload=JSON.stringify({sourceInvoiceId:139,items:[{sourceItemId:701,quantity:1}],reason:'Kontrol'}),plan_json=JSON.stringify({sourceDocumentNo:'TSTB-PAY',items:[{stockCode:'TEST-V70-GOODS-P'}]});
 for(const [user,expected] of [[{id:15,permissions:['purchase.view']},false],[{id:16,permissions:['purchase.view','purchase.cancel']},true]]){const root=dom(),ui=createWorkSupplierReturns({root,session:{inbound:async()=>context([{id:9,kind:'invoice-return',state:'pending',payload_json:payload,plan_json}])},user,storage:null});ui.mount();await tick();assert.equal(root.innerHTML.includes('data-return-approve="9"'),expected);ui.dispose();}
});
