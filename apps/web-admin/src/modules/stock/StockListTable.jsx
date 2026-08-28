import React, { useState } from 'react';
import { createPortal } from 'react-dom';

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

export function StockListTable({ rows, selectedRowId, selectedRowIds, onOpenRow, onSelectRow, onToggleRow, onToggleAll, columns }) {
  const [imagePreview, setImagePreview] = useState(null);
  const allSelected = rows.length > 0 && rows.every((row) => selectedRowIds.has(row.id));
  const someSelected = rows.some((row) => selectedRowIds.has(row.id));

  function positionPreview(event) {
    const previewWidth = Math.min(480, window.innerWidth - 24);
    const previewHeight = Math.min(500, window.innerHeight - 24);
    const anchorRect = event.currentTarget.getBoundingClientRect();
    const centeredTop = anchorRect.top + (anchorRect.height / 2) - (previewHeight / 2);
    const top = Math.max(12, Math.min(centeredTop, window.innerHeight - previewHeight - 12));
    const nextLeft = anchorRect.right + 12;
    const left = nextLeft + previewWidth > window.innerWidth
      ? anchorRect.left - previewWidth - 12
      : nextLeft;

    return {
      left: Math.max(12, Math.min(left, window.innerWidth - previewWidth - 12)),
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
            <th className="stock-select-cell">
              <input
                aria-label="Görünen ürünlerin tümünü seç"
                checked={allSelected}
                ref={(element) => {
                  if (element) element.indeterminate = someSelected && !allSelected;
                }}
                onChange={(event) => onToggleAll(event.target.checked)}
                type="checkbox"
              />
            </th>
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
              <td className="stock-select-cell" onClick={(event) => event.stopPropagation()}>
                <input
                  aria-label={`${row.stockCode} ürününü seç`}
                  checked={selectedRowIds.has(row.id)}
                  onChange={(event) => onToggleRow(row.id, event.target.checked)}
                  type="checkbox"
                />
              </td>
              {columns.map((column) => (
                <React.Fragment key={column.key}>{renderCell(row, column.key, imagePreviewHandlers)}</React.Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {imagePreview && typeof document !== 'undefined' && createPortal(
        <div
          className="stock-image-hover-preview"
          style={{ left: imagePreview.left, top: imagePreview.top }}
        >
          <img alt={imagePreview.title} src={imagePreview.imageUrl} />
          <span>{imagePreview.title}</span>
        </div>,
        document.body,
      )}
    </div>
  );
}
