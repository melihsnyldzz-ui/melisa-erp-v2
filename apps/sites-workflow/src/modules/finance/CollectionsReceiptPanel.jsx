import React from 'react';
import { partyLabel } from './collectionsFormatters.js';
import {formatCashMoney} from './cashReadMoney.js';

export function CollectionsReceiptPanel({ selectedReceipt, onPrint, onClose }) {
  if (!selectedReceipt) return null;

  return (
    <section className="erp-panel finance-receipt-panel">
      <div className="panel-title">
        <strong>{selectedReceipt.type}</strong>
        <span>{selectedReceipt.receiptNo} / {selectedReceipt.source}</span>
      </div>
      <div className="finance-receipt-paper">
        <div>
          <span>Makbuz No</span>
          <strong>{selectedReceipt.receiptNo}</strong>
        </div>
        <div>
          <span>Tarih</span>
          <strong>{selectedReceipt.documentDate || '-'}</strong>
        </div>
        <div>
          <span>Cari Türü</span>
          <strong>{partyLabel(selectedReceipt.partyType)}</strong>
        </div>
        <div>
          <span>Cari</span>
          <strong>{selectedReceipt.partyCode} / {selectedReceipt.partyName}</strong>
        </div>
        <div>
          <span>Ödeme Şekli</span>
          <strong>{selectedReceipt.paymentMethod}</strong>
        </div>
        <div>
          <span>Kasa / Banka</span>
          <strong>{selectedReceipt.accountLabel || '-'}</strong>
        </div>
        <div>
          <span>Tutar</span>
          <strong className="ledger-credit">{formatCashMoney(selectedReceipt.amount, selectedReceipt.currency)}</strong>
        </div>
        <div>
          <span>Bakiye Etkisi</span>
          <strong className="ledger-credit">{formatCashMoney(selectedReceipt.balanceEffect, selectedReceipt.currency)}</strong>
        </div>
      </div>
      <div className="segmented-control">
        <button type="button" onClick={onPrint}>Makbuz Yazdır</button>
        <button type="button" onClick={onClose}>Kapat</button>
      </div>
    </section>
  );
}
