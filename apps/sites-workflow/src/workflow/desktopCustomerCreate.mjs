// Source-only customer-create client. The caller supplies the authenticated
// transport, origin-shared durable storage and Web Locks; this module opens no
// connection by itself. Per-tab sessionStorage is insufficient for this contract.
const env='eb2888c2-51cb-4570-a933-397cf7e62806';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const types=new Set(['customer','wholesale','retail','mixed']);
const fail=()=>{throw new Error('CUSTOMER_CREATE_INVALID');};
function text(v,max){if(typeof v!=='string'||!v||v.trim()!==v||v.length>max||/[\u0000-\u001f\u007f]/.test(v))fail();return v;}
function optionalText(value){if(value===null||value==='')return null;if(typeof value!=='string'||/[\u0000-\u001f\u007f]/.test(value))fail();const trimmed=value.trim();if(!trimmed)return null;if(trimmed.length>100)fail();return trimmed;}
function body(input,requestId){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='city,country,currency,customerCode,customerType,name,phone')fail();
 if(!uuid.test(requestId)||!types.has(input.customerType)||typeof input.currency!=='string'||!/^[A-Z]{3}$/.test(input.currency))fail();
 return Object.freeze({requestId,customerCode:text(input.customerCode,50),name:text(input.name,250),phone:text(input.phone,40),customerType:input.customerType,currency:input.currency,city:optionalText(input.city),country:optionalText(input.country)});
}
function validated(record,actorId){
 if(!record||typeof record!=='object'||Object.keys(record).sort().join(',')!=='actorId,body,version'||record.version!==1||record.actorId!==actorId)fail();
 const p=record.body;if(!p||typeof p!=='object'||Object.keys(p).sort().join(',')!=='city,country,currency,customerCode,customerType,name,phone,requestId')fail();
 const {requestId,...fields}=p;return body(fields,requestId);
}
function persistedCustomer(value,currency){
 const exact=(object,keys)=>object&&typeof object==='object'&&!Array.isArray(object)&&
  [Object.prototype,null].includes(Object.getPrototypeOf(object))&&Object.keys(object).sort().join(',')===[...keys].sort().join(',')&&
  keys.every(key=>{const d=Object.getOwnPropertyDescriptor(object,key);return d&&d.enumerable&&Object.hasOwn(d,'value');});
 const validId=value=>typeof value==='string'&&/^[1-9]\d{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n;
 if(!exact(value,['kind','id','entityId','selectedCurrency','accounts'])||value.kind!=='local'||!validId(value.id)||!validId(value.entityId)||value.selectedCurrency!==currency||!Array.isArray(value.accounts)||value.accounts.length!==1)return false;
 const account=value.accounts[0];return exact(account,['id','customerId','currency','currentBalanceExact8'])&&validId(account.id)&&account.customerId===value.id&&account.currency===currency&&account.currentBalanceExact8==='0.00000000';
}
export function createDesktopCustomerCreate({actorId,storage,submit,newId,locks}={}){
 if(typeof actorId!=='string'||!/^[1-9]\d{0,18}$/.test(actorId)||BigInt(actorId)>9223372036854775807n||!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function'||typeof storage.removeItem!=='function'||typeof submit!=='function'||typeof newId!=='function'||!locks||typeof locks.request!=='function')fail();
 const key=`melisa-desktop-customer-create:${env}:${actorId}`;let running=false;
 function read(){const raw=storage.getItem(key);if(raw===null)return null;if(typeof raw!=='string'||raw.length>4096)fail();let record;try{record=JSON.parse(raw);}catch{fail();}return validated(record,actorId);}
 async function send(p){
  {
   let result;try{result=await submit({...p});}catch{return Object.freeze({state:'UNKNOWN',requestId:p.requestId});}
   if(!result||result.state!=='COMMITTED'||result.requestId!==p.requestId||result.operation!=='customer.create'||!persistedCustomer(result.entity,p.currency))return Object.freeze({state:'UNKNOWN',requestId:p.requestId});
   // Do not erase a different/new pending request on unexpected concurrent change.
   const stored=read();if(!stored||JSON.stringify(stored)!==JSON.stringify(p))return Object.freeze({state:'UNKNOWN',requestId:p.requestId});
   storage.removeItem(key);return Object.freeze({state:'COMMITTED',requestId:p.requestId,entity:result.entity,replayed:result.replayed===true});
  }
 }
 async function exclusive(work){if(running)throw new Error('CUSTOMER_CREATE_BUSY');running=true;
  try{return await locks.request(key,{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock)throw new Error('CUSTOMER_CREATE_BUSY');return work();});}
  finally{running=false;}}
 return Object.freeze({
  pending:()=>read(),
  async create(fields){return exclusive(async()=>{if(read())throw new Error('CUSTOMER_CREATE_PENDING');const p=body(fields,newId());
   // Persistence must finish before the first network dispatch. Never retry a
   // failed write to storage using a new identifier in the same invocation.
   storage.setItem(key,JSON.stringify({version:1,actorId,body:p}));if(JSON.stringify(read())!==JSON.stringify(p))fail();return send(p);});},
  async retry(){return exclusive(async()=>{const p=read();if(!p)throw new Error('CUSTOMER_CREATE_NO_PENDING');return send(p);});}
 });
}
export const DESKTOP_CUSTOMER_CREATE_LIMITS=Object.freeze({sourceOnly:true,routeIntegrated:false,writePermissionRequired:'customer.edit',
 storageContainsCustomerFields:true,requiresTrustedOriginAndStorage:true,requiresOriginSharedStorage:true,requiresWebLocks:true,realSqlVerified:false});

// Integrators mount this only after checking current customer.edit authority.
// No legacy form, demo store or route is loaded; no success is fabricated.
export function mountDesktopCustomerCreate({root,controller,onCommitted=()=>{}}={}){
 if(!root||typeof root.querySelector!=='function'||!controller||typeof controller.pending!=='function'||typeof controller.create!=='function'||typeof controller.retry!=='function'||typeof onCommitted!=='function')fail();
 let disposed=false,busy=false;
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function paint(message=''){
  if(disposed)return;let pending;try{pending=controller.pending();}catch{root.innerHTML='<p role="alert">Bekleyen işlem okunamadı. Yeni kayıt başlatılmadı.</p>';return;}
  if(pending){root.innerHTML=`<section class="card panel" style="padding:20px"><h2>Müşteri kaydı doğrulanıyor</h2><p>${escape(pending.customerCode)} kodlu kaydın sonucu henüz kesin değil. Aynı istekle yeniden doğrulayın.</p><button type="button" data-customer-retry ${busy?'disabled':''}>Kaydı doğrula</button><p role="status">${escape(message)}</p></section>`;
   root.querySelector('[data-customer-retry]').addEventListener('click',()=>act(()=>controller.retry()));return;}
  root.innerHTML=`<section class="card panel" style="padding:20px"><h2>Yeni müşteri kartı</h2><form data-customer-form><label>Müşteri kodu <input name="customerCode" maxlength="50" required></label><label>Cari adı <input name="name" maxlength="250" required></label><label>Telefon <input name="phone" maxlength="40" required></label><label>Şehir <input name="city" maxlength="100" required></label><label>Ülke <input name="country" maxlength="100" required></label><label>Para birimi <select name="currency"><option>TRY</option><option>USD</option><option>EUR</option></select></label><label>Müşteri türü <select name="customerType"><option value="customer">Müşteri</option><option value="wholesale">Toptan</option><option value="retail">Perakende</option><option value="mixed">Karma</option></select></label><button type="submit" ${busy?'disabled':''}>Kaydet</button><p role="status">${escape(message)}</p></form></section>`;
  root.querySelector('[data-customer-form]').addEventListener('submit',event=>{event.preventDefault();if(busy)return;const data=new FormData(event.currentTarget);const fields=Object.fromEntries(['customerCode','name','phone','currency','customerType','city','country'].map(k=>[k,data.get(k)]));if(!String(fields.city??'').trim()||!String(fields.country??'').trim()){root.querySelector('[role="status"]').textContent='Şehir ve ülke gerekli.';return;}void act(()=>controller.create(fields));});
 }
 async function act(action){if(busy||disposed)return;busy=true;try{const result=await action();if(disposed)return;if(result.state==='COMMITTED'){try{onCommitted(result);paint('Müşteri kaydı tamamlandı.');}catch{paint('Müşteri kaydedildi; liste yenilenemedi.');}}else paint('Sonuç henüz doğrulanamadı.');}catch{if(!disposed){try{if(controller.pending())paint('Kayıt doğrulanamadı.');else {const status=root.querySelector('[role="status"]');if(status)status.textContent='Kayıt başlatılamadı; alanları kontrol edin.';}}catch{paint();}}}finally{busy=false;if(!disposed){const button=root.querySelector('button[type="submit"], [data-customer-retry]');if(button)button.disabled=false;}}}
 paint();return Object.freeze({dispose(){disposed=true;}});
}
