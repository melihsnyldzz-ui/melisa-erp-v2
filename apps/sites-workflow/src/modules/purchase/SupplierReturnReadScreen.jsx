import React,{useState} from 'react';
import {ReceiptProductPicker} from './ReceiptProductPicker.jsx';
import {SupplierReturnPricePanel} from './SupplierReturnPricePanel.jsx';
const source='PROMPT-2-20260923-01';
const context={environment:'TEST',server:'Semih\\MELISADEV',database:'MELISA_ERP_FULL_TEST_20260916'};
// Read preparation only. Product search grants neither task ownership nor return permission.
export function SupplierReturnReadScreen({onOpenScreen}){
 const [productId,setProductId]=useState(''),[unit,setUnit]=useState(''),[currency,setCurrency]=useState(''),[selection,setSelection]=useState(null);
 function selectProduct(id){setSelection(null);setProductId(id);setUnit('');setCurrency('');}
 function changeUnit(value){setSelection(null);setUnit(value);}
 function changeCurrency(value){setSelection(null);setCurrency(value);}
 return <div className="v17-document-screen"><section className="erp-panel">
  <h1>Tedarikçi iadesi · kayıtlı fiyat incelemesi</h1>
  <button type="button" onClick={()=>onOpenScreen?.('purchase-invoice-list',{})}>Alış belgelerine dön</button>
  <p>İade oluşturma, muhasebe onayı ve stok/cari işlemleri henüz bağlı değil. Bu görünüm yalnız kayıtlı alış fiyatını inceler.</p>
  <ReceiptProductPicker context={context} onSelect={selectProduct}/>
  <form onSubmit={e=>{e.preventDefault();if(productId&&unit.trim()&&currency)setSelection({productId,unit,currency});}}>
   <label>Kaynak alış satırında doğrulanacak birim<input value={unit} maxLength={50} onChange={e=>changeUnit(e.target.value)}/></label>
   <label>Döviz<select value={currency} onChange={e=>changeCurrency(e.target.value)}><option value="">Seçin</option>{['TRY','USD','EUR'].map(c=><option key={c} value={c}>{c}</option>)}</select></label>
   <button type="submit" disabled={!productId||!unit.trim()||!currency}>Kayıtlı fiyatı oku</button>
  </form>
  <p>Birim veya döviz tahmin edilmez. Seçim kayıtlı son alışla eşleşmezse fiyat gösterilmez; görev sahipliği sunucuda ayrıca doğrulanır.</p>
 </section>{selection&&<SupplierReturnPricePanel key={JSON.stringify(selection)} source={source} {...selection} context={context}/>}</div>;
}

