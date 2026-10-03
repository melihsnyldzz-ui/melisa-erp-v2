import sql from 'mssql';
import { env } from '../config/env.js';
import { getVegaSqlPool } from '../config/vegaDatabase.js';

const BLOCKED_MODEL_CODES = new Set([
  'KDV',
  'URUN',
  'ÜRÜN',
  'KUTU',
  'YASTIK',
]);

const GENERIC_SUPPLIER_WORDS = new Set([
  'BABY',
  'BEBE',
  'KIDS',
  'KİDS',
  'TEKSTIL',
  'TEKSTİL',
  'TRIKO',
  'TRİKO',
]);

function serviceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function round(value, precision = 4) {
  const multiplier = 10 ** precision;
  return Math.round((Number(value || 0) + Number.EPSILON) * multiplier) / multiplier;
}

export function normalizePurchaseMatchText(value) {
  return String(value || '')
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/\s+/g, ' ');
}

function compactText(value) {
  return normalizePurchaseMatchText(value).replace(/[^A-ZÇĞİIÖŞÜ0-9]/g, '');
}

function coreName(value) {
  return normalizePurchaseMatchText(value)
    .split(/[^A-ZÇĞİIÖŞÜ0-9]+/)
    .filter((token) => token && !GENERIC_SUPPLIER_WORDS.has(token))
    .join('');
}

function namesAreRelated(leftValue, rightValue) {
  const leftCore = coreName(leftValue);
  const rightCore = coreName(rightValue);
  if (leftCore.length >= 3 && rightCore.length >= 3) {
    if (leftCore.includes(rightCore) || rightCore.includes(leftCore)) return true;
  }

  const leftCompact = compactText(leftValue);
  const rightCompact = compactText(rightValue);
  return leftCompact.length >= 3
    && rightCompact.length >= 3
    && (leftCompact.includes(rightCompact) || rightCompact.includes(leftCompact));
}

export function stockCodeStartsWithModel(stockCodeValue, modelCodeValue) {
  const stockCode = normalizePurchaseMatchText(stockCodeValue);
  const modelCode = normalizePurchaseMatchText(modelCodeValue);
  if (!stockCode || !modelCode) return false;
  return stockCode === modelCode
    || stockCode.startsWith(`${modelCode} `)
    || stockCode.startsWith(`${modelCode}-`)
    || stockCode.startsWith(`${modelCode}/`);
}

function indexProductsByModel(products) {
  const modelIndex = new Map();
  products.forEach((product) => {
    const stockCode = normalizePurchaseMatchText(product.stockCode);
    const prefixes = new Set([stockCode]);
    for (let position = 0; position < stockCode.length; position += 1) {
      if ([' ', '-', '/'].includes(stockCode[position])) {
        const prefix = stockCode.slice(0, position).trim();
        if (prefix) prefixes.add(prefix);
      }
    }
    prefixes.forEach((modelCode) => {
      if (!modelIndex.has(modelCode)) modelIndex.set(modelCode, []);
      modelIndex.get(modelCode).push(product);
    });
  });
  return modelIndex;
}

function normalizeCurrency(value) {
  const currency = normalizePurchaseMatchText(value);
  if (['$', 'US$', 'USD'].includes(currency)) return 'USD';
  if (['€', 'EUR'].includes(currency)) return 'EUR';
  if (['₺', 'TL', 'TRY'].includes(currency)) return 'TRY';
  return currency || 'TRY';
}

function normalizeDate(value, fieldName) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw serviceError('VEGA_SUPPLIER_INTELLIGENCE_DATE_INVALID', `${fieldName} must use YYYY-MM-DD format`);
  }
  return text;
}

function normalizeLimit(value) {
  const limit = Number(value || 100);
  if (!Number.isFinite(limit)) return 100;
  return Math.min(500, Math.max(10, Math.trunc(limit)));
}

function normalizeSourceId(value, fieldName) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw serviceError('VEGA_SUPPLIER_INTELLIGENCE_ID_INVALID', `${fieldName} must be a positive integer`);
  }
  return id;
}

export function calculatePurchasePriceFacts(line = {}) {
  const quantity = Number(line.quantity || 0);
  const currency = normalizeCurrency(line.headerCurrency || line.currency);
  const rawExchangeRate = Number(line.headerExchangeRate || line.exchangeRate || 0);
  const exchangeRate = currency === 'TRY' ? 1 : rawExchangeRate > 0 ? rawExchangeRate : 1;
  const grossUnitPriceTry = Number(line.grossUnitPriceTry || line.purchasePriceTry || 0);
  const netLineTotalTry = Number(line.netLineTotalTry || line.lineTotalTry || 0);
  const grossUnitPrice = grossUnitPriceTry / exchangeRate;
  const grossLineTotal = quantity * grossUnitPrice;
  const netLineTotal = netLineTotalTry / exchangeRate;
  const netUnitPrice = quantity > 0 ? netLineTotal / quantity : 0;
  const effectiveDiscountRate = grossLineTotal > 0
    ? 100 * (1 - (netLineTotal / grossLineTotal))
    : 0;
  const declaredDiscountRates = Array.from({ length: 6 }, (_, index) => (
    Number(line[`discountRate${index + 1}`] || 0)
  ));
  const declaredCombinedDiscountRate = 100 * (1 - declaredDiscountRates.reduce(
    (factor, discountRate) => factor * (1 - (discountRate / 100)),
    1,
  ));

  return {
    currency,
    exchangeRate: round(exchangeRate, 6),
    quantity: round(quantity, 4),
    grossUnitPrice: round(grossUnitPrice),
    grossLineTotal: round(grossLineTotal),
    netUnitPrice: round(netUnitPrice),
    netLineTotal: round(netLineTotal),
    discountAmount: round(grossLineTotal - netLineTotal),
    effectiveDiscountRate: round(effectiveDiscountRate),
    declaredDiscountRates: declaredDiscountRates.map((value) => round(value)),
    declaredCombinedDiscountRate: round(declaredCombinedDiscountRate),
    discountSource: Math.abs(effectiveDiscountRate - declaredCombinedDiscountRate) > 0.01
      ? 'gross-net-derived'
      : 'declared-fields',
  };
}

function selectSupplierBrand(supplier, genericLines, productsByModel) {
  const distinctModels = [...new Set(genericLines
    .map((line) => normalizePurchaseMatchText(line.modelCode))
    .filter((modelCode) => modelCode && !BLOCKED_MODEL_CODES.has(modelCode)))];
  const brandCoverage = new Map();

  distinctModels.forEach((modelCode) => {
    const brands = new Set((productsByModel.get(modelCode) || [])
      .map((product) => normalizePurchaseMatchText(product.brand))
      .filter(Boolean));
    brands.forEach((brand) => brandCoverage.set(brand, (brandCoverage.get(brand) || 0) + 1));
  });

  const supplierLabel = `${supplier.supplierCode || ''} ${supplier.supplierName || ''}`.trim();
  const candidates = [...brandCoverage.entries()].map(([brand, coverage]) => ({
    brand,
    coverage,
    relatedToSupplier: namesAreRelated(supplierLabel, brand),
  }));
  candidates.sort((left, right) => (
    Number(right.relatedToSupplier) - Number(left.relatedToSupplier)
      || right.coverage - left.coverage
      || left.brand.localeCompare(right.brand, 'tr')
  ));

  const selected = candidates[0] || null;
  return {
    selectedBrand: selected?.brand || '',
    selectedBrandCoverage: Number(selected?.coverage || 0),
    selectedBrandRelatedToSupplier: Boolean(selected?.relatedToSupplier),
    candidates: candidates.slice(0, 5),
  };
}

function matchLineToProduct(line, productsById, productsByModel, brandContext) {
  const directProduct = productsById.get(Number(line.stockSourceId));
  const genericStockCode = normalizePurchaseMatchText(line.stockCode);
  if (directProduct && genericStockCode !== 'URUN' && genericStockCode !== 'ÜRÜN') {
    return {
      status: 'matched',
      method: 'direct-stock-id',
      confidence: 100,
      product: directProduct,
      candidateCount: 1,
    };
  }

  const modelCode = normalizePurchaseMatchText(line.modelCode);
  if (!modelCode || BLOCKED_MODEL_CODES.has(modelCode)) {
    return {
      status: 'ignored',
      method: 'blocked-general-value',
      confidence: 0,
      product: null,
      candidateCount: 0,
    };
  }

  const candidates = productsByModel.get(modelCode) || [];
  const brandCandidates = brandContext.selectedBrand
    ? candidates.filter((product) => (
      normalizePurchaseMatchText(product.brand) === brandContext.selectedBrand
    ))
    : [];

  if (brandCandidates.length === 1) {
    return {
      status: 'matched',
      method: 'model-and-supplier-brand',
      confidence: brandContext.selectedBrandRelatedToSupplier ? 100 : 95,
      product: brandCandidates[0],
      candidateCount: candidates.length,
    };
  }
  if (candidates.length === 1) {
    return {
      status: 'review',
      method: 'model-only-unique',
      confidence: 75,
      product: candidates[0],
      candidateCount: 1,
    };
  }

  return {
    status: candidates.length > 1 ? 'ambiguous' : 'unmatched',
    method: candidates.length > 1 ? 'multiple-model-candidates' : 'no-model-candidate',
    confidence: 0,
    product: null,
    candidateCount: candidates.length,
  };
}

function compareLineRecency(left, right) {
  const dateDifference = new Date(left.documentDate || 0).getTime() - new Date(right.documentDate || 0).getTime();
  if (dateDifference !== 0) return dateDifference;
  return Number(left.lineSourceId || 0) - Number(right.lineSourceId || 0);
}

export function matchSupplierPurchaseLines({ supplier, lines, products }) {
  const normalizedProducts = products.map((product) => ({
    sourceId: Number(product.sourceId),
    stockCode: String(product.stockCode || '').trim(),
    productName: String(product.productName || '').trim(),
    brand: String(product.brand || '').trim(),
  }));
  const productsById = new Map(normalizedProducts.map((product) => [product.sourceId, product]));
  const productsByModel = indexProductsByModel(normalizedProducts);
  const genericLines = lines.filter((line) => {
    const stockCode = normalizePurchaseMatchText(line.stockCode);
    return stockCode === 'URUN' || stockCode === 'ÜRÜN';
  });
  const brandContext = selectSupplierBrand(supplier, genericLines, productsByModel);
  const genericMatchCache = new Map();
  const matchedLines = lines.map((line) => {
    const stockCode = normalizePurchaseMatchText(line.stockCode);
    const modelCode = normalizePurchaseMatchText(line.modelCode);
    const cacheKey = (stockCode === 'URUN' || stockCode === 'ÜRÜN') ? modelCode : '';
    let match = cacheKey ? genericMatchCache.get(cacheKey) : null;
    if (!match) {
      match = matchLineToProduct(line, productsById, productsByModel, brandContext);
      if (cacheKey) genericMatchCache.set(cacheKey, match);
    }
    return {
      ...line,
      modelCode: String(line.modelCode || '').trim(),
      match,
      price: calculatePurchasePriceFacts(line),
    };
  });

  return { brandContext, matchedLines, normalizedProducts };
}

export function buildSupplierPurchaseIntelligence({ supplier, lines, products, limit = 100 }) {
  const { brandContext, matchedLines, normalizedProducts } = matchSupplierPurchaseLines({
    supplier,
    lines,
    products,
  });
  const genericLines = matchedLines.filter((line) => {
    const stockCode = normalizePurchaseMatchText(line.stockCode);
    return stockCode === 'URUN' || stockCode === 'ÜRÜN';
  });
  const strongLines = matchedLines.filter((line) => line.match.status === 'matched');
  const groupedProducts = new Map();

  strongLines.forEach((line) => {
    const product = line.match.product;
    const key = `${product.sourceId}:${line.price.currency}`;
    if (!groupedProducts.has(key)) {
      groupedProducts.set(key, {
        product,
        currency: line.price.currency,
        lines: [],
      });
    }
    groupedProducts.get(key).lines.push(line);
  });

  const productRows = [...groupedProducts.values()].map((group) => {
    const sortedLines = [...group.lines].sort(compareLineRecency);
    const latest = sortedLines.at(-1);
    const totalQuantity = group.lines.reduce((sum, line) => sum + line.price.quantity, 0);
    const grossTotal = group.lines.reduce((sum, line) => sum + line.price.grossLineTotal, 0);
    const netTotal = group.lines.reduce((sum, line) => sum + line.price.netLineTotal, 0);
    const invoiceCount = new Set(group.lines.map((line) => line.headerSourceId)).size;
    return {
      productSourceId: group.product.sourceId,
      stockCode: group.product.stockCode,
      productName: group.product.productName,
      brand: group.product.brand,
      currency: group.currency,
      matchMethod: latest.match.method,
      matchConfidence: latest.match.confidence,
      purchaseLineCount: group.lines.length,
      purchaseInvoiceCount: invoiceCount,
      totalQuantity: round(totalQuantity, 4),
      weightedGrossUnitPrice: round(totalQuantity > 0 ? grossTotal / totalQuantity : 0),
      weightedNetUnitPrice: round(totalQuantity > 0 ? netTotal / totalQuantity : 0),
      weightedEffectiveDiscountRate: round(grossTotal > 0 ? 100 * (1 - (netTotal / grossTotal)) : 0),
      lastPurchaseDate: latest.documentDate || null,
      lastDocumentNo: String(latest.documentNo || '').trim(),
      lastGrossUnitPrice: latest.price.grossUnitPrice,
      lastNetUnitPrice: latest.price.netUnitPrice,
      lastEffectiveDiscountRate: latest.price.effectiveDiscountRate,
      discountSource: latest.price.discountSource,
    };
  }).sort((left, right) => (
    new Date(right.lastPurchaseDate || 0).getTime() - new Date(left.lastPurchaseDate || 0).getTime()
      || right.totalQuantity - left.totalQuantity
  ));

  const distinctModelCodes = new Set(genericLines
    .map((line) => normalizePurchaseMatchText(line.modelCode))
    .filter((modelCode) => modelCode && !BLOCKED_MODEL_CODES.has(modelCode)));
  const stronglyMatchedModels = new Set(strongLines
    .filter((line) => normalizePurchaseMatchText(line.stockCode) === 'URUN'
      || normalizePurchaseMatchText(line.stockCode) === 'ÜRÜN')
    .map((line) => normalizePurchaseMatchText(line.modelCode))
    .filter(Boolean));
  const totalGross = strongLines.reduce((sum, line) => sum + line.price.grossLineTotal, 0);
  const totalNet = strongLines.reduce((sum, line) => sum + line.price.netLineTotal, 0);

  return {
    source: 'vega-live-read-only',
    supplier: {
      sourceId: Number(supplier.sourceId),
      supplierCode: String(supplier.supplierCode || '').trim(),
      supplierName: String(supplier.supplierName || '').trim(),
    },
    brandContext,
    summary: {
      invoiceCount: new Set(lines.map((line) => line.headerSourceId)).size,
      lineCount: lines.length,
      directMatchedLineCount: matchedLines.filter((line) => line.match.method === 'direct-stock-id').length,
      contextMatchedLineCount: matchedLines.filter((line) => line.match.method === 'model-and-supplier-brand').length,
      reviewLineCount: matchedLines.filter((line) => line.match.status === 'review').length,
      ambiguousLineCount: matchedLines.filter((line) => line.match.status === 'ambiguous').length,
      unmatchedLineCount: matchedLines.filter((line) => line.match.status === 'unmatched').length,
      ignoredLineCount: matchedLines.filter((line) => line.match.status === 'ignored').length,
      distinctGenericModelCount: distinctModelCodes.size,
      stronglyMatchedGenericModelCount: stronglyMatchedModels.size,
      strongGenericModelMatchRate: round(
        distinctModelCodes.size > 0 ? 100 * (stronglyMatchedModels.size / distinctModelCodes.size) : 0,
        2,
      ),
      matchedProductCount: new Set(strongLines.map((line) => line.match.product.sourceId)).size,
      effectiveDiscountLineCount: strongLines.filter((line) => (
        Math.abs(line.price.effectiveDiscountRate) > 0.0001
      )).length,
      weightedEffectiveDiscountRate: round(
        totalGross > 0 ? 100 * (1 - (totalNet / totalGross)) : 0,
      ),
    },
    products: productRows.slice(0, limit),
    review: matchedLines
      .filter((line) => line.match.status !== 'matched')
      .slice(0, 100)
      .map((line) => ({
        lineSourceId: Number(line.lineSourceId),
        headerSourceId: Number(line.headerSourceId),
        documentNo: String(line.documentNo || '').trim(),
        documentDate: line.documentDate || null,
        modelCode: line.modelCode,
        status: line.match.status,
        method: line.match.method,
        candidateCount: line.match.candidateCount,
      })),
  };
}

export async function getVegaSupplierPurchaseIntelligence(supplierSourceIdValue, query = {}) {
  const supplierSourceId = normalizeSourceId(supplierSourceIdValue, 'supplierSourceId');
  const dateFrom = normalizeDate(query.dateFrom, 'dateFrom');
  const dateTo = normalizeDate(query.dateTo, 'dateTo');
  const limit = normalizeLimit(query.limit);
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw serviceError('VEGA_SUPPLIER_INTELLIGENCE_DATE_RANGE_INVALID', 'dateFrom cannot be after dateTo');
  }

  const pool = await getVegaSqlPool();
  const supplierResult = await pool.request()
    .input('supplierSourceId', sql.Int, supplierSourceId)
    .query(`
      SELECT TOP (1)
        c.IND AS source_id,
        c.FIRMAKODU AS supplier_code,
        c.FIRMAADI AS supplier_name
      FROM dbo.F0103TBLCARI c
      WHERE c.IND = @supplierSourceId
        AND ISNULL(c.DELETED, 0) = 0
        AND ISNULL(c.STATUS, 0) = 1;
    `);
  const supplierRow = supplierResult.recordset?.[0];
  if (!supplierRow) {
    throw serviceError('VEGA_SUPPLIER_INTELLIGENCE_NOT_FOUND', 'Vega supplier was not found', 404);
  }

  const linesResult = await pool.request()
    .input('supplierSourceId', sql.Int, supplierSourceId)
    .input('dateFrom', sql.Date, dateFrom)
    .input('dateTo', sql.Date, dateTo)
    .query(`
      SELECT
        b.IND AS header_source_id,
        b.BELGENO AS document_no,
        b.TARIH AS document_date,
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
      FROM dbo.F0103D0007TBLALFATBASLIK b
      INNER JOIN dbo.F0103D0007TBLALFATHAREKET l ON l.EVRAKNO = b.IND
      WHERE b.FIRMANO = @supplierSourceId
        AND ISNULL(b.IPTAL, 0) = 0
        AND (@dateFrom IS NULL OR b.TARIH >= @dateFrom)
        AND (@dateTo IS NULL OR b.TARIH < DATEADD(day, 1, @dateTo))
      ORDER BY b.TARIH ASC, b.IND ASC, l.IND ASC;
    `);

  const productsResult = await pool.request().query(`
    SELECT
      s.IND AS source_id,
      s.STOKKODU AS stock_code,
      s.MALINCINSI AS product_name,
      s.KOD1 AS brand
    FROM dbo.F0102TBLSTOKLAR s
    WHERE ISNULL(s.DELETED, 0) = 0
      AND ISNULL(s.IPTAL, 0) = 0
      AND ISNULL(s.STATUS, 0) = 1;
  `);

  return {
    ...buildSupplierPurchaseIntelligence({
      supplier: {
        sourceId: supplierRow.source_id,
        supplierCode: supplierRow.supplier_code,
        supplierName: supplierRow.supplier_name,
      },
      lines: (linesResult.recordset || []).map((row) => ({
        headerSourceId: Number(row.header_source_id),
        documentNo: row.document_no,
        documentDate: row.document_date,
        headerCurrency: row.header_currency,
        headerExchangeRate: Number(row.header_exchange_rate || 0),
        lineSourceId: Number(row.line_source_id),
        stockSourceId: Number(row.stock_source_id || 0),
        stockCode: row.stock_code,
        modelCode: row.model_code,
        quantity: Number(row.quantity || 0),
        grossUnitPriceTry: Number(row.gross_unit_price_try || 0),
        netLineTotalTry: Number(row.net_line_total_try || 0),
        discountRate1: Number(row.discount_rate_1 || 0),
        discountRate2: Number(row.discount_rate_2 || 0),
        discountRate3: Number(row.discount_rate_3 || 0),
        discountRate4: Number(row.discount_rate_4 || 0),
        discountRate5: Number(row.discount_rate_5 || 0),
        discountRate6: Number(row.discount_rate_6 || 0),
      })),
      products: (productsResult.recordset || []).map((row) => ({
        sourceId: Number(row.source_id),
        stockCode: row.stock_code,
        productName: row.product_name,
        brand: row.brand,
      })),
      limit,
    }),
    meta: {
      source: 'vega-live-read-only',
      companyCode: 'F0103',
      stockCompanyCode: env.vega.companyCode,
      periodCode: env.vega.periodCode,
      year: env.vega.year,
      filters: { supplierSourceId, dateFrom, dateTo, limit },
    },
  };
}
