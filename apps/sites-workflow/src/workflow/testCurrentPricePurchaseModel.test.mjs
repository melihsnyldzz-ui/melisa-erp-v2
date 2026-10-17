import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {currentPurchaseContext,currentPurchaseBody,currentPurchasePreview,currentPurchaseJournal,currentPurchaseCompletionMatches} from './testCurrentPricePurchaseModel.mjs';
const selection={productId:'301986',priceId:'1',versionId:'8',revision:'A'.repeat(64)};
const context=()=>({environment:'ISOLATED_TEST',fixture:{productId:301986,supplierId:13373,unit:'ADET',factorExact8:'1.00000000',supplierCurrency:'TRY',maxQuantity:5,maxAmountTryExact4:'200.0000',date:'2026-10-04'},quotes:[{selection,currency:'EUR',priceExact:'1.23456789'}],rates:[],receipts:[],invoiceDrafts:[]});
test('consumer binds native current version; no empty or unknown quote fallback',()=>{
 const body=currentPurchaseBody(context(),'0','2');assert.deepEqual(body,{selection,quantity:2,date:'2026-10-04',rateVersion:'1'});
 for(const [index,quantity] of [['','1'],['0','6'],['0','1.5'],['99','1']])assert.throws(()=>currentPurchaseBody(context(),index,quantity));
 const c=context();c.quotes[0].priceExact=null;assert.throws(()=>currentPurchaseBody(c,'0','1'));
 assert.throws(()=>currentPurchaseContext({...context(),environment:'LIVE'}));
});
test('authoritative preview must preserve selection, quantity, exact4 totals and writable proof',()=>{
 const body=currentPurchaseBody(context(),'0','1'),p={...body,writable:true,previewHash:'B'.repeat(64),currency:'EUR',nativePriceExact4:'1.2346',documentAmountExact4:'1.2346',accountAmountExact4:'55.5570',amountTryExact4:'55.5570'};assert.equal(currentPurchasePreview(p,body),p);
 for(const change of [{writable:false},{selection:{...selection,versionId:'9'}},{quantity:2},{accountAmountExact4:null},{nativePriceExact4:1.2346}])assert.throws(()=>currentPurchasePreview({...p,...change},body));
});
test('purchase replay journal stays in dedicated current consumer and preserves exact payload',()=>{
 const p={status:'pending',path:'/api/test-current-price-purchase/receipts',body:{requestId:'12345678-1234-4123-8123-123456789012',...currentPurchaseBody(context(),'0','1'),previewHash:'B'.repeat(64)}};assert.equal(currentPurchaseJournal(p),p);
 for(const path of ['/api/test-purchase-fx/receipts','/api/products/301986/current-prices','/api/test-current-price-purchase/receipts/1/delete'])assert.throws(()=>currentPurchaseJournal({...p,path}));
 assert.equal(currentPurchaseCompletionMatches({...p,status:'saved'},p,'rejected'),false);assert.equal(currentPurchaseCompletionMatches({...p,body:{...p.body,quantity:2}},p,'saved'),false);
});
async function controller(){const source=(await readFile(new URL('./testCurrentPricePurchase.js',import.meta.url),'utf8')).replace("import './testProductPriceEditor.css';",'').replace("'./testCurrentPricePurchaseModel.mjs'",JSON.stringify(new URL('./testCurrentPricePurchaseModel.mjs',import.meta.url).href));return (await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).createCurrentPricePurchase;}
function dom(){const handlers={},elements={quote:{value:'0'},quantity:{value:'1'},reason:{value:'TEST iptal'}},form={elements,querySelector:()=>({setAttribute(){}}),addEventListener:(event,fn)=>handlers['entry:'+event]=fn},host={isConnected:true,innerHTML:'',textContent:'',querySelectorAll:()=>[],querySelector:s=>s==='[data-current-entry]'||s==='[data-current-detail]'?form:{addEventListener:(_event,fn)=>handlers[s]=fn}};const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};return {host,handlers,elements,data,storage};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const user={id:'16',permissions:['product.view','purchase.view','goods.create','goods.approve','goods.reject','purchase.create','purchase.finalize','purchase.cancel']};
const preview=body=>({...body,writable:true,previewHash:'B'.repeat(64),priceExact:'1.23456789',currency:'EUR',nativePriceExact4:'1.2346',documentAmountExact4:'1.2346',accountAmountExact4:'55.5570',amountTryExact4:'55.5570'});
test('normal current-price consumer issues no context for readonly actor14 or missing view',async()=>{
 const create=await controller(),d=dom();let calls=0;
 for(const actor of [{...user,id:'14'},{...user,permissions:['goods.create']}]){const ui=create({api:()=>calls++,user:actor,esc:String,storage:d.storage});assert.equal(ui.html(),'');ui.mount(d.host);ui.dispose();}assert.equal(calls,0);
});
test('normal consumer previews exact current version and uncertain receipt replays same request',async()=>{
 const create=await controller(),d=dom(),calls=[];let writes=0;const api=async(path,options)=>{calls.push({path,options});if(!options)return context();if(path.endsWith('/preview'))return preview(options.body);if(++writes===1)throw Error('offline');return {id:100,replayed:true};};
 const ui=create({api,user,esc:String,storage:d.storage,uuid:()=> '12345678-1234-4123-8123-123456789012'});ui.mount(d.host);await tick();d.handlers['[data-current-new]']();await d.handlers['[data-current-preview]']();assert.match(d.host.innerHTML,/1,23456789/);assert.match(d.host.innerHTML,/1,2346/);d.handlers['entry:submit']({preventDefault(){}});await tick();assert.equal(JSON.parse([...d.data.values()][0]).status,'pending');d.handlers['[data-current-replay]']();await tick();const mutations=calls.filter(x=>x.path.endsWith('/receipts'));assert.equal(mutations.length,2);assert.deepEqual(mutations[0].options.body,mutations[1].options.body);assert.deepEqual(mutations[0].options.body.selection,selection);const saved=JSON.parse([...d.data.values()][0]);assert.equal(saved.status,'saved');assert.equal(saved.result.replayed,true);assert.match(d.host.innerHTML,/Aynı işlem doğrulandı; ikinci belge veya hareket oluşturulmadı/);ui.dispose();
});
test('stale preview cannot enable receipt save or invent a replacement quote',async()=>{
 const create=await controller(),d=dom(),calls=[];const ui=create({api:async(path,options)=>{calls.push({path,options});if(!options)return context();throw Object.assign(Error('Fiyat değişti. Güncel fiyatı yükleyip yeniden önizleyin.'),{status:409});},user,esc:String,storage:d.storage});ui.mount(d.host);await tick();d.handlers['[data-current-new]']();await d.handlers['[data-current-preview]']();assert.match(d.host.innerHTML,/Fiyat değişti/);d.handlers['entry:submit']({preventDefault(){}});await tick();assert.equal(calls.filter(x=>x.path.endsWith('/receipts')).length,0);assert.equal(d.data.size,0);ui.dispose();
});

test('invoice detail cannot replace a pending write generation or leave its completion locked',async()=>{
 const create=await controller(),d=dom(),invoiceButton={dataset:{currentInvoice:'77'}};
 d.host.querySelectorAll=selector=>selector==='[data-current-invoice]'?[invoiceButton]:[];
 const state={...context(),invoiceDrafts:[{id:77,number:'TDAY-C09-TEST',status:'draft',currency:'EUR',documentAmountExact4:'1.2346'}]};
 let finishWrite,detailReads=0;
 const api=async(path,options)=>{
  if(!options){if(path.endsWith('/77'))detailReads++;return state;}
  if(path.endsWith('/preview'))return preview(options.body);
  return await new Promise(resolve=>{finishWrite=resolve;});
 };
 const ui=create({api,user,esc:String,storage:d.storage,uuid:()=> '12345678-1234-4123-8123-123456789012'});
 ui.mount(d.host);await tick();d.handlers['[data-current-new]']();await d.handlers['[data-current-preview]']();d.handlers['entry:submit']({preventDefault(){}});await tick();
 assert.equal(JSON.parse([...d.data.values()][0]).status,'pending');assert.match(d.host.innerHTML,/data-current-invoice="77" disabled/);
 await invoiceButton.onclick();assert.equal(detailReads,0);
 finishWrite({id:100,replayed:false});await tick();await tick();
 assert.equal(JSON.parse([...d.data.values()][0]).status,'saved');assert.match(d.host.innerHTML,/İşlem kaydedildi · Belge #100/);assert.doesNotMatch(d.host.innerHTML,/data-current-invoice="77" disabled/);
 ui.dispose();
});
