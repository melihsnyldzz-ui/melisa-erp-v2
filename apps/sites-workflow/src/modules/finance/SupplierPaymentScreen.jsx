import React,{useEffect,useRef,useState} from 'react';
import {postSupplierPayment,compensateSupplierPayment,fetchSupplierPaymentAccounts,fetchSupplierPaymentOutcome} from '../../services/financeApi.js';
export function SupplierPaymentScreen({capability=null,supplierId=null,source=null}){
 const [accountRead,setAccountRead]=useState(null);
 const readKey=JSON.stringify([source,supplierId]);
 const [outcome,setOutcome]=useState(null),outcomeGeneration=useRef(null),outcomeRequest=useRef(null);
 const [pendingInverses,setPendingInverses]=useState(null);
 const validId=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
 useEffect(()=>{const token={};outcomeGeneration.current=token;setOutcome(null);setPendingInverses(null);
  return()=>{if(outcomeGeneration.current===token)outcomeGeneration.current=null;outcomeRequest.current?.abort();outcomeRequest.current=null;};},[readKey]);
 function loadPendingInverses(){
  if(source!=='PROMPT-2-20260923-01'||!validId(supplierId)||outcomeRequest.current)return;
  try{
   const prefix=`melisa.payment.inverse.pending:${source}:`,items=[];
   // Read only this workflow's pending records, never auth/session contents.
   for(let i=0;i<sessionStorage.length;i++){
    const key=sessionStorage.key(i);if(typeof key!=='string'||!key.startsWith(prefix))continue;
    const raw=sessionStorage.getItem(key),record=JSON.parse(raw||'null'),command=record?.command;
    if(command?.source!==source||command?.supplierId!==supplierId)continue;
    if(!validId(record.paymentId)||key!==prefix+record.paymentId||typeof command.requestId!=='string'
     ||!/^[a-zA-Z0-9-]{8,80}$/.test(command.requestId))throw Error('Bekleyen telafi kimliği doğrulanamadı.');
    items.push({key,paymentId:record.paymentId,requestId:command.requestId,raw});
   }
   setPendingInverses({key:readKey,items});
  }catch{setPendingInverses({key:readKey,error:'Bekleyen telafi kayıtları okunamadı. Saklanan istekler değiştirilmedi.'});}
 }
 async function inspectPending(inverse=null){
  const token=outcomeGeneration.current;if(!token||outcomeRequest.current||source!=='PROMPT-2-20260923-01'||!validId(supplierId))return;
  const request=new AbortController();outcomeRequest.current=request;
  const current=()=>outcomeGeneration.current===token&&outcomeRequest.current===request&&!request.signal.aborted;
  try{
   const key=inverse?`melisa.payment.inverse.pending:${source}:${inverse.paymentId}`:`melisa.payment.pending:${source}:${supplierId}`;
   const raw=sessionStorage.getItem(key),record=JSON.parse(raw||'null'),pending=inverse?record?.command:record;
   if(!pending||pending.source!==source||pending.supplierId!==supplierId||typeof pending.requestId!=='string'
    ||!/^[a-zA-Z0-9-]{8,80}$/.test(pending.requestId)
    ||(inverse&&(!validId(inverse.paymentId)||record.paymentId!==inverse.paymentId||pending.requestId!==inverse.requestId||raw!==inverse.raw)))
    throw Error('Bu cari için bekleyen işlem kimliği bulunamadı.');
   setOutcome({busy:true});
   const response=await fetchSupplierPaymentOutcome(supplierId,source,pending.requestId,{signal:request.signal});if(!current())return;
   const r=response?.data;
   if(response?.success!==true||r?.source!==source||r.supplierId!==supplierId||r.requestId!==pending.requestId
    ||!['RECORDED','NOT_FOUND'].includes(r.state)||r.retryAllowed!==false||r.pendingClearAllowed!==false
    ||typeof r.readAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?Z$/.test(r.readAt)||!Number.isFinite(Date.parse(r.readAt))
    ||(r.state==='RECORDED'&&(!validId(r.paymentId)||r.compensatesPaymentId!==(inverse?.paymentId??null)||r.paymentId===inverse?.paymentId))
    ||(r.state==='NOT_FOUND'&&(r.paymentId!==null||r.compensatesPaymentId!==null))
    ||sessionStorage.getItem(key)!==raw)throw Error('Ödeme sonuç yanıtı doğrulanamadı.');
   const label=inverse?`telafi #${r.paymentId} (özgün ödeme #${inverse.paymentId})`:`ödeme #${r.paymentId}`;
   setOutcome({busy:false,text:(r.state==='RECORDED'?`İstek kaydı bulundu: ${label}.`:'Bu okuma anında istek kaydı bulunamadı.')+` Okuma: ${r.readAt}. Komut içeriği mutabakatı tamamlanmadı; yeniden gönderim kilidi korunuyor.`});
  }catch(error){if(current())setOutcome({busy:false,text:'Sonuç doğrulanamadı; yeniden gönderim kilidi korunuyor.'});}
  finally{if(outcomeRequest.current===request)outcomeRequest.current=null;}
 }
 useEffect(()=>{
  let current=true;const abort=new AbortController();
  if(source!=='PROMPT-2-20260923-01'||typeof supplierId!=='string'||!/^[1-9]\d{0,18}$/.test(supplierId)
   ||BigInt(supplierId)>9223372036854775807n){setAccountRead(null);return()=>{current=false;abort.abort();};}
  setAccountRead({key:readKey,loading:true});
  Promise.resolve().then(()=>{if(!current)return;return fetchSupplierPaymentAccounts(supplierId,source,{signal:abort.signal});})
   .then(response=>{
    if(!current)return;const r=response?.data,m=response?.meta;
    if(response?.success!==true||r?.source!==source||r?.supplierId!==supplierId||!Array.isArray(r.accounts)
     ||!Array.isArray(r.debtCurrencies)||m?.source!==source||typeof m.readAt!=='string'||!Number.isFinite(Date.parse(m.readAt))
     ||m.sourceContext?.environment!=='TEST'||m.sourceContext.server!=='Semih\\MELISADEV'
     ||m.sourceContext.database!=='MELISA_ERP_FULL_TEST_20260916')throw Error('Hesap okuması doğrulanamadı.');
    const ids=new Set();
    for(const a of r.accounts){
     if(!a||typeof a.id!=='string'||!/^[1-9]\d{0,18}$/.test(a.id)||BigInt(a.id)>9223372036854775807n
      ||ids.has(a.id)||!['cash','bank'].includes(a.type)||!['TRY','USD','EUR'].includes(a.currency))
      throw Error('Hesap okuması doğrulanamadı.');
     ids.add(a.id);
    }
    if(r.debtCurrencies.some(c=>!['TRY','USD','EUR'].includes(c)))throw Error('Hesap okuması doğrulanamadı.');
    setAccountRead({key:readKey,loading:false,data:r,meta:m});
   }).catch(()=>{if(current)setAccountRead({key:readKey,loading:false,error:'Ödeme hesapları okunamadı; bakiye veya ödeme yetkisi doğrulanmadı.'});});
  return()=>{current=false;abort.abort();};
 },[source,supplierId]);
 const read=accountRead?.key===readKey?accountRead:null;
 const [date,setDate]=useState(''),[description,setDescription]=useState(''),[legs,setLegs]=useState([{accountId:'',amount:'',quoteId:''}]);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');const alive=useRef(false),locked=useRef(false);
 const [posted,setPosted]=useState(null),[inverseReason,setInverseReason]=useState('');const inverseLocked=useRef(false);
 const identity=JSON.stringify([source,supplierId,capability?.source,capability?.supplierId,capability?.eventDate,capability?.sourceContext?.environment,capability?.sourceContext?.server,capability?.sourceContext?.database]);
 const generation=useRef(null),[boundIdentity,setBoundIdentity]=useState(null);
 useEffect(()=>{
  const token={};generation.current=token;alive.current=true;locked.current=false;
  setDate('');setDescription('');setLegs([{accountId:'',amount:'',quoteId:''}]);setBusy(false);setMessage('');setBoundIdentity(identity);
  setPosted(null);setInverseReason('');inverseLocked.current=false;
  return()=>{alive.current=false;if(generation.current===token)generation.current=null;};
 },[identity]);
 const enabled=boundIdentity===identity&&(source===null||source===capability?.source)&&(supplierId===null||supplierId===capability?.supplierId)&&Number.isSafeInteger(capability?.maximumLegs)&&capability.maximumLegs>0&&capability?.enabled===true&&capability?.source==='PROMPT-2-20260923-01'&&capability?.eventDate===date
  &&capability?.sourceContext?.server==='Semih\\MELISADEV'&&capability?.sourceContext?.database==='MELISA_ERP_FULL_TEST_20260916'
  &&capability?.sourceContext?.environment==='TEST'&&Array.isArray(capability?.accounts)&&Array.isArray(capability?.exchangeQuotes);
 const accounts=capability?.accounts||[],quotes=capability?.exchangeQuotes||[];
 function update(index,key,value){setLegs(old=>old.map((leg,i)=>i===index?{...leg,[key]:value,...(key==='accountId'?{quoteId:''}:{})}:leg));}
 async function submit(event){
  event.preventDefault();if(!enabled||busy||locked.current)return;let body;
  const key=`melisa.payment.pending:${capability.source}:${capability.supplierId}`;
  try{
   if(sessionStorage.getItem(key)){setMessage('Önceki ödemenin sonucu doğrulanmalı.');return;}
   if(legs.length<1||legs.length>capability.maximumLegs)throw Error('Ödeme parçası sınırı doğrulanamadı.');
   const amounts=legs.map(leg=>{
    const account=accounts.find(a=>a.id===leg.accountId);if(!account||!['cash','bank'].includes(account.type))throw Error('Hesap seçin.');
    if(leg.quoteId){const q=quotes.find(q=>q.id===leg.quoteId&&q.supplierId===capability.supplierId&&q.source===capability.source&&q.eventDate===date&&q.paidCurrency===account.currency);
     if(!q||q.verified!==true)throw Error('Muhasebe kur dayanağı doğrulanmadı.');
     return {accountId:account.id,method:account.type,paidCurrency:account.currency,paidAmount:q.paidAmount,debtCurrency:q.debtCurrency,debtAmount:q.debtAmount,rateQuoteId:q.id};
    }
    if(!/^\d{1,14}(\.\d{1,4})?$/.test(leg.amount)||!/[1-9]/.test(leg.amount))throw Error('Pozitif kayıtlı tutar gerekli.');
    return {accountId:account.id,method:account.type,paidCurrency:account.currency,paidAmount:leg.amount,debtCurrency:account.currency,debtAmount:leg.amount};
   });
   body={source:capability.source,supplierId:capability.supplierId,requestId:crypto.randomUUID(),eventDate:date,description,legs:amounts};
   sessionStorage.setItem(key,JSON.stringify(body));
  }catch(e){setMessage(e.message||'Ödeme bilgisi veya istek kimliği doğrulanamadı.');return;}
  const token=generation.current,current=()=>alive.current&&generation.current===token;
  locked.current=true;setBusy(true);
  try{const response=await postSupplierPayment(body),r=response?.data;
   if(response?.success!==true||r?.source!==body.source||r?.supplierId!==body.supplierId||r?.status!=='posted'||typeof r?.paymentId!=='string'||!/^[1-9]\d{0,18}$/.test(r.paymentId))throw Error('Ödeme doğrulanamadı');
   if(BigInt(r.paymentId)>9223372036854775807n||!Array.isArray(r.warnings)||r.warnings.some(w=>!w||w.code!=='NEGATIVE_FINANCE_BALANCE'||!body.legs.some(leg=>leg.accountId===w.accountId&&leg.paidCurrency===w.currency)))throw Error('Ödeme uyarıları doğrulanamadı');
   const successMessage=`Ödeme #${r.paymentId} kaydedildi.${r.warnings.length?' Kaynak hesap bakiyesi negatif uyarısı var.':''}`;
   sessionStorage.removeItem(key);if(current()){setMessage(successMessage);setPosted({paymentId:r.paymentId,command:body,identity});}
  }catch{if(current())setMessage(`Ödeme sonucu doğrulanamadı. İstek ${body.requestId} saklandı; otomatik tekrar yok.`);}
  finally{if(current())setBusy(false);}
 }
 async function compensate(){
  if(!enabled||capability?.compensate!==true||!posted||posted.identity!==identity||posted.compensated||busy||inverseLocked.current)return;
  const reason=inverseReason.trim();if(!reason||reason.length>500){setMessage('Telafi gerekçesi gerekli.');return;}
  const original=posted,key=`melisa.payment.inverse.pending:${original.command.source}:${original.paymentId}`;
  let body;
  try{
   if(sessionStorage.getItem(key)){setMessage('Önceki telafi isteğinin sonucu doğrulanmalı.');return;}
   const {description:unused,requestId:oldRequest,...fields}=original.command;
   body={...fields,requestId:crypto.randomUUID(),reason};
   if(body.requestId===oldRequest)throw Error('Yeni istek kimliği gerekli.');
   sessionStorage.setItem(key,JSON.stringify({paymentId:original.paymentId,command:body}));
  }catch{setMessage('Telafi isteği güvenle hazırlanamadı.');return;}
  inverseLocked.current=true;setBusy(true);const token=generation.current,current=()=>alive.current&&generation.current===token;
  try{
   const response=await compensateSupplierPayment(original.paymentId,body),r=response?.data;
   if(response?.success!==true||r?.source!==body.source||r?.supplierId!==body.supplierId||r?.compensatesPaymentId!==original.paymentId
    ||r?.status!=='posted'||typeof r.paymentId!=='string'||!/^[1-9]\d{0,18}$/.test(r.paymentId)||BigInt(r.paymentId)>9223372036854775807n
    ||r.paymentId===original.paymentId||!Array.isArray(r.warnings)
    ||r.warnings.some(w=>!w||w.code!=='NEGATIVE_FINANCE_BALANCE'||!body.legs.some(l=>l.accountId===w.accountId&&l.paidCurrency===w.currency)))
    throw Error('Telafi sonucu doğrulanamadı.');
   sessionStorage.removeItem(key);
   if(current()){setPosted({...original,compensated:true});setMessage(`Ödeme #${original.paymentId}, telafi #${r.paymentId} ile ters kaydedildi.${r.warnings.length?' Hesap bakiyesi negatif uyarısı var.':''}`);}
  }catch{if(current())setMessage(`Telafi sonucu doğrulanamadı. İstek ${body.requestId} saklandı; otomatik tekrar yok.`);}
  finally{if(current())setBusy(false);}
 }
 return <main className="v17-document-screen"><section className="v17-document-main"><h1>Tedarikçi ödeme</h1><p>Tedarikçi: {supplierId||capability?.supplierId?`#${supplierId||capability?.supplierId}`:'Doğrulanmadı'}. Ödeme parçaları kendi dövizleriyle işlenir; farklı dövizler toplanmaz.</p>
  <button type="button" disabled={outcome?.busy||!supplierId||!source} onClick={()=>inspectPending()}>Bekleyen ödeme sonucunu oku</button>
  <button type="button" disabled={outcome?.busy||!supplierId||!source} onClick={loadPendingInverses}>Bekleyen telafileri yükle</button>
  {pendingInverses?.key===readKey&&<section aria-label="Bekleyen ödeme telafileri">
   {pendingInverses.error?<p role="alert">{pendingInverses.error}</p>:pendingInverses.items.length?
    <ul>{pendingInverses.items.map(item=><li key={item.key}>Özgün ödeme #{item.paymentId} · İstek {item.requestId} <button type="button" disabled={outcome?.busy} onClick={()=>inspectPending(item)}>Telafi sonucunu oku #{item.paymentId}</button></li>)}</ul>:
    <p>Bu oturumda seçili cariye ait saklanmış telafi isteği bulunamadı. Bu bilgi DB işlem sonucu değildir.</p>}
  </section>}
  {outcome?.text&&<p role="status">{outcome.text}</p>}
  {read?.loading&&<p role="status">Ödeme hesapları okunuyor…</p>}
  {read?.error&&<p role="alert">{read.error}</p>}
  {read?.data&&<section aria-label="Ödeme hesap okuması"><p>Kaynak: {read.meta.source} · Okuma zamanı: {read.meta.readAt}</p>
   <p>{read.data.accounts.length?`${read.data.accounts.length} hesap okundu.`:'Seçilebilir görev hesabı bulunamadı.'} Bakiye ve ödeme yetkisi doğrulanmadı.</p>
   <ul>{read.data.accounts.map(a=><li key={a.id}>Hesap #{a.id} · {a.type} · {a.currency}</li>)}</ul>
  </section>}
  <form onSubmit={submit}><label>İşlem tarihi<input type="date" value={date} disabled={busy||locked.current} onChange={e=>setDate(e.target.value)}/></label>
   {legs.map((leg,index)=><fieldset key={index} disabled={busy||locked.current}><legend>Ödeme parçası {index+1}</legend><label>Hesap<select value={leg.accountId} onChange={e=>update(index,'accountId',e.target.value)}><option value="">Doğrulanmış hesap seçin</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name||`#${a.id}`} · {a.type} · {a.currency}</option>)}</select></label>
    <label>Tutar<input inputMode="decimal" value={leg.amount} disabled={!!leg.quoteId} onChange={e=>update(index,'amount',e.target.value)}/></label>
    <label>Muhasebe kur kaydı<select value={leg.quoteId} onChange={e=>update(index,'quoteId',e.target.value)}><option value="">Aynı döviz</option>{quotes.filter(q=>q.eventDate===date&&q.paidCurrency===accounts.find(a=>a.id===leg.accountId)?.currency).map(q=><option key={q.id} value={q.id}>#{q.id}: {q.paidAmount} {q.paidCurrency} → {q.debtAmount} {q.debtCurrency}</option>)}</select></label>
    <button type="button" disabled={legs.length===1} onClick={()=>setLegs(old=>old.filter((_,i)=>i!==index))}>Parçayı çıkar</button></fieldset>)}
   <button type="button" disabled={!enabled||busy||locked.current||legs.length>=capability?.maximumLegs} onClick={()=>setLegs(old=>[...old,{accountId:'',amount:'',quoteId:''}])}>Nakit/banka parçası ekle</button>
   <label>Açıklama<textarea maxLength={500} value={description} disabled={busy||locked.current} onChange={e=>setDescription(e.target.value)}/></label>
   <button disabled={!enabled||busy||locked.current}>Ödemeyi kaydet</button>
  </form>{posted?.identity===identity&&<section aria-label="Kaydedilmiş ödemeyi telafi et"><p>Özgün ödeme #{posted.paymentId}; kayıtlar silinmez.</p>
   <label>Telafi gerekçesi<textarea maxLength={500} value={inverseReason} disabled={busy||inverseLocked.current||capability?.compensate!==true} onChange={e=>setInverseReason(e.target.value)}/></label>
   <button type="button" onClick={compensate} disabled={!enabled||capability?.compensate!==true||busy||inverseLocked.current||posted.compensated}>Ödemeyi ters kayıtla telafi et</button>
  </section>}{!enabled&&<p>Doğrulanmış TEST tedarikçi/hesap/dönem bağlantısı yok; gönderim kapalı. Çek ödemesi ayrı yaşam döngüsünü gerektirir.</p>}{message&&<p role="status">{message}</p>}
 </section></main>;
}


