import React from 'react';

export function StockListTable({ rows, selectedRowId, onSelectRow }) {
  return (
    <div className="stock-table-wrap">
      <table className="stock-table">
        <thead>
          <tr>
            <th>Stok Kodu</th>
            <th>Barkod</th>
            <th>Ürün Adı</th>
            <th>Marka</th>
            <th>Kategori</th>
            <th>PB</th>
            <th>Satış Fiyatı</th>
            <th>Alış Fiyatı</th>
            <th>Mevcut Stok</th>
            <th>Ana Tedarikçi</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              className={selectedRowId === row.id ? 'selected' : ''}
              key={row.id}
              onClick={() => onSelectRow(row.id)}
            >
              <td className="code-cell">{row.stockCode}</td>
              <td>{row.barcode}</td>
              <td>{row.name}</td>
              <td>{row.brand}</td>
              <td>{row.category}</td>
              <td>{row.currency}</td>
              <td className="money-cell">{row.salesPrice}</td>
              <td className="money-cell">{row.purchasePrice}</td>
              <td className={row.currentStock < 0 ? 'stock-negative' : row.currentStock === 0 ? 'stock-zero' : ''}>
                {row.currentStock}
              </td>
              <td>{row.supplier}</td>
              <td className={row.status === 'Pasif' ? 'status-passive' : 'status-active'}>{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
