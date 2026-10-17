import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {normalTestFingerprint} from './normalTestRefreshSession.mjs';
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
 const identity=configuredSemihTestIdentity(options);
 return [15,16].includes(user?.id)||matchesSemihTestUser(user,identity);
}
