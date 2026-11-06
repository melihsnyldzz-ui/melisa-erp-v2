import {desktopCustomerAccountCommand,isCustomerAccountOutcome,CUSTOMER_ACCOUNT_CURRENCIES} from '../../../../packages/shared/src/desktopCustomerAccount.mjs';
const fail=()=>{throw Error('CUSTOMER_ACCOUNT_CLIENT_INVALID');};
const env='eb2888c2-51cb-4570-a933-397cf7e62806';
export function createDesktopCustomerAccountCreate({actorId,storage,locks,newId,submit}={}){
 if(typeof actorId!=='string'||!/^[1-9]\d{0,18}$/.test(actorId)||BigInt(actorId)>9223372036854775807n||typeof storage?.getItem!=='function'||typeof storage.setItem!=='function'||typeof storage.removeItem!=='function'||typeof locks?.request!=='function'||typeof newId!=='function'||typeof submit!=='function')fail();
 const key=`melisa-desktop-customer-account-v4:${env}:${actorId}`;let busy=false;
 function read(){const raw=storage.getItem(key);if(raw===null)return null;if(typeof raw!=='string'||raw.length>4096)fail();const v=JSON.parse(raw);if(!v||Object.keys(v).sort().join(',')!=='actorId,command,version'||v.version!==1||v.actorId!==actorId)fail();return desktopCustomerAccountCommand(v.command);}
 async function send(c){
  let result;try{result=await submit(c);}catch{return {state:'UNKNOWN',requestId:c.requestId};}
  if(!isCustomerAccountOutcome(result,c)||JSON.stringify(read())!==JSON.stringify(c))return {state:'UNKNOWN',requestId:c.requestId};
  storage.removeItem(key);if(storage.getItem(key)!==null)fail();return result;
 }
 async function exclusive(work){if(busy)fail();busy=true;try{return await locks.request(key,{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock)fail();return work();});}finally{busy=false;}}
 return Object.freeze({pending:read,create:fields=>exclusive(async()=>{
  if(read())fail();if(!fields||Object.keys(fields).sort().join(',')!=='currency,customerCode,customerId,customerName,entityId')fail();const c=desktopCustomerAccountCommand({...fields,requestId:newId()});
  storage.setItem(key,JSON.stringify({version:1,actorId,command:c}));if(JSON.stringify(read())!==JSON.stringify(c))fail();return send(c);
 }),retry:()=>exclusive(async()=>{const c=read();if(!c)fail();return send(c);})});
}
export function createDesktopCustomerAccountTransport({location,fetch:fetchImpl,tokenProvider}={}){
 const origin='http://127.0.0.1:5294';if(location?.origin!==origin||typeof fetchImpl!=='function'||typeof tokenProvider!=='function')fail();
 return async input=>{
  const c=desktopCustomerAccountCommand(input),body=JSON.stringify(c);if(location.origin!==origin)fail();const token=await tokenProvider();
  if(location.origin!==origin||typeof token!=='string'||token.length>4096||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))fail();
  const r=await fetchImpl('http://127.0.0.1:4294/api/desktop-local/customer-accounts',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000),body});
  if(!r||![200,201,409].includes(r.status))fail();const e=await r.json(),d=e?.data;
  if(!isCustomerAccountOutcome(d,c))fail();
  if(d.state==='COMMITTED'){
   if(r.status!==(d.replayed?200:201)||e?.success!==true||r.ok!==true)fail();
  }else if(r.status!==409||e?.success!==false||r.ok!==false||e?.error?.code!=='CUSTOMER_ACCOUNT_EXISTS')fail();
  return d;
 };
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountDesktopCustomerAccountCreate({root,customer,controller,onSettled=()=>{}}={}){
 if(!root||typeof root.querySelector!=='function'||typeof controller?.pending!=='function'||typeof controller.create!=='function'||typeof controller.retry!=='function'||typeof onSettled!=='function')fail();let disposed=false,busy=false;
 function paint(message=''){
  if(disposed)return;let p;try{p=controller.pending();}catch{root.innerHTML='<p role="alert">Bekleyen döviz hesabı işlemi okunamadı. Yeni hesap açılmadı.</p>';return;}
  if(p){root.innerHTML=`<p>${esc(p.customerCode)} · ${esc(p.customerName)} · ${esc(p.currency)} hesabının sonucu bekleniyor.</p><button type="button" data-account-retry ${busy?'disabled':''}>Aynı hesap işlemini doğrula</button><p role="status">${esc(message)}</p>`;root.querySelector('[data-account-retry]').addEventListener('click',()=>act(()=>controller.retry()));return;}
  const available=CUSTOMER_ACCOUNT_CURRENCIES.filter(v=>!customer.accounts.some(a=>a.currency===v));
  root.innerHTML=available.length&&customer.isActive?`<label>Yeni hesap para birimi <select data-account-currency>${available.map(v=>`<option value="${v}">${v}</option>`).join('')}</select></label> <button type="button" data-account-create ${busy?'disabled':''}>Sıfır bakiyeli hesap aç</button><p role="status">${esc(message)}</p>`:`<p>${customer.isActive?'TRY, USD ve EUR hesaplarının tamamı açık.':'Pasif müşteri için yeni hesap açılamaz.'}</p><p role="status">${esc(message)}</p>`;
  root.querySelector('[data-account-create]')?.addEventListener('click',()=>act(()=>controller.create({customerId:customer.id,entityId:customer.entityId,customerCode:customer.customerCode,customerName:customer.name,currency:root.querySelector('[data-account-currency]').value})));
 }
 async function act(work){if(busy||disposed)return;busy=true;const buttons=root.querySelectorAll?.('button,select')??[];for(const b of buttons)b.disabled=true;
  try{const result=await work();if(disposed)return;if(result.state==='COMMITTED'||result.state==='NOT_COMMITTED'){busy=false;await onSettled(result);if(!disposed)paint(result.state==='COMMITTED'?'Hesap sıfır bakiyeyle açıldı.':'Bu para biriminin hesabı zaten açık.');}else paint('Sonuç doğrulanamadı; aynı işlem saklanıyor.');}
  catch{if(!disposed)paint('İşlem doğrulanamadı. Bekleyen kaydı yeniden doğrulayın.');}
  finally{busy=false;if(!disposed){const button=root.querySelector('[data-account-retry], [data-account-create]');if(button)button.disabled=false;}}
 }
 paint();return Object.freeze({dispose(){disposed=true;},requestClose(){return !busy;}});
}
