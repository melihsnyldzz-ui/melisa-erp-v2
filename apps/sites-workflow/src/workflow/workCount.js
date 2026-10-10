import {testDaily} from './testDaily.js';
import {workTaskHandoff} from './workTaskHandoff.mjs';
import './workTaskHandoff.css';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function createWorkCount({root,session,user}){
 let active=true,busy=false,data=null,view=null;
 const alive=()=>active&&root.isConnected;
 const api=(path,options)=>session.inbound(path,options||{});
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
 return {mount,dispose(){active=false;view=null;data=null;}};
}
