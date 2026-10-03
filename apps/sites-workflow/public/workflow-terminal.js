/* One local terminal draft. No production or remote writes. */
(()=>{
 const newId=()=>Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join('');
 const key='melisa-terminal-draft-v1';let raw=null,id=newId(),error='',blocked=false;
 const message='Taslak başka sekmede değişti. Devam etmeden sayfayı yenileyin.';
 function snapshot(){return {version:1,id,basket:structuredClone(basket),customer:saleCustomer,rate:saleFxRate,discount:window.MelisaSaleDiscountBps||0,stage:saleStage}}
 function save(){
  if(blocked)throw Error(error||message);
  const latest=localStorage.getItem(key);if(latest!==raw){blocked=true;error=message;throw Error(error)}
  const next=JSON.stringify(snapshot());localStorage.setItem(key,next);raw=next;error='';return id;
 }
 function show(){const status=document.getElementById('terminal-draft-status');if(status)status.textContent=error||'Taslak bu tarayıcıda korunuyor.';if(blocked)document.querySelectorAll('.terminal input,.terminal select,.terminal button').forEach(x=>x.disabled=true)}
 try{raw=localStorage.getItem(key);if(raw){const d=JSON.parse(raw);if(d.version!==1||typeof d.id!=='string'||!Array.isArray(d.basket)||!d.basket.every(i=>typeof i.code==='string'&&Number.isInteger(i.qty)&&i.qty>0&&Number.isFinite(i.price))||!['edit','review','done'].includes(d.stage))throw Error('Kayıtlı terminal taslağı okunamadı.');id=d.id;basket=d.basket;saleCustomer=d.customer;saleFxRate=d.rate||'';window.MelisaSaleDiscountBps=d.discount||0;saleStage=d.stage;
   const receipt=window.MelisaDemoReceipts.list().find(r=>r.terminalDraftId===id);if(receipt)saleStage='done';saleMessage='Kaydedilmiş taslak geri yüklendi.';
 }}catch(e){blocked=true;error=e.message}
 window.MelisaTerminal={id:()=>id,save,reset(){id=newId();basket=[];saleStage='edit';saleMessage='';saleFxRate='';window.MelisaSaleDiscountBps=0;render()},last(){return window.MelisaDemoReceipts.list().find(r=>r.terminalDraftId===id)},status:()=>error};
 document.addEventListener('workflow-render',()=>{if(current!=='sales'||localStorage.getItem('melisa-data-mode')==='live')return;
  const root=document.querySelector('.terminal');if(!root)return;const status=document.createElement('div');status.id='terminal-draft-status';status.className='sale-info';status.setAttribute('role','status');root.append(status);
  try{save()}catch(e){error=e.message}show();
 });
 for(const event of ['input','change'])document.addEventListener(event,e=>{if(current!=='sales'||!e.target.closest('.terminal'))return;try{save()}catch(e){error=e.message}show()});
 window.addEventListener('storage',e=>{if(e.key===key&&e.newValue!==raw){blocked=true;error=message;show()}});
 window.addEventListener('beforeunload',e=>{if(error){e.preventDefault();e.returnValue=''}});
})();
