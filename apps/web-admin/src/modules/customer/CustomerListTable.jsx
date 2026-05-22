import React from 'react';

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function CustomerListTable({ rows, selectedRowId, onOpenRow, onSelectRow }) {
  return (
    <div className="table-wrap customer-table-wrap">
      <table className="customer-table">
        <thead>
          <tr>
            <th>Cari kodu</th>
            <th>Musteri / tedarikci adi</th>
            <th>Telefon</th>
            <th>Sehir</th>
            <th>Ulke</th>
            <th>Para birimi</th>
            <th>Cari tipi</th>
            <th>Bakiye</th>
            <th>Son islem tarihi</th>
            <th>Aktif / pasif</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={[
                row.id === selectedRowId ? 'selected' : '',
                row.status === 'Pasif' ? 'passive-row' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onSelectRow(row.id)}
              onDoubleClick={() => onOpenRow(row.id)}
            >
              <td className="code-cell">{row.code}</td>
              <td>{row.name}</td>
              <td>{row.phone}</td>
              <td>{row.city}</td>
              <td>{row.country}</td>
              <td>{row.currency}</td>
              <td>{row.type}</td>
              <td className={`money-cell ${row.balance < 0 ? 'customer-payable' : ''}`}>
                {formatMoney(row.balance, row.currency)}
              </td>
              <td>{row.lastTransactionDate}</td>
              <td className={row.status === 'Aktif' ? 'status-active' : 'status-passive'}>{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
