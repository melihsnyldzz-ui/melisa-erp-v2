import React,{useEffect,useRef,useState} from 'react';
import {fetchCollectionNotices,fetchCollectionNotice} from '../../services/financeApi.js';
import {CollectionNoticeReviewForm} from './CollectionNoticeReviewForm.jsx';
const labels={pending:'Muhasebe onayı bekliyor',approved:'Muhasebe onaylı',rejected:'Reddedildi'};
const PAGE_SIZE=4;
export function CollectionNoticeList({source='PROMPT-2-20260923-01',initialNotice=null}){
 const [page,setPage]=useState(1),[status,setStatus]=useState(''),[started,setStarted]=useState(false),[refresh,setRefresh]=useState(0);
 const [list,setList]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [selected,setSelected]=useState(null),[detail,setDetail]=useState(null),[detailError,setDetailError]=useState('');
 const detailRequest=useRef(null);
 function close(){detailRequest.current?.abort();setSelected(null);setDetail(null);setDetailError('');}
 function verify(response){
  const m=response?.meta;
  if(response?.success!==true||m?.source!==source||m?.sourceContext?.environment!=='TEST'
   ||m?.sourceContext?.server!=='Semih\\MELISADEV'||m?.sourceContext?.database!=='MELISA_ERP_FULL_TEST_20260916'
   ||m?.amountScope!=='REPORTED_AMOUNT_NOT_APPROVED_COLLECTION'||!['OWN_REPORTED_NOTICES','ALL_TASK_NOTICES'].includes(m.scope)||!Number.isFinite(Date.parse(m.readAt)))throw Error('Bildirim okuma kapsamı doğrulanamadı.');
 }
 useEffect(()=>{
  if(!started)return;const c=new AbortController();close();setLoading(true);setList(null);setError('');
  fetchCollectionNotices({source,page,pageSize:PAGE_SIZE,...(status?{status}:{})},{signal:c.signal}).then(response=>{
   if(c.signal.aborted)return;verify(response);
   if(!Array.isArray(response.data)||response.meta.page!==page||response.meta.pageSize!==PAGE_SIZE||!Number.isSafeInteger(response.meta.total)||response.meta.total<0
    ||response.data.length!==Math.min(PAGE_SIZE,Math.max(0,response.meta.total-(page-1)*PAGE_SIZE))
    ||response.data.some(row=>row.source!==source||(status&&row.status!==status)))throw Error('Bildirim sayfası doğrulanamadı.');
   setList(response);
  }).catch(e=>{if(!c.signal.aborted)setError(e.message||'Bildirimler okunamadı.');}).finally(()=>{if(!c.signal.aborted)setLoading(false);});
  return()=>{c.abort();detailRequest.current?.abort();};
 },[source,page,status,started,refresh]);
 useEffect(()=>{
  close();
  if(initialNotice==null)return ()=>detailRequest.current?.abort();
  const id=initialNotice.documentId;
  if(initialNotice.kind!=='collection_notice'||initialNotice.source!=='/api/collection-notices'
   ||source!=='PROMPT-2-20260923-01'||typeof id!=='string'||!/^[1-9]\d{0,18}$/.test(id)||BigInt(id)>9223372036854775807n){
   setError('Bildirim bağlantı kimliği doğrulanamadı.');return ()=>detailRequest.current?.abort();
  }
  setError('');select({id});
  return ()=>detailRequest.current?.abort();
 },[source,initialNotice?.kind,initialNotice?.source,initialNotice?.documentId]);
 async function select(row){
  detailRequest.current?.abort();const c=new AbortController();detailRequest.current=c;setSelected(row.id);setDetail(null);setDetailError('');
  try{const response=await fetchCollectionNotice(row.id,source,{signal:c.signal});if(c.signal.aborted)return;verify(response);
   if(response.data?.id!==row.id||response.data?.source!==source)throw Error('Seçilen bildirim kimliği eşleşmedi.');setDetail(response);
  }catch(e){if(!c.signal.aborted)setDetailError(e.message||'Bildirim ayrıntısı okunamadı.');}
 }
 return <section><h2>Bildirimler</h2><div className="v17-document-filters">
  <label>Durum<select value={status} onChange={e=>{close();setStatus(e.target.value);setPage(1);}}><option value="">Tümü</option>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
  <button type="button" disabled={loading} onClick={()=>{setStarted(true);setRefresh(n=>n+1);}}>Bildirimleri oku</button></div>
  {loading&&<p>Okunuyor…</p>}{error&&<p role="alert">{error} Kayıtlar boş sayılmadı.</p>}
  {list&&<><p>{list.meta.total} bildirim · Sayfa {page} · {list.meta.scope==='OWN_REPORTED_NOTICES'?'Kendi bildirimleriniz':'Görev kapsamı'} · Okuma: {list.meta.readAt}</p>
   <p>Kaynak: {list.meta.sourceContext.server} / {list.meta.sourceContext.database}. Tutarlar bildirim tutarıdır; onaylı tahsilat toplamı değildir.</p>
   <div className="v17-document-table-wrap"><table className="v17-document-table"><thead><tr><th>Bildirim</th><th>Müşteri</th><th>Bildirilen tutar</th><th>Durum</th></tr></thead><tbody>{list.data.map(row=><tr key={row.id}><td><button type="button" onClick={()=>select(row)}>#{row.id}</button></td><td>#{row.customerId} · Ad okunmadı</td><td>{row.reportedAmount} {row.currency}</td><td>{labels[row.status]||'Doğrulanmadı'}</td></tr>)}</tbody></table></div>
   {!list.data.length&&<p>{list.meta.total?'Sayfa aralığı dışında; toplam korunuyor.':'Bu filtrede kayıt yok.'}</p>}
   <button type="button" disabled={loading||page<=1} onClick={()=>setPage(p=>p-1)}>Önceki</button><button type="button" disabled={loading||page*PAGE_SIZE>=list.meta.total} onClick={()=>setPage(p=>p+1)}>Sonraki</button></>}
  {selected&&<aside aria-label="Bildirim ayrıntısı"><button type="button" onClick={close}>Kapat</button>{detailError?<p role="alert">{detailError}</p>:detail?<><h3>Bildirim #{detail.data.id}</h3><p>{labels[detail.data.status]}</p><p>{detail.data.reportedAmount} {detail.data.currency} · Bildirim tarihi {detail.data.reportedOn}</p><p>Müşteri #{detail.data.customerId} · Ad okunmadı</p><p>Okuma zamanı: {detail.meta.readAt}</p><CollectionNoticeReviewForm key={`${source}:${detail.data.id}:${detail.data.version}`} notice={detail.data} meta={detail.meta} onSaved={()=>{close();setRefresh(n=>n+1);}}/></>:<p>Ayrıntı okunuyor…</p>}</aside>}
 </section>;
}




