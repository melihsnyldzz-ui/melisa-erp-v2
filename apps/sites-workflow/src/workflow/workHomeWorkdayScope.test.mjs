import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {homeWorkday,validateWorkHome,homeAmount,homeReportsReady,homeNormalScreen} from './workHomeModel.mjs';
import {homeSummaryDto} from '../../../api/src/services/homeSummaryModel.mjs';

// Real native DTO projector with synthetic, in-memory data and explicit clocks.
function dto(date='2026-11-02'){
 const capabilities=Object.fromEntries(['home','goods','purchase','sales','collection','product','customer','supplier','finance','payment','count','returns','approval','salesReturn','purchaseReturn','approveGoods'].map(k=>[k,true]));
 return homeSummaryDto({capabilities,counts:Object.fromEntries(['salesCount','salesCancelledCount','goodsPendingCount','salesReturnCount','purchaseReturnCount','returnCancelledCount','countPendingCount','approvalPendingCount'].map(k=>[k,0])),tasks:[{id:'goods:12',kind:'goods',state:'pending',date:null}],salesTotals:[{currency:'TRY',amountExact4:'0.0000',knownCount:1,unknownCount:0},{currency:'USD',amountExact4:'9007199254740993.1234',knownCount:1,unknownCount:0},{currency:'EUR',amountExact4:null,knownCount:0,unknownCount:1}],collections:[],payments:[],reversals:[]},{date,readAt:'2026-11-03T09:00:00.000Z'});
}
function copy(business=false){
 const profile={schemaVersion:'melisa-stage4-isolated-operation-copy.v1',operationOrigin:'ISOLATED_TEST_COPY',copyId:'00000000-0000-4000-8000-000000000001',sealHash:'a'.repeat(64),backupSHA:'b'.repeat(64),sourceDatabase:'MELISA_ERP_SIRKET_TEST_20260929_01',target:{server:'Semih\\MELISADEV',database:business?'MELISA_ERP_CRM_SHARED_TEST_20261009_02':'MELISA_ERP_STAGE04_COPY_TEST_20261008_01'},date:business?'2026-10-09':'2026-10-08',actors:[{id:'15',role:'isolated_test_sales'},{id:'16',role:'isolated_test_ilker'}],products:['301','302'].map(id=>({id,stockCode:'K-'+id,unit:'ADET',unitFactorExact8:'1.00000000',priceIds:[id],barcodes:[],sourceKey:'VEGA2026/F0102TBLSTOKLAR/'+id})),customers:[{id:'501',partyId:'21',accountId:'22',currency:'TRY',sourceKey:'VEGA2026/F0102TBLCARI/23'}],suppliers:[{id:'801',partyId:'31',accountId:'32',currency:'TRY',sourceKey:'VEGA2026/F0103TBLCARI/33'}],financeAccounts:[{id:'99',currency:'TRY'}]};
 if(business){Object.assign(profile,{scopeKind:'VERIFIED_BUSINESS_TEST',businessScopeHash:'c'.repeat(64),businessInvoiceMaxExact4:'20000.0000',businessDaily:{scopeHash:'d'.repeat(64),selection:{currency:'TRY',productIds:['301','302'],customerAccountId:'22',supplierAccountId:'32',financeAccountId:'99'}}});profile.products.forEach(p=>p.supplierId='801');}
 const data=dto(profile.date);Object.assign(data.meta,{operationOrigin:profile.operationOrigin,copyId:profile.copyId,sealHash:profile.sealHash,...(business?{dailySelectionReady:true}:{} )});return {profile,data};
}
function withCopy(t,business){const previous=Object.getOwnPropertyDescriptor(globalThis,'window'),c=copy(business);Object.defineProperty(globalThis,'window',{configurable:true,writable:true,value:{location:{protocol:'http:',hostname:'127.0.0.1',port:business?'5234':'5204'},__MELISA_OPERATION_COPY__:c.profile}});t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else delete globalThis.window;});return c;}

for(const [label,date,now,isToday] of [
 ['past native workday','2026-11-02','2026-11-03T09:00:00Z',false],
 ['same native workday','2026-11-03','2026-11-03T09:00:00Z',true],
 ['future native workday','2026-11-04','2026-11-03T09:00:00Z',false],
 ['Istanbul before midnight','2026-11-02','2026-11-02T20:59:59.999Z',true],
 ['Istanbul midnight','2026-11-02','2026-11-02T21:00:00Z',false],
 ['Istanbul next workday','2026-11-03','2026-11-02T21:00:00Z',true],
 ['Istanbul year boundary','2026-12-31','2026-12-31T21:00:00Z',false],
 ['valid leap day','2024-02-29','2024-02-29T20:59:59.999Z',true],
 ['leap day after midnight','2024-02-29','2024-02-29T21:00:00Z',false],
])test(`${label}: labels and actual date do not depend on copy metadata`,()=>{
 const data=dto(date),before=structuredClone(data);assert.equal(validateWorkHome(data),data);
 const scope=homeWorkday(data,new Date(now));assert.equal(scope.prefix,isToday?'Bugünkü':'İş günündeki');assert.equal(scope.tasksLabel,isToday?'Bugünkü işler':'İş gününün işleri');assert.equal(scope.subtitle,isToday?'Bugünkü işleri görün; yapmak istediğiniz işlemi açın.':'İş gününün işlerini görün; yapmak istediğiniz işlemi açın.');assert.equal(scope.workdayText,'İş günü: '+date.split('-').reverse().join('.'));assert.equal(scope.date,date);assert.equal(scope.dailyFlow,false);assert.equal(scope.scopeLabel,null);assert.equal(scope.scopeNote,null);assert.deepEqual(data,before);
});

test('read timestamp and a native daily-ready marker cannot replace the source workday or invent sealed scope',()=>{
 const data=dto();data.meta.readAt='2026-11-05T09:00:00Z';data.meta.dailySelectionReady=true;const before=structuredClone(data),scope=homeWorkday(data,new Date('2026-11-03T09:00:00Z'));
 assert.equal(scope.date,'2026-11-02');assert.equal(scope.prefix,'İş günündeki');assert.equal(scope.dailyFlow,false);assert.equal(scope.scopeNote,null);assert.deepEqual(data,before);
});

for(const invalid of ['2026-02-29','2024-02-30','2026-04-31','2026-13-01','2026-00-01','2026-11-00','2026-11-32','2026-2-02'])test(`invalid calendar date ${invalid} is rejected without normalization`,()=>{
 const data=dto(invalid),before=structuredClone(data);assert.throws(()=>homeWorkday(data,new Date('2026-11-03T09:00:00Z')));assert.deepEqual(data,before);
 const task=dto();task.tasks[0].date=invalid;assert.throws(()=>validateWorkHome(task));
});

for(const today of [true,false])test(`sealed copy keeps source identity and ${today?'same':'different'} workday wording`,t=>{
 const {data,profile}=withCopy(t,false),before=structuredClone({data,profile}),scope=homeWorkday(data,new Date(today?'2026-10-08T09:00:00Z':'2026-11-03T09:00:00Z'));
 assert.equal(scope.prefix,today?'Bugünkü':'İş günündeki');assert.equal(scope.workdayText,'İş günü: 08.10.2026');assert.equal(scope.dailyFlow,false);assert.equal(scope.scopeNote,null);assert.deepEqual({data,profile},before);
});

test('verified daily flow keeps its exact explanation and selection while labels still identify its workday',t=>{
 const {data,profile}=withCopy(t,true),before=structuredClone({data,profile});
 for(const now of ['2026-10-09T09:00:00Z','2026-11-03T09:00:00Z']){const scope=homeWorkday(data,new Date(now));assert.equal(scope.dailyFlow,true);assert.equal(scope.prefix,'Günlük akış');assert.equal(scope.scopeLabel,'Günlük akış özeti');assert.equal(scope.scopeNote,'Bu özet kayıtlı günlük akıştaki işlemleri gösterir. Diğer kayıtları Raporlar bölümünden inceleyebilirsiniz.');assert.equal(scope.workdayText,'İş günü: 09.10.2026');assert.equal(scope.tasksLabel,now.startsWith('2026-10-09')?'Bugünkü işler':'İş gününün işleri');}
 assert.deepEqual({data,profile},before);data.meta.dailySelectionReady=false;assert.equal(homeWorkday(data,new Date('2026-11-03T09:00:00Z')).dailyFlow,false);
});

test('copy provenance or malformed daily selection still fails closed',t=>{
 const {data,profile}=withCopy(t,true);
 for(const mutate of [d=>d.meta.date='2026-10-10',d=>d.meta.sealHash='e'.repeat(64),d=>delete d.meta.copyId,d=>d.meta.dailySelectionReady='true',d=>d.meta.businessDailyScopeHash='e'.repeat(64)]){const bad=structuredClone(data);mutate(bad);assert.throws(()=>homeWorkday(bad,new Date('2026-11-03T09:00:00Z')));}
 profile.businessDaily.selection.productIds=['unknown'];assert.throws(()=>homeWorkday(data,new Date('2026-11-03T09:00:00Z')));
});

test('wording leaves unknown/zero, exact currencies, capabilities and navigation unchanged',()=>{
 const data=dto(),before=structuredClone(data);homeWorkday(data,new Date('2026-11-03T09:00:00Z'));assert.equal(homeAmount(data.sections.sales.currencyTotals[0].amountExact4),'0');assert.equal(homeAmount(data.sections.sales.currencyTotals[1].amountExact4),'9.007.199.254.740.993,1234');assert.equal(homeAmount(data.sections.sales.currencyTotals[2].amountExact4),'Bilinmiyor');assert.equal(homeReportsReady(data,{permissions:['sales.view']}),true);assert.equal(homeReportsReady(data,{permissions:[]}),false);assert.equal(homeNormalScreen(data.tasks[0].target),'goods');assert.deepEqual(data,before);
});

test('unchanged production home controller renders native dated wording with a pinned fixture clock',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-03T09:00:00Z')});
 let source=await readFile(new URL('./workHome.js',import.meta.url),'utf8');source=source.replace("import './workHome.css';",'').replace("'./workHomeModel.mjs'",JSON.stringify(new URL('./workHomeModel.mjs',import.meta.url).href));const {createWorkHome}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const nodes=new Map(),root={isConnected:true,innerHTML:'',querySelector(k){if(!nodes.has(k))nodes.set(k,{});return nodes.get(k);},querySelectorAll(){return [];}},data=dto(),before=structuredClone(data),calls=[];
 const ui=createWorkHome({root,session:{home:async()=>{calls.push('GET home');return data;}}});t.after(()=>ui.dispose());ui.mount();await new Promise(resolve=>setImmediate(resolve));
 assert.match(root.innerHTML,/İş günü: 02\.11\.2026 · Son okuma:/);assert.match(root.innerHTML,/İş günündeki satış/);assert.match(root.innerHTML,/İş gününün işleri/);assert.doesNotMatch(root.innerHTML,/Bugünkü|Günlük akış özeti|data-home-reports/);assert.match(root.innerHTML,/Bilinmiyor EUR/);await ui.refresh();assert.deepEqual(calls,['GET home','GET home']);assert.deepEqual(data,before);
});
