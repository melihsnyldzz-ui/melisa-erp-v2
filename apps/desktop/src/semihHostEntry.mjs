import fs from 'node:fs';
import * as asyncFs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {worktest,validateWorktestSession} from './protectedWorkSessionPolicy.mjs';
import {prepareWorktestUserData} from './protectedWorkSessionStore.mjs';

export const semihIdentityPath='C:\\Sirket\\ERP\\runtime\\SEMIH-TEST-20261012\\erp-identity.json';
export const semihCredentialPath='C:\\Sirket\\ERP\\runtime\\SEMIH-TEST-20261012\\erp-first-login.dpapi';
const fail=()=>{throw new Error('WORKTEST_SEMIH_ENTRY_UNAVAILABLE');};
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
export function validateSemihEntryPin(value){
 if(!exact(value,['identityPath','identitySHA256'])||value.identityPath!==semihIdentityPath||!/^[a-f0-9]{64}$/.test(value.identitySHA256??''))fail();
 return Object.freeze({...value});
}
export function validateSemihHostIdentity(value){
 if(!exact(value,['schemaVersion','copyId','target','userId','username','displayName','role','fingerprint'])||value.schemaVersion!=='melisa-semih-test-identity.v1'||value.copyId!==worktest.copyId||!exact(value.target,['server','database'])||value.target.server!==worktest.server||value.target.database!==worktest.database||value.userId!=='17'||value.username!=='erp-semih-test-20261012'||value.displayName!=='Semih TEST'||!exact(value.role,['id','code'])||value.role.id!=='2'||value.role.code!=='admin'||!/^[a-f0-9]{64}$/.test(value.fingerprint??''))fail();
 return Object.freeze({...value,target:Object.freeze({...value.target}),role:Object.freeze({...value.role})});
}
export function readSemihHostIdentity(pin,{platform=process.platform,io=fs}={}){
 validateSemihEntryPin(pin);if(platform!=='win32')fail();
 try{
  for(let p=pin.identityPath;;p=path.win32.dirname(p)){if(io.lstatSync(p).isSymbolicLink())fail();if(p===path.win32.dirname(p))break;}
  const s=io.lstatSync(pin.identityPath);if(!s.isFile()||s.nlink!==1||s.size<2||s.size>4096)fail();
  const bytes=io.readFileSync(pin.identityPath);if(createHash('sha256').update(bytes).digest('hex')!==pin.identitySHA256)fail();
  return validateSemihHostIdentity(JSON.parse(bytes.toString('utf8')));
 }catch{fail();}
}
export function assertSemihHostUser(user,identity){
 if(!user||String(user.id)!==identity.userId||user.username!==identity.username||user.displayName!==identity.displayName||String(user.role?.id)!==identity.role.id||user.role?.code!==identity.role.code||user.testAdminSession||!Array.isArray(user.permissions)||user.permissions.some(p=>typeof p!=='string'))fail();
}
export function createSemihStartupState({root,io=asyncFs,prepare=prepareWorktestUserData}){
 const marker=path.join(root,'first-login-consumed.json');
 const value={schemaVersion:'melisa-semih-first-login-consumed.v1',copyId:worktest.copyId,userId:'17',consumed:true};
 async function read(){
  prepare(root);let s;try{s=await io.lstat(marker);}catch(e){if(e.code==='ENOENT')return false;fail();}
  if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>4096)fail();
  let parsed;try{parsed=JSON.parse(await io.readFile(marker,'utf8'));}catch{fail();}
  if(!exact(parsed,Object.keys(value))||Object.keys(value).some(k=>parsed[k]!==value[k]))fail();return true;
 }
 return Object.freeze({canFirstLogin:async()=>!await read(),consume:async()=>{
  if(await read())return;let handle;
  try{handle=await io.open(marker,'wx',0o600);await handle.writeFile(JSON.stringify(value),'utf8');await handle.sync();}
  catch(e){if(e.code!=='EEXIST')fail();}
  finally{await handle?.close();}
  if(!await read())fail();
 }});
}
// This is a client of the existing normal password/refresh/me/logout API, never
// a token issuer or anonymous entry endpoint. Only explicit OS application
// opening (before its first document) or its guarded user menu may continue;
// renderer get/reload/navigation never logs a signed-out user in again.
export function createSemihHostEntry({identity,store,readCredential,verifyRuntime,startupState,fetchImpl=globalThis.fetch,now=Date.now}){
 validateSemihHostIdentity(identity);
 if(typeof startupState?.canFirstLogin!=='function'||typeof startupState?.consume!=='function')fail();
 async function request(route,{body,token}={}){
  const response=await fetchImpl(worktest.api+route,{method:body===undefined?'GET':'POST',redirect:'error',credentials:'omit',signal:AbortSignal.timeout(5000),headers:{Origin:worktest.origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  let text='';for await(const chunk of response.body){text+=Buffer.from(chunk).toString('utf8');if(text.length>65536)fail();}
  let value;try{value=JSON.parse(text);}catch{fail();}if(!response.ok||value?.success!==true)throw Object.assign(new Error('WORKTEST_SEMIH_ENTRY_UNAVAILABLE'),{authRejected:[401,403].includes(response.status)});return value.data;
 }
 async function revoke(refreshToken){if(typeof refreshToken==='string'&&refreshToken){const proof=await request('/api/auth/logout',{body:{refreshToken}});if(proof?.loggedOut!==true)fail();}}
 const cleanupRevoke=refreshToken=>revoke(refreshToken).catch(()=>{});
 async function confirm(record){
  const proof=await request('/api/auth/session-confirm',{token:record.accessToken,body:{refreshToken:record.refreshToken}});
  if(proof?.confirmed!==true||proof.expiresAt!==record.expiresAt||record.expiresAt<=now())fail();assertSemihHostUser(proof.user,identity);
 }
 async function verifiedRecord(grant){
  assertSemihHostUser(grant?.user,identity);
  const record=validateWorktestSession({accessToken:grant.accessToken,refreshToken:grant.refreshToken,userId:String(grant.user.id),username:grant.user.username,expiresAt:grant.expiresAt},identity);
  if(record.expiresAt<=now())fail();
  const fresh=await request('/api/auth/me',{token:record.accessToken});assertSemihHostUser(fresh,identity);return record;
 }
 let queue=Promise.resolve();const serial=fn=>{const call=queue.then(fn);queue=call.catch(()=>{});return call;};
 return Object.freeze({
  continueSession:({startup=false}={})=>serial(async()=>{
   let old=null,grant=null;
   // A temporary offline health failure must not destroy a saved OS grant.
   try{await verifyRuntime();}catch{fail();}
   try{
    old=await store.get();
    if(old){validateWorktestSession(old,identity);grant=await request('/api/auth/refresh',{body:{refreshToken:old.refreshToken}});if(grant.refreshToken===old.refreshToken)fail();}
    else{if(startup&&!await startupState.canFirstLogin())return null;await startupState.consume();const credential=await readCredential(semihCredentialPath);if(credential.username!==identity.username||typeof credential.password!=='string'||credential.password.length<32)fail();try{grant=await request('/api/auth/login',{body:{username:credential.username,password:credential.password}});}finally{credential.password='';}}
    const record=await verifiedRecord(grant);await verifyRuntime();await startupState.consume();await store.put(record);return null;
   }catch(error){if(old&&!grant&&error?.authRejected!==true)fail();await cleanupRevoke(grant?.refreshToken);await cleanupRevoke(old?.refreshToken);if(old||grant)await startupState.consume();await store.clear().catch(()=>{});fail();}
  }),
  accept:record=>serial(async()=>{
   await verifyRuntime();const checked=validateWorktestSession(record,identity);let paired=false;
   try{await confirm(checked);paired=true;await startupState.consume();await store.put(checked);}
   catch{if(paired){await cleanupRevoke(checked.refreshToken);await store.clear().catch(()=>{});}fail();}return null;
  }),
  clear:()=>serial(async()=>{
   let old=null,firstFailure=null,known=false;
   const attempt=async fn=>{try{await fn();}catch(error){firstFailure??=error??new Error('WORKTEST_SEMIH_ENTRY_UNAVAILABLE');}};
   await attempt(async()=>{old=await store.get();if(old!==null){validateWorktestSession(old,identity);known=true;}});
   // accept persisted only a server-confirmed pair. The normal page may have
   // revoked it already; server logout remains idempotent for this known grant.
   if(known)await attempt(()=>revoke(old.refreshToken));
   // Local logout and the nonsecret intent survive an offline server. Failure
   // in any step still rejects; local deletion is never server revoke proof.
   await attempt(()=>startupState.consume());
   await attempt(()=>store.clear());
   if(firstFailure!==null)fail();return null;
  }),
 });
}
