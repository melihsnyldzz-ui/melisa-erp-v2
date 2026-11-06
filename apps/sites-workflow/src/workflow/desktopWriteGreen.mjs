// Separate v2 entry; loading the old read-only entry is unaffected.
import {createDesktopWriteGreenCore} from './desktopWriteGreenCore.mjs';
import {mountDesktopCustomerCreate} from './desktopCustomerCreate.mjs';
import {mountDesktopProductCreate} from './desktopProductCreate.mjs';
import {mountDesktopProductCard} from './desktopProductCard.mjs';
import './desktopMasterCards.css';
import {mountDesktopSupplierCreate} from './desktopSupplierCreate.mjs';
import {mountDesktopWorkflowScreen} from './desktopWorkflowScreen.mjs';
const core=createDesktopWriteGreenCore({location,fetch:window.fetch.bind(window),sessionStorage,localStorage,locks:navigator.locks,newId:()=>crypto.randomUUID(),richCards:true});
const nav=document.getElementById('nav'),view=document.getElementById('view'),label=document.getElementById('user-label'),crumb=document.getElementById('crumb'),logout=document.getElementById('logout');
const pages=[['home','⌂','Ana sayfa'],['products','▦','Ürün & stok'],['customers','♙','Müşteriler'],['suppliers','▧','Tedarikçiler'],['sales','▤','Satış ve hazırlama'],['receipts','▣','Fişler']];
const pending=['Alış','Stok hareketleri','Cari','Finans','Raporlar'];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sequence=0,mounted=null;
function dispose(){mounted?.dispose();mounted=null;}
function navigation(active){nav.innerHTML=pages.filter(([id])=>id==='home'||core.can(id)).map(([id,icon,title])=>`<button type="button" data-page="${id}" class="${id===active?'active':''}">${icon} <span>${esc(title)}</span></button>`).join('')+pending.map(title=>`<button type="button" disabled>◌ <span>${esc(title)} · Hazırlanıyor</span></button>`).join('');
 nav.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>show(button.dataset.page)));}
function login(message=''){sequence++;dispose();navigation('');label.textContent='Giriş bekleniyor';crumb.textContent='Giriş';logout.hidden=true;
 view.innerHTML=`<section class="card panel" style="padding:24px;max-width:480px"><p class="eyebrow">MELİSA ERP</p><h1>Giriş yap</h1><form id="green-login"><p><label>Kullanıcı adı<br><input name="username" autocomplete="username" required></label></p><p><label>Parola<br><input name="password" type="password" autocomplete="current-password" required></label></p><button class="btn primary" type="submit">Giriş yap</button><p role="alert">${esc(message)}</p></form></section>`;
 view.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,data=new FormData(form),button=form.querySelector('button');button.disabled=true;try{await core.login(data.get('username'),data.get('password'));form.elements.password.value='';await show('home');}catch{form.elements.password.value='';login('Giriş doğrulanamadı.');}});
}
async function show(page,number=1,search=''){if(!core.getUser())return login();if(page!=='home'&&!core.can(page))return show('home');
 try{if(mounted?.requestClose&&!mounted.requestClose()){const status=view.querySelector('[role="status"]');if(status)status.textContent='Önce değişiklikleri kaydedin veya son işlemi doğrulayın.';return;}}catch{return;}
 const current=++sequence;dispose();const entry=pages.find(x=>x[0]===page);if(!entry)return;navigation(page);const user=core.getUser();label.textContent=user.displayName||user.username;crumb.textContent=entry[2];logout.hidden=false;
 if(page==='home'){view.innerHTML='<div class="heading"><div><p class="eyebrow">MELİSA ERP</p><h1>Hoş geldiniz</h1><p class="sub">Yetkiniz dahilindeki kartlara sol menüden ulaşabilirsiniz.</p></div></div>';return;}
 if(page==='sales'){mounted=mountDesktopWorkflowScreen({root:view,core,storage:localStorage,actorId:String(user.id)});return;}
 const editable=core.can(page,'edit');view.innerHTML=`<div class="heading"><div><p class="eyebrow">YEREL KURULUM</p><h1>${esc(entry[2])}</h1></div>${editable?'<button type="button" class="btn primary" data-create>Yeni kart</button>':''}</div><div data-form></div><section data-list class="card panel" style="padding:20px"><p role="status">Liste okunuyor…</p></section>`;
 if(editable)view.querySelector('[data-create]').addEventListener('click',()=>{if(!core.can(page,'edit'))return;dispose();try{const controller=core.create(page),mount=page==='customers'?mountDesktopCustomerCreate:page==='suppliers'?mountDesktopSupplierCreate:mountDesktopProductCreate;mounted=mount({root:view.querySelector('[data-form]'),controller,richCards:true,loadSuppliers:(page,search)=>core.list('suppliers',page,search),onCommitted:()=>{void show(page,number);}});}catch{view.querySelector('[data-form]').textContent='Kart işlemi başlatılamadı.';}});
 try{const result=await core.list(page,number,search);if(current!==sequence)return;const root=view.querySelector('[data-list]'),names={products:['productName','stockCode'],customers:['customerName','customerCode'],suppliers:['supplierName','supplierCode']}[page];
  const extraHead=page==='products'?'<th>Marka</th><th>Ürün türü</th><th>Ana tedarikçi</th><th>Stok</th><th>Birim</th><th>Satış fiyatı</th>':page==='customers'?'<th>Şehir / ülke</th><th>Bakiye</th>':page==='suppliers'?'<th>Şehir / ülke</th><th>Para birimi</th>':'';
  const extraCells=row=>page==='products'?`<td>${esc(row.brand||'—')}</td><td>${esc(row.category||'—')}</td><td>${esc(row.supplierName||'—')}</td><td>${esc(row.currentStockExact3)}</td><td>${esc(row.unit)}</td><td>${esc(row.salePriceExact4)} ${esc(row.currency)}</td>`:page==='customers'?`<td>${esc([row.city,row.country].filter(Boolean).join(' / '))}</td><td>${esc(row.balanceExact4)} ${esc(row.currency)}</td>`:page==='suppliers'?`<td>${esc([row.city,row.country].filter(Boolean).join(' / '))}</td><td>${esc(row.currency)}</td>`:'';
  const receipts=page==='receipts',products=page==='products',states={DRAFT:'Taslak',PREPARING:'Hazırlanıyor',READY:'Hazır',CHECKED:'Son kontrol tamam',COMPLETED:'Tamamlandı',CANCELLED:'İptal'};
  const head=receipts?'<th>Fiş no</th><th>Müşteri</th><th>Tarih</th><th>Durum</th><th>Toplam</th><th></th>':`<th>Ad</th><th>Kod</th>${extraHead}${products&&editable?'<th></th>':''}`;
  const cells=row=>receipts?`<td>${esc(row.documentNo)}</td><td>${esc(row.customerName)}</td><td>${esc(row.documentDate)}</td><td>${esc(states[row.workflowState])}</td><td>${esc(row.totalExact4)} ${esc(row.currency)}</td><td><button type="button" class="btn small" data-open-invoice="${esc(row.id)}">Fişi aç</button></td>`:`<td>${esc(row[names[0]])}</td><td>${esc(row[names[1]])}</td>${extraCells(row)}${products&&editable?`<td><button type="button" class="btn small" data-open-product="${esc(row.id)}">Kartı aç</button></td>`:''}`;
  const searchForm=receipts?`<p><input data-receipt-search aria-label="Fiş veya müşteri ara" value="${esc(search)}" maxlength="100"><button type="button" data-search-receipts>Ara</button></p>`:products?`<div class="desktop-product-search"><input data-product-search aria-label="Kod, ad veya barkod ara" value="${esc(search)}" maxlength="100"><button class="btn" type="button" data-search-products>Ara</button></div>`:'';
  root.innerHTML=searchForm+(result.data.length?`<div class="tablewrap"><table><thead><tr>${head}</tr></thead><tbody>${result.data.map(row=>`<tr>${cells(row)}</tr>`).join('')}</tbody></table></div>`:'<p>Henüz kayıt yok.</p>')+`<div><button type="button" data-previous ${number===1?'disabled':''}>Önceki</button> <span>Sayfa ${number}</span> <button type="button" data-next ${result.meta.hasNextPage?'':'disabled'}>Sonraki</button></div>`;
  root.querySelector('[data-search-receipts]')?.addEventListener('click',()=>show(page,1,root.querySelector('[data-receipt-search]').value));
  root.querySelector('[data-search-products]')?.addEventListener('click',()=>show(page,1,root.querySelector('[data-product-search]').value));
  root.querySelector('[data-product-search]')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();void show(page,1,event.currentTarget.value);}});
  root.querySelectorAll('[data-open-product]').forEach(button=>button.addEventListener('click',()=>{
   if(!core.can('products','edit'))return;dispose();const formRoot=view.querySelector('[data-form]');
   mounted=mountDesktopProductCard({root:formRoot,productId:button.dataset.openProduct,load:id=>core.productCard(id),onClose:()=>{dispose();formRoot.innerHTML='';}});
  }));
  root.querySelectorAll('[data-open-invoice]').forEach(button=>button.addEventListener('click',()=>{localStorage.setItem('melisa.desktop.workflow.last.v1.'+String(user.id),button.dataset.openInvoice);void show('sales');}));
  root.querySelector('[data-previous]').addEventListener('click',()=>show(page,number-1,search));root.querySelector('[data-next]').addEventListener('click',()=>show(page,number+1,search));
 }catch{if(current===sequence)view.querySelector('[data-list]').innerHTML='<p role="alert">Liste okunamadı.</p>';}
}
logout.addEventListener('click',()=>{try{if(mounted?.requestClose&&!mounted.requestClose()){const status=view.querySelector('[role="status"]');if(status)status.textContent='Çıkmadan önce değişiklikleri kaydedin veya son işlemi doğrulayın.';return;}}catch{return;}sequence++;dispose();void core.logout();login();});
window.addEventListener('beforeunload',event=>{try{if(mounted?.requestClose&&!mounted.requestClose()){event.preventDefault();event.returnValue='';}}catch{event.preventDefault();event.returnValue='';}});
core.restore().then(user=>user?show('home'):login());
