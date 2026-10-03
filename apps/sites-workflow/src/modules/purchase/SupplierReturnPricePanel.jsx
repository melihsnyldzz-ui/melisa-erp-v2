import React,{useEffect,useState} from 'react';
import {fetchSupplierReturnPrice} from '../../services/supplierReturnApi.js';
const id=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
// Controlled by the selected product and recorded unit/currency, never card defaults.
export function SupplierReturnPricePanel({source,productId,unit,currency,context}){
 const [state,setState]=useState({key:null,busy:false,data:null,error:''});
 const key=JSON.stringify([source,productId,unit,currency,context?.environment,context?.server,context?.database]);
 useEffect(()=>{
  const controller=new AbortController();let active=true;
  setState({key,busy:false,data:null,error:''});
  if(!productId||!unit||!currency)return()=>{active=false;controller.abort();};
  setState({key,busy:true,data:null,error:''});
  Promise.resolve().then(()=>{
   if(!active)return null;
   return fetchSupplierReturnPrice({source,productId,unit,currency},{signal:controller.signal});
  }).then(r=>{
   if(!active)return;
   const d=r?.data,c=r?.meta?.sourceContext;
   if(r?.success!==true||r.meta.readOnly!==true||d?.readOnly!==true||d.source!==source||d.productId!==productId||d.unit!==unit||d.currency!==currency
    ||context?.environment!=='TEST'||!context.server||!context.database||c?.environment!==context.environment||c.server!==context.server||c.database!==context.database
    ||d.purpose!=='COMMERCIAL_RETURN_PRICE_ONLY'||d.inventoryCostIncluded!==false
    ||d.selectionBasis!=='invoiceDraftService.recalculateProductAverageCostTry:document_date,id,item_id'
    ||typeof d.unitPrice!=='string'||!/^\d{1,14}\.\d{8}$/.test(d.unitPrice)
    ||![d.priceInvoiceId,d.priceItemId,d.priceSupplierId].every(id)||!/^0x[0-9a-f]{16}$/.test(d.priceInvoiceVersion||'')
    ||!/^\d{4}-\d{2}-\d{2}$/.test(d.priceDocumentDate||'')||!Number.isFinite(Date.parse(d.priceDocumentDate))
    ||typeof d.readAtUtc!=='string'||!Number.isFinite(Date.parse(d.readAtUtc)))throw Error('İade fiyatının kayıtlı kaynağı doğrulanamadı.');
   setState({key,busy:false,data:d,error:''});
  }).catch(e=>{if(active)setState({key,busy:false,data:null,error:e.message||'Kayıtlı iade fiyatı okunamadı.'});});
  return()=>{active=false;controller.abort();};
 },[key]);
 const current=state.key===key?state:null,d=current?.data;
 return <section className="erp-panel" aria-label="Kayıtlı iade fiyatı">
  <h3>Kayıtlı son alış fiyatı</h3>
  {!productId||!unit||!currency?<p>Ürün, kayıtlı birim ve döviz seçilmedi.</p>:current?.busy?<p>Fiyat okunuyor…</p>:null}
  {current?.error&&<p role="alert">{current.error} Tutar doğrulanmadı.</p>}
  {d&&<dl><dt>Birim fiyat</dt><dd>{d.unitPrice.replace('.',',')} {d.currency} / {d.unit}</dd>
   <dt>Kaynak alış belgesi / satır</dt><dd>#{d.priceInvoiceId} / #{d.priceItemId}</dd>
   <dt>Kaynak tedarikçi</dt><dd>#{d.priceSupplierId}</dd><dt>Belge tarihi</dt><dd>{d.priceDocumentDate}</dd>
   <dt>Okuma zamanı</dt><dd>{d.readAtUtc}</dd><dt>Kaynak</dt><dd>{context.environment} · {context.server} · {context.database}</dd></dl>}
  <p>Yalnız kayıtlı ticari fiyat. Stok maliyeti veya iade onayı değildir; kayıt işlemi kapalıdır.</p>
 </section>;
}

