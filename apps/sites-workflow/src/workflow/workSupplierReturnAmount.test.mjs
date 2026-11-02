import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Production controller; only its session, DOM and storage are synthetic.
async function controller(){let source=await readFile(new URL('./workSupplierReturns.js',import.meta.url),'utf8');source=source.replace("import './workSupplierReturns.css';",'').replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,import.meta.url).href));return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function context(plan,state,serialized){return {party:{name:'Yapay tedarikçi'},availablePurchaseSources:[{id:139,document_no:'TSTB-RETURN',status:'finalized',document_currency:'USD',supplierName:'Yapay tedarikçi',supplierBalance:140,supplierCurrency:'TRY',items:[{id:701,stock_code:'TEST-RETURN-P',product_name:'Yapay ürün',quantity:5,line_total:350,returnableQuantity:5,pendingQuantity:0,returnedQuantity:0,current_stock_qty:7}]}],drafts:[{id:9,kind:'invoice-return',state,created_by:15,reason:'Geri alma <&> gerekçesi',payload_json:JSON.stringify({sourceInvoiceId:139,items:[{sourceItemId:701,quantity:1}],reason:'Özgün iade gerekçesi'}),plan_json:serialized?JSON.stringify(plan):plan}]};}
async function mount(plan,{state='approved',serialized=false,user={id:15,permissions:['purchase.view']}}={}){
 const {createWorkSupplierReturns}=await controller(),data=context(plan,state,serialized),before=structuredClone(data),calls=[],handlers=new Map();let html='';
 const root={isConnected:true,get innerHTML(){return html;},set innerHTML(value){html=value;},querySelector(selector){return {addEventListener(type,fn){handlers.set(selector+':'+type,fn);},setAttribute(){}};},querySelectorAll(){return [];}};
 const ui=createWorkSupplierReturns({root,user,session:{inbound:async(path,options)=>{calls.push({path,options});assert.equal(options,undefined,'Reading an amount must not create a return');return data;}},storage:{getItem:()=>null,setItem(){assert.fail('Amount rendering must not mutate the journal');},removeItem(){assert.fail('Amount rendering must not clear the journal');}},uuid(){assert.fail('Amount rendering must not generate a request UUID');}});
 ui.mount();await tick();
 const record=()=>/<article class="return-record">([\s\S]*?)<\/article>/.exec(html)?.[1]??assert.fail('Expected the production return record');
 return {ui,root,record,async refresh(){await handlers.get('[data-return-refresh]:click')();},assertReadOnly(){assert.deepEqual(data,before);assert.ok(calls.every(c=>c.path==='/api/test-daily/purchase'&&c.options===undefined));assert.equal(ui.requestClose(),true);}};
}

for(const state of ['pending','approved','rejected','cancelled'])for(const serialized of [false,true]){
 for(const [label,amount] of [['null',null],['empty',''],['whitespace',' \t\n '],['NaN',NaN],['Infinity',Infinity],['negative Infinity',-Infinity]]){
  test(`${state}: ${serialized?'JSON':'object'} ${label} amount is unknown, not zero, on load and refresh`,async t=>{
   const h=await mount({amount,documentCurrency:'TRY'},{state,serialized});t.after(()=>h.ui.dispose());
   const verify=()=>{assert.match(h.record(),/1 adet · Bilinmiyor/);assert.doesNotMatch(h.record(),/0,00|NaN|Infinity/);assert.match(h.record(),/Özgün iade gerekçesi/);if(state==='cancelled')assert.match(h.record(),/Geri alma &lt;&amp;&gt; gerekçesi/);h.assertReadOnly();};
   verify();await h.refresh();verify();
  });
 }
}

for(const currency of ['TRY','USD','EUR'])for(const [label,amount,display] of [['numeric zero',0,'0,00'],['string zero','0','0,00'],['decimal zero','0.0000','0,00'],['number',1234.5,'1.234,50'],['numeric string','1234.50','1.234,50'],['negative',-12.34,'-12,34']]){
 test(`${currency}: ${label} retains its real amount and document currency after refresh`,async t=>{
  const h=await mount({amount,documentCurrency:currency},{serialized:true});t.after(()=>h.ui.dispose());
  assert.ok(h.record().includes('1 adet · '+display+' '+currency));assert.doesNotMatch(h.record(),/Bilinmiyor/);await h.refresh();assert.ok(h.record().includes(display+' '+currency));h.assertReadOnly();
 });
}

test('omitted amount stays absent; a valid amount still falls back to the source invoice currency',async t=>{
 for(const [plan,expected] of [[{},'1 adet</p>'],[{amount:70},'1 adet · 70,00 USD']]){
  const h=await mount(plan);t.after(()=>h.ui.dispose());assert.ok(h.record().includes(expected));await h.refresh();assert.ok(h.record().includes(expected));h.assertReadOnly();
 }
});

test('amount formatting keeps text escaped and does not grant return decisions to a viewer',async t=>{
 const h=await mount({amount:'70.00',documentCurrency:'<img src=x onerror=alert(1)>'});t.after(()=>h.ui.dispose());
 assert.match(h.record(),/70,00 &lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(h.record(),/<img|data-return-approve|data-return-reject|data-return-cancel/);await h.refresh();h.assertReadOnly();
});
