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
    supplierDiscountRate: numberOrZero(draft.supplierDiscountRate),
    totalDiscount: numberOrZero(draft.discountTotal),
    grandTotal: numberOrZero(draft.grandTotal),
    tryEquivalent: numberOrZero(draft.amountTry),
    stockCostEffect: numberOrZero(draft.stockCostEffectTry),
    lineCount: items.length,
    totalQuantity: items.reduce((total, item) => total + numberOrZero(item.quantity), 0),
  };
}
