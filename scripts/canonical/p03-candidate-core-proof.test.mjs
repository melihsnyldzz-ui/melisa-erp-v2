import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPLETION_CORE_STAGES} from './terminal-completion-logon.mjs';
import {proveP03CandidateCore} from './p03-candidate-core-proof.mjs';
import {CRM06_STAFF_INTEGRATED_CRM_PACKAGE,CRM06_STAFF_ERP_INTEGRATED_PACKAGE,crm06StaffSuccessorProfile,CRM06_STAFF_INTEGRATED_CRM_SOURCE} from './crm06-staff-refresh-successor.mjs';

const owner='S-1-5-21-123-456-789-1001',source='b'.repeat(40),hash='a'.repeat(64);
const erp='C:\\Sirket\\ERP',crm='C:\\Sirket\\CRM';
function settings(){
 const refs=Object.fromEntries(['operationConfig','nativeOrderConfig','crmActivationConfig','hubPinConfig','hubStartupConfig'].map(key=>[key,{path:`${erp}\\runtime\\completion\\${key}.json`,sha256:hash}]));
 const packageRoot=erp+'\\releases\\CANONICAL-COMPLETE-TEST-20261011-bbbbbbb';
 const nativePin={packageRoot:'C:\\Sirket\\ERP\\releases\\CRM-ORDER-DRAFT-TEST-20261013-7a41f64',sourceCommit:'7a41f6492273dd1ec0bcb086f820be5575372be8',manifestSha256:'6cb0d29fbc541844a4fe95fc288c743ba3be8cdb617b32a4ca9ed986e9557f16'};
 const components=Object.fromEntries(['erpApiNative','nativeOrder','crm','hub'].map(name=>[name,{...(name==='crm'?CRM06_STAFF_INTEGRATED_CRM_PACKAGE:name==='nativeOrder'?nativePin:CRM06_STAFF_ERP_INTEGRATED_PACKAGE),config:refs[{erpApiNative:'operationConfig',nativeOrder:'nativeOrderConfig',crm:'crmActivationConfig',hub:'hubStartupConfig'}[name]]}]));
 return {schemaVersion:1,ownerSid:owner,actualT1:false,copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',lanAddress:'192.168.1.46',runtimeDirectory:erp+'\\runtime\\terminal-completion-logon',node:{path:'C:\\Program Files\\nodejs\\node.exe',sha256:hash},supervisor:{packageRoot:erp+'\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261017-c4010efa8ff6',sourceCommit:'c4010efa8ff6b49f3e342032c98611a26c41cfaf',manifestSha256:'4fecac939834ee66266472bfc2d0d4ede3c475292971183da6e58de006c58590'},components,privateSources:refs,dependencyLocks:Object.fromEntries(['erpApiNative','nativeOrder','crm'].map(name=>[name,{path:erp+'\\runtime\\terminal-completion-logon\\'+name+'-'+components[name].sourceCommit.slice(0,12)+'-dependency-lock.json',sha256:hash}])),crmPrivateFiles:{baseline:{path:crm+'\\runtime\\normal-baseline.env',sha256:hash},catalogAccess:{path:erp+'\\runtime\\catalog-access.json',sha256:hash}}};
}
function fixture(){
 const s=settings(),observations=COMPLETION_CORE_STAGES.map((stage,index)=>{
  const pin=s.components[stage.component],entry=pin.packageRoot+'\\'+stage.entry.replaceAll('/','\\'),parent=s.supervisor.packageRoot+'\\scripts\\canonical\\terminal-completion-logon.mjs',creation=`2026-10-17T12:00:00.${String(2000000+index*10000)}Z`,parentCreation='2026-10-17T12:00:00.1000000Z';
  const args=[s.node.path,'--no-maglev',entry,...(stage.component==='crm'?[]:[...(stage.mode?[stage.mode]:[]),pin.config.path])];
  const settingsPath=crm06StaffSuccessorProfile(CRM06_STAFF_INTEGRATED_CRM_SOURCE,'erp-crm-integrated-20261017').nextPaths.settings;
  const row={pid:100+index,parentPid:11,ownerSid:owner,parentOwnerSid:owner,nodePath:s.node.path,parentNodePath:s.node.path,creationTime:creation,managedCreationTime:creation,parentCreationTime:parentCreation,parentCommandLine:`"${s.node.path}" --no-maglev "${parent}" --config "${settingsPath}" --sha256 ${hash} --owner-sid ${owner} --action Start`,commandLine:args.map(value=>'"'+value+'"').join(' '),bindings:stage.ports.map(port=>({port,address:'127.0.0.1'}))};
  if(['erpApi','crmServer'].includes(stage.name))row.bindings.push({port:stage.ports[0],address:s.lanAddress});
  const receipt={run:`run-${index}`,pid:row.pid,parentPid:11,parentCreationTime:parentCreation,creationTime:creation,stage:stage.name,sourceCommit:pin.sourceCommit,configSha256:pin.config.sha256,copyId:s.copyId,actualT1:false};
  return {stage:stage.name,rows:[row],receipt,observedAt:'2026-10-17T12:00:01.000Z',receiptRef:{path:s.runtimeDirectory+'\\'+stage.name+'.json',sha256:hash,observedAt:'2026-10-17T12:00:00.500Z'}};
 });
 const oldRoles=['hub','crmServer','crmOrders','crmCatalog','crmNativeOrder','erpApi','erpNative','terminalWatcher','hubWatcher','coreSupervisor'];
 const settingsRef={path:crm06StaffSuccessorProfile(CRM06_STAFF_INTEGRATED_CRM_SOURCE,'erp-crm-integrated-20261017').nextPaths.settings,sha256:hash};
 return {settings:s,ownerSid:owner,settingsRef,supervisorConfig:{...settingsRef},beforeImage:{observedAt:'2026-10-17T12:00:00.000Z',oldOwners:oldRoles.map((role,index)=>({role,pid:30+index,creationTime:'2026-10-11T11:00:00.0000000Z'}))},observations,oldPids:oldRoles.map((_,index)=>30+index),now:'2026-10-17T12:00:02.000Z'};
}
const denied=value=>assert.throws(()=>proveP03CandidateCore(value),/REJECTED/);
test('six exact candidate CORE receipts and rows pass without IO',()=>{
 const result=proveP03CandidateCore(fixture());assert.equal(result.status,'CANDIDATE_CORE_CONDITIONAL_CONSISTENCY');assert.equal(result.roles.length,6);assert.equal(result.parentPid,11);
});
test('missing, duplicate and ambiguous CORE roles fail closed',()=>{
 for(const change of [v=>v.observations.pop(),v=>v.observations.push(structuredClone(v.observations[0])),v=>v.observations[0].rows.push(structuredClone(v.observations[0].rows[0])),v=>v.observations[0].rows=[]]){const v=fixture();change(v);denied(v);}
});
test('foreign OS identity, argv, parent birth, port and receipt are rejected',()=>{
 const changes=[
  v=>v.observations[0].rows[0].ownerSid='S-1-5-18',
  v=>v.observations[0].rows[0].nodePath='C:\\Other\\node.exe',
  v=>v.observations[0].rows[0].commandLine+=' --inspect',
  v=>v.observations[0].rows[0].parentCommandLine+=' --inspect',
  v=>v.observations[0].rows[0].parentPid=12,
  v=>v.observations[0].rows[0].parentCreationTime='2026-10-11T11:58:00.0000000Z',
  v=>v.observations[0].rows[0].creationTime='2026-10-11T12:01:00.0000000Z',
  v=>v.observations[0].rows[0].bindings=[{port:4186,address:'0.0.0.0'}],
  v=>v.observations[0].receipt.configSha256='c'.repeat(64),
  v=>v.observations[0].receipt.sourceCommit='c'.repeat(40),
  v=>v.observations[0].receipt.actualT1=true,
  v=>v.observations[0].receipt.parentPid=12,
  v=>v.observations[0].receipt.creationTime='2026-10-11T12:01:00.0000000Z',
  v=>v.observations[0].receipt.pid=30,
 ];
 for(const change of changes){const v=fixture();change(v);denied(v);}
});
test('configuration, common lineage and pinned metadata must remain exact',()=>{
 const changes=[v=>v.settings.actualT1=true,v=>v.settings.ownerSid='S-1-5-18',v=>v.settings.components.erpApiNative.config.sha256='c'.repeat(64),v=>v.settings.components.crm.sourceCommit='c'.repeat(40),v=>v.observations[1].receipt.parentCreationTime='2026-10-11T11:58:00.0000000Z',v=>v.observations[1].rows[0].parentCreationTime='2026-10-11T11:58:00.0000000Z',v=>v.observations[0].receipt.run=v.observations[1].receipt.run];
 for(const change of changes){const v=fixture();change(v);denied(v);}
});
test('all ten old identities, their births and a fresh before-image are mandatory',()=>{
 const changes=[v=>v.oldPids=[],v=>v.oldPids.pop(),v=>v.beforeImage.oldOwners.pop(),v=>v.beforeImage.oldOwners[0].role='unknown',v=>v.beforeImage.oldOwners[0].creationTime='bad',v=>v.beforeImage.oldOwners[0].pid=v.beforeImage.oldOwners[1].pid,v=>v.beforeImage.observedAt='2026-10-17T12:00:03.000Z',v=>v.observations[0].receipt.pid=30,v=>v.observations.forEach(o=>{o.receipt.parentPid=30;o.rows[0].parentPid=30;})];
 for(const change of changes){const v=fixture();change(v);denied(v);}
});
test('fresh row and receipt provenance, chronological birth and exact integrated pins are required',()=>{
 const changes=[v=>v.observations[0].observedAt='2026-10-17T11:58:00.000Z',v=>v.observations[0].receiptRef.observedAt='2026-10-17T11:58:00.000Z',v=>v.observations[0].receiptRef.path+='-other',v=>v.observations[0].receiptRef.sha256='bad',v=>v.observations[0].receiptRef.observedAt='2026-10-17T12:00:02.000Z',v=>v.now='2026-10-17T12:02:00.000Z',v=>v.settingsRef.path+='-other',v=>v.supervisorConfig.sha256='c'.repeat(64),v=>v.settings.components.nativeOrder.manifestSha256='c'.repeat(64),v=>v.observations[0].receipt.creationTime='2026-10-11T11:58:00.0000000Z'];
 for(const change of changes){const v=fixture();change(v);denied(v);}
});
test('candidate parent and child must both be born after the captured before-image',()=>{
 const changes=[
  v=>v.observations.forEach(o=>{o.receipt.parentCreationTime='2026-10-11T11:59:00.0000000Z';o.rows[0].parentCreationTime=o.receipt.parentCreationTime;}),
  v=>{const o=v.observations[0];o.receipt.creationTime='2026-10-17T12:00:00.0999990Z';o.rows[0].creationTime=o.receipt.creationTime;o.rows[0].managedCreationTime=o.receipt.creationTime;},
  v=>{const o=v.observations[0];o.receipt.creationTime='2026-10-17T11:59:59.9999990Z';o.rows[0].creationTime=o.receipt.creationTime;o.rows[0].managedCreationTime=o.receipt.creationTime;},
 ];
 for(const change of changes){const v=fixture();change(v);denied(v);}
});
test('native order requires the installed draft package, not the historical donor',()=>{
 const v=fixture();assert.equal(proveP03CandidateCore(v).roles.length,6);
 v.settings.components.nativeOrder.packageRoot=erp+'\\releases\\CANONICAL-COMPLETE-TEST-20261011-7a41f64';denied(v);
});
test('CORE parent requires the exact integrated supervisor package, source and manifest',()=>{
 const changes=[v=>v.settings.supervisor.packageRoot=erp+'\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261017-other',v=>v.settings.supervisor.sourceCommit='b'.repeat(40),v=>v.settings.supervisor.manifestSha256='b'.repeat(64)];
 for(const change of changes){const v=fixture();change(v);denied(v);}
});
test('receipt readback must follow both before-image and child birth at 100ns precision',()=>{
 const changes=[v=>v.observations[0].receiptRef.observedAt='2026-10-17T11:59:59.9999999Z',v=>v.observations[0].receiptRef.observedAt='2026-10-17T12:00:00.1999999Z'];
 for(const change of changes){const v=fixture();change(v);denied(v);}
});
test('frozen before-image can predate a long transition while observations stay fresh',()=>{
 const v=fixture();v.beforeImage.observedAt='2026-10-17T11:45:00.000Z';assert.equal(proveP03CandidateCore(v).status,'CANDIDATE_CORE_CONDITIONAL_CONSISTENCY');
 for(const observedAt of ['2026-10-17T12:00:03.000Z','bad']){const changed=fixture();changed.beforeImage.observedAt=observedAt;denied(changed);}
});
