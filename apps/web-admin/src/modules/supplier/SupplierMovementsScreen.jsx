import { partyScopeId, assertPartyScope } from '../../utils/operationNavigation.js';
import { PartyContextNotice } from '../shared/PartyContextNotice.jsx';
import React, { useEffect, useMemo, useState } from 'react';
import { fetchCompleteLedger } from '../../utils/fetchCompleteLedger.js';
import { LedgerBalanceSummary } from '../shared/LedgerBalanceSummary.jsx';
import { ledgerAccountCurrency, ledgerEffect, absoluteLedgerEffect } from '../shared/ledgerBalances.js';
import {
  ExternalLink,
  FileDown,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { fetchSupplierMovements } from '../../services/movementApi.js';
import { fetchSuppliers } from '../../services/supplierApi.js';
import { exportRowsToCsv, printRowsReport } from '../../utils/exportUtils.js';
import { ledgerTargetActionLabel, openLedgerTarget } from '../shared/ledgerNavigation.js';
import { normalizeSupplierSearch, toSupplierSuggestion } from './supplierStatementUtils.js';

function formatMoney(value, currency = 'TRY') {
  if (value == null || !Number.isFinite(Number(value)) || !['TRY', 'USD', 'EUR'].includes(currency)) return 'Bilinmiyor';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatCurrencyTotals(totals = {}) {
  const entries = Object.entries(totals);
  if (entries.length === 0) return formatMoney(0, 'TRY');
  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(' / ');
}

function isCancelledMovement(row) {
  return Boolean(row.isCancelled)
    || row.movementType === 'purchase_invoice_cancel'
    || row.movementType === 'purchase_return_cancel'
    || row.invoiceStatus === 'cancelled';
}

function isPaymentMovement(row) {
  return row.movementType === 'payment';
}

function isPurchaseMovement(row) {
  return row.movementType === 'purchase_invoice' && !isCancelledMovement(row);
}

function isReturnMovement(row) {
  return row.movementType === 'purchase_return' && !isCancelledMovement(row);
}

function movementLabel(row) {
  if (row.movementType?.startsWith('purchase_return')) return isCancelledMovement(row) ? 'Alış iadesi iptal' : 'Alış iadesi';
  if (isCancelledMovement(row)) return 'Alış iptali';
  if (isPaymentMovement(row)) return 'Ödeme';
  if (isPurchaseMovement(row)) return 'Alış faturası';
  return row.movementType || '-';
}

function statusLabel(row) {
  if (isCancelledMovement(row)) return 'İptal';
  if (isPaymentMovement(row)) return 'Ödendi';
  if (row.invoiceStatus === 'finalized') return 'Kesin';
  return row.invoiceStatus && row.invoiceStatus !== '-' ? row.invoiceStatus : 'Kayıtlı';
}

function addCurrencyTotal(target, currency, amount) {
  const key = currency || 'Bilinmiyor';
  if (amount == null || !Number.isFinite(Number(amount)) || (key in target && target[key] == null)) {
    target[key] = null;
    return;
  }
  target[key] = Number(target[key] || 0) + Number(amount || 0);
}

function summarizeRows(rows) {
  const purchases = {};
  const payments = {};
  const returns = {};
  let purchaseCount = 0;
  let paymentCount = 0;
  let returnCount = 0;

  rows.forEach((row) => {
    const effect = ledgerEffect(row);
    if (isPurchaseMovement(row)) {
      purchaseCount += 1;
      addCurrencyTotal(purchases, ledgerAccountCurrency(row), (effect == null ? null : Math.abs(effect)));
    }
    if (isPaymentMovement(row)) {
      paymentCount += 1;
      addCurrencyTotal(payments, ledgerAccountCurrency(row), (effect == null ? null : Math.abs(effect)));
    }
    if (isReturnMovement(row)) {
      returnCount += 1;
      addCurrencyTotal(returns, ledgerAccountCurrency(row), absoluteLedgerEffect(row));
    }

  });

  return { purchases, payments, returns, purchaseCount, paymentCount, returnCount };
}

export function SupplierMovementsScreen({ onOpenScreen, initialSupplierId, initialSupplierCode }) {
  const scopedPartyId = partyScopeId(initialSupplierId);
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    movementType: 'all',
    showCancelled: false,
    sortDirection: 'desc',
  });
  const [rows, setRows] = useState([]);
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const normalizedSearch = useMemo(
    () => normalizeSupplierSearch(debouncedSearch, supplierSuggestions),
    [debouncedSearch, supplierSuggestions],
  );

  const query = useMemo(() => ({
    supplierId: scopedPartyId || undefined,
    page: 1,
    limit: 500,
    search: normalizedSearch,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  }), [scopedPartyId, filters.dateFrom, filters.dateTo, normalizedSearch]);

  useEffect(() => {
    let isMounted = true;

    async function loadSuggestions() {
      try {
        const response = await fetchSuppliers({
          page: 1,
          limit: 80,
          search: debouncedSearch,
          activeOnly: false,
        });
        if (isMounted) {
          setSupplierSuggestions((response.data || []).map(toSupplierSuggestion).filter((item) => item.label));
        }
      } catch {
        if (isMounted) setSupplierSuggestions([]);
      }
    }

    loadSuggestions();
    return () => { isMounted = false; };
  }, [debouncedSearch]);

  useEffect(() => {
    let isMounted = true;

    async function loadRows() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchCompleteLedger(fetchSupplierMovements, query);
        assertPartyScope(response.data, 'supplier', scopedPartyId);
        if (isMounted) {
          setRows(response.data || []);
          setMeta(response.meta || null);
        }
      } catch (error) {
        if (isMounted) {
          setRows([]);
          setMeta(null);
          setErrorMessage(error.message || 'Tedarikçi cari hareketleri okunamadı.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadRows();
    return () => { isMounted = false; };
  }, [query, reloadKey]);

  const visibleRows = useMemo(() => {
    const filteredRows = rows.filter((row) => {
      if (!filters.showCancelled && isCancelledMovement(row)) return false;
      if (filters.movementType === 'purchase') return isPurchaseMovement(row);
      if (filters.movementType === 'payment') return isPaymentMovement(row);
      if (filters.movementType === 'return') return isReturnMovement(row);
      return true;
    });

    return [...filteredRows].sort((left, right) => {
      const dateCompare = String(left.documentDate || '').localeCompare(String(right.documentDate || ''));
      const idCompare = Number(left.id || 0) - Number(right.id || 0);
      const direction = filters.sortDirection === 'asc' ? 1 : -1;
      return (dateCompare || idCompare) * direction;
    });
  }, [filters.movementType, filters.showCancelled, filters.sortDirection, rows]);

  const summary = useMemo(() => summarizeRows(rows.filter((row) => !isCancelledMovement(row))), [rows]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters({ search: '', dateFrom: '', dateTo: '', movementType: 'all', showCancelled: false, sortDirection: 'desc' });
  }

  function openMovement(row) {
    openLedgerTarget(row, onOpenScreen);
  }

  function openSupplier(row) {
    if (!row.supplierId) return;
    onOpenScreen?.('supplier-card', {
      supplierId: row.supplierId,
      supplierCode: row.supplierCode,
      tabLabel: row.supplierName || row.supplierCode || 'Tedarikçi Kartı',
    });
  }

  const exportColumns = [
    { label: 'Tarih', key: 'documentDate' },
    { label: 'Tedarikçi Kodu', key: 'supplierCode' },
    { label: 'Tedarikçi', key: 'supplierName' },
    { label: 'Belge No', key: 'documentNo' },
    { label: 'İşlem', value: movementLabel },
    { label: 'Belge Tutarı', key: 'amount' },
    { label: 'Belge Dövizi', key: 'currency' },
    { label: 'Alış Faturası', value: (row) => isPurchaseMovement(row) ? absoluteLedgerEffect(row) ?? 'Bilinmiyor' : '' },
    { label: 'Ödeme', value: (row) => isPaymentMovement(row) ? absoluteLedgerEffect(row) ?? 'Bilinmiyor' : '' },
    { label: 'Alış İadesi', value: (row) => isReturnMovement(row) ? absoluteLedgerEffect(row) ?? 'Bilinmiyor' : '' },
    { label: 'Cari Etkisi', value: (row) => ledgerEffect(row) ?? 'Bilinmiyor' },
    { label: 'Hareket Sonrası Bakiye', value: (row) => row.runningBalance ?? 'Bilinmiyor' },
    { label: 'Cari Dövizi', value: ledgerAccountCurrency },
    { label: 'Durum', value: statusLabel },
  ];

  function exportMovementRows() {
    exportRowsToCsv({ filename: 'tedarikci-fatura-odeme-hareketleri', rows: visibleRows, columns: exportColumns });
  }

  function printMovementRows() {
    printRowsReport({
      title: 'Melisa ERP - Tedarikçi Fatura ve Ödeme Hareketleri',
      subtitle: `${visibleRows.length} hareket / ${filters.dateFrom || 'İlk kayıt'} - ${filters.dateTo || 'Bugün'}`,
      rows: visibleRows,
      columns: exportColumns.map((column) => ({
        ...column,
        value: column.value || (['runningBalance'].includes(column.key)
          ? (row) => formatMoney(row[column.key], ledgerAccountCurrency(row))
          : undefined),
      })),
    });
  }

  return (
    <main className="work-area supplier-ledger-screen supplier-movements-workspace">
      <PartyContextNotice entityType="supplier" partyId={scopedPartyId} partyCode={initialSupplierCode} screenId="supplier-movements" onOpenScreen={onOpenScreen} />
      <section className="erp-panel supplier-movement-header">
        <div className="supplier-movement-title-row">
          <div>
            <strong>Tedarikçi Fatura ve Ödemeleri</strong>
            <span>Alınan faturalar, yapılan ödemeler ve hareket sonrası kalan borç</span>
          </div>
          <div className="supplier-movement-actions">
            <button type="button" title="Verileri yenile" onClick={() => setReloadKey((value) => value + 1)}>
              <RefreshCw size={15} /> Yenile
            </button>
            <button type="button" title="Excel dosyası indir" onClick={exportMovementRows}>
              <FileDown size={15} /> Excel
            </button>
            <button type="button" title="Yazdır veya PDF oluştur" onClick={printMovementRows}>
              <Printer size={15} /> Yazdır
            </button>
          </div>
        </div>

        <div className="supplier-movement-search-row">
          <label className="supplier-movement-search">
            <Search size={17} aria-hidden="true" />
            <input
              list="supplier-movement-suggestions"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Tedarikçi adı, kodu veya belge numarası ara"
              aria-label="Tedarikçi veya belge ara"
            />
            <datalist id="supplier-movement-suggestions">
              {supplierSuggestions.map((supplier) => <option key={supplier.key} value={supplier.label} />)}
            </datalist>
          </label>
          <div className="supplier-movement-tabs" aria-label="Hareket türü">
            <button type="button" className={filters.movementType === 'all' ? 'pressed' : ''} onClick={() => updateFilter('movementType', 'all')}>Tümü</button>
            <button type="button" className={filters.movementType === 'purchase' ? 'pressed purchase' : ''} onClick={() => updateFilter('movementType', 'purchase')}>Alış Faturaları</button>
            <button type="button" className={filters.movementType === 'payment' ? 'pressed payment' : ''} onClick={() => updateFilter('movementType', 'payment')}>Ödemeler</button>
            <button type="button" className={filters.movementType === 'return' ? 'pressed' : ''} onClick={() => updateFilter('movementType', 'return')}>Alış İadeleri</button>
          </div>
          <button type="button" className={showAdvancedFilters ? 'pressed' : ''} onClick={() => setShowAdvancedFilters((value) => !value)}>
            <SlidersHorizontal size={15} /> Filtreler
          </button>
        </div>

        {showAdvancedFilters && (
          <div className="supplier-movement-advanced">
            <label>Başlangıç<input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} /></label>
            <label>Bitiş<input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} /></label>
            <label>Sıralama
              <select value={filters.sortDirection} onChange={(event) => updateFilter('sortDirection', event.target.value)}>
                <option value="desc">En yeni önce</option>
                <option value="asc">En eski önce</option>
              </select>
            </label>
            <label className="supplier-movement-check"><input type="checkbox" checked={filters.showCancelled} onChange={(event) => updateFilter('showCancelled', event.target.checked)} /> İptal kayıtlarını göster</label>
            <button type="button" onClick={resetFilters}>Temizle</button>
          </div>
        )}
      </section>

      <LedgerBalanceSummary rows={rows} partyType="supplier" isLoading={isLoading} errorMessage={errorMessage} />
      <section className="supplier-movement-summary" aria-label="Tedarikçi hareket özeti">
        <article><span>Alış faturaları</span><strong>{formatCurrencyTotals(summary.purchases)}</strong><small>{summary.purchaseCount} kesin fatura</small></article>
        <article><span>Yapılan ödemeler</span><strong>{formatCurrencyTotals(summary.payments)}</strong><small>{summary.paymentCount} ödeme hareketi</small></article>
        <article><span>Alış iadeleri</span><strong>{formatCurrencyTotals(summary.returns)}</strong><small>{summary.returnCount} iade hareketi</small></article>
        <article><span>Kapsam</span><strong>{rows.length} hareket</strong><small>Seçilen tarih ve aramanın tüm hareketleri</small></article>
        <article><span>Listelenen hareket</span><strong>{visibleRows.length}</strong><small>API toplamı {meta?.total ?? rows.length}</small></article>
      </section>

      <section className="erp-panel supplier-movement-table-panel">
        <div className="panel-title">
          <strong>Fatura ve Ödeme Geçmişi</strong>
          <span>Belge numarasına veya Aç düğmesine basarak kaynağa gidin</span>
        </div>
        {isLoading && <div className="list-state">Tedarikçi hareketleri yükleniyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && visibleRows.length === 0 && <div className="list-state">Bu filtreye uygun fatura veya ödeme bulunamadı.</div>}
        {!isLoading && !errorMessage && visibleRows.length > 0 && (
          <div className="table-shell supplier-movement-table-shell">
            <table className="erp-table supplier-movement-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Tedarikçi</th>
                  <th>Belge No</th>
                  <th>İşlem</th>
                  <th>Belge Tutarı</th>
                  <th>Alış Faturası</th>
                  <th>Ödeme</th>
                  <th>Cari Etkisi</th>
                  <th>Hareket Sonrası Bakiye</th>
                  <th>Durum</th>
                  <th aria-label="İşlem bağlantısı" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const effect = ledgerEffect(row);
                  return (
                    <tr className="clickable-row" key={row.id} onClick={() => openMovement(row)}>
                      <td>{row.documentDate || '-'}</td>
                      <td>
                        <button type="button" className="link-button supplier-name-link" onClick={(event) => { event.stopPropagation(); openSupplier(row); }}>
                          <b>{row.supplierName || '-'}</b><small>{row.supplierCode || ''}</small>
                        </button>
                      </td>
                      <td><button type="button" className="document-link-button" onClick={(event) => { event.stopPropagation(); openMovement(row); }}>{row.documentNo || '-'}</button></td>
                      <td><span className={`supplier-movement-kind ${isPaymentMovement(row) ? 'payment' : isCancelledMovement(row) ? 'cancelled' : 'purchase'}`}>{movementLabel(row)}</span></td>
                      <td>{formatMoney(row.amount, row.currency)}</td>
                      <td className="supplier-purchase-amount">{isPurchaseMovement(row) ? formatMoney((effect == null ? null : Math.abs(effect)), ledgerAccountCurrency(row)) : '-'}</td>
                      <td className="supplier-payment-amount">{isPaymentMovement(row) ? formatMoney((effect == null ? null : Math.abs(effect)), ledgerAccountCurrency(row)) : '-'}</td>
                      <td>{formatMoney(effect, ledgerAccountCurrency(row))}</td>
                      <td className="supplier-balance-amount">{formatMoney(row.runningBalance, ledgerAccountCurrency(row))}</td>
                      <td><span className={`status-pill ${isCancelledMovement(row) ? 'danger' : isPaymentMovement(row) ? 'good' : ''}`}>{statusLabel(row)}</span></td>
                      <td><button type="button" className="mini-button supplier-open-movement" title={ledgerTargetActionLabel(row)} onClick={(event) => { event.stopPropagation(); openMovement(row); }}><ExternalLink size={14} /> Aç</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
