// Pure operator preparation for existing startup JSON+scrypt authentication.
// No account is installed, no session issued, and no durable staff refresh is
// enabled here. The runtime owner separately pins bytes, ACLs and deployment.
import {createHash} from 'node:crypto';

const SOURCE='5b6dfe5acf1c0c1ea301f66aea39bf2abcec8f36';
const PACKAGE='C:\\Sirket\\CRM\\releases\\crm-shared-test-'+SOURCE;
const DATABASE='MELISA_ERP_CRM_SHARED_TEST_20261009_02';
const BASELINE='C:\\Sirket\\CRM\\runtime\\CRM06-TEST-ACTORS-20261014\\agent-test-baseline.env';
const MANAGER=Object.freeze({id:'crm-crm06-manager-test-20261014',username:'crm-crm06-manager',displayName:'CRM06 Yönetici TEST',role:'mudur',active:true,chatwootAgentId:2});
const STAFF=Object.freeze({id:'crm-crm06-staff-test-20261014',username:'crm-crm06-staff',displayName:'CRM06 Personel TEST',role:'personel',active:true,chatwootAgentId:2});
const activationKeys=['sourceCommit','packageRoot','packageManifestSha256','database','actualT1','externalOperations','paidAi','whatsappSend','environmentVariables'];
const inputKeys=['baseline','activation','managerPasswordHash','staffPasswordHash','expectedBaselineHash','expectedActivationHash'];
const fail=()=>{throw Object.assign(Error('CRM06_PROVISIONING_REJECTED'),{code:'CRM06_PROVISIONING_REJECTED'});};
const check=value=>{if(!value)fail();};

function record(value){
 check(value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype);
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(value);
 check(keys.every(key=>typeof key==='string'&&descriptors[key].enumerable&&Object.hasOwn(descriptors[key],'value')));
 return keys;
}
const exact=(value,keys)=>{const actual=record(value);check(actual.length===keys.length&&keys.every(key=>actual.includes(key)));};
function snapshot(value){
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;
 if(Array.isArray(value)){const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(value);check(keys.length===value.length+1&&keys.every(key=>key==='length'||typeof key==='string'&&/^(0|[1-9]\d*)$/.test(key)&&Number(key)<value.length&&descriptors[key].enumerable&&Object.hasOwn(descriptors[key],'value')));return value.map(snapshot);}
 const keys=record(value);return Object.fromEntries(keys.map(key=>[key,snapshot(value[key])]));
}
function canonical(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
}
// This content pin is preparation metadata, never authenticated authority.
export function crm06ProvisioningInputHash(value){return createHash('sha256').update(canonical(snapshot(value)),'utf8').digest('hex');}
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
const passwordHash=value=>typeof value==='string'&&/^scrypt\$[a-f0-9]{48}\$[a-f0-9]{128}$/i.test(value);
const freeze=value=>{if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;};
const username=value=>typeof value==='string'?value.trim().toLocaleLowerCase('tr-TR'):'';

export function buildCrm06TestActorProvisioning(input){
 exact(input,inputKeys);
 const {baseline,activation,managerPasswordHash,staffPasswordHash,expectedBaselineHash,expectedActivationHash}=snapshot(input);
 check(hash(expectedBaselineHash)&&hash(expectedActivationHash)&&crm06ProvisioningInputHash(baseline)===expectedBaselineHash.toLowerCase()&&crm06ProvisioningInputHash(activation)===expectedActivationHash.toLowerCase());
 const baselineKeys=record(baseline);check(baselineKeys.length>0&&baselineKeys.every(key=>/^[A-Z][A-Z0-9_]*$/.test(key)&&typeof baseline[key]==='string'));
 // The existing CRM role mapper can otherwise add crm.send to personel.
 // Never silently change that shared policy to make this new actor eligible.
 check(!Object.hasOwn(baseline,'WHATSAPP_CRM_PERSONNEL_CAN_SEND')||['','false'].includes(baseline.WHATSAPP_CRM_PERSONNEL_CAN_SEND));
 exact(activation,activationKeys);
 check(activation.sourceCommit===SOURCE&&activation.packageRoot===PACKAGE&&hash(activation.packageManifestSha256)&&activation.database===DATABASE&&activation.actualT1===false&&activation.externalOperations===false&&activation.paidAi===false&&activation.whatsappSend===false);
 const vars=activation.environmentVariables;record(vars);check(Object.values(vars).every(value=>typeof value==='string'));
 const required={CRM_TEST_PORT_BASE:'62700',CRM_ISOLATED_PREPARATION:'true',CRM_TEST_ERP_ORIGIN:'http://127.0.0.1:4184',CRM_TEST_EXPECTED_DATABASE:DATABASE,CRM_CUSTOMER_PRODUCT_REQUEST_ENABLED:'true',CRM_CUSTOMER_PRODUCT_REQUEST_ISSUER_IDS:'["crm-patron"]'};
 check(Object.entries(required).every(([key,value])=>vars[key]===value));
 check(typeof vars.CRM_BASELINE_ENV==='string'&&/^C:\\Sirket\\CRM\\runtime\\[^\r\n]+\.env$/.test(vars.CRM_BASELINE_ENV)&&!vars.CRM_BASELINE_ENV.split(/[\\/]/).some(part=>part==='.'||part==='..'));
 for(const key of ['WHATSAPP_SEND_ENABLED','WHATSAPP_LIVE_SEND_APPROVED','CRM_PAID_AI_ENABLED','WAAPI_CHATWOOT_BRIDGE_ENABLED','WAAPI_INCOMING_READER_ENABLED'])if(Object.hasOwn(vars,key))check(vars[key]==='false');
 if(Object.hasOwn(vars,'CRM_AI_SALES_MODE'))check(vars.CRM_AI_SALES_MODE==='off');
 check(!Object.hasOwn(vars,'CRM_CUSTOMER_PRODUCT_REQUEST_PROOF')&&!Object.hasOwn(vars,'CRM_SEMIH_TEST_CONTINUE_ENABLED'));
 check(vars.CRM_NORMAL_REFRESH_ENABLED==='true'&&vars.CRM_NORMAL_REFRESH_USER_ID==='crm-agent-test-20261011'&&typeof vars.CRM_NORMAL_REFRESH_JOURNAL_PATH==='string'&&typeof vars.CRM_CUSTOMER_PRODUCT_REQUEST_STORE_FILE==='string'&&typeof vars.CRM_CUSTOMER_PRODUCT_REQUEST_REFRESH_JOURNAL_PATH==='string');
 check(passwordHash(managerPasswordHash)&&passwordHash(staffPasswordHash)&&managerPasswordHash!==staffPasswordHash);
 let users;try{users=JSON.parse(baseline.WHATSAPP_CRM_AUTH_USERS_JSON);}catch{fail();}
 check(Array.isArray(users)&&users.length===7);
 const ids=new Set(),names=new Set();
 for(const user of users){
  record(user);check(typeof user.id==='string'&&user.id&&username(user.username)&&!ids.has(user.id)&&!names.has(username(user.username)));
  ids.add(user.id);names.add(username(user.username));
 }
 check(users.some(user=>user.id==='crm-patron'&&user.role==='patron'&&user.active!==false));
 for(const actor of [MANAGER,STAFF])check(!ids.has(actor.id)&&!names.has(username(actor.username)));
 const oldHashes=users.map(crm06ProvisioningInputHash);
 const nextUsers=[...users,{...MANAGER,passwordHash:managerPasswordHash},{...STAFF,passwordHash:staffPasswordHash}];
 check(nextUsers.slice(0,7).every((entry,index)=>crm06ProvisioningInputHash(entry)===oldHashes[index]));
 const nextBaseline={...baseline,WHATSAPP_CRM_AUTH_USERS_JSON:JSON.stringify(nextUsers)};
 const nextActivation={...activation,environmentVariables:{...vars,CRM_BASELINE_ENV:BASELINE,CRM_CUSTOMER_PRODUCT_REQUEST_ISSUER_IDS:JSON.stringify(['crm-patron',MANAGER.id])}};
 const candidate={schemaVersion:'crm06-test-actor-provisioning.v1',baseline:nextBaseline,activation:nextActivation};
 const audit=freeze({schemaVersion:'crm06-test-actor-provisioning-audit.v1',installed:false,nativeExecution:false,existingUsers:7,addedUsers:2,existingUserEntryHashes:oldHashes,
  actors:[{...MANAGER,derivedPermissions:['crm.view','crm.send','crm.assign','crm.agents','crm.manage']},{...STAFF,derivedPermissions:['crm.view']}],
  existingIssuerPreserved:true,newIssuerId:MANAGER.id,existingIdentityChanges:0,existingPasswordChanges:0,permissionOverrides:0,
  staffDurableRefreshSupported:false,staffSessionPreparationRequired:true,
  previousBaselineHash:expectedBaselineHash.toLowerCase(),previousActivationHash:expectedActivationHash.toLowerCase(),nextBaselineHash:crm06ProvisioningInputHash(nextBaseline),nextActivationHash:crm06ProvisioningInputHash(nextActivation),candidateHash:crm06ProvisioningInputHash(candidate)});
 // Private values are explicitly accessible to the sole runtime owner, but
 // absent from JSON.stringify(result), log spreads and enumerable safe audit.
 const result={audit};
 Object.defineProperties(result,{nextBaseline:{value:freeze(nextBaseline)},nextActivation:{value:freeze(nextActivation)},candidate:{value:freeze(candidate)}});
 return Object.freeze(result);
}
