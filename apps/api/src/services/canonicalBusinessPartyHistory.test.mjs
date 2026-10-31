import test,{mock} from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {parsePartyHistoryQuery,partyHistoryPath,partyHistoryPathAllowed,partyHistoryResult,validatePartyHistoryEnvelope} from './canonicalBusinessPartyHistoryModel.mjs';
import {createCanonicalBusinessPartyHistoryService} from './canonicalBusinessPartyHistoryService.mjs';
import {createCanonicalBusinessSaleReadService} from './canonicalBusinessSaleReadService.mjs';
import {BUSINESS_SESSION} from './canonicalBusinessSessionContext.mjs';
import {createWorkingCatalogSession} from '../../../sites-workflow/src/workflow/workingCatalogSession.mjs';
const noSql=()=>assert.fail('Offline history fixture must not access SQL/auth/native');
mock.module('./authService.js',{namedExports:{getUserById:noSql,verifyAccessToken:noSql,verifyNormalTestAccessSession:noSql}});
const {createCanonicalBusinessPartyHistoryRoutes}=await import('../routes/canonicalBusinessPartyHistoryRoutes.mjs');
const query=(kind='customer')=>({kind,partyId:'155',accountId:'7',currency:'USD',page:'1'}),clock=()=> '2026-10-28T00:00:00.000Z';
const actor=()=>({id:17,username:BUSINESS_SESSION.username,role:{id:17,code:BUSINESS_SESSION.roleCode},permissions:['sales.view','customer.view','product.view','finance.view','supplier.view','purchase.view'],isAdmin:false});
const authority=()=>({userId:17,username:BUSINESS_SESSION.username,roleId:17,roleCode:BUSINESS_SESSION.roleCode,database:BUSINESS_SESSION.database,server:BUSINESS_SESSION.server,actualT1:false,externalOperations:false,permissions:actor().permissions});
const row=(id='91',date='2025-12-31')=>({id,kind:'collection',documentDate:date,documentAmountExact:'100.0000',documentCurrencyRaw:'TRY',accountAmountExact:'2.1234',accountCurrency:'USD',balanceEffectExact:'-2.12345678',legacyBalanceEffectExact:'-2.1234',affectsBalance:true,invoiceId:'51',invoiceNumber:'SYN-INV',returnId:null});
const raw=()=>({account:{id:'7',partyId:'155',oppositePartyId:null,partyEntityId:'3',currency:'USD'},total:'1',unassignedCount:'2',conflictCount:'0',rows:[row()]});
function fixture(){const data=raw(),context=authority(),calls=[],auth=createCanonicalBusinessSaleReadService({authority:()=>context}).assertActor;return {data,context,calls,service:createCanonicalBusinessPartyHistoryService({authorize:auth,clock,store:{read:async options=>{calls.push(options);return data;}}})};}
test('account IDs, role, currency and dates parse strictly; native history defaults to all recorded dates',()=>{
 const q=parsePartyHistoryQuery(query());assert.equal(q.offset,0);assert.equal(q.dateFrom,null);assert.equal(q.dateTo,null);
 for(const edit of [{kind:'finance'},{accountId:'0'},{accountId:7},{partyId:'9223372036854775808'},{currency:'LL'},{currency:['USD','EUR']},{page:'0'},{page:'100001'},{dateFrom:'2026-02-30'},{dateFrom:'2026-04-02',dateTo:'2026-04-01'},{unexpected:'x'}])assert.throws(()=>parsePartyHistoryQuery({...query(),...edit}),{statusCode:400});
 const p=partyHistoryPath({...query(),page:2});assert.equal(partyHistoryPathAllowed(p),true);for(const bad of [p+'&currency=EUR',p+'&partyId=9',p.replace('/7?','/07?'),p.replace('USD','LL'),p+'#x'])assert.equal(partyHistoryPathAllowed(bad),false);
});
test('TRY document in USD account retains each exact amount, B/A-effect precision and all native recorded years',async()=>{
 const f=fixture(),out=await f.service.read(query(),actor());assert.equal(out.data[0].documentCurrency,'TRY');assert.equal(out.data[0].accountCurrency,'USD');assert.equal(out.data[0].documentAmountExact,'100.0000');assert.equal(out.data[0].accountAmountExact,'2.1234');assert.equal(out.data[0].balanceEffectExact,'-2.12345678');assert.equal(out.data[0].documentDate,'2025-12-31');assert.equal(out.meta.scope.period,'all-native-recorded-dates');assert.equal(out.meta.atomic,false);assert.equal(out.meta.originClassification,'NOT_PERFORMED');assert.equal(out.meta.unassignedCount,2);assert.equal(out.meta.unassignedScope,'party-all-native-recorded-dates');assert.equal(out.meta.writeAuthorized,false);assert.equal('balance' in out,false);assert.deepEqual(f.calls,[parsePartyHistoryQuery(query())]);assert.equal(validatePartyHistoryEnvelope({success:true,...out},query()).data[0].id,'91');
});
test('out-of-range page retains total; unknown account amount/currency/effect never becomes zero',()=>{
 const q=parsePartyHistoryQuery({...query(),page:'2'}),r=raw();r.rows=[];const out=partyHistoryResult(r,q,{readAt:clock()});assert.equal(out.meta.total,1);assert.deepEqual(out.data,[]);
 const unknown=raw();Object.assign(unknown.rows[0],{accountAmountExact:null,accountCurrency:null,balanceEffectExact:null,affectsBalance:null,documentCurrencyRaw:'$2'});const u=partyHistoryResult(unknown,parsePartyHistoryQuery(query()),{readAt:clock()});assert.equal(u.data[0].accountAmountExact,null);assert.equal(u.data[0].documentCurrency,null);assert.equal(u.data[0].documentCurrencyRaw,'$2');assert.equal(u.data[0].legacyBalanceEffectExact,'-2.1234');assert.deepEqual(u.data[0].unknownFields,['documentCurrency','accountAmountExact','balanceEffectExact','affectsBalance','accountCurrency']);
});
test('wrong membership, dual role and linked currency/entity conflicts block without returning rows',()=>{
 for(const [mutate,code] of [[r=>{r.account=null;},'BUSINESS_PARTY_HISTORY_ACCOUNT_CHANGED'],[r=>{r.account.partyId='156';},'BUSINESS_PARTY_HISTORY_ACCOUNT_CHANGED'],[r=>{r.account.currency='EUR';},'BUSINESS_PARTY_HISTORY_ACCOUNT_CHANGED'],[r=>{r.account.oppositePartyId='90';},'BUSINESS_PARTY_HISTORY_ROLE_CONFLICT'],[r=>{r.conflictCount='1';},'BUSINESS_PARTY_HISTORY_LINK_CONFLICT']]){const r=raw();mutate(r);assert.throws(()=>partyHistoryResult(r,parsePartyHistoryQuery(query()),{readAt:clock()}),{code});}
 for(const mutate of [r=>{r.rows[0].accountAmountExact=2.12;},r=>{r.rows[0].accountCurrency='EUR';},r=>{r.total='9007199254740992';},r=>{r.total='2';r.rows.push({...r.rows[0]});},r=>{r.rows[0].documentDate='invalid';}]){const r=raw();mutate(r);assert.throws(()=>partyHistoryResult(r,parsePartyHistoryQuery(query()),{readAt:clock()}));}
});
test('explicit document-date range rejects leaked older rows; row order and count are checked',()=>{
 const q=parsePartyHistoryQuery({...query(),dateFrom:'2026-01-01',dateTo:'2026-12-31'});assert.throws(()=>partyHistoryResult(raw(),q,{readAt:clock()}));
 const r=raw();r.rows=[row('92','2026-01-01'),row('91','2026-01-01')];r.total='2';assert.equal(partyHistoryResult(r,q,{readAt:clock()}).data.length,2);r.rows.reverse();assert.throws(()=>partyHistoryResult(r,q,{readAt:clock()}));
});
test('registered normal actor and the relevant finance/party/trade permissions remain mandatory',async()=>{
 for(const user of [{...actor(),id:16},{...actor(),isAdmin:true},{...actor(),permissions:actor().permissions.filter(p=>p!=='finance.view')},{...actor(),permissions:actor().permissions.filter(p=>p!=='supplier.view')}]){const f=fixture();await assert.rejects(f.service.read(query('supplier'),user),{statusCode:403});assert.equal(f.calls.length,0);}
 const f=fixture();f.context.database='foreign';await assert.rejects(f.service.read(query(),actor()),{statusCode:503});assert.equal(f.calls.length,0);
});
test('client envelope rejects substituted account/currency/amount claims without depending on object key order',()=>{
 const out={success:true,...partyHistoryResult(raw(),parsePartyHistoryQuery(query()),{readAt:clock()})};
 const reordered=structuredClone(out);reordered.data=reordered.data.map(r=>Object.fromEntries(Object.entries(r).reverse()));assert.equal(validatePartyHistoryEnvelope(reordered,query()),reordered);
 for(const mutate of [p=>{p.meta.scope.accountId='8';},p=>{p.data[0].documentCurrency='USD';},p=>{p.data[0].accountAmountExact=2.12;},p=>{p.meta.writeAuthorized=true;},p=>{p.data[0].unknownFields=['invented'];}]){const p=structuredClone(out);mutate(p);assert.throws(()=>validatePartyHistoryEnvelope(p,query()));}
});
test('existing browser session reads exact history through same-origin GET without storing refresh secrets',async()=>{
 const input=query(),payload={success:true,...partyHistoryResult(raw(),parsePartyHistoryQuery(input),{readAt:clock()})},values=new Map(),calls=[];
 const location={protocol:'http:',hostname:'127.0.0.1',port:'5244',origin:'http://127.0.0.1:5244'};
 const session=createWorkingCatalogSession({location,apiBase:'http://127.0.0.1:4144',businessProfile:BUSINESS_SESSION.id,protectedDevice:null,storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},fetchImpl:async(url,options)=>{
  const u=new URL(url);assert.equal(u.origin,location.origin);assert.equal(options.credentials,'same-origin');calls.push({path:u.pathname+u.search,method:options.method,body:options.body});
  if(u.pathname==='/api/auth/refresh')return {ok:true,status:200,json:async()=>({success:true,data:{user:actor(),accessToken:'fixture-access',browserSession:true,expiresAt:Date.now()+900000}})};
  assert.equal(options.method,'GET');assert.equal(options.body,undefined);assert.equal(u.pathname+u.search,partyHistoryPath(input));return {ok:true,status:200,json:async()=>payload};
 }});
 assert.equal(session.partyHistoryAvailable('customer'),false);await session.start();assert.equal(session.partyHistoryAvailable('customer'),true);assert.equal(session.partyHistoryAvailable('supplier'),true);assert.equal(session.partyHistoryAvailable('unknown'),false);assert.equal(await session.partyHistory(input),payload);assert.equal(calls.at(-1).path,partyHistoryPath(input));assert(!JSON.stringify([...values.values()]).includes('refreshToken'));
});

test('isolated HTTP route guards query shadowing and rejects financial methods without touching readers',async()=>{
 const f=fixture(),app=express();app.use(express.json());app.use('/api',createCanonicalBusinessPartyHistoryRoutes({service:f.service,authenticate:(req,res,next)=>{if(req.get('x-test-actor')!=='semih')return res.status(401).json({success:false});req.user=actor();next();}}));app.use((e,_req,res,_next)=>res.status(e.statusCode??500).json({success:false,error:{code:e.code}}));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const origin='http://127.0.0.1:'+server.address().port,path=partyHistoryPath(query());
 try{const good=await fetch(origin+path,{headers:{'x-test-actor':'semih'}});assert.equal(good.status,200);assert.equal(good.headers.get('cache-control'),'no-store');validatePartyHistoryEnvelope(await good.json(),query());const before=f.calls.length;
  assert.equal((await fetch(origin+path)).status,401);for(const method of ['POST','PUT','DELETE','PATCH'])assert.equal((await fetch(origin+path,{method,headers:{'x-test-actor':'semih'}})).status,405);for(const bad of [path+'&partyId=99',path+'&currency=EUR'])assert.equal((await fetch(origin+bad,{headers:{'x-test-actor':'semih'}})).status,400);assert.equal(f.calls.length,before);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
