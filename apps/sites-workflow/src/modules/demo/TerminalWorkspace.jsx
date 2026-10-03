import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { dispatchOperations, getOperations, priceInput, subscribeOperations, today } from '../../demo/operationsStore.js';
import { scanPackage, appendScannedPackage } from '../../demo/operationsScan.js';
import { returnableLines } from '../../demo/operationsCorrections.js';
import { queueTerminalTicket, flushTerminalTicket, discardTerminalTicket, readTerminalQueue } from '../../demo/terminalQueue.js';
import './operations.css';
import './terminal.css';
import { ScanBarcode, ClipboardList, ReceiptText, CheckCheck } from 'lucide-react';
import { WorkspaceHeading } from './WorkspaceChrome.jsx';

const kinds = { sale: 'Satışı tamamla', order: 'Sipariş hazırlığı', receipt: 'Mal kabul sayımı', count: 'Stok sayımı', 'sales-return': 'Müşteri iadesi', 'purchase-return': 'Tedarikçi iadesi' };
const plusDays = n => { const date = new Date(`${today()}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + n); return date.toISOString().slice(0, 10); };

export function TerminalWorkspace({ roleViewId = 'yonetici', onOpenScreen, onDirtyChange }) {
  const state = useSyncExternalStore(subscribeOperations, getOperations, getOperations);
  const [kind, setKind] = useState(roleViewId === 'depo' ? 'receipt' : 'sale');
  const [partyId, setPartyId] = useState('');
  const [partySearch, setPartySearch] = useState('');
  const scanInput = useRef(null), quantityInputs = useRef(new Map());
  const [focusTarget, setFocusTarget] = useState(null);
  const [sourceId, setSourceId] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [dueDate, setDueDate] = useState(plusDays(30));
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [boxCount, setBoxCount] = useState('1');
  const [scan, setScan] = useState('');
  const [pending, setPending] = useState(null);
  const [items, setItems] = useState([]);
  const [offline, setOffline] = useState(false);
  const [queue, setQueue] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isSupplier = ['receipt', 'purchase-return'].includes(kind);
  const parties = isSupplier ? state.suppliers : state.customers;
  const query = partySearch.trim().toLocaleLowerCase('tr');
  const shownParties = parties.filter(p => p.active !== false && (!query || p.id === partyId || `${p.name} ${p.code || ''}`.toLocaleLowerCase('tr').includes(query))).sort((a,b) => Number(b.name.toLocaleLowerCase('tr') === query) - Number(a.name.toLocaleLowerCase('tr') === query) || a.name.localeCompare(b.name,'tr'));
  useEffect(() => { onDirtyChange?.(items.length > 0 || Boolean(pending)); }, [items, pending, onDirtyChange]);
  useEffect(() => { const input = quantityInputs.current.get(focusTarget?.id); if (input && !input.readOnly) { input.focus(); input.select(); } }, [focusTarget]);
  const sources = state.documents.filter(doc => doc.status === 'APPROVED' && doc.kind === (kind === 'purchase-return' ? 'purchase' : 'sale'));
  const selectedSource = sources.find(doc => doc.id === Number(sourceId));
  const review = state.documents.filter(doc => doc.status === 'DRAFT' && [doc.intake?.stage, doc.countSession?.stage, doc.returnFlow?.stage].includes('REVIEW'));
  useEffect(() => { if (roleViewId === 'depo' && ['sale', 'order', 'sales-return'].includes(kind)) changeKind('receipt'); if (roleViewId === 'satis' && !['sale', 'order', 'sales-return'].includes(kind)) changeKind('sale'); }, [roleViewId]);

  function loadQueue() { setQueue(readTerminalQueue(window.localStorage)); }
  useEffect(() => { try { loadQueue(); } catch (err) { setError(err.message); } }, []);
  useEffect(() => {
    const listener = event => { if (event.key === 'melisa.terminal-demo.queue.v1') try { loadQueue(); } catch (err) { setError(err.message); } };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }, []);

  function changeKind(next) { if (items.length && !window.confirm('İşlem değişince kaydedilmemiş fiş satırları temizlenecek. Devam edilsin mi?')) return; setKind(next); setPartyId(''); setPartySearch(''); setSourceId(''); setItems([]); setPending(null); setNote(''); setReason(''); setError(''); }
  function scanProduct() {
    try {
      setError('');
      if (kind !== 'count' && !partyId) throw Error('Önce müşteri veya tedarikçi seçin.');
      const result = scanPackage(state, pending, scan.trim());
      if (kind === 'receipt' && result.product.supplierId !== partyId) throw Error('Barkod seçilen tedarikçinin ürününe ait değil.');
      if (['sales-return', 'purchase-return'].includes(kind) && !selectedSource?.items.some(line => line.productId === result.product.id)) throw Error('Ürün kaynak belgede yok.');
      setPending(result.pending); setScan('');
      if (result.complete) {
        setItems(current => appendScannedPackage(current, result, { unitPrice: priceInput(result.product, currency) }));
        setMessage(`${result.product.name}: miktarı yazın, Enter ile sonraki barkoda geçin.`);
        setFocusTarget({id:result.product.id,at:Date.now()});
      } else setMessage('Seri eksik: ' + Object.entries(result.pending.counts).map(([size, count]) => `${size} ${count}`).join(', '));
    } catch (err) { setError(err.message); }
  }
  function addProduct(productId) {
    const product = state.products.find(row => row.id === productId);
    if (!product) return;
    if (kind !== 'count' && !partyId) { setError('Önce müşteri veya tedarikçi seçin.'); return; }
    if (kind === 'receipt' && product.supplierId !== partyId) { setError('Ürün seçilen tedarikçiye ait değil.'); return; }
    if (items.some(row => row.productId === productId)) { setError('Ürün zaten eklendi.'); return; }
    setItems(current => [...current, { productId, quantity: kind === 'count' ? String(product.stock) : '1', unitPrice: priceInput(product, currency), discount: '0' }]);
    setFocusTarget({id:productId,at:Date.now()});
  }
  function sourceChanged(id) {
    setSourceId(id); const source = sources.find(doc => doc.id === Number(id));
    setPartyId(source?.partyId || ''); setCurrency(source?.currency || 'TRY');
    setItems(source ? returnableLines(state, source, kind).filter(row => row.remaining > 0).map(row => ({ productId: row.productId, quantity: String(row.remaining), unitPrice: '0', discount: '0' })) : []);
  }
  function makeInput() {
    if (!items.length || pending) throw Error(pending ? 'Serinin kalan bedenlerini tamamlayın.' : 'En az bir ürün ekleyin.');
    if (kind === 'order') return { date: today(), validUntil: plusDays(3), customerId: partyId, currency, taxRate: '0', salesPolicyVersion: 2, paymentTerms: 'PREPAID', minimumExceptionReason: reason, priceExceptionReason: reason, note, items };
    if (kind === 'sale') return { kind, fulfillmentPolicyVersion: 1, date: today(), partyId, currency, taxRate: '0', salesPolicyVersion: 2, dueDate, minimumExceptionReason: reason, priceExceptionReason: reason, reason: note, items };
    const base = { kind, date: today(), currency, partyId, reason: reason || (kind === 'receipt' ? note : ''), items };
    if (kind === 'receipt') {
      const samples = Object.fromEntries(items.map(row => [row.productId, String(row.sample || row.barcode || row.unitScans?.[0] || '').trim()]));
      if (Object.values(samples).some(value => !value)) throw Error('Her ürün için örnek barkod okutun veya yazın.');
      return { ...base, intake: { boxCount, countedBy: 'Terminal personeli', note, samples, expected: {}, unknownItems: [] } };
    }
    if (kind === 'count') return { ...base, terminalStockSnapshot: Object.fromEntries(items.map(row => [row.productId, state.products.find(p => p.id === row.productId)?.stock])), countSession: { countedBy: 'Terminal personeli', note, investigation: Object.fromEntries(items.filter(row => Number(row.quantity) !== state.products.find(p => p.id === row.productId)?.stock).map(row => [row.productId, reason])) } };
    return { ...base, referenceId: Number(sourceId), returnFlow: { countedBy: 'Terminal personeli', note, boxCount, reasonCode: reason === 'CONSIGNMENT' ? 'CONSIGNMENT' : 'WRONG' } };
  }
  async function send(ticket) {
    if (offline || !navigator.onLine) { setMessage('Fiş cihaz kuyruğunda. Bağlantı gelince aynı fişi gönderin.'); return; }
    const result = await flushTerminalTicket(window.localStorage, ticket.requestId, dispatchOperations, getOperations);
    loadQueue(); const saleDoc = getOperations().documents.find(d => d.terminalRequestId === ticket.requestId);
    setMessage(ticket.command.kind === 'sale' && saleDoc?.status === 'DRAFT' ? `${saleDoc.number}: fiyat / minimum istisnası yönetici onayında. Henüz stok veya borç işlenmedi.` : ticket.command.kind === 'sale' ? `Satış tamamlandı (${result.requestId.slice(-8)}). Stok ve müşteri bakiyesi güncellendi.` : `Fiş gönderildi (${result.requestId.slice(-8)}). Kayıt kuyruğunu kontrol edin.`);
  }
  async function submit() {
    if (busy) return; setBusy(true); setError('');
    try {
      const input = makeInput();
      const requestId = globalThis.crypto?.randomUUID?.() || `terminal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      const ticket = queueTerminalTicket(window.localStorage, kind, input, roleViewId, requestId);
      loadQueue();
      await send(ticket);
      setItems([]); setPending(null); setScan('');
    } catch (err) { setError(err.message); try { loadQueue(); } catch {} }
    finally { setBusy(false); }
  }
  async function retry(ticket) {
    if (busy) return; setBusy(true); setError('');
    try { await send(ticket); } catch (err) { setError(err.message); loadQueue(); }
    finally { setBusy(false); }
  }
  return <main className="work-area terminal-workspace">
    <WorkspaceHeading screen="terminal-overview" title="El terminali" description="Barkod okutun, ürünleri sayın ve fişi tamamlayın" count={navigator.onLine && !offline ? 'Bağlı demo' : 'Çevrimdışı kuyruk'}/>

    {error && <p className="terminal-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <div className="terminal-columns"><section className="erp-panel terminal-form"><div className="op-section-title"><h2 className="ui-section-icon"><ReceiptText size={18} aria-hidden="true"/>Yeni fiş</h2><span className="ui-record-count">{items.length} ürün</span></div><div className="ui-terminal-context">
      <label>İşlem<select value={kind} onChange={e => changeKind(e.target.value)}>{Object.entries(kinds).filter(([id]) => roleViewId === 'satis' ? ['sale', 'order', 'sales-return'].includes(id) : roleViewId === 'depo' ? ['receipt', 'count', 'purchase-return'].includes(id) : true).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      {['sales-return', 'purchase-return'].includes(kind) && <label>Kaynak belge<select value={sourceId} onChange={e => sourceChanged(e.target.value)}><option value="">Seçin</option>{sources.map(row => <option key={row.id} value={row.id}>{row.number}</option>)}</select></label>}
      {kind !== 'count' && !selectedSource && <label>{isSupplier ? 'Tedarikçi ara' : 'Müşteri ara'}<input value={partySearch} placeholder="İsim veya cari kodu" onChange={e => setPartySearch(e.target.value)} /></label>}
      {kind !== 'count' && <label>{isSupplier ? 'Tedarikçi' : 'Müşteri'}<select disabled={Boolean(selectedSource)} value={partyId} onChange={e => { if(items.length&&!window.confirm('Müşteri değişince fiş satırları temizlenecek. Devam edilsin mi?'))return; setPartyId(e.target.value);setItems([]);setPending(null);setScan(''); }}><option value="">Seçin</option>{shownParties.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}
      {['sale', 'order'].includes(kind) && <label>Döviz<select value={currency} onChange={e => { if(items.length&&!window.confirm('Döviz değişince fiş satırları temizlenecek. Devam edilsin mi?'))return; setCurrency(e.target.value); setItems([]);setPending(null);setScan(''); }}><option>TRY</option><option>EUR</option><option>USD</option></select></label>}
      {kind === 'sale' && <label>Önerilen vade<input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>}
      </div><div className="terminal-scan"><ScanBarcode size={22} aria-hidden="true"/><label>Barkod / beden<input ref={scanInput} value={scan} onChange={e => setScan(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); scanProduct(); } }} placeholder="Okutun, Enter" /></label><button type="button" onClick={scanProduct}>Ekle</button></div>
      {pending && <p>Seri tamamlanıyor: {Object.entries(pending.counts).map(([size, count]) => `${size} ${count}`).join(' · ')} <button type="button" onClick={() => setPending(null)}>Temizle</button></p>}
      <label>Elle ürün seç<select defaultValue="" key={kind} onChange={e => { addProduct(e.target.value); e.target.value = ''; }}><option value="">Ürün ekle</option>{state.products.filter(product => product.active !== false && (kind !== 'receipt' || product.supplierId === partyId)).map(product => <option key={product.id} value={product.id}>{product.code} · {product.name}</option>)}</select></label>
      {items.map(row => <div className="terminal-line" key={row.productId}><div className="terminal-product-summary"><strong>{state.products.find(p => p.id === row.productId)?.name}</strong>{['sale','order'].includes(kind)&&<b className="terminal-price">{row.unitPrice ? new Intl.NumberFormat('tr-TR',{style:'currency',currency}).format(Number(row.unitPrice)) : 'Fiyat tanımlı değil'}</b>}<small>Stok: {state.products.find(p => p.id === row.productId)?.stock} {(state.products.find(p => p.id === row.productId)?.unitFactor||1)>1?'paket':'adet'}{(state.products.find(p => p.id === row.productId)?.unitFactor||1)>1?` · 1 paket = ${state.products.find(p => p.id === row.productId).unitFactor} adet`:''}</small></div><label>{kind === 'count' ? 'Sayılan' : (state.products.find(p => p.id === row.productId)?.unitFactor||1)>1 ? 'Paket miktarı' : 'Adet'}<input ref={node=>{if(node)quantityInputs.current.set(row.productId,node);else quantityInputs.current.delete(row.productId);}} inputMode="numeric" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();scanInput.current?.focus();}}} type="number" min={kind === 'count' ? '0' : '1'} value={row.quantity} readOnly={Boolean(row.unitScans)} onChange={e => setItems(items.map(item => item === row ? { ...item, quantity: e.target.value } : item))} /></label>{['sale', 'order'].includes(kind) && <label>Birim fiyat<input type="number" min="0.01" step="0.01" value={row.unitPrice} onChange={e => setItems(items.map(item => item === row ? { ...item, unitPrice: e.target.value } : item))} /></label>}{kind === 'receipt' && <label className="terminal-sample">Örnek barkod<input value={row.sample || row.barcode || row.unitScans?.[0] || ''} onChange={e => setItems(items.map(item => item === row ? { ...item, sample: e.target.value } : item))} /></label>}<button type="button" onClick={() => setItems(items.filter(item => item !== row))}>Çıkar</button></div>)}
      {kind === 'receipt' && <label>Koli adedi<input type="number" min="1" value={boxCount} onChange={e => setBoxCount(e.target.value)} /></label>}
      {['sales-return', 'purchase-return'].includes(kind) && <label>İade kolisi<input type="number" min="1" value={boxCount} onChange={e => setBoxCount(e.target.value)} /></label>}
      <label>Not<input value={note} onChange={e => setNote(e.target.value)} placeholder="Sayım veya müşteri notu" /></label>
      {kind !== 'receipt' && <label>{kind === 'count' ? 'Sayım farkı nedeni' : ['sale', 'order'].includes(kind) ? 'Fiyat / minimum istisnası' : 'İade gerekçesi'}<input value={reason} onChange={e => setReason(e.target.value)} /></label>}
      <button type="button" className="primary-action" disabled={busy || !items.length || Boolean(pending)} onClick={submit}>{kind === 'sale' ? 'Satışı tamamla' : 'Fişi sıraya al ve gönder'}</button>
    </section><aside className="erp-panel terminal-queue"><h2 className="ui-section-icon"><ClipboardList size={18} aria-hidden="true"/>Cihaz kuyruğu <span className="ui-record-count">{queue.length}</span></h2><label><input type="checkbox" checked={offline} onChange={e => setOffline(e.target.checked)} /> Çevrimdışı deneme</label><p>Kapanıştan sonra bekleyen fişler burada kalır. Çakışan fişi inceleyip yeni fiş hazırlayın.</p>
      {queue.slice().reverse().map(ticket => <div className="terminal-ticket" key={ticket.requestId}><strong>{kinds[ticket.command.kind]} · {ticket.requestId.slice(-8)}</strong><span>{ticket.status === 'sent' ? 'Gönderildi' : ticket.status === 'conflict' ? 'Çakışma' : 'Bekliyor'}</span>{ticket.error && <p>{ticket.error}</p>}{ticket.status !== 'sent' && <div><button type="button" disabled={busy} onClick={() => retry(ticket)}>Aynı fişi yeniden gönder</button><button type="button" disabled={busy} onClick={() => { try { discardTerminalTicket(window.localStorage, ticket.requestId); loadQueue(); } catch (err) { setError(err.message); } }}>Fişi kaldır</button></div>}</div>)}
      {!queue.length && <p>Bekleyen fiş yok.</p>}
      <h2 className="ui-section-icon"><CheckCheck size={18} aria-hidden="true"/>Muhasebe kontrolünde</h2>{review.slice().reverse().map(doc => <p key={doc.id}><button type="button" onClick={() => onOpenScreen?.(doc.kind === 'receipt' ? 'inventory-receipt-list' : doc.kind === 'count' ? 'stock-count' : doc.kind === 'purchase-return' ? 'purchase-invoice-list' : 'sales-invoice-list', { selectedDocumentId: doc.id })}>{doc.number} · {kinds[doc.kind]}</button></p>)}
      {!review.length && <p>İnceleme bekleyen belge yok.</p>}
    </aside></div>
  </main>;
}
