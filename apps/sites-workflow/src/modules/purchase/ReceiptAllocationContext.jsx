import React,{useEffect,useRef,useState} from 'react';
import {get} from '../../services/apiClient.js';
import {ReceiptAllocationForm} from './ReceiptAllocationForm.jsx';
const source='PROMPT-2-20260923-01';
const decimal=v=>typeof v==='string'&&/^\d+(\.\d{1,8})?$/.test(v);
export function ReceiptAllocationContext({invoice}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const sequence=useRef(0),request=useRef(null);
 const identity=`${invoice?.id}|${invoice?.invoiceVersion}`;
 useEffect(()=>{sequence.current++;setData(null);setError('');setBusy(false);return()=>{sequence.current++;request.current?.abort();};},[identity]);
 const available=/^[1-9]\d{0,18}$/.test(String(invoice?.id))&&/^0x[0-9a-f]{16}$/i.test(invoice?.invoiceVersion||'')&&String(invoice?.status).toLowerCase()==='draft';
 async function read(){
  if(!available)return;const token=++sequence.current;request.current?.abort();const controller=new AbortController();request.current=controller;
  setBusy(true);setError('');setData(null);
  try{
   const response=await get(`/api/purchase-invoices/${encodeURIComponent(invoice.id)}/allocation-context`,{source,invoiceVersion:invoice.invoiceVersion},{signal:controller.signal});
   if(token!==sequence.current||controller.signal.aborted)return;
   const r=response?.data;
   if(response?.success!==true||r?.source!==source||r.invoiceId!==String(invoice.id)||r.invoiceVersion?.toLowerCase()!==invoice.invoiceVersion.toLowerCase()
    ||r.supplierId!==String(invoice.supplierId)||r.currency!==invoice.documentCurrency||r.readOnly!==true
    ||r.sourceContext?.server!=='Semih\\MELISADEV'||r.sourceContext?.database!=='MELISA_ERP_FULL_TEST_20260916'||r.sourceContext?.environment!=='TEST'
    ||typeof r.readAt!=='string'||!r.readAt.endsWith('Z')||!Number.isFinite(Date.parse(r.readAt))||r.capacityScope!=='RECORDED_ACTIVE_ALLOCATIONS_AT_READ_TIME'
    ||!Array.isArray(r.items)||r.items.some(p=>typeof p?.unit!=='string'||!p.unit.trim()||[p.invoiceRemaining,p.receiptRemaining].some(v=>v!==null&&!decimal(v))))throw Error('Tahsis yanıtının belge, kaynak veya miktar bilgisi doğrulanamadı.');
   setData(r);
  }catch(e){if(token===sequence.current&&!controller.signal.aborted)setError(e.message||'Tahsis bağlamı okunamadı.');}
  finally{if(token===sequence.current&&!controller.signal.aborted)setBusy(false);}
 }
 return <section className="v17-detail-lines"><h3>Gelen mal tahsisleri</h3>
  <button type="button" disabled={!available||busy} onClick={read}>Kayıtlı tahsis kapasitesini oku</button>
  {!available&&<p>Taslak belge ve kayıtlı sürüm doğrulanmadı; tahsis okuması kapalı.</p>}
  {busy&&<p>Bağlam okunuyor…</p>}{error&&<p role="alert">{error}</p>}
  {data&&<><p>Kaynak: {data.sourceContext.database} · Okuma zamanı: {data.readAt}</p><p>Okuma anındaki kapasite; firma/dönem doğrulanmadı. Tahsis gönderimi kapalı.</p>
   {!data.items.length&&<p>Bu görev kapsamındaki belge için uygun kayıtlı eşleşme bulunamadı.</p>}
   {data.items.map(p=><article key={`${p.invoiceLineId}:${p.receiptLineId}`}><strong>Alış satırı #{p.invoiceLineId} ↔ Kabul #{p.receiptId} / satır #{p.receiptLineId}</strong>
    <p>Ürün #{p.productId} · {p.unit}</p><p>Alışta kalan: {p.invoiceRemaining===null?'Doğrulanmadı':p.invoiceRemaining} · Kabulde kalan: {p.receiptRemaining===null?'Doğrulanmadı':p.receiptRemaining}</p></article>)}
   <ReceiptAllocationForm key={`${data.source}:${data.invoiceId}:${data.invoiceVersion}:${data.readAt}`} context={data}/>
  </>}
 </section>;
}

