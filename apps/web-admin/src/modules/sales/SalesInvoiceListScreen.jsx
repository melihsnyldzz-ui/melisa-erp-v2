import React, { useEffect, useMemo, useState } from 'react';
import { fetchSalesDrafts } from '../../services/invoiceDraftApi.js';
import { exportRowsToExcel, printRowsReport } from '../../utils/exportUtils.js';

function todayIsoDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('tr-TR') : '-';
}

export function SalesInvoiceListScreen({ onOpenScreen }) {
  const today = useMemo(() => todayIsoDate(), []);
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [rows, setRows] = useState([]);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRowId) ?? null,
    [rows, selectedRowId],
  );

  async function loadSalesInvoices() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetchSalesDrafts({
        page: 1,
        limit: 100,
        search,
        customer,
        status: statusFilter,
        dateFrom,
        dateTo,
      });

      setRows(response.data);
      setMeta(response.meta);
      setSelectedRowId((currentId) => (
        response.data.some((row) => row.id === currentId) ? currentId : response.data[0]?.id ?? null
      ));
    } catch (error) {
      setRows([]);
      setMeta(null);
      setSelectedRowId(null);
      setErrorMessage(error.message || 'Satış fişi listesi API bağlantısı başarısız.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function guardedLoad() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchSalesDrafts({
          page: 1,
          limit: 100,
          search,
          customer,
          status: statusFilter,
          dateFrom,
          dateTo,
        });

        if (isMounted) {
          setRows(response.data);
          setMeta(response.meta);
          setSelectedRowId((currentId) => (
            response.data.some((row) => row.id === currentId) ? currentId : response.data[0]?.id ?? null
          ));
        }
      } catch (error) {
        if (isMounted) {
          setRows([]);
          setMeta(null);
          setSelectedRowId(null);
          setErrorMessage(error.message || 'Satış fişi listesi API bağlantısı başarısız.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    guardedLoad();

    return () => {
      isMounted = false;
    };
  }, [customer, dateFrom, dateTo, search, statusFilter]);

  function openInvoice(rowId = selectedRow?.id) {
    if (!rowId) {
      setErrorMessage('Fiş açmak için listeden bir kayıt seçin.');
      return;
    }

    setErrorMessage('');
    const row = rows.find((item) => item.id === rowId);
    onOpenScreen('sales-invoice', { salesDraftId: rowId, invoiceNo: row?.invoiceNo });
  }

  function exportSalesRows() {
    exportRowsToExcel({
      filename: 'satis-fisleri',
      title: 'Satış Fişleri',
      rows,
      columns: [
        { label: 'Fiş No', key: 'invoiceNo' },
        { label: 'Müşteri', key: 'customerName' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Toplam', key: 'totalAmount' },
        { label: 'Durum', key: 'status' },
        { label: 'Satır', key: 'itemCount' },
        { label: 'Oluşturma', value: (row) => formatDate(row.createdAt) },
        { label: 'Güncelleme', value: (row) => formatDate(row.updatedAt) },
      ],
    });
  }

  function printSalesRows() {
    printRowsReport({
      title: 'Melisa ERP - Satış Fişleri',
      subtitle: `${rows.length} fiş / ${dateFrom || '-'} - ${dateTo || '-'}`,
      rows,
      columns: [
        { label: 'Fiş No', key: 'invoiceNo' },
        { label: 'Müşteri', key: 'customerName' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Toplam', key: 'totalAmount' },
        { label: 'Durum', key: 'status' },
        { label: 'Satır', key: 'itemCount' },
        { label: 'Oluşturma', value: (row) => formatDate(row.createdAt) },
        { label: 'Güncelleme', value: (row) => formatDate(row.updatedAt) },
      ],
    });
  }

  return (
    <main className="work-area invoice-list-screen">
      <section className="invoice-list-toolbar">
        <div className="invoice-list-title">
          <strong>Satış Fişleri</strong>
          <span>Bugün çıkan satış fişleri, taslaklar ve kesinleşen düzeltmeler</span>
        </div>
        <div className="invoice-list-actions">
          <button type="button" onClick={() => onOpenScreen('sales-invoice')}>Yeni Fiş</button>
          <button type="button" onClick={() => openInvoice()} disabled={!selectedRow}>Fiş Aç</button>
          <button type="button" onClick={exportSalesRows}>Excel</button>
          <button type="button" onClick={printSalesRows}>Yazdır</button>
          <button type="button" onClick={loadSalesInvoices}>Yenile</button>
        </div>
      </section>

      <section className="invoice-list-filters">
        <label>
          <span>Fiş / genel arama</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Fiş no veya müşteri" />
        </label>
        <label>
          <span>Müşteri</span>
          <input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Müşteri adı" />
        </label>
        <label>
          <span>Durum</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">Tümü</option>
            <option value="DRAFT">Taslak</option>
            <option value="FINALIZED">Kesinleşen</option>
            <option value="CANCELLED">İptal</option>
            <option value="ARCHIVED_TEST">Test Arşivi</option>
          </select>
        </label>
        <label>
          <span>Başlangıç</span>
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label>
          <span>Bitiş</span>
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
      </section>

      <section className="erp-panel invoice-list-panel">
        <div className="panel-title">
          <strong>Satış Fişleri Tablosu</strong>
          <span>Seçili: {selectedRow?.invoiceNo ?? 'yok'} / Satır: {rows.length}</span>
        </div>
        {isLoading && <div className="list-state">API'den satış fişleri yükleniyor...</div>}
        {!isLoading && errorMessage && (
          <div className="list-state list-state-error">{errorMessage} Demo fallback kullanılmadı.</div>
        )}
        {!isLoading && !errorMessage && rows.length === 0 && (
          <div className="list-state">Kayıt bulunamadı veya seçilen filtreler boş.</div>
        )}
        {!isLoading && !errorMessage && rows.length > 0 && (
          <div className="table-wrap invoice-table-wrap">
            <table className="invoice-list-table">
              <thead>
                <tr>
                  <th>Fiş no</th>
                  <th>Müşteri</th>
                  <th>PB</th>
                  <th>Toplam</th>
                  <th>Durum</th>
                  <th>Satır</th>
                  <th>Oluşturma</th>
                  <th>Güncelleme</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={row.id === selectedRow?.id ? 'selected' : ''}
                    onClick={() => setSelectedRowId(row.id)}
                    onDoubleClick={() => openInvoice(row.id)}
                  >
                    <td className="code-cell">{row.invoiceNo}</td>
                    <td>{row.customerName}</td>
                    <td>{row.currency}</td>
                    <td className="money-cell">{formatMoney(row.totalAmount, row.currency)}</td>
                    <td><span className={`draft-badge ${row.status === 'ARCHIVED_TEST' ? 'archived-test-badge' : ''}`}>{row.status}</span></td>
                    <td className="money-cell">{row.itemCount}</td>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>{formatDate(row.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="screen-summary invoice-list-summary">
        <span>Toplam fiş: {meta?.total ?? rows.length}</span>
        <span>Liste kaydı: {rows.length}</span>
        <span>Durum: {statusFilter}</span>
        <span>Tarih: {dateFrom || '-'} / {dateTo || '-'}</span>
        <span>Kaynak: API / canli SQL</span>
      </section>
    </main>
  );
}
