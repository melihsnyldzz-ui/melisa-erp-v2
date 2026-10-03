import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createActiveRequestGate, createRequestIdentity } from './ReadOnlyInvoiceListScreen.jsx';
import {
  fetchReadOnlyParties,
  fetchReadOnlyParty,
  fetchReadOnlyPartyMovements,
} from '../../services/partyReadApi.js';

const PAGE_SIZE = 20;

function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('tr-TR', withTime
    ? { dateStyle: 'short', timeStyle: 'medium' }
    : { dateStyle: 'short' }).format(date);
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || value === '') return 'Veri yok';
  const match = String(value).trim().match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
  if (!match) return 'Veri yok';
  const scale = 10n ** BigInt(digits);
  const fraction = (match[3] || '').padEnd(digits + 1, '0');
  let scaled = BigInt(match[2]) * scale + BigInt(fraction.slice(0, digits) || '0');
  if (Number(fraction[digits] || '0') >= 5) scaled += 1n;
  const whole = (scaled / scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimal = digits ? `,${(scaled % scale).toString().padStart(digits, '0')}` : '';
  return `${match[1] === '-' ? '-' : ''}${whole}${decimal}`;
}

function formatMoney(value, currency) {
  if (value === null || value === undefined || value === '') return 'Veri yok';
  const formatted = formatNumber(value);
  if (formatted === 'Veri yok') return formatted;
  if (!currency) return `${formatted} · Döviz okunmadı`;
  const symbol = { TRY: '₺', USD: '$', EUR: '€' }[currency];
  return symbol ? `${formatted.startsWith('-') ? '-' : ''}${symbol}${formatted.replace(/^-/, '')}` : `${formatted} ${currency}`;
}

function sourceLabel(meta) {
  const source = meta?.sourceContext;
  if (!source) return 'Kaynak doğrulanmadı';
  const pieces = [source.environment, source.server, source.database].filter(Boolean);
  return pieces.length ? pieces.join(' · ') : 'Kaynak doğrulanmadı';
}

function movementLabel(value) {
  return ({
    sales_invoice: 'Satış belgesi', sales_invoice_cancel: 'Satış iptali', collection: 'Tahsilat',
    purchase_invoice: 'Alış belgesi', purchase_invoice_cancel: 'Alış iptali', payment: 'Ödeme',
    opening: 'Açılış', opening_transfer: 'Taşınmış açılış', carry_forward: 'Devir',
  })[value] || value || 'Tür okunmadı';
}

function permissionMessage(error, area) {
  if (error?.code === 'READ_OBJECT_PERMISSION_MISSING') {
    return `${area} mevcut TEST SQL hesabının SELECT kapsamı dışında. Yeni izin verilmedi.`;
  }
  return error?.message || `${area} okunamadı.`;
}

export function ReadOnlyPartyListScreen({ kind, onOpenScreen, initialPartyId = null, permissions=[] }) {
  const isCustomer = kind === 'customer';
  const title = isCustomer ? 'Müşteriler' : 'Tedarikçiler';
  const listSource = `/api/read-only-parties/${kind}`;
  const [filters, setFilters] = useState({ search: '', currency: 'ALL', status: 'ACTIVE' });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailMeta, setDetailMeta] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [movementFilters, setMovementFilters] = useState({ dateFrom: '', dateTo: '', currency: 'ALL' });
  const [movementPage, setMovementPage] = useState(1);
  const [movements, setMovements] = useState([]);
  const [movementMeta, setMovementMeta] = useState(null);
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementError, setMovementError] = useState('');
  const listGate = useRef(null);
  const detailGate = useRef(null);
  const movementGate = useRef(null);
  if (!listGate.current) listGate.current = createActiveRequestGate();
  if (!detailGate.current) detailGate.current = createActiveRequestGate();
  if (!movementGate.current) movementGate.current = createActiveRequestGate();
  const selectedId = selection?.kind === kind && selection?.source === listSource ? selection.partyId : null;
  const paymentSupplierId=typeof detail?.id==='string'?detail.id:Number.isSafeInteger(detail?.id)?String(detail.id):null;
  const paymentReadable=!isCustomer&&permissions.includes('finance.payment')&&!detailLoading&&!detailError
    &&detail?.kind==='supplier'&&paymentSupplierId===String(selectedId)&&/^[1-9]\d{0,18}$/.test(paymentSupplierId||'')
    &&BigInt(paymentSupplierId)<=9223372036854775807n;
  function openPaymentContext(){
    if(!paymentReadable)return;
    // This is a request to the existing task-owned account reader, not proof
    // that an ordinary supplier is task-owned or that payment is authorized.
    onOpenScreen?.('collections-overview',{mode:'payment',supplierId:paymentSupplierId,source:'PROMPT-2-20260923-01'});
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    const controller = new AbortController();
    const identity = createRequestIdentity({ kind, source: listSource });
    const token = listGate.current.begin(identity);
    const isCurrent = () => !controller.signal.aborted && listGate.current.isActive(token, identity);
    setLoading(true); setError('');
    fetchReadOnlyParties(kind, { page, limit: PAGE_SIZE, search: debouncedSearch || undefined, currency: filters.currency, status: filters.status }, { signal: controller.signal })
      .then((response) => { if (!isCurrent()) return; setRows(Array.isArray(response.data) ? response.data : []); setMeta(response.meta || null); })
      .catch((requestError) => { if (!isCurrent() || requestError.name === 'AbortError') return; setRows([]); setMeta(requestError.meta || null); setError(permissionMessage(requestError, `${title} listesi`)); })
      .finally(() => { if (isCurrent()) setLoading(false); });
    return () => { controller.abort(); listGate.current.cancel(token); };
  }, [debouncedSearch, filters.currency, filters.status, kind, listSource, page, title]);

  useEffect(() => {
    detailGate.current.clear(); movementGate.current.clear();
    setMovementPage(1);
    setSelection(initialPartyId ? { kind, source: listSource, partyId: initialPartyId } : null);
    setDetail(null); setDetailMeta(null); setDetailError(''); setMovements([]); setMovementMeta(null); setMovementError('');
  }, [initialPartyId, kind, listSource]);

  useEffect(() => {
    if (!selectedId) { detailGate.current.clear(); setDetail(null); setDetailMeta(null); setDetailLoading(false); setDetailError(''); return undefined; }
    const controller = new AbortController();
    const identity = createRequestIdentity({ kind, source: listSource, documentId: selectedId });
    const token = detailGate.current.begin(identity);
    const isCurrent = () => !controller.signal.aborted && detailGate.current.isActive(token, identity);
    setDetail(null); setDetailMeta(null); setDetailLoading(true); setDetailError('');
    fetchReadOnlyParty(kind, selectedId, { signal: controller.signal })
      .then((response) => { if (!isCurrent()) return; setDetail(response.data || null); setDetailMeta(response.meta || null); })
      .catch((requestError) => { if (!isCurrent() || requestError.name === 'AbortError') return; setDetailError(permissionMessage(requestError, 'Cari ayrıntısı')); })
      .finally(() => { if (isCurrent()) setDetailLoading(false); });
    return () => { controller.abort(); detailGate.current.cancel(token); };
  }, [kind, listSource, selectedId]);

  useEffect(() => {
    if (!selectedId) { movementGate.current.clear(); setMovements([]); setMovementMeta(null); setMovementLoading(false); setMovementError(''); return undefined; }
    const controller = new AbortController();
    const identity = createRequestIdentity({ kind, source: `${listSource}/${selectedId}/movements`, documentId: selectedId });
    const token = movementGate.current.begin(identity);
    const isCurrent = () => !controller.signal.aborted && movementGate.current.isActive(token, identity);
    setMovements([]); setMovementMeta(null); setMovementLoading(true); setMovementError('');
    fetchReadOnlyPartyMovements(kind, selectedId, { page: movementPage, limit: PAGE_SIZE, ...movementFilters }, { signal: controller.signal })
      .then((response) => { if (!isCurrent()) return; setMovements(Array.isArray(response.data) ? response.data : []); setMovementMeta(response.meta || null); })
      .catch((requestError) => { if (!isCurrent() || requestError.name === 'AbortError') return; setMovementError(permissionMessage(requestError, 'Cari hareketleri')); setMovementMeta(requestError.meta || null); })
      .finally(() => { if (isCurrent()) setMovementLoading(false); });
    return () => { controller.abort(); movementGate.current.cancel(token); };
  }, [kind, listSource, movementFilters.currency, movementFilters.dateFrom, movementFilters.dateTo, movementPage, selectedId]);

  const totalText = useMemo(() => meta?.total === null || meta?.total === undefined ? 'Toplam kayıt doğrulanmadı' : `${meta.total} kayıt`, [meta]);

  function updateFilter(key, value) { setFilters((current) => ({ ...current, [key]: value })); setPage(1); }
  function updateMovementFilter(key, value) { setMovementFilters((current) => ({ ...current, [key]: value })); setMovementPage(1); }
  function selectParty(partyId) {
    if (String(selectedId) !== String(partyId)) setMovementPage(1);
    setSelection({ kind, source: listSource, partyId });
  }
  function closeDetail() { detailGate.current.clear(); movementGate.current.clear(); setMovementPage(1); setSelection(null); setDetail(null); setMovements([]); setMovementMeta(null); setDetailError(''); setMovementError(''); }
  function openDocument(movement) {
    const link = movement.documentLink;
    if (!link) return;
    const screen = link.kind === 'sales' ? 'sales-invoice-list' : 'purchase-invoice-list';
    onOpenScreen?.(screen, {
      [link.kind === 'sales' ? 'salesDraftId' : 'purchaseDraftId']: link.documentId,
      invoiceNo: movement.documentNo || `#${link.documentId}`,
      returnScreen: isCustomer ? 'customer-list' : 'supplier-list',
      returnPayload: isCustomer ? { customerId: selectedId } : { supplierId: selectedId },
    });
  }

  return <main className={`v17-party-screen ${selectedId ? 'detail-open' : ''}`}>
    <section className="v17-party-main">
      <header className="v17-document-heading"><div><span className="v17-eyebrow">CARİLER · SALT OKUNUR</span><h1>{title}</h1><p>{totalText}. Kayıtlı bakiye ile tarih aralığındaki hareket etkisi ayrı gösterilir.</p></div><div className="v17-read-meta"><strong>{sourceLabel(meta)}</strong><span>Okuma zamanı: {formatDate(meta?.readAt, true)}</span><span>Firma / dönem / iş tarihi: doğrulanmadı</span></div></header>
      <div className="v17-party-filters" role="search"><label><span>Kod veya ad</span><input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Cari ara" /></label><label><span>Döviz</span><select value={filters.currency} onChange={(event) => updateFilter('currency', event.target.value)}><option value="ALL">Tümü</option><option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label><label><span>Durum</span><select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="ACTIVE">Aktif</option><option value="PASSIVE">Pasif</option><option value="ALL">Tümü</option></select></label></div>
      <div className="v17-party-table-wrap">{loading && <div className="v17-document-state">Cari kartlar okunuyor…</div>}{!loading && error && <div className="v17-document-state error" data-state="permission-or-access-error">{error}</div>}{!loading && !error && rows.length === 0 && <div className="v17-document-state">{meta?.pageState === 'PAGE_OUT_OF_RANGE' ? `İstenen sayfa aralık dışında. Filtrelenmiş toplam: ${meta.total} kayıt.` : 'Bu filtrelerde gerçek kayıt yok.'}</div>}{!loading && !error && rows.length > 0 && <table className="v17-party-table"><thead><tr><th>Kod</th><th>Ad</th><th>Döviz</th><th className="numeric">Kayıtlı bakiye</th><th>Durum</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className={String(selectedId) === String(row.id) ? 'selected' : ''} onClick={() => selectParty(row.id)} tabIndex="0" onKeyDown={(event) => { if (event.key === 'Enter') selectParty(row.id); }}><td><strong>{row.code || 'Kod okunmadı'}</strong><small>Kaynak ID #{row.id}</small></td><td>{row.name || 'Ad okunmadı'}</td><td>{row.currency || 'Döviz okunmadı'}</td><td className="numeric">{formatMoney(row.currentBalances?.[0]?.amount, row.currentBalances?.[0]?.currency)}</td><td><span className={`v17-status ${row.isPassive ? '' : 'active'}`}>{row.isPassive ? 'Pasif' : 'Aktif'}</span></td></tr>)}</tbody></table>}</div>
      <footer className="v17-document-pagination"><span>Sayfa {meta?.page || page} / {meta?.totalPages || 1}</span><div><button type="button" disabled={loading || !meta?.hasPreviousPage} onClick={() => setPage((current) => Math.max(1, current - 1))}>Önceki</button><button type="button" disabled={loading || !meta?.hasNextPage} onClick={() => setPage((current) => current + 1)}>Sonraki</button></div></footer>
    </section>
    {selectedId && <aside className="v17-party-detail"><button type="button" className="v17-detail-close" aria-label="Paneli kapat" onClick={closeDetail}>×</button>{detailLoading && <div className="v17-document-state">Cari ayrıntısı okunuyor…</div>}{!detailLoading && detailError && <div className="v17-document-state error">{detailError}</div>}{!detailLoading && !detailError && detail && <><span className="v17-eyebrow">{isCustomer ? 'MÜŞTERİ' : 'TEDARİKÇİ'} AYRINTISI</span><h2>{detail.name || 'Ad okunmadı'}</h2>{paymentReadable&&<div className="v17-panel-note"><button type="button" className="v17-link-button" onClick={openPaymentContext}>Seçili tedarikçinin TEST ödeme hesaplarını incele</button><span> Görev sahipliği ayrıca sunucuda doğrulanır; bu bağlantı ödeme kaydetmez.</span></div>}<div className="v17-detail-party"><span>Kayıtlı kimlik</span><strong>{detail.code || 'Kod okunmadı'} · #{detail.id}</strong></div><h3>Kayıtlı bakiye</h3><div className="v17-balance-grid">{(detail.currentBalances || []).length ? detail.currentBalances.map((balance) => <article key={balance.currency || 'unknown'}><span>{balance.currency || 'Döviz okunmadı'}</span><strong>{formatMoney(balance.amount, balance.currency)}</strong><small>{balance.state === 'RECORDED' ? 'Kartta kayıtlı değer' : 'Eksik veri'}</small></article>) : <div className="v17-inline-state">Bakiye dövizi doğrulanmadı.</div>}</div><p className="v17-panel-note">Farklı dövizler toplanmaz. Görüntüleme yuvarlaması kaynak değeri değiştirmez. Muhasebe mutabakatı doğrulanmadı. Vade doğrulanmadığı için gecikme veya risk puanı üretilmez.</p><h3>Hareket / ekstre</h3><div className="v17-ledger-filters"><label><span>Başlangıç</span><input type="date" value={movementFilters.dateFrom} onChange={(event) => updateMovementFilter('dateFrom', event.target.value)} /></label><label><span>Bitiş</span><input type="date" value={movementFilters.dateTo} onChange={(event) => updateMovementFilter('dateTo', event.target.value)} /></label><label><span>Döviz</span><select value={movementFilters.currency} onChange={(event) => updateMovementFilter('currency', event.target.value)}><option value="ALL">Tümü</option><option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label></div>{movementLoading && <div className="v17-inline-state">Hareketler okunuyor…</div>}{!movementLoading && movementError && <div className="v17-inline-state error" data-state="permission-denied">{movementError}</div>}{!movementLoading && !movementError && <><div className="v17-balance-grid compact">{(movementMeta?.currentBalances || []).map((balance) => <article key={`current-${balance.currency}`}><span>Tüm hareket etkisi · {balance.currency || 'Döviz yok'}</span><strong>{balance.amountState === 'INCOMPLETE' ? 'Eksik etki — toplam yok' : formatMoney(balance.amount, balance.currency)}</strong><small>{balance.movementCount} hareket · mutabakat doğrulanmadı</small></article>)}{(movementMeta?.periodTotals || []).map((total) => <article key={`period-${total.currency}`}><span>Dönem etkisi · {total.currency || 'Döviz yok'}</span><strong>{total.effectState === 'INCOMPLETE' ? 'Eksik etki — toplam yok' : formatMoney(total.effect, total.currency)}</strong><small>{total.movementCount} hareket · {total.reversalCount} iptal etkisi</small></article>)}</div><div className="v17-history-note">Geçmiş başlangıç bakiyesi: {movementMeta?.historicOpeningBalance?.state === 'UNVERIFIED' ? 'doğrulanmadı' : formatMoney(movementMeta?.historicOpeningBalance?.amount)}</div>{movements.length === 0 ? <div className="v17-inline-state">{movementMeta?.pageState === 'PAGE_OUT_OF_RANGE' ? `İstenen hareket sayfası aralık dışında. Filtrelenmiş toplam: ${movementMeta.total} hareket.` : 'Bu aralıkta gerçek hareket yok.'}</div> : <div className="v17-ledger-scroll"><table className="v17-ledger-table"><thead><tr><th>Tarih / belge</th><th>İşlem</th><th className="numeric">Kayıtlı etki</th><th>Bağlantı</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{formatDate(movement.documentDate)}<small>{movement.documentNo || 'Belge no yok'}</small></td><td>{movementLabel(movement.movementType)}<small>{movement.directionLabel}</small></td><td className="numeric">{formatMoney(movement.balanceEffect, movement.currency)}</td><td>{movement.documentLink ? <button type="button" className="v17-link-button" onClick={() => openDocument(movement)}>Belgeyi aç</button> : <span className="v17-muted">Bağlantı yok</span>}</td></tr>)}</tbody></table></div>}<footer className="v17-ledger-pagination"><span>Hareket sayfası {movementMeta?.page || movementPage} / {movementMeta?.totalPages || 1}</span><div><button type="button" disabled={!movementMeta?.hasPreviousPage} onClick={() => setMovementPage((current) => Math.max(1, current - 1))}>Önceki</button><button type="button" disabled={!movementMeta?.hasNextPage} onClick={() => setMovementPage((current) => current + 1)}>Sonraki</button></div></footer></>}</>}</aside>}
  </main>;
}
