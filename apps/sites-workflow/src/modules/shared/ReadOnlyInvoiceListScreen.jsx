import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ReceiptAllocationContext } from '../purchase/ReceiptAllocationContext.jsx';
import { SalesInverseContext } from '../sales/SalesInverseContext.jsx';
import {
  fetchPurchaseDrafts,
  fetchPurchaseInvoice,
  fetchSalesDrafts,
  fetchSalesInvoice,
} from '../../services/invoiceDraftApi.js';

const PAGE_SIZE = 20;

export function createRequestIdentity({ kind, source, documentId = null }) {
  return `${kind}|${source}|${documentId === null || documentId === undefined ? 'none' : String(documentId)}`;
}

export function createActiveRequestGate() {
  let sequence = 0;
  let active = null;
  return {
    begin(identity) {
      active = { sequence: ++sequence, identity };
      return active;
    },
    isActive(token, identity) {
      return active === token && token.identity === identity;
    },
    cancel(token) {
      if (active === token) active = null;
    },
    clear() {
      active = null;
    },
  };
}

function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('tr-TR', withTime
    ? { dateStyle: 'short', timeStyle: 'medium' }
    : { dateStyle: 'short' }).format(date);
}

function formatNumber(value, maximumFractionDigits = 3) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits }).format(number);
}

function formatMoney(value, currency) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  if (!currency) return formatNumber(number, 2);
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(number);
  } catch {
    return `${formatNumber(number, 2)} ${currency}`;
  }
}

function partyLabel(record, kind) {
  const name = kind === 'sales' ? record.customerName : record.supplierName;
  if (name) return name;
  const code = kind === 'sales' ? record.customerCode : record.supplierCode;
  const id = kind === 'sales' ? record.customerId : record.supplierId;
  const identity = code || (id !== null && id !== undefined ? `#${id}` : 'Kimlik yok');
  return `${identity} · Ad okunmadı`;
}

function sourceLabel(meta) {
  const source = meta?.sourceContext;
  if (!source) return 'Kaynak doğrulanmadı';
  const pieces = [source.environment, source.server, source.database].filter(Boolean);
  return pieces.length ? pieces.join(' · ') : 'Kaynak doğrulanmadı';
}

function statusLabel(value) {
  const labels = {
    DRAFT: 'Taslak',
    FINALIZED: 'Onaylı',
    CANCELLED: 'İptal',
    ARCHIVED_TEST: 'Arşiv TEST',
  };
  return labels[value] || value || '—';
}

function recordedUnitLabel(item) {
  if (item.unitState === 'RECORDED') {
    const unit = item.unit || 'Birim kaydı boş';
    return item.unitMultiplier === null || item.unitMultiplier === undefined || Number(item.unitMultiplier) === 1
      ? unit
      : `${unit} · kayıtlı çarpan ${formatNumber(item.unitMultiplier)}`;
  }
  if (item.unitState === 'EMPTY') return 'Birim kaydı boş';
  return 'Birim metadata doğrulanmadı';
}

function lineCurrencyLabel(item, documentCurrency) {
  const lineCurrency = item.currency || 'dövizi yok';
  if (item.currency && documentCurrency && item.currency !== documentCurrency) {
    return `Belge ${documentCurrency} · satır ${item.currency}`;
  }
  return `Satır ${lineCurrency}`;
}

export function ReadOnlyInvoiceListScreen({ kind, initialDocumentId = null, onOpenScreen, returnScreen = null, returnPayload = null }) {
  const isSales = kind === 'sales';
  const title = isSales ? 'Satış belgeleri' : 'Alış belgeleri';
  const partyTitle = isSales ? 'Müşteri' : 'Tedarikçi';
  const listRequest = isSales ? fetchSalesDrafts : fetchPurchaseDrafts;
  const detailRequest = isSales ? fetchSalesInvoice : fetchPurchaseInvoice;
  const listSource = `/api/${isSales ? 'sales' : 'purchase'}-invoices`;
  const [filters, setFilters] = useState({ search: '', dateFrom: '', dateTo: '', status: 'ALL', currency: 'ALL' });
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
  const listGate = useRef(null);
  const detailGate = useRef(null);
  if (!listGate.current) listGate.current = createActiveRequestGate();
  if (!detailGate.current) detailGate.current = createActiveRequestGate();
  const selectedId = selection?.kind === kind && selection?.source === listSource
    ? selection.documentId
    : null;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    const controller = new AbortController();
    const identity = createRequestIdentity({ kind, source: listSource });
    const token = listGate.current.begin(identity);
    const isCurrent = () => !controller.signal.aborted && listGate.current.isActive(token, identity);
    setLoading(true);
    setError('');
    listRequest({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      status: filters.status,
      currency: filters.currency,
    }, { signal: controller.signal })
      .then((response) => {
        if (!isCurrent()) return;
        setRows(Array.isArray(response.data) ? response.data : []);
        setMeta(response.meta || null);
      })
      .catch((requestError) => {
        if (!isCurrent() || requestError.name === 'AbortError') return;
        setError(requestError.message || 'Belge listesi okunamadı.');
      })
      .finally(() => {
        if (isCurrent()) setLoading(false);
      });
    return () => {
      controller.abort();
      listGate.current.cancel(token);
    };
  }, [currencyKey(filters), debouncedSearch, kind, listRequest, listSource, page]);

  useEffect(() => {
    detailGate.current.clear();
    setSelection(initialDocumentId ? { kind, source: listSource, documentId: initialDocumentId } : null);
    setDetail(null);
    setDetailMeta(null);
    setDetailLoading(false);
    setDetailError('');
  }, [initialDocumentId, kind, listSource]);

  useEffect(() => {
    if (!selectedId) {
      detailGate.current.clear();
      setDetail(null);
      setDetailMeta(null);
      setDetailLoading(false);
      setDetailError('');
      return undefined;
    }
    const controller = new AbortController();
    const identity = createRequestIdentity({ kind, source: listSource, documentId: selectedId });
    const token = detailGate.current.begin(identity);
    const isCurrent = () => !controller.signal.aborted && detailGate.current.isActive(token, identity);
    setDetail(null);
    setDetailMeta(null);
    setDetailLoading(true);
    setDetailError('');
    detailRequest(selectedId, { signal: controller.signal })
      .then((response) => {
        if (!isCurrent()) return;
        setDetail(response.data || null);
        setDetailMeta(response.meta || null);
      })
      .catch((requestError) => {
        if (!isCurrent() || requestError.name === 'AbortError') return;
        setDetailError(requestError.message || 'Belge ayrıntısı okunamadı.');
      })
      .finally(() => {
        if (isCurrent()) setDetailLoading(false);
      });
    return () => {
      controller.abort();
      detailGate.current.cancel(token);
    };
  }, [detailRequest, kind, listSource, selectedId]);

  const totalText = useMemo(() => {
    if (!meta || meta.total === null || meta.total === undefined) return 'Toplam kayıt doğrulanmadı';
    return `${formatNumber(meta.total, 0)} kayıt`;
  }, [meta]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  return (
    <main className={`v17-document-screen ${selectedId ? 'detail-open' : ''}`}>
      <section className="v17-document-main">
        <header className="v17-document-heading">
          <div>
            <span className="v17-eyebrow">BELGELER · SALT OKUNUR</span>
            <h1>{title}</h1>{kind === 'purchase' && onOpenScreen && <button type="button" onClick={() => onOpenScreen('purchase-invoice-list', {mode:'supplier-return-read'})}>İade fiyatı incele</button>}
            <p>{totalText}. İlk sayfa bütün belgelerin toplamı olarak kullanılmaz.</p>
          </div>
          <div className="v17-read-meta">
            <strong>{sourceLabel(meta)}</strong>
            <span>Okuma zamanı: {formatDate(meta?.readAt, true)}</span>
            <span>Firma / dönem / iş tarihi: doğrulanmadı</span>
          </div>
        </header>

        <div className="v17-document-filters" role="search">
          <label><span>Belge no</span><input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Belge no ara" /></label>
          <label><span>Başlangıç</span><input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} /></label>
          <label><span>Bitiş</span><input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} /></label>
          <label><span>Durum</span><select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="ALL">Tümü</option><option value="DRAFT">Taslak</option><option value="FINALIZED">Onaylı</option><option value="CANCELLED">İptal</option></select></label>
          <label><span>Döviz</span><select value={filters.currency} onChange={(event) => updateFilter('currency', event.target.value)}><option value="ALL">Tümü</option><option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
        </div>

        <div className="v17-document-table-wrap">
          {loading && <div className="v17-document-state">Belgeler okunuyor…</div>}
          {!loading && error && <div className="v17-document-state error">{error}</div>}
          {!loading && !error && rows.length === 0 && <div className="v17-document-state">Bu filtrelerde kayıt bulunamadı.</div>}
          {!loading && !error && rows.length > 0 && <table className="v17-document-table"><thead><tr><th>Belge</th><th>Tarih</th><th>{partyTitle}</th><th>Durum</th><th>Satır</th><th className="numeric">Kayıtlı toplam</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className={String(selectedId) === String(row.id) ? 'selected' : ''} onClick={() => setSelection({ kind, source: listSource, documentId: row.id })} tabIndex="0" onKeyDown={(event) => { if (event.key === 'Enter') setSelection({ kind, source: listSource, documentId: row.id }); }}><td><strong>{row.invoiceNo || 'Belge no yok'}</strong><small>Kaynak ID #{row.id}</small></td><td>{formatDate(row.documentDate)}</td><td>{partyLabel(row, kind)}</td><td><span className={`v17-status status-${String(row.status || '').toLowerCase()}`}>{statusLabel(row.status)}</span></td><td>{formatNumber(row.itemCount, 0)}</td><td className="numeric"><strong>{formatMoney(row.totalAmount, row.currency)}</strong><small>{row.currency || 'Döviz yok'}</small></td></tr>)}</tbody></table>}
        </div>

        <footer className="v17-document-pagination"><span>Sayfa {meta?.page || page} / {meta?.totalPages || 1}</span><div><button type="button" disabled={loading || !meta?.hasPreviousPage} onClick={() => setPage((current) => Math.max(1, current - 1))}>Önceki</button><button type="button" disabled={loading || !meta?.hasNextPage} onClick={() => setPage((current) => current + 1)}>Sonraki</button></div></footer>
      </section>

      {selectedId && <aside className="v17-document-detail" aria-label={`${title} ayrıntısı`}>
        <button className="v17-detail-close" type="button" onClick={() => setSelection(null)} aria-label="Ayrıntıyı kapat">×</button>
        {returnScreen && <button className="v17-return-button" type="button" onClick={() => onOpenScreen?.(returnScreen, returnPayload || {})}>← Cari ekstreye dön</button>}
        {detailLoading && <div className="v17-document-state">Belge ayrıntısı okunuyor…</div>}
        {!detailLoading && detailError && <div className="v17-document-state error">{detailError}</div>}
        {!detailLoading && !detailError && detail && <>
          <span className="v17-eyebrow">AYNI KAYNAK · ID #{detail.id}</span>
          <h2>{detail.documentNo || 'Belge no yok'}</h2>
          {kind === 'purchase' && <ReceiptAllocationContext key={`purchase:${detail.id}:${detail.invoiceVersion}`} invoice={detail} />}
          {kind === 'sales' && <SalesInverseContext key={`sales:${detail.id}:${detail.invoiceVersion}`} invoice={detail} />}
          <div className="v17-detail-party"><span>{partyTitle}</span><strong>{partyLabel(detail, kind)}</strong></div>
          <dl className="v17-detail-facts"><div><dt>Belge tarihi</dt><dd>{formatDate(detail.documentDate)}</dd></div><div><dt>Durum</dt><dd>{statusLabel(detail.status)}</dd></div><div><dt>Döviz</dt><dd>{detail.documentCurrency || '—'}</dd></div><div><dt>Kayıtlı toplam</dt><dd>{formatMoney(detail.grandTotal, detail.documentCurrency)}</dd></div>{detail.discountAmount != null && <div><dt>Genel iskonto</dt><dd>{formatMoney(detail.discountAmount, detail.documentCurrency)}</dd></div>}</dl>
          <div className="v17-detail-source"><strong>{sourceLabel(detailMeta)}</strong><span>Okuma zamanı: {formatDate(detailMeta?.readAt, true)}</span></div>
          <h3>Kayıtlı ürün satırları</h3>
          <div className="v17-detail-lines">{Array.isArray(detail.items) && detail.items.length > 0 ? detail.items.map((item) => <article key={item.id}><div><strong>{item.productName || 'Ürün adı yok'}</strong><span>{item.stockCode || item.barcode || `Ürün #${item.productId ?? '—'}`}</span></div><div className="v17-line-values"><span>{formatNumber(item.quantity)} {recordedUnitLabel(item)}</span><span>{formatMoney(item.unitPrice, item.currency)}<small>{lineCurrencyLabel(item, detail.documentCurrency)}</small></span><strong>{formatMoney(item.lineTotal, item.currency)}<small>{lineCurrencyLabel(item, detail.documentCurrency)}</small></strong></div></article>) : <div className="v17-document-state">Kayıtlı ürün satırı yok.</div>}</div>
        </>}
      </aside>}
    </main>
  );
}

function currencyKey(filters) {
  return `${filters.dateFrom}|${filters.dateTo}|${filters.status}|${filters.currency}`;
}
