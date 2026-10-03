import React,{useEffect,useRef,useState} from 'react';
import {allocatePurchaseReceiptLines} from '../../services/receiptDraftApi.js';
const ticks=v=>{if(typeof v!=='string'||!/^\d{1,15}(\.\d{1,8})?$/.test(v))throw Error('Kayıtlı miktar doğrulanmadı.');const [a,b='']=v.split('.');return BigInt(a)*100000000n+BigInt(b.padEnd(8,'0'));};
export function ReceiptAllocationForm({context}){
 const [quantities,setQuantities]=useState({}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const alive=useRef(false),locked=useRef(false);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const cap=context?.commands?.allocate;
 const enabled=cap?.enabled===true&&cap.source===context.source&&cap.invoiceId===context.invoiceId&&cap.invoiceVersion===context.invoiceVersion;
 async function submit(e){
  e.preventDefault();if(!enabled||locked.current)return;let body;
  const key=`melisa.allocation.pending:${context.source}:${context.invoiceId}`;
  try{
   if(sessionStorage.getItem(key))throw Error('Önceki tahsisin sonucu doğrulanmalı.');
   const receiptTotals=new Map(),invoiceTotals=new Map(),seen=new Set();
   const allocations=context.items.flatMap(p=>{
    const key=`${p.invoiceLineId}:${p.receiptLineId}`,quantity=quantities[key];if(quantity===undefined||quantity==='')return [];
    if(seen.has(key))throw Error('Tekrarlanan tahsis satırı.');seen.add(key);
    if(!/^\d{1,4}(\.\d{1,3})?$/.test(quantity)||ticks(quantity)<=0n||ticks(quantity)>1000n*100000000n)throw Error('Pozitif, en fazla üç ondalıklı tahsis miktarı gerekli.');
    const q=ticks(quantity),receipt=(receiptTotals.get(p.receiptLineId)||0n)+q,invoice=(invoiceTotals.get(p.invoiceLineId)||0n)+q;
    if(receipt>ticks(p.receiptRemaining)||invoice>ticks(p.invoiceRemaining))throw Error('Tahsis toplamı kayıtlı kalan miktarı aşıyor.');
    receiptTotals.set(p.receiptLineId,receipt);invoiceTotals.set(p.invoiceLineId,invoice);
    return [{receiptLineId:p.receiptLineId,invoiceLineId:p.invoiceLineId,expectedReceiptVersion:p.receiptVersion,quantity}];
   });
   if(!allocations.length||allocations.length>24)throw Error('1–24 tahsis satırı gerekli.');
   body={source:context.source,requestId:crypto.randomUUID(),expectedInvoiceVersion:context.invoiceVersion,allocations};
   sessionStorage.setItem(key,JSON.stringify(body));
  }catch(error){setMessage(error.message||'Tahsis bilgileri doğrulanamadı.');return;}
  locked.current=true;setBusy(true);
  try{
   const response=await allocatePurchaseReceiptLines(context.invoiceId,body),r=response?.data;
   if(response?.success!==true||r?.source!==body.source||r.invoiceId!==context.invoiceId||!/^0x[0-9a-f]{16}$/i.test(r.invoiceVersion||'')
    ||r.invoiceVersion.toLowerCase()===body.expectedInvoiceVersion.toLowerCase()||ticks(r.inventoryEffect)!==0n
    ||!Array.isArray(r.allocations)||r.allocations.length!==body.allocations.length)throw Error('Tahsis yanıtı doğrulanamadı');
   const remaining=new Map(body.allocations.map(a=>[`${a.invoiceLineId}:${a.receiptLineId}`,a]));
   for(const a of r.allocations){const k=`${a.invoiceLineId}:${a.receiptLineId}`,expected=remaining.get(k),recorded=context.items.find(p=>`${p.invoiceLineId}:${p.receiptLineId}`===k);
    if(!expected||ticks(a.quantity)!==ticks(expected.quantity)||a.unit!==recorded.unit)throw Error('Tahsis satırı doğrulanamadı');remaining.delete(k);}
   sessionStorage.removeItem(key);if(alive.current)setMessage('Tahsis kaydedildi. Yeni belge sürümünü ve kapasiteleri yeniden okuyun. Stok etkisi yok.');
  }catch{if(alive.current)setMessage(`Tahsis sonucu doğrulanamadı. İstek ${body.requestId} saklandı; otomatik tekrar yok.`);}
  finally{if(alive.current)setBusy(false);}
 }
 return <form onSubmit={submit}><fieldset disabled={!enabled||busy||locked.current}>
  {context.items.map(p=><label key={`${p.invoiceLineId}:${p.receiptLineId}`}>Alış #{p.invoiceLineId} / kabul satırı #{p.receiptLineId} · {p.unit}
   <input inputMode="decimal" value={quantities[`${p.invoiceLineId}:${p.receiptLineId}`]||''} disabled={p.invoiceRemaining===null||p.receiptRemaining===null}
    onChange={e=>setQuantities(old=>({...old,[`${p.invoiceLineId}:${p.receiptLineId}`]:e.target.value}))}/></label>)}
  <button>Tahsisleri kaydet</button></fieldset>{!enabled&&<p>Doğrulanmış sunucu tahsis yeteneği yok; gönderim kapalı.</p>}{message&&<p role="status">{message}</p>}</form>;
}

