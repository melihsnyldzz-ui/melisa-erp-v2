import React, { useEffect, useMemo, useState } from 'react';
import {
  applyDemoCleanup,
  applyTestArchiveRestore,
  applyTestTreeCleanup,
  fetchDemoCleanupPreview,
  fetchSettingsOverview,
  fetchTestArchiveRestorePreview,
  fetchTestTreeCleanupPreview,
  updateSettings,
} from '../../services/settingsApi.js';
import { apiConfig } from '../../config/apiConfig.js';
import { exportRowsToExcel, printRowsReport, savePrintCompanyInfo } from '../../utils/exportUtils.js';

const COMPANY_FIELDS = [
  ['name', 'Firma Adı'],
  ['taxOffice', 'Vergi Dairesi'],
  ['taxNumber', 'Vergi No'],
  ['address', 'Adres'],
  ['phone', 'Telefon'],
];

const SERIES_FIELDS = [
  ['salesInvoicePrefix', 'Satış Fişi Seri'],
  ['purchaseInvoicePrefix', 'Alış Fişi Seri'],
  ['salesOfferPrefix', 'Teklif Seri'],
  ['salesOrderPrefix', 'Sipariş Seri'],
];

const CLEANUP_GROUPS = [
  ['products', 'Stok Kartları'],
  ['customers', 'Müşteri Carileri'],
  ['suppliers', 'Tedarikçi Carileri'],
];

function getValue(settings, group, key, fallback = '') {
  return settings.find((item) => item.group === group && item.key === key)?.value ?? fallback;
}

function cleanupRows(preview) {
  return CLEANUP_GROUPS.flatMap(([key, label]) => (
    (preview?.summary?.[key]?.sample || []).map((row) => ({ ...row, groupKey: key, groupLabel: label }))
  ));
}

function treeRows(preview) {
  const sales = (preview?.summary?.sales?.sample || []).map((row) => ({ ...row, groupLabel: 'Satış Fişi' }));
  const purchases = (preview?.summary?.purchases?.sample || []).map((row) => ({ ...row, groupLabel: 'Alış Fişi' }));
  return [...sales, ...purchases];
}

function financeMovementRows(preview) {
  return (preview?.financeMovements?.sample || []).map((row) => ({
    ...row,
    groupLabel: row.partyType === 'supplier' ? 'Test tedarikçi ödemesi' : 'Test müşteri tahsilatı',
  }));
}

function maintenanceReportRows({ cleanupPreview, treePreview, restorePreview }) {
  const cleanup = cleanupRows(cleanupPreview).map((row) => ({
    section: 'Kart Temizligi',
    type: row.groupLabel,
    code: row.code,
    name: row.name,
    status: row.canClean ? 'Temizlenebilir' : 'Korunur',
    count: row.linkCount,
    reason: row.reason,
  }));
  const tree = treeRows(treePreview).map((row) => ({
    section: 'Test Fis Arsivi',
    type: row.groupLabel,
    code: row.documentNo,
    name: row.partyName,
    status: row.status,
    count: (row.ledgerCount || 0) + (row.stockMovementCount || 0),
    reason: row.reason,
  }));
  const restore = treeRows(restorePreview).map((row) => ({
    section: 'Arsiv Geri Alma',
    type: row.groupLabel,
    code: row.documentNo,
    name: row.partyName,
    status: row.restoreStatus || row.status,
    count: (row.ledgerCount || 0) + (row.stockMovementCount || 0),
    reason: row.reason,
  }));
  const finance = financeMovementRows(cleanupPreview).map((row) => ({
    section: 'Test Finans Hareketi',
    type: row.groupLabel,
    code: row.documentNo,
    name: `${row.partyCode} / ${row.partyName}`,
    status: 'Normal finans listesinden ayrılır',
    count: 1,
    reason: row.reason,
  }));

  return [...cleanup, ...tree, ...restore, ...finance];
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : '-';
}

function formatMoney(value) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(value || 0));
}

function MaintenanceInvoiceTable({ rows, emptyText, showRestoreStatus = false }) {
  return (
    <div className="table-shell compact-table-shell">
      <table className="erp-table cleanup-preview-table">
        <thead>
          <tr>
            <th>Tip</th>
            <th>Fiş No</th>
            <th>Tarih</th>
            <th>Cari / Tedarikçi</th>
            <th>Durum</th>
            {showRestoreStatus && <th>Geri Dönüş</th>}
            <th>Satır</th>
            <th>Hareket</th>
            <th>Tutar TRY</th>
            <th>Sebep</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.kind}-${row.id}`}>
              <td>{row.groupLabel}</td>
              <td className="code-cell">{row.documentNo}</td>
              <td>{formatDate(row.documentDate)}</td>
              <td>{row.partyName}</td>
              <td><span className="status-pill danger">{row.status}</span></td>
              {showRestoreStatus && <td><span className="status-pill success">{row.restoreStatus || '-'}</span></td>}
              <td>{row.itemCount}</td>
              <td>{(row.ledgerCount || 0) + (row.stockMovementCount || 0)}</td>
              <td>{formatMoney(row.amountTry)}</td>
              <td>{row.reason}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={showRestoreStatus ? 10 : 9}>{emptyText}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function SystemSettingsScreen() {
  const [settings, setSettings] = useState([]);
  const [form, setForm] = useState({ company: {}, documentSeries: {}, tax: {}, accounting: {} });
  const [cleanupPreview, setCleanupPreview] = useState(null);
  const [treePreview, setTreePreview] = useState(null);
  const [restorePreview, setRestorePreview] = useState(null);
  const [cleanupConfirmation, setCleanupConfirmation] = useState('');
  const [treeConfirmation, setTreeConfirmation] = useState('');
  const [restoreConfirmation, setRestoreConfirmation] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCleanupLoading, setIsCleanupLoading] = useState(false);
  const [isTreeLoading, setIsTreeLoading] = useState(false);
  const [isRestoreLoading, setIsRestoreLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplyingCleanup, setIsApplyingCleanup] = useState(false);
  const [isApplyingTree, setIsApplyingTree] = useState(false);
  const [isApplyingRestore, setIsApplyingRestore] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const vatRatesText = useMemo(() => (
    Array.isArray(form.tax.vatRates) ? form.tax.vatRates.join(',') : String(form.tax.vatRates || '')
  ), [form.tax.vatRates]);
  const cleanupCandidates = useMemo(() => cleanupRows(cleanupPreview), [cleanupPreview]);
  const financeCandidates = useMemo(() => financeMovementRows(cleanupPreview), [cleanupPreview]);
  const treeCandidates = useMemo(() => treeRows(treePreview), [treePreview]);
  const restoreCandidates = useMemo(() => treeRows(restorePreview), [restorePreview]);
  const maintenanceRows = useMemo(() => (
    maintenanceReportRows({ cleanupPreview, treePreview, restorePreview })
  ), [cleanupPreview, treePreview, restorePreview]);

  async function loadSettings() {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetchSettingsOverview();
      const list = response.data?.settings || [];
      const company = Object.fromEntries(COMPANY_FIELDS.map(([key]) => [key, getValue(list, 'company', key, '')]));
      setSettings(list);
      setForm({
        company,
        documentSeries: Object.fromEntries(SERIES_FIELDS.map(([key]) => [key, getValue(list, 'documentSeries', key, '')])),
        tax: {
          defaultVatRate: getValue(list, 'tax', 'defaultVatRate', 20),
          vatRates: getValue(list, 'tax', 'vatRates', [0, 1, 10, 20]),
        },
        accounting: {
          periodLockEnabled: Boolean(getValue(list, 'accounting', 'periodLockEnabled', false)),
          periodLockedThroughDate: getValue(list, 'accounting', 'periodLockedThroughDate', ''),
        },
      });
      savePrintCompanyInfo(company);
    } catch (error) {
      setErrorMessage(`${error.message || 'Ayarlar okunamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCleanupPreview() {
    setIsCleanupLoading(true);
    setErrorMessage('');
    try {
      const response = await fetchDemoCleanupPreview();
      setCleanupPreview(response.data || null);
    } catch (error) {
      setCleanupPreview(null);
      setErrorMessage(`${error.message || 'Demo/test temizlik önizlemesi alınamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsCleanupLoading(false);
    }
  }

  async function loadTreePreview() {
    setIsTreeLoading(true);
    setErrorMessage('');
    try {
      const response = await fetchTestTreeCleanupPreview();
      setTreePreview(response.data || null);
    } catch (error) {
      setTreePreview(null);
      setErrorMessage(`${error.message || 'Test işlem ağacı önizlemesi alınamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsTreeLoading(false);
    }
  }

  async function loadRestorePreview() {
    setIsRestoreLoading(true);
    setErrorMessage('');
    try {
      const response = await fetchTestArchiveRestorePreview();
      setRestorePreview(response.data || null);
    } catch (error) {
      setRestorePreview(null);
      setErrorMessage(`${error.message || 'Test arşivi geri alma önizlemesi alınamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsRestoreLoading(false);
    }
  }

  async function refreshMaintenance() {
    await Promise.all([loadCleanupPreview(), loadTreePreview(), loadRestorePreview()]);
  }

  useEffect(() => {
    loadSettings();
    refreshMaintenance();
  }, []);

  function updateField(group, key, value) {
    setForm((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));
  }

  async function saveSettings() {
    setIsSaving(true);
    setMessage('');
    setErrorMessage('');
    try {
      const payload = [
        ...COMPANY_FIELDS.map(([key]) => ({ group: 'company', key, value: form.company[key] || '', valueType: 'string' })),
        ...SERIES_FIELDS.map(([key]) => ({ group: 'documentSeries', key, value: form.documentSeries[key] || '', valueType: 'string' })),
        { group: 'tax', key: 'defaultVatRate', value: Number(form.tax.defaultVatRate || 0), valueType: 'number' },
        { group: 'tax', key: 'vatRates', value: vatRatesText.split(',').map((item) => Number(item.trim())).filter((item) => Number.isFinite(item)), valueType: 'json' },
        { group: 'accounting', key: 'periodLockEnabled', value: Boolean(form.accounting.periodLockEnabled), valueType: 'boolean', description: 'Kapali donem eski tarihli ticari hareket girisini durdurur' },
        { group: 'accounting', key: 'periodLockedThroughDate', value: form.accounting.periodLockedThroughDate || '', valueType: 'string', description: 'Bu tarih ve oncesi muhasebe donemi kapali kabul edilir' },
      ];
      const response = await updateSettings({ settings: payload });
      setSettings(response.data?.settings || []);
      savePrintCompanyInfo(form.company);
      setMessage('Sistem ayarları kaydedildi.');
    } catch (error) {
      setErrorMessage(`${error.message || 'Ayarlar kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  async function runTreeApply() {
    setIsApplyingTree(true);
    setMessage('');
    setErrorMessage('');
    try {
      const response = await applyTestTreeCleanup({ confirmation: treeConfirmation });
      setTreePreview(response.data?.preview || null);
      setTreeConfirmation('');
      const result = response.data?.result || {};
      setMessage(`Test işlem ağacı arşivlendi. Satış fişi: ${result.salesInvoicesArchived || 0}, alış fişi: ${result.purchaseInvoicesArchived || 0}.`);
      await Promise.all([loadCleanupPreview(), loadRestorePreview()]);
    } catch (error) {
      setErrorMessage(`${error.message || 'Test işlem ağacı arşivlenemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsApplyingTree(false);
    }
  }

  async function runRestoreApply() {
    setIsApplyingRestore(true);
    setMessage('');
    setErrorMessage('');
    try {
      const response = await applyTestArchiveRestore({ confirmation: restoreConfirmation });
      setRestorePreview(response.data?.preview || null);
      setRestoreConfirmation('');
      const result = response.data?.result || {};
      setMessage(`Test arşivi geri alındı. Satış fişi: ${result.salesInvoicesRestored || 0}, alış fişi: ${result.purchaseInvoicesRestored || 0}.`);
      await Promise.all([loadCleanupPreview(), loadTreePreview()]);
    } catch (error) {
      setErrorMessage(`${error.message || 'Test arşivi geri alınamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsApplyingRestore(false);
    }
  }

  async function runCleanupApply() {
    setIsApplyingCleanup(true);
    setMessage('');
    setErrorMessage('');
    try {
      const response = await applyDemoCleanup({ confirmation: cleanupConfirmation });
      setCleanupPreview(response.data?.preview || null);
      const result = response.data?.result || {};
      setCleanupConfirmation('');
      setMessage(`Demo/test temizlik tamamlandı. Stok: ${result.productsCleaned || 0}, müşteri: ${result.customersCleaned || 0}, tedarikçi: ${result.suppliersCleaned || 0}.`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Demo/test temizlik uygulanamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsApplyingCleanup(false);
    }
  }

  function exportMaintenanceReport() {
    exportRowsToExcel({
      filename: 'demo-test-temizlik-raporu',
      title: 'Demo Test Temizlik Raporu',
      rows: maintenanceRows,
      columns: [
        { label: 'Bolum', key: 'section' },
        { label: 'Tip', key: 'type' },
        { label: 'Kod / Belge', key: 'code' },
        { label: 'Ad / Cari', key: 'name' },
        { label: 'Durum', key: 'status' },
        { label: 'Bag / Hareket', key: 'count' },
        { label: 'Sebep', key: 'reason' },
      ],
    });
  }

  function printMaintenanceReport() {
    printRowsReport({
      title: 'Melisa ERP - Demo/Test Temizlik Raporu',
      subtitle: `${maintenanceRows.length} satir / ${apiConfig.demoMode ? 'DEMO MOD' : 'CANLI SQL'}`,
      rows: maintenanceRows,
      columns: [
        { label: 'Bolum', key: 'section' },
        { label: 'Tip', key: 'type' },
        { label: 'Kod / Belge', key: 'code' },
        { label: 'Ad / Cari', key: 'name' },
        { label: 'Durum', key: 'status' },
        { label: 'Sebep', key: 'reason' },
      ],
    });
  }

  return (
    <main className="work-area dashboard-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Sistem Ayarları</strong>
          <span>Firma, belge seri, vergi/KDV ve güvenli bakım işlemleri</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={exportMaintenanceReport} disabled={maintenanceRows.length === 0}>Bakim Excel</button>
          <button type="button" onClick={printMaintenanceReport} disabled={maintenanceRows.length === 0}>Bakim PDF</button>
          <button type="button" onClick={saveSettings} disabled={isSaving}>{isSaving ? 'Kaydediliyor' : 'Kaydet'}</button>
          <button type="button" onClick={() => { loadSettings(); refreshMaintenance(); }}>Yenile</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Ayarlar API'den okunuyor...</div>}
      {message && <div className="list-state list-state-success">{message}</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <section className="dashboard-kpi-grid">
        <article className={apiConfig.demoMode ? 'dashboard-kpi danger' : 'dashboard-kpi good'}>
          <span>Calisma modu</span>
          <strong>{apiConfig.demoMode ? 'DEMO' : 'CANLI SQL'}</strong>
          <small>{apiConfig.baseUrl}</small>
        </article>
        <article className={(cleanupPreview?.totals?.safe || 0) > 0 ? 'dashboard-kpi warn' : 'dashboard-kpi good'}>
          <span>Temizlenebilir kart</span>
          <strong>{cleanupPreview?.totals?.safe || 0}</strong>
          <small>Hareketsiz demo/test kartlari</small>
        </article>
        <article className={(treePreview?.totals?.totalInvoices || 0) > 0 ? 'dashboard-kpi warn' : 'dashboard-kpi good'}>
          <span>Test fis adayi</span>
          <strong>{treePreview?.totals?.totalInvoices || 0}</strong>
          <small>Normal rapordan arsivlenebilir</small>
        </article>
        <article className={(restorePreview?.totals?.totalInvoices || 0) > 0 ? 'dashboard-kpi info' : 'dashboard-kpi good'}>
          <span>Arsivde test fis</span>
          <strong>{restorePreview?.totals?.totalInvoices || 0}</strong>
          <small>Gerekirse geri alinabilir</small>
        </article>
      </section>

      <section className="split-grid">
        <section className="erp-panel">
          <div className="panel-title"><strong>Firma Bilgileri</strong><span>Çıktı ve rapor başlıkları</span></div>
          <div className="filter-grid">
            {COMPANY_FIELDS.map(([key, label]) => (
              <label key={key}>{label}<input value={form.company[key] || ''} onChange={(event) => updateField('company', key, event.target.value)} /></label>
            ))}
          </div>
        </section>
        <section className="erp-panel">
          <div className="panel-title"><strong>Belge Seri Ayarları</strong><span>Yeni belge ön ekleri</span></div>
          <div className="filter-grid">
            {SERIES_FIELDS.map(([key, label]) => (
              <label key={key}>{label}<input value={form.documentSeries[key] || ''} onChange={(event) => updateField('documentSeries', key, event.target.value.toUpperCase())} /></label>
            ))}
          </div>
        </section>
      </section>

      <section className="erp-panel">
        <div className="panel-title"><strong>Vergi / KDV</strong><span>Operasyonel varsayılanlar</span></div>
        <div className="filter-grid">
          <label>Varsayılan KDV %<input type="number" value={form.tax.defaultVatRate || 0} onChange={(event) => updateField('tax', 'defaultVatRate', event.target.value)} /></label>
          <label>KDV Oranları<input value={vatRatesText} onChange={(event) => updateField('tax', 'vatRates', event.target.value)} placeholder="0,1,10,20" /></label>
        </div>
      </section>

      <section className="erp-panel accounting-lock-panel">
        <div className="panel-title"><strong>Muhasebe Donem Kilidi</strong><span>Kapali doneme ticari hareket yazilmaz</span></div>
        <div className="filter-grid">
          <label>
            Kilit durumu
            <select
              value={form.accounting.periodLockEnabled ? 'true' : 'false'}
              onChange={(event) => updateField('accounting', 'periodLockEnabled', event.target.value === 'true')}
            >
              <option value="false">Acik - eski tarihe kayit serbest</option>
              <option value="true">Kilitli - eski donem kapali</option>
            </select>
          </label>
          <label>
            Kapali donem bitis tarihi
            <input
              type="date"
              value={form.accounting.periodLockedThroughDate || ''}
              onChange={(event) => updateField('accounting', 'periodLockedThroughDate', event.target.value)}
            />
          </label>
        </div>
        <div className="list-state">
          Kilit aktifken bu tarih ve oncesine ait satis, alis, iptal, tahsilat, odeme ve stok sayim duzeltmesi kaydedilmez.
        </div>
      </section>

      <section className="erp-panel test-tree-cleanup-panel">
        <div className="panel-title">
          <strong>Test İşlem Ağacı Arşivi</strong>
          <span>Test fişleri silinmez; normal rapor dışına alınır</span>
        </div>
        {isTreeLoading && <div className="list-state">Test fişleri taranıyor...</div>}
        {treePreview && (
          <>
            <div className="cleanup-summary-grid">
              <article><span>Toplam fiş</span><strong>{treePreview.totals?.totalInvoices || 0}</strong></article>
              <article className="cleanup-blocked"><span>Satış fişi</span><strong>{treePreview.totals?.salesInvoices || 0}</strong></article>
              <article className="cleanup-blocked"><span>Alış fişi</span><strong>{treePreview.totals?.purchaseInvoices || 0}</strong></article>
              <article><span>Onay metni</span><strong>{treePreview.confirmationText}</strong></article>
            </div>
            <div className="cleanup-rules">
              {(treePreview.rules || []).map((rule) => <span key={rule}>{rule}</span>)}
            </div>
            <div className="filter-grid cleanup-apply-grid">
              <label>
                Arşiv onayı
                <input value={treeConfirmation} onChange={(event) => setTreeConfirmation(event.target.value)} placeholder={treePreview.confirmationText} />
              </label>
              <button
                type="button"
                className="danger-button"
                disabled={isApplyingTree || treeConfirmation !== treePreview.confirmationText || (treePreview.totals?.totalInvoices || 0) === 0}
                onClick={runTreeApply}
              >
                {isApplyingTree ? 'Arşivleniyor' : 'Test Fişlerini Arşivle'}
              </button>
              <button type="button" onClick={loadTreePreview}>Önizlemeyi Yenile</button>
            </div>
            <MaintenanceInvoiceTable rows={treeCandidates} emptyText="Arşivlenecek test fişi bulunamadı." />
          </>
        )}
      </section>

      <section className="erp-panel test-archive-restore-panel">
        <div className="panel-title">
          <strong>Test Arşivi Geri Alma</strong>
          <span>Yanlış arşivlenen test fişlerini eski operasyon statüsüne döndürür</span>
        </div>
        {isRestoreLoading && <div className="list-state">Arşivdeki test fişleri taranıyor...</div>}
        {restorePreview && (
          <>
            <div className="cleanup-summary-grid">
              <article><span>Arşivdeki fiş</span><strong>{restorePreview.totals?.totalInvoices || 0}</strong></article>
              <article className="cleanup-safe"><span>Satış fişi</span><strong>{restorePreview.totals?.salesInvoices || 0}</strong></article>
              <article className="cleanup-safe"><span>Alış fişi</span><strong>{restorePreview.totals?.purchaseInvoices || 0}</strong></article>
              <article><span>Onay metni</span><strong>{restorePreview.confirmationText}</strong></article>
            </div>
            <div className="cleanup-rules">
              {(restorePreview.rules || []).map((rule) => <span key={rule}>{rule}</span>)}
            </div>
            <div className="filter-grid cleanup-apply-grid">
              <label>
                Geri alma onayı
                <input value={restoreConfirmation} onChange={(event) => setRestoreConfirmation(event.target.value)} placeholder={restorePreview.confirmationText} />
              </label>
              <button
                type="button"
                disabled={isApplyingRestore || restoreConfirmation !== restorePreview.confirmationText || (restorePreview.totals?.totalInvoices || 0) === 0}
                onClick={runRestoreApply}
              >
                {isApplyingRestore ? 'Geri Alınıyor' : 'Arşivi Geri Al'}
              </button>
              <button type="button" onClick={loadRestorePreview}>Önizlemeyi Yenile</button>
            </div>
            <MaintenanceInvoiceTable rows={restoreCandidates} emptyText="Geri alınacak arşiv kaydı bulunamadı." showRestoreStatus />
          </>
        )}
      </section>

      <section className="erp-panel demo-cleanup-panel">
        <div className="panel-title">
          <strong>Demo/Test Kart Temizlik Merkezi</strong>
          <span>Soft-delete önizleme / hareketli kayıtlar korunur</span>
        </div>
        {isCleanupLoading && <div className="list-state">Demo/test adayları taranıyor...</div>}
        {cleanupPreview && (
          <>
            <div className="cleanup-summary-grid">
              <article><span>Toplam aday</span><strong>{cleanupPreview.totals?.total || 0}</strong></article>
              <article className="cleanup-safe"><span>Temizlenebilir</span><strong>{cleanupPreview.totals?.safe || 0}</strong></article>
              <article className="cleanup-blocked"><span>Bloklu</span><strong>{cleanupPreview.totals?.blocked || 0}</strong></article>
              <article className={(cleanupPreview.totals?.financeMovementCount || 0) > 0 ? 'cleanup-blocked' : 'cleanup-safe'}>
                <span>Test finans izi</span>
                <strong>{cleanupPreview.totals?.financeMovementCount || 0}</strong>
              </article>
              <article><span>Onay metni</span><strong>{cleanupPreview.confirmationText}</strong></article>
            </div>
            <div className="cleanup-rules">
              {(cleanupPreview.rules || []).map((rule) => <span key={rule}>{rule}</span>)}
            </div>
            <div className="filter-grid cleanup-apply-grid">
              <label>
                Temizlik onayı
                <input value={cleanupConfirmation} onChange={(event) => setCleanupConfirmation(event.target.value)} placeholder={cleanupPreview.confirmationText} />
              </label>
              <button
                type="button"
                className="danger-button"
                disabled={isApplyingCleanup || cleanupConfirmation !== cleanupPreview.confirmationText || (cleanupPreview.totals?.safe || 0) === 0}
                onClick={runCleanupApply}
              >
                {isApplyingCleanup ? 'Temizleniyor' : 'Güvenli Temizle'}
              </button>
              <button type="button" onClick={loadCleanupPreview}>Önizlemeyi Yenile</button>
            </div>
            <div className="table-shell compact-table-shell">
              <table className="erp-table cleanup-preview-table">
                <thead>
                  <tr>
                    <th>Grup</th>
                    <th>Kod</th>
                    <th>Ad / Unvan</th>
                    <th>Sebep</th>
                    <th>Bağ</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {cleanupCandidates.map((row) => (
                    <tr key={`${row.groupKey}-${row.id}`}>
                      <td>{row.groupLabel}</td>
                      <td className="code-cell">{row.code}</td>
                      <td>{row.name}</td>
                      <td>{row.reason}</td>
                      <td>{row.linkCount}</td>
                      <td><span className={row.canClean ? 'status-pill success' : 'status-pill danger'}>{row.canClean ? 'Temizlenebilir' : 'Hareketli / korunur'}</span></td>
                    </tr>
                  ))}
                  {cleanupCandidates.length === 0 && (
                    <tr><td colSpan="6">Demo/test adayı bulunamadı.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {financeCandidates.length > 0 && (
              <div className="table-shell compact-table-shell">
                <table className="erp-table cleanup-preview-table">
                  <thead>
                    <tr>
                      <th>Tip</th>
                      <th>Belge</th>
                      <th>Tarih</th>
                      <th>Cari / Tedarikçi</th>
                      <th>Tutar</th>
                      <th>Bakiye Etkisi</th>
                      <th>Sebep</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financeCandidates.map((row) => (
                      <tr key={`${row.partyType}-${row.id}`}>
                        <td>{row.groupLabel}</td>
                        <td className="code-cell">{row.documentNo}</td>
                        <td>{formatDate(row.documentDate)}</td>
                        <td>{row.partyCode} / {row.partyName}</td>
                        <td>{formatMoney(row.amount)}</td>
                        <td>{formatMoney(row.balanceEffect)}</td>
                        <td>{row.reason}</td>
                        <td><span className="status-pill danger">Normal finans listesinden ayrıldı</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <section className="erp-panel">
        <div className="panel-title"><strong>Kayıtlı Ayarlar</strong><span>{settings.length} satır</span></div>
        <div className="table-shell">
          <table className="erp-table">
            <thead><tr><th>Grup</th><th>Anahtar</th><th>Tip</th><th>Değer</th><th>Açıklama</th></tr></thead>
            <tbody>
              {settings.map((item) => (
                <tr key={item.id}>
                  <td>{item.group}</td>
                  <td>{item.key}</td>
                  <td>{item.valueType}</td>
                  <td>{item.rawValue}</td>
                  <td>{item.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
