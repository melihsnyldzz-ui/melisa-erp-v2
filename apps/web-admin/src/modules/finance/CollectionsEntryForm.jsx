import React from 'react';
import { ArrowRight, ChevronDown, ExternalLink, Save } from 'lucide-react';
import { formatMoney, partyCode, partyName } from './collectionsFormatters.js';

export function CollectionsEntryForm({
  mode,
  form,
  partyOptions,
  partyQuery,
  currentParty,
  currentBalance,
  partyCurrency,
  accountOptions,
  canSubmit,
  isSaving,
  ratesReadonly,
  onUpdateField,
  onPartyQueryChange,
  onSubmit,
}) {
  const suggestionsId = mode === 'collection' ? 'collection-party-suggestions' : 'payment-party-suggestions';

  return (
    <form className="erp-panel collections-entry-card" onSubmit={onSubmit}>
      <div className="panel-title">
        <strong>{mode === 'collection' ? 'Müşteriden Tahsilat' : 'Tedarikçiye Ödeme'}</strong>
        <span>1. Cari seç &nbsp; 2. Tutarı gir &nbsp; 3. Etkiyi kontrol et</span>
      </div>
      <div className="collections-core-form">
        <label className="collections-party-field">
          <span>{mode === 'collection' ? 'Müşteri' : 'Tedarikçi'}</span>
          <input
            required
            list={suggestionsId}
            value={partyQuery}
            onChange={(event) => onPartyQueryChange(event.target.value)}
            placeholder="Kod veya cari adı yazın"
          />
          <datalist id={suggestionsId}>
            {partyOptions.map((party) => (
              <option
                key={party.id}
                value={`${partyCode(party, mode)} / ${partyName(party, mode)}`}
                label={`${formatMoney(party.balance, party.currency)}`}
              />
            ))}
          </datalist>
        </label>
        <label className="positive-input amount-field">
          <span>{mode === 'collection' ? 'Tahsilat Tutarı' : 'Ödeme Tutarı'}</span>
          <div className="collections-amount-control">
            <input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => onUpdateField('amount', event.target.value)} placeholder="0,00" />
            <b>{form.currency}</b>
          </div>
        </label>
        <button className="primary" disabled={!canSubmit} type="submit">
          <Save size={16} />{isSaving ? 'Kaydediliyor...' : mode === 'collection' ? 'Tahsilatı Kaydet' : 'Ödemeyi Kaydet'}
        </button>
      </div>
      <div className="collections-entry-context" aria-live="polite">
        <span className={currentParty ? 'is-ready' : ''}><b>Cari:</b> {currentParty ? `${partyCode(currentParty, mode)} / ${partyName(currentParty, mode)}` : 'Seçilmedi'}</span>
        <span><b>Mevcut bakiye:</b> {currentParty ? formatMoney(currentBalance, partyCurrency) : '-'}</span>
        <span><b>Yöntem:</b> {form.paymentMethod === 'cash' ? 'Nakit' : form.paymentMethod === 'bank' ? 'Banka' : form.paymentMethod === 'card' ? 'Kart' : 'Diğer'}</span>
      </div>
      {currentParty && <div className="collections-detail-grid" style={{ padding: '12px 16px' }}>
        <label>
          <span>İşlem kuru · 1 {form.currency} = TRY</span>
          <input type="number" min="0.00000001" step="0.00000001" value={form.exchangeRate}
            readOnly={ratesReadonly || form.currency === 'TRY'} placeholder="Kur gerekli"
            onChange={(event) => onUpdateField('exchangeRate', event.target.value)} />
        </label>
        <label>
          <span>Cari kuru · 1 {partyCurrency} = TRY</span>
          <input type="number" min="0.00000001" step="0.00000001" value={form.accountExchangeRate}
            readOnly={ratesReadonly || partyCurrency === 'TRY' || partyCurrency === form.currency} placeholder="Kur gerekli"
            onChange={(event) => onUpdateField('accountExchangeRate', event.target.value)} />
        </label>
        <small className="wide">Kurlar fiş tarihine göre alınır ve bu işlemde saklanır. Eksik döviz kurunu girin; TRY kuru 1’dir.</small>
      </div>}
      <details className="collections-entry-details">
        <summary><ChevronDown size={15} />İşlem ayrıntıları <small>Tarih, para birimi, yöntem, kasa/banka ve açıklama</small></summary>
        <div className="collections-detail-grid">
          <label>
            <span>Tarih</span>
            <input required type="date" value={form.documentDate} onChange={(event) => onUpdateField('documentDate', event.target.value)} />
          </label>
          <label>
            <span>Para Birimi</span>
            <select value={form.currency} onChange={(event) => onUpdateField('currency', event.target.value)}>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label>
            <span>İşlem Yöntemi</span>
            <select value={form.paymentMethod} onChange={(event) => onUpdateField('paymentMethod', event.target.value)}>
              <option value="cash">Nakit</option>
              <option value="bank">Banka</option>
              <option value="card">Kart</option>
              <option value="other">Diğer</option>
            </select>
          </label>
          <label>
            <span>Kasa / Banka Hesabı</span>
            <select value={form.accountId} onChange={(event) => onUpdateField('accountId', event.target.value)}>
              <option value="">Otomatik seç</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} / {account.name} / {formatMoney(account.currentBalance, account.currency)}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            <span>Açıklama</span>
            <input value={form.description} onChange={(event) => onUpdateField('description', event.target.value)} placeholder="Opsiyonel not" />
          </label>
        </div>
      </details>
    </form>
  );
}

export function CollectionsEffectPanel({
  mode,
  currentParty,
  currentBalance,
  nextBalance,
  amount,
  accountAmount,
  hasValidAmount,
  partyCurrency,
  formCurrency,
  canSubmit,
  onOpenSelectedParty,
}) {
  return (
    <aside className="erp-panel finance-effect-panel">
      <div className="panel-title">
        <strong>İşlem Önizleme</strong>
        <span>Kaydetmeden önce son kontrol</span>
      </div>
      <div className={canSubmit ? 'finance-effect-flow ready' : 'finance-effect-flow'}>
        <span><small>Mevcut</small><strong>{currentParty ? formatMoney(currentBalance, partyCurrency) : '-'}</strong></span>
        <ArrowRight size={18} />
        <span><small>Cari azalması</small><strong>{hasValidAmount ? formatMoney(accountAmount, partyCurrency) : '-'}</strong></span>
        <ArrowRight size={18} />
        <span className="result"><small>İşlem sonrası</small><strong>{currentParty && hasValidAmount ? formatMoney(nextBalance, partyCurrency) : '-'}</strong></span>
      </div>
      <p className="finance-effect-note">{mode === 'collection' ? 'Tahsil edilen' : 'Ödenen'}: {hasValidAmount ? formatMoney(amount, formCurrency) : '-'}</p>
      <p className="finance-effect-note">
        {currentParty && hasValidAmount ? (nextBalance < 0 ? 'Bu işlem caride avans oluşturur.' : 'Bu işlem cari bakiyesini azaltır.') : 'Önizleme için cari ve tutar seçin.'}
      </p>
      <div className="collections-side-actions">
        <button type="button" disabled={!currentParty} onClick={onOpenSelectedParty}><ExternalLink size={15} />Cari Kartını Aç</button>
      </div>
    </aside>
  );
}
