import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const normalTestFingerprint=Symbol('normal-test-session-fingerprint');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const reject=()=>Object.assign(new Error('Session is invalid or revoked'),{code:'AUTH_REFRESH_INVALID',statusCode:401});
export function bindNormalTestFingerprint(user,row){
 if(typeof row.password_hash==='string'&&row.password_hash)Object.defineProperty(user,normalTestFingerprint,{value:hash(JSON.stringify([String(user.id),user.username,user.role.id,user.role.code,[...user.permissions].sort(),row.password_hash]))});
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
  inspectToken(t,{includeRetired=false}={}){const h=digest(t),g=read().grants.find(g=>g.tokenHash===h||includeRetired&&g.revocationHashes?.includes(h));if(!g||!includeRetired&&(g.revoked||g.expiresAt<=now()))throw reject();return Object.freeze({sid:g.sid,userId:g.userId,refreshExpiresAt:g.expiresAt});},
  rotate(t,u){return mutate(d=>{const g=d.grants.find(g=>g.tokenHash===digest(t));current(g,u);g.revocationHashes??=[];if(g.revocationHashes.length>=5000)throw reject();g.revocationHashes.push(g.tokenHash);const refreshToken=random();g.tokenHash=digest(refreshToken);return{sid:g.sid,refreshToken,refreshExpiresAt:g.expiresAt};});},
  verify(sid,u){current(read().grants.find(g=>g.sid===sid),u);return true;},
  verifyPair(sid,t,u){const g=read().grants.find(g=>g.sid===sid);current(g,u);if(g.tokenHash!==digest(t))throw reject();return true;},
  revoke(t,expectedUserId){return mutate(d=>{const h=digest(t),g=d.grants.find(g=>g.tokenHash===h||g.revocationHashes?.includes(h));if(expectedUserId!==undefined&&(!g||g.userId!==expectedUserId))throw reject();if(g)g.revoked=true;return{loggedOut:true};});},
 };
}
export function configuredNormalTestRefreshStore({copy,config=process.env}={}){
 const file=config.MELISA_TEST_PROTECTED_SESSION_PATH;if(!file)return null;
 const root=path.win32.resolve('C:/Sirket/ERP/runtime'),relative=path.win32.relative(root,file);
 if(copy?.copyId!=='e16b70f0-4057-428b-9abc-6bbcaf35fe82'||copy.target?.database!=='MELISA_ERP_CRM_SHARED_TEST_20261009_02'||copy.target?.server!=='Semih\\MELISADEV'||!path.win32.isAbsolute(file)||!relative||relative.startsWith('..')||path.win32.isAbsolute(relative)||path.win32.extname(file)!=='.json')throw Error('AUTH_TEST_SESSION_TARGET');
 return createNormalTestRefreshStore({file});
}
