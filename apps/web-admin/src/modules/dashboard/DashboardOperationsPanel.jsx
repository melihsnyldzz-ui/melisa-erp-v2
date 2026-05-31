import React from 'react';

export function DashboardOperationsPanel({ columns, rows, title, subtitle }) {
  return (
    <section className="erp-panel dashboard-table-panel dashboard-operations-panel">
      <div className="panel-title">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <div className="table-wrap dashboard-table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id || `${title}-${index}`}>
                {columns.map((column) => (
                  <td className={column.align === 'right' ? 'money-cell' : ''} key={column.key}>
                    {row[column.key] ?? '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="list-state">Demo/SQL verisi bekleniyor.</div>}
      </div>
    </section>
  );
}
