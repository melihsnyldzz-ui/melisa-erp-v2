import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchVegaSupplierMovements,
  fetchVegaSupplierPurchaseDocument,
  fetchVegaSupplierPurchaseIntelligence,
} from '../../services/movementApi.js';
import { exportRowsToCsv, printRowsReport } from '../../utils/exportUtils.js';
import '../../styles/supplier-purchase-intelligence.css';

const movementFilters = [
  { value: '', label: 'Tüm Hareketler' },
  { value: 'purchase_invoice', label: 'Alış Faturaları' },
  { value: 'supplier_payment', label: 'Cari Çıkışlar' },
  { value: 'supplier_entry', label: 'Cari Girişler' },
  { value: 'stock_entry', label: 'Stok Girişleri' },
  { value: 'opening_transfer', label: 'Devir' },
];

function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('tr-TR').format(new Date(value));
}

function formatPercent(value) {
  return `%${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value || 0))}`;
}

export function VegaSupplierMovementsScreen({ supplierSourceId, supplierCode, supplierName, supplierCurrency }) {
  const [filters, setFilters] = useState({ search: '', dateFrom: '', dateTo: '', movementType: '' });
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [documentDetail, setDocumentDetail] = useState(null);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentError, setDocumentError] = useState('');
  const [purchaseIntelligence, setPurchaseIntelligence] = useState(null);
  const [purchaseIntelligenceLoading, setPurchaseIntelligenceLoading] = useState(true);
  const [purchaseIntelligenceError, setPurchaseIntelligenceError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!supplierSourceId) {
        setRows([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setErrorMessage('');
      try {
        const response = await fetchVegaSupplierMovements(supplierSourceId, {
          page: 1,
          limit: 500,
          search: filters.search,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
        });
        if (mounted) {
          setRows(response.data || []);
          setMeta(response.meta || null);
        }
      } catch (error) {
        if (mounted) {
          setRows([]);
          setMeta(null);
          setErrorMessage(error.message || 'Vega tedarikçi hareketleri okunamadı.');
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [supplierSourceId, filters.search, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    let mounted = true;
    async function loadPurchaseIntelligence() {
      if (!supplierSourceId) {
        setPurchaseIntelligence(null);
        setPurchaseIntelligenceLoading(false);
        return;
      }
      setPurchaseIntelligenceLoading(true);
      setPurchaseIntelligenceError('');
      try {
        const response = await fetchVegaSupplierPurchaseIntelligence(supplierSourceId, {
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          limit: 200,
        });
        if (mounted) setPurchaseIntelligence(response.data || null);
      } catch (error) {
        if (mounted) {
          setPurchaseIntelligence(null);
          setPurchaseIntelligenceError(error.message || 'Ürün ve alış fiyatı bağlamı okunamadı.');
        }
      } finally {
        if (mounted) setPurchaseIntelligenceLoading(false);
      }
    }
    loadPurchaseIntelligence();
    return () => { mounted = false; };
  }, [supplierSourceId, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    if (!selectedRow) return undefined;
    function onKeyDown(event) { if (event.key === 'Escape') setSelectedRow(null); }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedRow]);

  const visibleRows = useMemo(() => (
    filters.movementType ? rows.filter((row) => row.movementType === filters.movementType) : rows
  ), [filters.movementType, rows]);
  const currency = rows[0]?.currency || supplierCurrency || 'TRY';
  const totals = useMemo(() => ({
    debit: rows.reduce((sum, row) => sum + Number(row.debit || 0), 0),
    credit: rows.reduce((sum, row) => sum + Number(row.credit || 0), 0),
    balance: Number(rows.at(-1)?.runningBalance || 0),
  }), [rows]);

  function updateFilter(key, value) { setFilters((current) => ({ ...current, [key]: value })); }
  function resetFilters() { setFilters({ search: '', dateFrom: '', dateTo: '', movementType: '' }); }

  async function openDocument(row) {
    if (row.movementType !== 'purchase_invoice') return;
    setSelectedRow(row);
    setDocumentDetail(null);
    setDocumentError('');
    setDocumentLoading(true);
    try {
      const response = await fetchVegaSupplierPurchaseDocument(supplierSourceId, row.sourceId);
      setDocumentDetail(response.data);
    } catch (error) {
      setDocumentError(error.message || 'Alış faturası içeriği okunamadı.');
    } finally {
      setDocumentLoading(false);
    }
  }

  function exportRows() {
    exportRowsToCsv({
      filename: `${supplierCode || 'tedarikci'}-vega-hareketleri`,
      rows: visibleRows,
      columns: [
        { label: 'Tarih', value: (row) => formatDate(row.documentDate) },
        { label: 'İzahat', key: 'movementLabel' },
        { label: 'Evrak No', key: 'documentNo' },
        { label: 'Borç', key: 'debit' },
        { label: 'Alacak', key: 'credit' },
        { label: 'Bakiye', key: 'runningBalance' },
        { label: 'Para Birimi', key: 'currency' },
      ],
    });
  }

  function printRows() {
    printRowsReport({
      title: `${supplierName || supplierCode || 'Tedarikçi'} - Vega Cari Hareketleri`,
      subtitle: `${visibleRows.length} hareket / Güncel bakiye: ${formatMoney(totals.balance, currency)}`,
      rows: visibleRows,
      columns: [
        { label: 'Tarih', value: (row) => formatDate(row.documentDate) },
        { label: 'İzahat', key: 'movementLabel' },
        { label: 'Evrak No', key: 'documentNo' },
        { label: 'Borç', value: (row) => row.debit ? formatMoney(row.debit, row.currency) : '-' },
        { label: 'Alacak', value: (row) => row.credit ? formatMoney(row.credit, row.currency) : '-' },
        { label: 'Bakiye', value: (row) => formatMoney(row.runningBalance, row.currency) },
      ],
    });
  }

  return (
    <main className="work-area customer-ledger-screen koli-ledger-screen supplier-ledger-screen supplier-movements-workspace vega-supplier-ledger-screen">
      <section className="erp-panel supplier-movement-header vega-supplier-movement-header">
        <div className="supplier-movement-title-row">
          <div>
            <strong>{supplierName ? `${supplierName} Tedarikçi Hareketleri` : 'Vega Tedarikçi Hareketleri'}</strong>
            <span>Vega F0103 · 2026 canlı · salt okunur · Kod: {supplierCode || '-'} · {meta?.total ?? rows.length} hareket</span>
          </div>
          <div className="supplier-movement-actions">
            <button type="button" onClick={exportRows}>CSV indir</button>
            <button type="button" onClick={printRows}>Yazdır / PDF</button>
          </div>
        </div>

        <div className="supplier-movement-tabs vega-supplier-movement-tabs" aria-label="Hareket türü">
          {movementFilters.map((option) => (
            <button type="button" key={option.value || 'all'} className={filters.movementType === option.value ? 'pressed' : ''} onClick={() => updateFilter('movementType', option.value)}>{option.label}</button>
          ))}
        </div>

        <div className="vega-supplier-filter-line">
          <label className="supplier-movement-search">
            <span className="vega-supplier-field-label">Evrak ara</span>
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Belge numarası yazın (örn. A0000861)" aria-label="Evrak ara" />
          </label>
          <label className="vega-supplier-date-field"><span>Başlangıç</span><input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} /></label>
          <label className="vega-supplier-date-field"><span>Bitiş</span><input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} /></label>
          <button type="button" className="ghost-button vega-supplier-clear" onClick={resetFilters}>Filtreleri temizle</button>
        </div>
      </section>

      <section className="supplier-movement-summary" aria-label="Tedarikçi hareket özeti">
        <article><span>Toplam borç</span><strong className="ledger-out">{formatMoney(totals.debit, currency)}</strong><small>Cari çıkış ve borç hareketleri</small></article>
        <article><span>Toplam alacak</span><strong className="ledger-in">{formatMoney(totals.credit, currency)}</strong><small>Alış faturaları ve cari girişler</small></article>
        <article><span>Güncel bakiye</span><strong className={totals.balance < 0 ? 'ledger-in' : 'ledger-out'}>{formatMoney(Math.abs(totals.balance), currency)}</strong><small>{totals.balance < 0 ? 'Tedarikçiye borç' : totals.balance > 0 ? 'Tedarikçiden alacak' : 'Bakiye kapalı'}</small></article>
        <article><span>Görünen hareket</span><strong>{visibleRows.length}</strong><small>Toplam {meta?.total ?? rows.length} kayıt</small></article>
      </section>

      <section className="erp-panel supplier-purchase-intelligence-panel" aria-label="Tedarikçi ürün ve alış fiyatı bağlamı">
        <div className="panel-title supplier-purchase-intelligence-title">
          <div>
            <strong>Ürün ve alış fiyatı bağlamı</strong>
            <span>Genel URUN satırları model kodu ve tedarikçi markasıyla gerçek stok kartlarına bağlanır.</span>
          </div>
          {purchaseIntelligence?.brandContext?.selectedBrand && (
            <span className="status-pill">Marka bağlamı: {purchaseIntelligence.brandContext.selectedBrand}</span>
          )}
        </div>

        {purchaseIntelligenceLoading && <div className="list-state">Ürün eşleşmeleri ve net alış fiyatları hesaplanıyor...</div>}
        {!purchaseIntelligenceLoading && purchaseIntelligenceError && <div className="list-state list-state-error">{purchaseIntelligenceError}</div>}
        {!purchaseIntelligenceLoading && !purchaseIntelligenceError && purchaseIntelligence && (
          <>
            <div className="supplier-purchase-intelligence-summary">
              <article><span>Eşleşen ürün</span><strong>{purchaseIntelligence.summary.matchedProductCount}</strong><small>Gerçek stok kartı</small></article>
              <article><span>Model eşleşmesi</span><strong>{formatPercent(purchaseIntelligence.summary.strongGenericModelMatchRate)}</strong><small>{purchaseIntelligence.summary.stronglyMatchedGenericModelCount} / {purchaseIntelligence.summary.distinctGenericModelCount} model</small></article>
              <article><span>Efektif iskonto</span><strong>{formatPercent(purchaseIntelligence.summary.weightedEffectiveDiscountRate)}</strong><small>Brüt ve net tutardan ağırlıklı</small></article>
              <article><span>Bağlanmayan satır</span><strong>{purchaseIntelligence.summary.reviewLineCount + purchaseIntelligence.summary.ambiguousLineCount + purchaseIntelligence.summary.unmatchedLineCount + purchaseIntelligence.summary.ignoredLineCount}</strong><small>İnceleme veya genel değer</small></article>
            </div>

            {purchaseIntelligence.products.length === 0 ? (
              <div className="list-state">Bu tarih aralığında eşleşen ürün alış kaydı bulunamadı.</div>
            ) : (
              <div className="table-shell supplier-purchase-intelligence-table-shell">
                <table className="erp-table supplier-purchase-intelligence-table">
                  <thead>
                    <tr><th>Stok kodu</th><th>Ürün</th><th>Son alış</th><th>Brüt birim</th><th>Efektif iskonto</th><th>Net birim</th><th>Ağırlıklı net</th><th>Toplam adet</th><th>Fiş</th><th>Güven</th></tr>
                  </thead>
                  <tbody>
                    {purchaseIntelligence.products.map((product) => (
                      <tr key={`${product.productSourceId}-${product.currency}`}>
                        <td><strong>{product.stockCode}</strong><small>{product.brand || '-'}</small></td>
                        <td>{product.productName || '-'}</td>
                        <td><strong>{formatDate(product.lastPurchaseDate)}</strong><small>{product.lastDocumentNo || '-'}</small></td>
                        <td>{formatMoney(product.lastGrossUnitPrice, product.currency)}</td>
                        <td><span className="supplier-effective-discount">{formatPercent(product.lastEffectiveDiscountRate)}</span><small>{product.discountSource === 'gross-net-derived' ? 'brüt-net farkı' : 'iskonto alanları'}</small></td>
                        <td><strong>{formatMoney(product.lastNetUnitPrice, product.currency)}</strong></td>
                        <td>{formatMoney(product.weightedNetUnitPrice, product.currency)}</td>
                        <td>{new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(product.totalQuantity)}</td>
                        <td>{product.purchaseInvoiceCount}</td>
                        <td><span className="status-pill">%{product.matchConfidence}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {purchaseIntelligence.review.length > 0 && (
              <div className="supplier-purchase-review-note">
                <strong>{purchaseIntelligence.review.length} satır otomatik bağlanmadı.</strong>
                <span>KDV, URUN, KUTU gibi genel değerler ve birden fazla ürün adayı bulunan kodlar manuel incelemeye bırakıldı.</span>
              </div>
            )}
          </>
        )}
      </section>

      <section className="erp-panel supplier-movement-table-panel vega-supplier-movement-table-panel">
        <div className="panel-title"><strong>Cari Hareketleri</strong><span>Eski tarihten yeni tarihe yürüyen bakiye</span></div>
        {isLoading && <div className="list-state">Tedarikçi hareketleri Vega'dan okunuyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && visibleRows.length === 0 && <div className="list-state">Filtreye uygun hareket bulunamadı.</div>}
        {!isLoading && !errorMessage && visibleRows.length > 0 && (
          <div className="table-shell ledger-table-shell supplier-movement-table-shell vega-supplier-movement-table-shell">
            <table className="erp-table supplier-movement-table vega-supplier-movement-table">
              <thead><tr><th>Tarih</th><th>İzahat</th><th>Evrak No</th><th>Borç</th><th>Alacak</th><th>Bakiye</th><th>PB</th><th>Kur</th></tr></thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.documentDate)}</td>
                    <td><span className="status-pill">{row.movementLabel}</span></td>
                    <td>{row.movementType === 'purchase_invoice' ? <button type="button" className="koli-document-button" onClick={() => openDocument(row)}><span>{row.documentNo || '-'}</span><span aria-hidden="true">↗</span></button> : (row.documentNo || '-')}</td>
                    <td className="ledger-out">{row.debit ? formatMoney(row.debit, row.currency) : '-'}</td>
                    <td className="ledger-in">{row.credit ? formatMoney(row.credit, row.currency) : '-'}</td>
                    <td className={row.runningBalance < 0 ? 'ledger-in' : 'ledger-out'}><strong>{formatMoney(Math.abs(row.runningBalance), row.currency)} {row.runningBalance < 0 ? '(B)' : row.runningBalance > 0 ? '(A)' : ''}</strong></td>
                    <td>{row.currency}</td>
                    <td>{new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 }).format(row.exchangeRate)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="koli-ledger-end-row"><td colSpan="8">Liste sonu · {visibleRows.length} hareketin tamamı gösterildi</td></tr></tfoot>
            </table>
          </div>
        )}
      </section>

      {selectedRow && (
        <div className="koli-document-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRow(null); }}>
          <section className="koli-document-modal" role="dialog" aria-modal="true" aria-labelledby="vega-purchase-document-title">
            <header className="koli-document-modal-header">
              <div><strong id="vega-purchase-document-title">Alış Faturası · {selectedRow.documentNo || '-'}</strong><span>{supplierCode || '-'} · {supplierName || 'Tedarikçi'} · {formatDate(selectedRow.documentDate)}</span></div>
              <div className="koli-document-modal-header-actions"><span>Vega canlı · salt okunur</span><button type="button" aria-label="Fiş penceresini kapat" onClick={() => setSelectedRow(null)}>×</button></div>
            </header>
            <div className="koli-document-modal-body">
              {documentLoading && <div className="koli-document-state">Alış faturası Vega'dan okunuyor...</div>}
              {documentError && <div className="koli-document-state error">{documentError}</div>}
              {documentDetail && (
                <div className="koli-document-detail">
                  <div className="koli-document-summary"><strong>{documentDetail.lineCount} ürün satırı</strong><span>{new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(documentDetail.totalQuantity)} adet</span><span>Fiş toplamı {formatMoney(documentDetail.totalAmount, documentDetail.currency)}</span></div>
                  <div className="koli-document-lines-shell">
                    <table className="koli-document-lines">
                      <thead><tr><th>#</th><th>Stok kodu</th><th>Ürün adı</th><th>Barkod</th><th>Miktar</th><th>Birim</th><th>Birim fiyat</th><th>Satır toplamı</th></tr></thead>
                      <tbody>{documentDetail.lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td><strong>{line.stockCode || '-'}</strong></td><td>{line.productName || '-'}</td><td>{line.barcode || '-'}</td><td>{new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(line.quantity)}</td><td>{line.unitName || '-'}</td><td>{formatMoney(line.unitPrice, line.currency)}</td><td><strong>{formatMoney(line.lineTotal, line.currency)}</strong></td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <footer className="koli-document-modal-footer"><span>Esc tuşuyla da kapatabilirsiniz.</span><button type="button" onClick={() => setSelectedRow(null)}>Kapat</button></footer>
          </section>
        </div>
      )}
    </main>
  );
}
