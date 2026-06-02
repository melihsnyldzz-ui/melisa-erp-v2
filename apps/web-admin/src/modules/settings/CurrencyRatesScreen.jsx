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
  const [rates, setRates] = useState({ USD: '', EUR: '' });
  const [rateData, setRateData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const currentRates = useMemo(() => rateMap(rateData), [rateData]);

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
      setErrorMessage(`${error.message || 'Kur bilgisi okunamadi.'} (${error.code || 'API_ERROR'})`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRates(date);
  }, []);

  async function saveRates() {
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
      setSuccessMessage('Doviz kurlari kaydedildi. Yeni satis fisleri bu tanimli kuru kullanir.');
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
    <main className="work-area currency-rates-screen">
      <section className="invoice-list-toolbar">
        <div className="invoice-list-title">
          <strong>Doviz Kurlari</strong>
          <span>Merkezi USD/EUR kur tanimi. Fisler son tanimli kuru snapshot olarak alir.</span>
        </div>
        <div className="invoice-list-actions">
          <button type="button" onClick={() => loadRates(date)} disabled={isLoading}>Yenile</button>
          <button type="button" className="primary" onClick={saveRates} disabled={isSaving}>
            {isSaving ? 'Kaydediliyor' : 'Kaydet'}
          </button>
        </div>
      </section>

      {isLoading && <div className="list-state">Kur bilgileri SQL'den okunuyor...</div>}
      {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
      {successMessage && <div className="list-state list-state-success">{successMessage}</div>}

      <section className="erp-panel currency-rate-panel">
        <div className="panel-title">
          <strong>Gunluk Kur Tanimi</strong>
          <span>TRY sabit 1.0000, USD/EUR manuel tanimlanir</span>
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

      <section className="erp-panel currency-rate-panel">
        <div className="panel-title">
          <strong>Aktif Kur Snapshot</strong>
          <span>Sistemde tanimli son kur kullanilir</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Para birimi</th>
                <th>TRY karsiligi</th>
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
                  <td>{currentRates[currency]?.defined ? 'Tanimli' : 'Tanim bekliyor'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="screen-summary">
        <span>USD: {rates.USD === '' ? 'Tanim yok' : Number(rates.USD).toFixed(4)}</span>
        <span>EUR: {rates.EUR === '' ? 'Tanim yok' : Number(rates.EUR).toFixed(4)}</span>
        <span>Kaynak: SQL currency_rates</span>
      </section>
    </main>
  );
}
