import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {canViewCurrentPrices,canEditCurrentPrices,canonicalPrice,currentPriceContext,currentPriceRequest,priceJournal,priceCompletionMatches,tupleKey,supportedPriceTuples} from './testProductPriceModel.mjs';
import {productPriceContext} from '../../../api/src/services/testProductPriceModel.mjs';
const tuple={type:'purchase',unitId:null,tier:0,currency:'EUR'},requestId='12345678-1234-4123-8123-123456789012';
const context=()=>({product:{id:'301986',stockCode:'TEST-DAILY-PURCHASE',name:'Sentetik TEST ürünü',unit:'ADET',synthetic:true},revision:'A'.repeat(64),capabilities:{currencies:['TRY','EUR'],units:[{id:'9001',label:'ADET',factorExact8:'1.00000000',isMainUnit:true}],purchaseTier:0,saleTiers:[1,2],supportedTuples:[tuple,{type:'sale',unitId:'9001',tier:2,currency:'TRY'}],canEdit:true},prices:[],recentChanges:[]});
const row=(request)=>({id:'1',versionId:'1',...request.tuple,priceExact:request.priceExact,revision:'B'.repeat(64),provenance:{source:'synthetic-native-price-card',actorId:'16',changedAt:'2026-10-05T08:00:00.000Z',reason:request.reason}});
const fields=()=>({tupleKey:tupleKey(tuple),price:'1,23456789',unknown:false,reason:'TEST fiyat denemesi',priceId:null});
const permissions=['product.view','purchase.view','product.price.edit'];
test('price editor accepts the SQL price-card provenance after API normalization',async()=>{
 const sqlSource=await readFile(new URL('../../../../scripts/canonical/enable-test-product-prices.mjs',import.meta.url),'utf8');
 const source=sqlSource.match(/N'([^']+)' source,CONVERT\(varchar\(20\),v.actor_id\)/)?.[1];
 assert.equal(source,'synthetic-native-price-card');
 const r={...row({tuple,priceExact:'1.12345678',reason:'TEST SQL provenance'}),provenance:{...row({tuple,priceExact:null,reason:'TEST SQL provenance'}).provenance,source}};
 const response=productPriceContext({...context(),revision:r.revision,prices:[r],recentChanges:[r]},true);
 assert.equal(currentPriceContext(response).prices[0].priceExact,'1.12345678');
 assert.throws(()=>currentPriceContext({...response,prices:[{...r,provenance:{...r.provenance,source:'native-operational-price'}}]}));
});
test('view and special edit permission have independent actor and server boundaries',()=>{
 assert.equal(canViewCurrentPrices(['product.view','purchase.view']),true);assert.equal(canEditCurrentPrices('16',permissions),true);
 for(const [id,p] of [['14',permissions],['15',permissions],['16',['product.view','purchase.view','product.edit']],['16',['product.price.edit']]])assert.equal(canEditCurrentPrices(id,p),false);
 assert.throws(()=>currentPriceContext({...context(),product:{...context().product,synthetic:false}}));assert.throws(()=>currentPriceContext({...context(),product:{...context().product,id:'301985'}}));
});
test('exact8 preserves unknown, real zero and decimal precision; malformed and excessive input rejected',()=>{
 assert.equal(canonicalPrice('',true),null);assert.equal(canonicalPrice('0'),'0.00000000');assert.equal(canonicalPrice('1,23456789'),'1.23456789');
 for(const bad of ['','-1','1e3','01','1.123456789','1.000.000',1])assert.throws(()=>canonicalPrice(bad));
 const c=context();assert.equal(supportedPriceTuples(c.capabilities).length,2);assert.throws(()=>currentPriceContext({...c,capabilities:{...c.capabilities,supportedTuples:[{...tuple,unitId:'999'}]}}));
});
test('supported tuple and immutable identity bind request; missing price create has no fictitious seed',()=>{
 const c=context(),r=currentPriceRequest(c,{tuple,priceId:null,priceExact:'0.00000000',reason:'TEST zero'},requestId);assert.equal(r.priceId,null);assert.equal(c.prices.length,0);assert.equal(r.expectedRevision,c.revision);
 assert.throws(()=>currentPriceRequest(c,{tuple:{...tuple,currency:'USD'},priceExact:'1.00000000',reason:'TEST'},requestId));
 c.prices=[row(r)];assert.throws(()=>currentPriceRequest(c,{tuple,priceId:null,priceExact:'1.00000000',reason:'TEST'},requestId));
});
test('journal binds full payload to fields and late completion cannot downgrade saved or newer request',()=>{
 const f=fields(),r=currentPriceRequest(context(),{tuple,priceExact:canonicalPrice(f.price),reason:f.reason},requestId),sent={status:'pending',context:context(),fields:f,request:r};
 priceJournal(sent);assert.throws(()=>priceJournal({...sent,fields:{...f,price:'2'}}));assert.throws(()=>priceJournal({...sent,request:{...r,unexpected:true}}));
 assert.equal(priceCompletionMatches({...sent,status:'saved'},sent,'stale'),false);assert.equal(priceCompletionMatches({...sent,request:{...r,requestId:'87654321-4321-4123-8123-123456789012'}},sent,'saved'),false);assert.equal(priceCompletionMatches(sent,sent,'saved'),true);
});
test('saved new tuple stays selected after it becomes an existing native price',async()=>{
 const create=await controller(),d=dom();const ui=create({api:async(_p,o)=>o?{...context(),revision:'B'.repeat(64),prices:[row(o.body)],replayed:false}:context(),esc:s=>String(s).replaceAll('"','&quot;'),actorId:'16',permissions,storage:d.storage,uuid:()=>requestId});
 ui.mount(d.host);await tick();d.handlers['[data-price-new]']();d.handlers['form:submit']({preventDefault(){}});await tick();
 const select=d.host.innerHTML.match(/<select[^>]*name="tupleKey"[\s\S]*?<\/select>/)?.[0];
 assert.match(select,/disabled/);assert.match(select,/selected[^>]*>Alış · Kart alış birimi · Kademe 0 · EUR/);
 assert.equal((select.match(/<option /g)||[]).length,1);ui.dispose();
});
async function controller(){const source=(await readFile(new URL('./testProductPriceEditor.js',import.meta.url),'utf8')).replace("import './testProductPriceEditor.css';",'').replace("'./testProductPriceModel.mjs'",JSON.stringify(new URL('./testProductPriceModel.mjs',import.meta.url).href));return (await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).createProductPriceEditor;}
function dom(){const handlers={},f=fields(),elements={tupleKey:{value:f.tupleKey},price:{value:f.price},unknown:{checked:false},reason:{value:f.reason}},form={elements,addEventListener:(event,fn)=>handlers['form:'+event]=fn};const host={isConnected:true,innerHTML:'',textContent:'',querySelectorAll:()=>[],querySelector:s=>s==='[data-price-form]'?form:{addEventListener:(event,fn)=>handlers[s]=fn}};const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};return {handlers,host,elements,data,storage};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('readonly actual controller renders native price view without edit form; missing view issues no API',async()=>{
 const create=await controller();let reads=0;const d=dom(),ui=create({api:async()=>{reads++;return {...context(),capabilities:{...context().capabilities,canEdit:false}};},esc:String,actorId:'14',permissions:['product.view','purchase.view'],storage:d.storage});ui.mount(d.host);await tick();assert.equal(reads,1);assert.doesNotMatch(d.host.innerHTML,/data-price-new|data-price-form|data-price-edit/);ui.dispose();
 const denied=create({api:()=>reads++,esc:String,actorId:'15',permissions:['product.view'],storage:d.storage});denied.mount(d.host);await tick();assert.equal(reads,1);
});
test('uncertain write freezes request, replays exactly, persists after dispose; stale never auto-resubmits',async()=>{
 const create=await controller(),d=dom(),calls=[];let writes=0;const api=async(path,options)=>{calls.push({path,options});if(!options)return context();if(++writes===1)throw Error('offline');return {...context(),revision:'B'.repeat(64),prices:[row(options.body)],replayed:true};};
 const ui=create({api,esc:String,actorId:'16',permissions,storage:d.storage,uuid:()=>requestId});ui.mount(d.host);await tick();d.handlers['[data-price-new]']();d.handlers['form:submit']({preventDefault(){}});await tick();const first=JSON.parse([...d.data.values()][0]);assert.equal(first.status,'pending');assert.equal(ui.requestClose(()=>{}),false);d.handlers['[data-price-retry]']();await tick();assert.deepEqual(calls[1].options.body,calls[2].options.body);assert.equal(JSON.parse([...d.data.values()][0]).status,'saved');assert.equal(JSON.parse([...d.data.values()][0]).response.replayed,true);ui.dispose();
 const s=dom();let count=0;const stale=create({api:async(_p,o)=>{if(!o)return context();count++;throw Object.assign(Error('changed'),{status:409,code:'TEST_PRODUCT_PRICE_STALE'});},esc:String,actorId:'16',permissions,storage:s.storage,uuid:()=>requestId});stale.mount(s.host);await tick();s.handlers['[data-price-new]']();s.handlers['form:submit']({preventDefault(){}});await tick();assert.equal(JSON.parse([...s.data.values()][0]).status,'stale');s.handlers['[data-price-retry]']?.();await tick();assert.equal(count,1);stale.dispose();
});
test('dispose prevents old UI painting while confirmed write result remains actor-scoped',async()=>{
 const create=await controller(),d=dom();let finish;const ui=create({api:async(_p,o)=>o?new Promise(resolve=>{finish=()=>resolve({...context(),revision:'B'.repeat(64),prices:[row(o.body)],replayed:false});}):context(),esc:String,actorId:'16',permissions,storage:d.storage,uuid:()=>requestId});ui.mount(d.host);await tick();d.handlers['[data-price-new]']();d.handlers['form:submit']({preventDefault(){}});const html=d.host.innerHTML;ui.dispose();finish();await tick();assert.equal(d.host.innerHTML,html);assert.equal(JSON.parse([...d.data.values()][0]).status,'saved');assert.equal([...d.data.keys()][0],'melisa-current-product-price:16:301986');
});
test('close contract lets caller act once when clean; dirty keep/discard and absent callback remain usable',async()=>{
 const create=await controller(),d=dom();let writes=0,closed=0;
 const ui=create({api:async(_path,options)=>{if(options)writes++;return context();},esc:String,actorId:'16',permissions,storage:d.storage});ui.mount(d.host);await tick();
 const leave=()=>closed++;assert.equal(ui.requestClose(leave),true);assert.equal(closed,0);if(ui.requestClose(leave))leave();assert.equal(closed,1);
 d.handlers['[data-price-new]']();assert.equal(ui.requestClose(leave),false);assert.match(d.host.innerHTML,/Kaydedilmemiş fiyat değişiklikleri/);assert.equal(closed,1);
 d.handlers['[data-price-keep]']();assert.doesNotMatch(d.host.innerHTML,/Kaydedilmemiş fiyat değişiklikleri/);assert.equal(JSON.parse([...d.data.values()][0]).status,'dirty');
 assert.equal(ui.requestClose(leave),false);d.handlers['[data-price-discard]']();assert.equal(closed,2);assert.equal(d.data.size,0);
 d.handlers['[data-price-new]']();assert.equal(ui.requestClose(undefined),false);assert.match(d.host.innerHTML,/data-price-discard/);d.handlers['[data-price-discard]']();assert.equal(d.data.size,0);
 d.handlers['[data-price-new]']();d.handlers['[data-price-close]']();assert.match(d.host.innerHTML,/Kaydedilmemiş fiyat değişiklikleri/);d.handlers['[data-price-discard]']();assert.doesNotMatch(d.host.innerHTML,/data-price-form/);
 // The editor's own close button must also execute the clean branch callback.
 d.handlers['[data-price-close]']();assert.doesNotMatch(d.host.innerHTML,/data-price-form/);assert.equal(writes,0);ui.dispose();
});
