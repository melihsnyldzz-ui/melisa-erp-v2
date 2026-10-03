import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchProducts } from '../../services/productApi.js';
import { fetchCustomers } from '../../services/customerApi.js';
import { fetchSuppliers } from '../../services/supplierApi.js';
import { fetchSalesDrafts, fetchPurchaseDrafts } from '../../services/invoiceDraftApi.js';
import { fetchSalesOffers, fetchSalesOrders } from '../../services/salesPipelineApi.js';
import { fetchStockMovements, fetchStockValuation } from '../../services/movementApi.js';
import { fetchTerminalAdminOverview } from '../../services/terminalAdminApi.js';
import { exportRowsToCsv, exportRowsToExcel, printRowsReport } from '../../utils/exportUtils.js';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

export async function fetchAllPages(fetchPage, params, { pageSize = 500, maxRows = 20000, isCurrent = () => true } = {}) {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || !Number.isSafeInteger(maxRows) || maxRows < 1) throw Error('Çıktı sınırı geçersiz.');
  const rows = [], seen = new Set();
  let page = 1, firstMeta = null, lastMeta = null;
  function assertCurrent() { if (!isCurrent()) { const error = Error('Rapor okuması geçersizleşti.'); error.name = 'AbortError'; throw error; } }
  while (rows.length < maxRows) {
    assertCurrent();
    const response = await fetchPage({ ...params, page, limit: pageSize });
    assertCurrent();
    const meta = response?.meta;
    if (response?.success !== true || !Array.isArray(response.data) || !meta
      || meta.page !== page || !Number.isSafeInteger(meta.limit) || meta.limit < 1
      || !Number.isSafeInteger(meta.total) || meta.total < 0) throw Error('Rapor sayfası ve toplamı doğrulanamadı.');
    if (firstMeta && (meta.total !== firstMeta.total || meta.limit !== firstMeta.limit || meta.source !== firstMeta.source)) {
      throw Error('Rapor okunurken kaynak veya kayıt kapsamı değişti; yeniden okuyun.');
    }
    firstMeta ||= { ...meta };
    const expected = Math.min(meta.limit, Math.max(0, meta.total - (page - 1) * meta.limit));
    if (response.data.length !== expected) throw Error('Rapor sayfası eksik; tam çıktı hazırlanmadı.');
    for (const row of response.data) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw Error('Rapor satırı doğrulanamadı.');
      if (row.id !== undefined && row.id !== null) {
        const key = String(row.id);
        if (seen.has(key)) throw Error('Rapor sayfalarında yinelenen kayıt var; yeniden okuyun.');
        seen.add(key);
      }
    }
    rows.push(...response.data); lastMeta = meta;
    if (rows.length >= meta.total) break;
    page += 1;
  }
  return { data: rows.slice(0, maxRows), meta: { ...lastMeta, loaded: Math.min(rows.length, maxRows),
    truncated: rows.length > maxRows || lastMeta.total > rows.length, snapshotVerified: false } };
}
const exportDefinitions = {
  products: {
    title: 'Stok Listesi',
    filename: 'stok-listesi',
    fetcher: ({ search }, options) => fetchAllPages(fetchProducts, { search, activeOnly: false }, options),
    columns: [
      { label: 'Stok Kodu', key: 'stockCode' },
      { label: 'Barkod', value: (row) => row.matchedBarcode || row.barcodeMasked || '' },
      { label: 'Ürün', key: 'productName' },
      { label: 'Marka', key: 'brand' },
      { label: 'Kategori', key: 'category' },
      { label: 'Para Birimi', key: 'currency' },
      { label: 'Satış Fiyatı', key: 'salePrice' },
      { label: 'Alış Fiyatı', key: 'purchasePrice' },
      { label: 'Stok', key: 'stockQuantity' },
    ],
  },
  customers: {
    title: 'Müşteri Cari Listesi',
    filename: 'musteri-cari-listesi',
    fetcher: ({ search }, options) => fetchAllPages(fetchCustomers, { search, activeOnly: false }, options),
    columns: [
      { label: 'Cari Kod', key: 'customerCode' },
      { label: 'Ad / Unvan', value: (row) => row.customerName || row.name || '' },
      { label: 'Telefon', value: (row) => row.phone || row.phoneMasked || '' },
      { label: 'Şehir', key: 'city' },
      { label: 'Ülke', key: 'country' },
      { label: 'Para Birimi', key: 'currency' },
      { label: 'Bakiye', key: 'balance' },
      { label: 'Durum', value: (row) => row.isPassive ? 'Pasif' : 'Aktif' },
    ],
  },
  suppliers: {
    title: 'Tedarikçi Cari Listesi',
    filename: 'tedarik?i-cari-listesi',
    fetcher: ({ search }, options) => fetchAllPages(fetchSuppliers, { search, activeOnly: false }, options),
    columns: [
      { label: 'Cari Kod', key: 'supplierCode' },
      { label: 'Ad / Unvan', value: (row) => row.supplierName || row.name || '' },
      { label: 'Telefon', value: (row) => row.phone || row.phoneMasked || '' },
      { label: 'Şehir', key: 'city' },
      { label: 'Ülke', key: 'country' },
      { label: 'Para Birimi', key: 'currency' },
      { label: 'Bakiye', key: 'balance' },
      { label: 'Durum', value: (row) => row.isPassive ? 'Pasif' : 'Aktif' },
    ],
  },
  sales: {
    title: 'Satış Fişleri',
    filename: 'satis-fisleri',
    fetcher: ({ search, status, dateFrom, dateTo }, options) => fetchAllPages(fetchSalesDrafts, { search, status, dateFrom, dateTo }, options),
    columns: [
      { label: 'Fiş No', key: 'invoiceNo' },
      { label: 'Müşteri', key: 'customerName' },
      { label: 'Para Birimi', key: 'currency' },
      { label: 'Toplam', key: 'totalAmount' },
      { label: 'Durum', key: 'status' },
      { label: 'Satır', key: 'itemCount' },
      { label: 'Oluşturma', key: 'createdAt' },
      { label: 'Güncelleme', key: 'updatedAt' },
    ],
  },
  offers: {
    title: 'Teklifler',
    filename: 'teklifler',
    fetcher: ({ search, status, dateFrom, dateTo }, options) => fetchAllPages(fetchSalesOffers, { search, status, dateFrom, dateTo }, options),
    columns: [
      { label: 'Belge No', key: 'documentNo' },
      { label: 'Tarih', key: 'documentDate' },
      { label: 'Cari', key: 'customerName' },
      { label: 'Durum', key: 'status' },
      { label: 'PB', key: 'documentCurrency' },
      { label: 'Toplam', key: 'grandTotal' },
      { label: 'TRY', key: 'amountTry' },
      { label: 'Satır', key: 'itemCount' },
    ],
  },
  orders: {
    title: 'Siparişler',
    filename: 'sipari?ler',
    fetcher: ({ search, status, dateFrom, dateTo }, options) => fetchAllPages(fetchSalesOrders, { search, status, dateFrom, dateTo }, options),
    columns: [
      { label: 'Belge No', key: 'documentNo' },
      { label: 'Tarih', key: 'documentDate' },
      { label: 'Cari', key: 'customerName' },
      { label: 'Durum', key: 'status' },
      { label: 'PB', key: 'documentCurrency' },
      { label: 'Toplam', key: 'grandTotal' },
      { label: 'TRY', key: 'amountTry' },
      { label: 'Satır', key: 'itemCount' },
    ],
  },
  purchases: {
    title: 'Alış Fişleri',
    filename: 'alis-fisleri',
    fetcher: ({ search, status, dateFrom, dateTo }, options) => fetchAllPages(fetchPurchaseDrafts, { search, status, dateFrom, dateTo }, options),
    columns: [
      { label: 'Fiş No', key: 'invoiceNo' },
      { label: 'Tedarikçi', key: 'supplierName' },
      { label: 'Para Birimi', key: 'currency' },
      { label: 'Toplam', key: 'totalAmount' },
      { label: 'Durum', key: 'status' },
      { label: 'Satır', key: 'itemCount' },
      { label: 'Oluşturma', key: 'createdAt' },
      { label: 'Güncelleme', key: 'updatedAt' },
    ],
  },
  stockMovements: {
    title: 'Stok Hareketleri',
    filename: 'stok-hareketleri',
    fetcher: ({ search, dateFrom, dateTo }, options) => fetchAllPages(fetchStockMovements, { search, dateFrom, dateTo }, options),
    columns: [
      { label: 'Tarih', key: 'documentDate' },
      { label: 'Kaynak', key: 'sourceType' },
      { label: 'Belge No', key: 'sourceDocumentNo' },
      { label: 'Stok Kodu', key: 'stockCode' },
      { label: 'Ürün', key: 'productName' },
      { label: 'Giriş', key: 'quantityIn' },
      { label: 'Çıkış', key: 'quantityOut' },
      { label: 'Net', key: 'quantityNet' },
      { label: 'Müşteri', key: 'customerName' },
      { label: 'Tedarikçi', key: 'supplierName' },
    ],
  },
  stockValuation: {
    title: 'Stok Değerleme',
    filename: 'stok-degerleme',
    fetcher: ({ search }, options) => fetchAllPages(fetchStockValuation, { search }, options),
    columns: [
      { label: 'Stok Kodu', key: 'stockCode' },
      { label: 'Barkod', key: 'barcode' },
      { label: 'Ürün', key: 'productName' },
      { label: 'Marka', key: 'brand' },
      { label: 'PB', key: 'currency' },
      { label: 'Stok', key: 'stockQuantity' },
      { label: 'Ort. Maliyet TRY', key: 'averageCostTry' },
      { label: 'Stok Değeri TRY', key: 'stockValueTry' },
      { label: 'Potansiyel Kar TRY', key: 'potentialGrossProfitTry' },
    ],
  },
  terminalSync: {
    title: 'Terminal Sync Logları',
    filename: 'terminal-sync-loglari',
    fetcher: async ({ search, status, dateFrom, dateTo }) => {
      const response = await fetchTerminalAdminOverview({ search, status, dateFrom, dateTo });
      return {
        ...response,
        data: response.data.queue || [],
        meta: {
          source: response.meta.source || 'terminal-admin',
          total: response.data.queue.length || 0,
        },
      };
    },
    columns: [
      { label: 'Tarih', key: 'receivedAt' },
      { label: 'Cihaz', key: 'deviceCode' },
      { label: 'Cihaz Adı', key: 'deviceName' },
      { label: 'Kullanıcı', key: 'username' },
      { label: 'Event', key: 'eventType' },
      { label: 'Request', key: 'clientRequestId' },
      { label: 'Durum', key: 'status' },
      { label: 'Retry', key: 'retryCount' },
      { label: 'Hata', key: 'lastError' },
    ],
  },
};

const reportOptions = Object.entries(exportDefinitions).map(([id, definition]) => ({
  id,
  label: definition.title,
}));

export function ExportCenterScreen() {
  const [reportId, setReportId] = useState('products');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [dateFrom, setDateFrom] = useState(monthStartDate());
  const [dateTo, setDateTo] = useState(todayIsoDate());
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const active = useRef(null), loaded = useRef(null), alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; active.current = null; loaded.current = null; }; }, []);

  const definition = exportDefinitions[reportId];
  const supportsDate = ['sales', 'purchases', 'offers', 'orders', 'stockMovements', 'terminalSync'].includes(reportId);
  const supportsStatus = ['sales', 'purchases', 'offers', 'orders', 'terminalSync'].includes(reportId);
  const previewRows = useMemo(() => rows.slice(0, 20), [rows]);
  const canExport = !isLoading && !errorMessage && rows.length > 0 && loaded.current?.rows === rows && loaded.current?.definition === definition;
  function invalidate() {
    active.current = null; loaded.current = null;
    setRows([]); setMeta(null); setErrorMessage(''); setIsLoading(false);
  }
  function exportReady() { return alive.current && canExport && loaded.current?.rows === rows && loaded.current?.definition === definition; }

  async function loadRows(event) {
    event.preventDefault();
    const token = {}; active.current = token; loaded.current = null;
    const current = () => alive.current && active.current === token;
    setRows([]); setMeta(null);
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await definition.fetcher({ search, status, dateFrom, dateTo }, { isCurrent: current });
      if (!current()) return;
      if (!Array.isArray(response?.data)) throw Error('Rapor yanıtı doğrulanamadı.');
      loaded.current = { rows: response.data, definition };
      setRows(response.data);
      setMeta(response.meta || null);
    } catch (error) {
      if (!current()) return;
      loaded.current = null;
      setRows([]);
      setMeta(null);
      setErrorMessage(`${error.message || 'Çıktı verisi okunamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      if (current()) setIsLoading(false);
    }
  }

  function exportCsv() {
    if (!exportReady()) return;
    const scope = outputScope();
    exportRowsToCsv({ filename: outputFilename(), rows, columns: [...definition.columns, { label: 'Rapor kapsamı', value: () => scope }] });
  }

  function exportExcel() {
    if (!exportReady()) return;
    exportRowsToExcel({ filename: outputFilename(), title: `${definition.title} · ${outputScope()}`, rows, columns: definition.columns });
  }

  function outputScope() {
    const total = Number.isSafeInteger(meta?.total) && meta.total >= 0 ? meta.total : 'doğrulanmadı';
    return `Yüklenen ${rows.length} / toplam ${total} kayıt${meta?.truncated ? ' · KISMİ ÇIKTI' : ''} · Tek zamanlı veri görüntüsü doğrulanmadı`;
  }
  function outputFilename() { return `${definition.filename}-${rows.length}-satir${meta?.truncated ? '-kismi' : ''}`; }

  function printReport() {
    if (!exportReady()) return;
    printRowsReport({
      title: definition.title,
      subtitle: `${supportsDate ? `${dateFrom || '-'} / ${dateTo || '-'}` : 'Tarih filtresi uygulanmaz'} · ${outputScope()}`,
      rows,
      columns: definition.columns,
    });
  }

  return (
    <main className="work-area export-center-screen">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Çıktı Merkezi</strong>
          <span>CSV, Excel ve PDF olarak kaydedilebilir yazdırma çıktıları</span>
        </div>
        <form className="filter-grid export-filter-form" onSubmit={loadRows}>
          <label>
            Rapor
            <select value={reportId} onChange={(event) => { invalidate(); setReportId(event.target.value); }}>
              {reportOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <details className="export-advanced-filters">
            <summary>Arama ve tarih filtreleri</summary>
            <div>
          <label>
            Arama
            <input value={search} onChange={(event) => { invalidate(); setSearch(event.target.value); }} placeholder="Kod, ad, barkod, cari..." />
          </label>
          <label>
            Durum
            <select value={status} disabled={!supportsStatus} onChange={(event) => { invalidate(); setStatus(event.target.value); }}>
              <option value="ALL">Tümü</option>
              <option value="DRAFT">Taslak</option>
              <option value="FINALIZED">Kesinleşen</option>
              <option value="CANCELLED">İptal</option>
            </select>
          </label>
          <label>
            Başlangıç
            <input type="date" value={dateFrom} disabled={!supportsDate} onChange={(event) => { invalidate(); setDateFrom(event.target.value); }} />
          </label>
          <label>
            Bitiş
            <input type="date" value={dateTo} disabled={!supportsDate} onChange={(event) => { invalidate(); setDateTo(event.target.value); }} />
          </label>
            </div>
          </details>
          <button type="submit" className="primary" disabled={isLoading}>{isLoading ? 'Okunuyor...' : 'Veriyi Getir'}</button>
        </form>
      </section>

      <section className="summary-strip">
        <article className="summary-card">
          <span>Rapor</span>
          <strong>{definition.title}</strong>
          <small>Kaynak: {typeof meta?.source === 'string' ? meta.source : 'Doğrulanmadı'}</small>
        </article>
        <article className="summary-card">
          <span>Satır</span>
          <strong>{isLoading ? 'Okunuyor…' : meta ? rows.length : 'Doğrulanmadı'}</strong>
          <small>Toplam: {meta?.total ?? 'Doğrulanmadı'}</small>
        </article>
        <article className="summary-card">
          <span>Format</span>
          <strong>CSV / Excel / PDF</strong>
          <small>PDF için yazdır penceresinde PDF kaydet</small>
        </article>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Önizleme</strong>
          <span>İlk 20 satır gösterilir, çıktı tüm yüklenen satırdan alınır</span>
        </div>
        <div className="toolbar-row export-center-actions">
          <button type="button" onClick={exportCsv} disabled={!canExport}>CSV İndir</button>
          <button type="button" onClick={exportExcel} disabled={!canExport}>Excel İndir</button>
          <button type="button" onClick={printReport} disabled={!canExport}>Yazdır / PDF</button>
        </div>
        {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {meta?.truncated && <div className="list-state list-state-error">Rapor {meta.loaded} satır güvenlik sınırında durduruldu. Daha dar filtre kullanın.</div>}
        {!errorMessage && rows.length === 0 && <div className="list-state">Rapor verisi bekleniyor.</div>}
        {rows.length > 0 && (
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  {definition.columns.map((column) => <th key={column.label}>{column.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={row.id || `${reportId}-${index}`}>
                    {definition.columns.map((column) => (
                      <td key={column.label}>{String(column.value ? column.value(row) : row[column.key] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
