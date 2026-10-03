import React from 'react';

function statusLabel(status) {
  const labels = {
    DRAFT: 'Taslak',
    FINALIZED: 'Kesinleşti',
    CANCELLED: 'İptal',
    ARCHIVED_TEST: 'Test Arşivi',
  };

  return labels[status] || status || '-';
}

function statusTone(status) {
  if (status === 'FINALIZED') return 'success';
  if (status === 'CANCELLED') return 'danger';
  if (status === 'ARCHIVED_TEST') return 'passive';
  return 'warning';
}

export function DashboardRecentTransactions({ rows }) {
  return (
    <section className="erp-panel dashboard-table-panel">
      <div className="panel-title">
        <strong>Son Satışlar / Son Alışlar</strong>
        <span>Satış / alış / cari / terminal sync</span>
      </div>
      <div className="table-wrap dashboard-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Saat</th>
              <th>Belge</th>
              <th>Cari / kaynak</th>
              <th>Tip</th>
              <th>Tutar</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.time}-${row.document}`}>
                <td>{row.time}</td>
                <td className="code-cell">{row.document}</td>
                <td>{row.account}</td>
                <td>{row.type}</td>
                <td className="money-cell">{row.amount}</td>
                <td><span className={`status-pill ${statusTone(row.status)}`}>{statusLabel(row.status)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
