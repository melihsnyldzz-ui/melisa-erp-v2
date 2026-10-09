import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {businessInboundFixture} from './businessInbound.test-fixture.mjs';
import {sharedRevisionFixture,revisionFixture} from './isolatedOperationCopyRevision.test.mjs';
import {fixtureProof,fixtureContext} from './isolatedOperationCopyContext.test.mjs';
import {isolatedCopyHash,validateIsolatedOperationCopyContext,validateIsolatedCopyReadyRevision,registerIsolatedCopyReadyRevision,registerIsolatedCopyAdapterRevision,assertIsolatedCopyReadProof} from './isolatedOperationCopyContext.mjs';
import {configureBusinessReadyRevision,BUSINESS_READY_REVISION_PROOF_SQL} from './businessReadyRevisionBootstrap.mjs';
import {validateSharedCopyBootstrap,publicSharedCopyScope} from './sharedCopyBootstrap.mjs';
function revision(c){const body={schemaVersion:'melisa-business-copy-ready-revision.v1',version:1,copyId:c.copyId,baseSealHash:c.sealHash,modules:[{name:c.sql.ready.name,beforeHash:c.sql.ready.hash,afterHash:'F'.repeat(64)}],immutableTriggerHash:'E'.repeat(64)};return{...body,revisionHash:isolatedCopyHash(body)};}
function proof(c,r){const m=r.modules[0];return[{databaseName:c.target.database,copyId:c.copyId,version:1,baseSealHash:c.sealHash,manifestSealHash:c.sealHash,name:m.name,beforeHash:m.beforeHash,afterHash:m.afterHash,actualHash:m.afterHash,baseManifestHash:m.beforeHash,baseManifestRows:185,revisionHash:r.revisionHash,immutableTriggerHash:r.immutableTriggerHash,triggerDisabled:0}];}
const config=c=>({copyContext:c,host:'127.0.0.1',lanHost:'192.168.1.46',erpPort:4184,nativePort:4186,webPort:5234,database:c.target.database,server:c.target.server,sqlUser:'melisa_shared_test_ro_20261009_02',salesSqlUser:c.target.login,jwtAccessSecret:'s'.repeat(48),jwtRefreshSecret:'t'.repeat(48)});
test('DB02 exact ready adjunct changes only its registered definition hash and keeps all copy/profile/replay seals',()=>{
 const {copy:c}=businessInboundFixture(),r=revision(c),old=fixtureProof(c),next={...old,definitionHashes:{...old.definitionHashes,ready:r.modules[0].afterHash}};
 assertIsolatedCopyReadProof(c,old);assert.throws(()=>assertIsolatedCopyReadProof(c,next));const accepted=registerIsolatedCopyReadyRevision(c,r,proof(c,r));assert(Object.isFrozen(accepted.modules[0]));assertIsolatedCopyReadProof(c,next);assert.throws(()=>assertIsolatedCopyReadProof(c,old));
 for(const key of ['context','begin','effects'])assert.throws(()=>assertIsolatedCopyReadProof(c,{...next,definitionHashes:{...next.definitionHashes,[key]:'9'.repeat(64)}}));
 for(const key of ['copyId','sealHash','backupSHA'])assert.throws(()=>assertIsolatedCopyReadProof(c,{...next,[key]:'changed'}));assert.throws(()=>registerIsolatedCopyReadyRevision(c,r,proof(c,r)));
});
test('ready-only metadata rejects unknown keys, non-ready modules, altered base pin, unsealed metadata and other databases',()=>{
 for(const change of [r=>r.extra=true,r=>r.version=2,r=>r.copyId='changed',r=>r.baseSealHash='0'.repeat(64),r=>r.modules=[],r=>r.modules.push({...r.modules[0]}),r=>r.modules[0].extra=true,r=>r.modules[0].name='dbo.usp_stage4_copy_context',r=>r.modules[0].beforeHash='B'.repeat(64),r=>r.modules[0].afterHash=r.modules[0].beforeHash,r=>r.immutableTriggerHash=null,r=>r.revisionHash='0'.repeat(64)]){const {copy:c}=businessInboundFixture(),r=revision(c);change(r);assert.throws(()=>validateIsolatedCopyReadyRevision(c,r));}
 for(const c of [sharedRevisionFixture(),validateIsolatedOperationCopyContext(fixtureContext())])assert.throws(()=>validateIsolatedCopyReadyRevision(c,revision(c)));
 const {copy:c}=businessInboundFixture();assert.throws(()=>validateIsolatedCopyReadyRevision(structuredClone(c),revision(c)));assert.throws(()=>registerIsolatedCopyAdapterRevision(c,revisionFixture(c),[]));
});
test('actual registry requires exactly one DB02 row and exact base185 manifest, enabled immutable guard and actual module pins',()=>{
 for(const change of [p=>p.pop(),p=>p.push({...p[0]}),p=>p[0].databaseName='MELISA_ERP_CRM_SHARED_TEST_20261009_01',p=>p[0].copyId='changed',p=>p[0].version=2,p=>p[0].baseSealHash='B'.repeat(64),p=>p[0].manifestSealHash=null,p=>p[0].name='dbo.any_module',p=>p[0].beforeHash='B'.repeat(64),p=>p[0].afterHash='B'.repeat(64),p=>p[0].actualHash=null,p=>p[0].baseManifestHash=null,p=>p[0].baseManifestRows=184,p=>p[0].baseManifestRows=186,p=>p[0].revisionHash='B'.repeat(64),p=>p[0].immutableTriggerHash=null,p=>p[0].triggerDisabled=1,p=>p[0].triggerDisabled=null]){const {copy:c}=businessInboundFixture(),r=revision(c),p=proof(c,r);change(p);assert.throws(()=>registerIsolatedCopyReadyRevision(c,r,p),{code:'ISOLATED_COPY_READY_DB_PROOF'});}
});
test('server bootstrap rejects mixed or foreign revision config before SQL; actual proof query reads all registry rows',async()=>{
 const {copy:c}=businessInboundFixture(),r=revision(c);let reads=0;const pool={request:()=>({query:async sql=>{reads++;assert.equal(sql,BUSINESS_READY_REVISION_PROOF_SQL);return{recordset:proof(c,r)};}})};
 validateSharedCopyBootstrap({...config(c),businessReadyRevision:r});assert.throws(()=>validateSharedCopyBootstrap({...config(c),businessReadyRevision:r,copyAdapterRevision:{}}));assert.throws(()=>validateSharedCopyBootstrap({...config(c),copyAdapterRevision:{}}));
 await assert.rejects(configureBusinessReadyRevision(c,{...r,version:2},pool));assert.equal(reads,0);await configureBusinessReadyRevision(c,r,pool);assert.equal(reads,1);
 assert.match(BUSINESS_READY_REVISION_PROOF_SQL,/LEFT JOIN dbo\.stage4_copy_module_manifest/);assert.doesNotMatch(BUSINESS_READY_REVISION_PROOF_SQL.slice(BUSINESS_READY_REVISION_PROOF_SQL.indexOf('FROM dbo.stage4_copy_ready_revisions')),/\bWHERE\b/);assert(!JSON.stringify(publicSharedCopyScope(c)).includes('Revision'));
 const bootstrap=fs.readFileSync(new URL('../../start-shared-test-copy.mjs',import.meta.url),'utf8');assert.match(bootstrap,/configureBusinessReadyRevision\(context,config\.businessReadyRevision,pool\)/);assert.match(bootstrap,/registerIsolatedCopyAdapterRevision\(context,config\.copyAdapterRevision,proof\)/);
});
