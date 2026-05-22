import React, { useEffect, useMemo, useState } from 'react';
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
import {
  createSalesDraft,
  fetchSalesInvoice,
  finalizeSalesInvoice,
  updateSalesDraft,
} from '../../services/invoiceDraftApi.js';

function calculateTotals(items, discountRate) {
  const subtotal = items.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
  const totalCost = items.reduce((total, item) => total + item.quantity * item.averageCostTry, 0);
  const discountAmount = subtotal * (discountRate / 100);
  const grandTotal = subtotal - discountAmount;
  const estimatedProfit = grandTotal - totalCost;

  return {
    subtotal,
    discountRate,
    discountAmount,
    grandTotal,
    tryEquivalent: grandTotal,
    estimatedProfit,
  };
}

function formatDate(value) {
  if (!value) {
    return salesInvoiceHeader.date;
  }

  return String(value).slice(0, 10);
}

function mapDraftToInvoice(draft) {
  return {
    invoiceNo: draft.documentNo,
    date: formatDate(draft.documentDate),
    customerId: draft.customerId,
    customer: draft.customerName || `Musteri #${draft.customerId}`,
    customerCurrency: draft.customerCurrency,
    invoiceCurrency: draft.documentCurrency,
    exchangeRate: `${draft.documentCurrency} ${Number(draft.exchangeRate || 1).toFixed(4)}`,
    exchangeRateValue: Number(draft.exchangeRate || 1),
    description: draft.description || '',
    status: draft.status === 'DRAFT' ? 'Taslak' : 'FINALIZED',
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
    unitPrice: Number(item.unitPrice || 0),
    stockState: item.stockStatus || '-',
    note: item.note || '-',
    averageCostTry: Number(item.averageCostTry || 0),
  }));
}

export function SalesInvoiceScreen({ salesDraftId }) {
  const [draftId, setDraftId] = useState(salesDraftId ?? null);
  const [invoice, setInvoice] = useState(salesInvoiceHeader);
  const [items, setItems] = useState(salesInvoiceItems);
  const [discountRate, setDiscountRate] = useState(invoiceDiscountRate);
  const [status, setStatus] = useState(salesInvoiceHeader.status);
  const [selectedItemId, setSelectedItemId] = useState(salesInvoiceItems[0]?.id);
  const [statusMessage, setStatusMessage] = useState('Taslak fis henuz stok veya cari hareket olusturmaz.');
  const [isLoading, setIsLoading] = useState(Boolean(salesDraftId));
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const totals = useMemo(() => calculateTotals(items, discountRate), [discountRate, items]);
  const isFinalized = status === 'FINALIZED';

  useEffect(() => {
    if (!salesDraftId) {
      return undefined;
    }

    let isMounted = true;

    async function loadDraft() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetchSalesInvoice(salesDraftId);
        const nextInvoice = mapDraftToInvoice(response.data);
        const nextItems = mapDraftItems(response.data.items);

        if (isMounted) {
          setDraftId(response.data.id);
          setInvoice(nextInvoice);
          setItems(nextItems);
          setDiscountRate(Number(response.data.discountRate || 0));
          setStatus(nextInvoice.status);
          setSelectedItemId(nextItems[0]?.id ?? null);
          setStatusMessage(`Taslak fis DB'den acildi (#${response.data.id}); ticari etki yok.`);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(`${error.message || 'Taslak fis okunamadi.'} (${error.code || 'API_ERROR'})`);
          setStatusMessage('Taslak okuma basarisiz; API/DB kontrol edilmeli.');
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
  }, [salesDraftId]);

  function buildDraftPayload() {
    return {
      documentNo: invoice.invoiceNo,
      documentDate: invoice.date,
      customerId: invoice.customerId || 1,
      customerCurrency: invoice.customerCurrency,
      documentCurrency: invoice.invoiceCurrency,
      exchangeRate: invoice.exchangeRateValue || 1,
      description: invoice.description,
      discountRate,
      estimatedProfitTry: totals.estimatedProfit,
      items: items.map((item, index) => ({
        productId: item.productId || index + 1,
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
    setInvoice(salesInvoiceHeader);
    setItems(salesInvoiceItems);
    setDiscountRate(invoiceDiscountRate);
    setStatus('Taslak');
    setSelectedItemId(salesInvoiceItems[0]?.id);
    setErrorMessage('');
    setStatusMessage('Yeni taslak hazirlandi; kaydedilene kadar ticari etki yok.');
  }

  async function saveDraft() {
    if (isFinalized) {
      setStatusMessage('Kesinlesmis fis guncellenemez; iptal/duzeltme akisi ayri sprintte ele alinacak.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const payload = buildDraftPayload();
      const response = draftId
        ? await updateSalesDraft(draftId, payload)
        : await createSalesDraft(payload);
      const nextInvoice = mapDraftToInvoice(response.data);
      const nextItems = mapDraftItems(response.data.items);

      setDraftId(response.data.id);
      setInvoice(nextInvoice);
      setItems(nextItems);
      setDiscountRate(Number(response.data.discountRate || 0));
      setStatus(nextInvoice.status);
      setSelectedItemId(nextItems[0]?.id ?? null);
      setStatusMessage(`Taslak fis DB'ye kaydedildi (#${response.data.id}); stok ve cari etkisi olusmadi.`);
    } catch (error) {
      setErrorMessage(`${error.message || 'Taslak kaydedilemedi.'} (${error.code || 'API_ERROR'})`);
      setStatusMessage('Taslak kaydi basarisiz; API/DB kontrol edilmeli.');
    } finally {
      setIsSaving(false);
    }
  }

  async function finalizeInvoice() {
    if (!draftId) {
      setErrorMessage('Kesinlestirme icin once taslak fis kaydedilmeli.');
      return;
    }

    if (isFinalized) {
      setStatusMessage('Bu fis zaten kesinlesmis; tekrar kesinlestirilemez.');
      return;
    }

    setIsFinalizing(true);
    setErrorMessage('');

    try {
      const response = await finalizeSalesInvoice(draftId);
      const nextInvoice = mapDraftToInvoice(response.data);
      const nextItems = mapDraftItems(response.data.items);
      const warningCount = response.data.warnings?.length || 0;

      setInvoice(nextInvoice);
      setItems(nextItems);
      setDiscountRate(Number(response.data.discountRate || 0));
      setStatus('FINALIZED');
      setSelectedItemId(nextItems[0]?.id ?? null);
      setStatusMessage(
        warningCount > 0
          ? `Fis kesinlesti; ${warningCount} eksi stok uyarisi olustu.`
          : 'Fis kesinlesti; stok hareketi, cari hareket ve audit olustu.',
      );
    } catch (error) {
      setErrorMessage(`${error.message || 'Fis kesinlestirilemedi.'} (${error.code || 'API_ERROR'})`);
      setStatusMessage('Kesinlestirme basarisiz; transaction rollback edildi.');
    } finally {
      setIsFinalizing(false);
    }
  }

  return (
    <main className="work-area sales-invoice-screen">
      <SalesInvoiceToolbar
        status={status}
        isSaving={isSaving}
        isFinalizing={isFinalizing}
        isFinalized={isFinalized}
        onNewDraft={createNewDraft}
        onSaveDraft={saveDraft}
        onFinalize={finalizeInvoice}
      />
      <section className="sales-invoice-layout">
        {isLoading && <div className="list-state">Taslak fis API'den okunuyor...</div>}
        {errorMessage && <div className="list-state list-state-error">{errorMessage}</div>}
        {isSaving && <div className="list-state">Taslak fis API'ye kaydediliyor...</div>}
        {isFinalizing && <div className="list-state">Fis kesinlestiriliyor; stok/cari/audit transaction icinde yaziliyor...</div>}
        {isFinalized && (
          <div className="list-state list-state-success">FINALIZED fis readonly modda; tekrar kayit/kesinlestirme kapali.</div>
        )}
        {!isLoading && !errorMessage && items.length === 0 && (
          <div className="list-state">Taslak fis satiri bulunamadi.</div>
        )}
        <SalesInvoiceHeader invoice={invoice} status={status} />
        <SalesInvoiceCustomerPanel invoice={invoice} permissions={salesInvoicePermissions} />
        <SalesInvoiceItemsTable
          items={items}
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
        />
        <SalesInvoiceTotals totals={totals} />
        <SalesInvoiceRulesPanel rules={salesInvoiceRules} statusMessage={statusMessage} />
      </section>
      <section className="screen-summary sales-invoice-summary">
        <span>Fis: {invoice.invoiceNo}</span>
        <span>Draft ID: {draftId ?? 'yok'}</span>
        <span>Durum: {status}</span>
        <span>Satir: {items.length}</span>
        <span>Kaynak: API draft</span>
      </section>
    </main>
  );
}
