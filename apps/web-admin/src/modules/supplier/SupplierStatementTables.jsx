import React from 'react';
import { ledgerTargetActionLabel } from '../shared/ledgerNavigation.js';
import { displayMovementLabel, formatMoney } from './supplierStatementUtils.js';

export function SupplierStatementSummaryStrip({ totals }) {
  return (
    <section className="summary-strip">
      {totals.map((total) => (
        <article className="summary-card" key={total.currency}>
          <span>{total.currency} tedarikçi bakiyesi</span>
          <strong className={total.balance >= 0 ? 'ledger-in' : 'ledger-out'}>{formatMoney(total.balance, total.currency)}</strong>
          <small>Borç {formatMoney(total.debit, total.currency)} / Alacak {formatMoney(total.credit, total.currency)}</small>
        </article>
      ))}
      {totals.length === 0 && (
        <article className="summary-card">
          <span>Tedarikçi bakiyesi</span>
          <strong>0</strong>
          <small>Filtreye uygun normal hareket yok</small>
        </article>
      )}
    </section>
  );
}

export function SupplierCancelledStatementTable({
  showCancelled,
  cancelledRows,
  cancelledTotals,
  onOpenMovement,
  onOpenSupplier,
}) {
  if (!showCancelled || cancelledRows.length === 0) return null;

  return (
    <section className="erp-panel cancelled-ledger-panel">
      <div className="panel-title">
        <strong>İptal Edilen Alış Fişleri</strong>
        <span>{cancelledRows.length} iptal hareketi / ekstrede ayrı izlenir</span>
      </div>
      <div className="cancelled-ledger-summary">
        {cancelledTotals.map((total) => (
          <div key={total.currency}>
            <span>{total.currency} iptal iz toplamı</span>
            <strong>{formatMoney(total.balance, total.currency)}</strong>
            <small>İptal hareketleri tedarikçi izinden silinmez, normal ekstre satırından ayrılır.</small>
          </div>
        ))}
      </div>
      <div className="table-shell compact-table-shell">
        <table className="erp-table cancelled-ledger-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Tedarikçi</th>
              <th>Belge No</th>
              <th>İşlem</th>
              <th>Tutar</th>
              <th>PB</th>
              <th>Git</th>
            </tr>
          </thead>
          <tbody>
            {cancelledRows.map((row) => (
              <tr className="clickable-row" key={`supplier-statement-cancelled-${row.id}`} onClick={() => onOpenMovement(row)}>
                <td>{row.documentDate || '-'}</td>
                <td>
                  <button type="button" className="link-button" onClick={(event) => { event.stopPropagation(); onOpenSupplier(row); }}>
                    {row.supplierName || row.supplierCode || '-'}
                  </button>
                </td>
                <td>
                  <button type="button" className="document-link-button" onClick={(event) => { event.stopPropagation(); onOpenMovement(row); }}>
                    {row.documentNo || '-'}
                  </button>
                </td>
                <td><span className="cancelled-ledger-badge">{displayMovementLabel(row)}</span></td>
                <td>{formatMoney(Math.abs(Number(row.balanceEffect || row.amount || 0)), row.currency)}</td>
                <td><span className="status-pill danger">{row.currency || 'TRY'}</span></td>
                <td><button type="button" className="mini-button danger" onClick={(event) => { event.stopPropagation(); onOpenMovement(row); }}>{ledgerTargetActionLabel(row)}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function SupplierStatementRowsTable({
  rows,
  regularRows,
  cancelledRows,
  showCancelled,
  isLoading,
  errorMessage,
  onOpenMovement,
  onOpenSupplier,
}) {
  return (
    <section className="erp-panel">
      <div className="panel-title">
        <strong>Tedarikci Ekstre Satirlari</strong>
        <span>{regularRows.length} normal satir / {showCancelled ? cancelledRows.length : 0} iptal ustte ayri gosterilir</span>
      </div>
      {isLoading && <div className="list-state">Tedarikçi ekstresi yükleniyor...</div>}
      {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
      {!isLoading && !errorMessage && rows.length === 0 && <div className="list-state">Tedarikçi ekstre hareketi bulunamadı.</div>}
      {!isLoading && !errorMessage && rows.length > 0 && regularRows.length === 0 && <div className="list-state">Normal ekstre satırı yok; sadece iptal hareketi var.</div>}
      {!isLoading && !errorMessage && regularRows.length > 0 && (
        <div className="table-shell ledger-table-shell">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Tedarikçi</th>
                <th>Belge No</th>
                <th>İşlem</th>
                <th>Borç</th>
                <th>Alacak</th>
                <th>Etki</th>
                <th>PB</th>
                <th>Git</th>
              </tr>
            </thead>
            <tbody>
              {regularRows.map((row) => {
                const effect = Number(row.balanceEffect || row.amount || 0);
                return (
                  <tr className="clickable-row" key={row.id} onClick={() => onOpenMovement(row)}>
                    <td>{row.documentDate || '-'}</td>
                    <td>
                      <button type="button" className="link-button" onClick={(event) => { event.stopPropagation(); onOpenSupplier(row); }}>
                        {row.supplierName || row.supplierCode || '-'}
                      </button>
                    </td>
                    <td>
                      <button type="button" className="document-link-button" onClick={(event) => { event.stopPropagation(); onOpenMovement(row); }}>
                        {row.documentNo || '-'}
                      </button>
                    </td>
                    <td>{displayMovementLabel(row)}</td>
                    <td className="ledger-out">{effect < 0 ? formatMoney(Math.abs(effect), row.currency) : '-'}</td>
                    <td className="ledger-in">{effect >= 0 ? formatMoney(effect, row.currency) : '-'}</td>
                    <td>{formatMoney(effect, row.currency)}</td>
                    <td><span className="status-pill">{row.currency || 'TRY'}</span></td>
                    <td><button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); onOpenMovement(row); }}>{ledgerTargetActionLabel(row)}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
