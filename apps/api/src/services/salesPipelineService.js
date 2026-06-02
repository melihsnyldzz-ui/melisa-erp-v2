import sql from 'mssql';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { createSalesDraft, getSalesDraft } from './invoiceDraftService.js';
import { buildListMeta, parseListQuery } from './queryHelpers.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';

const DOCUMENTS = {
  offer: {
    table: 'sales_offers',
    itemTable: 'sales_offer_items',
    itemFk: 'sales_offer_id',
    idField: 'offerId',
    noField: 'offerNo',
    prefix: 'TEK',
    sourceField: 'valid_until',
    sourceInput: 'validUntil',
    statuses: new Set(['draft', 'sent', 'accepted', 'cancelled']),
    auditEntity: 'sales_offer',
  },
  order: {
    table: 'sales_orders',
    itemTable: 'sales_order_items',
    itemFk: 'sales_order_id',
    idField: 'orderId',
    noField: 'orderNo',
    prefix: 'SIP',
    sourceField: 'delivery_note',
    sourceInput: 'deliveryNote',
    statuses: new Set(['draft', 'confirmed', 'fulfilled', 'cancelled']),
    auditEntity: 'sales_order',
  },
};

function makeServiceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCurrency(value) {
  const currency = trimText(value || 'TRY').toUpperCase();
  return ['TRY', 'USD', 'EUR'].includes(currency) ? currency : 'TRY';
}

function normalizeDate(value) {
  return trimText(value) || new Date().toISOString().slice(0, 10);
}

function numberValue(value, fieldName, { min = 0, allowZero = true } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || (!allowZero && number === 0)) {
    throw makeServiceError('SALES_PIPELINE_VALIDATION_FAILED', `${fieldName} is invalid`);
  }
  return number;
}

function createDocumentNo(prefix) {
  const now = new Date();
  const stamp = [
    String(now.getUTCFullYear()).slice(-2),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0'),
  ].join('');

  return `${prefix}-${stamp}`;
}

function createConversionMarker(kind, id) {
  return `${kind}:${id}`;
}

function getConfig(kind) {
  const config = DOCUMENTS[kind];
  if (!config) {
    throw makeServiceError('SALES_PIPELINE_KIND_INVALID', 'Document kind is invalid');
  }
  return config;
}

function parsePipelineQuery(query = {}) {
  const options = parseListQuery(query);
  const status = trimText(query.status).toLowerCase();
  const dateFrom = trimText(query.dateFrom);
  const dateTo = trimText(query.dateTo);
  const customer = trimText(query.customer);

  return {
    ...options,
    status: status && status !== 'all' ? status : '',
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    customer,
  };
}

function toListDto(row, config) {
  return {
    id: row.id,
    [config.noField]: row.document_no,
    documentNo: row.document_no,
    documentDate: row.document_date,
    customerId: row.customer_id,
    customerName: row.customer_name || '-',
    status: String(row.status || '').toUpperCase(),
    customerCurrency: row.customer_currency,
    documentCurrency: row.document_currency,
    exchangeRate: Number(row.exchange_rate_snapshot || 1),
    subtotal: Number(row.subtotal || 0),
    discountRate: Number(row.discount_rate || 0),
    discountTotal: Number(row.discount_total || 0),
    grandTotal: Number(row.grand_total || 0),
    amountTry: Number(row.amount_try || 0),
    itemCount: Number(row.item_count || 0),
    validUntil: row.valid_until || null,
    deliveryNote: row.delivery_note || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toItemDto(row) {
  return {
    id: row.id,
    productId: row.product_id,
    stockCode: row.stock_code_snapshot,
    barcode: row.barcode_snapshot || '',
    productName: row.product_name_snapshot,
    quantity: Number(row.quantity || 0),
    currency: row.currency_code,
    unitPrice: Number(row.unit_price || 0),
    lineTotal: Number(row.line_total || 0),
    note: row.note || '',
  };
}

async function ensureCustomer(request, customerId) {
  const result = await request
    .input('customerId', sql.BigInt, customerId)
    .query(`
      SELECT TOP 1 id, name, currency_code
      FROM dbo.customers
      WHERE id = @customerId AND is_deleted = 0;
    `);

  const customer = result.recordset[0];
  if (!customer) {
    throw makeServiceError('CUSTOMER_NOT_FOUND', 'Customer not found', 404);
  }
  return customer;
}

async function ensureProduct(request, productId) {
  const result = await request
    .input('productId', sql.BigInt, productId)
    .query(`
      SELECT TOP 1 p.id, p.stock_code, p.name, p.currency_code, p.sales_price,
        primaryBarcode.barcode AS primary_barcode
      FROM dbo.products p
      OUTER APPLY (
        SELECT TOP 1 pb.barcode
        FROM dbo.product_barcodes pb
        WHERE pb.product_id = p.id AND pb.is_active = 1
        ORDER BY pb.is_primary DESC, pb.id ASC
      ) primaryBarcode
      WHERE p.id = @productId AND p.is_deleted = 0;
    `);

  const product = result.recordset[0];
  if (!product) {
    throw makeServiceError('PRODUCT_NOT_FOUND', 'Product not found', 404);
  }
  return product;
}

function normalizePayload(payload = {}, config) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const discountRate = numberValue(payload.discountRate ?? 0, 'discountRate');
  const exchangeRate = numberValue(payload.exchangeRate ?? 1, 'exchangeRate', { min: 0, allowZero: false });
  const normalizedItems = items.map((item, index) => {
    const quantity = numberValue(item.quantity, `items[${index}].quantity`, { min: 0, allowZero: false });
    const unitPrice = numberValue(item.unitPrice, `items[${index}].unitPrice`);

    if (!item.productId) {
      throw makeServiceError('SALES_PIPELINE_VALIDATION_FAILED', `items[${index}].productId is required`);
    }

    return {
      productId: Number(item.productId),
      stockCode: trimText(item.stockCode),
      barcode: trimText(item.barcode),
      productName: trimText(item.productName),
      quantity,
      currency: normalizeCurrency(item.currency || payload.documentCurrency),
      unitPrice,
      lineTotal: quantity * unitPrice,
      note: trimText(item.note).slice(0, 250),
    };
  });

  if (!payload.customerId) {
    throw makeServiceError('SALES_PIPELINE_VALIDATION_FAILED', 'customerId is required');
  }

  if (normalizedItems.length < 1) {
    throw makeServiceError('SALES_PIPELINE_VALIDATION_FAILED', 'At least one product line is required');
  }

  const subtotal = normalizedItems.reduce((total, item) => total + item.lineTotal, 0);
  const discountTotal = subtotal * (discountRate / 100);
  const grandTotal = subtotal - discountTotal;

  if (grandTotal < 0) {
    throw makeServiceError('SALES_PIPELINE_VALIDATION_FAILED', 'grandTotal cannot be negative');
  }

  return {
    documentNo: trimText(payload.documentNo) || createDocumentNo(config.prefix),
    documentDate: normalizeDate(payload.documentDate),
    customerId: Number(payload.customerId),
    customerCurrency: normalizeCurrency(payload.customerCurrency),
    documentCurrency: normalizeCurrency(payload.documentCurrency),
    exchangeRate,
    description: trimText(payload.description).slice(0, 500),
    discountRate,
    subtotal,
    discountTotal,
    grandTotal,
    amountTry: grandTotal * exchangeRate,
    validUntil: trimText(payload.validUntil) || null,
    deliveryNote: trimText(payload.deliveryNote).slice(0, 500) || null,
    sourceOfferId: payload.sourceOfferId ? Number(payload.sourceOfferId) : null,
    items: normalizedItems,
  };
}

async function insertItems(sqlDriver, transaction, config, documentId, payloadItems) {
  for (const payloadItem of payloadItems) {
    const product = await ensureProduct(new sqlDriver.Request(transaction), payloadItem.productId);
    await new sqlDriver.Request(transaction)
      .input('documentId', sql.BigInt, documentId)
      .input('productId', sql.BigInt, product.id)
      .input('stockCode', sql.NVarChar(50), payloadItem.stockCode || product.stock_code)
      .input('barcode', sql.NVarChar(80), payloadItem.barcode || product.primary_barcode || null)
      .input('productName', sql.NVarChar(250), payloadItem.productName || product.name)
      .input('quantity', sql.Decimal(18, 3), payloadItem.quantity)
      .input('currency', sql.NVarChar(3), payloadItem.currency || product.currency_code || 'TRY')
      .input('unitPrice', sql.Decimal(18, 4), payloadItem.unitPrice)
      .input('lineTotal', sql.Decimal(18, 4), payloadItem.lineTotal)
      .input('note', sql.NVarChar(250), payloadItem.note || null)
      .query(`
        INSERT INTO dbo.${config.itemTable} (
          ${config.itemFk},
          product_id,
          stock_code_snapshot,
          barcode_snapshot,
          product_name_snapshot,
          quantity,
          currency_code,
          unit_price,
          line_total,
          note
        )
        VALUES (
          @documentId,
          @productId,
          @stockCode,
          @barcode,
          @productName,
          @quantity,
          @currency,
          @unitPrice,
          @lineTotal,
          @note
        );
      `);
  }
}

export async function listPipelineDocuments(kind, query = {}) {
  const config = getConfig(kind);
  const options = parsePipelineQuery(query);
  const sourceSelect = kind === 'order'
    ? 'd.source_offer_id, CAST(NULL AS DATE) AS valid_until, d.delivery_note'
    : 'CAST(NULL AS BIGINT) AS source_offer_id, d.valid_until, CAST(NULL AS NVARCHAR(500)) AS delivery_note';
  const sourceGroup = kind === 'order'
    ? 'd.source_offer_id, d.delivery_note'
    : 'd.valid_until';
  const pool = await getSqlPool();
  const request = pool.request()
    .input('offset', sql.Int, options.offset)
    .input('limit', sql.Int, options.limit)
    .input('search', sql.NVarChar(120), `%${options.search}%`)
    .input('customer', sql.NVarChar(120), `%${options.customer}%`)
    .input('status', sql.NVarChar(20), options.status)
    .input('dateFrom', sql.Date, options.dateFrom)
    .input('dateTo', sql.Date, options.dateTo);

  const result = await request.query(`
    WITH filtered AS (
      SELECT d.id, d.document_no, d.document_date, d.customer_id, ${sourceSelect}, d.status,
        d.customer_currency, d.document_currency, d.exchange_rate_snapshot, d.description, d.subtotal,
        d.discount_rate, d.discount_total, d.grand_total, d.amount_try, d.created_at, d.created_by,
        d.updated_at, d.updated_by, c.name AS customer_name, COUNT(i.id) AS item_count
      FROM dbo.${config.table} d
      INNER JOIN dbo.customers c ON c.id = d.customer_id
      LEFT JOIN dbo.${config.itemTable} i ON i.${config.itemFk} = d.id
      WHERE (@status = N'' OR d.status = @status)
        AND (@dateFrom IS NULL OR d.document_date >= @dateFrom)
        AND (@dateTo IS NULL OR d.document_date <= @dateTo)
        AND (@customer = N'%%' OR c.name LIKE @customer OR c.customer_code LIKE @customer)
        AND (
          @search = N'%%'
          OR d.document_no LIKE @search
          OR c.name LIKE @search
          OR c.customer_code LIKE @search
        )
      GROUP BY d.id, d.document_no, d.document_date, d.customer_id, ${sourceGroup}, d.status,
        d.customer_currency, d.document_currency, d.exchange_rate_snapshot, d.description, d.subtotal,
        d.discount_rate, d.discount_total, d.grand_total, d.amount_try, d.created_at, d.created_by,
        d.updated_at, d.updated_by, c.name
    )
    SELECT *, COUNT(*) OVER() AS total_count
    FROM filtered
    ORDER BY document_date DESC, id DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
  `);

  const rows = result.recordset.map((row) => toListDto(row, config));
  const total = Number(result.recordset[0]?.total_count || 0);

  return {
    data: rows,
    meta: buildListMeta({
      page: options.page,
      limit: options.limit,
      offset: options.offset,
      total,
      source: `sql-${config.table}`,
      filters: {
        search: options.search,
        customer: options.customer,
        status: options.status || 'all',
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
      },
    }),
  };
}

export async function getPipelineDocument(kind, id) {
  const config = getConfig(kind);
  const pool = await getSqlPool();

  const header = await pool.request()
    .input('id', sql.BigInt, id)
    .query(`
      SELECT d.*, c.name AS customer_name, c.customer_code, c.currency_code AS card_currency
      FROM dbo.${config.table} d
      INNER JOIN dbo.customers c ON c.id = d.customer_id
      WHERE d.id = @id;
    `);

  const row = header.recordset[0];
  if (!row) {
    throw makeServiceError('SALES_PIPELINE_NOT_FOUND', 'Document not found', 404);
  }

  const items = await pool.request()
    .input('id', sql.BigInt, id)
    .query(`
      SELECT *
      FROM dbo.${config.itemTable}
      WHERE ${config.itemFk} = @id
      ORDER BY id ASC;
    `);

  return {
    ...toListDto(row, config),
    customerCode: row.customer_code,
    cardCurrency: row.card_currency,
    description: row.description || '',
    items: items.recordset.map(toItemDto),
  };
}

export async function createPipelineDocument(kind, payload, actor) {
  assertMelisaWriteEnabled();
  const config = getConfig(kind);
  const draft = normalizePayload(payload, config);
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();
  try {
    const customer = await ensureCustomer(new sqlDriver.Request(transaction), draft.customerId);
    draft.customerCurrency = draft.customerCurrency || normalizeCurrency(customer.currency_code);

    const insert = await new sqlDriver.Request(transaction)
      .input('documentNo', sql.NVarChar(30), draft.documentNo)
      .input('documentDate', sql.Date, draft.documentDate)
      .input('customerId', sql.BigInt, draft.customerId)
      .input('sourceOfferId', sql.BigInt, draft.sourceOfferId)
      .input('customerCurrency', sql.NVarChar(3), draft.customerCurrency || normalizeCurrency(customer.currency_code))
      .input('documentCurrency', sql.NVarChar(3), draft.documentCurrency)
      .input('exchangeRate', sql.Decimal(18, 8), draft.exchangeRate)
      .input('description', sql.NVarChar(500), draft.description || null)
      .input('subtotal', sql.Decimal(18, 4), draft.subtotal)
      .input('discountRate', sql.Decimal(9, 4), draft.discountRate)
      .input('discountTotal', sql.Decimal(18, 4), draft.discountTotal)
      .input('grandTotal', sql.Decimal(18, 4), draft.grandTotal)
      .input('amountTry', sql.Decimal(18, 4), draft.amountTry)
      .input('validUntil', sql.Date, draft.validUntil)
      .input('deliveryNote', sql.NVarChar(500), draft.deliveryNote)
      .input('actorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        INSERT INTO dbo.${config.table} (
          document_no,
          document_date,
          customer_id,
          ${kind === 'order' ? 'source_offer_id,' : ''}
          customer_currency,
          document_currency,
          exchange_rate_snapshot,
          description,
          subtotal,
          discount_rate,
          discount_total,
          grand_total,
          amount_try,
          ${config.sourceField},
          created_by
        )
        OUTPUT INSERTED.id
        VALUES (
          @documentNo,
          @documentDate,
          @customerId,
          ${kind === 'order' ? '@sourceOfferId,' : ''}
          @customerCurrency,
          @documentCurrency,
          @exchangeRate,
          @description,
          @subtotal,
          @discountRate,
          @discountTotal,
          @grandTotal,
          @amountTry,
          @${config.sourceInput},
          @actorId
        );
      `);

    const documentId = insert.recordset[0].id;
    await insertItems(sqlDriver, transaction, config, documentId, draft.items);
    const afterSnapshot = await getPipelineDocumentFromRequest(new sqlDriver.Request(transaction), kind, documentId);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: `${config.auditEntity}_created`,
      entityType: config.auditEntity,
      entityId: documentId,
      afterSnapshot,
      actor,
    });

    await transaction.commit();
    return afterSnapshot;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function getPipelineDocumentFromRequest(request, kind, id) {
  const config = getConfig(kind);
  const header = await request
    .input('snapshotId', sql.BigInt, id)
    .query(`
      SELECT d.*, c.name AS customer_name, c.customer_code, c.currency_code AS card_currency
      FROM dbo.${config.table} d
      INNER JOIN dbo.customers c ON c.id = d.customer_id
      WHERE d.id = @snapshotId;
    `);

  const row = header.recordset[0];
  if (!row) {
    throw makeServiceError('SALES_PIPELINE_NOT_FOUND', 'Document not found', 404);
  }

  const items = await request
    .input('snapshotItemId', sql.BigInt, id)
    .query(`
      SELECT *
      FROM dbo.${config.itemTable}
      WHERE ${config.itemFk} = @snapshotItemId
      ORDER BY id ASC;
    `);

  return {
    ...toListDto(row, config),
    customerCode: row.customer_code,
    cardCurrency: row.card_currency,
    description: row.description || '',
    items: items.recordset.map(toItemDto),
  };
}

export async function updatePipelineDocument(kind, id, payload, actor) {
  assertMelisaWriteEnabled();
  const config = getConfig(kind);
  const draft = normalizePayload(payload, config);
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();
  try {
    const beforeSnapshot = await getPipelineDocumentFromRequest(new sqlDriver.Request(transaction), kind, id);
    if (beforeSnapshot.status === 'CANCELLED') {
      throw makeServiceError('SALES_PIPELINE_CANCELLED', 'Cancelled documents cannot be edited', 409);
    }

    const customer = await ensureCustomer(new sqlDriver.Request(transaction), draft.customerId);

    await new sqlDriver.Request(transaction)
      .input('id', sql.BigInt, id)
      .input('documentNo', sql.NVarChar(30), draft.documentNo)
      .input('documentDate', sql.Date, draft.documentDate)
      .input('customerId', sql.BigInt, draft.customerId)
      .input('sourceOfferId', sql.BigInt, draft.sourceOfferId)
      .input('customerCurrency', sql.NVarChar(3), draft.customerCurrency || normalizeCurrency(customer.currency_code))
      .input('documentCurrency', sql.NVarChar(3), draft.documentCurrency)
      .input('exchangeRate', sql.Decimal(18, 8), draft.exchangeRate)
      .input('description', sql.NVarChar(500), draft.description || null)
      .input('subtotal', sql.Decimal(18, 4), draft.subtotal)
      .input('discountRate', sql.Decimal(9, 4), draft.discountRate)
      .input('discountTotal', sql.Decimal(18, 4), draft.discountTotal)
      .input('grandTotal', sql.Decimal(18, 4), draft.grandTotal)
      .input('amountTry', sql.Decimal(18, 4), draft.amountTry)
      .input('validUntil', sql.Date, draft.validUntil)
      .input('deliveryNote', sql.NVarChar(500), draft.deliveryNote)
      .input('actorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        UPDATE dbo.${config.table}
        SET document_no = @documentNo,
            document_date = @documentDate,
            customer_id = @customerId,
            ${kind === 'order' ? 'source_offer_id = @sourceOfferId,' : ''}
            customer_currency = @customerCurrency,
            document_currency = @documentCurrency,
            exchange_rate_snapshot = @exchangeRate,
            description = @description,
            subtotal = @subtotal,
            discount_rate = @discountRate,
            discount_total = @discountTotal,
            grand_total = @grandTotal,
            amount_try = @amountTry,
            ${config.sourceField} = @${config.sourceInput},
            updated_at = SYSUTCDATETIME(),
            updated_by = @actorId
        WHERE id = @id;
      `);

    await new sqlDriver.Request(transaction)
      .input('id', sql.BigInt, id)
      .query(`DELETE FROM dbo.${config.itemTable} WHERE ${config.itemFk} = @id;`);
    await insertItems(sqlDriver, transaction, config, id, draft.items);

    const afterSnapshot = await getPipelineDocumentFromRequest(new sqlDriver.Request(transaction), kind, id);
    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: `${config.auditEntity}_updated`,
      entityType: config.auditEntity,
      entityId: Number(id),
      beforeSnapshot,
      afterSnapshot,
      actor,
    });

    await transaction.commit();
    return afterSnapshot;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function changePipelineStatus(kind, id, status, actor) {
  assertMelisaWriteEnabled();
  const config = getConfig(kind);
  const normalizedStatus = trimText(status).toLowerCase();

  if (!config.statuses.has(normalizedStatus)) {
    throw makeServiceError('SALES_PIPELINE_STATUS_INVALID', 'Status is invalid');
  }

  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();
  try {
    const beforeSnapshot = await getPipelineDocumentFromRequest(new sqlDriver.Request(transaction), kind, id);
    await new sqlDriver.Request(transaction)
      .input('id', sql.BigInt, id)
      .input('status', sql.NVarChar(20), normalizedStatus)
      .input('actorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        UPDATE dbo.${config.table}
        SET status = @status,
            updated_at = SYSUTCDATETIME(),
            updated_by = @actorId
        WHERE id = @id;
      `);

    const afterSnapshot = await getPipelineDocumentFromRequest(new sqlDriver.Request(transaction), kind, id);
    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: `${config.auditEntity}_status_changed`,
      entityType: config.auditEntity,
      entityId: Number(id),
      beforeSnapshot,
      afterSnapshot,
      actor,
    });

    await transaction.commit();
    return afterSnapshot;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

function pipelineToPayload(document, overrides = {}) {
  return {
    customerId: document.customerId,
    customerCurrency: document.customerCurrency,
    documentCurrency: document.documentCurrency,
    exchangeRate: document.exchangeRate,
    discountRate: document.discountRate,
    description: overrides.description || document.description || '',
    validUntil: document.validUntil || null,
    deliveryNote: document.deliveryNote || null,
    sourceOfferId: overrides.sourceOfferId || null,
    items: (document.items || []).map((item) => ({
      productId: item.productId,
      stockCode: item.stockCode,
      barcode: item.barcode,
      productName: item.productName,
      quantity: item.quantity,
      currency: item.currency || document.documentCurrency,
      unitPrice: item.unitPrice,
      note: item.note || '',
    })),
  };
}

async function findExistingOrderFromOffer(pool, offerId) {
  const result = await pool.request()
    .input('offerId', sql.BigInt, offerId)
    .query(`
      SELECT TOP 1 id
      FROM dbo.sales_orders
      WHERE source_offer_id = @offerId
      ORDER BY id DESC;
    `);

  return result.recordset[0]?.id || null;
}

async function findExistingSalesDraftFromOrder(pool, orderId) {
  const marker = `%${createConversionMarker('salesOrder', orderId)}%`;
  const result = await pool.request()
    .input('marker', sql.NVarChar(120), marker)
    .query(`
      SELECT TOP 1 id
      FROM dbo.sales_invoices
      WHERE description LIKE @marker
        AND status <> N'cancelled'
      ORDER BY id DESC;
    `);

  return result.recordset[0]?.id || null;
}

export async function convertOfferToOrder(offerId, actor = null) {
  assertMelisaWriteEnabled();

  const id = Number(offerId);
  if (!Number.isInteger(id) || id < 1) {
    throw makeServiceError('SALES_OFFER_ID_INVALID', 'Offer id is invalid');
  }

  const pool = await getSqlPool();
  const existingOrderId = await findExistingOrderFromOffer(pool, id);
  if (existingOrderId) {
    return {
      duplicate: true,
      order: await getPipelineDocument('order', existingOrderId),
    };
  }

  const offer = await getPipelineDocument('offer', id);
  if (offer.status === 'CANCELLED') {
    throw makeServiceError('SALES_OFFER_CANCELLED', 'Cancelled offer cannot be converted', 409);
  }

  const order = await createPipelineDocument('order', pipelineToPayload(offer, {
    sourceOfferId: id,
    description: `${offer.description || ''} ${createConversionMarker('salesOffer', id)}`.trim(),
  }), actor);

  await changePipelineStatus('offer', id, 'accepted', actor);
  await changePipelineStatus('order', order.id, 'confirmed', actor);

  return {
    duplicate: false,
    order: await getPipelineDocument('order', order.id),
  };
}

export async function convertOrderToSalesDraft(orderId, actor = null) {
  assertMelisaWriteEnabled();

  const id = Number(orderId);
  if (!Number.isInteger(id) || id < 1) {
    throw makeServiceError('SALES_ORDER_ID_INVALID', 'Order id is invalid');
  }

  const pool = await getSqlPool();
  const existingDraftId = await findExistingSalesDraftFromOrder(pool, id);
  if (existingDraftId) {
    return {
      duplicate: true,
      salesDraft: await getSalesDraft(existingDraftId),
    };
  }

  const order = await getPipelineDocument('order', id);
  if (order.status === 'CANCELLED') {
    throw makeServiceError('SALES_ORDER_CANCELLED', 'Cancelled order cannot be converted', 409);
  }

  const salesDraft = await createSalesDraft({
    customerId: order.customerId,
    customerCurrency: order.customerCurrency,
    documentCurrency: order.documentCurrency,
    exchangeRate: order.exchangeRate,
    discountRate: order.discountRate,
    description: `${order.description || ''} ${createConversionMarker('salesOrder', id)}`.trim(),
    items: (order.items || []).map((item) => ({
      productId: item.productId,
      stockCode: item.stockCode,
      barcode: item.barcode,
      productName: item.productName,
      quantity: item.quantity,
      currency: item.currency || order.documentCurrency,
      unitPrice: item.unitPrice,
      note: item.note || '',
    })),
  }, actor);

  await changePipelineStatus('order', id, 'fulfilled', actor);

  return {
    duplicate: false,
    salesDraft,
  };
}
