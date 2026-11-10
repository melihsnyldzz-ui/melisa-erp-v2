// Pure admission and injected normal reset operation only. The caller proves the
// fresh local TEST identity, owns the transaction and commits or rolls it back.
// confirmation=true must originate from the human-owned masked WinForms Save;
// a boolean checked here is not independent evidence of that UI event.
import {createResetManagedAuthPasswordCore} from '../../apps/api/src/services/resetManagedAuthPasswordCore.mjs';

export const TARGET=Object.freeze({
 server:'Semih\\MELISAERP',database:'MELISA_ERP_DESKTOP_TEST_20261105',databaseId:5,
 databaseGuid:'c67f5317-9c0d-4831-aadd-fadc379a95d1',environmentId:'eb2888c2-51cb-4570-a933-397cf7e62806',
 schemaVersion:7,actualT1:false,externalOperations:false,readOnly:false,windowsOwner:'SEMIH\\Xaser',
 userId:30018,username:'erp_muhasebe_deneme',roleId:19,roleCode:'desktop_accounting_test'
});
const reject=code=>{throw Error(code);};
function data(value,keys,code){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).length!==keys.length)reject(code);
 for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))reject(code);}
}
const identityKeys=['server','database','databaseId','databaseGuid','environmentId','schemaVersion','actualT1','externalOperations','readOnly','windowsOwner','expectedUserVersion'];
const guid=value=>typeof value==='string'&&/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/.test(value)?value.toLowerCase():null;
const fixedId=(value,expected)=>value===expected||value===String(expected);
function assertIdentity(identity){
 data(identity,identityKeys,'ACCOUNTING_PASSWORD_IDENTITY');
 for(const key of identityKeys.filter(k=>!['databaseGuid','environmentId','expectedUserVersion'].includes(k)))if(identity[key]!==TARGET[key])reject('ACCOUNTING_PASSWORD_IDENTITY');
 if(guid(identity.databaseGuid)!==TARGET.databaseGuid||guid(identity.environmentId)!==TARGET.environmentId||typeof identity.expectedUserVersion!=='string'||!/^[a-f0-9]{16}$/.test(identity.expectedUserVersion))reject('ACCOUNTING_PASSWORD_IDENTITY');
}
function assertUser(identity,user){
 if(!user||!fixedId(user.id,TARGET.userId)||user.username!==TARGET.username||!fixedId(user.role_id,TARGET.roleId)||user.is_active!==true||!Buffer.isBuffer(user.row_version)||user.row_version.length!==8||user.row_version.toString('hex')!==identity.expectedUserVersion)reject('ACCOUNTING_PASSWORD_USER');
}
export function validateHumanInput(input){
 data(input,['password','passwordConfirmation','confirmation'],'ACCOUNTING_HUMAN_INPUT_INVALID');
 const p=input.password;
 if(input.confirmation!==true||typeof p!=='string'||p.length<8||p.length>64||!p.isWellFormed()||Buffer.byteLength(p,'utf8')>72||input.passwordConfirmation!==p)reject('ACCOUNTING_HUMAN_INPUT_INVALID');
 return true;
}
export function assertAccountingTarget({identity,user,role}={}){
 assertIdentity(identity);assertUser(identity,user);
 if(!role||!fixedId(role.id,TARGET.roleId)||role.code!==TARGET.roleCode||role.is_active!==true||role.is_system_role!==false)reject('ACCOUNTING_PASSWORD_ROLE');
 return true;
}
export async function resetAccountingHumanPassword({sql,transaction,request,hashPassword,writeAudit,identity,readRole}={},input){
 validateHumanInput(input);assertIdentity(identity);
 if(!transaction||!sql||[request,hashPassword,writeAudit,readRole].some(f=>typeof f!=='function'))reject('ACCOUNTING_PASSWORD_DEPENDENCIES');
 // Snapshot before any await. Do not return, log, persist or relay either input.
 const password=input.password,admittedIdentity=Object.freeze({...identity});
 try{
  const reset=createResetManagedAuthPasswordCore({sql,request,hashPassword,writeAudit,
   authorizeUser:async(user,tx)=>{
    if(tx!==transaction)reject('ACCOUNTING_PASSWORD_TRANSACTION');
    assertUser(admittedIdentity,user);
    const role=await readRole(tx,TARGET.roleId);
    assertAccountingTarget({identity:admittedIdentity,user,role});
   }});
  const result=await reset(transaction,TARGET.userId,{password},null);
  if(result.id!==TARGET.userId||result.username!==TARGET.username||result.passwordConfigured!==true||result.sessionsRevoked!==true||typeof result.rowVersion!=='string'||!/^[a-f0-9]{16}$/.test(result.rowVersion)||result.rowVersion===admittedIdentity.expectedUserVersion)reject('ACCOUNTING_PASSWORD_RESULT');
  return result;
 }catch{
  // The injected driver/hash/audit can throw sensitive messages; never relay them.
  reject('ACCOUNTING_HUMAN_PASSWORD_RESET_REJECTED');
 }
}
