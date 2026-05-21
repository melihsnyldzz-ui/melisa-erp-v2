import React from 'react';

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function CustomerTransactionsPanel({ transactions }) {
  return (
    <section className="erp-panel customer-transactions-panel">
      <div className="panel-title">
        <strong>Son Satis / Alis Hareketleri</strong>
        <span>Fis, tahsilat ve duzeltme ozeti</span>
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
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
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
