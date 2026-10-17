import React from 'react';

const highlightedCells = new Set(['Eksi', 'Uyarı', 'Risk']);

export function DataTable({ rows, columns }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join('-')}>
              {row.map((cell, index) => (
                <td key={`${cell}-${index}`} className={highlightedCells.has(cell) ? 'hot' : ''}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
