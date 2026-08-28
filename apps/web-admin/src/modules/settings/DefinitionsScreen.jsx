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
  const [activeDefinition, setActiveDefinition] = useState(DEFINITION_FIELDS[0][0]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function loadDefinitions() {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetchSettingsOverview();
      const list = response.data.settings || [];
      setSettings(list.filter((item) => item.group === 'definitions'));
      setForm(Object.fromEntries(DEFINITION_FIELDS.map(([key]) => [key, (getValue(list, key, []) || []).join(',')])));
    } catch (error) {
      setErrorMessage(`${error.message || 'Tanımlar okunamadı.'} (${error.code || 'API_ERROR'})`);
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
      setSettings((response.data.settings || []).filter((item) => item.group === 'definitions'));
      setMessage('Tanım listeleri kaydedildi.');
    } catch (error) {
      setErrorMessage(`${error.message || 'Tanımlar kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  const activeField = DEFINITION_FIELDS.find(([key]) => key === activeDefinition) || DEFINITION_FIELDS[0];

  return (
    <main className="work-area dashboard-screen definitions-screen">
      <section className="dashboard-toolbar">
        <div className="dashboard-toolbar-title">
          <strong>Tanım Listeleri</strong>
          <span>Stok, cari, ödeme ve para birimi tanımları</span>
        </div>
        <div className="dashboard-toolbar-actions">
          <button type="button" onClick={loadDefinitions}>Yenile</button>
          <button type="button" className="primary" onClick={saveDefinitions} disabled={isSaving}>{isSaving ? 'Kaydediliyor' : 'Kaydet'}</button>
        </div>
      </section>

      {isLoading && <div className="list-state">Tanımlar API'den okunuyor...</div>}
      {message && <div className="list-state list-state-success">{message}</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}

      <details className="definition-boundary-note">
        <summary>Kaydetme etkisi</summary>
        <div className="list-state">
          Kaydet; stok birimi, cari tipi, ödeme/tahsilat yöntemi ve para birimi tanımlarını API'ye yazar. Bu ekran import veya migration çalıştırmaz, mevcut fişleri toplu olarak düzeltmez.
        </div>
      </details>

      <section className="erp-panel definition-editor-panel">
        <div className="definition-selector" role="tablist" aria-label="Tanım grupları">
          {DEFINITION_FIELDS.map(([key, label]) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeDefinition === key}
              className={activeDefinition === key ? 'active' : ''}
              key={key}
              onClick={() => setActiveDefinition(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="definition-active-field">
          <span>
            <strong>{activeField[1]}</strong>
            <small>Değerleri virgül ile ayırın</small>
          </span>
          <textarea
            className="definition-textarea"
            value={form[activeField[0]] || ''}
            onChange={(event) => setForm((current) => ({ ...current, [activeField[0]]: event.target.value }))}
          />
        </label>
      </section>

      <details className="erp-panel definition-registered-details">
        <summary>
          <span>
            <strong>Kayıtlı Tanımlar</strong>
            <small>API tarafından dönen teknik görünüm</small>
          </span>
          <b>{settings.length} grup</b>
        </summary>
        <div className="table-shell">
          <table className="erp-table">
            <thead><tr><th>Anahtar</th><th>Tip</th><th>Değer</th><th>Açıklama</th></tr></thead>
            <tbody>{settings.map((item) => <tr key={item.id}><td>{item.key}</td><td>{item.valueType}</td><td>{item.rawValue}</td><td>{item.description}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </main>
  );
}
