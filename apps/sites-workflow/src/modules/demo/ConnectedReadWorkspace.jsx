import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { accountBalance, availableStock, balance, currencies, dispatchOperations, financePosition, getOperations, kinds, productPrice, reservedQuantity, settlementBalance, subscribeOperations, today } from '../../demo/operationsStore.js';
import { MasterCards } from './MasterCards.jsx';
import './operations.css';
import { WorkspaceHeading, CurrencyMark } from './WorkspaceChrome.jsx';

export const connectedReadScreens = new Set([
  'product-card', 'customer-card', 'supplier-card', 'stock-movements', 'customer-movements',
  'customer-statement', 'supplier-movements', 'supplier-statement', 'price-list',
  'stock-valuation', 'finance-overview', 'accounting-journal', 'cash-customers',
]);
const labels = {
  'stock-movements': 'Stok hareketleri', 'customer-movements': 'Müşteri hareketleri',
  'customer-statement': 'Müşteri ekstresi', 'supplier-movements': 'Tedarikçi hareketleri',
  'supplier-statement': 'Tedarikçi ekstresi', 'price-list': 'Fiyat listesi',
  'stock-valuation': 'Stok değerleme', 'finance-overview': 'Finans özeti',
  'accounting-journal': 'Muhasebe hareketleri', 'cash-customers': 'Müşteri bakiyeleri',
};
const money = (n,c) => new Intl.NumberFormat('tr-TR',{style:'currency',currency:c}).format(n/100);
function CurrencyRates({state,permissions}){
 const [date,setDate]=useState(today()),[currency,setCurrency]=useState('USD'),[value,setValue]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
 const save=async()=>{try{if(!permissions.includes('settings.manage'))throw Error('Kur kaydı yetkiniz yok.');await dispatchOperations({type:'save-rate',date,currency,value});setError('');setMessage(`${date} ${currency} kuru kaydedildi.`);}catch(e){setError(e.message);setMessage('');}};
 return <section className="erp-panel op-form"><h2>Tarihli kurlar</h2><p>1 dövizin TRY karşılığı. Kur yalnız aynı tarihli yeni belgeye kaydedilir; eski belgeler değiştirilmez. Kur eksikse TRY karşılığı hesaplanmaz.</p>
  <div className="op-fields"><label>Tarih<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Para birimi<select value={currency} onChange={e=>setCurrency(e.target.value)}><option>USD</option><option>EUR</option></select></label><label>TRY kuru<input type="number" min="0.0001" step="0.0001" value={value} onChange={e=>setValue(e.target.value)}/></label></div>
  <button type="button" disabled={!permissions.includes('settings.manage')} onClick={save}>Kuru kaydet</button>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  <div className="table-shell"><table className="erp-table"><thead><tr><th>Tarih</th><th>Döviz</th><th>TRY kuru</th></tr></thead><tbody>{[...(state.exchangeRates||[])].sort((a,b)=>b.date.localeCompare(a.date)).map(rate=><tr key={`${rate.date}-${rate.currency}`}><td>{rate.date}</td><td>{rate.currency}</td><td>{rate.value}</td></tr>)}</tbody></table></div>
 </section>;
}
export function ConnectedReadWorkspace({ screenId, payload={}, permissions=[], onDirtyChange, onOpenScreen }) {
  const state = useSyncExternalStore(subscribeOperations,getOperations,getOperations);
  const [search,setSearch] = useState('');
  const cardEntity = screenId === 'product-card' ? 'products' : screenId === 'customer-card' ? 'customers' : screenId === 'supplier-card' ? 'suppliers' : null;
  const initialId = payload.productId || payload.customerId || payload.supplierId;
  const partyName = id => [...state.customers,...state.suppliers].find(row=>row.id===id)?.name || '—';
  const productName = id => state.products.find(row=>row.id===id)?.name || '—';
  const partyKind=screenId.startsWith('supplier')?'supplier':screenId.startsWith('customer')||screenId==='cash-customers'?'customer':null;
  const parties=partyKind==='supplier'?state.suppliers:state.customers;
  const running=useMemo(()=>{const totals=new Map();return state.movements.map(m=>{const key=`${m.partyId}-${m.currency}`,next=(totals.get(key)||0)+m.partyDelta;totals.set(key,next);return next;});},[state]);
  const rows=useMemo(()=>state.movements.map((m,index)=>({...m,index,document:state.documents.find(d=>d.id===m.documentId)})).filter(m=>{
    if(screenId==='stock-movements')return Boolean(m.productId)&&(!payload.productId||m.productId===payload.productId);
    if(partyKind)return parties.some(p=>p.id===m.partyId)&&m.partyDelta!==0&&(!(payload.customerId||payload.supplierId)||m.partyId===(payload.customerId||payload.supplierId));
    return screenId==='accounting-journal'&&(m.partyDelta!==0||m.cashDelta!==0||m.accountDelta!==0);
  }).filter(m=>`${m.document?.number||''} ${partyName(m.partyId)} ${productName(m.productId)}`.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr'))).reverse(),[state,screenId,search,payload.productId,payload.customerId,payload.supplierId]);
  if(cardEntity)return <main className="work-area connected-operations"><WorkspaceHeading screen={screenId} title={cardEntity==='products'?'Ürün kartı':cardEntity==='customers'?'Müşteri kartı':'Tedarikçi kartı'} description="Kart bilgileri ve hareket geçmişi"/>
    <MasterCards key={`${cardEntity}-${initialId||''}`} entity={cardEntity} initialId={String(initialId||'')} state={state} permissions={permissions} onDirtyChange={onDirtyChange} onOpenScreen={onOpenScreen}/></main>;
  return <main className="work-area connected-operations"><WorkspaceHeading screen={screenId} title={labels[screenId]} description="Kartlar, belgeler ve hareket ayrıntıları"/>

    {['stock-movements','customer-movements','customer-statement','supplier-movements','supplier-statement','accounting-journal'].includes(screenId) && <section className="erp-panel"><div className="op-section-title"><h2>Belge hareketleri</h2><label>Belge, cari veya ürün ara<input placeholder="Aramaya başlayın" value={search} onChange={event=>setSearch(event.target.value)} /></label></div>
      <div className="table-shell"><table className="erp-table"><thead><tr><th>Tarih</th><th>Belge</th><th>İşlem</th><th>Cari</th><th>Ürün</th><th>Paket farkı</th><th>Cari farkı</th><th>Hareket sonrası bakiye</th><th>Kasa farkı</th><th>Hesap farkı</th></tr></thead><tbody>{rows.map(m=><tr key={m.index}><td>{m.date}</td><td>{m.document?.number||'—'}</td><td>{m.kind==='cancel'?'İptal':kinds[m.kind]}</td><td>{partyName(m.partyId)}</td><td>{m.productId?productName(m.productId):'—'}</td><td>{m.stockDelta||'—'}</td><td>{m.partyDelta?money(m.partyDelta,m.currency):'—'}</td><td>{m.partyId?money(running[m.index],m.currency):'—'}</td><td>{m.cashDelta?money(m.cashDelta,m.currency):'—'}</td><td>{m.accountDelta?money(m.accountDelta,m.currency):'—'}</td></tr>)}</tbody></table></div>{!rows.length&&<p>Bu kapsamda henüz hareket yok.</p>}</section>}
    {['price-list','stock-valuation'].includes(screenId)&&<section className="erp-panel"><div className="op-section-title"><h2>Ürünler</h2><label>Ürün ara<input placeholder="Kod, ürün veya marka" value={search} onChange={e=>setSearch(e.target.value)}/></label></div><p>{screenId==='stock-valuation'?'Kartta kayıtlı tahmini TRY maliyetiyle hesaplanan stok tutarıdır; muhasebesel maliyet veya kâr değildir.':'TRY, USD ve EUR fiyatları bağımsız etiketlerdir; otomatik kur dönüşümü yapılmaz.'}</p><div className="table-shell"><table className="erp-table"><thead><tr><th>Kod</th><th>Ürün</th><th>Stok paketi</th><th>Parça / paket</th><th>Ayrılmış</th><th>Kullanılabilir</th><th>Tahmini maliyet (TRY)</th>{screenId==='price-list'&&currencies.map(c=><th key={c}>Satış ({c})</th>)}{screenId==='stock-valuation'&&<th>Tahmini tutar</th>}</tr></thead><tbody>{state.products.filter(p=>`${p.code} ${p.name} ${p.brand||''}`.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr'))).map(p=><tr key={p.id}><td>{p.code}{p.active===false?' · pasif':''}</td><td><button type="button" onClick={()=>onOpenScreen?.('product-card',{productId:p.id})}>{p.name}</button></td><td>{p.stock}</td><td>{p.unitFactor||1}</td><td>{reservedQuantity(state,p.id)}</td><td>{availableStock(state,p.id)}</td><td>{money(p.cost,'TRY')}</td>{screenId==='price-list'&&currencies.map(c=><td key={c}>{productPrice(p,c)==null?'—':money(productPrice(p,c),c)}</td>)}{screenId==='stock-valuation'&&<td>{money(p.cost*p.stock,'TRY')}</td>}</tr>)}</tbody></table></div></section>}
    {screenId==='price-list'&&<CurrencyRates state={state} permissions={permissions}/>}
    {['customer-statement','supplier-statement','customer-movements','supplier-movements','finance-overview','cash-customers'].includes(screenId)&&<section className="erp-panel"><h2>Açık belgeler ve cari ayrımı</h2><p>Pozitif bakiye müşteriden alacak veya tedarikçiye borçtur. Siparişe ayrılan avans başka faturaya mahsup edilmez. Dövizler ayrı tutulur.</p><div className="table-shell"><table className="erp-table"><thead><tr><th>Cari</th><th>Döviz</th><th>Açık belge</th><th>Vade</th><th>Başlangıç</th><th>Kalan</th><th>Cari bakiye</th><th>Ayrılmış avans</th><th>Serbest bakiye</th></tr></thead><tbody>{(partyKind==='supplier'?state.suppliers:partyKind==='customer'?state.customers:[...state.customers,...state.suppliers]).filter(p=>!(payload.customerId||payload.supplierId)||p.id===(payload.customerId||payload.supplierId)).flatMap(p=>currencies.flatMap(c=>{const pos=financePosition(state,p.id,c);if(!pos.invoices.length&&!pos.reserved&&!pos.free)return [];return (pos.invoices.length?pos.invoices:[null]).map(invoice=><tr key={`${p.id}-${c}-${invoice?.id||'credit'}`}><td>{p.name}</td><td>{c}</td><td>{invoice?.number||'Devir / açık avans'}</td><td>{invoice?.dueDate||'—'}{invoice?.open>0&&invoice?.dueDate<today()?' · Gecikti':''}</td><td>{invoice?money(invoice.amount,c):'—'}</td><td>{invoice?money(invoice.open,c):'—'}</td><td>{money(balance(state,p.id,c),c)}</td><td>{money(pos.reserved,c)}</td><td>{money(pos.free,c)}</td></tr>);}))}</tbody></table></div></section>}
    {['finance-overview','cash-customers'].includes(screenId)&&<section className="erp-panel"><h2>{screenId==='cash-customers'?'Müşteri bakiyeleri':'Kasa ve hesap bakiyeleri'}</h2><div className="table-shell"><table className="erp-table"><thead><tr><th>Hesap</th>{currencies.map(c=><th key={c}><CurrencyMark code={c}/></th>)}</tr></thead><tbody>{screenId==='finance-overview'&&['CASH','BANK','CARD','OTHER'].map(channel=><tr key={channel}><td>{{CASH:'Kasa',BANK:'Banka',CARD:'Kart',OTHER:'Diğer hesap'}[channel]}</td>{currencies.map(c=><td key={c}>{money(accountBalance(state,channel,c),c)}</td>)}</tr>)}{[...state.customers,...(screenId==='finance-overview'?state.suppliers:[])].map(p=><tr key={p.id}><td>{p.name}</td>{currencies.map(c=><td key={c}>{money(state.customers.some(cust=>cust.id===p.id)?settlementBalance(state,p.id,c):balance(state,p.id,c),c)}</td>)}</tr>)}</tbody></table></div></section>}
  </main>;
}
