import React from 'react';

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function CustomerTransactionsPanel({ transactions, onOpenTransaction }) {
  return (
    <section className="erp-panel customer-transactions-panel">
      <div className="panel-title">
        <strong>Cari Hareketler</strong>
        <span>Satira tiklayinca ilgili isleme gider</span>
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
                <td colSpan="5">Cari hareket bulunamadi.</td>
              </tr>
            )}
            {transactions.map((transaction) => (
              <tr
                className={transaction.salesInvoiceId ? 'clickable-row' : ''}
                key={transaction.id}
                onClick={() => onOpenTransaction?.(transaction)}
              >
                <td>{transaction.date}</td>
                <td>{transaction.type}</td>
                <td className="code-cell">{transaction.documentNo}</td>
                <td className={`money-cell ${transaction.amount < 0 ? 'customer-payable' : ''}`}>
                  {formatMoney(transaction.amount, transaction.currency)}
                </td>
                <td>{transaction.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
