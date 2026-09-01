import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchVegaCustomerStockExitDocument,
  fetchVegaSalesStockExits,
} from '../../services/movementApi.js';
import { apiConfig } from '../../config/apiConfig.js';
import { exportRowsToExcel, printRowsReport } from '../../utils/exportUtils.js';

function localIsoDate(value = new Date()) {
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
}

function lastSevenDays() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  from.setDate(from.getDate() - 6);
  return { dateFrom: localIsoDate(from), dateTo: localIsoDate(today) };
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '-';
}

function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

const cashFilters = [
  { code: '', label: 'Tüm Satışlar', detail: 'Seçili tarih aralığı', symbol: '≡', tone: 'all' },
  { code: '2-PEŞİN TL', label: 'Peşin TL', detail: 'Son 7 gün', symbol: '₺', tone: 'try' },
  { code: '1-PEŞİN $', label: 'Peşin USD', detail: 'Son 7 gün', symbol: '$', tone: 'usd' },
  { code: '3-PEŞİN €', label: 'Peşin EUR', detail: 'Son 7 gün', symbol: '€', tone: 'eur' },
];

export function VegaSalesInvoiceListScreen({ onOpenScreen }) {
  const today = useMemo(() => localIsoDate(), []);
  const initialDateFrom = useMemo(() => lastSevenDays().dateFrom, []);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(today);
  const [currency, setCurrency] = useState('ALL');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [cashCustomerCode, setCashCustomerCode] = useState('');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [detailError, setDetailError] = useState('');

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRowId) || null,
    [rows, selectedRowId],
  );
  const isSyntheticDemo = apiConfig.demoMode || meta?.source === 'synthetic-demo-read-only';

  useEffect(() => {
    let mounted = true;
    async function loadRows() {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const response = await fetchVegaSalesStockExits({
          page: 1,
          limit: 500,
          search,
          dateFrom,
          dateTo,
          currency,
          amountMin,
          amountMax,
          customerCode: cashCustomerCode,
        });
        if (!mounted) return;
        const nextRows = response.data || [];
        setRows(nextRows);
        setMeta(response.meta || null);
        setSelectedRowId((current) => (
          nextRows.some((row) => row.id === current) ? current : nextRows[0]?.id || null
        ));
      } catch (error) {
        if (!mounted) return;
        setRows([]);
        setMeta(null);
        setSelectedRowId(null);
        setErrorMessage(error.message || 'Vega satış fişleri okunamadı.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    loadRows();
    return () => { mounted = false; };
  }, [amountMax, amountMin, cashCustomerCode, currency, dateFrom, dateTo, search]);

  useEffect(() => {
    let mounted = true;
    async function loadDetail() {
      if (!selectedRow) {
        setSelectedDetail(null);
        setDetailError('');
        return;
      }
      setIsDetailLoading(true);
      setDetailError('');
      try {
        const response = await fetchVegaCustomerStockExitDocument(selectedRow.customerSourceId, selectedRow.sourceId);
        if (mounted) setSelectedDetail(response.data || null);
      } catch (error) {
        if (mounted) {
          setSelectedDetail(null);
          setDetailError(error.message || 'Stok çıkış fişi içeriği okunamadı.');
        }
      } finally {
        if (mounted) setIsDetailLoading(false);
      }
    }
    loadDetail();
    return () => { mounted = false; };
  }, [selectedRow]);

  function applyCashFilter(item) {
    setCashCustomerCode(item.code);
    setSearch('');
    setCurrency('ALL');
    setAmountMin('');
    setAmountMax('');
    if (item.code) {
      const range = lastSevenDays();
      setDateFrom(range.dateFrom);
      setDateTo(range.dateTo);
    }
  }

  function resetFilters() {
    setSearch('');
    setDateFrom(today);
    setDateTo(today);
    setCurrency('ALL');
    setAmountMin('');
    setAmountMax('');
    setCashCustomerCode('');
  }

  function exportRows() {
    exportRowsToExcel({
      filename: isSyntheticDemo ? 'sentetik-demo-satis-fisleri' : 'vega-satis-fisleri',
      title: isSyntheticDemo ? 'Sentetik Demo Satış Fişleri' : 'Vega Satış Fişleri',
      rows,
      columns: [
        { label: 'Tarih', value: (row) => formatDate(row.documentDate) },
        { label: 'Fiş No', key: 'documentNo' },
        { label: 'Cari Kodu', key: 'customerCode' },
        { label: 'Cari', key: 'customerName' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Toplam', key: 'totalAmount' },
        { label: 'Ürün Satırı', key: 'itemCount' },
        { label: 'Adet', key: 'totalQuantity' },
      ],
    });
  }

  function printRows() {
    printRowsReport({
      title: isSyntheticDemo ? 'Melisa ERP - Sentetik Demo Satış Fişleri' : 'Melisa ERP - Vega Satış Fişleri',
      subtitle: `${dateFrom || '-'} / ${dateTo || '-'} · ${cashCustomerCode || 'Tüm cariler'} · ${rows.length} fiş`,
      rows,
      columns: [
        { label: 'Tarih', value: (row) => formatDate(row.documentDate) },
        { label: 'Fiş No', key: 'documentNo' },
        { label: 'Cari', key: 'customerName' },
        { label: 'PB', key: 'currency' },
        { label: 'Toplam', value: (row) => formatMoney(row.totalAmount, row.currency) },
        { label: 'Satır', key: 'itemCount' },
        { label: 'Adet', key: 'totalQuantity' },
      ],
    });
  }

  return (
    <main className="work-area vega-sales-list-screen">
      <section className="vega-sales-toolbar">
        <div><strong>Satış Fişleri</strong><span>{isSyntheticDemo ? 'Yerel sentetik örnekler · şirket verisi değildir · salt okunur' : 'Vega 2026 stok çıkışları · tüm müşteriler · canlı ve salt okunur'}</span></div>
        <div className="vega-sales-toolbar-actions">
          <button type="button" className="primary" onClick={() => onOpenScreen('sales-invoice')}>+ Yeni Satış Fişi</button>
          <button
            type="button"
            disabled={!selectedRow}
            onClick={() => selectedRow && onOpenScreen('proforma-invoice', {
              sourceId: selectedRow.sourceId,
              customerSourceId: selectedRow.customerSourceId,
              customerCode: selectedRow.customerCode,
              customerName: selectedRow.customerName,
              documentNo: selectedRow.documentNo,
              documentDate: selectedRow.documentDate,
              currency: selectedRow.currency,
              totalAmount: selectedRow.totalAmount,
              tabLabel: `Proforma · ${selectedRow.documentNo}`,
            })}
          >
            Seçili Fişten Proforma
          </button>
          <button type="button" onClick={() => onOpenScreen('fedex-micro-export-demo')}>FedEx Mikro İhracat Demo</button>
          <button type="button" onClick={exportRows} disabled={!rows.length}>Excel</button>
          <button type="button" onClick={printRows} disabled={!rows.length}>Yazdır / PDF</button>
          <button type="button" onClick={resetFilters}>Bugüne Dön</button>
        </div>
      </section>

      <section className="vega-cash-filter-strip" aria-label="Peşin satış filtreleri">
        {cashFilters.map((item) => (
          <button aria-pressed={cashCustomerCode === item.code} className={`vega-cash-filter ${item.tone} ${cashCustomerCode === item.code ? 'active' : ''}`} key={item.tone} onClick={() => applyCashFilter(item)} type="button">
            <span className="vega-cash-filter-symbol">{item.symbol}</span>
            <span><strong>{item.label}</strong><small>{item.detail}</small></span>
          </button>
        ))}
      </section>

      <section className="vega-sales-filters">
        <label className="wide"><span>Fiş / cari / ürün / barkod ara</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Fiş no, cari, stok kodu, ürün veya barkod" /></label>
        <label><span>Başlangıç</span><input type="date" max={dateTo || undefined} value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label><span>Bitiş</span><input type="date" min={dateFrom || undefined} value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        <label><span>Para birimi</span><select value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="ALL">Tümü</option><option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
        <label><span>Min. tutar</span><input min="0" step="0.01" type="number" value={amountMin} onChange={(event) => setAmountMin(event.target.value)} placeholder="0,00" /></label>
        <label><span>Maks. tutar</span><input min={amountMin || '0'} step="0.01" type="number" value={amountMax} onChange={(event) => setAmountMax(event.target.value)} placeholder="Sınırsız" /></label>
        <button type="button" onClick={resetFilters}>Filtreleri Temizle</button>
      </section>

      {isSyntheticDemo && (
        <div className="list-state list-state-info">
          <strong>SENTETİK DEMO</strong> — Bu satış örnekleri gerçek müşteri veya şirket kaydı değildir ve kaydedilmez.
        </div>
      )}

      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
      {meta && Number(meta.total || 0) > rows.length && <div className="list-state list-state-info">İlk {rows.length} fiş gösteriliyor. Daha kesin sonuç için tarih veya arama filtresini daraltın.</div>}

      <section className={`vega-sales-content ${!isLoading && !rows.length ? 'empty' : ''}`}>
        <section className="erp-panel vega-sales-table-panel">
          <div className="panel-title"><strong>Fiş Listesi</strong><span>{isLoading ? (isSyntheticDemo ? 'Sentetik örnekler hazırlanıyor…' : 'Vega okunuyor…') : `${meta?.total ?? rows.length} fiş · yeniden eskiye`}</span></div>
          {isLoading && <div className="list-state">{isSyntheticDemo ? 'Yerel sentetik satış fişleri hazırlanıyor...' : 'Tüm satış fişleri Vega’dan okunuyor...'}</div>}
          {!isLoading && !errorMessage && rows.length === 0 && <div className="invoice-list-empty-state"><span className="invoice-list-empty-icon">⌕</span><strong>Bu tarihlerde satış fişi bulunamadı</strong><p>Tarih aralığını değiştirin veya Tüm Satışlar düğmesine basın.</p></div>}
          {!isLoading && rows.length > 0 && (
            <div className="table-shell vega-sales-table-shell">
              <table className="erp-table vega-sales-table">
                <thead><tr><th>Tarih</th><th>Fiş No</th><th>Cari Kodu</th><th>Cari</th><th>Satır</th><th>Adet</th><th>PB</th><th>Toplam</th><th>Durum</th></tr></thead>
                <tbody>{rows.map((row) => (
                  <tr className={selectedRowId === row.id ? 'selected' : ''} key={row.id} onClick={() => setSelectedRowId(row.id)}>
                    <td>{formatDate(row.documentDate)}</td>
                    <td><button type="button" className="vega-sales-document-link" onClick={() => setSelectedRowId(row.id)}>{row.documentNo || '-'}</button></td>
                    <td className="code-cell">{row.customerCode || '-'}</td><td>{row.customerName || '-'}</td><td>{row.itemCount}</td><td>{formatNumber(row.totalQuantity)}</td>
                    <td><span className={`vega-currency-pill ${String(row.currency || '').toLowerCase()}`}>{row.currency}</span></td>
                    <td className="money-cell">{formatMoney(row.totalAmount, row.currency)}</td><td><span className="status-pill success">Kesinleşti</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>

        {rows.length > 0 && (
          <aside className="erp-panel vega-sales-preview">
            <div className="panel-title"><strong>Fiş İçeriği</strong><span>Bu ekranda açılır</span></div>
            {!selectedRow && <div className="list-state">İçeriği görmek için bir fiş seçin.</div>}
            {selectedRow && <>
              <header className="vega-sales-preview-head">
                <div><span>Fiş</span><strong>{selectedRow.documentNo}</strong><small>{formatDate(selectedRow.documentDate)}</small></div>
                <div><span>Cari</span><strong>{selectedRow.customerName}</strong><small>{selectedRow.customerCode}</small></div>
                <div><span>Toplam</span><strong>{formatMoney(selectedRow.totalAmount, selectedRow.currency)}</strong><small>{selectedRow.currency} · Kur {formatNumber(selectedRow.exchangeRate)}</small></div>
              </header>
              {isDetailLoading && <div className="list-state">{isSyntheticDemo ? 'Sentetik fiş satırları hazırlanıyor...' : 'Fiş satırları Vega’dan okunuyor...'}</div>}
              {detailError && <div className="list-state list-state-error">{detailError}</div>}
              {selectedDetail && <>
                <div className="vega-sales-preview-summary"><span><strong>{selectedDetail.lineCount}</strong> ürün satırı</span><span><strong>{formatNumber(selectedDetail.totalQuantity)}</strong> adet</span><span><strong>{formatMoney(selectedDetail.totalAmount, selectedDetail.currency)}</strong> fiş toplamı</span></div>
                <div className="table-shell vega-sales-preview-lines"><table className="erp-table"><thead><tr><th>Stok Kodu</th><th>Ürün</th><th>Barkod</th><th>Miktar</th><th>Birim Fiyat</th><th>Toplam</th></tr></thead><tbody>{selectedDetail.lines.map((line) => <tr key={line.id}><td className="code-cell">{line.stockCode}</td><td>{line.productName}</td><td>{line.barcode || '-'}</td><td>{formatNumber(line.quantity)} {line.unitName}</td><td>{formatMoney(line.unitPrice, line.currency)}</td><td className="money-cell">{formatMoney(line.lineTotal, line.currency)}</td></tr>)}</tbody></table></div>
              </>}
            </>}
          </aside>
        )}
      </section>

      <footer className="vega-sales-status"><span>Kaynak: {isSyntheticDemo ? 'Yerel sentetik örnek — şirket verisi değildir' : 'Vega F0102 / D0007'}</span><span>{dateFrom || '-'} — {dateTo || '-'}</span><span>{cashCustomerCode || 'Tüm cariler'}</span><strong>{meta?.total ?? rows.length} fiş</strong></footer>
    </main>
  );
}
