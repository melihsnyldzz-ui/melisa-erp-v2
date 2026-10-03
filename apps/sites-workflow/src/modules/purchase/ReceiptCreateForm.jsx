import React,{useEffect,useRef,useState} from 'react';
import {fetchInventoryReceipts} from '../../services/receiptApi.js';
import {createInventoryReceipt} from '../../services/receiptDraftApi.js';

export function ReceiptCreateForm({source,supplierId,onCreated,onSelectExisting}){
 const [context,setContext]=useState(null),[date,setDate]=useState(''),[dispatch,setDispatch]=useState(''),[ack,setAck]=useState(false);
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const read=useRef(null),alive=useRef(false),locked=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;read.current?.abort();};},[]);
 async function inspect(){
  if(locked.current)return;
  read.current?.abort();const controller=new AbortController();read.current=controller;
  setContext(null);setAck(false);setBusy(true);setMessage('');
  try{
   const response=await fetchInventoryReceipts({source,supplierId,page:1,pageSize:8},{signal:controller.signal});
   if(controller.signal.aborted||!alive.current)return;
   const c=response?.meta?.creation;
   if(response?.success!==true||response.meta?.source!==source||c?.supplierId!==supplierId
    ||!Array.isArray(c.observedOpenReceipts)||c.observedOpenReceipts.some(row=>typeof row?.id!=='string'||!/^[1-9]\d{0,18}$/.test(row.id)||BigInt(row.id)>9223372036854775807n||!Number.isSafeInteger(row.version)||row.version<0)
    ||new Set(c.observedOpenReceipts.map(row=>row.id)).size!==c.observedOpenReceipts.length
    ||!Number.isFinite(Date.parse(response.meta.readAt)))throw Error('Tedarikçinin bütün açık kabulleri doğrulanamadı.');
   setContext({creation:c,readAt:response.meta.readAt});
  }catch(e){if(!controller.signal.aborted&&alive.current)setMessage(e.message||'Açık kabuller okunamadı.');}
  finally{if(!controller.signal.aborted&&alive.current)setBusy(false);}
 }
 async function submit(event){
  event.preventDefault();if(locked.current||busy||context?.creation.enabled!==true||!ack)return;
  if(!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date){setMessage('Geçerli belge tarihi girin.');return;}
  const key=`melisa.receipt.create.pending:${source}:${supplierId}`;let body;
  try{
   if(sessionStorage.getItem(key)){setMessage('Önceki oluşturma isteğinin sonucu doğrulanmalı.');return;}
   body={source,supplierId,documentDate:date,dispatchNumber:dispatch.trim()||null,requestId:crypto.randomUUID(),observedOpenReceipts:context.creation.observedOpenReceipts.map(row=>({id:row.id,version:row.version}))};
   sessionStorage.setItem(key,JSON.stringify(body));
  }catch{setMessage('İstek kimliği saklanamadı; gönderilmedi.');return;}
  locked.current=true;setBusy(true);
  try{
   const response=await createInventoryReceipt(body),row=response?.data;
   if(response?.success!==true||row?.source!==source||row?.supplierId!==supplierId||row?.version!==0||row?.status!=='draft'
    ||typeof row.id!=='string'||!/^[1-9]\d{0,18}$/.test(row.id))throw Error('Kimlik doğrulanamadı');
   sessionStorage.removeItem(key);if(alive.current)onCreated(row.id);
  }catch{if(alive.current)setMessage(`Oluşturma sonucu doğrulanamadı. İstek ${body.requestId} saklandı; otomatik tekrar yok.`);}
  finally{if(alive.current)setBusy(false);}
 }
 return <details><summary>Yeni kabul taslağı</summary><form onSubmit={submit}>
  <p>Tedarikçi #{supplierId}. Aynı tedarikçinin açık kabulleri yeni kart öncesi incelenir.</p>
  <button type="button" disabled={busy||locked.current} onClick={inspect}>Açık kabulleri kontrol et</button>
  {context&&<><p>Okuma zamanı: {context.readAt}</p><p>{context.creation.observedOpenReceipts.length?`Açık kabuller: ${context.creation.observedOpenReceipts.map(row=>`#${row.id}`).join(', ')}`:'Bu görev kapsamında açık kabul yok.'}</p>
   {typeof onSelectExisting==='function'&&context.creation.observedOpenReceipts.map(row=><button key={row.id} type="button" disabled={busy||locked.current} onClick={()=>{if(busy||locked.current)return;setAck(false);onSelectExisting({source,id:row.id});}}>Mevcut kabul #{row.id} aç</button>)}
   <label><input type="checkbox" checked={ack} disabled={busy} onChange={e=>setAck(e.target.checked)}/>Açık kabul bilgisini inceledim; ayrı kabul oluşturacağım.</label></>}
  <label>Belge tarihi<input type="date" value={date} disabled={busy} onChange={e=>setDate(e.target.value)}/></label>
  <label>İrsaliye numarası<input value={dispatch} maxLength={80} disabled={busy} onChange={e=>setDispatch(e.target.value)}/></label>
  {context?.creation.enabled!==true&&<p>TEST oluşturma bağlantısı doğrulanmadı; gönderim kapalı.</p>}
  <button disabled={busy||locked.current||!ack||context?.creation.enabled!==true}>Kabul taslağı oluştur</button>
  {message&&<p role="status">{message}</p>}
 </form></details>;
}

