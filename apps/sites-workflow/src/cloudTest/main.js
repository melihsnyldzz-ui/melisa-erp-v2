import {createWorkReceiving} from '../workflow/workReceiving.js';
import {createWorkSales} from '../workflow/workSales.js';
import {createWorkCollections} from '../workflow/workCollections.js';
import {createTradeJournal,tradeUuid,tradeInvoice} from './workTradeModel.mjs';
import {createCloudSession} from './session.js';
import './shell.css';

const api=createCloudSession(),root=document.getElementById('cloud-controller'),extra=document.getElementById('cloud-extra'),error=document.getElementById('cloud-error');
let selected=null,session=null,controller=null,generation=0,busy=false,view='goods';
const storage={getItem:key=>window.sessionStorage.getItem('melisa-cloud-test:'+key),setItem:(key,value)=>window.sessionStorage.setItem('melisa-cloud-test:'+key,value),removeItem:key=>window.sessionStorage.removeItem('melisa-cloud-test:'+key)};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function journal(){return createTradeJournal({storage,key:`melisa-work-sale-v1:${location.host}:${selected.user.id}`});}
function mayLeave(){return !busy&&controller?.requestClose?.()!==false;}
function dispose(){generation++;controller?.dispose();controller=null;root.replaceChildren();extra.replaceChildren();}
function controls(disabled){document.querySelectorAll('#cloud-session-form button,[data-cloud-view]').forEach(button=>button.disabled=disabled);}
function activate(current){
  selected=current;session=current.user?api.bind(current):null;
  document.getElementById('cloud-user').textContent=current.user?`Etkin sentetik hesap: ${current.user.name} · ${current.user.role} · ${current.user.id}`:'Sentetik TEST hesabını seçin.';
  if(current.user)document.getElementById('cloud-actor').value=String(current.user.id);
}
async function navigate(next){
  if(!selected?.user||!mayLeave())return;
  dispose();view=next;error.textContent='';
  document.querySelectorAll('[data-cloud-view]').forEach(button=>button.classList.toggle('primary',button.dataset.cloudView===next));
  if(next==='crm'){await loadOrders();return;}
  const options={root,session,user:{...selected.user,id:String(selected.user.id)},storage,navigate};
  controller=next==='goods'?createWorkReceiving(options):next==='collections'?createWorkCollections(options):createWorkSales({...options,receiptOnly:next==='receipts'});
  controller.mount();
}
async function loadOrders(){
  const own=generation;extra.innerHTML='<section class="card cloud-orders"><h2>CRM’den gelen sentetik taslaklar</h2><p role="status">Sunucudan okunuyor…</p></section>';
  try{
    const orders=await session.work('/api/cloud-test/erp/drafts');
    if(own!==generation)return;if(!Array.isArray(orders))throw Error('Taslak listesi doğrulanamadı.');
    extra.innerHTML=`<section class="card cloud-orders"><div class="heading"><h2>CRM’den gelen sentetik taslaklar</h2><button class="btn" data-cloud-orders-refresh>Sunucudan yenile</button></div><p>CRM ve ERP aynı sentetik veritabanını kullanır. Satışa aktarmak stok veya borcu değiştirmez; gerçek ERP satış fişindeki tamamlama adımı ayrı yapılır.</p>${orders.map(order=>`<article><div><strong>${escape(order.documentNo)}</strong><span>${escape(order.customerName)} · ${escape(order.grandTotalExact4)} TRY</span><small>${escape(order.requestId)}</small></div><button class="btn primary" data-cloud-convert="${escape(order.id)}" ${selected.user.role!=='personnel'?'disabled':''}>ERP satış taslağına aktar</button></article>`).join('')||'<p>Bu hesaba görünür CRM taslağı yok.</p>'}</section>`;
    extra.querySelector('[data-cloud-orders-refresh]').onclick=loadOrders;
    extra.querySelectorAll('[data-cloud-convert]').forEach(button=>button.onclick=()=>convert(button.dataset.cloudConvert));
  }catch(failure){if(own===generation)error.textContent=failure.message;}
}
async function convert(orderId){
  if(busy||!session)return;const own=generation;busy=true;controls(true);error.textContent='';
  try{
    const operationKey=`order-sale-operation:${selected.user.id}:${orderId}`;
    let requestId=storage.getItem(operationKey);if(!requestId){requestId=tradeUuid();storage.setItem(operationKey,requestId);if(storage.getItem(operationKey)!==requestId)throw Error('İşlem kimliği korunamadı.');}
    const saved=journal().read();if(saved?.status==='pending')throw Error('Önce satış ekranındaki son işlemi doğrulayın.');
    const pending=journal().begin(`/api/cloud-test/erp/orders/${orderId}/sale`,{requestId});
    const result=await session.work(pending.path,{method:'POST',body:pending.body});tradeInvoice(result.invoice);
    if(generation!==own)return;journal().done(pending,result);
    busy=false;controls(false);await navigate('receipts');
  }catch(failure){if(own===generation)error.textContent=failure.message;}
  finally{busy=false;controls(false);}
}
document.querySelectorAll('[data-cloud-view]').forEach(button=>button.onclick=()=>void navigate(button.dataset.cloudView));
document.getElementById('cloud-session-form').onsubmit=async event=>{
  event.preventDefault();if(!mayLeave())return;dispose();busy=true;controls(true);error.textContent='';
  try{activate(await api.select(Number(document.getElementById('cloud-actor').value)));}
  catch(failure){selected=null;session=null;error.textContent=failure.message;}
  finally{busy=false;controls(false);}
  if(selected?.user)await navigate(view);
};
window.addEventListener('pagehide',()=>dispose());
api.inspect().then(current=>{activate(current);if(current.user)return navigate(view);}).catch(failure=>{error.textContent=failure.message;});
