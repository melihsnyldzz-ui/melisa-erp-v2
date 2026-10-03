import sql from 'mssql';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';

const SUPPORTED_CURRENCIES = ['TRY', 'USD', 'EUR'];

function makeRateError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(value) {
  const text = typeof value === 'string' && value.trim() ? value.trim().slice(0, 10) : todayIsoDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw makeRateError('CURRENCY_RATE_DATE_INVALID', 'Rate date is invalid');
  }
  return text;
}

function normalizeRate(value, currency) {
  if (currency === 'TRY') {
    return 1;
  }

  const rate = Number(value);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw makeRateError('CURRENCY_RATE_INVALID', `${currency} rate must be greater than zero`);
  }
  return rate;
}

function mapRowsToRates(rows, rateDate) {
  const byCurrency = new Map((rows || []).map((row) => [row.currency_code, row]));
  return SUPPORTED_CURRENCIES.map((currency) => {
    const row = byCurrency.get(currency);
    return {
      currency,
      rateDate: row?.rate_date ? String(row.rate_date).slice(0, 10) : rateDate,
      rateToTry: currency === 'TRY' ? 1 : Number(row?.rate_to_try || 1),
      source: row?.source || (currency === 'TRY' ? 'system' : 'not-defined'),
      defined: currency === 'TRY' || Boolean(row),
    };
  });
}

export async function getCurrencyRates(query = {}) {
  const rateDate = normalizeDate(query.date);
  const pool = await getSqlPool();
  const result = await pool.request()
    .input('rateDate', sql.Date, rateDate)
    .query(`
      WITH latest_rates AS (
        SELECT
          currency_code,
          rate_date,
          rate_to_try,
          source,
          ROW_NUMBER() OVER (PARTITION BY currency_code ORDER BY rate_date DESC, id DESC) AS row_number
        FROM dbo.currency_rates
        WHERE currency_code IN (N'USD', N'EUR')
          AND rate_date <= @rateDate
      )
      SELECT
        currency_code,
        CONVERT(varchar(10), rate_date, 23) AS rate_date,
        rate_to_try,
        source
      FROM latest_rates
      WHERE row_number = 1;
    `);

  return {
    date: rateDate,
    rates: mapRowsToRates(result.recordset || [], rateDate),
  };
}

export async function upsertCurrencyRates(payload = {}, actor = null) {
  assertMelisaWriteEnabled();

  const rateDate = normalizeDate(payload.date);
  const inputRates = payload.rates || {};
  const nextRates = {
    USD: normalizeRate(inputRates.USD ?? payload.USD, 'USD'),
    EUR: normalizeRate(inputRates.EUR ?? payload.EUR, 'EUR'),
  };
  const source = typeof payload.source === 'string' && payload.source.trim()
    ? payload.source.trim().slice(0, 50)
    : 'manual';

  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();

  try {
    const before = await getCurrencyRates({ date: rateDate });

    for (const [currency, rate] of Object.entries(nextRates)) {
      await new sqlDriver.Request(transaction)
        .input('currency', sql.NVarChar(3), currency)
        .input('rateDate', sql.Date, rateDate)
        .input('rateToTry', sql.Decimal(18, 8), rate)
        .input('source', sql.NVarChar(50), source)
        .input('createdBy', sql.BigInt, actor?.id ? Number(actor.id) : null)
        .query(`
          MERGE dbo.currency_rates AS target
          USING (
            SELECT
              @currency AS currency_code,
              @rateDate AS rate_date
          ) AS source_row
          ON target.currency_code = source_row.currency_code
            AND target.rate_date = source_row.rate_date
          WHEN MATCHED THEN
            UPDATE SET
              rate_to_try = @rateToTry,
              source = @source,
              created_by = @createdBy,
              created_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN
            INSERT (
              currency_code,
              rate_date,
              rate_to_try,
              source,
              created_by
            )
            VALUES (
              @currency,
              @rateDate,
              @rateToTry,
              @source,
              @createdBy
            );
        `);
    }

    const afterRows = await new sqlDriver.Request(transaction)
      .input('rateDate', sql.Date, rateDate)
      .query(`
        SELECT
          currency_code,
          CONVERT(varchar(10), rate_date, 23) AS rate_date,
          rate_to_try,
          source
        FROM dbo.currency_rates
        WHERE currency_code IN (N'USD', N'EUR')
          AND rate_date = @rateDate
        ORDER BY currency_code ASC;
      `);

    const after = {
      date: rateDate,
      rates: mapRowsToRates(afterRows.recordset || [], rateDate),
    };

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'currency_rates_updated',
      entityType: 'currency_rates',
      entityId: null,
      beforeSnapshot: before,
      afterSnapshot: after,
      actor,
    });

    await transaction.commit();
    return getCurrencyRates({ date: rateDate });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
