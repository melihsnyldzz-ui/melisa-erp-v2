function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function mapPersistedPurchaseTotals(draft, items = []) {
  return {
    currency: draft.documentCurrency || 'TRY',
    exchangeRate: numberOrZero(draft.exchangeRate) || 1,
    subtotal: numberOrZero(draft.subtotal),
    lineDiscountTotal: numberOrZero(draft.lineDiscountTotal),
    invoiceDiscountRate: numberOrZero(draft.invoiceDiscountRate),
    invoiceDiscountType: draft.invoiceDiscountType || 'rate',
    invoiceDiscountAmount: numberOrZero(draft.invoiceDiscountAmount),
    supplierDiscountRate: numberOrZero(draft.supplierDiscountRate),
    totalDiscount: numberOrZero(draft.discountTotal),
    grandTotal: numberOrZero(draft.grandTotal),
    tryEquivalent: numberOrZero(draft.amountTry),
    stockCostEffect: numberOrZero(draft.stockCostEffectTry),
    accountCurrency: draft.accountCurrency || draft.supplierCurrency || '-',
    accountAmount: draft.accountAmount == null ? null : numberOrZero(draft.accountAmount),
    accountExchangeRate: draft.accountExchangeRate == null ? null : numberOrZero(draft.accountExchangeRate),
    lineCount: items.length,
    totalQuantity: items.reduce((total, item) => total + numberOrZero(item.quantity), 0),
  };
}
