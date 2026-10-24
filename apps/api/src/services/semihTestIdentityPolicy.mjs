import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {normalTestFingerprint} from './normalTestRefreshSession.mjs';
import {CLEAN_DATABASE,CLEAN_ENVIRONMENT_ID} from './cleanSyntheticContext.mjs';
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
 if(options?.clean!==undefined){
  const clean=options.clean;
  if(options.copy||clean?.environment!=='CLEAN_SYNTHETIC_TEST'||clean.environmentId!==CLEAN_ENVIRONMENT_ID||clean.database!==CLEAN_DATABASE||clean.synthetic!==true||clean.actualT1!==false||clean.externalOperations!==false||user?.isActive===false||user?.isAdmin===true||user?.testAdminSession===true||!Array.isArray(user?.permissions)||user.permissions.some(p=>typeof p!=='string')||!/^[a-f0-9]{64}$/.test(user?.[normalTestFingerprint]??''))return false;
  const actors=[[15,'ornek-satis',20,'clean_test_sales'],[16,'ornek-okuyucu',21,'clean_test_reader'],[17,'ornek-sorumlu',22,'clean_test_supervisor'],[18,'ornek-depo',23,'clean_test_warehouse'],[19,'ornek-kontrol',24,'clean_test_inbound_supervisor'],[20,'ornek-finans',25,'clean_test_finance'],[21,'ornek-sayim',26,'clean_test_counter'],[22,'ornek-inceleme',27,'clean_test_inventory_supervisor'],[23,'ornek-finans-kontrol',29,'clean_test_finance_checker'],[10018,'semih',28,'clean_test_administrator']];
  return actors.some(([id,username,roleId,roleCode])=>user.id===id&&user.username===username&&user.role?.id===roleId&&user.role?.code===roleCode);
 }
 const identity=configuredSemihTestIdentity(options);
 return [15,16].includes(user?.id)||matchesSemihTestUser(user,identity);
}
