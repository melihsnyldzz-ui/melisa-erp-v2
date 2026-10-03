import React,{useEffect,useRef,useState} from 'react';
import {postFinanceTransfer,compensateFinanceTransfer,fetchFinanceTransferAccounts} from '../../services/financeApi.js';
const id=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
// Capability must come from a verified server context, never navigation payload.
export function FinanceTransferForm({capability:suppliedCapability=null}){
 const [date,setDate]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[amount,setAmount]=useState(''),[description,setDescription]=useState(''),[message,setMessage]=useState('');
 const alive=useRef(false),locked=useRef(false);const [busy,setBusy]=useState(false);
 const [loaded,setLoaded]=useState(null),[reading,setReading]=useState(false),accountRequest=useRef(null);
 const [posted,setPosted]=useState(null),[reason,setReason]=useState(''),[compensated,setCompensated]=useState(false),inverseLocked=useRef(false);
 const capability=suppliedCapability||loaded;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;accountRequest.current?.abort();};},[]);
 const accounts=Array.isArray(capability?.accounts)?capability.accounts:[];
 const enabled=capability?.enabled===true&&capability.source==='PROMPT-2-20260923-01'&&capability.eventDate===date
  &&capability.sourceContext?.server==='Semih\\MELISADEV'&&capability.sourceContext?.database==='MELISA_ERP_FULL_TEST_20260916'&&capability.sourceContext?.environment==='TEST';
 async function readAccounts(){
  accountRequest.current?.abort();const c=new AbortController();accountRequest.current=c;setReading(true);setLoaded(null);setMessage('');setFrom('');setTo('');
  try{
   const response=await fetchFinanceTransferAccounts(date,{signal:c.signal});if(!alive.current||c.signal.aborted)return;
   const d=response?.data;
   if(response?.success!==true||d?.source!=='PROMPT-2-20260923-01'||d.eventDate!==date||d.enabled!==false||d.periodVerified!==false
     ||d.sourceContext?.environment!=='TEST'||d.sourceContext?.server!=='Semih\\MELISADEV'||d.sourceContext?.database!=='MELISA_ERP_FULL_TEST_20260916'
     ||!Array.isArray(d.accounts)||!Number.isFinite(Date.parse(d.readAt)))throw Error('Transfer hesap kaynağı doğrulanamadı.');
   setLoaded(d);
  }catch(e){if(alive.current&&!c.signal.aborted)setMessage(e.message||'Transfer hesapları okunamadı.');}
  finally{if(alive.current&&!c.signal.aborted)setReading(false);}
 }
 async function submit(e){
  e.preventDefault();if(!enabled||locked.current)return;
  const key=`melisa.transfer.pending:${capability.source}`;let body;
  try{
   if(sessionStorage.getItem(key))throw Error('Önceki transferin sonucu doğrulanmalı.');
   const a=accounts.filter(a=>a.id===from),b=accounts.filter(a=>a.id===to);
   if(a.length!==1||b.length!==1||!id(from)||!id(to)||from===to||a[0].type===b[0].type
    ||[a[0],b[0]].some(a=>!['cash','bank'].includes(a.type))||a[0].currency!==b[0].currency||!['TRY','USD','EUR'].includes(a[0].currency))throw Error('Aynı dövizde ayrı kasa ve banka hesabı seçin.');
   if(!/^\d{1,14}(\.\d{1,4})?$/.test(amount)||!/[1-9]/.test(amount))throw Error('Pozitif kayıtlı tutar gerekli.');
   body={source:capability.source,requestId:crypto.randomUUID(),fromAccountId:from,toAccountId:to,currency:a[0].currency,amount,eventDate:date,description};
   sessionStorage.setItem(key,JSON.stringify(body));
  }catch(error){setMessage(error.message||'Transfer bilgileri doğrulanamadı.');return;}
  locked.current=true;setBusy(true);
  try{
   const response=await postFinanceTransfer(body),r=response?.data;
   if(response?.success!==true||r?.source!==body.source||r?.status!=='posted'||!id(r?.transferId)||!Array.isArray(r.warnings)
    ||r.warnings.some(w=>!w||w.code!=='NEGATIVE_FINANCE_BALANCE'||w.accountId!==body.fromAccountId||w.currency!==body.currency))throw Error('Transfer doğrulanamadı');
   const message=`Transfer #${r.transferId} kaydedildi.${r.warnings.length?' Kaynak hesap bakiyesi negatif uyarısı var.':''}`;
   sessionStorage.removeItem(key);if(alive.current){setPosted({transferId:r.transferId,command:{...body}});setMessage(message);}
  }catch{if(alive.current)setMessage(`Transfer sonucu doğrulanamadı. İstek ${body.requestId} saklandı; otomatik tekrar yok.`);}
  finally{if(alive.current)setBusy(false);}
 }
 async function compensate(){
  if(!enabled||capability.compensate!==true||!posted||inverseLocked.current||compensated)return;
  const key=`melisa.transfer.compensation.pending:${posted.command.source}:${posted.transferId}`;let body;
  try{
   if(sessionStorage.getItem(key))throw Error('Önceki telafinin sonucu doğrulanmalı.');
   if(!reason.trim()||reason.length>500)throw Error('Telafi gerekçesi gerekli.');
   // Reverse only the confirmed command. No editable account/amount fields,
   // revaluation or Number conversion; SQL independently verifies the original.
   const original=posted.command;
   body={source:original.source,requestId:crypto.randomUUID(),fromAccountId:original.toAccountId,toAccountId:original.fromAccountId,
    currency:original.currency,amount:original.amount,eventDate:original.eventDate,reason};
   sessionStorage.setItem(key,JSON.stringify(body));
  }catch(e){setMessage(e.message||'Telafi bilgileri doğrulanamadı.');return;}
  inverseLocked.current=true;setBusy(true);
  try{
   const response=await compensateFinanceTransfer(posted.transferId,body),r=response?.data;
   if(response?.success!==true||r?.source!==body.source||r.status!=='posted'||!id(r.transferId)||r.transferId===posted.transferId
    ||r.compensatesTransferId!==posted.transferId||!Array.isArray(r.warnings)
    ||r.warnings.some(w=>!w||w.code!=='NEGATIVE_FINANCE_BALANCE'||w.accountId!==body.fromAccountId||w.currency!==body.currency))throw Error('Telafi doğrulanamadı');
   sessionStorage.removeItem(key);
   if(alive.current){setCompensated(true);setMessage(`Transfer #${posted.transferId}, #${r.transferId} ile telafi edildi.${r.warnings.length?' Kaynak hesap bakiyesi negatif uyarısı var.':''}`);}
  }catch{if(alive.current)setMessage(`Telafi sonucu doğrulanamadı. İstek ${body.requestId} saklandı; otomatik tekrar yok.`);}
  finally{if(alive.current)setBusy(false);}
 }
 return <section className="section-card"><h2>Kasa ↔ Banka transferi</h2><p>Aynı dövizde tek transfer; cari ve stok etkisi yoktur.</p>
  <form onSubmit={submit}><fieldset disabled={busy||locked.current}>
   <label>İşlem tarihi<input type="date" value={date} onChange={e=>{accountRequest.current?.abort();setLoaded(null);setReading(false);setFrom('');setTo('');setDate(e.target.value);}}/></label>
   {!suppliedCapability&&<button type="button" disabled={!date||reading} onClick={readAccounts}>{reading?'Hesaplar okunuyor…':'TEST hesaplarını oku'}</button>}
   <label>Çıkış hesabı<select value={from} onChange={e=>setFrom(e.target.value)}><option value="">Hesap seçin</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name||`#${a.id}`} · {a.type} · {a.currency}</option>)}</select></label>
   <label>Giriş hesabı<select value={to} onChange={e=>setTo(e.target.value)}><option value="">Hesap seçin</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name||`#${a.id}`} · {a.type} · {a.currency}</option>)}</select></label>
   <label>Tutar<input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
   <label>Açıklama<textarea maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}/></label>
   <button disabled={!enabled||busy||locked.current}>Transferi kaydet</button>
  </fieldset></form>{loaded&&<p>Kaynak: {loaded.sourceContext.server} / {loaded.sourceContext.database} · Okuma: {loaded.readAt}. {loaded.accounts.length?'Görev hesapları alındı.':'Uygun görev hesabı bulunmadı.'} Dönem ve yazma onayı doğrulanmadı.</p>}
  {posted&&<section aria-label="Transfer telafisi"><p>Kayıtlı transfer #{posted.transferId}: {posted.command.amount} {posted.command.currency}. Telafi aynı tutarı ters hesap yönünde kaydeder; eski kayıt korunur.</p>
   <label>Telafi gerekçesi<textarea maxLength={500} disabled={busy||inverseLocked.current||compensated} value={reason} onChange={e=>setReason(e.target.value)}/></label>
   <button type="button" onClick={compensate} disabled={!enabled||capability.compensate!==true||busy||inverseLocked.current||compensated}>Kayıtlı transferi telafi et</button>
   {capability?.compensate!==true&&<p>Sunucunun telafi yetkisi/bağlantısı doğrulanmadı; işlem kapalı.</p>}
  </section>}
  {!enabled&&<p>Doğrulanmış TEST hesap/dönem bağlantısı yok; transfer kapalı.</p>}{message&&<p role="status">{message}</p>}
 </section>;
}

