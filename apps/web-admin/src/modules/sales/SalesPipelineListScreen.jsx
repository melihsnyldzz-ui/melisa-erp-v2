import React, { useEffect, useMemo, useState } from 'react';
import { fetchSalesOffers, fetchSalesOrders } from '../../services/salesPipelineApi.js';
import { exportRowsToCsv, printCurrentScreen } from '../../utils/exportUtils.js';

const STATUS_LABELS = {
  DRAFT: 'Taslak',
  SENT: 'Gönderildi',
  ACCEPTED: 'Kabul',
  CONFIRMED: 'Onaylı',
  FULFILLED: 'Tamamlandı',
  CANCELLED: 'İptal',
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
  const hasPartialList = Number(meta?.total || 0) > rows.length;

  async function loadRows() {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const loader = isOffer ? fetchSalesOffers : fetchSalesOrders;
      const response = await loader({ page: 1, limit: 100, ...filters });
      setRows(response.data || []);
      setMeta(response.meta || null);
      setSelectedId((current) => (
        (response.data || []).some((row) => row.id === current) ? current : response.data?.[0]?.id ?? null
      ));
    } catch (error) {
      setRows([]);
      setMeta(null);
      setSelectedId(null);
      setErrorMessage(error.message || 'Liste API bağlantısı başarısız.');
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
          setSelectedId((current) => (
            (response.data || []).some((row) => row.id === current) ? current : response.data?.[0]?.id ?? null
          ));
        }
      } catch (error) {
        if (isMounted) {
          setRows([]);
          setMeta(null);
          setSelectedId(null);
          setErrorMessage(error.message || 'Liste API bağlantısı başarısız.');
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
      setErrorMessage('Açacak kayıt seçin.');
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
        { label: 'Satır', key: 'itemCount' },
      ],
    });
  }

  return (
    <main className="work-area invoice-list-screen">
      <section className="invoice-list-toolbar">
        <div className="invoice-list-title">
          <strong>{isOffer ? 'Teklifler' : 'Siparişler'}</strong>
          <span>Gerçek API listesi / Satır: {meta?.total ?? rows.length}</span>
        </div>
        <div className="invoice-list-actions">
          <button type="button" onClick={() => onOpenScreen(isOffer ? 'sales-offer' : 'sales-order')}>Yeni</button>
          <button type="button" onClick={() => openDocument()}>Aç</button>
          <button type="button" onClick={exportRows}>Excel</button>
          <button type="button" onClick={() => printCurrentScreen(`Melisa ERP - ${isOffer ? 'Teklifler' : 'Siparişler'}`)}>Yazdır</button>
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
          <input value={filters.customer} onChange={(event) => updateFilter('customer', event.target.value)} placeholder="Cari adı/kodu" />
        </label>
        <label>
          <span>Durum</span>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="all">Tümü</option>
            <option value="draft">Taslak</option>
            {isOffer ? <option value="sent">Gönderildi</option> : <option value="confirmed">Onaylı</option>}
            {isOffer ? <option value="accepted">Kabul</option> : <option value="fulfilled">Tamamlandı</option>}
            <option value="cancelled">İptal</option>
          </select>
        </label>
        <label>
          <span>Başlangıç</span>
          <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
        </label>
        <label>
          <span>Bitiş</span>
          <input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
        </label>
      </section>

      <section className="erp-panel invoice-list-panel">
        <div className="panel-title">
          <strong>{isOffer ? 'Teklif Listesi' : 'Sipariş Listesi'}</strong>
          <span>Seçili: {selectedRow?.documentNo ?? 'yok'}</span>
        </div>
        {isLoading && <div className="list-state">API'den liste yükleniyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage} Demo fallback kullanılmadı.</div>}
        {!isLoading && !errorMessage && hasPartialList && (
          <div className="list-state list-state-info">
            Liste API'den gelen ilk {rows.length} belgeyi gösteriyor. Daha kesin sonuç için belge no, cari, durum veya tarih filtresiyle aramayı daraltın.
          </div>
        )}
        {!isLoading && !errorMessage && rows.length === 0 && (
          <div className="list-state">Kayıt bulunamadı; filtreleri temizleyip tekrar deneyin.</div>
        )}
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
                  <th>Satır</th>
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
