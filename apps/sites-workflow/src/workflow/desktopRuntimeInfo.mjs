import {isDesktopRuntimeInfo} from '../../../../packages/shared/src/desktopRuntimeInfo.mjs';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountDesktopRuntimeInfo({root,load}={}){
 if(!root||typeof load!=='function')throw Error('DESKTOP_RUNTIME_INFO_INVALID');let disposed=false;
 root.innerHTML='<section class="card panel desktop-product-card"><p role="status">Kurulum bilgisi okunuyor…</p></section>';
 void (async()=>{try{const value=await load();if(disposed)return;if(!isDesktopRuntimeInfo(value))throw Error();
  const fields=[['Sürüm',value.packageSha256.slice(0,12)],['SQL örneği',value.server],['Veritabanı',value.database],['Şema sürümü',value.schemaVersion],['Paket oluşturulma zamanı (UTC)',value.createdAt.replace('T',' ').replace('Z','')],['Erişim','Yalnız bu bilgisayarda'],['Tam paket kimliği',value.packageSha256]];
  root.innerHTML=`<section class="card panel desktop-product-card" aria-label="Kurulum bilgisi"><h2>Yerel deneme kurulumu</h2><p>Bu sürüm deneme veritabanında çalışır; işletme teslimi henüz tamamlanmadı.</p><dl class="desktop-product-details">${fields.map(([label,text])=>`<div><dt>${esc(label)}</dt><dd>${esc(text)}</dd></div>`).join('')}</dl></section>`;
 }catch{if(!disposed)root.innerHTML='<section class="card panel desktop-product-card"><p role="alert">Kurulum bilgisi okunamadı. Oturumu ve yerel bağlantıyı kontrol edip Kurulum bilgisini göster düğmesiyle tekrar deneyin.</p></section>';}})();return Object.freeze({dispose(){disposed=true;}});
}
