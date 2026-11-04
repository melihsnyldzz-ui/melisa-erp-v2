import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {tradeDate,tradeInvoice,tradeCollection,tradeContext,tradeSelection,tradePreview} from './workTradeModel.mjs';

// Synthetic DTOs use the existing production validators, not a copied date helper.
const revision='a'.repeat(64),valid='2026-10-06';
function collection(documentDate=valid){return {id:'77',invoiceId:'42',accountId:'99',amountExact4:'1.0000',currency:'TRY',documentDate,status:'active',revision};}
function items(){return ['111','112'].map(productId=>({productId,quoteId:'quote-'+productId,stockCode:'00'+productId,name:'Yapay ürün '+productId,quantityExact3:'1.000',unit:{label:'ADET',factorExact8:'1.00000000'},currency:'TRY',unitLabel:'ADET',unitPriceExact8:'1.50000000',unitPriceExact4:'1.5000',lineTotalExact4:'1.5000'}));}
function invoice(documentDate=valid){return {id:'42',documentNo:'SAT-42',documentDate,status:'finalized',customerId:'501',currency:'TRY',subtotalExact4:'3.0000',grandTotalExact4:'3.0000',amountTryExact4:'3.0000',revision,items:items(),collections:{receivedExact4:'0.0000',outstandingExact4:'3.0000',revision,items:[]},customerBalanceExact4:'3.0000'};}
function context(date=valid){return {meta:{schemaVersion:'melisa-work-trade.v1',date,timeZone:'Europe/Istanbul',source:'native-test'},revision,capabilities:{canCreate:true,canFinalize:true,canCancel:true,canCollect:true,canCancelCollection:true},scope:{synthetic:true,customer:{id:'501',code:'SYNTHETIC-C',name:'Yapay müşteri',currency:'TRY',synthetic:true,writeEligible:true,balanceExact4:'0.0000',revision},products:items().map(i=>({id:i.productId,stockCode:i.stockCode,name:i.name,barcode:'00000'+i.productId,synthetic:true,writeEligible:true,stockQuantityExact3:'10.000',unit:i.unit,revision,prices:[{quoteId:i.quoteId,currency:'TRY',unitPriceExact8:i.unitPriceExact8,source:{kind:'synthetic-test'},revision}]})),accounts:[{id:'99',code:'CASH',name:'Yapay kasa',type:'cash',currency:'TRY',balanceExact4:'0.0000',synthetic:true}]},supportedCurrencies:['TRY'],limits:{maxItems:10,maxQuantityPerLine:5,maxInvoiceAmountExact4:'500.0000',maxOpenInvoices:10}};}
const selection=(documentDate=valid)=>({customerId:'501',documentDate,currency:'TRY',items:items().map(({productId,quoteId,quantityExact3})=>({productId,quoteId,quantityExact3}))});
const impossible=['2026-02-31','2025-02-29','1900-02-29','2100-02-29','2026-04-31','2026-06-31','2026-09-31','2026-11-31'];

for(const [name,make,validate] of [['invoice',invoice,tradeInvoice],['collection',collection,tradeCollection]])for(const date of impossible)test(`production ${name} validator rejects impossible ${date} without changing the DTO`,()=>{
 const good=make();assert.equal(validate(good),good,'All other fixture fields must satisfy the production contract');assert.equal(Number.isFinite(Date.parse(date)),true,'This must reproduce the old normalization defect');
 const bad=make(date),before=structuredClone(bad);assert.throws(()=>validate(bad),/İşlem bilgileri doğrulanamadı/);assert.deepEqual(bad,before);
});

test('public tradeDate rejects all old finite-parse impossible-day counterexamples',()=>{for(const date of impossible)assert.equal(tradeDate(date),false,date);});

for(const date of ['0000-02-29','0001-01-01','0096-02-29','0099-12-31','0100-02-28','1900-02-28','2000-02-29','2024-02-29','2026-04-30','2026-12-31','2400-02-29','9999-12-31'])test(`valid schema/year/leap boundary ${date} retains the exact source text`,()=>{
 const i=invoice(date),c=collection(date),scope=context(date),chosen=selection(date),before=structuredClone({i,c,scope,chosen});
 assert.equal(tradeDate(date),true);assert.equal(tradeInvoice(i),i);assert.equal(tradeCollection(c),c);assert.equal(tradeContext(scope),scope);assert.equal(tradeSelection(chosen,scope),chosen);assert.deepEqual({i,c,scope,chosen},before);
});

test('existing YYYY-MM-DD schema and null/type/malformed rejection do not gain coercion or timestamps',()=>{
 for(const date of [null,undefined,20261006,{},[],new Date('2026-10-06T00:00:00Z'),'',' ','2026-2-06','26-10-06','2026-10-6','2026-00-01','2026-13-01','2026-01-00','2026-01-32','2026-10-06T00:00:00Z','2026-10-06+03:00',' 2026-10-06','2026-10-06 ','+010000-02-29','not-a-date']){assert.equal(tradeDate(date),false);const i=invoice();i.documentDate=date;assert.throws(()=>tradeInvoice(i));const c=collection();c.documentDate=date;assert.throws(()=>tradeCollection(c));}
});

test('nested invoice collections consume the same production calendar guard',()=>{
 const i=invoice();i.collections={revision,receivedExact4:'1.0000',outstandingExact4:'2.0000',items:[collection()]};assert.equal(tradeInvoice(i),i);
 i.collections.items[0].documentDate='2026-02-31';const before=structuredClone(i);assert.throws(()=>tradeInvoice(i));assert.deepEqual(i,before);
});
test('tradeContext rejects impossible source-day metadata with otherwise accepted scope',()=>{const c=context();assert.equal(tradeContext(c),c);c.meta.date='2026-02-31';const before=structuredClone(c);assert.throws(()=>tradeContext(c));assert.deepEqual(c,before);});
test('tradeSelection rejects impossible document date without changing item/unit/currency selection',()=>{const c=context(),s=selection();assert.equal(tradeSelection(s,c),s);s.documentDate='2026-02-31';const before=structuredClone(s);assert.throws(()=>tradeSelection(s,c));assert.deepEqual(s,before);});
test('tradePreview cannot admit a selection with an impossible document date',()=>{const c=context(),p={selection:selection(),previewHash:revision,scopeRevision:revision,currency:'TRY',subtotalExact4:'3.0000',grandTotalExact4:'3.0000',amountTryExact4:'3.0000',items:items(),writable:true};assert.equal(tradePreview(p,c),p);p.selection.documentDate='2026-02-31';const before=structuredClone(p);assert.throws(()=>tradePreview(p,c));assert.deepEqual(p,before);});

test('valid past/future days remain calendar-valid without inventing a business/workday policy',()=>{
 const c=context('2026-10-06');for(const date of ['1900-01-01','2025-02-28','2026-10-06','2026-10-07','9999-12-31'])assert.equal(tradeSelection(selection(date),c).documentDate,date);
});

async function collectionsController(){let source=await readFile(new URL('./workCollections.js',import.meta.url),'utf8');source=source.replace(/^import ['"]\.\/[^'"]+\.css['"];\s*$/gm,'').replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,import.meta.url).href));return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));}
function surface(){const nodes=new Map(),node=k=>{if(!nodes.has(k))nodes.set(k,{innerHTML:'',value:'',dataset:{},addEventListener(type,fn){this['on'+type]=fn;},setAttribute(){},remove(){},querySelector:node,querySelectorAll:()=>[]});return nodes.get(k);};return {isConnected:true,innerHTML:'',querySelector:node,querySelectorAll:()=>[]};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
for(const badKind of ['invoice','nested collection'])test(`production collection controller clears an impossible ${badKind} date on readonly refresh`,async t=>{
 const {createWorkCollections}=await collectionsController(),root=surface(),calls=[],scope=context();let current={invoice:invoice(),customer:scope.scope.customer,accounts:scope.scope.accounts,capabilities:scope.capabilities,revision};
 const storage={getItem:key=>key==='melisa-work-selected-invoice:16'?'42':null,setItem(){assert.fail('Reading an invalid date must not persist a new request');},removeItem(){assert.fail('Reading an invalid date must not clear a journal');}};
 const ui=createWorkCollections({root,user:{id:16},storage,uuid(){assert.fail('Reading an invalid date must not allocate a UUID');},session:{work:async(path,options)=>{calls.push({path,options});assert.equal(options,undefined);return path.includes('/context?')?current:{data:[],meta:{}};}}});t.after(()=>ui.dispose());
 ui.mount();await tick();await tick();assert.match(root.innerHTML,/SAT-42/);assert.match(root.innerHTML,/Fiş toplamı: 3,00 TRY/);
 current=structuredClone(current);if(badKind==='invoice')current.invoice.documentDate='2026-02-31';else current.invoice.collections={revision,receivedExact4:'1.0000',outstandingExact4:'2.0000',items:[collection('2026-02-31')]};const before=structuredClone(current);
 await ui.refresh();await tick();assert.match(root.innerHTML,/Tahsilat tamamlanamadı/);assert.doesNotMatch(root.innerHTML,/Fiş toplamı:|SAT-42|2026-02-31|2026-03-03|data-collection-preview/);assert.deepEqual(current,before);assert.ok(calls.every(c=>c.options===undefined));assert.equal(ui.requestClose(),true);
});
