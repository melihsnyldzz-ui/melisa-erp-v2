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


const node24Variant='erp-crm-node24-ready';
const node24Crm={packageRoot:crm+'\\releases\\node-v24.19.0\\crm-shared-test-'+unifiedSource,sourceCommit:unifiedSource,manifestSha256:'e85ce261ece92201e24c86ea52e4df7e95b022b0ae6835e80c9b99e5abaec938'};
const node24Index='0fcb6b27d9cac1aefa186a41b60962cf18be06154b27b171bb65df99a4dfc5af',node24CrmLock=runtime+'\\crm-439b63db8376-node24-dependency-lock.json';
const preservedErp={packageRoot:erp+'\\releases\\CANONICAL-COMPLETE-TEST-20261011-f5f672c-native-ready',sourceCommit:'f5f672c439972b287f77ddd2c7750fa0c6369e87',manifestSha256:'d9e8488888aa89380a690fd6a6a491e7bec14be35c3104e8b742263577c26e97'};
const preservedErpLock=runtime+'\\erpApiNative-f5f672c43997-native-ready-dependency-lock.json';
const requiredNode={path:erp+'\\tools\\node-v24.19.0\\node.exe',sha256:'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'};
function priorNativeFixture(){const f=inputFor();f.profileVariant='erp-candidate-native-ready';f.erpCandidate={packagePin:structuredClone(preservedErp),dependencyLockRef:{path:preservedErpLock,sha256:'6'.repeat(64)},nodeRuntimePin:structuredClone(requiredNode)};return f;}
function node24Fixture(){const f=priorNativeFixture();f.profileVariant=node24Variant;f.crmPackagePin=structuredClone(node24Crm);f.crmIndexSha256=node24Index;f.crmDependencyLockRef.path=node24CrmLock;return f;}

test('CRM Node24 successor admits only a distinct exact build profile without changing ERP native or authority',()=>{
 const f=node24Fixture(),before=structuredClone(f),p=buildCrm06StaffRefreshSuccessor(f),prior=buildCrm06StaffRefreshSuccessor(priorNativeFixture()),profile=crm06StaffSuccessorProfile(unifiedSource,node24Variant);
 assert.deepEqual(f,before);assert.equal(assertCrm06StaffRefreshSuccessor(assertion(f,p)),true);validateCompletionSettings(p.settings,owner);
 assert.equal(profile.nextPaths.settings,runtime+'\\settings-crm06-staff-439b63db8376-erp-crm-node24-ready.json');assert.equal(profile.dependencyLockPath,node24CrmLock);assert.equal(profile.erpDependencyLockPath,preservedErpLock);assert.equal(crm06StaffSuccessorProfileForPath(unifiedSource,profile.successorPath).profileVariant,node24Variant);
 assert.deepEqual(p.settings.components.crm,{...node24Crm,config:p.activationRef});assert.deepEqual(p.settings.components.erpApiNative,prior.settings.components.erpApiNative);assert.deepEqual(p.settings.components.hub,{...preservedErp,config:p.hubStartupRef});assert.deepEqual(p.settings.components.nativeOrder,prior.settings.components.nativeOrder);assert.deepEqual(p.settings.node,requiredNode);
 assert.deepEqual(p.activation,{...prior.activation,packageRoot:node24Crm.packageRoot,packageManifestSha256:node24Crm.manifestSha256,environmentVariables:{...prior.activation.environmentVariables,CRM_TEST_PACKAGE_ROOT:node24Crm.packageRoot,CRM_TEST_PACKAGE_MANIFEST_SHA256:node24Crm.manifestSha256}});
 assert.equal(p.hubPin.crmIndexSha256,node24Index);assert.equal(p.hubPin.crmSourceCommit,unifiedSource);assert.equal(p.hubPin.apiSourceCommit,preservedErp.sourceCommit);
 assert.deepEqual(p.settings.dependencyLocks.erpApiNative,prior.settings.dependencyLocks.erpApiNative);assert.deepEqual(p.settings.dependencyLocks.nativeOrder,prior.settings.dependencyLocks.nativeOrder);assert.deepEqual(p.settings.dependencyLocks.crm,f.crmDependencyLockRef);
 for(const key of ['operationConfig','nativeOrderConfig'])assert.deepEqual(p.settings.privateSources[key],prior.settings.privateSources[key]);for(const key of ['baseline','crm06Actors','catalogAccess'])assert.deepEqual(p.settings.crmPrivateFiles[key],prior.settings.crmPrivateFiles[key]);
 assert.deepEqual(p.receipt.parent,prior.receipt.parent);assert.deepEqual(p.receipt.rollback,prior.receipt.rollback);for(const key of ['installed','authenticatedOperationsVerified','humanAccepted'])assert.equal(p.receipt[key],false);
});

test('CRM Node24 profile refuses old build roots wrong hashes source index dependency or optional-looking Node',()=>{
 const changes=[f=>f.crmPackagePin.packageRoot=crm+'\\releases\\crm-shared-test-'+unifiedSource,f=>f.crmPackagePin.packageRoot=f.crmPackagePin.packageRoot.toUpperCase(),f=>f.crmPackagePin.manifestSha256='342eb291f570dd4294d50206327d67d895bf2e90944026b56392e498a38aebba',f=>f.crmPackagePin.sourceCommit=copySource,f=>f.crmIndexSha256='0'.repeat(64),f=>f.crmDependencyLockRef.path=runtime+'\\crm-439b63db8376-dependency-lock.json',f=>f.erpCandidate.packagePin.packageRoot=f.erpCandidate.packagePin.packageRoot.replace('-native-ready',''),f=>f.erpCandidate.packagePin.manifestSha256='0'.repeat(64),f=>delete f.erpCandidate.nodeRuntimePin,f=>f.erpCandidate.nodeRuntimePin.path='C:\\Program Files\\nodejs\\node.exe',f=>f.erpCandidate.nodeRuntimePin.sha256='0'.repeat(64),f=>f.erpCandidate.nodeRuntimePin.args=['--inspect'],f=>f.erpCandidate.environmentVariables={CRM_PAID_AI_ENABLED:'true'},f=>f.profileVariant='erp-candidate-native-ready',f=>f.profileVariant='ERP-CRM-NODE24-READY'];
 for(const change of changes){const f=node24Fixture();change(f);assert.throws(()=>buildCrm06StaffRefreshSuccessor(f),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});}
 assert.throws(()=>crm06StaffSuccessorProfile(copySource,node24Variant),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});
 const profile=crm06StaffSuccessorProfile(unifiedSource,node24Variant);for(const file of [profile.successorPath.toUpperCase(),profile.successorPath+'-other'])assert.throws(()=>crm06StaffSuccessorProfileForPath(unifiedSource,file),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});
});

test('CRM Node24 receipt reconstruction rejects mixed old activation role Node native and acceptance claims',()=>{
 const f=node24Fixture(),p=buildCrm06StaffRefreshSuccessor(f);
 for(const change of [v=>v.currentActivation.packageRoot=crm+'\\releases\\crm-shared-test-'+unifiedSource,v=>v.currentActivation.environmentVariables.CRM_ASSIGNED_STAFF_REFRESH_USER_ID='crm-patron',v=>v.currentActivation.paidAi=true,v=>v.currentSettings.components.nativeOrder.sourceCommit='b'.repeat(40),v=>v.currentSettings.node.sha256='b'.repeat(64),v=>v.currentSettings.crmPrivateFiles.baseline.sha256='b'.repeat(64),v=>v.receipt.prepared.profileVariant='erp-candidate-native-ready',v=>v.receipt.humanAccepted=true,v=>v.currentHubPin.crmIndexSha256='b'.repeat(64)]){const input=structuredClone(assertion(f,p));change(input);assert.throws(()=>assertCrm06StaffRefreshSuccessor(input),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});}
});

test('CRM Node24 journal has24 finite references and independent PowerShell includes exactly the prior receipts',()=>{
 const prior=crm06StaffJournalExcludedPaths(unifiedSource,'erp-candidate-native-ready'),next=crm06StaffJournalExcludedPaths(unifiedSource,node24Variant),profile=crm06StaffSuccessorProfile(unifiedSource,node24Variant);
 assert.equal(prior.length,23);assert.equal(next.length,24);assert.deepEqual(next,[...prior,profile.successorPath].sort());assert.equal(new Set(next).size,24);
 assert.deepEqual(crm06StaffJournalPhysicalArguments({source:unifiedSource,profileVariant:node24Variant,excludedPaths:next,ownerSid:owner}).slice(-4),['-Source',unifiedSource,'-ProfileVariant',node24Variant]);
 for(const input of [{source:unifiedSource,profileVariant:node24Variant,excludedPaths:prior,ownerSid:owner},{source:copySource,profileVariant:node24Variant,excludedPaths:next,ownerSid:owner},{source:unifiedSource,excludedPaths:next,ownerSid:owner}])assert.throws(()=>crm06StaffJournalPhysicalArguments(input));
 const ps=fs.readFileSync(new URL('./crm06-staff-journal-preflight.ps1',import.meta.url),'utf8');assert(ps.includes("($ProfileVariant -ceq '"+node24Variant+"' -and $Source -ceq '"+unifiedSource+"')"));
 const line=ps.split(/\r?\n/).find(row=>row.startsWith(" if($hasParentProbe -and $ProfileVariant -ceq '"+node24Variant+"')"));assert(line);const refs=[...line.matchAll(/\$actorRoot\+'([^']+)'/g)].map(match=>crm+'\\runtime\\CRM06-TEST-ACTORS-20261014'+match[1]).sort();assert.deepEqual(refs,['erp-candidate','erp-candidate-native-ready',node24Variant].map(variant=>crm06StaffSuccessorProfile(unifiedSource,variant).successorPath).sort());
});

test('CRM Node24 Hub tuple is closed and its real scheduled gate requires the exact pinned Node',()=>{
 const profile=crm06StaffSuccessorProfile(unifiedSource,node24Variant);assert.equal(assertErpHubProfile(profile.nextPaths.settings,unifiedSource),true);
 for(const [config,source]of [[profile.nextPaths.settings.toUpperCase(),unifiedSource],[profile.nextPaths.settings,copySource],[profile.nextPaths.settings+'-other',unifiedSource]])assert.throws(()=>assertErpHubProfile(config,source),{code:'ERP_HUB_WAIT_REJECTED'});
 const ps=fs.readFileSync(new URL('./watch-hub-after-erp.ps1',import.meta.url),'utf8');assert(ps.includes("'"+profile.nextPaths.settings+"'{'"+unifiedSource+"';break}"));assert(ps.includes("$crmNode24Required=$StartupConfigPath-ceq'"+profile.nextPaths.settings+"'"));assert(ps.includes("$literalCrmNode24=$crmNode24Required-and$c.node.path-ceq'"+requiredNode.path+"'-and$c.node.sha256-ceq'"+requiredNode.sha256+"'"));assert(ps.includes('($crmNode24Required-and!$literalCrmNode24)'));
});

test('CRM Node24 CRM and ERP lock aliases cannot cross each other or the earlier native-ready profile',()=>{
 const f=node24Fixture(),p=buildCrm06StaffRefreshSuccessor(f);validateCompletionSettings(p.settings,owner);
 for(const [name,value]of [['crm',runtime+'\\crm-439b63db8376-dependency-lock.json'],['erpApiNative',runtime+'\\erpApiNative-f5f672c43997-dependency-lock.json'],['nativeOrder',preservedErpLock]]){const s=structuredClone(p.settings);s.dependencyLocks[name].path=value;assert.throws(()=>validateCompletionSettings(s,owner));}
 const prior=structuredClone(buildCrm06StaffRefreshSuccessor(priorNativeFixture()).settings);prior.dependencyLocks.crm.path=node24CrmLock;assert.throws(()=>validateCompletionSettings(prior,owner));
});

test('CRM Node24 nested pin accessors are rejected without evaluation',()=>{
 const f=node24Fixture();let reads=0;Object.defineProperty(f.crmPackagePin,'manifestSha256',{enumerable:true,get(){reads++;return node24Crm.manifestSha256;}});assert.throws(()=>buildCrm06StaffRefreshSuccessor(f),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});assert.equal(reads,0);
});

test('CRM Node24 addition preserves earlier native-ready and CRM18 base fingerprints',()=>{
 assert.equal(crm06SuccessorFileHash(buildCrm06StaffRefreshSuccessor(priorNativeFixture())),'73543326bf96e9353ae765c790a12517922df836865f5bfce4e93ac9ea214d42');
 assert.equal(crm06SuccessorFileHash(buildCrm06StaffRefreshSuccessor(inputFor())),'c6767e23a680b35dec6ad5e9bd52d5245eab4254d666ccbae60bd502a084253f');
});

