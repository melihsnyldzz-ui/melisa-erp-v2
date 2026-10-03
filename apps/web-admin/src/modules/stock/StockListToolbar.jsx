import React from 'react';
import { Columns3, Download, Ellipsis, Eye, FileSpreadsheet, ImagePlus, ListChecks, PackageOpen, PanelRightOpen, Plus, Printer, RefreshCcw } from 'lucide-react';

export function StockListToolbar({ showPassive, onTogglePassive, onOpenNewProduct, onOpenProductCard, onOpenProductImage, onOpenBulkUpdate, onExportCsv, onExportExcel, onPrint, onRefresh, onToggleColumns, onToggleProduct360, isColumnPanelOpen = false, isProduct360Open = false, hasSelection = true, bulkSelectionCount = 0, canBulkEdit = false, canManageImage = false, canExport = true, isReadOnly = false, onSyncVegaCards }) {
  return (
    <div className="stock-toolbar stock-toolbar-compact">
      <div className="stock-toolbar-title"><strong>Stok Listesi</strong><span>{isReadOnly ? 'Vega Canlı · Salt okunur' : 'Canlı stok, fiyat ve ürün takibi'}</span></div>
      <div className="stock-toolbar-actions">
        {!isReadOnly && <button className="primary-action" type="button" onClick={onOpenNewProduct}><Plus aria-hidden="true" size={16} /> Yeni Ürün</button>}
        <button type="button" onClick={onOpenProductCard} disabled={!hasSelection}><PackageOpen aria-hidden="true" size={16} /> {isReadOnly ? 'Kart Özeti' : 'Ürün Kartı'}</button>
        {isReadOnly && canManageImage && <button className="primary-action" type="button" onClick={onOpenProductImage} disabled={!hasSelection}><ImagePlus aria-hidden="true" size={16} /> Görsel Ekle</button>}
        {!isReadOnly && <button className={isProduct360Open ? 'pressed' : ''} type="button" onClick={onToggleProduct360}><PanelRightOpen aria-hidden="true" size={16} /> Ürün 360</button>}
        {canBulkEdit && <button type="button" onClick={onOpenBulkUpdate} disabled={bulkSelectionCount === 0}><ListChecks aria-hidden="true" size={16} /> Toplu Düzenle {bulkSelectionCount > 0 ? `(${bulkSelectionCount})` : ''}</button>}
        <button type="button" onClick={onRefresh}><RefreshCcw aria-hidden="true" size={16} /> Yenile</button>
        {onSyncVegaCards && <button type="button" onClick={onSyncVegaCards}><RefreshCcw aria-hidden="true" size={16} /> Vega’dan kartları güncelle</button>}
        <details className="stock-list-tools">
          <summary aria-label="Diğer stok işlemleri" title="Diğer işlemler"><Ellipsis aria-hidden="true" size={18} /></summary>
          <div className="stock-list-tools-menu">
            <button type="button" onClick={onExportCsv} disabled={!canExport}><Download aria-hidden="true" size={16} /> CSV</button>
            <button type="button" onClick={onExportExcel} disabled={!canExport}><FileSpreadsheet aria-hidden="true" size={16} /> Excel</button>
            <button type="button" onClick={onPrint} disabled={!canExport}><Printer aria-hidden="true" size={16} /> Yazdır/PDF</button>
            <button className={isColumnPanelOpen ? 'pressed' : ''} type="button" onClick={onToggleColumns}><Columns3 aria-hidden="true" size={16} /> Kolonlar</button>
            <button className={showPassive ? 'pressed' : ''} type="button" onClick={onTogglePassive}><Eye aria-hidden="true" size={16} /> Pasifler</button>
          </div>
        </details>
      </div>
    </div>
  );
}
