import React from 'react';

export function SupplierStatementFilters({
  filters,
  onUpdateFilter,
  onReset,
  onExport,
  onPrint,
}) {
  return (
    <>
      <div className="movement-quick-filters">
        <button type="button" className="pressed">Normal Ekstre</button>
        <button type="button" className={filters.showCancelled ? 'pressed danger' : 'danger'} onClick={() => onUpdateFilter('showCancelled', !filters.showCancelled)}>
          İptal Fişleri {filters.showCancelled ? 'Açık' : 'Kapalı'}
        </button>
      </div>
      <div className="filter-grid">
        <label>
          Tedarikçi / Belge
          <input
            value={filters.search}
            onChange={(event) => onUpdateFilter('search', event.target.value)}
            placeholder="Tedarikçi kodu, unvan, belge no"
          />
        </label>
        <label>
          Başlangıç
          <input type="date" value={filters.dateFrom} onChange={(event) => onUpdateFilter('dateFrom', event.target.value)} />
        </label>
        <label>
          Bitiş
          <input type="date" value={filters.dateTo} onChange={(event) => onUpdateFilter('dateTo', event.target.value)} />
        </label>
        <button type="button" className="ghost-button" onClick={onReset}>Temizle</button>
        <button type="button" onClick={onExport}>Excel</button>
        <button type="button" onClick={onPrint}>Yazdır / PDF</button>
      </div>
    </>
  );
}
