import React, { useMemo, useRef, useState } from 'react';
import { fetchProducts } from '../../services/productApi.js';
import { fetchCustomers } from '../../services/customerApi.js';
import { fetchSuppliers } from '../../services/supplierApi.js';
import { fetchSalesDrafts, fetchPurchaseDrafts } from '../../services/invoiceDraftApi.js';
import { fetchSalesOffers, fetchSalesOrders } from '../../services/salesPipelineApi.js';
import { fetchStockMovements, fetchStockValuation } from '../../services/movementApi.js';
import { fetchTerminalAdminOverview } from '../../services/terminalAdminApi.js';
import { exportRowsToCsv, exportRowsToExcel, printRowsReport } from '../../utils/exportUtils.js';

function todayIsoDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthStartDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

import { fetchAllExportPages as fetchAllPages } from './reportExportPages.js';

const exportDefinitions = {
  products: {
    title: 'Stok Listesi',
    filename: 'stok-listesi',
    fetcher: ({ search }) => fetchAllPages(fetchProducts, { search, activeOnly: false }),
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
    fetcher: ({ search }) => fetchAllPages(fetchCustomers, { search, activeOnly: false }),
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
    filename: 'tedarikci-cari-listesi',
    fetcher: ({ search }) => fetchAllPages(fetchSuppliers, { search, activeOnly: false }),
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
    fetcher: ({ search, status, dateFrom, dateTo }) => fetchAllPages(fetchSalesDrafts, { search, status, dateFrom, dateTo }),
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
    fetcher: ({ search, status, dateFrom, dateTo }) => fetchAllPages(fetchSalesOffers, { search, status, dateFrom, dateTo }),
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
    filename: 'siparisler',
    fetcher: ({ search, status, dateFrom, dateTo }) => fetchAllPages(fetchSalesOrders, { search, status, dateFrom, dateTo }),
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
    fetcher: ({ search, status, dateFrom, dateTo }) => fetchAllPages(fetchPurchaseDrafts, { search, status, dateFrom, dateTo }),
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
    fetcher: ({ search, dateFrom, dateTo }) => fetchAllPages(fetchStockMovements, { search, dateFrom, dateTo }),
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
    fetcher: ({ search }) => fetchAllPages(fetchStockValuation, { search }),
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

  const requestVersion = useRef(0);
  const definition = exportDefinitions[reportId];
  const usesDates = ['sales', 'purchases', 'offers', 'orders', 'stockMovements', 'terminalSync'].includes(reportId);
  const usesStatus = ['sales', 'purchases', 'offers', 'orders'].includes(reportId);
  const statuses = reportId === 'offers' ? [['draft','Taslak'],['sent','Gönderilen'],['accepted','Kabul edilen'],['cancelled','İptal']]
    : reportId === 'orders' ? [['draft','Taslak'],['confirmed','Onaylanan'],['fulfilled','Karşılanan'],['cancelled','İptal']]
    : [['DRAFT','Taslak'],['FINALIZED','Kesinleşen'],['CANCELLED','İptal']];
  function invalidate() {
    requestVersion.current += 1;
    setRows([]); setMeta(null); setErrorMessage(''); setIsLoading(false);
  }
  const canExport = rows.length > 0 && !isLoading && !meta?.truncated;
  const previewRows = useMemo(() => rows.slice(0, 20), [rows]);

  async function loadRows(event) {
    event.preventDefault();
    const version = ++requestVersion.current;
    setRows([]); setMeta(null);
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await definition.fetcher({ search, status, dateFrom, dateTo });
      if (version !== requestVersion.current) return;
      setRows(response.data || []);
      setMeta(response.meta || null);
    } catch (error) {
      if (version !== requestVersion.current) return;
      setRows([]);
      setMeta(null);
      setErrorMessage(`${error.message || 'Çıktı verisi okunamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }

  function exportCsv() {
    if (!canExport) return;
    exportRowsToCsv({ filename: definition.filename, rows, columns: definition.columns });
  }

  function exportExcel() {
    if (!canExport) return;
    exportRowsToExcel({ filename: definition.filename, title: definition.title, rows, columns: definition.columns });
  }

  function printReport() {
    if (!canExport) return;
    printRowsReport({
      title: definition.title,
      subtitle: usesDates ? `${dateFrom || '-'} / ${dateTo || '-'} - ${rows.length} satır` : `${rows.length} satır`,
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
            <select value={reportId} onChange={(event) => { invalidate(); setReportId(event.target.value); setStatus('ALL'); }}>
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
          <label hidden={!usesStatus}>
            Durum
            <select value={status} onChange={(event) => { invalidate(); setStatus(event.target.value); }}>
              <option value="ALL">Tümü</option>
              {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label hidden={!usesDates}>
            Başlangıç
            <input type="date" value={dateFrom} onChange={(event) => { invalidate(); setDateFrom(event.target.value); }} />
          </label>
          <label hidden={!usesDates}>
            Bitiş
            <input type="date" value={dateTo} onChange={(event) => { invalidate(); setDateTo(event.target.value); }} />
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
          <small>{meta ? `Kaynak: ${meta.source || 'API'}` : 'Veri henüz yüklenmedi'}</small>
        </article>
        <article className="summary-card">
          <span>Satır</span>
          <strong>{rows.length}</strong>
          <small>Toplam: {meta?.total ?? rows.length}</small>
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
