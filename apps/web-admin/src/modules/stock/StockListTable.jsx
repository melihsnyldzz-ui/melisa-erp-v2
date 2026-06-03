import React from 'react';

export function StockListTable({ rows, selectedRowId, onOpenRow, onSelectRow }) {
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
              className={[
                selectedRowId === row.id ? 'selected' : '',
                row.status === 'Pasif' ? 'passive-row' : '',
              ].filter(Boolean).join(' ')}
              key={row.id}
              onClick={() => onSelectRow(row.id)}
              onDoubleClick={() => onOpenRow(row.id)}
            >
              <td className="code-cell">{row.stockCode}</td>
              <td title={row.primaryBarcode !== row.barcode ? `Ana barkod: ${row.primaryBarcode}` : row.barcode}>
                {row.barcode}
              </td>
              <td>{row.name}</td>
              <td>{row.brand}</td>
              <td>{row.category}</td>
              <td>{row.currency}</td>
              <td className="money-cell">{row.salesPrice}</td>
              <td className="money-cell">{row.purchasePrice}</td>
              <td>
                <span className={row.currentStock < 0 ? 'stock-pill negative' : row.currentStock === 0 ? 'stock-pill zero' : 'stock-pill positive'}>
                  {row.currentStock}
                </span>
              </td>
              <td>{row.supplier}</td>
              <td>
                <span className={row.status === 'Pasif' ? 'status-badge passive' : 'status-badge active'}>
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
