import React, { useMemo, useState } from 'react';
import { SalesInvoiceCustomerPanel } from './SalesInvoiceCustomerPanel.jsx';
import { SalesInvoiceHeader } from './SalesInvoiceHeader.jsx';
import { SalesInvoiceItemsTable } from './SalesInvoiceItemsTable.jsx';
import { SalesInvoiceRulesPanel } from './SalesInvoiceRulesPanel.jsx';
import { SalesInvoiceToolbar } from './SalesInvoiceToolbar.jsx';
import { SalesInvoiceTotals } from './SalesInvoiceTotals.jsx';
import {
  invoiceDiscountRate,
  salesInvoiceHeader,
  salesInvoiceItems,
  salesInvoicePermissions,
  salesInvoiceRules,
} from './salesInvoiceMockData.js';

function calculateTotals(items) {
  const subtotal = items.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
  const totalCost = items.reduce((total, item) => total + item.quantity * item.averageCostTry, 0);
  const discountAmount = subtotal * (invoiceDiscountRate / 100);
  const grandTotal = subtotal - discountAmount;
  const estimatedProfit = grandTotal - totalCost;

  return {
    subtotal,
    discountRate: invoiceDiscountRate,
    discountAmount,
    grandTotal,
    tryEquivalent: grandTotal,
    estimatedProfit,
  };
}

export function SalesInvoiceScreen() {
  const [status, setStatus] = useState(salesInvoiceHeader.status);
  const [selectedItemId, setSelectedItemId] = useState(salesInvoiceItems[0]?.id);
  const [statusMessage, setStatusMessage] = useState('Taslak fis henuz stok veya cari hareket olusturmaz.');
  const totals = useMemo(() => calculateTotals(salesInvoiceItems), []);

  function createNewDraft() {
    setStatus('Taslak');
    setSelectedItemId(salesInvoiceItems[0]?.id);
    setStatusMessage('Yeni mock taslak acildi; ticari etki yok.');
  }

  function saveDraft() {
    setStatus('Taslak');
    setStatusMessage('Taslak mock olarak kaydedildi; stok ve cari etkisi olusmadi.');
  }

  function finalizeInvoice() {
    setStatus('Kesinlesti');
    setStatusMessage('Mock kesinlestirme yapildi; gercek stok dusumu veya SQL yazimi yok.');
  }

  return (
    <main className="work-area sales-invoice-screen">
      <SalesInvoiceToolbar
        status={status}
        onNewDraft={createNewDraft}
        onSaveDraft={saveDraft}
        onFinalize={finalizeInvoice}
      />
      <section className="sales-invoice-layout">
        <SalesInvoiceHeader invoice={salesInvoiceHeader} status={status} />
        <SalesInvoiceCustomerPanel invoice={salesInvoiceHeader} permissions={salesInvoicePermissions} />
        <SalesInvoiceItemsTable
          items={salesInvoiceItems}
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
        />
        <SalesInvoiceTotals totals={totals} />
        <SalesInvoiceRulesPanel rules={salesInvoiceRules} statusMessage={statusMessage} />
      </section>
      <section className="screen-summary sales-invoice-summary">
        <span>Fis: {salesInvoiceHeader.invoiceNo}</span>
        <span>Durum: {status}</span>
        <span>Satir: {salesInvoiceItems.length}</span>
        <span>API/SQL/Auth bagli degil</span>
      </section>
    </main>
  );
}
