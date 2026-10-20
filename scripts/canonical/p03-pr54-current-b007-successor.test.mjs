import test from 'node:test';import assert from 'node:assert/strict';import * as api from './p03-pr54-owner-successor.mjs';
const root='C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018';
function currentCandidate(){return {erpSource:'6dc33f41737349c6e3f17fb867a451b570a00acc',erpManifest:'6bdf40638a3e4816e1b22f6c5c7c3f400de1ef47cd78d72b22bf075f2de9ca49',crmSource:'7ba6e4ebc8b70019136d603e6307741189ba03c1',crmManifest:'820cbf0f0002a7bcd6ce4d2e629d4e1c690027bb3243aa04b19a8ac0aa9edf35',supervisorSource:'b007317f03e6be2c3a3d2271428dcf9dec33e04e',supervisorManifest:'365dc4dd287fb05d171ca30f8c9e8abb037f9d9d5382a79f61fa9356f8d21eac',supervisorRoot:'C:\\Sirket\\ERP\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261020-b007317f03e6',newSettings:{path:'C:\\Sirket\\ERP\\runtime\\terminal-completion-logon\\settings-crm06-staff-7ba6e4ebc8b7-erp-6dc33f417373-current.json',sha256:'de54c4da7f5b33a5f41b94624f01df4eb315dfa6a20fd2826af9ca37538d3942'}};}
test('CurrentB007 tuple is exact and uses a fresh claim without reopening consumed B264 claims',()=>{
 const c=currentCandidate();assert.deepEqual(api.assertPr54CurrentB007Candidate(c),c);assert.equal(api.PR54_CURRENT_B007_SUCCESSOR_CLAIM_PATH,root+'\\p03-pr54-current-b007-successor-of-b264594b6f93d560d807c8decc4e6699.lock.json');assert.notEqual(api.PR54_CURRENT_B007_SUCCESSOR_CLAIM_PATH,api.PR54_B264_SUCCESSOR_CLAIM_PATH);
 for(const mutate of [x=>x.erpSource='0'.repeat(40),x=>x.crmManifest='0'.repeat(64),x=>x.supervisorSource=api.PR54_B264_SUP20D_SUPERVISOR.sourceCommit,x=>x.newSettings.sha256=api.PR54_B264_SUP20D_SETTINGS_SHA256,x=>x.newSettings.path=x.newSettings.path.toUpperCase(),x=>x.extra=true]){const bad=currentCandidate();mutate(bad);assert.throws(()=>api.assertPr54CurrentB007Candidate(bad));}
 assert.throws(()=>api.assertPr54B264Sup20dCandidate(c));assert.throws(()=>api.assertPr54B264SuccessorCandidate(c));
});

// Reuse existing modeled history fixtures only. No private proof files or OS
// callbacks are read; this remains a modeled source proof, not admission.
async function modeledFixture(){
 const fs=await import('node:fs');
 const file=new URL('./p03-pr54-b264-successor.test.mjs',import.meta.url),legacy=fs.readFileSync(file,'utf8');
 let code=legacy.slice(0,legacy.indexOf("test('existing 639"))
  +legacy.slice(legacy.indexOf('function modeledModule(history){'),legacy.indexOf("test('modeled restored OLD"))
  +legacy.slice(legacy.indexOf('function currentEpochFixture(){'),legacy.indexOf("test('new current epoch"))
  +legacy.slice(legacy.indexOf('function sup20dCandidate(){'),legacy.indexOf("test('Sup20D candidate"));
 code=code.replace("'validateP03ProtectedSqlService',code+","'validateP03ProtectedSqlService','lookupPr54CurrentB007PhysicalInspection',code+")
  .replace('return {admitPr54B264OwnerSuccessor,','return {admitPr54CurrentB007Epoch,admitPr54B264OwnerSuccessor,')
  .replace('},validateP03ProtectedSqlService);','},validateP03ProtectedSqlService,sup20dLookup);');
 code=code.replaceAll('import.meta.url',JSON.stringify(file.href)).replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,file).href));
 const fixture=await import('data:text/javascript;base64,'+Buffer.from(code+'\nexport {sup20dEpochFixture,seal,p03TransitionDigest,hash};').toString('base64'));
 const f=fixture.sup20dEpochFixture(),c=currentCandidate(),old=f.profile.oldSettings,oldRoot='C:\\Sirket\\ERP\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261018-13bdf75a032a';
 f.candidate=c;f.profile.newSettings=c.newSettings;f.before.newConfig=c.newSettings;f.before.profile=Object.fromEntries(['erpSource','erpManifest','crmSource','crmManifest','supervisorSource','supervisorManifest'].map(k=>[k,c[k]]));
 f.before.plan.newSettingsSha256=c.newSettings.sha256;f.before.plan.digest=fixture.p03TransitionDigest(f.before.plan);
 f.profile.packages=[...f.profile.packages.slice(0,4),...[
  {root:'C:\\Sirket\\ERP\\releases\\CANONICAL-CANDIDATE-TEST-20261020-6dc33f41',sourceCommit:c.erpSource,manifestSha256:c.erpManifest},
  {root:'C:\\Sirket\\CRM\\releases\\node-v24.19.0\\crm-shared-test-'+c.crmSource,sourceCommit:c.crmSource,manifestSha256:c.crmManifest},
  {root:c.supervisorRoot,sourceCommit:c.supervisorSource,manifestSha256:c.supervisorManifest},
 ].map(p=>({...p,manifestPath:p.root+'\\release-manifest.json'}))];
 for(const t of f.profile.tasks){t.newXml=t.oldXml.replaceAll(oldRoot,c.supervisorRoot).replaceAll(old.path,c.newSettings.path).replaceAll(old.sha256,c.newSettings.sha256);t.newXmlSha256=fixture.hash(t.newXml);}
 fixture.seal(f);f.physicalInspection=f.mod.mintModeledSup20dInspection(f);return {f,fixture};
}
test('CurrentB007 modeled admission retains old4 plus exact new3 and immutable failed history with no transition authority',async()=>{
 const {f}=await modeledFixture(),history=JSON.stringify(f.raw),r=f.mod.admitPr54CurrentB007Epoch(f);
 assert.equal(r.claimPath,api.PR54_CURRENT_B007_SUCCESSOR_CLAIM_PATH);assert.equal(r.claim.schemaVersion,'melisa-p03-current-b007-epoch-proposal.v1');assert.equal(r.transitionAuthority,false);assert.equal(r.applyExecuted,false);assert.equal(f.profile.packages.length,7);assert.equal(JSON.stringify(f.raw),history);
});
test('CurrentB007 modeled admission rejects package union, native/physical, birth, COM, raw and protected SQL drift',async()=>{
 const mutations=[f=>f.profile.packages.pop(),f=>f.profile.packages.push(f.profile.packages[0]),f=>f.profile.packages[0].manifestSha256='f'.repeat(64),f=>f.profile.packages[5].root+='-other',f=>f.nativeContinuity={},f=>f.physicalInspection={},f=>f.current.runningInstances[0].enginePid++,f=>f.current.processes[0].creationTime='2026-10-19T13:01:30.1111112Z',f=>f.current.processes.push({...f.current.processes[0],pid:999999}),f=>f.profile.protectedProcesses[0].service.startName='OTHER',f=>f.before.actualT1=true,f=>f.before.copyId='foreign',f=>f.profile.newSettings.sha256=api.PR54_B264_SUP20D_SETTINGS_SHA256];
 for(const mutate of mutations){const {f,fixture}=await modeledFixture(),token=f.physicalInspection;mutate(f);fixture.seal(f);if(f.physicalInspection===token)f.physicalInspection=f.mod.mintModeledSup20dInspection(f);assert.throws(()=>f.mod.admitPr54CurrentB007Epoch(f),mutate.toString());}
});
