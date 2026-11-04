import {workingCatalogUserLabel} from './workingCatalogSession.mjs';
import {catalogEnvelope,catalogPath,catalogStockDisplay} from './workCatalogModel.mjs';
import {supplierListEnvelope,supplierListPath} from './testSuppliersModel.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Existing authenticated catalog/party readers only. No commercial writes.
export function createBusinessReceivingRead({root,session,user,navigate=()=>{}}={}){
 if(String(user?.id)!=='17'||user?.username!=='unified-semih-test'||user?.role?.code!=='unified_test_semih'||Number(user?.role?.id)!==17||user?.isAdmin===true||!Array.isArray(user.permissions))throw Error('Mal kabul görüntüleme kimliği doğrulanamadı.');
 let active=false;
 const state={product:{input:'',query:'',page:1,result:null,error:'',busy:false,version:0},supplier:{input:'',query:'',page:1,result:null,error:'',busy:false,version:0}};
 const alive=()=>active&&root?.isConnected;
 const pageButtons=(kind,s)=>s.result||s.error&&s.page>1?`<div class="inbound-actions"><button class="btn" data-read-${kind}-prev ${s.busy||s.page<=1?'disabled':''}>Önceki</button><span>Sayfa ${s.page}</span><button class="btn" data-read-${kind}-next ${s.busy||!s.result||s.page*s.result.meta.limit>=s.result.meta.total?'disabled':''}>Sonraki</button></div>`:'';
 const paint=()=>{if(!alive())return;const p=state.product,s=state.supplier;
 root.innerHTML=`<p class="inbound-note">Depo: <strong>MERKEZ</strong> · Sorumlu: <strong>${esc(workingCatalogUserLabel(user))}</strong></p><p class="inbound-note">Ürün ve tedarikçi kartlarını kontrol edebilirsiniz. Mal kabul kaydı, gönderim ve onay henüz açık değil.</p><div class="inbound-grid"><section class="card inbound-panel"><h2>Tedarikçi kartları</h2><form data-read-supplier-search><label>Tedarikçi adı veya kodu<input name="search" value="${esc(s.input)}" maxlength="120" autocomplete="off"></label><button class="btn" ${s.busy?'disabled':''}>Tedarikçi ara</button></form><p role="status">${esc(s.error||(s.result?`${s.result.meta.total} tedarikçi · Bu sayfada ${s.result.data.length}`:'Tedarikçiler okunuyor…'))}</p>${s.result?s.result.data.map(row=>`<article class="inbound-record"><strong>${esc(row.supplierName??row.supplierCode)}</strong><p>${esc(row.supplierCode)} · ${row.quarantine.blocked===true?'İnceleme bekliyor':row.quarantine.blocked===false?'Kartı görüntülenebilir':'Durumu doğrulanmadı'}</p></article>`).join(''):''}${pageButtons('supplier',s)}<button class="btn" data-read-suppliers>Tedarikçi ekranını aç</button></section><section class="card inbound-panel"><h2>Ürün kontrolü</h2><form data-read-product-search><label>Ürün kodu veya adı<input name="search" value="${esc(p.input)}" maxlength="120" autocomplete="off"></label><button class="btn" ${p.busy?'disabled':''}>Ürün ara</button></form><p role="status">${esc(p.error||(p.result?`${p.result.meta.total} ürün · Bu sayfada ${p.result.data.length}`:'Ürünler okunuyor…'))}</p>${p.result?p.result.data.map(row=>`<article class="inbound-record"><strong>${esc(row.stockCode)}</strong><p>${esc(row.productName??'')} · ${row.stockQuantityExact===null?'Stok bilinmiyor':esc(catalogStockDisplay(row))}${row.unit.verified&&!row.hold.blocked?' '+esc(row.unit.label??'Birim bilinmiyor'):''}</p><p>${row.hold.blocked?'İnceleme bekliyor':'Kartı görüntülenebilir'}</p></article>`).join(''):''}${pageButtons('product',p)}<button class="btn" data-read-products>Ürün ve stok ekranını aç</button></section></div><button class="btn" data-read-refresh ${p.busy||s.busy?'disabled':''}>Kartları yenile</button>`;
 root.querySelector('[data-read-suppliers]').onclick=()=>{if(alive())navigate('suppliers');};root.querySelector('[data-read-products]').onclick=()=>{if(alive())navigate('stock');};root.querySelector('[data-read-refresh]').onclick=()=>{if(!alive()||p.busy||s.busy)return;void load('product');void load('supplier');};
 for(const kind of ['supplier','product']){const s=state[kind],form=root.querySelector(`[data-read-${kind}-search]`);
  form.elements.search.oninput=e=>{if(alive())s.input=e.target.value;};
  form.onsubmit=e=>{e.preventDefault();if(!alive()||s.busy)return;const value=form.elements.search.value.trim();if(value.length>120)return;s.input=value;s.query=value;s.page=1;void load(kind);};
  root.querySelector(`[data-read-${kind}-prev]`)?.addEventListener('click',()=>{if(!alive()||s.busy||s.page<=1||!s.result&&!s.error)return;s.page--;void load(kind);});
  root.querySelector(`[data-read-${kind}-next]`)?.addEventListener('click',()=>{if(!alive()||s.busy||!s.result||s.page*s.result.meta.limit>=s.result.meta.total)return;s.page++;void load(kind);});
 }
 };
 async function load(kind){const s=state[kind];if(!alive()||s.busy)return;const n=++s.version,page=s.page,query=s.query;s.busy=true;s.error='';s.result=null;paint();
  try{let result;
   if(kind==='product'){if(!user.permissions.includes('product.view'))throw Error();result=catalogEnvelope(await session.api(catalogPath({search:query,page,status:'active'}),{envelope:true}),{salesPermission:user.permissions.includes('sales.view')});}
   else{if(!user.permissions.includes('supplier.view'))throw Error();result=supplierListEnvelope(await session.suppliers(supplierListPath({search:query,page,status:'active'}),{envelope:true}));}
   if(result.meta.page!==page||result.data.length!==Math.min(result.meta.limit,Math.max(0,result.meta.total-(page-1)*result.meta.limit)))throw Error();if(alive()&&n===s.version)s.result=result;
  }catch{if(alive()&&n===s.version)s.error=kind==='product'?'Ürün kartları şu anda okunamıyor.':'Tedarikçi kartları şu anda okunamıyor.';}
  finally{if(alive()&&n===s.version){s.busy=false;paint();}}
 }
 return{mount(){active=true;void load('product');void load('supplier');},dispose(){active=false;state.product.version++;state.supplier.version++;root=null;}};
}
