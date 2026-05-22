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
import { createSalesDraft, updateSalesDraft } from '../../services/invoiceDraftApi.js';

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
  const [draftId, setDraftId] = useState(null);
  const [status, setStatus] = useState(salesInvoiceHeader.status);
  const [selectedItemId, setSelectedItemId] = useState(salesInvoiceItems[0]?.id);
  const [statusMessage, setStatusMessage] = useState('Taslak fis henuz stok veya cari hareket olusturmaz.');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const totals = useMemo(() => calculateTotals(salesInvoiceItems), []);

  function buildDraftPayload() {
    return {
      documentNo: salesInvoiceHeader.invoiceNo,
      documentDate: salesInvoiceHeader.date,
      customerId: 1,
      customerCurrency: salesInvoiceHeader.customerCurrency,
      documentCurrency: salesInvoiceHeader.invoiceCurrency,
      exchangeRate: 1,
      description: salesInvoiceHeader.description,
      discountRate: invoiceDiscountRate,
      estimatedProfitTry: totals.estimatedProfit,
      items: salesInvoiceItems.map((item, index) => ({
        productId: index + 1,
        stockCode: item.stockCode,
        barcode: item.barcode,
        productName: item.productName,
        quantity: item.quantity,
        currency: item.currency,
        unitPrice: item.unitPrice,
        averageCostTry: item.averageCostTry,
        stockStatus: item.stockState,
        note: item.note,
      })),
    };
  }

  function createNewDraft() {
    setDraftId(null);
    setStatus('Taslak');
    setSelectedItemId(salesInvoiceItems[0]?.id);
    setErrorMessage('');
    setStatusMessage('Yeni taslak hazirlandi; kaydedilene kadar ticari etki yok.');
  }

  async function saveDraft() {
    setIsSaving(true);
    setErrorMessage('');

    try {
      const payload = buildDraftPayload();
      const response = draftId
        ? await updateSalesDraft(draftId, payload)
        : await createSalesDraft(payload);

      setDraftId(response.data.id);
      setStatus('Taslak');
      setStatusMessage(`Taslak fis DB'ye kaydedildi (#${response.data.id}); stok ve cari etkisi olusmadi.`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Taslak kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
      setStatusMessage('Taslak kaydi basarisiz; API/DB kontrol edilmeli.');
    } finally {
      setIsSaving(false);
    }
  }

  function finalizeInvoice() {
    setStatusMessage('Kesinlestirme bu sprintte kapali; stok dusumu ve cari hareket olusmaz.');
  }

  return (
    <main className="work-area sales-invoice-screen">
      <SalesInvoiceToolbar
        status={status}
        isSaving={isSaving}
        onNewDraft={createNewDraft}
        onSaveDraft={saveDraft}
        onFinalize={finalizeInvoice}
      />
      <section className="sales-invoice-layout">
        {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {isSaving && <div className="list-state">Taslak fis API'ye kaydediliyor...</div>}
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
        <span>Draft ID: {draftId ?? 'yok'}</span>
        <span>Durum: {status}</span>
        <span>Satir: {salesInvoiceItems.length}</span>
        <span>Kaynak: API draft</span>
      </section>
    </main>
  );
}
