import React, { useEffect, useMemo, useState } from 'react';
import { fetchPurchaseDrafts } from '../../services/invoiceDraftApi.js';
import { exportRowsToExcel, printRowsReport } from '../../utils/exportUtils.js';

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

export function PurchaseInvoiceListScreen({ onOpenScreen }) {
  const [search, setSearch] = useState('');
  const [supplier, setSupplier] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [rows, setRows] = useState([]);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRowId) ?? null,
    [rows, selectedRowId],
  );

  async function loadDrafts() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetchPurchaseDrafts({
        page: 1,
        limit: 100,
        search,
        supplier,
        status: statusFilter,
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
      setErrorMessage(error.message || 'Alış fiş listesi API bağlantısı başarısız.');
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
        const response = await fetchPurchaseDrafts({
          page: 1,
          limit: 100,
          search,
          supplier,
          status: statusFilter,
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
          setErrorMessage(error.message || 'Alış fiş listesi API bağlantısı başarısız.');
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
  }, [search, statusFilter, supplier]);

  function openDraft(rowId = selectedRow?.id) {
    if (!rowId) {
      setErrorMessage('Fiş açmak için listeden bir kayıt seçin.');
      return;
    }

    setErrorMessage('');
    const row = rows.find((item) => item.id === rowId);
    onOpenScreen('purchase-invoice', { purchaseDraftId: rowId, invoiceNo: row?.invoiceNo });
  }

  function exportPurchaseRows() {
    exportRowsToExcel({
      filename: 'alis-fisleri',
      title: 'Alış Fişleri',
      rows,
      columns: [
        { label: 'Fiş No', key: 'invoiceNo' },
        { label: 'Tedarikçi', key: 'supplierName' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Toplam', key: 'totalAmount' },
        { label: 'Durum', key: 'status' },
        { label: 'Satır', key: 'itemCount' },
        { label: 'Oluşturma', value: (row) => formatDate(row.createdAt) },
        { label: 'Güncelleme', value: (row) => formatDate(row.updatedAt) },
      ],
    });
  }

  function printPurchaseRows() {
    printRowsReport({
      title: 'Melisa ERP - Alış Fişleri',
      subtitle: `${rows.length} fiş / ${statusFilter === 'ALL' ? 'Tüm durumlar' : statusFilter}`,
      rows,
      columns: [
        { label: 'Fiş No', key: 'invoiceNo' },
        { label: 'Tedarikçi', key: 'supplierName' },
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
          <strong>Alış Fişleri</strong>
          <span>Tedarikçi alış fişleri, maliyet etkisi ve stok girişi</span>
        </div>
        <div className="invoice-list-actions">
          <button type="button" onClick={() => onOpenScreen('purchase-invoice')}>Yeni Fiş</button>
          <button type="button" onClick={() => openDraft()} disabled={!selectedRow}>Fiş Aç</button>
          <button type="button" onClick={exportPurchaseRows}>Excel</button>
          <button type="button" onClick={printPurchaseRows}>Yazdır</button>
          <button type="button" onClick={loadDrafts}>Yenile</button>
        </div>
      </section>

      <section className="invoice-list-filters">
        <label>
          <span>Fiş / genel arama</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Fiş no veya tedarikçi" />
        </label>
        <label>
          <span>Tedarikçi</span>
          <input value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="Tedarikçi adı" />
        </label>
        <label>
          <span>Durum</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">Tümü</option>
            <option value="DRAFT">Taslak</option>
            <option value="FINALIZED">Kesinleşmiş</option>
            <option value="CANCELLED">İptal</option>
            <option value="ARCHIVED_TEST">Test Arşivi</option>
          </select>
        </label>
      </section>

      <section className="erp-panel invoice-list-panel">
        <div className="panel-title">
          <strong>Alış Fişleri Tablosu</strong>
          <span>Seçili: {selectedRow?.invoiceNo ?? 'yok'} / Satır: {rows.length}</span>
        </div>
        {isLoading && <div className="list-state">API'den alış fişleri yükleniyor...</div>}
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
                  <th>Tedarikçi</th>
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
                    onDoubleClick={() => openDraft(row.id)}
                  >
                    <td className="code-cell">{row.invoiceNo}</td>
                    <td>{row.supplierName}</td>
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
        <span>Kaynak: API / canlı SQL</span>
      </section>
    </main>
  );
}
