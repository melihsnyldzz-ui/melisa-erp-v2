import React, { useEffect, useMemo, useState } from 'react';
import { fetchSupplierStatement } from '../../services/movementApi.js';
import { fetchSuppliers } from '../../services/supplierApi.js';
import { exportRowsToCsv, printLedgerStatement } from '../../utils/exportUtils.js';
import { openLedgerTarget } from '../shared/ledgerNavigation.js';
import { SupplierStatement360Card } from './SupplierStatement360Card.jsx';
import { SupplierStatementFilters } from './SupplierStatementFilters.jsx';
import { SupplierCancelledStatementTable, SupplierStatementRowsTable, SupplierStatementSummaryStrip } from './SupplierStatementTables.jsx';
import {
  buildSupplier360,
  displayMovementLabel,
  formatMoney,
  isCancelledMovement,
  normalizeSupplierSearch,
  summarizeRows,
  toSupplierSuggestion,
} from './supplierStatementUtils.js';

export function SupplierStatementScreen({ onOpenScreen }) {
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    showCancelled: true,
  });
  const [statement, setStatement] = useState({ rows: [], totals: [] });
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const normalizedSearch = useMemo(
    () => normalizeSupplierSearch(filters.search, supplierSuggestions),
    [filters.search, supplierSuggestions],
  );

  const query = useMemo(() => ({
    limit: 250,
    search: normalizedSearch,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  }), [filters.dateFrom, filters.dateTo, normalizedSearch]);

  useEffect(() => {
    let isMounted = true;

    async function loadSupplierSuggestions() {
      try {
        const response = await fetchSuppliers({
          page: 1,
          limit: 120,
          search: normalizedSearch,
          activeOnly: false,
        });

        if (isMounted) {
          setSupplierSuggestions((response.data || []).map(toSupplierSuggestion).filter((supplier) => supplier.label));
        }
      } catch (_error) {
        if (isMounted) {
          setSupplierSuggestions([]);
        }
      }
    }

    loadSupplierSuggestions();

    return () => {
      isMounted = false;
    };
  }, [normalizedSearch]);

  useEffect(() => {
    let isMounted = true;

    async function loadStatement() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchSupplierStatement(query);
        if (isMounted) {
          setStatement(response.data || { rows: [], totals: [] });
        }
      } catch (error) {
        if (isMounted) {
          setStatement({ rows: [], totals: [] });
          setErrorMessage(error.message || 'Tedarikçi ekstresi okunamadı.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadStatement();

    return () => {
      isMounted = false;
    };
  }, [query]);

  const rows = statement.rows || [];
  const regularRows = useMemo(() => rows.filter((row) => !isCancelledMovement(row)), [rows]);
  const cancelledRows = useMemo(() => rows.filter(isCancelledMovement), [rows]);
  const totals = useMemo(() => summarizeRows(regularRows), [regularRows]);
  const cancelledTotals = useMemo(() => summarizeRows(cancelledRows), [cancelledRows]);
  const supplier360 = useMemo(
    () => buildSupplier360(rows, regularRows, cancelledRows, totals),
    [cancelledRows, regularRows, rows, totals],
  );
  const mergedSupplierSuggestions = useMemo(() => {
    const suggestionMap = new Map();

    [...supplierSuggestions, ...supplier360.supplierSuggestions].forEach((supplier) => {
      const key = supplier.code || supplier.label || supplier.key;
      if (key && !suggestionMap.has(key)) {
        suggestionMap.set(key, supplier);
      }
    });

    return [...suggestionMap.values()].slice(0, 80);
  }, [supplier360.supplierSuggestions, supplierSuggestions]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters({ search: '', dateFrom: '', dateTo: '', showCancelled: true });
  }

  function openMovement(row) {
    openLedgerTarget(row, onOpenScreen);
  }

  function openSupplier(row) {
    if (row.supplierId) {
      onOpenScreen?.('supplier-card', {
        supplierId: row.supplierId,
        supplierCode: row.supplierCode,
        tabLabel: row.supplierName || row.supplierCode || 'Tedarikçi Kart',
      });
    }
  }

  function exportStatementRows() {
    exportRowsToCsv({
      filename: 'tedarikci-cari-ekstre',
      rows: [...regularRows, ...(filters.showCancelled ? cancelledRows : [])],
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Tedarikçi', value: (row) => row.supplierName || row.supplierCode || '-' },
        { label: 'Belge No', key: 'documentNo' },
        { label: 'İşlem', value: (row) => displayMovementLabel(row) },
        { label: 'Tutar', key: 'amount' },
        { label: 'Bakiye Etkisi', key: 'balanceEffect' },
        { label: 'Para Birimi', key: 'currency' },
      ],
    });
  }

  function printStatement() {
    printLedgerStatement({
      title: 'Tedarikci Cari Ekstre',
      partyLabel: 'Tedarikci',
      filters,
      rows: regularRows,
      cancelledRows: filters.showCancelled ? cancelledRows : [],
      totals,
      cancelledTotals,
      movementLabel: displayMovementLabel,
      partyKey: 'supplierName',
      debitWhenPositive: false,
    });
  }

  return (
    <main className="work-area supplier-ledger-screen">
      <section className="erp-panel">
        <div className="panel-title">
          <strong>Tedarikci Cari Ekstre</strong>
          <span>Alis, odeme, bakiye ve iptal izleri / Normal: {regularRows.length} / Iptal: {cancelledRows.length}</span>
        </div>
        <SupplierStatement360Card
          supplier360={supplier360}
          filters={filters}
          suggestions={mergedSupplierSuggestions}
          onUpdateFilter={updateFilter}
          onExport={exportStatementRows}
          onPrint={printStatement}
          onOpenSupplier={openSupplier}
          onOpenMovement={openMovement}
        />
        <SupplierStatementFilters
          filters={filters}
          onUpdateFilter={updateFilter}
          onReset={resetFilters}
          onExport={exportStatementRows}
          onPrint={printStatement}
        />
      </section>

      <SupplierStatementSummaryStrip totals={totals} />

      <SupplierCancelledStatementTable
        showCancelled={filters.showCancelled}
        cancelledRows={cancelledRows}
        cancelledTotals={cancelledTotals}
        onOpenMovement={openMovement}
        onOpenSupplier={openSupplier}
      />

      <SupplierStatementRowsTable
        rows={rows}
        regularRows={regularRows}
        cancelledRows={cancelledRows}
        showCancelled={filters.showCancelled}
        isLoading={isLoading}
        errorMessage={errorMessage}
        onOpenMovement={openMovement}
        onOpenSupplier={openSupplier}
      />
    </main>
  );
}
