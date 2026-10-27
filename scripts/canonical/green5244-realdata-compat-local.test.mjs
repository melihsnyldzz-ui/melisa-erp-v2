// Cross-release LOCAL preparation proof. Missing installed evidence => SKIP, not PASS.
// Pure models/HTML fixtures only; no HTTP, SQL, credential, browser or runtime calls.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {GREEN5244_PREP as p} from './prepare-green5244-realdata-compat.mjs';
const available=fs.existsSync(p.destination+'/candidate.json'),local=(name,fn)=>test(name,{skip:!available},fn),sha=b=>createHash('sha256').update(b).digest('hex');
const candidate=()=>JSON.parse(fs.readFileSync(p.destination+'/candidate.json')),context=()=>JSON.parse(fs.readFileSync(p.context)),file=n=>p.web+'/apps/sites-workflow/src/workflow/'+n;
const load=n=>import(pathToFileURL(file(n)).href);
async function catalog(overlay){let source=fs.readFileSync(file('workCatalogModel.mjs'),'utf8');source=source.replace(/from '(\.\/[^']+)'/g,(_,relative)=>'from '+JSON.stringify(pathToFileURL(overlay&&relative==='./currentProductCatalogModel.mjs'?p.destination+'/'+p.overlay:path.resolve(path.dirname(file('workCatalogModel.mjs')),relative)).href));return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));}
const row=()=>({id:'12',stockCode:'00012',displayCode:'00012',classification:{brand:'CONCEPT',productType:'TAKIM',sourceName:'SYNTHETIC FIXTURE',verified:true},productName:'SYNTHETIC FIXTURE',isActive:true,stockQuantityExact:'-3.00000000',unit:{label:'ADET',sourceId:'7',factorExact8:'1.00000000',verified:true},barcodes:[{id:'91',value:'000012',isPrimary:true,sourceKey:null}],provenance:{kind:'accepted-opening',sourceKey:'VEGA_CAPTURE_20260930_01/F0102/TBLSTOKLAR/12',runId:'VEGA-OPENING-TEST-20261004-06',sourceAsOf:'2026-09-30',verified:true},hold:{blocked:false,reasons:[]},salePrices:[{id:'77',type:'sale',unitSourceId:'7',tier:1,currency:'USD',priceExact:'9.12345678',isMainUnit:true,sourceKey:null}],photo:{status:'missing',url:null,sourceKey:null,verified:false}});
const envelope=()=>({success:true,data:[row()],meta:{schemaVersion:'melisa-catalog.v1',readOnly:true,sourceAsOf:context().sourceAsOf,currentVersion:context(),freshLive:false,readAt:'2026-10-27T15:00:00.000Z',canViewSalesPrices:true,scopeCounts:{acceptedOpening:context().productCount,syntheticTest:0,quarantinedSource:54},filters:{brands:['CONCEPT'],productTypes:['TAKIM']},total:1,page:1,limit:50,totalPages:1}});
local('pinned source overlay changes one catalog parser; finance10b and CSSb6 stay byte-equal',()=>{
 const c=candidate();assert.equal(c.installed,false);assert.equal(c.executionAllowed,false);assert.equal(c.kind,'UNBUILT_SOURCE_OVERLAY_NOT_INSTALLABLE');assert.equal(sha(fs.readFileSync(p.destination+'/'+p.overlay)),c.overlay.afterSha256);assert.notEqual(c.overlay.beforeSha256,c.overlay.afterSha256);
 for(const f of c.preserved)assert.equal(sha(fs.readFileSync(p.web+'/'+f.path)),f.sha256);for(const f of c.sharedDependencies)assert.equal(sha(fs.readFileSync(p.destination+'/'+f.path)),f.sha256);assert.equal(c.sharedDependencies.length,2);assert(c.preserved.some(f=>f.path.endsWith('erp-modern.css')));assert(c.preserved.some(f=>f.path.endsWith('workCollections.js')));
});
local('old5244 rejects current stock ancestry; accepted donor overlay and real-data backend model agree',async()=>{
 const old=await load('currentProductCatalogModel.mjs'),next=await import(pathToFileURL(p.destination+'/'+p.overlay).href),backend=await import(pathToFileURL(p.data+'/apps/api/src/services/currentProductCatalogContext.mjs').href);
 assert.equal(!!old.currentProductCatalogVersion(context()),false);assert.equal(!!next.currentProductCatalogVersion(context()),true);assert.equal(backend.validateCurrentProductCatalogContext(context()).runId,context().runId);
});
local('actual5244 catalog consumer with overlay preserves code, barcode, negative stock and currency tuple',async()=>{
 const old=await catalog(false),next=await catalog(true),input=envelope();assert.throws(()=>old.catalogEnvelope(input,{salesPermission:true}));const parsed=next.catalogEnvelope(input,{salesPermission:true});assert.equal(parsed.data[0].stockCode,'00012');assert.equal(parsed.data[0].barcodes[0].value,'000012');assert.equal(parsed.data[0].stockQuantityExact,'-3.00000000');assert.equal(next.catalogMainPrice(parsed.data[0]).currency,'USD');assert.equal(parsed.data[0].salePrices[0].priceExact,'9.12345678');
});
local('overlay retains role, quarantine and malformed context denial; no permissive fallback',async()=>{
 const next=await catalog(true);assert.throws(()=>next.catalogEnvelope(envelope(),{salesPermission:false}));
 for(const edit of [e=>e.meta.currentVersion.actualT1=true,e=>e.meta.currentVersion.readerDefinitionHash='bad',e=>e.meta.currentVersion.ancestry[1].sourceAsOf='2026-10-27',e=>e.meta.scopeCounts.acceptedOpening++,e=>e.meta.scopeCounts.syntheticTest=1]){const e=envelope();edit(e);assert.throws(()=>next.catalogEnvelope(e,{salesPermission:true}));}
 const held=row();held.hold.blocked=true;assert.equal(next.catalogMainPrice(held),null);
});
local('actual5244 customer/supplier HTML ignores zero scalar for UNKNOWN currency account',async()=>{
 const m=await load('currencyAccountPresentation.mjs');for(const role of ['customer','supplier']){const unknown={currency:'EUR',balanceExact:null,nativeBalanceExact:'0.00000000',rawScalar:'99999999',confidence:'unknown',sourceStatus:'unknown',reconciled:false};assert.equal(m.accountPresentation(unknown,{role}).known,false);const html=m.currencyAccountsHtml([unknown],{role,detail:true});assert.match(html,/EUR: Bilinmiyor/);assert.doesNotMatch(html,/99999999|0,00/);const consumer=fs.readFileSync(file(role==='customer'?'workCustomers.js':'workSuppliers.js'),'utf8');assert.match(consumer,/currencyAccountsHtml/);}
});
local('actual5244 currency renderer keeps TRY/USD/EUR and role-specific B/A separate',async()=>{
 const m=await load('currencyAccountPresentation.mjs'),a=(currency,balance)=>({currency,balanceExact:balance,sourceOpeningBalanceExact:balance,localDeltaExact:'0.00000000',confidence:'source-matched',reconciled:true});for(const role of ['customer','supplier']){const html=m.currencyAccountsHtml([a('TRY','3.00000000'),a('USD','-4.00000000'),{currency:'EUR',balanceExact:null,confidence:'unknown',reconciled:false}],{role});assert.match(html,new RegExp('3,00 TRY · '+(role==='customer'?'B':'A')));assert.match(html,new RegExp('4,00 USD · '+(role==='customer'?'A':'B')));assert.match(html,/EUR: Bilinmiyor/);}
});
local('existing5244 session refuses4144 pairing and never silently auto-opens another actor',async()=>{
 const m=await load('testAdminSession.mjs'),location={protocol:'http:',hostname:'127.0.0.1',port:'5244',origin:'http://127.0.0.1:5244'};assert.equal(m.resolveTestApiBase({location,apiBase:'http://127.0.0.1:4144'}),null);assert.equal(m.shouldAutoOpenTestAdmin({location,apiBase:'http://127.0.0.1:4194'}),false);assert.equal(candidate().target.normalActorMapped,false);
});
local('5536 native UNKNOWN and coherent backend/session remain explicit deployment blockers',()=>{
 const c=candidate();assert(c.blockers.some(x=>x.includes('NOT NULL')));assert(c.blockers.some(x=>x.includes('synthetic cohorts')));assert(c.blockers.some(x=>x.includes('existing user')));assert(c.blockers.some(x=>x.includes('not compiled')));assert.equal(c.bases.cleanApiReferenceOnly.notBusinessBackend,true);assert.equal(c.target.assumedDatabase,'MELISA_ERP_SIRKET_TEST_20260929_01');
});
