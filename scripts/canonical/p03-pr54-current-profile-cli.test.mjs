import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {crm06StaffSuccessorProfile,CRM06_STAFF_CURRENT_CRM_SOURCE} from './crm06-staff-refresh-successor.mjs';
const source=fs.readFileSync(new URL('./p03-pr54-current-profile-cli.mjs',import.meta.url),'utf8');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const snapshot=String.raw`C:\Sirket\ERP\backups\P03-20261019-123456\source-pre-snapshot.json`;
const base=['--new-settings-sha256','a'.repeat(64),'--business-digest-path',snapshot,'--business-digest-sha256','b'.repeat(64)];
const currentSnapshot=snapshot.replace('20261019','20261020'),currentBase=base.map(value=>value===snapshot?currentSnapshot:value);
function fixture(args){
 const calls={pins:[],collect:0,legacyCollect:0,currentCollect:0,build:[],writer:[],logs:[]};
 const prepared={beforeImage:{path:'MEMORY-BEFORE',sha256:'c'.repeat(64)},profile:{path:'MEMORY-PROFILE',sha256:'d'.repeat(64)}};
 let code=source.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'').split('if(process.argv[1]&&pathToFileURL')[0].replaceAll('import.meta.url',JSON.stringify(import.meta.url));
 const context={process:{platform:'win32',argv:['node','profile-cli',...args],env:{}},Buffer,Map,JSON,Object,URL,crypto,path:path.win32,crm06StaffSuccessorProfile,CRM06_STAFF_CURRENT_CRM_SOURCE,
  fs:{readFileSync:()=>Buffer.from('synthetic-shell')},console:{log:v=>calls.logs.push(JSON.parse(v))},
  capturePr54B264CurrentOwner:async()=>{calls.collect++;calls.currentCollect++;return {oldObservation:{observedAt:'MEMORY-ONLY'},extras:{},oldSettings:{}};},
  capturePr54CurrentOwner:async()=>{calls.collect++;calls.legacyCollect++;return {oldObservation:{observedAt:'MEMORY-ONLY'},extras:{},oldSettings:{}};},
  buildP03PhysicalProfile:input=>{calls.build.push(input);return {summary:prepared};},
  fileURLToPath:()=> 'MEMORY-WRITER',execFileSync:(...args)=>{calls.writer.push(args);return JSON.stringify({status:'CREATED_PROTECTED',...prepared});},
 };
 vm.runInNewContext(code+`\npin=ref=>{calls.pins.push(ref);if(ref.path.endsWith('source-pre-snapshot.json'))return Buffer.from(JSON.stringify({database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',tables:Array(51)}));return Buffer.from('{}');};globalThis.run=main;`,Object.assign(context,{calls}));
 return {calls,run:()=>context.run()};
}
test('CurrentB007 selects only current settings and builder generation in the actual in-memory CLI flow',async()=>{
 for(const mode of [null,'DryRun','Create']){const f=fixture([...currentBase,'--generation','CurrentB007',...(mode?['--mode',mode]:[])]);await f.run();
 assert.equal(f.calls.collect,1);assert.equal(f.calls.currentCollect,1);assert.equal(f.calls.legacyCollect,0);assert.equal(f.calls.build.length,1);assert.equal(f.calls.writer.length,mode==='Create'?1:0);
 const request=f.calls.build[0],profile=crm06StaffSuccessorProfile(CRM06_STAFF_CURRENT_CRM_SOURCE,'erp-crm-current-20261020');
 assert.equal(request.newSettingsRef.path,profile.nextPaths.settings);assert.equal(request.newSettingsRef.sha256,'a'.repeat(64));assert.equal(request.generation,'pr54-current-b007-20261020');
 assert.equal(request.businessDigest.path,currentSnapshot);assert.equal(f.calls.logs[0].status,mode==='Create'?'CREATED_PROTECTED':'DRY_RUN_ONLY');assert.equal(f.calls.logs[0].applyExecuted,false);}
});
test('legacy default and explicit modes retain the exact settings, snapshot and writer protocol in memory',async()=>{
 for(const mode of [null,'DryRun','Create']){const f=fixture([...base,...(mode?['--mode',mode]:[])]);await f.run();assert.equal(f.calls.legacyCollect,1);assert.equal(f.calls.currentCollect,0);const request=f.calls.build[0];
  assert.equal(request.newSettingsRef.path,String.raw`C:\Sirket\ERP\runtime\terminal-completion-logon\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd.json`);assert.equal(request.generation,'pr54-reads-20261019');assert.equal(request.businessDigest.path,snapshot);
  assert.equal(f.calls.writer.length,mode==='Create'?1:0);if(mode==='Create'){assert.equal(f.calls.writer[0][1][3],'MEMORY-WRITER');assert.equal(f.calls.logs[0].status,'CREATED_PROTECTED');assert.equal(f.calls.logs[0].installed,false);}
 }
});
test('CurrentB007 rejects unknown, case aliases, duplicate or extra selectors before collection or any pin access',async()=>{
 const cases=[...['Other','currentb007','CURRENTB007',''].map(value=>[...base,'--generation',value]),[...base,'--generation','CurrentB007','--generation','CurrentB007'],[...base,'--generation','CurrentB007','--extra','value'],[...base,'--generation'],['--mode','DryRun','--generation','CurrentB007','--business-digest-path',snapshot]];
 for(const args of cases){const f=fixture(args);await assert.rejects(f.run(),/P03_CURRENT_PROFILE_(?:ARGUMENTS|FLAG|GENERATION)/);assert.equal(f.calls.collect,0);assert.equal(f.calls.pins.length,0);assert.equal(f.calls.writer.length,0);}
});
test('CurrentB007 and legacy keep separate exact dated snapshot gates',async()=>{
 const foreign=[snapshot,currentSnapshot.replace('20261020','20261021'),currentSnapshot.replace('123456','12345'),currentSnapshot+'-other',currentSnapshot.toUpperCase(),currentSnapshot.replace('C:\\Sirket\\ERP\\backups','C:\\Other\\backups')];
 for(const bad of foreign){const args=[...currentBase];args[3]=bad;const f=fixture([...args,'--generation','CurrentB007']);await assert.rejects(f.run(),/P03_CURRENT_PROFILE_SNAPSHOT_PATH/);assert.equal(f.calls.collect,0);assert.equal(f.calls.build.length,0);assert.equal(f.calls.pins.length,1);}
 const legacy=fixture(currentBase);await assert.rejects(legacy.run(),/P03_CURRENT_PROFILE_SNAPSHOT_PATH/);assert.equal(legacy.calls.collect,0);assert.equal(legacy.calls.build.length,0);
});


test('current preliminary collector reports only bounded public failure codes',()=>{
 const callback=source.match(/\.catch\((e=>\{[^\n]*\})\);/)[1];
 for(const [message,expected] of [['P03_B264_BEFORE_SQL_PROTECT','P03_B264_BEFORE_SQL_PROTECT'],['P03_CURRENT_PROFILE_HASH','P03_CURRENT_PROFILE_HASH'],['private detail must not escape','P03_CURRENT_PROFILE_REJECTED'],['P03_B264_BEFORE_'+ 'A'.repeat(181),'P03_CURRENT_PROFILE_REJECTED']]){
  const lines=[],process={exitCode:0},handler=vm.runInNewContext('('+callback+')',{process,console:{error:x=>lines.push(x)}});handler({message});assert.deepEqual(lines,[expected]);assert.equal(process.exitCode,1);
 }
});
