import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildCrm06TestActorProvisioning,crm06ProvisioningInputHash as digest} from './crm06-test-actor-provisioning.mjs';
import {buildCrm06OwnerProjection,CRM06_BASELINE_PATH,CRM06_ACTOR_AUDIT_PATH} from './crm06-owner-projection.mjs';
import {buildCrm06StaffRefreshSuccessor,assertCrm06StaffRefreshSuccessor,crm06StaffSuccessorProfile,crm06StaffSuccessorProfileForPath,crm06SuccessorFileHash,CRM06_STAFF_PARENT_SETTINGS_PATH,CRM06_STAFF_PARENT_ACTIVATION_PATH,CRM06_STAFF_CRM_SOURCE} from './crm06-staff-refresh-successor.mjs';
import {crm06StaffJournalExcludedPaths,crm06StaffJournalPhysicalArguments} from './crm06-staff-journal-preflight.mjs';
import {assertErpHubProfile,erpHubFailureMetadata} from './wait-erp-for-hub.mjs';

test('19/20October supervisor archive keeps raw Git blob bytes without changing Git config',{skip:process.platform!=='win32'},()=>{
 const source=fs.readFileSync(new URL('./build-crm06-supervisor-package.mjs',import.meta.url),'utf8');
 const options=source.match(/const archiveOptions=([^;]+);/)[1];for(const day of ['20261019','20261020'])assert.deepEqual(Function('target','return '+options)('TEST-'+day+'-fixture'),['-c','core.autocrlf=false','-c','core.eol=lf']);for(const day of ['20261014','20261015','20261017','20261018'])assert.deepEqual(Function('target','return '+options)('TEST-'+day+'-fixture'),[]);
 const cwd=fileURLToPath(new URL('../..',import.meta.url)),file='scripts/canonical/build-crm06-supervisor-package.mjs';
 const archive=spawnSync('git',['-c','core.autocrlf=false','-c','core.eol=lf','archive','--format=tar','HEAD',file],{cwd,windowsHide:true,maxBuffer:2e6});assert.equal(archive.status,0);
 const extracted=spawnSync('tar.exe',['-xOf','-',file],{cwd,input:archive.stdout,windowsHide:true,maxBuffer:2e6});assert.equal(extracted.status,0);
 const blob=spawnSync('git',['show','HEAD:'+file],{cwd,windowsHide:true,maxBuffer:2e6});assert.equal(blob.status,0);
 const hash=b=>createHash('sha256').update(b).digest('hex');assert.equal(hash(extracted.stdout),hash(blob.stdout));
});
import {validateCompletionSettings} from './terminal-completion-logon.mjs';
import {preparePr53CiOwnerProfile,preparePr54ReadOwnerProfile,preparePr54B264OwnerProfile,PR54_B264_OWNER_VARIANT,PR53_CI_OWNER_SUPERVISOR} from './p03-pr53-ci-owner-preparation.mjs';
import {preparePr53OwnerProfile,PR53_OWNER_SUPERVISOR} from './p03-pr53-owner-preparation.mjs';
import {crm06StaffJournalReferenceHash,CRM06_STAFF_JOURNAL_ROOT,CRM06_STAFF_JOURNAL_PATH} from './crm06-staff-journal-preflight.mjs';
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


const hubVariant='erp-crm-node24-hub-ready';
const webHub={packageRoot:erp+'\\releases\\CANONICAL-COMPLETE-TEST-20261011-f5f672c',sourceCommit:'f5f672c439972b287f77ddd2c7750fa0c6369e87',manifestSha256:'0e119c7256f8e34290973cd0e4c627e992906eb2641cf06fd830f853525af653'};
function hubFixture(){const f=structuredClone(node24Fixture());f.profileVariant=hubVariant;return f;}

test('Hub-ready generation keeps native repair and CRM Node24 while selecting only original immutable web package',()=>{
 const f=hubFixture(),before=structuredClone(f),p=buildCrm06StaffRefreshSuccessor(f),prior=buildCrm06StaffRefreshSuccessor(node24Fixture()),profile=crm06StaffSuccessorProfile(unifiedSource,hubVariant);
 assert.deepEqual(f,before);validateCompletionSettings(p.settings,owner);assert.equal(assertCrm06StaffRefreshSuccessor(assertion(f,p)),true);
 assert.equal(profile.nextPaths.settings,runtime+'\\settings-crm06-staff-439b63db8376-erp-crm-node24-hub-ready.json');assert.equal(crm06StaffSuccessorProfileForPath(unifiedSource,profile.successorPath).profileVariant,hubVariant);
 assert.deepEqual(p.settings.components.hub,{...webHub,config:p.hubStartupRef});assert.equal(p.hubStartup.PackageRoot,webHub.packageRoot);assert.equal(p.hubStartup.SourceCommit,webHub.sourceCommit);assert.equal(p.hubStartup.ManifestSha256,webHub.manifestSha256);
 assert.deepEqual(p.settings.components.erpApiNative,prior.settings.components.erpApiNative);assert.deepEqual(p.settings.components.nativeOrder,prior.settings.components.nativeOrder);assert.deepEqual(p.activation,prior.activation);assert.deepEqual(p.settings.components.crm,{...prior.settings.components.crm,config:p.activationRef});assert.deepEqual(p.settings.node,requiredNode);
 assert.deepEqual(p.hubPin,prior.hubPin);assert.equal(p.hubPin.apiSourceCommit,preservedErp.sourceCommit);assert.deepEqual(p.settings.dependencyLocks,prior.settings.dependencyLocks);for(const key of ['operationConfig','nativeOrderConfig'])assert.deepEqual(p.settings.privateSources[key],prior.settings.privateSources[key]);for(const key of ['baseline','crm06Actors','catalogAccess'])assert.deepEqual(p.settings.crmPrivateFiles[key],prior.settings.crmPrivateFiles[key]);assert.deepEqual(p.receipt.parent,prior.receipt.parent);assert.deepEqual(p.receipt.rollback,prior.receipt.rollback);for(const key of ['installed','authenticatedOperationsVerified','humanAccepted'])assert.equal(p.receipt[key],false);
});

test('Hub-ready constructor refuses adjustable Hub targets and wrong API native CRM Node or role scope',()=>{
 for(const change of [f=>f.hubPackagePin=webHub,f=>f.erpCandidate.hubPackagePin=webHub,f=>f.erpCandidate.packagePin=structuredClone(webHub),f=>f.erpCandidate.packagePin.manifestSha256='0'.repeat(64),f=>f.erpCandidate.packagePin.sourceCommit='b'.repeat(40),f=>delete f.erpCandidate.nodeRuntimePin,f=>f.erpCandidate.nodeRuntimePin.path='C:\\Program Files\\nodejs\\node.exe',f=>f.erpCandidate.nodeRuntimePin.sha256='0'.repeat(64),f=>f.erpCandidate.nodeRuntimePin.options=[],f=>f.crmPackagePin.manifestSha256=unifiedManifest,f=>f.crmPackagePin.packageRoot=crm+'\\releases\\crm-shared-test-'+unifiedSource,f=>f.crmDependencyLockRef.path=runtime+'\\crm-439b63db8376-dependency-lock.json',f=>f.crmIndexSha256='0'.repeat(64),f=>f.profileVariant='ERP-CRM-NODE24-HUB-READY',f=>f.parentActivation.environmentVariables.CRM_ASSIGNED_STAFF_REFRESH_USER_ID='crm-patron']){const f=hubFixture();change(f);assert.throws(()=>buildCrm06StaffRefreshSuccessor(f),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});}
 assert.throws(()=>crm06StaffSuccessorProfile(copySource,hubVariant));const profile=crm06StaffSuccessorProfile(unifiedSource,hubVariant);for(const file of [profile.successorPath.toUpperCase(),profile.successorPath+'-other'])assert.throws(()=>crm06StaffSuccessorProfileForPath(unifiedSource,file));
});

test('Hub-ready receipt reconstitution rejects mixed derivative Hub or altered authority and acceptance',()=>{
 const f=hubFixture(),p=buildCrm06StaffRefreshSuccessor(f);
 for(const change of [v=>v.currentSettings.components.hub.packageRoot=preservedErp.packageRoot,v=>v.currentSettings.components.hub.manifestSha256=preservedErp.manifestSha256,v=>v.currentHubStartup.PackageRoot=preservedErp.packageRoot,v=>v.currentSettings.components.erpApiNative.packageRoot=webHub.packageRoot,v=>v.currentSettings.components.nativeOrder.sourceCommit='b'.repeat(40),v=>v.currentSettings.node.sha256='b'.repeat(64),v=>v.currentActivation.paidAi=true,v=>v.currentActivation.environmentVariables.CRM_ASSIGNED_STAFF_REFRESH_USER_ID='crm-patron',v=>v.receipt.prepared.profileVariant=node24Variant,v=>v.receipt.humanAccepted=true]){const input=structuredClone(assertion(f,p));change(input);assert.throws(()=>assertCrm06StaffRefreshSuccessor(input),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});}
});

test('Hub-ready physical journal has exactly25 references and independently closed PowerShell set',()=>{
 const prior=crm06StaffJournalExcludedPaths(unifiedSource,node24Variant),next=crm06StaffJournalExcludedPaths(unifiedSource,hubVariant),profile=crm06StaffSuccessorProfile(unifiedSource,hubVariant);assert.equal(prior.length,24);assert.equal(next.length,25);assert.deepEqual(next,[...prior,profile.successorPath].sort());assert.equal(new Set(next).size,25);assert.deepEqual(crm06StaffJournalPhysicalArguments({source:unifiedSource,profileVariant:hubVariant,excludedPaths:next,ownerSid:owner}).slice(-4),['-Source',unifiedSource,'-ProfileVariant',hubVariant]);
 for(const input of [{source:unifiedSource,profileVariant:hubVariant,excludedPaths:prior,ownerSid:owner},{source:copySource,profileVariant:hubVariant,excludedPaths:next,ownerSid:owner},{source:unifiedSource,excludedPaths:next,ownerSid:owner}])assert.throws(()=>crm06StaffJournalPhysicalArguments(input));
 const ps=fs.readFileSync(new URL('./crm06-staff-journal-preflight.ps1',import.meta.url),'utf8');assert(ps.includes("($ProfileVariant -ceq '"+hubVariant+"' -and $Source -ceq '"+unifiedSource+"')"));const line=ps.split(/\r?\n/).find(row=>row.startsWith(" if($hasParentProbe -and $ProfileVariant -ceq '"+hubVariant+"')"));assert(line);const refs=[...line.matchAll(/\$actorRoot\+'([^']+)'/g)].map(match=>crm+'\\runtime\\CRM06-TEST-ACTORS-20261014'+match[1]).sort();assert.deepEqual(refs,['erp-candidate','erp-candidate-native-ready',node24Variant,hubVariant].map(variant=>crm06StaffSuccessorProfile(unifiedSource,variant).successorPath).sort());
});

test('Hub-ready barrier and actual scheduled PowerShell gate admit only exact source config and Node24',()=>{
 const profile=crm06StaffSuccessorProfile(unifiedSource,hubVariant);assert.equal(assertErpHubProfile(profile.nextPaths.settings,unifiedSource),true);for(const [config,source]of [[profile.nextPaths.settings.toUpperCase(),unifiedSource],[profile.nextPaths.settings,copySource],[profile.nextPaths.settings+'-other',unifiedSource]])assert.throws(()=>assertErpHubProfile(config,source));const ps=fs.readFileSync(new URL('./watch-hub-after-erp.ps1',import.meta.url),'utf8');assert(ps.includes("'"+profile.nextPaths.settings+"'{'"+unifiedSource+"';break}"));assert(ps.includes("$crmNode24HubRequired=$StartupConfigPath-ceq'"+profile.nextPaths.settings+"'"));assert(ps.includes("$literalCrmNode24Hub=$crmNode24HubRequired-and$c.node.path-ceq'"+requiredNode.path+"'-and$c.node.sha256-ceq'"+requiredNode.sha256+"'"));assert(ps.includes('($crmNode24HubRequired-and!$literalCrmNode24Hub)'));assert(ps.includes("$c.node.path-cne'C:\\Program Files\\nodejs\\node.exe'-and!$literalCandidateNode"));
});

test('Hub-ready picks a name admitted by the unchanged full manifest validating supported launcher',()=>{
 const source=fs.readFileSync(new URL('./start-hub-web.ps1',import.meta.url),'utf8'),match=/\$completionName=\$packageName -cmatch '([^']+)'/.exec(source);assert(match);const pattern=new RegExp(match[1]);assert(pattern.test(webHub.packageRoot.split('\\').at(-1)));assert(!pattern.test(preservedErp.packageRoot.split('\\').at(-1)));assert(source.includes('$c.SourceCommit.StartsWith($Matches[1])'));assert(source.includes("$m.sourceCommit -ne $c.SourceCommit -or !$m.baselineReproduced"));assert(source.includes("foreach($file in $m.files)"));
 const f=hubFixture(),p=buildCrm06StaffRefreshSuccessor(f);for(const [name,value]of [['crm',runtime+'\\crm-439b63db8376-dependency-lock.json'],['erpApiNative',runtime+'\\erpApiNative-f5f672c43997-dependency-lock.json'],['nativeOrder',preservedErpLock]]){const s=structuredClone(p.settings);s.dependencyLocks[name].path=value;assert.throws(()=>validateCompletionSettings(s,owner));}
});

test('Hub-ready accessor pins are rejected without reading them',()=>{
 const f=hubFixture();let reads=0;Object.defineProperty(f.erpCandidate.packagePin,'manifestSha256',{enumerable:true,get(){reads++;return preservedErp.manifestSha256;}});assert.throws(()=>buildCrm06StaffRefreshSuccessor(f));assert.equal(reads,0);
});

test('Hub-ready addition preserves Node24 native-ready and CRM base fingerprints',()=>{
 assert.equal(crm06SuccessorFileHash(buildCrm06StaffRefreshSuccessor(node24Fixture())),'8800a730b2a18f648cf40c776cb5673613bdce8ecb5d794fbb072c0833f7f343');assert.equal(crm06SuccessorFileHash(buildCrm06StaffRefreshSuccessor(priorNativeFixture())),'73543326bf96e9353ae765c790a12517922df836865f5bfce4e93ac9ea214d42');assert.equal(crm06SuccessorFileHash(buildCrm06StaffRefreshSuccessor(inputFor())),'c6767e23a680b35dec6ad5e9bd52d5245eab4254d666ccbae60bd502a084253f');
});

const integratedVariant='erp-crm-integrated-20261017',integratedCrmSource='6bc82e6fe9726261ef1d0171d97e5d9da9f5398a';
const integratedErp={packageRoot:erp+'\\releases\\CANONICAL-COMPLETE-TEST-20261017-e0e6c28',sourceCommit:'e0e6c288373478208a1fb2b48fca36b18b092dac',manifestSha256:'c1f01f72b907b6b481a2665096270c9ceaea977446ed8f300f600e9e9640dcfa'};
const integratedCrm={packageRoot:crm+'\\releases\\crm-shared-test-'+integratedCrmSource,sourceCommit:integratedCrmSource,manifestSha256:'e276feb306e84c7af1a042184c2007f19b14191780d9a265edc9196f5766fc83'};
function integratedFixture(){const f=hubFixture();f.profileVariant=integratedVariant;f.crmPackagePin=structuredClone(integratedCrm);f.crmIndexSha256='e1a8faeabe007b54ecd63dd8bd3dd345f3b5a0144bb6f4f9ce4df037dd76dc04';f.crmDependencyLockRef.path=runtime+'\\crm-6bc82e6fe972-node24-dependency-lock.json';f.erpCandidate.packagePin=structuredClone(integratedErp);f.erpCandidate.dependencyLockRef.path=runtime+'\\erpApiNative-e0e6c2883734-dependency-lock.json';f.supervisorPin.packageRoot=erp+'\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261017-'+'8'.repeat(12);return f;}
test('integrated TEST profile binds only exact ERP and CRM immutable candidates without enabling writes',()=>{
 const f=integratedFixture(),p=buildCrm06StaffRefreshSuccessor(f),profile=crm06StaffSuccessorProfile(integratedCrmSource,integratedVariant);
 assert.equal(assertCrm06StaffRefreshSuccessor(assertion(f,p)),true);validateCompletionSettings(p.settings,owner);
 assert.deepEqual(p.settings.components.erpApiNative,{...integratedErp,config:f.parentSettings.components.erpApiNative.config});
 assert.deepEqual(p.settings.components.hub,{...integratedErp,config:p.hubStartupRef});assert.deepEqual(p.settings.components.crm,{...integratedCrm,config:p.activationRef});
 assert.deepEqual(p.settings.node,requiredNode);assert.equal(p.receipt.prepared.profileVariant,integratedVariant);assert.equal(p.receipt.installed,false);assert.equal(p.receipt.humanAccepted,false);
 assert.equal(crm06StaffSuccessorProfileForPath(integratedCrmSource,profile.successorPath).profileVariant,integratedVariant);
 assert.equal(assertErpHubProfile(profile.nextPaths.settings,integratedCrmSource),true);
});
test('integrated TEST profile rejects changed package, Node and crossed old profile',()=>{
 for(const change of [f=>f.erpCandidate.packagePin.manifestSha256='0'.repeat(64),f=>f.crmPackagePin.manifestSha256='0'.repeat(64),f=>f.crmIndexSha256='0'.repeat(64),f=>f.erpCandidate.nodeRuntimePin.sha256='0'.repeat(64),f=>f.crmPackagePin.packageRoot=node24Crm.packageRoot,f=>f.profileVariant=hubVariant]){const f=integratedFixture();change(f);assert.throws(()=>buildCrm06StaffRefreshSuccessor(f),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});}
 assert.throws(()=>crm06StaffSuccessorProfile(unifiedSource,integratedVariant));
});
test('integrated TEST journal and Hub gates accept one literal profile only',()=>{
 const profile=crm06StaffSuccessorProfile(integratedCrmSource,integratedVariant),prior=crm06StaffJournalExcludedPaths(unifiedSource,hubVariant),next=crm06StaffJournalExcludedPaths(integratedCrmSource,integratedVariant);
 assert.equal(prior.length,25);assert.deepEqual(next,[...prior,profile.successorPath].sort());
 assert.deepEqual(crm06StaffJournalPhysicalArguments({source:integratedCrmSource,profileVariant:integratedVariant,excludedPaths:next,ownerSid:owner}).slice(-4),['-Source',integratedCrmSource,'-ProfileVariant',integratedVariant]);
 assert.throws(()=>crm06StaffJournalExcludedPaths(integratedCrmSource));assert.throws(()=>crm06StaffSuccessorProfile(integratedCrmSource));
 for(const source of [unifiedSource,'0'.repeat(40)])assert.throws(()=>assertErpHubProfile(profile.nextPaths.settings,source));
 const ps=fs.readFileSync(new URL('./crm06-staff-journal-preflight.ps1',import.meta.url),'utf8'),watch=fs.readFileSync(new URL('./watch-hub-after-erp.ps1',import.meta.url),'utf8');
 assert(ps.includes("($ProfileVariant -ceq '"+integratedVariant+"' -and $Source -ceq '"+integratedCrmSource+"')"));
 assert(ps.includes("if($Source -ceq '"+integratedCrmSource+"' -and -not $hasParentProbe){throw 'REJECT'}"));
 assert(watch.includes("'"+profile.nextPaths.settings+"'{'"+integratedCrmSource+"';break}"));
 assert(watch.includes("$integratedNodeRequired=$StartupConfigPath-ceq'"+profile.nextPaths.settings+"'"));
 assert(watch.includes('($integratedNodeRequired-and!$literalIntegratedNode)'));
 const builder=fs.readFileSync(new URL('./build-crm06-supervisor-package.mjs',import.meta.url),'utf8');
 assert(builder.includes("expected=['20261014','20261015','20261017','20261018','20261019','20261020'].map(day=>"));
});

const lineageVariant='erp-crm-hub-lineage-20261017';
const pr53Variant='erp-crm-pr53-20261018';
const pr53Erp={packageRoot:erp+'\\releases\\CANONICAL-COMPLETE-TEST-20261018-c88d7010f831',sourceCommit:'c88d7010f8318b088c73201585a254f8975c650d',manifestSha256:'72cde5c7e2a51aab283f3b66bbb0a921360296f01f343bbc32cc7b904a4a0640'};
function pr53Fixture(){const f=integratedFixture();f.profileVariant=pr53Variant;f.erpCandidate.packagePin=structuredClone(pr53Erp);f.erpCandidate.dependencyLockRef.path=runtime+'\\erpApiNative-c88d7010f831-dependency-lock.json';f.supervisorPin.packageRoot=f.supervisorPin.packageRoot.replace('20261017','20261018');return f;}

test('PR53 is an exact separate inactive profile and preserves earlier generations',()=>{
 const before=buildCrm06StaffRefreshSuccessor(lineageFixture()),f=pr53Fixture(),next=buildCrm06StaffRefreshSuccessor(f),p=crm06StaffSuccessorProfile(integratedCrmSource,pr53Variant);
 assert.equal(assertCrm06StaffRefreshSuccessor(assertion(f,next)),true);validateCompletionSettings(next.settings,owner);
 assert.deepEqual(next.settings.components.erpApiNative,{...pr53Erp,config:f.parentSettings.components.erpApiNative.config});
 assert.deepEqual(next.settings.components.hub,{...pr53Erp,config:next.hubStartupRef});assert.deepEqual(next.settings.node,requiredNode);
 assert.equal(next.settings.dependencyLocks.erpApiNative.path,p.erpDependencyLockPath);
 assert.equal(next.receipt.installed,false);assert.equal(next.receipt.humanAccepted,false);
 assert.equal(crm06StaffSuccessorProfileForPath(integratedCrmSource,p.successorPath).profileVariant,pr53Variant);
 assert.equal(assertErpHubProfile(p.nextPaths.settings,integratedCrmSource),true);
 assert.deepEqual(before,buildCrm06StaffRefreshSuccessor(lineageFixture()));
});

test('PR53 rejects alternate package bytes, paths, toolchain and supervisor day',()=>{
 for(const change of [f=>f.erpCandidate.packagePin.sourceCommit=lineageErp.sourceCommit,f=>f.erpCandidate.packagePin.packageRoot=lineageErp.packageRoot,f=>f.erpCandidate.packagePin.manifestSha256=lineageErp.manifestSha256,f=>f.erpCandidate.dependencyLockRef.path=runtime+'\\erpApiNative-1a03157a323e-dependency-lock.json',f=>f.erpCandidate.nodeRuntimePin.sha256='0'.repeat(64),f=>f.supervisorPin.packageRoot=f.supervisorPin.packageRoot.replace('20261018','20261017'),f=>f.profileVariant=pr53Variant+'-other']){const f=pr53Fixture();change(f);assert.throws(()=>buildCrm06StaffRefreshSuccessor(f));}
});

test('PR53 journal is the prior lineage policy plus its exact successor',()=>{
 const p=crm06StaffSuccessorProfile(integratedCrmSource,pr53Variant),old=crm06StaffJournalExcludedPaths(integratedCrmSource,lineageVariant),next=crm06StaffJournalExcludedPaths(integratedCrmSource,pr53Variant);
 assert.deepEqual(next,[...old,p.successorPath].sort());
 assert.deepEqual(crm06StaffJournalPhysicalArguments({source:integratedCrmSource,profileVariant:pr53Variant,excludedPaths:next,ownerSid:owner}).slice(-4),['-Source',integratedCrmSource,'-ProfileVariant',pr53Variant]);
 assert.throws(()=>crm06StaffJournalPhysicalArguments({source:integratedCrmSource,profileVariant:pr53Variant,excludedPaths:old,ownerSid:owner}));
});

const pr53CiVariant='erp-crm-pr53-ci-20261018';
const pr53CiErp={packageRoot:erp+'\\releases\\CANONICAL-COMPLETE-TEST-20261018-e59e07abf7ae',sourceCommit:'e59e07abf7ae2567cdc2adb93811fe29e0032fe5',manifestSha256:'2b8115a7ad44854d48626717930857aff26a97ffd37e9dbbc4310ab675b869c7'};
function pr53CiFixture(){const f=pr53Fixture();f.profileVariant=pr53CiVariant;f.erpCandidate.packagePin=structuredClone(pr53CiErp);f.erpCandidate.dependencyLockRef.path=runtime+'\\erpApiNative-e59e07abf7ae-dependency-lock.json';return f;}
test('PR53 CI is an exact separate inactive profile and preserves earlier generations',()=>{
 const before=buildCrm06StaffRefreshSuccessor(pr53Fixture()),f=pr53CiFixture(),next=buildCrm06StaffRefreshSuccessor(f),p=crm06StaffSuccessorProfile(integratedCrmSource,pr53CiVariant);
 assert.equal(assertCrm06StaffRefreshSuccessor(assertion(f,next)),true);validateCompletionSettings(next.settings,owner);
 assert.deepEqual(next.settings.components.erpApiNative,{...pr53CiErp,config:f.parentSettings.components.erpApiNative.config});
 assert.deepEqual(next.settings.components.hub,{...pr53CiErp,config:next.hubStartupRef});assert.deepEqual(next.settings.node,requiredNode);
 assert.equal(next.settings.dependencyLocks.erpApiNative.path,p.erpDependencyLockPath);
 assert.equal(next.receipt.installed,false);assert.equal(next.receipt.humanAccepted,false);
 assert.equal(crm06StaffSuccessorProfileForPath(integratedCrmSource,p.successorPath).profileVariant,pr53CiVariant);
 assert.equal(assertErpHubProfile(p.nextPaths.settings,integratedCrmSource),true);
 assert.deepEqual(before,buildCrm06StaffRefreshSuccessor(pr53Fixture()));
});

test('PR53 CI rejects alternate package bytes, paths, toolchain and supervisor day',()=>{
 for(const change of [f=>f.erpCandidate.packagePin.sourceCommit=lineageErp.sourceCommit,f=>f.erpCandidate.packagePin.packageRoot=lineageErp.packageRoot,f=>f.erpCandidate.packagePin.manifestSha256=lineageErp.manifestSha256,f=>f.erpCandidate.dependencyLockRef.path=runtime+'\\erpApiNative-1a03157a323e-dependency-lock.json',f=>f.erpCandidate.nodeRuntimePin.sha256='0'.repeat(64),f=>f.supervisorPin.packageRoot=f.supervisorPin.packageRoot.replace('20261018','20261017'),f=>f.profileVariant=pr53CiVariant+'-other']){const f=pr53CiFixture();change(f);assert.throws(()=>buildCrm06StaffRefreshSuccessor(f));}
});

test('PR53 CI journal is the prior lineage policy plus its exact successor',()=>{
 const p=crm06StaffSuccessorProfile(integratedCrmSource,pr53CiVariant),old=crm06StaffJournalExcludedPaths(integratedCrmSource,pr53Variant),next=crm06StaffJournalExcludedPaths(integratedCrmSource,pr53CiVariant);
 assert.deepEqual(next,[...old,p.successorPath].sort());
 assert.deepEqual(crm06StaffJournalPhysicalArguments({source:integratedCrmSource,profileVariant:pr53CiVariant,excludedPaths:next,ownerSid:owner}).slice(-4),['-Source',integratedCrmSource,'-ProfileVariant',pr53CiVariant]);
 assert.throws(()=>crm06StaffJournalPhysicalArguments({source:integratedCrmSource,profileVariant:pr53CiVariant,excludedPaths:old,ownerSid:owner}));
});

test('PR53 owner helper binds exact pins and canonical lock and journal evidence hashes without IO',()=>{
 const f=pr53Fixture(),profile=crm06StaffSuccessorProfile(integratedCrmSource,pr53Variant);
 const parentInputs=Object.fromEntries(['baseline','parentActivation','parentAudit','parentSettings','parentSettingsRef','parentHubPin','parentHubStartup','ownerSid'].map(k=>[k,f[k]]));
 const lock=(pin,module)=>({schemaVersion:1,sourceCommit:pin.sourceCommit,packageRoot:pin.packageRoot,files:[{path:module+'/node_modules/package/index.js',sha256:sha}]});
 const erpDependencyLock=lock(pr53Erp,'apps/api'),crmDependencyLock=lock(f.crmPackagePin,'apps/gateway');
 const references=crm06StaffJournalExcludedPaths(integratedCrmSource,pr53Variant).map(path=>({path,exists:false,volumeSerial:null,fileId:null,linkCount:null,reparse:false}));
 const meta=(path,directory,fileId)=>({path,ownerSid:owner,daclProtected:true,foreignWritable:false,foreignAllowed:false,volumeSerial:'1234ABCD',fileId,linkCount:1,reparse:false,directory});
 const journalEvidence={schemaVersion:'crm06-staff-journal-physical.v1',status:'READY',path:CRM06_STAFF_JOURNAL_PATH,actorRoot:CRM06_STAFF_JOURNAL_ROOT,callerSid:owner,ancestorReparse:false,parent:meta(CRM06_STAFF_JOURNAL_ROOT,true,'0000000000000001'),journal:meta(CRM06_STAFF_JOURNAL_PATH,false,'0000000000000002'),references,referenceSha256:crm06StaffJournalReferenceHash(references)};
 const input={parentInputs,erpDependencyLock,crmDependencyLock,journalEvidence,erpDependencyLockRef:{path:profile.erpDependencyLockPath,sha256:crm06SuccessorFileHash(erpDependencyLock)},crmDependencyLockRef:{path:profile.dependencyLockPath,sha256:crm06SuccessorFileHash(crmDependencyLock)},journalEvidenceRef:{path:profile.journalEvidencePath,sha256:crm06SuccessorFileHash(journalEvidence)}};
 const before=structuredClone(input),next=preparePr53OwnerProfile(input);
 assert.deepEqual(next.settings.supervisor,PR53_OWNER_SUPERVISOR);assert.deepEqual(input,before);assert.equal(next.receipt.installed,false);
 for(const change of [x=>x.erpDependencyLock.files[0].sha256='0'.repeat(64),x=>x.journalEvidenceRef.sha256='0'.repeat(64),x=>x.journalEvidence.status='PREPARE_REQUIRED',x=>x.erpDependencyLockRef.path=runtime+'\\erpApiNative-1a03157a323e-dependency-lock.json']){const bad=structuredClone(input);change(bad);assert.throws(()=>preparePr53OwnerProfile(bad));}
});
test('PR53 CI owner helper binds exact pins and canonical lock and journal evidence hashes without IO',()=>{
 const f=pr53CiFixture(),profile=crm06StaffSuccessorProfile(integratedCrmSource,pr53CiVariant);
 const parentInputs=Object.fromEntries(['baseline','parentActivation','parentAudit','parentSettings','parentSettingsRef','parentHubPin','parentHubStartup','ownerSid'].map(k=>[k,f[k]]));
 const lock=(pin,module)=>({schemaVersion:1,sourceCommit:pin.sourceCommit,packageRoot:pin.packageRoot,files:[{path:module+'/node_modules/package/index.js',sha256:sha}]});
 const erpDependencyLock=lock(pr53CiErp,'apps/api'),crmDependencyLock=lock(f.crmPackagePin,'apps/gateway');
 const references=crm06StaffJournalExcludedPaths(integratedCrmSource,pr53CiVariant).map(path=>({path,exists:false,volumeSerial:null,fileId:null,linkCount:null,reparse:false}));
 const meta=(path,directory,fileId)=>({path,ownerSid:owner,daclProtected:true,foreignWritable:false,foreignAllowed:false,volumeSerial:'1234ABCD',fileId,linkCount:1,reparse:false,directory});
 const journalEvidence={schemaVersion:'crm06-staff-journal-physical.v1',status:'READY',path:CRM06_STAFF_JOURNAL_PATH,actorRoot:CRM06_STAFF_JOURNAL_ROOT,callerSid:owner,ancestorReparse:false,parent:meta(CRM06_STAFF_JOURNAL_ROOT,true,'0000000000000001'),journal:meta(CRM06_STAFF_JOURNAL_PATH,false,'0000000000000002'),references,referenceSha256:crm06StaffJournalReferenceHash(references)};
 const input={parentInputs,erpDependencyLock,crmDependencyLock,journalEvidence,erpDependencyLockRef:{path:profile.erpDependencyLockPath,sha256:crm06SuccessorFileHash(erpDependencyLock)},crmDependencyLockRef:{path:profile.dependencyLockPath,sha256:crm06SuccessorFileHash(crmDependencyLock)},journalEvidenceRef:{path:profile.journalEvidencePath,sha256:crm06SuccessorFileHash(journalEvidence)}};
 const before=structuredClone(input),next=preparePr53CiOwnerProfile(input);
 assert.deepEqual(next.settings.supervisor,PR53_CI_OWNER_SUPERVISOR);assert.deepEqual(input,before);assert.equal(next.receipt.installed,false);
 for(const change of [x=>x.erpDependencyLock.files[0].sha256='0'.repeat(64),x=>x.journalEvidenceRef.sha256='0'.repeat(64),x=>x.journalEvidence.status='PREPARE_REQUIRED',x=>x.erpDependencyLockRef.path=runtime+'\\erpApiNative-1a03157a323e-dependency-lock.json']){const bad=structuredClone(input);change(bad);assert.throws(()=>preparePr53CiOwnerProfile(bad));}
});
const lineageErp={packageRoot:erp+'\\releases\\CANONICAL-COMPLETE-TEST-20261017-1a03157a323e',sourceCommit:'1a03157a323e6a6c16aea714194a76b6438a435c',manifestSha256:'9e5d75db4312231ab06af2f17d421b0f4e3e909cdfaee19743d92ae171ad6a66'};
function lineageFixture(){const f=integratedFixture();f.profileVariant=lineageVariant;f.erpCandidate.packagePin=structuredClone(lineageErp);f.erpCandidate.dependencyLockRef.path=runtime+'\\erpApiNative-1a03157a323e-dependency-lock.json';return f;}
test('Hub lineage is a separate inactive exact CRM6bc ERP1a source profile',()=>{
 const old=buildCrm06StaffRefreshSuccessor(integratedFixture()),f=lineageFixture(),next=buildCrm06StaffRefreshSuccessor(f),profile=crm06StaffSuccessorProfile(integratedCrmSource,lineageVariant);
 assert.equal(crm06SuccessorFileHash(old),'a941d9d924eb220451516f6eb152fb8f990742aa162a53f9c7a6ef069b3eb70d');
 assert.equal(assertCrm06StaffRefreshSuccessor(assertion(f,next)),true);validateCompletionSettings(next.settings,owner);
 assert.deepEqual(next.settings.components.erpApiNative,{...lineageErp,config:f.parentSettings.components.erpApiNative.config});
 assert.deepEqual(next.settings.components.hub,{...lineageErp,config:next.hubStartupRef});assert.deepEqual(next.settings.node,requiredNode);
 assert.equal(next.settings.dependencyLocks.erpApiNative.path,profile.erpDependencyLockPath);
 assert.equal(next.receipt.installed,false);assert.equal(next.receipt.humanAccepted,false);
 assert.equal(crm06StaffSuccessorProfileForPath(integratedCrmSource,profile.successorPath).profileVariant,lineageVariant);
 assert.equal(assertErpHubProfile(profile.nextPaths.settings,integratedCrmSource),true);
 assert.notEqual(profile.successorPath,crm06StaffSuccessorProfile(integratedCrmSource,integratedVariant).successorPath);
 assert.deepEqual(old,buildCrm06StaffRefreshSuccessor(integratedFixture()));
});
test('Hub lineage rejects package and path substitutions before generation',()=>{
 for(const change of [f=>f.erpCandidate.packagePin.sourceCommit=integratedErp.sourceCommit,f=>f.erpCandidate.packagePin.packageRoot=integratedErp.packageRoot,f=>f.erpCandidate.packagePin.manifestSha256=integratedErp.manifestSha256,f=>f.erpCandidate.dependencyLockRef.path=runtime+'\\erpApiNative-e0e6c2883734-dependency-lock.json',f=>f.erpCandidate.nodeRuntimePin.sha256='0'.repeat(64),f=>f.profileVariant=integratedVariant]){const f=lineageFixture();change(f);assert.throws(()=>buildCrm06StaffRefreshSuccessor(f),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});}
 const profile=crm06StaffSuccessorProfile(integratedCrmSource,lineageVariant);
 assert.equal(crm06StaffSuccessorProfileForPath(integratedCrmSource,crm06StaffSuccessorProfile(integratedCrmSource,integratedVariant).successorPath).profileVariant,integratedVariant);
 for(const wrong of [profile.successorPath.toUpperCase(),profile.successorPath+'-other'])assert.throws(()=>crm06StaffSuccessorProfileForPath(integratedCrmSource,wrong));
 assert.throws(()=>assertErpHubProfile(profile.nextPaths.settings,integratedErp.sourceCommit));
});
test('Hub lineage journal adds old e0e and new exact successor refs with matching PowerShell policy',()=>{
 const old=crm06StaffJournalExcludedPaths(integratedCrmSource,integratedVariant),profile=crm06StaffSuccessorProfile(integratedCrmSource,lineageVariant),next=crm06StaffJournalExcludedPaths(integratedCrmSource,lineageVariant);
 assert.deepEqual(next,[...old,profile.successorPath].sort());
 assert.deepEqual(crm06StaffJournalPhysicalArguments({source:integratedCrmSource,profileVariant:lineageVariant,excludedPaths:next,ownerSid:owner}).slice(-4),['-Source',integratedCrmSource,'-ProfileVariant',lineageVariant]);
 assert.throws(()=>crm06StaffJournalPhysicalArguments({source:integratedCrmSource,profileVariant:lineageVariant,excludedPaths:old,ownerSid:owner}));
 const ps=fs.readFileSync(new URL('./crm06-staff-journal-preflight.ps1',import.meta.url),'utf8'),watch=fs.readFileSync(new URL('./watch-hub-after-erp.ps1',import.meta.url),'utf8');
 assert(ps.includes("($ProfileVariant -ceq '"+lineageVariant+"' -and $Source -ceq '"+integratedCrmSource+"')"));
 assert(ps.includes("if($hasParentProbe -and $ProfileVariant -ceq '"+lineageVariant+"'){$expected+=($actorRoot+'\\staff-refresh-successor-6bc82e6fe972-erp-1a03157.json')}"));
 assert(watch.includes("'"+profile.nextPaths.settings+"'{'"+integratedCrmSource+"';break}"));
 assert(watch.includes("($hubLineageNodeRequired-and!$literalHubLineageNode)"));
});
test('WindowsPS5 journal parameter AST admits only the four exact CRM6bc profiles',{skip:process.platform!=='win32'},()=>{
 const sourcePath=fileURLToPath(new URL('./crm06-staff-journal-preflight.ps1',import.meta.url)).replaceAll("'","''");
 const script=`$ErrorActionPreference='Stop';$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${sourcePath}',[ref]$tokens,[ref]$errors)
if($errors.Count-ne0){throw 'PARSE_FAILED'}
$try=$ast.EndBlock.Statements|Where-Object {$_ -is [Management.Automation.Language.TryStatementAst]}|Select-Object -First 1
$statements=@($try.Body.Statements);$start=$statements|Where-Object {$_.Extent.Text.StartsWith('$phase=') -and $_.Extent.Text.Contains("'PARAMETERS'")}|Select-Object -First 1
$end=$statements|Where-Object {$_.Extent.Text.StartsWith('[Array]::Sort($expected,')}|Select-Object -First 1
if(-not $start-or-not $end){throw 'POLICY_AST_MISSING'}
$text=$ast.Extent.Text.Substring($start.Extent.StartOffset,$end.Extent.EndOffset-$start.Extent.StartOffset)
$policy=[scriptblock]::Create('param($Source,$ProfileVariant,$actorRoot)'+[Environment]::NewLine+$text+[Environment]::NewLine+'return ,$expected')
$cases=@(@('${integratedCrmSource}','${integratedVariant}'),@('${integratedCrmSource}','${lineageVariant}'),@('${integratedCrmSource}','${pr53Variant}'),@('${integratedCrmSource}','${pr53CiVariant}'),@('${integratedCrmSource}',$null),@('${integratedCrmSource}','erp-crm-hub-lineage-20261017-other'),@('${unifiedSource}','${lineageVariant}'))
$results=@(foreach($case in $cases){try{$a=@{Source=$case[0];actorRoot='C:\\Sirket\\CRM\\runtime\\CRM06-TEST-ACTORS-20261014'};if($null-ne$case[1]){$a.ProfileVariant=$case[1]};$paths=& $policy @a;[pscustomobject]@{accepted=$true;paths=@($paths)}}catch{[pscustomobject]@{accepted=$false;paths=@()}}})
ConvertTo-Json -InputObject @($results) -Depth 5 -Compress`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,result.stderr);const rows=JSON.parse(result.stdout);assert.equal(rows.length,7);
 assert.deepEqual(rows[0].paths,[...crm06StaffJournalExcludedPaths(integratedCrmSource,integratedVariant)]);
 assert.deepEqual(rows[1].paths,[...crm06StaffJournalExcludedPaths(integratedCrmSource,lineageVariant)]);
 assert.deepEqual(rows[2].paths,[...crm06StaffJournalExcludedPaths(integratedCrmSource,pr53Variant)]);
 assert.deepEqual(rows[3].paths,[...crm06StaffJournalExcludedPaths(integratedCrmSource,pr53CiVariant)]);
 for(const row of rows.slice(4))assert.equal(row.accepted,false);
});

const readsVariant='erp-crm-pr54-reads-20261019';
function readsFixture(){const f=pr53CiFixture();f.profileVariant=readsVariant;f.erpCandidate.packagePin={packageRoot:erp+'\\releases\\CANONICAL-CANDIDATE-TEST-20261019-01ef3e3a',sourceCommit:'01ef3e3aa3bd6b8cc4f05191e1ccdf58fb76c7f2',manifestSha256:'8754f9cb11449ad1f784f16ce0425a129725847c1aa0b5397d5611c3fcc4edcf'};f.erpCandidate.dependencyLockRef.path=runtime+'\\erpApiNative-01ef3e3aa3bd-dependency-lock.json';f.supervisorPin.packageRoot=f.supervisorPin.packageRoot.replace('20261018','20261019');return f;}
test('read repair profile admits only reviewed immutable package and retains original profiles and roles',()=>{
 const f=readsFixture(),before=structuredClone(f),legacy=buildCrm06StaffRefreshSuccessor(pr53CiFixture()),next=buildCrm06StaffRefreshSuccessor(f),p=crm06StaffSuccessorProfile(integratedCrmSource,readsVariant);
 assert.equal(assertCrm06StaffRefreshSuccessor(assertion(f,next)),true);validateCompletionSettings(next.settings,owner);assertErpHubProfile(p.nextPaths.settings,integratedCrmSource);
 assert.deepEqual(f,before);assert.deepEqual(next.settings.components.erpApiNative,{...f.erpCandidate.packagePin,config:f.parentSettings.components.erpApiNative.config});assert.deepEqual(next.settings.components.nativeOrder,f.parentSettings.components.nativeOrder);assert.deepEqual(next.settings.crmPrivateFiles.baseline,f.parentSettings.crmPrivateFiles.baseline);assert.deepEqual(next.settings.crmPrivateFiles.crm06Actors,f.parentSettings.crmPrivateFiles.crm06Actors);
 assert.equal(next.receipt.installed,false);assert.equal(next.receipt.humanAccepted,false);assert.equal(crm06StaffSuccessorProfileForPath(integratedCrmSource,p.successorPath).profileVariant,readsVariant);assert.deepEqual(legacy,buildCrm06StaffRefreshSuccessor(pr53CiFixture()));
 assert.equal(crm06StaffJournalPhysicalArguments({source:integratedCrmSource,profileVariant:readsVariant,excludedPaths:crm06StaffJournalExcludedPaths(integratedCrmSource,readsVariant),ownerSid:owner}).at(-1),readsVariant);assert.deepEqual(crm06StaffJournalExcludedPaths(integratedCrmSource,readsVariant),[...crm06StaffJournalExcludedPaths(integratedCrmSource,pr53CiVariant),p.successorPath].sort());
});
for(const [label,change] of [['source',f=>f.erpCandidate.packagePin.sourceCommit=pr53CiErp.sourceCommit],['bytes',f=>f.erpCandidate.packagePin.manifestSha256='0'.repeat(64)],['path',f=>f.erpCandidate.packagePin.packageRoot+='-other'],['lock',f=>f.erpCandidate.dependencyLockRef.path+='-other'],['node',f=>f.erpCandidate.nodeRuntimePin.sha256='0'.repeat(64)],['supervisor day',f=>f.supervisorPin.packageRoot=f.supervisorPin.packageRoot.replace('20261019','20261018')]])test('read repair profile rejects '+label,()=>{const f=readsFixture();change(f);assert.throws(()=>buildCrm06StaffRefreshSuccessor(f));});

test('read repair owner helper binds exact pins and canonical lock and journal evidence hashes without IO',()=>{
 const f=readsFixture(),profile=crm06StaffSuccessorProfile(integratedCrmSource,readsVariant);
 const parentInputs=Object.fromEntries(['baseline','parentActivation','parentAudit','parentSettings','parentSettingsRef','parentHubPin','parentHubStartup','ownerSid'].map(k=>[k,f[k]]));
 const lock=(pin,module)=>({schemaVersion:1,sourceCommit:pin.sourceCommit,packageRoot:pin.packageRoot,files:[{path:module+'/node_modules/package/index.js',sha256:sha}]});
 const erpDependencyLock=lock(f.erpCandidate.packagePin,'apps/api'),crmDependencyLock=lock(f.crmPackagePin,'apps/gateway');
 const references=crm06StaffJournalExcludedPaths(integratedCrmSource,readsVariant).map(path=>({path,exists:false,volumeSerial:null,fileId:null,linkCount:null,reparse:false}));
 const meta=(path,directory,fileId)=>({path,ownerSid:owner,daclProtected:true,foreignWritable:false,foreignAllowed:false,volumeSerial:'1234ABCD',fileId,linkCount:1,reparse:false,directory});
 const journalEvidence={schemaVersion:'crm06-staff-journal-physical.v1',status:'READY',path:CRM06_STAFF_JOURNAL_PATH,actorRoot:CRM06_STAFF_JOURNAL_ROOT,callerSid:owner,ancestorReparse:false,parent:meta(CRM06_STAFF_JOURNAL_ROOT,true,'0000000000000001'),journal:meta(CRM06_STAFF_JOURNAL_PATH,false,'0000000000000002'),references,referenceSha256:crm06StaffJournalReferenceHash(references)};
 const input={parentInputs,erpDependencyLock,crmDependencyLock,journalEvidence,supervisorPin:f.supervisorPin,erpDependencyLockRef:{path:profile.erpDependencyLockPath,sha256:crm06SuccessorFileHash(erpDependencyLock)},crmDependencyLockRef:{path:profile.dependencyLockPath,sha256:crm06SuccessorFileHash(crmDependencyLock)},journalEvidenceRef:{path:profile.journalEvidencePath,sha256:crm06SuccessorFileHash(journalEvidence)}};
 const before=structuredClone(input),next=preparePr54ReadOwnerProfile(input);
 assert.deepEqual(next.settings.supervisor,f.supervisorPin);assert.deepEqual(input,before);assert.equal(next.receipt.installed,false);
 for(const change of [x=>x.erpDependencyLock.files[0].sha256='0'.repeat(64),x=>x.journalEvidenceRef.sha256='0'.repeat(64),x=>x.journalEvidence.status='PREPARE_REQUIRED',x=>x.erpDependencyLockRef.path=runtime+'\\erpApiNative-1a03157a323e-dependency-lock.json']){const bad=structuredClone(input);change(bad);assert.throws(()=>preparePr54ReadOwnerProfile(bad));}
});

test('legacy pr54Reads snapshot remains byte-identical after B264 addition',()=>{const value=buildCrm06StaffRefreshSuccessor(readsFixture());assert.equal(crm06SuccessorFileHash(value),'7393f5dc0f665d5d44d711328cdd4317fd380e6f9077d7fb0cedb459e7cd49c1');assert.equal(crm06SuccessorFileHash(crm06StaffSuccessorProfile(integratedCrmSource,readsVariant)),'137f3920a01b268b956844a4d68fd4587896830ed4ff5e4265fc1850f77e8b73');assert.equal(crm06SuccessorFileHash(crm06StaffJournalExcludedPaths(integratedCrmSource,readsVariant)),'38393696b920f08daa449ce32302d14e1a907c0b996f130365c175a43b7162a7');});


const b264SyntheticSupervisor=Object.freeze({packageRoot:erp+'\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-20261020-'+ 'b'.repeat(12),sourceCommit:'b'.repeat(40),manifestSha256:'c'.repeat(64)});
function b264Fixture(){
 const f=readsFixture(),profile=crm06StaffSuccessorProfile(integratedCrmSource,PR54_B264_OWNER_VARIANT);
 f.profileVariant=PR54_B264_OWNER_VARIANT;f.supervisorPin={...b264SyntheticSupervisor};f.crmDependencyLockRef.path=profile.dependencyLockPath;f.erpCandidate.dependencyLockRef.path=profile.erpDependencyLockPath;return f;
}
function b264PreparationInput(){
 const f=b264Fixture(),profile=crm06StaffSuccessorProfile(integratedCrmSource,PR54_B264_OWNER_VARIANT);
 const parentInputs=Object.fromEntries(['baseline','parentActivation','parentAudit','parentSettings','parentSettingsRef','parentHubPin','parentHubStartup','ownerSid'].map(k=>[k,f[k]]));
 const lock=(pin,module)=>({schemaVersion:1,sourceCommit:pin.sourceCommit,packageRoot:pin.packageRoot,files:[{path:module+'/node_modules/package/index.js',sha256:sha}]});
 const erpDependencyLock=lock(f.erpCandidate.packagePin,'apps/api'),crmDependencyLock=lock(f.crmPackagePin,'apps/gateway');
 const references=crm06StaffJournalExcludedPaths(integratedCrmSource,PR54_B264_OWNER_VARIANT).map(path=>({path,exists:false,volumeSerial:null,fileId:null,linkCount:null,reparse:false}));
 const meta=(path,directory,fileId)=>({path,ownerSid:owner,daclProtected:true,foreignWritable:false,foreignAllowed:false,volumeSerial:'1234ABCD',fileId,linkCount:1,reparse:false,directory});
 const journalEvidence={schemaVersion:'crm06-staff-journal-physical.v1',status:'READY',path:CRM06_STAFF_JOURNAL_PATH,actorRoot:CRM06_STAFF_JOURNAL_ROOT,callerSid:owner,ancestorReparse:false,parent:meta(CRM06_STAFF_JOURNAL_ROOT,true,'0000000000000001'),journal:meta(CRM06_STAFF_JOURNAL_PATH,false,'0000000000000002'),references,referenceSha256:crm06StaffJournalReferenceHash(references)};
 return {parentInputs,supervisorPin:f.supervisorPin,erpDependencyLock,crmDependencyLock,journalEvidence,erpDependencyLockRef:{path:profile.erpDependencyLockPath,sha256:crm06SuccessorFileHash(erpDependencyLock)},crmDependencyLockRef:{path:profile.dependencyLockPath,sha256:crm06SuccessorFileHash(crmDependencyLock)},journalEvidenceRef:{path:profile.journalEvidencePath,sha256:crm06SuccessorFileHash(journalEvidence)}};
}
test('B264 exact inactive profile reuses the constructor and lock while keeping all prior child paths distinct',()=>{
 const f=b264Fixture(),input=b264PreparationInput(),before=structuredClone(input),next=preparePr54B264OwnerProfile(input),profile=crm06StaffSuccessorProfile(integratedCrmSource,PR54_B264_OWNER_VARIANT),oldProfile=crm06StaffSuccessorProfile(integratedCrmSource,readsVariant);
 assert.deepEqual(input,before);assert.deepEqual(next.settings.supervisor,b264SyntheticSupervisor);assert.equal(assertCrm06StaffRefreshSuccessor(assertion(f,next)),true);validateCompletionSettings(next.settings,owner);
 assert.equal(profile.nextPaths.settings,runtime+'\\settings-crm06-staff-6bc82e6fe972-erp-01ef3e3aa3bd-b264-successor.json');
 assert.equal(profile.erpDependencyLockPath,oldProfile.erpDependencyLockPath);assert.equal(profile.dependencyLockPath,oldProfile.dependencyLockPath);
 for(const key of Object.keys(profile.nextPaths)){assert.notEqual(profile.nextPaths[key],oldProfile.nextPaths[key]);assert.match(profile.nextPaths[key],/-b264-successor\.json$/);}
 for(const key of ['successorPath','journalEvidencePath']){assert.notEqual(profile[key],oldProfile[key]);assert.match(profile[key],/-b264-successor\.json$/);}
 assert.equal(crm06StaffSuccessorProfileForPath(integratedCrmSource,profile.successorPath).profileVariant,PR54_B264_OWNER_VARIANT);
 assert.deepEqual(next.settings.components.nativeOrder,f.parentSettings.components.nativeOrder);assert.deepEqual(next.settings.crmPrivateFiles.baseline,f.parentSettings.crmPrivateFiles.baseline);assert.deepEqual(next.settings.crmPrivateFiles.crm06Actors,f.parentSettings.crmPrivateFiles.crm06Actors);
 assert.equal(next.receipt.installed,false);assert.equal(next.receipt.authenticatedOperationsVerified,false);assert.equal(next.receipt.humanAccepted,false);
 assert.deepEqual(crm06StaffJournalExcludedPaths(integratedCrmSource,PR54_B264_OWNER_VARIANT),[...crm06StaffJournalExcludedPaths(integratedCrmSource,readsVariant),profile.successorPath].sort());
 assert.equal(crm06StaffJournalPhysicalArguments({source:integratedCrmSource,profileVariant:PR54_B264_OWNER_VARIANT,excludedPaths:crm06StaffJournalExcludedPaths(integratedCrmSource,PR54_B264_OWNER_VARIANT),ownerSid:owner}).at(-1),PR54_B264_OWNER_VARIANT);
});

test('B264 selector rejects unknown variants, foreign source, supervisor substitution and mismatched canonical evidence',()=>{
 for(const variant of [PR54_B264_OWNER_VARIANT+'-other',PR54_B264_OWNER_VARIANT.toUpperCase(),'erp-crm-pr54-b264-20261021'])assert.throws(()=>crm06StaffSuccessorProfile(integratedCrmSource,variant));
 assert.throws(()=>crm06StaffSuccessorProfile(unifiedSource,PR54_B264_OWNER_VARIANT));
 for(const change of [f=>f.supervisorPin.sourceCommit='a'.repeat(40),f=>f.supervisorPin.manifestSha256='not-a-sha',f=>f.supervisorPin.packageRoot+='-other',f=>f.erpCandidate.packagePin.sourceCommit='a'.repeat(40),f=>f.erpCandidate.dependencyLockRef.path+='-other']){const f=b264Fixture();change(f);assert.throws(()=>buildCrm06StaffRefreshSuccessor(f));}
 for(const change of [i=>i.supervisorPin.packageRoot=i.supervisorPin.packageRoot.replace('20261020','20261019'),i=>i.supervisorPin.manifestSha256='bad',i=>i.supervisorPin.sourceCommit='bad',i=>i.supervisorPin.unexpected=true,i=>i.profileVariant=readsVariant,i=>i.erpDependencyLockRef.path+='-other',i=>i.journalEvidenceRef.path=crm06StaffSuccessorProfile(integratedCrmSource,readsVariant).journalEvidencePath,i=>i.journalEvidenceRef.sha256='0'.repeat(64),i=>i.erpDependencyLock.sourceCommit='a'.repeat(40),i=>i.crmDependencyLock.files[0].sha256='0'.repeat(64),i=>i.journalEvidence.references.pop()]){const input=b264PreparationInput();change(input);assert.throws(()=>preparePr54B264OwnerProfile(input));}
});

test('WindowsPS5 B264 journal policy matches exact MJS exclusions and refuses cross-source or approximate variants',{skip:process.platform!=='win32'},()=>{
 const sourcePath=fileURLToPath(new URL('./crm06-staff-journal-preflight.ps1',import.meta.url)).replaceAll("'","''");
 const script=`$ErrorActionPreference='Stop';$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${sourcePath}',[ref]$tokens,[ref]$errors)
if($errors.Count-ne0){throw 'PARSE_FAILED'}
$try=$ast.EndBlock.Statements|Where-Object {$_ -is [Management.Automation.Language.TryStatementAst]}|Select-Object -First 1
$statements=@($try.Body.Statements);$start=$statements|Where-Object {$_.Extent.Text.StartsWith('$phase=') -and $_.Extent.Text.Contains("'PARAMETERS'")}|Select-Object -First 1
$end=$statements|Where-Object {$_.Extent.Text.StartsWith('[Array]::Sort($expected,')}|Select-Object -First 1
if(-not $start-or-not $end){throw 'POLICY_AST_MISSING'}
$text=$ast.Extent.Text.Substring($start.Extent.StartOffset,$end.Extent.EndOffset-$start.Extent.StartOffset)
$policy=[scriptblock]::Create('param($Source,$ProfileVariant,$actorRoot)'+[Environment]::NewLine+$text+[Environment]::NewLine+'return ,$expected')
$cases=@(@('${integratedCrmSource}','${PR54_B264_OWNER_VARIANT}'),@('${integratedCrmSource}','${readsVariant}'),@('${integratedCrmSource}','${PR54_B264_OWNER_VARIANT}-other'),@('${unifiedSource}','${PR54_B264_OWNER_VARIANT}'))
$results=@(foreach($case in $cases){try{$paths=& $policy -Source $case[0] -ProfileVariant $case[1] -actorRoot 'C:\\Sirket\\CRM\\runtime\\CRM06-TEST-ACTORS-20261014';[pscustomobject]@{accepted=$true;paths=@($paths)}}catch{[pscustomobject]@{accepted=$false;paths=@()}}})
ConvertTo-Json -InputObject @($results) -Depth 5 -Compress`;
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,result.stderr);const rows=JSON.parse(result.stdout);assert.equal(rows.length,4);
 assert.equal(rows[0].accepted,true);assert.deepEqual(rows[0].paths,[...crm06StaffJournalExcludedPaths(integratedCrmSource,PR54_B264_OWNER_VARIANT)]);
 assert.equal(rows[1].accepted,true);assert.deepEqual(rows[1].paths,[...crm06StaffJournalExcludedPaths(integratedCrmSource,readsVariant)]);
 for(const row of rows.slice(2))assert.equal(row.accepted,false);
});
