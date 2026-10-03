export function nullableReportNumber(value) {
  return value == null || typeof value === 'boolean' || String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value);
}

export function sumKnownReportAmounts(values) {
  let units = 0n;
  for (const value of values) {
    const n = nullableReportNumber(value);
    if (n == null || !Number.isSafeInteger(Math.round(n * 10000))) return null;
    units += BigInt(Math.round(n * 10000));
  }
  return units > BigInt(Number.MAX_SAFE_INTEGER) || units < BigInt(Number.MIN_SAFE_INTEGER) ? null : Number(units) / 10000;
}

// Static SQL fragments: callers supply only source-owned aliases/table names.
export function cardBalanceTrySql(alias, rate = 'rate') {
  if (!/^[a-z]+$/.test(alias) || !/^[a-z]+$/.test(rate)) throw Error('Invalid reporting alias');
  return `CASE WHEN ${alias}.balance=0 THEN 0 WHEN ${alias}.currency_code=N'TRY' THEN ${alias}.balance WHEN ${alias}.currency_code IN(N'USD',N'EUR') AND ${rate}.rate_to_try>0 THEN ${alias}.balance*${rate}.rate_to_try ELSE NULL END`;
}

export function cardBalanceTotalSql(table, alias, positiveOnly = false) {
  if (!['customers', 'suppliers'].includes(table) || !/^[a-z]+$/.test(alias)) throw Error('Invalid reporting table');
  const value = cardBalanceTrySql(alias, 'rate');
  return `(SELECT CASE WHEN COUNT_BIG(*)<>COUNT_BIG(${value}) THEN NULL ELSE COALESCE(SUM(${value}),0) END
    FROM dbo.${table} ${alias} OUTER APPLY (SELECT TOP(1) rate_to_try FROM dbo.currency_rates cr
      WHERE cr.currency_code=${alias}.currency_code AND cr.rate_date<=CONVERT(date,SYSUTCDATETIME())
      ORDER BY cr.rate_date DESC,cr.id DESC) rate
    WHERE ${alias}.is_deleted=0${positiveOnly ? ` AND ${alias}.balance>0` : ''})`;
}

export function cardValuationDto(row) {
  const currency = row.currency_code || null;
  return { balance: nullableReportNumber(row.balance), currency,
    balanceTry: nullableReportNumber(row.balance_try),
    rateToTry: currency === 'TRY' ? 1 : nullableReportNumber(row.valuation_rate) > 0 ? Number(row.valuation_rate) : null,
    rateDate: currency === 'TRY' ? null : row.valuation_rate_date || null };
}

export function summarizeFinanceRows(rows, supported) {
  const normalized = rows.map(row => ({ currency: row.currency_code, type: row.movement_type,
    count: Number(row.row_count), amount: nullableReportNumber(row.amount),
    amountTry: Number(row.unknown_count) === 0 ? nullableReportNumber(row.amount_try) : null,
    missing: row.unknown_count == null ? null : Number(row.unknown_count) }));
  const seen = new Set();
  const valid = normalized.every(row => ['collection', 'payment'].includes(row.type) && ['TRY', 'USD', 'EUR'].includes(row.currency)
    && Number.isSafeInteger(row.count) && row.count > 0 && Number.isSafeInteger(row.missing) && row.missing >= 0 && row.missing <= row.count && row.amount != null
    && !seen.has(`${row.currency}:${row.type}`) && seen.add(`${row.currency}:${row.type}`));
  if (!valid) return { supported, known: false, collectionsTry: null, paymentsTry: null, netCashTry: null, byCurrency: [], reason: 'FINANCE_REPORT_UNCONFIRMED' };
  const collectionsTry = sumKnownReportAmounts(normalized.filter(row => row.type === 'collection').map(row => row.amountTry));
  const paymentsTry = sumKnownReportAmounts(normalized.filter(row => row.type === 'payment').map(row => row.amountTry));
  const netCashTry = sumKnownReportAmounts([collectionsTry, paymentsTry == null ? null : -paymentsTry]);
  const byCurrency = [...new Set(normalized.map(row => row.currency))].sort().map(currency => {
    const group = normalized.filter(row => row.currency === currency);
    return { currency, count: group.reduce((n, row) => n + row.count, 0),
      amount: sumKnownReportAmounts(group.map(row => row.type === 'collection' ? row.amount : -row.amount)),
      amountTry: sumKnownReportAmounts(group.map(row => row.amountTry == null ? null : row.type === 'collection' ? row.amountTry : -row.amountTry)),
      unknownCount: group.reduce((n, row) => n + row.missing, 0) };
  });
  return { supported, known: netCashTry != null, collectionsTry, paymentsTry, netCashTry, byCurrency,
    unknownCount: normalized.reduce((n, row) => n + row.missing, 0), reason: netCashTry == null ? 'FINANCE_REPORT_SNAPSHOT_REQUIRED' : null };
}

export async function readFinanceReporting(pool, sql, { dateFrom, dateTo }) {
  const schema = (await pool.request().query(`SELECT
    CASE WHEN COL_LENGTH(N'dbo.customer_movements',N'amount_try') IS NOT NULL THEN 1 ELSE 0 END AS customer_snapshot,
    CASE WHEN COL_LENGTH(N'dbo.supplier_movements',N'amount_try') IS NOT NULL THEN 1 ELSE 0 END AS supplier_snapshot;`)).recordset?.[0] || {};
  const customerSnapshot = Number(schema.customer_snapshot) === 1, supplierSnapshot = Number(schema.supplier_snapshot) === 1;
  const value = hasSnapshot => `CASE WHEN currency_code=N'TRY' THEN amount ELSE ${hasSnapshot ? 'amount_try' : 'CAST(NULL AS DECIMAL(18,4))'} END`;
  const result = await pool.request().input('financeReportFrom', sql.Date, dateFrom).input('financeReportTo', sql.Date, dateTo).query(`
    WITH finance_report_rows AS (
      SELECT currency_code,amount,${value(customerSnapshot)} AS amount_try,N'collection' AS movement_type
      FROM dbo.customer_movements WHERE movement_type=N'collection' AND document_date>=@financeReportFrom AND document_date<=@financeReportTo
      UNION ALL
      SELECT currency_code,amount,${value(supplierSnapshot)} AS amount_try,N'payment' AS movement_type
      FROM dbo.supplier_movements WHERE movement_type=N'payment' AND document_date>=@financeReportFrom AND document_date<=@financeReportTo
    ) SELECT currency_code,movement_type,COUNT_BIG(*) AS row_count,SUM(amount) AS amount,SUM(amount_try) AS amount_try,
      SUM(CASE WHEN amount_try IS NULL OR amount IS NULL THEN 1 ELSE 0 END) AS unknown_count
    FROM finance_report_rows GROUP BY currency_code,movement_type ORDER BY currency_code,movement_type;`);
  return summarizeFinanceRows(result.recordset || [], customerSnapshot && supplierSnapshot);
}
