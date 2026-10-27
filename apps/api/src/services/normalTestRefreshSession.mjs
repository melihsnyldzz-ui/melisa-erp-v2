import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {CLEAN_DATABASE,CLEAN_ENVIRONMENT_ID} from './cleanSyntheticContext.mjs';
import {assertCanonicalBusinessSession} from './canonicalBusinessSessionContext.mjs';
export const normalTestFingerprint=Symbol('normal-test-session-fingerprint');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const reject=()=>Object.assign(new Error('Session is invalid or revoked'),{code:'AUTH_REFRESH_INVALID',statusCode:401});
export function bindNormalTestFingerprint(user,row,personnelBinding){
 if(typeof row.password_hash==='string'&&row.password_hash){
  const identity=[String(user.id),user.username,user.role.id,user.role.code,[...user.permissions].sort(),row.password_hash];
  // Existing actors retain their exact fingerprint. Personal accounts add the
  // server-read row versions, so deactivate/re-enable cannot revive an old family.
  if(personnelBinding!==undefined)identity.push(personnelBinding);
  Object.defineProperty(user,normalTestFingerprint,{value:hash(JSON.stringify(identity))});
 }
 return user;
}
export function createNormalTestRefreshStore({file,now=Date.now,random=()=>crypto.randomBytes(32).toString('base64url'),ttlMs=30*86400000}){
 if(!path.isAbsolute(file))throw Error('AUTH_SESSION_PATH');
 const plain=()=>{for(let p=file;;p=path.dirname(p)){if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw Error('AUTH_SESSION_REPARSE');if(p===path.dirname(p))break;}};
 const read=()=>{plain();let d;try{d=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')return{version:1,grants:[]};throw reject();}if(d.version!==1||!Array.isArray(d.grants)||d.grants.length>10000||d.grants.some(g=>!g||!/^[a-f0-9-]{36}$/.test(g.sid)||!/^\d+$/.test(g.userId)||!/^[a-f0-9]{64}$/.test(g.tokenHash)||!/^[a-f0-9]{64}$/.test(g.fingerprint)||!Number.isSafeInteger(g.expiresAt)||typeof g.revoked!=='boolean'||g.revocationHashes!==undefined&&(!Array.isArray(g.revocationHashes)||g.revocationHashes.length>5000||g.revocationHashes.some(h=>!/^[a-f0-9]{64}$/.test(h)))))throw reject();return d;};
 const digest=t=>{if(typeof t!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(t))throw reject();return hash(t);};
 const mutate=fn=>{plain();let fd,tmp;try{fd=fs.openSync(file+'.lock','wx',0o600);const d=read(),r=fn(d);tmp=file+'.'+crypto.randomUUID()+'.tmp';const out=fs.openSync(tmp,'wx',0o600);try{fs.writeFileSync(out,JSON.stringify(d));fs.fsyncSync(out);}finally{fs.closeSync(out);}fs.renameSync(tmp,file);tmp=null;return r;}catch(e){if(e.statusCode)throw e;throw Object.assign(new Error('Session storage unavailable'),{code:'AUTH_SESSION_STORAGE_UNAVAILABLE',statusCode:503});}finally{if(tmp)try{fs.unlinkSync(tmp);}catch{}if(fd!==undefined){fs.closeSync(fd);fs.unlinkSync(file+'.lock');}}};
 const current=(g,u)=>{if(!g||g.revoked||g.expiresAt<=now()||!u||String(u.id)!==g.userId||!u[normalTestFingerprint]||u[normalTestFingerprint]!==g.fingerprint)throw reject();return u;};
 return{
  issue(u){return mutate(d=>{if(!u?.[normalTestFingerprint]||d.grants.length>=10000)throw reject();const refreshToken=random(),sid=crypto.randomUUID(),expiresAt=now()+ttlMs;d.grants.push({sid,userId:String(u.id),fingerprint:u[normalTestFingerprint],tokenHash:digest(refreshToken),expiresAt,revoked:false});return{sid,refreshToken,refreshExpiresAt:expiresAt};});},
  userId(t){const g=read().grants.find(g=>g.tokenHash===digest(t));if(!g||g.revoked||g.expiresAt<=now())throw reject();return g.userId;},
  rotate(t,u){return mutate(d=>{const g=d.grants.find(g=>g.tokenHash===digest(t));current(g,u);g.revocationHashes??=[];if(g.revocationHashes.length>=5000)throw reject();g.revocationHashes.push(g.tokenHash);const refreshToken=random();g.tokenHash=digest(refreshToken);return{sid:g.sid,refreshToken,refreshExpiresAt:g.expiresAt};});},
  verify(sid,u){current(read().grants.find(g=>g.sid===sid),u);return true;},
  describe(sid,u){const g=read().grants.find(g=>g.sid===sid);current(g,u);return {sid:g.sid,userId:g.userId,expiresAt:g.expiresAt};},
  verifyPair(sid,t,u){const g=read().grants.find(g=>g.sid===sid);current(g,u);if(g.tokenHash!==digest(t))throw reject();return true;},
  revoke(t){return mutate(d=>{const h=digest(t),g=d.grants.find(g=>g.tokenHash===h||g.revocationHashes?.includes(h));if(g)g.revoked=true;return{loggedOut:true};});},
 };
}
export function normalTestRefreshTarget({copy,clean,business,config=process.env}={}){
 if(business!==undefined){
  const context=assertCanonicalBusinessSession(business);
  if(copy||clean||config.MELISA_TEST_PROTECTED_SESSION_PATH!==context.sessionPath)throw Error('AUTH_TEST_SESSION_TARGET');
  return context.sessionPath;
 }
 const file=config.MELISA_TEST_PROTECTED_SESSION_PATH;if(!file)return null;
 if(clean!==undefined){
  const expected='C:\\Sirket\\ERP\\clean\\20261022\\runtime\\protected-erp-sessions\\grants.json';
  if(copy||clean?.environment!=='CLEAN_SYNTHETIC_TEST'||clean.environmentId!==CLEAN_ENVIRONMENT_ID||clean.database!==CLEAN_DATABASE||clean.synthetic!==true||clean.actualT1!==false||clean.externalOperations!==false||config.MELISA_CLEAN_TEST!=='20261022'||config.SQL_DATABASE!==CLEAN_DATABASE||String(config.API_PORT)!=='4194'||typeof file!=='string'||path.win32.resolve(file)!==expected||file!==expected)throw Error('AUTH_TEST_SESSION_TARGET');
  return file;
 }
 const root=path.win32.resolve('C:/Sirket/ERP/runtime'),relative=path.win32.relative(root,file);
 if(copy?.copyId!=='e16b70f0-4057-428b-9abc-6bbcaf35fe82'||copy.target?.database!=='MELISA_ERP_CRM_SHARED_TEST_20261009_02'||copy.target?.server!=='Semih\\MELISADEV'||!path.win32.isAbsolute(file)||!relative||relative.startsWith('..')||path.win32.isAbsolute(relative)||path.win32.extname(file)!=='.json')throw Error('AUTH_TEST_SESSION_TARGET');
 return file;
}
export function configuredNormalTestRefreshStore(options={}){
 const file=normalTestRefreshTarget(options);
 // Only the approved dedicated business identity has explicit-logout lifetime.
 // Access JWTs remain short-lived; logout, row-version/permission/password
 // checks and refresh rotation still revoke the entire existing family.
 return file?createNormalTestRefreshStore({file,...(options.business?{ttlMs:Date.UTC(9999,11,31)-Date.now()}:{} )}):null;
}
export function cleanProtectedSessionReadAllowed(req,options={}){
 if(req?.method!=='POST'||req.path!=='/api/auth/session-confirm'||req.query&&Object.keys(req.query).length||!options.clean)return false;
 try{return normalTestRefreshTarget(options)!==null;}catch{return false;}
}
