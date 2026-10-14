import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,scryptSync} from 'node:crypto';
import {buildCrm06TestActorProvisioning,crm06ProvisioningInputHash} from './crm06-test-actor-provisioning.mjs';

// Synthetic strings only. No real account, credential, config or session read.
const source='5b6dfe5acf1c0c1ea301f66aea39bf2abcec8f36',db='MELISA_ERP_CRM_SHARED_TEST_20261009_02';
const encoded=seed=>{const salt=createHash('sha256').update(seed).digest('hex').slice(0,48);return `scrypt$${salt}$${scryptSync('Only-Synthetic-Test-Password-'+seed,salt,64).toString('hex')}`;};
const managerHash=encoded('manager'),staffHash=encoded('staff'),oldHash=encoded('old');
function fixture(){
 const users=Array.from({length:7},(_,index)=>({id:index?'old-'+index:'crm-patron',username:index?'old-user-'+index:'crm-patron',displayName:'Synthetic '+index,role:index?'personel':'patron',active:true,chatwootAgentId:2,passwordHash:oldHash}));
 const baseline={WHATSAPP_CRM_AUTH_USERS_JSON:JSON.stringify(users),SYNTHETIC_PRIVATE_SETTING:'untouched-private-canary'};
 const activation={sourceCommit:source,packageRoot:'C:\\Sirket\\CRM\\releases\\crm-shared-test-'+source,packageManifestSha256:'a'.repeat(64),database:db,actualT1:false,externalOperations:false,paidAi:false,whatsappSend:false,environmentVariables:{
  CRM_TEST_PORT_BASE:'62700',CRM_ISOLATED_PREPARATION:'true',CRM_TEST_ERP_ORIGIN:'http://127.0.0.1:4184',CRM_TEST_EXPECTED_DATABASE:db,
  CRM_BASELINE_ENV:'C:\\Sirket\\CRM\\runtime\\old\\normal-agent-test-baseline.env',CRM_CUSTOMER_PRODUCT_REQUEST_ENABLED:'true',CRM_CUSTOMER_PRODUCT_REQUEST_ISSUER_IDS:'["crm-patron"]',
  CRM_CUSTOMER_PRODUCT_REQUEST_STORE_FILE:'C:\\Sirket\\CRM\\runtime\\requests.json',CRM_CUSTOMER_PRODUCT_REQUEST_REFRESH_JOURNAL_PATH:'C:\\Sirket\\CRM\\runtime\\issuer-refresh.json',
  CRM_NORMAL_REFRESH_ENABLED:'true',CRM_NORMAL_REFRESH_USER_ID:'crm-agent-test-20261011',CRM_NORMAL_REFRESH_JOURNAL_PATH:'C:\\Sirket\\CRM\\runtime\\staff-refresh.json',
  WHATSAPP_SEND_ENABLED:'false',WHATSAPP_LIVE_SEND_APPROVED:'false',CRM_PAID_AI_ENABLED:'false',CRM_AI_SALES_MODE:'off',WAAPI_CHATWOOT_BRIDGE_ENABLED:'false',WAAPI_INCOMING_READER_ENABLED:'false',
 }};
 return {baseline,activation,managerPasswordHash:managerHash,staffPasswordHash:staffHash,expectedBaselineHash:crm06ProvisioningInputHash(baseline),expectedActivationHash:crm06ProvisioningInputHash(activation)};
}
const repin=f=>{f.expectedBaselineHash=crm06ProvisioningInputHash(f.baseline);f.expectedActivationHash=crm06ProvisioningInputHash(f.activation);return f;};
const reject=f=>assert.throws(()=>buildCrm06TestActorProvisioning(f),{code:'CRM06_PROVISIONING_REJECTED'});

test('preparation appends exactly two normal identities and preserves every old entry and non-auth baseline value',()=>{
 const f=fixture(),before=structuredClone(f),result=buildCrm06TestActorProvisioning(f),old=JSON.parse(f.baseline.WHATSAPP_CRM_AUTH_USERS_JSON),next=JSON.parse(result.nextBaseline.WHATSAPP_CRM_AUTH_USERS_JSON);
 assert.deepEqual(f,before);assert.equal(next.length,9);assert.deepEqual(next.slice(0,7),old);assert.deepEqual(result.audit.existingUserEntryHashes,old.map(crm06ProvisioningInputHash));
 assert.deepEqual(next.slice(7).map(({passwordHash,...user})=>user),[{id:'crm-crm06-manager-test-20261014',username:'crm-crm06-manager',displayName:'CRM06 Yönetici TEST',role:'mudur',active:true,chatwootAgentId:2},{id:'crm-crm06-staff-test-20261014',username:'crm-crm06-staff',displayName:'CRM06 Personel TEST',role:'personel',active:true,chatwootAgentId:2}]);
 assert.equal(next[7].passwordHash,managerHash);assert.equal(next[8].passwordHash,staffHash);
 assert.equal(result.nextBaseline.SYNTHETIC_PRIVATE_SETTING,f.baseline.SYNTHETIC_PRIVATE_SETTING);
 assert(next.slice(7).every(user=>!['permissions','testAdmin','testPersonnel','normalTestScope'].some(key=>Object.hasOwn(user,key))));
});
test('activation changes only exact private baseline path and the appended selected issuer; every journal/provider/target pin is preserved',()=>{
 const f=fixture(),next=buildCrm06TestActorProvisioning(f).nextActivation;
 assert.deepEqual(Object.keys(next),Object.keys(f.activation));assert.deepEqual(Object.keys(next.environmentVariables),Object.keys(f.activation.environmentVariables));
 for(const key of Object.keys(f.activation))if(key!=='environmentVariables')assert.equal(next[key],f.activation[key]);
 for(const [key,value]of Object.entries(f.activation.environmentVariables))if(!['CRM_BASELINE_ENV','CRM_CUSTOMER_PRODUCT_REQUEST_ISSUER_IDS'].includes(key))assert.equal(next.environmentVariables[key],value);
 assert.equal(next.environmentVariables.CRM_BASELINE_ENV,'C:\\Sirket\\CRM\\runtime\\CRM06-TEST-ACTORS-20261014\\agent-test-baseline.env');
 assert.equal(next.environmentVariables.CRM_CUSTOMER_PRODUCT_REQUEST_ISSUER_IDS,'["crm-patron","crm-crm06-manager-test-20261014"]');
});
test('identical reviewed inputs replay deterministically without generating salts, IDs or session authority',()=>{
 const f=fixture(),one=buildCrm06TestActorProvisioning(f),two=buildCrm06TestActorProvisioning(f);
 assert.deepEqual(one.audit,two.audit);assert.deepEqual(one.candidate,two.candidate);assert.equal(one.audit.installed,false);assert.equal(one.audit.nativeExecution,false);assert.equal(one.audit.staffDurableRefreshSupported,false);assert.equal(one.audit.staffSessionPreparationRequired,true);
});
test('safe enumerable audit excludes password hashes and all private baseline values; returned private snapshots are deeply frozen',()=>{
 const result=buildCrm06TestActorProvisioning(fixture()),text=JSON.stringify(result);
 assert.deepEqual(Object.keys(result),['audit']);for(const value of [managerHash,staffHash,oldHash,'untouched-private-canary','passwordHash','scrypt$'])assert(!text.includes(value));
 assert(Object.isFrozen(result)&&Object.isFrozen(result.audit)&&Object.isFrozen(result.audit.actors[0])&&Object.isFrozen(result.nextBaseline)&&Object.isFrozen(result.nextActivation.environmentVariables)&&Object.isFrozen(result.candidate));
 assert.throws(()=>{result.nextActivation.environmentVariables.CRM_TEST_PORT_BASE='1';},TypeError);
 assert.deepEqual(result.audit.actors.map(actor=>actor.derivedPermissions),[['crm.view','crm.send','crm.assign','crm.agents','crm.manage'],['crm.view']]);
});
test('any existing user/password/role or unrelated input mutation fails the externally reviewed content pins',()=>{
 for(const field of ['id','username','passwordHash','role','chatwootAgentId']){const f=fixture(),users=JSON.parse(f.baseline.WHATSAPP_CRM_AUTH_USERS_JSON);users[1][field]=field==='chatwootAgentId'?3:'mutated';f.baseline.WHATSAPP_CRM_AUTH_USERS_JSON=JSON.stringify(users);reject(f);}
 const other=fixture();other.baseline.SYNTHETIC_PRIVATE_SETTING='changed';reject(other);const env=fixture();env.activation.environmentVariables.CRM_NORMAL_REFRESH_JOURNAL_PATH+='-changed';reject(env);
});
test('preexisting new ID or normalized username is never adopted, reset or role-upgraded even under freshly reviewed pins',()=>{
 for(const [key,value]of [['id','crm-crm06-manager-test-20261014'],['id','crm-crm06-staff-test-20261014'],['username',' CRM-CRM06-MANAGER '],['username','CRM-CRM06-STAFF']]){const f=fixture(),users=JSON.parse(f.baseline.WHATSAPP_CRM_AUTH_USERS_JSON);users[1][key]=value;f.baseline.WHATSAPP_CRM_AUTH_USERS_JSON=JSON.stringify(users);reject(repin(f));}
 const f=fixture(),result=buildCrm06TestActorProvisioning(f);f.baseline=structuredClone(result.nextBaseline);f.activation=structuredClone(result.nextActivation);reject(repin(f));
});
test('unknown input/activation keys, accessors and permissions/role overrides fail closed',()=>{
 for(const key of ['managerRole','permissions','testAdmin','testPersonnel','semih','nextIssuer'])reject({...fixture(),[key]:true});
 for(const key of ['canManage','role','permissions','normalTestScope']){const f=fixture();f.activation[key]='invented';reject(repin(f));}
 const f=fixture();Object.defineProperty(f,'managerPasswordHash',{get(){throw Error('must-not-read');},enumerable:true});reject(f);
 const g=fixture();Object.defineProperty(g.baseline,'HIDDEN',{value:'must-not-read'});reject(g);
});
test('foreign source/package/DB/ports, provider modes and another selected issuer are rejected even if their object pins match',()=>{
 for(const [key,value]of [['sourceCommit','f'.repeat(40)],['packageRoot','C:\\foreign'],['database','LIVE'],['actualT1',true],['externalOperations',true],['paidAi',true],['whatsappSend',true]]){const f=fixture();f.activation[key]=value;reject(repin(f));}
 for(const [key,value]of [['CRM_TEST_PORT_BASE','62400'],['CRM_ISOLATED_PREPARATION','false'],['CRM_TEST_ERP_ORIGIN','http://127.0.0.1:4144'],['CRM_TEST_EXPECTED_DATABASE','LIVE'],['CRM_CUSTOMER_PRODUCT_REQUEST_ISSUER_IDS','["crm-ahmet"]'],['CRM_NORMAL_REFRESH_USER_ID','crm-crm06-staff-test-20261014'],['WHATSAPP_SEND_ENABLED','true'],['CRM_PAID_AI_ENABLED','true'],['CRM_CUSTOMER_PRODUCT_REQUEST_PROOF','false'],['CRM_SEMIH_TEST_CONTINUE_ENABLED','true'],['CRM_BASELINE_ENV','C:\\outside.env']]){const f=fixture();f.activation.environmentVariables[key]=value;reject(repin(f));}
});
test('malformed/same scrypt inputs and invalid seven-user snapshots cannot produce a candidate',()=>{
 for(const value of ['plain-password','bcrypt$abc',`scrypt$abc$${'a'.repeat(128)}`,`scrypt$${'a'.repeat(48)}$bad`,managerHash+'$extra',staffHash])reject({...fixture(),managerPasswordHash:value});
 for(const mutate of [users=>users.pop(),users=>users.push(users[0]),users=>{users[1].id=users[0].id;},users=>{users[1].username=users[0].username;},users=>{users[0].role='personel';},users=>{users[0].active=false;}]){const f=fixture(),users=JSON.parse(f.baseline.WHATSAPP_CRM_AUTH_USERS_JSON);mutate(users);f.baseline.WHATSAPP_CRM_AUTH_USERS_JSON=JSON.stringify(users);reject(repin(f));}
});
test('existing personnel-send policy is never changed or falsely reported as view-only',()=>{
 for(const value of ['true','TRUE','unknown']){const f=fixture();f.baseline.WHATSAPP_CRM_PERSONNEL_CAN_SEND=value;reject(repin(f));}
 for(const value of ['','false']){const f=fixture();f.baseline.WHATSAPP_CRM_PERSONNEL_CAN_SEND=value;const next=buildCrm06TestActorProvisioning(repin(f));assert.equal(next.nextBaseline.WHATSAPP_CRM_PERSONNEL_CAN_SEND,value);assert.deepEqual(next.audit.actors[1].derivedPermissions,['crm.view']);}
});
