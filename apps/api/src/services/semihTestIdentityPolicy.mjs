import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {normalTestFingerprint,bindNormalTestFingerprint,normalTestRefreshTarget} from './normalTestRefreshSession.mjs';
import {CLEAN_DATABASE,CLEAN_ENVIRONMENT_ID,CLEAN_LOGIN} from './cleanSyntheticContext.mjs';
import {CLEAN_PERSONNEL_WORK_ROLES} from './cleanPersonnelManagement.mjs';
import {expandPermissions,applyRolePermissionDefaults} from './permissionCatalog.js';
import {businessSessionUserAllowed} from './canonicalBusinessSessionContext.mjs';
const personalUsers=new WeakMap();
const legacyIds=new Set([15,16,17,18,19,20,21,22,23,10018]);
const personalReject=()=>{throw Object.assign(new Error('Personal TEST session identity is unavailable'),{code:'AUTH_REFRESH_INVALID',statusCode:401});};
const exactClean=options=>!options?.copy&&options?.clean?.environment==='CLEAN_SYNTHETIC_TEST'&&options.clean.environmentId===CLEAN_ENVIRONMENT_ID&&options.clean.database===CLEAN_DATABASE&&options.clean.synthetic===true&&options.clean.actualT1===false&&options.clean.externalOperations===false;
const userIdentity=user=>JSON.stringify([user.id,user.username,user.role?.id,user.role?.code,[...(user.permissions??[])].sort()]);
export function requiresCleanPersonalNormalWitness(user,options){
 const role=CLEAN_PERSONNEL_WORK_ROLES[user?.role?.id];
 return exactClean(options)&&Number.isSafeInteger(user?.id)&&user.id>0&&!legacyIds.has(user.id)&&!!role&&role.code===user?.role?.code&&normalTestRefreshTarget(options)!==null;
}
// Called only with the normal service's fresh SQL result. The WeakMap witness
// is never a DTO/JWT/client field and does not survive JSON or object spreading.
export function bindCleanPersonalNormalTestUser(user,row,witness,options){
 if(!requiresCleanPersonalNormalWitness(user,options)||!witness||row.is_active!==true||row.role_is_active!==true||user.isAdmin===true||user.testAdminSession===true||!Array.isArray(user.permissions)||user.permissions.some(p=>typeof p!=='string'))personalReject();
 const same=(a,b)=>String(a)===String(b),version=v=>typeof v==='string'&&/^0x[a-fA-F0-9]{16}$/.test(v);
 if(witness.databaseName!==CLEAN_DATABASE||witness.serverName!=='Semih\\MELISADEV'||witness.loginName!==CLEAN_LOGIN||witness.databaseUser!==CLEAN_LOGIN||typeof witness.environmentId!=='string'||witness.environmentId.toLowerCase()!==CLEAN_ENVIRONMENT_ID||witness.synthetic!==true||witness.actualT1!==false||witness.externalOperations!==false||!same(witness.actorId,user.id)||!same(witness.employeeUserId,user.id)||!Number.isSafeInteger(Number(witness.employeeId))||Number(witness.employeeId)<1||witness.username!==user.username||!same(witness.roleId,user.role.id)||witness.roleCode!==user.role.code||witness.passwordHash!==row.password_hash||witness.userActive!==true||witness.roleActive!==true||witness.employeeActive!==true||![witness.userVersion,witness.roleVersion,witness.employeeVersion].every(version)||typeof witness.memberCreatedAt!=='string'||!witness.memberCreatedAt)personalReject();
 let permissionRows;try{permissionRows=JSON.parse(witness.permissionState);}catch{personalReject();}
 const role=CLEAN_PERSONNEL_WORK_ROLES[user.role.id],keys=[...new Set([...role.view,...role.create,...role.approve])].sort();
 if(!Array.isArray(permissionRows)||permissionRows.length!==keys.length||permissionRows.some(p=>!p||typeof p!=='object')||new Set(permissionRows.map(p=>p.permission_key)).size!==keys.length||permissionRows.some(p=>!keys.includes(p.permission_key)||p.can_view!==role.view.includes(p.permission_key)||p.can_create!==role.create.includes(p.permission_key)||p.can_approve!==role.approve.includes(p.permission_key)||p.can_update!==false||p.can_delete!==false||!version(p.version))||JSON.stringify(applyRolePermissionDefaults(expandPermissions(permissionRows),role.code))!==JSON.stringify([...user.permissions].sort()))personalReject();
 const binding=['clean-personnel.v1',CLEAN_ENVIRONMENT_ID,String(witness.employeeId),witness.memberCreatedAt,witness.userVersion.toLowerCase(),witness.roleVersion.toLowerCase(),witness.employeeVersion.toLowerCase(),permissionRows.map(p=>[p.permission_key,p.version.toLowerCase()]).sort(([a],[b])=>a.localeCompare(b))];
 bindNormalTestFingerprint(user,row,binding);
 personalUsers.set(user,{identity:userIdentity(user),fingerprint:user[normalTestFingerprint]});
 return user;
}
const fail=()=>{throw Object.assign(new Error('Dedicated TEST identity is unavailable'),{code:'AUTH_TEST_SEMIH_IDENTITY_INVALID',statusCode:503});};
const exact=(value,keys)=>value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
export function validateSemihTestIdentity(value,copy) {
 if(copy?.copyId!=='e16b70f0-4057-428b-9abc-6bbcaf35fe82'||copy.target?.server!=='Semih\\MELISADEV'||copy.target?.database!=='MELISA_ERP_CRM_SHARED_TEST_20261009_02'||copy.actualT1!==false)fail();
 if(!exact(value,['schemaVersion','copyId','target','userId','username','displayName','role','fingerprint'])||value.schemaVersion!=='melisa-semih-test-identity.v1'||value.copyId!==copy.copyId||!exact(value.target,['server','database'])||value.target.server!==copy.target.server||value.target.database!==copy.target.database)fail();
 if(typeof value.userId!=='string'||!/^[1-9]\d{0,14}$/.test(value.userId)||!Number.isSafeInteger(Number(value.userId))||['15','16'].includes(value.userId)||value.username!=='erp-semih-test-20261012'||value.displayName!=='Semih TEST'||!exact(value.role,['id','code'])||value.role.id!=='2'||value.role.code!=='admin'||!/^[a-f0-9]{64}$/.test(value.fingerprint??''))fail();
 return Object.freeze({...value,target:Object.freeze({...value.target}),role:Object.freeze({...value.role})});
}
export function configuredSemihTestIdentity({copy,config=process.env}={}) {
 const file=config.MELISA_TEST_SEMIH_IDENTITY_PATH,sha=config.MELISA_TEST_SEMIH_IDENTITY_SHA256;
 if(file===undefined&&sha===undefined)return null;
 if(typeof file!=='string'||!path.win32.isAbsolute(file)||!/^[a-fA-F0-9]{64}$/.test(sha??''))fail();
 const relative=path.win32.relative('C:/Sirket/ERP/runtime',file);
 if(!relative||relative.startsWith('..')||path.win32.isAbsolute(relative)||path.win32.extname(file)!=='.json')fail();
 try {
  for(let p=file;;p=path.dirname(p)){if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())fail();if(p===path.dirname(p))break;}
  const stat=fs.lstatSync(file);if(!stat.isFile()||stat.nlink!==1||stat.size<2||stat.size>4096)fail();
  const bytes=fs.readFileSync(file);if(createHash('sha256').update(bytes).digest('hex')!==sha.toLowerCase())fail();
  return validateSemihTestIdentity(JSON.parse(bytes.toString('utf8')),copy);
 }catch{fail();}
}
export function matchesSemihTestUser(user,identity) {
 return !!(identity&&user&&String(user.id)===identity.userId&&user.username===identity.username&&user.displayName===identity.displayName&&String(user.role?.id)===identity.role.id&&user.role?.code===identity.role.code&&user[normalTestFingerprint]===identity.fingerprint);
}
export function allowsProtectedNormalTestUser(user,options) {
 if(options?.business!==undefined)return !options.copy&&!options.clean&&businessSessionUserAllowed(user,options.business,user?.[normalTestFingerprint]);
 if(options?.clean!==undefined){
  const clean=options.clean;
  if(options.copy||clean?.environment!=='CLEAN_SYNTHETIC_TEST'||clean.environmentId!==CLEAN_ENVIRONMENT_ID||clean.database!==CLEAN_DATABASE||clean.synthetic!==true||clean.actualT1!==false||clean.externalOperations!==false||user?.isActive===false||user?.isAdmin===true||user?.testAdminSession===true||!Array.isArray(user?.permissions)||user.permissions.some(p=>typeof p!=='string')||!/^[a-f0-9]{64}$/.test(user?.[normalTestFingerprint]??''))return false;
  const actors=[[15,'ornek-satis',20,'clean_test_sales'],[16,'ornek-okuyucu',21,'clean_test_reader'],[17,'ornek-sorumlu',22,'clean_test_supervisor'],[18,'ornek-depo',23,'clean_test_warehouse'],[19,'ornek-kontrol',24,'clean_test_inbound_supervisor'],[20,'ornek-finans',25,'clean_test_finance'],[21,'ornek-sayim',26,'clean_test_counter'],[22,'ornek-inceleme',27,'clean_test_inventory_supervisor'],[23,'ornek-finans-kontrol',29,'clean_test_finance_checker'],[10018,'semih',28,'clean_test_administrator']];
  if(actors.some(([id,username,roleId,roleCode])=>user.id===id&&user.username===username&&user.role?.id===roleId&&user.role?.code===roleCode))return true;
  const witness=personalUsers.get(user);
  return !!(witness&&requiresCleanPersonalNormalWitness(user,options)&&witness.identity===userIdentity(user)&&witness.fingerprint===user[normalTestFingerprint]);
 }
 const identity=configuredSemihTestIdentity(options);
 return [15,16].includes(user?.id)||matchesSemihTestUser(user,identity);
}
