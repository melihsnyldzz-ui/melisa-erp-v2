import test from 'node:test';
import assert from 'node:assert/strict';
import {businessInboundFixture} from './businessInbound.test-fixture.mjs';
import {fixtureContext,fixtureIdentity,fixtureProof} from './isolatedOperationCopyContext.test.mjs';
import {isolatedCopyHash,isolatedCopyJSON,validateIsolatedOperationCopyContext,getBusinessDailyHomeReadRevisions} from './isolatedOperationCopyContext.mjs';
import {selectBusinessDailyProfile} from '../../../../scripts/canonical/shared-business-daily-revision-sql.mjs';
import {configureBusinessDailyRevision,BUSINESS_DAILY_REVISION_PROOF_SQL} from './businessDailyRevisionBootstrap.mjs';
import {businessDailyProfitReadSQL} from './businessDailyProfitRevision.mjs';
import {businessDailyNativeCheckReadSQL,BUSINESS_DAILY_NATIVE_CHECK_BEFORE} from './businessDailyNativeCheck.mjs';
import {businessReadinessQueryPlanReadSQL} from './businessReadinessQueryPlanRevision.mjs';
import {createIsolatedOperationCopyStore,ISOLATED_COPY_FINITE_FK_SQL} from './isolatedOperationCopyStoreFactory.mjs';
import {isIsolatedOperationCopyMutation} from './isolatedOperationCopyScope.mjs';
import {BUSINESS_DAILY_HOME_CONTEXT_HASH,BUSINESS_DAILY_HOME_READ_PROOF_SQL,verifyBusinessDailyHomeReadProof} from './businessDailyHomeReadProof.mjs';

// Offline metadata and runtime witnesses; never a SQL connection or company data.
const sealed=body=>({...body,revisionHash:isolatedCopyHash(body)});
function fixture(mutateRaw=()=>{}){
 const raw=structuredClone(businessInboundFixture().copy);
 for(const [kind,count,start] of [['customers',26,100],['suppliers',11,200]])raw[kind]=Array.from({length:count},(_,i)=>({...raw[kind][0],id:String(start+i),partyId:String(start+2000+i),accountId:String(start+1000+i),currency:'TRY',sourceKey:`VEGA2026/${kind==='customers'?'F0102':'F0103'}TBLCARI/${start+i}`,sourceKnown:true,accountIdentityVerified:true,sourceAccountWitnessCount:1,openingHumanAccepted:false,sourceWitnessHash:'E'.repeat(64)}));
 raw.financeAccounts=[{...raw.financeAccounts[0],id:'20043',currency:'TRY',type:'cash',active:true,startingBalanceVerified:true,openingHumanAccepted:false,baselineBalanceExact4:'100.0000'}];
 raw.products=[{...raw.products[0],id:'444',sourceKey:'VEGA2026/F0102TBLSTOKLAR/444',stockCode:'OFFLINE-444',barcodes:['00444'],identityVerified:true,sourceKnown:true,supplierBindingKnown:true,supplierId:'200',purchaseCurrency:'TRY',purchaseInvoiceAccountId:'1200',purchasePriceExact8:'2.50000000',purchaseQuote:{verified:true},costExact4:'1.2500',stockExact3:'10.000',sourceWitnessHash:'E'.repeat(64),quotes:[{quoteId:'100',currency:'TRY',priceExact8:'3.00000000',type:'sale',mainUnit:true,verified:true}]}];
 mutateRaw(raw);const {sealHash,...body}=raw;raw.sealHash=isolatedCopyHash(body);const c=validateIsolatedOperationCopyContext(raw);
 const base=sealed({schemaVersion:'melisa-business-copy-ready-revision.v1',version:1,copyId:c.copyId,baseSealHash:c.sealHash,modules:[{name:c.sql.ready.name,beforeHash:c.sql.ready.hash,afterHash:'F'.repeat(64)}],immutableTriggerHash:'E'.repeat(64)});
 const performance=sealed({schemaVersion:'melisa-business-copy-ready-performance-revision.v1',version:2,copyId:c.copyId,baseSealHash:c.sealHash,baseReadyRevisionHash:base.revisionHash,modules:[{name:c.sql.ready.name,beforeHash:base.modules[0].afterHash,afterHash:'9'.repeat(64)}],immutableTriggerHash:'D'.repeat(64)});
 const residuals=[...c.customers.map(p=>({role:'customer',...p})),...c.suppliers.map(p=>({role:'supplier',...p}))].map((p,i)=>({role:p.role,id:p.id,accountId:p.accountId,currency:p.currency,residualExact8:i%2?'-0.00000001':'0.00000001',beforeHash:p.beforeHash,accountBeforeHash:p.accountBeforeHash,sourceWitnessHash:p.sourceWitnessHash}));
 const effects=sealed({schemaVersion:'melisa-business-copy-effects-performance-revision.v1',version:3,copyId:c.copyId,baseSealHash:c.sealHash,baseReadyRevisionHash:base.revisionHash,baseReadyPerformanceRevisionHash:performance.revisionHash,modules:[{name:c.sql.ready.name,beforeHash:performance.modules[0].afterHash,afterHash:'8'.repeat(64)},{name:c.sql.effects.name,beforeHash:c.sql.effects.hash,afterHash:'7'.repeat(64)}],baselineResiduals:residuals,baselineResidualsHash:isolatedCopyHash(residuals),immutableTriggerHash:'C'.repeat(64)});
 const names=['ready','context','begin','guard','effects'].map(k=>'dbo.usp_stage4_copy_'+k).concat(['context','begin','guard'].map(k=>'dbo.usp_business_daily_'+k));
 const selection={productIds:['444'],customerAccountId:'1100',supplierAccountId:'1200',financeAccountId:'20043',currency:'TRY'},daily=selectBusinessDailyProfile(c,selection);
 const modules=names.map((name,i)=>({name,beforeHash:i<5?effects.modules.find(m=>m.name===name)?.afterHash??Object.values(c.sql).find(m=>m.name===name)?.hash??'B'.repeat(64):null,afterHash:i===1?BUSINESS_DAILY_HOME_CONTEXT_HASH:String(i+1).repeat(64)}));
 const revision=sealed({schemaVersion:'melisa-business-copy-daily-revision.v1',version:4,copyId:c.copyId,baseSealHash:c.sealHash,baseEffectsRevisionHash:effects.revisionHash,modules,dailyScope:daily,dailyScopeHash:isolatedCopyHash(daily),immutableTriggerHash:'6'.repeat(64)});
 const current=name=>revision.modules.find(m=>m.name===name).afterHash;
 const historyRow=(r,m)=>({databaseName:c.target.database,copyId:c.copyId,version:r.version,baseSealHash:c.sealHash,manifestSealHash:c.sealHash,name:m.name,beforeHash:m.beforeHash,afterHash:m.afterHash,actualHash:current(m.name),baseManifestHash:c.sql[m.name===c.sql.ready.name?'ready':'effects'].hash,baseManifestRows:185,revisionHash:r.revisionHash,immutableTriggerHash:r.immutableTriggerHash,triggerDisabled:0});
 const proof=[ [historyRow(base,base.modules[0])], [{...historyRow(performance,performance.modules[0]),baseReadyRevisionHash:base.revisionHash}], effects.modules.map(m=>({...historyRow(effects,m),baseReadyRevisionHash:base.revisionHash,baseReadyPerformanceRevisionHash:performance.revisionHash,baselineResidualsHash:effects.baselineResidualsHash,baselineResidualsJSON:isolatedCopyJSON(residuals)})), revision.modules.map((m,i)=>({databaseName:c.target.database,copyId:c.copyId,version:4,baseSealHash:c.sealHash,baseEffectsRevisionHash:effects.revisionHash,manifestSealHash:c.sealHash,name:m.name,beforeHash:m.beforeHash,afterHash:m.afterHash,actualHash:m.afterHash,baseManifestHash:i<5?Object.values(c.sql).find(x=>x.name===m.name)?.hash??m.beforeHash:null,baseManifestRows:185,revisionHash:revision.revisionHash,dailyScopeHash:revision.dailyScopeHash,dailyProfileJSON:isolatedCopyJSON(daily),immutableTriggerHash:revision.immutableTriggerHash,triggerDisabled:0})) ];
 const nativeProof={recordsets:[[{databaseName:c.target.database,serverName:c.target.server,currentHash:BUSINESS_DAILY_NATIVE_CHECK_BEFORE,isDisabled:false,isNotTrusted:false,registryExists:false,triggerHash:null,triggerDisabled:1,helperExists:false}],[]]};
 const pool={request:()=>({query:async sql=>{if(sql===businessDailyNativeCheckReadSQL())return structuredClone(nativeProof);assert.equal(sql,BUSINESS_DAILY_REVISION_PROOF_SQL);return {recordsets:structuredClone(proof)};}})};
 return {c,base,performance,effects,revision,proof,pool};
}
function profitFixture(){
 const f=fixture(),names=['dbo.usp_business_daily_guard','dbo.usp_stage4_copy_ready','dbo.usp_business_daily_context'];
 const v5=sealed({schemaVersion:'melisa-business-daily-profit-revision.v1',version:5,copyId:f.c.copyId,baseSealHash:f.c.sealHash,baseDailyRevisionHash:f.revision.revisionHash,dailyScopeHash:f.revision.dailyScopeHash,modules:names.map((name,i)=>({name,beforeHash:f.revision.modules.find(m=>m.name===name).afterHash,afterHash:['A','B','C','D'][i].repeat(64)})),immutableTriggerHash:'E'.repeat(64)});
 const rows=v5.modules.map(m=>({copyId:f.c.copyId,name:m.name,revision:5,baseSealHash:f.c.sealHash,baseDailyRevisionHash:f.revision.revisionHash,dailyScopeHash:f.revision.dailyScopeHash,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:v5.revisionHash,actualHash:m.afterHash,immutableTriggerHash:v5.immutableTriggerHash,triggerDisabled:0}));
 for(const group of f.proof)for(const r of group){const m=v5.modules.find(m=>m.name===r.name);if(m)r.actualHash=m.afterHash;}
 const pool={request:()=>({query:async sql=>sql===businessDailyProfitReadSQL()?{recordset:structuredClone(rows)}:sql===businessDailyNativeCheckReadSQL()?f.pool.request().query(sql):{recordsets:structuredClone(f.proof)}})};
 return {...f,v5,rows,pool};
}
function queryPlanFixture(){
 const f=profitFixture(),parent=f.v5.modules.find(m=>m.name==='dbo.usp_stage4_copy_ready');
 const v6=sealed({schemaVersion:'melisa-readiness-query-plan-revision.v1',version:6,copyId:f.c.copyId,baseSealHash:f.c.sealHash,baseDailyRevisionHash:f.revision.revisionHash,baseProfitRevisionHash:f.v5.revisionHash,dailyScopeHash:f.revision.dailyScopeHash,modules:[{name:parent.name,beforeHash:parent.afterHash,afterHash:'D'.repeat(64)}],immutableTriggerHash:'F'.repeat(64)});
 for(const group of [...f.proof,f.rows])for(const r of group){if(r.name===parent.name)r.actualHash=v6.modules[0].afterHash;}
 const parentRows=p=>p.modules.map(m=>({copyId:p.copyId,version:p.version,baseSealHash:p.baseSealHash,dailyScopeHash:p.dailyScopeHash,name:m.name,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:p.revisionHash}));
 const queryProof={recordsets:[[{databaseName:f.c.target.database,serverName:f.c.target.server,registryExists:true,actualHash:v6.modules[0].afterHash,immutableTriggerHash:v6.immutableTriggerHash,triggerDisabled:0,baseManifestRows:185,manifestSealHash:f.c.sealHash}],[{copyId:f.c.copyId,version:6,baseSealHash:v6.baseSealHash,baseDailyRevisionHash:v6.baseDailyRevisionHash,baseProfitRevisionHash:v6.baseProfitRevisionHash,dailyScopeHash:v6.dailyScopeHash,name:parent.name,beforeHash:parent.afterHash,afterHash:v6.modules[0].afterHash,revisionHash:v6.revisionHash}],parentRows(f.revision),parentRows(f.v5)]};
 const pool={request:()=>({query:async sql=>sql===businessReadinessQueryPlanReadSQL()?structuredClone(queryProof):f.pool.request().query(sql)})};
 return {...f,v6,queryProof,pool};
}

const actor={id:'16',permissions:['goods.view','sales.create']};
const configure=f=>configureBusinessDailyRevision(f.c,f.base,f.performance,f.effects,f.revision,f.pool,f.v5,undefined,f.v6);
function homeProof(f){
 return {recordsets:[[{databaseName:f.c.target.database,serverName:f.c.target.server,transactionCount:1,transactionState:1,copyLockMode:'Shared',isolationLevel:4,baseManifestRows:'185',contextHash:BUSINESS_DAILY_HOME_CONTEXT_HASH,readyHash:f.v5.modules.find(m=>m.name===f.c.sql.ready.name).afterHash,dailyTriggerHash:f.revision.immutableTriggerHash,dailyTriggerDisabled:0,profitTriggerHash:f.v5.immutableTriggerHash,profitTriggerDisabled:0}],
  [{copyId:f.c.copyId,sealHash:f.c.sealHash,backupSHA:f.c.backupSHA,sealed:true,profileHash:isolatedCopyHash(f.c)}],
  f.revision.modules.map(m=>({copyId:f.c.copyId,version:4,baseSealHash:f.c.sealHash,baseEffectsRevisionHash:f.revision.baseEffectsRevisionHash,name:m.name,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:f.revision.revisionHash,dailyScopeHash:f.revision.dailyScopeHash,dailyProfileHash:f.revision.dailyScopeHash,actualHash:(f.v5.modules.find(p=>p.name===m.name)??m).afterHash})),
  f.v5.modules.map(m=>({copyId:f.c.copyId,version:5,baseSealHash:f.c.sealHash,baseDailyRevisionHash:f.revision.revisionHash,name:m.name,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:f.v5.revisionHash,dailyScopeHash:f.revision.dailyScopeHash,actualHash:m.afterHash}))]};
}
const readOptions={domain:'inbound',write:false,automatic:null};
test('only authoritative DB02 v4/v5 registration admits the reviewed raw context definition',async()=>{
 const f=profitFixture(),proof=homeProof(f);let queries=0;
 const request={query:async sql=>{assert.equal(sql,BUSINESS_DAILY_HOME_READ_PROOF_SQL);queries++;return structuredClone(proof);}};
 assert.equal(getBusinessDailyHomeReadRevisions(f.c),null);
 assert.equal(await verifyBusinessDailyHomeReadProof(f.c,request,readOptions),false);assert.equal(queries,0);
 await configure(f);assert(Object.isFrozen(getBusinessDailyHomeReadRevisions(f.c)));
 assert.equal(await verifyBusinessDailyHomeReadProof(f.c,request,readOptions),true);assert.equal(queries,1);
 assert.throws(()=>getBusinessDailyHomeReadRevisions(structuredClone(f.c)),{code:'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED'});
 await assert.rejects(verifyBusinessDailyHomeReadProof(structuredClone(f.c),request,readOptions),{code:'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED'});
 for(const options of [{...readOptions,write:true},{...readOptions,automatic:{}},{domain:'inbound',skipReady:true}])await assert.rejects(verifyBusinessDailyHomeReadProof(f.c,request,options),{code:'BUSINESS_HOME_READ_ONLY'});
 for(const domain of ['trade','daily','payment'])assert.equal(await verifyBusinessDailyHomeReadProof(f.c,request,{...readOptions,domain}),false);
 assert.equal(queries,1);
});

test('unknown context semantics, absent v5, original copy and registered v6 use the existing route',async()=>{
 const legacy=validateIsolatedOperationCopyContext(fixtureContext()),noProfit=fixture(),v6=queryPlanFixture(),unknown=profitFixture();
 const altered='F'.repeat(64);unknown.revision.modules[1].afterHash=altered;
 const {revisionHash,...body}=unknown.revision;unknown.revision.revisionHash=isolatedCopyHash(body);
 unknown.v5.baseDailyRevisionHash=unknown.revision.revisionHash;const {revisionHash:v5Hash,...v5Body}=unknown.v5;unknown.v5.revisionHash=isolatedCopyHash(v5Body);
 for(const rows of unknown.proof){for(const row of rows){if(row.name===unknown.c.sql.context.name)row.actualHash=altered;if(row.version===4){row.afterHash=unknown.revision.modules.find(m=>m.name===row.name).afterHash;row.revisionHash=unknown.revision.revisionHash;}}}
 for(const row of unknown.rows){row.baseDailyRevisionHash=unknown.revision.revisionHash;row.revisionHash=unknown.v5.revisionHash;}
 await configureBusinessDailyRevision(noProfit.c,noProfit.base,noProfit.performance,noProfit.effects,noProfit.revision,noProfit.pool);
 await configure(v6);await configure(unknown);
 const noQuery={query:()=>{throw Error('fallback must not query the HOME proof');}};
 for(const c of [legacy,noProfit.c,v6.c,unknown.c])assert.equal(await verifyBusinessDailyHomeReadProof(c,noQuery,readOptions),false);
});

test('fresh proof preserves v4 historical hashes and requires v5 actual pins without raw hash normalization',async()=>{
 const f=profitFixture();await configure(f);const proof=homeProof(f);
 for(const set of [proof.recordsets[1],proof.recordsets[2],proof.recordsets[3]])for(const row of set)row.copyId=row.copyId.toUpperCase();
 assert.notEqual(proof.recordsets[2][0].afterHash,proof.recordsets[2][0].actualHash);
 assert.equal(await verifyBusinessDailyHomeReadProof(f.c,{query:async()=>proof},readOptions),true);
 for(const mutate of [p=>p.recordsets[0][0].readyHash=f.revision.modules[0].afterHash,p=>p.recordsets[2][0].actualHash=f.revision.modules[0].afterHash,p=>p.recordsets[2][1].actualHash='ALTER '+BUSINESS_DAILY_HOME_CONTEXT_HASH]){
  const bad=homeProof(f);mutate(bad);await assert.rejects(verifyBusinessDailyHomeReadProof(f.c,{query:async()=>bad},readOptions));
 }
});

test('every metadata, profile and registry field fails closed on null or drift before context execution',async()=>{
 const f=profitFixture();await configure(f);const template=homeProof(f);
 for(let i=0;i<template.recordsets.length;i++)for(let j=0;j<template.recordsets[i].length;j++)for(const key of Object.keys(template.recordsets[i][j])){
  if(template.recordsets[i][j][key]===null)continue;
  for(const value of [null,'FOREIGN']){const bad=homeProof(f);bad.recordsets[i][j][key]=value;await assert.rejects(verifyBusinessDailyHomeReadProof(f.c,{query:async()=>bad},readOptions),`${i}/${j}/${key}`);}
 }
 for(const mutate of [p=>p.recordsets.pop(),p=>p.recordsets[0].push({...p.recordsets[0][0]}),p=>p.recordsets[1].push({...p.recordsets[1][0]}),p=>p.recordsets[2].pop(),p=>p.recordsets[2].push({...p.recordsets[2][0]}),p=>p.recordsets[2][1]={...p.recordsets[2][0]},p=>p.recordsets[3].push({...p.recordsets[3][0]}),p=>p.recordsets[3][0].extra=true,p=>p.recordsets[0][0].copyLockMode='Exclusive',p=>p.recordsets[0][0].transactionState=-1,p=>p.recordsets[0][0].isolationLevel=2,p=>p.recordsets[0][0].dailyTriggerDisabled=1,p=>p.recordsets[0][0].profitTriggerDisabled=1]){
  const bad=homeProof(f);mutate(bad);await assert.rejects(verifyBusinessDailyHomeReadProof(f.c,{query:async()=>bad},readOptions));
 }
});

function runtimeFixture(f,{domain='inbound'}={}){
 const events=[],state={metadata:homeProof(f),deny:false,badProof:false,badFK:false,wrongIdentity:false,readyFailure:false,lockFailure:false,commits:0,rollbacks:0};
 const readProof={...fixtureProof(f.c),definitionHashes:Object.fromEntries(Object.entries(f.c.sql).map(([key,m])=>[key,(f.v6?.modules.find(p=>p.name===m.name)??f.v5.modules.find(p=>p.name===m.name)??f.revision.modules.find(p=>p.name===m.name)).afterHash]))};
 class Transaction{async begin(level){assert.equal(level,'SERIALIZABLE');events.push('begin');this.active=true;}async commit(){events.push('commit');state.commits++;this.active=false;}async rollback(){events.push('rollback');state.rollbacks++;this.active=false;}}
 class Request{
  constructor(tx){assert(tx instanceof Transaction);assert(tx.active);this.tx=tx;this.params={};}
  input(key,type,value){this.params[key]=value;return this;}
  async query(sql){
   assert(this.tx.active);
   if(sql.startsWith('SELECT DB_NAME() db,')){events.push('identity');return {recordset:[{...fixtureIdentity(f.c),...(state.wrongIdentity?{db:'FOREIGN'}:{})}]};}
   if(sql.includes('sp_getapplock')){events.push(sql.includes("N'Shared'")?'Shared':'Exclusive');if(state.lockFailure)throw Object.assign(Error('busy'),{number:51401});return {};}
   if(sql===businessDailyNativeCheckReadSQL()){events.push('native-check');return f.pool.request().query(sql);}
   if(sql===businessReadinessQueryPlanReadSQL()){events.push('v6-proof');return structuredClone(f.queryProof);}
   if(sql===BUSINESS_DAILY_HOME_READ_PROOF_SQL){assert.equal(this.params.copy_id,f.c.copyId);events.push('home-proof');return structuredClone(state.metadata);}
   if(sql===ISOLATED_COPY_FINITE_FK_SQL){events.push('FK');return {recordset:[['FK__test_good__produ__5654B625','test_goods_batch_lines'],['FK__test_purc__produ__69678A99','test_purchase_batch_intent_lines']].map(([constraintName,parentTable])=>({constraintName,parentSchema:'dbo',parentTable,parentColumn:'product_id',referencedSchema:'dbo',referencedTable:state.badFK?'FOREIGN':'products',referencedColumn:'id',ordinal:1,columnCount:1,isDisabled:false,isNotTrusted:false,deleteAction:'NO_ACTION',updateAction:'NO_ACTION'}))};}
   throw Error('Unexpected SQL: '+sql);
  }
  async execute(name){
   assert(this.tx.active);assert.equal(this.params.copy_id,f.c.copyId);
   if(name===f.c.sql.ready.name){events.push('outer-ready');return {};}
   assert.equal(name,f.c.sql.context.name);assert.equal(this.params.domain,domain);assert.equal(String(this.params.actor_id),actor.id);events.push('context','inner-ready');
   // This simulates the already reviewed native context calling full ready.
   // Actual native preservation and timings are proved separately by root.
   if(state.readyFailure)throw Object.assign(Error('protected source changed'),{code:'BUSINESS_PRODUCT_WITNESS_DRIFT'});
   return {recordset:[{proof_json:JSON.stringify({...readProof,...(state.badProof?{valid:false}:{})}),actor_json:JSON.stringify({id:actor.id,role:'isolated_test_ilker',active:true,permissions:state.deny?[]:actor.permissions}),context_json:JSON.stringify({meta:{date:f.c.date,operationOrigin:f.c.operationOrigin,copyId:f.c.copyId,sealHash:f.c.sealHash},scope:{synthetic:false,operationOrigin:f.c.operationOrigin}})}]};
  }
 }
 const runtime={copyContext:f.c,pool:{},sql:{Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:'SERIALIZABLE'},UniqueIdentifier:'uuid',BigInt:'bigint',NVarChar:n=>'nvarchar'+n}},buildDomain=async({context,nativeContext,write,reloadContext})=>{events.push('build');return {context,reloadContext,write,mutationAllowed:()=>isIsolatedOperationCopyMutation({database:f.c.target.database,server:f.c.target.server,user:f.c.target.login,readOnly:false},nativeContext.transaction)};};
 const store=createIsolatedOperationCopyStore({getRuntime:async()=>runtime,buildDomain,domain,readPermission:'goods.view',skipReady:true});
 return {events,state,store};
}

test('HOME executes one full inner ready with same-transaction metadata, FK, actor, scope and end identity',async()=>{
 const f=profitFixture();await configure(f);const r=runtimeFixture(f);
 const result=await r.store.readHome({...actor,skipReady:true},c=>{r.events.push('summary');assert.equal(c.write,false);assert.equal(c.mutationAllowed(),false);return 'summary';});
 assert.equal(result,'summary');assert.deepEqual(r.events,['begin','identity','Shared','native-check','home-proof','FK','context','inner-ready','build','summary','identity','commit']);
 await r.store.readHome(actor,()=>null);assert.equal(r.events.filter(e=>e==='home-proof').length,2);assert.equal(r.events.filter(e=>e==='inner-ready').length,2);assert.equal(r.events.includes('outer-ready'),false);
});

test('general read/context/mutate ignore caller flags and retain their outer ready calls',async()=>{
 const f=profitFixture();await configure(f);const r=runtimeFixture(f);
 await r.store.read({...actor,skipReady:true},()=>null);await r.store.context(actor);await r.store.mutate(actor,c=>{assert.equal(c.write,true);assert.equal(c.mutationAllowed(),true);});
 assert.equal(r.events.filter(e=>e==='outer-ready').length,3);assert.equal(r.events.filter(e=>e==='inner-ready').length,3);assert.equal(r.events.includes('home-proof'),false);assert.equal(r.events.filter(e=>e==='Exclusive').length,1);
});

test('HOME cannot journal a writer intent and reloading context refreshes its proof without a cache',async()=>{
 const f=profitFixture();await configure(f);const r=runtimeFixture(f);
 await assert.rejects(r.store.readHome(actor,c=>c.journal('sale_draft',{},()=>null)),{code:'ISOLATED_COPY_WRITE_TRANSACTION'});assert.equal(r.state.rollbacks,1);
 await r.store.readHome(actor,c=>c.reloadContext());assert.equal(r.events.filter(e=>e==='home-proof').length,3);assert.equal(r.events.filter(e=>e==='inner-ready').length,3);
});

test('eligible HOME metadata drift rejects without falling back or executing context',async()=>{
 const f=profitFixture();await configure(f);const r=runtimeFixture(f);await r.store.readHome(actor,()=>null);
 r.state.metadata.recordsets[0][0].contextHash='F'.repeat(64);
 await assert.rejects(r.store.readHome(actor,()=>assert.fail('handler must not run')),{code:'BUSINESS_HOME_READ_CURRENT'});
 assert.equal(r.events.filter(e=>e==='context').length,1);assert.equal(r.events.includes('outer-ready'),false);assert.equal(r.state.commits,1);assert.equal(r.state.rollbacks,1);
});

test('HOME preserves full ready failure, FK rejection, current permissions, readProof, identity and lock rejection',async()=>{
 const f=profitFixture();await configure(f);
 for(const [mode,code] of [['readyFailure','BUSINESS_PRODUCT_WITNESS_DRIFT'],['badFK','ISOLATED_COPY_FINITE_FK_UNVERIFIED'],['deny','ISOLATED_COPY_FORBIDDEN'],['badProof','ISOLATED_COPY_READ_PROOF'],['wrongIdentity','ISOLATED_COPY_DB_IDENTITY'],['lockFailure','ISOLATED_COPY_BUSY']]){
  const r=runtimeFixture(f);r.state[mode]=true;
  await assert.rejects(r.store.readHome(actor,()=>assert.fail('summary must not run')),{code});assert.equal(r.state.commits,0);assert.equal(r.state.rollbacks,1);assert.equal(r.events.includes('build'),false);assert.equal(r.events.includes('outer-ready'),false);
 }
});

test('registered v6 HOME falls back and keeps its existing fresh v6 proof and two ready calls',async()=>{
 const f=queryPlanFixture();await configure(f);const r=runtimeFixture(f);await r.store.readHome(actor,()=>null);
 assert.equal(r.events.includes('home-proof'),false);assert.equal(r.events.filter(e=>e==='v6-proof').length,1);assert.equal(r.events.filter(e=>e==='outer-ready').length,1);assert.equal(r.events.filter(e=>e==='inner-ready').length,1);
});

test('HOME metadata SQL is exact SELECT-only, returns all registry rows and preserves raw stored hashes',()=>{
 assert.match(BUSINESS_DAILY_HOME_READ_PROOF_SQL,/OBJECT_ID\(N'dbo\.usp_stage4_copy_context',N'P'\)/);assert.match(BUSINESS_DAILY_HOME_READ_PROOF_SQL,/HASHBYTES\('SHA2_256',OBJECT_DEFINITION/);
 assert.match(BUSINESS_DAILY_HOME_READ_PROOF_SQL,/APPLOCK_MODE\(N'public'/);assert.match(BUSINESS_DAILY_HOME_READ_PROOF_SQL,/transaction_isolation_level/);
 assert.doesNotMatch(BUSINESS_DAILY_HOME_READ_PROOF_SQL,/\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|EXEC|MERGE)\b/i);
 assert.doesNotMatch(BUSINESS_DAILY_HOME_READ_PROOF_SQL,/REPLACE\(|WHERE\s+copy_id|TOP\(/i);assert.equal((BUSINESS_DAILY_HOME_READ_PROOF_SQL.match(/WITH\(HOLDLOCK\)/g)??[]).length,4);
});
