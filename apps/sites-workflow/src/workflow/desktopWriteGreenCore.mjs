// Source-only entry model for the dedicated v2 app. The server remains the
// authority; the UI permission checks only control visibility and dispatch.
import {createDesktopCustomerCreate} from './desktopCustomerCreate.mjs';
import {createDesktopProductCreate} from './desktopProductCreate.mjs';
import {createDesktopSupplierCreate} from './desktopSupplierCreate.mjs';
import {createDesktopLocalSupplierTransport} from './desktopLocalSupplierTransport.mjs';
import {createDesktopLocalCustomerTransport} from './desktopLocalCustomerTransport.mjs';
import {createDesktopLocalProductTransport} from './desktopLocalProductTransport.mjs';
import {createDesktopWorkflowClient} from './desktopWorkflowClient.mjs';
const API='http://127.0.0.1:4294',ORIGIN='http://127.0.0.1:5294',KEY='melisaDesktopWriteV2Token';
const fail=()=>{throw Error('Yerel işlem doğrulanamadı.');};
const actorId=v=>{if(typeof v==='number'&&Number.isSafeInteger(v))v=String(v);return typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n?v:null;};
const kinds=Object.freeze({products:{view:'product.view',edit:'product.edit'},customers:{view:'customer.view',edit:'customer.edit'},suppliers:{view:'supplier.view',edit:'supplier.edit'},sales:{view:'sales.view'},receipts:{view:'sales.view'}});
function validUser(u){return !!(u&&actorId(u.id)&&typeof u.username==='string'&&Array.isArray(u.permissions)&&u.permissions.every(p=>typeof p==='string'));}
export function createDesktopWriteGreenCore({location,fetch:fetchImpl,sessionStorage,localStorage,locks,newId,richCards=false}={}){
 if(location?.origin!==ORIGIN||typeof fetchImpl!=='function'||!sessionStorage||!localStorage||typeof locks?.request!=='function'||typeof newId!=='function')fail();
 let token=sessionStorage.getItem(KEY),user=null,generation=0;
 async function request(path,{method='GET',body,credential=token}={}){
  if(location.origin!==ORIGIN)fail();
  const r=await fetchImpl(API+path,{method,headers:{'Content-Type':'application/json',...(credential?{Authorization:`Bearer ${credential}`}:{})},credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000),...(body?{body:JSON.stringify(body)}:{})});
  const value=await r.json();if(!r.ok||value?.success!==true)fail();return value;
 }
 function clear(){generation++;token=null;user=null;sessionStorage.removeItem(KEY);}
 function acceptUser(value){if(!validUser(value))fail();user=value;return user;}
 function can(kind,operation='view'){return !!user&&typeof kinds[kind]?.[operation]==='string'&&user.permissions.includes(kinds[kind][operation]);}
 async function login(username,password){const prior=++generation;const response=await request('/api/auth/login',{method:'POST',body:{username,password},credential:null});
  if(prior!==generation||typeof response.data?.accessToken!=='string'||!validUser(response.data.user))fail();
  token=response.data.accessToken;sessionStorage.setItem(KEY,token);return acceptUser(response.data.user);
 }
 async function restore(){if(!token)return null;const prior=generation;try{const r=await request('/api/auth/me');if(prior!==generation)fail();return acceptUser(r.data);}catch{if(prior===generation)clear();return null;}}
 async function logout(){const old=token;clear();if(old)try{await request('/api/auth/logout',{method:'POST',credential:old});}catch{/* local token remains cleared */}}
 async function list(kind,page=1,search=''){if(!can(kind)||!Number.isInteger(page)||page<1||page>100000||typeof search!=='string'||search.length>100||/[\u0000-\u001f\u007f]/.test(search))fail();const prior=generation;
  const r=await request(`/api/${kind}?page=${page}&limit=100${search?'&search='+encodeURIComponent(search):''}`);if(prior!==generation||!can(kind)||!Array.isArray(r.data)||!r.meta||r.meta.page!==page||!Number.isSafeInteger(r.meta.total)||typeof r.meta.hasNextPage!=='boolean')fail();return {data:r.data,meta:r.meta};}
 function create(kind){if(!can(kind,'edit'))fail();const id=actorId(user.id),prior=generation,permission=kinds[kind].edit;
  const tokenProvider=async()=>{if(prior!==generation||!user||actorId(user.id)!==id||!user.permissions.includes(permission)||!token)fail();return token;};
  const submit=kind==='customers'?createDesktopLocalCustomerTransport({location,fetch:fetchImpl,tokenProvider}):kind==='suppliers'?createDesktopLocalSupplierTransport({location,fetch:fetchImpl,tokenProvider}):createDesktopLocalProductTransport({location,fetch:fetchImpl,tokenProvider});
  const options={actorId:id,storage:localStorage,locks,newId,submit,richCards},controller=kind==='customers'?createDesktopCustomerCreate(options):kind==='suppliers'?createDesktopSupplierCreate(options):createDesktopProductCreate(options);
  const current=()=>{if(prior!==generation||!user||actorId(user.id)!==id||!user.permissions.includes(permission)||!token)fail();};
  return Object.freeze({pending:()=>{current();return controller.pending();},create:async fields=>{current();if(richCards&&kind==='products'&&!user.permissions.includes('supplier.view'))fail();if(kind==='suppliers'&&!user.permissions.includes('supplier.view'))fail();return controller.create(fields);},retry:async()=>{current();return controller.retry();}});
 }
 function sale(){
  if(!can('sales'))fail();const actor=actorId(user.id),prior=generation;
  const current=()=>{if(prior!==generation||!user||actorId(user.id)!==actor||!can('sales')||!token)fail();};
  const controller=createDesktopWorkflowClient({actorId:actor,storage:localStorage,locks,newId,submit:async(kind,body)=>{
   if(kind==='resolve'){current();const result=await request('/api/desktop-sale/resolve',{method:'POST',body});current();return result.data;}
   current();const needed=kind==='transition'?{PREPARE:'sales.create',SAVE_CARTONS:'sales.edit',READY:'sales.edit',CHECK:'sales.finalize',CANCEL:'sales.edit'}[body.operation]:'sales.finalize';if(!needed||!user.permissions.includes(needed)||kind!=='transition'&&!user.permissions.includes('sales.create'))fail();
   const path=kind==='draft'?'/api/desktop-sale/drafts':`/api/desktop-sale/workflows/${body.invoiceId}/${kind==='dispatch'?'dispatch':'transitions'}`;
   const result=await request(path,{method:'POST',body});current();return result.data;
  }});
  return Object.freeze({pending:()=>{current();return controller.pending();},create:async(kind,payload)=>{current();return controller.create(kind,payload);},retry:async()=>{current();return controller.retry();},resolve:async()=>{current();return controller.resolve();},
   preview:async input=>{current();if(!Array.isArray(input.productIds)||input.productIds.length!==2)fail();const query=new URLSearchParams({customerId:input.customerId,documentDate:input.documentDate,productIds:input.productIds.join(',')});const result=await request('/api/desktop-sale/draft-preview?'+query);current();return result.data;},
   read:async invoiceId=>{current();if(!actorId(invoiceId))fail();const result=await request('/api/desktop-sale/workflows/'+invoiceId);current();if(result.data?.invoiceId!==invoiceId)fail();return result.data;}
  });
 }
 return Object.freeze({login,restore,logout,list,can,create,sale,getUser:()=>user});
}
