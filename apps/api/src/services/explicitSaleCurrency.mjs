const saleCurrencyAliases = new Map([
  ['EUR', 'EUR'], ['€', 'EUR'],
  ['USD', 'USD'], ['$', 'USD'], ['US$', 'USD'],
  ['TRY', 'TRY'], ['TL', 'TRY'], ['₺', 'TRY'],
]);

/** Accept only the actual sale-unit PB1 column, never purchase currency. */
export function explicitSaleCurrency(raw) {
  const currency = saleCurrencyAliases.get(typeof raw === 'string' ? raw.trim().toUpperCase() : '') ?? null;
  return {
    currency,
    currencyTrustState: currency ? 'TRUSTED' : 'UNAVAILABLE',
    currencySource: currency ? 'ERP_SALE_UNIT' : null,
  };
}

/** Preserve absent and invalid quantities instead of inventing available stock. */
export function explicitInventoryQuantity(raw) {
  if (raw == null || (typeof raw === 'string' && !raw.trim())) return null;
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  const quantity = Number(raw);
  return Number.isFinite(quantity) ? quantity : null;
}
