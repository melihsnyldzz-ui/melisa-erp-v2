import React,{useState,useEffect,useRef} from 'react';
import JsBarcode from 'jsbarcode';
import {currencies,balance,dispatchOperations,productBarcodes,priceInput} from '../../demo/operationsStore.js';
import { statementOutput } from '../../demo/operationsOutput.js';
import { exportRowsToExcel, printRowsReport } from '../../utils/exportUtils.js';
import './barcode-labels.css';
import { Plus, PencilLine, Search, Package, ChevronRight, X } from 'lucide-react';
import { availableStock, reservedQuantity } from '../../demo/operationsStore.js';
import { financePosition } from '../../demo/operationsFinance.js';
import { CurrencyMark } from './WorkspaceChrome.jsx';
const money=(n,c)=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:c}).format(n/100);
const empty={name:'',code:'',barcode:'',barcodes:'',unitBarcodesText:'',brand:'',category:'',ageGroup:'',size:'',seriesText:'',active:true,phone:'',country:'',supplierId:'',cost:'',salePrice:'',prices:{TRY:'',USD:'',EUR:''},creditLimits:{TRY:'0',USD:'0',EUR:'0'}};
const toForm=row=>row?{...empty,...row,barcodes:(row.barcodes||[]).join(', '),unitBarcodesText:(row.unitBarcodes||[]).map(item=>`${item.size}:${item.barcode}`).join(', '),seriesText:(row.series||[]).map(part=>`${part.size}:${part.quantity}`).join(', '),cost:String((row.cost||0)/100),salePrice:String((row.salePrice||0)/100),prices:Object.fromEntries(currencies.map(c=>[c,priceInput(row,c)])),creditLimits:Object.fromEntries(currencies.map(c=>[c,String((row.creditLimits?.[c]||0)/100)]))}:empty;
function BarcodeLabel({product,code,size}){
 const svg=useRef(null),[failure,setFailure]=useState(false);
 useEffect(()=>{try{JsBarcode(svg.current,code,{format:'CODE128',width:1.5,height:48,displayValue:true,fontSize:12,margin:6});setFailure(false);}catch{setFailure(true);}},[code]);
 return <article className="barcode-label"><strong>{product.name}</strong><span>{product.code} · {size?`Beden ${size} · 1 parça`:`Tam seri / paket · ${product.unitFactor||1} parça`}</span><svg ref={svg} role="img" aria-label={`${code} barkodu`} hidden={failure}/>{failure&&<span role="alert">Bu barkod etikete dönüştürülemedi.</span>}</article>;
}
function BarcodeLabels({product}){
 const packages=[product.barcode,...(product.barcodes||[])].filter(Boolean);
 return <div className="barcode-print-sheet" aria-label="Barkod etiketi çıktısı">{packages.map(code=><BarcodeLabel key={`package-${code}`} product={product} code={code}/>)}{(product.unitBarcodes||[]).map(item=><BarcodeLabel key={`piece-${item.barcode}`} product={product} code={item.barcode} size={item.size}/>)}</div>;
}
export function MasterCards({entity,state,permissions,onDirtyChange,initialId='',onOpenScreen}) {
 const [id,setId]=useState(initialId),[form,setForm]=useState(()=>toForm(state[entity].find(p=>p.id===initialId))),[dirty,setDirty]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [editorOpen,setEditorOpen]=useState(Boolean(initialId));
 const editorRef=useRef(null), directoryRef=useRef(null);
 useEffect(()=>{if(editorOpen)editorRef.current?.scrollIntoView({behavior:'smooth',block:'nearest'});},[editorOpen,id]);
 const [search,setSearch]=useState(''),[activeOnly,setActiveOnly]=useState(false),[page,setPage]=useState(0),[pageSize,setPageSize]=useState(25);
 const product=entity==='products',rows=state[entity];
 const allowed=permissions.includes(product?'product.edit':entity==='customers'?'customer.edit':'supplier.edit');
 const busy=useRef(false);
 useEffect(()=>{onDirtyChange?.(dirty);},[dirty,onDirtyChange]);
 const change=(k,v)=>{setForm(f=>({...f,[k]:v}));setDirty(true);};
 const select=value=>{
  if(dirty&&!window.confirm('Kaydedilmemiş kart değişiklikleri bırakılsın mı?'))return;
  const row=rows.find(p=>p.id===value);setId(value);setForm(toForm(row));setDirty(false);setError('');setMessage('');setEditorOpen(true);
 };
 const normalizedSearch=search.trim().toLocaleLowerCase('tr');
 const filtered=rows.filter(p=>(!activeOnly||p.active!==false)&&`${p.code||''} ${p.name} ${p.brand||''} ${p.category||''} ${p.phone||''} ${p.country||''} ${product?productBarcodes(p).join(' '):''}`.toLocaleLowerCase('tr').includes(normalizedSearch)).sort((a,b)=>{const exactA=a.name.toLocaleLowerCase('tr')===normalizedSearch,exactB=b.name.toLocaleLowerCase('tr')===normalizedSearch;return Number(exactB)-Number(exactA)||a.name.localeCompare(b.name,'tr',{numeric:true});});
 const pages=Math.max(1,Math.ceil(filtered.length/pageSize));const currentPage=Math.min(page,pages-1);
 const save=async()=>{if(busy.current)return;busy.current=true;try{
  if(!allowed)throw Error('Kart düzenleme yetkiniz yok.');
  const series=form.seriesText.trim()?form.seriesText.split(',').map(part=>{const [size,quantity,...extra]=part.trim().split(':');if(extra.length||!size?.trim()||!quantity?.trim())throw Error('Seriyi beden:adet biçiminde yazın; örnek 56:2, 62:2.');return {size:size.trim(),quantity:quantity.trim()};}):[];
  const unitBarcodes=form.unitBarcodesText.trim()?form.unitBarcodesText.split(',').map(part=>{const [size,barcode,...extra]=part.trim().split(':');if(extra.length||!size?.trim()||!barcode?.trim())throw Error('Birim barkodlarını beden:barkod biçiminde yazın; örnek 56:8690001.');return {size:size.trim(),barcode:barcode.trim()};}):[];
  const input=product?{...form,series,unitBarcodes,barcodes:form.barcodes.split(/[\s,;]+/).filter(Boolean)}:form;
  const next=await dispatchOperations({type:'save-card',entity,id:id||undefined,input});
  const saved=next[entity].find(p=>p.id===(id||next[entity].at(-1).id));setId(saved.id);setForm(toForm(saved));setDirty(false);setError('');setMessage('Kart kaydedildi. Yeni işlemlerde seçebilirsiniz.');
 }catch(e){setError(e.message);setMessage('');}finally{busy.current=false;}};
 const movements=state.movements.filter(m=>product?m.productId===id:m.partyId===id);
 const audits=(state.cardAudit||[]).filter(a=>a.entity===entity&&a.id===id);
 const selected=rows.find(p=>p.id===id);
 return <section className="erp-panel op-form business-directory" aria-label="Kart yönetimi" ref={directoryRef}>
  <div className="op-section-title"><h2 className="ui-section-icon"><Search size={17} aria-hidden="true"/>{product?'Ürün listesi':entity==='customers'?'Müşteri listesi':'Tedarikçi listesi'}</h2><div className="op-actions">{!editorOpen&&dirty&&<button type="button" onClick={()=>setEditorOpen(true)}><PencilLine size={16} aria-hidden="true"/>Düzenlemeye devam et</button>}{product&&onOpenScreen&&<><button type="button" onClick={()=>onOpenScreen('price-list')}>Fiyat listesi ve kurlar</button><button type="button" onClick={()=>onOpenScreen('stock-valuation')}>Stok değerleme</button></>}<button type="button" className="primary-action" disabled={!allowed} onClick={()=>select('')}><Plus size={16} aria-hidden="true"/>Yeni kart</button></div></div>
  <div className="ui-directory-toolbar"><label>{product?'Kod, ad, marka veya barkod ara':'Kart ara'}<input value={search} placeholder={product?'Ürün adı, stok kodu veya barkod':'Ad, cari kodu, telefon veya ülke'} onChange={e=>{setSearch(e.target.value);setPage(0);}}/></label><label><input type="checkbox" checked={activeOnly} onChange={e=>{setActiveOnly(e.target.checked);setPage(0);}}/>Yalnız aktifler</label><button type="button" disabled={!search&&!activeOnly} onClick={()=>{setSearch('');setActiveOnly(false);setPage(0);}}>Temizle</button><span>{filtered.length} kayıt</span></div>
  <div className="table-shell business-table"><table className="erp-table"><thead><tr><th>{product?'Ürün / kod':'Cari'}</th>{product?<><th>Tedarikçi</th><th>Marka</th><th>Paket</th><th>Parça/paket</th><th>Ayrılmış</th><th>Kullanılabilir</th></>:<><th>İletişim</th>{currencies.map(c=><th key={c} className="numeric"><CurrencyMark code={c}/></th>)}</>}<th>Kart</th></tr></thead><tbody>{filtered.slice(currentPage*pageSize,(currentPage+1)*pageSize).map(row=><tr key={row.id} className={id===row.id&&editorOpen?'ui-directory-row-selected':''}><td><button type="button" onClick={()=>select(row.id)}><span><span className="ui-directory-name">{row.name}</span><span className="ui-directory-secondary">{row.code||''}{row.active===false?' · Pasif':''}</span></span></button></td>{product?<><td>{state.suppliers.find(p=>p.id===row.supplierId)?.name||'—'}</td><td>{row.brand||'—'}</td><td>{row.stock}</td><td>{row.unitFactor||1}</td><td>{reservedQuantity(state,row.id)}</td><td><strong>{availableStock(state,row.id)}</strong></td></>:<><td>{row.phone||'—'}<span className="ui-directory-secondary">{row.country||'Ülke belirtilmedi'}</span></td>{currencies.map(c=><td key={c} className="numeric">{money(balance(state,row.id,c),c)}</td>)}</>}<td><button type="button" aria-label={`${row.name} kartını aç`} onClick={()=>select(row.id)}><ChevronRight size={17} aria-hidden="true"/>Aç</button></td></tr>)}</tbody></table></div>
  {!filtered.length&&<div className="ui-empty"><Package size={24} aria-hidden="true"/><div><strong>Eşleşen kayıt yok</strong><small>Aramayı değiştirin veya yeni kart açın.</small></div></div>}
  <div className="op-actions ui-pagination business-pagination"><label>Satır<select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(0);}}>{[25,50,100].map(n=><option key={n}>{n}</option>)}</select></label><span>{filtered.length?currentPage*pageSize+1:0}–{Math.min((currentPage+1)*pageSize,filtered.length)} / {filtered.length} kart · {currentPage+1} / {pages}</span><button type="button" disabled={currentPage===0} onClick={()=>setPage(v=>v-1)}>Önceki</button><button type="button" disabled={currentPage>=pages-1} onClick={()=>setPage(v=>v+1)}>Sonraki</button></div>
  <div className="ui-card-editor" ref={editorRef} hidden={!editorOpen}>
  <div className="op-section-title"><h2 className="ui-editor-caption"><PencilLine size={17} aria-hidden="true"/>{selected?.name||'Yeni kart'}</h2><button type="button" onClick={()=>{setEditorOpen(false);directoryRef.current?.scrollIntoView({behavior:'smooth',block:'start'});}}><X size={15} aria-hidden="true"/>Listeye dön</button></div>
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  <div className="op-fields">
   <label>Kart adı<input value={form.name} onChange={e=>change('name',e.target.value)}/></label>
   {product?<>
    <label>Stok kodu<input value={form.code} onChange={e=>change('code',e.target.value)}/></label>
    <label>Ana barkod<input value={form.barcode} onChange={e=>change('barcode',e.target.value)}/></label>
    <label>Ek barkodlar (virgülle ayırın)<input value={form.barcodes} onChange={e=>change('barcodes',e.target.value)}/></label>
    <label>Beden barkodları (beden:barkod)<input value={form.unitBarcodesText} onChange={e=>change('unitBarcodesText',e.target.value)} placeholder="56:8690001, 62:8690002"/></label>
    <label>Marka<input value={form.brand} onChange={e=>change('brand',e.target.value)}/></label>
    <label>Kategori<input value={form.category} onChange={e=>change('category',e.target.value)}/></label>
    <label>Yaş grubu<input value={form.ageGroup} onChange={e=>change('ageGroup',e.target.value)}/></label>
    <label>Beden açıklaması<input value={form.size} onChange={e=>change('size',e.target.value)}/></label>
    <label>Seri içeriği (beden:adet)<input value={form.seriesText} onChange={e=>change('seriesText',e.target.value)} placeholder="56:2, 62:2"/></label>
    <label>Ana tedarikçi<select value={form.supplierId} onChange={e=>change('supplierId',e.target.value)}><option value="">Seçin</option>{state.suppliers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Tahmini maliyet (TRY)<input type="number" min="0.01" step="0.01" value={form.cost} onChange={e=>change('cost',e.target.value)}/></label>
    {currencies.map(c=><label key={c}>Satış fiyatı ({c})<input type="number" min="0.01" step="0.01" value={form.prices[c]} onChange={e=>change('prices',{...form.prices,[c]:e.target.value})}/></label>)}
    <label><input type="checkbox" checked={form.active} onChange={e=>change('active',e.target.checked)}/> Aktif ürün</label>
   </>:<>
    <label>Telefon<input value={form.phone} onChange={e=>change('phone',e.target.value)}/></label>
    <label>Ülke<input value={form.country} onChange={e=>change('country',e.target.value)}/></label>
    {entity==='customers'&&currencies.map(c=><label key={c}>Açık hesap limiti ({c})<input type="number" min="0" step="0.01" value={form.creditLimits[c]} onChange={e=>change('creditLimits',{...form.creditLimits,[c]:e.target.value})}/></label>)}
   </>}
  </div>
  {product&&<p>Stok miktarı tam seri/paket sayısıdır. {form.seriesText?'Her bedene ayrı barkod tanımlanabilir; beden barkodu tek parça tanır, yalnız tüm seri tamamlandığında paket olarak eklenir.':'Tekli ürünün katsayısı 1.'} Döviz fiyatları ayrı etiketlerdir; kurla otomatik çevrilmez.</p>}
  <button className="primary-action" disabled={!allowed||!dirty} onClick={save}>Kartı kaydet</button>
  {id&&<>
   {product&&<><p>Stok: {selected.stock} paket × {selected.unitFactor||1} = {selected.stock*(selected.unitFactor||1)} parça. Son onaylı alış: {selected.lastPurchasePrice?`${money(selected.lastPurchasePrice.amount,selected.lastPurchasePrice.currency)} · ${selected.lastPurchasePrice.date}`:'Henüz yok'}. Tahmini maliyet ayrıca kaydedilir.</p><p>Onaylı alış ortalaması (KDV hariç, TRY): {selected.actualPurchaseCostTry==null?'Hesaplanamadı; bu tarihte kur bulunmayabilir.':`${money(selected.actualPurchaseCostTry,'TRY')} / paket · ${selected.actualPurchaseCostUnits} faturalı paket`}. Bu tutar eldeki stokun değerlemesi değildir.</p>{productBarcodes(selected).length>0&&<details><summary>Barkod etiketleri ({productBarcodes(selected).length})</summary><p>Etiket çıktısında yalnız barkod, ürün, stok kodu ve paket/beden bilgisi bulunur.</p><BarcodeLabels product={selected}/><button type="button" onClick={()=>window.print()}>Yalnız etiketleri yazdır / PDF kaydet</button></details>}</>}
   {!product&&<section className="party-open-documents"><h3>Fişler ve kalan borç</h3><div className="op-actions"><button type="button" onClick={()=>onOpenScreen?.('collections-overview',{kind:entity==='customers'?'collection':'payment',partyId:id,tabLabel:form.name,workflowTaskId:`party-${id}`})}>{entity==='customers'?'Tahsilat gir':'Ödeme gir'}</button></div><div className="table-shell"><table className="erp-table"><thead><tr><th>Fiş</th><th>Döviz</th><th>Tutar</th><th>Kalan</th><th>Vade</th></tr></thead><tbody>{currencies.flatMap(c=>financePosition(state,id,c).invoices.map(d=><tr key={d.id}><td><button onClick={()=>onOpenScreen?.(d.kind==='sale'?'sales-invoice-list':'purchase-invoice-list',{selectedDocumentId:d.id,documentNo:d.number})}>{d.number}</button></td><td>{c}</td><td>{money(d.amount,c)}</td><td>{money(d.open,c)}</td><td>{d.dueDate||'—'}</td></tr>))}</tbody></table></div></section>}
   <h3>{product?'Stok hareketleri':'Cari ekstre'}</h3>
   {!product&&<><p>{currencies.map(c=>money(balance(state,id,c),c)).join(' / ')}</p><div className="op-actions">{currencies.map(c=><React.Fragment key={c}><button type="button" onClick={()=>printRowsReport(statementOutput(state,id,c))}>{c} ekstre yazdır / PDF</button><button type="button" onClick={()=>exportRowsToExcel(statementOutput(state,id,c))}>{c} ekstre Excel</button></React.Fragment>)}</div></>}
   <div className="table-shell"><table className="erp-table"><thead><tr><th>Tarih</th><th>Belge</th><th>İşlem</th><th>{product?'Paket farkı':'Cari farkı'}</th></tr></thead><tbody>{movements.map((m,i)=><tr key={i}><td>{m.date}</td><td>{state.documents.find(d=>d.id===m.documentId)?.number}</td><td>{m.kind==='cancel'?'İptal hareketi':'Belge hareketi'}</td><td>{product?m.stockDelta:money(m.partyDelta,m.currency)}</td></tr>)}</tbody></table></div>
   {!movements.length&&<p>Bu karta ait hareket yok.</p>}
   <details><summary>Kart değişiklik geçmişi ({audits.length})</summary>{audits.map((a,i)=><p key={i}>{new Date(a.at).toLocaleString('tr-TR')} · {a.actor} · {a.before?'Düzenlendi':'Oluşturuldu'} · {a.after.name}</p>)}</details>
  </>}
  </div>
 </section>;
}
