import React, { useEffect, useMemo, useState } from 'react';
import { fetchCurrencyRates, updateCurrencyRates } from '../../services/currencyRateApi.js';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function rateMap(rateData) {
  return Object.fromEntries((rateData?.rates || []).map((rate) => [rate.currency, rate]));
}

export function CurrencyRatesScreen() {
  const [date, setDate] = useState(todayIsoDate());
  const [rates, setRates] = useState(/** @type {{USD: number | string, EUR: number | string}} */ ({ USD: '', EUR: '' }));
  const [rateData, setRateData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const currentRates = useMemo(() => rateMap(rateData), [rateData]);
  const usdRate = Number(rates.USD || 0);
  const eurRate = Number(rates.EUR || 0);
  const canSaveRates = Boolean(date) && usdRate > 0 && eurRate > 0 && !isSaving;

  async function loadRates(nextDate = date) {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetchCurrencyRates({ date: nextDate });
      const nextRates = rateMap(response.data);
      setRateData(response.data);
      setRates({
        USD: nextRates.USD?.defined ? Number(nextRates.USD.rateToTry) : '',
        EUR: nextRates.EUR?.defined ? Number(nextRates.EUR.rateToTry) : '',
      });
    } catch (error) {
      setErrorMessage(`${error.message || 'Kur bilgisi okunamadı.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRates(date);
  }, []);

  async function saveRates() {
    if (!canSaveRates) {
      setErrorMessage('USD ve EUR kuru 0’dan büyük olmalı. Boş kur kaydedilemez.');
      setSuccessMessage('');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await updateCurrencyRates({
        date,
        source: 'manual-web-admin',
        rates: {
          USD: rates.USD,
          EUR: rates.EUR,
        },
      });
      const nextRates = rateMap(response.data);
      setRateData(response.data);
      setRates({
        USD: nextRates.USD?.defined ? Number(nextRates.USD.rateToTry) : '',
        EUR: nextRates.EUR?.defined ? Number(nextRates.EUR.rateToTry) : '',
      });
      setSuccessMessage('Döviz kurları kaydedildi. Yeni satış ve alış fişleri bu tanımlı kuru kullanır.');
    } catch (error) {
      setErrorMessage(`${error.message || 'Kur kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsSaving(false);
    }
  }

  function updateRate(currency, value) {
    setRates((current) => ({
      ...current,
      [currency]: value === '' ? '' : Math.max(0.0001, Number(value || 1)),
    }));
    setSuccessMessage('');
  }

  return (
    <main className="work-area currency-rates-screen report-definition-screen">
      <section className="invoice-list-toolbar">
        <div className="invoice-list-title">
          <strong>Döviz Kurları</strong>
          <span>Yeni fişlerde kullanılacak merkezi USD ve EUR kuru</span>
        </div>
        <div className="invoice-list-actions">
          <button type="button" onClick={() => loadRates(date)} disabled={isLoading}>Yenile</button>
          <button type="button" className="primary" onClick={saveRates} disabled={!canSaveRates}>
            {isSaving ? 'Kaydediliyor' : 'Kaydet'}
          </button>
        </div>
      </section>

      {isLoading && <div className="list-state">Kur bilgileri SQL'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
      {successMessage && <div className="list-state list-state-success">{successMessage}</div>}

      <details className="definition-boundary-note">
        <summary>Kaydetme etkisi</summary>
        <div className="list-state">
          Kaydet, USD ve EUR kurunu API'ye yazar ve yeni satış/alış fişlerinin kur snapshot davranışını etkiler. Eski kesinleşmiş fişleri toplu olarak yeniden hesaplamaz.
        </div>
      </details>

      <section className="erp-panel currency-rate-panel currency-rate-editor">
        <div className="panel-title">
          <strong>Günlük Kur Tanımı</strong>
          <span>TRY sabit 1.0000, USD ve EUR manuel tanımlanır</span>
        </div>
        <div className="currency-rate-grid">
          <label>
            <span>Tarih</span>
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                loadRates(event.target.value);
              }}
            />
          </label>
          <label>
            <span>TRY</span>
            <input readOnly value="1.0000" />
          </label>
          <label>
            <span>USD kuru</span>
            <input min="0.0001" step="0.0001" type="number" value={rates.USD} onChange={(event) => updateRate('USD', event.target.value)} />
          </label>
          <label>
            <span>EUR kuru</span>
            <input min="0.0001" step="0.0001" type="number" value={rates.EUR} onChange={(event) => updateRate('EUR', event.target.value)} />
          </label>
        </div>
      </section>

      <details className="erp-panel currency-rate-panel currency-snapshot-details">
        <summary>
          <span>
            <strong>Aktif Kur Snapshot</strong>
            <small>Sistemde tanımlı son kur ve teknik kaynak bilgisi</small>
          </span>
          <b>3 para birimi</b>
        </summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Para birimi</th>
                <th>TRY karşılığı</th>
                <th>Kur tarihi</th>
                <th>Kaynak</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {['TRY', 'USD', 'EUR'].map((currency) => (
                <tr key={currency}>
                  <td className="code-cell">{currency}</td>
                  <td>
                    {currency === 'TRY'
                      ? '1.0000'
                      : currentRates[currency]?.defined
                        ? Number(currentRates[currency].rateToTry).toFixed(4)
                        : '-'}
                  </td>
                  <td>{currentRates[currency]?.rateDate || date}</td>
                  <td>{currentRates[currency]?.source || '-'}</td>
                  <td>{currentRates[currency]?.defined ? 'Tanımlı' : 'Tanım bekliyor'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <section className="screen-summary">
        <span>USD: {rates.USD === '' ? 'Tanım yok' : Number(rates.USD).toFixed(4)}</span>
        <span>EUR: {rates.EUR === '' ? 'Tanım yok' : Number(rates.EUR).toFixed(4)}</span>
        <span>Kaynak: SQL currency_rates</span>
      </section>
    </main>
  );
}
