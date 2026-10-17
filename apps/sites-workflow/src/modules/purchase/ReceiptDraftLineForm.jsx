import React,{useEffect,useRef,useState} from 'react';
import {captureInventoryReceiptLine,appendInventoryReceiptLine,editInventoryReceiptQuantities,resolveInventoryReceiptLine} from '../../services/receiptDraftApi.js';
import {fetchReceiptLineIdentity} from '../../services/receiptApi.js';
import {ReceiptProductPicker} from './ReceiptProductPicker.jsx';

// Current read service supplies readOnly:true: this prepared form cannot activate it.
export function ReceiptDraftLineForm({receipt,meta,onSaved}){
 const [barcode,setBarcode]=useState(''),[model,setModel]=useState(''),[quantity,setQuantity]=useState('');
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [action,setAction]=useState('capture'),[productId,setProductId]=useState(''),[lineId,setLineId]=useState('');
 const [evidence,setEvidence]=useState(null),[unit,setUnit]=useState(''),[reason,setReason]=useState(''),[ack,setAck]=useState(false),[reading,setReading]=useState(false);
 const preview=useRef(null);
 const live=useRef(null),locked=useRef(false);
 const identity=`${receipt.source}:${receipt.id}:${receipt.version}`;
 useEffect(()=>{const token={};live.current=token;return()=>{if(live.current===token)live.current=null;};},[identity]);
 useEffect(()=>{const token={controller:null};preview.current=token;setEvidence(null);setAck(false);setReading(false);setUnit('');setReason('');
  return()=>{token.controller?.abort();if(preview.current===token)preview.current=null;};},[identity,action,lineId]);
 async function readIdentity(){
  const token=preview.current;if(!token||!lineId||locked.current)return;
  token.controller?.abort();const controller=new AbortController();token.controller=controller;
  setReading(true);setEvidence(null);setProductId('');setAck(false);setMessage('Eşleştirme adayları okunuyor…');
  try{
   const response=await fetchReceiptLineIdentity(receipt.id,lineId,receipt.source,{signal:controller.signal}),data=response?.data,m=response?.meta;
   if(preview.current!==token||controller.signal.aborted)return;
   if(response?.success!==true||data?.source!==receipt.source||data.receiptId!==receipt.id||data.lineId!==lineId||data.version!==receipt.version
    ||!Array.isArray(data.productIds)||new Set(data.productIds).size!==data.productIds.length
    ||data.productIds.some(v=>typeof v!=='string'||! /^[1-9]\d{0,18}$/.test(v)||BigInt(v)>9223372036854775807n)
    ||!['unmatched','corroborated_candidate','single_source_proposal','conflicting_candidates'].includes(data.classification)
    ||!/^[a-f0-9]{64}$/.test(data.evidenceHash||'')||data.automaticallyResolved!==false||data.unit!==null
    ||m?.source!==receipt.source||m.server!==meta?.sourceContext?.server||m.database!==meta?.sourceContext?.database
    ||typeof m.readAt!=='string'||!Number.isFinite(Date.parse(m.readAt)))throw Error('Kanıt kimliği doğrulanamadı');
   setEvidence({...data,readAt:m.readAt});setMessage('Adaylar otomatik eşleştirme değildir; ürün ve birimi açıkça doğrulayın.');
  }catch{if(preview.current===token&&!controller.signal.aborted)setMessage('Eşleştirme kanıtı okunamadı; aday yok sonucu çıkarılmadı.');}
  finally{if(preview.current===token&&!controller.signal.aborted)setReading(false);}
 }
 const enabled=Number.isSafeInteger(receipt.version)&&receipt.version>=0&&meta?.readOnly===false&&meta?.source===receipt.source
  &&meta?.commands?.[action]===true&&meta?.commands?.receiptId===receipt.id
  &&meta?.commands?.version===receipt.version&&(receipt.status==='draft'||action==='resolve'&&receipt.status==='returned');
 async function submit(event){
  event.preventDefault();if(!enabled||locked.current)return;
  const validId=value=>/^[1-9]\d{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n;
  if(action==='resolve' ? (!evidence||evidence.lineId!==lineId||!evidence.productIds.includes(productId)||!unit.trim()||unit.length>40||!reason.trim()||reason.length>500||!ack)
   : (!/^\d+(\.\d{1,3})?$/.test(quantity)||Number(quantity)>1000
   ||(action==='capture'&&!barcode.trim()&&!model.trim())
   ||(action==='append'&&!validId(productId))
   ||(action==='edit'&&(!validId(lineId)||!receipt.lines?.some(line=>line.id===lineId))))){
   setMessage('Kod veya kayıtlı kimlik ile 0–1000 aralığında en çok üç ondalıklı miktar girin.');return;
  }
  const key=`melisa.receipt.pending:${receipt.source}:${receipt.id}`;
  let body;
  try{
   if(sessionStorage.getItem(key)){setMessage('Önceki isteğin sonucu doğrulanmalı; yeni gönderim kapalı.');return;}
   body={source:receipt.source,expectedVersion:receipt.version,requestId:crypto.randomUUID(),
    ...(action==='capture'?{barcode:barcode.trim()||null,supplierModelCode:model.trim()||null,quantity}
     :action==='append'?{productId,quantity}:action==='resolve'?{productId,observedEvidenceHash:evidence.evidenceHash,confirmedUnit:unit.trim(),confirmedUnitMultiplier:'1',reason:reason.trim()}:{quantities:[{lineId,quantity}]})};
   sessionStorage.setItem(key,JSON.stringify({action,receiptId:receipt.id,body}));
  }catch{setMessage('İstek kimliği güvenle saklanamadı; gönderilmedi.');return;}
  const token=live.current;locked.current=true;setBusy(true);setMessage('Gönderiliyor…');
  try{
   const send={capture:captureInventoryReceiptLine,append:appendInventoryReceiptLine,edit:editInventoryReceiptQuantities,resolve:(id,command)=>resolveInventoryReceiptLine(id,lineId,command)}[action];
   const response=await send(receipt.id,body);
   if(response?.success!==true||response.data?.id!==receipt.id||response.data?.source!==receipt.source||response.data?.version!==receipt.version+1)throw Error('Sonuç doğrulanamadı');
   if(action==='resolve'&&(response.data.lineId!==lineId||response.data.productId!==productId||response.data.unit!==body.confirmedUnit||response.data.resolution!=='verified'||response.data.resolutionEvidenceHash!==body.observedEvidenceHash))throw Error('Eşleştirme sonucu doğrulanamadı');
   sessionStorage.removeItem(key);
   if(live.current===token){setMessage('Sayım satırı kaydedildi.');onSaved?.();}
  }catch{
   if(live.current===token)setMessage(`Sonuç doğrulanamadı. İstek ${body.requestId} saklandı; otomatik tekrar yapılmaz.`);
  }finally{if(live.current===token)setBusy(false);}
 }
 return <form onSubmit={submit} aria-label="Kabul sayım satırı">
  <h3>Sayım satırı</h3><p>Ürün ve birim tahmin edilmez; bildirilen kodlar eşleştirme için korunur.</p>
  <label>İşlem<select value={action} disabled={busy||locked.current} onChange={e=>{setAction(e.target.value);setProductId('');setQuantity('');setMessage('');}}><option value="capture">Barkod/model bildir</option><option value="append">Ürün satırı ekle</option><option value="edit">Kayıtlı miktarı düzelt</option><option value="resolve">Belirsiz ürün kimliğini incele</option></select></label>
  {action==='capture'&&<><label>Barkod<input value={barcode} onChange={e=>setBarcode(e.target.value)} disabled={busy}/></label>
  <label>Tedarikçi model kodu<input value={model} onChange={e=>setModel(e.target.value)} disabled={busy}/></label></>}
  {action==='append'&&<><ReceiptProductPicker context={meta?.sourceContext} disabled={busy||locked.current} onSelect={setProductId}/><p>Seçilen ürün: {productId?`#${productId}`:'Seçilmedi'}</p></>}
  {action==='edit'&&<label>Kayıtlı satır<select value={lineId} disabled={busy} onChange={e=>setLineId(e.target.value)}><option value="">Satır seçin</option>{(receipt.lines||[]).map(line=><option key={line.id} value={line.id}>#{line.id} · Ürün {line.productId||'çözülmedi'} · {line.quantity} {line.unit||'birim doğrulanmadı'}</option>)}</select></label>}
  {action==='resolve'&&<><label>Çözülmemiş satır<select value={lineId} disabled={busy} onChange={e=>setLineId(e.target.value)}><option value="">Satır seçin</option>{(receipt.lines||[]).filter(line=>line.resolution!=='verified').map(line=><option key={line.id} value={line.id}>#{line.id} · {line.barcode||line.supplierModelCode||'Kod yok'}</option>)}</select></label>
   <button type="button" onClick={readIdentity} disabled={!lineId||busy||reading||locked.current}>Adayları oku</button>
   {evidence&&<><p>Okuma: {evidence.readAt} · Kaynak: {evidence.source}</p><p>{evidence.classification==='unmatched'?'Eşleşen aday bulunmadı.':evidence.classification==='conflicting_candidates'?'Kaynaklar çelişiyor; otomatik ürün seçilmedi.':'Aday bulundu; kesin eşleştirme değildir.'}</p>
    <label>Doğrulanan ürün<select value={productId} disabled={busy} onChange={e=>{setProductId(e.target.value);setAck(false);}}><option value="">Ürün seçin</option>{evidence.productIds.map(id=><option key={id} value={id}>Ürün #{id}</option>)}</select></label>
    <label>Doğrulanan kayıtlı birim<input value={unit} disabled={busy} onChange={e=>{setUnit(e.target.value);setAck(false);}}/></label><p>Yalnız aynı birim ve 1 çarpan; dönüşüm tahmin edilmez. Miktar değişmez.</p>
    <label>Gerekçe<input value={reason} disabled={busy} onChange={e=>{setReason(e.target.value);setAck(false);}}/></label>
    <label><input type="checkbox" checked={ack} disabled={busy} onChange={e=>setAck(e.target.checked)}/>Ürünü ve aynı birimi inceledim.</label></>}
  </>}
  {action!=='resolve'&&<label>Miktar<input inputMode="decimal" value={quantity} onChange={e=>setQuantity(e.target.value)} disabled={busy}/></label>}
  {!enabled&&<p>TEST yazma bağlantısı doğrulanmadı; gönderim kapalı.</p>}
  <button type="submit" disabled={!enabled||busy||locked.current}>Sayım satırını gönder</button>
  {message&&<p role="status">{message}</p>}
 </form>;
}



