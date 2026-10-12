import {validateOperationCopyBootstrap} from './isolatedOperationCopyModel.mjs';
import {resolveTestApiBase} from './testAdminSession.mjs';
const queues=new WeakMap();
const unavailable=()=>{throw Object.assign(new Error('Semih giriş bağlantısı doğrulanamadı.'),{status:503});};
export function semihBrowserRequested(location){try{return new URLSearchParams(location?.search??'').has('semih');}catch{return false;}}
export function validateSemihBrowserScope({location,apiBase,copyProfile,protectedDevice}){
 if(protectedDevice||location?.protocol!=='http:'||location.port!=='5234'||!['127.0.0.1','192.168.1.46'].includes(location.hostname)||location.pathname!=='/ornek-akis.html'||location.search!=='?semih=1'||location.origin!==`http://${location.hostname}:5234`||!resolveTestApiBase({location,apiBase}))unavailable();
 const profile=validateOperationCopyBootstrap(copyProfile,location);if(profile.copyId!=='e16b70f0-4057-428b-9abc-6bbcaf35fe82')unavailable();return true;
}
export function validateSemihBrowserUser(user,{publicOnly=false}={}){
 if(!user||user.id!==17||user.username!=='erp-semih-test-20261012'||user.displayName!=='Semih TEST'||String(user.role?.id)!=='2'||user.role?.code!=='admin'||user.testAdminSession===true||!publicOnly&&(!Array.isArray(user.permissions)||user.permissions.some(p=>typeof p!=='string')))unavailable();return user;
}
export function validateSemihBrowserGrant(payload){
 const data=payload?.data;validateSemihBrowserUser(data?.user);
 if(payload?.success!==true||typeof data.accessToken!=='string'||!data.accessToken||data.accessToken.length>8192||Object.hasOwn(data,'refreshToken')||!Number.isSafeInteger(data.expiresAt)||data.expiresAt<=Date.now())unavailable();return data;
}
// Serialize cookie enrollment/rotation/logout across factories in one document.
// The server remains responsible for cross-tab grant and CSRF validation.
export function queueSemihBrowserCall(fetchImpl,work){
 if(typeof fetchImpl!=='function')unavailable();const next=(queues.get(fetchImpl)??Promise.resolve()).then(work);queues.set(fetchImpl,next.catch(()=>{}));return next;
}
