import sql from 'mssql';
import { getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { createSalesDraft, finalizeSalesInvoice, getSalesDraft } from './invoiceDraftService.js';
import { getCustomersList } from './customerService.js';
import { getProductsList } from './productService.js';

const IDEMPOTENCY_PREFIX = 'terminalClientEventId:';

function serviceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value, fieldName, { min = 0, allowZero = true } = {}) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < min || (!allowZero && parsed === 0)) {
    throw serviceError('TERMINAL_SALE_VALIDATION_FAILED', `${fieldName} is invalid`);
  }

  return parsed;
}

function idempotencyMarker(clientEventId) {
  return `${IDEMPOTENCY_PREFIX}${clientEventId}`;
}

function buildDescription({ note, terminalCode, clientEventId }) {
  return [
    trimText(note),
    `terminalCode:${terminalCode}`,
    idempotencyMarker(clientEventId),
  ].filter(Boolean).join(' | ').slice(0, 500);
}

function normalizeSubmitPayload(payload = {}) {
  const clientEventId = trimText(payload.clientEventId);
  const terminalCode = trimText(payload.terminalCode);
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (!clientEventId) {
    throw serviceError('TERMINAL_CLIENT_EVENT_ID_REQUIRED', 'clientEventId is required');
  }

  if (!terminalCode) {
    throw serviceError('TERMINAL_CODE_REQUIRED', 'terminalCode is required');
  }

  if (!payload.customerId) {
    throw serviceError('TERMINAL_CUSTOMER_REQUIRED', 'customerId is required');
  }

  if (items.length < 1) {
    throw serviceError('TERMINAL_ITEMS_REQUIRED', 'items cannot be empty');
  }

  return {
    clientEventId,
    terminalCode,
    customerId: Number(payload.customerId),
    documentNumber: trimText(payload.documentNumber),
    documentCurrency: trimText(payload.documentCurrency).toUpperCase(),
    exchangeRate: numberValue(payload.exchangeRate ?? 1, 'exchangeRate', { min: 0, allowZero: false }),
    note: trimText(payload.note),
    items: items.map((item, index) => ({
      productId: Number(item.productId),
      barcode: trimText(item.barcode),
      quantity: numberValue(item.quantity, `items[${index}].quantity`, { min: 0, allowZero: false }),
      unitPrice: numberValue(item.unitPrice, `items[${index}].unitPrice`),
      currency: trimText(item.currency).toUpperCase(),
    })),
  };
}

async function findExistingTerminalSale(clientEventId) {
  const pool = await getSqlPool();
  const marker = idempotencyMarker(clientEventId);
  const result = await pool.request()
    .input('marker', sql.NVarChar(160), `%${marker}%`)
    .query(`
      SELECT TOP (1)
        si.id,
        si.document_no AS documentNumber,
        si.status,
        si.grand_total AS grandTotal,
        si.amount_try AS amountTry,
        si.updated_at AS updatedAt
      FROM dbo.sales_invoices si
      WHERE si.description LIKE @marker
      ORDER BY si.id DESC;
    `);

  return result.recordset?.[0] || null;
}

async function getActiveCustomer(customerId) {
  const pool = await getSqlPool();
  const result = await pool.request()
    .input('customerId', sql.BigInt, customerId)
    .query(`
      SELECT TOP (1)
        id,
        name AS customerName,
        currency_code AS currency,
        is_active AS isActive,
        is_deleted AS isDeleted
      FROM dbo.customers
      WHERE id = @customerId;
    `);

  const customer = result.recordset?.[0];
  if (!customer || customer.isDeleted) {
    throw serviceError('TERMINAL_CUSTOMER_NOT_FOUND', 'Customer not found', 404);
  }

  if (!customer.isActive) {
    throw serviceError('TERMINAL_CUSTOMER_PASSIVE', 'Passive customer cannot be used for terminal sale', 409);
  }

  return customer;
}

async function getActiveProducts(items) {
  const ids = [...new Set(items.map((item) => item.productId))];
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) {
    throw serviceError('TERMINAL_PRODUCT_REQUIRED', 'productId is required');
  }

  const pool = await getSqlPool();
  const request = pool.request();
  const placeholders = ids.map((id, index) => {
    request.input(`productId${index}`, sql.BigInt, id);
    return `@productId${index}`;
  });

  const result = await request.query(`
    SELECT
      p.id,
      p.stock_code AS stockCode,
      p.name AS productName,
      p.currency_code AS currency,
      p.sales_price AS salePrice,
      p.average_cost_try AS averageCostTry,
      p.current_stock_qty AS stockQuantity,
      p.is_active AS isActive,
      p.is_deleted AS isDeleted,
      pb.barcode
    FROM dbo.products p
    OUTER APPLY (
      SELECT TOP (1) b.barcode
      FROM dbo.product_barcodes b
      WHERE b.product_id = p.id
        AND b.is_active = 1
      ORDER BY b.is_primary DESC, b.id ASC
    ) pb
    WHERE p.id IN (${placeholders.join(', ')});
  `);

  const productsById = new Map((result.recordset || []).map((product) => [Number(product.id), product]));

  for (const id of ids) {
    const product = productsById.get(id);

    if (!product || product.isDeleted) {
      throw serviceError('TERMINAL_PRODUCT_NOT_FOUND', `Product not found: ${id}`, 404);
    }

    if (!product.isActive) {
      throw serviceError('TERMINAL_PRODUCT_PASSIVE', `Passive product cannot be sold: ${id}`, 409);
    }
  }

  return productsById;
}

async function writeTerminalSubmitAudit(invoice, payload, actor) {
  const pool = await getSqlPool();
  await writeAuditLog(pool.request(), {
    action: 'terminal_sales_submitted',
    entityType: 'sales_invoice',
    entityId: invoice.id,
    actor,
    afterSnapshot: {
      clientEventId: payload.clientEventId,
      terminalCode: payload.terminalCode,
      invoiceId: invoice.id,
      documentNumber: invoice.documentNo || invoice.documentNumber,
      status: invoice.status,
      itemCount: invoice.items?.length || 0,
      note: payload.note || null,
    },
  });
}

function toSubmitResponse(invoice, { duplicate = false } = {}) {
  return {
    ok: true,
    duplicate,
    invoiceId: invoice.id,
    documentNumber: invoice.documentNo || invoice.documentNumber,
    status: String(invoice.status || '').toLowerCase(),
    stockEffects: (invoice.items || []).map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity || 0),
      effect: -Number(item.quantity || 0),
    })),
    customerEffect: {
      customerId: invoice.customerId,
      amount: Number(invoice.grandTotal || 0),
      currency: invoice.documentCurrency,
    },
  };
}

export async function submitTerminalSale(payload = {}, actor = null) {
  const normalized = normalizeSubmitPayload(payload);
  const existing = await findExistingTerminalSale(normalized.clientEventId);

  if (existing) {
    if (String(existing.status).toLowerCase() === 'finalized') {
      const invoice = await getSalesDraft(existing.id);
      return toSubmitResponse(invoice, { duplicate: true });
    }

    throw serviceError(
      'TERMINAL_SALE_DUPLICATE_INCOMPLETE',
      'A terminal sale with this clientEventId already exists but is not finalized',
      409,
    );
  }

  const customer = await getActiveCustomer(normalized.customerId);
  const productsById = await getActiveProducts(normalized.items);
  const documentCurrency = normalized.documentCurrency || customer.currency || 'TRY';
  const description = buildDescription(normalized);

  const draftPayload = {
    documentNo: normalized.documentNumber,
    documentDate: new Date().toISOString().slice(0, 10),
    customerId: normalized.customerId,
    customerCurrency: customer.currency || documentCurrency,
    documentCurrency,
    exchangeRate: normalized.exchangeRate,
    description,
    discountRate: 0,
    items: normalized.items.map((item) => {
      const product = productsById.get(item.productId);
      return {
        productId: item.productId,
        stockCode: product.stockCode,
        barcode: item.barcode || product.barcode || '',
        productName: product.productName,
        quantity: item.quantity,
        currency: item.currency || documentCurrency,
        unitPrice: item.unitPrice,
        averageCostTry: Number(product.averageCostTry || 0),
        stockStatus: `Terminal ${normalized.terminalCode}`,
        note: `terminal barcode:${item.barcode || product.barcode || '-'}`,
      };
    }),
  };

  const draft = await createSalesDraft(draftPayload, actor);

  try {
    const finalized = await finalizeSalesInvoice(draft.id, actor);
    await writeTerminalSubmitAudit(finalized, normalized, actor);
    return toSubmitResponse(finalized);
  } catch (error) {
    error.code = error.code || 'TERMINAL_SALE_FINALIZE_FAILED';
    throw error;
  }
}

export async function searchTerminalProducts(query = {}) {
  return getProductsList({
    page: query.page || 1,
    limit: query.limit || 30,
    search: query.q || query.search || '',
    activeOnly: 'true',
  });
}

export async function searchTerminalCustomers(query = {}) {
  return getCustomersList({
    page: query.page || 1,
    limit: query.limit || 30,
    search: query.q || query.search || '',
    activeOnly: 'true',
  });
}

export async function getTerminalProductByBarcode(barcode) {
  const normalizedBarcode = trimText(barcode);

  if (!normalizedBarcode) {
    throw serviceError('TERMINAL_BARCODE_REQUIRED', 'Barcode is required');
  }

  const pool = await getSqlPool();
  const result = await pool.request()
    .input('barcode', sql.NVarChar(120), normalizedBarcode)
    .query(`
      SELECT TOP (1)
        p.id,
        p.stock_code AS stockCode,
        pb.barcode AS barcode,
        p.name AS productName,
        p.brand,
        p.category,
        p.currency_code AS currency,
        p.sales_price AS salePrice,
        p.current_stock_qty AS stockQuantity,
        pi.file_path AS imageUrl,
        p.is_active AS isActive
      FROM dbo.product_barcodes pb
      INNER JOIN dbo.products p ON p.id = pb.product_id
      OUTER APPLY (
        SELECT TOP (1) image.file_path
        FROM dbo.product_images image
        WHERE image.product_id = p.id
          AND image.is_active = 1
        ORDER BY image.is_primary DESC, image.sort_order ASC, image.id ASC
      ) pi
      WHERE pb.barcode = @barcode
        AND pb.is_active = 1
        AND p.is_deleted = 0
      ORDER BY pb.is_primary DESC, pb.id ASC;
    `);

  const product = result.recordset?.[0];
  if (!product) {
    throw serviceError('TERMINAL_PRODUCT_NOT_FOUND', 'Product barcode not found', 404);
  }

  if (!product.isActive) {
    throw serviceError('TERMINAL_PRODUCT_PASSIVE', 'Passive product cannot be sold', 409);
  }

  return {
    id: product.id,
    stockCode: product.stockCode,
    barcode: product.barcode,
    productName: product.productName,
    brand: product.brand,
    category: product.category,
    currency: product.currency,
    salePrice: Number(product.salePrice || 0),
    stockQuantity: Number(product.stockQuantity || 0),
    imageUrl: product.imageUrl || null,
    isPassive: false,
  };
}
