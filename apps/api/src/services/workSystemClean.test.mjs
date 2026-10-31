import test from 'node:test';
import assert from 'node:assert/strict';
import {createCleanWorkSystemService} from './workSystemService.mjs';
import {CLEAN_DATABASE,CLEAN_ENVIRONMENT_ID,CLEAN_LOGIN} from './cleanSyntheticContext.mjs';
import {validateSystemSummary} from '../../../sites-workflow/src/workflow/workSystemSettingsModel.mjs';

const actor=()=>({id:10018,username:'semih',displayName:'Semih',role:{code:'admin'},permissions:['product.view','settings.manage','audit.view']});
const fixture=()=>({
 context:{environment:'CLEAN_SYNTHETIC_TEST',environmentId:CLEAN_ENVIRONMENT_ID,database:CLEAN_DATABASE,synthetic:true,actualT1:false,externalOperations:false},
 identity:{databaseName:CLEAN_DATABASE,serverName:'Semih\\MELISADEV',loginName:CLEAN_LOGIN,databaseUser:CLEAN_LOGIN,sysadmin:0,databaseControl:0,originalDatabaseAccess:0,liveDatabaseAccess:0,environmentId:CLEAN_ENVIRONMENT_ID},
 port:4194,sourceCommit:'a'.repeat(40),packageId:'CLEAN-ERP-20261022-'+'a'.repeat(12),nativeSourceCommit:'b'.repeat(40),
});
const native=(r=fixture())=>({ok:true,environment:'CLEAN_SYNTHETIC_TEST',environmentId:CLEAN_ENVIRONMENT_ID,database:CLEAN_DATABASE,databaseName:CLEAN_DATABASE,serverName:'Semih\\MELISADEV',synthetic:true,actualT1:false,externalOperations:false,mode:'erp',port:4196,purpose:'crm-order-draft-only',automaticJobs:false,stockEffect:false,ledgerEffect:false,reservationEffect:false,sysadmin:0,databaseControl:0,originalDatabaseAccess:0,liveDatabaseAccess:0,sourceCommit:r.nativeSourceCommit,packageId:'CLEAN-ERP-20261022-'+r.nativeSourceCommit.slice(0,12)});
const crm=()=>({success:true,data:{status:'ok',appName:'melisa-whatsapp-crm-api',authMode:'crm-local',provider:'disabled-preparation',providerConnected:false,sendReady:false,bridgeReady:false,translationEnabled:false,sendEnabled:false},meta:{source:'whatsapp-crm-health'}});
const clock=()=>new Date('2026-10-23T01:00:00Z');

test('clean settings renders the installed API and independently pinned native without legacy status files',async()=>{
 const urls=[];
 const service=createCleanWorkSystemService({runtime:async()=>fixture(),clock,health:async(url,check)=>{urls.push(url);return check(url.endsWith('/test-health')?native():crm());}});
 const summary=validateSystemSummary(await service.summary(actor()));
 assert.equal(summary.package.sourceCommit,'a'.repeat(40));
 assert.deepEqual(summary.currentUser,{id:10018,displayName:'Semih',roleCodes:['admin'],permissionsSummary:['Ürün görüntüleme','Ayarlar yönetimi']});
 assert.deepEqual(urls,['http://127.0.0.1:4196/test-health','http://127.0.0.1:62801/health']);
 assert(summary.services.every(s=>s.status==='ready'&&s.checkedAt===clock().toISOString()));
 assert.equal(summary.backup.status,'unknown');assert.equal(summary.restore.status,'unknown');
 assert.equal(summary.backup.checksumVerified,null);assert.equal(summary.backup.lastSuccessAt,null);
 assert.equal(summary.autostart.erp.status,'unknown');assert.equal(summary.autostart.crm.status,'unknown');
 assert.equal(summary.terminal.physicalAcceptance,'pending');assert.equal(summary.terminal.lastAccessAt,null);
 assert.equal(Object.hasOwn(summary,'recoveryEvidence'),false);
 assert(!JSON.stringify(summary).includes(CLEAN_LOGIN));assert(!JSON.stringify(summary).includes('C:/'));
});

test('current permission is required before any identity or network read; no role-name override',async()=>{
 let reads=0;const service=createCleanWorkSystemService({runtime:async()=>{reads++;return fixture();},health:async()=>{reads++;return true;}});
 for(const user of [null,{}, {...actor(),permissions:[]},{...actor(),permissions:['audit.view']},{...actor(),id:0},{...actor(),id:1.5},{...actor(),role:null},{...actor(),isAdmin:true},{...actor(),testAdminSession:true}]){
  await assert.rejects(()=>service.summary(user),e=>e.statusCode===403&&e.code==='SYSTEM_PERMISSION_DENIED');
 }
 assert.equal(reads,0);
});

test('registered clean identity, minimum SQL privilege, endpoint and exact package are checked on every read',async()=>{
 for(const change of [r=>r.context=null,r=>r.context.environment='LIVE',r=>r.context.environmentId='wrong',r=>r.context.database='old',r=>r.context.synthetic=false,r=>r.context.actualT1=true,r=>r.context.externalOperations=true,r=>r.port=4196,r=>r.sourceCommit='HEAD',r=>r.packageId='old',r=>r.nativeSourceCommit='',r=>r.identity.databaseName='old',r=>r.identity.loginName='sa',r=>r.identity.databaseUser='dbo',r=>r.identity.sysadmin=1,r=>r.identity.databaseControl=1,r=>r.identity.originalDatabaseAccess=1,r=>r.identity.liveDatabaseAccess=1,r=>r.identity.environmentId='wrong']){
  const r=fixture();change(r);let probes=0;
  const service=createCleanWorkSystemService({runtime:async()=>r,health:async()=>{probes++;return true;}});
  await assert.rejects(()=>service.summary(actor()),e=>e.statusCode===503);assert.equal(probes,0);
 }
 let current=fixture();const service=createCleanWorkSystemService({runtime:async()=>current,health:async()=>false});
 await service.summary(actor());current.identity.databaseControl=1;
 await assert.rejects(()=>service.summary(actor()),e=>e.statusCode===503);
});

test('native drift cannot become ready or prevent independent CRM status',async()=>{
 for(const delta of [{sourceCommit:'a'.repeat(40)},{packageId:'wrong'},{databaseName:'old'},{database:'old'},{environmentId:'wrong'},{port:4146},{mode:'native'},{purpose:'wrong'},{synthetic:false},{actualT1:true},{externalOperations:true},{sysadmin:1},{databaseControl:1},{originalDatabaseAccess:1},{liveDatabaseAccess:1},{stockEffect:true},{ledgerEffect:true},{automaticJobs:true},{reservationEffect:true}]){
  const service=createCleanWorkSystemService({runtime:async()=>fixture(),health:async(url,check)=>check(url.endsWith('/test-health')?{...native(),...delta}:crm())});
  const summary=await service.summary(actor());
  assert.equal(summary.services.find(s=>s.id==='native').status,'unavailable');
  assert.equal(summary.services.find(s=>s.id==='crm').status,'ready');
 }
});

test('a generic or externally enabled CRM health is not reported ready',async()=>{
 for(const value of [{success:true},{...crm(),meta:{source:'other'}},...['appName','authMode','provider','status'].map(k=>({...crm(),data:{...crm().data,[k]:'other'}})),...['providerConnected','sendReady','bridgeReady','translationEnabled','sendEnabled'].map(k=>({...crm(),data:{...crm().data,[k]:true}}))]){
  const service=createCleanWorkSystemService({runtime:async()=>fixture(),health:async(url,check)=>check(url.endsWith('/test-health')?native():value)});
  const summary=await service.summary(actor());
  assert.equal(summary.services.find(s=>s.id==='crm').status,'unavailable');
  assert.equal(summary.services.find(s=>s.id==='native').status,'ready');
 }
});

test('unavailable health keeps backup, autostart and physical acceptance unknown',async()=>{
 const summary=validateSystemSummary(await createCleanWorkSystemService({runtime:async()=>fixture(),health:async()=>false}).summary(actor()));
 assert.deepEqual(summary.services.map(s=>s.status),['ready','ready','unavailable','unavailable']);
 assert.equal(summary.restore.status,'unknown');assert.equal(summary.terminal.physicalAcceptance,'pending');
});
