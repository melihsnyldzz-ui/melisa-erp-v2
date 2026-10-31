import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {businessInboundFixture} from './businessInbound.test-fixture.mjs';
import {fixtureProof} from './isolatedOperationCopyContext.test.mjs';
import {sharedRevisionFixture} from './isolatedOperationCopyRevision.test.mjs';
import {isolatedCopyHash,isolatedCopyJSON,validateIsolatedOperationCopyContext,validateIsolatedCopyEffectsPerformanceRevision,registerIsolatedCopyEffectsPerformanceRevision,registerIsolatedCopyReadyPerformanceRevision,registerIsolatedCopyReadyRevision,assertIsolatedCopyReadProof} from './isolatedOperationCopyContext.mjs';
import {configureBusinessEffectsPerformanceRevision,BUSINESS_EFFECTS_PERFORMANCE_REVISION_PROOF_SQL} from './businessReadyRevisionBootstrap.mjs';
import {validateSharedCopyBootstrap,publicSharedCopyScope} from './sharedCopyBootstrap.mjs';
const sealed=body=>({...body,revisionHash:isolatedCopyHash(body)});
function fixture(){
 const raw=structuredClone(businessInboundFixture().copy);
 for(const[kind,role,count,start]of [['customers','customer',26,100],['suppliers','supplier',11,200]])raw[kind]=Array.from({length:count},(_,i)=>({...raw[kind][0],id:String(start+i),accountId:String(start+1000+i)}));
 const{sealHash,...body}=raw;raw.sealHash=isolatedCopyHash(body);const c=validateIsolatedOperationCopyContext(raw);
 const base=sealed({schemaVersion:'melisa-business-copy-ready-revision.v1',version:1,copyId:c.copyId,baseSealHash:c.sealHash,modules:[{name:c.sql.ready.name,beforeHash:c.sql.ready.hash,afterHash:'F'.repeat(64)}],immutableTriggerHash:'E'.repeat(64)});
 const performance=sealed({schemaVersion:'melisa-business-copy-ready-performance-revision.v1',version:2,copyId:c.copyId,baseSealHash:c.sealHash,baseReadyRevisionHash:base.revisionHash,modules:[{name:c.sql.ready.name,beforeHash:base.modules[0].afterHash,afterHash:'9'.repeat(64)}],immutableTriggerHash:'D'.repeat(64)});
 const baselineResiduals=[...c.customers.map(p=>({role:'customer',...p})),...c.suppliers.map(p=>({role:'supplier',...p}))].map((p,i)=>({role:p.role,id:p.id,accountId:p.accountId,currency:p.currency,residualExact8:i%2?'-0.00000001':'0.00000001',beforeHash:p.beforeHash,accountBeforeHash:p.accountBeforeHash,sourceWitnessHash:p.sourceWitnessHash}));
 const next=sealed({schemaVersion:'melisa-business-copy-effects-performance-revision.v1',version:3,copyId:c.copyId,baseSealHash:c.sealHash,baseReadyRevisionHash:base.revisionHash,baseReadyPerformanceRevisionHash:performance.revisionHash,modules:[{name:c.sql.ready.name,beforeHash:performance.modules[0].afterHash,afterHash:'8'.repeat(64)},{name:c.sql.effects.name,beforeHash:c.sql.effects.hash,afterHash:'7'.repeat(64)}],baselineResiduals,baselineResidualsHash:isolatedCopyHash(baselineResiduals),immutableTriggerHash:'C'.repeat(64)});
 const row=(r,m)=>({databaseName:c.target.database,copyId:c.copyId,version:r.version,baseSealHash:c.sealHash,manifestSealHash:c.sealHash,name:m.name,beforeHash:m.beforeHash,afterHash:m.afterHash,actualHash:next.modules.find(n=>n.name===m.name).afterHash,baseManifestHash:c.sql[m.name===c.sql.ready.name?'ready':'effects'].hash,baseManifestRows:185,revisionHash:r.revisionHash,immutableTriggerHash:r.immutableTriggerHash,triggerDisabled:0});
 const proof={base:[row(base,base.modules[0])],performance:[{...row(performance,performance.modules[0]),baseReadyRevisionHash:base.revisionHash}],effects:next.modules.map(m=>({...row(next,m),baseReadyRevisionHash:base.revisionHash,baseReadyPerformanceRevisionHash:performance.revisionHash,baselineResidualsHash:next.baselineResidualsHash,baselineResidualsJSON:isolatedCopyJSON(baselineResiduals)}))};
 return {c,base,performance,next,proof};
}
const config=c=>({copyContext:c,host:'127.0.0.1',lanHost:'192.168.1.46',erpPort:4184,nativePort:4186,webPort:5234,database:c.target.database,server:c.target.server,sqlUser:'melisa_shared_test_ro_20261009_02',salesSqlUser:c.target.login,jwtAccessSecret:'s'.repeat(48),jwtRefreshSecret:'t'.repeat(48)});
test('v3 freezes genuine ready/effects source chain and all 37 captured residual tuples',()=>{
 const {c,base,performance,next}=fixture(),valid=validateIsolatedCopyEffectsPerformanceRevision(c,base,performance,next);assert.deepEqual(valid,next);assert(Object.isFrozen(valid.baselineResiduals[0]));assert.equal(valid.baselineResiduals.filter(r=>r.role==='customer').length,26);assert.equal(valid.baselineResiduals.filter(r=>r.role==='supplier').length,11);
});
test('v3 metadata rejects foreign context, missing chains, extra fields, wrong version/module order and hashes',()=>{
 for(const mutate of [n=>n.extra=true,n=>n.version=2,n=>n.copyId='changed',n=>n.baseSealHash='B'.repeat(64),n=>n.baseReadyRevisionHash='B'.repeat(64),n=>n.baseReadyPerformanceRevisionHash='B'.repeat(64),n=>n.modules.reverse(),n=>n.modules.push({...n.modules[0]}),n=>n.modules[0].beforeHash='B'.repeat(64),n=>n.modules[1].name='dbo.usp_stage4_copy_context',n=>n.modules[1].afterHash=n.modules[1].beforeHash,n=>n.modules[1].extra=true,n=>n.immutableTriggerHash=null,n=>n.revisionHash='B'.repeat(64)]){const {c,base,performance,next}=fixture();mutate(next);assert.throws(()=>validateIsolatedCopyEffectsPerformanceRevision(c,base,performance,next));}
 const f=fixture();assert.throws(()=>validateIsolatedCopyEffectsPerformanceRevision(structuredClone(f.c),f.base,f.performance,f.next));assert.throws(()=>validateIsolatedCopyEffectsPerformanceRevision(sharedRevisionFixture(),f.base,f.performance,f.next));assert.throws(()=>validateIsolatedCopyEffectsPerformanceRevision(f.c,undefined,f.performance,f.next));assert.throws(()=>validateIsolatedCopyEffectsPerformanceRevision(f.c,f.base,undefined,f.next));
});
test('residuals require exactly captured 26/11 identity/hash tuples, nonzero fixed8 and canonical full-array seal',()=>{
 for(const mutate of [r=>r.pop(),r=>r.push({...r[0]}),r=>r[1]={...r[0]},r=>r[0].role='admin',r=>r[0].id='591',r=>r[0].accountId='unknown',r=>r[0].currency='LL',r=>r[0].residualExact8='0.00000000',r=>r[0].residualExact8='-0.00000000',r=>r[0].residualExact8='0.000000001',r=>r[0].residualExact8='01.00000000',r=>r[0].residualExact8='1e-8',r=>r[0].residualExact8='1000000000000000000000.00000000',r=>r[0].beforeHash='B'.repeat(64),r=>r[0].accountBeforeHash='B'.repeat(64),r=>r[0].sourceWitnessHash='B'.repeat(64),r=>r[0].extra=true]){const f=fixture();mutate(f.next.baselineResiduals);f.next.baselineResidualsHash=isolatedCopyHash(f.next.baselineResiduals);const{revisionHash,...body}=f.next;f.next.revisionHash=isolatedCopyHash(body);assert.throws(()=>validateIsolatedCopyEffectsPerformanceRevision(f.c,f.base,f.performance,f.next));}
 const f=fixture();f.next.baselineResidualsHash='B'.repeat(64);assert.throws(()=>validateIsolatedCopyEffectsPerformanceRevision(f.c,f.base,f.performance,f.next));
});
test('real three-registry proof registers current3 for historical1/2 and changes only ready/effects pins',()=>{
 const f=fixture(),old=fixtureProof(f.c),current={...old,definitionHashes:{...old.definitionHashes,ready:f.next.modules[0].afterHash,effects:f.next.modules[1].afterHash}};
 assert.throws(()=>assertIsolatedCopyReadProof(f.c,current));registerIsolatedCopyEffectsPerformanceRevision(f.c,f.base,f.performance,f.next,f.proof);assertIsolatedCopyReadProof(f.c,current);assert.throws(()=>assertIsolatedCopyReadProof(f.c,old));
 for(const key of ['ready','effects','begin','context'])assert.throws(()=>assertIsolatedCopyReadProof(f.c,{...current,definitionHashes:{...current.definitionHashes,[key]:'B'.repeat(64)}}));
});
test('every old1/old2/new3 SQL metadata field including full residual JSON and all triggers fails closed',()=>{
 for(const registry of ['base','performance','effects'])for(let index=0;index<fixture().proof[registry].length;index++)for(const field of Object.keys(fixture().proof[registry][index])){const f=fixture();f.proof[registry][index][field]=null;assert.throws(()=>registerIsolatedCopyEffectsPerformanceRevision(f.c,f.base,f.performance,f.next,f.proof),{code:'ISOLATED_COPY_EFFECTS_PERFORMANCE_DB_PROOF'});}
 for(const mutate of [p=>p.base[0].actualHash='F'.repeat(64),p=>p.performance[0].actualHash='9'.repeat(64),p=>p.effects[1].actualHash='A'.repeat(64),p=>p.effects[0].baselineResidualsJSON=JSON.stringify(JSON.parse(p.effects[0].baselineResidualsJSON).reverse())]){const f=fixture();mutate(f.proof);assert.throws(()=>registerIsolatedCopyEffectsPerformanceRevision(f.c,f.base,f.performance,f.next,f.proof));}
});
test('all registry rows are required, no foreign/mixed/duplicate registrations can install trusted pins',()=>{
 for(const mutate of [p=>p.base=[],p=>p.performance=[],p=>p.effects=[],p=>p.effects.pop(),p=>p.effects[1]={...p.effects[0]},p=>p.base.push({...p.base[0]}),p=>p.performance.push({...p.performance[0]}),p=>p.effects.push({...p.effects[0]}),p=>p.extra=[],p=>p.effects[0].extra=true,p=>p.effects[1].databaseName='LIVE']){const f=fixture();mutate(f.proof);assert.throws(()=>registerIsolatedCopyEffectsPerformanceRevision(f.c,f.base,f.performance,f.next,f.proof));}
 const f=fixture();registerIsolatedCopyEffectsPerformanceRevision(f.c,f.base,f.performance,f.next,f.proof);assert.throws(()=>registerIsolatedCopyEffectsPerformanceRevision(f.c,f.base,f.performance,f.next,f.proof));assert.throws(()=>registerIsolatedCopyReadyPerformanceRevision(f.c,f.base,f.performance,{base:f.proof.base,performance:f.proof.performance}));assert.throws(()=>registerIsolatedCopyReadyRevision(f.c,f.base,[{...f.proof.base[0],actualHash:f.base.modules[0].afterHash}]));
 const g=fixture();registerIsolatedCopyReadyRevision(g.c,g.base,[{...g.proof.base[0],actualHash:g.base.modules[0].afterHash}]);assert.throws(()=>registerIsolatedCopyEffectsPerformanceRevision(g.c,g.base,g.performance,g.next,g.proof));
});
test('bootstrap refuses missing/extra server adjuncts before any SQL and never exposes residuals publicly',async()=>{
 const f=fixture(),cfg={...config(f.c),businessReadyRevision:f.base,businessReadyPerformanceRevision:f.performance,businessEffectsPerformanceRevision:f.next};validateSharedCopyBootstrap(cfg);
 for(const mutate of [c=>delete c.businessReadyRevision,c=>delete c.businessReadyPerformanceRevision,c=>c.copyAdapterRevision={},c=>c.businessEffectsPerformanceRevision.extra=true]){const c=structuredClone(cfg);mutate(c);assert.throws(()=>validateSharedCopyBootstrap(c));}
 let calls=0;await assert.rejects(configureBusinessEffectsPerformanceRevision(f.c,f.base,f.performance,{...f.next,version:2},{request:()=>{calls++;}}));assert.equal(calls,0);assert.doesNotMatch(JSON.stringify(publicSharedCopyScope(f.c)),/Residual|Revision|accountBeforeHash|sourceWitnessHash/);
});
test('single startup query reads all three complete registries without masking rows or fabricating history',async()=>{
 const f=fixture();let calls=0;await configureBusinessEffectsPerformanceRevision(f.c,f.base,f.performance,f.next,{request:()=>({query:async text=>{calls++;assert.equal(text,BUSINESS_EFFECTS_PERFORMANCE_REVISION_PROOF_SQL);return {recordsets:[f.proof.base,f.proof.performance,f.proof.effects]};}})});assert.equal(calls,1);
 for(const name of ['stage4_copy_ready_revisions','stage4_copy_ready_performance_revisions','stage4_copy_effects_performance_revisions'])assert.doesNotMatch(BUSINESS_EFFECTS_PERFORMANCE_REVISION_PROOF_SQL.split('FROM dbo.'+name+' r')[1].split(';')[0],/\bWHERE\b/);
 for(const length of [0,1,2,4]){const g=fixture();await assert.rejects(configureBusinessEffectsPerformanceRevision(g.c,g.base,g.performance,g.next,{request:()=>({query:async()=>({recordsets:Array.from({length},()=>[])})})}),{code:'ISOLATED_COPY_EFFECTS_PERFORMANCE_DB_PROOF'});}
});
test('entrypoint chooses v3 before unchanged standalone v2/v1 startup, with no env/HTTP guard bypass',()=>{
 const source=fs.readFileSync(new URL('../../start-shared-test-copy.mjs',import.meta.url),'utf8');assert.match(source,/if\(config\.businessEffectsPerformanceRevision\)/);assert.match(source,/configureBusinessEffectsPerformanceRevision\(context,config\.businessReadyRevision,config\.businessReadyPerformanceRevision,config\.businessEffectsPerformanceRevision,pool\)/);assert.match(source,/else if\(config\.businessReadyPerformanceRevision\)/);assert.match(source,/else if\(config\.businessReadyRevision\)/);assert.doesNotMatch(source,/skipReady|cachedReady|disableGuards/i);
});
test('a serialized HTTP/body marker or environment value cannot register a revision or override trusted pins',async()=>{
 const f=fixture(),current={...fixtureProof(f.c),definitionHashes:{...fixtureProof(f.c).definitionHashes,ready:f.next.modules[0].afterHash,effects:f.next.modules[1].afterHash},businessEffectsPerformanceRevision:f.next};
 const saved=process.env.MELISA_BUSINESS_EFFECTS_PERFORMANCE_REVISION;process.env.MELISA_BUSINESS_EFFECTS_PERFORMANCE_REVISION=JSON.stringify(f.next);
 try{assert.throws(()=>assertIsolatedCopyReadProof(f.c,current));let calls=0;await assert.rejects(configureBusinessEffectsPerformanceRevision(JSON.parse(JSON.stringify(f.c)),f.base,f.performance,f.next,{request:()=>{calls++;}}),{code:'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED'});assert.equal(calls,0);assert.throws(()=>registerIsolatedCopyEffectsPerformanceRevision(structuredClone(f.c),f.base,f.performance,f.next,f.proof));assert.throws(()=>assertIsolatedCopyReadProof(f.c,current));}finally{if(saved===undefined)delete process.env.MELISA_BUSINESS_EFFECTS_PERFORMANCE_REVISION;else process.env.MELISA_BUSINESS_EFFECTS_PERFORMANCE_REVISION=saved;}
});
test('actual web runtime projection and both test-health response expressions omit every residual/private capture field',()=>{
 const f=fixture(),forbidden=/baselineResiduals|residualExact8|accountBeforeHash|sourceWitnessHash|businessEffectsPerformanceRevision/;
 const projection=publicSharedCopyScope(f.c);assert.doesNotMatch('window.__MELISA_OPERATION_COPY__='+JSON.stringify(projection),forbidden);
 const web=fs.readFileSync(new URL('../../start-shared-test-copy-web.mjs',import.meta.url),'utf8');assert.match(web,/const publicScope=publicSharedCopyScope\(c\)/);const factory=fs.readFileSync(new URL('./sharedCopyWebApplication.mjs',import.meta.url),'utf8');assert.match(factory,/JSON\.stringify\(publicScope\)/);assert.match(web,/createSharedCopyWebApplication\(/);
 const expression=web.match(/health:(\{[^\n]+\}),/)[1],release={sourceCommit:'a'.repeat(40),packageId:'fixture'};
 assert.doesNotMatch(JSON.stringify(vm.runInNewContext('('+expression+')',{c:f.c,topology:{webPort:5234},release})),forbidden);
 const api=fs.readFileSync(new URL('../../start-shared-test-copy.mjs',import.meta.url),'utf8'),health=api.match(/const health=(\{[^\n]+\});/)[1];
 assert.doesNotMatch(JSON.stringify(vm.runInNewContext('('+health+')',{mode:'erp',port:4184,identity:{databaseName:f.c.target.database},writes:true,context:f.c,release})),forbidden);
});
