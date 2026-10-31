import {workingCatalogUserLabel} from './workingCatalogSession.mjs';
import {catalogEnvelope,catalogPath,catalogExact} from './workCatalogModel.mjs';
import {supplierListEnvelope,supplierListPath} from './testSuppliersModel.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Existing authenticated catalog/party readers only. This view does not create
// a receiving actor, map the native test warehouse, select a trade supplier,
// expose another actor's receipts, or provide a commercial request method.
export function createBusinessReceivingRead({root,session,user,navigate=()=>{}}={}){
 if(String(user?.id)!=='17'||user?.username!=='unified-semih-test'||user?.role?.code!=='unified_test_semih'||Number(user?.role?.id)!==17||user?.isAdmin===true||!Array.isArray(user.permissions))throw Error('Mal kabul görüntüleme kimliği doğrulanamadı.');
 let active=false,revision=0,products=null,suppliers=null,productError='',supplierError='',productQuery='',supplierQuery='',busy=false;
 const paint=()=>{if(!active||!root?.isConnected)return;
 root.innerHTML=`<p class="inbound-note">Depo: <strong>MERKEZ</strong> · Sorumlu: <strong>${esc(workingCatalogUserLabel(user))}</strong></p><p class="inbound-note">Ürün ve tedarikçi kartlarını kontrol edebilirsiniz. Mal kabul kaydı, gönderim ve onay henüz açık değil.</p><div class="inbound-grid"><section class="card inbound-panel"><h2>Tedarikçi kartları</h2><form data-read-supplier-search><label>Tedarikçi adı veya kodu<input name="search" value="${esc(supplierQuery)}" maxlength="120" autocomplete="off"></label><button class="btn" ${busy?'disabled':''}>Tedarikçi ara</button></form><p role="status">${esc(supplierError|| (suppliers?`${suppliers.meta.total} tedarikçi · Bu sayfada ${suppliers.data.length}`:'Tedarikçiler okunuyor…'))}</p>${suppliers?suppliers.data.slice(0,5).map(s=>`<article class="inbound-record"><strong>${esc(s.supplierName??s.supplierCode)}</strong><p>${esc(s.supplierCode)} · ${s.quarantine.blocked===true?'İnceleme bekliyor':s.quarantine.blocked===false?'Kartı görüntülenebilir':'Durumu doğrulanmadı'}</p></article>`).join(''):''}<button class="btn" data-read-suppliers>Tedarikçi ekranını aç</button></section><section class="card inbound-panel"><h2>Ürün kontrolü</h2><form data-read-product-search><label>Ürün kodu veya adı<input name="search" value="${esc(productQuery)}" maxlength="120" autocomplete="off"></label><button class="btn" ${busy?'disabled':''}>Ürün ara</button></form><p role="status">${esc(productError||(products?`${products.meta.total} ürün · Bu sayfada ${products.data.length}`:'Ürünler okunuyor…'))}</p>${products?products.data.slice(0,5).map(p=>`<article class="inbound-record"><strong>${esc(p.stockCode)}</strong><p>${esc(p.productName??'')} · ${p.stockQuantityExact===null?'Stok bilinmiyor':esc(catalogExact(p.stockQuantityExact))} ${esc(p.unit.label??'Birim bilinmiyor')}</p><p>${p.hold.blocked?'İnceleme bekliyor':'Kartı görüntülenebilir'}</p></article>`).join(''):''}<button class="btn" data-read-products>Ürün ve stok ekranını aç</button></section></div><button class="btn" data-read-refresh ${busy?'disabled':''}>Kartları yenile</button>`;
 root.querySelector('[data-read-suppliers]').onclick=()=>navigate('suppliers');root.querySelector('[data-read-products]').onclick=()=>navigate('stock');root.querySelector('[data-read-refresh]').onclick=load;
 for(const [selector,kind] of [['[data-read-supplier-search]','supplier'],['[data-read-product-search]','product']]){const form=root.querySelector(selector);form.onsubmit=e=>{e.preventDefault();if(busy)return;const value=form.elements.search.value.trim();if(value.length>120)return;if(kind==='supplier')supplierQuery=value;else productQuery=value;load();};}
 };
 async function load(){if(!active||busy)return;const n=++revision;busy=true;productError='';supplierError='';paint();
 const [p,s]=await Promise.allSettled([
  user.permissions.includes('product.view')?Promise.resolve().then(()=>session.api(catalogPath({search:productQuery,status:'active'}),{envelope:true})).then(v=>catalogEnvelope(v,{salesPermission:user.permissions.includes('sales.view')})):Promise.reject(Error()),
  user.permissions.includes('supplier.view')?Promise.resolve().then(()=>session.suppliers(supplierListPath({search:supplierQuery,status:'active'}),{envelope:true})).then(supplierListEnvelope):Promise.reject(Error())
 ]);if(!active||n!==revision)return;
 products=p.status==='fulfilled'?p.value:null;suppliers=s.status==='fulfilled'?s.value:null;
 if(!products)productError='Ürün kartları şu anda okunamıyor.';if(!suppliers)supplierError='Tedarikçi kartları şu anda okunamıyor.';busy=false;paint();
 }
 return{mount(){active=true;void load();},dispose(){active=false;revision++;root=null;}};
}
