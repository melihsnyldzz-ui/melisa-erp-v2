import React,{useEffect,useRef,useState} from 'react';
import {reviewCollectionNotice} from '../../services/financeApi.js';
const names={reject:'Reddet',approve:'Bildirilen tutarı onayla',correct_and_approve:'Tutarı düzelterek onayla'};
const money=v=>typeof v==='string'&&/^\d{1,14}(\.\d{1,4})?$/.test(v)?BigInt(v.split('.')[0])*10000n+BigInt((v.split('.')[1]||'').padEnd(4,'0')):null;
export function CollectionNoticeReviewForm({notice,meta,onSaved}){
 const [action,setAction]=useState('reject'),[reason,setReason]=useState(''),[date,setDate]=useState(''),[amount,setAmount]=useState(''),[ack,setAck]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');const alive=useRef(false),locked=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const cap=meta?.review,approved=action==='approve'?notice.reportedAmount:amount,duplicates=cap?.duplicateEvidence;
 const duplicateReady=action==='reject'||(duplicates?.verified===true&&duplicates?.noticeId===notice.id&&duplicates?.source===notice.source
  &&duplicates?.currency===notice.currency&&money(duplicates?.amount)!==null&&money(duplicates.amount)===money(approved)
  &&Array.isArray(duplicates.ids)&&duplicates.ids.every(id=>typeof id==='string'&&/^[1-9]\d{0,18}$/.test(id)));
 const acknowledgmentKey=JSON.stringify([notice.source,notice.id,notice.version,action,date,approved,duplicates?.ids]);
 const acknowledged=ack===acknowledgmentKey;
 const enabled=notice.status==='pending'&&meta?.source===notice.source&&cap?.noticeId===notice.id&&cap?.version===notice.version
  &&cap?.[action]===true&&duplicateReady;
 async function submit(event){
  event.preventDefault();if(!enabled||!acknowledged||busy||locked.current)return;
  if(!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date
   ||(action!=='approve'&&!reason.trim())||(action!=='reject'&&(money(approved)===null||money(approved)<=0n))
   ||(action==='correct_and_approve'&&money(approved)===money(notice.reportedAmount))){setMessage('Tarih, gerekçe ve onay tutarı doğrulanmalı.');return;}
  const key=`melisa.notice.review.pending:${notice.source}:${notice.id}`;let body;
  try{if(sessionStorage.getItem(key)){setMessage('Önceki inceleme isteğinin sonucu doğrulanmalı.');return;}
   body={source:notice.source,requestId:crypto.randomUUID(),expectedVersion:notice.version,eventDate:date,
    ...(reason.trim()?{reason:reason.trim()}:{}),...(action==='reject'?{}:{approvedAmount:approved,acknowledgedDuplicateIds:[...duplicates.ids]})};
   sessionStorage.setItem(key,JSON.stringify({action,noticeId:notice.id,body}));
  }catch{setMessage('İstek kimliği saklanamadı; gönderilmedi.');return;}
  locked.current=true;setBusy(true);
  try{const response=await reviewCollectionNotice(notice.id,action,body),row=response?.data;
   if(response?.success!==true||row?.source!==notice.source||row?.noticeId!==notice.id||row?.version!==notice.version+1||row?.status!==(action==='reject'?'rejected':'approved'))throw Error('Sonuç doğrulanamadı');
   sessionStorage.removeItem(key);if(alive.current)onSaved();
  }catch{if(alive.current)setMessage(`İnceleme sonucu doğrulanamadı. İstek ${body.requestId} saklandı; otomatik tekrar yok.`);}
  finally{if(alive.current)setBusy(false);}
 }
 return <form onSubmit={submit} aria-label="Bildirim muhasebe incelemesi"><h4>Muhasebe incelemesi</h4><p>Bildirilen: {notice.reportedAmount} {notice.currency}</p>
  <select value={action} disabled={busy||locked.current} onChange={e=>{setAction(e.target.value);setAck(false);}}>{Object.entries(names).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
  {action==='correct_and_approve'&&<label>Onaylanacak tutar<input value={amount} inputMode="decimal" disabled={busy} onChange={e=>{setAmount(e.target.value);setAck(false);}}/></label>}
  <label>İşlem tarihi<input type="date" value={date} disabled={busy} onChange={e=>setDate(e.target.value)}/></label><label>Gerekçe<textarea maxLength={500} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>
  {action!=='reject'&&<p>Onay cari ve finans etkisi üretir; doğrulanmış hesap/dönem ve mükerrer kontrolü gereklidir. {duplicateReady?`İncelenecek diğer bildirimler: ${duplicates.ids.join(', ')||'Yok'}`:'Mükerrer kapsamı doğrulanmadı.'}</p>}
  <label><input type="checkbox" checked={acknowledged} disabled={busy} onChange={e=>setAck(e.target.checked?acknowledgmentKey:false)}/>İşlemi ve varsa mükerrer uyarısını inceledim.</label>
  {!enabled&&<p>Sunucu inceleme yeteneği doğrulanmadı; gönderim kapalı.</p>}<button disabled={!enabled||!acknowledged||busy||locked.current}>{names[action]}</button>{message&&<p role="status">{message}</p>}
 </form>;
}


