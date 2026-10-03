import React,{useEffect,useRef,useState} from 'react';
import {get} from '../../services/apiClient.js';
const source='PROMPT-2-20260923-01';
export function SalesInverseContext({invoice}){
 const [result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const sequence=useRef(0),request=useRef(null);
 const identity=JSON.stringify([invoice?.id,invoice?.invoiceVersion]);
 useEffect(()=>{sequence.current++;setResult(null);setBusy(false);setError('');
  return()=>{sequence.current++;request.current?.abort();};},[identity]);
 const invoiceId=typeof invoice?.id==='string'?invoice.id:Number.isSafeInteger(invoice?.id)?String(invoice.id):'';
 const available=/^[1-9]\d{0,18}$/.test(invoiceId)&&BigInt(invoiceId)<=9223372036854775807n
  &&/^0x[0-9a-f]{16}$/i.test(invoice?.invoiceVersion||'')&&String(invoice?.status).toLowerCase()==='finalized';
 async function read(){
  if(!available||busy)return;const token=++sequence.current;request.current?.abort();
  const controller=new AbortController();request.current=controller;
  const current=()=>sequence.current===token&&!controller.signal.aborted;
  setBusy(true);setResult(null);setError('');
  try{
   const response=await get(`/api/sales-invoices/${encodeURIComponent(invoiceId)}/inverse-context`,
    {source,expectedVersion:invoice.invoiceVersion},{signal:controller.signal});
   if(!current())return;const r=response?.data;
   if(response?.success!==true||r?.source!==source||r.invoiceId!==invoiceId
    ||r.invoiceVersion?.toLowerCase()!==invoice.invoiceVersion.toLowerCase()
    ||r.sourceContext?.environment!=='TEST'||r.sourceContext.server!=='Semih\\MELISADEV'
    ||r.sourceContext.database!=='MELISA_ERP_FULL_TEST_20260916'
    ||typeof r.readAt!=='string'||!r.readAt.endsWith('Z')||!Number.isFinite(Date.parse(r.readAt))
    ||r.commands?.cancel?.enabled!==false||r.commands?.revise?.enabled!==false
    ||typeof r.recordedRevenueVerified!=='boolean'||r.originalEffectsMatched!==false||r.downstreamHistoryVerified!==false
    ||!Array.isArray(r.unavailableReasons))throw Error('Satış bağlamı doğrulanamadı.');
   setResult(r);
  }catch{if(current())setError('Satış düzeltme/iptal bağlamı okunamadı; işlem izni verilmedi.');}
  finally{if(current())setBusy(false);}
 }
 return <section className="v17-detail-lines"><h3>Satış düzeltme / iptal bağlamı</h3>
  <button type="button" disabled={!available||busy} onClick={read}>Kayıtlı satış bağlamını oku</button>
  {!available&&<p>Onaylı belge ve kayıtlı sürüm doğrulanmadı.</p>}
  {busy&&<p>Bağlam okunuyor…</p>}{error&&<p role="alert">{error}</p>}
  {result&&<><p>Kaynak: {result.sourceContext.database} · Okuma zamanı: {result.readAt}</p>
   <p>Kayıtlı gelir dağılımı: {result.recordedRevenueVerified?'Doğrulandı':'Doğrulanmadı'}. Özgün etki ve sonraki hareket mutabakatı tamamlanmadı.</p>
   <p>İptal/düzeltme yazıcısı etkin değil. Bu okuma stok, cari veya finans hareketi oluşturmaz.</p></>}
 </section>;
}

