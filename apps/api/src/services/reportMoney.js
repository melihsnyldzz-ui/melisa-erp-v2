// Callers bind @reportAsOf (UTC report date). Select the latest recorded rate,
// including an invalid latest value; never silently fall back to an older rate.
export const reportBalanceCtes = `
  WITH report_rates AS (
    SELECT currency_code, rate_date, rate_to_try,
      ROW_NUMBER() OVER (PARTITION BY currency_code ORDER BY rate_date DESC, id DESC) AS rn
    FROM dbo.currency_rates WHERE rate_date <= @reportAsOf
  ), report_customers AS (
    SELECT c.*, r.rate_date,
      CASE WHEN c.currency_code = N'TRY' THEN 1 WHEN r.rate_to_try > 0 THEN r.rate_to_try END AS rate_to_try,
      CASE WHEN c.balance = 0 THEN 0 WHEN c.currency_code = N'TRY' THEN c.balance
        WHEN r.rate_to_try > 0 THEN c.balance * r.rate_to_try END AS balance_try
    FROM dbo.customers c LEFT JOIN report_rates r ON r.currency_code = c.currency_code AND r.rn = 1
    WHERE c.is_deleted = 0
  ), report_suppliers AS (
    SELECT s.*, r.rate_date,
      CASE WHEN s.currency_code = N'TRY' THEN 1 WHEN r.rate_to_try > 0 THEN r.rate_to_try END AS rate_to_try,
      CASE WHEN s.balance = 0 THEN 0 WHEN s.currency_code = N'TRY' THEN s.balance
        WHEN r.rate_to_try > 0 THEN s.balance * r.rate_to_try END AS balance_try
    FROM dbo.suppliers s LEFT JOIN report_rates r ON r.currency_code = s.currency_code AND r.rn = 1
    WHERE s.is_deleted = 0
  )`;

export function nullableReportAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function sumReportAmounts(values) {
  const amounts = values.map(nullableReportAmount);
  return amounts.some(value => value === null) ? null : Number(amounts.reduce((sum, value) => sum + value, 0).toFixed(4));
}

export function reportBalanceFields(row) {
  return {
    balance: nullableReportAmount(row.balance),
    currency: row.currency_code || 'UNKNOWN',
    balanceTry: nullableReportAmount(row.balance_try),
    rateToTry: nullableReportAmount(row.rate_to_try),
    rateDate: row.rate_date ? new Date(row.rate_date).toISOString().slice(0, 10) : null,
  };
}

export function reportConversion(rows, asOfDate) {
  const missingCurrencies = [...new Set(rows.filter(row => Number(row.missing_count) > 0).map(row => row.currency_code || 'UNKNOWN'))].sort();
  return {
    asOfDate,
    ratePolicy: 'LATEST_ON_OR_BEFORE_REPORT_DATE',
    status: missingCurrencies.length ? 'MISSING_RATES' : 'COMPLETE',
    missingCurrencies,
    balancesByCurrency: rows.map(row => ({ party: row.party, ...reportBalanceFields(row) })),
  };
}

// Collection/payment rows have no transaction-time FX snapshot. Keep native
// amounts; only TRY is known historically. Today's rates cannot fill that gap.
export function historicalFinanceSummary(rows) {
  const amounts = rows.map(row => ({
    currency: row.currency_code || 'UNKNOWN',
    collections: nullableReportAmount(row.collections),
    payments: nullableReportAmount(row.payments),
    collectionActivity: nullableReportAmount(row.collection_activity ?? row.collections),
    paymentActivity: nullableReportAmount(row.payment_activity ?? row.payments),
  }));
  const total = (key, activity) => sumReportAmounts(amounts.map(row => row.currency === 'TRY' || row[activity] === 0 ? row[key] : null));
  const collections = total('collections', 'collectionActivity');
  const payments = total('payments', 'paymentActivity');
  return {
    collections,
    payments,
    netCash: collections === null || payments === null ? null : Number((collections - payments).toFixed(4)),
    currencySummary: amounts.map(({ currency, collections: collected, payments: paid }) => ({ currency, collections: collected, payments: paid })),
    missingSnapshotCurrencies: [...new Set(amounts.filter(row => row.currency !== 'TRY' && (row.collectionActivity !== 0 || row.paymentActivity !== 0)).map(row => row.currency))].sort(),
  };
}
