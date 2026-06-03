import React, { useMemo, useState } from 'react';
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

function value(key) {
  return { key };
}

const exportDefinitions = {
  products: {
    title: 'Stok Listesi',
    filename: 'stok-listesi',
    fetcher: ({ search }) => fetchProducts({ search, limit: 500, activeOnly: false }),
    columns: [
      { label: 'Stok Kodu', key: 'stockCode' },
      { label: 'Barkod', value: (row) => row.matchedBarcode || row.barcodeMasked || '' },
      { label: 'Urun', key: 'productName' },
      { label: 'Marka', key: 'brand' },
      { label: 'Kategori', key: 'category' },
      { label: 'Para Birimi', key: 'currency' },
      { label: 'Satis Fiyati', key: 'salePrice' },
      { label: 'Alis Fiyati', key: 'purchasePrice' },
      { label: 'Stok', key: 'stockQuantity' },
    ],
  },
  customers: {
    title: 'Musteri Cari Listesi',
    filename: 'musteri-cari-listesi',
    fetcher: ({ search }) => fetchCustomers({ search, limit: 500, activeOnly: false }),
    columns: [
      { label: 'Cari Kod', key: 'customerCode' },
      { label: 'Ad / Unvan', value: (row) => row.customerName || row.name || '' },
      { label: 'Telefon', value: (row) => row.phone || row.phoneMasked || '' },
      { label: 'Sehir', key: 'city' },
      { label: 'Ulke', key: 'country' },
      { label: 'Para Birimi', key: 'currency' },
      { label: 'Bakiye', key: 'balance' },
      { label: 'Durum', value: (row) => row.isPassive ? 'Pasif' : 'Aktif' },
    ],
  },
  suppliers: {
    title: 'Tedarikci Cari Listesi',
    filename: 'tedarikci-cari-listesi',
    fetcher: ({ search }) => fetchSuppliers({ search, limit: 500, activeOnly: false }),
    columns: [
      { label: 'Cari Kod', key: 'supplierCode' },
      { label: 'Ad / Unvan', value: (row) => row.supplierName || row.name || '' },
      { label: 'Telefon', value: (row) => row.phone || row.phoneMasked || '' },
      { label: 'Sehir', key: 'city' },
      { label: 'Ulke', key: 'country' },
      { label: 'Para Birimi', key: 'currency' },
      { label: 'Bakiye', key: 'balance' },
      { label: 'Durum', value: (row) => row.isPassive ? 'Pasif' : 'Aktif' },
    ],
  },
  sales: {
    title: 'Satis Fisleri',
    filename: 'satis-fisleri',
    fetcher: ({ search, status, dateFrom, dateTo }) => fetchSalesDrafts({ search, status, dateFrom, dateTo, limit: 500 }),
    columns: [
      { label: 'Fis No', key: 'invoiceNo' },
      { label: 'Musteri', key: 'customerName' },
      { label: 'Para Birimi', key: 'currency' },
      { label: 'Toplam', key: 'totalAmount' },
      { label: 'Durum', key: 'status' },
      { label: 'Satir', key: 'itemCount' },
      { label: 'Olusturma', key: 'createdAt' },
      { label: 'Guncelleme', key: 'updatedAt' },
    ],
  },
  offers: {
    title: 'Teklifler',
    filename: 'teklifler',
    fetcher: ({ search, status, dateFrom, dateTo }) => fetchSalesOffers({ search, status, dateFrom, dateTo, limit: 500 }),
    columns: [
      { label: 'Belge No', key: 'documentNo' },
      { label: 'Tarih', key: 'documentDate' },
      { label: 'Cari', key: 'customerName' },
      { label: 'Durum', key: 'status' },
      { label: 'PB', key: 'documentCurrency' },
      { label: 'Toplam', key: 'grandTotal' },
      { label: 'TRY', key: 'amountTry' },
      { label: 'Satir', key: 'itemCount' },
    ],
  },
  orders: {
    title: 'Siparisler',
    filename: 'siparisler',
    fetcher: ({ search, status, dateFrom, dateTo }) => fetchSalesOrders({ search, status, dateFrom, dateTo, limit: 500 }),
    columns: [
      { label: 'Belge No', key: 'documentNo' },
      { label: 'Tarih', key: 'documentDate' },
      { label: 'Cari', key: 'customerName' },
      { label: 'Durum', key: 'status' },
      { label: 'PB', key: 'documentCurrency' },
      { label: 'Toplam', key: 'grandTotal' },
      { label: 'TRY', key: 'amountTry' },
      { label: 'Satir', key: 'itemCount' },
    ],
  },
  purchases: {
    title: 'Alis Fisleri',
    filename: 'alis-fisleri',
    fetcher: ({ search, status }) => fetchPurchaseDrafts({ search, status, limit: 500 }),
    columns: [
      { label: 'Fis No', key: 'invoiceNo' },
      { label: 'Tedarikci', key: 'supplierName' },
      { label: 'Para Birimi', key: 'currency' },
      { label: 'Toplam', key: 'totalAmount' },
      { label: 'Durum', key: 'status' },
      { label: 'Satir', key: 'itemCount' },
      { label: 'Olusturma', key: 'createdAt' },
      { label: 'Guncelleme', key: 'updatedAt' },
    ],
  },
  stockMovements: {
    title: 'Stok Hareketleri',
    filename: 'stok-hareketleri',
    fetcher: ({ search, dateFrom, dateTo }) => fetchStockMovements({ search, dateFrom, dateTo, limit: 500 }),
    columns: [
      { label: 'Tarih', key: 'documentDate' },
      { label: 'Kaynak', key: 'sourceType' },
      { label: 'Belge No', key: 'sourceDocumentNo' },
      { label: 'Stok Kodu', key: 'stockCode' },
      { label: 'Urun', key: 'productName' },
      { label: 'Giris', key: 'quantityIn' },
      { label: 'Cikis', key: 'quantityOut' },
      { label: 'Net', key: 'quantityNet' },
      { label: 'Musteri', key: 'customerName' },
      { label: 'Tedarikci', key: 'supplierName' },
    ],
  },
  stockValuation: {
    title: 'Stok Degerleme',
    filename: 'stok-degerleme',
    fetcher: ({ search }) => fetchStockValuation({ search, limit: 500 }),
    columns: [
      { label: 'Stok Kodu', key: 'stockCode' },
      { label: 'Barkod', key: 'barcode' },
      { label: 'Urun', key: 'productName' },
      { label: 'Marka', key: 'brand' },
      { label: 'PB', key: 'currency' },
      { label: 'Stok', key: 'stockQuantity' },
      { label: 'Ort. Maliyet TRY', key: 'averageCostTry' },
      { label: 'Stok Degeri TRY', key: 'stockValueTry' },
      { label: 'Potansiyel Kar TRY', key: 'potentialGrossProfitTry' },
    ],
  },
  terminalSync: {
    title: 'Terminal Sync Loglari',
    filename: 'terminal-sync-loglari',
    fetcher: async ({ search, status, dateFrom, dateTo }) => {
      const response = await fetchTerminalAdminOverview({ search, status, dateFrom, dateTo });
      return {
        ...response,
        data: response.data?.queue || [],
        meta: {
          source: response.meta?.source || 'terminal-admin',
          total: response.data?.queue?.length || 0,
        },
      };
    },
    columns: [
      { label: 'Tarih', key: 'receivedAt' },
      { label: 'Cihaz', key: 'deviceCode' },
      { label: 'Cihaz Adi', key: 'deviceName' },
      { label: 'Kullanici', key: 'username' },
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

  const definition = exportDefinitions[reportId];
  const previewRows = useMemo(() => rows.slice(0, 20), [rows]);

  async function loadRows(event) {
    event?.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await definition.fetcher({ search, status, dateFrom, dateTo });
      setRows(response.data || []);
      setMeta(response.meta || null);
    } catch (error) {
      setRows([]);
      setMeta(null);
      setErrorMessage(`${error.message || 'Cikti verisi okunamadi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  function exportCsv() {
    exportRowsToCsv({ filename: definition.filename, title: definition.title, rows, columns: definition.columns });
  }

  function exportExcel() {
    exportRowsToExcel({ filename: definition.filename, title: definition.title, rows, columns: definition.columns });
  }

  function printReport() {
    printRowsReport({
      title: definition.title,
      subtitle: `${dateFrom || '-'} / ${dateTo || '-'} - ${rows.length} satir`,
      rows,
      columns: definition.columns,
    });
  }

  return (
    <main className="work-area export-center-screen">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Çıktı Merkezi</strong>
          <span>CSV, Excel ve PDF olarak kaydedilebilir yazdirma ciktilari</span>
        </div>
        <form className="filter-grid" onSubmit={loadRows}>
          <label>
            Rapor
            <select value={reportId} onChange={(event) => { setReportId(event.target.value); setRows([]); }}>
              {reportOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Arama
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kod, ad, barkod, cari..." />
          </label>
          <label>
            Durum
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="ALL">Tumu</option>
              <option value="DRAFT">Taslak</option>
              <option value="FINALIZED">Kesinlesen</option>
              <option value="CANCELLED">Iptal</option>
            </select>
          </label>
          <label>
            Baslangic
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label>
            Bitis
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <button type="submit" className="primary" disabled={isLoading}>{isLoading ? 'Okunuyor...' : 'Veriyi Getir'}</button>
        </form>
      </section>

      <section className="summary-strip">
        <article className="summary-card">
          <span>Rapor</span>
          <strong>{definition.title}</strong>
          <small>Kaynak: canlı API</small>
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
          <button type="button" onClick={exportCsv} disabled={!rows.length}>CSV İndir</button>
          <button type="button" onClick={exportExcel} disabled={!rows.length}>Excel İndir</button>
          <button type="button" onClick={printReport} disabled={!rows.length}>Yazdır / PDF</button>
        </div>
        {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
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
