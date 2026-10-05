import {catalogPhotoUrl} from './workCatalogModel.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const catalogPhotoPlaceholder=(state='missing')=>`<span aria-hidden="true">▧</span><strong>${state==='loading'?'Fotoğraf açılıyor…':state==='error'?'Fotoğraf şu anda açılamıyor':'Fotoğraf henüz bağlı değil'}</strong>${state==='missing'?'<small>Doğrulanmış ürün fotoğrafı burada görünecek.</small>':''}`;
export function createCatalogPhotoLoader({media,urls=globalThis.URL}={}){
 let generation=0,controller=null,objectUrl=null,host=null;
 function clear(){generation++;controller?.abort();controller=null;if(objectUrl!==null){urls.revokeObjectURL(objectUrl);objectUrl=null;}host=null;}
 async function show(slot,row,{variant='preview'}={}){
  clear();host=slot;if(!slot)return;const n=generation,alive=()=>generation===n&&host===slot&&slot.isConnected;
  try{
   const preview=catalogPhotoUrl(row.photo,row),path=variant==='thumbnail'&&preview!==null?row.photo.thumbnailUrl:preview;if(path===null){slot.innerHTML=catalogPhotoPlaceholder();return;}
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
export function createCatalogThumbnailLoader({media,urls=globalThis.URL,Observer=globalThis.IntersectionObserver,concurrency=3}={}){
 if(!Number.isInteger(concurrency)||concurrency<1||concurrency>3)throw Error('Geçersiz fotoğraf yükleme sınırı.');
 let generation=0,observer=null,records=[],queue=[],running=0,scrollRoot=null,scan=null;
 function clear(){generation++;observer?.disconnect();observer=null;if(scan)scrollRoot?.removeEventListener?.('scroll',scan);scan=null;scrollRoot=null;records.forEach(r=>r.loader?.dispose());records=[];queue=[];running=0;}
 function pump(n){while(n===generation&&running<concurrency&&queue.length){const record=queue.shift();if(!record.slot.isConnected)continue;running++;record.loader=createCatalogPhotoLoader({media,urls});record.loader.show(record.slot,record.row,{variant:'thumbnail'}).finally(()=>{if(n!==generation)return;running--;pump(n);});}}
 function mount(root,entries){
  clear();const n=generation;scrollRoot=root;records=entries.filter(({slot,row})=>slot&&row.photo.status==='available').map(r=>({...r,queued:false,loader:null}));
  const enqueue=slot=>{const r=records.find(r=>r.slot===slot);if(!r||r.queued||n!==generation)return;r.queued=true;observer?.unobserve(slot);queue.push(r);pump(n);};
  if(typeof Observer==='function'){observer=new Observer(events=>events.forEach(event=>{if(event.isIntersecting)enqueue(event.target);}),{root:null,threshold:0.01});records.forEach(r=>observer.observe(r.slot));}
  else{scan=()=>{const bounds=root?.getBoundingClientRect?.();if(!bounds)return;records.forEach(r=>{const b=r.slot.getBoundingClientRect?.();if(b&&b.bottom>Math.max(0,bounds.top)&&b.top<Math.min(globalThis.innerHeight??bounds.bottom,bounds.bottom))enqueue(r.slot);});};root?.addEventListener?.('scroll',scan);scan();}
 }
 return {mount,clear,dispose:clear};
}
