import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const currentFile=new URL('./p03-pr54-current-b007-successor.test.mjs',import.meta.url);
const current=fs.readFileSync(currentFile,'utf8');
// Reuse only existing in-memory history/epoch fixtures; never import their test suite or private artifacts.
let helpers=current.slice(0,current.indexOf("test('CurrentB007 tuple"))+current.slice(current.indexOf('function modeledProtectedParents()'),current.indexOf("test('CurrentB007 modeled admission"));
helpers=helpers.replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,currentFile).href)).replace("new URL('./p03-pr54-b264-successor.test.mjs',import.meta.url)","new URL('./p03-pr54-b264-successor.test.mjs',"+JSON.stringify(currentFile.href)+')');
const fixtureModule=await import('data:text/javascript;base64,'+Buffer.from(helpers+'\nexport {modeledFixture};').toString('base64'));
function rejects(fn,expected){let message;try{fn()}catch(e){message=e.message;}assert.equal(message,expected.message);}
const error=reason=>({message:'P03_OWNER_SUCCESSOR_REJECTED_CURRENT_B007_'+reason});
test('Current diagnostic says native continuity before known-expired before image and exposes no data',async()=>{const {f}=await fixtureModule.modeledFixture();f.now+=908000;f.nativeContinuity={};rejects(()=>f.mod.admitPr54CurrentB007Epoch(f),error('NATIVE_CONTINUITY'));});
test('fresh native capability still refuses900s before age with the specific reason',async()=>{const {f,fixture}=await fixtureModule.modeledFixture();f.now+=908000;f.current.observedAt=new Date(f.now).toISOString();f.observation={...f.observation,observedAt:f.current.observedAt};f.nativeContinuity=f.mod.preparePr54CurrentB007NativeContinuity(f.profile.businessDigest,f.snapshot,f.observation,f.backup,f.now);fixture.seal(f);rejects(()=>f.mod.admitPr54CurrentB007Epoch(f),error('BEFORE_AGE'));});
test('Current live60s age remains strict and earlier candidate/settings checks win',async()=>{let {f,fixture}=await fixtureModule.modeledFixture();f.current.observedAt=new Date(f.now-60000).toISOString();fixture.seal(f);rejects(()=>f.mod.admitPr54CurrentB007Epoch(f),error('CURRENT_AGE'));({f}=await fixtureModule.modeledFixture());f.candidate.erpSource='0'.repeat(40);f.now+=908000;rejects(()=>f.mod.admitPr54CurrentB007Epoch(f),error('CANDIDATE'));({f,fixture}=await fixtureModule.modeledFixture());f.before.profile.crmSource='0'.repeat(40);f.nativeContinuity={};fixture.seal(f);rejects(()=>f.mod.admitPr54CurrentB007Epoch(f),error('PROFILE_CANDIDATE'));});
test('early reasons retain first-failure order and native60s expiry without widening legacy messages',async()=>{
 for(const [reason,mutate,seal] of [
  ['SNAPSHOT_PATH',f=>f.profile.businessDigest.path='foreign',false],
  ['PINNED_BYTES',f=>f.profile.ownerSid='foreign',false],
  ['PROFILE_PATH',f=>f.before.runId='b264594b6f93d560d807c8decc4e6699',true],
  ['PROFILE_SCOPE',f=>f.before.copyId='foreign',true],
  ['SETTINGS',f=>f.before.newConfig={...f.before.newConfig,sha256:'0'.repeat(64)},true],
 ]){const {f,fixture}=await fixtureModule.modeledFixture();mutate(f);if(seal)fixture.seal(f);rejects(()=>f.mod.admitPr54CurrentB007Epoch(f),error(reason));}
 const {f}=await fixtureModule.modeledFixture();f.now+=60000;rejects(()=>f.mod.admitPr54CurrentB007Epoch(f),error('NATIVE_CONTINUITY'));
 const legacy=await fixtureModule.modeledFixture();rejects(()=>legacy.f.mod.admitPr54B264Sup20dCurrentEpoch(legacy.f),{message:'P03_OWNER_SUCCESSOR_REJECTED'});
});

function native21(f){const ref={...f.profile.businessDigest,path:f.profile.businessDigest.path.replace('20261020','20261021')},backup={...f.backup,runId:f.backup.runId.replace('20261020','20261021'),startedAt:f.backup.startedAt.replace('2026-10-20','2026-10-21')},now=f.now+86400000,observation={...f.observation,snapshotRef:ref,observedAt:new Date(now-1000).toISOString()};return {ref,snapshot:structuredClone(f.snapshot),observation,backup,now};}
test('fresh date21 revision remains a genuine Pre and does not overwrite or rebind backup identity',async()=>{
 const {f,fixture}=await fixtureModule.modeledFixture(),x=native21(f);x.ref.path=x.ref.path.replace('.json','-'+'ab01'.repeat(8)+'.json');x.observation.snapshotRef=x.ref;
 f.profile.businessDigest=x.ref;f.backup=x.backup;f.now=x.now;f.before.observedAt=new Date(x.now-2000).toISOString();f.current.observedAt=new Date(x.now-1000).toISOString();
 f.nativeContinuity=f.mod.preparePr54CurrentB007NativeContinuity(x.ref,x.snapshot,x.observation,x.backup,x.now);fixture.seal(f);f.physicalInspection=f.mod.mintModeledSup20dInspection(f);
 assert.equal(f.mod.admitPr54CurrentB007Epoch(f).applyExecuted,false);
 const old=x.ref.path;f.profile.businessDigest={...x.ref,path:old.replace('20261021','20261020')};rejects(()=>f.mod.admitPr54CurrentB007Epoch(f),error('SNAPSHOT_PATH'));
});
test('date21 native continuity exposes the first exact static stage with no guard or domain widening',async()=>{
 const cases=[['SNAPSHOT_REF',x=>x.ref.path='foreign'],['SNAPSHOT_LOG',x=>x.snapshot.logEndAfter+='0'],['BACKUP',x=>x.backup.startedAt='2026-10-20T23:59:59Z'],['OBSERVATION_SHAPE',x=>x.observation.extra=true],['DB_IDENTITY',x=>x.observation.copyId=x.observation.copyId.toUpperCase()],['DB_IDENTITY',x=>x.observation.queryStoreMode='READ_WRITE'],['GUID_LINK',x=>x.observation.databaseGuid='bad'],['GUID_LINK',x=>x.observation.backupLastRecoveryForkGuid='11111111-1111-1111-1111-111111111111'],['LOG_CONTINUITY',x=>x.observation.logEnd+='0'],['LOG_CONTINUITY',x=>x.observation.snapshotRef={...x.ref,sha256:'0'.repeat(64)}],['OBSERVATION_AGE',x=>x.observation.observedAt=new Date(x.now-60000).toISOString()]];
 for(const [stage,mutate]of cases){const {f}=await fixtureModule.modeledFixture(),x=native21(f);mutate(x);rejects(()=>f.mod.preparePr54CurrentB007NativeContinuity(x.ref,x.snapshot,x.observation,x.backup,x.now),error('CONTINUITY_'+stage));}
 const {f}=await fixtureModule.modeledFixture(),valid=native21(f);assert(Object.isFrozen(f.mod.preparePr54CurrentB007NativeContinuity(valid.ref,valid.snapshot,valid.observation,valid.backup,valid.now)));
 valid.observation.extra=true;valid.observation.queryStoreMode='READ_WRITE';rejects(()=>f.mod.preparePr54CurrentB007NativeContinuity(valid.ref,valid.snapshot,valid.observation,valid.backup,valid.now),error('CONTINUITY_OBSERVATION_SHAPE'));
});
test('historical20 continuity delegate keeps original generic rejection while date22 stays closed',async()=>{const {f}=await fixtureModule.modeledFixture();const bad={...f.observation,queryStoreMode:'READ_WRITE'};rejects(()=>f.mod.preparePr54CurrentB007NativeContinuity(f.profile.businessDigest,f.snapshot,bad,f.backup,f.now),{message:'P03_OWNER_SUCCESSOR_REJECTED'});const x=native21(f);x.ref.path=x.ref.path.replace('20261021','20261022');rejects(()=>f.mod.preparePr54CurrentB007NativeContinuity(x.ref,x.snapshot,x.observation,x.backup,x.now),error('CONTINUITY_SNAPSHOT_REF'));});
