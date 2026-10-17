import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Columns3,
  ImageOff,
  Info,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { fetchProducts } from '../../services/productApi.js';
import { fetchProductDetail } from '../../services/productDetailApi.js';
import './read-only-stock-workbench.css';

const PAGE_SIZE = 50;
const numberFormatter = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 });
const moneyFormatter = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const COLUMN_DEFINITIONS = [
  { key: 'product', label: 'Ürün / Kod', required: true },
  { key: 'barcode', label: 'Barkod' },
  { key: 'category', label: 'Kategori' },
  { key: 'brand', label: 'Marka' },
  { key: 'available', label: 'Kullanılabilir', numeric: true },
  { key: 'reserved', label: 'Rezerve', numeric: true },
  { key: 'stock', label: 'Net Stok', numeric: true },
  { key: 'unit', label: 'Birim' },
  { key: 'price', label: 'Satış Fiyatı', numeric: true },
  { key: 'status', label: 'Durum' },
];

const DEFAULT_COLUMNS = COLUMN_DEFINITIONS.reduce((next, column) => ({
  ...next,
  [column.key]: !['reserved'].includes(column.key),
}), {});

function displayValue(value, fallback = 'Bilinmiyor') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '—';
  return numberFormatter.format(Number(value));
}

function formatMoney(value, currency) {
  if (value === null || value === undefined || value === '') return '—';
  return `${moneyFormatter.format(Number(value))} ${displayValue(currency, '')}`.trim();
}

function formatReadTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Doğrulanmadı';
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function stockTone(stock) {
  if (stock < 0) return 'negative';
  if (stock === 0) return 'critical';
  return 'active';
}

function stockLabel(stock, active) {
  if (stock < 0) return 'NEGATİF';
  if (stock === 0) return 'KRİTİK';
  if (active === false) return 'PASİF';
  return 'AKTİF';
}

function getImageUrl(row, detail) {
  return detail?.imageUrl || row?.imageUrl || '';
}

export function ReadOnlyStockWorkbench() {
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState({ search: '', page: 1, activeOnly: true });
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState({ loading: true, rows: [], meta: null, error: null });
  const [selectedRow, setSelectedRow] = useState(null);
  const [detail, setDetail] = useState({ loading: false, data: null, meta: null, error: null });
  const [category, setCategory] = useState('all');
  const [brand, setBrand] = useState('all');
  const [stockState, setStockState] = useState('all');
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [density, setDensity] = useState('compact');
  const [detailTab, setDetailTab] = useState('summary');
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);

  useEffect(() => {
    const controller = new AbortController();
    setList((current) => ({ ...current, loading: true, error: null }));

    fetchProducts({ ...query, limit: PAGE_SIZE }, { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        setList({ loading: false, rows: response.data || [], meta: response.meta || null, error: null });
        setSelectedRow((current) => {
          const matching = (response.data || []).find((row) => String(row.id) === String(current?.id));
          return matching || response.data?.[0] || null;
        });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setList({ loading: false, rows: [], meta: null, error });
          setSelectedRow(null);
        }
      });

    return () => controller.abort();
  }, [query, revision]);

  useEffect(() => {
    if (!selectedRow?.id) {
      setDetail({ loading: false, data: null, meta: null, error: null });
      return undefined;
    }

    const controller = new AbortController();
    setDetail({ data: null, meta: null, loading: true, error: null });
    fetchProductDetail(selectedRow.id, { signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) {
          if (String(response.data?.id) !== String(selectedRow.id)) throw new Error('Seçilen ürün ile ayrıntı kimliği eşleşmedi.');
          setDetail({ loading: false, data: response.data || null, meta: response.meta || null, error: null });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setDetail({ loading: false, data: null, meta: null, error });
        }
      });

    return () => controller.abort();
  }, [selectedRow?.id, revision]);

  const categories = useMemo(() => [...new Set(list.rows.map((row) => row.category).filter(Boolean))].sort(), [list.rows]);
  const brands = useMemo(() => [...new Set(list.rows.map((row) => row.brand).filter(Boolean))].sort(), [list.rows]);
  const filteredRows = useMemo(() => list.rows.filter((row) => {
    const stock = Number(row.stockQuantity || 0);
    if (category !== 'all' && row.category !== category) return false;
    if (brand !== 'all' && row.brand !== brand) return false;
    if (stockState === 'negative' && stock >= 0) return false;
    if (stockState === 'zero' && stock !== 0) return false;
    if (stockState === 'positive' && stock <= 0) return false;
    if (issuesOnly && stock > 0) return false;
    return true;
  }), [brand, category, issuesOnly, list.rows, stockState]);

  useEffect(() => {
    setSelectedRow(current => filteredRows.find(row => String(row.id) === String(current?.id)) || filteredRows[0] || null);
  }, [filteredRows]);

  const negativeCount = filteredRows.filter((row) => Number(row.stockQuantity || 0) < 0).length;
  const criticalCount = filteredRows.filter((row) => Number(row.stockQuantity || 0) === 0).length;
  const total = list.meta?.total ?? null;
  const totalPages = total ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;
  const sourceContext = detail.meta?.sourceContext || list.meta?.sourceContext || {};
  const selectedStock = Number(selectedRow?.stockQuantity ?? detail.data?.stockQuantity ?? 0);
  const selectedImage = getImageUrl(selectedRow, detail.data);

  function submitSearch(event) {
    event.preventDefault();
    setQuery((current) => ({ ...current, search: searchInput.trim(), page: 1 }));
  }

  function changePage(page) {
    setQuery((current) => ({ ...current, page: Math.min(totalPages, Math.max(1, page)) }));
  }

  return (
    <main className={`stock-workbench density-${density}`}>
      <div className="stock-workbench-environment" role="status">
        <span><AlertTriangle size={15} /> TEST ORTAMI · SALT OKUNUR · Son doğrulama {formatReadTime(list.meta?.readAt)}</span>
        <small>Bu ortamda yalnızca görüntüleme yapılabilir.</small>
      </div>

      <header className="stock-workbench-heading">
        <div className="stock-workbench-title">
          <span className="stock-workbench-title-icon"><Boxes size={21} /></span>
          <div><h1>Ürün &amp; Stok</h1><span>Stok Masası</span></div>
        </div>
        <p>Ürün kartları, stok durumları ve satış fiyatları <strong>(salt okunur)</strong></p>
      </header>

      <section className="stock-command-row" aria-label="Stok filtreleri">
        <form className="stock-search" onSubmit={submitSearch}>
          <Search size={17} aria-hidden="true" />
          <input aria-label="Ürün ara" value={searchInput} maxLength={120} onChange={(event) => setSearchInput(event.target.value)} placeholder="Ürün adı, kod veya barkod ile ara..." />
        </form>
        <label><span>Kategori</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Tümü</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Marka</span><select value={brand} onChange={(event) => setBrand(event.target.value)}><option value="all">Tümü</option>{brands.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Stok Durumu</span><select value={stockState} onChange={(event) => setStockState(event.target.value)}><option value="all">Tümü</option><option value="negative">Negatif</option><option value="zero">Sıfır</option><option value="positive">Pozitif</option></select></label>
        <label className="stock-issues-toggle"><input type="checkbox" checked={issuesOnly} onChange={(event) => setIssuesOnly(event.target.checked)} /><span aria-hidden="true" /><b>Sadece sorunlular</b></label>
        <button className="stock-icon-action" type="button" disabled={list.loading} onClick={() => setRevision((value) => value + 1)}><RefreshCw size={16} /> Yenile</button>
        <details className="stock-columns-menu">
          <summary><Columns3 size={16} /> Sütunlar <ChevronDown size={14} /></summary>
          <div>{COLUMN_DEFINITIONS.map((column) => <label key={column.key}><input type="checkbox" disabled={column.required} checked={visibleColumns[column.key] !== false} onChange={(event) => setVisibleColumns((current) => ({ ...current, [column.key]: event.target.checked }))} />{column.label}</label>)}</div>
        </details>
      </section>

      <section className="stock-summary-row" aria-label="Liste özeti">
        <strong>{total === null ? 'Toplam doğrulanmadı' : `${formatNumber(total)} kayıt`}</strong>
        <span className="negative"><b>{negativeCount}</b> negatif <small>bu sayfa</small></span>
        <span className="critical"><b>{criticalCount}</b> kritik <small>bu sayfa</small></span>
        <span><b>{filteredRows.length}</b> görüntülenen</span>
        <div className="stock-density" aria-label="Satır yoğunluğu"><span>Görünüm:</span>{[['compact', 'Kompakt'], ['balanced', 'Dengeli'], ['relaxed', 'Rahat']].map(([value, label]) => <button key={value} type="button" aria-pressed={density === value} className={density === value ? 'active' : ''} onClick={() => setDensity(value)}>{label}</button>)}</div>
      </section>

      {list.error && <div className="stock-workbench-error" role="alert">TEST verisi okunamadı. Yenile ile tekrar deneyin.</div>}

      <section className="stock-grid-shell" aria-busy={list.loading}>
        <div className="stock-grid-scroll">
          <table className="stock-grid">
            <thead><tr>{COLUMN_DEFINITIONS.filter((column) => visibleColumns[column.key] !== false).map((column) => <th key={column.key} className={column.numeric ? 'numeric' : ''}>{column.label}</th>)}</tr></thead>
            <tbody>
              {list.loading && <tr><td colSpan="10" className="stock-empty">Ürünler yükleniyor…</td></tr>}
              {!list.loading && !list.error && filteredRows.length === 0 && <tr><td colSpan="10" className="stock-empty">Bu ölçütlere uyan ürün bulunamadı.</td></tr>}
              {!list.loading && filteredRows.map((row) => {
                const stock = Number(row.stockQuantity || 0);
                const tone = stockTone(stock);
                const cells = {
                  product: <td key="product"><button type="button" className="stock-product-cell" onClick={() => { setSelectedRow(row); setDetailTab('summary'); }}><strong>{displayValue(row.productName)}</strong><small>{displayValue(row.stockCode)}</small></button></td>,
                  barcode: <td key="barcode" className="mono">{displayValue(row.barcode, '—')}</td>,
                  category: <td key="category">{displayValue(row.category, '—')}</td>,
                  brand: <td key="brand">{displayValue(row.brand, '—')}</td>,
                  available: <td key="available" className={`numeric stock-number ${tone}`}>{formatNumber(stock)}</td>,
                  reserved: <td key="reserved" className="numeric muted">—</td>,
                  stock: <td key="stock" className={`numeric stock-number ${tone}`}>{formatNumber(stock)}</td>,
                  unit: <td key="unit">{displayValue(row.unit, '—')}</td>,
                  price: <td key="price" className="numeric">{formatMoney(row.salePrice, row.currency)}</td>,
                  status: <td key="status"><span className={`stock-status ${tone}`}>{stockLabel(stock, row.isActive)}</span></td>,
                };
                return <tr key={row.id} className={`${tone === 'negative' ? 'negative-row' : ''} ${String(selectedRow?.id) === String(row.id) ? 'selected' : ''}`} onClick={() => { setSelectedRow(row); setDetailTab('summary'); }}>{COLUMN_DEFINITIONS.filter((column) => visibleColumns[column.key] !== false).map((column) => cells[column.key])}</tr>;
              })}
            </tbody>
          </table>
        </div>
        <footer className="stock-grid-footer">
          <span>{filteredRows.length ? `${(query.page - 1) * PAGE_SIZE + 1}–${(query.page - 1) * PAGE_SIZE + filteredRows.length}` : '0'} arası gösteriliyor</span>
          <div className="stock-pagination"><span>{PAGE_SIZE} kayıt / sayfa</span><button type="button" aria-label="İlk sayfa" disabled={list.loading || query.page <= 1} onClick={() => changePage(1)}><ChevronFirst size={16} /></button><button type="button" aria-label="Önceki sayfa" disabled={list.loading || query.page <= 1} onClick={() => changePage(query.page - 1)}><ChevronLeft size={16} /></button><b>{query.page}</b><span>/ {totalPages}</span><button type="button" aria-label="Sonraki sayfa" disabled={list.loading || query.page >= totalPages} onClick={() => changePage(query.page + 1)}><ChevronRight size={16} /></button><button type="button" aria-label="Son sayfa" disabled={list.loading || query.page >= totalPages} onClick={() => changePage(totalPages)}><ChevronLast size={16} /></button></div>
        </footer>
      </section>

      {selectedRow && filteredRows.some(row => String(row.id) === String(selectedRow.id)) && <section className="stock-detail-drawer" aria-label="Seçili ürün ayrıntısı">
        <nav>{[['summary', 'Özet'], ['movements', 'Son Hareketler'], ['distribution', 'Depo Dağılımı']].map(([value, label]) => <button key={value} type="button" aria-pressed={detailTab === value} className={detailTab === value ? 'active' : ''} onClick={() => setDetailTab(value)}>{label}</button>)}</nav>
        {detail.loading && <p role="status">Ürün ayrıntısı okunuyor…</p>}
        {detail.error && <p role="alert">Ürün ayrıntısı okunamadı: {detail.error.message}</p>}
        {detailTab === 'summary' && <div className="stock-detail-content">
          <div className="stock-detail-product">
            <div className="stock-product-image">{selectedImage ? <img src={selectedImage} alt="" /> : <ImageOff size={24} aria-hidden="true" />}</div>
            <div><strong>{displayValue(selectedRow.productName)}</strong><span>{displayValue(selectedRow.stockCode)}</span><dl><dt>Barkod</dt><dd>{displayValue(selectedRow.barcode)}</dd><dt>Kategori</dt><dd>{displayValue(detail.data?.category || selectedRow.category)}</dd><dt>Marka</dt><dd>{displayValue(detail.data?.brand || selectedRow.brand)}</dd></dl></div>
          </div>
          <div className={`stock-detail-alert ${stockTone(selectedStock)}`}><AlertTriangle size={20} /><div><strong>Stok durumu: {stockLabel(selectedStock, selectedRow.isActive)}</strong><span>Net stok {formatNumber(selectedStock)} {displayValue(selectedRow.unit, '')}. {selectedStock < 0 ? 'Stok takibi gereklidir.' : 'Kayıt salt okunur.'}</span></div></div>
          <div className="stock-detail-metrics"><div><span>Kullanılabilir</span><strong>{formatNumber(selectedStock)}</strong></div><div><span>Rezerve</span><strong>—</strong></div><div><span>Net Stok</span><strong className={selectedStock < 0 ? 'negative' : ''}>{formatNumber(selectedStock)}</strong></div><div><span>Birim</span><strong>{displayValue(selectedRow.unit, '—')}</strong></div><div><span>Satış Fiyatı</span><strong>{formatMoney(selectedRow.salePrice, selectedRow.currency)}</strong></div></div>
          <div className="stock-readonly-note"><Info size={20} /><div><strong>Salt okunur — değişiklik yapılamaz.</strong><span>Bu ekranda kayıt üzerinde herhangi bir değişiklik yapılmaz.</span></div></div>
        </div>}
        {detailTab === 'movements' && <div className="stock-detail-placeholder"><ShieldCheck size={20} /><div><strong>Hareket ayrıntısı bu görünümde açık değil.</strong><span>Ürün kaynağı: {displayValue(sourceContext.database)} · Okuma zamanı: {formatReadTime(detail.meta?.readAt || list.meta?.readAt)}</span></div></div>}
        {detailTab === 'distribution' && <div className="stock-detail-placeholder"><Boxes size={20} /><div><strong>Tek merkez stok görünümü</strong><span>Depo/raf dağılımı kullanılmıyor; kayıtlı toplam stok gösteriliyor.</span></div></div>}
      </section>}
    </main>
  );
}

