import React,{useEffect,useRef,useState} from 'react';
import {fetchStockCount,fetchStockCounts} from '../../services/stockCountApi.js';
const labels={counting:'Sayılıyor',submitted:'İncelemeye gönderildi',review:'İncelemede',closed:'Kapalı',compensated:'Telafi edildi'};
const source='PROMPT-2-20260923-01';
export function NativeStockCountScreen({initialCount=null}={}){
 const [input,setInput]=useState(''),[detail,setDetail]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const request=useRef(null);
 const [list,setList]=useState(null),[listError,setListError]=useState(''),[listBusy,setListBusy]=useState(false),[status,setStatus]=useState('');
 const listRequest=useRef(null);
 useEffect(()=>()=>{request.current?.abort();listRequest.current?.abort();},[]);
 const incomingId=initialCount?.documentId,incomingSource=initialCount?.source,incomingKind=initialCount?.kind;
 useEffect(()=>{
  clear();
  if(incomingId===undefined)return;
  if(incomingKind!=='stock_count'||incomingSource!=='/api/stock-counts'||typeof incomingId!=='string'
    ||!/^[1-9]\d{0,18}$/.test(incomingId)||BigInt(incomingId)>9223372036854775807n){setInput('');setError('Sayım bağlantısının türü, kaynağı veya kimliği doğrulanamadı.');return;}
  read({preventDefault(){}},incomingId);
  return()=>request.current?.abort();
 },[incomingId,incomingSource,incomingKind]);
 function clear(){request.current?.abort();request.current=null;setDetail(null);setError('');setLoading(false);}
 async function read(event,selectedId){
  event.preventDefault();clear();const controller=new AbortController();request.current=controller;setLoading(true);
  const documentId=selectedId??input.trim();if(selectedId)setInput(selectedId);
  try{
   const response=await fetchStockCount(documentId,source,{signal:controller.signal});
   if(controller.signal.aborted||request.current!==controller)return;
   const d=response?.data,context=d?.sourceContext;
   if(response?.success!==true||d?.documentId!==documentId||d?.source!==source||d?.readOnly!==true
     ||context?.environment!=='TEST'||context?.server!=='Semih\\MELISADEV'||context?.database!=='MELISA_ERP_FULL_TEST_20260916'
     ||!Array.isArray(d.areas)||!d.areas.length||!Object.hasOwn(labels,d.status)||!Number.isFinite(Date.parse(d.readAt)))
     throw Error('Sayım belgesi, kaynak veya okuma kapsamı doğrulanamadı.');
   setDetail(d);
  }catch(e){if(!controller.signal.aborted&&request.current===controller)setError(e.message||'Sayım okunamadı.');}
  finally{if(!controller.signal.aborted&&request.current===controller)setLoading(false);}
 }
 async function readList(page=1){
  listRequest.current?.abort();const controller=new AbortController();listRequest.current=controller;
  setListBusy(true);setListError('');setList(null);
  try{
   const response=await fetchStockCounts({page,pageSize:8,status},{signal:controller.signal});
   if(controller.signal.aborted||listRequest.current!==controller)return;
   const d=response?.data,c=d?.sourceContext;
   if(response?.success!==true||d?.source!==source||d.readOnly!==true||d.page!==page||d.pageSize!==8
    ||c?.environment!=='TEST'||c.server!=='Semih\\MELISADEV'||c.database!=='MELISA_ERP_FULL_TEST_20260916'
    ||!Number.isSafeInteger(d.total)||d.total<0||!Number.isFinite(Date.parse(d.readAt))||!Array.isArray(d.items)
    ||d.items.length!==Math.min(8,Math.max(0,d.total-(page-1)*8))||d.outOfRange!==(d.total>0&&d.items.length===0)
    ||d.items.some(h=>typeof h.documentId!=='string'||!/^[1-9]\d{0,18}$/.test(h.documentId)||BigInt(h.documentId)>9223372036854775807n
      ||h.source!==source||!Object.hasOwn(labels,h.status)||(status&&h.status!==status)))throw Error('Sayım listesi veya sayfa kapsamı doğrulanamadı.');
   setList(d);
  }catch(e){if(!controller.signal.aborted&&listRequest.current===controller)setListError(e.message||'Sayım listesi okunamadı.');}
  finally{if(!controller.signal.aborted&&listRequest.current===controller)setListBusy(false);}
 }
 return <main className="work-area"><section className="erp-panel">
  <div className="panel-title"><strong>Stok Sayımı</strong><span>Kayıtlı sayım alanları</span></div>
  <p>TEST sayım yazması ve kapanış onayı etkin değil. Bu ekran stok bakiyesini değiştirmez.</p>
  <form className="v17-document-filters" onSubmit={read}><label>Sayım belge kimliği<input value={input} inputMode="numeric" onChange={e=>{clear();setInput(e.target.value);}} placeholder="Belge kimliği"/></label>
   <button type="submit" disabled={loading||!input.trim()}>Belgeyi oku</button><button type="button" onClick={clear}>Kapat</button></form>
  <section aria-label="Görev sayım listesi"><label>Sayım durumu<select value={status} onChange={e=>{listRequest.current?.abort();setList(null);setListError('');setListBusy(false);setStatus(e.target.value);clear();}}>
   <option value="">Tüm durumlar</option>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <button type="button" disabled={listBusy} onClick={()=>readList(1)}>Görev sayımlarını listele</button>
   {listBusy&&<p role="status">Sayım listesi okunuyor…</p>}{listError&&<p role="alert">{listError} Kayıt sayısı doğrulanmadı.</p>}
   {list&&<><p>Filtrelenmiş belge sayısı: {list.total} · Sayfa {list.page} · Kaynak: {list.sourceContext.database} · Okuma: {list.readAt}</p>
    {list.total===0&&<p>Bu filtre ve yetki kapsamında sayım bulunamadı.</p>}{list.outOfRange&&<p>İstenen sayfa aralık dışında; kayıtların tümü boş değildir.</p>}
    <ul>{list.items.map(h=><li key={h.documentId}><button type="button" onClick={e=>read(e,h.documentId)}>Sayım #{h.documentId} · {labels[h.status]}</button> · {h.startedAt}</li>)}</ul>
    <button type="button" disabled={listBusy||list.page<=1} onClick={()=>readList(list.page-1)}>Önceki sayfa</button>
    <button type="button" disabled={listBusy||list.page*8>=list.total} onClick={()=>readList(list.page+1)}>Sonraki sayfa</button>
   </>}
  </section>
  {loading&&<p role="status">Sayım okunuyor…</p>}{error&&<p role="alert">{error} Okuma hatası boş sayım veya sıfır stok değildir.</p>}
  {detail&&<><h2>Sayım #{detail.documentId} · {labels[detail.status]}</h2>
   <p>Revizyon: {detail.revision} · Başlangıç: {detail.startedAt}</p>
   <p>Kaynak: {detail.sourceContext.server} / {detail.sourceContext.database} · Okuma: {detail.readAt}</p>
   <p>Firma ve dönem doğrulanmadı. Aşağıdaki miktarlar alan gözlemleridir; genel stok veya stok farkı değildir.</p>
   <div className="v17-document-table-wrap"><table className="v17-document-table"><thead><tr><th>Ürün / Alan</th><th>Kayıtlı gözlem</th><th>Gözlem zamanı</th><th>Durum</th></tr></thead>
    <tbody>{detail.areas.map(a=><tr key={`${a.itemId}:${a.areaKey}`}><td>Ürün #{a.productId} · {a.areaKey}<br/>Alan revizyonu {a.areaRevision}</td>
     <td>{a.quantity===null?'Henüz gözlenmedi':`${a.quantity} ${a.unit}`}</td>
     <td>{a.countedAt??'Bildirilmedi'}<br/>Alınma: {a.receivedAt??'Kayıt yok'}</td>
     <td>{a.observationId===null?'Güncel atama için gözlem yok':a.timeState==='unverified'?'Zaman doğrulanmadı':a.timeState==='reconciled'?'Zaman mutabakatı yapıldı':'Zaman doğrulandı'}{a.zeroConfirmed===true?' · Sıfır ayrıca doğrulandı':''}</td></tr>)}</tbody></table></div>
  </>}
 </section></main>;
}

