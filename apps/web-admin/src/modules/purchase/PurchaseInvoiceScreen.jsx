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
import { createPurchaseDraft, updatePurchaseDraft } from '../../services/invoiceDraftApi.js';

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
  const [draftId, setDraftId] = useState(null);
  const [status, setStatus] = useState(purchaseInvoiceHeader.status);
  const [selectedItemId, setSelectedItemId] = useState(purchaseInvoiceItems[0]?.id);
  const [statusMessage, setStatusMessage] = useState('Taslak alis fisi stok artirmaz ve cari hareket olusturmaz.');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const totals = useMemo(() => calculateTotals(purchaseInvoiceItems), []);

  function buildDraftPayload() {
    return {
      documentNo: purchaseInvoiceHeader.invoiceNo,
      documentDate: purchaseInvoiceHeader.date,
      supplierName: purchaseInvoiceHeader.supplier,
      supplierCurrency: purchaseInvoiceHeader.supplierCurrency,
      documentCurrency: purchaseInvoiceHeader.invoiceCurrency,
      exchangeRate: 1,
      description: purchaseInvoiceHeader.description,
      invoiceDiscountRate,
      supplierDiscountRate: supplierGeneralDiscountRate,
      items: purchaseInvoiceItems.map((item, index) => ({
        productId: index + 1,
        stockCode: item.stockCode,
        barcode: item.barcode,
        productName: item.productName,
        quantity: item.quantity,
        currency: item.currency,
        purchasePrice: item.purchasePrice,
        lineDiscountRate: item.lineDiscountRate,
        stockEffect: item.stockEffect,
        note: item.note,
      })),
    };
  }

  function createNewDraft() {
    setDraftId(null);
    setStatus('Taslak');
    setSelectedItemId(purchaseInvoiceItems[0]?.id);
    setErrorMessage('');
    setStatusMessage('Yeni alis taslagi hazirlandi; kaydedilene kadar ticari etki yok.');
  }

  async function saveDraft() {
    setIsSaving(true);
    setErrorMessage('');

    try {
      const payload = buildDraftPayload();
      const response = draftId
        ? await updatePurchaseDraft(draftId, payload)
        : await createPurchaseDraft(payload);

      setDraftId(response.data.id);
      setStatus('Taslak');
      setStatusMessage(`Alis taslagi DB'ye kaydedildi (#${response.data.id}); stok, cari ve average cost etkisi olusmadi.`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Alis taslagi kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
      setStatusMessage('Alis taslak kaydi basarisiz; API/DB kontrol edilmeli.');
    } finally {
      setIsSaving(false);
    }
  }

  function finalizeInvoice() {
    setStatusMessage('Kesinlestirme bu sprintte kapali; stok artisi, cari hareket ve average cost etkisi olusmaz.');
  }

  return (
    <main className="work-area purchase-invoice-screen">
      <PurchaseInvoiceToolbar
        status={status}
        isSaving={isSaving}
        onNewDraft={createNewDraft}
        onSaveDraft={saveDraft}
        onFinalize={finalizeInvoice}
      />
      <section className="purchase-invoice-layout">
        {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {isSaving && <div className="list-state">Alis taslagi API'ye kaydediliyor...</div>}
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
        <span>Draft ID: {draftId ?? 'yok'}</span>
        <span>Durum: {status}</span>
        <span>Satir: {purchaseInvoiceItems.length}</span>
        <span>Kaynak: API draft</span>
      </section>
    </main>
  );
}
