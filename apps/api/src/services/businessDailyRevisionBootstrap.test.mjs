import test from 'node:test';
import assert from 'node:assert/strict';
import {businessInboundFixture} from './businessInbound.test-fixture.mjs';
import {fixtureProof,fixtureIdentity} from './isolatedOperationCopyContext.test.mjs';
import {isolatedCopyHash,isolatedCopyJSON,validateIsolatedOperationCopyContext,assertIsolatedCopyReadProof,assertIsolatedCopyActor,getBusinessDailySelection,getBusinessDailyScopeHash,getBusinessReadinessQueryPlanRevision,registerBusinessReadinessQueryPlanRevision} from './isolatedOperationCopyContext.mjs';
import {isolatedCopyRequestBody,createIsolatedOperationCopyStore,ISOLATED_COPY_FINITE_FK_SQL} from './isolatedOperationCopyStore.mjs';
import {selectBusinessDailyProfile} from '../../../../scripts/canonical/shared-business-daily-revision-sql.mjs';
import {configureBusinessDailyRevision,validateBusinessDailyRevision,BUSINESS_DAILY_REVISION_PROOF_SQL} from './businessDailyRevisionBootstrap.mjs';
import {validateSharedCopyBootstrap,publicSharedCopyScope} from './sharedCopyBootstrap.mjs';
import {businessDailyProfitReadSQL} from './businessDailyProfitRevision.mjs';
import {businessDailyNativeCheckReadSQL,BUSINESS_DAILY_NATIVE_CHECK_BEFORE} from './businessDailyNativeCheck.mjs';
import {validateBusinessReadinessQueryPlanRevision,businessReadinessQueryPlanReadSQL,overlayBusinessReadinessQueryPlanHistory,verifyBusinessReadinessQueryPlan} from './businessReadinessQueryPlanRevision.mjs';

// Anonymous offline fixtures. These account/price values are invented test
// witnesses, not exported company data and not a real SQL installation.
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
 const modules=names.map((name,i)=>({name,beforeHash:i<5?effects.modules.find(m=>m.name===name)?.afterHash??Object.values(c.sql).find(m=>m.name===name)?.hash??'B'.repeat(64):null,afterHash:String(i+1).repeat(64)}));
 const revision=sealed({schemaVersion:'melisa-business-copy-daily-revision.v1',version:4,copyId:c.copyId,baseSealHash:c.sealHash,baseEffectsRevisionHash:effects.revisionHash,modules,dailyScope:daily,dailyScopeHash:isolatedCopyHash(daily),immutableTriggerHash:'6'.repeat(64)});
 const current=name=>revision.modules.find(m=>m.name===name).afterHash;
 const historyRow=(r,m)=>({databaseName:c.target.database,copyId:c.copyId,version:r.version,baseSealHash:c.sealHash,manifestSealHash:c.sealHash,name:m.name,beforeHash:m.beforeHash,afterHash:m.afterHash,actualHash:current(m.name),baseManifestHash:c.sql[m.name===c.sql.ready.name?'ready':'effects'].hash,baseManifestRows:185,revisionHash:r.revisionHash,immutableTriggerHash:r.immutableTriggerHash,triggerDisabled:0});
 const proof=[ [historyRow(base,base.modules[0])], [{...historyRow(performance,performance.modules[0]),baseReadyRevisionHash:base.revisionHash}], effects.modules.map(m=>({...historyRow(effects,m),baseReadyRevisionHash:base.revisionHash,baseReadyPerformanceRevisionHash:performance.revisionHash,baselineResidualsHash:effects.baselineResidualsHash,baselineResidualsJSON:isolatedCopyJSON(residuals)})), revision.modules.map((m,i)=>({databaseName:c.target.database,copyId:c.copyId,version:4,baseSealHash:c.sealHash,baseEffectsRevisionHash:effects.revisionHash,manifestSealHash:c.sealHash,name:m.name,beforeHash:m.beforeHash,afterHash:m.afterHash,actualHash:m.afterHash,baseManifestHash:i<5?Object.values(c.sql).find(x=>x.name===m.name)?.hash??m.beforeHash:null,baseManifestRows:185,revisionHash:revision.revisionHash,dailyScopeHash:revision.dailyScopeHash,dailyProfileJSON:isolatedCopyJSON(daily),immutableTriggerHash:revision.immutableTriggerHash,triggerDisabled:0})) ];
 const nativeProof={recordsets:[[{databaseName:c.target.database,serverName:c.target.server,currentHash:BUSINESS_DAILY_NATIVE_CHECK_BEFORE,isDisabled:false,isNotTrusted:false,registryExists:false,triggerHash:null,triggerDisabled:1,helperExists:false}],[]]};
 const pool={request:()=>({query:async sql=>{if(sql===businessDailyNativeCheckReadSQL())return structuredClone(nativeProof);assert.equal(sql,BUSINESS_DAILY_REVISION_PROOF_SQL);return {recordsets:structuredClone(proof)};}})};
 return {c,base,performance,effects,revision,proof,pool};
}
const configure=f=>configureBusinessDailyRevision(f.c,f.base,f.performance,f.effects,f.revision,f.pool);
const resealRevision=f=>{f.revision.dailyScopeHash=isolatedCopyHash(f.revision.dailyScope);const {revisionHash,...body}=f.revision;f.revision.revisionHash=isolatedCopyHash(body);};

test('web daily selection is published only from a fully validated finite config and excludes private witnesses',()=>{
 const f=fixture(),config={copyContext:f.c,host:'127.0.0.1',lanHost:'192.168.1.46',erpPort:4184,nativePort:4186,webPort:5234,database:f.c.target.database,server:f.c.target.server,sqlUser:'melisa_shared_test_ro_20261009_02',salesSqlUser:f.c.target.login,jwtAccessSecret:'s'.repeat(48),jwtRefreshSecret:'t'.repeat(48),businessReadyRevision:f.base,businessReadyPerformanceRevision:f.performance,businessEffectsPerformanceRevision:f.effects,businessDailyRevision:f.revision};
 const {context}=validateSharedCopyBootstrap(config),scope=publicSharedCopyScope(context);
 assert.deepEqual(scope.businessDaily,{scopeHash:f.revision.dailyScopeHash,selection:f.revision.dailyScope.selection});
 assert.equal(publicSharedCopyScope(f.c).businessDaily,undefined);
 assert.equal(JSON.stringify(scope.businessDaily).includes('costExact4'),false);
 scope.businessDaily.selection.productIds.push('999');assert.deepEqual(publicSharedCopyScope(context).businessDaily.selection.productIds,['444']);
 const bad=structuredClone(config);bad.businessDailyRevision.dailyScope.selection.customerAccountId='999';assert.throws(()=>validateSharedCopyBootstrap(bad));
});

test('v4 binds eight current modules to v1/v2/v3 history and preserves 37 exact residual witnesses',async()=>{
 const f=fixture();assert.equal(f.effects.baselineResiduals.length,37);assert.equal(f.effects.baselineResiduals.filter(r=>r.role==='customer').length,26);
 validateBusinessDailyRevision(f.c,f.base,f.performance,f.effects,f.revision);
 const current={...fixtureProof(f.c),definitionHashes:Object.fromEntries(Object.entries(f.c.sql).map(([key,m])=>[key,f.revision.modules.find(p=>p.name===m.name).afterHash]))};
 assert.throws(()=>assertIsolatedCopyReadProof(f.c,current));await configure(f);assertIsolatedCopyReadProof(f.c,current);assert.throws(()=>assertIsolatedCopyReadProof(f.c,fixtureProof(f.c)));
 assert.deepEqual(getBusinessDailySelection(f.c),f.revision.dailyScope.selection);assert.equal(getBusinessDailyScopeHash(f.c),f.revision.dailyScopeHash);assert(Object.isFrozen(getBusinessDailySelection(f.c)));
 assert.equal(f.revision.dailyScope.financeAccounts[0].openingOrigin,'UNKNOWN');assert.equal(f.revision.dailyScope.realFinancialOpeningAuthorized,false);
});
test('every non-null daily registry field rejects null, with exact row and predecessor proof',async()=>{
 const template=fixture();for(let i=0;i<8;i++)for(const key of Object.keys(template.proof[3][i])){
  if(template.proof[3][i][key]===null)continue;const f=fixture();f.proof[3][i][key]=null;await assert.rejects(configure(f),`${i}:${key}`);
 }
});
test('foreign, duplicate, extra and truncated daily/history registry rows fail closed',async()=>{
 const mutations=[p=>p[3][0].databaseName='OTHER_DATABASE',p=>p[3][0].extra=true,p=>p[3][1]={...p[3][0]},p=>p[3].pop(),p=>p[3].push({...p[3][0]}),p=>p.pop(),p=>p[3][3].baseManifestHash='F'.repeat(64),p=>p[3][5].baseManifestHash='F'.repeat(64),p=>p[3][5].beforeHash='F'.repeat(64),p=>p[0][0].actualHash='F'.repeat(64),p=>p[1][0].beforeHash='A'.repeat(64),p=>p[2][1].baselineResidualsJSON='[]',p=>p[2][0].triggerDisabled=1];
 for(const mutate of mutations){const f=fixture();mutate(f.proof);await assert.rejects(configure(f));}
});
test('resealed scope cannot invent identities, currency, real opening or a second account',()=>{
 const mutations=[d=>d.selection.customerAccountId='999',d=>d.selection.currency='LL',d=>d.customers[0].accountId='999',d=>d.products[0].stockCode='CHANGED',d=>d.realFinancialOpeningAuthorized=true,d=>d.actualT1=true,d=>d.openingHumanAccepted=true,d=>d.financeAccounts[0].openingOrigin='VERIFIED',d=>d.financeAccounts[0].openingVerified=true,d=>d.financeAccounts.push({...d.financeAccounts[0],id:'999'})];
 for(const mutate of mutations){const f=fixture();mutate(f.revision.dailyScope);resealRevision(f);assert.throws(()=>validateBusinessDailyRevision(f.c,f.base,f.performance,f.effects,f.revision));}
 for(const mutate of [r=>r.customers[0].sourceKnown=false,r=>r.suppliers[0].sourceKnown=false,r=>r.suppliers[0].currency='LL',r=>r.suppliers[0].excludedLL=true,r=>r.products[0].quarantined=true,r=>r.products[0].purchaseQuote.verified=false])assert.throws(()=>fixture(mutate));
});
test('server object identity and reserved daily hash prevent serialized or client scope spoofing',async()=>{
 const f=fixture();await configure(f);assert.throws(()=>getBusinessDailySelection(structuredClone(f.c)),{code:'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED'});
 const payload={requestId:'9c0075ed-7f4b-42f8-b056-f27b8369ad9c',customerId:'100',currency:'TRY'};
 const body=isolatedCopyRequestBody(f.c,{id:'16'},'sale_draft',payload);assert.equal(JSON.parse(body.json).businessDailyScopeHash,f.revision.dailyScopeHash);
 assert.throws(()=>isolatedCopyRequestBody(f.c,{id:'16'},'sale_draft',{...payload,businessDailyScopeHash:'F'.repeat(64)}),{code:'ISOLATED_COPY_CLIENT_PROFILE'});
 assert.throws(()=>isolatedCopyRequestBody(structuredClone(f.c),{id:'16'},'sale_draft',payload),{code:'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED'});
 const changed=isolatedCopyRequestBody(f.c,{id:'16'},'sale_draft',{...payload,customerId:'101'});assert.notEqual(changed.hash,body.hash);assert.equal(JSON.parse(changed.json).businessDailyScopeHash,f.revision.dailyScopeHash);
});

function profitFixture(){
 const f=fixture(),names=['dbo.usp_business_daily_guard','dbo.usp_stage4_copy_ready','dbo.usp_business_daily_context'];
 const v5=sealed({schemaVersion:'melisa-business-daily-profit-revision.v1',version:5,copyId:f.c.copyId,baseSealHash:f.c.sealHash,baseDailyRevisionHash:f.revision.revisionHash,dailyScopeHash:f.revision.dailyScopeHash,modules:names.map((name,i)=>({name,beforeHash:f.revision.modules.find(m=>m.name===name).afterHash,afterHash:['A','B','C','D'][i].repeat(64)})),immutableTriggerHash:'E'.repeat(64)});
 const rows=v5.modules.map(m=>({copyId:f.c.copyId,name:m.name,revision:5,baseSealHash:f.c.sealHash,baseDailyRevisionHash:f.revision.revisionHash,dailyScopeHash:f.revision.dailyScopeHash,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:v5.revisionHash,actualHash:m.afterHash,immutableTriggerHash:v5.immutableTriggerHash,triggerDisabled:0}));
 for(const group of f.proof)for(const r of group){const m=v5.modules.find(m=>m.name===r.name);if(m)r.actualHash=m.afterHash;}
 const pool={request:()=>({query:async sql=>sql===businessDailyProfitReadSQL()?{recordset:structuredClone(rows)}:sql===businessDailyNativeCheckReadSQL()?f.pool.request().query(sql):{recordsets:structuredClone(f.proof)}})};
 return {...f,v5,rows,pool};
}
const configureProfit=f=>configureBusinessDailyRevision(f.c,f.base,f.performance,f.effects,f.revision,f.pool,f.v5);
test('v5 verifies the three current pins before normalizing immutable v4 history and preserves daily identity',async()=>{
 const f=profitFixture();await configureProfit(f);
 const hashes=Object.fromEntries(Object.entries(f.c.sql).map(([key,m])=>[key,(f.v5.modules.find(p=>p.name===m.name)??f.revision.modules.find(p=>p.name===m.name)).afterHash]));
 assertIsolatedCopyReadProof(f.c,{...fixtureProof(f.c),definitionHashes:hashes});
 assert.throws(()=>assertIsolatedCopyReadProof(f.c,{...fixtureProof(f.c),definitionHashes:Object.fromEntries(Object.entries(f.c.sql).map(([k,m])=>[k,f.revision.modules.find(p=>p.name===m.name).afterHash]))}));
 assert.deepEqual(getBusinessDailySelection(f.c),f.revision.dailyScope.selection);assert.equal(getBusinessDailyScopeHash(f.c),f.revision.dailyScopeHash);
});
test('v5 drift or forged predecessor cannot authorize v4 normalization',async()=>{
 for(const mutate of [f=>f.rows[0].actualHash='F'.repeat(64),f=>f.rows[0].copyId='9c0075ed-7f4b-42f8-b056-f27b8369ad9c',f=>f.rows[0].triggerDisabled=1,f=>f.rows[0].beforeHash='F'.repeat(64),f=>f.rows.pop(),f=>f.rows.push({...f.rows[0]}),f=>f.proof[3][4].actualHash='F'.repeat(64),f=>f.proof[0][0].actualHash='F'.repeat(64),f=>f.v5.baseDailyRevisionHash='F'.repeat(64)]){const f=profitFixture();mutate(f);await assert.rejects(configureProfit(f));}
 const noConfig=profitFixture();await assert.rejects(configureBusinessDailyRevision(noConfig.c,noConfig.base,noConfig.performance,noConfig.effects,noConfig.revision,noConfig.pool));
});
test('v5 accepts SQL uppercase UUID representation and rejects missing database identity',async()=>{
 const f=profitFixture();for(const row of f.rows)row.copyId=row.copyId.toUpperCase();await configureProfit(f);
 assert.deepEqual(getBusinessDailySelection(f.c),f.revision.dailyScope.selection);
 for(const value of [null,undefined,42,'']){const invalid=profitFixture();invalid.rows[0].copyId=value;await assert.rejects(configureProfit(invalid));}
});

function queryPlanFixture(){
 const f=profitFixture(),parent=f.v5.modules.find(m=>m.name==='dbo.usp_stage4_copy_ready');
 const v6=sealed({schemaVersion:'melisa-readiness-query-plan-revision.v1',version:6,copyId:f.c.copyId,baseSealHash:f.c.sealHash,baseDailyRevisionHash:f.revision.revisionHash,baseProfitRevisionHash:f.v5.revisionHash,dailyScopeHash:f.revision.dailyScopeHash,modules:[{name:parent.name,beforeHash:parent.afterHash,afterHash:'D'.repeat(64)}],immutableTriggerHash:'F'.repeat(64)});
 for(const group of [...f.proof,f.rows])for(const r of group){if(r.name===parent.name)r.actualHash=v6.modules[0].afterHash;}
 const parentRows=p=>p.modules.map(m=>({copyId:p.copyId,version:p.version,baseSealHash:p.baseSealHash,dailyScopeHash:p.dailyScopeHash,name:m.name,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:p.revisionHash}));
 const queryProof={recordsets:[[{databaseName:f.c.target.database,serverName:f.c.target.server,registryExists:true,actualHash:v6.modules[0].afterHash,immutableTriggerHash:v6.immutableTriggerHash,triggerDisabled:0,baseManifestRows:185,manifestSealHash:f.c.sealHash}],[{copyId:f.c.copyId,version:6,baseSealHash:v6.baseSealHash,baseDailyRevisionHash:v6.baseDailyRevisionHash,baseProfitRevisionHash:v6.baseProfitRevisionHash,dailyScopeHash:v6.dailyScopeHash,name:parent.name,beforeHash:parent.afterHash,afterHash:v6.modules[0].afterHash,revisionHash:v6.revisionHash}],parentRows(f.revision),parentRows(f.v5)]};
 const pool={request:()=>({query:async sql=>sql===businessReadinessQueryPlanReadSQL()?structuredClone(queryProof):f.pool.request().query(sql)})};
 return {...f,v6,queryProof,pool};
}
const configureQueryPlan=f=>configureBusinessDailyRevision(f.c,f.base,f.performance,f.effects,f.revision,f.pool,f.v5,undefined,f.v6);
const queryPlanHashes=f=>Object.fromEntries(Object.entries(f.c.sql).map(([key,m])=>[key,(f.v6.modules.find(p=>p.name===m.name)??f.v5.modules.find(p=>p.name===m.name)??f.revision.modules.find(p=>p.name===m.name)).afterHash]));

test('v6 validates fresh SQL and immutable v1-v5 closure, preserving scope, actor permissions and latest readProof pin',async()=>{
 const f=queryPlanFixture(),before=isolatedCopyJSON(f.c),dailyBody=isolatedCopyJSON(f.revision);await configureQueryPlan(f);
 assert.equal(isolatedCopyJSON(f.c),before);assert.equal(isolatedCopyJSON(f.revision),dailyBody);
 assertIsolatedCopyReadProof(f.c,{...fixtureProof(f.c),definitionHashes:queryPlanHashes(f)});
 for(const stale of [f.v5.modules.find(m=>m.name===f.c.sql.ready.name).afterHash,f.revision.modules[0].afterHash,f.c.sql.ready.hash])assert.throws(()=>assertIsolatedCopyReadProof(f.c,{...fixtureProof(f.c),definitionHashes:{...queryPlanHashes(f),ready:stale}}));
 assert.deepEqual(getBusinessDailySelection(f.c),f.revision.dailyScope.selection);assert.equal(getBusinessDailyScopeHash(f.c),f.revision.dailyScopeHash);
 const actor={id:'15',permissions:['sales.view']},actual={id:'15',role:f.c.actors.find(a=>a.id==='15').role,active:true,permissions:['sales.view']};
 assertIsolatedCopyActor(f.c,actor,actual,'sales.view');assert.throws(()=>assertIsolatedCopyActor(f.c,actor,actual,'sales.finalize'),{statusCode:403});assert.throws(()=>assertIsolatedCopyActor(f.c,actor,{...actual,role:'admin'},'sales.view'),{statusCode:403});
 assert(Object.isFrozen(getBusinessReadinessQueryPlanRevision(f.c).revision.modules[0]));
});

test('v6 missing/foreign/stale/disabled/duplicate metadata and each parent pin reject before registration',async()=>{
 const mutations=[
  p=>p.recordsets[0][0].registryExists=false,p=>p.recordsets[0][0].actualHash='B'.repeat(64),p=>p.recordsets[0][0].immutableTriggerHash='A'.repeat(64),p=>p.recordsets[0][0].triggerDisabled=1,
  p=>p.recordsets[0][0].databaseName='LIVE',p=>p.recordsets[0][0].serverName='Other',p=>p.recordsets[0][0].baseManifestRows=184,p=>p.recordsets[0][0].manifestSealHash='A'.repeat(64),
  p=>p.recordsets[1].pop(),p=>p.recordsets[1].push({...p.recordsets[1][0]}),p=>p.recordsets[2].pop(),p=>p.recordsets[3].push({...p.recordsets[3][0]}),p=>p.recordsets.pop()
 ];
 for(const mutate of mutations){const f=queryPlanFixture();mutate(f.queryProof);await assert.rejects(configureQueryPlan(f));assert.equal(getBusinessReadinessQueryPlanRevision(f.c),null);}
 for(const group of [0,1,2,3])for(const key of Object.keys(queryPlanFixture().queryProof.recordsets[group][0])){
  const f=queryPlanFixture();f.queryProof.recordsets[group][0][key]=null;await assert.rejects(configureQueryPlan(f),`${group}:${key}`);assert.equal(getBusinessReadinessQueryPlanRevision(f.c),null);
 }
});

test('v6 accepts SQL uppercase UUIDs but rejects resealed forged parents, module widening and config without v5',async()=>{
 const valid=queryPlanFixture();for(const rows of valid.queryProof.recordsets.slice(1))for(const r of rows)r.copyId=r.copyId.toUpperCase();await configureQueryPlan(valid);
 for(const mutate of [r=>r.baseDailyRevisionHash='A'.repeat(64),r=>r.baseProfitRevisionHash='A'.repeat(64),r=>r.dailyScopeHash='A'.repeat(64),r=>r.modules[0].beforeHash='A'.repeat(64),r=>r.modules[0].afterHash=r.modules[0].beforeHash,r=>r.modules[0].name='dbo.usp_stage4_copy_effects',r=>r.modules.push({...r.modules[0]}),r=>r.extra=true]){
  const f=queryPlanFixture();mutate(f.v6);const {revisionHash,...body}=f.v6;f.v6.revisionHash=isolatedCopyHash(body);assert.throws(()=>validateBusinessReadinessQueryPlanRevision(f.revision,f.v5,f.v6));
 }
 const f=queryPlanFixture();await assert.rejects(configureBusinessDailyRevision(f.c,f.base,f.performance,f.effects,f.revision,f.pool,undefined,undefined,f.v6));
 await assert.rejects(configureBusinessDailyRevision(f.c,f.base,f.performance,f.effects,f.revision,f.pool,f.v5));
});

test('v6 overlay is ready-only, refuses stale ready in any history group and never hides another module drift',async()=>{
 const f=queryPlanFixture(),rows=[{name:f.c.sql.ready.name,actualHash:f.v6.modules[0].afterHash},{name:f.c.sql.effects.name,actualHash:'7'.repeat(64)}],out=overlayBusinessReadinessQueryPlanHistory(rows,f.v6);
 assert.equal(out[0].actualHash,f.v6.modules[0].beforeHash);assert.deepEqual(out[1],rows[1]);assert.equal(rows[0].actualHash,f.v6.modules[0].afterHash);
 for(let group=0;group<4;group++){const changed=queryPlanFixture();changed.proof[group].find(r=>r.name===changed.c.sql.ready.name).actualHash=changed.v6.modules[0].beforeHash;await assert.rejects(configureQueryPlan(changed));}
 const changed=queryPlanFixture();changed.proof[3].find(r=>r.name===changed.c.sql.effects.name).actualHash='F'.repeat(64);await assert.rejects(configureQueryPlan(changed));
});

test('v6 runtime verification rereads metadata and parents on every call; unregistered legacy context makes no query',async()=>{
 const legacy=fixture();let reads=0;await verifyBusinessReadinessQueryPlan(legacy.c,{query:async()=>{reads++;throw Error('not expected');}});assert.equal(reads,0);
 for(const mutate of [p=>p.recordsets[0][0].triggerDisabled=1,p=>p.recordsets[0][0].actualHash='A'.repeat(64),p=>p.recordsets[1].pop(),p=>p.recordsets[2][0].revisionHash='A'.repeat(64),p=>p.recordsets[3][0].copyId='foreign']){
  const f=queryPlanFixture();await configureQueryPlan(f);await verifyBusinessReadinessQueryPlan(f.c,f.pool.request());mutate(f.queryProof);await assert.rejects(verifyBusinessReadinessQueryPlan(f.c,f.pool.request()));
 }
});

test('shared bootstrap validates optional v6 parents without publishing revision/SQL pins to the web scope',()=>{
 const f=queryPlanFixture(),config={copyContext:f.c,host:'127.0.0.1',lanHost:'192.168.1.46',erpPort:4184,nativePort:4186,webPort:5234,database:f.c.target.database,server:f.c.target.server,sqlUser:'melisa_shared_test_ro_20261009_02',salesSqlUser:f.c.target.login,jwtAccessSecret:'s'.repeat(48),jwtRefreshSecret:'t'.repeat(48),businessReadyRevision:f.base,businessReadyPerformanceRevision:f.performance,businessEffectsPerformanceRevision:f.effects,businessDailyRevision:f.revision,businessDailyProfitRevision:f.v5,businessReadinessQueryPlanRevision:f.v6};
 const {context}=validateSharedCopyBootstrap(config);assert.equal(JSON.stringify(publicSharedCopyScope(context)).includes(f.v6.revisionHash),false);
 const {businessReadinessQueryPlanRevision,...legacy}=config;validateSharedCopyBootstrap(legacy);
 const noParent={...config};delete noParent.businessDailyProfitRevision;assert.throws(()=>validateSharedCopyBootstrap(noParent));
 const bad=structuredClone(config);bad.businessReadinessQueryPlanRevision.baseProfitRevisionHash='A'.repeat(64);assert.throws(()=>validateSharedCopyBootstrap(bad));
});

test('normal copy store revalidates v6 before ready/handler and on context reload; drift rolls back with no commit',async()=>{
 for(const mode of ['valid','before-handler','on-reload']){
  const f=queryPlanFixture();await configureQueryPlan(f);const events=[],state={commits:0,rollbacks:0,handlers:0,contextCalls:0},actor={id:'16',permissions:['sales.view']};
  const normal={meta:{date:f.c.date,operationOrigin:f.c.operationOrigin,copyId:f.c.copyId,sealHash:f.c.sealHash},scope:{synthetic:false,operationOrigin:f.c.operationOrigin}};
  class Transaction{async begin(level){assert.equal(level,'SERIALIZABLE');events.push('begin');}async commit(){state.commits++;}async rollback(){state.rollbacks++;}}
  class Request{input(){return this;}async query(sql){
   if(sql===businessReadinessQueryPlanReadSQL()){events.push('v6');return structuredClone(f.queryProof);}
   if(sql===businessDailyNativeCheckReadSQL())return f.pool.request().query(sql);
   if(sql===ISOLATED_COPY_FINITE_FK_SQL)return {recordset:[['FK__test_good__produ__5654B625','test_goods_batch_lines'],['FK__test_purc__produ__69678A99','test_purchase_batch_intent_lines']].map(([constraintName,parentTable])=>({constraintName,parentSchema:'dbo',parentTable,parentColumn:'product_id',referencedSchema:'dbo',referencedTable:'products',referencedColumn:'id',ordinal:1,columnCount:1,isDisabled:false,isNotTrusted:false,deleteAction:'NO_ACTION',updateAction:'NO_ACTION'}))};
   if(sql.includes('sp_getapplock')){events.push('lock');return {recordset:[]};}
   if(sql.startsWith('SELECT DB_NAME'))return {recordset:[fixtureIdentity(f.c)]};throw Error('Unexpected SQL');
  }async execute(name){
   if(name===f.c.sql.ready.name){events.push('ready');return {recordset:[]};}
   assert.equal(name,f.c.sql.context.name);events.push('context');state.contextCalls++;
   return {recordset:[{proof_json:JSON.stringify({...fixtureProof(f.c),definitionHashes:queryPlanHashes(f)}),actor_json:JSON.stringify({...actor,active:true,role:f.c.actors.find(a=>a.id===actor.id).role}),context_json:JSON.stringify(normal)}]};
  }}
  const sql={Transaction,Request,ISOLATION_LEVEL:{SERIALIZABLE:'SERIALIZABLE'},UniqueIdentifier:'uuid',NVarChar:n=>n,BigInt:'id'},runtime={sql,pool:{},copyContext:f.c};
  const store=createIsolatedOperationCopyStore({getRuntime:async()=>runtime,buildDomain:async({context,reloadContext})=>{state.handlers++;return {context,reload:reloadContext};}});
  if(mode==='before-handler')f.queryProof.recordsets[0][0].triggerDisabled=1;
  const run=()=>store.read(actor,async c=>{if(mode==='on-reload')f.queryProof.recordsets[0][0].actualHash='A'.repeat(64);return c.reload();});
  if(mode==='valid'){await run();assert.equal(state.commits,1);assert.equal(state.rollbacks,0);assert.equal(state.contextCalls,2);assert.deepEqual(events,['begin','lock','v6','ready','context','v6','context']);}
  else{await assert.rejects(run());assert.equal(state.commits,0);assert.equal(state.rollbacks,1);assert.equal(state.handlers,mode==='before-handler'?0:1);assert.equal(state.contextCalls,mode==='before-handler'?0:1);}
 }
});

test('v6 cannot register from sealed config alone or replace an existing registration',async()=>{
 const pending=queryPlanFixture(),legacy=profitFixture();await configureProfit(legacy);
 assert.throws(()=>registerBusinessReadinessQueryPlanRevision(legacy.c,pending.v6),{code:'BUSINESS_READINESS_QUERY_PLAN_REGISTRATION_PROOF'});
 const current=queryPlanFixture();await configureQueryPlan(current);
 assert.throws(()=>registerBusinessReadinessQueryPlanRevision(current.c,current.v6,current.queryProof),{code:'BUSINESS_READINESS_QUERY_PLAN_REGISTRATION'});
 assert.throws(()=>getBusinessReadinessQueryPlanRevision(structuredClone(current.c)),{code:'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED'});
});
