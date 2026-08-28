import sql from 'mssql';
import { env } from '../config/env.js';
import { getVegaSqlPool } from '../config/vegaDatabase.js';
import { buildListMeta, parseListQuery, sqlNormalizedLike, toSearchPattern } from './queryHelpers.js';

function normalizeCurrency(value) {
  const currency = String(value || '').trim().toLocaleUpperCase('tr-TR');
  if (['$', 'US$', 'USD'].includes(currency)) return 'USD';
  if (['€', 'EUR'].includes(currency)) return 'EUR';
  if (['₺', 'TL', 'TRY'].includes(currency)) return 'TRY';
  return currency || 'TRY';
}

function buildSpecialCodes(row) {
  return Object.fromEntries(
    Array.from({ length: 7 }, (_, index) => {
      const number = index + 1;
      return [`KOD${number}`, String(row[`special_code_${number}`] || '').trim()];
    }).filter(([, value]) => value),
  );
}

function toSupplierDto(row) {
  const balance = Number(row.balance || 0);
  return {
    id: `vega-supplier-${row.source_id}`,
    source: 'vega',
    sourceId: Number(row.source_id),
    supplierCode: String(row.supplier_code || '').trim(),
    supplierName: String(row.supplier_name || row.legal_title || '').trim(),
    legalTitle: String(row.legal_title || '').trim(),
    contactName: String(row.contact_name || '').trim(),
    phoneMasked: String(row.phone || '').trim() || null,
    email: String(row.email || '').trim() || null,
    city: String(row.city || '').trim(),
    country: String(row.country || '').trim(),
    address: String(row.address || '').trim(),
    currency: normalizeCurrency(row.currency_code),
    balance,
    balanceSide: balance < 0 ? 'payable' : balance > 0 ? 'receivable' : 'balanced',
    rawCardBalance: Number(row.raw_card_balance || 0),
    purchaseDiscountRate: Number(row.purchase_discount_rate || 0),
    purchaseCount: Number(row.purchase_count || 0),
    lastPurchaseDate: row.last_purchase_at || null,
    lastTransactionDate: row.last_transaction_at || null,
    cardOpenedAt: row.card_opened_at || null,
    isPassive: !row.is_active,
    specialCodes: buildSpecialCodes(row),
  };
}

export async function getVegaSuppliersList(query = {}) {
  const options = parseListQuery(query, { defaultLimit: 100, maxLimit: 500 });
  const searchPredicates = [
    'c.FIRMAKODU',
    'c.FIRMAADI',
    'c.UNVAN',
    'c.YETKILI',
    'c.TELEFON1',
    'c.YGSM',
    'c.SEHIR',
    'c.IL',
    'c.KOD1',
  ].map((column) => sqlNormalizedLike(column)).join('\n          OR ');

  const pool = await getVegaSqlPool();
  const result = await pool.request()
    .input('search', sql.NVarChar(120), toSearchPattern(options.search))
    .input('offset', sql.Int, options.offset)
    .query(`
      WITH live_suppliers AS (
        SELECT
          c.IND AS source_id,
          c.FIRMAKODU AS supplier_code,
          c.FIRMAADI AS supplier_name,
          c.UNVAN AS legal_title,
          c.YETKILI AS contact_name,
          COALESCE(NULLIF(LTRIM(RTRIM(c.TELEFON1)), N''), NULLIF(LTRIM(RTRIM(c.YGSM)), N''), NULLIF(LTRIM(RTRIM(c.YTELEFON1)), N'')) AS phone,
          COALESCE(NULLIF(LTRIM(RTRIM(c.EMAIL)), N''), NULLIF(LTRIM(RTRIM(c.YEMAIL)), N'')) AS email,
          COALESCE(NULLIF(LTRIM(RTRIM(c.SEHIR)), N''), NULLIF(LTRIM(RTRIM(c.IL)), N'')) AS city,
          c.KOD1 AS country,
          COALESCE(CONVERT(nvarchar(max), c.ADRESFATURA), CONVERT(nvarchar(max), c.ADRESPOSTA), CONVERT(nvarchar(max), c.ADRESSEVK)) AS address,
          c.PARABIRIMI AS currency_code,
          c.BAKIYE AS raw_card_balance,
          c.ISKONTO AS purchase_discount_rate,
          c.KAYITTARIHI AS card_opened_at,
          c.KOD1 AS special_code_1,
          c.KOD2 AS special_code_2,
          c.KOD3 AS special_code_3,
          c.KOD4 AS special_code_4,
          c.KOD5 AS special_code_5,
          c.KOD6 AS special_code_6,
          c.KOD7 AS special_code_7,
          CAST(1 AS bit) AS is_active
        FROM dbo.F0103TBLCARI c
        WHERE
          ISNULL(c.DELETED, 0) = 0
          AND ISNULL(c.STATUS, 0) = 1
          AND LTRIM(RTRIM(ISNULL(c.PARABIRIMI, N''))) <> N'LL'
          AND (@search IS NULL OR ${searchPredicates})
      ),
      movement_balances AS (
        SELECT
          h.FIRMANO AS source_id,
          SUM((ISNULL(h.BORC, 0) - ISNULL(h.ALACAK, 0)) / NULLIF(h.KUR, 0)) AS balance,
          MAX(h.TARIH) AS last_transaction_at
        FROM dbo.F0103D0007TBLCARIHAREKETLERI h
        INNER JOIN live_suppliers s ON s.source_id = h.FIRMANO
        WHERE
          ISNULL(h.IZAHAT, N'') NOT IN (N'30', N'31')
          AND (
            (s.currency_code IN (N'$', N'USD') AND h.PARABIRIMI IN (N'$', N'USD'))
            OR (s.currency_code IN (N'€', N'EUR') AND h.PARABIRIMI IN (N'€', N'EUR'))
            OR (s.currency_code IN (N'TL', N'TRY', N'₺') AND h.PARABIRIMI IN (N'TL', N'TRY', N'₺'))
          )
        GROUP BY h.FIRMANO
      ),
      purchase_summary AS (
        SELECT
          b.FIRMANO AS source_id,
          COUNT_BIG(1) AS purchase_count,
          MAX(b.TARIH) AS last_purchase_at
        FROM dbo.F0103D0007TBLALFATBASLIK b
        INNER JOIN live_suppliers s ON s.source_id = b.FIRMANO
        WHERE ISNULL(b.IPTAL, 0) = 0
        GROUP BY b.FIRMANO
      ),
      numbered_suppliers AS (
        SELECT
          s.*,
          ISNULL(m.balance, 0) AS balance,
          m.last_transaction_at,
          ISNULL(p.purchase_count, 0) AS purchase_count,
          p.last_purchase_at,
          ROW_NUMBER() OVER (ORDER BY s.supplier_code ASC, s.source_id ASC) AS row_number,
          COUNT_BIG(1) OVER () AS total_count
        FROM live_suppliers s
        LEFT JOIN movement_balances m ON m.source_id = s.source_id
        LEFT JOIN purchase_summary p ON p.source_id = s.source_id
      )
      SELECT TOP (${options.limit}) *
      FROM numbered_suppliers
      WHERE row_number > @offset
      ORDER BY row_number ASC;
    `);

  const rows = result.recordset || [];
  const total = rows.length ? Number(rows[0].total_count || 0) : 0;
  return {
    data: rows.map(toSupplierDto),
    meta: buildListMeta({
      ...options,
      total,
      source: 'vega-live-read-only',
      filters: {
        companyCode: 'F0103',
        periodCode: env.vega.periodCode,
        year: env.vega.year,
        search: options.search || null,
        status: 1,
        excludedCurrencies: ['LL'],
      },
    }),
  };
}
