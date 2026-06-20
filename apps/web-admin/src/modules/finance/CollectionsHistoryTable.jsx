import React from 'react';
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
                <th>Cari Türü</th>
                <th>Cari / Tedarikçi</th>
                <th>Belge</th>
                <th>İşlem</th>
                <th>Tutar</th>
                <th>Bakiye Etkisi</th>
                <th>PB</th>
                <th>Makbuz</th>
                <th>Git</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((row) => {
                const effect = Number(row.balanceEffect || 0);
                const isCancelled = String(row.movementType || '').includes('cancel');
                return (
                  <tr className={`clickable-row ${isCancelled ? 'cancel-row' : ''}`} key={`${row.partyType}-${row.id}-${row.movementType}`} onClick={() => onOpenMovement(row)}>
                    <td>{row.documentDate || '-'}</td>
                    <td>{partyLabel(row.partyType)}</td>
                    <td>
                      <button type="button" className="document-link-button party" onClick={(event) => { event.stopPropagation(); onOpenParty(row); }}>
                        {row.partyCode} / {row.partyName}
                      </button>
                    </td>
                    <td>
                      <button type="button" className="document-link-button" onClick={(event) => { event.stopPropagation(); onOpenMovement(row); }}>
                        {row.documentNo || '-'}
                      </button>
                    </td>
                    <td>{movementLabel(row.movementType)}</td>
                    <td>{formatMoney(row.amount, row.currency)}</td>
                    <td className={effect >= 0 ? 'ledger-debit' : 'ledger-credit'}>{formatMoney(effect, row.currency)}</td>
                    <td><span className="status-pill">{row.currency}</span></td>
                    <td>
                      {['collection', 'payment'].includes(row.movementType) ? (
                        <button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); onSelectReceipt(row); }}>Makbuz</button>
                      ) : '-'}
                    </td>
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
