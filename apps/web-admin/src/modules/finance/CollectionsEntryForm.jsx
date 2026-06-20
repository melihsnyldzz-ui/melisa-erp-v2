import React from 'react';
import { formatMoney, partyCode, partyName } from './collectionsFormatters.js';

export function CollectionsEntryForm({
  mode,
  form,
  partyOptions,
  selectedPartyId,
  currentParty,
  currentBalance,
  partyCurrency,
  accountOptions,
  canSubmit,
  isSaving,
  onUpdateField,
  onSubmit,
}) {
  return (
    <form className="erp-panel collections-entry-card" onSubmit={onSubmit}>
      <div className="panel-title">
        <strong>{mode === 'collection' ? 'Müşteriden Tahsilat' : 'Tedarikçiye Ödeme'}</strong>
        <span>{currentParty ? `Seçili bakiye: ${formatMoney(currentBalance, partyCurrency)}` : 'Önce cari seçin'}</span>
      </div>
      <div className="collections-form-grid">
        <label className="wide">
          {mode === 'collection' ? 'Müşteri' : 'Tedarikçi'}
          <select
            required
            value={selectedPartyId}
            onChange={(event) => onUpdateField(mode === 'collection' ? 'customerId' : 'supplierId', event.target.value)}
          >
            <option value="">Seçin</option>
            {partyOptions.map((party) => (
              <option key={party.id} value={party.id}>
                {mode === 'collection'
                  ? `${party.customerCode} / ${party.customerName} / ${formatMoney(party.balance, party.currency)}`
                  : `${party.supplierCode} / ${party.supplierName} / ${formatMoney(party.balance, party.currency)}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tarih
          <input required type="date" value={form.documentDate} onChange={(event) => onUpdateField('documentDate', event.target.value)} />
        </label>
        <label className="positive-input amount-field">
          Giren Tutar
          <input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => onUpdateField('amount', event.target.value)} />
        </label>
        <label>
          Para Birimi
          <select value={form.currency} onChange={(event) => onUpdateField('currency', event.target.value)}>
            <option value="TRY">TRY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label>
          Ödeme Şekli
          <select value={form.paymentMethod} onChange={(event) => onUpdateField('paymentMethod', event.target.value)}>
            <option value="cash">Nakit</option>
            <option value="bank">Banka</option>
            <option value="card">Kart</option>
            <option value="other">Diğer</option>
          </select>
        </label>
        <label>
          Kasa / Banka Hesabı
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
          Açıklama
          <input value={form.description} onChange={(event) => onUpdateField('description', event.target.value)} placeholder="Opsiyonel not" />
        </label>
        <button className="primary" disabled={!canSubmit} type="submit">
          {isSaving ? 'Kaydediliyor...' : mode === 'collection' ? 'Tahsilat Kaydet' : 'Ödeme Kaydet'}
        </button>
      </div>
    </form>
  );
}

export function CollectionsEffectPanel({
  mode,
  currentParty,
  currentBalance,
  nextBalance,
  amount,
  hasValidAmount,
  partyCurrency,
  formCurrency,
  canSubmit,
  onOpenSelectedParty,
}) {
  return (
    <aside className="erp-panel finance-effect-panel">
      <div className="panel-title">
        <strong>İşlem Etkisi</strong>
        <span>Kaydetmeden önce cari bakiyeye etkisi</span>
      </div>
      <div className={canSubmit ? 'finance-effect-result ready' : 'finance-effect-result'}>
        <span>{mode === 'collection' ? 'Tahsilat etkisi' : 'Ödeme etkisi'}</span>
        <strong>{currentParty && hasValidAmount ? formatMoney(nextBalance, partyCurrency) : '-'}</strong>
        <small>{currentParty && hasValidAmount ? 'İşlem sonrası beklenen bakiye' : 'Cari ve tutar seçilince hesaplanır'}</small>
      </div>
      <dl className="supplier-summary-list">
        <div>
          <dt>Cari</dt>
          <dd>{currentParty ? `${partyCode(currentParty, mode)} / ${partyName(currentParty, mode)}` : '-'}</dd>
        </div>
        <div>
          <dt>Mevcut bakiye</dt>
          <dd className="ledger-debit">{currentParty ? formatMoney(currentBalance, partyCurrency) : '-'}</dd>
        </div>
        <div>
          <dt>{mode === 'collection' ? 'Tahsilat girişi' : 'Ödeme çıkışı'}</dt>
          <dd className="ledger-credit">{hasValidAmount ? formatMoney(amount, formCurrency) : '-'}</dd>
        </div>
        <div>
          <dt>İşlem sonrası bakiye</dt>
          <dd className={nextBalance > 0 ? 'ledger-debit' : 'ledger-credit'}>{currentParty && hasValidAmount ? formatMoney(nextBalance, partyCurrency) : '-'}</dd>
        </div>
        <div>
          <dt>İşlem sonucu</dt>
          <dd>{currentParty && hasValidAmount ? (nextBalance < 0 ? 'Avans oluşur' : 'Bakiye azalır') : 'Bekleniyor'}</dd>
        </div>
      </dl>
      <div className="collections-side-actions">
        <button type="button" disabled={!currentParty} onClick={onOpenSelectedParty}>Cari Kartı Aç</button>
      </div>
    </aside>
  );
}
