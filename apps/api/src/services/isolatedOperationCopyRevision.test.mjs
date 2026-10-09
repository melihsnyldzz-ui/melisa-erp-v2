import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureContext,fixtureProof} from './isolatedOperationCopyContext.test.mjs';
import {isolatedCopyHash,SHARED_COPY_DATABASE,validateIsolatedOperationCopyContext,registerIsolatedCopyAdapterRevision,assertIsolatedCopyReadProof} from './isolatedOperationCopyContext.mjs';
export function sharedRevisionFixture(){
 const raw=fixtureContext();raw.date='2026-10-09';Object.assign(raw.target,{database:SHARED_COPY_DATABASE,login:'melisa_shared_test_rw_20261009_01',databaseUser:'melisa_shared_test_rw_20261009_01'});
 raw.products=[{...raw.products[0],id:'29980'},{...raw.products[0],id:'30003',sourceKey:'VEGA2026/F0102TBLSTOKLAR/14568'}];raw.customers[0].id='210';Object.assign(raw.suppliers[0],{id:'10162',currency:'TRY'});raw.financeAccounts=[{...raw.financeAccounts[0],id:'20043'}];const {sealHash,...body}=raw;raw.sealHash=isolatedCopyHash(body);return validateIsolatedOperationCopyContext(raw);
}
export function revisionFixture(context){const body={schemaVersion:'melisa-shared-copy-adapter-revision.v1',version:1,copyId:context.copyId,baseSealHash:context.sealHash,modules:[{name:'dbo.usp_stage4_copy_ready',beforeHash:context.sql.ready.hash,afterHash:'B'.repeat(64)},{name:'dbo.usp_stage4_copy_guard',beforeHash:'C'.repeat(64),afterHash:'D'.repeat(64)},{name:'dbo.usp_stage4_copy_context',beforeHash:context.sql.context.hash,afterHash:'F'.repeat(64)}],immutableTriggerHash:'E'.repeat(64)};return{...body,revisionHash:isolatedCopyHash(body)};}
const dbProof=r=>r.modules.map(m=>({...m,copyId:r.copyId,version:1,baseSealHash:r.baseSealHash,actualHash:m.afterHash,baseManifestHash:m.beforeHash,immutableTriggerHash:r.immutableTriggerHash,triggerDisabled:0}));
if(import.meta.filename===process.argv[1]){
test('shared adjunct pins ready/context while existing copyId, seal and replay proof fields stay unchanged',()=>{
 const c=sharedRevisionFixture(),r=revisionFixture(c),old=fixtureProof(c),next={...old,definitionHashes:{...old.definitionHashes,ready:r.modules[0].afterHash,context:r.modules[2].afterHash}};
 assertIsolatedCopyReadProof(c,old);assert.throws(()=>assertIsolatedCopyReadProof(c,next));registerIsolatedCopyAdapterRevision(c,r,dbProof(r));assertIsolatedCopyReadProof(c,next);assert.throws(()=>assertIsolatedCopyReadProof(c,old));
 for(const k of ['context','begin','effects'])assert.throws(()=>assertIsolatedCopyReadProof(c,{...next,definitionHashes:{...next.definitionHashes,[k]:'9'.repeat(64)}}));
 for(const k of ['copyId','sealHash','backupSHA'])assert.throws(()=>assertIsolatedCopyReadProof(c,{...next,[k]:'changed'}));assert.throws(()=>registerIsolatedCopyAdapterRevision(c,r,dbProof(r)));
});
test('only exact DB-pinned fixed shared revision can register; altered targets, metadata or guard state fail closed',()=>{
 for(const mutate of [v=>v[0].actualHash='F'.repeat(64),v=>v[0].baseManifestHash='F'.repeat(64),v=>v[0].copyId='ab9ab06a-6b0f-4b48-8898-43b13c140c94',v=>v[0].triggerDisabled=1,v=>v[1].name='dbo.any_proc',v=>v.pop()]){const c=sharedRevisionFixture(),r=revisionFixture(c),p=dbProof(r);mutate(p);assert.throws(()=>registerIsolatedCopyAdapterRevision(c,r,p));}
 const c=sharedRevisionFixture();for(const mutate of [v=>v.version=2,v=>v.copyId='changed',v=>v.baseSealHash='F'.repeat(64),v=>v.modules[1].name='dbo.usp_stage4_copy_effects',v=>v.revisionHash='F'.repeat(64)]){const r=revisionFixture(c);mutate(r);assert.throws(()=>registerIsolatedCopyAdapterRevision(c,r,dbProof(r)));}
 const old=validateIsolatedOperationCopyContext(fixtureContext()),r=revisionFixture(old);assert.throws(()=>registerIsolatedCopyAdapterRevision(old,r,dbProof(r)));assert.throws(()=>registerIsolatedCopyAdapterRevision(structuredClone(c),revisionFixture(c),[]));
});
}
