const METRICS = {
  customerReceivables: 'customerReceivables',
  customerAdvances: 'customerAdvances',
  supplierPayables: 'supplierPayables',
  supplierAdvances: 'supplierAdvances',
  todayCollections: 'todayCollections',
  todayPayments: 'todayPayments',
  financeBalances: 'financeTryBalance',
};

export function buildFinanceSummary(breakdownRows, rateRows, asOfDate, counts = {}) {
  const currencySummary = {};
  for (const row of breakdownRows) {
    if (!Object.hasOwn(METRICS, row.metric)) throw new Error('Unknown finance summary metric');
    const currency = String(row.currency_code || '').trim().toUpperCase() || 'UNKNOWN';
    const amount = Number(row.amount);
    if (row.amount === null || !Number.isFinite(amount)) throw new Error('Invalid finance summary amount');
    currencySummary[row.metric] ||= {};
    currencySummary[row.metric][currency] = (currencySummary[row.metric][currency] || 0) + amount;
  }
  const selectedRates = new Map();
  for (const row of rateRows) {
    const currency = String(row.currency_code || '').trim().toUpperCase();
    const date = row.rate_date instanceof Date ? row.rate_date.toISOString().slice(0, 10) : String(row.rate_date || '').slice(0, 10);
    if (!date || date > asOfDate || currency === 'TRY') continue;
    const rate = Number(row.rate_to_try);
    selectedRates.set(currency, { currency, date, rateToTry: Number.isFinite(rate) && rate > 0 ? rate : null });
  }
  const values = {};
  const missingByMetric = {};
  for (const [metric, field] of Object.entries(METRICS)) {
    let total = 0;
    const missing = [];
    for (const [currency, amount] of Object.entries(currencySummary[metric] || {})) {
      if (amount === 0) continue;
      const rate = currency === 'TRY' ? 1 : selectedRates.get(currency)?.rateToTry;
      if (!rate) missing.push(currency);
      else total += amount * rate;
    }
    values[field] = missing.length ? null : Number(total.toFixed(4));
    if (missing.length) missingByMetric[field] = missing.sort();
  }
  const missingCurrencies = [...new Set(Object.values(missingByMetric).flat())].sort();
  return {
    customerReceivables: values.customerReceivables,
    customerAdvances: values.customerAdvances,
    supplierPayables: values.supplierPayables,
    supplierAdvances: values.supplierAdvances,
    todayCollections: values.todayCollections,
    todayPayments: values.todayPayments,
    financeTryBalance: values.financeTryBalance,
    collectionCount: Number(counts.collection_count || 0),
    paymentCount: Number(counts.payment_count || 0),
    currencySummary,
    conversion: {
      status: missingCurrencies.length ? 'MISSING_RATES' : 'COMPLETE',
      asOfDate,
      ratePolicy: 'LATEST_ON_OR_BEFORE_REPORT_DATE',
      rates: [...selectedRates.values()],
      missingCurrencies,
      missingByMetric,
    },
  };
}
