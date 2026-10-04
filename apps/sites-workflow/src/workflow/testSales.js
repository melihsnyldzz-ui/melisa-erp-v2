import {testMigrationQuarantine} from './testMigrationQuarantine.js';
import {testCustomers} from './testCustomers.js';
let customerUI=null;
import {testSuppliers} from './testSuppliers.js';
let supplierUI=null;
let quarantineUI=null;
import {testPrices} from './testPrices.js';
let priceUI=null;
import {testRefund} from './testRefund.js';
let refundData=null,refundUI=null;
import {testDaily} from './testDaily.js';
let dailyData={},dailyUI=null;
import {testPayment} from './testPayment.js';
let paymentData=null,paymentUI=null;
import './testSales.css';
import {normalizeTestInvoiceList} from './testSalesModel.js';
import {testFinance} from './testFinance.js';
import {testPurchase} from './testPurchase.js';
let purchaseData=null,purchaseUI=null;
let financeData=null,financeUI=null,fxData=null;
const BASE=import.meta.env.VITE_API_BASE_URL;
if(BASE!=='http://127.0.0.1:4144')throw Error('TEST API hedefi doğrulanmadı.');
const view=document.getElementById('view'),nav=document.getElementById('nav');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+' TRY';
const tokenKey='melisaTestSalesAccessToken';
let token=sessionStorage.getItem(tokenKey),user=null,scope=null,product=null,customer=null,invoices=[],busy=false,connected=false,error='',notice='',generation=0;
const pages=[['home','⌂','İş sırası'],['stock','▦','Ürün & stok'],['customers','♙','Müşteriler'],['suppliers','▧','Tedarikçiler'],['sales','▣','Satış terminali'],['receipts','≡','Satış fişleri']];
pages.push(['prices','₺','Fiyat & maliyet']);
pages.push(['migration-quarantine','⚑','Aktarım karantinası']);
pages.push(['finance','₺','Tahsilat'],['fx','€','Döviz tahsilatı']);
pages.push(['supplier-refund','₺','Tedarikçiden para dönüşü']);
pages.push(['goods','▤','Mal kabulü'],['purchases','▧','Alış faturaları']);
pages.push(['return-purchase','↩','Tedarikçiye iade'],['return-sales','↪','Müşteri iadesi'],['count-test','☷','Sayım'],['return-cancel','↶','İade iptal kabulü'],['count-cancel','↶','Sayım iptal kabulü']);
const has=p=>user?.permissions?.includes(p);
const page=()=>pages.some(x=>x[0]===location.hash.slice(1))?location.hash.slice(1):'home';
const pendingKey=()=>`melisa-test-sale-v1:${user?.id}`;
function pending(){try{return JSON.parse(localStorage.getItem(pendingKey())||'null')}catch{return null}}
function remember(value){localStorage.setItem(pendingKey(),JSON.stringify(value))}
async function api(path,{method='GET',body,envelope=false}={}){
 let response,payload;
 try{response=await fetch(BASE+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)});payload=await response.json()}
 catch{throw Error('TEST bağlantısı kurulamadı. Örnek veriye geçilmedi. İşlem sonucu belirsizse aynı istek kimliğiyle tekrar doğrulayın.')}
 if(!response.ok||payload.success!==true)throw Object.assign(Error(payload.error?.message||`TEST isteği reddedildi (${response.status}).`),{code:payload.error?.code,status:response.status});
 return envelope?payload:payload.data;
}
function role(){
 document.querySelector('.rolebox').innerHTML=`<label>GERÇEK TEST OTURUMU</label><strong class="test-user">${esc(user?.displayName||'Giriş bekleniyor')}</strong><small>${esc(user?.role?.name||'Yetki seçicisi yok')}</small>`;
 document.getElementById('avatar').textContent=(user?.displayName||'?')[0];
 document.querySelector('.sidefoot').innerHTML='<strong>TEST veritabanı</strong><br>LIVE’dan ayrı TEST<br>Yazma: ayrılmış deneme kayıtları<br>Dış entegrasyonlar kapalı<br><a href="/ornek-akis.html">Ayrı örnek akışı aç ↗</a>';
 const r=document.getElementById('mobileRole');r.disabled=true;r.innerHTML=`<option>${esc(user?.displayName||'Giriş gerekli')}</option>`;
}
function header(){
 const name=pages.find(x=>x[0]===page())?.[2];document.getElementById('crumb').textContent=name;
 nav.innerHTML=pages.map(([id,icon,label])=>`<button data-page="${id}" class="${page()===id?'active':''}">${icon} <span>${label}</span></button>`).join('');
 nav.querySelectorAll('button').forEach(b=>b.onclick=()=>location.hash=b.dataset.page);
 document.getElementById('business-date').textContent=new Date().toLocaleDateString('tr-TR');
 role();
}
const rows=()=>invoices.map(i=>`<tr><td><button class="link" data-detail="${i.id}">${esc(i.documentNo)}</button><br><small>Fiş #${i.id}</small></td><td>${esc(i.customerName)}</td><td>${money(i.grandTotal)}</td><td>${esc(i.status)}</td><td>${has('sales.cancel')&&i.status==='FINALIZED'?`<button class="btn small" data-cancel="${i.id}">İptal et</button>`:'—'}</td></tr>`).join('');
function invoiceTable(){return `<div class="tablewrap"><table><thead><tr><th>Fiş</th><th>TEST müşteri</th><th>Tutar</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>${rows()||'<tr><td colspan="5">TEST veritabanında henüz fiş yok.</td></tr>'}</tbody></table></div>`}
function render(){
 customerUI?.dispose();customerUI=null;
 supplierUI?.dispose();supplierUI=null;
 header();
 if(!user){
  view.innerHTML=`<section class="card test-login"><p class="eyebrow">MELİSA ERP · TEST</p><h1>TEST oturumunu aç</h1><p>Gerçek kullanıcı yetkisi sunucudan alınır. Örnek rol seçimi kullanılmaz.</p><form id="test-login"><label>Kullanıcı adı<input name="username" autocomplete="username" required></label><label>Şifre<input name="password" type="password" autocomplete="current-password" required></label><button class="btn primary" ${busy?'disabled':''}>Giriş yap</button></form><p role="alert" class="test-error">${esc(error)}</p><a href="/ornek-akis.html">Veritabanından ayrı örnek ekranı aç</a></section>`;
  document.getElementById('test-login').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);busy=true;error='';try{const r=await api('/api/auth/login',{method:'POST',body:{username:f.get('username'),password:f.get('password')}});token=r.accessToken;sessionStorage.setItem(tokenKey,token);await refresh()}catch(e){error=e.message}finally{busy=false;render()}};
  return;
 }
 let content='';
 if(page()==='customers'){customerUI=testCustomers({api,esc,permissions:user.permissions});content=customerUI.html();}
 else if(page()==='suppliers'){supplierUI=testSuppliers({api,esc,permissions:user.permissions,actorId:user.id});content=supplierUI.html();}
 else if(!connected){content='<section class="card"><h2>TEST verileri doğrulanamadı</h2><p>Satış kapalı. Sonuç alınana kadar örnek kayıtlar gösterilmez.</p></section>'}
 else if(page()==='home'){content=`<p class="eyebrow">MELİSA ERP · ORTAK TEST KAYITLARI</p><h1>Günlük operasyon</h1><p>Bu ekran ayrı TEST veritabanını okur; örnek localStorage kayıtlarını kullanmaz.</p><div class="stats"><div class="stat"><small>TEST ürün stoğu</small><strong id="test-stock">${product.stockQuantity} ADET</strong></div><div class="stat"><small>TEST cari borcu</small><strong id="test-balance">${money(customer.balance)}</strong></div><div class="stat"><small>Ortak TEST fişi</small><strong>${invoices.length}</strong></div></div><section class="card panel"><h2>Satış, stok ve cari</h2>${invoiceTable()}</section>`}
 else if(page()==='prices'){priceUI=has('product.view')&&has('purchase.view')?testPrices({api,esc}):null;content=priceUI?priceUI.html():'<h1>Fiyat & maliyet</h1><section class="card panel"><p>Bu rapor için ürün ve alış görüntüleme yetkisi gerekir.</p></section>'}
 else if(page()==='migration-quarantine'){quarantineUI=testMigrationQuarantine({api,esc,permissions:user.permissions});content=quarantineUI.html();}
 else if(page()==='stock'){content=`<h1>Ürün & stok</h1><section class="card panel"><p class="pill green">TEST veritabanı · yalnız izinli ürün</p><h2>${esc(product.productName)}</h2><p>${esc(product.stockCode)} · #${product.id}</p><div class="stats"><div class="stat"><small>Mevcut stok</small><strong>${product.stockQuantity} ADET</strong></div><div class="stat"><small>Birim fiyat</small><strong>${money(product.salePrice)}</strong></div></div></section>`}
 else if(page()==='receipts'){content=`<h1>Satış fişleri</h1><section class="card panel"><p>Gerçek oturum: ${esc(user.displayName)} · Kayıtlar tüm yetkili TEST oturumları için ortaktır.</p>${invoiceTable()}</section>`}
 else if(['return-purchase','return-sales','count-test','return-cancel','count-cancel'].includes(page())){const key=page()==='count-cancel'?'count-cancel':page()==='return-cancel'?'return-cancel':page()==='count-test'?'count':page().slice(7);const flow=key==='count-cancel'?'count':key==='return-cancel'?'purchase':key;dailyUI=dailyData[key]?testDaily({api,user,data:dailyData[key],flow,refresh:runRefresh,esc}):null;content=dailyUI?dailyUI.html():'<section class="card panel"><p>Bu işlem için görüntüleme yetkiniz yok.</p></section>'}
 else if(['finance','fx'].includes(page())){financeUI=testFinance({api,user,data:page()==='fx'?fxData:financeData,refresh:runRefresh,esc,mode:page()==='fx'?'fx':'standard'});content=financeUI.html()}
 else if((page()==='goods'||page()==='purchases')&&!purchaseData){content='<p>Bu oturumda mal kabulü görüntüleme yetkisi yok.</p>'}
 else if(page()==='supplier-refund'){if(!refundData)content='<p>Bu oturumda görüntüleme yetkisi yok.</p>';else{refundUI=testRefund({api,user,data:refundData,refresh:runRefresh,esc});content=refundUI.html()}}
 else if(page()==='goods'||page()==='purchases'){purchaseUI=testPurchase({api,user,data:purchaseData,refresh:runRefresh,esc,paymentData,returnData:dailyData.purchase,onPaymentDetail:id=>paymentUI.openDetail(id)});content=purchaseUI.html(page());if(page()==='purchases'&&paymentData){paymentUI=testPayment({api,user,data:paymentData,refresh:runRefresh,esc,onCancelInvoice:purchaseUI.cancelInvoice});content+=paymentUI.html()}}
 else if(page()==='sales'){
  const p=pending();content=`<h1>Satış terminali</h1><div class="test-sale-grid"><section class="card panel"><p class="pill green">VERİTABANINA YAZILAN TEST SATIŞI</p><h2>${esc(product.productName)}</h2><p>${esc(product.stockCode)} · Kullanılabilir stok: ${product.stockQuantity}</p><p>Fiyat sunucuda doğrulanır: ${money(scope.unitPrice)}</p><form id="test-sale"><label>TEST müşteri<select name="customerId"><option value="${scope.customerId}">${esc(customer.customerName)}</option></select></label><label>Adet<input name="quantity" type="number" min="1" max="5" step="1" value="${p?.body?.items?.[0]?.quantity||2}" ${p?'disabled':''}></label><button class="btn primary" ${busy||!has('sales.create')||!has('sales.finalize')||p?.invoice?'disabled':''}>TEST satışını tamamla</button></form><p class="test-note">Bu kabulde tek TEST ürün/cari, 1–5 adet ve aynı anda en fazla 5 açık fiş kullanılabilir. Tahsilat yalnız yetkili TEST oturumuna açıktır; kargo, e-posta ve WhatsApp kapalıdır.</p></section><section class="card panel"><h2>İşlem sonucu</h2>${p?`<p>İstek kimliği</p><code id="test-request-id">${esc(p.body.requestId)}</code>${p.invoice?`<h3 id="test-invoice-id">Fiş #${p.invoice.id}</h3><p>${esc(p.invoice.documentNo)} · ${esc(p.invoice.status)}</p><p>${money(p.invoice.grandTotal)}</p>`:'<p>Bu istek bekliyor. Hata veya bağlantı kopmasında aynı kimlikle doğrulayın.</p>'}<button id="test-replay" class="btn" ${busy?'disabled':''}>Aynı isteği tekrar doğrula</button>${p.invoice?'<button id="test-new" class="btn">Yeni TEST fişi</button>':''}`:'<p>Henüz satış isteği oluşturulmadı.</p>'}<p>Stok ve cari etkisi tek transaction içinde kaydedilir.</p></section></div>`;
 }
 const connectionLabel=page()==='customers'?'<b>TEST</b> · Müşteri kartları · Salt okunur':page()==='suppliers'?'<b>TEST</b> · Tedarikçi kartları · Salt okunur':`<b>TEST SQL</b> · ${connected?'Bağlı':'Bağlantı doğrulanamadı'} · Dış gönderimler kapalı`;
 view.innerHTML=`<section class="test-status card"><span>${connectionLabel}</span><div><button id="test-refresh" class="btn small" ${busy?'disabled':''}>Yenile</button><button id="test-logout" class="btn small">Oturumu kapat</button></div></section>${error?`<p class="test-error" role="alert">${esc(error)}</p>`:''}${notice?`<p class="test-success" role="status">${esc(notice)}</p>`:''}${content}`;
 document.getElementById('test-refresh').onclick=()=>runRefresh();
 document.getElementById('test-logout').onclick=()=>{generation++;token=null;sessionStorage.removeItem(tokenKey);user=null;connected=false;notice='';error='';render()};
 document.getElementById('test-sale')?.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);let p=pending();if(!p){p={body:{requestId:crypto.randomUUID(),customerId:scope.customerId,items:[{productId:scope.productId,quantity:Number(f.get('quantity'))}]}};}submit(p)});
 document.getElementById('test-replay')?.addEventListener('click',()=>submit(pending()));
 document.getElementById('test-new')?.addEventListener('click',()=>{localStorage.removeItem(pendingKey());notice='';render()});
 view.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>cancel(b.dataset.cancel));
 view.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>detail(b.dataset.detail));
 if(connected&&dailyUI&&['return-purchase','return-sales','count-test','return-cancel','count-cancel'].includes(page()))dailyUI.bind();
 if(connected&&page()==='prices')priceUI?.bind();
 if(page()==='customers')customerUI?.bind();
 if(page()==='suppliers')supplierUI?.bind();
 if(connected&&page()==='migration-quarantine')quarantineUI?.bind();
 if(connected&&['finance','fx'].includes(page()))financeUI.bind();
 if(connected&&purchaseData&&(page()==='goods'||page()==='purchases'))purchaseUI.bind();
 if(connected&&page()==='purchases'&&paymentData)paymentUI.bind();
 if(connected&&page()==='supplier-refund'&&refundData)refundUI.bind();
}
async function refresh(){
 const version=++generation;
 try{
  const me=await api('/api/auth/me');
  if(version!==generation)return;
  user=me;
  if(['customers','suppliers'].includes(page())){error='';return;}
  const ctx=await api('/api/test-sales/context');
  if(ctx.environment!=='ISOLATED_TEST'||ctx.database!=='MELISA_ERP_SIRKET_TEST_20260929_01')throw Error('TEST veritabanı kimliği uyuşmuyor.');
  const [p,c,list]=await Promise.all([api(`/api/products/${ctx.productId}`),api(`/api/customers/${ctx.customerId}`),api(`/api/sales-invoices?customerId=${ctx.customerId}&status=ALL&limit=100`)]);
  if(version!==generation)return;
  const fin=await api('/api/test-finance/context');
  const pur=me.permissions.includes('goods.view')?await api('/api/test-purchase/context'):null;
  if(version!==generation)return;
  paymentData=me.permissions.includes('purchase.view')?await api('/api/test-payment/context'):null;
  refundData=me.permissions.includes('purchase.view')?await api('/api/test-refund/context'):null;
  fxData=await api('/api/test-daily/fx/context');
  dailyData={};for(const f of ['purchase','sales','count','return-cancel','count-cancel']){
   const permission=f==='count'||f==='count-cancel'?'product.view':f==='sales'?'sales.view':'purchase.view';
   if(me.permissions.includes(permission))dailyData[f]=await api('/api/test-daily/'+f);
  }
  user=me;scope=ctx;product=p;customer=c;invoices=normalizeTestInvoiceList(list);financeData=fin;purchaseData=pur;connected=true;error='';
 }catch(e){if(version===generation){connected=false;error=e.message}throw e}
}
async function runRefresh(){busy=true;render();try{await refresh()}catch{}finally{busy=false;render()}}
async function submit(p){
 if(busy||!p||!connected)return;busy=true;error='';notice='';remember(p);render();
 try{const r=await api('/api/sales-invoices/test-complete',{method:'POST',body:p.body});remember({...p,invoice:r.invoice});notice=r.replayed?'Aynı istek doğrulandı; yeni fiş oluşturulmadı.':`TEST fişi #${r.invoice.id} tamamlandı; stok ve cari kaydı birlikte oluştu.`;await refresh()}
 catch(e){error=e.message}finally{busy=false;render()}
}
function cancel(id){
 const backdrop=document.getElementById('modalback'),modal=document.getElementById('modal');
 modal.innerHTML=`<h2>TEST fişi #${esc(id)} iptal</h2><p>Stok ve cari etkisi mevcut iptal servisiyle tersine çevrilecek.</p><form id="test-cancel-form"><label>İptal nedeni<input name="reason" minlength="5" required value="TEST kabulü — stok ve cari etkisini geri al" style="display:block;width:100%;padding:12px;margin:15px 0"></label><button class="btn primary">TEST iptalini onayla</button><button type="button" id="test-cancel-close" class="btn">Vazgeç</button></form>`;
 backdrop.style.display='flex';document.getElementById('test-cancel-close').onclick=()=>backdrop.style.display='none';
 document.getElementById('test-cancel-form').onsubmit=e=>{e.preventDefault();const reason=new FormData(e.target).get('reason');backdrop.style.display='none';submitCancel(id,reason)};
}
async function submitCancel(id,reason){
 busy=true;error='';notice='';render();
 try{const r=await api(`/api/sales-invoices/${id}/cancel`,{method:'POST',body:{reason}});notice=r.replayed?'Fiş zaten iptal edilmiş; ikinci ters hareket oluşturulmadı.':`TEST fişi #${id} iptal edildi.`;const p=pending();if(p?.invoice?.id===r.invoice.id)remember({...p,invoice:r.invoice});await refresh()}catch(e){error=e.message}finally{busy=false;render()}
}
async function detail(id){try{const i=await api(`/api/sales-invoices/${id}`);notice=`Fiş #${i.id} · ${i.documentNo} · ${i.status} · ${money(i.grandTotal)} · ${i.items.length} satır`;render()}catch(e){error=e.message;render()}}
window.addEventListener('hashchange',()=>{if(user&&!connected&&!['customers','suppliers'].includes(page()))runRefresh();else render();});
document.querySelector('.top-right button').onclick=()=>location.hash='home';
document.getElementById('mobileScreen').onchange=e=>location.hash=e.target.value;
document.title='TEST · Melisa ERP v70 · Gerçek TEST bağlantısı';
render();if(token)runRefresh();








