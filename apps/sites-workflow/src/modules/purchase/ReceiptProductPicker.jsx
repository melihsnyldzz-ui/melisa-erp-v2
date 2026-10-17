import React,{useEffect,useRef,useState} from 'react';
import {fetchProducts} from '../../services/productApi.js';

export function ReceiptProductPicker({context,disabled,onSelect}){
 const [query,setQuery]=useState(''),[rows,setRows]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const request=useRef(null);
 const identity=JSON.stringify([context?.environment,context?.server,context?.database]);
 useEffect(()=>{setRows([]);setBusy(false);setError('');onSelect('');return()=>{request.current?.abort();};},[identity]);
 function change(value){request.current?.abort();setQuery(value);setRows([]);setError('');setBusy(false);onSelect('');}
 async function search(){
  if(disabled||!query.trim())return;
  request.current?.abort();const controller=new AbortController();request.current=controller;
  setBusy(true);setError('');setRows([]);onSelect('');
  try{
   const response=await fetchProducts({page:1,limit:20,search:query.trim(),activeOnly:true},{signal:controller.signal});
   if(controller.signal.aborted||request.current!==controller)return;
   const source=response?.meta?.sourceContext;
   if(response?.success!==true||context?.environment!=='TEST'||!context?.server||!context?.database
    ||source?.environment!==context.environment||source?.server!==context.server||source?.database!==context.database
    ||!Array.isArray(response.data)||!Number.isFinite(Date.parse(response.meta?.readAt)))throw Error('Ürün aramasının TEST kaynağı doğrulanamadı.');
   const items=response.data.map(row=>{
    const id=typeof row.id==='string'?row.id:Number.isSafeInteger(row.id)?String(row.id):'';
    if(!/^[1-9]\d{0,18}$/.test(id)||BigInt(id)>9223372036854775807n)throw Error('Ürün kimliği doğrulanamadı.');
    return {id,name:typeof row.name==='string'?row.name:`Ürün #${id}`};
   });
   setRows(items);if(!items.length)setError('Bu aramada ürün bulunmadı.');
  }catch(e){if(!controller.signal.aborted&&request.current===controller)setError(e.message||'Ürün araması okunamadı.');}
  finally{if(!controller.signal.aborted&&request.current===controller)setBusy(false);}
 }
 return <fieldset disabled={disabled} style={{minWidth:0}}><legend>Kaynak ürün seçimi</legend>
  <label>Ürün ara<input value={query} onChange={e=>change(e.target.value)}/></label>
  <button type="button" disabled={busy||!query.trim()} onClick={search}>Ara</button>
  {busy&&<p>Ürünler okunuyor…</p>}{error&&<p role="status">{error}</p>}
  {!!rows.length&&<label>İlk 20 eşleşme<select defaultValue="" onChange={e=>onSelect(rows.some(row=>row.id===e.target.value)?e.target.value:'')}><option value="">Ürün seçin</option>{rows.map(row=><option key={row.id} value={row.id}>{row.name} · #{row.id}</option>)}</select></label>}
  <p>Yalnız ürün kimliği aktarılır; fiyat veya geçmiş birim tamamlanmaz.</p>
 </fieldset>;
}

