// Controller event regression; this does not replace a normal browser test.
import test from 'node:test';import assert from 'node:assert/strict';
import {mountDesktopWorkflowScreen} from './desktopWorkflowScreen.mjs';
import {captureDesktopPackingSource,readDesktopPackingRecovery} from './desktopPackingRecovery.mjs';
test('series quantity display and draft both use the authoritative preview instead of stale list factor',async()=>{
 for(const factor of ['8.00000000',null]){const node=root(),calls=[],storage={getItem:()=>null,setItem(){},removeItem(){}},controller={pending:()=>null,preview:async()=>({revision:'a'.repeat(64),products:[{productId:'5',stockCode:'P5',unit:'ADET',priceExact4:'12.0000',stockExact3:'60.000',reservedExact3:'0.000',...(factor?{seriesUnit:{unitId:'53',factorExact8:factor}}:{})},{productId:'9',stockCode:'P9',unit:'ADET',priceExact4:'10.0000',stockExact3:'3.000',reservedExact3:'0.000'}]}),create:async(kind,body)=>{calls.push({kind,body});return {state:'UNKNOWN'};}};
  const core={sale:()=>controller,list:async kind=>({data:kind==='customers'?[{id:'2',customerCode:'M2',customerName:'Ada'}]:[{id:'5',stockCode:'P5',productName:'Serili ürün',unit:'ADET',seriesUnitId:'53',seriesFactorExact8:'6.00000000'},{id:'9',stockCode:'P9',productName:'Ürün',unit:'ADET'}],meta:{hasNextPage:false}})};
  const mounted=mountDesktopWorkflowScreen({root:node,core,storage,actorId:'8'});await new Promise(resolve=>setImmediate(resolve));
  node.querySelector('[data-customer]').events.change({target:{value:'2'}});for(const [index,value] of [['0','5'],['1','9']])node.querySelector(`[data-product="${index}"]`).events.change({target:{value,dataset:{product:index}}});node.querySelector('[data-quantity-unit="0"]').events.change({target:{value:'SERİ',dataset:{quantityUnit:'0'}}});node.querySelector('[data-quantity="0"]').events.input({target:{value:'2',dataset:{quantity:'0'}}});await node.querySelector('[data-preview]').events.click();
  if(factor)assert.match(node.innerHTML,/2.000 SERİ = 16.000 ADET/);else assert.match(node.innerHTML,/Seri bilgisi okunamadı/);await node.querySelector('[data-draft]').events.click();
  if(factor){assert.equal(calls.length,1);assert.equal(calls[0].body.items[0].quantityExact3,'16.000');assert.equal(calls[0].body.items[0].series.factorExact8,'8.00000000');}else assert.equal(calls.length,0);mounted.dispose();
 }
});
function root(){let html='',elements=[];return {get innerHTML(){return html;},set innerHTML(value){html=value;elements=[...value.matchAll(/<(button|input|select|p|span)\b[^>]*>/g)].map(match=>{const attrs=Object.fromEntries([...match[0].matchAll(/([a-zA-Z][\w-]*)(?:="([^"]*)")?/g)].map(a=>[a[1],a[2]??'']));return {attrs,textContent:value.slice(match.index+match[0].length).split('<')[0],dataset:Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_m,c)=>c.toUpperCase()),v])),value:attrs.value??'',disabled:Object.hasOwn(attrs,'disabled'),events:{},addEventListener(name,fn){this.events[name]=fn;}};});},insertAdjacentHTML(_where,value){this.innerHTML=this.innerHTML+value;},querySelectorAll(selector){const match=/^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);return match?elements.filter(e=>Object.hasOwn(e.attrs,match[1])&&(match[2]===undefined||e.attrs[match[1]]===match[2])):[];},querySelector(selector){return this.querySelectorAll(selector)[0]??null;}};}

test('correcting all local quantities clears only their validation warning without redraw or submission',async()=>{
 const f=await quantityWarningFixture();await f.input(0,'1.5');await f.input(1,'0');await f.clickDraft();assert.equal(f.calls(),0);
 const status=f.node.querySelector('[role="status"]'),field=f.node.querySelector('[data-quantity="0"]');assert.match(status.textContent,/Seri miktarı/);
 await f.input(0,'2');assert.match(status.textContent,/Seri miktarı/);assert.equal(f.node.querySelector('[data-converted="0"]').textContent,'2.000 SERİ = 12.000 ADET');
 await f.input(1,'1');assert.equal(status.textContent,'');assert.equal(f.node.querySelector('[data-quantity="0"]'),field);assert.equal(f.calls(),0);assert.equal(f.node.querySelector('[data-draft]').disabled,false);f.screen.dispose();
});
test('quantity correction preserves pending-request warnings and genuine server errors',async()=>{
 for(const mode of ['pending-after-local','unknown','server']){
  const f=await quantityWarningFixture(mode);if(mode==='pending-after-local'){await f.input(0,'1.5');await f.clickDraft();f.setPending();}else await f.clickDraft();
  const status=f.node.querySelector('[role="status"]'),message=status.textContent;assert.ok(message);await f.input(0,'2');assert.equal(status.textContent,message);assert.equal(f.calls(),mode==='pending-after-local'?0:1);f.screen.dispose();
 }
});
async function quantityWarningFixture(mode='local'){
 const node=root();let unresolved=null,calls=0;const controller={pending:()=>unresolved,preview:async()=>({revision:'a'.repeat(64),products:[{productId:'5',stockCode:'P5',unit:'ADET',priceExact4:'12.0000',stockExact3:'60.000',reservedExact3:'0.000',seriesUnit:{unitId:'53',factorExact8:'6.00000000'}},{productId:'9',stockCode:'P9',unit:'ADET',priceExact4:'10.0000',stockExact3:'3.000',reservedExact3:'0.000'}]}),create:async()=>{calls++;if(mode==='server')throw Error('Sunucudaki fiyat değişti.');unresolved={kind:'draft'};return {state:'UNKNOWN'};}};
 const core={sale:()=>controller,list:async kind=>({data:kind==='customers'?[{id:'2',customerCode:'M2',customerName:'Ada'}]:[{id:'5',stockCode:'P5',productName:'Serili ürün',unit:'ADET',seriesUnitId:'53',seriesFactorExact8:'6.00000000'},{id:'9',stockCode:'P9',productName:'Ürün',unit:'ADET'}],meta:{hasNextPage:false}})};
 const screen=mountDesktopWorkflowScreen({root:node,core,storage:{getItem:()=>null,setItem(){},removeItem(){}},actorId:'8'});await new Promise(resolve=>setImmediate(resolve));node.querySelector('[data-customer]').events.change({target:{value:'2'}});
 for(const [index,value] of [['0','5'],['1','9']])node.querySelector(`[data-product="${index}"]`).events.change({target:{value,dataset:{product:index}}});node.querySelector('[data-quantity-unit="0"]').events.change({target:{value:'SERİ',dataset:{quantityUnit:'0'}}});await node.querySelector('[data-preview]').events.click();
 return {node,screen,calls:()=>calls,setPending(){unresolved={kind:'draft'};},input(i,value){const field=node.querySelector(`[data-quantity="${i}"]`);field.value=value;field.events.input({target:field});},clickDraft:()=>node.querySelector('[data-draft]').events.click()};
}
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
