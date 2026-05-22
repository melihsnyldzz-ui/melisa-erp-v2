import React from 'react';

export function DashboardSupplierPerformance({ rows }) {
  return (
    <section className="erp-panel dashboard-table-panel">
      <div className="panel-title">
        <strong>Tedarikci Performansi</strong>
        <span>Alis / teslimat / kalite</span>
      </div>
      <div className="table-wrap dashboard-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tedarikci</th>
              <th>Acik alis</th>
              <th>Teslimat</th>
              <th>Hata</th>
              <th>Borc</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.supplier}>
                <td>{row.supplier}</td>
                <td className="money-cell">{row.openPurchases}</td>
                <td>{row.delivery}</td>
                <td>{row.defect}</td>
                <td className="money-cell">{row.debt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
