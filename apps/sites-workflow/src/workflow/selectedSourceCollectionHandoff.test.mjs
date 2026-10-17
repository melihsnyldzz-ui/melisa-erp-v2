import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {selectedSourceCopy,verifySelectedSourceReceipt,saveSelectedSourceHandoff,readSelectedSourceHandoff} from './selectedSourceCollectionHandoff.mjs';
import {createTradeJournal} from './workTradeModel.mjs';
import {createWorkingCatalogSession,workingCatalogTokenKey} from './workingCatalogSession.mjs';

const location={protocol:'http:',hostname:'127.0.0.1',port:'5234',origin:'http://127.0.0.1:5234'};
const apiBase='http://127.0.0.1:4184';
const profile=()=>({schemaVersion:'melisa-stage4-isolated-operation-copy.v1',operationOrigin:'ISOLATED_TEST_COPY',copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',sealHash:'A'.repeat(64),backupSHA:'B'.repeat(64),sourceDatabase:'MELISA_ERP_SIRKET_TEST_20260929_01',target:{server:'Semih\\MELISADEV',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02'},date:'2026-10-09',scopeKind:'VERIFIED_BUSINESS_TEST',businessScopeHash:'C'.repeat(64),businessInvoiceMaxExact4:'20000.0000',actors:[{id:'15',role:'isolated_test_sales'},{id:'16',role:'isolated_test_ilker'}],products:[{id:'301',supplierId:'601',sourceKey:['VEGA2026','F0102TBLSTOKLAR','301'].join('/'),stockCode:'P',unit:'ADET',unitFactorExact8:'1.00000000',priceIds:['801'],barcodes:['000301']}],customers:[{id:'501',partyId:'901',accountId:'1001',currency:'TRY',sourceKey:['VEGA2026','F0102TBLCARI','501'].join('/')}],suppliers:[{id:'601',partyId:'902',accountId:'1002',currency:'TRY',sourceKey:['VEGA2026','F0103TBLCARI','601'].join('/')}],financeAccounts:[{id:'701',currency:'TRY'}]});
const seller={id:15,role:{code:'isolated_test_sales'},permissions:['sales.view']};
const collector={id:16,role:{code:'isolated_test_ilker'},permissions:['finance.view','customer.view','finance.collection']};
const invoice=()=>({id:'42',status:'finalized',currency:'TRY',createdBy:'15',documentDate:'2026-10-09',customerId:'501',capabilities:{canCollect:false,canCancelCollection:false},items:[{productId:'301'}]});
const context=copy=>({meta:{operationOrigin:copy.operationOrigin,copyId:copy.copyId,sealHash:copy.sealHash,date:copy.date,selectedSale:{source:'SOURCE',customerId:'501',currency:'TRY',productIds:['301']}},scope:{customer:{id:'501'}},capabilities:{canCreate:true}});
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key),map};};

test('exact business copy, finalized selected SOURCE receipt, and actor handoff',()=>{
 const copy=selectedSourceCopy({profile:profile(),location,apiBase}),store=storage(),now=1_000_000;
 assert.equal(copy.copyId,profile().copyId);
 assert.equal(verifySelectedSourceReceipt({invoice:invoice(),context:context(copy),copy}),'42');
 saveSelectedSourceHandoff({storage:store,invoice:invoice(),context:context(copy),copy,user:seller,now});
 assert.deepEqual(readSelectedSourceHandoff({storage:store,copy,user:collector,now:now+1000}),{invoiceId:'42'});
 assert.equal(readSelectedSourceHandoff({storage:store,copy,user:collector,now:now+900001}),null);
});

test('wrong host/API/copy, actor, and corrupted or foreign handoff fail closed',()=>{
 const copy=selectedSourceCopy({profile:profile(),location,apiBase}),store=storage(),now=1_000_000;
 for(const options of [{location:{...location,port:'5224'}},{apiBase:'http://127.0.0.1:4174'},{apiBase:'http://192.168.1.46:4184'},{profile:{...profile(),copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe83'}},{profile:{...profile(),target:{...profile().target,database:'OTHER'}}}])assert.equal(selectedSourceCopy({profile:profile(),location,apiBase,...options}),null);
 assert.throws(()=>saveSelectedSourceHandoff({storage:store,invoice:invoice(),context:context(copy),copy,user:{...seller,id:16},now}));
 saveSelectedSourceHandoff({storage:store,invoice:invoice(),context:context(copy),copy,user:seller,now});
 assert.equal(readSelectedSourceHandoff({storage:store,copy,user:seller,now}),null);
 assert.equal(readSelectedSourceHandoff({storage:store,copy,user:{...collector,permissions:['finance.view']},now}),null);
 const key=[...store.map.keys()][0],saved=JSON.parse(store.getItem(key));
 for(const changed of [{...saved,copyId:'foreign'},{...saved,invoiceId:'0'},{...saved,sealHash:'B'.repeat(64)},{...saved,fromActorId:16},{...saved,createdAt:now+1},{...saved,unexpected:true}]){store.setItem(key,JSON.stringify(changed));assert.equal(readSelectedSourceHandoff({storage:store,copy,user:collector,now}),null);}
 store.setItem(key,'{');assert.equal(readSelectedSourceHandoff({storage:store,copy,user:collector,now}),null);
});

test('draft, non-SOURCE, foreign customer/product and legacy invoice are rejected',()=>{
 const copy=selectedSourceCopy({profile:profile(),location,apiBase});
 for(const changed of [{status:'draft'},{createdBy:'16'},{currency:'USD'},{customerId:'999'},{documentDate:'2026-10-10'},{capabilities:{canCollect:true,canCancelCollection:false}},{items:[{productId:'999'}]}])assert.throws(()=>verifySelectedSourceReceipt({invoice:{...invoice(),...changed},context:context(copy),copy}));
 const other=context(copy);other.meta.selectedSale.source='DAILY';assert.throws(()=>verifySelectedSourceReceipt({invoice:invoice(),context:other,copy}));
});

async function salesController(){let source=await readFile(new URL('./workSales.js',import.meta.url),'utf8');source=source.replace(/^import ['"]\.\/[^'"]+\.css['"];\s*$/gm,'').replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,import.meta.url).href));return (await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).createWorkSales;}
function dom(){let html='',nodes=new Map();const node=key=>{if(nodes.has(key))return nodes.get(key);const n={isConnected:true,dataset:{},elements:{search:{value:''}},value:'',innerHTML:'',setAttribute(){},remove(){},addEventListener(event,handler){this['on'+event]=handler;},querySelector:node,querySelectorAll:()=>[]};nodes.set(key,n);return n;};const root={isConnected:true,querySelector:node,querySelectorAll:()=>[]};Object.defineProperty(root,'innerHTML',{get:()=>html,set:value=>{html=value;nodes=new Map();}});return {root,node};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function mountedContext(copy){const revision='a'.repeat(64),entity={synthetic:false,operationOrigin:copy.operationOrigin,writeEligible:true,revision},customer=copy.customers[0],product=copy.products[0];return {meta:{schemaVersion:'melisa-work-trade.v1',date:copy.date,timeZone:'Europe/Istanbul',source:'native-test',operationOrigin:copy.operationOrigin,copyId:copy.copyId,sealHash:copy.sealHash,selectedSale:{source:'SOURCE',customerId:customer.id,customerAccountId:customer.accountId,currency:'TRY',productIds:[product.id]}},revision,capabilities:{canCreate:true,canFinalize:true,canCancel:true,canCollect:false,canCancelCollection:false},scope:{synthetic:false,operationOrigin:copy.operationOrigin,customer:{...entity,...customer,code:'C-501',name:'Müşteri',balanceExact4:'0.0000'},products:[{...entity,id:product.id,stockCode:product.stockCode,name:'Ürün',barcode:product.barcodes[0],stockQuantityExact3:'10.000',unit:{label:'ADET',factorExact8:'1.00000000'},prices:[{quoteId:'801',currency:'TRY',unitPriceExact8:'3.00000000',revision,source:{kind:'isolated-test-copy',copyId:copy.copyId,sealHash:copy.sealHash}}]}],accounts:[]},supportedCurrencies:['TRY'],limits:{maxItems:200,maxQuantityPerLine:2147483647,maxInvoiceAmountExact4:'20000.0000'}};}
function mountedInvoice(){return {...invoice(),documentNo:'SAT-42',subtotalExact4:'3.0000',grandTotalExact4:'3.0000',amountTryExact4:'3.0000',customerBalanceExact4:'3.0000',revision:'a'.repeat(64),items:[{productId:'301',stockCode:'P',name:'Ürün',quantityExact3:'1.000',currency:'TRY',unitPriceExact8:'3.00000000',unitPriceExact4:'3.0000',lineTotalExact4:'3.0000',unit:{label:'ADET',factorExact8:'1.00000000'}}],collections:{revision:'a'.repeat(64),receivedExact4:'0.0000',outstandingExact4:'3.0000',items:[]}};}
test('mounted seller handoff never opens legacy collections; supported collector session reads the same selection',async()=>{
 const previous=globalThis.window,copy=selectedSourceCopy({profile:profile(),location,apiBase}),store=storage(),d=dom(),receipt=mountedInvoice(),ctx=mountedContext(copy),calls=[],navigations=[];
 createTradeJournal({storage:store,key:'melisa-work-sale-v1:local:15'}).done(createTradeJournal({storage:store,key:'melisa-work-sale-v1:local:15'}).begin('/api/work-sales/drafts',{requestId:'00000000-0000-4000-8000-000000000001'}),{invoice:receipt,requestId:'00000000-0000-4000-8000-000000000001'});
 globalThis.window={location,__MELISA_OPERATION_COPY__:copy};
 try{
  const create=await salesController(),ui=create({root:d.root,session:{media:async()=>{},work:async(path,options)=>{calls.push({path,options});if(path==='/api/work-sales/context'||path==='/api/work-sales/selected-context')return structuredClone(ctx);if(path==='/api/work-sales/selection-options')return {enabled:true,date:copy.date,maxItems:200,customers:[{id:'501',code:'C-501',name:'Müşteri',currency:'TRY'}],products:[{id:'301',stockCode:'P',name:'Ürün',barcodes:['000301'],currencies:['TRY']}]};if(path==='/api/work-sales/invoices/42')return structuredClone(receipt);throw Error(path);}},user:seller,storage:store,apiBase,navigate:page=>navigations.push(page)});
  ui.mount();await tick();assert.match(d.root.innerHTML,/Tahsilata devret/);d.node('[data-sale-collect]').onclick();await tick();assert.deepEqual(navigations,[]);assert.match(d.root.innerHTML,/İlker hesabıyla Tahsilat ekranını açın/);assert.equal(calls.filter(c=>c.path==='/api/work-sales/selected-context').length,1);
  const sessionStore=storage();sessionStore.setItem(workingCatalogTokenKey,'synthetic-access-token');const session=createWorkingCatalogSession({location,apiBase,copyProfile:copy,storage:sessionStore,protectedDevice:null,fetchImpl:async(url,options)=>({ok:true,status:200,json:async()=>url.endsWith('/api/auth/me')?{success:true,data:seller}:{success:true,data:{user:collector,accessToken:'synthetic-next-token'},meta:{operationOrigin:copy.operationOrigin,copyId:copy.copyId,sealHash:copy.sealHash}}})});
  await session.start();const switched=await session.selectCopyActor('16');assert.deepEqual(readSelectedSourceHandoff({storage:store,copy,user:switched}),{invoiceId:'42'});session.dispose();ui.dispose();
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
