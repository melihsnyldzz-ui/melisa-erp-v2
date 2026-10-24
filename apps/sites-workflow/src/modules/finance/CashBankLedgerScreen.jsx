import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { ledgerTargetActionLabel, openLedgerTarget } from '../shared/ledgerNavigation.js';
import {sumCashAmounts,formatCashMoney} from './cashReadMoney.js';

function formatMoney(value, currency = 'TRY') {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    const decimal = String(value);
    // Adapt existing numeric DTOs for display without inventing decimal precision.
    const safeDecimal = Number.isFinite(value) && /^-?\d+\.\d{1,8}$/.test(decimal)
      && BigInt(decimal.replace(/[-.]/g, '')) <= BigInt(Number.MAX_SAFE_INTEGER);
    return formatCashMoney(safeDecimal ? decimal : null, currency);
  }
  return formatCashMoney(value, currency);
}

function formatCurrencyTotals(totals, key = 'net') {
  const entries = Object.entries(totals || {});
  if (entries.length === 0) return 'Hareket kaydı yok';
  return entries
    .map(([currency, value]) => {
      return formatCashMoney(value?.[key], currency);
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

export function CashBankLedgerScreen({ onOpenScreen, commandPanel=null, readOnly=false }) {
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
  const activeRead = useRef(null);
  const readReady = useRef(false);

  async function loadLedger(nextFilters = filters) {
    activeRead.current?.abort();
    readReady.current=false;
    const controller=new AbortController();activeRead.current=controller;
    const current=()=>activeRead.current===controller&&!controller.signal.aborted;
    const options={signal:controller.signal};
    setIsLoading(true);
    setMessage('');
    setErrorMessage('');

    try {
      const [accountResponse, cleanupResponse] = await Promise.all([
        fetchFinanceAccounts({ includePassive: true },options),
        readOnly ? Promise.resolve({data:null}) : fetchFinanceAccountCleanupPreview(options).catch(() => ({ data: null })),
      ]);
      if(!current())return;
      if(accountResponse?.success!==true||!Array.isArray(accountResponse.data))throw Error('Hesap yanıtı doğrulanamadı.');
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
      },options)));
      if(!current())return;
      if(responses.some(response=>response?.success!==true||!Array.isArray(response.data)))throw Error('Hareket yanıtı doğrulanamadı.');

      const combinedRows = responses
        .flatMap((response) => response.data || [])
        .sort((a, b) => `${b.documentDate || ''}${b.createdAt || ''}`.localeCompare(`${a.documentDate || ''}${a.createdAt || ''}`));

      setAccounts(accountResponse.data || []);
      setCleanupPreview(cleanupResponse.data || null);
      setRows(combinedRows);
      readReady.current=true;
    } catch (error) {
      if(!current())return;
      setAccounts([]);
      setCleanupPreview(null);
      setRows([]);
      setErrorMessage(`${error.message || 'Kasa/banka hareketleri okunamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      if(current())setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLedger();
    return()=>{readReady.current=false;activeRead.current?.abort();activeRead.current=null;};
  }, []);

  const summary = useMemo(() => rows.reduce((total, row) => {
    return {
      collectionCount: total.collectionCount + (row.movementType === 'collection' ? 1 : 0),
      paymentCount: total.paymentCount + (row.movementType === 'payment' ? 1 : 0),
    };
  }, {
    collectionCount: 0,
    paymentCount: 0,
  }), [rows]);

  const accountTotals = useMemo(() => accounts.reduce((totals, account) => {
    const currency = account.currency || 'Döviz doğrulanmadı';
    totals[currency] = sumCashAmounts([Object.hasOwn(totals,currency)?totals[currency]:'0',account.currentBalance]);
    return totals;
  }, {}), [accounts]);

  const selectedAccount = useMemo(() => (
    accounts.find((account) => String(account.id) === String(filters.accountId)) || null
  ), [accounts, filters.accountId]);

  const accountUsage = useMemo(() => rows.reduce((usage, row) => {
    if (!row.accountId) return usage;
    const key = `${row.accountId}:${row.currency || 'Döviz doğrulanmadı'}`;
    usage[key] = usage[key] || { movementCount: 0, in: '0', out: '0' };
    usage[key].movementCount += 1;
    if (row.movementType === 'collection') usage[key].in = sumCashAmounts([usage[key].in,row.amount]);
    if (row.movementType === 'payment') usage[key].out = sumCashAmounts([usage[key].out,row.amount]);
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
    const currency = row.currency || 'Döviz doğrulanmadı';
    totals[currency] = totals[currency] || { in: '0', out: '0', net: '0' };
    if (row.movementType === 'collection') {
      totals[currency].in = sumCashAmounts([totals[currency].in,row.amount]);

    }
    if (row.movementType === 'payment') {
      totals[currency].out = sumCashAmounts([totals[currency].out,row.amount]);

    }
    const out = totals[currency].out;
    totals[currency].net = sumCashAmounts([totals[currency].in,out === null ? null : out.startsWith('-') ? out.slice(1) : '-'+out]);
    return totals;
  }, {}), [rows]);

  const readStateText = isLoading ? 'Okunuyor…' : errorMessage ? 'Doğrulanmadı' : null;
  const cashInText = readStateText || formatCurrencyTotals(rowCurrencyTotals, 'in');
  const cashOutText = readStateText || formatCurrencyTotals(rowCurrencyTotals, 'out');
  const netFlowText = readStateText || formatCurrencyTotals(rowCurrencyTotals, 'net');
  const accountBalanceText = readStateText || (Object.keys(accountTotals).length
    ? Object.entries(accountTotals).map(([currency,value])=>formatCashMoney(value,currency)).join(' / ')
    : 'Hesap kaydı yok');
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

  function applyQuickFilter(patch) {
    const nextFilters = { ...filters, ...patch };
    setFilters(nextFilters);
    loadLedger(nextFilters);
  }

  function updateNewAccount(key, value) {
    setNewAccount((current) => {
      const next = { ...current, [key]: value };
      if (key === 'type' || key === 'currency') {
        const previousStandard = standardAccountCode(current.type, current.currency);
        if (!current.code.trim() || current.code === previousStandard) {
          next.code = standardAccountCode(next.type, next.currency);
        }
        if (!current.name.trim() || current.name === `${current.currency} Ana Kasa` || current.name === `${current.currency} Banka Hesabı` || current.name === `${current.currency} POS / Kart Hesabı`) {
          const nameMap = {
            cash: `${next.currency} Ana Kasa`,
            bank: `${next.currency} Banka Hesabı`,
            card: `${next.currency} POS / Kart Hesabı`,
            other: `${next.currency} Diğer Finans Hesabı`,
          };
          next.name = nameMap[next.type] || `${next.currency} Finans Hesabı`;
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
    if(readOnly)return;
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
    if(readOnly)return;
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
    if(readOnly)return;
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
    if(readOnly)return;
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
      setMessage('Kasa/Banka hesabı oluşturuldu.');
      await loadLedger(filters);
    } catch (error) {
      setErrorMessage(`${error.message || 'Hesap oluşturulamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsAccountSaving(false);
    }
  }

  function openMovement(row) {
    openLedgerTarget(row, onOpenScreen);
  }

  function openParty(row) {
    if (row.partyType === 'supplier' && row.supplierId) {
      onOpenScreen?.('supplier-card', { supplierId: row.supplierId, supplierCode: row.partyCode });
      return;
    }

    if (row.partyType !== 'supplier' && row.customerId) {
      onOpenScreen?.('customer-card', { customerId: row.customerId, customerCode: row.partyCode });
    }
  }

  function printLedgerReceipt(row) {
    if(!readReady.current||isLoading||errorMessage||!rows.includes(row))return;
    printFinanceReceipt(buildReceipt(row));
  }

  function exportLedger() {
    if(!readReady.current||isLoading||errorMessage)return;
    exportRowsToExcel({
      filename: 'kasa-banka-defteri',
      title: 'Kasa Banka Defteri — gösterilen sınırlı hareketler',
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
        { label: 'Açıklama', key: 'description' },
        { label: 'İşlem', value: (row) => movementLabel(row.movementType) },
        { label: 'Tutar', key: 'amount' },
        { label: 'Para Birimi', key: 'currency' },
      ],
    });
  }

  function printLedger() {
    if(!readReady.current||isLoading||errorMessage)return;
    printRowsReport({
      title: 'Melisa ERP - Kasa Banka Defteri',
      subtitle: `${rows.length} gösterilen finans hareketi / net ${netFlowText} / genel dönem toplamı değildir`,
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
        { label: 'Açıklama', key: 'description' },
        { label: 'İşlem', value: (row) => movementLabel(row.movementType) },
        { label: 'Tutar', key: 'amount' },
        { label: 'Para Birimi', key: 'currency' },
      ],
    });
  }

  return (
    <main className="work-area cash-bank-ledger-screen">
      {commandPanel}
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Kasa / Banka Defteri</strong>
          <span>Kalıcı kasa/banka hesap kartları ve tahsilat/ödeme defteri</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" className="primary" onClick={() => onOpenScreen?.('collections-overview')}>{readOnly?'Tahsilat / Çek Görüntüle':'Tahsilat / Ödeme Gir'}</button>
          <button type="button" disabled={isLoading||!!errorMessage||!readReady.current} onClick={exportLedger}>Excel</button>
          <button type="button" disabled={isLoading||!!errorMessage||!readReady.current} onClick={printLedger}>Yazdır</button>
          <button type="button" onClick={() => loadLedger(filters)}>Yenile</button>
        </div>
      </section>

      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
      {message && <div className="list-state list-state-success">{message}</div>}

      <section className="dashboard-kpi-grid finance-mini-grid">
        <article className="dashboard-kpi good">
          <span>Giriş</span>
          <strong>{cashInText}</strong>
          <small>{readStateText || `${summary.collectionCount} gösterilen tahsilat hareketi`}</small>
        </article>
        <article className="dashboard-kpi danger">
          <span>Çıkış</span>
          <strong>{cashOutText}</strong>
          <small>{readStateText || `${summary.paymentCount} gösterilen ödeme hareketi`}</small>
        </article>
        <article className="dashboard-kpi">
          <span>Gösterilen hareket neti</span>
          <strong>{netFlowText}</strong>
          <small>Döviz bazında; sınırlı sonuç kümesi, genel bakiye değil</small>
        </article>
        <article className="dashboard-kpi info">
          <span>Hesap bakiyesi</span>
          <strong>{accountBalanceText}</strong>
          <small>Aktif hesap toplamı</small>
        </article>
        <article className="dashboard-kpi info">
          <span>Seçili hesap</span>
          <strong>{selectedAccount ? formatCashMoney(selectedAccount.currentBalance, selectedAccount.currency) : 'Tümü'}</strong>
          <small>{selectedAccount ? `${selectedAccount.code} / ${selectedAccount.name}` : 'Hesap filtresi yok'}</small>
        </article>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Para Birimi Bazlı Nakit Özeti</strong>
          <span>Gösterilen en fazla 200 giriş ve 200 çıkış; genel dönem toplamı değildir</span>
        </div>
        <div className="currency-summary-grid">
          {!readStateText && Object.entries(rowCurrencyTotals).map(([currency, total]) => (
            <article className="currency-summary-card" key={currency}>
              <strong>{currency}</strong>
              <span className="ledger-credit">Giriş: {formatCashMoney(total.in, currency)}</span>
              <span className="ledger-debit">Çıkış: {formatCashMoney(total.out, currency)}</span>
              <span>Net: {formatCashMoney(total.net, currency)}</span>
            </article>
          ))}
          {readStateText ? <div className="list-state">{readStateText}</div> : Object.keys(rowCurrencyTotals).length === 0 && <div className="list-state">Seçili filtrede nakit hareketi yok.</div>}
        </div>
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Kasa / Banka Hesap Kartları</strong>
          <span>{readStateText?'Hesap sayısı doğrulanmadı':`${accounts.length} hesap / ${duplicateAccountCount} aktif mükerrer hesap uyarısı`}</span>
        </div>
        {!readOnly && duplicateAccountCount > 0 && (
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
            const usage = accountUsage[`${account.id}:${account.currency || 'Döviz doğrulanmadı'}`] || { movementCount: 0, in: '0', out: '0' };
            return (
              <article className={`finance-account-card ${account.isActive ? 'active' : 'passive'} ${isDuplicate ? 'duplicate' : ''}`} key={account.id}>
                <div className="finance-account-card-head">
                  <span>{account.type} / {account.currency}</span>
                  <span className={`status-pill ${account.isActive ? 'success' : 'passive'}`}>{account.isActive ? 'Aktif' : 'Pasif'}</span>
                </div>
                <strong>{account.code} / {account.name}</strong>
                <small>{formatCashMoney(account.currentBalance, account.currency)}</small>
                <div className="finance-account-meta">
                  <span className={`status-pill ${isStandard ? 'success' : 'warning'}`}>
                    {isStandard ? 'Standart kod' : `Önerilen: ${expectedCode}`}
                  </span>
                  {isDuplicate && <span className="status-pill danger">Mükerrer aktif</span>}
                  <span className="status-pill">{usage.movementCount} hareket</span>
                </div>
                <div className="finance-account-flow">
                  <span className="ledger-credit">Giriş {formatCashMoney(usage.in, account.currency)}</span>
                  <span className="ledger-debit">Çıkış {formatCashMoney(usage.out, account.currency)}</span>
                </div>
                <div className="segmented-control">
                  <button type="button" onClick={() => focusAccount(account)}>Filtrele</button>
                  {!readOnly&&<button type="button" disabled={isAccountSaving} onClick={() => toggleAccountActive(account)}>
                    {account.isActive ? 'Pasife Al' : 'Aktif Et'}
                  </button>}
                </div>
              </article>
            );
          })}
          {accounts.length === 0 && <div className="list-state">{readStateText||'Kasa/banka hesabı yok.'}</div>}
        </div>
        {!readOnly&&<form className="filter-grid finance-account-create" onSubmit={saveNewAccount}>
          <label>
            Hesap Kodu
            <input value={newAccount.code} onChange={(event) => updateNewAccount('code', event.target.value)} placeholder="KASA-USD" />
          </label>
          <label>
            Hesap Adı
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
        </form>}
        {readOnly&&<p>TEST hesap yönetimi kapalı: hesap açma, aktif/pasif değiştirme, temizlik ve standartlaştırma yapılmaz.</p>}
      </section>

      <section className="erp-panel">
        <div className="panel-title">
          <strong>Defter Filtreleri</strong>
          <span>Tarih, işlem tipi, para birimi ve cari/belge araması</span>
        </div>
        <div className="movement-quick-filters cash-bank-quick-filters">
          <button
            type="button"
            className={!filters.movementType && !filters.accountType ? 'pressed' : ''}
            onClick={() => applyQuickFilter({ movementType: '', accountType: '', accountId: '' })}
          >
            Tüm Defter
          </button>
          <button
            type="button"
            className={`in ${filters.movementType === 'collection' ? 'pressed' : ''}`}
            onClick={() => applyQuickFilter({ movementType: 'collection', accountId: '' })}
          >
            Girişler
          </button>
          <button
            type="button"
            className={`out ${filters.movementType === 'payment' ? 'pressed' : ''}`}
            onClick={() => applyQuickFilter({ movementType: 'payment', accountId: '' })}
          >
            Çıkışlar
          </button>
          <button
            type="button"
            className={filters.accountType === 'cash' ? 'pressed' : ''}
            onClick={() => applyQuickFilter({ accountType: 'cash', accountId: '' })}
          >
            Kasa
          </button>
          <button
            type="button"
            className={filters.accountType === 'bank' ? 'pressed' : ''}
            onClick={() => applyQuickFilter({ accountType: 'bank', accountId: '' })}
          >
            Banka
          </button>
          <button
            type="button"
            className={filters.accountType === 'card' ? 'pressed' : ''}
            onClick={() => applyQuickFilter({ accountType: 'card', accountId: '' })}
          >
            POS / Kart
          </button>
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
            İşlem
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
          <div className="table-shell ledger-table-shell cash-bank-table-shell">
            <table className="erp-table cash-bank-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Yön</th>
                  <th>Hesap</th>
                  <th>Cari Türü</th>
                  <th>Cari / Tedarikçi</th>
                  <th>Belge</th>
                  <th>Açıklama</th>
                  <th>İşlem</th>
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
                      <td>
                        <button type="button" className="document-link-button party" onClick={(event) => { event.stopPropagation(); openParty(row); }}>
                          {row.partyCode} / {row.partyName}
                        </button>
                      </td>
                      <td>
                        <button type="button" className="document-link-button" onClick={(event) => { event.stopPropagation(); openMovement(row); }}>
                          {row.documentNo || '-'}
                        </button>
                      </td>
                      <td>{row.description || '-'}</td>
                      <td>{movementLabel(row.movementType)}</td>
                      <td className="ledger-credit">{isIn ? formatMoney(row.amount, row.currency) : '-'}</td>
                      <td className="ledger-debit">{isOut ? formatMoney(row.amount, row.currency) : '-'}</td>
                      <td><span className="status-pill">{row.currency}</span></td>
                      <td>
                        <button type="button" disabled={isLoading||!!errorMessage||!readReady.current} className="mini-button" onClick={(event) => { event.stopPropagation(); printLedgerReceipt(row); }}>
                          Makbuz
                        </button>
                      </td>
                      <td><button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); openMovement(row); }}>{ledgerTargetActionLabel(row)}</button></td>
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
