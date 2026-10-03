import sql from 'mssql';
import { env } from '../config/env.js';
import { getVegaSqlPool } from '../config/vegaDatabase.js';
import { buildListMeta, parseListQuery, sqlNormalizedLike, toSearchPattern } from './queryHelpers.js';

function normalizeCurrency(value) {
  const currency = String(value || '').trim().toLocaleUpperCase('tr-TR');

  if (['$', 'US$', 'USD'].includes(currency)) return 'USD';
  if (['€', 'EUR'].includes(currency)) return 'EUR';
  if (['₺', 'TL', 'TRY'].includes(currency)) return 'TRY';

  return '';
}

function buildSpecialCodes(row) {
  return Object.fromEntries(
    Array.from({ length: 7 }, (_, index) => {
      const number = index + 1;
      return [`KOD${number}`, String(row[`special_code_${number}`] || '').trim()];
    }).filter(([, value]) => value),
  );
}

function toVegaCustomerDto(row) {
  return {
    id: `vega-${row.source_id}`,
    source: 'vega',
    sourceId: Number(row.source_id),
    customerCode: String(row.customer_code || '').trim(),
    customerName: String(row.customer_name || row.legal_title || '').trim(),
    legalTitle: String(row.legal_title || '').trim(),
    contactName: String(row.contact_name || '').trim(),
    phoneMasked: String(row.phone || '').trim() || null,
    email: String(row.email || '').trim() || null,
    city: String(row.city || '').trim(),
    country: String(row.country || '').trim(),
    address: String(row.address || '').trim(),
    currency: normalizeCurrency(row.currency_code),
    customerType: 'wholesale',
    vegaCustomerTypeCode: row.customer_type_code,
    balance: Number(row.balance || 0),
    rawCardBalance: Number(row.raw_card_balance || 0),
    isPassive: !row.is_active,
    lastTransactionDate: row.last_transaction_at || null,
    cardOpenedAt: row.card_opened_at || null,
    specialCodes: buildSpecialCodes(row),
  };
}

export async function getVegaCustomersList(query) {
  const options = parseListQuery(query, { defaultLimit: 100, maxLimit: 500 });
  const searchPredicates = [
    'c.FIRMAKODU',
    'c.FIRMAADI',
    'c.UNVAN',
    'c.TELEFON1',
    'c.YGSM',
    'c.SEHIR',
    'c.IL',
    'c.KOD1',
  ].map((column) => sqlNormalizedLike(column)).join('\n          OR ');

  const pool = await getVegaSqlPool();
  const result = await pool.request()
    .input('search', sql.NVarChar(120), toSearchPattern(options.search))
    // A full customer code must survive Turkish letter normalization unchanged.
    .input('exactCustomerCode', sql.NVarChar(120), options.search || null)
    .input('offset', sql.Int, options.offset)
    .query(`
      WITH live_customers AS (
        SELECT
          c.IND AS source_id,
          c.FIRMAKODU AS customer_code,
          c.FIRMAADI AS customer_name,
          c.UNVAN AS legal_title,
          c.YETKILI AS contact_name,
          COALESCE(NULLIF(LTRIM(RTRIM(c.TELEFON1)), N''), NULLIF(LTRIM(RTRIM(c.YGSM)), N''), NULLIF(LTRIM(RTRIM(c.YTELEFON1)), N'')) AS phone,
          COALESCE(NULLIF(LTRIM(RTRIM(c.EMAIL)), N''), NULLIF(LTRIM(RTRIM(c.YEMAIL)), N'')) AS email,
          COALESCE(NULLIF(LTRIM(RTRIM(c.SEHIR)), N''), NULLIF(LTRIM(RTRIM(c.IL)), N'')) AS city,
          c.KOD1 AS country,
          COALESCE(CONVERT(nvarchar(max), c.ADRESFATURA), CONVERT(nvarchar(max), c.ADRESPOSTA), CONVERT(nvarchar(max), c.ADRESSEVK)) AS address,
          c.PARABIRIMI AS currency_code,
          c.FIRMATIPI AS customer_type_code,
          c.BAKIYE AS raw_card_balance,
          c.KAYITTARIHI AS card_opened_at,
          c.KOD1 AS special_code_1,
          c.KOD2 AS special_code_2,
          c.KOD3 AS special_code_3,
          c.KOD4 AS special_code_4,
          c.KOD5 AS special_code_5,
          c.KOD6 AS special_code_6,
          c.KOD7 AS special_code_7,
          CAST(1 AS bit) AS is_active
        FROM dbo.F0102TBLCARI c
        WHERE
          ISNULL(c.DELETED, 0) = 0
          AND ISNULL(c.STATUS, 0) = 1
          AND LTRIM(RTRIM(ISNULL(c.PARABIRIMI, N''))) <> N'LL'
          AND (@search IS NULL OR LTRIM(RTRIM(c.FIRMAKODU)) = @exactCustomerCode OR ${searchPredicates})
      ),
      movement_balances AS (
        SELECT
          h.FIRMANO AS source_id,
          SUM((ISNULL(h.BORC, 0) - ISNULL(h.ALACAK, 0)) / NULLIF(h.KUR, 0)) AS balance,
          MAX(h.TARIH) AS last_transaction_at
        FROM dbo.F0102D0007TBLCARIHAREKETLERI h
        INNER JOIN live_customers c ON c.source_id = h.FIRMANO
        WHERE
          ISNULL(h.IZAHAT, N'') NOT IN (N'30', N'31')
          AND (
            (c.currency_code IN (N'$', N'USD') AND h.PARABIRIMI IN (N'$', N'USD'))
            OR (c.currency_code IN (N'€', N'EUR') AND h.PARABIRIMI IN (N'€', N'EUR'))
            OR (c.currency_code IN (N'TL', N'TRY', N'₺') AND h.PARABIRIMI IN (N'TL', N'TRY', N'₺'))
          )
        GROUP BY h.FIRMANO
      ),
      numbered_customers AS (
        SELECT
          c.*,
          ISNULL(m.balance, 0) AS balance,
          m.last_transaction_at,
          ROW_NUMBER() OVER (ORDER BY c.customer_code ASC, c.source_id ASC) AS row_number,
          COUNT_BIG(1) OVER () AS total_count
        FROM live_customers c
        LEFT JOIN movement_balances m ON m.source_id = c.source_id
      )
      SELECT TOP (${options.limit}) *
      FROM numbered_customers
      WHERE row_number > @offset
      ORDER BY row_number ASC;
    `);

  const rows = result.recordset || [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;

  return {
    data: rows.map(toVegaCustomerDto),
    meta: buildListMeta({
      ...options,
      total,
      source: 'vega-live-read-only',
      filters: {
        companyCode: env.vega.companyCode,
        periodCode: env.vega.periodCode,
        year: env.vega.year,
        search: options.search || null,
        status: 1,
        excludedCurrencies: ['LL'],
      },
    }),
  };
}
