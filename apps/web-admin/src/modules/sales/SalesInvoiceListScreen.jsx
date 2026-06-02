import React, { useEffect, useMemo, useState } from 'react';
import { fetchSalesDrafts } from '../../services/invoiceDraftApi.js';
import { exportRowsToCsv, printCurrentScreen } from '../../utils/exportUtils.js';

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
    () => rows.find((row) => row.id === selectedRowId) ?? rows[0],
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
      setErrorMessage(error.message || 'Satis fisi listesi API baglantisi basarisiz.');
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
          setErrorMessage(error.message || 'Satis fisi listesi API baglantisi basarisiz.');
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
      setErrorMessage('Fis acmak icin listeden bir kayit secin.');
      return;
    }

    setErrorMessage('');
    const row = rows.find((item) => item.id === rowId);
    onOpenScreen('sales-invoice', { salesDraftId: rowId, invoiceNo: row?.invoiceNo });
  }

  function exportSalesRows() {
    exportRowsToCsv({
      filename: 'satis-fisleri',
      rows,
      columns: [
        { label: 'Fis No', key: 'invoiceNo' },
        { label: 'Musteri', key: 'customerName' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Toplam', key: 'totalAmount' },
        { label: 'Durum', key: 'status' },
        { label: 'Satir', key: 'itemCount' },
        { label: 'Olusturma', value: (row) => formatDate(row.createdAt) },
        { label: 'Guncelleme', value: (row) => formatDate(row.updatedAt) },
      ],
    });
  }

  return (
    <main className="work-area invoice-list-screen">
      <section className="invoice-list-toolbar">
        <div className="invoice-list-title">
          <strong>Satis Fisleri</strong>
          <span>Bugun cikan satis fisleri, taslaklar ve finalized duzeltmeleri</span>
        </div>
        <div className="invoice-list-actions">
          <button type="button" onClick={() => onOpenScreen('sales-invoice')}>Yeni Fis</button>
          <button type="button" onClick={() => openInvoice()}>Fis Ac</button>
          <button type="button" onClick={exportSalesRows}>Excel</button>
          <button type="button" onClick={() => printCurrentScreen('Melisa ERP - Satis Fisleri')}>Yazdir</button>
          <button type="button" onClick={loadSalesInvoices}>Yenile</button>
        </div>
      </section>

      <section className="invoice-list-filters">
        <label>
          <span>Fis / genel arama</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Fis no veya musteri" />
        </label>
        <label>
          <span>Musteri</span>
          <input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Musteri adi" />
        </label>
        <label>
          <span>Durum</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">Tumu</option>
            <option value="DRAFT">Taslak</option>
            <option value="FINALIZED">Kesinlesen</option>
            <option value="CANCELLED">Iptal</option>
          </select>
        </label>
        <label>
          <span>Baslangic</span>
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label>
          <span>Bitis</span>
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
      </section>

      <section className="erp-panel invoice-list-panel">
        <div className="panel-title">
          <strong>Satis Fisleri Tablosu</strong>
          <span>Secili: {selectedRow?.invoiceNo ?? 'yok'} / Satir: {rows.length}</span>
        </div>
        {isLoading && <div className="list-state">API'den satis fisleri yukleniyor...</div>}
        {!isLoading && errorMessage && (
          <div className="list-state list-state-error">{errorMessage} Demo fallback kullanilmadi.</div>
        )}
        {!isLoading && !errorMessage && rows.length === 0 && (
          <div className="list-state">Kayit bulunamadi veya secilen filtreler bos.</div>
        )}
        {!isLoading && !errorMessage && rows.length > 0 && (
          <div className="table-wrap invoice-table-wrap">
            <table className="invoice-list-table">
              <thead>
                <tr>
                  <th>Fis no</th>
                  <th>Musteri</th>
                  <th>PB</th>
                  <th>Toplam</th>
                  <th>Durum</th>
                  <th>Satir</th>
                  <th>Olusturma</th>
                  <th>Guncelleme</th>
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
                    <td><span className="draft-badge">{row.status}</span></td>
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
        <span>Toplam fis: {meta?.total ?? rows.length}</span>
        <span>Liste kaydi: {rows.length}</span>
        <span>Durum: {statusFilter}</span>
        <span>Tarih: {dateFrom || '-'} / {dateTo || '-'}</span>
        <span>Kaynak: API / canli SQL</span>
      </section>
    </main>
  );
}
