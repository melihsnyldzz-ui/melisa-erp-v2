// Pure owner preparation. Pins describe setup; ordinary CRM authentication still
// establishes identities. No filesystem, tasks, process, SQL or network access.
import {buildCrm06TestActorProvisioning,crm06ProvisioningInputHash} from './crm06-test-actor-provisioning.mjs';
import {validateCompletionSettings,completionTaskPlan} from './terminal-completion-logon.mjs';

export const CRM06_ACTOR_ROOT='C:\\Sirket\\CRM\\runtime\\CRM06-TEST-ACTORS-20261014';
export const CRM06_BASELINE_PATH=CRM06_ACTOR_ROOT+'\\agent-test-baseline.env';
export const CRM06_ACTOR_AUDIT_PATH=CRM06_ACTOR_ROOT+'\\provisioning-audit.json';
const OLD_BASELINE='C:\\Sirket\\CRM\\runtime\\ERP-COMPLETION01-20261011\\normal-agent-test-baseline.env';
const fail=()=>{throw Object.assign(Error('CRM06_OWNER_PROJECTION_REJECTED'),{code:'CRM06_OWNER_PROJECTION_REJECTED'});};
const check=value=>{if(!value)fail();};
const exact=(value,keys)=>check(value&&Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>{const d=Object.getOwnPropertyDescriptor(value,key);return d?.enumerable&&Object.hasOwn(d,'value');}));
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const equal=(a,b)=>crm06ProvisioningInputHash(a)===crm06ProvisioningInputHash(b);
const pin=value=>{exact(value,['path','sha256']);check(typeof value.path==='string'&&typeof value.sha256==='string'&&/^[a-f0-9]{64}$/i.test(value.sha256));};

export function assertCrm06PreparedActorReceipt(input){
 try{
  exact(input,['baseline','activation','receipt']);const {baseline,activation,receipt}=input;
  crm06ProvisioningInputHash(baseline);crm06ProvisioningInputHash(activation);crm06ProvisioningInputHash(receipt);
  // Rebuilding the exact normal-role additions also rejects accessor/hidden
  // properties, overrides, send policy changes and unsupported refresh claims.
  check(baseline&&typeof baseline.WHATSAPP_CRM_AUTH_USERS_JSON==='string');
  const users=JSON.parse(baseline.WHATSAPP_CRM_AUTH_USERS_JSON);check(Array.isArray(users)&&users.length===9);
  const oldBaseline={...baseline,WHATSAPP_CRM_AUTH_USERS_JSON:JSON.stringify(users.slice(0,7))};
  const oldActivation={...activation,environmentVariables:{...activation.environmentVariables,CRM_BASELINE_ENV:OLD_BASELINE,CRM_CUSTOMER_PRODUCT_REQUEST_ISSUER_IDS:'["crm-patron"]'}};
  check(activation.environmentVariables.CRM_BASELINE_ENV===CRM06_BASELINE_PATH&&activation.environmentVariables.CRM_CUSTOMER_PRODUCT_REQUEST_ISSUER_IDS==='["crm-patron","crm-crm06-manager-test-20261014"]');
  const expected=buildCrm06TestActorProvisioning({baseline:oldBaseline,activation:oldActivation,managerPasswordHash:users[7].passwordHash,staffPasswordHash:users[8].passwordHash,expectedBaselineHash:crm06ProvisioningInputHash(oldBaseline),expectedActivationHash:crm06ProvisioningInputHash(oldActivation)});
  check(equal(expected.nextBaseline,baseline)&&equal(expected.nextActivation,activation));
  exact(receipt,Object.keys(expected.audit));
  check(typeof receipt.previousBaselineHash==='string'&&/^[a-f0-9]{64}$/.test(receipt.previousBaselineHash)&&typeof receipt.previousActivationHash==='string'&&/^[a-f0-9]{64}$/.test(receipt.previousActivationHash));
  check(equal({...expected.audit,previousBaselineHash:receipt.previousBaselineHash,previousActivationHash:receipt.previousActivationHash},receipt));
  // Activation is cloned field-for-field; unlike baseline's embedded JSON its
  // predecessor representation is reconstructible without normalization.
  check(receipt.previousActivationHash===crm06ProvisioningInputHash(oldActivation));
  return true;
 }catch{fail();}
}

export function buildCrm06OwnerProjection(input){
 exact(input,['priorSettings','supervisorPin','activationRef','baselineRef','auditRef','ownerSid','settingsRef']);
 const {priorSettings,supervisorPin,activationRef,baselineRef,auditRef,ownerSid,settingsRef}=input;
 crm06ProvisioningInputHash(input);
 validateCompletionSettings(priorSettings,ownerSid);
 check(!Object.hasOwn(priorSettings.crmPrivateFiles,'crm06Actors')&&priorSettings.crmPrivateFiles.baseline.path===OLD_BASELINE);
 for(const ref of [activationRef,baselineRef,auditRef,settingsRef])pin(ref);
 check(baselineRef.path===CRM06_BASELINE_PATH&&auditRef.path===CRM06_ACTOR_AUDIT_PATH);
 check(activationRef.path!==priorSettings.privateSources.crmActivationConfig.path&&settingsRef.path!==priorSettings.privateSources.crmActivationConfig.path);
 check(supervisorPin.packageRoot!==priorSettings.supervisor.packageRoot&&supervisorPin.manifestSha256!==priorSettings.supervisor.manifestSha256);
 const settings=structuredClone(priorSettings);
 settings.supervisor=structuredClone(supervisorPin);
 settings.components.crm.config=structuredClone(activationRef);
 settings.privateSources.crmActivationConfig=structuredClone(activationRef);
 settings.crmPrivateFiles.baseline=structuredClone(baselineRef);
 settings.crmPrivateFiles.crm06Actors=structuredClone(auditRef);
 validateCompletionSettings(settings,ownerSid);
 const taskPlan=completionTaskPlan(settings,settingsRef,ownerSid);
 return freeze({settings,settingsHash:crm06ProvisioningInputHash(settings),taskPlan});
}
