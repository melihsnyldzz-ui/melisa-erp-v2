const money = value => {
  if (value === null || value === undefined || typeof value === 'boolean' || String(value).trim() === '' || !Number.isFinite(Number(value))) throw new Error('Unknown report amount');
  const units = Math.round(Number(value) * 10000);
  if (!Number.isSafeInteger(units)) throw new Error('Unsafe report amount');
  return BigInt(units);
};
const amount = units => {
  if (units > BigInt(Number.MAX_SAFE_INTEGER) || units < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('Unsafe report total');
  return Number(units) / 10000;
};
const sum = values => amount(values.reduce((total, value) => total + money(value), 0n));
const unknown = (supported, reason) => ({ supported, known: false, reason, events: [] });

// Read-only event aggregation. A cancelled header does not erase its earlier return event.
export async function readReturnReporting(pool, sql, { dateFrom, dateTo }) {
  const schema = await pool.request().query(`SELECT CASE WHEN OBJECT_ID(N'dbo.invoice_returns',N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.invoice_returns',N'amount') IS NOT NULL
    AND COL_LENGTH(N'dbo.invoice_returns',N'document_currency') IS NOT NULL
    AND COL_LENGTH(N'dbo.stock_movements',N'amount_try') IS NOT NULL
    AND COL_LENGTH(N'dbo.stock_movements',N'unit_cost_try') IS NOT NULL THEN 1 ELSE 0 END AS ready;`);
  if (!schema.recordset?.[0]?.ready) return unknown(false, 'RETURN_REPORT_SCHEMA_REQUIRED');
  const result = await pool.request().input('returnReportFrom', sql.Date, dateFrom).input('returnReportTo', sql.Date, dateTo).query(`
    SELECT sm.source_id AS returnId,sm.source_type AS eventType,sm.document_date AS eventDate,
      r.kind,r.document_currency AS currency,r.amount AS documentAmount,
      SUM(sm.amount_try) AS signedAmountTry,
      SUM(CASE WHEN r.kind=N'sales' THEN sm.amount_try + sm.quantity_net * sm.unit_cost_try ELSE 0 END) AS profitAdjustmentTry,
      SUM(CASE WHEN r.id IS NULL OR sm.amount_try IS NULL OR sm.quantity_net IS NULL
        OR (r.kind=N'sales' AND sm.unit_cost_try IS NULL) THEN 1 ELSE 0 END) AS invalidRows
    FROM dbo.stock_movements sm
    LEFT JOIN dbo.invoice_returns r ON r.id=sm.source_id
    WHERE sm.source_type IN(N'invoice_return',N'invoice_return_cancel')
      AND sm.document_date>=@returnReportFrom AND sm.document_date<=@returnReportTo
    GROUP BY sm.source_id,sm.source_type,sm.document_date,r.kind,r.document_currency,r.amount;
  `);
  return normalizeReturnEvents(result.recordset || []);
}

export function normalizeReturnEvents(rows) {
  try {
    const seen = new Set();
    const events = rows.map(row => {
      const sign = row.eventType === 'invoice_return' ? -1 : row.eventType === 'invoice_return_cancel' ? 1 : 0;
      const key = `${row.returnId}:${row.eventType}`;
      if (!sign || !['sales', 'purchase'].includes(row.kind) || !['TRY', 'USD', 'EUR'].includes(row.currency)
        || row.invalidRows == null || Number(row.invalidRows) !== 0 || !Number.isSafeInteger(Number(row.returnId)) || Number(row.returnId) <= 0 || seen.has(key)) throw Error('Invalid return event');
      seen.add(key);
      const documentAmount = money(row.documentAmount), signedTry = money(row.signedAmountTry), profit = money(row.profitAdjustmentTry);
      if (documentAmount < 0n || signedTry * BigInt(sign) < 0n) throw Error('Invalid event amount sign');
      return { kind: row.kind, currency: row.currency, cancelled: sign > 0, amount: amount(documentAmount),
        amountTry: amount(signedTry * BigInt(sign)), profitAdjustmentTry: amount(profit) };
    });
    return { supported: true, known: true, reason: null, events };
  } catch { return unknown(true, 'RETURN_REPORT_EVENTS_UNCONFIRMED'); }
}

export function summarizeReturnAmounts(report, kind, grossAmountTry, grossProfitTry = null) {
  const base = { supported: report.supported, known: report.known, reason: report.reason, grossAmountTry, grossProfitTry };
  if (!report.known) return { ...base, returnedAmountTry: null, returnCancelledAmountTry: null, returnCount: null,
    returnCancelledCount: null, netAmountTry: null, profitAdjustmentTry: null, netGrossProfitTry: null };
  const events = report.events.filter(row => row.kind === kind);
  const returnedAmountTry = sum(events.filter(row => !row.cancelled).map(row => row.amountTry));
  const returnCancelledAmountTry = sum(events.filter(row => row.cancelled).map(row => row.amountTry));
  const profitAdjustmentTry = sum(events.map(row => row.profitAdjustmentTry));
  return { ...base, returnedAmountTry, returnCancelledAmountTry,
    returnCount: events.filter(row => !row.cancelled).length, returnCancelledCount: events.filter(row => row.cancelled).length,
    netAmountTry: sum([grossAmountTry, -returnedAmountTry, returnCancelledAmountTry]), profitAdjustmentTry,
    netGrossProfitTry: grossProfitTry == null ? null : sum([grossProfitTry, profitAdjustmentTry]) };
}

export function applyReturnCurrencyTotals(grossRows, report, kind) {
  const currencies = new Set([...grossRows.map(row => row.currency), ...report.events.filter(row => row.kind === kind).map(row => row.currency)]);
  return [...currencies].sort().map(currency => {
    const gross = grossRows.find(row => row.currency === currency) || { currency, count: 0, amount: 0, amountTry: 0 };
    const scoped = { ...report, events: report.events.filter(row => row.currency === currency) };
    const totals = summarizeReturnAmounts(scoped, kind, gross.amountTry);
    const events = scoped.events.filter(row => row.kind === kind);
    const returnedAmount = report.known ? sum(events.filter(row => !row.cancelled).map(row => row.amount)) : null;
    const returnCancelledAmount = report.known ? sum(events.filter(row => row.cancelled).map(row => row.amount)) : null;
    return { ...gross, grossAmount: gross.amount, grossAmountTry: gross.amountTry, returnedAmount, returnCancelledAmount,
      returnedAmountTry: totals.returnedAmountTry, returnCancelledAmountTry: totals.returnCancelledAmountTry,
      amount: report.known ? sum([gross.amount, -returnedAmount, returnCancelledAmount]) : null, amountTry: totals.netAmountTry,
      returnReportingSupported: report.supported, returnReportingKnown: report.known };
  });
}
