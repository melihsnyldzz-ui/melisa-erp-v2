function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function mapPersistedSalesTotals(invoice, items = []) {
  const currency = String(invoice.documentCurrency || 'TRY').toUpperCase();

  return {
    currency,
    exchangeRate: currency === 'TRY' ? 1 : numberOrZero(invoice.exchangeRate),
    subtotal: numberOrZero(invoice.subtotal),
    discountRate: numberOrZero(invoice.discountRate),
    discountAmount: numberOrZero(invoice.discountTotal),
    grandTotal: numberOrZero(invoice.grandTotal),
    tryEquivalent: numberOrZero(invoice.amountTry),
    lineCount: items.length,
    totalQuantity: items.reduce((total, item) => total + numberOrZero(item.quantity), 0),
  };
}
