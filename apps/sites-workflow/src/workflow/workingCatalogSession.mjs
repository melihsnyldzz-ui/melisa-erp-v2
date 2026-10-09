import {createBusinessSupplierSelection} from './businessSupplierSelection.mjs';
import {shouldAutoOpenTestAdmin,testSessionModeKey,resolveTestApiBase,isTestSessionTarget} from './testAdminSession.mjs';
import {validateOperationCopyBootstrap} from './isolatedOperationCopyModel.mjs';
export const workingCatalogTokenKey='melisaTestSalesAccessToken';
const problem=(message='ERP bağlantısı kurulamadı. Yeniden deneyin.',status=503)=>Object.assign(new Error(message),{status});
function validUser(user){
 if(!user||!Number.isSafeInteger(user.id)||user.id<1||!Array.isArray(user.permissions)||user.permissions.some(p=>typeof p!=='string'))throw problem('Oturum bilgileri doğrulanamadı.');
 return user;
}
export function workingCatalogUserLabel(user){if((globalThis.window?.location??globalThis.location)?.port==='5234'&&((String(user?.id)==='15'&&user?.role?.code==='isolated_test_sales')||(String(user?.id)==='16'&&user?.role?.code==='isolated_test_ilker')))return String(user.id)==='15'?'TEST Personel (15)':'TEST İlker rolü (16)';return user?.role?.code==='admin'?'Yönetici':typeof user?.displayName==='string'?user.displayName.replace(/TEST|DEMO|DEBUG/gi,'').trim()||'Kullanıcı':'Kullanıcı';}
export function createWorkingCatalogSession({location,apiBase,storage,fetchImpl=globalThis.fetch,onExpired=()=>{},timeoutMs=15000,copyProfile=globalThis.window?.__MELISA_OPERATION_COPY__}={}){
 const resolvedApiBase=resolveTestApiBase({location,apiBase});
 let active=true,token=null,user=null,generation=0,switching=false;const controllers=new Set();
 const target=()=>isTestSessionTarget({location,apiBase});
 const stored=key=>{try{return storage?.getItem(key);}catch{return null;}};
 const save=(key,value)=>{try{value===null?storage?.removeItem(key):storage?.setItem(key,value);}catch{throw problem('Oturum saklanamadı.');}};
 const clear=({force=false}={})=>{const previous=token;generation++;controllers.forEach(c=>c.abort());token=null;user=null;try{if(force||previous!==null&&stored(workingCatalogTokenKey)===previous)storage?.removeItem(workingCatalogTokenKey);}catch{}};
 async function request(path,{method='GET',body,expire=false,workErrors=false,keepForbiddenSession=false,inboundErrors=false,paymentErrors=false,startupAuth=false,headers={}}={}){
  if(!active)throw problem('İstek iptal edildi.');if(!target())throw problem('Bu çalışma bağlantısı kullanılamıyor.');
  const controller=new AbortController(),version=generation,requestToken=token;controllers.add(controller);const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetchImpl(resolvedApiBase+path,{method,credentials:'omit',redirect:'error',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}) ,...headers},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
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
  async selectCopyActor(actorId){
   const profile=validateOperationCopyBootstrap(copyProfile,location),selected=profile.actors.find(a=>a.id===actorId);
   const copyBase=location?.port==='5234'?`http://${location.hostname==='192.168.1.46'?'192.168.1.46':'127.0.0.1'}:4184`:location?.port==='5224'?`http://${location.hostname==='192.168.1.46'?'192.168.1.46':'127.0.0.1'}:4174`:'http://127.0.0.1:4154';
   if(!active||!token||!user||switching||resolvedApiBase!==copyBase||!['15','16'].includes(actorId)||!selected||stored(workingCatalogTokenKey)!==token)throw problem('Kullanıcı geçişi yapılamıyor.');
   if(String(user.id)===actorId&&user.role?.code===selected.role)return user;
   switching=true;generation++;controllers.forEach(c=>c.abort());const previous=token,version=generation;
   try{
    const payload=await request('/api/auth/stage4-actor',{method:'POST',body:{actorId,copyId:profile.copyId,sealHash:profile.sealHash},startupAuth:true});
    const next=validUser(payload?.data?.user);
    if(!active||version!==generation||token!==previous||stored(workingCatalogTokenKey)!==previous||String(next.id)!==actorId||next.role?.code!==selected.role||payload.meta?.operationOrigin!==profile.operationOrigin||payload.meta?.copyId!==profile.copyId||payload.meta?.sealHash!==profile.sealHash)throw problem('Kullanıcı oturumu doğrulanamadı.');
    const nextToken=payload.data.accessToken;if(typeof nextToken!=='string'||!nextToken.length)throw problem('Oturum doğrulanamadı.');
    save(workingCatalogTokenKey,nextToken);token=nextToken;user=next;return user;
   }finally{switching=false;}
  },
  async home(...args){
   if(args.length||!token||!user)throw problem('Günlük işler okunamıyor.');
   return (await request('/api/home/summary',{expire:true})).data;
  },
  async reports(path,...args){
   if(args.length||typeof path!=='string'||!/^\/api\/work-reports(?:\/(?:context|export))?(?:\?[^#]*)?$/.test(path)||!token||!user)throw problem('Rapor bağlantısı kullanılamıyor.');
   return (await request(path,{expire:true,keepForbiddenSession:true})).data;
  },
  async system(path,...args){
   if(args.length||path!=='/api/work-system/summary'||!token||!user)throw problem('Sistem durumu okunamıyor.');
   return (await request(path,{expire:true,keepForbiddenSession:true})).data;
  },
  async api(path,{envelope=false,...extra}={}){
   const referenceRead=typeof path==='string'&&/^\/api\/products\/[1-9]\d{0,18}\/purchase-reference$/.test(path);
   if(Object.keys(extra).length||typeof path!=='string'||!(/^\/api\/catalog\/products(?:\/[1-9]\d*)?(?:\?[^#]*)?$/.test(path)||referenceRead)||!token||!user||referenceRead&&!['product.view','purchase.view','finance.view'].every(p=>user.permissions.includes(p)))throw problem('Katalog isteği kullanılamıyor.');
   const payload=await request(path,{expire:true,keepForbiddenSession:referenceRead});return envelope?payload:payload.data;
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
   const read=/^\/api\/(?:test-daily\/(?:count|purchase)|work-receiving\/(?:context|home|count-drafts(?:\/[1-9]\d*)?|requests\/[a-f0-9-]{36})|work-purchases\/(?:context|drafts\/[1-9]\d*|fx\/(?:context|drafts\/[1-9]\d*))|work-suppliers\/(?:context|history))$/;
   const write=/^\/api\/(?:test-daily\/(?:count\/(?:draft|approve|reject|cancel)|purchase\/(?:draft|approve|reject|cancel))|work-receiving\/(?:count-drafts(?:\/[1-9]\d*\/(?:update|submit|cancel))?|receipts\/[1-9]\d*\/(?:approve|reject))|work-purchases\/(?:preview|drafts(?:\/[1-9]\d*\/(?:finalize|cancel))?|fx\/(?:preview|receipts(?:\/[1-9]\d*\/(?:approve|reject))?|drafts(?:\/[1-9]\d*\/(?:finalize|cancel))?)))$/;
   if(Object.keys(extra).length||typeof path!=='string'||!token||!user||!(method==='GET'&&read.test(path)&&body===undefined||method==='POST'&&write.test(path)&&body&&typeof body==='object'&&!Array.isArray(body)))throw problem('Mal kabulü bağlantısı kullanılamıyor.');
   return (await request(path,{method,body,expire:true,keepForbiddenSession:true,inboundErrors:true,headers:createBusinessSupplierSelection({storage,userId:user.id,profile:copyProfile,location})?.headers()??{}})).data;
  },
  businessSupplierSelection(){
   if(!active||!token||!user)throw problem('Tedarikçi seçimi için oturum gerekli.');
   return createBusinessSupplierSelection({storage,userId:user.id,profile:copyProfile,location});
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
