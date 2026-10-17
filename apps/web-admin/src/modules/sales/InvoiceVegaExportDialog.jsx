import React,{useEffect,useRef,useState} from 'react';
import {post} from '../../services/apiClient.js';
import './invoice-vega-export.css';
export const vegaExportLabel=state=>({NOT_ATTEMPTED:'Gönderilmedi',READY:'Gönderime hazır',VERIFIED:'Vega’da doğrulandı',REVIEW_REQUIRED:'Sonuç incelenmeli',BLOCKED:'Gönderilemedi'})[state]||state;
const money=(value,currency)=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:currency||'TRY'}).format(Number(value||0));
export function InvoiceVegaExportDialog({invoiceIds,onClose,onResult}){
 const dialog=useRef(null),[preview,setPreview]=useState(null),[results,setResults]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[sending,setSending]=useState(false),[confirmed,setConfirmed]=useState(false);
 useEffect(()=>{dialog.current?.showModal();let alive=true;
  post('/api/invoice-vega-export/preview',{invoiceIds}).then(r=>{if(alive)setPreview(r.data);}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};},[]);
 async function submit(){
  if(sending||!confirmed||!preview?.readyCount)return;
  setSending(true);setError('');
  try{const r=await post('/api/invoice-vega-export/submit',{token:preview.token,confirmed:true});setResults(r.data.rows);onResult(r.data.rows);}
  catch(e){setError(e.message+' Gönderim düğmesine tekrar basmayın; aktarım durumunu kontrol edin.');setResults([]);onResult(invoiceIds.map(invoiceId=>({invoiceId,state:'REVIEW_REQUIRED'})));}
  finally{setSending(false);}
 }
 async function check(){
  setLoading(true);setError('');
  try{const r=await post('/api/invoice-vega-export/status',{invoiceIds,reconcile:true});setResults(r.data.rows);onResult(r.data.rows);}catch(e){setError(e.message);}finally{setLoading(false);}
 }
 const rows=(preview?.rows||[]).map(row=>({...row,...results?.find(r=>r.invoiceId===row.invoiceId)}));
 const totals=(preview?.rows||[]).filter(r=>r.ready).reduce((a,r)=>({...a,[r.currency]:(a[r.currency]||0)+Number(r.total)}),{});
 return <dialog ref={dialog} className="vega-export-dialog" aria-labelledby="vega-export-title" onCancel={event=>{event.preventDefault();if(!sending)onClose();}}>
  <header><div><h2 id="vega-export-title">Seçilen fişleri Vega’ya gönder</h2><p>Kaynak: Test ERP · Hedef: Vega 2026 / F0102 / D0007</p></div><button type="button" disabled={sending} onClick={onClose} aria-label="Aktarım penceresini kapat">×</button></header>
  <div className="vega-export-body">
   <p className="vega-export-notice">{preview?.notice||'Fişler gönderilmeden önce cari, ürün, barkod, birim, tutar ve aktarım geçmişi kontrol edilir.'}</p>
   {loading&&<p role="status">Fişler ve Vega bağlantısı kontrol ediliyor…</p>}
   {error&&<p role="alert" className="vega-export-error">{error}</p>}
   {rows.length>0&&<div className="vega-export-table"><table><thead><tr><th>Fiş / Tarih</th><th>Cari / Kaynak personel</th><th>Toplam / Kur</th><th>Vega aktarım hesabı</th><th>Durum</th></tr></thead><tbody>{rows.map(row=><tr key={row.invoiceId}><td><strong>{row.documentNo||'#'+row.invoiceId}</strong><small>{row.date} · {row.lines||0} satır</small></td><td>{row.customer}<small>{row.employee||'Personel belirtilmemiş'}</small></td><td>{money(row.total,row.currency)}<small>Kayıtlı kur: {row.rate||'-'}</small></td><td>{row.target?<>{row.target.terminalName}<small>Personel: {row.target.personnelCode} · {row.target.depot}</small></>:'Doğrulanamadı'}</td><td><strong className={row.state==='VERIFIED'?'vega-export-success':''}>{vegaExportLabel(row.state)}</strong><small>{row.message||row.reason||''}</small>{row.documentNumber&&<small>{row.documentNumber}</small>}</td></tr>)}</tbody></table></div>}
   {preview&&results===null&&<><div className="vega-export-totals"><strong>{preview.readyCount} uygun / {preview.rows.length} seçilen fiş</strong>{Object.entries(totals).map(([currency,total])=><span key={currency}>{money(total,currency)}</span>)}</div>
    {preview.readyCount>0&&<label className="vega-export-confirm"><input type="checkbox" checked={confirmed} disabled={sending} onChange={e=>setConfirmed(e.target.checked)}/><span>Gönderime hazır fişlerin Vega’da daha önce elle işlenmediğini kontrol ettim. Gösterilen aktarım hesabı ve toplamlarla Vega’da gerçek satış oluşturulmasını onaylıyorum.</span></label>}
   </>}
   {sending&&<p role="status">Fişler sırayla gönderiliyor. Sonucu belirsiz bir fiş olursa sıra durdurulur.</p>}
  </div><footer><button type="button" disabled={sending} onClick={onClose}>{results?'Kapat':'Vazgeç'}</button><button type="button" disabled={loading||sending} onClick={check}>Vega sonucunu kontrol et</button>{results===null&&<button className="primary" type="button" disabled={loading||sending||!confirmed||!preview?.readyCount} onClick={submit}>{sending?'Gönderiliyor…':(preview?.readyCount||0)+' fişi Vega’ya gönder'}</button>}</footer>
 </dialog>;
}
