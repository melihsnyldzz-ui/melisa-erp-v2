import React, { useState } from 'react';

const statusOptions = [
  ['ALL', 'Tümü'],
  ['DRAFT', 'Taslak'],
  ['FINALIZED', 'Kesinleşmiş'],
  ['CANCELLED', 'İptal'],
  ['ARCHIVED_TEST', 'Test Arşivi'],
];

export function InvoiceListAdvancedFilters({
  status,
  onStatusChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  currency,
  onCurrencyChange,
  amountMin,
  onAmountMinChange,
  amountMax,
  onAmountMaxChange,
  employee = '',
  onEmployeeChange,
  terminal = '',
  onTerminalChange,
  party = '',
  partyLabel = 'Cari',
  onPartyChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const activeCount = [
    status !== 'ALL' ? status : '',
    dateFrom,
    dateTo,
    currency !== 'ALL' ? currency : '',
    amountMin,
    amountMax,
    employee,
    terminal,
    party,
  ].filter(Boolean).length;
  const activeSummary = [
    dateFrom || dateTo ? `${dateFrom || 'Başlangıç yok'} – ${dateTo || 'Bitiş yok'}` : '',
    status !== 'ALL' ? statusOptions.find(([value]) => value === status)?.[1] : '',
    currency !== 'ALL' ? currency : '',
    party ? `${partyLabel}: ${party}` : '',
  ].filter(Boolean).join(' · ');

  return (
    <section className={isOpen ? 'invoice-advanced-search open' : 'invoice-advanced-search'}>
      <button
        aria-expanded={isOpen}
        className="invoice-advanced-search-toggle"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span>Detaylı Arama</span>
        <small>{activeCount > 0 ? `${activeCount} kriter aktif${activeSummary ? ` · ${activeSummary}` : ''}` : 'Cari, durum, tarih, para birimi ve tutar'}</small>
      </button>
      {isOpen && <div className="invoice-advanced-search-grid">
        {onPartyChange && <label>
          <span>{partyLabel}</span>
          <input value={party} onChange={(event) => onPartyChange(event.target.value)} placeholder={`${partyLabel} adı veya kodu`} />
        </label>}
        <label>
          <span>Durum</span>
          <select value={status} onChange={(event) => onStatusChange(event.target.value)}>
            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Başlangıç tarihi</span>
          <input max={dateTo || undefined} type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} />
        </label>
        <label>
          <span>Bitiş tarihi</span>
          <input min={dateFrom || undefined} type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} />
        </label>
        <label>
          <span>Para birimi</span>
          <select value={currency} onChange={(event) => onCurrencyChange(event.target.value)}>
            <option value="ALL">Tümü</option>
            <option value="TRY">TRY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label>
          <span>Minimum tutar</span>
          <input min="0" step="0.01" type="number" value={amountMin} onChange={(event) => onAmountMinChange(event.target.value)} placeholder="0,00" />
        </label>
        <label>
          <span>Maksimum tutar</span>
          <input min={amountMin || '0'} step="0.01" type="number" value={amountMax} onChange={(event) => onAmountMaxChange(event.target.value)} placeholder="Sınırsız" />
        </label>
        {onEmployeeChange && (
          <label>
            <span>Personel</span>
            <input value={employee} onChange={(event) => onEmployeeChange(event.target.value)} placeholder="Personel adı" />
          </label>
        )}
        {onTerminalChange && (
          <label>
            <span>Terminal</span>
            <input value={terminal} onChange={(event) => onTerminalChange(event.target.value)} placeholder="Terminal kodu" />
          </label>
        )}
      </div>}
    </section>
  );
}
