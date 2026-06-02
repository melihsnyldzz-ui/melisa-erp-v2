import React, { useEffect, useMemo, useState } from 'react';
import { fetchSettingsOverview, updateSettings } from '../../services/settingsApi.js';

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

function getValue(settings, group, key, fallback = '') {
  return settings.find((item) => item.group === group && item.key === key)?.value ?? fallback;
}

export function SystemSettingsScreen() {
  const [settings, setSettings] = useState([]);
  const [form, setForm] = useState({ company: {}, documentSeries: {}, tax: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const vatRatesText = useMemo(() => (Array.isArray(form.tax.vatRates) ? form.tax.vatRates.join(',') : String(form.tax.vatRates || '')), [form.tax.vatRates]);

  async function loadSettings() {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetchSettingsOverview();
      const list = response.data?.settings || [];
      setSettings(list);
      setForm({
        company: Object.fromEntries(COMPANY_FIELDS.map(([key]) => [key, getValue(list, 'company', key, '')])),
        documentSeries: Object.fromEntries(SERIES_FIELDS.map(([key]) => [key, getValue(list, 'documentSeries', key, '')])),
        tax: {
          defaultVatRate: getValue(list, 'tax', 'defaultVatRate', 20),
          vatRates: getValue(list, 'tax', 'vatRates', [0, 1, 10, 20]),
        },
      });
    } catch (error) {
      setErrorMessage(`${error.message || 'Ayarlar okunamadi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
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
      ];
      const response = await updateSettings({ settings: payload });
      setSettings(response.data?.settings || []);
      setMessage('Sistem ayarlari kaydedildi.');
    } catch (error) {
      setErrorMessage(`${error.message || 'Ayarlar kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="work-area dashboard-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Sistem Ayarları</strong>
          <span>Firma, belge seri ve vergi/KDV varsayılanları</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={saveSettings} disabled={isSaving}>{isSaving ? 'Kaydediliyor' : 'Kaydet'}</button>
          <button type="button" onClick={loadSettings}>Yenile</button>
        </div>
      </section>
      {isLoading && <div className="list-state">Ayarlar API'den okunuyor...</div>}
      {message && <div className="list-state list-state-success">{message}</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
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
      <section className="erp-panel">
        <div className="panel-title"><strong>Kayıtlı Ayarlar</strong><span>{settings.length} satır</span></div>
        <div className="table-shell">
          <table className="erp-table">
            <thead><tr><th>Grup</th><th>Anahtar</th><th>Tip</th><th>Değer</th><th>Açıklama</th></tr></thead>
            <tbody>{settings.map((item) => <tr key={item.id}><td>{item.group}</td><td>{item.key}</td><td>{item.valueType}</td><td>{item.rawValue}</td><td>{item.description}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
