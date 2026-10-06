import {shouldAutoOpenTestAdmin,testSessionModeKey,resolveTestApiBase,isTestSessionTarget} from './testAdminSession.mjs';
export const workingCatalogTokenKey='melisaTestSalesAccessToken';
const problem=(message='ERP bağlantısı kurulamadı. Yeniden deneyin.',status=503)=>Object.assign(new Error(message),{status});
function validUser(user){
 if(!user||!Number.isSafeInteger(user.id)||user.id<1||!Array.isArray(user.permissions)||user.permissions.some(p=>typeof p!=='string'))throw problem('Oturum bilgileri doğrulanamadı.');
 return user;
}
export function workingCatalogUserLabel(user){return user?.role?.code==='admin'?'Yönetici':typeof user?.displayName==='string'?user.displayName.replace(/TEST|DEMO|DEBUG/gi,'').trim()||'Kullanıcı':'Kullanıcı';}
export function createWorkingCatalogSession({location,apiBase,storage,fetchImpl=globalThis.fetch,onExpired=()=>{},timeoutMs=15000}={}){
 const resolvedApiBase=resolveTestApiBase({location,apiBase});
 let active=true,token=null,user=null,generation=0;const controllers=new Set();
 const target=()=>isTestSessionTarget({location,apiBase});
 const stored=key=>{try{return storage?.getItem(key);}catch{return null;}};
 const save=(key,value)=>{try{value===null?storage?.removeItem(key):storage?.setItem(key,value);}catch{throw problem('Oturum saklanamadı.');}};
 const clear=({force=false}={})=>{const previous=token;generation++;controllers.forEach(c=>c.abort());token=null;user=null;try{if(force||previous!==null&&stored(workingCatalogTokenKey)===previous)storage?.removeItem(workingCatalogTokenKey);}catch{}};
 async function request(path,{method='GET',body,expire=false,workErrors=false,keepForbiddenSession=false,inboundErrors=false,paymentErrors=false,startupAuth=false}={}){
  if(!active)throw problem('İstek iptal edildi.');if(!target())throw problem('Bu çalışma bağlantısı kullanılamıyor.');
  const controller=new AbortController(),version=generation,requestToken=token;controllers.add(controller);const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetchImpl(resolvedApiBase+path,{method,credentials:'omit',redirect:'error',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
   if(!active||controller.signal.aborted||version!==generation||requestToken!==token)throw problem('İstek iptal edildi.');
   const payload=await response.json();if(!active||controller.signal.aborted||version!==generation||requestToken!==token)throw problem('İstek iptal edildi.');
   if(!response.ok||payload?.success!==true){if(!startupAuth&&(response.status===401||response.status===403&&!keepForbiddenSession)){clear();if(expire&&active)onExpired();}const error=problem(response.status===401?'Oturumunuz sona erdi. Yeniden giriş yapın.':response.status===403?'Bu kayıtları görüntüleme yetkiniz yok.':'ERP bağlantısı şu anda okunamıyor.',response.status);if(workErrors&&response.status===409&&payload?.error?.code==='WORK_COLLECTIONS_ACTIVE')error.code='WORK_COLLECTIONS_ACTIVE';if(inboundErrors&&response.status===409&&['INBOUND_STALE','INBOUND_NEEDS_REVIEW','INBOUND_REQUEST_CONFLICT','INBOUND_STATE','INBOUND_PRODUCT'].includes(payload?.error?.code))error.code=payload.error.code;if(paymentErrors&&['WORK_PAYMENT_INPUT','WORK_PAYMENT_AMOUNT','WORK_PAYMENT_SCOPE','WORK_PAYMENT_DEBT','WORK_PAYMENT_FUNDS','WORK_PAYMENT_RATE','WORK_PAYMENT_STALE','WORK_PAYMENT_PREVIEW','WORK_PAYMENT_REQUEST_CONFLICT','WORK_PAYMENT_ALREADY_CANCELLED','WORK_PAYMENT_LIMIT','WORK_PAYMENT_NOT_FOUND','WORK_PAYMENT_FORBIDDEN','WORK_PAYMENT_UNAVAILABLE'].includes(payload?.error?.code))error.code=payload.error.code;throw error;}
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
   if(token){const version=generation,cachedToken=token;try{const payload=await request('/api/auth/me',{startupAuth:true});if(!active||version!==generation||token!==cachedToken||stored(workingCatalogTokenKey)!==cachedToken)throw problem('İstek iptal edildi.');user=validUser(payload.data);return user;}catch(error){if(!active||version!==generation||token!==cachedToken||stored(workingCatalogTokenKey)!==cachedToken)throw error;if(![401,403].includes(error?.status))throw problem('Oturum şu anda doğrulanamıyor. Yenileyerek tekrar deneyin.',error?.status??503);clear();}}
   if(!shouldAutoOpenTestAdmin({location,apiBase,mode:stored(testSessionModeKey)}))return null;
   return accept(await request('/api/auth/test-admin',{method:'POST',body:{}}));
  },
  async login({username,password}){if(typeof username!=='string'||typeof password!=='string'||!username.trim()||!password)throw problem('Kullanıcı adı ve şifre gerekli.',400);save(testSessionModeKey,'manual');clear({force:true});return accept(await request('/api/auth/login',{method:'POST',body:{username,password}}));},
  async home(...args){
   if(args.length||!token||!user)throw problem('Günlük işler okunamıyor.');
   return (await request('/api/home/summary',{expire:true})).data;
  },
  async api(path,{envelope=false,...extra}={}){
   if(Object.keys(extra).length||typeof path!=='string'||!/^\/api\/catalog\/products(?:\/[1-9]\d*)?(?:\?[^#]*)?$/.test(path)||!token||!user)throw problem('Katalog isteği kullanılamıyor.');
   const payload=await request(path,{expire:true});return envelope?payload:payload.data;
  },
  async customers(path,{envelope=false,...extra}={}){
   if(Object.keys(extra).length||typeof path!=='string'||!/^\/api\/(?:customer-cards\?[^#]*|customers\/[1-9]\d*\/card)$/.test(path)||!token||!user)throw problem('Müşteri kartları okunamıyor.');
   const payload=await request(path,{expire:true});return envelope?payload:payload.data;
  },
  async work(path,{method='GET',body,...extra}={}){
   const read=/^\/api\/(?:work-sales\/(?:context|invoices(?:\/[1-9]\d*)?|requests\/[a-f0-9-]{36})|work-collections\/context\?invoiceId=[1-9]\d*)$/;
   const write=/^\/api\/(?:work-sales\/(?:preview|drafts|drafts\/[1-9]\d*\/(?:finalize|cancel))|work-collections(?:\/preview|\/[1-9]\d*\/cancel)?)$/;
   if(Object.keys(extra).length||typeof path!=='string'||!token||!user||!(method==='GET'&&read.test(path)&&body===undefined||method==='POST'&&write.test(path)&&body&&typeof body==='object'&&!Array.isArray(body)))throw problem('İşlem bağlantısı kullanılamıyor.');
   return (await request(path,{method,body,expire:true,workErrors:method==='POST'&&/^\/api\/work-sales\/drafts\/[1-9]\d*\/cancel$/.test(path)})).data;
  },
  async inbound(path,{method='GET',body,...extra}={}){
   const read=/^\/api\/(?:test-daily\/count|work-receiving\/(?:context|home|count-drafts(?:\/[1-9]\d*)?|requests\/[a-f0-9-]{36})|work-purchases\/(?:context|drafts\/[1-9]\d*|fx\/(?:context|drafts\/[1-9]\d*))|work-suppliers\/(?:context|history))$/;
   const write=/^\/api\/(?:test-daily\/count\/(?:draft|approve|reject|cancel)|work-receiving\/(?:count-drafts(?:\/[1-9]\d*\/(?:update|submit|cancel))?|receipts\/[1-9]\d*\/(?:approve|reject))|work-purchases\/(?:preview|drafts(?:\/[1-9]\d*\/(?:finalize|cancel))?|fx\/(?:preview|receipts(?:\/[1-9]\d*\/(?:approve|reject))?|drafts(?:\/[1-9]\d*\/(?:finalize|cancel))?)))$/;
   if(Object.keys(extra).length||typeof path!=='string'||!token||!user||!(method==='GET'&&read.test(path)&&body===undefined||method==='POST'&&write.test(path)&&body&&typeof body==='object'&&!Array.isArray(body)))throw problem('Mal kabulü bağlantısı kullanılamıyor.');
   return (await request(path,{method,body,expire:true,keepForbiddenSession:true,inboundErrors:true})).data;
  },
  async supplierPayments(path,{method='GET',body,...extra}={}){
   const read=/^\/api\/work-supplier-payments\/(?:context|requests\/[a-f0-9-]{36})$/;
   const write=/^\/api\/work-supplier-payments\/(?:preview|payments(?:\/[1-9]\d*\/cancel)?)$/;
   if(Object.keys(extra).length||typeof path!=='string'||!token||!user||!(method==='GET'&&read.test(path)&&body===undefined||method==='POST'&&write.test(path)&&body&&typeof body==='object'&&!Array.isArray(body)))throw problem('Ödeme bağlantısı kullanılamıyor.');
   return (await request(path,{method,body,expire:true,keepForbiddenSession:true,paymentErrors:true})).data;
  },
  async suppliers(path,{envelope=false,...extra}={}){
   if(Object.keys(extra).length||typeof path!=='string'||!/^\/api\/(?:supplier-cards\?[^#]*|suppliers\/[1-9]\d*\/card)$/.test(path)||!token||!user)throw problem('Tedarikçi kartları okunamıyor.');
   const payload=await request(path,{expire:true,keepForbiddenSession:true});return envelope?payload:payload.data;
  },
  async media(path,{signal,...extra}={}){
   if(Object.keys(extra).length||typeof path!=='string'||!/^\/api\/catalog\/products\/[1-9]\d*\/photo\?variant=(?:preview|thumbnail)$/.test(path)||!token||!user||!active||!target()||signal?.aborted)throw problem('Ürün fotoğrafı açılamıyor.');
   const controller=new AbortController(),version=generation,requestToken=token,abort=()=>controller.abort();controllers.add(controller);signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,timeoutMs);
   const current=()=>active&&!controller.signal.aborted&&version===generation&&requestToken===token;
   try{
    const response=await fetchImpl(resolvedApiBase+path,{method:'GET',credentials:'omit',redirect:'error',headers:{Accept:'image/jpeg, image/png, image/webp',Authorization:`Bearer ${requestToken}`},signal:controller.signal});
    if(!current())throw problem('İstek iptal edildi.');
    if(!response.ok){if(response.status===401||response.status===403){clear();if(active)onExpired();}throw problem(response.status===401?'Oturumunuz sona erdi. Yeniden giriş yapın.':response.status===403?'Ürün fotoğrafını görüntüleme yetkiniz yok.':'Ürün fotoğrafı şu anda açılamıyor.',response.status);}
    const type=response.headers?.get('Content-Type')?.split(';')[0].trim().toLowerCase();
    if(!['image/jpeg','image/png','image/webp'].includes(type))throw problem('Ürün fotoğrafı açılamıyor.');
    const blob=await response.blob();if(!current())throw problem('İstek iptal edildi.');
    if(!blob||blob.size<1||blob.size>8*1024*1024||blob.type.toLowerCase()!==type)throw problem('Ürün fotoğrafı açılamıyor.');return blob;
   }catch(error){if(error?.status)throw error;throw problem('Ürün fotoğrafı açılamıyor.');}finally{clearTimeout(timer);controllers.delete(controller);signal?.removeEventListener('abort',abort);}
  },
  dispose(){active=false;generation++;controllers.forEach(c=>c.abort());controllers.clear();user=null;token=null;},
 };
}
