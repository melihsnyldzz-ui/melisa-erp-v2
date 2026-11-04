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
   const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
   const id=value=>(typeof value==='number'||typeof value==='string'&&/^[1-9]\d*$/.test(value))&&Number.isSafeInteger(Number(value))&&Number(value)>0;
   const failed=value=>value.error!==undefined&&value.error!==null||['success','ok'].some(key=>value[key]!==undefined&&value[key]!==true);
   if(!object(entry)||!['draft','approve','reject','cancel'].includes(entry.op)||!object(entry.body)||typeof entry.body.requestId!=='string'||!/^[a-zA-Z0-9-]{16,64}$/.test(entry.body.requestId))return true;
   // testDaily stores the existing daily API response, not the inbound journal
   // schema. A response object alone does not confirm a count operation.
   const r=entry.result;
   const expectedState={draft:'pending',approve:'approved',reject:'rejected',cancel:'cancelled'}[entry.op];
   if(!object(r)||failed(r)||!id(r.id)||r.state!==undefined&&r.state!==expectedState||r.kind!==undefined&&r.kind!=='count'||r.flow!==undefined&&r.flow!=='count'||r.requestId!==undefined&&r.requestId!==entry.body.requestId||['replayed','alreadyApplied'].some(k=>r[k]!==undefined&&typeof r[k]!=='boolean'))return true;
   if(entry.op==='draft')return r.state!==undefined&&r.state!=='pending';
   if(!id(entry.body.id)||Number(r.id)!==Number(entry.body.id))return true;
   if(entry.op==='reject')return r.state!=='rejected';
   // Non-finance personnel projection may reduce a legacy adjustment to {}.
   // Keep that valid nested result; the outer document and decision must match.
   if(entry.op==='approve')return !object(r.result)||failed(r.result)||r.result.state!==undefined&&r.result.state!=='approved'||r.result.id!==undefined&&(!id(r.result.id)||Number(r.result.id)!==Number(r.id));
   return !object(r.reversal)||failed(r.reversal)||r.reversal.state!==undefined&&r.reversal.state!=='cancelled'||!id(r.reversal.id)||r.reversal.kind!==undefined&&r.reversal.kind!=='count'||r.reversal.flow!==undefined&&r.reversal.flow!=='count'||r.reversal.original_draft_id!==undefined&&(!id(r.reversal.original_draft_id)||Number(r.reversal.original_draft_id)!==Number(r.id));
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
