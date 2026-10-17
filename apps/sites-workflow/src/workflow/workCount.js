import {testDaily} from './testDaily.js';
import {workTaskHandoff} from './workTaskHandoff.mjs';
import './workTaskHandoff.css';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function createWorkCount({root,session,user,storage=globalThis.localStorage}){
 let active=true,busy=false,data=null,view=null,pendingWrites=0;
 const alive=()=>active&&root.isConnected;
 const api=async(path,options)=>{
  const writing=!['GET','HEAD'].includes(String(options?.method||'GET').toUpperCase());
  if(writing)pendingWrites++;
  try{return await session.inbound(path,options||{});}
  finally{if(writing)pendingWrites--;}
 };
 function unresolvedJournal(){
  try{
   if(!storage||user?.id==null)return true;
   const raw=storage.getItem(`melisa-daily-count-${user.id}`);
   if(raw==null)return false;
   const entry=JSON.parse(raw);
   if(entry===null)return false;
   return !entry||typeof entry!=='object'||Array.isArray(entry)||!entry.result||typeof entry.result!=='object'||Array.isArray(entry.result);
  }catch{return true;}
 }
 function requestClose(){
  const doc=root.ownerDocument||globalThis.document,modal=doc?.getElementById('modalback');
  const modalOpen=modal?.style?.display&&modal.style.display!=='none';
  if(!pendingWrites&&!modalOpen&&!unresolvedJournal())return true;
  const message=modalOpen?'Önce sayım penceresini kapatın; taslağınız saklanır.':'Önce sayım işleminin sonucunu kontrol edin. Sonucu doğrulanmadan kullanıcı veya ekran değiştirilemez.';
  let notice=doc?.getElementById('daily-status')||root.querySelector('[data-count-close-status]');
  if(!notice&&alive()){
   root.insertAdjacentHTML('beforeend','<p data-count-close-status role="alert"></p>');
   notice=root.querySelector('[data-count-close-status]');
  }
  if(notice){notice.textContent=message;notice.setAttribute('role','alert');}
  return false;
 }
 const status=error=>error?.status===403?'Bu sayım kayıtlarını görüntüleme veya inceleme yetkiniz yok.':'Sayım verileri şu anda açılamıyor. Yenileyip tekrar deneyin.';
 function draw(){
  if(!alive()||!data)return;
  view=testDaily({api,user,data,flow:'count',refresh,esc,normalScreen:true});
  root.innerHTML=`<div class="work-count">${workTaskHandoff('count')}${view.html()}</div>`;view.bind();
 }
 async function refresh(){
  if(!alive()||busy)return;
  busy=true;
  try{data=await api('/api/test-daily/count');draw();}
  catch(error){if(alive())root.innerHTML=`<div class="heading"><div><div class="eyebrow">STOK KONTROLÜ</div><h1>Sayım & düzeltme</h1><p class="sub">${esc(status(error))}</p></div><button class="btn primary" id="count-retry">Yenile</button></div>`;root.querySelector('#count-retry')?.addEventListener('click',refresh);}
  finally{busy=false;}
 }
 function mount(){
  if(!alive()||busy)return;
  root.innerHTML='<section class="card panel" style="padding:20px"><p role="status">Sayım bilgileri açılıyor…</p></section>';
  refresh();
 }
 return {mount,requestClose,dispose(){active=false;view=null;data=null;}};
}
