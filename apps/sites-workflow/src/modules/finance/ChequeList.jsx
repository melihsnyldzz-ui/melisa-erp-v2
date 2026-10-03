import {ChequeTransitionForm} from './ChequeTransitionForm.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {fetchTaskCheques,fetchTaskCheque} from '../../services/chequeApi.js';

const labels={draft:'Taslak',portfolio:'Portföyde',issued:'Verildi',bank_deposited:'Bankaya verildi',collected:'Tahsil edildi',paid:'Ödendi',cancelled:'İptal',dishonoured:'Karşılıksız',returned:'İade'};
const actions={finalize:'Teslim / muhasebe onayı',deposit:'Bankaya verme',settle:'Banka sonucu',cancel:'İptal',dishonour:'Karşılıksız',return:'İade'};
const PAGE_SIZE=4;
export function ChequeList({source='PROMPT-2-20260923-01',initialCheque=null}){
 const [page,setPage]=useState(1),[status,setStatus]=useState(''),[started,setStarted]=useState(false),[refresh,setRefresh]=useState(0);
 const [list,setList]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [selected,setSelected]=useState(null),[detail,setDetail]=useState(null),[detailError,setDetailError]=useState('');
 const [direction,setDirection]=useState(''),[currency,setCurrency]=useState('');
 const detailRequest=useRef(null);
 function close(){detailRequest.current?.abort();setSelected(null);setDetail(null);setDetailError('');}
 function verify(response){
  const m=response?.meta;
  if(response?.success!==true||m?.source!==source||m?.sourceContext?.environment!=='TEST'
   ||m?.sourceContext?.server!=='Semih\\MELISADEV'||m?.sourceContext?.database!=='MELISA_ERP_FULL_TEST_20260916'
   ||m?.amountScope!=='FACE_AMOUNT_NOT_BANK_BALANCE'||m.scope!=='TASK_CHEQUES_FINANCE_VIEW'||!Number.isFinite(Date.parse(m.readAt)))throw Error('Çek okuma kapsamı doğrulanamadı.');
 }
 useEffect(()=>{
  if(!started)return;const c=new AbortController();close();setLoading(true);setList(null);setError('');
  fetchTaskCheques({source,page,pageSize:PAGE_SIZE,...(status?{status}:{}),...(direction?{direction}:{}),...(currency?{currency}:{})},{signal:c.signal}).then(response=>{
   if(c.signal.aborted)return;verify(response);
   if(!Array.isArray(response.data)||response.meta.page!==page||response.meta.pageSize!==PAGE_SIZE||!Number.isSafeInteger(response.meta.total)||response.meta.total<0
    ||response.data.length!==Math.min(PAGE_SIZE,Math.max(0,response.meta.total-(page-1)*PAGE_SIZE))
    ||response.data.some(row=>row.source!==source||(status&&row.status!==status)||(direction&&row.direction!==direction)||(currency&&row.currency!==currency)))throw Error('Çek sayfası doğrulanamadı.');
   setList(response);
  }).catch(e=>{if(!c.signal.aborted)setError(e.message||'Çekler okunamadı.');}).finally(()=>{if(!c.signal.aborted)setLoading(false);});
  return()=>{c.abort();detailRequest.current?.abort();};
 },[source,page,status,direction,currency,started,refresh]);
 useEffect(()=>{
  close();
  if(initialCheque==null)return ()=>detailRequest.current?.abort();
  const id=initialCheque.documentId;
  if(initialCheque.kind!=='cheque'||initialCheque.source!=='/api/cheques'
   ||source!=='PROMPT-2-20260923-01'||typeof id!=='string'||!/^[1-9]\d{0,18}$/.test(id)||BigInt(id)>9223372036854775807n){
   setError('Çek bağlantı kimliği doğrulanamadı.');return ()=>detailRequest.current?.abort();
  }
  setError('');select({id});
  return ()=>detailRequest.current?.abort();
 },[source,initialCheque?.kind,initialCheque?.source,initialCheque?.documentId]);
 async function select(row){
  detailRequest.current?.abort();const c=new AbortController();detailRequest.current=c;setSelected(row.id);setDetail(null);setDetailError('');
  try{const response=await fetchTaskCheque(row.id,source,{signal:c.signal});if(c.signal.aborted)return;verify(response);
   if(response.data?.id!==row.id||response.data?.source!==source)throw Error('Seçilen çek kimliği eşleşmedi.');
   const h=response.meta.history;
   if(h&&(h.source!==source||h.chequeId!==row.id||h.version!==response.data.version
    ||h.scope!=='RECORDED_EVENT_AUDIT_CHAIN_NOT_BALANCE_RECONCILIATION'||!Array.isArray(h.items)||h.items.length!==h.version
    ||!Number.isFinite(Date.parse(h.createdAt))||typeof h.createdBy!=='string'
    ||h.items.some((e,i)=>!actions[e.action]||e.version!==i+1||!labels[e.status]||!labels[e.previousStatus]
     ||typeof e.actorId!=='string'||typeof e.eventDate!=='string'||!Number.isFinite(Date.parse(e.recordedAt)))))throw Error('Çek işlem geçmişi doğrulanamadı.');
   setDetail(response);
  }catch(e){if(!c.signal.aborted)setDetailError(e.message||'Çek ayrıntısı okunamadı.');}
 }
 return <section><h2>Çekler</h2><div className="v17-document-filters">
  <label>Durum<select value={status} onChange={e=>{close();setStatus(e.target.value);setPage(1);}}><option value="">Tümü</option>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
  <label>Yön<select value={direction} onChange={e=>{close();setDirection(e.target.value);setPage(1);}}><option value="">Tümü</option><option value="received">Alınan</option><option value="given">Verilen</option></select></label>
  <label>Döviz<select value={currency} onChange={e=>{close();setCurrency(e.target.value);setPage(1);}}><option value="">Tümü</option>{['TRY','USD','EUR'].map(c=><option key={c}>{c}</option>)}</select></label>
  <button type="button" disabled={loading} onClick={()=>{setStarted(true);setRefresh(n=>n+1);}}>Çekleri oku</button></div>
  {loading&&<p>Okunuyor…</p>}{error&&<p role="alert">{error} Kayıtlar boş sayılmadı.</p>}
  {list&&<><p>{list.meta.total} çek · Sayfa {page} · {'Görev çekleri'} · Okuma: {list.meta.readAt}</p>
   <p>Kaynak: {list.meta.sourceContext.server} / {list.meta.sourceContext.database}. Tutarlar çek bedelidir; banka bakiyesi değildir. Dövizler birleştirilmez.</p>
   <div className="v17-document-table-wrap"><table className="v17-document-table"><thead><tr><th>Çek</th><th>Yön / Cari</th><th>Çek tutarı</th><th>Durum</th></tr></thead><tbody>{list.data.map(row=><tr key={row.id}><td><button type="button" onClick={()=>select(row)}>#{row.id}</button></td><td>{row.direction==='received'?'Alınan':row.direction==='given'?'Verilen':'Doğrulanmadı'} · #{row.partyId} · Ad okunmadı</td><td>{row.amount} {row.currency}</td><td>{labels[row.status]||'Doğrulanmadı'}</td></tr>)}</tbody></table></div>
   {!list.data.length&&<p>{list.meta.total?'Sayfa aralığı dışında; toplam korunuyor.':'Bu filtrede kayıt yok.'}</p>}
   <button type="button" disabled={loading||page<=1} onClick={()=>setPage(p=>p-1)}>Önceki</button><button type="button" disabled={loading||page*PAGE_SIZE>=list.meta.total} onClick={()=>setPage(p=>p+1)}>Sonraki</button></>}
  {selected&&<aside aria-label="Çek ayrıntısı"><button type="button" onClick={close}>Kapat</button>{detailError?<p role="alert">{detailError}</p>:detail?<><h3>Çek #{detail.data.id}</h3><p>{labels[detail.data.status]}</p><p>{detail.data.amount} {detail.data.currency} · Kayıtlı vade {detail.data.dueDate}</p><p>Cari #{detail.data.partyId} · Ad okunmadı</p><p>Banka: {detail.data.bankName} · Çek no: {detail.data.number}</p><p>Vade gelmesi otomatik ödeme değildir.</p><p>Okuma zamanı: {detail.meta.readAt}</p>
   <section aria-label="Çek işlem geçmişi"><h4>İşlem geçmişi</h4>{detail.meta.history?<>
    <p>Oluşturan kullanıcı #{detail.meta.history.createdBy} · Kayıt zamanı (UTC): {detail.meta.history.createdAt}</p>
    <p>Kayıtlı işlem ve audit zinciri; banka/cari bakiye mutabakatı değildir.</p>
    {detail.meta.history.items.length?<ol>{detail.meta.history.items.map(e=><li key={e.eventId}>
     <strong>{actions[e.action]} · #{e.eventId}</strong><p>{labels[e.previousStatus]} → {labels[e.status]} · Sürüm {e.version}</p>
     <p>İş tarihi: {e.eventDate} · Kaydeden kullanıcı #{e.actorId} · Kayıt zamanı (UTC): {e.recordedAt}</p>
     {e.reversesPartyEventId&&<p>Özgün cari olay: #{e.reversesPartyEventId}</p>}{e.reversesBankEventId&&<p>Özgün banka olay: #{e.reversesBankEventId}</p>}
    </li>)}</ol>:<p>Taslak; henüz finansal işlem kaydı yok.</p>}
   </>:<p>İşlem geçmişi doğrulanmadı.</p>}</section>
   <ChequeTransitionForm key={`${source}:${detail.data.id}:${detail.data.version}`} cheque={detail.data} meta={detail.meta} onSaved={()=>{close();setRefresh(n=>n+1);}}/></>:<p>Ayrıntı okunuyor…</p>}</aside>}
 </section>;
}







