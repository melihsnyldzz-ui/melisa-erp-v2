import React from 'react';

function formatMoney(amount, currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function renderCell(row, columnKey) {
  if (columnKey === 'code') {
    return <td className="code-cell">{row.code}</td>;
  }

  if (columnKey === 'balance') {
    return (
      <td className={`money-cell ${row.balance < 0 ? 'customer-payable' : ''}`}>
        {formatMoney(row.balance, row.currency)}
      </td>
    );
  }

  if (columnKey === 'status') {
    return <td className={row.status === 'Aktif' ? 'status-active' : 'status-passive'}>{row.status}</td>;
  }

  return <td>{row[columnKey] ?? '-'}</td>;
}

export function CustomerListTable({ columns, rows, selectedRowId, onOpenRow, onSelectRow, onSort, sortConfig }) {
  function sortMark(key) {
    if (sortConfig.key !== key) {
      return '';
    }

    return sortConfig.direction === 'asc' ? ' ASC' : ' DESC';
  }

  return (
    <div className="table-wrap customer-table-wrap">
      <table className="customer-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={{ width: column.width }}>
                <button className="table-sort-button" onClick={() => onSort(column.key)} type="button">
                  {column.label}{sortMark(column.key)}
                </button>
              </th>
            ))}
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
              {columns.map((column) => (
                <React.Fragment key={column.key}>{renderCell(row, column.key)}</React.Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
