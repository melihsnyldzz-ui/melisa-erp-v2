import React from 'react';
import { ledgerAccountCurrency, ledgerEffect } from '../shared/ledgerBalances.js';
import { displayMovementLabel, formatMoney } from './supplierStatementUtils.js';

function currencyTotalsText(rows = [], key) {
  return rows.length ? rows.map(row => `${formatMoney(row[key], row.currency)}`).join(' / ') : '—';
}

export function SupplierStatement360Card({
  supplier360,
  isFiltered,
  filters,
  suggestions,
  onUpdateFilter,
  onExport,
  onPrint,
  onOpenSupplier,
  onOpenMovement,
}) {
  return (
    <section className="supplier-ekstre-360-card">
      <div className="supplier-ekstre-360-main">
        <div className="supplier-ekstre-360-head">
          <div>
            <span>Tedarikci</span>
            <strong>{isFiltered ? (supplier360.primarySupplier?.supplierName || supplier360.primarySupplier?.supplierCode || 'Tedarikci bulunamadi') : 'Tum tedarikciler'}</strong>
            <small>{isFiltered ? (supplier360.primarySupplier?.supplierCode || 'Filtreli ekstre') : `${supplier360.supplierCount || 0} tedarikci`}</small>
          </div>
          <b>{supplier360.currency || 'Dövizler ayrı'}</b>
        </div>
        <label className="supplier-ekstre-search">
          <span>Cari / belge ara</span>
          <input
            list="supplier-ekstre-suggestions"
            value={filters.search}
            onChange={(event) => onUpdateFilter('search', event.target.value)}
            placeholder="Tedarikci kodu, unvan, belge no"
          />
          <datalist id="supplier-ekstre-suggestions">
            {suggestions.map((supplier) => (
              <option key={supplier.key} value={supplier.label} />
            ))}
          </datalist>
        </label>
        <div className="supplier-ekstre-360-actions">
          <button type="button" onClick={onExport}>Excel</button>
          <button type="button" onClick={onPrint}>Yazdir / PDF</button>
          <button type="button" disabled={!isFiltered || !supplier360.primarySupplier} onClick={() => supplier360.primarySupplier && onOpenSupplier(supplier360.primarySupplier)}>Tedarikci</button>
          <button type="button" onClick={() => supplier360.latestRow && onOpenMovement(supplier360.latestRow)}>Son Fis</button>
        </div>
      </div>
      <div className="supplier-ekstre-360-facts">
        <div>
          <span>Normal hareket neti</span>
          <strong>{currencyTotalsText(supplier360.currencyTotals, 'balance')}</strong>
        </div>
        <div>
          <span>Alis</span>
          <strong>{currencyTotalsText(supplier360.currencyTotals, 'purchaseTotal')}</strong>
        </div>
        <div>
          <span>Odeme</span>
          <strong>{currencyTotalsText(supplier360.currencyTotals, 'paymentTotal')}</strong>
        </div>
        <div>
          <span>Alış iadesi</span>
          <strong>{currencyTotalsText(supplier360.currencyTotals, 'returnTotal')}</strong>
        </div>
        <div>
          <span>Son hareket</span>
          <strong>{supplier360.latestRow?.documentDate || '-'}</strong>
        </div>
      </div>
      <div className="supplier-ekstre-360-counts">
        <span><b>Hareket</b>{supplier360.movementCount}</span>
        <span><b>Iptal</b>{supplier360.cancelledCount}</span>
        <span className="in"><b>Alis</b>{currencyTotalsText(supplier360.currencyTotals, 'purchaseTotal')}</span>
        <span className="out"><b>Odeme</b>{currencyTotalsText(supplier360.currencyTotals, 'paymentTotal')}</span>
      </div>
      <div className="supplier-ekstre-period-grid">
        <div>
          <span>Son 1 ay odeme</span>
          <strong>{supplier360.last30.paymentCount}</strong>
          <small>{currencyTotalsText(supplier360.last30.currencyTotals, 'paymentTotal')}</small>
        </div>
        <div className="in">
          <span>Son 1 ay gelen mal</span>
          <strong>{supplier360.last30.goodsCount}</strong>
          <small>{currencyTotalsText(supplier360.last30.currencyTotals, 'goodsTotal')}</small>
        </div>
        <div>
          <span>Son 3 ay odeme</span>
          <strong>{supplier360.last90.paymentCount}</strong>
          <small>{currencyTotalsText(supplier360.last90.currencyTotals, 'paymentTotal')}</small>
        </div>
        <div className="out">
          <span>Son 3 ay odenen para</span>
          <strong>{currencyTotalsText(supplier360.last90.currencyTotals, 'paymentTotal')}</strong>
          <small>{supplier360.last90.paymentCount} odeme hareketi</small>
        </div>
      </div>
      <div className="supplier-ekstre-360-movements">
        <strong>Son Fis Hareketleri</strong>
        {supplier360.recentRows.length === 0 && <span>Hareket yok.</span>}
        {supplier360.recentRows.map((row) => {
          const effect = ledgerEffect(row);
          return (
            <button type="button" key={`supplier-360-${row.id}`} onClick={() => onOpenMovement(row)}>
              <span>
                <b>{displayMovementLabel(row)}</b>
                <small>{row.documentNo || '-'} / {row.supplierName || row.supplierCode || '-'}</small>
              </span>
              <strong className={effect < 0 ? 'out' : ''}>{effect == null ? '' : effect < 0 ? '-' : '+'}{formatMoney((effect == null ? null : Math.abs(effect)), ledgerAccountCurrency(row))}</strong>
            </button>
          );
        })}
      </div>
    </section>
  );
}
