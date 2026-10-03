import React,{useEffect,useRef,useState} from 'react';
import {transitionInventoryReceipt} from '../../services/receiptDraftApi.js';
const labels={submit:'Muhasebeye gönder',return:'Geri gönder',approve:'Kabulü onayla',correct:'Onaylı miktarı düzelt'};
const states={submit:'submitted',return:'returned',approve:'approved',correct:'approved'};
function correctionPreview(line,quantity){
 const units=value=>typeof value==='string'&&/^\d{1,20}(\.\d{1,8})?$/.test(value)
  ?BigInt(value.split('.')[0])*100000000n+BigInt((value.split('.')[1]||'').padEnd(8,'0')):null;
 const before=units(line?.quantity),after=units(quantity);
 if(before===null||after===null)return 'Miktar farkı doğrulanmadı.';
 const delta=after-before,abs=delta<0n?-delta:delta;
 const value=`${delta<0n?'-':'+'}${abs/100000000n}.${String(abs%100000000n).padStart(8,'0')}`;
 return `Kayıtlı: ${line.quantity} → Yeni: ${quantity} · Miktar farkı: ${value} ${line.unit||'(Birim doğrulanmadı)'}. Kesin stok etkisi sunucuda doğrulanır.`;
}
export function ReceiptTransitionForm({receipt,meta,onSaved}){
 const [action,setAction]=useState(receipt.status==='submitted'?'return':receipt.status==='approved'?'correct':'submit');
 const [reason,setReason]=useState(''),[lineId,setLineId]=useState(''),[quantity,setQuantity]=useState(''),[ack,setAck]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const alive=useRef(false),locked=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const choices=receipt.status==='submitted'?['return','approve']:receipt.status==='approved'?['correct']:['draft','returned'].includes(receipt.status)?['submit']:[];
 const enabled=choices.includes(action)&&meta?.readOnly===false&&meta?.source===receipt.source
  &&meta?.commands?.receiptId===receipt.id&&meta?.commands?.version===receipt.version&&meta?.commands?.[action]===true;
 async function submit(event){
  event.preventDefault();if(!enabled||!ack||busy||locked.current)return;
  if((['return','correct'].includes(action)&&!reason.trim())||(action==='correct'&&(!receipt.lines.some(l=>l.id===lineId)||!/^\d+(\.\d{1,3})?$/.test(quantity)))){setMessage('Gerekçe ve kayıtlı satırın geçerli miktarı gerekli.');return;}
  const key=`melisa.receipt.pending:${receipt.source}:${receipt.id}`;let body;
  try{
   if(sessionStorage.getItem(key)){setMessage('Önceki komutun sonucu doğrulanmalı; yeni işlem kapalı.');return;}
   body={source:receipt.source,expectedVersion:receipt.version,requestId:crypto.randomUUID(),
    ...(['return','correct'].includes(action)?{reason:reason.trim()}:{}),...(action==='correct'?{quantities:[{lineId,quantity}]}:{})};
   sessionStorage.setItem(key,JSON.stringify({action,receiptId:receipt.id,body}));
  }catch{setMessage('İstek kimliği saklanamadı; gönderilmedi.');return;}
  locked.current=true;setBusy(true);
  try{
   const response=await transitionInventoryReceipt(receipt.id,action,body),row=response?.data;
   if(response?.success!==true||row?.id!==receipt.id||row?.source!==receipt.source||row?.version!==receipt.version+1||row?.status!==states[action])throw Error('Sonuç doğrulanamadı');
   sessionStorage.removeItem(key);if(alive.current)onSaved();
  }catch{if(alive.current)setMessage(`Sonuç doğrulanamadı. İstek ${body.requestId} saklandı; otomatik tekrar yok.`);}
  finally{if(alive.current)setBusy(false);}
 }
 return <form onSubmit={submit} aria-label="Kabul muhasebe işlemi"><h3>Kabul muhasebe işlemi</h3>
  <select aria-label="Kabul işlemi" value={action} disabled={busy||locked.current} onChange={e=>{setAction(e.target.value);setAck(false);setMessage('');}}>{choices.map(a=><option key={a} value={a}>{labels[a]}</option>)}</select>
  {['return','correct'].includes(action)&&<label>Gerekçe<textarea maxLength={500} value={reason} disabled={busy} onChange={e=>{setReason(e.target.value);setAck(false);}}/></label>}
  {action==='correct'&&<><label>Kayıtlı satır<select value={lineId} disabled={busy} onChange={e=>{setLineId(e.target.value);setAck(false);}}><option value="">Seçin</option>{receipt.lines.map(l=><option key={l.id} value={l.id}>#{l.id} · {l.quantity} {l.unit||'birim doğrulanmadı'}</option>)}</select></label><label>Yeni kayıtlı miktar<input inputMode="decimal" value={quantity} disabled={busy} onChange={e=>{setQuantity(e.target.value);setAck(false);}}/></label></>}
  <p>{['approve','correct'].includes(action)?'Onay/düzeltme kayıtlı stok etkisi üretir. Tahsis, dönem ve transaction kontrolleri sunucuda zorunludur.':'Bu aşama tek başına stok onayı değildir.'}</p>
  {action==='correct'&&<p role="status">{correctionPreview(receipt.lines.find(line=>line.id===lineId),quantity)}</p>}
  <label><input type="checkbox" checked={ack} disabled={busy} onChange={e=>setAck(e.target.checked)}/>Seçilen kabul ve işlemi inceledim.</label>
  {!enabled&&<p>TEST işlem bağlantısı doğrulanmadı; gönderim kapalı.</p>}
  <button disabled={!enabled||!ack||busy||locked.current}>{labels[action]}</button>{message&&<p role="status">{message}</p>}
 </form>;
}

