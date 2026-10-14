import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCrm06TestActorProvisioning,crm06ProvisioningInputHash as digest} from './crm06-test-actor-provisioning.mjs';
import {assertCrm06PreparedActorReceipt,buildCrm06OwnerProjection,CRM06_BASELINE_PATH,CRM06_ACTOR_AUDIT_PATH} from './crm06-owner-projection.mjs';
import {validateCompletionSettings,completionCrmEnvironment} from './terminal-completion-logon.mjs';
const erp='C:\\Sirket\\ERP',crm='C:\\Sirket\\CRM',source='5b6dfe5acf1c0c1ea301f66aea39bf2abcec8f36',nativeSource='7a'.padEnd(40,'1'),sha='a'.repeat(64),owner='S-1-5-21-123-456-789-1001';
const oldPath=crm+'\\runtime\\ERP-COMPLETION01-20261011\\normal-agent-test-baseline.env';
const password=n=>`scrypt$${String(n).repeat(48)}$${String(n).repeat(128)}`;
function setup(){
 const refs=Object.fromEntries(['operationConfig','nativeOrderConfig','crmActivationConfig','hubPinConfig','hubStartupConfig'].map(key=>[key,{path:erp+'\\runtime\\completion\\'+key+'.json',sha256:sha}]));
 const root=erp+'\\releases\\old-complete-7a';
 const components=Object.fromEntries(['erpApiNative','nativeOrder','crm','hub'].map(name=>[name,{packageRoot:name==='crm'?crm+'\\releases\\crm-shared-test-'+source:root,sourceCommit:name==='crm'?source:nativeSource,manifestSha256:sha,config:refs[{erpApiNative:'operationConfig',nativeOrder:'nativeOrderConfig',crm:'crmActivationConfig',hub:'hubStartupConfig'}[name]]}]));
 const settings={schemaVersion:1,ownerSid:owner,actualT1:false,copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',lanAddress:'192.168.1.46',runtimeDirectory:erp+'\\runtime\\terminal-completion-logon',node:{path:'C:\\Program Files\\nodejs\\node.exe',sha256:sha},supervisor:{packageRoot:root,sourceCommit:nativeSource,manifestSha256:sha},components,privateSources:refs,dependencyLocks:Object.fromEntries(['erpApiNative','nativeOrder','crm'].map(name=>[name,{path:erp+'\\runtime\\terminal-completion-logon\\'+name+'-'+components[name].sourceCommit.slice(0,12)+'-dependency-lock.json',sha256:sha}])),crmPrivateFiles:{baseline:{path:oldPath,sha256:sha},catalogAccess:{path:erp+'\\runtime\\catalog-access.json',sha256:sha}}};
 const p=components.crm,requestRoot=crm+'\\runtime\\CUSTOMER-PRODUCT-REQUEST-SHARED-20261013';
 const activation={sourceCommit:source,packageRoot:p.packageRoot,packageManifestSha256:sha,database:settings.database,actualT1:false,externalOperations:false,paidAi:false,whatsappSend:false,environmentVariables:{CRM_TEST_PORT_BASE:'62700',CRM_ISOLATED_PREPARATION:'true',CRM_TEST_ERP_ORIGIN:'http://127.0.0.1:4184',CRM_TEST_EXPECTED_DATABASE:settings.database,CRM_TEST_LAN_ADDRESS:settings.lanAddress,CRM_TEST_SOURCE_COMMIT:source,CRM_TEST_PACKAGE_ROOT:p.packageRoot,CRM_TEST_PACKAGE_MANIFEST_SHA256:sha,CRM_TEST_NATIVE_SOURCE_COMMIT:nativeSource,CRM_TEST_RUNTIME_DIR:crm+'\\runtime\\existing-personnel',CRM_TEST_LOG_DIR:crm+'\\logs\\existing-personnel',CRM_BASELINE_ENV:oldPath,CRM_ERP_CATALOG_ACCESS_PATH:settings.crmPrivateFiles.catalogAccess.path,CRM_TEST_TERMINAL_PERSONNEL_USERNAME:'crm-ahmet',CRM_NORMAL_REFRESH_ENABLED:'true',CRM_NORMAL_REFRESH_USER_ID:'crm-agent-test-20261011',CRM_NORMAL_REFRESH_JOURNAL_PATH:crm+'\\runtime\\ERP-COMPLETION01-20261011\\protected-normal-sessions\\refresh-journal.json',CRM_CUSTOMER_PRODUCT_REQUEST_ENABLED:'true',CRM_CUSTOMER_PRODUCT_REQUEST_ISSUER_IDS:'["crm-patron"]',CRM_CUSTOMER_PRODUCT_REQUEST_STORE_FILE:requestRoot+'\\customer-product-requests.json',CRM_CUSTOMER_PRODUCT_REQUEST_REFRESH_JOURNAL_PATH:requestRoot+'\\request-issuer-refresh.json',WHATSAPP_SEND_ENABLED:'false',WHATSAPP_LIVE_SEND_APPROVED:'false',CRM_PAID_AI_ENABLED:'false',CRM_AI_SALES_MODE:'off',WAAPI_CHATWOOT_BRIDGE_ENABLED:'false',WAAPI_INCOMING_READER_ENABLED:'false'}};
 const baseline={WHATSAPP_CRM_AUTH_USERS_JSON:JSON.stringify(Array.from({length:7},(_,i)=>({id:i?'old-'+i:'crm-patron',username:'old-user-'+i,role:i?'personel':'patron',active:true,chatwootAgentId:2,passwordHash:password(1)}))),WHATSAPP_CRM_PERSONNEL_CAN_SEND:'false',SYNTHETIC:'preserved'};
 const prepared=buildCrm06TestActorProvisioning({baseline,activation,managerPasswordHash:password(2),staffPasswordHash:password(3),expectedBaselineHash:digest(baseline),expectedActivationHash:digest(activation)});
 const input={priorSettings:settings,supervisorPin:{packageRoot:erp+'\\releases\\crm06-supervisor-only',sourceCommit:'c'.repeat(40),manifestSha256:'b'.repeat(64)},activationRef:{path:erp+'\\runtime\\completion\\crm06-activation.json',sha256:'b'.repeat(64)},baselineRef:{path:CRM06_BASELINE_PATH,sha256:'b'.repeat(64)},auditRef:{path:CRM06_ACTOR_AUDIT_PATH,sha256:'b'.repeat(64)},ownerSid:owner,settingsRef:{path:erp+'\\runtime\\completion\\crm06-supervisor-settings.json',sha256:'c'.repeat(64)}};
 return {settings,activation,baseline,prepared,input};
}
const checkReceipt=(f,baseline=f.prepared.nextBaseline,activation=f.prepared.nextActivation,receipt=f.prepared.audit)=>assertCrm06PreparedActorReceipt({baseline,activation,receipt});
test('normal two-role setup receipt proves every user and full object without installing or minting auth',()=>{
 const f=setup();assert.equal(checkReceipt(f),true);assert.equal(f.prepared.audit.installed,false);assert.equal(f.prepared.audit.staffDurableRefreshSupported,false);
});
test('supervisor-only projection preserves all component binaries, locks, Hub, old metadata and leaves inputs untouched',()=>{
 const f=setup(),before=structuredClone(f.input),r=buildCrm06OwnerProjection(f.input);assert.deepEqual(f.input,before);assert.equal(r.settingsHash,digest(r.settings));assert(Object.isFrozen(r.settings.components.crm));
 for(const name of ['erpApiNative','nativeOrder','hub'])assert.deepEqual(r.settings.components[name],f.settings.components[name]);
 assert.deepEqual(r.settings.dependencyLocks,f.settings.dependencyLocks);assert.deepEqual({...r.settings.components.crm,config:f.settings.components.crm.config},f.settings.components.crm);
 for(const key of ['operationConfig','nativeOrderConfig','hubPinConfig','hubStartupConfig'])assert.deepEqual(r.settings.privateSources[key],f.settings.privateSources[key]);
 assert.deepEqual(r.settings.crmPrivateFiles.catalogAccess,f.settings.crmPrivateFiles.catalogAccess);assert.equal(r.taskPlan.installed,false);assert.equal(r.taskPlan.runLevel,'LeastPrivilege');assert.equal(r.taskPlan.hubTaskPreserved,'Melisa-Hub-TEST-Web');
 assert.equal(validateCompletionSettings(r.settings,owner),r.settings);const env=completionCrmEnvironment(f.prepared.nextActivation,r.settings);assert.equal(env.CRM_BASELINE_ENV,CRM06_BASELINE_PATH);assert.equal(env.CRM_NORMAL_REFRESH_USER_ID,'crm-agent-test-20261011');assert.equal(env.WHATSAPP_SEND_ENABLED,'false');
});
test('legacy two-reference path and single issuer remain accepted, new baseline requires exact pinned third reference',()=>{
 const f=setup();assert.equal(validateCompletionSettings(f.settings,owner),f.settings);assert.equal(completionCrmEnvironment(f.activation,f.settings).CRM_CUSTOMER_PRODUCT_REQUEST_ISSUER_IDS,'["crm-patron"]');
 const s=buildCrm06OwnerProjection(f.input).settings;
 for(const change of [v=>delete v.crmPrivateFiles.crm06Actors,v=>v.crmPrivateFiles.crm06Actors.path+='-other',v=>v.crmPrivateFiles.baseline.path+='-other',v=>v.crmPrivateFiles.extra={path:oldPath,sha256:sha}]){const bad=structuredClone(s);change(bad);assert.throws(()=>validateCompletionSettings(bad,owner));}
 assert.throws(()=>completionCrmEnvironment(f.prepared.nextActivation,f.settings));assert.throws(()=>completionCrmEnvironment(f.activation,s));
});
test('mismatched receipts, old roles, changed new identity/flags, override and staff refresh claims reject without secret output',()=>{
 assert.throws(()=>assertCrm06PreparedActorReceipt(),{code:'CRM06_OWNER_PROJECTION_REJECTED'});
 const f=setup();for(const change of [v=>v.installed=true,v=>v.nativeExecution=true,v=>v.staffDurableRefreshSupported=true,v=>v.nextBaselineHash='f'.repeat(64),v=>v.nextActivationHash='f'.repeat(64),v=>v.existingUserEntryHashes[2]='f'.repeat(64),v=>v.actors[1].derivedPermissions.push('crm.send'),v=>v.extra='secret']){const bad=structuredClone(f.prepared.audit);change(bad);assert.throws(()=>checkReceipt(f,undefined,undefined,bad),{code:'CRM06_OWNER_PROJECTION_REJECTED'});}
 for(const change of [u=>u[0].role='personel',u=>u[7].role='patron',u=>u[8].chatwootAgentId=3,u=>u[8].active=false,u=>u[8].permissions=['crm.send'],u=>u[8].testPersonnel=true]){const bad=structuredClone(f.prepared.nextBaseline),users=JSON.parse(bad.WHATSAPP_CRM_AUTH_USERS_JSON);change(users);bad.WHATSAPP_CRM_AUTH_USERS_JSON=JSON.stringify(users);assert.throws(()=>checkReceipt(f,bad),{code:'CRM06_OWNER_PROJECTION_REJECTED'});}
 const baseline=structuredClone(f.prepared.nextBaseline);baseline.WHATSAPP_CRM_PERSONNEL_CAN_SEND='true';assert.throws(()=>checkReceipt(f,baseline));
});
test('finite issuer/path/refresh/semih guards reject coherent metadata substitutions',()=>{
 const f=setup(),s=buildCrm06OwnerProjection(f.input).settings;
 for(const change of [v=>v.CRM_CUSTOMER_PRODUCT_REQUEST_ISSUER_IDS='["crm-patron"]',v=>v.CRM_CUSTOMER_PRODUCT_REQUEST_ISSUER_IDS='["crm-ahmet"]',v=>v.CRM_NORMAL_REFRESH_USER_ID='crm-crm06-staff-test-20261014',v=>v.CRM_NORMAL_REFRESH_JOURNAL_PATH+='-other',v=>v.CRM_CUSTOMER_PRODUCT_REQUEST_STORE_FILE+='-other',v=>v.CRM_SEMIH_TEST_CONTINUE_ENABLED='true']){const bad=structuredClone(f.prepared.nextActivation);change(bad.environmentVariables);assert.throws(()=>checkReceipt(f,undefined,bad));assert.throws(()=>completionCrmEnvironment(bad,s));}
 for(const change of [v=>v.ownerSid='S-1-5-21-123-456-789-1002',v=>v.auditRef.path+='-other',v=>v.baselineRef.path=oldPath,v=>v.supervisorPin=structuredClone(f.settings.supervisor),v=>v.priorSettings.components.crm.config={...v.priorSettings.components.crm.config,path:v.priorSettings.components.crm.config.path+'-other'}]){const bad=structuredClone(f.input);change(bad);assert.throws(()=>buildCrm06OwnerProjection(bad));}
});
test('driver validates actual pinned bytes with installed dotenv before any launch; pure source modules never perform I/O',()=>{
 const source=fs.readFileSync(new URL('./terminal-completion-logon.mjs',import.meta.url),'utf8');assert(source.includes("require('dotenv').parse(readPinned(settings.crmPrivateFiles.baseline))"));assert(source.includes('assertCrm06PreparedActorReceipt({baseline,activation:crm,receipt:json(settings.crmPrivateFiles.crm06Actors)})'));
 const projection=fs.readFileSync(new URL('./crm06-owner-projection.mjs',import.meta.url),'utf8');for(const forbidden of ['node:fs','node:child_process','fetch(','writeFile','spawn(','execFile(','mssql'])assert(!projection.includes(forbidden));
});
