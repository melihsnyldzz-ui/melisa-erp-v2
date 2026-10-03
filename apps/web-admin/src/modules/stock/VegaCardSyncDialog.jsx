import React, {useState} from 'react';
import {post,get} from '../../services/apiClient.js';
const labels={new:'Yeni kart',stockCode:'Kod',name:'Ad',brand:'Marka',category:'Kategori',unit:'Birim',currency:'Para birimi',price:'Fiyat',barcodes:'Barkod',isActive:'Aktiflik',isDeleted:'Kart durumu'};
function CardValues({card}){
 return <dl>{Object.entries(card).map(([field,value])=><React.Fragment key={field}><dt>{labels[field]||field}</dt><dd>{Array.isArray(value)?(value.join(', ')||'Yok'):typeof value==='boolean'?(value?'Evet':'Hayır'):(value??'Yok')}</dd></React.Fragment>)}</dl>;
}
export function VegaCardSyncDialog({onClose,onApplied}){
 const [preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null),[page,setPage]=useState(0),[uncertain,setUncertain]=useState(false);
 async function read(){
  setBusy(true);setError('');setPreview(null);setPage(0);
  try{setPreview((await post('/api/product-card-sync/preview',{})).data);}
  catch(e){setError(e.message||'Vega okunamadı.');}finally{setBusy(false);}
 }
 async function apply(){
  if(busy||!preview||preview.issues.length||uncertain)return;
  setBusy(true);setError('');
  try{const data=(await post('/api/product-card-sync/apply',{previewId:preview.previewId})).data;setResult(data);onApplied(data);}
  catch(e){setUncertain(true);setError(e.message||'Güncelleme sonucu alınamadı. Sonucu kontrol edin.');}
  finally{setBusy(false);}
 }
 async function status(){
  setBusy(true);setError('');
  try{const data=(await get('/api/product-card-sync/status/'+preview.previewId)).data;if(data.state==='COMPLETED'){setResult(data);onApplied(data);}else{setError('Tamamlanmış güncelleme bulunamadı. Yeni önizleme almadan tekrar uygulamayın.');setUncertain(false);setPreview(null);}}
  catch(e){setError(e.message||'Sonuç kontrol edilemedi.');}finally{setBusy(false);}
 }
 const rows=preview?.changes.slice(page*100,(page+1)*100)||[];
 return <div className="bulk-update-backdrop">
  <section className="bulk-update-dialog" role="dialog" aria-modal="true" aria-labelledby="vega-card-title" style={{maxWidth:1100}}>
   <header className="bulk-update-header"><div><h2 id="vega-card-title">Vega’dan kartları güncelle</h2><p>Vega’daki bütün aktif ürün kartları. Stok miktarları ve mevcut fişler korunur; yeni kartların stoğu sıfırdır.</p></div><button type="button" disabled={busy} onClick={onClose}>Kapat</button></header>
   <div style={{padding:16,overflow:'auto',maxHeight:'65vh'}}>
    {error&&<p role="alert" className="list-state list-state-error">{error}</p>}
    {result?<p role="status">Güncelleme tamamlandı. {result.counts.new} yeni kart, {result.counts.updated} güncellenen kart. Stok miktarları ve fişler korundu.</p>:<>
     <p>Ad, kod, marka, kategori, birim, fiyat ve barkod bilgileri alınır. Kaynakta bulunmayan eski kartlar silinmez.</p>
     <button type="button" disabled={busy||uncertain} onClick={read}>{busy?'İşlem sürüyor…':'Vega kartlarını oku'}</button>
     {preview&&<>
      <p><strong>{preview.counts.activeSource} aktif Vega kartı</strong> · {preview.counts.new} yeni · {preview.counts.updated} güncellenecek · {preview.counts.unchanged} kartın görünen bilgileri aynı.</p>
      <p>Kaynak okuma zamanı: {new Date(preview.sourceAt).toLocaleString('tr-TR')}</p>
      {preview.issues.length>0&&<div role="alert"><strong>Güncelleme engellendi: {preview.issues.length} çakışma</strong><ul>{preview.issues.map((w,i)=><li key={i}>{w.stockCode}: {w.message}</li>)}</ul></div>}
      {preview.warnings.length>0&&<details><summary>{preview.warnings.length} bilgi/uyarı — incele</summary><ul>{preview.warnings.map((w,i)=><li key={i}>{w.stockCode}: {w.message}</li>)}</ul></details>}
      <div style={{overflowX:'auto',marginTop:12}}><table className="erp-table"><thead><tr><th>İşlem</th><th>Kod / ürün</th><th>Değişen alanlar</th><th>Önce</th><th>Sonra</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}><td>{r.kind}</td><td>{r.stockCode}<br/>{r.name}</td><td>{r.fields.map(f=>labels[f]||f).join(', ')}</td><td>{r.before?<details><summary>Önceki bilgiler</summary><CardValues card={r.before} /></details>:'Yeni kart'}</td><td><details><summary>Yeni bilgiler</summary><CardValues card={r.after} /></details></td></tr>)}</tbody></table></div>
      {preview.changes.length===0&&<p>Kartların görünen bilgileri güncel.</p>}
      <p>Değişiklik listesi: {page+1} / {Math.max(1,Math.ceil(preview.changes.length/100))}</p>
      <button type="button" disabled={busy||page===0} onClick={()=>setPage(p=>p-1)}>Önceki</button>{' '}
      <button type="button" disabled={busy||(page+1)*100>=preview.changes.length} onClick={()=>setPage(p=>p+1)}>Sonraki</button>
      <p>Güncelleme tüm aktif kartları kapsar; bu sayfadaki 100 satırla sınırlı değildir.</p>
      {uncertain?<button type="button" disabled={busy} onClick={status}>Güncelleme sonucunu kontrol et</button>:<button className="primary-action" type="button" disabled={busy||preview.issues.length>0} onClick={apply}>Güncelle</button>}
     </>}
    </>}
   </div>
  </section>
 </div>;
}
