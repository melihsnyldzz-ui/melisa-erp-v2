import {installReadOnlyNavigation} from './readOnlyNavigation.mjs';
import {exampleSettingsPanel,wireExampleSettings} from './settingsUI.js';
import {completionTree} from './completion.js';
import {createLazyVegaClient as createVegaProductClient} from '../services/lazyVegaClient.mjs';
import { createVegaProductStorage } from '../services/vegaProductStorage.js';
import { normalizePage, verifyDetail, quantity, currency, priceRows } from '../modules/vega/vegaReadModel.js';
import { dayRange, istanbulDay, operationPage, readiness, readPaths, documentCard, documentSummary, completionSteps } from './liveDataModel.js';
import './liveData.css';
import './officeLayout.css';
import './officeAccessibility.js';
import dailySnapshot from './dailySnapshot.json';
import accountSnapshot from './accountSnapshot.json';
import {createWorkCatalog} from './workCatalog.js';
import {createCleanNativeOrders} from './cleanNativeOrders.js';
import {isCleanCatalogLocation} from './cleanSyntheticCatalogModel.mjs';
import {createWorkHome} from './workHome.js';
import {validateWorkHome} from './workHomeModel.mjs';
import {createWorkSales} from './workSales.js';
import {createWorkCollections} from './workCollections.js';
import {createWorkCustomers} from './workCustomers.js';
import {createWorkReceiving} from './workReceiving.js';
import {createWorkPurchases} from './workPurchases.js';
import {createWorkSuppliers} from './workSuppliers.js';
import {createWorkSupplierPayments} from './workSupplierPayments.js';
import {createWorkCount} from './workCount.js';
import {createWorkSupplierReturns} from './workSupplierReturns.js';
import {createWorkReports} from './workReports.js';
import {createWorkSystemSettings} from './workSystemSettings.js';
import {resolveTestApiBase,testSessionModeKey} from './testAdminSession.mjs';
import {createWorkingCatalogSession,workingCatalogUserLabel} from './workingCatalogSession.mjs';
import {selectedSourceCopy,readSelectedSourceHandoff} from './selectedSourceCollectionHandoff.mjs';
import {mountCopyActorSelector,verifiedCopyPage} from './workCopyActorSelector.mjs';
const savedAccounts=accountSnapshot.rows.map(r=>({sourceId:String(r.IND),accountCode:r.FIRMAKODU,name:r.FIRMAADI,currency:r.PARABIRIMI,groupCode:r.KOD1,readAt:r.readAt}));
const savedAccountNames=Object.fromEntries(savedAccounts.map(r=>[r.sourceId,r.name]));

const workflow=window.MelisaWorkflow;
let disposeCopyActors=()=>{};
let disposeReadOnlyNavigation=()=>{};
function showCopyActors(session,current){disposeCopyActors();disposeCopyActors=mountCopyActorSelector({container:document.querySelector('.top-right'),session,user:current,beforeSwitch:()=>window.MelisaWorkingBeforeNavigate?.()!==false,onChanged:()=>workflow.render()});}
function refreshBusinessDate(){
 const target=document.getElementById('business-date');
 if(target)target.textContent=new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',day:'numeric',month:'long',year:'numeric',weekday:'long'}).format(new Date());
}
refreshBusinessDate();
setInterval(refreshBusinessDate,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshBusinessDate()});

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const val=v=>v===null||v===undefined||v===''?'Bilinmiyor':esc(v);
const amount=v=>esc(quantity(v));
const date=v=>v?esc(String(v).slice(0,10)):'Bilinmiyor';
const stamp=v=>Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):'Henüz okunmadı';
const storage=name=>{try{return window[name]}catch{return undefined}};
const settings=storage('localStorage');
let mode='demo';try{if(settings?.getItem('melisa-example-workflow-v2')!=='yes'){settings?.setItem('melisa-data-mode','demo');settings?.setItem('melisa-example-workflow-v2','yes')}mode=settings?.getItem('melisa-data-mode')==='live'?'live':'demo'}catch{}
let user=null,day=istanbulDay(),followToday=true,dispose=()=>{},authBusy=false,catalogAvatarBefore=null;
const client=createVegaProductClient({allowLocalTest:import.meta.env.VITE_TEST_READ_ONLY==='true',baseUrl:import.meta.env.VITE_VEGA_PRODUCTS_BASE_URL||'https://vega-api.melisababy.com',allowAccounts:true,allowOperations:true,storage:createVegaProductStorage(storage('localStorage'),storage('sessionStorage')),onExpired:()=>{user=null;queueMicrotask(()=>workflow.render())}});
const toolbar=document.createElement('section');toolbar.className='live-toolbar';toolbar.setAttribute('aria-label','Veri kaynağı');document.getElementById('view').before(toolbar);
function switchMode(next){mode=next;try{settings?.setItem('melisa-data-mode',mode)}catch{} workflow.render()}
function table(columns,rows,empty='Seçilen kapsamda kayıt bulunamadı.'){
 return `<div class="tablewrap"><table><thead><tr>${columns.map(([,label])=>`<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${columns.map(([key,,format])=>`<td>${format?format(row[key],row):val(row[key])}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${columns.length}">${esc(empty)}</td></tr>`}</tbody></table></div>`;
}
function savedDocuments(page,kind,selectedDay){
 if(user||selectedDay!==dailySnapshot.date||!kind)return null;
 const snapshot=dailySnapshot.documents[kind];if(!snapshot)return null;
 return {...snapshot,rows:page==='returns'?snapshot.rows.filter(r=>r.IADE===true):snapshot.rows};
}
function recordTable(rows,empty){
 return table([['number','Fiş / belge',(v,r)=>`<button class="link" data-document="${esc(r.id)}">${val(v)}</button><br><small>${date(r.date)}</small>`],['account','Cari'],['currency','Döviz'],['state','Belge durumu'],['payment','Tahsilat'],['shipment','Gönderim']],rows,empty);
}
function modeSettings(){return `<section class="card live-result"><h2>Çalışma ekranı</h2><label>Gösterilen kayıtlar <select id="live-mode"><option value="live" ${mode==='live'?'selected':''}>İşletme kayıtları</option><option value="demo" ${mode==='demo'?'selected':''}>Örnek akış</option></select></label><p class="live-note">Örnek akış, işlemleri denemek içindir. İşletme kayıtlarıyla birleşmez.</p></section>`}
function roadmap(){if(mode==='demo')return `<section class="card live-result live-roadmap"><h2>Örnek ERP — tamamlanan ve kalan işler</h2><p>Önce bu iş akışı tamamlanacak. Veri taşıma ve gerçek sunucu bağlantısı sonraki aşama.</p>${table([['name','Bölüm'],['done','Çalışan'],['left','Kalan']], [
{name:'Ürün & stok',done:'Kart açma/düzenleme, fiyat geçmişi, ortak stok, filtre ve dışa aktarma.',left:'Gerçek veritabanına kayıt ve maliyet entegrasyonu.'},
{name:'Satış / tahsilat',done:'Fiş, genel cari tahsilatı, kayıtlı kur, kasa/banka açılışı, aktarım, iptal; vade, gönderim, indirim ve para iadesi.',left:'Gerçek kullanıcı, ortak kayıt ve canlı kasa/cari kabulü.'},
{name:'Müşteriler',done:'Cari açma/düzenleme, kart ayrıntısı, fişler, borç ve alacak.',left:'Gerçek cari hareketleri ve farklı dövizlerde satış.'},
{name:'Gelen mal',done:'Çok ürünlü kabul, barkod eşleme, aynı ekranda eksik kart açma ve yetkili onayıyla tek stok artışı.',left:'Gerçek veritabanı ve cihazlarla kullanım provası.'},
{name:'Alış',done:'Kısmi / çok satırlı fatura, iskonto / KDV, kabul eşleme, tedarikçi ödemesi / iptali ve ürün alış maliyeti.',left:'Gerçek veritabanı ve ortak kayıt kabulü.'},
{name:'Sayım',done:'Toplu barkod sayımı, saklanan taslak, fark nedeni, toplu onay / ret, tekrar sayım geçmişi ve hareket koruması.',left:'Gerçek veritabanı ve fiziksel cihazlarla kullanım provası.'},
{name:'Onaylar',done:'Birleşik bekleyen işler, yetki filtresi, kabul / ret, kaynak belge ve ortak karar geçmişi; dört rol kontrolü.',left:'Gerçek kullanıcı yetkileri ve ortak veritabanı kabulü.'},
{name:'İadeler',done:'Müşteri iadesi, ayrı para iadesi; faturalı ve faturasız tedarikçi iadesi, onay / ret ve miktar koruması.',left:'Gerçek veritabanı ve kullanıcı yetkileri.'},
{name:'Ayarlar',done:'Saklanan örnek tercihler, Semih düzenleme yetkisi, değişiklik geçmişi, rol tablosu ve yeni form başlangıç değerleri.',left:'Gerçek kullanıcı / rol yönetimi, ortak veritabanı ve yedekten dönüş.'}
])}</section>`;return `<section class="card live-result live-roadmap"><h2>Bitirme sırası</h2><p>Günlük kullanıma geçiş henüz tamamlanmadı.</p>${table([['order','Sıra'],['name','İş'],['state','Durum'],['acceptance','Bitti sayma koşulu']],completionSteps)}<h2>Bölüm bölüm kalan işler</h2>${table([['name','Bölüm'],['done','Hazırlanan'],['left','Kalan iş']],readiness.map(([id,name,done,left])=>({name,done,left})))}</section>`}
function message(cause){if(cause?.status===401)return 'ERP oturumu sona erdi. Ayarlar üzerinden yeniden giriş yapın.';if(cause?.status===403)return 'Bu kayıtları görüntüleme yetkiniz veya bağlantı izni yok.';if(cause?.status===404)return 'Şirket bağlantısında bu veri ekranı henüz açılmamış. Bağlantı servisi güncellenmeli.';return cause?.message||'Veriler okunamadı.'}
function paintToolbar(){
 let displayName='Melisa ERP';if(mode==='demo'){try{displayName=window.MelisaDemoOperations?.settings().values.displayName||displayName}catch{}}
 toolbar.innerHTML=`<strong>${esc(displayName)}</strong><p>${mode==='demo'?'Örnek akış · Gerçek işlem kaydedilmez.':user?'İşletme kayıtları · İşlem kaydetme bağlantısı bekleniyor.':authBusy?'Bağlantı kontrol ediliyor…':'İşletme kayıtları · Sürekli bağlantı bekleniyor.'}</p><button class="btn small" id="live-settings">Ayarlar ve kalan işler</button>`;
 toolbar.querySelector('#live-settings').onclick=()=>workflow.go('settings');
 const role=document.getElementById('role');if(role)role.closest('.rolebox').hidden=mode==='live';
 if(mode==='live')document.querySelectorAll('#nav .badge').forEach(x=>x.remove());
 const side=document.querySelector('aside .sidefoot');if(side)side.textContent=mode==='live'?'Melisa ERP':'Melisa ERP · Örnek akış';
}
function loginBox(){return `<section class="card live-result"><h2>ERP bağlantısı</h2>${user?`<p>Mevcut ERP hesabıyla bağlantı doğrulandı. Yetkiler ERP hesabınızdan gelir.</p><button class="btn" id="live-logout">Oturumu kapat</button>`:`<p>Mevcut ERP kullanıcı adı ve şifrenizle bağlanın. Şifre kaydedilmez.</p><form class="live-login" id="live-login"><label>Kullanıcı adı<input name="username" autocomplete="username" required maxlength="120"></label><label>Şifre<input type="password" name="password" autocomplete="current-password" required></label><button class="btn primary" ${authBusy?'disabled':''}>${authBusy?'Bağlanıyor…':'ERP’ye bağlan'}</button></form>`}<p class="live-status" role="status" id="live-login-status"></p><div class="live-health"><button class="btn" id="live-health">Bağlantıyı kontrol et</button><p id="live-health-status" role="status"></p></div><p class="live-note">Gerçek satış, tahsilat, iade ve stok düzeltme kayıtları için kalıcı işlem bağlantısı henüz tamamlanmadı.</p></section>`}
function wireLogin(root){
 const form=root.querySelector('#live-login');
 if(form)form.onsubmit=async e=>{e.preventDefault();if(authBusy)return;const data=new FormData(form),status=root.querySelector('#live-login-status');authBusy=true;form.querySelector('button').disabled=true;status.textContent='ERP oturumu doğrulanıyor…';try{const session=await client.login(data.get('username'),data.get('password'));if(!Array.isArray(session.data?.permissions))throw new Error('ERP yetkileri doğrulanamadı.');user=session.data;form.querySelector('[name=password]').value='';mode='live';try{settings?.setItem('melisa-data-mode',mode)}catch{}workflow.go('home')}catch(error){if(root.isConnected){status.textContent=message(error);form.querySelector('[name=password]').value=''}}finally{authBusy=false;paintToolbar();if(form.isConnected)form.querySelector('button').disabled=false}};
 const logout=root.querySelector('#live-logout');if(logout)logout.onclick=async()=>{user=null;dispose();await client.logout().catch(()=>{});workflow.render()};
 const health=root.querySelector('#live-health');if(health)health.onclick=async()=>{health.disabled=true;const status=root.querySelector('#live-health-status');status.textContent='Bağlantı sınanıyor…';try{const r=await client.get('/health');status.textContent=r.data?.erpAuthReachable===true&&r.data?.vegaMcpReachable===true?'ERP oturum servisi ve VEGA veri kaynağı yanıt verdi.':'Bağlantının bütün bileşenleri doğrulanamadı.'}catch(error){status.textContent=message(error)}finally{health.disabled=false}};
}
const configs={home:['Günlük operasyon','Fişi açın veya soldaki menüden işinize geçin.','sale_stock_exit'],receipts:['Satış fişleri','Fiş numarası veya cari kayıt numarasıyla arayın; ayrıntısını açın.','sale_stock_exit'],goods:['Gelen mal','Personel sayar → İlker ürünleri kontrol eder → kabul tamamlanır.','purchase_stock_entry'],purchases:['Alış faturaları','Mal kabulüyle faturayı eşleştirin; tedarikçi borcu ve maliyeti kontrol edin.','purchase_invoice'],returns:['İadeler','Müşteri ve tedarikçi iadelerini ayrı inceleyin.','sale_stock_exit'],stock:['Ürün & stok','Ürünü seçerek stok, birim, barkod ve kayıtlı fiyatları açın.'],customers:['Müşteriler','Cari kartını seçerek gün içindeki borç ve alacak hareketlerini açın.'],collections:['Tahsilat','Cari hareketlerini inceleyin. Yeni tahsilat kaydı henüz bağlı değil.']};
export function nativeApprovalSummary(data){
 const s=data?.sections?.approvals,c=data?.capabilities,n=data?.navigationReady;
 if(!s||!c||!n||!['available','forbidden','unavailable'].includes(s.status))throw Error('Onay bilgileri okunamadı.');
 const coverage=['goods','count','sales-return','purchase-return'];
 if(s.status==='available'&&(c.approval!==true||!Number.isSafeInteger(s.pendingCount)||s.pendingCount<0||s.complete!==false||!Array.isArray(s.sourceCoverage)||s.sourceCoverage.length<1||s.sourceCoverage.length>coverage.length||new Set(s.sourceCoverage).size!==s.sourceCoverage.length||[...s.sourceCoverage].some(k=>!coverage.includes(k))))throw Error('Onay bilgileri okunamadı.');
 if(s.status!=='available'&&s.pendingCount!==null)throw Error('Onay bilgileri okunamadı.');
 const links=[['goods','Mal kabulü','goods'],['count','Sayım','count'],['returns','İadeler','returns']].filter(([, ,k])=>c[k]===true&&n[k]===true).map(([screen,label])=>({screen,label}));
 return {pendingCount:s.status==='available'?s.pendingCount:null,status:s.status,links};
}
function createNativeApprovals({root,session,navigate,user}){
 if(isCleanCatalogLocation(window.location))return createCleanNativeOrders({root,session,user,storage:storage('localStorage')});
 let active=false,generation=0;
 async function refresh(){const token=++generation;root.innerHTML='<section class="card panel" style="padding:20px"><h1>Onaylar</h1><p role="status">Bekleyen işler açılıyor…</p></section>';try{
  const view=nativeApprovalSummary(validateWorkHome(await session.home()));if(!active||!root.isConnected||token!==generation)return;
  const text=view.pendingCount===null?(view.status==='forbidden'?'Onayları görüntüleme yetkiniz yok.':'Bekleyen işler şu anda okunamıyor.'):`${view.pendingCount.toLocaleString('tr-TR')} kayıt kontrol bekliyor.`;
  root.innerHTML=`<div class="heading"><div><div class="eyebrow">MELİSA ERP</div><h1>Onaylar</h1><p class="sub">Bekleyen kayıtları kaynak bölümünde inceleyin.</p></div><button class="btn" data-approval-refresh>Yenile</button></div><section class="card panel" style="padding:20px"><p role="status">${esc(text)}</p><p>Bu özet, yetkiniz kapsamındaki mal kabulü, sayım ve iade kayıtlarını kapsar. İndirim kararları ve birleşik karar geçmişi bu özete dahil değildir.</p><div class="office-approval-links">${view.links.map(l=>`<article class="office-approval-source"><h2>${l.label}</h2><p>${l.screen==='goods'?'Personelin gönderdiği teslimatları inceleyin.':l.screen==='count'?'Fiziksel adetleri ve fark nedenlerini inceleyin.':'Kaynak belgeyi, iade miktarını ve nedenini inceleyin.'}</p><button class="btn" data-approval-source="${l.screen}">${l.label}</button></article>`).join('')}</div><p class="sub">Kayıt ayrıntısını ve karar yetkisini ilgili bölümden kontrol edin.</p></section>`;
  root.querySelector('[data-approval-refresh]').onclick=refresh;root.querySelectorAll('[data-approval-source]').forEach(b=>b.onclick=()=>navigate(b.dataset.approvalSource));
 }catch{if(active&&root.isConnected&&token===generation){root.innerHTML='<section class="card panel" style="padding:20px"><h1>Onaylar</h1><p role="alert">Bekleyen işler şu anda okunamıyor. Yenileyerek tekrar deneyin.</p><button class="btn" data-approval-refresh>Yenile</button></section>';root.querySelector('[data-approval-refresh]').onclick=refresh;}}}
 return {mount(){active=true;refresh();},dispose(){active=false;generation++;}};
}
function mount(){
 document.body.classList.add('office-layout');
 disposeCopyActors();dispose();disposeReadOnlyNavigation();paintToolbar();const page=workflow.screen();const root=document.getElementById('view');
 let catalogUI=null;
 const clearReadOnlyNavigation=installReadOnlyNavigation({host:window,root,page,isCurrent:()=>workflow.screen()===page,beforeNavigate:()=>page!=='stock'||catalogUI?.requestClose?.()!==false});disposeReadOnlyNavigation=clearReadOnlyNavigation;
 const countWorkspace=page==='count';
 const workspace=['stock','home','approvals','sales','receipts','customers','collections','goods','purchases','suppliers','supplier-payments','reports','settings'].includes(page)||countWorkspace||page==='returns';
 toolbar.hidden=workspace;toolbar.style.display=workspace?'none':'';
 const mobileRole=document.getElementById('mobileRole');if(mobileRole)mobileRole.hidden=workspace;
 const realLabel=document.getElementById('working-catalog-user');if(realLabel)realLabel.remove();
 if(page==='reports'||page==='settings'){
  document.getElementById('role')?.closest('.rolebox')?.setAttribute('hidden','');
  document.querySelectorAll('#nav .badge,#nav .nav-complete').forEach(x=>x.hidden=true);
  const side=document.querySelector('aside .sidefoot');if(side)side.textContent='Melisa ERP';
  const avatar=document.getElementById('avatar');if(avatar)avatar.textContent='—';
  const label=document.createElement('span');label.id='working-catalog-user';label.textContent='Oturum açılıyor…';document.querySelector('.top-right')?.append(label);
  let active=true,screenUI=null,session;const alive=()=>active&&root.isConnected&&workflow.screen()===page;
  function showLogin(message=''){
   if(!alive())return;screenUI?.dispose();screenUI=null;label.textContent='Oturum gerekli';if(avatar)avatar.textContent='—';
   root.innerHTML=`<div class="heading"><div><div class="eyebrow">MELİSA ERP</div><h1>${page==='reports'?'Raporlar':'Ayarlar / Sistem Durumu'}</h1></div></div><section class="card panel" style="padding:20px"><h2>ERP hesabıyla giriş</h2><p role="alert">${esc(message)}</p><form id="working-management-login"><label>Kullanıcı adı<input class="search" name="username" autocomplete="username" required></label><label>Şifre<input class="search" name="password" type="password" autocomplete="current-password" required></label><button class="btn primary" type="submit">Giriş yap</button></form></section>`;
   root.querySelector('#working-management-login').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;form.querySelector('button').disabled=true;const fields=new FormData(form),credentials={username:fields.get('username'),password:fields.get('password')};form.elements.password.value='';try{showManagement(await session.login(credentials));}catch(error){if(alive())showLogin(error.message);}finally{credentials.password='';}};
  }
  function showManagement(current){if(!alive())return;if(!current){showLogin();return;}showCopyActors(session,current);label.textContent=workingCatalogUserLabel(current);if(avatar)avatar.textContent=label.textContent.slice(0,1);screenUI?.dispose();screenUI=page==='reports'?createWorkReports({root,session}):createWorkSystemSettings({root,session});screenUI.mount();}
  session=createWorkingCatalogSession({location:window.location,apiBase:import.meta.env.VITE_API_BASE_URL,storage:storage('sessionStorage'),onExpired:()=>showLogin('Oturumunuz sona erdi. Yeniden giriş yapın.')});
  dispose=()=>{active=false;clearReadOnlyNavigation();screenUI?.dispose();session.dispose();};
  root.innerHTML='<section class="card panel" style="padding:20px"><p role="status">Bilgiler açılıyor…</p></section>';
  session.start().then(showManagement).catch(error=>{if(alive())showLogin(error.message);});return;
 }
 if(['sales','receipts','customers','collections','cash','goods','purchases','suppliers','supplier-payments'].includes(page)||countWorkspace||page==='returns'){
  document.getElementById('role')?.closest('.rolebox')?.setAttribute('hidden','');
  document.querySelectorAll('#nav .badge,#nav .nav-complete').forEach(x=>x.hidden=true);
  const side=document.querySelector('aside .sidefoot');if(side)side.textContent='Melisa ERP';
  const avatar=document.getElementById('avatar');if(avatar)avatar.textContent='—';
  const label=document.createElement('span');label.id='working-catalog-user';label.textContent='Oturum açılıyor…';document.querySelector('.top-right')?.append(label);
  let active=true,tradeUI=null,session,cashLoadGeneration=0;const alive=()=>active&&root.isConnected&&workflow.screen()===page;
  const heading={sales:'Satış',receipts:'Satış fişleri',customers:'Müşteriler',collections:'Tahsilat',cash:'Günlük kasa',goods:'Mal Kabul',purchases:'Alış / Fatura',suppliers:'Tedarikçiler','supplier-payments':'Tedarikçi Ödeme',count:'Sayım & düzeltme',returns:'Tedarikçiye iade'}[page];
  function showLogin(message=''){
   if(!alive())return;cashLoadGeneration++;tradeUI?.dispose();tradeUI=null;label.textContent='Oturum gerekli';if(avatar)avatar.textContent='—';
   root.innerHTML=`<div class="heading"><div><div class="eyebrow">MELİSA ERP</div><h1>${heading}</h1></div></div><section class="card panel" style="padding:20px"><h2>ERP hesabıyla giriş</h2><p role="alert">${esc(message)}</p><form id="working-trade-login"><label>Kullanıcı adı<input class="search" name="username" autocomplete="username" required></label><label>Şifre<input class="search" name="password" type="password" autocomplete="current-password" required></label><button class="btn primary" type="submit">Giriş yap</button></form></section>`;
   root.querySelector('#working-trade-login').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;form.querySelector('button').disabled=true;const fields=new FormData(form),credentials={username:fields.get('username'),password:fields.get('password')};form.elements.password.value='';try{showTrade(await session.login(credentials));}catch(error){if(alive())showLogin(error.message);}finally{credentials.password='';}};
  }
  const copy=selectedSourceCopy({profile:window.__MELISA_OPERATION_COPY__,location:window.location,apiBase:resolveTestApiBase({location:window.location,apiBase:import.meta.env.VITE_API_BASE_URL})});
  function showTrade(current){if(!alive())return;if(!current){showLogin();return;}showCopyActors(session,current);label.textContent=workingCatalogUserLabel(current);if(avatar)avatar.textContent=label.textContent.slice(0,1);const args={root,session,user:current,navigate:id=>workflow.go(id),storage:storage('localStorage'),apiBase:resolveTestApiBase({location:window.location,apiBase:import.meta.env.VITE_API_BASE_URL})};const selectedSource=copy&&current.id===16?readSelectedSourceHandoff({storage:args.storage,copy,user:current})??{}:undefined;if(page==='cash'){const token=++cashLoadGeneration;root.innerHTML='<section class="card panel" style="padding:20px"><p role="status">Günlük kasa açılıyor…</p></section>';import('./workCash.jsx').then(({createWorkCash})=>{if(!alive()||token!==cashLoadGeneration)return;tradeUI=createWorkCash(args);window.MelisaWorkingBeforeNavigate=()=>tradeUI?.requestClose?.()!==false;tradeUI.mount();}).catch(()=>{if(alive()&&token===cashLoadGeneration)root.innerHTML='<section class="card panel" style="padding:20px"><h1>Günlük kasa</h1><p role="status">Kasa ekranı şu anda açılamıyor. Sayfayı yenileyin.</p></section>';});return;}tradeUI=page==='supplier-payments'?createWorkSupplierPayments(args):page==='goods'?createWorkReceiving(args):page==='purchases'?createWorkPurchases(args):page==='suppliers'?createWorkSuppliers(args):page==='collections'?createWorkCollections({...args,selectedSource}):page==='customers'?createWorkCustomers(args):page==='count'?createWorkCount(args):page==='returns'?createWorkSupplierReturns(args):createWorkSales({...args,receiptOnly:page==='receipts'});window.MelisaWorkingBeforeNavigate=()=>tradeUI?.requestClose?.()!==false;tradeUI.mount();}
  if((page==='count'||page==='returns')&&!verifiedCopyPage())storage('sessionStorage')?.setItem(testSessionModeKey,'manual');
  session=createWorkingCatalogSession({location:window.location,apiBase:import.meta.env.VITE_API_BASE_URL,storage:storage('sessionStorage'),selectedSourceCollections:!!copy,onExpired:()=>showLogin('Oturumunuz sona erdi. Yeniden giriş yapın.')});
  dispose=()=>{active=false;tradeUI?.dispose();session.dispose();window.MelisaWorkingBeforeNavigate=null;};
  root.innerHTML='<section class="card panel" style="padding:20px"><p role="status">İşlem bilgileri açılıyor…</p></section>';
  session.start().then(showTrade).catch(error=>{if(alive())showLogin(error.message);});return;
 }
 if(page==='home'||page==='approvals'){
  document.getElementById('role')?.closest('.rolebox')?.setAttribute('hidden','');
  document.querySelectorAll('#nav .badge,#nav .nav-complete').forEach(x=>x.hidden=true);
  const side=document.querySelector('aside .sidefoot');if(side)side.textContent='Melisa ERP';
  const avatar=document.getElementById('avatar');if(avatar){if(catalogAvatarBefore===null)catalogAvatarBefore=avatar.textContent;avatar.textContent='—';}
  let active=true,homeUI=null,session;const alive=()=>active&&root.isConnected&&workflow.screen()===page;
  const label=document.createElement('span');label.id='working-catalog-user';label.textContent='Oturum açılıyor…';document.querySelector('.top-right')?.append(label);
  function showLogin(message=''){
   if(!alive())return;homeUI?.dispose();homeUI=null;label.textContent='Oturum gerekli';if(avatar)avatar.textContent='—';
   root.innerHTML=`<div class="heading"><div><div class="eyebrow">MELİSA ERP</div><h1>${page==='approvals'?'Onaylar':'Bugün sırada ne var?'}</h1><p class="sub">Günlük işlerinize ERP hesabınızla ulaşın.</p></div></div><section class="card panel" style="padding:20px"><h2>ERP hesabıyla giriş</h2><p role="alert">${esc(message)}</p><form id="working-home-login"><label>Kullanıcı adı<input class="search" name="username" autocomplete="username" required></label><label>Şifre<input class="search" name="password" type="password" autocomplete="current-password" required></label><button class="btn primary" type="submit">Giriş yap</button></form></section>`;
   root.querySelector('#working-home-login').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;form.querySelector('button').disabled=true;const fields=new FormData(form),credentials={username:fields.get('username'),password:fields.get('password')};form.elements.password.value='';try{showHome(await session.login(credentials));}catch(error){if(alive())showLogin(error.message);}finally{credentials.password='';}};
  }
  function showHome(current){
   if(!alive())return;if(!current){showLogin();return;}showCopyActors(session,current);label.textContent=workingCatalogUserLabel(current);if(avatar)avatar.textContent=label.textContent.slice(0,1);
   homeUI?.dispose();homeUI=page==='approvals'?createNativeApprovals({root,session,user:current,navigate:id=>workflow.go(id)}):createWorkHome({root,session,user:current,navigate:id=>workflow.go(id),openLink:href=>window.location.assign(href)});homeUI.mount();
  }
  session=createWorkingCatalogSession({location:window.location,apiBase:import.meta.env.VITE_API_BASE_URL,storage:storage('sessionStorage'),onExpired:()=>showLogin('Oturumunuz sona erdi. Yeniden giriş yapın.')});
  dispose=()=>{active=false;clearReadOnlyNavigation();homeUI?.dispose();session.dispose();};
  session.start().then(showHome).catch(error=>{if(alive())showLogin(error.message);});return;
 }
 if(page==='stock'){
  const avatar=document.getElementById('avatar');if(avatar){if(catalogAvatarBefore===null)catalogAvatarBefore=avatar.textContent;avatar.textContent='—';}
  document.getElementById('role')?.closest('.rolebox')?.setAttribute('hidden','');
  document.querySelectorAll('#nav .badge').forEach(x=>x.hidden=true);
  const side=document.querySelector('aside .sidefoot');if(side)side.textContent='Melisa ERP';
  document.body.classList.add('stock-workspace');
  let active=true,session;
  const alive=()=>active&&root.isConnected&&workflow.screen()==='stock';
  const label=document.createElement('span');label.id='working-catalog-user';label.textContent='Oturum açılıyor…';document.querySelector('.top-right')?.append(label);
  function showLogin(message=''){
   if(!alive())return;catalogUI?.dispose();catalogUI=null;label.textContent='Oturum gerekli';const avatar=document.getElementById('avatar');if(avatar)avatar.textContent='—';
   root.innerHTML=`<div class="heading"><div><div class="eyebrow">MELİSA ERP</div><h1>Ürün & stok</h1></div></div><section class="card panel" style="padding:20px"><h2>ERP hesabıyla giriş</h2><p role="alert">${esc(message)}</p><form id="working-catalog-login"><label>Kullanıcı adı<input class="search" name="username" autocomplete="username" required></label><label>Şifre<input class="search" name="password" type="password" autocomplete="current-password" required></label><button class="btn primary" type="submit">Giriş yap</button></form></section>`;
   root.querySelector('#working-catalog-login').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;const fields=new FormData(form),credentials={username:fields.get('username'),password:fields.get('password')};form.elements.password.value='';try{showCatalog(await session.login(credentials));}catch(error){if(alive())showLogin(error.message);}finally{credentials.password='';}};
  }
  function showCatalog(current){if(!alive())return;if(!current){showLogin();return;}showCopyActors(session,current);label.textContent=workingCatalogUserLabel(current);const avatar=document.getElementById('avatar');if(avatar)avatar.textContent=label.textContent.slice(0,1);catalogUI=createWorkCatalog({api:session.api,media:session.media,permissions:current.permissions,actorId:String(current.id),storage:storage('sessionStorage')});root.innerHTML=catalogUI.html();catalogUI.mount(root);}
  session=createWorkingCatalogSession({location:window.location,apiBase:import.meta.env.VITE_API_BASE_URL,storage:storage('sessionStorage'),onExpired:()=>showLogin('Oturumunuz sona erdi. Yeniden giriş yapın.')});
  dispose=()=>{active=false;clearReadOnlyNavigation();catalogUI?.dispose();session.dispose();};
  root.innerHTML='<section class="card panel" style="padding:20px"><p role="status">Ürün kataloğu açılıyor…</p></section>';
  session.start().then(showCatalog).catch(error=>{if(alive())showLogin(error.message);});return;
 }
 document.querySelectorAll('#nav .badge').forEach(x=>x.hidden=false);
 if(catalogAvatarBefore!==null){const avatar=document.getElementById('avatar');if(avatar)avatar.textContent=catalogAvatarBefore;catalogAvatarBefore=null;}
 if(page==='settings'){root.innerHTML=`<div class="live-heading"><div><div class="eyebrow">MELİSA ERP</div><h1>Ayarlar ve tamamlanma</h1><p>Bağlantı durumu ve günlük kullanıma geçişte kalan işler.</p></div></div>${modeSettings()}${mode==='live'?loginBox():exampleSettingsPanel()}<section class="card live-result"><h2>Çalışma kuralları</h2><p>Tek merkez · Satış ekibi terminalde fişi bitirir; İlker fişi ve tahsilatı görür.</p><p>Satış personeli kasayı kullanmaz. Tahsilatı İlker kaydeder. Gönderim ödeme veya vade kontrolünden sonra ayrı kaydedilir.</p><p>Bu kuralların gerçek kullanıcı yetkilerine uygulanması canlı kabul bekliyor.</p></section>${completionTree()}${roadmap()}`;wireLogin(root);if(mode==='demo')wireExampleSettings(root);root.querySelector('#live-mode').onchange=e=>switchMode(e.target.value);return}
 if(mode==='demo')return;
 document.body.classList.remove('stock-workspace');
 const cfg=configs[page];
 if(!cfg){const item=readiness.find(r=>r[0]===page);root.innerHTML=`<div class="live-heading"><div><div class="eyebrow">MELİSA ERP</div><h1>${esc(item?.[1]||'Günlük çalışma')}</h1></div></div><section class="live-empty"><h2>Gerçek işlem bağlantısı bekleniyor</h2><p>${esc(item?.[3]||'Kalıcı kayıt bağlantısı tamamlanacak.')}</p><button class="btn" id="live-demo">Örnek akışı incele</button><button class="btn" id="live-progress">Kalan işleri aç</button></section>`;root.querySelector('#live-demo').onclick=()=>switchMode('demo');root.querySelector('#live-progress').onclick=()=>workflow.go('settings');return}
 const isProducts=page==='stock',isAccounts=['customers','collections'].includes(page),isDocuments=!!cfg[2];
 let active=true,controller=new AbortController(),busy=false,rows=[],meta=null,loaded=false,error='',query='',kind=cfg[2],cursors=[undefined],next=null,selected=null,detail=null,detailBusy=false,generation=0,docQuery='',docState='all';
 const alive=()=>active&&root.isConnected&&workflow.screen()===page&&mode==='live';
 dispose=()=>{active=false;controller.abort();clearInterval(interval)};
 root.innerHTML=`<div class="live-heading"><div><div class="eyebrow">MELİSA ERP</div><h1>${cfg[0]}</h1><p>${cfg[1]}</p></div></div><div class="live-controls"><label>Gün<input type="date" id="live-day" value="${day}"></label><button class="btn" id="live-today">Bugün</button>${isProducts||isAccounts||isDocuments?'<form id="live-search-form"><label>Kayıt ara<input id="live-query" placeholder="Kod veya kayıt numarası"></label><button class="btn" type="submit">Ara</button></form>':''}${page==='returns'?'<label>İade türü<select id="live-return-kind"><option value="sale_stock_exit">Müşteri iadesi</option><option value="purchase_stock_entry">Tedarikçiye iade</option></select></label>':''}<button class="btn primary" id="live-refresh">Yenile</button><label><span>Otomatik yenileme</span><select id="live-auto"><option value="60">60 saniye</option><option value="0">Kapalı</option></select></label>${isDocuments?'<label>Durum<select id="live-doc-state"><option value="all">Tüm belgeler</option><option value="active">İptal edilmemiş</option><option value="cancelled">İptal</option><option value="return">İade</option></select></label>':''}</div><div id="live-summary"></div><section class="card live-result"><h2>${isDocuments?(page==='goods'?'Mal girişleri':page==='purchases'?'Fatura listesi':'Fiş listesi'):'Kayıtlar'}</h2><div id="live-status" role="status"></div><div id="live-error" role="alert"></div><div id="live-table"></div><div class="live-nav"><button class="btn" id="live-prev">Önceki</button><span id="live-page"></span><button class="btn" id="live-next">Sonraki</button></div><p class="live-source" id="live-source"></p></section><section id="live-detail"></section>${page==='home'?'<p class="live-note">Bekleyen iş, kasa, maliyet ve kâr toplamları bağlantıları doğrulandıktan sonra eklenecek.</p>':''}`;
 const interval=setInterval(()=>{if(alive()&&user&&!document.hidden&&root.querySelector('#live-auto').value!=='0'&&cursors.length===1&&!selected&&!busy){if(followToday){day=istanbulDay();root.querySelector('#live-day').value=day}load(true)}},60000);
 function reset(){generation++;controller.abort();controller=new AbortController();rows=[];meta=null;loaded=false;error='';cursors=[undefined];next=null;selected=null;detail=null;busy=false;detailBusy=false;root.querySelector('#live-detail').replaceChildren();load(true)}
 function paint(){if(!alive())return;
  const saved=savedDocuments(page,kind,day),available=loaded?rows:saved?.rows||(!user&&isAccounts?savedAccounts:[]),cards=isDocuments?available.map(r=>documentCard(r,kind,!user?savedAccountNames:{})):[];
  const summary=documentSummary(cards);
  root.querySelector('#live-summary').innerHTML=isDocuments?`<div class="grid stats"><div class="stat"><small>Listelenen belge</small><strong>${loaded||saved?available.length:'—'}</strong><small>${saved?'Kayıtlı kopyada':'Bu sayfada'}</small></div><div class="stat"><small>İptal edilmemiş</small><strong>${loaded||saved?summary.active:'—'}</strong><small>Tamamlandı anlamına gelmez</small></div><div class="stat"><small>İptal</small><strong>${loaded||saved?summary.cancelled:'—'}</strong><small>Kaynak belge işareti</small></div><div class="stat"><small>Tahsilat / gönderim</small><strong>—</strong><small>Henüz eşleştirilmedi</small></div></div>`:'';
  root.querySelector('#live-status').textContent=!user&&isAccounts?'Fişlerdeki 7 cari · Kayıtlı kopya; tüm müşteri listesi değildir. Otomatik güncellenmiyor.':saved?`Kayıtlı kopya · ${stamp(saved.readAt)} · Otomatik güncellenmiyor.`:!user?'Kayıtları yenilemek için Ayarlar’dan ERP bağlantısını açın.':busy?'Kayıtlar güncelleniyor…':error?'Son yenileme başarısız.':loaded?`${rows.length} kayıt bu sayfada · ${next?'Sonraki sayfa var':'Son sayfa'}`:'Henüz veri okunmadı.';
  root.querySelector('#live-error').innerHTML=error?`<div class="live-error">${esc(error)}${loaded?' Aşağıdaki liste son başarılı okumaya aittir.':''}</div>`:'';
  const filtered=isAccounts&&query?available.filter(r=>`${r.accountCode} ${r.name}`.toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR'))):available;
  let cols;
  if(isProducts)cols=[['stockCode','Stok kodu',(v,r)=>`<button class="link" data-product="${esc(r.sourceId)}">${val(v)}</button>`],['name','Ürün'],['brand','Marka'],['category','Grup']];
  else if(isAccounts)cols=[['accountCode','Cari kodu',(v,r)=>`<button class="link" data-account="${esc(r.sourceId)}">${val(v)}</button>`],['name','Cari adı'],['currency','Kayıtlı döviz',v=>esc(currency(v))],['groupCode','Grup']];
  const shownCards=cards.filter(r=>(!docQuery||`${r.number} ${r.account}`.toLocaleLowerCase('tr-TR').includes(docQuery))&&(docState==='all'||docState==='cancelled'&&r.cancelled===true||docState==='active'&&r.cancelled===false||docState==='return'&&r.returned===true));
  root.querySelector('#live-table').innerHTML=isDocuments?recordTable(shownCards,!loaded&&!saved?'Bu günün kayıtları henüz yüklenmedi.':'Seçili filtrede belge bulunamadı.'):table(cols,filtered,!loaded?'Kayıtlar henüz yüklenmedi.':isAccounts&&query?'Bu sayfada eşleşme bulunamadı. Diğer sayfalarda kayıt olabilir.':'Seçilen kapsamda kayıt bulunamadı.');
  root.querySelectorAll('[data-document]').forEach(b=>b.onclick=()=>openDocument(cards.find(r=>r.id===b.dataset.document),saved?.readAt||meta?.readAt));
  root.querySelector('#live-prev').disabled=busy||cursors.length===1;root.querySelector('#live-next').disabled=busy||!next;root.querySelector('#live-refresh').disabled=busy||!user;root.querySelector('#live-page').textContent=loaded?`Sayfa ${cursors.length}`:'';
  root.querySelector('#live-source').textContent=`Kaynak: VEGA2026 / F0102${isAccounts?'':' / D0007'} · Son başarılı okuma: ${stamp(meta?.readAt||saved?.readAt||(!user&&isAccounts?savedAccounts.map(r=>r.readAt).sort().at(-1):null))}${isDocuments?' · Ürün satırları, tutar, tahsilat ve sevk bağlantısı tamamlanacak.':''}${isProducts?' · Stok ve fiyat ayrıntıda okunur; seçili gün kartı geçmişe taşımaz.':''}${isAccounts&&query?' · Arama yalnız yüklenen sayfada yapılır.':''}${cursors.length>1||selected?' · Ayrıntı ve sonraki sayfalarda otomatik yenileme duraklatıldı.':''}`;
  root.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>openProduct(b.dataset.product));root.querySelectorAll('[data-account]').forEach(b=>b.onclick=()=>openAccount(b.dataset.account));
 }
 async function load(refresh=false){if(!alive()||busy||!user){paint();return}busy=true;error='';const version=++generation;paint();try{
   let result;const params={limit:50,cursor:cursors.at(-1)};
   if(isProducts||isAccounts){const path=isProducts?(query?'/api/vega-read/products/search':'/api/vega-read/products'):'/api/vega-read/accounts';const r=await client.get(path,{...params,...(isProducts&&query?{q:query}:{})},{signal:controller.signal});const p=normalizePage(r,isProducts?'stock-card':'account-card',{cursor:params.cursor});result={rows:p.rows,meta:p.meta,nextCursor:p.meta.pagination?.hasMore?p.meta.pagination.nextCursor:null}}
   else {Object.assign(params,dayRange(day),{kind},page==='returns'?{returns:true}:{});result=operationPage(await client.get('/api/vega-read/documents',params,{signal:controller.signal}),params)}
   if(!alive()||version!==generation)return;rows=result.rows;meta=result.meta;next=result.nextCursor;loaded=true;
  }catch(cause){if(alive()&&version===generation&&cause.name!=='AbortError'){error=message(cause);if(cause.status===401||cause.status===403){rows=[];loaded=false;meta=null;next=null}}}finally{if(alive()&&version===generation){busy=false;paint()}}}
 function detailBox(title,body){root.querySelector('#live-detail').innerHTML=`<section class="card live-detail"><div class="live-heading"><h2>${esc(title)}</h2><button class="btn" id="live-detail-close">Ayrıntıyı kapat</button></div>${body}</section>`;root.querySelector('#live-detail-close').onclick=()=>{selected=null;generation++;detail=null;detailBusy=false;root.querySelector('#live-detail').replaceChildren();paint()};paint()}
 function openSavedAccount(id){
  const account=savedAccounts.find(r=>r.sourceId===String(id));if(!account)return;
  selected=`account:${id}`;
  const documents=(dailySnapshot.documents.sale_stock_exit?.rows||[]).filter(r=>String(r.FIRMANO)===String(id)).map(r=>documentCard(r,'sale_stock_exit',savedAccountNames));
  detailBox(account.name,`<p>Cari kodu: ${esc(account.accountCode)} · Kayıtlı döviz: ${esc(currency(account.currency))}</p><h3>${esc(dailySnapshot.date)} tarihli fişler</h3>${recordTable(documents,'Bu kopyada ilişkili fiş bulunamadı.')}<p class="live-note">Bu fişlerden açık bakiye veya tahsilat toplamı hesaplanmadı. Cari hareketleri ve ödeme eşleştirmesi henüz bağlı değil.</p><p class="live-source">Cari kartı okuma: ${stamp(account.readAt)} · Fişler: ${stamp(dailySnapshot.documents.sale_stock_exit.readAt)} · Otomatik güncellenmez.</p>`);
  root.querySelector('#live-detail').querySelectorAll('[data-document]').forEach(b=>b.onclick=()=>openDocument(documents.find(r=>r.id===b.dataset.document),dailySnapshot.documents.sale_stock_exit.readAt));
 }
 function openDocument(record,readAt){
  if(!record)return;selected=record.id;
  detailBox(`Fiş · ${record.number}`,`<div class="live-document-grid"><div><small>Cari</small><strong>${esc(record.account)}</strong></div><div><small>Belge tarihi</small><strong>${date(record.date)}</strong></div><div><small>Döviz</small><strong>${esc(currency(record.currency))}</strong></div><div><small>Belge durumu</small><strong>${esc(record.state)}</strong></div></div>${!user&&savedAccountNames[record.accountId]?'<button class="btn" id="live-related-account">Cari kartını aç</button>':''}<h3>Ürün satırları</h3><p>Bu belgenin ürün satırları henüz bağlanmadı. Miktar ve toplam tutar doğrulanmadı.</p><div class="live-document-grid"><div><small>Tahsilat</small><strong>Henüz eşleştirilmedi</strong></div><div><small>Kalan borç</small><strong>Henüz hesaplanmadı</strong></div><div><small>Gönderim</small><strong>Henüz eşleştirilmedi</strong></div></div><p class="live-note">İşlem kaydetme bağlantısı tamamlanmadığı için bu fişte değişiklik yapılamıyor.</p><p class="live-source">Kaynak: VEGA · Belge kimliği ${esc(record.id)} · Okuma: ${stamp(readAt)}</p>`);
  const accountButton=root.querySelector('#live-related-account');if(accountButton)accountButton.onclick=()=>openSavedAccount(record.accountId);
 }
 async function openProduct(id){if(busy||detailBusy)return;selected=id;detailBusy=true;const version=++generation;detailBox('Ürün ayrıntısı','<p role="status">Stok, birim ve fiyatlar okunuyor…</p>');try{const r=verifyDetail(await client.get(readPaths.product(id),{},{signal:controller.signal}),'stock-card',id);if(!alive()||version!==generation)return;const d=r.data;detailBox(d.product.name,`<p>${val(d.product.stockCode)} · ${val(d.product.brand)}</p><h3>Stok</h3>${table([['erp_quantity','Miktar',amount],['source_unit','Birim']],d.stock,'Stok bilgisi yok; sıfır kabul edilmedi.')}<h3>Barkod ve birim</h3>${table([['BIRIMADI','Birim'],['BARCODE','Barkod'],['CARPAN','Kaynak çarpanı',amount]],d.units)}<h3>Kayıtlı fiyatlar</h3>${table([['unit','Birim'],['label','Fiyat türü'],['amount','Tutar',amount],['currency','Döviz',v=>esc(currency(v))]],priceRows(d.prices))}<p class="live-source">Okuma: ${stamp(r.meta.readAt)} · Birimler otomatik çevrilmez.</p><p class="live-note">Doğrulanmış maliyet ve kâr hesabı henüz bağlı değil.</p>`)}catch(cause){if(alive()&&version===generation)detailBox('Ürün ayrıntısı',`<p class="live-error">${esc(message(cause))}</p>`)}finally{if(version===generation)detailBusy=false}}
 async function openAccount(id,cursor){if(!user){openSavedAccount(id);return}if(busy||detailBusy)return;selected=id;detailBusy=true;const version=++generation;detailBox('Cari hareketleri','<p role="status">Seçili günün cari hareketleri okunuyor…</p>');try{const params={...dayRange(day),limit:50,...(cursor?{cursor}:{})};const r=operationPage(await client.get(readPaths.ledger(id),params,{signal:controller.signal}),params);if(!alive()||version!==generation)return;if(r.rows.some(row=>String(row.account_id)!==id))throw new Error('Cari kimliği eşleşmiyor.');detailBox('Cari hareketleri',`<p>${esc(day)} · Borç/alacak hareketleri. Tahsil edilmiş bakiye veya vadesi geçmiş borç hesabı değildir.</p>${table([['transaction_date','Tarih',date],['account_name','Cari'],['currency','Döviz'],['debit_original','Borç',amount],['credit_original','Alacak',amount],['balance_effect','Hareket etkisi',amount],['is_return','İade',v=>v===true?'Evet':v===false?'Hayır':'Bilinmiyor']],r.rows)}${r.nextCursor?'<button class="btn" id="live-ledger-next">Sonraki hareketler</button>':''}<p class="live-source">Okuma: ${stamp(r.meta.readAt)} · Dövizler birleştirilmez.</p>`);const nextButton=root.querySelector('#live-ledger-next');if(nextButton)nextButton.onclick=()=>openAccount(id,r.nextCursor)}catch(cause){if(alive()&&version===generation)detailBox('Cari hareketleri',`<p class="live-error">${esc(message(cause))}</p>`)}finally{if(version===generation)detailBusy=false}}
 root.querySelector('#live-day').onchange=e=>{try{dayRange(e.target.value);day=e.target.value;followToday=false;reset()}catch(cause){error=cause.message;paint()}};
 root.querySelector('#live-today').onclick=()=>{day=istanbulDay();followToday=true;root.querySelector('#live-day').value=day;reset()};
 root.querySelector('#live-refresh').onclick=()=>reset();root.querySelector('#live-prev').onclick=()=>{if(busy)return;cursors.pop();selected=null;root.querySelector('#live-detail').replaceChildren();load()};root.querySelector('#live-next').onclick=()=>{if(busy||!next)return;cursors.push(next);selected=null;root.querySelector('#live-detail').replaceChildren();load()};
 const search=root.querySelector('#live-search-form');if(search)search.onsubmit=e=>{e.preventDefault();query=root.querySelector('#live-query').value.trim();if(isDocuments){docQuery=query.toLocaleLowerCase('tr-TR');paint()}else reset()};
 const statusFilter=root.querySelector('#live-doc-state');if(statusFilter)statusFilter.onchange=e=>{docState=e.target.value;paint()};
 const returns=root.querySelector('#live-return-kind');if(returns)returns.onchange=e=>{kind=e.target.value;reset()};
 paint();load();
}
// The later demo module performs the initial render. Start auth only after
// all deferred modules finish, so it cannot abort a successful cookie rotation.
let workflowBootReady=document.readyState==='complete';
document.addEventListener('workflow-render',()=>{if(workflowBootReady)mount();});
window.addEventListener('storage',e=>{if(['stock','home','sales','receipts','customers','collections','goods','purchases','suppliers','supplier-payments','count','returns'].includes(workflow.screen()))return;if(['melisaVegaProductsAccessToken','melisaVegaProductsRefreshToken'].includes(e.key)){user=null;dispose();workflow.render();restore()}});
async function restore(){if(!client.hasSession()||authBusy)return;authBusy=true;paintToolbar();try{const r=await client.get('/api/auth/me');if(!Array.isArray(r.data?.permissions))throw new Error('ERP yetkileri eksik.');user=r.data}catch{user=null}finally{authBusy=false;workflow.render()}}
function bootWorkingScreen(){workflowBootReady=true;mount();if(mode==='live'&&!['stock','home','sales','receipts','customers','collections','goods','purchases','suppliers','supplier-payments','count','returns','reports','settings'].includes(workflow.screen()))restore();}
if(workflowBootReady)bootWorkingScreen();else document.addEventListener('DOMContentLoaded',bootWorkingScreen,{once:true});
