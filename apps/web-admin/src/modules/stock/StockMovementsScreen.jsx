import React, { useEffect, useMemo, useState } from 'react';
import { fetchStockMovements } from '../../services/movementApi.js';
import { exportRowsToCsv, printCurrentScreen } from '../../utils/exportUtils.js';

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
    sales_invoice: 'Satis fisi',
    purchase_invoice: 'Alis fisi',
    adjustment: 'Stok duzeltme',
  };

  return labels[sourceType] || sourceType || '-';
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
    limit: 100,
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
          setErrorMessage(error.message || 'Stok hareketleri okunamadi.');
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

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters({ search: '', movementType: '', sourceType: '', dateFrom: '', dateTo: '' });
  }

  function openSource(row) {
    if (row.sourceType === 'sales_invoice' && row.sourceId) {
      onOpenScreen('sales-invoice', { salesDraftId: row.sourceId });
      return;
    }

    if (row.sourceType === 'purchase_invoice' && row.sourceId) {
      onOpenScreen('purchase-invoice', { purchaseDraftId: row.sourceId });
    }
  }

  function exportMovementRows() {
    exportRowsToCsv({
      filename: 'stok-hareketleri',
      rows,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Kaynak', value: (row) => sourceLabel(row.sourceType) },
        { label: 'Belge No', key: 'sourceDocumentNo' },
        { label: 'Stok Kodu', key: 'stockCode' },
        { label: 'Urun', key: 'productName' },
        { label: 'Giris', key: 'quantityIn' },
        { label: 'Cikis', key: 'quantityOut' },
        { label: 'Net', key: 'quantityNet' },
        { label: 'Maliyet TRY', key: 'unitCostTry' },
        { label: 'Tutar TRY', key: 'amountTry' },
        { label: 'Cari/Tedarikci', value: (row) => row.customerName || row.supplierName || '-' },
      ],
    });
  }

  const totals = rows.reduce((summary, row) => ({
    in: summary.in + Number(row.quantityIn || 0),
    out: summary.out + Number(row.quantityOut || 0),
    net: summary.net + Number(row.quantityNet || 0),
  }), { in: 0, out: 0, net: 0 });

  return (
    <main className="work-area">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Stok Hareketleri</strong>
          <span>Gercek stok hareket defteri / Satir: {meta?.total ?? rows.length}</span>
        </div>
        <div className="filter-grid">
          <label>
            Arama
            <input
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Stok kodu, barkod, urun, cari"
            />
          </label>
          <label>
            Hareket
            <select value={filters.movementType} onChange={(event) => updateFilter('movementType', event.target.value)}>
              <option value="">Tum hareketler</option>
              <option value="in">Giris</option>
              <option value="out">Cikis</option>
              <option value="cancel">Iptal</option>
            </select>
          </label>
          <label>
            Kaynak
            <select value={filters.sourceType} onChange={(event) => updateFilter('sourceType', event.target.value)}>
              <option value="">Tum kaynaklar</option>
              <option value="sales_invoice">Satis fisi</option>
              <option value="purchase_invoice">Alis fisi</option>
              <option value="adjustment">Stok duzeltme</option>
            </select>
          </label>
          <label>
            Baslangic
            <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
          </label>
          <label>
            Bitis
            <input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
          </label>
          <button type="button" className="ghost-button" onClick={resetFilters}>Temizle</button>
          <button type="button" onClick={exportMovementRows}>Excel</button>
          <button type="button" onClick={() => printCurrentScreen('Melisa ERP - Stok Hareketleri')}>Yazdir</button>
        </div>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Hareket Satirlari</strong>
          <span>Giris: {formatNumber(totals.in)} / Cikis: {formatNumber(totals.out)} / Net: {formatNumber(totals.net)}</span>
        </div>
        {isLoading && <div className="list-state">Stok hareketleri yukleniyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && rows.length === 0 && <div className="list-state">Hareket bulunamadi.</div>}
        {!isLoading && !errorMessage && rows.length > 0 && (
          <div className="table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Kaynak</th>
                  <th>Belge No</th>
                  <th>Stok Kodu</th>
                  <th>Urun</th>
                  <th>Giris</th>
                  <th>Cikis</th>
                  <th>Net</th>
                  <th>Maliyet TRY</th>
                  <th>Tutar TRY</th>
                  <th>Cari</th>
                  <th>Islem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.documentDate || '-'}</td>
                    <td>{sourceLabel(row.sourceType)}</td>
                    <td>{row.sourceDocumentNo}</td>
                    <td>{row.stockCode}</td>
                    <td>{row.productName}</td>
                    <td>{formatNumber(row.quantityIn)}</td>
                    <td>{formatNumber(row.quantityOut)}</td>
                    <td>{formatNumber(row.quantityNet)}</td>
                    <td>{formatMoney(row.unitCostTry, 'TRY')}</td>
                    <td>{formatMoney(row.amountTry, 'TRY')}</td>
                    <td>{row.customerName || row.supplierName || '-'}</td>
                    <td>
                      {(row.sourceType === 'sales_invoice' || row.sourceType === 'purchase_invoice') ? (
                        <button type="button" className="mini-button" onClick={() => openSource(row)}>Fişe Git</button>
                      ) : '-'}
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
