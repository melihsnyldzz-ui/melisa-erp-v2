import {catalogPhotoUrl} from './workCatalogModel.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const catalogPhotoPlaceholder=(state='missing')=>`<span aria-hidden="true">▧</span><strong>${state==='loading'?'Fotoğraf açılıyor…':state==='error'?'Fotoğraf şu anda açılamıyor':'Fotoğraf henüz bağlı değil'}</strong>${state==='missing'?'<small>Doğrulanmış ürün fotoğrafı burada görünecek.</small>':''}`;
export function createCatalogPhotoLoader({media,urls=globalThis.URL}={}){
 let generation=0,controller=null,objectUrl=null,host=null;
 function clear(){generation++;controller?.abort();controller=null;if(objectUrl!==null){urls.revokeObjectURL(objectUrl);objectUrl=null;}host=null;}
 async function show(slot,row){
  clear();host=slot;if(!slot)return;const n=generation,alive=()=>generation===n&&host===slot&&slot.isConnected;
  try{
   const path=catalogPhotoUrl(row.photo,row);if(path===null){slot.innerHTML=catalogPhotoPlaceholder();return;}
   if(typeof media!=='function')throw Error('media unavailable');
   controller=new AbortController();slot.innerHTML=catalogPhotoPlaceholder('loading');
   const blob=await media(path,{signal:controller.signal});if(!alive())return;
   const url=urls.createObjectURL(blob);objectUrl=url;
   slot.innerHTML=`<img class="catalog-photo-preview" alt="${esc(row.productName??row.stockCode)} ürün fotoğrafı" src="${esc(url)}" decoding="async" referrerpolicy="no-referrer">`;
   slot.querySelector('img').onerror=()=>{if(!alive())return;urls.revokeObjectURL(url);if(objectUrl===url)objectUrl=null;slot.innerHTML=catalogPhotoPlaceholder('error');};
  }catch{if(alive()){if(objectUrl!==null){urls.revokeObjectURL(objectUrl);objectUrl=null;}slot.innerHTML=catalogPhotoPlaceholder('error');}}
 }
 return {show,clear,dispose:clear};
}
