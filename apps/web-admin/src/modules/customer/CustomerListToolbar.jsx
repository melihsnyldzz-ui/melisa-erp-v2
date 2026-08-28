import React from 'react';
import { Columns3, Download, Ellipsis, Eye, Plus, Printer, RefreshCcw, UserRound } from 'lucide-react';

export function CustomerListToolbar({
  showPassive,
  onTogglePassive,
  onOpenNewCustomer,
  onOpenCustomerCard,
  onExportCsv,
  onPrint,
  onRefresh,
  onToggleColumns,
  hasSelection = true,
  isColumnPanelOpen = false,
  isReadOnly = false,
}) {
  return (
    <section className="customer-toolbar">
      <div className="customer-toolbar-title">
        <strong>Cari Listesi</strong>
        <span>{isReadOnly ? 'Vega canlı cari ve 2026 bakiye takibi' : 'Müşteri, bakiye ve son hareket takibi'}</span>
      </div>
      <div className="customer-toolbar-actions">
        <button type="button" className="primary-action" onClick={onOpenNewCustomer} disabled={isReadOnly}><Plus aria-hidden="true" size={16} /> Yeni Cari</button>
        <button type="button" onClick={onOpenCustomerCard} disabled={!hasSelection}><UserRound aria-hidden="true" size={16} /> {isReadOnly ? 'Hareketleri Aç' : 'Cari Kartı'}</button>
        <button type="button" onClick={onRefresh} title="Listeyi yenile"><RefreshCcw aria-hidden="true" size={16} /> Yenile</button>
        <details className="entity-list-tools">
          <summary aria-label="Diğer liste işlemleri" title="Diğer işlemler"><Ellipsis aria-hidden="true" size={18} /></summary>
          <div className="entity-list-tools-menu">
            <button type="button" onClick={onExportCsv}><Download aria-hidden="true" size={16} /> Excel</button>
            <button type="button" onClick={onPrint}><Printer aria-hidden="true" size={16} /> Yazdır</button>
            <button type="button" className={isColumnPanelOpen ? 'pressed' : ''} onClick={onToggleColumns}><Columns3 aria-hidden="true" size={16} /> Kolonlar</button>
            {!isReadOnly && <button type="button" className={showPassive ? 'pressed' : ''} onClick={onTogglePassive}><Eye aria-hidden="true" size={16} /> Pasifler</button>}
          </div>
        </details>
      </div>
    </section>
  );
}
