import './personnelTerminal.css';
import {createWorkingCatalogSession,workingCatalogUserLabel} from './workingCatalogSession.mjs';
import {createWorkReceiving} from './workReceiving.js';
import {createWorkSales} from './workSales.js';
import {createWorkCount} from './workCount.js';
import {createWorkSupplierReturns} from './workSupplierReturns.js';
import {moneyDisplay,catalogPath,catalogEnvelope,catalogMainPrice,catalogExact} from './workCatalogModel.mjs';
import {createCatalogPhotoLoader,createCatalogThumbnailLoader} from './workCatalogPhoto.mjs';
import {terminalActions,terminalRoute,terminalCrmUrl,terminalMessage,terminalStorage,terminalUser,createTerminalScanGate,createTerminalSessionFacade,terminalOfflineText} from './personnelTerminalModel.mjs';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root=document.getElementById('view'),crm=document.getElementById('terminal-crm'),frame=document.getElementById('terminal-crm-frame'),crmStatus=document.getElementById('terminal-crm-status'),connection=document.getElementById('terminal-connection');
const storage=terminalStorage(sessionStorage),scanner=createTerminalScanGate();
let session=null,user=null,controller=null,route='home',crmStarted=false,crmOrigin=null,crmTimer=null,pendingWrites=0,navigationVersion=0,crmLogoutPending=storage.getItem('crmLogoutPending')==='true',logoutResolve=null;
function announce(message){connection.textContent=message;connection.hidden=!message;}
function online(){return navigator.onLine!==false;}
function connectionState(){announce(online()?'':terminalOfflineText);}
window.addEventListener('online',connectionState);window.addEventListener('offline',connectionState);

// Existing services own writes and UUID journals. The facade prevents approval,
// finance and offline actions; it creates no commercial source or sync queue.
function client(){const scoped=createTerminalSessionFacade(session,{online});return {...scoped,work:(path,options)=>track(()=>scoped.work(path,options),options),inbound:(path,options)=>track(()=>scoped.inbound(path,options),options)};}
async function track(action,options){const write=options?.method==='POST';if(write)pendingWrites++;try{return await action();}finally{if(write)pendingWrites--;}}
function closeAllowed(){
 if(pendingWrites||controller?.requestClose?.()===false){announce('Son işlemi doğruladıktan sonra başka ekrana geçebilirsiniz.');return false;}
 if(document.getElementById('modalback').style.display==='flex'){announce('Önce açık sayımı kaydedin veya kapatın.');return false;}
 if(route==='count'&&user){try{const pending=JSON.parse(localStorage.getItem(`melisa-daily-count-${user.id}`)||'null');if(pending&&!pending.result){announce('Son sayımın sonucu doğrulanmalı. Aynı isteği yeniden doğrulayın.');return false;}}catch{announce('Son sayım okunamıyor. Kaydı doğrulayın.');return false;}}
 return true;
}
function go(value,{initial=false}={}){
 const next=terminalRoute(value);if(!initial&&!closeAllowed())return false;
 controller?.dispose();controller=null;scanner.reset();route=next;navigationVersion++;root.hidden=route==='crm';crm.hidden=route!=='crm';
 if(location.hash!=='#'+route)history.replaceState(null,'','#'+route);
 if(!user){showLogin();return true;}
 if(route==='home')home();else if(route==='crm')openCrm();else if(route==='products'){controller=products();controller.mount();}else{
  const args={root,session:client(),user,storage:localStorage,navigate:go};
  controller=route==='goods'?createWorkReceiving(args):route==='sales'?createWorkSales(args):route==='count'?createWorkCount(args):createWorkSupplierReturns(args);
  controller.mount();
 }
 connectionState();return true;
}
function home(){root.innerHTML=`<section class="terminal-home"><h1>Bugünkü işiniz</h1><p>İşinizi seçin; kaydınızı aynı ekrandan sürdürün.</p><div class="terminal-actions">${terminalActions.map(a=>`<button class="terminal-action" type="button" data-terminal-route="${a.id}"><span aria-hidden="true">${a.icon}</span>${a.label}</button>`).join('')}</div><p><a class="btn" href="/kullanim-egitimi.html?terminal=1#receiving">Kısa eğitimler</a></p></section>`;root.querySelectorAll('[data-terminal-route]').forEach(button=>button.onclick=()=>go(button.dataset.terminalRoute));}
function setUser(current){user=terminalUser(current);document.getElementById('terminal-user').textContent=workingCatalogUserLabel(user);document.getElementById('terminal-logout').hidden=false;go(route,{initial:true});}
function showLogin(message=''){
 controller?.dispose();controller=null;user=null;root.hidden=false;crm.hidden=true;document.getElementById('terminal-user').textContent='';document.getElementById('terminal-logout').hidden=true;
 root.innerHTML=`<section class="card terminal-login"><h1>Personel girişi</h1><p>Kendi hesabınızla günlük işlerinizi açın.</p><p role="alert">${esc(message)}</p><form id="terminal-login"><label>Kullanıcı adı<input name="username" autocomplete="username" required maxlength="120"></label><label>Parola<input name="password" type="password" autocomplete="current-password" required></label><button class="btn primary">Programa gir</button></form></section>`;
 root.querySelector('form').onsubmit=async e=>{e.preventDefault();if(!online()){announce(terminalOfflineText);return;}const form=e.currentTarget,button=form.querySelector('button'),credentials={username:form.elements.username.value,password:form.elements.password.value};button.disabled=true;form.elements.password.value='';try{const current=await session.login(credentials);terminalUser(current);setUser(current);}catch(error){storage.removeItem('melisaTestSalesAccessToken');showLogin(error.message);}finally{credentials.password='';}};
}
function start(){session?.dispose();session=createWorkingCatalogSession({location,apiBase:import.meta.env.VITE_API_BASE_URL,storage,onExpired:()=>{requestCrmLogout();showLogin('Oturumunuz sona erdi. Yeniden giriş yapın.');}});root.innerHTML='<p role="status">Personel oturumu açılıyor…</p>';session.start().then(current=>current?setUser(current):showLogin()).catch(error=>{storage.removeItem('melisaTestSalesAccessToken');showLogin(error.message);});}
function clearCrm(){clearTimeout(crmTimer);frame.removeAttribute('src');crmStarted=false;crm.dataset.ready='false';}
function recoverCrmLogout({reload=false}={}){
 frame.hidden=true;
 if(!online())return;
 try{const target=terminalCrmUrl(location);crmOrigin=target.origin;if(!crmStarted||reload){crmStarted=true;frame.src=target.url;}else frame.contentWindow?.postMessage({type:'melisa-terminal-parent',version:1,action:'logout'},crmOrigin);}catch{crmStatus.textContent='Müşteri oturumu kapanışı doğrulanamadı.';}
}
async function requestCrmLogout(){
 frame.hidden=true;
 if(!crmStarted&&!crmLogoutPending){clearCrm();return;}
 crmLogoutPending=true;storage.setItem('crmLogoutPending','true');
 await new Promise(resolve=>{logoutResolve=resolve;recoverCrmLogout();setTimeout(()=>{if(logoutResolve===resolve){logoutResolve=null;resolve();}},4000);});
}
function openCrm(){
 if(crmLogoutPending){frame.hidden=true;crm.dataset.ready='false';crmStatus.textContent='Önceki müşteri oturumunun kapanışı doğrulanıyor. ERP işlerinize devam edebilirsiniz.';recoverCrmLogout();return;}
 frame.hidden=false;
 if(!online()){crmStatus.textContent=terminalOfflineText;crm.dataset.ready='false';return;}
 if(crmStarted){frame.contentWindow?.postMessage({type:'melisa-terminal-parent',version:1,action:'activate'},crmOrigin);return;}
 try{const target=terminalCrmUrl(location);crmOrigin=target.origin;crmStarted=true;crm.dataset.ready='false';crmStatus.textContent='Müşterileriniz açılıyor…';frame.src=target.url;clearTimeout(crmTimer);crmTimer=setTimeout(()=>{if(crm.dataset.ready!=='true')crmStatus.textContent='Müşteri bağlantısı şu anda açılamıyor. Diğer işlerinize devam edebilirsiniz.';},12000);}catch(error){crmStatus.textContent=error.message;}
}
window.addEventListener('message',event=>{const action=terminalMessage(event,frame,crmOrigin);if(action==='logged-out'&&crmLogoutPending){crmLogoutPending=false;storage.removeItem('crmLogoutPending');clearCrm();frame.hidden=false;logoutResolve?.();logoutResolve=null;if(user&&route==='crm')openCrm();}else if(action==='ready'&&!crmLogoutPending){clearTimeout(crmTimer);crm.dataset.ready='true';}else if(action==='home'&&!crmLogoutPending)go('home');else if(action==='unavailable'){crm.dataset.ready='false';crmStatus.textContent='Müşteri bağlantısı şu anda açılamıyor. Diğer işlerinize devam edebilirsiniz.';}});
frame.addEventListener('load',()=>{if(crmStarted)frame.contentWindow?.postMessage({type:'melisa-terminal-parent',version:1,action:crmLogoutPending?'logout':'activate'},crmOrigin);});
document.getElementById('terminal-crm-retry').onclick=()=>{if(crmLogoutPending){recoverCrmLogout({reload:true});crmStatus.textContent='Önceki müşteri oturumunun kapanışı doğrulanıyor…';return;}clearCrm();openCrm();};
document.getElementById('terminal-home').onclick=()=>go('home');
document.getElementById('terminal-logout').onclick=async()=>{
 if(!closeAllowed())return;
 const button=document.getElementById('terminal-logout');button.disabled=true;
 storage.removeItem('melisaTestSalesAccessToken');session?.dispose();controller?.dispose();controller=null;user=null;frame.hidden=true;crm.hidden=true;root.hidden=false;
 await requestCrmLogout();
 route='home';button.disabled=false;start();if(crmLogoutPending)announce('Müşteri oturumu kapanışı doğrulanamadı. Müşterilerim geçici olarak kapalı.');
};
window.addEventListener('hashchange',()=>{if(!go(location.hash.slice(1)))history.replaceState(null,'','#'+route);});

// HID scanners and manual input share the same string path. Duplicate Enter
// must not add another quantity or submit a commercial form a second time.
document.addEventListener('keydown',event=>{
 if(event.key!=='Enter'||!(event.target instanceof HTMLInputElement))return;
 const input=event.target,scan=input.matches('#count-scan,[name=scan],[name=search],[data-terminal-query]');
 if(!scan)return;
 if(pendingWrites||!scanner.accept(input.value)){event.preventDefault();event.stopImmediatePropagation();return;}
 if(route==='sales'&&input.matches('[name=search]')){event.preventDefault();event.stopImmediatePropagation();input.closest('form')?.querySelector('[data-sale-barcode]')?.click();}
},true);
document.addEventListener('submit',event=>{if(!online()){event.preventDefault();event.stopImmediatePropagation();announce(terminalOfflineText);}},true);

function products(){
 let active=true,busy=false,generation=0,rows=[],page=1,meta=null,query='',barcodeMode=true;
 const scoped=client(),photo=createCatalogPhotoLoader({media:scoped.media}),thumbs=createCatalogThumbnailLoader({media:scoped.media});
 const salesPermission=user.permissions.includes('sales.view');
 const state=message=>{root.innerHTML=`<section class="terminal-products"><h1>Ürünler</h1><form data-terminal-product-form><label for="terminal-query">Barkod veya ürün kodu</label><input id="terminal-query" data-terminal-query name="query" inputmode="text" autocomplete="off" value="${esc(query)}" maxlength="160" placeholder="Okut ve Enter"><button class="btn primary" ${busy?'disabled':''}>Bul</button><button class="btn" type="button" data-terminal-name ${busy?'disabled':''}>Ad / kod ile ara</button></form><p role="status">${esc(message||'')}</p><div data-terminal-product-list></div><div data-terminal-product-detail></div><div class="terminal-pagination"><button class="btn" data-terminal-prev ${busy||page<=1?'disabled':''}>Önceki</button><span>${meta?`${page} / ${Math.max(1,meta.totalPages)}`:''}</span><button class="btn" data-terminal-next ${busy||!meta||page>=meta.totalPages?'disabled':''}>Sonraki</button></div></section>`;
  root.querySelector('form').onsubmit=event=>{event.preventDefault();if(busy)return;query=event.currentTarget.elements.query.value.trim();page=1;barcodeMode=true;search();};
  root.querySelector('[data-terminal-name]').onclick=()=>{if(busy)return;query=root.querySelector('[name=query]').value.trim();page=1;barcodeMode=false;search();};
  root.querySelector('[data-terminal-prev]').onclick=()=>{page--;search();};root.querySelector('[data-terminal-next]').onclick=()=>{page++;search();};
 };
 const money=row=>{const price=catalogMainPrice(row);return price?`${moneyDisplay(price.priceExact)} ${price.currency} / ${row.unit.label??'Birim bilinmiyor'}`:'Fiyat bilinmiyor';};
 async function search(){if(busy||!active)return;if(!user.permissions.includes('product.view')){state('Ürünleri görüntüleme yetkiniz yok.');return;}const n=++generation;busy=true;scanner.setBusy(true);thumbs.clear();photo.clear();state('Ürün bilgileri açılıyor…');try{let p=catalogEnvelope(await scoped.api(catalogPath({...(barcodeMode&&query?{barcode:query}:{search:query}),page}),{envelope:true}),{salesPermission});if(barcodeMode&&query&&p.meta.total===0&&query.length<=120)p=catalogEnvelope(await scoped.api(catalogPath({search:query,page}),{envelope:true}),{salesPermission});if(!active||n!==generation)return;rows=p.data;meta=p.meta;busy=false;state(rows.length?'':'Stok kartı gerekli / inceleme gerekli.');const list=root.querySelector('[data-terminal-product-list]');list.innerHTML=rows.map(r=>`<button class="terminal-product-row" type="button" data-terminal-product="${r.id}"><span class="terminal-thumb" data-terminal-thumb="${r.id}">▧</span><span><b>${esc(r.displayCode)}</b><small>${esc(r.classification.brand??'Marka bilinmiyor')} · ${esc(r.classification.productType??'Tür bilinmiyor')}</small><small>${esc(r.productName??'')}</small><small>Stok: ${esc(r.stockQuantityExact===null?'Bilinmiyor':catalogExact(r.stockQuantityExact))} ${esc(r.unit.label??'')}</small></span><span><b>${esc(money(r))}</b><small>${r.hold.blocked?'İnceleme bekliyor':r.isActive?'Aktif':'Pasif'}</small></span></button>`).join('');thumbs.mount(list,[...list.querySelectorAll('[data-terminal-thumb]')].map(slot=>({slot,row:rows.find(r=>r.id===slot.dataset.terminalThumb)})));list.querySelectorAll('[data-terminal-product]').forEach(button=>button.onclick=()=>detail(button.dataset.terminalProduct));}catch(error){if(active&&n===generation){busy=false;rows=[];meta=null;state(!online()?terminalOfflineText:error.status===403?'Ürünleri görüntüleme yetkiniz yok.':'Ürün bilgileri doğrulanamadı. Yeniden deneyin.');}}finally{scanner.setBusy(false);}}
 async function detail(id){const n=++generation,box=root.querySelector('[data-terminal-product-detail]');if(!box||busy)return;box.innerHTML='<p role="status">Ürün açılıyor…</p>';try{const p=catalogEnvelope(await scoped.api(`/api/catalog/products/${id}`,{envelope:true}),{salesPermission,detail:true});if(!active||n!==generation)return;const r=p.data;box.innerHTML=`<article class="card terminal-product-card"><button class="btn" data-terminal-close>Listeye dön</button><h2>${esc(r.displayCode)}</h2><div class="terminal-product-photo" data-terminal-photo></div><p class="terminal-price">${esc(money(r))}</p><dl><dt>Marka</dt><dd>${esc(r.classification.brand??'Bilinmiyor')}</dd><dt>Tür</dt><dd>${esc(r.classification.productType??'Bilinmiyor')}</dd><dt>Stok kodu</dt><dd>${esc(r.stockCode)}</dd><dt>Barkod</dt><dd>${esc(r.barcodes.map(b=>b.value).join(' · ')||'Bilinmiyor')}</dd><dt>Stok</dt><dd>${esc(r.stockQuantityExact===null?'Bilinmiyor':catalogExact(r.stockQuantityExact))} ${esc(r.unit.label??'')}</dd></dl>${r.hold.blocked?'<p>İnceleme bekliyor. İşlem başlatılamaz.</p>':''}</article>`;photo.show(box.querySelector('[data-terminal-photo]'),r);box.querySelector('[data-terminal-close]').onclick=()=>{photo.clear();box.innerHTML='';root.querySelector('[name=query]')?.focus();};box.scrollIntoView({block:'start'});}catch(error){if(active&&n===generation)box.textContent=!online()?terminalOfflineText:'Ürün bilgileri doğrulanamadı.';}}
 return {mount(){state();search();},dispose(){active=false;generation++;photo.dispose();thumbs.dispose();}};
}
route=terminalRoute(location.hash.slice(1));connectionState();start();
