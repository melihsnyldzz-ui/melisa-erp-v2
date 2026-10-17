import React from 'react';
import { ArrowUpRight, ReceiptText } from 'lucide-react';
import { ledgerTargetActionLabel } from '../shared/ledgerNavigation.js';
import { formatMoney, movementLabel, partyLabel } from './collectionsFormatters.js';

export function CollectionsHistoryTable({
  movements,
  isLoading,
  onOpenMovement,
  onOpenParty,
  onSelectReceipt,
}) {
  return (
    <section className="erp-panel collections-history-panel">
      <div className="panel-title">
        <strong>Son Tahsilat / Ödeme Hareketleri</strong>
        <span>{movements.length} satır / hareketten ilgili karta veya fişe geçilebilir</span>
      </div>
      {!isLoading && movements.length === 0 && <div className="list-state">Hareket bulunamadı.</div>}
      {movements.length > 0 && (
        <div className="table-shell">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Cari</th>
                <th>İşlem</th>
                <th>Tutar</th>
                <th>Bakiye Etkisi</th>
                <th>Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((row) => {
                const effect = Number(row.balanceEffect || 0);
                const isCancelled = String(row.movementType || '').includes('cancel');
                return (
                  <tr className={`clickable-row ${isCancelled ? 'cancel-row' : ''}`} key={`${row.partyType}-${row.id}-${row.movementType}`} onClick={() => onOpenMovement(row)}>
                    <td>{row.documentDate || '-'}</td>
                    <td className="collections-party-cell">
                      <button type="button" className="document-link-button party" onClick={(event) => { event.stopPropagation(); onOpenParty(row); }}>
                        {row.partyCode} / {row.partyName}
                      </button>
                      <small>{partyLabel(row.partyType)}</small>
                    </td>
                    <td className="collections-movement-cell">
                      <strong>{movementLabel(row.movementType)}</strong>
                      <button type="button" className="document-link-button" onClick={(event) => { event.stopPropagation(); onOpenMovement(row); }}>
                        {row.documentNo || '-'}
                      </button>
                    </td>
                    <td className="money-cell"><strong>{formatMoney(row.amount, row.currency)}</strong><small>{row.currency}</small></td>
                    <td className={effect >= 0 ? 'ledger-debit' : 'ledger-credit'}>{formatMoney(effect, row.currency)}</td>
                    <td className="collections-row-actions">
                      {['collection', 'payment'].includes(row.movementType) ? (
                        <button type="button" className="invoice-row-icon-button" aria-label="Makbuzu aç" title="Makbuzu aç" onClick={(event) => { event.stopPropagation(); onSelectReceipt(row); }}><ReceiptText size={15} /></button>
                      ) : null}
                      <button type="button" className="invoice-row-icon-button" aria-label={ledgerTargetActionLabel(row)} title={ledgerTargetActionLabel(row)} onClick={(event) => { event.stopPropagation(); onOpenMovement(row); }}><ArrowUpRight size={15} /></button>
                    </td>
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
