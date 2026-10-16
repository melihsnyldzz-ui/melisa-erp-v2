import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCrm06TestActorProvisioning,crm06ProvisioningInputHash as digest} from './crm06-test-actor-provisioning.mjs';
import {buildCrm06OwnerProjection,CRM06_BASELINE_PATH,CRM06_ACTOR_AUDIT_PATH} from './crm06-owner-projection.mjs';
import {buildCrm06StaffRefreshSuccessor,assertCrm06StaffRefreshSuccessor,crm06StaffSuccessorProfile,crm06StaffSuccessorProfileForPath,crm06SuccessorFileHash,CRM06_STAFF_PARENT_SETTINGS_PATH,CRM06_STAFF_PARENT_ACTIVATION_PATH,CRM06_STAFF_CRM_SOURCE} from './crm06-staff-refresh-successor.mjs';
import {crm06StaffJournalExcludedPaths,crm06StaffJournalPhysicalArguments} from './crm06-staff-journal-preflight.mjs';
import {assertErpHubProfile,erpHubFailureMetadata} from './wait-erp-for-hub.mjs';
import {validateCompletionSettings} from './terminal-completion-logon.mjs';
const erp='C:\\Sirket\\ERP',crm='C:\\Sirket\\CRM',runtime=erp+'\\runtime\\terminal-completion-logon',source='5b6dfe5acf1c0c1ea301f66aea39bf2abcec8f36',native='7a'.padEnd(40,'1'),sha='a'.repeat(64),owner='S-1-5-21-123-456-789-1001';
const password=n=>`scrypt$${String(n).repeat(48)}$${String(n).repeat(128)}`;
function fixture(){
 const refs=Object.fromEntries(['operationConfig','nativeOrderConfig','crmActivationConfig','hubPinConfig','hubStartupConfig'].map(name=>[name,{path:runtime+'\\'+name+'.json',sha256:sha}]));
 const packageRoot=erp+'\\releases\\old-complete-7a',baselinePath=crm+'\\runtime\\ERP-COMPLETION01-20261011\\normal-agent-test-baseline.env';
 const components=Object.fromEntries(['erpApiNative','nativeOrder','crm','hub'].map(name=>[name,{packageRoot:name==='crm'?crm+'\\releases\\crm-shared-test-'+source:packageRoot,sourceCommit:name==='crm'?source:native,manifestSha256:sha,config:refs[{erpApiNative:'operationConfig',nativeOrder:'nativeOrderConfig',crm:'crmActivationConfig',hub:'hubStartupConfig'}[name]]}]));
 const old={schemaVersion:1,ownerSid:owner,actualT1:false,copyId:'e16b70f0-4057-428b-9abc-6bbcaf35fe82',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',lanAddress:'192.168.1.46',runtimeDirectory:runtime,node:{path:'C:\\Program Files\\nodejs\\node.exe',sha256:sha},supervisor:{packageRoot,sourceCommit:native,manifestSha256:sha},components,privateSources:refs,dependencyLocks:Object.fromEntries(['erpApiNative','nativeOrder','crm'].map(name=>[name,{path:runtime+'\\'+name+'-'+components[name].sourceCommit.slice(0,12)+'-dependency-lock.json',sha256:sha}])),crmPrivateFiles:{baseline:{path:baselinePath,sha256:sha},catalogAccess:{path:erp+'\\runtime\\catalog-access.json',sha256:sha}}};
 const p=components.crm,request=crm+'\\runtime\\CUSTOMER-PRODUCT-REQUEST-SHARED-20261013';
 const originalActivation={sourceCommit:source,packageRoot:p.packageRoot,packageManifestSha256:sha,database:old.database,actualT1:false,externalOperations:false,paidAi:false,whatsappSend:false,environmentVariables:{CRM_TEST_PORT_BASE:'62700',CRM_ISOLATED_PREPARATION:'true',CRM_TEST_ERP_ORIGIN:'http://127.0.0.1:4184',CRM_TEST_EXPECTED_DATABASE:old.database,CRM_TEST_LAN_ADDRESS:old.lanAddress,CRM_TEST_SOURCE_COMMIT:source,CRM_TEST_PACKAGE_ROOT:p.packageRoot,CRM_TEST_PACKAGE_MANIFEST_SHA256:sha,CRM_TEST_NATIVE_SOURCE_COMMIT:native,CRM_TEST_RUNTIME_DIR:crm+'\\runtime\\existing-personnel',CRM_TEST_LOG_DIR:crm+'\\logs\\existing-personnel',CRM_BASELINE_ENV:baselinePath,CRM_ERP_CATALOG_ACCESS_PATH:old.crmPrivateFiles.catalogAccess.path,CRM_TEST_TERMINAL_PERSONNEL_USERNAME:'crm-ahmet',CRM_NORMAL_REFRESH_ENABLED:'true',CRM_NORMAL_REFRESH_USER_ID:'crm-agent-test-20261011',CRM_NORMAL_REFRESH_JOURNAL_PATH:crm+'\\runtime\\ERP-COMPLETION01-20261011\\protected-normal-sessions\\refresh-journal.json',CRM_CUSTOMER_PRODUCT_REQUEST_ENABLED:'true',CRM_CUSTOMER_PRODUCT_REQUEST_ISSUER_IDS:'["crm-patron"]',CRM_CUSTOMER_PRODUCT_REQUEST_STORE_FILE:request+'\\customer-product-requests.json',CRM_CUSTOMER_PRODUCT_REQUEST_REFRESH_JOURNAL_PATH:request+'\\request-issuer-refresh.json',WHATSAPP_SEND_ENABLED:'false',WHATSAPP_LIVE_SEND_APPROVED:'false',CRM_PAID_AI_ENABLED:'false',CRM_AI_SALES_MODE:'off',WAAPI_CHATWOOT_BRIDGE_ENABLED:'false',WAAPI_INCOMING_READER_ENABLED:'false'}};
 const oldBaseline={WHATSAPP_CRM_AUTH_USERS_JSON:JSON.stringify(Array.from({length:7},(_,i)=>({id:i?'old-'+i:'crm-patron',username:'old-user-'+i,role:i?'personel':'patron',active:true,chatwootAgentId:2,passwordHash:password(1)}))),WHATSAPP_CRM_PERSONNEL_CAN_SEND:'false',SYNTHETIC:'preserved'};
 const prepared=buildCrm06TestActorProvisioning({baseline:oldBaseline,activation:originalActivation,managerPasswordHash:password(2),staffPasswordHash:password(3),expectedBaselineHash:digest(oldBaseline),expectedActivationHash:digest(originalActivation)});
 const projected=buildCrm06OwnerProjection({priorSettings:old,supervisorPin:{packageRoot:erp+'\\releases\\old-supervisor-actor',sourceCommit:'c'.repeat(40),manifestSha256:'b'.repeat(64)},activationRef:{path:CRM06_STAFF_PARENT_ACTIVATION_PATH,sha256:sha},baselineRef:{path:CRM06_BASELINE_PATH,sha256:sha},auditRef:{path:CRM06_ACTOR_AUDIT_PATH,sha256:sha},ownerSid:owner,settingsRef:{path:CRM06_STAFF_PARENT_SETTINGS_PATH,sha256:sha}});
 const hubPin={apiSourceCommit:native,crmSourceCommit:source,crmIndexSha256:sha,crmHealthPath:runtime+'\\crm-health-status.json',trainingFiles:Array.from({length:8},(_,i)=>({path:'lesson-'+i,sha256:sha}))};
 const hubStartup={HubConfigPath:refs.hubPinConfig.path,PackageRoot:packageRoot,SourceCommit:native,ManifestSha256:sha,OperationConfigPath:refs.operationConfig.path,NodePath:old.node.path,NodeSha256:sha,OwnerSid:owner,unchanged:'fixture'};
 return {baseline:prepared.nextBaseline,parentActivation:prepared.nextActivation,parentAudit:prepared.audit,parentSettings:structuredClone(projected.settings),parentSettingsRef:{path:CRM06_STAFF_PARENT_SETTINGS_PATH,sha256:sha},parentHubPin:hubPin,parentHubStartup:hubStartup,crmPackagePin:{packageRoot:crm+'\\releases\\crm-shared-test-'+CRM06_STAFF_CRM_SOURCE,sourceCommit:CRM06_STAFF_CRM_SOURCE,manifestSha256:'d'.repeat(64)},crmIndexSha256:'e'.repeat(64),crmDependencyLockRef:{path:runtime+'\\crm-'+CRM06_STAFF_CRM_SOURCE.slice(0,12)+'-dependency-lock.json',sha256:'f'.repeat(64)},supervisorPin:{packageRoot:erp+'\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261014-'+'8'.repeat(12),sourceCommit:'8'.repeat(40),manifestSha256:'9'.repeat(64)},journalEvidenceSha256:'1'.repeat(64),ownerSid:owner};
}

const unifiedSource='439b63db8376a6b9d3ac8baa625ed98367022623',unifiedManifest='342eb291f570dd4294d50206327d67d895bf2e90944026b56392e498a38aebba',unifiedIndex='0fcb6b27d9cac1aefa186a41b60962cf18be06154b27b171bb65df99a4dfc5af';
const searchSource='94f2a75322a3daa695d38010a6f2c8ef23f6c17b',copySource='a7243dedf9ca5d1ca1d5aa1cb3dffaee7c18a7e9';
const legacyProfiles=[
 ['b2985d2295c022848c769ea5f494012c1eb3fa00'],
 ['da82fc6644c1d9dba0c10eaa861773534d43c288'],
 ['da82fc6644c1d9dba0c10eaa861773534d43c288','parent-probe'],
 ['5ce452b01ef20fc84a09c52b78311db8eb1dd1d8'],
 ['5bcd5ad136ff7ca35d623d436b8724cc491641be'],
 ['5bcd5ad136ff7ca35d623d436b8724cc491641be','receipt-wait'],
 ['bb8966c59a6cfbdc1cc83472cb331e48b720a173'],
 ['957f98773695874ea3d101b7eb4816f9ea080880'],
 ['89427492f27caf72c511a27262b55e73d782c407'],[searchSource],[copySource]
];
function inputFor(source=unifiedSource,variant){
 const f=fixture(),profile=crm06StaffSuccessorProfile(source,variant);
 f.crmPackagePin.sourceCommit=source;f.crmPackagePin.packageRoot=crm+'\\releases\\crm-shared-test-'+source;
 f.crmDependencyLockRef.path=profile.dependencyLockPath;
 if(source!==CRM06_STAFF_CRM_SOURCE)f.supervisorPin.packageRoot=f.supervisorPin.packageRoot.replace('20261014','20261015');
 if(variant!==undefined)f.profileVariant=variant;
 if(source===searchSource){f.crmPackagePin.manifestSha256='16cb075a8734d56afd1f364999ab8f0707255be5c4a042a9c197ccf397eea556';f.crmIndexSha256='19624f5d0189c5750089b4c50779809f3a381e323ae59541daa5ee4c3efdf3a5';}
 if(source===copySource){f.crmPackagePin.manifestSha256='82ec0b63849817b8d88fe74097a5a0820c118a78d631cf54cf649b90e1545236';f.crmIndexSha256='6d67b7a335f490715e792a9940e9c1b97f745069cf4049fa5b1d4f597fa8a192';}
 if(source===unifiedSource){f.crmPackagePin.manifestSha256=unifiedManifest;f.crmIndexSha256=unifiedIndex;}
 return f;
}
function assertion(f,p){return {baseline:f.baseline,parentActivation:f.parentActivation,parentAudit:f.parentAudit,parentSettings:f.parentSettings,parentHubPin:f.parentHubPin,parentHubStartup:f.parentHubStartup,currentActivation:p.activation,currentSettings:p.settings,currentHubPin:p.hubPin,currentHubStartup:p.hubStartup,receipt:p.receipt,ownerSid:f.ownerSid};}

const erpPackage={packageRoot:erp+'\\releases\\CANONICAL-COMPLETE-TEST-20261011-f5f672c',sourceCommit:'f5f672c439972b287f77ddd2c7750fa0c6369e87',manifestSha256:'0e119c7256f8e34290973cd0e4c627e992906eb2641cf06fd830f853525af653'};
const erpLockPath=runtime+'\\erpApiNative-f5f672c43997-dependency-lock.json';
function combinedFixture(){const f=inputFor();f.profileVariant='erp-candidate';f.erpCandidate={packagePin:structuredClone(erpPackage),dependencyLockRef:{path:erpLockPath,sha256:'6'.repeat(64)}};return f;}
const alternateNode={path:'C:\\Sirket\\ERP\\tools\\node-v24.19.0\\node.exe',sha256:'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'};
function alternateNodeFixture(){const f=combinedFixture();f.erpCandidate.nodeRuntimePin=structuredClone(alternateNode);return f;}

test('combined optional Node runtime pins only the reviewed binary and updates settings and Hub startup together',()=>{
 const f=alternateNodeFixture(),before=structuredClone(f),p=buildCrm06StaffRefreshSuccessor(f),base=buildCrm06StaffRefreshSuccessor(combinedFixture());
 assert.deepEqual(f,before);assert.equal(assertCrm06StaffRefreshSuccessor(assertion(f,p)),true);validateCompletionSettings(p.settings,owner);
 assert.deepEqual(p.settings.node,alternateNode);assert.deepEqual(p.hubStartup,{...base.hubStartup,NodePath:alternateNode.path,NodeSha256:alternateNode.sha256});
 assert.deepEqual(p.receipt.prepared.erpCandidate.nodeRuntimePin,alternateNode);assert.deepEqual(p.activation,base.activation);assert.deepEqual(p.hubPin,base.hubPin);assert.deepEqual(p.receipt.parent,base.receipt.parent);assert.deepEqual(p.receipt.rollback,base.receipt.rollback);
 assert.deepEqual(p.settings.components.nativeOrder,base.settings.components.nativeOrder);assert.deepEqual(p.settings.dependencyLocks,base.settings.dependencyLocks);assert.deepEqual(p.settings.privateSources.operationConfig,base.settings.privateSources.operationConfig);assert.deepEqual(p.settings.privateSources.nativeOrderConfig,base.settings.privateSources.nativeOrderConfig);assert.deepEqual(p.settings.crmPrivateFiles.baseline,base.settings.crmPrivateFiles.baseline);assert.deepEqual(p.settings.crmPrivateFiles.crm06Actors,base.settings.crmPrivateFiles.crm06Actors);
 for(const key of ['installed','authenticatedOperationsVerified','humanAccepted'])assert.equal(p.receipt[key],false);
});

test('combined optional Node runtime rejects wrong path hash shape extra field and non-variant input',()=>{
 for(const change of [f=>f.erpCandidate.nodeRuntimePin.path='C:\\Program Files\\nodejs\\node.exe',f=>f.erpCandidate.nodeRuntimePin.path=f.erpCandidate.nodeRuntimePin.path.toUpperCase(),f=>f.erpCandidate.nodeRuntimePin.sha256='a'.repeat(64),f=>f.erpCandidate.nodeRuntimePin.version='v24.19.0',f=>f.erpCandidate.nodeRuntimePin.args=['--no-maglev'],f=>f.erpCandidate.nodeRuntimePin.environmentVariables={NODE_OPTIONS:'--inspect'},f=>f.erpCandidate.nodeRuntimePin=null,f=>delete f.erpCandidate.nodeRuntimePin.sha256]){const f=alternateNodeFixture();change(f);assert.throws(()=>buildCrm06StaffRefreshSuccessor(f),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});}
 const base=inputFor();base.erpCandidate=alternateNodeFixture().erpCandidate;assert.throws(()=>buildCrm06StaffRefreshSuccessor(base),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});
 const f=combinedFixture();f.nodeRuntimePin=alternateNode;assert.throws(()=>buildCrm06StaffRefreshSuccessor(f),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});
});

test('combined optional Node receipt rejects unilateral settings Hub provenance and authority changes',()=>{
 const f=alternateNodeFixture(),p=buildCrm06StaffRefreshSuccessor(f);
 for(const change of [v=>v.currentSettings.node.path='C:\\Program Files\\nodejs\\node.exe',v=>v.currentSettings.node.sha256='a'.repeat(64),v=>v.currentHubStartup.NodePath='C:\\Program Files\\nodejs\\node.exe',v=>v.currentHubStartup.NodeSha256='a'.repeat(64),v=>delete v.receipt.prepared.erpCandidate.nodeRuntimePin,v=>v.receipt.prepared.erpCandidate.nodeRuntimePin.path+='-other',v=>v.currentActivation.environmentVariables.NODE_OPTIONS='--inspect',v=>v.currentActivation.environmentVariables.CRM_PAID_AI_ENABLED='true']){const input=structuredClone(assertion(f,p));change(input);assert.throws(()=>assertCrm06StaffRefreshSuccessor(input),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});}
});

test('combined candidate without optional Node retains its exact pre-change output fingerprint',()=>{
 assert.equal(crm06SuccessorFileHash(buildCrm06StaffRefreshSuccessor(combinedFixture())),'7707e24dd17c6134a5c8eae06d237331f6801bb39720c5f5e2e2dda75d1ab848');
});

test('combined candidate changes only the literal ERP package Hub and dependency pin while preserving the CRM18 native and authority context',()=>{
 const f=combinedFixture(),before=structuredClone(f),p=buildCrm06StaffRefreshSuccessor(f),base=buildCrm06StaffRefreshSuccessor(inputFor()),profile=crm06StaffSuccessorProfile(unifiedSource,'erp-candidate');
 assert.deepEqual(f,before);assert.equal(assertCrm06StaffRefreshSuccessor(assertion(f,p)),true);validateCompletionSettings(p.settings,owner);
 assert.deepEqual(p.settings.components.erpApiNative,{...erpPackage,config:f.parentSettings.components.erpApiNative.config});
 assert.deepEqual(p.settings.components.hub,{...erpPackage,config:p.hubStartupRef});assert.deepEqual(p.settings.dependencyLocks.erpApiNative,f.erpCandidate.dependencyLockRef);
 assert.equal(p.hubPin.apiSourceCommit,erpPackage.sourceCommit);assert.equal(p.hubPin.crmSourceCommit,unifiedSource);assert.equal(p.hubPin.crmIndexSha256,unifiedIndex);
 assert.deepEqual(p.hubStartup,{...f.parentHubStartup,HubConfigPath:p.hubPinRef.path,PackageRoot:erpPackage.packageRoot,SourceCommit:erpPackage.sourceCommit,ManifestSha256:erpPackage.manifestSha256});
 assert.deepEqual(p.activation,base.activation);assert.deepEqual(p.settings.components.nativeOrder,base.settings.components.nativeOrder);assert.deepEqual(p.settings.dependencyLocks.nativeOrder,base.settings.dependencyLocks.nativeOrder);assert.deepEqual(p.settings.dependencyLocks.crm,base.settings.dependencyLocks.crm);
 assert.deepEqual(p.settings.privateSources.operationConfig,f.parentSettings.privateSources.operationConfig);assert.deepEqual(p.settings.privateSources.nativeOrderConfig,f.parentSettings.privateSources.nativeOrderConfig);
 assert.deepEqual(p.settings.crmPrivateFiles.baseline,base.settings.crmPrivateFiles.baseline);assert.deepEqual(p.settings.crmPrivateFiles.crm06Actors,base.settings.crmPrivateFiles.crm06Actors);assert.deepEqual(p.receipt.parent,base.receipt.parent);assert.deepEqual(p.receipt.rollback,base.receipt.rollback);
 assert.deepEqual(p.receipt.prepared.erpCandidate,f.erpCandidate);assert.equal(p.receipt.prepared.profileVariant,'erp-candidate');assert.equal(p.receipt.featureBase.crm,unifiedSource);
 for(const ref of [p.activationRef,p.settingsRef,p.hubPinRef,p.hubStartupRef,p.receiptRef])assert(ref.path.endsWith('439b63db8376-erp-candidate.json'));
 assert.equal(profile.erpDependencyLockPath,erpLockPath);assert.equal(profile.dependencyLockPath,crm06StaffSuccessorProfile(unifiedSource).dependencyLockPath);
 for(const key of ['installed','authenticatedOperationsVerified','humanAccepted'])assert.equal(p.receipt[key],false);
});

test('combined candidate rejects extra setters and wrong ERP source manifest package path or dependency identity',()=>{
 const changes=[f=>f.erpCandidate.packagePin.sourceCommit='f'.repeat(40),f=>f.erpCandidate.packagePin.manifestSha256='a'.repeat(64),f=>f.erpCandidate.packagePin.packageRoot+='-other',f=>f.erpCandidate.packagePin.packageRoot=f.erpCandidate.packagePin.packageRoot.toUpperCase(),f=>f.erpCandidate.packagePin.config=f.parentSettings.components.erpApiNative.config,f=>f.erpCandidate.dependencyLockRef.path+='-other',f=>f.erpCandidate.dependencyLockRef.sha256='not-a-hash',f=>f.erpCandidate.dependencyLockRef.path=f.crmDependencyLockRef.path,f=>f.erpCandidate.nativeOrder=erpPackage,f=>f.erpCandidate.environmentVariables={CRM_PAID_AI_ENABLED:'true'},f=>f.erpCandidate.role='patron',f=>f.erpCandidate.config=f.parentSettings.components.erpApiNative.config,f=>delete f.erpCandidate,f=>delete f.erpCandidate.packagePin,f=>delete f.erpCandidate.dependencyLockRef];
 for(const change of changes){const f=combinedFixture();change(f);assert.throws(()=>buildCrm06StaffRefreshSuccessor(f),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});}
 const base=inputFor();base.erpCandidate=combinedFixture().erpCandidate;assert.throws(()=>buildCrm06StaffRefreshSuccessor(base),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});
 for(const [source]of legacyProfiles)assert.throws(()=>crm06StaffSuccessorProfile(source,'erp-candidate'),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});
});

test('combined optional target rejects accessors before evaluating any caller getter',()=>{
 for(const key of ['profileVariant','erpCandidate']){const f=combinedFixture();let reads=0;Object.defineProperty(f,key,{enumerable:true,get(){reads++;throw Error('GETTER_CALLED');}});assert.throws(()=>buildCrm06StaffRefreshSuccessor(f),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});assert.equal(reads,0);}
 const f=combinedFixture();let reads=0;Object.defineProperty(f.erpCandidate,'packagePin',{enumerable:true,get(){reads++;throw Error('GETTER_CALLED');}});assert.throws(()=>buildCrm06StaffRefreshSuccessor(f),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});assert.equal(reads,0);
});

test('combined full assertion rejects changed operation native role source and prepared provenance',()=>{
 const f=combinedFixture(),p=buildCrm06StaffRefreshSuccessor(f);
 for(const change of [v=>v.currentSettings.components.erpApiNative.sourceCommit=unifiedSource,v=>v.currentSettings.components.erpApiNative.config.path+='-other',v=>v.currentSettings.components.hub.manifestSha256='a'.repeat(64),v=>v.currentSettings.components.nativeOrder.sourceCommit=erpPackage.sourceCommit,v=>v.currentSettings.privateSources.operationConfig.path+='-other',v=>v.currentSettings.dependencyLocks.erpApiNative.path+='-other',v=>v.currentSettings.dependencyLocks.nativeOrder.sha256='7'.repeat(64),v=>v.currentActivation.environmentVariables.CRM_ASSIGNED_STAFF_REFRESH_USER_ID='other',v=>v.currentActivation.environmentVariables.WHATSAPP_SEND_ENABLED='true',v=>v.currentActivation.environmentVariables.CRM_TEST_NATIVE_SOURCE_COMMIT=erpPackage.sourceCommit,v=>v.receipt.prepared.erpCandidate.packagePin.manifestSha256='a'.repeat(64),v=>delete v.receipt.prepared.erpCandidate,v=>v.receipt.prepared.profileVariant=undefined,v=>v.currentHubPin.apiSourceCommit=unifiedSource,v=>v.receipt.installed=true]){const input=structuredClone(assertion(f,p));change(input);assert.throws(()=>assertCrm06StaffRefreshSuccessor(input),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});}
});

test('combined receipt paths are a distinct literal profile and cannot cross the unchanged CRM18 base',()=>{
 const next=crm06StaffSuccessorProfile(unifiedSource,'erp-candidate'),base=crm06StaffSuccessorProfile(unifiedSource);
 assert.equal(crm06StaffSuccessorProfileForPath(unifiedSource,next.successorPath).profileVariant,'erp-candidate');assert.equal(crm06StaffSuccessorProfileForPath(unifiedSource,base.successorPath).profileVariant,undefined);
 for(const value of ['ERP-CANDIDATE','erp-candidate-other','',null])assert.throws(()=>crm06StaffSuccessorProfile(unifiedSource,value),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});
 for(const [source,file]of [[copySource,next.successorPath],[unifiedSource,next.successorPath.toUpperCase()],[unifiedSource,next.successorPath+'-other']])assert.throws(()=>crm06StaffSuccessorProfileForPath(source,file),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});
 const f=combinedFixture(),p=buildCrm06StaffRefreshSuccessor(f),wrong=structuredClone(p.settings);wrong.crmPrivateFiles.crm06StaffSuccessor.path=base.successorPath;assert.throws(()=>validateCompletionSettings(wrong,owner));
});

test('combined physical journal policy appends only its receipt and forwards the closed variant to independent PowerShell',()=>{
 const base=crm06StaffJournalExcludedPaths(unifiedSource),next=crm06StaffJournalExcludedPaths(unifiedSource,'erp-candidate'),profile=crm06StaffSuccessorProfile(unifiedSource,'erp-candidate');assert.deepEqual(next,[...base,profile.successorPath].sort());
 assert.deepEqual(crm06StaffJournalPhysicalArguments({source:unifiedSource,profileVariant:'erp-candidate',excludedPaths:next,ownerSid:owner}).slice(-4),['-Source',unifiedSource,'-ProfileVariant','erp-candidate']);
 for(const input of [{source:unifiedSource,profileVariant:'erp-candidate',excludedPaths:base,ownerSid:owner},{source:unifiedSource,excludedPaths:next,ownerSid:owner},{source:copySource,profileVariant:'erp-candidate',excludedPaths:next,ownerSid:owner}])assert.throws(()=>crm06StaffJournalPhysicalArguments(input));
 const ps=fs.readFileSync(new URL('./crm06-staff-journal-preflight.ps1',import.meta.url),'utf8');
 assert(ps.includes("($ProfileVariant -ceq 'erp-candidate' -and $Source -ceq '"+unifiedSource+"')"));
 assert(ps.includes("if($hasParentProbe -and $ProfileVariant -ceq 'erp-candidate'){$expected+=($actorRoot+'\\staff-refresh-successor-439b63db8376-erp-candidate.json')}"));
});

test('combined Hub JS and real scheduled PowerShell entry recognize the same literal variant and retain target guards',()=>{
 const profile=crm06StaffSuccessorProfile(unifiedSource,'erp-candidate');assert.equal(assertErpHubProfile(profile.nextPaths.settings,unifiedSource),true);
 for(const [config,source]of [[profile.nextPaths.settings,copySource],[profile.nextPaths.settings.toUpperCase(),unifiedSource],[profile.nextPaths.settings,unifiedSource.toUpperCase()]])assert.throws(()=>assertErpHubProfile(config,source),{code:'ERP_HUB_WAIT_REJECTED'});
 const ps=fs.readFileSync(new URL('./watch-hub-after-erp.ps1',import.meta.url),'utf8');assert(ps.includes("'"+profile.nextPaths.settings+"'{'"+unifiedSource+"';break}"));assert(ps.includes("default {throw 'ERP_HUB_WAIT_CONFIG_SCOPE'}"));assert(ps.includes('$c.components.crm.sourceCommit-cne$expectedCrmSource'));assert(ps.includes('$fresh.components.crm.sourceCommit-cne$expectedCrmSource'));
 const guardian=fs.readFileSync(new URL('./terminal-completion-logon.mjs',import.meta.url),'utf8');assert(guardian.includes('crm06StaffSuccessorProfileForPath(settings.components.crm.sourceCommit,settings.crmPrivateFiles.crm06StaffSuccessor.path)'));assert(guardian.includes('assertCrm06StaffRefreshSuccessor({baseline,parentActivation:'));assert(guardian.includes('excludedPaths,source:profile.source,...variant'));
});

test('combined variant leaves all eleven old successors and the base CRM18 output fingerprints unchanged',()=>{
 const expected=['d57b40c961cd89450be7cd1fd36fb71919f18eb4960c764212d193ad1ef3e256','f1d1eb450ca1959de2d6ab5c4c2d56f609c083c8c64bbdf255b07f405ce1d474','11624ff661c12f2302d41166dfed5ac41c1e740b6bad2c6cf28321a5bb0886d5','2efb3b63b1b9d161a1f6feb5eb1e88088197d2f93b7e738286af559e6f5f1aa5','5260a5bbbfb733ae5fb609244065aa6362971994c0b8b8c4a8f149f946f1ecaa','068304ce198d245e607cd647d2bea75f8500a288704cdddac22e3f79726a3f6f','b0262377b1692599d54a432517ec1a6727e4097856fe9f202e1f756f6265bfc6','89acd9e3d1dfa6b7df9c17fb5a4ec200a32a89e85279a720643fcf8df4051748','c3debeb56854052e7f2af8c27862671c45f32547ad0e66a860220495e533b0cb','a51b0da60e1a4dae3ef36a929f6faec0654e8c5695a81e7ad435d01af7623994','e73465dc5c1069db3a6e58a92c503a6d4fae3bf4c9038833d2c8df8651526fd8','c6767e23a680b35dec6ad5e9bd52d5245eab4254d666ccbae60bd502a084253f'];
 assert.deepEqual([...legacyProfiles.map(([source,variant])=>inputFor(source,variant)),inputFor()].map(buildCrm06StaffRefreshSuccessor).map(crm06SuccessorFileHash),expected);assert.equal(crm06StaffSuccessorProfile().source,CRM06_STAFF_CRM_SOURCE);
});

