import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {businessInboundFixture} from './businessInbound.test-fixture.mjs';
import {fixtureIdentity} from './isolatedOperationCopyContext.test.mjs';
import {isolatedCopyHash} from './isolatedOperationCopyContext.mjs';
import {STOCK_PREDICATE_MODULES} from '../../../../scripts/canonical/shared-business-stock-predicate-distinct-revision-sql.mjs';
import {supportsBusinessSelectedSaleHistoricalRead,assertBusinessSelectedSaleHistoricalReadProof,verifyBusinessSelectedSaleHistoricalReadProof,BUSINESS_SELECTED_SALE_HISTORICAL_CONTEXT_HASH,BUSINESS_SELECTED_SALE_HISTORICAL_READ_PROOF_SQL} from './businessSelectedSaleHistoricalReadProof.mjs';

// Synthetic metadata validation only. This value is never registered with the
// bootstrap WeakMap and therefore cannot select the production shortcut.
function fixture(){
 const {copy}=businessInboundFixture();
 const storedDefinition="CREATE   PROCEDURE dbo.usp_business_daily_context @copy_id uniqueidentifier,@actor_id bigint,@domain nvarchar(20) WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;\nIF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_CRM_SHARED_TEST_20261009_02' OR CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) COLLATE Latin1_General_100_BIN2<>N'Semih\\MELISADEV' THROW 51904,'STAGE4_WRONG_COPY_TARGET',1;\nEXEC dbo.usp_stage4_copy_ready @copy_id;\nEND;";
 const modules=STOCK_PREDICATE_MODULES.map((name,i)=>({name,type:i===0?'TR':'P',beforeHash:'A'.repeat(64),afterHash:i===3?createHash('sha256').update(storedDefinition,'utf16le').digest('hex').toUpperCase():'B'.repeat(64)}));
 const revision={version:11,revisionHash:'C'.repeat(64),modules,profileHash:isolatedCopyHash(copy),baseOperationQuarantineRevisionHash:'D'.repeat(64),immutableTriggerHash:'E'.repeat(64)};
 const parentHashes={context:BUSINESS_SELECTED_SALE_HISTORICAL_CONTEXT_HASH,ready:modules[2].afterHash};
 const registered={revision:{version:6},selectedEffectsRevision:{version:7},selectedParentRevision:{version:8},supplierItemQuarantineRevision:{version:9},operationQuarantineRevision:{version:10},stockPredicateRevision:revision,bundle:{revision,replacements:[{name:modules[3].name,afterHash:modules[3].afterHash,storedDefinition}]},parentHashes};
 const meta={...fixtureIdentity(copy),sessionId:7,transactionId:'9007199254740993',transactionCount:1,transactionState:1,isolationLevel:4,copyLockMode:'Shared',baseManifestRows:'185',contextHash:parentHashes.context,readyHash:parentHashes.ready,dailyContextHash:modules[3].afterHash,immutableTriggerHash:revision.immutableTriggerHash,immutableTriggerDisabled:0,immutableTriggerName:'dbo.immutable_stage4_copy_stock_predicate_revisions',immutableParentName:'dbo.stage4_copy_stock_predicate_revisions'};
 const rows=modules.map((m,i)=>({copyId:copy.copyId,name:m.name,revision:11,baseSealHash:copy.sealHash,baseOperationQuarantineRevisionHash:revision.baseOperationQuarantineRevisionHash,profileHash:revision.profileHash,beforeHash:m.beforeHash,afterHash:m.afterHash,revisionHash:revision.revisionHash,actualHash:m.afterHash,objectId:100+i,moduleType:m.type,moduleDisabled:0,parentName:i===0?'dbo.stock_movements':null,firstInsert:0,firstUpdate:0,firstDelete:0,lastInsert:0,lastUpdate:0,lastDelete:0}));
 return {copy,registered,result:{recordsets:[[meta],[{copyId:copy.copyId,sealHash:copy.sealHash,backupSHA:copy.backupSHA,sealed:true,profileHash:revision.profileHash}],rows,[structuredClone(meta)]]}};
}
test('synthetic latest-six metadata and reviewed dispatcher/daily semantic pins validate',()=>{
 const f=fixture();assert.equal(supportsBusinessSelectedSaleHistoricalRead(f.copy,f.registered),true);assert.equal(assertBusinessSelectedSaleHistoricalReadProof(f.copy,f.registered,f.result),true);
 assert(!/\b(?:EXEC|INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|MERGE)\b/i.test(BUSINESS_SELECTED_SALE_HISTORICAL_READ_PROOF_SQL));assert.match(BUSINESS_SELECTED_SALE_HISTORICAL_READ_PROOF_SQL,/WITH\(HOLDLOCK\)/);
});
test('no registration or caller option grants shortcut; unknown revisions/semantics fallback',async()=>{
 const f=fixture();let calls=0;const tx={},request={parent:tx,query:async()=>{calls++;throw Error('must not query');}};
 assert.equal(await verifyBusinessSelectedSaleHistoricalReadProof(f.copy,request,{domain:'trade',write:false,automatic:null,transaction:tx,registered:f.registered,skipReady:true}),false);assert.equal(calls,0);
 for(const option of [{domain:'inbound',write:false,automatic:null},{domain:'trade',write:true,automatic:null},{domain:'trade',write:false,automatic:{}},{domain:'trade',write:false}])assert.equal(await verifyBusinessSelectedSaleHistoricalReadProof(f.copy,request,option),false);
 for(const mutate of [r=>r.stockPredicateRevision.version=12,r=>r.revision.version=7,r=>r.parentHashes.context='F'.repeat(64),r=>r.bundle.revision={version:11,revisionHash:'F'.repeat(64)},r=>r.futureRevision={},r=>r.bundle.replacements[0].storedDefinition+=' -- drift',r=>r.bundle.replacements[0].storedDefinition=r.bundle.replacements[0].storedDefinition.replace('EXEC dbo.usp_stage4_copy_ready','IF @domain=\'trade\' EXEC dbo.usp_stage4_copy_ready')]){const x=fixture();mutate(x.registered);assert.equal(supportsBusinessSelectedSaleHistoricalRead(x.copy,x.registered),false);}
 await assert.rejects(verifyBusinessSelectedSaleHistoricalReadProof(structuredClone(f.copy),request,{domain:'trade',write:false,automatic:null}),{code:'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED'});
});
test('supported native identity/TX/lock/context/immutable/manifest drift fails closed',()=>{
 const changes=[s=>s[0][0].sysadmin=1,s=>s[0][0].login='foreign',s=>s[0][0].originalDatabaseAccess=1,s=>s[0][0].transactionCount=2,s=>s[0][0].transactionState=-1,s=>s[0][0].isolationLevel=2,s=>s[0][0].copyLockMode='Exclusive',s=>s[0][0].contextHash='F'.repeat(64),s=>s[0][0].readyHash='F'.repeat(64),s=>s[0][0].dailyContextHash='F'.repeat(64),s=>s[0][0].baseManifestRows=184,s=>s[0][0].immutableTriggerDisabled=1,s=>s[0][0].immutableTriggerHash='F'.repeat(64),s=>s[0][0].immutableParentName='dbo.foreign',s=>s[0][0].extra=true,s=>s[3][0].transactionId='9007199254740994',s=>s[1][0].sealed=false,s=>s[1][0].profileHash='F'.repeat(64),s=>s[1].push({...s[1][0]}),s=>s.pop()];
 for(const mutate of changes){const f=fixture();mutate(f.result.recordsets);assert.throws(()=>assertBusinessSelectedSaleHistoricalReadProof(f.copy,f.registered,f.result));}
});
test('latest registry foreign/extra/hash/type/disabled/order/object metadata drift fails',()=>{
 const changes=[s=>s[2].pop(),s=>s[2].push({...s[2][0]}),s=>s[2][0].name='dbo.foreign',s=>s[2][0].copyId='foreign',s=>s[2][0].revision=12,s=>s[2][0].baseSealHash='F'.repeat(64),s=>s[2][0].baseOperationQuarantineRevisionHash='F'.repeat(64),s=>s[2][0].profileHash='F'.repeat(64),s=>s[2][0].beforeHash='F'.repeat(64),s=>s[2][0].afterHash='F'.repeat(64),s=>s[2][0].actualHash='F'.repeat(64),s=>s[2][0].moduleDisabled=1,s=>s[2][0].moduleType='P',s=>s[2][0].parentName='dbo.foreign',s=>s[2][0].firstInsert=1,s=>s[2][0].lastDelete=1,s=>s[2][1].firstUpdate=1,s=>s[2][0].objectId=0,s=>s[2][1].objectId=s[2][0].objectId,s=>s[2][0].extra=true];
 for(const mutate of changes){const f=fixture();mutate(f.result.recordsets);assert.throws(()=>assertBusinessSelectedSaleHistoricalReadProof(f.copy,f.registered,f.result));}
});
