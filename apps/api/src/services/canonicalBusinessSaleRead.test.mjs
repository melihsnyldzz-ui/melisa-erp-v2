import test,{mock} from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {customerCardDto} from './customerCardModel.mjs';import {catalogProductDto} from './catalogModel.mjs';
import {createCanonicalBusinessSaleReadService} from './canonicalBusinessSaleReadService.mjs';
import {parseBusinessSaleReadQuery,businessSaleReadPath,businessSaleReadPathAllowed,validateBusinessSaleReadEnvelope} from './canonicalBusinessSaleReadModel.mjs';
import {BUSINESS_SESSION} from './canonicalBusinessSessionContext.mjs';
import {createWorkingCatalogSession} from '../../../sites-workflow/src/workflow/workingCatalogSession.mjs';
import {businessWorkfaceRequestAllowed} from '../../../sites-workflow/src/workflow/businessWorkface.mjs';
const noSql=()=>assert.fail('Isolated selection tests must never open SQL/auth/native');
mock.module('./authService.js',{namedExports:{getUserById:noSql,verifyAccessToken:noSql,verifyNormalTestAccessSession:noSql}});
const {createCanonicalBusinessSaleReadRoutes}=await import('../routes/canonicalBusinessSaleReadRoutes.mjs');
const q=()=>({customerId:'155',accountId:'7',currency:'USD',productId:'12',priceId:'81',unitSourceId:'9',tier:'1'});
const user=()=>({id:17,username:BUSINESS_SESSION.username,role:{id:17,code:BUSINESS_SESSION.roleCode},permissions:['sales.view','customer.view','product.view'],isActive:true,isAdmin:false});
const authority=()=>({userId:17,username:BUSINESS_SESSION.username,roleId:17,roleCode:BUSINESS_SESSION.roleCode,database:BUSINESS_SESSION.database,server:BUSINESS_SESSION.server,actualT1:false,externalOperations:false,permissions:user().permissions});
function inputs(){
 const customer=customerCardDto({customer:{id:'155',customerCode:'SYN-READ-C',customerName:'Sentetik müşteri',isActive:true},linkage:{status:'accepted-opening',verified:true,sourceLinkCount:1,sourcePartyCount:1},provenance:{verified:true,sourceAsOf:'2026-09-30',quarantineVerified:true},quarantineHolds:[],nativeAccounts:[{id:'7',customerId:'155',currency:'USD',nativeBalanceExact:'-2.12345678',sourceOpeningBalanceExact:'-2.12345678',localDeltaExact:'0.00000000',expectedNativeBalanceExact:'-2.12345678',ledgerBalanceExact:'-2.12345678',sourceAccountKey:'SYN/USD',matchStatus:'matched',reconciliationStatus:'reconciled',confidence:'source-matched',balanceStatus:'known'}],sourceAccounts:[{sourceKey:'SYN/USD',role:'customer',balanceStatus:'SOURCE',matchStatus:'matched',matchedNativeAccountId:'7',currency:'USD',sourceOpeningBalanceExact:'-2.12345678'}]},{detail:true});
 const source='VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/12';
 const product=catalogProductDto({id:'12',stockCode:'0012 MARKA',displayCode:'0012',classification:{brand:'MARKA',productType:'TAKIM',sourceName:'Sentetik ürün',verified:true},productName:'Sentetik ürün',isActive:true,stockQuantityExact:'-3.00000000',unit:{sourceId:'9',label:'ADET',factorExact8:'1.00000000',verified:true},barcodes:[{id:'71',value:'0000120000',isPrimary:true,sourceKey:null},{id:'72',value:'0000120001',isPrimary:false,sourceKey:null}],imageUrl:null,provenance:{kind:'accepted-opening',sourceKey:source,runId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30',verified:true},hold:{blocked:false,reasons:[]},salePrices:[{id:'81',type:'sale',unitSourceId:'9',tier:1,currency:'USD',priceExact:'2.12345678',isMainUnit:true,sourceKey:source+'/PRICE/sale/9/1/USD'}],photo:{status:'missing',url:null,sourceKey:null,verified:false}},{sqlSales:true,canViewSalesPrices:true});
 return {customer:{data:customer,meta:{readOnly:true,freshLive:false,sourceAsOf:'2026-09-30'}},catalog:{data:product,meta:{schemaVersion:'melisa-catalog.v1',readOnly:true,freshLive:false,sourceAsOf:'2026-09-30',readAt:'2026-10-28T00:00:00.000Z',canViewSalesPrices:true}}};
}
function fixture(){const data=inputs(),context=authority(),calls=[];const service=createCanonicalBusinessSaleReadService({authority:()=>context,readCustomer:async id=>{calls.push(['customer',id]);return data.customer;},readProduct:async(id,actor)=>{calls.push(['product',id,actor.id]);return data.catalog;}});return {data,context,calls,service};}
test('strict exact tuple rejects duplicate/foreign/number/LL and unsafe identities before reading',async()=>{
 for(const edit of [{currency:'LL'},{customerId:155},{productId:'012'},{accountId:'0'},{unitSourceId:'9223372036854775808'},{tier:'01'},{priceId:81},{requestId:'unexpected'},{currency:['USD','TRY']}])assert.throws(()=>parseBusinessSaleReadQuery({...q(),...edit}),{statusCode:400});
 const path=businessSaleReadPath(q());assert.equal(businessSaleReadPathAllowed(path),true);assert.equal(businessWorkfaceRequestAllowed('GET',path),true);
 for(const wrong of [path+'&currency=EUR',path+'&unknown=x',path+'#x',path.replace('selection?','selection/?'),path.replace('USD','LL')])assert.equal(businessSaleReadPathAllowed(wrong),false);
 for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS'])assert.equal(businessWorkfaceRequestAllowed(method,path),false);
 for(const path of ['/api/work-sales/context','/api/work-sales/drafts','/api/auth/local-passwordless-admin'])assert.equal(businessWorkfaceRequestAllowed('GET',path),false);
 const f=fixture();await assert.rejects(f.service.selection({...q(),priceId:null},user()),{statusCode:400});assert.equal(f.calls.length,0);
});
test('existing card/catalog DTOs bind exact account and price, preserve zeros and precision without write authority',async()=>{
 const f=fixture(),before=JSON.stringify(f.data),out=await f.service.selection(q(),user());
 assert.equal(out.data.selectionVerified,true);assert.equal(out.data.customer.account.id,'7');assert.equal(out.data.customer.account.balanceExact,'-2.12345678');assert.equal(out.data.customer.account.debitCreditDirection,'A');assert.equal(out.data.product.stockCode,'0012 MARKA');assert.equal(out.data.product.displayCode,'0012');assert.equal(out.data.product.stockQuantityExact,'-3.00000000');assert.deepEqual(out.data.product.barcodes.map(b=>b.value),['0000120000','0000120001']);assert.equal(out.data.price.priceExact,'2.12345678');assert.deepEqual(out.data.capabilities,{canSave:false,canFinalize:false,canCollect:false});assert.equal(out.meta.writeAuthorized,false);assert.equal(out.data.readEvidence.atomic,false);assert.equal(JSON.stringify(f.data),before);assert.deepEqual(f.calls,[['customer','155'],['product','12',17]]);
 assert.equal(validateBusinessSaleReadEnvelope({success:true,...out},q()).data,out.data);assert.equal(JSON.stringify(out).includes('sourceComparison'),false);
});
test('same currency accounts are selected by exact account ID, other unknown accounts do not contaminate the selected account',async()=>{
 const f=fixture();f.data.customer.data.accounts.push({...f.data.customer.data.accounts[0],accountId:'8',balanceExact:null,amountExact:null,debitCreditDirection:null,reconciled:false,confidence:'unknown'});f.data.customer.data.hasUnknownAccounts=true;
 assert.equal((await f.service.selection(q(),user())).data.selectionVerified,true);
 const unknown=await f.service.selection({...q(),accountId:'8'},user());assert.equal(unknown.data.selectionVerified,false);assert.equal(unknown.data.customer.account.balanceExact,null);assert(unknown.data.issues.includes('CUSTOMER_ACCOUNT_UNVERIFIED'));
 for(const query of [{...q(),accountId:'155'},{...q(),currency:'EUR'}])await assert.rejects(f.service.selection(query,user()),{code:'BUSINESS_SALE_ACCOUNT_CHANGED'});
 f.data.customer.data.accounts.push({...f.data.customer.data.accounts[0]});await assert.rejects(f.service.selection(q(),user()),{code:'BUSINESS_SALE_ACCOUNT_CHANGED'});
});
test('verified zero and both customer directions remain distinct; tampered client balances and write flags reject',async()=>{
 for(const [balanceExact,debitCreditDirection] of [['0.00000000','ZERO'],['2.12345678','B'],['-2.12345678','A']]){
  const f=fixture(),a=f.data.customer.data.accounts[0];Object.assign(a,{balanceExact,amountExact:balanceExact.replace(/^-/,''),debitCreditDirection});
  const envelope={success:true,...await f.service.selection(q(),user())};assert.equal(validateBusinessSaleReadEnvelope(envelope,q()).data.selectionVerified,true);
  for(const mutate of [d=>{d.customer.account.debitCreditDirection=debitCreditDirection==='A'?'B':'A';},d=>{d.customer.account.amountExact='3.00000000';},d=>{d.capabilities.canSave=true;},d=>{d.price.currency='TRY';},d=>{d.product.unit.factorExact8='6.00000000';},d=>{d.customer.account.id='155';}]){const bad=structuredClone(envelope);mutate(bad.data);assert.throws(()=>validateBusinessSaleReadEnvelope(bad,q()));}
 }
});
test('unknown, real zero and negative price remain distinct; unit and stock are never defaulted',async()=>{
 for(const price of [null,'0.00000000','-1.00000000']){const f=fixture();f.data.catalog.data.salePrices[0].priceExact=price;const out=await f.service.selection(q(),user());assert.equal(out.data.price.priceExact,price);assert.equal(out.data.selectionVerified,false);assert(out.data.issues.includes(price===null?'PRICE_UNKNOWN':'POSITIVE_PRICE_REQUIRED'));}
 for(const edit of [{factorExact8:null,verified:false},{factorExact8:'6.00000000',label:'KOLI'},{sourceId:'10'},{label:null}]){const f=fixture();Object.assign(f.data.catalog.data.unit,edit);const out=await f.service.selection(q(),user());assert(out.data.issues.includes('UNIT_NOT_SUPPORTED'));assert.deepEqual(out.data.product.unit,f.data.catalog.data.unit);}
 const f=fixture();f.data.catalog.data.stockQuantityExact=null;assert((await f.service.selection(q(),user())).data.issues.includes('STOCK_UNKNOWN'));
});
test('wrong product/tuple, hold, passive card, unproven account and monetary floats fail closed',async()=>{
 for(const edit of [{productId:'13'},{priceId:'82'},{unitSourceId:'10'},{tier:'2'}]){const f=fixture();await assert.rejects(f.service.selection({...q(),...edit},user()));}
 const held=fixture();held.data.catalog.data.hold.blocked=true;held.data.catalog.data.salePrices=[];await assert.rejects(held.service.selection(q(),user()),{code:'BUSINESS_SALE_PRODUCT_HELD'});
 for(const mutate of [d=>{d.customer.data.isPassive=true;},d=>{d.customer.data.quarantine.blocked=null;},d=>{d.catalog.data.isActive=false;},d=>{d.customer.data.accounts[0].confidence='drift';}]){const f=fixture();mutate(f.data);assert.equal((await f.service.selection(q(),user())).data.selectionVerified,false);}
 for(const mutate of [d=>{d.customer.data.accounts[0].balanceExact=2.1;},d=>{d.customer.data.accounts[0].debitCreditDirection='B';},d=>{d.catalog.data.salePrices[0].priceExact=2.1;},d=>{d.catalog.meta.canViewSalesPrices=false;}]){const f=fixture();mutate(f.data);await assert.rejects(f.service.selection(q(),user()));}
});
test('normal actor, registered authority and unchanged permission witness are required before and after reads',async()=>{
 for(const edit of [{id:16},{role:{id:17,code:'isolated_test_ilker'}},{username:'other'},{isAdmin:true},{testAdminSession:true},{permissions:['sales.view','product.view']},{permissions:[...user().permissions,'users.manage']}]){const f=fixture();await assert.rejects(f.service.selection(q(),{...user(),...edit}),{statusCode:403});assert.equal(f.calls.length,0);}
 const missing=createCanonicalBusinessSaleReadService({authority:()=>null,readCustomer:noSql,readProduct:noSql});await assert.rejects(missing.selection(q(),user()),{statusCode:503});
 const f=fixture();f.context.database='other';await assert.rejects(f.service.selection(q(),user()),{statusCode:503});assert.equal(f.calls.length,0);
 const context=authority(),actor=user(),data=inputs(),s=createCanonicalBusinessSaleReadService({authority:()=>context,readCustomer:async()=>{actor.permissions=[];return data.customer;},readProduct:async()=>data.catalog});await assert.rejects(s.selection(q(),actor),{statusCode:403});
});
test('isolated HTTP route and existing browser session transport read the selection; writes and foreign actors never reach readers',async()=>{
 const f=fixture(),app=express(),requests=[];app.use(express.json());
 const actors={semih:user(),foreign:{...user(),id:16},limited:{...user(),permissions:['sales.view']}};
 app.use('/api',createCanonicalBusinessSaleReadRoutes({service:f.service,authenticate:(req,res,next)=>{requests.push(req.method+' '+req.path);req.user=actors[req.get('x-test-actor')];if(!req.user)return res.status(401).json({success:false});next();}}));
 app.use((e,_req,res,_next)=>res.status(e.statusCode??500).json({success:false,error:{code:e.code}}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const origin='http://127.0.0.1:'+server.address().port;
 try{
  const location={protocol:'http:',hostname:'127.0.0.1',port:'5244',origin:'http://127.0.0.1:5244'},values=new Map(),paths=[];
  const session=createWorkingCatalogSession({location,apiBase:'http://127.0.0.1:4144',businessProfile:BUSINESS_SESSION.id,protectedDevice:null,storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},fetchImpl:async(url,options)=>{const u=new URL(url);paths.push({path:u.pathname,method:options.method,body:options.body});assert.equal(u.origin,location.origin);assert.equal(options.credentials,'same-origin');if(u.pathname==='/api/auth/refresh')return {ok:true,status:200,json:async()=>({success:true,data:{user:user(),accessToken:'fixture-access',browserSession:true,expiresAt:Date.now()+900000}})};assert.equal(options.method,'GET');return fetch(origin+u.pathname+u.search,{method:options.method,headers:{'x-test-actor':'semih'}});}});
  await session.start();const out=await session.businessSaleSelection(q());assert.equal(out.data.selectionVerified,true);assert.equal(out.data.price.priceExact,'2.12345678');assert.equal(paths.at(-1).method,'GET');assert.equal(paths.at(-1).body,undefined);
  const count=f.calls.length,path=businessSaleReadPath(q());
  for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await fetch(origin+path,{method,headers:{'x-test-actor':'semih'}})).status,405);
  for(const [actor,status] of [['none',401],['foreign',403],['limited',403]])assert.equal((await fetch(origin+path,{headers:{'x-test-actor':actor}})).status,status);
  assert.equal((await fetch(origin+path+'&currency=EUR',{headers:{'x-test-actor':'semih'}})).status,400);assert.equal(f.calls.length,count);assert(requests.every(r=>r.startsWith('GET ')));
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
