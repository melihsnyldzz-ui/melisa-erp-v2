import React from 'react';

export function DashboardTopProducts({ rows }) {
  return (
    <section className="erp-panel dashboard-table-panel">
      <div className="panel-title">
        <strong>En Cok Satan Urunler</strong>
        <span>Adet / satis / stok</span>
      </div>
      <div className="table-wrap dashboard-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Stok kodu</th>
              <th>Urun</th>
              <th>Adet</th>
              <th>Satis</th>
              <th>Stok</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code}>
                <td className="code-cell">{row.code}</td>
                <td>{row.name}</td>
                <td className="money-cell">{row.quantity}</td>
                <td className="money-cell">{row.sales}</td>
                <td className={row.stock < 0 ? 'dashboard-risk-cell' : 'money-cell'}>{row.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
