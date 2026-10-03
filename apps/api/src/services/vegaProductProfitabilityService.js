import sql from 'mssql';
import { env } from '../config/env.js';
import { getVegaSqlPool } from '../config/vegaDatabase.js';
import { matchSupplierPurchaseLines } from './vegaSupplierPurchaseIntelligenceService.js';

const HISTORY_PERIODS = [
  { year: 2020, period: 'D0001' },
  { year: 2021, period: 'D0002' },
  { year: 2022, period: 'D0003' },
  { year: 2023, period: 'D0004' },
  { year: 2024, period: 'D0005' },
  { year: 2025, period: 'D0006' },
  { year: 2026, period: 'D0007' },
];

const HISTORY_START = '2020-01-01';

function serviceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function round(value, precision = 2) {
  const multiplier = 10 ** precision;
  return Math.round((Number(value || 0) + Number.EPSILON) * multiplier) / multiplier;
}

function number(value) {
  return Number(value || 0);
}

function dateKey(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function normalizeDate(value, fieldName, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw serviceError('VEGA_PRODUCT_PROFITABILITY_DATE_INVALID', `${fieldName} must use YYYY-MM-DD format`);
  }
  return text;
}

function normalizeLimit(value) {
  const parsed = Number(value || 500);
  if (!Number.isFinite(parsed)) return 500;
  return Math.min(1500, Math.max(25, Math.trunc(parsed)));
}

function normalizeFilters(query = {}) {
  const currentYear = Number(env.vega.year || 2026);
  const today = new Date().toISOString().slice(0, 10);
  const yearEnd = `${currentYear}-12-31`;
  const dateFrom = normalizeDate(query.dateFrom, 'dateFrom', `${currentYear}-01-01`);
  const dateTo = normalizeDate(query.dateTo, 'dateTo', today < yearEnd ? today : yearEnd);
  if (dateFrom > dateTo) {
    throw serviceError('VEGA_PRODUCT_PROFITABILITY_DATE_RANGE_INVALID', 'dateFrom cannot be after dateTo');
  }
  if (dateFrom < HISTORY_START || dateTo > yearEnd) {
    throw serviceError(
      'VEGA_PRODUCT_PROFITABILITY_DATE_RANGE_UNSUPPORTED',
      `Profitability dates must stay between ${HISTORY_START} and ${yearEnd}`,
    );
  }
  return { dateFrom, dateTo, limit: normalizeLimit(query.limit) };
}

function purchaseUnionSql() {
  return HISTORY_PERIODS.map(({ year, period }) => `
    SELECT
      ${year} AS source_year,
      b.IND AS header_source_id,
      b.BELGENO AS document_no,
      b.TARIH AS document_date,
      b.FIRMANO AS supplier_source_id,
      c.FIRMAKODU AS supplier_code,
      c.FIRMAADI AS supplier_name,
      b.PARABIRIMI AS header_currency,
      ISNULL(b.KUR, 0) AS header_exchange_rate,
      l.IND AS line_source_id,
      l.STOKNO AS stock_source_id,
      l.STOKKODU AS stock_code,
      l.MALINCINSI AS model_code,
      ISNULL(l.MIKTAR, 0) AS quantity,
      ISNULL(l.AFIYATI, 0) AS gross_unit_price_try,
      ISNULL(l.GERCEKTOPLAM, 0) AS net_line_total_try,
      ISNULL(l.ISK1, 0) AS discount_rate_1,
      ISNULL(l.ISK2, 0) AS discount_rate_2,
      ISNULL(l.ISK3, 0) AS discount_rate_3,
      ISNULL(l.ISK4, 0) AS discount_rate_4,
      ISNULL(l.ISK5, 0) AS discount_rate_5,
      ISNULL(l.ISK6, 0) AS discount_rate_6
    FROM dbo.F0103${period}TBLALFATBASLIK b
    INNER JOIN dbo.F0103${period}TBLALFATHAREKET l ON l.EVRAKNO = b.IND
    LEFT JOIN dbo.F0103TBLCARI c ON c.IND = b.FIRMANO
    WHERE b.TARIH >= '${year}-01-01'
      AND b.TARIH < '${year + 1}-01-01'
      AND b.TARIH < DATEADD(day, 1, @dateTo)
      AND ISNULL(b.IPTAL, 0) = 0
      AND ISNULL(l.MIKTAR, 0) > 0
      AND ISNULL(l.GERCEKTOPLAM, 0) > 0
  `).join('\nUNION ALL\n');
}

function salesUnionSql({ returnMovement = false } = {}) {
  const quantityColumn = returnMovement ? 'GIREN' : 'CIKAN';
  const movementCode = returnMovement ? '34' : '33';
  const returnFilter = returnMovement ? 'AND ISNULL(m.IADE, 0) = 1' : 'AND ISNULL(m.IADE, 0) = 0';
  return HISTORY_PERIODS.map(({ year, period }) => `
    SELECT
      ${year} AS source_year,
      CONVERT(date, m.TARIH) AS event_date,
      m.STOKNO AS product_source_id,
      SUM(ISNULL(m.${quantityColumn}, 0)) AS quantity,
      SUM(ISNULL(m.${quantityColumn}, 0) * ISNULL(m.BIRIMFIYAT, 0)) AS gross_amount_try,
      SUM(ISNULL(m.TUTAR, 0)) AS net_amount_try,
      COUNT_BIG(*) AS line_count,
      COUNT(DISTINCT CONCAT(
        CONVERT(nvarchar(30), m.FIRMANO), N'|',
        LTRIM(RTRIM(ISNULL(m.EVRAKNO, N''))), N'|',
        CONVERT(nvarchar(10), CONVERT(date, m.TARIH), 23)
      )) AS document_count
    FROM dbo.F0102${period}TBLSTOKHAREKETLERI m
    WHERE m.TARIH >= '${year}-01-01'
      AND m.TARIH < '${year + 1}-01-01'
      AND m.TARIH < DATEADD(day, 1, @dateTo)
      AND LTRIM(RTRIM(ISNULL(m.IZAHAT, N''))) = N'${movementCode}'
      ${returnFilter}
      AND ISNULL(m.${quantityColumn}, 0) > 0
      AND ISNULL(m.TUTAR, 0) > 0
    GROUP BY CONVERT(date, m.TARIH), m.STOKNO
  `).join('\nUNION ALL\n');
}

function normalizeProduct(product) {
  return {
    sourceId: Number(product.sourceId),
    stockCode: String(product.stockCode || '').trim(),
    productName: String(product.productName || '').trim(),
    brand: String(product.brand || '').trim() || 'Markasız',
  };
}

function createProductRow(product) {
  return {
    productSourceId: product.sourceId,
    stockCode: product.stockCode,
    productName: product.productName,
    brand: product.brand,
    soldQuantity: 0,
    returnedQuantity: 0,
    netSoldQuantity: 0,
    salesLineCount: 0,
    salesDocumentCount: 0,
    grossSalesTry: 0,
    salesDiscountTry: 0,
    netSalesTry: 0,
    costedNetSalesTry: 0,
    uncostedNetSalesTry: 0,
    costOfGoodsSoldTry: 0,
    grossProfitTry: 0,
    grossMarginRate: null,
    markupRate: null,
    costedSalesQuantity: 0,
    costCoverageRate: 0,
    averageCostTry: 0,
    lastPurchaseCostTry: 0,
    lastPurchaseDate: null,
    purchaseLineCount: 0,
    purchaseQuantity: 0,
    purchaseGrossTry: 0,
    purchaseNetTry: 0,
    purchaseDiscountTry: 0,
    purchaseDiscountRate: 0,
    supplierNames: new Set(),
    confidence: 'incomplete',
    confidenceLabel: 'Maliyet eksik',
    warnings: [],
  };
}

function eventSort(left, right) {
  const byDate = dateKey(left.date).localeCompare(dateKey(right.date));
  if (byDate !== 0) return byDate;
  const priority = { purchase: 0, sales_return: 1, sale: 2 };
  return (priority[left.type] ?? 9) - (priority[right.type] ?? 9);
}

function isInRange(date, dateFrom, dateTo) {
  const key = dateKey(date);
  return key >= dateFrom && key <= dateTo;
}

function finalizeRow(row, state) {
  row.netSoldQuantity = row.soldQuantity - row.returnedQuantity;
  row.grossProfitTry = row.costedNetSalesTry - row.costOfGoodsSoldTry;
  row.grossMarginRate = row.costedNetSalesTry > 0
    ? 100 * row.grossProfitTry / row.costedNetSalesTry
    : null;
  row.markupRate = row.costOfGoodsSoldTry > 0
    ? 100 * row.grossProfitTry / row.costOfGoodsSoldTry
    : null;
  row.costCoverageRate = row.soldQuantity > 0
    ? 100 * row.costedSalesQuantity / row.soldQuantity
    : 0;
  row.averageCostTry = state.averageCostTry;
  row.purchaseDiscountTry = row.purchaseGrossTry - row.purchaseNetTry;
  row.purchaseDiscountRate = row.purchaseGrossTry > 0
    ? 100 * row.purchaseDiscountTry / row.purchaseGrossTry
    : 0;

  if (row.costCoverageRate >= 99.999 && !state.historyGap && !state.negativeStockSeen) {
    row.confidence = 'strong';
    row.confidenceLabel = 'Güçlü';
  } else if (row.costCoverageRate >= 90) {
    row.confidence = 'review';
    row.confidenceLabel = 'Kontrol gerekli';
  }

  if (row.costCoverageRate < 99.999) {
    row.warnings.push(`Satış maliyeti kapsamı %${round(row.costCoverageRate, 1)}`);
  }
  if (state.historyGap) {
    row.warnings.push('İlk eşleşen alıştan önce satış hareketi var');
  }
  if (state.negativeStockSeen) {
    row.warnings.push('Geçmiş akışta eksi stok oluşmuş; son bilinen maliyet kullanıldı');
  }
  if (row.returnedQuantity > 0) {
    row.warnings.push('Satış iadesi, iade tarihindeki ağırlıklı maliyetle ters çevrildi');
  }

  return {
    ...row,
    soldQuantity: round(row.soldQuantity, 4),
    returnedQuantity: round(row.returnedQuantity, 4),
    netSoldQuantity: round(row.netSoldQuantity, 4),
    grossSalesTry: round(row.grossSalesTry),
    salesDiscountTry: round(row.salesDiscountTry),
    netSalesTry: round(row.netSalesTry),
    costedNetSalesTry: round(row.costedNetSalesTry),
    uncostedNetSalesTry: round(row.uncostedNetSalesTry),
    costOfGoodsSoldTry: round(row.costOfGoodsSoldTry),
    grossProfitTry: round(row.grossProfitTry),
    grossMarginRate: row.grossMarginRate == null ? null : round(row.grossMarginRate, 2),
    markupRate: row.markupRate == null ? null : round(row.markupRate, 2),
    costedSalesQuantity: round(row.costedSalesQuantity, 4),
    costCoverageRate: round(row.costCoverageRate, 2),
    averageCostTry: round(row.averageCostTry, 4),
    lastPurchaseCostTry: round(row.lastPurchaseCostTry, 4),
    purchaseQuantity: round(row.purchaseQuantity, 4),
    purchaseGrossTry: round(row.purchaseGrossTry),
    purchaseNetTry: round(row.purchaseNetTry),
    purchaseDiscountTry: round(row.purchaseDiscountTry),
    purchaseDiscountRate: round(row.purchaseDiscountRate, 2),
    supplierNames: [...row.supplierNames].sort((a, b) => a.localeCompare(b, 'tr')),
    warnings: [...new Set(row.warnings)],
  };
}

function buildBrandRows(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const brand = row.brand || 'Markasız';
    if (!groups.has(brand)) {
      groups.set(brand, {
        brand,
        productCount: 0,
        soldQuantity: 0,
        returnedQuantity: 0,
        costedSalesQuantity: 0,
        grossSalesTry: 0,
        salesDiscountTry: 0,
        netSalesTry: 0,
        costedNetSalesTry: 0,
        uncostedNetSalesTry: 0,
        costOfGoodsSoldTry: 0,
        grossProfitTry: 0,
        confidenceCounts: { strong: 0, review: 0, incomplete: 0 },
      });
    }
    const group = groups.get(brand);
    group.productCount += 1;
    group.soldQuantity += row.soldQuantity;
    group.returnedQuantity += row.returnedQuantity;
    group.costedSalesQuantity += row.costedSalesQuantity;
    group.grossSalesTry += row.grossSalesTry;
    group.salesDiscountTry += row.salesDiscountTry;
    group.netSalesTry += row.netSalesTry;
    group.costedNetSalesTry += row.costedNetSalesTry;
    group.uncostedNetSalesTry += row.uncostedNetSalesTry;
    group.costOfGoodsSoldTry += row.costOfGoodsSoldTry;
    group.grossProfitTry += row.grossProfitTry;
    group.confidenceCounts[row.confidence] += 1;
  });

  return [...groups.values()].map((group) => ({
    ...group,
    soldQuantity: round(group.soldQuantity, 4),
    returnedQuantity: round(group.returnedQuantity, 4),
    grossSalesTry: round(group.grossSalesTry),
    salesDiscountTry: round(group.salesDiscountTry),
    netSalesTry: round(group.netSalesTry),
    costedNetSalesTry: round(group.costedNetSalesTry),
    uncostedNetSalesTry: round(group.uncostedNetSalesTry),
    costOfGoodsSoldTry: round(group.costOfGoodsSoldTry),
    grossProfitTry: round(group.grossProfitTry),
    grossMarginRate: group.costedNetSalesTry > 0
      ? round(100 * group.grossProfitTry / group.costedNetSalesTry, 2)
      : null,
    costCoverageRate: group.soldQuantity > 0
      ? round(100 * group.costedSalesQuantity / group.soldQuantity, 2)
      : 0,
  })).sort((left, right) => (
    right.costedNetSalesTry - left.costedNetSalesTry
      || left.brand.localeCompare(right.brand, 'tr')
  ));
}

export function buildProductProfitability({
  products,
  purchaseEvents,
  salesEvents,
  dateFrom,
  dateTo,
  limit = 500,
  purchaseAudit = /** @type {Partial<Record<'lineCount' | 'eligibleLineCount' | 'matchedLineCount' | 'reviewLineCount' | 'unmatchedLineCount', number>>} */ ({}),
}) {
  const normalizedProducts = products.map(normalizeProduct);
  const productMap = new Map(normalizedProducts.map((product) => [product.sourceId, product]));
  const eventsByProduct = new Map();
  const addEvent = (event) => {
    const productSourceId = Number(event.productSourceId);
    if (!productMap.has(productSourceId)) return;
    if (!eventsByProduct.has(productSourceId)) eventsByProduct.set(productSourceId, []);
    eventsByProduct.get(productSourceId).push({ ...event, productSourceId });
  };
  purchaseEvents.forEach(addEvent);
  salesEvents.forEach(addEvent);

  const rows = [];
  for (const [productSourceId, productEvents] of eventsByProduct.entries()) {
    const product = productMap.get(productSourceId);
    const row = createProductRow(product);
    const state = {
      stockQuantity: 0,
      averageCostTry: 0,
      historyGap: false,
      negativeStockSeen: false,
    };

    for (const event of [...productEvents].sort(eventSort)) {
      const quantity = number(event.quantity);
      if (quantity <= 0) continue;
      const inRange = isInRange(event.date, dateFrom, dateTo);

      if (event.type === 'purchase') {
        const netCostTry = number(event.netCostTry);
        const unitCostTry = quantity > 0 ? netCostTry / quantity : 0;
        if (unitCostTry <= 0) continue;

        if (state.stockQuantity > 0 && state.averageCostTry > 0) {
          const combinedQuantity = state.stockQuantity + quantity;
          state.averageCostTry = (
            (state.stockQuantity * state.averageCostTry) + netCostTry
          ) / combinedQuantity;
        } else {
          if (state.stockQuantity < 0) state.negativeStockSeen = true;
          state.averageCostTry = unitCostTry;
        }
        state.stockQuantity += quantity;
        row.lastPurchaseCostTry = unitCostTry;
        row.lastPurchaseDate = dateKey(event.date);
        if (event.supplierName) row.supplierNames.add(String(event.supplierName).trim());
        if (inRange) {
          row.purchaseLineCount += number(event.lineCount || 1);
          row.purchaseQuantity += quantity;
          row.purchaseGrossTry += number(event.grossCostTry);
          row.purchaseNetTry += netCostTry;
        }
        continue;
      }

      const hasCost = state.averageCostTry > 0;
      if (!hasCost) state.historyGap = true;
      if (event.type === 'sale') {
        if (inRange) {
          row.soldQuantity += quantity;
          row.salesLineCount += number(event.lineCount);
          row.salesDocumentCount += number(event.documentCount);
          row.grossSalesTry += number(event.grossAmountTry);
          row.netSalesTry += number(event.netAmountTry);
          row.salesDiscountTry += number(event.grossAmountTry) - number(event.netAmountTry);
          if (hasCost) {
            row.costedSalesQuantity += quantity;
            row.costedNetSalesTry += number(event.netAmountTry);
            row.costOfGoodsSoldTry += quantity * state.averageCostTry;
          } else {
            row.uncostedNetSalesTry += number(event.netAmountTry);
          }
        }
        state.stockQuantity -= quantity;
        if (state.stockQuantity < 0) state.negativeStockSeen = true;
        continue;
      }

      if (event.type === 'sales_return') {
        if (inRange) {
          row.returnedQuantity += quantity;
          row.salesLineCount += number(event.lineCount);
          row.salesDocumentCount += number(event.documentCount);
          row.grossSalesTry -= number(event.grossAmountTry);
          row.netSalesTry -= number(event.netAmountTry);
          row.salesDiscountTry -= number(event.grossAmountTry) - number(event.netAmountTry);
          if (hasCost) {
            row.costedNetSalesTry -= number(event.netAmountTry);
            row.costOfGoodsSoldTry -= quantity * state.averageCostTry;
          } else {
            row.uncostedNetSalesTry -= number(event.netAmountTry);
          }
        }
        state.stockQuantity += quantity;
      }
    }

    if (row.soldQuantity > 0 || row.returnedQuantity > 0) {
      rows.push(finalizeRow(row, state));
    }
  }

  rows.sort((left, right) => (
    right.costedNetSalesTry - left.costedNetSalesTry
      || right.netSalesTry - left.netSalesTry
      || left.stockCode.localeCompare(right.stockCode, 'tr')
  ));

  const sum = (key) => rows.reduce((total, row) => total + number(row[key]), 0);
  const soldQuantity = sum('soldQuantity');
  const costedSalesQuantity = sum('costedSalesQuantity');
  const costedNetSalesTry = sum('costedNetSalesTry');
  const costOfGoodsSoldTry = sum('costOfGoodsSoldTry');
  const grossProfitTry = costedNetSalesTry - costOfGoodsSoldTry;
  const purchaseGrossTry = sum('purchaseGrossTry');
  const purchaseNetTry = sum('purchaseNetTry');
  const confidenceCounts = rows.reduce((result, row) => {
    result[row.confidence] = (result[row.confidence] || 0) + 1;
    return result;
  }, { strong: 0, review: 0, incomplete: 0 });
  const brands = buildBrandRows(rows);

  return {
    source: 'vega-live-read-only',
    generatedAt: new Date().toISOString(),
    filters: { dateFrom, dateTo, historyStart: HISTORY_START, limit },
    summary: {
      productCount: rows.length,
      returnedProductCount: rows.filter((row) => row.returnedQuantity > 0).length,
      salesLineCount: sum('salesLineCount'),
      salesDocumentCount: sum('salesDocumentCount'),
      soldQuantity: round(soldQuantity, 4),
      returnedQuantity: round(sum('returnedQuantity'), 4),
      grossSalesTry: round(sum('grossSalesTry')),
      salesDiscountTry: round(sum('salesDiscountTry')),
      netSalesTry: round(sum('netSalesTry')),
      costedNetSalesTry: round(costedNetSalesTry),
      uncostedNetSalesTry: round(sum('uncostedNetSalesTry')),
      costOfGoodsSoldTry: round(costOfGoodsSoldTry),
      calculatedGrossProfitTry: round(grossProfitTry),
      grossMarginRate: costedNetSalesTry > 0 ? round(100 * grossProfitTry / costedNetSalesTry, 2) : null,
      salesCostCoverageRate: soldQuantity > 0 ? round(100 * costedSalesQuantity / soldQuantity, 2) : 0,
      purchaseGrossTry: round(purchaseGrossTry),
      purchaseNetTry: round(purchaseNetTry),
      purchaseDiscountTry: round(purchaseGrossTry - purchaseNetTry),
      purchaseDiscountRate: purchaseGrossTry > 0
        ? round(100 * (purchaseGrossTry - purchaseNetTry) / purchaseGrossTry, 2)
        : 0,
      confidenceCounts,
      purchaseAudit: {
        lineCount: number(purchaseAudit.lineCount),
        eligibleLineCount: number(purchaseAudit.eligibleLineCount),
        matchedLineCount: number(purchaseAudit.matchedLineCount),
        reviewLineCount: number(purchaseAudit.reviewLineCount),
        unmatchedLineCount: number(purchaseAudit.unmatchedLineCount),
        matchRate: number(purchaseAudit.eligibleLineCount) > 0
          ? round(100 * number(purchaseAudit.matchedLineCount) / number(purchaseAudit.eligibleLineCount), 2)
          : 0,
      },
    },
    brands,
    products: rows.slice(0, limit),
    meta: {
      totalProductCount: rows.length,
      returnedRowCount: Math.min(rows.length, limit),
      totalBrandCount: brands.length,
      costMethod: 'moving-weighted-average-net-purchase-cost-try',
      sameDayOrder: 'purchase-before-sales-return-before-sale',
      writePerformed: false,
    },
    limitations: [
      'Bu rapor resmi muhasebe kârı değil, ürün brüt ticari kârı için operasyonel karar desteğidir.',
      'Maliyet geçmişi 2020 başlangıçlıdır; daha eski devreden stok maliyeti kanıtlanamayan ürünler eksik veya kontrol gerekli işaretlenir.',
      'Güçlü eşleşmeyen alış satırları maliyete katılmaz; tahmini ürün maliyeti üretilmez.',
      'Kargo, komisyon, POS, gümrük, kira, personel ve diğer genel giderler bu rapora dahil değildir.',
    ],
  };
}

function mapPurchaseRows(rows, products) {
  const linesBySupplier = new Map();
  for (const row of rows) {
    const supplierSourceId = Number(row.supplier_source_id || 0);
    if (!supplierSourceId) continue;
    if (!linesBySupplier.has(supplierSourceId)) {
      linesBySupplier.set(supplierSourceId, {
        supplier: {
          sourceId: supplierSourceId,
          supplierCode: row.supplier_code,
          supplierName: row.supplier_name,
        },
        lines: [],
      });
    }
    linesBySupplier.get(supplierSourceId).lines.push({
      headerSourceId: Number(row.header_source_id),
      documentNo: row.document_no,
      documentDate: row.document_date,
      headerCurrency: row.header_currency,
      headerExchangeRate: number(row.header_exchange_rate),
      lineSourceId: Number(row.line_source_id),
      stockSourceId: Number(row.stock_source_id),
      stockCode: row.stock_code,
      modelCode: row.model_code,
      quantity: number(row.quantity),
      grossUnitPriceTry: number(row.gross_unit_price_try),
      netLineTotalTry: number(row.net_line_total_try),
      discountRate1: number(row.discount_rate_1),
      discountRate2: number(row.discount_rate_2),
      discountRate3: number(row.discount_rate_3),
      discountRate4: number(row.discount_rate_4),
      discountRate5: number(row.discount_rate_5),
      discountRate6: number(row.discount_rate_6),
    });
  }

  const events = [];
  const audit = {
    lineCount: 0,
    eligibleLineCount: 0,
    matchedLineCount: 0,
    reviewLineCount: 0,
    unmatchedLineCount: 0,
  };
  for (const { supplier, lines } of linesBySupplier.values()) {
    const result = matchSupplierPurchaseLines({ supplier, lines, products });
    for (const line of result.matchedLines) {
      audit.lineCount += 1;
      if (line.match.status !== 'ignored') audit.eligibleLineCount += 1;
      if (line.match.status === 'review') audit.reviewLineCount += 1;
      if (line.match.status === 'ambiguous' || line.match.status === 'unmatched') audit.unmatchedLineCount += 1;
      if (line.match.status !== 'matched' || !line.match.product) continue;
      audit.matchedLineCount += 1;
      events.push({
        type: 'purchase',
        date: line.documentDate,
        productSourceId: line.match.product.sourceId,
        quantity: line.price.quantity,
        grossCostTry: number(line.quantity) * number(line.grossUnitPriceTry),
        netCostTry: number(line.netLineTotalTry),
        lineCount: 1,
        supplierSourceId: supplier.sourceId,
        supplierName: String(supplier.supplierName || supplier.supplierCode || '').trim(),
        matchMethod: line.match.method,
        matchConfidence: line.match.confidence,
      });
    }
  }
  return { events, audit };
}

function mapSalesRows(rows, type) {
  return rows.map((row) => ({
    type,
    date: row.event_date,
    productSourceId: Number(row.product_source_id),
    quantity: number(row.quantity),
    grossAmountTry: number(row.gross_amount_try),
    netAmountTry: number(row.net_amount_try),
    lineCount: number(row.line_count),
    documentCount: number(row.document_count),
  }));
}

export async function getVegaProductProfitability(query = {}) {
  const filters = normalizeFilters(query);
  const pool = await getVegaSqlPool();
  const execute = (queryText) => {
    const request = pool.request();
    request.timeout = 120000;
    return request.input('dateTo', sql.Date, filters.dateTo).query(queryText);
  };

  const [productsResult, purchasesResult, salesResult, returnsResult] = await Promise.all([
    pool.request().query(`
      SELECT
        s.IND AS source_id,
        s.STOKKODU AS stock_code,
        s.MALINCINSI AS product_name,
        s.KOD1 AS brand
      FROM dbo.F0102TBLSTOKLAR s
      WHERE ISNULL(s.DELETED, 0) = 0
        AND ISNULL(s.IPTAL, 0) = 0;
    `),
    execute(purchaseUnionSql()),
    execute(salesUnionSql()),
    execute(salesUnionSql({ returnMovement: true })),
  ]);

  const products = (productsResult.recordset || []).map((row) => ({
    sourceId: Number(row.source_id),
    stockCode: row.stock_code,
    productName: row.product_name,
    brand: row.brand,
  }));
  const purchaseMapping = mapPurchaseRows(purchasesResult.recordset || [], products);
  const salesEvents = [
    ...mapSalesRows(salesResult.recordset || [], 'sale'),
    ...mapSalesRows(returnsResult.recordset || [], 'sales_return'),
  ];

  return buildProductProfitability({
    products,
    purchaseEvents: purchaseMapping.events,
    salesEvents,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    limit: filters.limit,
    purchaseAudit: purchaseMapping.audit,
  });
}
