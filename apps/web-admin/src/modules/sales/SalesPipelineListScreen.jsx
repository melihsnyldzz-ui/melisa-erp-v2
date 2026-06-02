import React, { useEffect, useMemo, useState } from 'react';
import { fetchSalesOffers, fetchSalesOrders } from '../../services/salesPipelineApi.js';
import { exportRowsToCsv, printCurrentScreen } from '../../utils/exportUtils.js';

const STATUS_LABELS = {
  DRAFT: 'Taslak',
  SENT: 'Gonderildi',
  ACCEPTED: 'Kabul',
  CONFIRMED: 'Onayli',
  FULFILLED: 'Tamamlandi',
  CANCELLED: 'Iptal',
};

function todayIsoDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('tr-TR') : '-';
}

export function SalesPipelineListScreen({ type, onOpenScreen }) {
  const isOffer = type === 'offer';
  const today = useMemo(() => todayIsoDate(), []);
  const [filters, setFilters] = useState({
    search: '',
    customer: '',
    status: 'all',
    dateFrom: '',
    dateTo: today,
  });
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [meta, setMeta] = useState(null);

  const selectedRow = rows.find((row) => row.id === selectedId) || rows[0] || null;

  async function loadRows() {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const loader = isOffer ? fetchSalesOffers : fetchSalesOrders;
      const response = await loader({ page: 1, limit: 100, ...filters });
      setRows(response.data || []);
      setMeta(response.meta || null);
      setSelectedId((current) => (response.data || []).some((row) => row.id === current) ? current : response.data?.[0]?.id ?? null);
    } catch (error) {
      setRows([]);
      setMeta(null);
      setSelectedId(null);
      setErrorMessage(error.message || 'Liste API baglantisi basarisiz.');
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
        const loader = isOffer ? fetchSalesOffers : fetchSalesOrders;
        const response = await loader({ page: 1, limit: 100, ...filters });
        if (isMounted) {
          setRows(response.data || []);
          setMeta(response.meta || null);
          setSelectedId((current) => (response.data || []).some((row) => row.id === current) ? current : response.data?.[0]?.id ?? null);
        }
      } catch (error) {
        if (isMounted) {
          setRows([]);
          setMeta(null);
          setSelectedId(null);
          setErrorMessage(error.message || 'Liste API baglantisi basarisiz.');
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
  }, [filters, isOffer]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function openDocument(row = selectedRow) {
    if (!row) {
      setErrorMessage('Acacak kayit secin.');
      return;
    }
    onOpenScreen(isOffer ? 'sales-offer' : 'sales-order', {
      [isOffer ? 'offerId' : 'orderId']: row.id,
      documentNo: row.documentNo,
    });
  }

  function exportRows() {
    exportRowsToCsv({
      filename: isOffer ? 'teklifler' : 'siparisler',
      rows,
      columns: [
        { label: 'Belge No', key: 'documentNo' },
        { label: 'Tarih', value: (row) => formatDate(row.documentDate) },
        { label: 'Cari', key: 'customerName' },
        { label: 'Durum', value: (row) => STATUS_LABELS[row.status] || row.status },
        { label: 'PB', key: 'documentCurrency' },
        { label: 'Toplam', key: 'grandTotal' },
        { label: 'TRY', key: 'amountTry' },
        { label: 'Satir', key: 'itemCount' },
      ],
    });
  }

  return (
    <main className="work-area invoice-list-screen">
      <section className="invoice-list-toolbar">
        <div className="invoice-list-title">
          <strong>{isOffer ? 'Teklifler' : 'Siparisler'}</strong>
          <span>Gercek API listesi / Satir: {meta?.total ?? rows.length}</span>
        </div>
        <div className="invoice-list-actions">
          <button type="button" onClick={() => onOpenScreen(isOffer ? 'sales-offer' : 'sales-order')}>Yeni</button>
          <button type="button" onClick={() => openDocument()}>Ac</button>
          <button type="button" onClick={exportRows}>Excel</button>
          <button type="button" onClick={() => printCurrentScreen(`Melisa ERP - ${isOffer ? 'Teklifler' : 'Siparisler'}`)}>Yazdir</button>
          <button type="button" onClick={loadRows}>Yenile</button>
        </div>
      </section>

      <section className="invoice-list-filters">
        <label>
          <span>Arama</span>
          <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Belge no veya cari" />
        </label>
        <label>
          <span>Cari</span>
          <input value={filters.customer} onChange={(event) => updateFilter('customer', event.target.value)} placeholder="Cari adi/kodu" />
        </label>
        <label>
          <span>Durum</span>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="all">Tumu</option>
            <option value="draft">Taslak</option>
            {isOffer ? <option value="sent">Gonderildi</option> : <option value="confirmed">Onayli</option>}
            {isOffer ? <option value="accepted">Kabul</option> : <option value="fulfilled">Tamamlandi</option>}
            <option value="cancelled">Iptal</option>
          </select>
        </label>
        <label>
          <span>Baslangic</span>
          <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
        </label>
        <label>
          <span>Bitis</span>
          <input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
        </label>
      </section>

      <section className="erp-panel invoice-list-panel">
        <div className="panel-title">
          <strong>{isOffer ? 'Teklif Listesi' : 'Siparis Listesi'}</strong>
          <span>Secili: {selectedRow?.documentNo ?? 'yok'}</span>
        </div>
        {isLoading && <div className="list-state">API'den liste yukleniyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && rows.length === 0 && <div className="list-state">Kayit bulunamadi.</div>}
        {!isLoading && !errorMessage && rows.length > 0 && (
          <div className="table-wrap invoice-table-wrap">
            <table className="invoice-list-table">
              <thead>
                <tr>
                  <th>Belge no</th>
                  <th>Tarih</th>
                  <th>Cari</th>
                  <th>Durum</th>
                  <th>PB</th>
                  <th>Toplam</th>
                  <th>TRY</th>
                  <th>Satir</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={row.id === selectedRow?.id ? 'selected-row' : ''}
                    onClick={() => setSelectedId(row.id)}
                    onDoubleClick={() => openDocument(row)}
                  >
                    <td>{row.documentNo}</td>
                    <td>{formatDate(row.documentDate)}</td>
                    <td>{row.customerName}</td>
                    <td><span className={`status-pill status-${String(row.status).toLowerCase()}`}>{STATUS_LABELS[row.status] || row.status}</span></td>
                    <td>{row.documentCurrency}</td>
                    <td>{formatMoney(row.grandTotal, row.documentCurrency)}</td>
                    <td>{formatMoney(row.amountTry, 'TRY')}</td>
                    <td>{row.itemCount}</td>
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
