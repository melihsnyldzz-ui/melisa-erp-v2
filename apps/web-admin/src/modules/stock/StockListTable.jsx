import React, { useState } from 'react';

function renderCell(row, columnKey, imagePreviewHandlers = {}) {
  if (columnKey === 'imageUrl') {
    return (
      <td className="stock-image-cell">
        {row.imageUrl ? (
          <img
            alt={row.name || row.stockCode || 'Urun'}
            onMouseEnter={(event) => imagePreviewHandlers.show?.(row, event)}
            onMouseLeave={imagePreviewHandlers.hide}
            src={row.imageUrl}
          />
        ) : (
          <span className="stock-image-placeholder">Yok</span>
        )}
      </td>
    );
  }

  if (columnKey === 'barcode') {
    return (
      <td title={row.primaryBarcode !== row.barcode ? `Ana barkod: ${row.primaryBarcode}` : row.barcode}>
        {row.barcode}
      </td>
    );
  }

  if (columnKey === 'currentStock') {
    return (
      <td>
        <span className={row.currentStock < 0 ? 'stock-pill negative' : row.currentStock === 0 ? 'stock-pill zero' : 'stock-pill positive'}>
          {row.currentStock}
        </span>
      </td>
    );
  }

  if (columnKey === 'status') {
    return (
      <td>
        <span className={row.status === 'Pasif' ? 'status-badge passive' : 'status-badge active'}>
          {row.status}
        </span>
      </td>
    );
  }

  const moneyColumns = new Set(['salesPrice', 'purchasePrice']);
  const className = [
    columnKey === 'stockCode' ? 'code-cell' : '',
    moneyColumns.has(columnKey) ? 'money-cell' : '',
  ].filter(Boolean).join(' ');

  return <td className={className || undefined}>{row[columnKey]}</td>;
}

export function StockListTable({ rows, selectedRowId, onOpenRow, onSelectRow, columns }) {
  const [imagePreview, setImagePreview] = useState(null);

  function positionPreview(event) {
    const previewWidth = Math.min(384, window.innerWidth - 32);
    const anchorRect = event.currentTarget.getBoundingClientRect();
    const top = 96;
    const nextLeft = anchorRect.right + 14;
    const left = nextLeft + previewWidth > window.innerWidth
      ? anchorRect.left - previewWidth - 12
      : nextLeft;

    return {
      left: Math.max(16, Math.min(left, window.innerWidth - previewWidth - 16)),
      top,
    };
  }

  const imagePreviewHandlers = {
    show(row, event) {
      setImagePreview({
        imageUrl: row.imageUrl,
        title: row.name || row.stockCode || 'Urun',
        ...positionPreview(event),
      });
    },
    hide() {
      setImagePreview(null);
    },
  };

  return (
    <div className="stock-table-wrap">
      <table className="stock-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={{ width: column.width }}>{column.label}</th>
            ))}
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
              {columns.map((column) => (
                <React.Fragment key={column.key}>{renderCell(row, column.key, imagePreviewHandlers)}</React.Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {imagePreview && (
        <div
          className="stock-image-hover-preview"
          style={{ left: imagePreview.left, top: imagePreview.top }}
        >
          <img alt={imagePreview.title} src={imagePreview.imageUrl} />
          <span>{imagePreview.title}</span>
        </div>
      )}
    </div>
  );
}
