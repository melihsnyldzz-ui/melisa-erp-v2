import React, { useEffect, useMemo, useState } from 'react';
import { fetchCustomers } from '../../services/customerApi.js';
import { fetchCustomerMovements } from '../../services/movementApi.js';
import { exportRowsToCsv, printRowsReport } from '../../utils/exportUtils.js';
import { openLedgerTarget } from '../shared/ledgerNavigation.js';

const cashCustomerDefinitions = [
  { code: 'PESIN-TL', label: 'Peşin TL', currency: 'TRY', tone: 'try' },
  { code: 'PESIN-USD', label: 'Peşin USD', currency: 'USD', tone: 'usd' },
  { code: 'PESIN-EUR', label: 'Peşin EUR', currency: 'EUR', tone: 'eur' },
];

function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function movementLabel(type) {
  const labels = {
    sales_invoice: 'Satış fişi',
    sales_invoice_cancel: 'Satış iptal',
    collection: 'Tahsilat',
    payment: 'Ödeme',
  };

  return labels[type] || type || '-';
}

function summarizeRows(rows) {
  return rows.reduce((summary, row) => {
    const effect = Number(row.balanceEffect || row.amount || 0);
    if (effect >= 0) {
      summary.debit += effect;
    } else {
      summary.credit += Math.abs(effect);
    }
    summary.balance += effect;
    return summary;
  }, { debit: 0, credit: 0, balance: 0 });
}

export function CashCustomerTrackingScreen({ onOpenScreen }) {
  const [selectedCode, setSelectedCode] = useState('PESIN-TL');
  const [cashCustomers, setCashCustomers] = useState([]);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const selectedDefinition = cashCustomerDefinitions.find((item) => item.code === selectedCode) || cashCustomerDefinitions[0];
  const selectedCustomer = cashCustomers.find((customer) => customer.customerCode === selectedCode);

  const query = useMemo(() => ({
    page: 1,
    limit: 100,
    search: selectedCode,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  }), [filters.dateFrom, filters.dateTo, selectedCode]);

  useEffect(() => {
    let isMounted = true;

    async function loadCashCustomers() {
      try {
        const response = await fetchCustomers({ page: 1, limit: 10, search: 'PESIN', activeOnly: true });
        if (isMounted) {
          setCashCustomers(response.data || []);
        }
      } catch (error) {
        if (isMounted) {
          setCashCustomers([]);
          setErrorMessage(error.message || 'Peşin cariler okunamadı.');
        }
      }
    }

    loadCashCustomers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadRows() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchCustomerMovements(query);
        if (isMounted) {
          setRows(response.data || []);
          setMeta(response.meta || null);
        }
      } catch (error) {
        if (isMounted) {
          setRows([]);
          setMeta(null);
          setErrorMessage(error.message || 'Peşin cari hareketleri okunamadı.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadRows();

    return () => {
      isMounted = false;
    };
  }, [query]);

  const totals = summarizeRows(rows);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function openCashCustomerCard(customer = selectedCustomer) {
    if (!customer?.id) {
      return;
    }
    onOpenScreen?.('customer-card', { customerId: customer.id, customerCode: customer.customerCode });
  }

  function openMovement(row) {
    openLedgerTarget(row, onOpenScreen);
  }

  function exportRows() {
    exportRowsToCsv({
      filename: `pesin-cari-${selectedCode.toLowerCase()}`,
      rows,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Cari Kodu', key: 'customerCode' },
        { label: 'Cari', key: 'customerName' },
        { label: 'Belge No', key: 'documentNo' },
        { label: 'İşlem', value: (row) => movementLabel(row.movementType) },
        { label: 'Borç', value: (row) => Number(row.balanceEffect || 0) >= 0 ? row.balanceEffect : '' },
        { label: 'Alacak', value: (row) => Number(row.balanceEffect || 0) < 0 ? Math.abs(Number(row.balanceEffect || 0)) : '' },
        { label: 'Para Birimi', key: 'currency' },
        { label: 'Durum', key: 'invoiceStatus' },
      ],
    });
  }

  function printRows() {
    printRowsReport({
      title: `Melisa ERP - ${selectedDefinition.label} hareketleri`,
      subtitle: `${rows.length} hareket / ${filters.dateFrom || '-'} - ${filters.dateTo || '-'}`,
      rows,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Cari', key: 'customerName' },
        { label: 'Belge No', key: 'documentNo' },
        { label: 'İşlem', value: (row) => movementLabel(row.movementType) },
        { label: 'Borç', value: (row) => Number(row.balanceEffect || 0) >= 0 ? formatMoney(row.balanceEffect, row.currency) : '' },
        { label: 'Alacak', value: (row) => Number(row.balanceEffect || 0) < 0 ? formatMoney(Math.abs(Number(row.balanceEffect || 0)), row.currency) : '' },
        { label: 'Durum', key: 'invoiceStatus' },
      ],
    });
  }

  return (
    <main className="work-area cash-customer-screen">
      <section className="erp-panel cash-customer-hero">
        <div className="panel-title">
          <strong>Peşin Cari Takibi</strong>
          <span>Genel müşteriler Peşin TL / USD / EUR carilerinde izlenir</span>
        </div>
        <div className="cash-customer-big-buttons">
          {cashCustomerDefinitions.map((definition) => {
            const customer = cashCustomers.find((item) => item.customerCode === definition.code);
            const isSelected = selectedCode === definition.code;
            return (
              <button
                className={isSelected ? `cash-customer-big-button ${definition.tone} active` : `cash-customer-big-button ${definition.tone}`}
                key={definition.code}
                type="button"
                onClick={() => setSelectedCode(definition.code)}
              >
                <span>{definition.label}</span>
                <strong>{formatMoney(customer?.balance || 0, definition.currency)}</strong>
                <small>{definition.code} / {customer ? 'Kart açık' : 'Kart bekleniyor'}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="summary-strip cash-customer-summary-strip">
        <article className="summary-card">
          <span>Seçili peşin cari</span>
          <strong>{selectedCustomer?.customerName || selectedDefinition.label}</strong>
          <small>{selectedCode} / {selectedDefinition.currency}</small>
        </article>
        <article className="summary-card">
          <span>Satış borcu</span>
          <strong className="ledger-out">{formatMoney(totals.debit, selectedDefinition.currency)}</strong>
          <small>Satış fişi hareketleri</small>
        </article>
        <article className="summary-card">
          <span>Tahsilat</span>
          <strong className="ledger-in">{formatMoney(totals.credit, selectedDefinition.currency)}</strong>
          <small>Otomatik veya manuel tahsilat</small>
        </article>
        <article className="summary-card">
          <span>Kalan bakiye</span>
          <strong>{formatMoney(totals.balance, selectedDefinition.currency)}</strong>
          <small>Peşinde ideal hedef: 0</small>
        </article>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>{selectedDefinition.label} Hareketleri</strong>
          <span>{meta?.total ?? rows.length} hareket / tıklayınca ilgili işlem açılır</span>
        </div>
        <div className="filter-grid">
          <label>
            Başlangıç
            <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
          </label>
          <label>
            Bitiş
            <input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
          </label>
          <button type="button" className="ghost-button" onClick={() => setFilters({ dateFrom: '', dateTo: '' })}>Temizle</button>
          <button type="button" onClick={() => openCashCustomerCard()}>Cari Kartına Git</button>
          <button type="button" onClick={exportRows}>Excel</button>
          <button type="button" onClick={printRows}>Yazdır / PDF</button>
        </div>

        {isLoading && <div className="list-state">Peşin cari hareketleri yükleniyor...</div>}
        {!isLoading && errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {!isLoading && !errorMessage && rows.length === 0 && <div className="list-state">Bu peşin caride hareket yok.</div>}
        {!isLoading && !errorMessage && rows.length > 0 && (
          <div className="table-shell cash-customer-table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Cari</th>
                  <th>Belge No</th>
                  <th>İşlem</th>
                  <th>Borç</th>
                  <th>Alacak</th>
                  <th>PB</th>
                  <th>Durum</th>
                  <th>Git</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const effect = Number(row.balanceEffect || row.amount || 0);
                  return (
                    <tr className="clickable-row" key={row.id} onClick={() => openMovement(row)}>
                      <td>{row.documentDate || '-'}</td>
                      <td>{row.customerName || row.customerCode || '-'}</td>
                      <td>{row.documentNo || '-'}</td>
                      <td>{movementLabel(row.movementType)}</td>
                      <td className="ledger-out">{effect >= 0 ? formatMoney(effect, row.currency) : '-'}</td>
                      <td className="ledger-in">{effect < 0 ? formatMoney(Math.abs(effect), row.currency) : '-'}</td>
                      <td><span className="status-pill">{row.currency || selectedDefinition.currency}</span></td>
                      <td>{String(row.invoiceStatus || '-').toUpperCase()}</td>
                      <td>
                        <button
                          type="button"
                          className="mini-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openMovement(row);
                          }}
                        >
                          Git
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
