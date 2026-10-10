import test from 'node:test';
import assert from 'node:assert/strict';
import {businessInboundFixture} from './businessInbound.test-fixture.mjs';
import {fixtureProof} from './isolatedOperationCopyContext.test.mjs';
import {isolatedCopyHash,isolatedCopyJSON,validateIsolatedOperationCopyContext,assertIsolatedCopyReadProof,getBusinessDailySelection,getBusinessDailyScopeHash} from './isolatedOperationCopyContext.mjs';
import {isolatedCopyRequestBody} from './isolatedOperationCopyStore.mjs';
import {selectBusinessDailyProfile} from '../../../../scripts/canonical/shared-business-daily-revision-sql.mjs';
import {configureBusinessDailyRevision,validateBusinessDailyRevision,BUSINESS_DAILY_REVISION_PROOF_SQL} from './businessDailyRevisionBootstrap.mjs';

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
 const pool={request:()=>({query:async sql=>{assert.equal(sql,BUSINESS_DAILY_REVISION_PROOF_SQL);return {recordsets:structuredClone(proof)};}})};
 return {c,base,performance,effects,revision,proof,pool};
}
const configure=f=>configureBusinessDailyRevision(f.c,f.base,f.performance,f.effects,f.revision,f.pool);
const resealRevision=f=>{f.revision.dailyScopeHash=isolatedCopyHash(f.revision.dailyScope);const {revisionHash,...body}=f.revision;f.revision.revisionHash=isolatedCopyHash(body);};

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
