// Controller event regression; this does not replace a normal browser test.
import test from 'node:test';import assert from 'node:assert/strict';
import {mountDesktopWorkflowScreen} from './desktopWorkflowScreen.mjs';
import {captureDesktopPackingSource,readDesktopPackingRecovery} from './desktopPackingRecovery.mjs';
function root(){let html='',elements=[];return {get innerHTML(){return html;},set innerHTML(value){html=value;elements=[...value.matchAll(/<(button|input|select)[^>]*>/g)].map(match=>{const attrs=Object.fromEntries([...match[0].matchAll(/([a-zA-Z][\w-]*)(?:="([^"]*)")?/g)].map(a=>[a[1],a[2]??'']));return {attrs,dataset:Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_m,c)=>c.toUpperCase()),v])),value:attrs.value??'',disabled:Object.hasOwn(attrs,'disabled'),events:{},addEventListener(name,fn){this.events[name]=fn;}};});},insertAdjacentHTML(_where,value){this.innerHTML=this.innerHTML+value;},querySelectorAll(selector){const match=/^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);return match?elements.filter(e=>Object.hasOwn(e.attrs,match[1])&&(match[2]===undefined||e.attrs[match[1]]===match[2])):[];},querySelector(selector){return this.querySelectorAll(selector)[0]??null;}};}
test('dirty carton edits block close and refresh even when a refresh event is forced',async()=>{
 const node=root(),storage={getItem:key=>key.includes('.last.')?'12':null,setItem(){},removeItem(){}},record={invoiceId:'12',documentNo:'DS-1',customerName:'Ada',customerId:'2',documentDate:'2026-11-05',workflowState:'PREPARING',version:'0x0000000000000001',totalExact4:'27.5000',items:[{itemId:'1',productId:'5',stockCode:'A',name:'Bir',quantityExact3:'2.000',unitPriceExact4:'10.0000',lineTotalExact4:'20.0000'},{itemId:'2',productId:'9',stockCode:'B',name:'İki',quantityExact3:'1.000',unitPriceExact4:'7.5000',lineTotalExact4:'7.5000'}],cartonItems:[{cartonNo:1,itemId:'1',quantityExact3:'1.000'}]};let reads=0;
 const controller={pending:()=>null,read:async()=>{reads++;return structuredClone(record);}},screen=mountDesktopWorkflowScreen({root:node,core:{sale:()=>controller},storage,actorId:'8'});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(reads,1);assert.equal(screen.requestClose(),true);
 const input=node.querySelector('[data-box]');input.value='2.000';input.events.input({target:input});assert.equal(screen.requestClose(),false);assert.equal(node.querySelector('[data-refresh]').disabled,true);
 node.querySelector('[data-refresh]').events.click();await new Promise(resolve=>setImmediate(resolve));assert.equal(reads,1);assert.equal(node.querySelector('[data-box]').value,'2.000');assert.match(node.innerHTML,/Önce koli değişikliklerini kaydedin/);screen.dispose();
});
test('no-commit resolution preserves submitted cartons before refreshing and offers explicit reapplication',async()=>{
 const node=root(),data=new Map([['melisa.desktop.workflow.last.v1.8','12']]),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const entry={kind:'transition',body:{requestId:'da171000-6f42-4f19-8cab-9f4539618647',invoiceId:'12',operation:'SAVE_CARTONS',expectedVersion:'0x0000000000000001',cartons:[{cartonNo:1,items:[{itemId:'1',quantityExact3:'2.000'}]}]}};let unresolved=entry;
 const record={invoiceId:'12',documentNo:'DS',customerName:'Ada',documentDate:'2026-11-05',workflowState:'PREPARING',version:'0x0000000000000002',totalExact4:'20.0000',items:[{itemId:'1',productId:'5',stockCode:'P5',name:'Ürün',quantityExact3:'2.000',unitPriceExact4:'10.0000',lineTotalExact4:'20.0000'}],cartonItems:[]};
 const controller={pending:()=>unresolved,read:async()=>structuredClone(record),resolve:async()=>{unresolved=null;return {state:'NOT_COMMITTED'};}};
 captureDesktopPackingSource(storage,'8',{...record,version:entry.body.expectedVersion});
 const screen=mountDesktopWorkflowScreen({root:node,core:{sale:()=>controller},storage,actorId:'8'});await new Promise(resolve=>setImmediate(resolve));
 node.querySelector('[data-resolve]').events.click();await new Promise(resolve=>setImmediate(resolve));
 const saved=readDesktopPackingRecovery(storage,'8','12');assert.deepEqual(saved.cartons,entry.body.cartons);assert.match(node.innerHTML,/Korunan koli taslağı/);
 node.querySelector('[data-restore-packing]').events.click();assert.equal(node.querySelector('[data-box]').value,'2.000');assert.equal(screen.requestClose(),false);screen.dispose();
});

test('draft cancellation requires explicit confirmation and reopens the cancelled record',async()=>{
 const node=root(),storage={getItem:k=>k.includes('.last.')?'12':null,setItem(){},removeItem(){}};let calls=0;
 const record={invoiceId:'12',documentNo:'DS',customerName:'Ada',customerId:'2',documentDate:'2026-11-06',workflowState:'DRAFT',version:'0x0000000000000001',totalExact4:'10.0000',items:[{itemId:'1',productId:'5',stockCode:'P5',name:'Ürün',quantityExact3:'1.000',unitPriceExact4:'10.0000',lineTotalExact4:'10.0000'}],cartonItems:[]};
 const controller={pending:()=>null,read:async()=>structuredClone(record),create:async(kind,payload)=>{calls++;assert.equal(kind,'transition');assert.equal(payload.operation,'CANCEL');assert.equal(payload.expectedVersion,record.version);record.workflowState='CANCELLED';return {state:'COMMITTED',invoiceId:'12',replayed:false};}};
 const screen=mountDesktopWorkflowScreen({root:node,core:{sale:()=>controller},storage,actorId:'8'});await new Promise(resolve=>setImmediate(resolve));assert.equal(node.querySelector('[data-cancel-draft]'),null);
 node.querySelector('[data-start-cancel]').events.click();assert.equal(calls,0);assert.match(node.innerHTML,/ayrılan ürünler serbest bırakılacak/);node.querySelector('[data-keep-draft]').events.click();assert.equal(calls,0);assert.equal(node.querySelector('[data-cancel-draft]'),null);
 node.querySelector('[data-start-cancel]').events.click();node.querySelector('[data-cancel-draft]').events.click();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);assert.match(node.innerHTML,/İptal/);assert.equal(node.querySelector('[data-start-cancel]'),null);assert.equal(node.querySelector('[data-new]').disabled,false);screen.dispose();
});

test('incomplete saved cartons show a useful warning before any READY request',async()=>{
 const node=root(),storage={getItem:k=>k.includes('.last.')?'12':null,setItem(){},removeItem(){}};let calls=0;
 const record={invoiceId:'12',documentNo:'DS',customerName:'Ada',documentDate:'2026-11-06',workflowState:'PREPARING',version:'0x0000000000000001',totalExact4:'20.0000',items:[{itemId:'1',productId:'5',stockCode:'P5',name:'Ürün',quantityExact3:'2.000',unitPriceExact4:'10.0000',lineTotalExact4:'20.0000'}],cartonItems:[{cartonNo:1,itemId:'1',quantityExact3:'1.000'}]};
 const controller={pending:()=>null,read:async()=>structuredClone(record),create:async()=>{calls++;throw Error('must not send');}};
 const screen=mountDesktopWorkflowScreen({root:node,core:{sale:()=>controller},storage,actorId:'8'});await new Promise(resolve=>setImmediate(resolve));node.querySelector('[data-action="READY"]').events.click();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,0);assert.match(node.innerHTML,/Koli miktarları eksik veya fazla/);screen.dispose();
});
