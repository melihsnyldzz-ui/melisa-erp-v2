import {shouldAutoOpenTestAdmin,testSessionModeKey} from './testAdminSession.mjs';
export const workingCatalogTokenKey='melisaTestSalesAccessToken';
const problem=(message='ERP bağlantısı kurulamadı. Yeniden deneyin.',status=503)=>Object.assign(new Error(message),{status});
function validUser(user){
 if(!user||!Number.isSafeInteger(user.id)||user.id<1||!Array.isArray(user.permissions)||user.permissions.some(p=>typeof p!=='string'))throw problem('Oturum bilgileri doğrulanamadı.');
 return user;
}
export function workingCatalogUserLabel(user){return user?.role?.code==='admin'?'Yönetici':typeof user?.displayName==='string'?user.displayName.replace(/TEST|DEMO|DEBUG/gi,'').trim()||'Kullanıcı':'Kullanıcı';}
export function createWorkingCatalogSession({location,apiBase,storage,fetchImpl=globalThis.fetch,onExpired=()=>{},timeoutMs=15000}={}){
 let active=true,token=null,user=null,generation=0;const controllers=new Set();
 const target=()=>shouldAutoOpenTestAdmin({location,apiBase,mode:null});
 const stored=key=>{try{return storage?.getItem(key);}catch{return null;}};
 const save=(key,value)=>{try{value===null?storage?.removeItem(key):storage?.setItem(key,value);}catch{throw problem('Oturum saklanamadı.');}};
 const clear=()=>{generation++;controllers.forEach(c=>c.abort());token=null;user=null;try{storage?.removeItem(workingCatalogTokenKey);}catch{}};
 async function request(path,{method='GET',body,expire=false}={}){
  if(!active)throw problem('İstek iptal edildi.');if(!target())throw problem('Bu çalışma bağlantısı kullanılamıyor.');
  const controller=new AbortController(),version=generation,requestToken=token;controllers.add(controller);const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetchImpl(apiBase+path,{method,credentials:'omit',redirect:'error',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
   if(!active||controller.signal.aborted||version!==generation||requestToken!==token)throw problem('İstek iptal edildi.');
   const payload=await response.json();if(!active||controller.signal.aborted||version!==generation||requestToken!==token)throw problem('İstek iptal edildi.');
   if(!response.ok||payload?.success!==true){if(response.status===401||response.status===403){clear();if(expire&&active)onExpired();}throw problem(response.status===401?'Oturumunuz sona erdi. Yeniden giriş yapın.':response.status===403?'Bu kayıtları görüntüleme yetkiniz yok.':'ERP bağlantısı şu anda okunamıyor.',response.status);}
   return payload;
  }catch(error){if(error?.status)throw error;throw problem();}finally{clearTimeout(timer);controllers.delete(controller);}
 }
 async function accept(payload){
  const data=payload?.data;if(typeof data?.accessToken!=='string'||!data.accessToken.length)throw problem('Oturum doğrulanamadı.');
  const next=validUser(data.user);if(!active)throw problem('İstek iptal edildi.');token=data.accessToken;user=next;save(workingCatalogTokenKey,token);return user;
 }
 return {
  async start(){
   if(!target())throw problem('Bu çalışma bağlantısı kullanılamıyor.');token=stored(workingCatalogTokenKey);
   if(token){try{user=validUser((await request('/api/auth/me')).data);return user;}catch(error){clear();if(!active)throw error;}}
   if(!shouldAutoOpenTestAdmin({location,apiBase,mode:stored(testSessionModeKey)}))return null;
   return accept(await request('/api/auth/test-admin',{method:'POST',body:{}}));
  },
  async login({username,password}){if(typeof username!=='string'||typeof password!=='string'||!username.trim()||!password)throw problem('Kullanıcı adı ve şifre gerekli.',400);save(testSessionModeKey,'manual');clear();return accept(await request('/api/auth/login',{method:'POST',body:{username,password}}));},
  async api(path,{envelope=false,...extra}={}){
   if(Object.keys(extra).length||typeof path!=='string'||!/^\/api\/catalog\/products(?:\/[1-9]\d*)?(?:\?[^#]*)?$/.test(path)||!token||!user)throw problem('Katalog isteği kullanılamıyor.');
   const payload=await request(path,{expire:true});return envelope?payload:payload.data;
  },
  dispose(){active=false;generation++;controllers.forEach(c=>c.abort());controllers.clear();user=null;token=null;},
 };
}
