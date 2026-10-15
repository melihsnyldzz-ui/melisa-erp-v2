// Pure successor preparation. Never rewrites the original actor receipt, users,
// journals or packages; ordinary login and physical installation stay separate.
import crypto from 'node:crypto';
import path from 'node:path';
import {assertCrm06PreparedActorReceipt,CRM06_BASELINE_PATH,CRM06_ACTOR_AUDIT_PATH} from './crm06-owner-projection.mjs';
import {crm06ProvisioningInputHash as digest} from './crm06-test-actor-provisioning.mjs';
import {validateCompletionSettings,completionCrmEnvironment,validateCurrentCrmHubPins} from './terminal-completion-logon.mjs';

export const CRM06_STAFF_CRM_SOURCE='b2985d2295c022848c769ea5f494012c1eb3fa00';
export const CRM06_STAFF_FRONTEND_CRM_SOURCE='da82fc6644c1d9dba0c10eaa861773534d43c288';
export const CRM06_STAFF_CANDIDATE_CRM_SOURCE='5ce452b01ef20fc84a09c52b78311db8eb1dd1d8';
export const CRM06_STAFF_FINAL_BATCH_CRM_SOURCE='5bcd5ad136ff7ca35d623d436b8724cc491641be';
export const CRM06_STAFF_READY_CRM_SOURCE='bb8966c59a6cfbdc1cc83472cb331e48b720a173';
export const CRM06_STAFF_SEPARATE_BATCH_CRM_SOURCE='957f98773695874ea3d101b7eb4816f9ea080880';
export const CRM06_STAFF_QUANTITY_CRM_SOURCE='89427492f27caf72c511a27262b55e73d782c407';
export const CRM06_STAFF_SEARCH_CRM_SOURCE='94f2a75322a3daa695d38010a6f2c8ef23f6c17b';
export const CRM06_STAFF_SEARCH_CRM_MANIFEST='16cb075a8734d56afd1f364999ab8f0707255be5c4a042a9c197ccf397eea556';
export const CRM06_STAFF_SEARCH_CRM_INDEX='19624f5d0189c5750089b4c50779809f3a381e323ae59541daa5ee4c3efdf3a5';
export const CRM06_STAFF_ERP_FEATURE_BASE='140fac3aa2a9293b63fdf7a6998acf4aaa814d77';
const root='C:\\Sirket\\ERP\\runtime\\terminal-completion-logon',actorRoot='C:\\Sirket\\CRM\\runtime\\CRM06-TEST-ACTORS-20261014';
export const CRM06_STAFF_SUCCESSOR_PATH=actorRoot+'\\staff-refresh-successor-b2985d2295c0.json';
export const CRM06_STAFF_JOURNAL_PATH=actorRoot+'\\assigned-staff-refresh.json';
export const CRM06_STAFF_PARENT_SETTINGS_PATH=root+'\\settings-crm06-7a081ab2b017.json';
export const CRM06_STAFF_PARENT_ACTIVATION_PATH=root+'\\crm-activation-crm06-7a081ab2b017.json';
export const CRM06_STAFF_JOURNAL_EVIDENCE_PATH=actorRoot+'\\journal-physical-preflight-b2985d2295c0.json';
const nextPaths=Object.freeze({activation:root+'\\crm-activation-crm06-staff-b2985d2295c0.json',settings:root+'\\settings-crm06-staff-b2985d2295c0.json',hubPin:root+'\\hub-pin-crm06-staff-b2985d2295c0.json',hubStartup:root+'\\hub-startup-crm06-staff-b2985d2295c0.json'});
// Eight reviewed CRM sources and ten literal supervisor generations only.
// Every generation retains the original actor setup as its immutable parent.
const frontendPaths=Object.freeze({activation:root+'\\crm-activation-crm06-staff-da82fc6644c1.json',settings:root+'\\settings-crm06-staff-da82fc6644c1.json',hubPin:root+'\\hub-pin-crm06-staff-da82fc6644c1.json',hubStartup:root+'\\hub-startup-crm06-staff-da82fc6644c1.json'});
const parentProbePaths=Object.freeze({activation:root+'\\crm-activation-crm06-staff-da82fc6644c1-parent-probe.json',settings:root+'\\settings-crm06-staff-da82fc6644c1-parent-probe.json',hubPin:root+'\\hub-pin-crm06-staff-da82fc6644c1-parent-probe.json',hubStartup:root+'\\hub-startup-crm06-staff-da82fc6644c1-parent-probe.json'});
const candidatePaths=Object.freeze({activation:root+'\\crm-activation-crm06-staff-5ce452b01ef2.json',settings:root+'\\settings-crm06-staff-5ce452b01ef2.json',hubPin:root+'\\hub-pin-crm06-staff-5ce452b01ef2.json',hubStartup:root+'\\hub-startup-crm06-staff-5ce452b01ef2.json'});
const finalBatchPaths=Object.freeze({activation:root+'\\crm-activation-crm06-staff-5bcd5ad136ff.json',settings:root+'\\settings-crm06-staff-5bcd5ad136ff.json',hubPin:root+'\\hub-pin-crm06-staff-5bcd5ad136ff.json',hubStartup:root+'\\hub-startup-crm06-staff-5bcd5ad136ff.json'});
const receiptWaitPaths=Object.freeze({activation:root+'\\crm-activation-crm06-staff-5bcd5ad136ff-receipt-wait.json',settings:root+'\\settings-crm06-staff-5bcd5ad136ff-receipt-wait.json',hubPin:root+'\\hub-pin-crm06-staff-5bcd5ad136ff-receipt-wait.json',hubStartup:root+'\\hub-startup-crm06-staff-5bcd5ad136ff-receipt-wait.json'});
const readyPaths=Object.freeze({activation:root+'\\crm-activation-crm06-staff-bb8966c59a6c.json',settings:root+'\\settings-crm06-staff-bb8966c59a6c.json',hubPin:root+'\\hub-pin-crm06-staff-bb8966c59a6c.json',hubStartup:root+'\\hub-startup-crm06-staff-bb8966c59a6c.json'});
const separateBatchPaths=Object.freeze({activation:root+'\\crm-activation-crm06-staff-957f98773695.json',settings:root+'\\settings-crm06-staff-957f98773695.json',hubPin:root+'\\hub-pin-crm06-staff-957f98773695.json',hubStartup:root+'\\hub-startup-crm06-staff-957f98773695.json'});
const quantityPaths=Object.freeze({activation:root+'\\crm-activation-crm06-staff-89427492f27c.json',settings:root+'\\settings-crm06-staff-89427492f27c.json',hubPin:root+'\\hub-pin-crm06-staff-89427492f27c.json',hubStartup:root+'\\hub-startup-crm06-staff-89427492f27c.json'});
const searchPaths=Object.freeze({activation:root+'\\crm-activation-crm06-staff-94f2a75322a3.json',settings:root+'\\settings-crm06-staff-94f2a75322a3.json',hubPin:root+'\\hub-pin-crm06-staff-94f2a75322a3.json',hubStartup:root+'\\hub-startup-crm06-staff-94f2a75322a3.json'});
const reject=()=>{throw Object.assign(Error('CRM06_STAFF_SUCCESSOR_REJECTED'),{code:'CRM06_STAFF_SUCCESSOR_REJECTED'});};
const check=value=>{if(!value)reject();};
export function crm06StaffSuccessorProfile(source=CRM06_STAFF_CRM_SOURCE,profileVariant){
 check(source===CRM06_STAFF_CRM_SOURCE||source===CRM06_STAFF_FRONTEND_CRM_SOURCE||source===CRM06_STAFF_CANDIDATE_CRM_SOURCE||source===CRM06_STAFF_FINAL_BATCH_CRM_SOURCE||source===CRM06_STAFF_READY_CRM_SOURCE||source===CRM06_STAFF_SEPARATE_BATCH_CRM_SOURCE||source===CRM06_STAFF_QUANTITY_CRM_SOURCE||source===CRM06_STAFF_SEARCH_CRM_SOURCE);
 check(profileVariant===undefined||source===CRM06_STAFF_FRONTEND_CRM_SOURCE&&profileVariant==='parent-probe'||source===CRM06_STAFF_FINAL_BATCH_CRM_SOURCE&&profileVariant==='receipt-wait');
 if(profileVariant==='receipt-wait')return Object.freeze({source,profileVariant,successorPath:actorRoot+'\\staff-refresh-successor-5bcd5ad136ff-receipt-wait.json',journalEvidencePath:actorRoot+'\\journal-physical-preflight-5bcd5ad136ff-receipt-wait.json',nextPaths:receiptWaitPaths,dependencyLockPath:root+'\\crm-5bcd5ad136ff-receipt-wait-dependency-lock.json'});
 if(profileVariant==='parent-probe')return Object.freeze({source,profileVariant,successorPath:actorRoot+'\\staff-refresh-successor-da82fc6644c1-parent-probe.json',journalEvidencePath:actorRoot+'\\journal-physical-preflight-da82fc6644c1-parent-probe.json',nextPaths:parentProbePaths,dependencyLockPath:root+'\\crm-da82fc6644c1-parent-probe-dependency-lock.json'});
 if(source===CRM06_STAFF_READY_CRM_SOURCE)return Object.freeze({source,successorPath:actorRoot+'\\staff-refresh-successor-bb8966c59a6c.json',journalEvidencePath:actorRoot+'\\journal-physical-preflight-bb8966c59a6c.json',nextPaths:readyPaths,dependencyLockPath:root+'\\crm-bb8966c59a6c-dependency-lock.json'});
 if(source===CRM06_STAFF_SEPARATE_BATCH_CRM_SOURCE)return Object.freeze({source,successorPath:actorRoot+'\\staff-refresh-successor-957f98773695.json',journalEvidencePath:actorRoot+'\\journal-physical-preflight-957f98773695.json',nextPaths:separateBatchPaths,dependencyLockPath:root+'\\crm-957f98773695-dependency-lock.json'});
 if(source===CRM06_STAFF_QUANTITY_CRM_SOURCE)return Object.freeze({source,successorPath:actorRoot+'\\staff-refresh-successor-89427492f27c.json',journalEvidencePath:actorRoot+'\\journal-physical-preflight-89427492f27c.json',nextPaths:quantityPaths,dependencyLockPath:root+'\\crm-89427492f27c-dependency-lock.json'});
 if(source===CRM06_STAFF_SEARCH_CRM_SOURCE)return Object.freeze({source,successorPath:actorRoot+'\\staff-refresh-successor-94f2a75322a3.json',journalEvidencePath:actorRoot+'\\journal-physical-preflight-94f2a75322a3.json',nextPaths:searchPaths,dependencyLockPath:root+'\\crm-94f2a75322a3-dependency-lock.json'});
 if(source===CRM06_STAFF_CANDIDATE_CRM_SOURCE)return Object.freeze({source,successorPath:actorRoot+'\\staff-refresh-successor-5ce452b01ef2.json',journalEvidencePath:actorRoot+'\\journal-physical-preflight-5ce452b01ef2.json',nextPaths:candidatePaths,dependencyLockPath:root+'\\crm-5ce452b01ef2-dependency-lock.json'});
 if(source===CRM06_STAFF_FINAL_BATCH_CRM_SOURCE)return Object.freeze({source,successorPath:actorRoot+'\\staff-refresh-successor-5bcd5ad136ff.json',journalEvidencePath:actorRoot+'\\journal-physical-preflight-5bcd5ad136ff.json',nextPaths:finalBatchPaths,dependencyLockPath:root+'\\crm-5bcd5ad136ff-dependency-lock.json'});
 const frontend=source===CRM06_STAFF_FRONTEND_CRM_SOURCE;
 return Object.freeze({source,successorPath:frontend?actorRoot+'\\staff-refresh-successor-da82fc6644c1.json':CRM06_STAFF_SUCCESSOR_PATH,journalEvidencePath:frontend?actorRoot+'\\journal-physical-preflight-da82fc6644c1.json':CRM06_STAFF_JOURNAL_EVIDENCE_PATH,nextPaths:frontend?frontendPaths:nextPaths,dependencyLockPath:root+'\\crm-'+source.slice(0,12)+'-dependency-lock.json'});
}
export function crm06StaffSuccessorProfileForPath(source,receiptPath){
 const profile=crm06StaffSuccessorProfile(source);
 if(receiptPath===profile.successorPath)return profile;
 const parentProbe=source===CRM06_STAFF_FRONTEND_CRM_SOURCE?crm06StaffSuccessorProfile(source,'parent-probe'):source===CRM06_STAFF_FINAL_BATCH_CRM_SOURCE?crm06StaffSuccessorProfile(source,'receipt-wait'):null;
 check(parentProbe&&receiptPath===parentProbe.successorPath);return parentProbe;
}
const exact=(value,keys)=>{check(value&&Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).length===keys.length);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);check(d?.enumerable&&Object.hasOwn(d,'value'));}};
const same=(a,b)=>digest(a)===digest(b);
const sha=value=>check(typeof value==='string'&&/^[a-f0-9]{64}$/.test(value));
const ref=(value,expectedPath)=>{exact(value,['path','sha256']);check(value.path===expectedPath);sha(value.sha256);};
const pin=(value,expectedRoot,expectedSource)=>{exact(value,['packageRoot','sourceCommit','manifestSha256']);check(typeof value.sourceCommit==='string'&&/^[a-f0-9]{40}$/.test(value.sourceCommit)&&(!expectedSource||value.sourceCommit===expectedSource));check(value.packageRoot===expectedRoot(value.sourceCommit));sha(value.manifestSha256);};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const crm06SuccessorFileBytes=value=>Buffer.from(JSON.stringify(value,null,2)+'\n','utf8');
export const crm06SuccessorFileHash=value=>crypto.createHash('sha256').update(crm06SuccessorFileBytes(value)).digest('hex');
export function crm06StaffSuccessorParentRefs(receipt){
 try{
  check(receipt?.schemaVersion==='melisa-crm06-staff-refresh-successor.v1');
  exact(receipt.parent,['settingsRef','settingsObjectHash','activationRef','activationObjectHash','baselineRef','actorAuditRef']);
  ref(receipt.parent.settingsRef,CRM06_STAFF_PARENT_SETTINGS_PATH);ref(receipt.parent.activationRef,CRM06_STAFF_PARENT_ACTIVATION_PATH);
  ref(receipt.parent.baselineRef,CRM06_BASELINE_PATH);ref(receipt.parent.actorAuditRef,CRM06_ACTOR_AUDIT_PATH);
  sha(receipt.parent.settingsObjectHash);sha(receipt.parent.activationObjectHash);
  return freeze({settingsRef:structuredClone(receipt.parent.settingsRef),activationRef:structuredClone(receipt.parent.activationRef)});
 }catch{reject();}
}
// Self-reference is excluded only from this projection digest. The actual
// receipt bytes are independently pinned by the launch settings and readPinned.
const settingsProjectionHash=(value,profile)=>{const copy=structuredClone(value);copy.crmPrivateFiles.crm06StaffSuccessor={path:profile.successorPath};return digest(copy);};

export function buildCrm06StaffRefreshSuccessor(input){
 try{
  exact(input,['baseline','parentActivation','parentAudit','parentSettings','parentSettingsRef','parentHubPin','parentHubStartup','crmPackagePin','crmIndexSha256','crmDependencyLockRef','supervisorPin','journalEvidenceSha256','ownerSid',...(Object.hasOwn(input,'profileVariant')?['profileVariant']:[])]);
  digest(input);const {baseline,parentActivation,parentAudit,parentSettings,parentSettingsRef,parentHubPin,parentHubStartup,crmPackagePin,crmIndexSha256,crmDependencyLockRef,supervisorPin,journalEvidenceSha256,ownerSid}=input;
  const profile=crm06StaffSuccessorProfile(crmPackagePin.sourceCommit,input.profileVariant),paths=profile.nextPaths;
  validateCompletionSettings(parentSettings,ownerSid);
  check(Object.hasOwn(parentSettings.crmPrivateFiles,'crm06Actors')&&!Object.hasOwn(parentSettings.crmPrivateFiles,'crm06StaffSuccessor'));
  check(parentSettings.components.crm.sourceCommit==='5b6dfe5acf1c0c1ea301f66aea39bf2abcec8f36');
  ref(parentSettingsRef,CRM06_STAFF_PARENT_SETTINGS_PATH);
  ref(parentSettings.privateSources.crmActivationConfig,CRM06_STAFF_PARENT_ACTIVATION_PATH);
  check(parentSettings.crmPrivateFiles.baseline.path===CRM06_BASELINE_PATH&&parentSettings.crmPrivateFiles.crm06Actors.path===CRM06_ACTOR_AUDIT_PATH);
  assertCrm06PreparedActorReceipt({baseline,activation:parentActivation,receipt:parentAudit});
  check(parentAudit.nextActivationHash===digest(parentActivation));
  completionCrmEnvironment(parentActivation,parentSettings);
  validateCurrentCrmHubPins(parentHubPin,parentSettings,parentActivation,parentHubPin.crmIndexSha256);
  check(parentHubStartup.HubConfigPath===parentSettings.privateSources.hubPinConfig.path);
  pin(crmPackagePin,source=>'C:\\Sirket\\CRM\\releases\\crm-shared-test-'+source,profile.source);
  if(profile.source===CRM06_STAFF_SEARCH_CRM_SOURCE)check(crmPackagePin.manifestSha256===CRM06_STAFF_SEARCH_CRM_MANIFEST&&crmIndexSha256===CRM06_STAFF_SEARCH_CRM_INDEX);
  pin(supervisorPin,source=>'C:\\Sirket\\ERP\\releases\\CANONICAL-CRM06-SUPERVISOR-TEST-'+(profile.source===CRM06_STAFF_CRM_SOURCE?'20261014':'20261015')+'-'+source.slice(0,12));
  check(!same(supervisorPin,parentSettings.supervisor));sha(crmIndexSha256);sha(journalEvidenceSha256);
  ref(crmDependencyLockRef,profile.dependencyLockPath);

  const activation=structuredClone(parentActivation);
  Object.assign(activation,{sourceCommit:crmPackagePin.sourceCommit,packageRoot:crmPackagePin.packageRoot,packageManifestSha256:crmPackagePin.manifestSha256});
  Object.assign(activation.environmentVariables,{CRM_TEST_SOURCE_COMMIT:crmPackagePin.sourceCommit,CRM_TEST_PACKAGE_ROOT:crmPackagePin.packageRoot,CRM_TEST_PACKAGE_MANIFEST_SHA256:crmPackagePin.manifestSha256,CRM_ASSIGNED_STAFF_REFRESH_ENABLED:'true',CRM_ASSIGNED_STAFF_REFRESH_USER_ID:'crm-crm06-staff-test-20261014',CRM_ASSIGNED_STAFF_REFRESH_JOURNAL_PATH:CRM06_STAFF_JOURNAL_PATH});
  const activationRef={path:paths.activation,sha256:crm06SuccessorFileHash(activation)};
  const hubPin={...structuredClone(parentHubPin),crmSourceCommit:profile.source,crmIndexSha256};
  const hubPinRef={path:paths.hubPin,sha256:crm06SuccessorFileHash(hubPin)};
  const hubStartup={...structuredClone(parentHubStartup),HubConfigPath:hubPinRef.path};
  const hubStartupRef={path:paths.hubStartup,sha256:crm06SuccessorFileHash(hubStartup)};
  const settings=structuredClone(parentSettings);
  settings.supervisor=structuredClone(supervisorPin);
  settings.components.crm={...structuredClone(crmPackagePin),config:activationRef};
  settings.privateSources.crmActivationConfig=activationRef;
  settings.dependencyLocks.crm=structuredClone(crmDependencyLockRef);
  settings.privateSources.hubPinConfig=hubPinRef;
  settings.privateSources.hubStartupConfig=hubStartupRef;settings.components.hub.config=hubStartupRef;
  settings.crmPrivateFiles.crm06StaffSuccessor={path:profile.successorPath,sha256:'0'.repeat(64)};
  validateCompletionSettings(settings,ownerSid);completionCrmEnvironment(activation,settings);validateCurrentCrmHubPins(hubPin,settings,activation,crmIndexSha256);
  const receipt={schemaVersion:'melisa-crm06-staff-refresh-successor.v1',featureBase:{erp:CRM06_STAFF_ERP_FEATURE_BASE,crm:profile.source},parent:{settingsRef:structuredClone(parentSettingsRef),settingsObjectHash:digest(parentSettings),activationRef:structuredClone(parentSettings.privateSources.crmActivationConfig),activationObjectHash:digest(parentActivation),baselineRef:structuredClone(parentSettings.crmPrivateFiles.baseline),actorAuditRef:structuredClone(parentSettings.crmPrivateFiles.crm06Actors)},prepared:{crmPackagePin:structuredClone(crmPackagePin),crmIndexSha256,crmDependencyLockRef:structuredClone(crmDependencyLockRef),supervisorPin:structuredClone(supervisorPin),journalEvidenceSha256,...(profile.profileVariant?{profileVariant:profile.profileVariant}:{})},child:{activationRef,activationObjectHash:digest(activation),hubPinRef,hubPinObjectHash:digest(hubPin),hubStartupRef,hubStartupObjectHash:digest(hubStartup),settingsPath:paths.settings,settingsProjectionHash:settingsProjectionHash(settings,profile)},rollback:{settingsRef:structuredClone(parentSettingsRef),crmActivationRef:structuredClone(parentSettings.privateSources.crmActivationConfig),hubStartupRef:structuredClone(parentSettings.privateSources.hubStartupConfig),hubPinRef:structuredClone(parentSettings.privateSources.hubPinConfig),crmPackagePin:{packageRoot:parentSettings.components.crm.packageRoot,sourceCommit:parentSettings.components.crm.sourceCommit,manifestSha256:parentSettings.components.crm.manifestSha256},supervisorPin:structuredClone(parentSettings.supervisor)},installed:false,authenticatedOperationsVerified:false,humanAccepted:false};
  const receiptRef={path:profile.successorPath,sha256:crm06SuccessorFileHash(receipt)};
  settings.crmPrivateFiles.crm06StaffSuccessor=receiptRef;
  const settingsRef={path:paths.settings,sha256:crm06SuccessorFileHash(settings)};
  return freeze({activation,activationRef,hubPin,hubPinRef,hubStartup,hubStartupRef,settings,settingsRef,receipt,receiptRef});
 }catch{reject();}
}

export function assertCrm06StaffRefreshSuccessor(input){
 try{
  exact(input,['baseline','parentActivation','parentAudit','parentSettings','parentHubPin','parentHubStartup','currentActivation','currentSettings','currentHubPin','currentHubStartup','receipt','ownerSid']);digest(input);
  const {receipt}=input;check(receipt?.schemaVersion==='melisa-crm06-staff-refresh-successor.v1');
  const expected=buildCrm06StaffRefreshSuccessor({baseline:input.baseline,parentActivation:input.parentActivation,parentAudit:input.parentAudit,parentSettings:input.parentSettings,parentSettingsRef:receipt.parent.settingsRef,parentHubPin:input.parentHubPin,parentHubStartup:input.parentHubStartup,crmPackagePin:receipt.prepared.crmPackagePin,crmIndexSha256:receipt.prepared.crmIndexSha256,crmDependencyLockRef:receipt.prepared.crmDependencyLockRef,supervisorPin:receipt.prepared.supervisorPin,journalEvidenceSha256:receipt.prepared.journalEvidenceSha256,ownerSid:input.ownerSid,...(Object.hasOwn(receipt.prepared,'profileVariant')?{profileVariant:receipt.prepared.profileVariant}:{})});
  check(same(expected.receipt,receipt)&&same(expected.activation,input.currentActivation)&&same(expected.settings,input.currentSettings)&&same(expected.hubPin,input.currentHubPin)&&same(expected.hubStartup,input.currentHubStartup));
  return true;
 }catch{reject();}
}
