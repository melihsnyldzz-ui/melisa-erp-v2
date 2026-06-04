import React, { useEffect, useMemo, useState } from 'react';
import { fetchStockMovements } from '../../services/movementApi.js';
import { exportRowsToExcel, printRowsReport } from '../../utils/exportUtils.js';

function formatNumber(value) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function sourceLabel(sourceType) {
  const labels = {
    sales_invoice: 'Satış fişi',
    purchase_invoice: 'Alış fişi',
    adjustment: 'Stok düzeltme',
  };

  return labels[sourceType] || sourceType || '-';
}

function movementTypeLabel(value) {
  const labels = {
    in: 'Giriş',
    out: 'Çıkış',
    cancel: 'İptal',
  };

  return labels[value] || 'Tüm hareketler';
}

function movementTone(row) {
  if (Number(row.quantityIn || 0) > 0) return 'ledger-in';
  if (Number(row.quantityOut || 0) > 0) return 'ledger-out';
  return '';
}

function sourceTone(row) {
  if (row.sourceType === 'purchase_invoice') return 'in-cell';
  if (row.sourceType === 'sales_invoice') return 'out-cell';
  return '';
}

export function StockMovementsScreen({ onOpenScreen }) {
  const [filters, setFilters] = useState({
    search: '',
    movementType: '',
    sourceType: '',
    dateFrom: '',
    dateTo: '',
  });
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const query = useMemo(() => ({
    page: 1,
    limit: 150,
    ...filters,
  }), [filters]);

  useEffect(() => {
    let isMounted = true;

    async function loadRows() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchStockMovements(query);
        if (isMounted) {
          setRows(response.data || []);
          setMeta(response.meta || null);
        }
      } catch (error) {
        if (isMounted) {
          setRows([]);
          setMeta(null);
          setErrorMessage(error.message || 'Stok hareketleri okunamadı.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadRows();

    return () => {
      isMounted = false;
    };
  }, [query]);

  const totals = useMemo(() => rows.reduce((summary, row) => ({
    in: summary.in + Number(row.quantityIn || 0),
    out: summary.out + Number(row.quantityOut || 0),
    net: summary.net + Number(row.quantityNet || 0),
    inValueTry: summary.inValueTry + (Number(row.quantityIn || 0) > 0 ? Number(row.amountTry || 0) : 0),
    outValueTry: summary.outValueTry + (Number(row.quantityOut || 0) > 0 ? Number(row.amountTry || 0) : 0),
  }), { in: 0, out: 0, net: 0, inValueTry: 0, outValueTry: 0 }), [rows]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyQuickFilter(patch) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function resetFilters() {
    setFilters({ search: '', movementType: '', sourceType: '', dateFrom: '', dateTo: '' });
  }

  function openSource(row) {
    if (row.targetScreen && row.targetPayload) {
      onOpenScreen?.(row.targetScreen, row.targetPayload);
    }
  }

  function openProduct(row) {
    if (row.productId) {
      onOpenScreen?.('product-card', {
        productId: row.productId,
        stockCode: row.stockCode,
        tabLabel: row.stockCode ? `Ürün: ${row.stockCode}` : 'Ürün Kartı',
      });
    }
  }

  function openParty(row) {
    if (row.partyTargetScreen && row.partyTargetPayload) {
      onOpenScreen?.(row.partyTargetScreen, row.partyTargetPayload);
    }
  }

  function exportMovementRows() {
    const columns = [
      { label: 'Tarih', key: 'documentDate' },
      { label: 'Kaynak', value: (row) => sourceLabel(row.sourceType) },
      { label: 'Belge No', key: 'sourceDocumentNo' },
      { label: 'Stok Kodu', key: 'stockCode' },
      { label: 'Ürün', key: 'productName' },
      { label: 'Giriş', key: 'quantityIn' },
      { label: 'Çıkış', key: 'quantityOut' },
      { label: 'Net', key: 'quantityNet' },
      { label: 'Maliyet TRY', key: 'unitCostTry' },
      { label: 'Tutar TRY', key: 'amountTry' },
      { label: 'Müşteri/Tedarikçi', value: (row) => row.customerName || row.supplierName || '-' },
    ];
    exportRowsToExcel({
      filename: 'stok-hareketleri',
      title: 'Stok Hareketleri',
      rows,
      columns,
    });
  }

  function printMovementRows() {
    printRowsReport({
      title: 'Melisa ERP - Stok Hareketleri',
      subtitle: `${rows.length} hareket / giriş ${formatNumber(totals.in)} / çıkış ${formatNumber(totals.out)} / net ${formatNumber(totals.net)}`,
      rows,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Kaynak', value: (row) => sourceLabel(row.sourceType) },
        { label: 'Belge No', key: 'sourceDocumentNo' },
        { label: 'Stok Kodu', key: 'stockCode' },
        { label: 'Ürün', key: 'productName' },
        { label: 'Giriş', key: 'quantityIn' },
        { label: 'Çıkış', key: 'quantityOut' },
        { label: 'Net', key: 'quantityNet' },
        { label: 'Tutar TRY', key: 'amountTry' },
        { label: 'Cari', value: (row) => row.customerName || row.supplierName || '-' },
      ],
    });
  }

  return (
    <main className="work-area stock-movements-screen">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Stok Hareketleri</strong>
          <span>Alış girişleri, satış çıkışları, stok düzeltmeleri / Satır: {meta?.total ?? rows.length}</span>
        </div>
        <div className="movement-quick-filters">
          <button type="button" className={!filters.movementType && !filters.sourceType ? 'pressed' : ''} onClick={resetFilters}>Tüm Hareketler</button>
          <button type="button" className={filters.movementType === 'in' ? 'pressed in' : 'in'} onClick={() => applyQuickFilter({ movementType: 'in', sourceType: '' })}>Girişler</button>
          <button type="button" className={filters.movementType === 'out' ? 'pressed out' : 'out'} onClick={() => applyQuickFilter({ movementType: 'out', sourceType: '' })}>Çıkışlar</button>
          <button type="button" className={filters.sourceType === 'purchase_invoice' ? 'pressed in' : 'in'} onClick={() => applyQuickFilter({ sourceType: 'purchase_invoice', movementType: '' })}>Alış Fişleri</button>
          <button type="button" className={filters.sourceType === 'sales_invoice' ? 'pressed out' : 'out'} onClick={() => applyQuickFilter({ sourceType: 'sales_invoice', movementType: '' })}>Satış Fişleri</button>
        </div>
        <div className="filter-grid">
          <label>
            Arama
            <input
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Stok kodu, barkod, ürün, müşteri, tedarikçi"
            />
          </label>
          <label>
            Hareket
            <select value={filters.movementType} onChange={(event) => updateFilter('movementType', event.target.value)}>
              <option value="">Tüm hareketler</option>
              <option value="in">Giriş</option>
              <option value="out">Çıkış</option>
              <option value="cancel">İptal</option>
            </select>
          </label>
          <label>
            Kaynak
            <select value={filters.sourceType} onChange={(event) => updateFilter('sourceType', event.target.value)}>
              <option value="">Tüm kaynaklar</option>
              <option value="sales_invoice">Satış fişi</option>
              <option value="purchase_invoice">Alış fişi</option>
              <option value="adjustment">Stok düzeltme</option>
            </select>
          </label>
          <label>
            Başlangıç
            <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
          </label>
          <label>
            Bitiş
            <input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
          </label>
          <button type="button" className="ghost-button" onClick={resetFilters}>Temizle</button>
          <button type="button" onClick={exportMovementRows}>Excel</button>
          <button type="button" onClick={printMovementRows}>Yazdır</button>
        </div>
      </section>

      <section className="summary-strip">
        <article className="summary-card">
          <span>Toplam giriş</span>
          <strong className="ledger-in">+{formatNumber(totals.in)}</strong>
          <small>{formatMoney(totals.inValueTry, 'TRY')}</small>
        </article>
        <article className="summary-card">
          <span>Toplam çıkış</span>
          <strong className="ledger-out">-{formatNumber(totals.out)}</strong>
          <small>{formatMoney(totals.outValueTry, 'TRY')}</small>
        </article>
        <article className="summary-card">
          <span>Net stok etkisi</span>
          <strong className={totals.net < 0 ? 'ledger-out' : 'ledger-in'}>{formatNumber(totals.net)}</strong>
          <small>{movementTypeLabel(filters.movementType)} / {sourceLabel(filters.sourceType)}</small>
        </article>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Hareket Satırları</strong>
          <span>Yeşil giriş, kırmızı çıkış; belge no fişe, stok kodu ürün kartına götürür</span>
        </div>
        {isLoading && <div className="list-state">Stok hareketleri yükleniyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && rows.length === 0 && <div className="list-state">Hareket bulunamadı.</div>}
        {!isLoading && !errorMessage && rows.length > 0 && (
          <div className="table-shell stock-movement-table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Kaynak</th>
                  <th>Belge No</th>
                  <th>Stok Kodu</th>
                  <th>Ürün</th>
                  <th>Giriş</th>
                  <th>Çıkış</th>
                  <th>Net</th>
                  <th>Maliyet TRY</th>
                  <th>Tutar TRY</th>
                  <th>Cari</th>
                  <th>Git</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="clickable-row" key={row.id} onClick={() => openSource(row)}>
                    <td>{row.documentDate || '-'}</td>
                    <td><span className={`movement-source-pill ${sourceTone(row)}`}>{sourceLabel(row.sourceType)}</span></td>
                    <td>
                      <button type="button" className="link-button" onClick={(event) => { event.stopPropagation(); openSource(row); }}>
                        {row.sourceDocumentNo || '-'}
                      </button>
                    </td>
                    <td>
                      <button type="button" className="link-button" onClick={(event) => { event.stopPropagation(); openProduct(row); }}>
                        {row.stockCode || '-'}
                      </button>
                    </td>
                    <td>{row.productName || '-'}</td>
                    <td className="ledger-in">{Number(row.quantityIn || 0) > 0 ? formatNumber(row.quantityIn) : '-'}</td>
                    <td className="ledger-out">{Number(row.quantityOut || 0) > 0 ? formatNumber(row.quantityOut) : '-'}</td>
                    <td className={movementTone(row)}>{formatNumber(row.quantityNet)}</td>
                    <td>{formatMoney(row.unitCostTry, 'TRY')}</td>
                    <td>{formatMoney(row.amountTry, 'TRY')}</td>
                    <td>
                      {(row.customerName || row.supplierName) ? (
                        <button type="button" className="link-button" onClick={(event) => { event.stopPropagation(); openParty(row); }}>
                          {row.customerName || row.supplierName}
                        </button>
                      ) : '-'}
                    </td>
                    <td>
                      <button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); openSource(row); }}>Fişe Git</button>
                    </td>
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
