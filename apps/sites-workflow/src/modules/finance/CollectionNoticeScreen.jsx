import React,{useEffect,useRef,useState} from 'react';
import {createCollectionNotice} from '../../services/financeApi.js';
import {CollectionNoticeList} from './CollectionNoticeList.jsx';

// No startup reads of legacy finance accounts (which may perform setup).
// Capability must come from a verified server response, never a tab payload.
export function CollectionNoticeScreen({capability=null,initialNotice=null,onOpenScreen}){
 const [form,setForm]=useState({customerId:'',currency:'TRY',method:'cash',reportedAmount:'',reportedOn:''});
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [createdNotice,setCreatedNotice]=useState(null);
 const navigationKey=JSON.stringify([initialNotice?.kind,initialNotice?.source,initialNotice?.documentId]);
 const currentNavigation=useRef({key:navigationKey});if(currentNavigation.current.key!==navigationKey)currentNavigation.current={key:navigationKey};
 const alive=useRef(false),locked=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const enabled=capability?.enabled===true&&capability?.source==='PROMPT-2-20260923-01'
  &&capability?.sourceContext?.environment==='TEST'&&capability?.sourceContext?.server==='Semih\\MELISADEV'
  &&capability?.sourceContext?.database==='MELISA_ERP_FULL_TEST_20260916';
 function field(key,value){setForm(f=>({...f,[key]:value}));}
 async function submit(event){
  event.preventDefault();if(!enabled||locked.current)return;
  if(!/^[1-9]\d{0,18}$/.test(form.customerId)||BigInt(form.customerId)>9223372036854775807n
   ||!/^\d{1,14}(\.\d{1,4})?$/.test(form.reportedAmount)||!/[1-9]/.test(form.reportedAmount)
   ||!/^\d{4}-\d{2}-\d{2}$/.test(form.reportedOn)||!Number.isFinite(Date.parse(form.reportedOn))
   ||new Date(form.reportedOn).toISOString().slice(0,10)!==form.reportedOn){setMessage('Müşteri kimliği, pozitif kayıtlı tutar ve tarih gerekli.');return;}
  const key=`melisa.notice.pending:${capability.source}:${form.customerId}`;let body;
  try{
   if(sessionStorage.getItem(key)){setMessage('Önceki bildirimin sonucu doğrulanmalı.');return;}
   body={...form,source:capability.source,requestId:crypto.randomUUID()};sessionStorage.setItem(key,JSON.stringify(body));
  }catch{setMessage('İstek kimliği saklanamadı; gönderilmedi.');return;}
  locked.current=true;setBusy(true);
  const requestNavigation=currentNavigation.current;
  try{
   const response=await createCollectionNotice(body),row=response?.data;
   if(response?.success!==true||row?.source!==body.source||row?.status!=='pending'||row?.version!==0||typeof row.noticeId!=='string'||!/^[1-9]\d{0,18}$/.test(row.noticeId)||BigInt(row.noticeId)>9223372036854775807n)throw Error('Bildirim doğrulanamadı');
   sessionStorage.removeItem(key);if(alive.current&&currentNavigation.current===requestNavigation){
    setMessage(`Bildirim #${row.noticeId} muhasebe onayı bekliyor. Tahsilat kesinleşmedi.`);
    setCreatedNotice({navigationKey:requestNavigation,target:{kind:'collection_notice',source:'/api/collection-notices',documentId:row.noticeId}});
   }
  }catch{if(alive.current&&currentNavigation.current===requestNavigation)setMessage(`Sonuç doğrulanamadı. İstek ${body.requestId} saklandı; otomatik tekrar yok.`);}
  finally{if(alive.current)setBusy(false);}
 }
 return <main className="v17-document-screen"><section className="v17-document-main"><header className="v17-document-heading"><div><h1>Tahsilat bildirimi</h1><p>Bildirim cari, kasa veya banka bakiyesini değiştirmez. Muhasebe onayı ayrı aşamadır.</p></div></header>
  <form onSubmit={submit} className="v17-document-filters" style={{gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,180px),1fr))'}}>
   <label>Müşteri kimliği<input value={form.customerId} disabled={busy||locked.current} onChange={e=>field('customerId',e.target.value)}/></label>
   <label>Bildirilen tutar<input inputMode="decimal" value={form.reportedAmount} disabled={busy||locked.current} onChange={e=>field('reportedAmount',e.target.value)}/></label>
   <label>Döviz<select value={form.currency} disabled={busy||locked.current} onChange={e=>field('currency',e.target.value)}>{['TRY','USD','EUR'].map(c=><option key={c}>{c}</option>)}</select></label>
   <label>Yöntem<select value={form.method} disabled={busy||locked.current} onChange={e=>field('method',e.target.value)}>{Object.entries({cash:'Nakit',bank:'Banka',card:'Kart',cheque:'Çek'}).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   <label>Bildirim tarihi<input type="date" value={form.reportedOn} disabled={busy||locked.current} onChange={e=>field('reportedOn',e.target.value)}/></label>
   <button disabled={!enabled||busy||locked.current}>Muhasebeye bildirim gönder</button>
  </form>{!enabled&&<p>Doğrulanmış TEST bildirim bağlantısı yok; gönderim kapalı. Tedarikçi ödeme ve muhasebe onayı bu ekranda henüz bağlı değil.</p>}
  {message&&<p role="status">{message}</p>}
  {onOpenScreen&&<button type="button" className="v17-button" onClick={()=>onOpenScreen('collections-overview',{mode:'cheque'})}>Çek taslağı →</button>}
  <CollectionNoticeList initialNotice={createdNotice?.navigationKey===currentNavigation.current?createdNotice.target:initialNotice} />
 </section></main>;
}



