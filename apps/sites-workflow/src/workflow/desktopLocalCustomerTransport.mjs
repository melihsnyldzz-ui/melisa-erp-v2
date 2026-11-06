// SOURCE ONLY. The caller owns session verification and durable request state.
// No listener or request starts until the returned function is explicitly called.
const origin='http://127.0.0.1:5294';
const endpoint='http://127.0.0.1:4294/api/desktop-local/customers';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const jwt=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const keys=['requestId','customerCode','name','phone','customerType','currency','city','country'];
const fail=()=>{throw Object.assign(new Error('CUSTOMER_TRANSPORT_UNAVAILABLE'),{code:'CUSTOMER_TRANSPORT_UNAVAILABLE'});};
function snapshot(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))fail();
 const d=Object.getOwnPropertyDescriptors(input),own=Reflect.ownKeys(input);
 if(own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k))||keys.some(k=>!d[k]||!d[k].enumerable||!Object.hasOwn(d[k],'value')))fail();
 const body=Object.fromEntries(keys.map(k=>[k,d[k].value]));
 if(typeof body.requestId!=='string'||!uuid.test(body.requestId)||keys.slice(1,6).some(k=>typeof body[k]!=='string')||
  !['city','country'].every(k=>body[k]===null||typeof body[k]==='string'))fail();
 const json=JSON.stringify(body);if(json.length>4096)fail();return {json,requestId:body.requestId,currency:body.currency};
}
function exact(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))&&
 Object.keys(value).sort().join(',')===[...keys].sort().join(',')&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(value,k);return d&&d.enumerable&&Object.hasOwn(d,'value');});}
function storedId(value){return typeof value==='string'&&/^[1-9]\d{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n;}
function entityValid(value,currency){
 if(!exact(value,['kind','id','entityId','selectedCurrency','accounts'])||value.kind!=='local'||!storedId(value.id)||!storedId(value.entityId)||value.selectedCurrency!==currency||!Array.isArray(value.accounts)||value.accounts.length!==1)return false;
 const a=value.accounts[0];return exact(a,['id','customerId','currency','currentBalanceExact8'])&&storedId(a.id)&&a.customerId===value.id&&a.currency===currency&&a.currentBalanceExact8==='0.00000000';
}
export function createDesktopLocalCustomerTransport({location,fetch:fetchImpl,tokenProvider}={}){
 if(!location||location.origin!==origin||typeof fetchImpl!=='function'||typeof tokenProvider!=='function')fail();
 return async input=>{
  try{
   // Snapshot before awaiting credentials so the UUID/body cannot drift.
   if(location.origin!==origin)fail();const {json,requestId,currency}=snapshot(input);
   const token=await tokenProvider();if(location.origin!==origin||typeof token!=='string'||token.length>4096||!jwt.test(token))fail();
   const response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
    credentials:'omit',redirect:'error',body:json,signal:AbortSignal.timeout(15000)});
   if(!response||![200,201].includes(response.status)||response.ok!==true||typeof response.json!=='function')fail();
   const envelope=await response.json(),data=envelope?.data;
   if(envelope?.success!==true||!data||data.state!=='COMMITTED'||data.requestId!==requestId||data.operation!=='customer.create'||typeof data.replayed!=='boolean'||response.status!==(data.replayed?200:201)||!entityValid(data.entity,currency))fail();
   return data;
  }catch{fail();}
 };
}
export const DESKTOP_LOCAL_CUSTOMER_TRANSPORT_LIMITS=Object.freeze({sourceOnly:true,realEndpointVerified:false,requiresNormalSession:true,
 requiresCallerToKeepUnknownRequest:true,fullEntityValidationInCallerAlsoRequired:true,logsCredentials:false});
