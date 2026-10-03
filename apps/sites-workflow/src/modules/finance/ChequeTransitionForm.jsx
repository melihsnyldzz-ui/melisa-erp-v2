import React,{useEffect,useRef,useState} from 'react';
import {transitionTaskCheque} from '../../services/chequeApi.js';
const id=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
export function ChequeTransitionForm({cheque,meta,onSaved}){
 const [date,setDate]=useState(''),[reason,setReason]=useState(''),[ack,setAck]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [choice,setChoice]=useState('');
 const alive=useRef(false),locked=useRef(false),generation=useRef(null);
 const chequeIdentity=JSON.stringify([cheque.source,cheque.id,cheque.version,cheque.direction,cheque.status]);
 useEffect(()=>{const token={};generation.current=token;alive.current=true;locked.current=false;
  setDate('');setReason('');setAck(null);setBusy(false);setMessage('');setChoice('');
  return()=>{alive.current=false;if(generation.current===token)generation.current=null;};},[chequeIdentity]);
 const primary=cheque.status==='draft'?'finalize':cheque.status==='portfolio'&&cheque.direction==='received'?'deposit':null;
 const reversible=(cheque.direction==='received'&&((cheque.status==='portfolio'&&cheque.version===1)||(cheque.status==='bank_deposited'&&cheque.version===2)))
  ||(cheque.direction==='given'&&cheque.status==='issued'&&cheque.version===1);
 const settled=(cheque.direction==='received'&&cheque.status==='collected'&&[2,3].includes(cheque.version))
  ||(cheque.direction==='given'&&cheque.status==='paid'&&cheque.version===2);
 const options=[...(primary?[primary]:[]),...(reversible?['settle']:[]),...(reversible||settled?['cancel','dishonour','return']:[])];
 const action=options.includes(choice)?choice:primary||options[0]||null,reverse=['cancel','dishonour','return'].includes(action);
 const titles={finalize:'Teslim / muhasebe onayı',deposit:'Bankaya verme',settle:'Banka sonucunu kaydet',cancel:'İptal',dishonour:'Karşılıksız',return:'İade'};
 const cap=meta?.commands,duplicates=cap?.duplicateIds;
 const duplicateReady=action!=='finalize'||(cap?.duplicatesVerified===true&&Array.isArray(duplicates)&&duplicates.length<=100&&duplicates.every(v=>id(v)&&v!==cheque.id)&&new Set(duplicates).size===duplicates.length);
 const enabled=action!==null&&id(cheque.id)&&meta?.source===cheque.source&&cap?.source===cheque.source&&cap?.chequeId===cheque.id&&cap?.version===cheque.version
  &&cap?.[action]===true&&duplicateReady&&['received','given'].includes(cheque.direction)
  &&(reverse?(reversible?cap?.unsettledReversalVerified===true:settled&&cap?.settledReversalVerified===true&&id(cap?.bankReversalEventId)&&cap?.bankReversalDate===date):action==='settle'?
   reversible&&cap?.settlementEvidenceVerified===true&&id(cap?.bankEventId)&&cap?.settlementEventDate===date:
   cheque.version===(action==='finalize'?0:1));
 const identity=JSON.stringify([cheque.source,cheque.id,cheque.version,action,date,reason,duplicates,action==='settle'?cap?.bankEventId:reverse&&settled?cap?.bankReversalEventId:null]);
 async function submit(e){
  e.preventDefault();if(!enabled||ack!==identity||locked.current)return;
  if(!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date){setMessage('Geçerli işlem tarihi gerekli.');return;}
  if(reverse&&!reason.trim()){setMessage('Ters işlem gerekçesi gerekli.');return;}
  const selected={source:cheque.source,id:cheque.id,version:cheque.version,direction:cheque.direction};
  const key=`melisa.cheque.transition.pending:${selected.source}:${selected.id}`;let body;
  try{if(sessionStorage.getItem(key)){setMessage('Önceki çek işleminin sonucu doğrulanmalı.');return;}
   body={source:selected.source,requestId:crypto.randomUUID(),expectedVersion:selected.version,eventDate:date,...(reason?{reason}:{}),...(action==='finalize'?{acknowledgedDuplicateIds:[...duplicates]}:{})};
   sessionStorage.setItem(key,JSON.stringify({chequeId:selected.id,action,body}));
  }catch{setMessage('İstek kimliği saklanamadı; gönderilmedi.');return;}
  locked.current=true;setBusy(true);const token=generation.current,current=()=>alive.current&&generation.current===token;
  try{const response=await transitionTaskCheque(selected.id,action,body),r=response?.data;
   const expected=reverse?{cancel:'cancelled',dishonour:'dishonoured',return:'returned'}[action]:action==='settle'?(selected.direction==='received'?'collected':'paid'):action==='deposit'?'bank_deposited':selected.direction==='received'?'portfolio':'issued';
   if(response?.success!==true||r?.source!==selected.source||r.chequeId!==selected.id||r.direction!==selected.direction||r.version!==selected.version+1||r.status!==expected||!id(r.eventId))throw Error('UNCONFIRMED');
   sessionStorage.removeItem(key);if(current())onSaved?.();
  }catch{if(current())setMessage(`Sonuç doğrulanamadı. İstek ${body.requestId} saklandı; otomatik tekrar yok.`);}finally{if(current())setBusy(false);}
 }
 return <form onSubmit={submit} aria-label="Çek işlemi"><h4>{titles[action]||'Çek işlemi'}</h4>
  {options.length>1&&<label>İşlem<select value={action} disabled={locked.current} onChange={e=>{setChoice(e.target.value);setAck(null);setMessage('');}}>{options.map(a=><option key={a} value={a}>{titles[a]}</option>)}</select></label>}
  <p>{reverse?(settled?'Özgün cari ve banka hareketleri korunur; doğrulanmış banka ters olayıyla ikisine bağlı ters kayıt eklenir.':'Özgün cari hareket korunur; bağlı ters hareket eklenir.'):action==='settle'?
   'Yalnız doğrulanmış banka olayı kaydedilir; ilk cari hareket tekrar üretilmez.':action==='deposit'?'Bankaya verme tahsilat değildir.':'Onay cari etkisi üretir; banka tahsilatı/ödemesi ayrı işlemdir.'}</p>
  {action==='settle'&&<p>{cap?.settlementEvidenceVerified===true&&id(cap?.bankEventId)?`Banka olay kaydı #${cap.bankEventId} · İş tarihi ${cap.settlementEventDate}`:'Gerçek banka olayı doğrulanmadı; vade tarihi ödeme kanıtı değildir.'}</p>}
  {reverse&&settled&&<p>{cap?.settledReversalVerified===true&&id(cap?.bankReversalEventId)?`Banka ters olay kaydı #${cap.bankReversalEventId} · İş tarihi ${cap.bankReversalDate}`:'Gerçek banka ters olayı doğrulanmadı; gönderim kapalı.'}</p>}
  <label>İşlem tarihi<input type="date" value={date} disabled={locked.current} onChange={e=>setDate(e.target.value)}/></label>
  <label>Not<textarea maxLength={500} value={reason} disabled={locked.current} onChange={e=>setReason(e.target.value)}/></label>
  {action==='finalize'&&<p>Mükerrer kontrolü: {duplicateReady?(duplicates.join(', ')||'Doğrulanmış eşleşme yok'):'Doğrulanmadı'}</p>}
  <label><input type="checkbox" checked={ack===identity} disabled={locked.current} onChange={e=>setAck(e.target.checked?identity:null)}/>İşlemi ve mükerrer uyarısını inceledim.</label>
  {!enabled&&<p>Sunucu işlem yeteneği doğrulanmadı; gönderim kapalı.</p>}<button disabled={!enabled||ack!==identity||busy||locked.current}>İşlemi gönder</button>{message&&<p role="status">{message}</p>}
 </form>;
}

