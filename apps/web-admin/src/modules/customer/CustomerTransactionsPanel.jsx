import React from 'react';

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

const movementLabels = {
  sales_invoice: 'Satış fişi',
  sales_invoice_cancel: 'Satış iptal',
  collection: 'Tahsilat',
  payment: 'Ödeme',
};

function movementLabel(type) {
  return movementLabels[type] || type || '-';
}

function isCancelled(transaction) {
  return transaction.status === 'cancelled' || transaction.type === 'sales_invoice_cancel';
}

export function CustomerTransactionsPanel({ transactions = [], onOpenTransaction }) {
  const summary = transactions.reduce((total, transaction) => {
    const effect = Number(transaction.balanceEffect ?? transaction.amount ?? 0);
    const amount = Math.abs(Number(transaction.amount || effect || 0));

    return {
      debit: total.debit + (effect > 0 ? amount : 0),
      credit: total.credit + (effect < 0 ? amount : 0),
      cancelled: total.cancelled + (isCancelled(transaction) ? 1 : 0),
    };
  }, { debit: 0, credit: 0, cancelled: 0 });
  const currency = transactions.find((transaction) => transaction.currency)?.currency || 'TRY';

  return (
    <section className="erp-panel customer-transactions-panel">
      <div className="panel-title">
        <strong>Cari Hareketler</strong>
        <span>Satıra tıklayınca ilgili satış fişi veya tahsilat ekranı açılır</span>
      </div>
      <div className="trace-summary-strip">
        <span><b>{transactions.length}</b> hareket</span>
        <span className="out-cell"><b>{formatMoney(summary.debit, currency)}</b> borç</span>
        <span className="in-cell"><b>{formatMoney(summary.credit, currency)}</b> alacak</span>
        {summary.cancelled > 0 && <span className="cancelled-ledger-badge"><b>{summary.cancelled}</b> iptal hareketi</span>}
      </div>
      <div className="table-wrap customer-transactions-wrap">
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Tip</th>
              <th>Belge no</th>
              <th>Tutar</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr>
                <td colSpan="5">Cari hareket bulunamadı.</td>
              </tr>
            )}
            {transactions.map((transaction) => {
              const effect = Number(transaction.balanceEffect ?? transaction.amount ?? 0);
              const canOpen = transaction.salesInvoiceId || transaction.type === 'collection' || transaction.type === 'payment';

              return (
                <tr
                  className={`${canOpen ? 'clickable-row' : ''} ${isCancelled(transaction) ? 'cancel-row' : ''}`}
                  key={transaction.id}
                  onClick={() => onOpenTransaction?.(transaction)}
                >
                  <td>{transaction.date || '-'}</td>
                  <td>{movementLabel(transaction.type)}</td>
                  <td className="code-cell">{transaction.documentNo || '-'}</td>
                  <td className={`money-cell ${effect < 0 ? 'in-cell' : 'out-cell'}`}>
                    {formatMoney(transaction.amount, transaction.currency || currency)}
                  </td>
                  <td>{String(transaction.status || '-').toUpperCase()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
