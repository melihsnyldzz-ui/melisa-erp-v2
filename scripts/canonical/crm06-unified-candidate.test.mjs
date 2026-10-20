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

test('unified candidate admits only its sealed CRM18 package while retaining actors data boundaries and rollback',()=>{
 const f=inputFor(),before=structuredClone(f),p=buildCrm06StaffRefreshSuccessor(f),profile=crm06StaffSuccessorProfile(unifiedSource);
 assert.deepEqual(f,before);assert.equal(assertCrm06StaffRefreshSuccessor(assertion(f,p)),true);validateCompletionSettings(p.settings,owner);
 assert.equal(p.receipt.featureBase.crm,unifiedSource);assert.equal(p.receipt.prepared.crmPackagePin.manifestSha256,unifiedManifest);assert.equal(p.hubPin.crmIndexSha256,unifiedIndex);
 assert.equal(p.receiptRef.path,crm+'\\runtime\\CRM06-TEST-ACTORS-20261014\\staff-refresh-successor-439b63db8376.json');
 assert.equal(profile.journalEvidencePath,crm+'\\runtime\\CRM06-TEST-ACTORS-20261014\\journal-physical-preflight-439b63db8376.json');
 assert.equal(p.settings.dependencyLocks.crm.path,runtime+'\\crm-439b63db8376-dependency-lock.json');
 for(const ref of [p.activationRef,p.settingsRef,p.hubPinRef,p.hubStartupRef])assert(ref.path.endsWith('439b63db8376.json'));
 const prior=buildCrm06StaffRefreshSuccessor(inputFor(copySource));
 assert.deepEqual(p.receipt.parent,prior.receipt.parent);assert.deepEqual(p.receipt.rollback,prior.receipt.rollback);
 for(const key of ['erpApiNative','nativeOrder']){assert.deepEqual(p.settings.components[key],prior.settings.components[key]);assert.deepEqual(p.settings.dependencyLocks[key],prior.settings.dependencyLocks[key]);}
 for(const key of ['CRM_ASSIGNED_STAFF_REFRESH_USER_ID','CRM_ASSIGNED_STAFF_REFRESH_JOURNAL_PATH','CRM_CUSTOMER_PRODUCT_REQUEST_ISSUER_IDS','CRM_PAID_AI_ENABLED','WHATSAPP_SEND_ENABLED'])assert.equal(p.activation.environmentVariables[key],prior.activation.environmentVariables[key]);
 assert.deepEqual(p.settings.crmPrivateFiles.baseline,prior.settings.crmPrivateFiles.baseline);assert.deepEqual(p.settings.crmPrivateFiles.crm06Actors,prior.settings.crmPrivateFiles.crm06Actors);
 for(const key of ['installed','authenticatedOperationsVerified','humanAccepted'])assert.equal(p.receipt[key],false);
 assert(Object.isFrozen(profile)&&Object.isFrozen(profile.nextPaths)&&Object.isFrozen(p.settings));
});

test('unified candidate rejects wrong sealed hashes source aliases paths variants and active-parent substitution',()=>{
 for(const source of [unifiedSource.slice(0,12),unifiedSource.toUpperCase(),'f'.repeat(40),null])assert.throws(()=>crm06StaffSuccessorProfile(source),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});
 for(const variant of ['parent-probe','receipt-wait','',null,'other'])assert.throws(()=>crm06StaffSuccessorProfile(unifiedSource,variant),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});
 for(const change of [f=>f.crmPackagePin.manifestSha256='f'.repeat(64),f=>f.crmIndexSha256='e'.repeat(64),f=>f.crmPackagePin.packageRoot+='-other',f=>f.crmPackagePin.sourceCommit=copySource,f=>f.crmDependencyLockRef.path=crm06StaffSuccessorProfile(copySource).dependencyLockPath,f=>f.supervisorPin.packageRoot=f.supervisorPin.packageRoot.replace('20261015','20261014'),f=>f.parentSettings=structuredClone(buildCrm06StaffRefreshSuccessor(inputFor(copySource)).settings)]){
  const f=inputFor();change(f);assert.throws(()=>buildCrm06StaffRefreshSuccessor(f),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});
 }
 const profile=crm06StaffSuccessorProfile(unifiedSource);
 assert.equal(crm06StaffSuccessorProfileForPath(unifiedSource,profile.successorPath).source,unifiedSource);
 for(const [source,path]of [[copySource,profile.successorPath],[unifiedSource,crm06StaffSuccessorProfile(copySource).successorPath],[unifiedSource,profile.successorPath.toUpperCase()]])assert.throws(()=>crm06StaffSuccessorProfileForPath(source,path),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});
});

test('unified candidate full assertion rejects crossed refs and altered permissions or acceptance claims',()=>{
 const f=inputFor(),p=buildCrm06StaffRefreshSuccessor(f);
 for(const change of [v=>v.currentSettings.crmPrivateFiles.crm06StaffSuccessor.path=crm06StaffSuccessorProfile(copySource).successorPath,v=>v.currentHubPin.crmIndexSha256='e'.repeat(64),v=>v.currentActivation.environmentVariables.CRM_CUSTOMER_PRODUCT_REQUEST_ISSUER_IDS='["crm-crm06-staff-test-20261014"]',v=>v.currentActivation.environmentVariables.WHATSAPP_SEND_ENABLED='true',v=>v.currentActivation.environmentVariables.CRM_PAID_AI_ENABLED='true',v=>v.receipt.prepared.crmPackagePin.manifestSha256='f'.repeat(64),v=>v.receipt.installed=true,v=>v.receipt.humanAccepted=true]){
  const input=structuredClone(assertion(f,p));change(input);assert.throws(()=>assertCrm06StaffRefreshSuccessor(input),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});
 }
});

test('unified physical journal policy extends the old finite refs by one without invoking physical inspection',()=>{
 const previous=crm06StaffJournalExcludedPaths(copySource),before=[...previous],profile=crm06StaffSuccessorProfile(unifiedSource),current=crm06StaffJournalExcludedPaths(unifiedSource);
 assert.deepEqual(current,[...previous,profile.successorPath].sort());assert.deepEqual(previous,before);assert(Object.isFrozen(current));assert.equal(new Set(current).size,current.length);
 const args=crm06StaffJournalPhysicalArguments({ownerSid:owner,excludedPaths:current,source:unifiedSource});
 assert.deepEqual(args.slice(-2),['-Source',unifiedSource]);assert.equal(args.includes('-ProfileVariant'),false);
 for(const input of [{ownerSid:owner,excludedPaths:previous,source:unifiedSource},{ownerSid:owner,excludedPaths:current,source:copySource},{ownerSid:owner,excludedPaths:current,source:unifiedSource.toUpperCase()},{ownerSid:owner,excludedPaths:current,source:unifiedSource,profileVariant:'receipt-wait'}])assert.throws(()=>crm06StaffJournalPhysicalArguments(input));
});

test('unified independent PowerShell closed source set and reference set match the JS policy',()=>{
 const code=fs.readFileSync(new URL('./crm06-staff-journal-preflight.ps1',import.meta.url),'utf8'),set=/\[ValidateSet\(([^)]+)\)\]\[string\]\$Source/.exec(code);
 assert(set);const actual=[...set[1].matchAll(/'([a-f0-9]{40})'/g)].map(match=>match[1]);
 const integratedSource='6bc82e6fe9726261ef1d0171d97e5d9da9f5398a';
 const currentSource='7ba6e4ebc8b70019136d603e6307741189ba03c1';
 assert.deepEqual(actual,[...new Set(legacyProfiles.map(([source])=>source)),unifiedSource,integratedSource,currentSource]);
 assert(code.includes("-and $Source -cne '"+unifiedSource+"' -and $Source -cne '"+integratedSource+"' -and $Source -cne '"+currentSource+"'){throw 'REJECT'}"));
 const line=code.split(/\r?\n/).find(value=>value.startsWith(" if($Source -ceq '"+unifiedSource+"' -or $Source -ceq '"+integratedSource+"')"));assert(line);
 const root=crm+'\\runtime\\CRM06-TEST-ACTORS-20261014';
 const references=[...line.matchAll(/\$actorRoot\+'([^']+)'/g)].map(match=>root+match[1]).sort();
 const expected=crm06StaffJournalExcludedPaths(unifiedSource).filter(name=>name.includes('\\staff-refresh-successor-')&&!name.endsWith('b2985d2295c0.json'));
 assert.deepEqual(references,expected);assert.equal(new Set(references).size,references.length);
});

test('unified Hub readiness admits only the exact config source tuple and fixed diagnostic receipt',()=>{
 const profile=crm06StaffSuccessorProfile(unifiedSource),previous=crm06StaffSuccessorProfile(copySource);
 assert.equal(assertErpHubProfile(profile.nextPaths.settings,unifiedSource),true);assert.equal(assertErpHubProfile(previous.nextPaths.settings,copySource),true);
 for(const [config,source]of [[profile.nextPaths.settings,copySource],[previous.nextPaths.settings,unifiedSource],[profile.nextPaths.settings.toUpperCase(),unifiedSource],[profile.nextPaths.settings,unifiedSource.toUpperCase()],[profile.nextPaths.settings,unifiedSource.slice(0,12)],[profile.nextPaths.settings+'-other',unifiedSource]])assert.throws(()=>assertErpHubProfile(config,source),{code:'ERP_HUB_WAIT_REJECTED'});
 const receipt=runtime+'\\hub-web\\erp-prerequisites-'+'a'.repeat(32)+'.json';
 assert.deepEqual(erpHubFailureMetadata(profile.nextPaths.settings,sha,receipt,'ERP_HUB_WAIT_IDENTITY'),{path:receipt+'.failure.json',code:'ERP_HUB_WAIT_IDENTITY',configSha256:sha});
});

test('unified scheduled PowerShell Hub entry preserves the exact case-sensitive JS config source contract',()=>{
 const code=fs.readFileSync(new URL('./watch-hub-after-erp.ps1',import.meta.url),'utf8');
 const block=/\$expectedCrmSource=switch -CaseSensitive \(\$StartupConfigPath\)\{([\s\S]*?)\r?\n\}/.exec(code);assert(block);
 const pattern=/^ '([^']+)'\{'([a-f0-9]{40})';break\}\r?$/gm;
 const pairs=[...block[1].matchAll(pattern)].map(([,config,source])=>({config,source}));
 const expected=legacyProfiles.filter(([source,variant])=>source!==CRM06_STAFF_CRM_SOURCE&&(source!=='da82fc6644c1d9dba0c10eaa861773534d43c288'||variant==='parent-probe')).map(([source,variant])=>({config:crm06StaffSuccessorProfile(source,variant).nextPaths.settings,source}));
 expected.push({config:crm06StaffSuccessorProfile(unifiedSource).nextPaths.settings,source:unifiedSource});
 expected.push({config:runtime+'\\settings-crm06-staff-439b63db8376-erp-candidate.json',source:unifiedSource});
 expected.push({config:runtime+'\\settings-crm06-staff-439b63db8376-erp-candidate-native-ready.json',source:unifiedSource});
 expected.push({config:runtime+'\\settings-crm06-staff-439b63db8376-erp-crm-node24-ready.json',source:unifiedSource});
 expected.push({config:runtime+'\\settings-crm06-staff-439b63db8376-erp-crm-node24-hub-ready.json',source:unifiedSource});
 expected.push({config:crm06StaffSuccessorProfile('6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','erp-crm-integrated-20261017').nextPaths.settings,source:'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a'});
 expected.push({config:crm06StaffSuccessorProfile('6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','erp-crm-hub-lineage-20261017').nextPaths.settings,source:'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a'});
 expected.push({config:crm06StaffSuccessorProfile('6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','erp-crm-pr53-20261018').nextPaths.settings,source:'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a'});
 expected.push({config:crm06StaffSuccessorProfile('6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','erp-crm-pr53-ci-20261018').nextPaths.settings,source:'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a'});
 expected.push({config:crm06StaffSuccessorProfile('6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','erp-crm-pr54-reads-20261019').nextPaths.settings,source:'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a'});
 expected.push({config:crm06StaffSuccessorProfile('6bc82e6fe9726261ef1d0171d97e5d9da9f5398a','erp-crm-pr54-b264-20261020').nextPaths.settings,source:'6bc82e6fe9726261ef1d0171d97e5d9da9f5398a'});
 // All historical entries remain byte-for-byte ordered; only this exact new
 // generation is appended to the closed switch, never a wildcard profile.
 expected.push({config:runtime+'\\settings-crm06-staff-7ba6e4ebc8b7-erp-6dc33f417373-current.json',source:'7ba6e4ebc8b70019136d603e6307741189ba03c1'});
 assert.deepEqual(pairs,expected);for(const pair of pairs)assert.equal(assertErpHubProfile(pair.config,pair.source),true);
 assert.equal(block[1].replace(pattern,'').replace(/default \{throw 'ERP_HUB_WAIT_CONFIG_SCOPE'\}/,'').trim(),'');
 const next=expected.at(-1);assert(!pairs.some(pair=>pair.config===next.config.toUpperCase()));assert(!pairs.some(pair=>pair.config===next.config+'-other'));
 assert(code.includes('$c.components.crm.sourceCommit-cne$expectedCrmSource'));assert(code.includes('$fresh.components.crm.sourceCommit-cne$expectedCrmSource'));
});

test('unified profile preserves all eleven pre-change successor output hashes and default',()=>{
 const expected=['d57b40c961cd89450be7cd1fd36fb71919f18eb4960c764212d193ad1ef3e256','f1d1eb450ca1959de2d6ab5c4c2d56f609c083c8c64bbdf255b07f405ce1d474','11624ff661c12f2302d41166dfed5ac41c1e740b6bad2c6cf28321a5bb0886d5','2efb3b63b1b9d161a1f6feb5eb1e88088197d2f93b7e738286af559e6f5f1aa5','5260a5bbbfb733ae5fb609244065aa6362971994c0b8b8c4a8f149f946f1ecaa','068304ce198d245e607cd647d2bea75f8500a288704cdddac22e3f79726a3f6f','b0262377b1692599d54a432517ec1a6727e4097856fe9f202e1f756f6265bfc6','89acd9e3d1dfa6b7df9c17fb5a4ec200a32a89e85279a720643fcf8df4051748','c3debeb56854052e7f2af8c27862671c45f32547ad0e66a860220495e533b0cb','a51b0da60e1a4dae3ef36a929f6faec0654e8c5695a81e7ad435d01af7623994','e73465dc5c1069db3a6e58a92c503a6d4fae3bf4c9038833d2c8df8651526fd8'];
 assert.deepEqual(legacyProfiles.map(([source,variant])=>crm06SuccessorFileHash(buildCrm06StaffRefreshSuccessor(inputFor(source,variant)))),expected);assert.equal(crm06StaffSuccessorProfile().source,CRM06_STAFF_CRM_SOURCE);
});
