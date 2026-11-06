// Source-only entry model for the dedicated v2 app. The server remains the
// authority; the UI permission checks only control visibility and dispatch.
import {createDesktopCustomerCreate} from './desktopCustomerCreate.mjs';
import {createDesktopProductCreate} from './desktopProductCreate.mjs';
import {desktopProductCardId,isDesktopProductCard} from '../../../../packages/shared/src/desktopProductCard.mjs';
import {isDesktopStockAvailability} from '../../../../packages/shared/src/desktopStockAvailability.mjs';
import {desktopCustomerCardId,isDesktopCustomerCard} from '../../../../packages/shared/src/desktopCustomerCard.mjs';
import {isDesktopRuntimeInfo} from '../../../../packages/shared/src/desktopRuntimeInfo.mjs';
import {desktopCompanyRateDate,isDesktopCompanyRates} from '../../../../packages/shared/src/desktopCompanyRates.mjs';
import {desktopSaleCurrencySelection} from '../../../../packages/shared/src/desktopSaleCurrencySelection.mjs';
import {desktopCurrencySettlementParity} from '../../../api/src/services/desktopCurrencySettlementParity.mjs';
import {isDesktopBarcode,isDesktopBarcodeLookup} from '../../../../packages/shared/src/desktopBarcodeLookup.mjs';
import {createDesktopSupplierCreate} from './desktopSupplierCreate.mjs';
import {createDesktopCustomerAccountCreate,createDesktopCustomerAccountTransport} from './desktopCustomerAccountCreate.mjs';
import {createDesktopLocalSupplierTransport} from './desktopLocalSupplierTransport.mjs';
import {createDesktopLocalCustomerTransport} from './desktopLocalCustomerTransport.mjs';
import {createDesktopLocalProductTransport} from './desktopLocalProductTransport.mjs';
import {createDesktopWorkflowClient} from './desktopWorkflowClient.mjs';
const API='http://127.0.0.1:4294',ORIGIN='http://127.0.0.1:5294',KEY='melisaDesktopWriteV2Token';
const fail=()=>{throw Error('Yerel işlem doğrulanamadı.');};
const actorId=v=>{if(typeof v==='number'&&Number.isSafeInteger(v))v=String(v);return typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n?v:null;};
const kinds=Object.freeze({products:{view:'product.view',edit:'product.edit'},customers:{view:'customer.view',edit:'customer.edit'},suppliers:{view:'supplier.view',edit:'supplier.edit'},sales:{view:'sales.view'},receipts:{view:'sales.view'}});
function validUser(u){return !!(u&&actorId(u.id)&&typeof u.username==='string'&&Array.isArray(u.permissions)&&u.permissions.every(p=>typeof p==='string'));}
function validateCurrencyAmounts(value,selection){if(value?.currency!==selection.documentCurrency)fail();const s=desktopCurrencySettlementParity({documentAmountExact4:value.totalExact4,documentCurrency:value.currency,accountCurrency:value.accountCurrency,documentRateToTryExact8:selection.documentRateExact8,accountRateToTryExact8:selection.accountRateExact8});if(value.accountAmountExact4!==s.accountAmountExact4||value.amountTryExact4!==s.amountTryExact4)fail();}
export function createDesktopWriteGreenCore({location,fetch:fetchImpl,sessionStorage,localStorage,locks,newId,richCards=false}={}){
 if(location?.origin!==ORIGIN||typeof fetchImpl!=='function'||!sessionStorage||!localStorage||typeof locks?.request!=='function'||typeof newId!=='function')fail();
 let token=sessionStorage.getItem(KEY),user=null,generation=0;
 async function request(path,{method='GET',body,credential=token}={}){
  if(location.origin!==ORIGIN)fail();
  const r=await fetchImpl(API+path,{method,headers:{'Content-Type':'application/json',...(credential?{Authorization:`Bearer ${credential}`}:{})},credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000),...(body?{body:JSON.stringify(body)}:{})});
  const value=await r.json();if(!r.ok||value?.success!==true){if(path.startsWith('/api/desktop-product-barcode?')&&r.status===404&&value?.code==='DESKTOP_BARCODE_NOT_FOUND')throw Error('Barkodla eşleşen aktif ürün bulunamadı.');if(path.startsWith('/api/desktop-product-barcode?')&&r.status===409&&value?.code==='DESKTOP_BARCODE_AMBIGUOUS')throw Error('Barkod birden fazla ürüne ait. Ürün kartlarını kontrol edin.');if(r.status===403&&path.startsWith('/api/desktop-sale/draft-preview?')&&value?.code==='DESKTOP_SALE_DISCOUNT_APPROVAL_REQUIRED')throw Error('İskonto yetki sınırınızı aşıyor. Yetkili onayı gerekiyor.');if(r.status===409&&path.startsWith('/api/desktop-sale/draft-preview?')&&value?.code==='DESKTOP_COMPANY_RATE_CHANGED')throw Error('Şirket kuru değişti. Kurları yeniden doldurup önizlemeyi hesaplayın.');if(r.status===409&&path.startsWith('/api/desktop-sale/draft-preview?')&&value?.code==='DESKTOP_SALE_PRICE_REQUIRED')throw Error('Seçili ürünlerden birinin bu para biriminde satış fiyatı tanımlı değil. Ürün fiyatını tanımlayıp yeniden kontrol edin.');if(r.status===409&&path.startsWith('/api/desktop-sale/draft-preview?')&&value?.code==='DESKTOP_COMPANY_RATE_REQUIRED')throw Error('Bu tarih için şirket kuru yok. İşlem kurunu açıkça girin.');fail();}return value;
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
  const r=await request(`/api/${kind}?page=${page}&limit=100${search?'&search='+encodeURIComponent(search):''}`);if(prior!==generation||!can(kind)||!Array.isArray(r.data)||!r.meta||r.meta.page!==page||!Number.isSafeInteger(r.meta.total)||typeof r.meta.hasNextPage!=='boolean'||richCards&&kind==='products'&&r.data.some(row=>!isDesktopStockAvailability(row)))fail();return {data:r.data,meta:r.meta};}
 function create(kind){if(!can(kind,'edit'))fail();const id=actorId(user.id),prior=generation,permission=kinds[kind].edit;
  const tokenProvider=async()=>{if(prior!==generation||!user||actorId(user.id)!==id||!user.permissions.includes(permission)||!token)fail();return token;};
  const submit=kind==='customers'?createDesktopLocalCustomerTransport({location,fetch:fetchImpl,tokenProvider}):kind==='suppliers'?createDesktopLocalSupplierTransport({location,fetch:fetchImpl,tokenProvider}):createDesktopLocalProductTransport({location,fetch:fetchImpl,tokenProvider});
  const options={actorId:id,storage:localStorage,locks,newId,submit,richCards},controller=kind==='customers'?createDesktopCustomerCreate(options):kind==='suppliers'?createDesktopSupplierCreate(options):createDesktopProductCreate(options);
  const current=()=>{if(prior!==generation||!user||actorId(user.id)!==id||!user.permissions.includes(permission)||!token)fail();};
  return Object.freeze({pending:()=>{current();return controller.pending();},
   ...(kind==='products'?{draft:()=>{current();return controller.draft();},rejected:()=>{current();return controller.rejected();}}:{}),
   create:async fields=>{current();if(richCards&&kind==='products'&&!user.permissions.includes('supplier.view'))fail();if(kind==='suppliers'&&!user.permissions.includes('supplier.view'))fail();return controller.create(fields);},retry:async()=>{current();return controller.retry();}});
 }
 function sale(){
  if(!can('sales'))fail();const actor=actorId(user.id),prior=generation;
  const current=()=>{if(prior!==generation||!user||actorId(user.id)!==actor||!can('sales')||!token)fail();};
  const controller=createDesktopWorkflowClient({actorId:actor,storage:localStorage,locks,newId,submit:async(kind,body)=>{
   if(kind==='resolve'){current();const result=await request('/api/desktop-sale/resolve',{method:'POST',body});current();return result.data;}
   current();const needed=kind==='cancel'?'sales.cancel':kind==='transition'?{PREPARE:'sales.create',SAVE_CARTONS:'sales.edit',READY:'sales.edit',CHECK:'sales.finalize',CANCEL:'sales.edit'}[body.operation]:'sales.finalize';if(!needed||!user.permissions.includes(needed)||!['transition','cancel'].includes(kind)&&!user.permissions.includes('sales.create'))fail();
   const path=kind==='draft'?'/api/desktop-sale/drafts':`/api/desktop-sale/workflows/${body.invoiceId}/${kind==='dispatch'?'dispatch':kind==='cancel'?'cancel-final':'transitions'}`;
   const result=await request(path,{method:'POST',body});current();return result.data;
  }});
  return Object.freeze({pending:()=>{current();return controller.pending();},create:async(kind,payload)=>{current();if(kind==='cancel'&&!user.permissions.includes('sales.cancel'))fail();return controller.create(kind,payload);},retry:async()=>{current();return controller.retry();},resolve:async()=>{current();return controller.resolve();},
   preview:async input=>{current();if(!Array.isArray(input.productIds)||input.productIds.length!==2)fail();const quote=Object.hasOwn(input,'discountRateExact4');if(quote&&(![input.quantities,input.quantityUnits].every(v=>Array.isArray(v)&&v.length===2&&v.every(s=>typeof s==='string'&&!s.includes(',')))||typeof input.discountRateExact4!=='string'))fail();const fx=Object.hasOwn(input,'currencySelection'),selection=fx?desktopSaleCurrencySelection(input.currencySelection):null;if(fx&&!quote)fail();const query=new URLSearchParams({customerId:input.customerId,documentDate:input.documentDate,productIds:input.productIds.join(','),...(quote?{quantities:input.quantities.join(','),quantityUnits:input.quantityUnits.join(','),discountRateExact4:input.discountRateExact4}:{}),...(fx?{currencySelection:JSON.stringify(selection)}:{})});const result=await request('/api/desktop-sale/draft-preview?'+query);current();if(fx){if(JSON.stringify(desktopSaleCurrencySelection(result.data?.currencySelection))!==JSON.stringify(selection)||result.data.quote?.accountId!==selection.accountId||result.data.quote?.documentRateExact8!==selection.documentRateExact8||result.data.quote?.accountRateExact8!==selection.accountRateExact8)fail();validateCurrencyAmounts(result.data.quote,selection);}else if(result.data?.currencySelection!==undefined)fail();return result.data;},
   read:async invoiceId=>{current();if(!actorId(invoiceId))fail();const result=await request('/api/desktop-sale/workflows/'+invoiceId);current();if(result.data?.invoiceId!==invoiceId)fail();if(result.data.currencySelection!==undefined){const selection=desktopSaleCurrencySelection(result.data.currencySelection);validateCurrencyAmounts(result.data,selection);}else if(result.data.currency!==undefined&&result.data.currency!=='TRY'||result.data.accountCurrency!==undefined)fail();return result.data;}
  });
 }
 async function productCard(id){
  if(!richCards||!desktopProductCardId(id)||!can('products')||!can('products','edit'))fail();const prior=generation;
  const result=await request('/api/products/'+id);if(prior!==generation||!can('products','edit')||!isDesktopProductCard(result.data,id))fail();return result.data;
 }
 async function customerCard(id){
  if(!richCards||!desktopCustomerCardId(id)||!can('customers'))fail();const prior=generation;
  const result=await request('/api/customers/'+id);if(prior!==generation||!can('customers')||!isDesktopCustomerCard(result.data,id)||result.data.salesHistoryAvailable&&!can('sales'))fail();return result.data;
 }
 async function runtimeInfo(){if(!richCards||!user)fail();const prior=generation,r=await request('/api/desktop-runtime');if(prior!==generation||!user||!isDesktopRuntimeInfo(r.data))fail();return r.data;}
 async function companyRates(date){if(!richCards||!can('sales'))fail();desktopCompanyRateDate(date);const prior=generation,r=await request('/api/desktop-company-rates?date='+encodeURIComponent(date));if(prior!==generation||!can('sales')||!isDesktopCompanyRates(r.data,date))fail();return r.data;}
 async function customerAccount(){
  if(!richCards||!can('customers')||!can('customers','edit'))fail();const actor=actorId(user.id),prior=generation;
  const current=()=>{if(prior!==generation||!user||actorId(user.id)!==actor||!can('customers')||!can('customers','edit')||!token)fail();};
  const info=await runtimeInfo();current();if(!['desktop-master-v4','desktop-master-v5'].includes(info.profile)||![4,5].includes(info.schemaVersion))return null;
  const submit=createDesktopCustomerAccountTransport({location,fetch:fetchImpl,tokenProvider:async()=>{current();return token;}});
  const c=createDesktopCustomerAccountCreate({actorId:actor,storage:localStorage,locks,newId,submit:async command=>{current();const result=await submit(command);current();return result;}});
  return Object.freeze({pending:()=>{current();return c.pending();},create:async fields=>{current();return c.create(fields);},retry:async()=>{current();return c.retry();}});
 }
 async function productBarcode(barcode){if(!richCards||!can('products')||!isDesktopBarcode(barcode))fail();const prior=generation,result=await request('/api/desktop-product-barcode?barcode='+encodeURIComponent(barcode));if(prior!==generation||!can('products')||!isDesktopBarcodeLookup(result.data,barcode))fail();return result.data.product;}
 return Object.freeze({login,restore,logout,list,can,create,sale,productCard,customerCard,runtimeInfo,companyRates,customerAccount,productBarcode,getUser:()=>user});
}
