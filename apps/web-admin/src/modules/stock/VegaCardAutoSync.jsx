import React, {useEffect,useRef,useState} from 'react';
import {get,put} from '../../services/apiClient.js';

export function VegaCardAutoSync({onChanged}){
 const [status,setStatus]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const onChangedRef=useRef(onChanged),lastChange=useRef(null);
 useEffect(()=>{onChangedRef.current=onChanged;},[onChanged]);
 useEffect(()=>{
  let disposed=false,timer;
  async function refresh(){
   try{
    const next=(await get('/api/product-card-sync/automatic')).data;
    if(disposed)return;
    setStatus(next);setError('');
    if(next.lastChangedAt&&next.lastChangedAt!==lastChange.current){lastChange.current=next.lastChangedAt;onChangedRef.current?.();}
   }catch(e){if(!disposed)setError(e.message||'Senkron durumu alınamadı.');}
   finally{if(!disposed)timer=setTimeout(refresh,5000);}
  }
  void refresh();return()=>{disposed=true;clearTimeout(timer);};
 },[]);
 async function toggle(event){
  const enabled=event.target.checked;setBusy(true);setError('');
  try{setStatus((await put('/api/product-card-sync/automatic',{enabled})).data);}
  catch(e){setError(e.message||'Otomatik güncelleme ayarı kaydedilemedi.');}
  finally{setBusy(false);}
 }
 const time=value=>value?new Date(value).toLocaleString('tr-TR'):'Henüz kontrol edilmedi';
 return <section aria-label="Otomatik Vega kart güncellemesi" style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:'8px 16px',padding:'8px 12px',borderBottom:'1px solid var(--border-color, #ddd)',fontSize:12}}>
  <label style={{display:'inline-flex',alignItems:'center',gap:6}}><input type="checkbox" checked={status?.enabled===true} disabled={busy||!status} onChange={toggle}/> <strong>Otomatik güncelle</strong> · Her 60 saniyede</label>
  <span role="status">{status?.running?'Kontrol ediliyor…':`Son kontrol: ${time(status?.lastCheckedAt)}`}</span>
  {status?.lastCheckedAt&&<span>Son sonuç: {status.updated} güncellenen · {status.new} yeni kart{status.durationMs!==null?` · ${(status.durationMs/1000).toFixed(1)} sn`:''}</span>}
  <span>Sunucu açıkken sayfa kapalı olsa da çalışır.</span>
  {(error||status?.error)&&<span role="alert" style={{color:'#b42318'}}>{error||status.error.message}</span>}
 </section>;
}
