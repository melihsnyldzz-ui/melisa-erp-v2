import React from 'react';
import { ledgerAccountCurrency, ledgerEffect, summarizeLedgerPeriod } from '../shared/ledgerBalances.js';
import { ledgerTargetActionLabel, resolveLedgerTarget } from '../shared/ledgerNavigation.js';

function formatMoney(amount, currency) {
  if (amount == null || !Number.isFinite(Number(amount)) || !['TRY', 'USD', 'EUR'].includes(currency)) return 'Bilinmiyor';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

const movementLabels = {
  sales_invoice: 'Satış fişi',
  sales_invoice_cancel: 'Satış iptal',
  sales_return: 'Satış iadesi',
  sales_return_cancel: 'Satış iadesi iptal',
  collection: 'Tahsilat',
  payment: 'Ödeme',
};

function movementLabel(type) {
  return movementLabels[type] || type || '-';
}

function isCancelled(transaction) {
  return transaction.status === 'cancelled' || ['sales_invoice_cancel', 'sales_return_cancel'].includes(transaction.type);
}

export function CustomerTransactionsPanel({ transactions = [], onOpenTransaction }) {
  const totals = Object.values(summarizeLedgerPeriod(transactions));
  const cancelled = transactions.filter(isCancelled).length;

  return (
    <section className="erp-panel customer-transactions-panel">
      <div className="panel-title">
        <strong>Cari Hareketler</strong>
        <span>Satıra tıklayınca ilgili satış fişi veya tahsilat ekranı açılır</span>
      </div>
      <div className="trace-summary-strip">
        <span><b>{transactions.length}</b> hareket</span>
        {totals.map(total => <React.Fragment key={total.currency}>
          <span className="out-cell"><b>{formatMoney(total.debit, total.currency)}</b> borç</span>
          <span className="in-cell"><b>{formatMoney(total.credit, total.currency)}</b> alacak</span>
        </React.Fragment>)}
        {cancelled > 0 && <span className="cancelled-ledger-badge"><b>{cancelled}</b> iptal hareketi</span>}
      </div>
      <div className="table-wrap customer-transactions-wrap">
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Tip</th>
              <th>Belge no</th>
              <th>Belge tutarı</th>
              <th>Cari bakiye etkisi</th>
              <th>Durum</th>
              <th>Git</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr>
                <td colSpan="7">Cari hareket bulunamadı.</td>
              </tr>
            )}
            {transactions.map((transaction) => {
              const effect = ledgerEffect(transaction);
              const canOpen = Boolean(resolveLedgerTarget(transaction));

              return (
                <tr
                  className={`${canOpen ? 'clickable-row' : ''} ${isCancelled(transaction) ? 'cancel-row' : ''}`}
                  key={transaction.id}
                  onClick={() => onOpenTransaction?.(transaction)}
                >
                  <td>{transaction.date || '-'}</td>
                  <td>{movementLabel(transaction.type)}</td>
                  <td>
                    <button
                      type="button"
                      className="document-link-button"
                      disabled={!canOpen}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenTransaction?.(transaction);
                      }}
                    >
                      {transaction.documentNo || '-'}
                    </button>
                  </td>
                  <td className="money-cell">{formatMoney(transaction.amount, transaction.currency)}</td>
                  <td className={`money-cell ${effect < 0 ? 'in-cell' : 'out-cell'}`}>
                    {formatMoney(effect, ledgerAccountCurrency(transaction))}
                  </td>
                  <td>{String(transaction.status || '-').toUpperCase()}</td>
                  <td>
                    <button
                      type="button"
                      className="mini-button"
                      disabled={!canOpen}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenTransaction?.(transaction);
                      }}
                    >
                      {canOpen ? ledgerTargetActionLabel(transaction) : 'Belge Yok'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
