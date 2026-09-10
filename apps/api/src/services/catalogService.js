import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import PDFDocument from 'pdfkit';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { env } from '../config/env.js';
import { writeAuditLog } from './auditService.js';
import { sqlNormalizedLike, toSearchPattern } from './queryHelpers.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';
import { getVegaProductsListFromWorker } from './vegaProductClientService.js';
import { getActiveVegaProductImageSourceIds, getVegaProductImageMap } from './vegaProductImageService.js';
import { getPresentableProductImages } from './productImageIdentity.mjs';
import { projectReviewedPublicCatalog } from './publicCatalogImagePolicy.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const productUploadsDir = path.resolve(__dirname, '../../uploads/products');
let conceptImagePathByStockCode = null;

function makeServiceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getConceptImagePathByStockCode() {
  if (conceptImagePathByStockCode) {
    return conceptImagePathByStockCode;
  }

  conceptImagePathByStockCode = new Map();

  try {
    const files = fs.readdirSync(productUploadsDir, { withFileTypes: true });

    files
      .filter((file) => file.isFile() && /^concept_.*\.(jpe?g|png|webp)$/i.test(file.name))
      .forEach((file) => {
        const match = file.name.match(/^concept_\d+_(.+?)_[^_.]+\.[^.]+$/i);
        const stockCode = trimText(match?.[1]);

        if (stockCode && !conceptImagePathByStockCode.has(stockCode)) {
          conceptImagePathByStockCode.set(stockCode, `/uploads/products/${file.name}`);
        }
      });
  } catch {
    conceptImagePathByStockCode = new Map();
  }

  return conceptImagePathByStockCode;
}

function resolvePublicProductImagePath(row) {
  const imagePath = trimText(row.image_path);

  if (imagePath) {
    return imagePath;
  }

  const stockCode = trimText(row.stock_code);
  const brand = trimText(row.brand).toLocaleUpperCase('tr-TR');

  if (brand === 'CONCEPT' || stockCode.toLocaleUpperCase('tr-TR').includes('CONCEPT')) {
    return getConceptImagePathByStockCode().get(stockCode) || '';
  }

  return '';
}

function toCatalogDto(row) {
  return {
    id: Number(row.id),
    catalogNo: row.catalog_no,
    name: row.name,
    customerId: row.customer_id ? Number(row.customer_id) : null,
    customerName: row.customer_name || null,
    customerCode: row.customer_code || null,
    customerPhone: row.customer_phone || null,
    status: row.status,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    itemCount: Number(row.item_count || 0),
    imageReadyCount: Number(row.image_ready_count || 0),
    stockReadyCount: Number(row.stock_ready_count || 0),
    totalSaleValue: Number(row.total_sale_value || 0),
    currency: row.currency_code || 'TRY',
    createdAt: row.created_at,
  };
}

function toCatalogItemDto(row) {
  return {
    id: Number(row.id),
    productId: Number(row.product_id),
    stockCode: row.stock_code,
    barcode: row.barcode || '',
    productName: row.product_name,
    brand: row.brand || '',
    category: row.category || '',
    stockQuantity: Number(row.stock_quantity || 0),
    price: Number(row.price_snapshot || 0),
    currency: row.currency_code || 'TRY',
    hasImage: Boolean(row.has_image),
    imagePath: row.image_path || '',
    displayOrder: Number(row.display_order || 0),
    note: row.note || '',
  };
}

function toCandidateDto(row) {
  return {
    productId: Number(row.product_id),
    stockCode: row.stock_code,
    barcode: row.barcode || '',
    productName: row.product_name,
    brand: row.brand || '',
    category: row.category || '',
    stockQuantity: Number(row.stock_quantity || 0),
    salePrice: Number(row.sale_price || 0),
    currency: row.currency_code || 'TRY',
    hasImage: Boolean(row.has_image),
    imagePath: row.image_path || '',
    readiness: row.has_image && Number(row.stock_quantity || 0) > 0 ? 'ready' : 'needs_attention',
  };
}

function toPublicCatalogProductDto(row) {
  const stockQuantity = Number(row.stock_quantity || 0);

  return {
    id: Number(row.product_id),
    stockCode: row.stock_code,
    productName: row.product_name,
    brand: row.brand || '',
    category: row.category || '',
    inStock: stockQuantity > 0,
    stockSignal: stockQuantity > 0 ? 'in_stock' : 'ask_sales',
    imageUrl: buildPublicUrl(resolvePublicProductImagePath(row)),
    isPassive: false,
  };
}

function toPublicVegaCatalogProductDto(row, imagePath = '') {
  const stockQuantity = Number(row.stockQuantity || 0);
  const specialCode4 = trimText(row.specialCode4 || row.specialCodes?.KOD4 || row.category);

  return {
    id: `vega-${Number(row.sourceId)}`,
    stockCode: trimText(row.stockCode),
    productName: trimText(row.productName),
    // KOD1 is the source of truth for the public brand label.
    brand: trimText(row.specialCodes?.KOD1 || row.brand),
    // KOD4 is deliberately preserved for the website taxonomy mapper.
    category: specialCode4,
    erpSpecialCode4: specialCode4,
    cardOpenedAt: row.cardOpenedAt || null,
    inStock: stockQuantity > 0 && !row.isPassive,
    stockSignal: stockQuantity > 0 && !row.isPassive ? 'in_stock' : 'ask_sales',
    imageUrl: buildPublicUrl(imagePath),
    isPassive: Boolean(row.isPassive),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePhone(value) {
  const digits = trimText(value).replace(/[^\d]/g, '');

  if (digits.startsWith('00')) {
    return digits.slice(2);
  }

  if (digits.startsWith('90')) {
    return digits;
  }

  if (digits.startsWith('0') && digits.length === 11) {
    return `90${digits.slice(1)}`;
  }

  if (digits.length === 10 && digits.startsWith('5')) {
    return `90${digits}`;
  }

  return digits;
}

function buildPublicUrl(pathValue) {
  const value = trimText(pathValue);
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  const base = env.whatsapp.publicApiUrl.replace(/\/+$/, '');
  const pathPart = value.startsWith('/') ? value : `/${value}`;
  const encodedPath = pathPart
    .split('/')
    .map((part, index) => (index === 0 ? part : encodeURIComponent(part)))
    .join('/');
  return `${base}${encodedPath}`;
}

function formatCatalogMoney(value, currency = 'TRY') {
  const amount = Number(value || 0);
  const suffix = currency || 'TRY';
  return `${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${suffix}`;
}

function buildCleanWhatsappCaption(item) {
  const lines = [];
  if (item.stockCode) lines.push(`✨ *${item.stockCode}* ✨`);
  if (item.productName) lines.push(`🧸 ${item.productName}`);
  lines.push('Fiyat ve stok bilgisi icin satis ekibinden teyit aliniz.');
  return lines.join('\n');
}

function buildWhatsappCaption(item) {
  return [
    item.stockCode ? `✨ *${item.stockCode}* ✨` : '',
    item.productName ? `🧸 ${item.productName}` : '',
    'Fiyat ve stok bilgisi icin satis ekibinden teyit aliniz.',
  ].filter(Boolean).join('\n');
}

function getWhatsappStatus() {
  const missing = [];
  if (!env.whatsapp.enabled) missing.push('WHATSAPP_ENABLED=true');
  if (!env.whatsapp.baseUrl) missing.push('WHATSAPP_API_URL');
  if (!env.whatsapp.apiKey) missing.push('WHATSAPP_API_KEY');
  if (!env.whatsapp.instance) missing.push('WHATSAPP_INSTANCE');
  const configured = missing.length === 0;

  return {
    provider: env.whatsapp.provider,
    enabled: env.whatsapp.enabled,
    configured,
    sendApproved: env.whatsapp.sendApproved,
    sendEnabled: configured && env.whatsapp.sendApproved,
    missing,
    approvalRequired: !env.whatsapp.sendApproved,
    instance: env.whatsapp.instance || null,
    publicApiUrl: env.whatsapp.publicApiUrl,
  };
}

function assertWhatsappSendAllowed(status = getWhatsappStatus()) {
  if (!status.sendApproved) {
    throw makeServiceError(
      'WHATSAPP_SEND_APPROVAL_REQUIRED',
      'WhatsApp gonderimi Melih onayi olmadan kapali. Onayli calisma icin WHATSAPP_SEND_APPROVED=true gerekir.',
      403,
    );
  }

  if (!status.configured) {
    throw makeServiceError('WHATSAPP_NOT_CONFIGURED', 'WhatsApp gonderimi icin Evolution API ayarlari eksik', 503);
  }
}

async function sendEvolutionImage({ phone, imageUrl, caption, fileName }) {
  return sendEvolutionMedia({
    phone,
    media: imageUrl,
    caption,
    fileName: fileName || 'melisa-urun.jpg',
    mediatype: 'image',
    mimetype: 'image/jpeg',
  });
}

async function sendEvolutionMedia({ phone, media, caption, fileName, mediatype = 'image', mimetype = 'image/jpeg' }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.whatsapp.timeoutMs);
  const baseUrl = env.whatsapp.baseUrl.replace(/\/+$/, '');
  const instance = encodeURIComponent(env.whatsapp.instance);

  try {
    const response = await fetch(`${baseUrl}/message/sendMedia/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.whatsapp.apiKey,
      },
      body: JSON.stringify({
        number: phone,
        mediatype,
        mimetype,
        media,
        caption,
        fileName: fileName || 'melisa-urun.jpg',
      }),
      signal: controller.signal,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = { raw: await response.text().catch(() => '') };
    }

    if (!response.ok) {
      const error = new Error(payload?.message || payload?.error || 'WhatsApp media send failed');
      error.statusCode = 502;
      error.code = 'WHATSAPP_SEND_FAILED';
      error.meta = { status: response.status, payload };
      throw error;
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendEvolutionText({ phone, text }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.whatsapp.timeoutMs);
  const baseUrl = env.whatsapp.baseUrl.replace(/\/+$/, '');
  const instance = encodeURIComponent(env.whatsapp.instance);

  try {
    const response = await fetch(`${baseUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.whatsapp.apiKey,
      },
      body: JSON.stringify({
        number: phone,
        text,
      }),
      signal: controller.signal,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = { raw: await response.text().catch(() => '') };
    }

    if (!response.ok) {
      const error = new Error(payload?.message || payload?.error || 'WhatsApp text send failed');
      error.statusCode = 502;
      error.code = 'WHATSAPP_SEND_FAILED';
      error.meta = { status: response.status, payload };
      throw error;
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function getSummary(pool) {
  const result = await pool.request().query(`
    SELECT
      COUNT_BIG(DISTINCT c.id) AS catalog_count,
      COUNT_BIG(ci.id) AS catalog_item_count,
      SUM(CASE WHEN pi.id IS NOT NULL THEN 1 ELSE 0 END) AS image_ready_count,
      SUM(CASE WHEN p.current_stock_qty > 0 THEN 1 ELSE 0 END) AS stock_ready_count,
      COUNT_BIG(DISTINCT CASE WHEN c.status = N'published' THEN c.id END) AS published_count
    FROM dbo.catalogs c
    LEFT JOIN dbo.catalog_items ci ON ci.catalog_id = c.id
    LEFT JOIN dbo.products p ON p.id = ci.product_id
    LEFT JOIN dbo.product_images pi ON pi.id = ci.product_image_id AND pi.is_active = 1;
  `);

  const row = result.recordset?.[0] || {};
  return {
    catalogCount: Number(row.catalog_count || 0),
    catalogItemCount: Number(row.catalog_item_count || 0),
    imageReadyCount: Number(row.image_ready_count || 0),
    stockReadyCount: Number(row.stock_ready_count || 0),
    publishedCount: Number(row.published_count || 0),
  };
}

async function getCatalogItems(pool, catalogId) {
  const result = await pool.request()
    .input('catalogId', sql.BigInt, catalogId)
    .query(`
      SELECT
        ci.id,
        ci.product_id,
        p.stock_code,
        pb.barcode,
        p.name AS product_name,
        p.brand,
        p.category,
        p.current_stock_qty AS stock_quantity,
        ci.price_snapshot,
        ci.currency_code,
        CASE WHEN pi.id IS NULL THEN 0 ELSE 1 END AS has_image,
        COALESCE(pi.file_path, pi.storage_key, N'') AS image_path,
        ci.display_order,
        ci.note
      FROM dbo.catalog_items ci
      INNER JOIN dbo.products p ON p.id = ci.product_id
      OUTER APPLY (
        SELECT TOP (1) b.barcode
        FROM dbo.product_barcodes b
        WHERE b.product_id = p.id AND b.is_active = 1
        ORDER BY b.is_primary DESC, b.id ASC
      ) pb
      LEFT JOIN dbo.product_images pi ON pi.id = ci.product_image_id AND pi.is_active = 1
      WHERE ci.catalog_id = @catalogId
      ORDER BY ci.display_order ASC, ci.id ASC;
    `);

  return (result.recordset || []).map(toCatalogItemDto);
}

export async function getCatalogOverview(query = {}) {
  const pool = await getSqlPool();
  const search = trimText(query.search);
  const status = trimText(query.status);
  const catalogId = Number(query.catalogId || 0) || null;
  const productSearch = trimText(query.productSearch);
  const brand = trimText(query.brand);
  const category = trimText(query.category);
  const currency = trimText(query.currency).toUpperCase();
  const stockMode = trimText(query.stockMode);
  const imageMode = trimText(query.imageMode);
  const minPrice = Number(query.minPrice);
  const maxPrice = Number(query.maxPrice);
  const catalogSearchPredicates = [
    'c.catalog_no',
    'c.name',
    'cu.name',
  ].map((column) => sqlNormalizedLike(column)).join('\n          OR ');
  const productSearchPredicates = [
    'p.stock_code',
    'p.name',
    'p.brand',
    'p.category',
  ].map((column) => sqlNormalizedLike(column, '@productSearch')).join('\n        OR ');

  const catalogResult = await pool.request()
    .input('search', sql.NVarChar(120), toSearchPattern(search))
    .input('status', sql.NVarChar(20), status || null)
    .query(`
      SELECT TOP (80)
        c.id,
        c.catalog_no,
        c.name,
        c.customer_id,
        cu.name AS customer_name,
        cu.customer_code,
        cu.phone AS customer_phone,
        c.status,
        c.valid_from,
        c.valid_to,
        c.created_at,
        COUNT_BIG(ci.id) AS item_count,
        SUM(CASE WHEN pi.id IS NOT NULL THEN 1 ELSE 0 END) AS image_ready_count,
        SUM(CASE WHEN p.current_stock_qty > 0 THEN 1 ELSE 0 END) AS stock_ready_count,
        SUM(COALESCE(ci.price_snapshot, 0)) AS total_sale_value,
        MAX(COALESCE(ci.currency_code, N'TRY')) AS currency_code
      FROM dbo.catalogs c
      LEFT JOIN dbo.customers cu ON cu.id = c.customer_id
      LEFT JOIN dbo.catalog_items ci ON ci.catalog_id = c.id
      LEFT JOIN dbo.products p ON p.id = ci.product_id
      LEFT JOIN dbo.product_images pi ON pi.id = ci.product_image_id AND pi.is_active = 1
      WHERE
        (@status IS NULL OR c.status = @status)
        AND (
          @search IS NULL
          OR ${catalogSearchPredicates}
        )
      GROUP BY c.id, c.catalog_no, c.name, c.customer_id, cu.name, cu.customer_code, cu.phone, c.status, c.valid_from, c.valid_to, c.created_at
      ORDER BY c.id DESC;
    `);

  const candidateRequest = pool.request()
    .input('productSearch', sql.NVarChar(160), toSearchPattern(productSearch))
    .input('brand', sql.NVarChar(120), brand || null)
    .input('category', sql.NVarChar(120), category || null)
    .input('currency', sql.NVarChar(3), currency || null)
    .input('stockMode', sql.NVarChar(20), stockMode || null)
    .input('imageMode', sql.NVarChar(20), imageMode || null)
    .input('minPrice', sql.Decimal(18, 4), Number.isFinite(minPrice) ? minPrice : null)
    .input('maxPrice', sql.Decimal(18, 4), Number.isFinite(maxPrice) ? maxPrice : null);

  const candidateResult = await candidateRequest.query(`
    SELECT TOP (80)
      p.id AS product_id,
      p.stock_code,
      pb.barcode,
      p.name AS product_name,
      p.brand,
      p.category,
      p.current_stock_qty AS stock_quantity,
      p.sales_price AS sale_price,
      p.currency_code,
      CASE WHEN pi.id IS NULL THEN 0 ELSE 1 END AS has_image,
      COALESCE(pi.file_path, pi.storage_key, N'') AS image_path
    FROM dbo.products p
    OUTER APPLY (
      SELECT TOP (1) b.barcode
      FROM dbo.product_barcodes b
      WHERE b.product_id = p.id AND b.is_active = 1
      ORDER BY b.is_primary DESC, b.id ASC
    ) pb
    OUTER APPLY (
      SELECT TOP (1) i.id, i.file_path, i.storage_key
      FROM dbo.product_images i
      WHERE i.product_id = p.id AND i.is_active = 1
      ORDER BY i.is_primary DESC, i.sort_order ASC, i.id ASC
    ) pi
    WHERE p.is_deleted = 0
      AND p.is_active = 1
      AND (
        @productSearch IS NULL
        OR ${productSearchPredicates}
        OR EXISTS (
          SELECT 1
          FROM dbo.product_barcodes bx
          WHERE bx.product_id = p.id
            AND bx.is_active = 1
            AND ${sqlNormalizedLike('bx.barcode', '@productSearch')}
        )
      )
      AND (@brand IS NULL OR p.brand = @brand)
      AND (@category IS NULL OR p.category = @category)
      AND (@currency IS NULL OR p.currency_code = @currency)
      AND (
        @stockMode IS NULL
        OR (@stockMode = N'inStock' AND p.current_stock_qty > 0)
        OR (@stockMode = N'zero' AND p.current_stock_qty = 0)
        OR (@stockMode = N'negative' AND p.current_stock_qty < 0)
      )
      AND (
        @imageMode IS NULL
        OR (@imageMode = N'withImage' AND pi.id IS NOT NULL)
        OR (@imageMode = N'withoutImage' AND pi.id IS NULL)
      )
      AND (@minPrice IS NULL OR p.sales_price >= @minPrice)
      AND (@maxPrice IS NULL OR p.sales_price <= @maxPrice)
    ORDER BY
      CASE WHEN p.current_stock_qty > 0 THEN 0 ELSE 1 END ASC,
      CASE WHEN pi.id IS NULL THEN 1 ELSE 0 END ASC,
      p.current_stock_qty DESC,
      p.id DESC;
  `);

  const filterOptionsResult = await pool.request().query(`
    SELECT TOP (80) brand AS value
    FROM dbo.products
    WHERE is_deleted = 0 AND is_active = 1 AND ISNULL(brand, N'') <> N''
    GROUP BY brand
    ORDER BY brand;

    SELECT TOP (80) category AS value
    FROM dbo.products
    WHERE is_deleted = 0 AND is_active = 1 AND ISNULL(category, N'') <> N''
    GROUP BY category
    ORDER BY category;
  `);

  const catalogs = (catalogResult.recordset || []).map(toCatalogDto);
  const selectedCatalogId = catalogId || catalogs[0]?.id || null;
  const items = selectedCatalogId ? await getCatalogItems(pool, selectedCatalogId) : [];
  const customerResult = await pool.request().query(`
    SELECT TOP (120)
      id,
      customer_code,
      name,
      phone,
      city,
      currency_code,
      balance
    FROM dbo.customers
    WHERE is_deleted = 0 AND is_active = 1
    ORDER BY
      CASE WHEN ISNULL(phone, N'') = N'' THEN 1 ELSE 0 END ASC,
      name ASC,
      id DESC;
  `);

  return {
    summary: await getSummary(pool),
    catalogs,
    selectedCatalogId: selectedCatalogId ? Number(selectedCatalogId) : null,
    items,
    customers: (customerResult.recordset || []).map((row) => ({
      id: Number(row.id),
      customerCode: row.customer_code,
      customerName: row.name,
      phone: row.phone || '',
      city: row.city || '',
      currency: row.currency_code || 'TRY',
      balance: Number(row.balance || 0),
    })),
    productCandidates: (candidateResult.recordset || []).map(toCandidateDto),
    filterOptions: {
      brands: (filterOptionsResult.recordsets?.[0] || []).map((row) => row.value),
      categories: (filterOptionsResult.recordsets?.[1] || []).map((row) => row.value),
      currencies: ['TRY', 'USD', 'EUR'],
    },
    filters: {
      search,
      status,
      catalogId: selectedCatalogId ? Number(selectedCatalogId) : null,
      productSearch,
      brand,
      category,
      currency,
      stockMode,
      imageMode,
      minPrice: Number.isFinite(minPrice) ? minPrice : null,
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : null,
    },
  };
}

export async function getPublicCatalogProducts(query = {}) {
  try {
    const imageOnly = String(query.imageOnly ?? 'true').toLowerCase() !== 'false';
    const imageSourceIds = imageOnly ? await getActiveVegaProductImageSourceIds() : [];

    // Registration bounds the source scan; publication still requires identity review.
    if (imageOnly && imageSourceIds.length === 0) {
      return projectReviewedPublicCatalog([], { total: 0, page: Number(query.page) || 1 }, new Map(), toPublicVegaCatalogProductDto, true);
    }

    const result = await getVegaProductsListFromWorker({
      ...query,
      activeOnly: true,
      imageStatus: imageOnly ? 'with-image' : 'all',
      includeSourceIds: imageOnly ? imageSourceIds : query.includeSourceIds,
    });
    const rows = result.data || [];
    const imageMap = await getVegaProductImageMap(rows.map((product) => product.sourceId));
    const presentation = await getPresentableProductImages(rows, imageMap);
    return projectReviewedPublicCatalog(rows, result.meta || {}, presentation, toPublicVegaCatalogProductDto, imageOnly);
  } catch {
    throw makeServiceError('PUBLIC_CATALOG_UNAVAILABLE', 'Public catalog source could not be verified', 503);
  }
}

// Retained for explicit legacy maintenance; never an automatic public fallback.
export async function getLegacyPublicCatalogProducts(query = {}) {
  const pool = await getSqlPool();
  const search = trimText(query.search);
  const brand = trimText(query.brand);
  const category = trimText(query.category);
  const inStockOnly = String(query.inStockOnly || 'false').toLowerCase() === 'true';
  const rawLimit = Number(query.limit || 100);
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 300) : 100;
  const rawOffset = Number(query.offset || 0);
  const offset = Number.isInteger(rawOffset) && rawOffset > 0 ? rawOffset : 0;
  const publicProductSearchPredicates = [
    'p.stock_code',
    'p.name',
    'p.brand',
    'p.category',
  ].map((column) => sqlNormalizedLike(column)).join('\n            OR ');

  const result = await pool.request()
    .input('search', sql.NVarChar(160), toSearchPattern(search))
    .input('brand', sql.NVarChar(120), brand || null)
    .input('category', sql.NVarChar(120), category || null)
    .input('inStockOnly', sql.Bit, inStockOnly)
    .input('offset', sql.Int, offset)
    .query(`
      WITH filtered_products AS (
        SELECT
          p.id AS product_id,
          p.stock_code,
          p.name AS product_name,
          p.brand,
          p.category,
          p.current_stock_qty AS stock_quantity,
          COALESCE(pi.file_path, pi.storage_key, N'') AS image_path,
          ROW_NUMBER() OVER (
            ORDER BY
              CASE WHEN p.current_stock_qty > 0 THEN 0 ELSE 1 END ASC,
              CASE WHEN pi.file_path IS NULL AND pi.storage_key IS NULL THEN 1 ELSE 0 END ASC,
              p.id DESC
          ) AS row_number,
          COUNT_BIG(1) OVER () AS total_count
        FROM dbo.products p
        OUTER APPLY (
          SELECT TOP (1) image.file_path, image.storage_key
          FROM dbo.product_images image
          WHERE image.product_id = p.id
            AND image.is_active = 1
          ORDER BY image.is_primary DESC, image.sort_order ASC, image.id ASC
        ) pi
        WHERE p.is_deleted = 0
          AND p.is_active = 1
          AND (@brand IS NULL OR p.brand = @brand)
          AND (@category IS NULL OR p.category = @category)
          AND (@inStockOnly = 0 OR p.current_stock_qty > 0)
          AND (
            @search IS NULL
            OR ${publicProductSearchPredicates}
          )
      )
      SELECT TOP (${limit}) *
      FROM filtered_products
      WHERE row_number > @offset
      ORDER BY row_number ASC;
    `);

  const rows = result.recordset || [];
  const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;

  return {
    products: rows.map(toPublicCatalogProductDto),
    meta: {
      source: 'sql-public-catalog',
      limit,
      offset,
      count: rows.length,
      total,
      hasMore: offset + rows.length < total,
      publicFieldsOnly: true,
      pricesIncluded: false,
      barcodesIncluded: false,
    },
  };
}

export async function createCatalogDraft(payload = {}, actor = null) {
  assertMelisaWriteEnabled();

  const name = trimText(payload.name) || `Katalog ${new Date().toISOString().slice(0, 10)}`;
  const customerId = Number(payload.customerId || 0) || null;
  const productIds = Array.isArray(payload.productIds)
    ? [...new Set(payload.productIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
    : [];

  if (productIds.length < 1) {
    throw makeServiceError('CATALOG_PRODUCTS_REQUIRED', 'Katalog icin en az bir urun secilmeli');
  }

  const sqlDriver = getSqlDriver();
  const pool = await getSqlPool();
  const transaction = new sqlDriver.Transaction(pool);
  await transaction.begin();

  try {
    const catalogNo = `KAT-${Date.now()}`;
    const insertCatalog = await new sqlDriver.Request(transaction)
      .input('catalogNo', sql.NVarChar(50), catalogNo)
      .input('name', sql.NVarChar(200), name)
      .input('customerId', sql.BigInt, customerId)
      .input('actorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        INSERT INTO dbo.catalogs (catalog_no, name, customer_id, status, created_by)
        OUTPUT inserted.id
        VALUES (@catalogNo, @name, @customerId, N'draft', @actorId);
      `);

    const catalogId = Number(insertCatalog.recordset[0].id);

    for (let index = 0; index < productIds.length; index += 1) {
      await new sqlDriver.Request(transaction)
        .input('catalogId', sql.BigInt, catalogId)
        .input('productId', sql.BigInt, productIds[index])
        .input('displayOrder', sql.Int, index + 1)
        .query(`
          INSERT INTO dbo.catalog_items (
            catalog_id,
            product_id,
            product_image_id,
            display_order,
            price_snapshot,
            currency_code,
            note
          )
          SELECT
            @catalogId,
            p.id,
            pi.id,
            @displayOrder,
            p.sales_price,
            p.currency_code,
            CASE WHEN pi.id IS NULL THEN N'Gorsel eksik' ELSE NULL END
          FROM dbo.products p
          OUTER APPLY (
            SELECT TOP (1) i.id
            FROM dbo.product_images i
            WHERE i.product_id = p.id AND i.is_active = 1
            ORDER BY i.is_primary DESC, i.sort_order ASC, i.id ASC
          ) pi
          WHERE p.id = @productId
            AND p.is_deleted = 0
            AND p.is_active = 1;
        `);
    }

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'catalog_draft_created',
      entityType: 'catalog',
      entityId: catalogId,
      beforeSnapshot: null,
      afterSnapshot: { catalogNo, name, customerId, productIds },
      actor,
    });

    await transaction.commit();
    return {
      catalogId,
      catalogNo,
      name,
      itemCount: productIds.length,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function getWhatsappPlanner(query = {}) {
  const pool = await getSqlPool();
  const catalogId = Number(query.catalogId || 0) || null;

  const customerResult = await pool.request().query(`
    SELECT TOP (80)
      c.id,
      c.customer_code,
      c.name,
      c.city,
      c.country,
      c.currency_code,
      c.balance,
      MAX(si.document_date) AS last_sale_date,
      COUNT_BIG(si.id) AS receipt_count
    FROM dbo.customers c
    LEFT JOIN dbo.sales_invoices si ON si.customer_id = c.id AND si.status = N'finalized'
    WHERE c.is_active = 1 AND c.is_deleted = 0
    GROUP BY c.id, c.customer_code, c.name, c.city, c.country, c.currency_code, c.balance
    ORDER BY MAX(si.document_date) DESC, c.id DESC;
  `);

  const catalogResult = await pool.request().query(`
    SELECT TOP (20)
      c.id,
      c.catalog_no,
      c.name,
      c.status,
      COUNT_BIG(ci.id) AS item_count
    FROM dbo.catalogs c
    LEFT JOIN dbo.catalog_items ci ON ci.catalog_id = c.id
    GROUP BY c.id, c.catalog_no, c.name, c.status
    ORDER BY CASE WHEN c.status = N'published' THEN 0 ELSE 1 END, c.id DESC;
  `);

  const selectedCatalog = catalogId
    ? catalogResult.recordset.find((row) => Number(row.id) === catalogId)
    : catalogResult.recordset[0];

  const messageTemplate = selectedCatalog
    ? `Merhaba, ${selectedCatalog.name} katalogumuz hazir. Urun ve fiyat listesini inceleyebilirsiniz.`
    : 'Merhaba, Melisa Bebe urun katalogumuz hazir. Urun ve fiyat listesini inceleyebilirsiniz.';

  return {
    catalogs: (catalogResult.recordset || []).map((row) => ({
      id: Number(row.id),
      catalogNo: row.catalog_no,
      name: row.name,
      status: row.status,
      itemCount: Number(row.item_count || 0),
    })),
    selectedCatalogId: selectedCatalog ? Number(selectedCatalog.id) : null,
    messageTemplate,
    customers: (customerResult.recordset || []).map((row) => ({
      id: Number(row.id),
      customerCode: row.customer_code,
      customerName: row.name,
      city: row.city || '',
      country: row.country || '',
      currency: row.currency_code || 'TRY',
      balance: Number(row.balance || 0),
      lastSaleDate: row.last_sale_date,
      receiptCount: Number(row.receipt_count || 0),
      whatsappText: `${messageTemplate} Cari: ${row.name}`,
    })),
  };
}

export async function getWhatsappProviderStatus() {
  return getWhatsappStatus();
}

function normalizeTerminalShareLines(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      productId: Number(item.productId || item.id || 0),
      stockCode: trimText(item.stockCode),
      barcode: trimText(item.barcode),
      productName: trimText(item.productName || item.name),
      category: trimText(item.category),
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || item.salePrice || 0),
      currency: trimText(item.currency) || 'TRY',
      imageUrl: trimText(item.imageUrl),
    }))
    .filter((item) => item.productId > 0 || item.stockCode || item.productName);
}

async function enrichTerminalShareImages(lines = []) {
  const ids = [...new Set(lines.map((item) => item.productId).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return lines;

  const pool = await getSqlPool();
  const request = pool.request();
  const placeholders = ids.map((id, index) => {
    request.input(`productId${index}`, sql.BigInt, id);
    return `@productId${index}`;
  });

  const result = await request.query(`
    SELECT
      p.id AS product_id,
      COALESCE(pi.file_path, pi.storage_key, N'') AS image_path
    FROM dbo.products p
    OUTER APPLY (
      SELECT TOP (1) image.file_path, image.storage_key
      FROM dbo.product_images image
      WHERE image.product_id = p.id
        AND image.is_active = 1
      ORDER BY image.is_primary DESC, image.sort_order ASC, image.id ASC
    ) pi
    WHERE p.id IN (${placeholders.join(', ')});
  `);

  const imageByProductId = new Map((result.recordset || []).map((row) => [
    Number(row.product_id),
    buildPublicUrl(row.image_path),
  ]));

  return lines.map((item) => ({
    ...item,
    imageUrl: item.imageUrl ? buildPublicUrl(item.imageUrl) : imageByProductId.get(item.productId) || '',
  }));
}

function buildTerminalReceiptText({ customerName, customerCode, lines }) {
  const totalsByCurrency = lines.reduce((summary, item) => {
    const currency = item.currency || 'TRY';
    return {
      ...summary,
      [currency]: Number(summary[currency] || 0) + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    };
  }, {});
  const itemQuantity = lines.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const rows = [
    'MELISA MINI ERP',
    'TERMINAL FIS',
    '------------------------------',
    `Cari: ${customerName || '-'}`,
    `Kod: ${customerCode || '-'}`,
    `Tarih: ${new Date().toLocaleString('tr-TR')}`,
    '------------------------------',
  ];

  lines.forEach((item) => {
    const lineTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
    rows.push(`${item.stockCode || '-'} ${item.productName || '-'}`);
    rows.push(`${item.quantity} x ${formatCatalogMoney(item.unitPrice, item.currency)} = ${formatCatalogMoney(lineTotal, item.currency)}`);
  });

  rows.push('------------------------------');
  rows.push(`Toplam adet: ${itemQuantity}`);
  Object.entries(totalsByCurrency).forEach(([currency, amount]) => {
    rows.push(`Toplam ${currency}: ${formatCatalogMoney(amount, currency)}`);
  });

  return rows.join('\n');
}

function buildTerminalReceiptPdfBuffer({ customerName, customerCode, lines }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Melisa Mini ERP - Terminal Fis', { underline: true });
    doc.moveDown(0.7);
    doc.fontSize(10).text(`Cari: ${customerName || '-'}`);
    doc.text(`Kod: ${customerCode || '-'}`);
    doc.text(`Tarih: ${new Date().toLocaleString('tr-TR')}`);
    doc.moveDown();

    doc.fontSize(10).text('Urun', 36, doc.y, { width: 230, continued: true });
    doc.text('Adet', 280, doc.y, { width: 50, continued: true, align: 'right' });
    doc.text('Birim', 340, doc.y, { width: 80, continued: true, align: 'right' });
    doc.text('Toplam', 430, doc.y, { width: 100, align: 'right' });
    doc.moveTo(36, doc.y + 4).lineTo(540, doc.y + 4).stroke();
    doc.moveDown(0.8);

    const totalsByCurrency = {};
    let itemQuantity = 0;
    lines.forEach((item) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      const currency = item.currency || 'TRY';
      const lineTotal = quantity * unitPrice;
      itemQuantity += quantity;
      totalsByCurrency[currency] = Number(totalsByCurrency[currency] || 0) + lineTotal;

      const y = doc.y;
      doc.fontSize(9).text(`${item.stockCode || '-'} ${item.productName || '-'}`, 36, y, { width: 230 });
      doc.text(String(quantity), 280, y, { width: 50, align: 'right' });
      doc.text(formatCatalogMoney(unitPrice, currency), 340, y, { width: 80, align: 'right' });
      doc.text(formatCatalogMoney(lineTotal, currency), 430, y, { width: 100, align: 'right' });
      doc.moveDown(0.5);
    });

    doc.moveDown();
    doc.fontSize(11).text(`Toplam adet: ${itemQuantity}`);
    Object.entries(totalsByCurrency).forEach(([currency, amount]) => {
      doc.text(`Toplam ${currency}: ${formatCatalogMoney(amount, currency)}`);
    });

    doc.end();
  });
}

function buildTerminalProductCaption(item) {
  const lineTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
  return [
    item.stockCode ? `*${item.stockCode}*` : '',
    item.productName || '',
    `Adet: ${Number(item.quantity || 0)}`,
    `Birim fiyat: ${formatCatalogMoney(item.unitPrice, item.currency)}`,
    `Toplam: ${formatCatalogMoney(lineTotal, item.currency)}`,
  ].filter(Boolean).join('\n');
}

export async function sendTerminalWhatsappShare(payload = {}) {
  const status = getWhatsappStatus();
  assertWhatsappSendAllowed(status);

  const phone = normalizePhone(payload.phone || payload.customerPhone);
  if (phone.length < 10) {
    throw makeServiceError('WHATSAPP_PHONE_INVALID', 'WhatsApp telefon numarasi gecersiz');
  }

  const mode = trimText(payload.mode) || 'products';
  const customerName = trimText(payload.customerName);
  const customerCode = trimText(payload.customerCode);
  const lines = await enrichTerminalShareImages(normalizeTerminalShareLines(payload.items || payload.lines));
  if (!lines.length) {
    throw makeServiceError('TERMINAL_SHARE_EMPTY', 'Gonderilecek fis satiri yok');
  }

  if (mode === 'receipt') {
    const pdfBuffer = await buildTerminalReceiptPdfBuffer({ customerName, customerCode, lines });
    const receiptText = buildTerminalReceiptText({ customerName, customerCode, lines });
    const response = await sendEvolutionMedia({
      phone,
      media: pdfBuffer.toString('base64'),
      caption: receiptText,
      fileName: `terminal-fis-${Date.now()}.pdf`,
      mediatype: 'document',
      mimetype: 'application/pdf',
    });

    return {
      mode,
      phone,
      total: 1,
      sent: 1,
      failed: 0,
      skipped: 0,
      providerResponse: response?.key?.id || response?.id || null,
    };
  }

  const results = [];
  for (let index = 0; index < lines.length; index += 1) {
    const item = lines[index];
    const caption = buildTerminalProductCaption(item);

    if (!item.imageUrl) {
      try {
        const response = await sendEvolutionText({ phone, text: caption });
        results.push({
          productId: item.productId,
          stockCode: item.stockCode,
          status: 'sent',
          message: 'Metin gonderildi',
          providerResponse: response?.key?.id || response?.id || null,
        });
      } catch (error) {
        results.push({
          productId: item.productId,
          stockCode: item.stockCode,
          status: 'failed',
          message: error.message || 'Gonderim hatasi',
          code: error.code || 'WHATSAPP_SEND_FAILED',
        });
      }
    } else {
      try {
        const response = await sendEvolutionImage({
          phone,
          imageUrl: item.imageUrl,
          caption,
          fileName: `${item.stockCode || item.productId || index + 1}.jpg`,
        });
        results.push({
          productId: item.productId,
          stockCode: item.stockCode,
          status: 'sent',
          message: 'Gonderildi',
          providerResponse: response?.key?.id || response?.id || null,
        });
      } catch (error) {
        results.push({
          productId: item.productId,
          stockCode: item.stockCode,
          status: 'failed',
          message: error.message || 'Gonderim hatasi',
          code: error.code || 'WHATSAPP_SEND_FAILED',
        });
      }
    }

    if (index < lines.length - 1 && env.whatsapp.sendDelayMs > 0) {
      await sleep(env.whatsapp.sendDelayMs);
    }
  }

  return {
    mode,
    phone,
    total: lines.length,
    sent: results.filter((row) => row.status === 'sent').length,
    failed: results.filter((row) => row.status === 'failed').length,
    skipped: results.filter((row) => row.status === 'skipped').length,
    results,
  };
}

export async function sendCatalogToWhatsapp(payload = {}) {
  const status = getWhatsappStatus();
  assertWhatsappSendAllowed(status);

  const phone = normalizePhone(payload.phone);
  if (phone.length < 10) {
    throw makeServiceError('WHATSAPP_PHONE_INVALID', 'WhatsApp telefon numarasi gecersiz');
  }

  const catalogId = Number(payload.catalogId || 0);
  if (!Number.isInteger(catalogId) || catalogId < 1) {
    throw makeServiceError('CATALOG_ID_REQUIRED', 'Gonderim icin katalog secilmeli');
  }

  const pool = await getSqlPool();
  const items = await getCatalogItems(pool, catalogId);
  if (items.length < 1) {
    throw makeServiceError('CATALOG_ITEMS_EMPTY', 'Katalog icinde gonderilecek urun yok');
  }

  const limit = Number(payload.limit || 0);
  const selectedItems = Number.isInteger(limit) && limit > 0 ? items.slice(0, limit) : items;
  const results = [];

  for (let index = 0; index < selectedItems.length; index += 1) {
    const item = selectedItems[index];
    const imageUrl = buildPublicUrl(item.imagePath);
    const caption = buildCleanWhatsappCaption(item);

    if (!imageUrl) {
      results.push({
        itemId: item.id,
        productId: item.productId,
        stockCode: item.stockCode,
        status: 'skipped',
        message: 'Gorsel yok',
      });
      continue;
    }

    try {
      const response = await sendEvolutionImage({
        phone,
        imageUrl,
        caption,
        fileName: `${item.stockCode || item.productId}.jpg`,
      });

      results.push({
        itemId: item.id,
        productId: item.productId,
        stockCode: item.stockCode,
        status: 'sent',
        message: 'Gonderildi',
        providerResponse: response?.key?.id || response?.id || null,
      });
    } catch (error) {
      results.push({
        itemId: item.id,
        productId: item.productId,
        stockCode: item.stockCode,
        status: 'failed',
        message: error.message || 'Gonderim hatasi',
        code: error.code || 'WHATSAPP_SEND_FAILED',
      });
    }

    if (index < selectedItems.length - 1 && env.whatsapp.sendDelayMs > 0) {
      await sleep(env.whatsapp.sendDelayMs);
    }
  }

  return {
    catalogId,
    phone,
    total: selectedItems.length,
    sent: results.filter((row) => row.status === 'sent').length,
    failed: results.filter((row) => row.status === 'failed').length,
    skipped: results.filter((row) => row.status === 'skipped').length,
    results,
  };
}
