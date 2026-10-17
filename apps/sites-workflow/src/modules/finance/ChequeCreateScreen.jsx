import {ChequeList} from './ChequeList.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {createTaskCheque,validateTaskCheque} from '../../services/chequeApi.js';
// Server capability only. Workspace deliberately supplies none until activation.
export function ChequeCreateScreen({capability=null,initialCheque=null}){
 const [form,setForm]=useState({partyId:'',direction:'received',currency:'TRY',amount:'',dueDate:'',bankName:'',number:''});
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [createdCheque,setCreatedCheque]=useState(null);
 const navigationKey=JSON.stringify([initialCheque?.kind,initialCheque?.source,initialCheque?.documentId]);
 const currentNavigation=useRef({key:navigationKey});if(currentNavigation.current.key!==navigationKey)currentNavigation.current={key:navigationKey};
 const alive=useRef(false),locked=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const enabled=capability?.enabled===true&&capability.source==='PROMPT-2-20260923-01'
  &&capability.sourceContext?.environment==='TEST'&&capability.sourceContext?.server==='Semih\\MELISADEV'
  &&capability.sourceContext?.database==='MELISA_ERP_FULL_TEST_20260916'
  &&Array.isArray(capability.directions)&&capability.directions.includes(form.direction);
 const change=(key,value)=>setForm(f=>({...f,[key]:value}));
 async function submit(e){
  e.preventDefault();if(!enabled||locked.current)return;
  const key=`melisa.cheque.pending:${capability.source}`;let body;
  try{
   if(sessionStorage.getItem(key)){setMessage('Önceki çek isteğinin sonucu doğrulanmalı.');return;}
   body={...form,source:capability.source,requestId:crypto.randomUUID()};
   try{validateTaskCheque(body);}catch{setMessage('Cari kimliği, tutar, banka, çek numarası ve vade alanlarını kontrol edin.');return;}
   // Keep the request before transport. Validation/transport errors never cause a new automatic request.
   sessionStorage.setItem(key,JSON.stringify(body));
  }catch{setMessage('İstek kimliği saklanamadı; gönderilmedi.');return;}
  locked.current=true;setBusy(true);
  const requestNavigation=currentNavigation.current;
  try{
   const response=await createTaskCheque(body),r=response?.data;
   if(response?.success!==true||r?.source!==body.source||r.direction!==body.direction||r.status!=='draft'||r.version!==0
    ||typeof r.chequeId!=='string'||!/^[1-9]\d{0,18}$/.test(r.chequeId)||BigInt(r.chequeId)>9223372036854775807n)throw Error('UNCONFIRMED');
   sessionStorage.removeItem(key);if(alive.current&&currentNavigation.current===requestNavigation){
    setMessage(`Çek #${r.chequeId} taslak oluşturuldu. Cari ve banka etkisi kesinleşmedi.`);
    setCreatedCheque({navigationKey:requestNavigation,target:{kind:'cheque',source:'/api/cheques',documentId:r.chequeId}});
   }
  }catch{if(alive.current&&currentNavigation.current===requestNavigation)setMessage(`Sonuç doğrulanamadı. İstek ${body.requestId} saklandı; otomatik tekrar yok.`);}
  finally{if(alive.current)setBusy(false);}
 }
 return <main className="v17-document-screen"><section className="v17-document-main">
  <header className="v17-document-heading"><div><h1>Çek taslağı</h1><p>Taslak ve teslim/onay ayrı aşamalardır. Vade gelmesi otomatik banka işlemi değildir.</p></div></header>
  <form onSubmit={submit} className="v17-document-filters" style={{gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,180px),1fr))'}}>
   <label>Yön<select value={form.direction} disabled={locked.current} onChange={e=>change('direction',e.target.value)}><option value="received">Müşteriden alınan</option><option value="given">Tedarikçiye verilen</option></select></label>
   <label>{form.direction==='received'?'Müşteri kimliği':'Tedarikçi kimliği'}<input value={form.partyId} disabled={locked.current} onChange={e=>change('partyId',e.target.value)}/></label>
   <label>Döviz<select value={form.currency} disabled={locked.current} onChange={e=>change('currency',e.target.value)}>{['TRY','USD','EUR'].map(c=><option key={c}>{c}</option>)}</select></label>
   {[['amount','Tutar'],['dueDate','Vade'],['bankName','Banka adı'],['number','Çek numarası']].map(([key,label])=><label key={key}>{label}<input type={key==='dueDate'?'date':'text'} inputMode={key==='amount'?'decimal':undefined} value={form[key]} disabled={locked.current} onChange={e=>change(key,e.target.value)}/></label>)}
   <button disabled={!enabled||busy||locked.current}>Çek taslağı oluştur</button>
  </form>
  {!enabled&&<p>Doğrulanmış TEST çek bağlantısı yok; gönderim kapalı.</p>}
  {message&&<p role="status">{message}</p>}
  <p>Teslim/onay, bankaya verme ve sonuçlandırma ekran bağlantıları henüz hazır değil.</p>
 <ChequeList initialCheque={createdCheque?.navigationKey===currentNavigation.current?createdCheque.target:initialCheque} />
 </section></main>;
}




