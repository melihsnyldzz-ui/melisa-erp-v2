import React, { useMemo, useState } from 'react';
import { PurchaseInvoiceHeader } from './PurchaseInvoiceHeader.jsx';
import { PurchaseInvoiceItemsTable } from './PurchaseInvoiceItemsTable.jsx';
import { PurchaseInvoiceRulesPanel } from './PurchaseInvoiceRulesPanel.jsx';
import { PurchaseInvoiceSupplierPanel } from './PurchaseInvoiceSupplierPanel.jsx';
import { PurchaseInvoiceToolbar } from './PurchaseInvoiceToolbar.jsx';
import { PurchaseInvoiceTotals } from './PurchaseInvoiceTotals.jsx';
import {
  invoiceDiscountRate,
  purchaseInvoiceHeader,
  purchaseInvoiceItems,
  purchaseInvoicePermissions,
  purchaseInvoiceRules,
  supplierGeneralDiscountRate,
} from './purchaseInvoiceMockData.js';

function calculateTotals(items) {
  const subtotal = items.reduce((total, item) => total + item.quantity * item.purchasePrice, 0);
  const lineDiscountTotal = items.reduce((total, item) => {
    const gross = item.quantity * item.purchasePrice;
    return total + gross * (item.lineDiscountRate / 100);
  }, 0);
  const afterLineDiscounts = subtotal - lineDiscountTotal;
  const invoiceDiscountAmount = afterLineDiscounts * (invoiceDiscountRate / 100);
  const afterInvoiceDiscount = afterLineDiscounts - invoiceDiscountAmount;
  const supplierDiscountAmount = afterInvoiceDiscount * (supplierGeneralDiscountRate / 100);
  const grandTotal = afterInvoiceDiscount - supplierDiscountAmount;

  return {
    subtotal,
    lineDiscountTotal,
    invoiceDiscountRate,
    supplierDiscountRate: supplierGeneralDiscountRate,
    grandTotal,
    tryEquivalent: grandTotal,
    stockCostEffect: grandTotal,
  };
}

export function PurchaseInvoiceScreen() {
  const [status, setStatus] = useState(purchaseInvoiceHeader.status);
  const [selectedItemId, setSelectedItemId] = useState(purchaseInvoiceItems[0]?.id);
  const [statusMessage, setStatusMessage] = useState('Taslak alis fisi stok artirmaz ve cari hareket olusturmaz.');
  const totals = useMemo(() => calculateTotals(purchaseInvoiceItems), []);

  function createNewDraft() {
    setStatus('Taslak');
    setSelectedItemId(purchaseInvoiceItems[0]?.id);
    setStatusMessage('Yeni mock alis taslagi acildi; ticari etki yok.');
  }

  function saveDraft() {
    setStatus('Taslak');
    setStatusMessage('Taslak mock olarak kaydedildi; stok, cari ve average cost etkisi olusmadi.');
  }

  function finalizeInvoice() {
    setStatus('Kesinlesti');
    setStatusMessage('Mock kesinlestirme yapildi; gercek stok artisi, SQL yazimi veya average cost guncellemesi yok.');
  }

  return (
    <main className="work-area purchase-invoice-screen">
      <PurchaseInvoiceToolbar
        status={status}
        onNewDraft={createNewDraft}
        onSaveDraft={saveDraft}
        onFinalize={finalizeInvoice}
      />
      <section className="purchase-invoice-layout">
        <PurchaseInvoiceHeader invoice={purchaseInvoiceHeader} status={status} />
        <PurchaseInvoiceSupplierPanel invoice={purchaseInvoiceHeader} permissions={purchaseInvoicePermissions} />
        <PurchaseInvoiceItemsTable
          items={purchaseInvoiceItems}
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
        />
        <PurchaseInvoiceTotals totals={totals} />
        <PurchaseInvoiceRulesPanel rules={purchaseInvoiceRules} statusMessage={statusMessage} />
      </section>
      <section className="screen-summary purchase-invoice-summary">
        <span>Fis: {purchaseInvoiceHeader.invoiceNo}</span>
        <span>Durum: {status}</span>
        <span>Satir: {purchaseInvoiceItems.length}</span>
        <span>API/SQL/Auth bagli degil</span>
      </section>
    </main>
  );
}
