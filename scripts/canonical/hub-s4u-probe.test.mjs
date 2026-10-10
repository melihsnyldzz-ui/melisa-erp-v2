import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createS4uProbePlan,createHubTaskRecoveryPlan} from './hub-s4u-probe-plan.mjs';
import {evaluateS4uReadiness} from './hub-s4u-readiness-probe.mjs';
import {STACK_STAGES} from './hub-stack-driver.mjs';
const source='a'.repeat(40),sha='b'.repeat(64),sid='S-1-5-21-123-456-789-1001';
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
function fixture(){const root='C:\\Sirket\\ERP\\releases',runtime='C:\\Sirket\\ERP\\runtime';const components=Object.fromEntries(['erpApiNative','nativeOrder','crm','hub','edge'].map(name=>[name,{packageRoot:`${name==='crm'?'C:\\Sirket\\CRM\\releases':root}\\${name}`,sourceCommit:source,manifestSha256:sha,config:{path:`${runtime}\\hub\\${name}.json`,sha256:sha}}]));
 return {stack:{schemaVersion:1,ownerSid:sid,currentOwnerSid:sid,actualT1:false,copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',stableOrigin:'https://semih.tail295701.ts.net:8443',releaseRoots:[root,'C:\\Sirket\\CRM\\releases'],runtimeRoot:runtime,windowsRoot:'C:\\Windows',node:{path:'C:\\Program Files\\nodejs\\node.exe',sha256:sha},stackPackage:{packageRoot:`${root}\\stack`,sourceCommit:source,manifestSha256:sha,entrySha256:sha},startupConfig:{path:`${runtime}\\hub\\startup.json`,sha256:sha},components,privateSources:Object.fromEntries(['operationConfig','crmActivationConfig','nativeOrderConfig','hubPinConfig'].map(name=>[name,{path:`${runtime}\\hub\\${name}.json`,sha256:sha}])),dependencyLocks:Object.fromEntries(['erpApiNative','nativeOrder','crm'].map(name=>[name,{path:components[name].packageRoot+'\\hub-dependency-lock.json',sha256:sha}])),crmPrivateFiles:{baseline:{path:'C:\\private\\baseline.env',sha256:sha},catalogAccess:{path:`${runtime}\\hub\\access.json`,sha256:sha}}},probeId:'11111111-1111-4111-8111-111111111111',probeEntrySha256:sha};}
function snapshot(){const xml=`<Task><Principals><Principal><UserId>${sid}</UserId><RunLevel>LeastPrivilege</RunLevel></Principal></Principals></Task>`,sddl=`O:${sid}G:${sid}D:(A;;FA;;;${sid})`;return {schemaVersion:1,taskPath:'\\',taskName:'Melisa-Hub-TEST-Web',ownerSid:sid,xml,sddl,xmlSha256:digest(xml),sddlSha256:digest(sddl)};}
test('ephemeral same-owner S4U Limited probe XML has no trigger/retry and a bounded 90 second run',()=>{
 const p=createS4uProbePlan(fixture());assert.equal(p.installed,false);assert.equal(p.executed,false);assert.match(p.taskXml,/<Triggers \/>/);assert.match(p.taskXml,/<ExecutionTimeLimit>PT90S<\/ExecutionTimeLimit>/);assert.match(p.taskXml,/<LogonType>S4U<\/LogonType><RunLevel>LeastPrivilege<\/RunLevel>/);assert.match(p.taskXml,/-Action Probe/);assert.doesNotMatch(p.taskXml,/RestartOnFailure|HighestAvailable|ServiceAccount|-Action Start|BootTrigger|LogonTrigger/);assert.equal(p.permissionChanges.length,0);
 for(const key of ['password','taskName','ports'])assert.throws(()=>createS4uProbePlan({...fixture(),[key]:'bad'}));
 const other=fixture();other.stack.currentOwnerSid+='2';assert.throws(()=>createS4uProbePlan(other));
});
test('recovery uses exact hashes and preserves unrelated tasks; old Hub disable is separately explicit and review-only',()=>{
 const p=createHubTaskRecoveryPlan(snapshot());assert.equal(p.applied,false);assert.equal(p.steps.length,2);assert.equal(p.stopProcesses,false);assert.equal(p.restoreDatabase,false);
 assert.equal(createHubTaskRecoveryPlan(snapshot(),{approvedDisableHubAtLogon:true}).steps.length,3);
 for(const key of ['xmlSha256','sddlSha256','ownerSid','taskName'])assert.throws(()=>createHubTaskRecoveryPlan({...snapshot(),[key]:'bad'}));
 const wrong=snapshot();wrong.xml=wrong.xml.replace('LeastPrivilege','HighestAvailable');wrong.xmlSha256=digest(wrong.xml);assert.throws(()=>createHubTaskRecoveryPlan(wrong));
 const omitted=snapshot();omitted.xml=omitted.xml.replace('<RunLevel>LeastPrivilege</RunLevel>','');omitted.xmlSha256=digest(omitted.xml);
 const unchanged=omitted.xml;assert.equal(createHubTaskRecoveryPlan(omitted).reviewOnly,true);assert.equal(omitted.xml,unchanged);
});
function mock(s,extra={}){const events=[];return {events,async verifyPins(){events.push('pins');},async sqlReady(){events.push('sql');return {ready:true,readOnlyProbe:true,database:s.database,copyId:s.copyId};},async inspect(stage){events.push(stage.name);return [];},async start(){assert.fail('Probe cannot start a service');},async stopOwned(){assert.fail('Probe cannot stop a service');},...extra};}
const context={ownerSid:sid,logonType:4,sessionId:0,elevated:false,profileAvailable:true};
test('cold noninteractive probe checks actual batch token/profile/pins/SQL then reports absent services without starting them',async()=>{
 const s=fixture().stack,d=mock(s),p=await evaluateS4uReadiness(s,context,d);assert.equal(p.state,'PREFLIGHT_VERIFIED');assert.equal(p.actualBootTested,false);assert.equal(p.candidatePortsAvailable,true);assert.equal(p.candidateStackReady,false);assert.equal(p.humanAcceptance,'PENDING');assert.equal(p.services.length,8);assert(p.services.every(x=>x.state==='NOT_RUNNING'));assert.deepEqual(d.events.slice(0,2),['pins','sql']);assert.doesNotMatch(JSON.stringify(p),/password|sqlUser|username|token|profilePath/i);
});
test('interactive/elevated/foreign/profile-missing or bad SQL fails closed before any service control',async()=>{
 const s=fixture().stack;
 for(const [key,value] of Object.entries({ownerSid:'foreign',logonType:2,sessionId:1,elevated:true,profileAvailable:false})){const d=mock(s);await assert.rejects(evaluateS4uReadiness(s,{...context,[key]:value},d),/NONINTERACTIVE_IDENTITY_REJECTED/);assert.equal(d.events.length,0);}
 await assert.rejects(evaluateS4uReadiness(s,context,mock(s,{async sqlReady(){return {ready:false};}})),/SQL_IDENTITY_REJECTED/);
 const d=mock(s,{async inspect(){return [{pid:99}];},async existingReceipt(){return null;}});const p=await evaluateS4uReadiness(s,context,d);assert.equal(p.accessPreflightVerified,true);assert.equal(p.candidateStackReady,false);assert.equal(p.candidatePortsAvailable,false);assert(p.services.every(item=>item.state==='BASELINE_OR_FOREIGN_OCCUPIED'&&item.adoptable===false));
});
test('PowerShell 5.1 parses probe/snapshot source offline; no registration/UAC/grants/provider/foreign stop commands exist',()=>{
 const names=['hub-s4u-readiness-probe.ps1','hub-task-review-snapshot.ps1'];
 for(const name of names){const text=fs.readFileSync(new URL(name,import.meta.url),'utf8');assert.doesNotMatch(text,/Register-ScheduledTask|Unregister-ScheduledTask|Disable-ScheduledTask|Enable-ScheduledTask|Set-ScheduledTask|Stop-Process|RunAs|SeBatchLogonRight|SetSecurityDescriptor|tailscale serve|Set-NetFirewall/i);}
 const shell='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
 const script=names.map(name=>`$e=$null;[System.Management.Automation.Language.Parser]::ParseFile('${new URL(name,import.meta.url).pathname.slice(1).replaceAll('/','\\\\')}',[ref]$null,[ref]$e)|Out-Null;if($e.Count){throw 'PARSER_FAILED'}`).join('\n');
 const result=spawnSync(shell,['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);
});
test('batch token reader compiles offline and Windows native structure offsets match; no token/query is executed',()=>{
 const source=fs.readFileSync(new URL('./hub-s4u-readiness-probe.ps1',import.meta.url),'utf8');const code=source.split("Add-Type -TypeDefinition @'\n")[1].split("\n'@")[0];
 const script=`Add-Type -TypeDefinition @'\n${code}\n'@\nif([Runtime.InteropServices.Marshal]::OffsetOf([HubS4uToken+LogonSession],'LogonType').ToInt32() -ne 64){throw 'LAYOUT_REJECTED'}`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);
});
