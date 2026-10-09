import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {businessInboundFixture} from './businessInbound.test-fixture.mjs';
import {sharedRevisionFixture} from './isolatedOperationCopyRevision.test.mjs';
import {fixtureProof} from './isolatedOperationCopyContext.test.mjs';
import {isolatedCopyHash,validateIsolatedCopyReadyPerformanceRevision,registerIsolatedCopyReadyPerformanceRevision,registerIsolatedCopyReadyRevision,assertIsolatedCopyReadProof} from './isolatedOperationCopyContext.mjs';
import {configureBusinessReadyPerformanceRevision,BUSINESS_READY_PERFORMANCE_REVISION_PROOF_SQL} from './businessReadyRevisionBootstrap.mjs';
import {validateSharedCopyBootstrap,publicSharedCopyScope} from './sharedCopyBootstrap.mjs';
const sealed=body=>({...body,revisionHash:isolatedCopyHash(body)});
function fixture(){const {copy:c}=businessInboundFixture(),base=sealed({schemaVersion:'melisa-business-copy-ready-revision.v1',version:1,copyId:c.copyId,baseSealHash:c.sealHash,modules:[{name:c.sql.ready.name,beforeHash:c.sql.ready.hash,afterHash:'F'.repeat(64)}],immutableTriggerHash:'E'.repeat(64)}),next=sealed({schemaVersion:'melisa-business-copy-ready-performance-revision.v1',version:2,copyId:c.copyId,baseSealHash:c.sealHash,baseReadyRevisionHash:base.revisionHash,modules:[{name:c.sql.ready.name,beforeHash:base.modules[0].afterHash,afterHash:'9'.repeat(64)}],immutableTriggerHash:'D'.repeat(64)});
 const row=r=>({databaseName:c.target.database,copyId:c.copyId,version:r.version,baseSealHash:c.sealHash,manifestSealHash:c.sealHash,name:c.sql.ready.name,beforeHash:r.modules[0].beforeHash,afterHash:r.modules[0].afterHash,actualHash:next.modules[0].afterHash,baseManifestHash:c.sql.ready.hash,baseManifestRows:185,revisionHash:r.revisionHash,immutableTriggerHash:r.immutableTriggerHash,triggerDisabled:0});
 return{c,base,next,proof:{base:[row(base)],performance:[{...row(next),baseReadyRevisionHash:base.revisionHash}]}};
}
const config=c=>({copyContext:c,host:'127.0.0.1',lanHost:'192.168.1.46',erpPort:4184,nativePort:4186,webPort:5234,database:c.target.database,server:c.target.server,sqlUser:'melisa_shared_test_ro_20261009_02',salesSqlUser:c.target.login,jwtAccessSecret:'s'.repeat(48),jwtRefreshSecret:'t'.repeat(48)});
test('v2 validates and freezes the exact original0→historical1→actual2 metadata chain',()=>{const {c,base,next}=fixture(),valid=validateIsolatedCopyReadyPerformanceRevision(c,base,next);assert.deepEqual(valid,next);assert(Object.isFrozen(valid.modules[0]));});
test('metadata rejects extra keys, missing/foreign base1, wrong linkage, seal, module and revision hashes',()=>{
 for(const mutate of [n=>n.extra=true,n=>n.version=1,n=>n.baseReadyRevisionHash='B'.repeat(64),n=>n.copyId='changed',n=>n.baseSealHash='B'.repeat(64),n=>n.modules.push({...n.modules[0]}),n=>n.modules[0].name='dbo.usp_stage4_copy_context',n=>n.modules[0].beforeHash='B'.repeat(64),n=>n.modules[0].afterHash=n.modules[0].beforeHash,n=>n.modules[0].extra=true,n=>n.immutableTriggerHash=null,n=>n.revisionHash='B'.repeat(64)]){const {c,base,next}=fixture();mutate(next);assert.throws(()=>validateIsolatedCopyReadyPerformanceRevision(c,base,next));}
 const {c,base,next}=fixture();assert.throws(()=>validateIsolatedCopyReadyPerformanceRevision(c,undefined,next));assert.throws(()=>validateIsolatedCopyReadyPerformanceRevision(sharedRevisionFixture(),base,next));assert.throws(()=>validateIsolatedCopyReadyPerformanceRevision(structuredClone(c),base,next));
});
test('direct chain registration accepts genuine historical1 with current actual2 and changes only ready effective pin',()=>{
 const {c,base,next,proof}=fixture(),old=fixtureProof(c),current={...old,definitionHashes:{...old.definitionHashes,ready:next.modules[0].afterHash}};
 assert.throws(()=>assertIsolatedCopyReadProof(c,current));registerIsolatedCopyReadyPerformanceRevision(c,base,next,proof);assertIsolatedCopyReadProof(c,current);assert.throws(()=>assertIsolatedCopyReadProof(c,old));assert.throws(()=>assertIsolatedCopyReadProof(c,{...current,definitionHashes:{...current.definitionHashes,ready:base.modules[0].afterHash}}));
 for(const key of ['context','begin','effects'])assert.throws(()=>assertIsolatedCopyReadProof(c,{...current,definitionHashes:{...current.definitionHashes,[key]:'B'.repeat(64)}}));
});
test('each old/new registry field including NULL actual hashes, trigger states and base185 counts fails closed',()=>{
 for(const registry of ['base','performance'])for(const field of Object.keys(fixture().proof[registry][0])){const {c,base,next,proof}=fixture();proof[registry][0][field]=null;assert.throws(()=>registerIsolatedCopyReadyPerformanceRevision(c,base,next,proof),{code:'ISOLATED_COPY_READY_PERFORMANCE_DB_PROOF'});}
 const {c,base,next,proof}=fixture();proof.base[0].actualHash=base.modules[0].afterHash;assert.throws(()=>registerIsolatedCopyReadyPerformanceRevision(c,base,next,proof));
});
test('all-row proof rejects extra/missing registry rows, unknown columns and mixed containers',()=>{
 for(const mutate of [p=>p.base=[],p=>p.performance=[],p=>p.base.push({...p.base[0]}),p=>p.performance.push({...p.performance[0]}),p=>p.extra=[],p=>p.base[0].extra=true,p=>p.performance[0].extra=true]){const {c,base,next,proof}=fixture();mutate(proof);assert.throws(()=>registerIsolatedCopyReadyPerformanceRevision(c,base,next,proof));}
});
test('standalone v1 remains supported; double/mixed registrations cannot replace trusted WeakMap pins',()=>{
 const {c,base,next,proof}=fixture();registerIsolatedCopyReadyPerformanceRevision(c,base,next,proof);assert.throws(()=>registerIsolatedCopyReadyPerformanceRevision(c,base,next,proof));assert.throws(()=>registerIsolatedCopyReadyRevision(c,base,[{...proof.base[0],actualHash:base.modules[0].afterHash}]));
 const old=fixture();registerIsolatedCopyReadyRevision(old.c,old.base,[{...old.proof.base[0],actualHash:old.base.modules[0].afterHash}]);assertIsolatedCopyReadProof(old.c,{...fixtureProof(old.c),definitionHashes:{...fixtureProof(old.c).definitionHashes,ready:old.base.modules[0].afterHash}});assert.throws(()=>registerIsolatedCopyReadyPerformanceRevision(old.c,old.base,old.next,old.proof));
});
test('bootstrap requires both adjuncts on DB02 and refuses missing/mixed configuration before SQL',async()=>{
 const {c,base,next}=fixture();validateSharedCopyBootstrap({...config(c),businessReadyRevision:base,businessReadyPerformanceRevision:next});validateSharedCopyBootstrap({...config(c),businessReadyRevision:base});
 for(const extra of [{businessReadyPerformanceRevision:next},{businessReadyRevision:base,businessReadyPerformanceRevision:next,copyAdapterRevision:{}},{businessReadyRevision:base,businessReadyPerformanceRevision:{...next,extra:true}}])assert.throws(()=>validateSharedCopyBootstrap({...config(c),...extra}));
 let calls=0;await assert.rejects(configureBusinessReadyPerformanceRevision(c,base,{...next,version:1},{request:()=>{calls++;}}));assert.equal(calls,0);
});
test('one query reads both complete registries and registers the real two-recordset chain without old1 fabrication',async()=>{
 const {c,base,next,proof}=fixture();let calls=0;await configureBusinessReadyPerformanceRevision(c,base,next,{request:()=>({query:async text=>{calls++;assert.equal(text,BUSINESS_READY_PERFORMANCE_REVISION_PROOF_SQL);return{recordsets:[proof.base,proof.performance]};}})});assert.equal(calls,1);
 for(const registry of ['stage4_copy_ready_revisions','stage4_copy_ready_performance_revisions']){const segment=BUSINESS_READY_PERFORMANCE_REVISION_PROOF_SQL.split('FROM dbo.'+registry+' r')[1].split(';')[0];assert.doesNotMatch(segment,/\bWHERE\b/);}
 const f=fixture();await assert.rejects(configureBusinessReadyPerformanceRevision(f.c,f.base,f.next,{request:()=>({query:async()=>({recordsets:[f.proof.base,f.proof.performance,[]]})})}),{code:'ISOLATED_COPY_READY_PERFORMANCE_DB_PROOF'});
});
test('server entrypoint chooses direct v2 proof first; public scope contains no registry adjunct or alternate bypass flag',()=>{
 const {c}=fixture();assert(!JSON.stringify(publicSharedCopyScope(c)).includes('Revision'));const source=fs.readFileSync(new URL('../../start-shared-test-copy.mjs',import.meta.url),'utf8');assert.match(source,/if\(config\.businessReadyPerformanceRevision\)/);assert.match(source,/configureBusinessReadyPerformanceRevision\(context,config\.businessReadyRevision,config\.businessReadyPerformanceRevision,pool\)/);assert.match(source,/else if\(config\.businessReadyRevision\)/);assert.doesNotMatch(source,/skipReady|cachedReady|disableGuards/i);
});
