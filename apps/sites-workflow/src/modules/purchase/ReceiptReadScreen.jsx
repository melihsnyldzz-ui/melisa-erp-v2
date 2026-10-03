import React, {useEffect,useRef,useState} from 'react';
import {fetchInventoryReceipt,fetchInventoryReceipts} from '../../services/receiptApi.js';
import {ReceiptDraftLineForm} from './ReceiptDraftLineForm.jsx';
import {ReceiptCreateForm} from './ReceiptCreateForm.jsx';
import {ReceiptTransitionForm} from './ReceiptTransitionForm.jsx';
import {createActiveRequestGate,createRequestIdentity} from '../shared/ReadOnlyInvoiceListScreen.jsx';

const PAGE_SIZE=4;
const statusText={draft:'Taslak',returned:'Geri gönderildi',submitted:'Muhasebe onayında',approved:'Kabul onaylandı'};
const billingText={awaiting_invoice:'Fatura bekliyor',partially_invoiced:'Kısmen faturalandı',invoiced:'Faturalandı'};
function readTime(meta){return meta?.readAt?new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'medium'}).format(new Date(meta.readAt)):'Doğrulanmadı';}
function sourceText(meta){return meta?.sourceContext?[meta.sourceContext.environment,meta.sourceContext.server,meta.sourceContext.database].filter(Boolean).join(' · '):'Kaynak doğrulanmadı';}
function quantityText(value){if(typeof value!=='string'||!/^\d+(\.\d+)?$/.test(value))return '—';return value.replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'').replace('.',',');}
function checkMeta(response,source){
 if(response?.success!==true||response.meta?.source!==source||typeof response.meta.readAt!=='string'||!Number.isFinite(Date.parse(response.meta.readAt)))throw Error('Okuma kaynağı doğrulanamadı.');
}
export function ReceiptReadScreen({source='PROMPT-2-20260923-01',initialReceiptId=null}){
 const [filters,setFilters]=useState({supplierId:'',status:''}),[page,setPage]=useState(1),[refresh,setRefresh]=useState(0);
 const [rows,setRows]=useState([]),[meta,setMeta]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [selection,setSelection]=useState(initialReceiptId?{source,id:initialReceiptId}:null),[detail,setDetail]=useState(null),[detailMeta,setDetailMeta]=useState(null),[detailLoading,setDetailLoading]=useState(false),[detailError,setDetailError]=useState('');
 const listGate=useRef(null),detailGate=useRef(null);
 if(!listGate.current)listGate.current=createActiveRequestGate();if(!detailGate.current)detailGate.current=createActiveRequestGate();
 const selectedId=selection?.source===source?selection.id:null;
 useEffect(()=>{
  const controller=new AbortController(),identity=createRequestIdentity({kind:`receipt-list:${page}:${filters.supplierId}:${filters.status}`,source}),token=listGate.current.begin(identity);
  const current=()=>!controller.signal.aborted&&listGate.current.isActive(token,identity);
  setLoading(true);setError('');setRows([]);setMeta(null);
  fetchInventoryReceipts({source,page,pageSize:PAGE_SIZE,...(filters.supplierId?{supplierId:filters.supplierId}:{}),...(filters.status?{status:filters.status}:{})},{signal:controller.signal})
   .then(response=>{if(!current())return;checkMeta(response,source);
    if(!Array.isArray(response.data)||!Number.isSafeInteger(response.meta.total)||response.meta.total<0||response.meta.page!==page
     ||response.data.some(row=>typeof row.id!=='string'||row.source!==source))throw Error('Kabul liste kapsamı doğrulanamadı.');
    setRows(response.data);setMeta(response.meta);
   }).catch(e=>{if(current()&&e.name!=='AbortError')setError(e.message||'Kabul listesi okunamadı.');})
   .finally(()=>{if(current())setLoading(false);});
  return ()=>{controller.abort();listGate.current.cancel(token);};
 },[source,page,filters.supplierId,filters.status,refresh]);
 useEffect(()=>{
  setDetail(null);setDetailMeta(null);setDetailError('');setDetailLoading(false);
  if(!selectedId){detailGate.current.clear();return undefined;}
  if(typeof selectedId!=='string'||!/^[1-9]\d{0,18}$/.test(selectedId)||BigInt(selectedId)>9223372036854775807n){detailGate.current.clear();setDetailError('Kabul kimliği geçersiz.');return undefined;}
  const controller=new AbortController(),identity=createRequestIdentity({kind:'receipt-detail',source,documentId:selectedId}),token=detailGate.current.begin(identity);
  const current=()=>!controller.signal.aborted&&detailGate.current.isActive(token,identity);
  setDetailLoading(true);
  fetchInventoryReceipt(selectedId,source,{signal:controller.signal}).then(response=>{
   if(!current())return;checkMeta(response,source);
   if(response.data?.source!==source||response.data?.id!==selectedId||!Array.isArray(response.data?.lines))throw Error('Seçilen kabul ile ayrıntı kimliği eşleşmedi.');
   setDetail(response.data);setDetailMeta(response.meta);
  }).catch(e=>{if(current()&&e.name!=='AbortError')setDetailError(e.message||'Kabul ayrıntısı okunamadı.');})
   .finally(()=>{if(current())setDetailLoading(false);});
  return ()=>{controller.abort();detailGate.current.cancel(token);};
 },[source,selectedId,refresh]);
 function closePanel(){detailGate.current.clear();setSelection(null);setDetail(null);setDetailMeta(null);setDetailError('');}
 function filter(key,value){if(filters[key]===value)return;listGate.current.clear();closePanel();setRows([]);setMeta(null);setLoading(true);setFilters(f=>({...f,[key]:value}));setPage(1);}
 function select(row){if(selectedId===row.id&&selection?.source===row.source)return;detailGate.current.clear();setDetail(null);setDetailError('');setSelection({source:row.source,id:row.id});}
 return <main className={`v17-document-screen ${selectedId?'detail-open':''}`}>
  <section className="v17-document-main">
   <header className="v17-document-heading"><div><span className="v17-eyebrow">GELEN MAL / KABUL</span><h1>Gelen mal</h1><p>Mal kabul kuyruğu · {meta?`${meta.total} kabul`:'Kayıt sayısı doğrulanmadı'}. Stok hareketleri bu kuyruğun yerine geçmez.</p></div>
    <div className="v17-read-meta"><strong>{sourceText(meta)}</strong><span>Okuma zamanı: {readTime(meta)}</span><span>Firma / dönem / iş tarihi: doğrulanmadı</span></div></header>
   <div className="v17-document-filters" role="search" style={{gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,180px),1fr))'}}>
    <label><span>Tedarikçi kimliği</span><input aria-label="Tedarikçi kimliği" inputMode="numeric" value={filters.supplierId} onChange={e=>filter('supplierId',e.target.value)} placeholder="Kaynak tedarikçi ID" /></label>
    <label><span>Kabul durumu</span><select aria-label="Kabul durumu" value={filters.status} onChange={e=>filter('status',e.target.value)}><option value="">Tümü</option>{Object.entries(statusText).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <button type="button" disabled={loading} onClick={()=>setRefresh(n=>n+1)}>Yenile</button>
   </div>
   <div className="v17-document-table-wrap">
    {/^[1-9]\d{0,18}$/.test(filters.supplierId)&&<ReceiptCreateForm key={`${source}:${filters.supplierId}`} source={source} supplierId={filters.supplierId} onSelectExisting={select} onCreated={id=>{setSelection({source,id});setRefresh(n=>n+1);}}/>}
    {meta&&<p className="v17-detail-source">{meta.visibilityScope==='all_task_receipts'
     ?'Liste görev kapsamındaki yetkili kabulleri kapsar; açık filtre ve sayfalama geçerlidir.'
     :meta.visibilityScope==='own_receipts_or_lines'
      ?'Yalnız kendi kayıtlarınız veya sayım satırlarınızın bulunduğu kabuller. Bu liste tedarikçinin bütün açık kabulleri değildir.'
      :'Liste görünürlük kapsamı doğrulanmadı; bütün açık kabuller olarak kullanılamaz.'}</p>}
    {loading&&<div className="v17-document-state">Kabul kayıtları okunuyor…</div>}
    {!loading&&error&&<div className="v17-document-state error" role="alert">{error} Kayıtlar boş veya tamamlanmış sayılmadı.</div>}
    {!loading&&!error&&!rows.length&&meta&&<div className="v17-document-state">{meta.outOfRange?'Bu sayfada kayıt yok; filtrelenmiş toplam korunuyor.':'Bu filtrelerde kabul kaydı yok.'}</div>}
    {!loading&&!error&&rows.length>0&&<table className="v17-document-table"><thead><tr><th>Kabul</th><th>Belge tarihi</th><th>Tedarikçi</th><th>Durum</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} tabIndex="0" className={selectedId===row.id?'selected':''} onClick={()=>select(row)} onKeyDown={e=>{if(e.key==='Enter')select(row);}}><td><strong>{row.documentNo}</strong><small>Kaynak ID #{row.id}</small></td><td>{row.documentDate}</td><td>#{row.supplierId} · {row.supplierName || 'Ad okunmadı'}</td><td><span className="v17-status">{statusText[row.status]||'Durum doğrulanmadı'}</span></td></tr>)}</tbody></table>}
   </div>
   <footer className="v17-document-pagination"><span>Sayfa {page} · {meta?`${meta.total} kayıt`:'Toplam doğrulanmadı'}</span><div><button type="button" disabled={loading||page<=1} onClick={()=>{closePanel();setPage(n=>n-1);}}>Önceki</button><button type="button" disabled={loading||!meta?.hasNextPage} onClick={()=>{closePanel();setPage(n=>n+1);}}>Sonraki</button></div></footer>
  </section>
  {selectedId&&<aside className="v17-document-detail" aria-label="Kabul ayrıntısı"><button className="v17-detail-close" type="button" onClick={closePanel} aria-label="Kabul ayrıntısını kapat">×</button>
   {detailLoading&&<div className="v17-document-state">Kabul ayrıntısı okunuyor…</div>}{!detailLoading&&detailError&&<div className="v17-document-state error" role="alert">{detailError}</div>}
   {!detailLoading&&detail&&detail.id===selectedId&&detail.source===source&&<><span className="v17-eyebrow">AYNI KAYNAK · ID #{detail.id}</span><h2>{detail.documentNo}</h2>
    <dl className="v17-detail-facts"><div><dt>Tedarikçi</dt><dd>#{detail.supplierId} · {detail.supplierName || 'Ad okunmadı'}</dd></div><div><dt>Belge tarihi</dt><dd>{detail.documentDate}</dd></div><div><dt>Durum</dt><dd>{statusText[detail.status]}</dd></div><div><dt>İrsaliye no</dt><dd>{detail.dispatchNumberState==='recorded'?(detail.dispatchNumber??'Kayıt boş'):'Doğrulanmadı'}</dd></div><div><dt>Faturalama</dt><dd>{detail.lineScope==='whole_receipt'?billingText[detail.billingStatus]||'Doğrulanmadı':detail.lineScope==='own_personnel_lines'?'Yalnız kendi satırlarınız':'Kapsam doğrulanmadı'}</dd></div></dl>
    <div className="v17-detail-source"><strong>{sourceText(detailMeta)}</strong><span>Okuma zamanı: {readTime(detailMeta)}</span></div>
    <h3>Kayıtlı kabul satırları</h3><p>{detail.lineScope==='own_personnel_lines'?'Yalnız kendi sayım satırlarınız; bütün kabul toplamı değildir.':'Birimler ve ürün miktarları tek toplama birleştirilmez.'}</p>
    <div className="v17-detail-lines">{detail.lines.length?detail.lines.map(line=><article key={line.id}><div><strong>{line.productId ? (line.productName || `Ürün #${line.productId}`) : "Ürün kimliği çözülmedi"}</strong><span>Satır #{line.id} · Sayan personel #{line.countedBy}</span></div><div className="v17-line-values"><span>{quantityText(line.quantity)} {line.unit || "(Birim doğrulanmadı)"}</span><span>Faturalanan: {quantityText(line.allocatedQuantity)} {line.unit || "(Birim doğrulanmadı)"}</span></div>{line.barcode && <small>Bildirilen barkod: {line.barcode}</small>}{line.supplierModelCode && <small>Bildirilen tedarikçi/model: {line.supplierModelCode}</small>}<small>{line.resolution==='verified'?'Ürün kimliği doğrulandı':line.resolution==='ambiguous'?'Ürün eşleştirmesi belirsiz':'Ürün eşleştirmesi çözülmedi'}</small></article>):<div className="v17-document-state">Bu kapsamda kayıtlı satır yok.</div>}</div>
    {['draft','returned'].includes(detail.status)&&<ReceiptDraftLineForm key={`${source}:${detail.id}:${detail.version}`} receipt={detail} meta={detailMeta} onSaved={()=>setRefresh(n=>n+1)}/>}
    <ReceiptTransitionForm key={`transition:${source}:${detail.id}:${detail.version}`} receipt={detail} meta={detailMeta} onSaved={()=>setRefresh(n=>n+1)}/>
   </>}
  </aside>}
 </main>;
}

