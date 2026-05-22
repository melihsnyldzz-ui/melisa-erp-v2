import React from 'react';

export function DashboardReceivablesPanel({ rows }) {
  return (
    <section className="erp-panel dashboard-table-panel">
      <div className="panel-title">
        <strong>Cari Borc / Ekstre Ozeti</strong>
        <span>Musteri borclari ve risk</span>
      </div>
      <div className="table-wrap dashboard-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Musteri</th>
              <th>Bakiye</th>
              <th>Son hareket</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.customer}>
                <td>{row.customer}</td>
                <td className="money-cell">{row.balance}</td>
                <td>{row.lastMove}</td>
                <td className={row.risk === 'Yuksek' ? 'dashboard-risk-cell' : ''}>{row.risk}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
