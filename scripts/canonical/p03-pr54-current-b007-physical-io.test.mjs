import test from 'node:test';import assert from 'node:assert/strict';import * as api from './p03-pr54-shared-owner-io.mjs';
 test('CurrentB007 physical validator rejects forged policy and remains a frame-only check',()=>{assert.equal(typeof api.validatePr54CurrentB007PhysicalInspection,'function');for(const frame of [{},{schemaVersion:'melisa-p03-b264-precut-inspection.v1',policyGeneration:'B264Sup20DInspectOnly'},{schemaVersion:'melisa-p03-b264-precut-inspection.v1',policyGeneration:'CurrentB007InspectOnly',transitionAuthority:true}])assert.throws(()=>api.validatePr54CurrentB007PhysicalInspection({frame}));});

import fs from 'node:fs';
async function currentFixture(){
 const file=new URL('./p03-pr54-b264-physical-io.test.mjs',import.meta.url),legacy=fs.readFileSync(file,'utf8');
 const segment=(name,end)=>legacy.slice(legacy.indexOf(name),legacy.indexOf(end,legacy.indexOf(name)));
 let code=legacy.slice(0,legacy.indexOf("test('Legacy B264"))+segment('function contractFixture(',"test('PS5 shared B264")+segment('function physicalFixture(',"test('B264 full frame")+segment('function sup20dInput(',"test('Sup20d inspection arguments");
 code=code.replaceAll('import.meta.url',JSON.stringify(file.href)).replace(/from '(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,file).href));
 const fixture=await import('data:text/javascript;base64,'+Buffer.from(code+'\nexport {physicalFixture};').toString('base64'));
 const f=fixture.physicalFixture(true);f.frame.policyGeneration='CurrentB007InspectOnly';f.frame.protectedConsolePins=[];f.current.policyGeneration='CurrentB007InspectOnly';f.engineRef={path:String.raw`C:\Sirket\ERP\runtime\P03-OWNER-20261018\MelisaERP-P03-current-b007-control-123456abcdef\p03-physical-rollback-lifetime-v2.ps1`,sha256:'b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f'};f.refs.engineRef=f.engineRef;f.frame.engineSha256=f.engineRef.sha256;return f;
}
test('CurrentB007 full physical frame preserves ten identities, raw/COM/port/protected-native and freshness checks',async()=>{
 const f=await currentFixture();assert.equal(api.validatePr54CurrentB007PhysicalInspection(f).length,3);
 for(const mutate of [x=>x.frame.engineSha256='99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def',x=>x.frame.oldIdentities.pop(),x=>x.current.runningInstances[0].enginePid++,x=>x.current.processes.push({...x.current.processes[0],pid:999}),x=>x.frame.protectedProcesses=[],x=>x.frame.observedAt='2026-10-19T00:00:00Z',x=>x.current.bindings.push({pid:40,port:99,address:'127.0.0.1'}),x=>x.frame.consolePins[0].parentPid=999]){const x=await currentFixture();mutate(x);assert.throws(()=>api.validatePr54CurrentB007PhysicalInspection(x));}
});

import * as physical from './p03-pr54-b264-physical-io.mjs';
test('CurrentB007 collector exists separately and rejects a fabricated admission token',()=>{assert.equal(typeof physical.pr54CurrentB007InspectionArguments,'function');assert.equal(typeof physical.inspectPr54CurrentB007PhysicalOwner,'function');assert.equal(physical.lookupPr54CurrentB007PhysicalInspection({},{}),null);});

import vm from 'node:vm';import path from 'node:path';import {createHash} from 'node:crypto';
function bindCurrentRefs(f){
 const dir=path.win32.dirname(f.engineRef.path),root=path.win32.dirname(dir);
 f.refs.recoveryHelperRef={path:root+'\\p03-pr54-paused-old-recover.ps1',sha256:'e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5'};
 f.refs.drainerRef={path:dir+'\\p03-pr54-successor-core-drain.ps1',sha256:'97cee59bd1dcd3eedc53f3eba07f261c095674f49fa168a5f074ff7e08c95f19'};
 f.refs.observerRef={path:dir+'\\p03-physical-recovery-observe.ps1',sha256:'1a76fd772aba76ed318e0624ab35fceb6067750394aeaec35acbcb1d055c3dbd'};f.recoveryHelperRef=f.refs.recoveryHelperRef;return f;
}
test('CurrentB007 Inspect argv binds engine/control siblings, unchanged helper and unique profile run; mutation flags reject',async()=>{
 const f=bindCurrentRefs(await currentFixture()),argv=physical.pr54CurrentB007InspectionArguments(f.refs);assert(argv.worker.includes('CurrentB007InspectOnly'));assert(argv.worker.includes('Inspect'));assert(argv.observer.includes('Physical'));
 for(const mutate of [x=>x.engineRef.sha256='f'.repeat(64),x=>x.engineRef.path=x.engineRef.path.toUpperCase(),x=>x.observerRef.path=x.observerRef.path.replace('123456abcdef','abcdef123456'),x=>x.recoveryHelperRef.path=x.drainerRef.path,x=>x.drainerRef.sha256='f'.repeat(64),x=>x.beforeRef.path=x.beforeRef.path.replace('a'.repeat(32),'b264594b6f93d560d807c8decc4e6699'),x=>x.mode='Drain',x=>x.transport=()=>{}]){const refs=structuredClone(f.refs);mutate(refs);assert.throws(()=>physical.pr54CurrentB007InspectionArguments(refs));}
});
async function collectorFixture(){
 const f=bindCurrentRefs(await currentFixture()),map=new WeakMap(),events=[],encode=o=>Buffer.from(JSON.stringify(o)),hash=b=>createHash('sha256').update(b).digest('hex');
 const context={input:f.refs,process:{platform:'win32'},fs:{existsSync:()=>false},Date,Object,JSON,Buffer,hash,bytes:encode,inspections:map,need:(v,c)=>{if(!v)throw Error(c);},shell:'memory',PR54_CURRENT_B007_SUCCESSOR_CLAIM_PATH:'CURRENT_ONLY_CLAIM',pr54CurrentB007InspectionArguments:physical.pr54CurrentB007InspectionArguments,assertPr54CurrentB007Candidate:()=>true,validatePr54CurrentB007PhysicalInspection:api.validatePr54CurrentB007PhysicalInspection,collectPr54CurrentInspectionPair:api.collectPr54CurrentInspectionPair,pr54CollectPhysicalObservation:api.pr54CollectPhysicalObservation,
 inspectPr54B264PredecessorIO:async()=>{events.push('history');},read:r=>r.path===f.profileRef.path?encode(f.profile):r.path===f.beforeRef.path?encode(f.before):Buffer.from('pinned source'),pinnedInvocation:(_ref,argv)=>argv,run:async(_exe,args)=>{events.push(args);return {stderr:'',stdout:JSON.stringify(args.includes('-Mode')?f.frame:f.current)};}};
 return {f,context,events,invoke:()=>vm.runInNewContext('('+physical.inspectPr54CurrentB007PhysicalOwner.toString()+')(input)',context),lookup:vm.runInNewContext('('+physical.lookupPr54CurrentB007PhysicalInspection.toString()+')',context)};
}
test('CurrentB007 real collector body mints only private short-lived immutable frame token after whole-pair rechecks',async()=>{
 const t=await collectorFixture(),r=await t.invoke(),args={current:r.current,profile:r.profile,before:r.before,profileRef:t.f.profileRef,beforeRef:t.f.beforeRef,now:t.f.now};assert.equal(r.status,'CURRENT_B007_PHYSICAL_INSPECTED_READ_ONLY');assert.equal(r.transitionAuthority,false);assert.equal(r.claimCreated,false);assert.equal(t.lookup(r.physicalInspection,args).length,3);assert.equal(t.events.filter(e=>e==='history').length,3);
 for(const token of [{},{...r.physicalInspection}])assert.equal(t.lookup(token,args),null);assert.equal(physical.lookupPr54B264Sup20dPhysicalInspection(r.physicalInspection,args),null);assert.equal(t.lookup(r.physicalInspection,{...args,current:structuredClone(args.current)}),null);assert.equal(t.lookup(r.physicalInspection,{...args,now:t.f.now+60000}),null);args.current.processes[0].parentPid++;assert.equal(t.lookup(r.physicalInspection,args),null);
});
test('CurrentB007 collector rejects consumed current claim, source changes, raw/worker drift and stderr without mutation',async()=>{
 for(const mutate of [t=>t.context.fs.existsSync=()=>true,t=>t.context.run=async()=>({stdout:'{}',stderr:'ERROR'}),t=>t.f.current.rawScope.unverifiedCount=1,t=>t.f.frame.protectedProcesses=[],t=>t.f.frame.policyGeneration='B264Sup20DInspectOnly',t=>{const read=t.context.read;let n=0;t.context.read=r=>{const b=read(r);return ++n>6?Buffer.from('changed'):b;};}]){const t=await collectorFixture();mutate(t);await assert.rejects(t.invoke());}
 assert.doesNotMatch(physical.inspectPr54CurrentB007PhysicalOwner.toString(),/CreateNew|writeFile|Stop-Process|RegisterTask|DrainWorkerCore/);
});

test('CurrentB007 terminal churn diagnostic retains only the last complete raw/worker pair after three whole-pair retries',async()=>{
 const t=await collectorFixture();let pairs=0;const original=t.context.run;t.context.run=async(exe,args)=>{if(!args.includes('-Mode')){pairs++;t.f.current.processes=t.f.current.processes.filter(p=>p.pid<800);t.f.current.processes.push({...t.f.current.processes[0],pid:800+pairs,commandLine:'private-command-do-not-emit',nodePath:'private-node-do-not-emit'});}return original(exe,args);};
 await assert.rejects(t.invoke(),error=>{assert.equal(error.message,'P03_SHARED_CURRENT_AUX_FRAME_CHANGED');const d=error.p03CurrentB007Diagnostic;assert(d);assert.equal(pairs,3);assert.deepEqual(Array.from(d.extraPids,x=>x.pid),[803]);assert.equal(d.counts.rawExtras,4);assert.equal(d.counts.expectedAuxiliary,3);assert.equal(d.counts.completedPairs,3);assert.equal(d.missingAuxiliaryPids.length,0);assert.match(d.extraPids[0].identitySha256,/^[a-f0-9]{64}$/);assert.equal(d.pins.engine,t.f.refs.engineRef.sha256);assert(Object.isFrozen(d)&&Object.isFrozen(d.extraPids)&&Object.isFrozen(d.extraPids[0])&&Object.isFrozen(d.counts)&&Object.isFrozen(d.pins));const text=JSON.stringify(d);assert(!text.includes('private-command-do-not-emit'));assert(!text.includes('private-node-do-not-emit'));assert(!text.includes('commandLine'));assert(!text.includes('env'));return true;});
});
test('CurrentB007 identity drift diagnostic neither retries permanent identity failure nor grants a physical token',async()=>{
 const t=await collectorFixture();const pid=t.f.frame.consolePins[0].pid;t.f.current.processes=structuredClone(t.f.current.processes);t.f.current.processes.find(p=>p.pid===pid).parentPid=999;
 await assert.rejects(t.invoke(),error=>{assert.equal(error.message,'P03_SHARED_CURRENT_AUX_IDENTITY');const d=error.p03CurrentB007Diagnostic;assert(d);assert.equal(d.counts.completedPairs,1);assert.equal(d.extraPids.length,0);assert.equal(d.missingAuxiliaryPids.length,0);assert.equal(d.identityDrift.find(x=>x.pid===pid).identityMatches,false);assert(d.identityDrift.find(x=>x.pid===pid).expectedIdentitySha256!==d.identityDrift.find(x=>x.pid===pid).rawIdentitySha256);assert.equal(physical.lookupPr54CurrentB007PhysicalInspection(error,{}),null);return true;});
});
test('CurrentB007 diagnostic separates protected typed-envelope identity mismatch from missing protected PID',async()=>{
 for(const absent of [false,true]){const t=await collectorFixture(),protectedRow=t.f.profile.protectedProcesses[0];if(absent)t.f.current.processes=t.f.current.processes.filter(p=>p.pid!==protectedRow.pid);else t.f.current.processes.push({...protectedRow,parentPid:123});
 // Force the existing validator error so the diagnostic alone is examined; no guard is relaxed.
 t.context.validatePr54CurrentB007PhysicalInspection=()=>{throw Error('P03_SHARED_CURRENT_AUX_FRAME_CHANGED');};
 await assert.rejects(t.invoke(),error=>{const row=error.p03CurrentB007Diagnostic?.protectedProcesses[0];assert(row);assert.equal(row.pid,protectedRow.pid);assert.equal(row.kind,'ProtectedSqlService');assert.equal(row.presentInRaw,!absent);assert.equal(row.identityMatches,false);assert.equal(row.rawIdentitySha256===null,absent);return true;});}
});

function withProtectedConsoles(f){
 const creationTime=f.before.identities.hub.creationTime;
 for(let n=0;n<3;n++){
  const parent={...f.before.identities.hub,pid:110+n,parentPid:1,commandLine:'preserved TEST125 node '+n,bindings:[]};f.profile.protectedProcesses.push(parent);f.current.processes.push({...parent});
  const pin={pid:160+n,parentPid:parent.pid,nodePath:String.raw`C:\Windows\System32\conhost.exe`,ownerSid:parent.ownerSid,commandLine:String.raw`\??\C:\WINDOWS\system32\conhost.exe 0x4`,creationTime};f.frame.protectedConsolePins.push(pin);f.current.processes.push({...pin});
 }return f;
}
test('CurrentB007 separately authenticates three readonly protected TEST consoles without changing owned stop auxiliaries',async()=>{
 const f=withProtectedConsoles(await currentFixture()),before=JSON.stringify({profile:f.profile,frame:f.frame,current:f.current}),result=api.validatePr54CurrentB007PhysicalInspection(f);
 assert.equal(result.length,6);assert.equal(f.frame.consolePins.length,3);assert.equal(f.frame.probePins.length,0);assert.equal(f.frame.protectedConsolePins.length,3);assert.equal(JSON.stringify({profile:f.profile,frame:f.frame,current:f.current}),before);assert(Object.isFrozen(result)&&result.every(Object.isFrozen));for(const p of f.frame.protectedConsolePins)assert(result.some(q=>q.pid===p.pid));assert.equal(physical.lookupPr54CurrentB007PhysicalInspection(result,{}),null);
});
test('CurrentB007 readonly protected console rejects foreign/SQL/missing/drifting parents, listeners, duplicate/owned pins and birth/source/ref forgery',async()=>{
 const mutate=[f=>f.frame.protectedConsolePins[0].parentPid=777,f=>f.frame.protectedConsolePins[0].parentPid=99,f=>f.current.processes=f.current.processes.filter(p=>p.pid!==110),f=>f.current.processes.find(p=>p.pid===110).commandLine+=' changed',f=>f.current.bindings.push({pid:160,port:5999,address:'127.0.0.1'}),f=>f.current.processes.find(p=>p.pid===160).bindings=[{port:5999,address:'127.0.0.1'}],f=>f.frame.protectedConsolePins.push({...f.frame.protectedConsolePins[0]}),f=>f.frame.protectedConsolePins[0].pid=f.before.identities.hub.pid,f=>f.frame.protectedConsolePins[0].pid=f.frame.consolePins[0].pid,f=>f.frame.protectedConsolePins[0].creationTime='2026-10-19T00:00:00.0000000Z',f=>f.frame.protectedConsolePins[0].creationTime='2099-01-01T00:00:00.0000000Z',f=>f.frame.protectedConsolePins[0].commandLine+=' -extra',f=>f.frame.protectedConsolePins[0].nodePath=String.raw`C:\temp\conhost.exe`,f=>f.frame.protectedConsolePins[0].ownerSid='foreign',f=>f.frame.protectedConsolePins[0].signatureValid=true,f=>f.frame.protectedConsolePins[0].sourcePath='untrusted',f=>f.frame.profileSha256='f'.repeat(64),f=>f.frame.engineSha256='f'.repeat(64),f=>f.frame.policyGeneration='B264Sup20DInspectOnly'];
 for(const change of mutate){const f=withProtectedConsoles(await currentFixture());change(f);assert.throws(()=>api.validatePr54CurrentB007PhysicalInspection(f),change.toString());}
});
test('CurrentB007 genuine collector alone carries readonly protected consoles into private raw coverage; cloned witness cannot authorize',async()=>{
 const t=await collectorFixture();withProtectedConsoles(t.f);const r=await t.invoke(),args={current:r.current,profile:r.profile,before:r.before,profileRef:t.f.profileRef,beforeRef:t.f.beforeRef};const coverage=t.lookup(r.physicalInspection,args);assert.equal(coverage.length,6);assert(Object.isFrozen(coverage));assert.equal(t.lookup({...r.physicalInspection},args),null);assert.equal(physical.lookupPr54B264Sup20dPhysicalInspection(r.physicalInspection,args),null);assert.equal(r.frame,undefined);assert.equal(r.profile.protectedProcesses.length,4);assert.equal(t.f.frame.consolePins.length,3);assert.equal(r.stopAuthority,false);
});

test('CurrentB007 protected console accepts six/seven-digit equivalent birth only and reports failed pins without authentication claims',async()=>{
 const f=withProtectedConsoles(await currentFixture());for(const p of f.frame.protectedConsolePins)p.creationTime=p.creationTime.replace(/(\.\d{6})0Z$/,'$1Z');assert.equal(api.validatePr54CurrentB007PhysicalInspection(f).length,6);
 const t=await collectorFixture();withProtectedConsoles(t.f);t.f.frame.protectedConsolePins[0].parentPid=777;await assert.rejects(t.invoke(),error=>{assert.match(error.message,/PROTECTED_CONSOLE_PARENT/);const d=error.p03CurrentB007Diagnostic;assert.equal(d.counts.reportedProtectedConsoles,3);assert.equal(d.reportedProtectedConsolePins.length,3);assert(Object.isFrozen(d.reportedProtectedConsolePins)&&d.reportedProtectedConsolePins.every(Object.isFrozen));assert.deepEqual(Object.keys(d.reportedProtectedConsolePins[0]).sort(),['identitySha256','pid']);return true;});
});
test('legacy physical validators retain old schema and reject the Current-only protected console witness field',async()=>{
 const f=await currentFixture();delete f.frame.protectedConsolePins;f.frame.policyGeneration='B264Sup20DInspectOnly';f.frame.engineSha256=f.engineRef.sha256='99b90fbd359852818bf1f7bf3c938d0ec0c3621f4fedccca3bf4951e6ef76def';assert.equal(api.validatePr54B264Sup20dPhysicalInspection(f).length,3);f.frame.protectedConsolePins=[];assert.throws(()=>api.validatePr54B264Sup20dPhysicalInspection(f));
});
