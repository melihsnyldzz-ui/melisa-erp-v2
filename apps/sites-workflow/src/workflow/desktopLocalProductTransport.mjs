// Source-only product transport. The server verifies the bearer and the caller
// owns the durable request journal. This module does not start any request.
import {isDesktopPersistedProduct} from './desktopProductCreate.mjs';
const origin='http://127.0.0.1:5294',endpoint='http://127.0.0.1:4294/api/desktop-local/products';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const jwt=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const keys=['requestId','stockCode','name','barcode','unit','currency','salePriceExact4','purchasePriceExact4','purchaseDiscountRateExact4','saleTier'];
const optional=['openingQuantityExact3','openingDate'], rich=['brand','category','supplierId'];
const fail=()=>{throw Object.assign(new Error('PRODUCT_TRANSPORT_UNAVAILABLE'),{code:'PRODUCT_TRANSPORT_UNAVAILABLE'});};
function snapshot(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))fail();
 const d=Object.getOwnPropertyDescriptors(input),own=Reflect.ownKeys(input),names=[...keys,...(optional.some(k=>Object.hasOwn(d,k))?optional:[]),...(rich.some(k=>Object.hasOwn(d,k))?rich:[])];
 if(own.length!==names.length||own.some(k=>typeof k!=='string'||!names.includes(k))||names.some(k=>!d[k]||!d[k].enumerable||!Object.hasOwn(d[k],'value')))fail();
 const body=Object.fromEntries(names.map(k=>[k,d[k].value]));
 if([...optional,...rich].some(k=>Object.hasOwn(body,k)&&typeof body[k]!=='string'))fail();
 if(typeof body.requestId!=='string'||!uuid.test(body.requestId)||keys.slice(1,9).some(k=>typeof body[k]!=='string')||
  body.saleTier!==null&&(!Number.isInteger(body.saleTier)||body.saleTier< -2147483648||body.saleTier>2147483647))fail();
 const json=JSON.stringify(body);if(json.length>4096)fail();return {json,body};
}
export function createDesktopLocalProductTransport({location,fetch:fetchImpl,tokenProvider}={}){
 if(!location||location.origin!==origin||typeof fetchImpl!=='function'||typeof tokenProvider!=='function')fail();
 return async input=>{
  try{if(location.origin!==origin)fail();const snap=snapshot(input);const token=await tokenProvider();
   if(location.origin!==origin||typeof token!=='string'||token.length>4096||!jwt.test(token))fail();
   const response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
    credentials:'omit',redirect:'error',body:snap.json,signal:AbortSignal.timeout(15000)});
   if(!response||![200,201].includes(response.status)||response.ok!==true||typeof response.json!=='function')fail();
   const envelope=await response.json(),data=envelope?.data;
   if(envelope?.success!==true||!data||data.state!=='COMMITTED'||data.requestId!==snap.body.requestId||data.operation!=='product.create'||typeof data.replayed!=='boolean'||response.status!==(data.replayed?200:201)||!isDesktopPersistedProduct(data.entity,snap.body))fail();
   return data;
  }catch{fail();}
 };
}
export const DESKTOP_LOCAL_PRODUCT_TRANSPORT_LIMITS=Object.freeze({sourceOnly:true,realEndpointVerified:false,requiresNormalSession:true,
 requiresCallerToKeepUnknownRequest:true,fullEntityValidationInCallerAlsoRequired:true,logsCredentials:false});
