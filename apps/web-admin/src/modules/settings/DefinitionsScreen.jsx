import React, { useEffect, useState } from 'react';
import { fetchSettingsOverview, updateSettings } from '../../services/settingsApi.js';

const DEFINITION_FIELDS = [
  ['productUnits', 'Stok Birimleri'],
  ['customerTypes', 'Cari Tipleri'],
  ['paymentMethods', 'Ödeme/Tahsilat Yöntemleri'],
  ['currencies', 'Para Birimleri'],
];

function getValue(settings, key, fallback = []) {
  return settings.find((item) => item.group === 'definitions' && item.key === key)?.value ?? fallback;
}

export function DefinitionsScreen() {
  const [form, setForm] = useState({});
  const [settings, setSettings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function loadDefinitions() {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetchSettingsOverview();
      const list = response.data?.settings || [];
      setSettings(list.filter((item) => item.group === 'definitions'));
      setForm(Object.fromEntries(DEFINITION_FIELDS.map(([key]) => [key, (getValue(list, key, []) || []).join(',')])));
    } catch (error) {
      setErrorMessage(`${error.message || 'Tanimlar okunamadi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDefinitions();
  }, []);

  async function saveDefinitions() {
    setIsSaving(true);
    setMessage('');
    setErrorMessage('');
    try {
      const payload = DEFINITION_FIELDS.map(([key]) => ({
        group: 'definitions',
        key,
        valueType: 'json',
        value: String(form[key] || '').split(',').map((item) => item.trim()).filter(Boolean),
      }));
      const response = await updateSettings({ settings: payload });
      setSettings((response.data?.settings || []).filter((item) => item.group === 'definitions'));
      setMessage('Tanım listeleri kaydedildi.');
    } catch (error) {
      setErrorMessage(`${error.message || 'Tanimlar kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="work-area dashboard-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Tanım Listeleri</strong>
          <span>Stok, cari, ödeme ve para birimi tanımları</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={saveDefinitions} disabled={isSaving}>{isSaving ? 'Kaydediliyor' : 'Kaydet'}</button>
          <button type="button" onClick={loadDefinitions}>Yenile</button>
        </div>
      </section>
      {isLoading && <div className="list-state">Tanımlar API'den okunuyor...</div>}
      {message && <div className="list-state list-state-success">{message}</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
      <section className="split-grid">
        {DEFINITION_FIELDS.map(([key, label]) => (
          <section className="erp-panel" key={key}>
            <div className="panel-title"><strong>{label}</strong><span>Virgül ile ayır</span></div>
            <textarea className="definition-textarea" value={form[key] || ''} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />
          </section>
        ))}
      </section>
      <section className="erp-panel">
        <div className="panel-title"><strong>Kayıtlı Tanımlar</strong><span>{settings.length} grup</span></div>
        <div className="table-shell">
          <table className="erp-table">
            <thead><tr><th>Anahtar</th><th>Tip</th><th>Değer</th><th>Açıklama</th></tr></thead>
            <tbody>{settings.map((item) => <tr key={item.id}><td>{item.key}</td><td>{item.valueType}</td><td>{item.rawValue}</td><td>{item.description}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
