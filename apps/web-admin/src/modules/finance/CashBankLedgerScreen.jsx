import React, { useEffect, useMemo, useState } from 'react';
import {
  applyFinanceAccountCleanup,
  applyFinanceAccountStandardization,
  createFinanceAccount,
  fetchFinanceAccountCleanupPreview,
  fetchFinanceAccounts,
  fetchFinanceMovements,
  updateFinanceAccount,
} from '../../services/financeApi.js';
import { exportRowsToExcel, printFinanceReceipt, printRowsReport } from '../../utils/exportUtils.js';
import { openLedgerTarget } from '../shared/ledgerNavigation.js';

function formatMoney(value, currency = 'TRY') {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatCurrencyTotals(totals, key = 'net') {
  const entries = Object.entries(totals || {});
  if (entries.length === 0) return formatMoney(0);
  return entries
    .map(([currency, value]) => {
      const amount = typeof value === 'number' ? value : Number(value?.[key] || 0);
      return formatMoney(amount, currency);
    })
    .join(' / ');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function accountLabel(row) {
  if (row.accountCode || row.accountName) return `${row.accountCode || '-'} / ${row.accountName || '-'}`;
  if (row.movementType === 'collection') return 'Hesap atanmamış tahsilat';
  if (row.movementType === 'payment') return 'Hesap atanmamış ödeme';
  return 'Hesap dışı';
}

function directionLabel(row) {
  if (row.movementType === 'collection') return 'Giriş';
  if (row.movementType === 'payment') return 'Çıkış';
  return '-';
}

function partyLabel(row) {
  return row.partyType === 'supplier' ? 'Tedarikçi' : 'Müşteri';
}

function movementLabel(type) {
  const labels = {
    collection: 'Tahsilat',
    payment: 'Ödeme',
  };
  return labels[type] || type || '-';
}

function buildReceipt(row) {
  const isPayment = row.movementType === 'payment';
  return {
    receiptNo: row.documentNo || `${isPayment ? 'OD' : 'TH'}-${row.id}`,
    type: isPayment ? 'Ödeme Makbuzu' : 'Tahsilat Makbuzu',
    partyType: row.partyType,
    partyCode: row.partyCode,
    partyName: row.partyName,
    documentDate: row.documentDate,
    amount: row.amount,
    currency: row.currency,
    paymentMethod: row.paymentMethod || '-',
    accountLabel: accountLabel(row),
    balanceEffect: row.balanceEffect,
    source: row.accountCode ? `${row.accountCode} / ${row.accountName || ''}` : 'Kasa/Banka Defteri',
    description: `${row.documentNo || ''} finans hareketinden üretilen makbuz`,
  };
}

function standardAccountCode(type, currency) {
  const prefixMap = {
    cash: 'KASA',
    bank: 'BANKA',
    card: 'POS',
    other: 'DIGER',
  };
  return `${prefixMap[type] || String(type || '').toUpperCase()}-${currency || 'TRY'}`;
}

function accountGroupKey(account) {
  return `${account.type || 'other'}-${account.currency || 'TRY'}`;
}

export function CashBankLedgerScreen({ onOpenScreen }) {
  const [accounts, setAccounts] = useState([]);
  const [filters, setFilters] = useState({
    dateFrom: monthStart(),
    dateTo: today(),
    movementType: '',
    accountId: '',
    accountType: '',
    paymentMethod: '',
    currency: '',
    search: '',
  });
  const [newAccount, setNewAccount] = useState({
    code: '',
    name: '',
    type: 'cash',
    currency: 'TRY',
    openingBalance: '0',
  });
  const [rows, setRows] = useState([]);
  const [cleanupPreview, setCleanupPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccountSaving, setIsAccountSaving] = useState(false);
  const [isCleanupSaving, setIsCleanupSaving] = useState(false);
  const [isStandardizing, setIsStandardizing] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function loadLedger(nextFilters = filters) {
    setIsLoading(true);
    setMessage('');
    setErrorMessage('');

    try {
      const [accountResponse, cleanupResponse] = await Promise.all([
        fetchFinanceAccounts({ includePassive: true }),
        fetchFinanceAccountCleanupPreview().catch(() => ({ data: null })),
      ]);
      const movementTypes = nextFilters.movementType ? [nextFilters.movementType] : ['collection', 'payment'];
      const responses = await Promise.all(movementTypes.map((movementType) => fetchFinanceMovements({
        limit: 200,
        movementType,
        accountId: nextFilters.accountId || undefined,
        accountType: nextFilters.accountType || undefined,
        paymentMethod: nextFilters.paymentMethod || undefined,
        currency: nextFilters.currency || undefined,
        dateFrom: nextFilters.dateFrom || undefined,
        dateTo: nextFilters.dateTo || undefined,
        search: nextFilters.search || undefined,
      })));

      const combinedRows = responses
        .flatMap((response) => response.data || [])
        .sort((a, b) => `${b.documentDate || ''}${b.createdAt || ''}`.localeCompare(`${a.documentDate || ''}${a.createdAt || ''}`));

      setAccounts(accountResponse.data || []);
      setCleanupPreview(cleanupResponse.data || null);
      setRows(combinedRows);
    } catch (error) {
      setAccounts([]);
      setCleanupPreview(null);
      setRows([]);
      setErrorMessage(`${error.message || 'Kasa/banka hareketleri okunamadi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLedger();
  }, []);

  const summary = useMemo(() => rows.reduce((total, row) => {
    const amount = Number(row.amount || 0);
    return {
      collectionCount: total.collectionCount + (row.movementType === 'collection' ? 1 : 0),
      paymentCount: total.paymentCount + (row.movementType === 'payment' ? 1 : 0),
      cashIn: total.cashIn + (row.movementType === 'collection' ? amount : 0),
      cashOut: total.cashOut + (row.movementType === 'payment' ? amount : 0),
    };
  }, {
    collectionCount: 0,
    paymentCount: 0,
    cashIn: 0,
    cashOut: 0,
  }), [rows]);

  const accountTotals = useMemo(() => accounts.reduce((totals, account) => {
    const currency = account.currency || 'TRY';
    totals[currency] = (totals[currency] || 0) + Number(account.currentBalance || 0);
    return totals;
  }, {}), [accounts]);

  const selectedAccount = useMemo(() => (
    accounts.find((account) => String(account.id) === String(filters.accountId)) || null
  ), [accounts, filters.accountId]);

  const accountUsage = useMemo(() => rows.reduce((usage, row) => {
    if (!row.accountId) return usage;
    const key = String(row.accountId);
    usage[key] = usage[key] || { movementCount: 0, in: 0, out: 0 };
    usage[key].movementCount += 1;
    if (row.movementType === 'collection') usage[key].in += Number(row.amount || 0);
    if (row.movementType === 'payment') usage[key].out += Number(row.amount || 0);
    return usage;
  }, {}), [rows]);

  const accountGroups = useMemo(() => accounts.reduce((groups, account) => {
    const key = accountGroupKey(account);
    groups[key] = groups[key] || [];
    groups[key].push(account);
    return groups;
  }, {}), [accounts]);

  const duplicateAccountCount = useMemo(() => Object.values(accountGroups)
    .reduce((count, group) => count + Math.max(group.filter((account) => account.isActive).length - 1, 0), 0), [accountGroups]);

  const rowCurrencyTotals = useMemo(() => rows.reduce((totals, row) => {
    const currency = row.currency || 'TRY';
    totals[currency] = totals[currency] || { in: 0, out: 0, net: 0 };
    const amount = Number(row.amount || 0);
    if (row.movementType === 'collection') {
      totals[currency].in += amount;
      totals[currency].net += amount;
    }
    if (row.movementType === 'payment') {
      totals[currency].out += amount;
      totals[currency].net -= amount;
    }
    return totals;
  }, {}), [rows]);

  const netBalance = summary.cashIn - summary.cashOut;
  const cashInText = formatCurrencyTotals(rowCurrencyTotals, 'in');
  const cashOutText = formatCurrencyTotals(rowCurrencyTotals, 'out');
  const netFlowText = formatCurrencyTotals(rowCurrencyTotals, 'net');
  const accountBalanceText = formatCurrencyTotals(accountTotals);
  const cleanupSummary = cleanupPreview?.summary || {};
  const safeCleanupCount = Number(cleanupSummary.safeCandidateCount || 0);
  const standardizationCount = Number(cleanupSummary.standardizationCandidateCount || 0);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(event) {
    event.preventDefault();
    loadLedger(filters);
  }

  function clearFilters() {
    const cleanFilters = {
      dateFrom: monthStart(),
      dateTo: today(),
      movementType: '',
      accountId: '',
      accountType: '',
      paymentMethod: '',
      currency: '',
      search: '',
    };
    setFilters(cleanFilters);
    loadLedger(cleanFilters);
  }

  function updateNewAccount(key, value) {
    setNewAccount((current) => {
      const next = { ...current, [key]: value };
      if (key === 'type' || key === 'currency') {
        const previousStandard = standardAccountCode(current.type, current.currency);
        if (!current.code.trim() || current.code === previousStandard) {
          next.code = standardAccountCode(next.type, next.currency);
        }
        if (!current.name.trim() || current.name === `${current.currency} Ana Kasa` || current.name === `${current.currency} Banka Hesabi` || current.name === `${current.currency} POS / Kart Hesabi`) {
          const nameMap = {
            cash: `${next.currency} Ana Kasa`,
            bank: `${next.currency} Banka Hesabi`,
            card: `${next.currency} POS / Kart Hesabi`,
            other: `${next.currency} Diger Finans Hesabi`,
          };
          next.name = nameMap[next.type] || `${next.currency} Finans Hesabi`;
        }
      }
      return next;
    });
    setMessage('');
  }

  function focusAccount(account) {
    const nextFilters = { ...filters, accountId: String(account.id) };
    setFilters(nextFilters);
    loadLedger(nextFilters);
  }

  async function toggleAccountActive(account) {
    setIsAccountSaving(true);
    setMessage('');
    setErrorMessage('');

    try {
      await updateFinanceAccount(account.id, {
        name: account.name,
        isActive: !account.isActive,
      });
      setMessage(`${account.code} hesabı ${account.isActive ? 'pasife alındı' : 'aktif edildi'}.`);
      await loadLedger(filters);
    } catch (error) {
      setErrorMessage(`${error.message || 'Hesap durumu güncellenemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsAccountSaving(false);
    }
  }

  async function runSafeCleanup() {
    setIsCleanupSaving(true);
    setMessage('');
    setErrorMessage('');

    try {
      const response = await applyFinanceAccountCleanup();
      const deactivatedCount = Number(response.data?.deactivatedCount || 0);
      setMessage(deactivatedCount > 0
        ? `${deactivatedCount} güvenli kasa/banka hesabı pasife alındı.`
        : 'Pasife alınacak güvenli kasa/banka hesabı bulunamadı.');
      await loadLedger(filters);
    } catch (error) {
      setErrorMessage(`${error.message || 'Güvenli hesap temizliği yapılamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsCleanupSaving(false);
    }
  }

  async function runAccountStandardization() {
    setIsStandardizing(true);
    setMessage('');
    setErrorMessage('');

    try {
      const response = await applyFinanceAccountStandardization();
      const transferredCount = Number(response.data?.transferredCount || 0);
      setMessage(transferredCount > 0
        ? `${transferredCount} finans hesabı standart hesaba aktarıldı.`
        : 'Standarda aktarılacak finans hesabı bulunamadı.');
      await loadLedger(filters);
    } catch (error) {
      setErrorMessage(`${error.message || 'Finans hesapları standartlaştırılamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsStandardizing(false);
    }
  }

  async function saveNewAccount(event) {
    event.preventDefault();
    setIsAccountSaving(true);
    setMessage('');
    setErrorMessage('');

    try {
      await createFinanceAccount({
        ...newAccount,
        openingBalance: Number(newAccount.openingBalance || 0),
      });
      setNewAccount({
        code: '',
        name: '',
        type: 'cash',
        currency: 'TRY',
        openingBalance: '0',
      });
      setMessage('Kasa/Banka hesabi olusturuldu.');
      await loadLedger(filters);
    } catch (error) {
      setErrorMessage(`${error.message || 'Hesap olusturulamadi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsAccountSaving(false);
    }
  }

  function openMovement(row) {
    openLedgerTarget(row, onOpenScreen);
  }

  function printLedgerReceipt(row) {
    printFinanceReceipt(buildReceipt(row));
  }

  function exportLedger() {
    exportRowsToExcel({
      filename: 'kasa-banka-defteri',
      title: 'Kasa Banka Defteri',
      rows,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Yön', value: directionLabel },
        { label: 'Hesap ID', key: 'accountId' },
        { label: 'Hesap', value: accountLabel },
        { label: 'Hesap Tipi', key: 'accountType' },
        { label: 'Ödeme Yöntemi', key: 'paymentMethod' },
        { label: 'Cari Türü', value: partyLabel },
        { label: 'Cari Kod', key: 'partyCode' },
        { label: 'Cari Ad', key: 'partyName' },
        { label: 'Belge', key: 'documentNo' },
        { label: 'İşlem', value: (row) => movementLabel(row.movementType) },
        { label: 'Tutar', key: 'amount' },
        { label: 'Para Birimi', key: 'currency' },
      ],
    });
  }

  function printLedger() {
    printRowsReport({
      title: 'Melisa ERP - Kasa Banka Defteri',
      subtitle: `${rows.length} finans hareketi / net ${netFlowText}`,
      rows,
      columns: [
        { label: 'Tarih', key: 'documentDate' },
        { label: 'Yön', value: directionLabel },
        { label: 'Hesap', value: accountLabel },
        { label: 'Hesap Tipi', key: 'accountType' },
        { label: 'Ödeme Yöntemi', key: 'paymentMethod' },
        { label: 'Cari Türü', value: partyLabel },
        { label: 'Cari Kod', key: 'partyCode' },
        { label: 'Cari Ad', key: 'partyName' },
        { label: 'Belge', key: 'documentNo' },
        { label: 'İşlem', value: (row) => movementLabel(row.movementType) },
        { label: 'Tutar', key: 'amount' },
        { label: 'Para Birimi', key: 'currency' },
      ],
    });
  }

  return (
    <main className="work-area cash-bank-ledger-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Kasa / Banka Defteri</strong>
          <span>Kalıcı kasa/banka hesap kartları ve tahsilat/ödeme defteri</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" className="primary" onClick={() => onOpenScreen?.('collections-overview')}>Tahsilat / Ödeme Gir</button>
          <button type="button" onClick={exportLedger}>Excel</button>
          <button type="button" onClick={printLedger}>Yazdır</button>
          <button type="button" onClick={() => loadLedger(filters)}>Yenile</button>
        </div>
      </section>

      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
      {message && <div className="list-state list-state-success">{message}</div>}

      <section className="dashboard-kpi-grid finance-mini-grid">
        <article className="dashboard-kpi good">
          <span>Giriş</span>
          <strong>{cashInText}</strong>
          <small>{summary.collectionCount} tahsilat hareketi</small>
        </article>
        <article className="dashboard-kpi danger">
          <span>Çıkış</span>
          <strong>{cashOutText}</strong>
          <small>{summary.paymentCount} ödeme hareketi</small>
        </article>
        <article className={`dashboard-kpi ${netBalance >= 0 ? 'good' : 'danger'}`}>
          <span>Net nakit akışı</span>
          <strong>{netFlowText}</strong>
          <small>Giriş eksi çıkış</small>
        </article>
        <article className="dashboard-kpi info">
          <span>Hesap bakiyesi</span>
          <strong>{accountBalanceText}</strong>
          <small>Aktif hesap toplamı</small>
        </article>
        <article className="dashboard-kpi info">
          <span>Seçili hesap</span>
          <strong>{selectedAccount ? formatMoney(selectedAccount.currentBalance, selectedAccount.currency) : 'Tümü'}</strong>
          <small>{selectedAccount ? `${selectedAccount.code} / ${selectedAccount.name}` : 'Hesap filtresi yok'}</small>
        </article>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Para Birimi Bazlı Nakit Özeti</strong>
          <span>Seçili filtreye göre giriş, çıkış ve net akış</span>
        </div>
        <div className="currency-summary-grid">
          {Object.entries(rowCurrencyTotals).map(([currency, total]) => (
            <article className="currency-summary-card" key={currency}>
              <strong>{currency}</strong>
              <span className="ledger-credit">Giriş: {formatMoney(total.in, currency)}</span>
              <span className="ledger-debit">Çıkış: {formatMoney(total.out, currency)}</span>
              <span>Net: {formatMoney(total.net, currency)}</span>
            </article>
          ))}
          {Object.keys(rowCurrencyTotals).length === 0 && <div className="list-state">Seçili filtrede nakit hareketi yok.</div>}
        </div>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Kasa / Banka Hesap Kartlari</strong>
          <span>{accounts.length} hesap / {duplicateAccountCount} aktif mükerrer hesap uyarısı</span>
        </div>
        {duplicateAccountCount > 0 && (
          <div className="list-state list-state-warning">
            Aynı tip ve para biriminde birden fazla aktif hesap var. Güvenli temizlik sadece hareketi olmayan, bakiyesi sıfır ve standart dışı hesapları pasife alır.
            <div className="finance-cleanup-actions">
              <strong>Güvenli aday: {safeCleanupCount}</strong>
              <strong>Standarda aktarılacak: {standardizationCount}</strong>
              <button type="button" className="primary" disabled={isCleanupSaving || safeCleanupCount === 0} onClick={runSafeCleanup}>
                {isCleanupSaving ? 'Temizleniyor...' : 'Güvenli Temizle'}
              </button>
              <button type="button" disabled={isStandardizing || standardizationCount === 0} onClick={runAccountStandardization}>
                {isStandardizing ? 'Aktarılıyor...' : 'Standarda Aktar'}
              </button>
            </div>
          </div>
        )}
        <div className="finance-account-grid">
          {accounts.map((account) => {
            const expectedCode = standardAccountCode(account.type, account.currency);
            const isStandard = account.code === expectedCode;
            const activeSiblings = (accountGroups[accountGroupKey(account)] || []).filter((item) => item.isActive);
            const isDuplicate = account.isActive && activeSiblings.length > 1;
            const usage = accountUsage[String(account.id)] || { movementCount: 0, in: 0, out: 0 };
            return (
              <article className={`finance-account-card ${account.isActive ? 'active' : 'passive'} ${isDuplicate ? 'duplicate' : ''}`} key={account.id}>
                <div className="finance-account-card-head">
                  <span>{account.type} / {account.currency}</span>
                  <span className={`status-pill ${account.isActive ? 'success' : 'passive'}`}>{account.isActive ? 'Aktif' : 'Pasif'}</span>
                </div>
                <strong>{account.code} / {account.name}</strong>
                <small>{formatMoney(account.currentBalance, account.currency)}</small>
                <div className="finance-account-meta">
                  <span className={`status-pill ${isStandard ? 'success' : 'warning'}`}>
                    {isStandard ? 'Standart kod' : `Önerilen: ${expectedCode}`}
                  </span>
                  {isDuplicate && <span className="status-pill danger">Mükerrer aktif</span>}
                  <span className="status-pill">{usage.movementCount} hareket</span>
                </div>
                <div className="finance-account-flow">
                  <span className="ledger-credit">Giriş {formatMoney(usage.in, account.currency)}</span>
                  <span className="ledger-debit">Çıkış {formatMoney(usage.out, account.currency)}</span>
                </div>
                <div className="segmented-control">
                  <button type="button" onClick={() => focusAccount(account)}>Filtrele</button>
                  <button type="button" disabled={isAccountSaving} onClick={() => toggleAccountActive(account)}>
                    {account.isActive ? 'Pasife Al' : 'Aktif Et'}
                  </button>
                </div>
              </article>
            );
          })}
          {accounts.length === 0 && <div className="list-state">Kasa/banka hesabi yok.</div>}
        </div>
        <form className="filter-grid finance-account-create" onSubmit={saveNewAccount}>
          <label>
            Hesap Kodu
            <input value={newAccount.code} onChange={(event) => updateNewAccount('code', event.target.value)} placeholder="KASA-USD" />
          </label>
          <label>
            Hesap Adi
            <input value={newAccount.name} onChange={(event) => updateNewAccount('name', event.target.value)} placeholder="USD Ana Kasa" />
          </label>
          <label>
            Tip
            <select value={newAccount.type} onChange={(event) => updateNewAccount('type', event.target.value)}>
              <option value="cash">Kasa</option>
              <option value="bank">Banka</option>
              <option value="card">POS/Kart</option>
              <option value="other">Diğer</option>
            </select>
          </label>
          <label>
            Para Birimi
            <select value={newAccount.currency} onChange={(event) => updateNewAccount('currency', event.target.value)}>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label>
            Açılış Bakiyesi
            <input type="number" step="0.01" value={newAccount.openingBalance} onChange={(event) => updateNewAccount('openingBalance', event.target.value)} />
          </label>
          <button className="primary" type="submit" disabled={isAccountSaving || !newAccount.code.trim() || !newAccount.name.trim()}>
            {isAccountSaving ? 'Kaydediliyor...' : 'Hesap Aç'}
          </button>
        </form>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Defter Filtreleri</strong>
          <span>Tarih, işlem tipi, para birimi ve cari/belge araması</span>
        </div>
        <form className="filter-grid" onSubmit={applyFilters}>
          <label>
            Hesap
            <select value={filters.accountId} onChange={(event) => updateFilter('accountId', event.target.value)}>
              <option value="">Tüm hesaplar</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.code} / {account.name} / {account.currency}</option>
              ))}
            </select>
          </label>
          <label>
            Hesap tipi
            <select value={filters.accountType} onChange={(event) => updateFilter('accountType', event.target.value)}>
              <option value="">Tümü</option>
              <option value="cash">Kasa</option>
              <option value="bank">Banka</option>
              <option value="card">POS/Kart</option>
              <option value="other">Diğer</option>
            </select>
          </label>
          <label>
            Başlangıç
            <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
          </label>
          <label>
            Bitiş
            <input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
          </label>
          <label>
            Islem
            <select value={filters.movementType} onChange={(event) => updateFilter('movementType', event.target.value)}>
              <option value="">Tahsilat + Ödeme</option>
              <option value="collection">Sadece tahsilat</option>
              <option value="payment">Sadece ödeme</option>
            </select>
          </label>
          <label>
            Ödeme yöntemi
            <select value={filters.paymentMethod} onChange={(event) => updateFilter('paymentMethod', event.target.value)}>
              <option value="">Tümü</option>
              <option value="cash">Nakit</option>
              <option value="bank">Banka</option>
              <option value="card">Kart/POS</option>
              <option value="other">Diğer</option>
            </select>
          </label>
          <label>
            Para birimi
            <select value={filters.currency} onChange={(event) => updateFilter('currency', event.target.value)}>
              <option value="">Tümü</option>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label>
            Arama
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Cari, belge no" />
          </label>
          <button className="primary" type="submit">Ara</button>
          <button type="button" onClick={clearFilters}>Temizle</button>
        </form>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Teknik Not</strong>
          <span>Kalıcı hesap fazı</span>
        </div>
        <div className="list-state list-state-passive">
          Yeni tahsilat/ödeme hareketleri kalıcı kasa/banka hesabına yazılır. Eski hareketlerde hesap bağlantısı yoksa hesap atanmamış olarak görünür.
        </div>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Kasa / Banka Hareketleri</strong>
          <span>{rows.length} satır / girişler yeşil, çıkışlar kırmızı</span>
        </div>
        {isLoading && <div className="list-state">Kasa/banka defteri yükleniyor...</div>}
        {!isLoading && rows.length === 0 && !errorMessage && <div className="list-state">Hareket bulunamadı.</div>}
        {!isLoading && rows.length > 0 && (
          <div className="table-shell">
            <table className="erp-table cash-bank-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Yon</th>
                  <th>Hesap</th>
                  <th>Cari Turu</th>
                  <th>Cari / Tedarikçi</th>
                  <th>Belge</th>
                  <th>Islem</th>
                  <th>Giriş</th>
                  <th>Çıkış</th>
                  <th>PB</th>
                  <th>Makbuz</th>
                  <th>Git</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isIn = row.movementType === 'collection';
                  const isOut = row.movementType === 'payment';
                  return (
                    <tr className={`clickable-row ${isIn ? 'cash-in-row' : 'cash-out-row'}`} key={`${row.partyType}-${row.id}-${row.movementType}`} onClick={() => openMovement(row)}>
                      <td>{row.documentDate || '-'}</td>
                      <td><span className={`status-pill ${isIn ? 'success' : 'danger'}`}>{directionLabel(row)}</span></td>
                      <td>{accountLabel(row)}</td>
                      <td>{partyLabel(row)}</td>
                      <td>{row.partyCode} / {row.partyName}</td>
                      <td>{row.documentNo || '-'}</td>
                      <td>{movementLabel(row.movementType)}</td>
                      <td className="ledger-credit">{isIn ? formatMoney(row.amount, row.currency) : '-'}</td>
                      <td className="ledger-debit">{isOut ? formatMoney(row.amount, row.currency) : '-'}</td>
                      <td><span className="status-pill">{row.currency}</span></td>
                      <td>
                        <button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); printLedgerReceipt(row); }}>
                          Makbuz
                        </button>
                      </td>
                      <td><button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); openMovement(row); }}>Git</button></td>
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
