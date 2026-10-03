import React from 'react';

export function DashboardOperationsPanel({ columns, rows, title, subtitle }) {
  const isEmpty = rows.length === 0;

  return (
    <section className={`erp-panel dashboard-table-panel dashboard-operations-panel ${isEmpty ? 'is-empty' : ''}`}>
      <div className="panel-title">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      {isEmpty ? (
        <div className="dashboard-compact-empty">
          <span aria-hidden="true">—</span>
          <p>Bu dönem için gösterilecek kayıt oluşmadı.</p>
        </div>
      ) : (
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
      </div>
      )}
    </section>
  );
}
