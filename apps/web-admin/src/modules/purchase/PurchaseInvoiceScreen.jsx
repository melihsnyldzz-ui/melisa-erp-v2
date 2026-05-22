import React, { useEffect, useMemo, useState } from 'react';
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
import { createPurchaseDraft, fetchPurchaseInvoice, updatePurchaseDraft } from '../../services/invoiceDraftApi.js';

function calculateTotals(items, invoiceRate, supplierRate) {
  const subtotal = items.reduce((total, item) => total + item.quantity * item.purchasePrice, 0);
  const lineDiscountTotal = items.reduce((total, item) => {
    const gross = item.quantity * item.purchasePrice;
    return total + gross * (item.lineDiscountRate / 100);
  }, 0);
  const afterLineDiscounts = subtotal - lineDiscountTotal;
  const invoiceDiscountAmount = afterLineDiscounts * (invoiceRate / 100);
  const afterInvoiceDiscount = afterLineDiscounts - invoiceDiscountAmount;
  const supplierDiscountAmount = afterInvoiceDiscount * (supplierRate / 100);
  const grandTotal = afterInvoiceDiscount - supplierDiscountAmount;

  return {
    subtotal,
    lineDiscountTotal,
    invoiceDiscountRate: invoiceRate,
    supplierDiscountRate: supplierRate,
    grandTotal,
    tryEquivalent: grandTotal,
    stockCostEffect: grandTotal,
  };
}

function formatDate(value) {
  if (!value) {
    return purchaseInvoiceHeader.date;
  }

  return String(value).slice(0, 10);
}

function mapDraftToInvoice(draft) {
  return {
    invoiceNo: draft.documentNo,
    date: formatDate(draft.documentDate),
    supplierId: draft.supplierId,
    supplier: draft.supplierName || `Tedarikci #${draft.supplierId}`,
    supplierCurrency: draft.supplierCurrency,
    invoiceCurrency: draft.documentCurrency,
    exchangeRate: `${draft.documentCurrency} ${Number(draft.exchangeRate || 1).toFixed(4)}`,
    exchangeRateValue: Number(draft.exchangeRate || 1),
    description: draft.description || '',
    status: draft.status === 'DRAFT' ? 'Taslak' : draft.status,
  };
}

function mapDraftItems(items = []) {
  return items.map((item, index) => ({
    id: item.id ?? index + 1,
    productId: item.productId,
    stockCode: item.stockCode,
    barcode: item.barcode || '-',
    productName: item.productName,
    quantity: Number(item.quantity || 0),
    currency: item.currency,
    purchasePrice: Number(item.purchasePrice || 0),
    lineDiscountRate: Number(item.lineDiscountRate || 0),
    stockEffect: item.stockEffect || '-',
    note: item.note || '-',
  }));
}

export function PurchaseInvoiceScreen({ purchaseDraftId }) {
  const [draftId, setDraftId] = useState(purchaseDraftId ?? null);
  const [invoice, setInvoice] = useState(purchaseInvoiceHeader);
  const [items, setItems] = useState(purchaseInvoiceItems);
  const [invoiceRate, setInvoiceRate] = useState(invoiceDiscountRate);
  const [supplierRate, setSupplierRate] = useState(supplierGeneralDiscountRate);
  const [status, setStatus] = useState(purchaseInvoiceHeader.status);
  const [selectedItemId, setSelectedItemId] = useState(purchaseInvoiceItems[0]?.id);
  const [statusMessage, setStatusMessage] = useState('Taslak alis fisi stok artirmaz ve cari hareket olusturmaz.');
  const [isLoading, setIsLoading] = useState(Boolean(purchaseDraftId));
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const totals = useMemo(
    () => calculateTotals(items, invoiceRate, supplierRate),
    [invoiceRate, items, supplierRate],
  );

  useEffect(() => {
    if (!purchaseDraftId) {
      return undefined;
    }

    let isMounted = true;

    async function loadDraft() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchPurchaseInvoice(purchaseDraftId);
        const nextInvoice = mapDraftToInvoice(response.data);
        const nextItems = mapDraftItems(response.data.items);

        if (isMounted) {
          setDraftId(response.data.id);
          setInvoice(nextInvoice);
          setItems(nextItems);
          setInvoiceRate(Number(response.data.invoiceDiscountRate || 0));
          setSupplierRate(Number(response.data.supplierDiscountRate || 0));
          setStatus(nextInvoice.status);
          setSelectedItemId(nextItems[0]?.id ?? null);
          setStatusMessage(`Alis taslagi DB'den acildi (#${response.data.id}); ticari etki yok.`);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(`${error.message || 'Alis taslagi okunamadi.'} (${error.code || 'API_ERROR'})`);
          setStatusMessage('Alis taslak okuma basarisiz; API/DB kontrol edilmeli.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDraft();

    return () => {
      isMounted = false;
    };
  }, [purchaseDraftId]);

  function buildDraftPayload() {
    return {
      documentNo: invoice.invoiceNo,
      documentDate: invoice.date,
      supplierId: invoice.supplierId,
      supplierName: invoice.supplier,
      supplierCurrency: invoice.supplierCurrency,
      documentCurrency: invoice.invoiceCurrency,
      exchangeRate: invoice.exchangeRateValue || 1,
      description: invoice.description,
      invoiceDiscountRate: invoiceRate,
      supplierDiscountRate: supplierRate,
      items: items.map((item, index) => ({
        productId: item.productId || index + 1,
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
    setInvoice(purchaseInvoiceHeader);
    setItems(purchaseInvoiceItems);
    setInvoiceRate(invoiceDiscountRate);
    setSupplierRate(supplierGeneralDiscountRate);
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
      const nextInvoice = mapDraftToInvoice(response.data);
      const nextItems = mapDraftItems(response.data.items);

      setDraftId(response.data.id);
      setInvoice(nextInvoice);
      setItems(nextItems);
      setInvoiceRate(Number(response.data.invoiceDiscountRate || 0));
      setSupplierRate(Number(response.data.supplierDiscountRate || 0));
      setStatus('Taslak');
      setSelectedItemId(nextItems[0]?.id ?? null);
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
        {isLoading && <div className="list-state">Alis taslagi API'den okunuyor...</div>}
        {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {isSaving && <div className="list-state">Alis taslagi API'ye kaydediliyor...</div>}
        {!isLoading && !errorMessage && items.length === 0 && (
          <div className="list-state">Alis taslak satiri bulunamadi.</div>
        )}
        <PurchaseInvoiceHeader invoice={invoice} status={status} />
        <PurchaseInvoiceSupplierPanel invoice={invoice} permissions={purchaseInvoicePermissions} />
        <PurchaseInvoiceItemsTable
          items={items}
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
        />
        <PurchaseInvoiceTotals totals={totals} />
        <PurchaseInvoiceRulesPanel rules={purchaseInvoiceRules} statusMessage={statusMessage} />
      </section>
      <section className="screen-summary purchase-invoice-summary">
        <span>Fis: {invoice.invoiceNo}</span>
        <span>Draft ID: {draftId ?? 'yok'}</span>
        <span>Durum: {status}</span>
        <span>Satir: {items.length}</span>
        <span>Kaynak: API draft</span>
      </section>
    </main>
  );
}
