import {
  acquireTerminalSaleIdempotencyLock,
  assertNoLegacyTerminalSale,
  assertTerminalSaleIdempotencySchema,
  assertTerminalSaleLedgerReplay,
  assertTerminalSaleReplayInvoice,
  buildTerminalSaleDescription,
  createTerminalSaleRequestFingerprint,
  findLegacyTerminalSale,
  insertTerminalSaleLedger,
  markTerminalSaleLedgerSynced,
  normalizeTerminalClientEventId,
  readTerminalSaleLedger,
} from './terminalSaleIdempotency.js';
import { runTerminalSaleSubmissionTransaction } from './terminalSaleSubmissionTransaction.js';
import sql from 'mssql';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';
import { createSalesDraft, finalizeSalesInvoice, getSalesDraft, prepareSalesInvoiceFinalization } from './invoiceDraftService.js';
import { getCustomersList } from './customerService.js';
import { getVegaProductsListFromWorker } from './vegaProductClientService.js';
import { getVegaProductImageMap } from './vegaProductImageService.js';



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





function normalizeSubmitPayload(payload = {}) {
  const clientEventId = normalizeTerminalClientEventId(payload.clientEventId);
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

  const vegaItem = items.find((item) => (
    trimText(item.productSource).toLowerCase() === 'vega'
    || trimText(item.productId).toLowerCase().startsWith('vega-')
  ));
  if (vegaItem) {
    throw serviceError(
      'TERMINAL_VEGA_SALE_WRITE_DISABLED',
      'Vega paralel kullanimdayken yeni terminalden satis kaydi kapali. Satisi mevcut Vega terminalinden tamamlayin.',
      409,
    );
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



async function getActiveCustomer(customerId, transactionContext = null) {
  const request = await createDatabaseRequest(transactionContext);
  const result = await request
    .input('customerId', sql.BigInt, customerId)
    .query(`
      SELECT TOP (1)
        id,
        name AS customerName,
        currency_code AS currency,
        is_active AS isActive,
        is_deleted AS isDeleted
      FROM dbo.customers WITH (UPDLOCK, HOLDLOCK)
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

async function getTerminalOperatorContext(terminalCode, actorUserId, transactionContext = null) {
  const userId = Number(actorUserId);
  if (!Number.isInteger(userId) || userId < 1) {
    throw serviceError('TERMINAL_OPERATOR_REQUIRED', 'Authenticated terminal personnel is required', 401);
  }
  const schemaRequest = await createDatabaseRequest(transactionContext);
  const schemaResult = await schemaRequest.query(`
    SELECT
      CASE
      WHEN OBJECT_ID(N'dbo.employees', N'U') IS NOT NULL
       AND COL_LENGTH(N'dbo.employees', N'user_id') IS NOT NULL
       AND COL_LENGTH(N'dbo.sales_invoices', N'employee_id') IS NOT NULL
      THEN 1 ELSE 0
      END AS is_ready,
      CASE
        WHEN COL_LENGTH(N'dbo.employees', N'can_terminal_sale') IS NOT NULL
         AND COL_LENGTH(N'dbo.employees', N'can_change_sale_price') IS NOT NULL
         AND COL_LENGTH(N'dbo.employees', N'max_sale_discount_percent') IS NOT NULL
        THEN 1 ELSE 0
      END AS restrictions_ready;
  `);
  if (!schemaResult.recordset?.[0]?.is_ready) {
    throw serviceError(
      'PERSONNEL_SCHEMA_MISSING',
      'Personnel schema is not installed. Apply migration 0013_personnel_terminal_sales.sql.',
      503,
    );
  }
  const restrictionsReady = Boolean(schemaResult.recordset?.[0]?.restrictions_ready);
  const restrictionColumns = restrictionsReady
    ? `e.can_terminal_sale,
       e.can_change_sale_price,
       e.max_sale_discount_percent`
    : `CAST(1 AS BIT) AS can_terminal_sale,
       CAST(0 AS BIT) AS can_change_sale_price,
       CAST(0 AS DECIMAL(5,2)) AS max_sale_discount_percent`;

  const terminalRequest = await createDatabaseRequest(transactionContext);
  const result = await terminalRequest
    .input('terminalCode', sql.NVarChar(80), terminalCode)
    .input('operatorUserId', sql.BigInt, userId)
    .query(`
      SELECT TOP (1)
        d.id AS terminal_device_id,
        d.device_code,
        d.device_name,
        d.is_active AS device_is_active,
        e.id AS employee_id,
        e.employee_code,
        e.full_name AS employee_name,
        e.is_active AS employee_is_active,
        ${restrictionColumns}
      FROM dbo.terminal_devices d WITH (UPDLOCK, HOLDLOCK)
      LEFT JOIN dbo.employees e WITH (UPDLOCK, HOLDLOCK) ON e.user_id = @operatorUserId
      WHERE d.device_code = @terminalCode;
    `);

  const terminal = result.recordset?.[0];
  if (!terminal || !terminal.device_is_active) {
    throw serviceError('TERMINAL_DEVICE_NOT_ACTIVE', 'Active terminal device not found', 409);
  }
  if (!terminal.employee_id || !terminal.employee_is_active) {
    throw serviceError(
      'TERMINAL_EMPLOYEE_NOT_ASSIGNED',
      'The logged in user must be linked to an active terminal personnel record',
      409,
    );
  }
  if (!terminal.can_terminal_sale) {
    throw serviceError(
      'TERMINAL_EMPLOYEE_SALE_RESTRICTED',
      'This employee is not allowed to create terminal sales',
      403,
    );
  }

  return {
    terminalDeviceId: Number(terminal.terminal_device_id),
    terminalCode: terminal.device_code,
    terminalName: terminal.device_name,
    employeeId: Number(terminal.employee_id),
    employeeCode: terminal.employee_code,
    employeeName: terminal.employee_name,
    canChangeSalePrice: Boolean(terminal.can_change_sale_price),
    maxSaleDiscountPercent: Number(terminal.max_sale_discount_percent || 0),
  };
}

async function getActiveProducts(items, transactionContext = null) {
  const ids = terminalProductLockIds(items);

  const productsById = new Map();
  for (const id of ids) {
    const request = await createDatabaseRequest(transactionContext);
    const result = await request
      .input('lockedProductId', sql.BigInt, id)
      .query(`
        SELECT TOP (1)
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
        FROM dbo.products p WITH (UPDLOCK, HOLDLOCK)
        OUTER APPLY (
          SELECT TOP (1) b.barcode
          FROM dbo.product_barcodes b
          WHERE b.product_id = p.id
            AND b.is_active = 1
          ORDER BY b.is_primary DESC, b.id ASC
        ) pb
        WHERE p.id = @lockedProductId;
      `);
    const product = result.recordset?.[0];
    if (product) productsById.set(Number(product.id), product);
  }

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

async function getTerminalCurrencyRateMap(transactionContext = null) {
  const request = await createDatabaseRequest(transactionContext);
  const result = await request.query(`
    WITH latest_rates AS (
      SELECT
        currency_code,
        rate_to_try,
        ROW_NUMBER() OVER (PARTITION BY currency_code ORDER BY rate_date DESC, id DESC) AS row_number
      FROM dbo.currency_rates WITH (UPDLOCK, HOLDLOCK)
      WHERE currency_code IN (N'USD', N'EUR')
    )
    SELECT currency_code, rate_to_try
    FROM latest_rates
    WHERE row_number = 1;
  `);

  return new Map([
    ['TRY', 1],
    ...(result.recordset || []).map((row) => [String(row.currency_code || '').toUpperCase(), Number(row.rate_to_try || 0)]),
  ]);
}

export function calculateTerminalReferencePrice({
  listPrice,
  sourceCurrency,
  targetCurrency,
  documentCurrency,
  documentExchangeRate,
  currencyRateMap,
}) {
  const source = trimText(sourceCurrency).toUpperCase() || 'TRY';
  const target = trimText(targetCurrency).toUpperCase() || trimText(documentCurrency).toUpperCase() || source;
  const document = trimText(documentCurrency).toUpperCase() || target;
  const resolveRate = (currency) => {
    if (currency === 'TRY') return 1;
    if (currency === document && Number(documentExchangeRate) > 0) return Number(documentExchangeRate);
    return Number(currencyRateMap?.get(currency) || 0);
  };
  const sourceRate = resolveRate(source);
  const targetRate = resolveRate(target);

  if (sourceRate <= 0 || targetRate <= 0) {
    throw serviceError(
      'TERMINAL_CURRENCY_RATE_REQUIRED',
      `Currency rate is required for ${sourceRate <= 0 ? source : target}`,
      409,
    );
  }

  return Number(listPrice || 0) * sourceRate / targetRate;
}

function assertTerminalSalePricing(items, productsById, terminal, pricingContext) {
  for (const item of items) {
    const product = productsById.get(item.productId);
    const listPrice = calculateTerminalReferencePrice({
      listPrice: product?.salePrice,
      sourceCurrency: product?.currency,
      targetCurrency: item.currency,
      ...pricingContext,
    });
    const enteredPrice = Number(item.unitPrice || 0);
    const changed = Math.abs(enteredPrice - listPrice) > 0.005;

    if (!changed) continue;

    if (!terminal.canChangeSalePrice) {
      throw serviceError(
        'TERMINAL_EMPLOYEE_PRICE_CHANGE_RESTRICTED',
        `Bu personel ${product?.stockCode || item.productId} ürününün satış fiyatını değiştiremez`,
        403,
      );
    }

    const discountPercent = listPrice > 0 && enteredPrice < listPrice
      ? ((listPrice - enteredPrice) / listPrice) * 100
      : 0;
    if (discountPercent - terminal.maxSaleDiscountPercent > 0.0001) {
      throw serviceError(
        'TERMINAL_EMPLOYEE_DISCOUNT_LIMIT_EXCEEDED',
        `Bu personel için izin verilen azami indirim %${terminal.maxSaleDiscountPercent}`,
        403,
      );
    }
  }
}

async function writeTerminalSubmitAudit(
  invoice,
  payload,
  actor,
  { transactionContext = null, requestFingerprint = '', ledgerId = null } = {},
) {
  const request = await createDatabaseRequest(transactionContext);
  await writeAuditLog(request, {
    action: 'terminal_sales_submitted',
    entityType: 'sales_invoice',
    entityId: invoice.id,
    actor,
    afterSnapshot: {
      clientEventId: payload.clientEventId,
      requestFingerprint,
      terminalSyncLedgerId: ledgerId,
      terminalCode: payload.terminalCode,
      terminalDeviceId: invoice.terminalDeviceId,
      employeeId: invoice.employeeId,
      employeeName: invoice.employeeName,
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
    terminal: invoice.terminalDeviceId ? {
      id: Number(invoice.terminalDeviceId),
      code: invoice.terminalCode || '',
      name: invoice.terminalName || '',
    } : null,
    employee: invoice.employeeId ? {
      id: Number(invoice.employeeId),
      code: invoice.employeeCode || '',
      name: invoice.employeeName || '',
    } : null,
  };
}

export async function submitTerminalSale(payload = {}, actor = null) {
  const normalized = normalizeSubmitPayload(payload);
  assertMelisaWriteEnabled();
  const actorUserId = Number(actor?.id);
  const requestFingerprint = createTerminalSaleRequestFingerprint(normalized, actorUserId);
  const pool = await getSqlPool();
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);
  const transactionContext = { pool, sqlDriver, transaction };
  const operations = {
    assertSchema: () => assertTerminalSaleIdempotencySchema(new sqlDriver.Request(transaction)),
    acquireLock: () => acquireTerminalSaleIdempotencyLock(
      new sqlDriver.Request(transaction),
      normalized.clientEventId,
    ),
    readLedger: () => readTerminalSaleLedger(
      new sqlDriver.Request(transaction),
      normalized.clientEventId,
    ),
    replay: async (ledger) => {
      const replay = assertTerminalSaleLedgerReplay(ledger, {
        requestFingerprint,
        actorUserId,
      });
      const existingInvoice = await getSalesDraft(replay.invoiceId, transactionContext);
      assertTerminalSaleReplayInvoice(existingInvoice, { ledger, requestFingerprint });
      return { ...replay.resultSnapshot, duplicate: true };
    },
    assertNoLegacySale: async () => {
      const legacySale = await findLegacyTerminalSale(
        new sqlDriver.Request(transaction),
        normalized.clientEventId,
      );
      assertNoLegacyTerminalSale(legacySale);
    },
    prepareNewSale: async () => {
      await prepareSalesInvoiceFinalization(transactionContext);
      const customer = await getActiveCustomer(normalized.customerId, transactionContext);
      const terminal = await getTerminalOperatorContext(
        normalized.terminalCode,
        actorUserId,
        transactionContext,
      );
      const productsById = await getActiveProducts(normalized.items, transactionContext);
      const documentCurrency = normalized.documentCurrency || customer.currency || 'TRY';
      const currencyRateMap = await getTerminalCurrencyRateMap(transactionContext);
      assertTerminalSalePricing(normalized.items, productsById, terminal, {
        documentCurrency,
        documentExchangeRate: normalized.exchangeRate,
        currencyRateMap,
      });
      const description = buildTerminalSaleDescription({
        ...normalized,
        requestFingerprint,
      });
      return {
        terminal,
        draftPayload: {
          documentNo: normalized.documentNumber,
          documentDate: new Date().toISOString().slice(0, 10),
          customerId: normalized.customerId,
          terminalDeviceId: terminal.terminalDeviceId,
          employeeId: terminal.employeeId,
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
        },
      };
    },
    reserveLedger: (prepared) => insertTerminalSaleLedger(new sqlDriver.Request(transaction), {
      clientEventId: normalized.clientEventId,
      terminalDeviceId: prepared.terminal.terminalDeviceId,
      actorUserId,
      requestFingerprint,
    }),
    createDraft: (prepared) => createSalesDraft(prepared.draftPayload, actor, transactionContext),
    finalizeDraft: (draft) => finalizeSalesInvoice(draft.id, actor, transactionContext),
    writeSubmitAudit: (finalized, _prepared, ledgerId) => writeTerminalSubmitAudit(
      finalized,
      normalized,
      actor,
      { transactionContext, requestFingerprint, ledgerId },
    ),
    completeLedger: (finalized, _prepared, ledgerId) => markTerminalSaleLedgerSynced(
      new sqlDriver.Request(transaction),
      {
        ledgerId,
        invoiceId: finalized.id,
        requestFingerprint,
        resultSnapshot: toSubmitResponse(finalized),
      },
    ),
    toCreatedResult: (finalized) => toSubmitResponse(finalized),
  };

  try {
    return await runTerminalSaleSubmissionTransaction({ transaction, operations });
  } catch (error) {
    if (error.transactionOutcome === 'unverified') {
      error.originalCode = error.code || 'TERMINAL_SALE_SUBMIT_FAILED';
      error.code = 'TERMINAL_SALE_OUTCOME_UNVERIFIED';
      error.statusCode = 503;
      error.message = 'Terminal sale outcome could not be verified; check ERP sales and audit records before retrying the same event';
    }
    error.code = error.code || 'TERMINAL_SALE_SUBMIT_FAILED';
    throw error;
  }
}

export async function searchTerminalProducts(query = {}) {
  const result = await getVegaProductsListFromWorker({
    ...query,
    page: query.page || 1,
    limit: query.limit || 30,
    search: query.q || query.search || '',
    activeOnly: true,
  });
  const sourceIds = result.data.map((product) => Number(product.sourceId));
  const imageMap = await getVegaProductImageMap(sourceIds);

  return {
    data: result.data.map((product) => ({
      ...product,
      imageUrl: imageMap.get(Number(product.sourceId)) || product.imageUrl || null,
      saleWritable: false,
    })),
    meta: {
      ...result.meta,
      source: 'terminal-vega-live-read-only',
      saleWriteEnabled: false,
    },
  };
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

  const result = await getVegaProductsListFromWorker({
    barcode: normalizedBarcode,
    page: 1,
    limit: 20,
    activeOnly: true,
  });
  const product = result.data.find((item) => (
    trimText(item.matchedBarcode || item.barcodeMasked).toLowerCase() === normalizedBarcode.toLowerCase()
  ));
  if (!product) {
    throw serviceError('TERMINAL_PRODUCT_NOT_FOUND', 'Product barcode not found', 404);
  }

  const imageMap = await getVegaProductImageMap([Number(product.sourceId)]);
  return {
    ...product,
    imageUrl: imageMap.get(Number(product.sourceId)) || product.imageUrl || null,
    saleWritable: false,
  };
}

async function createDatabaseRequest(transactionContext = null) {
  if (transactionContext?.transaction) {
    return new transactionContext.sqlDriver.Request(transactionContext.transaction);
  }
  const pool = await getSqlPool();
  return pool.request();
}
export function terminalProductLockIds(items) {
  const ids = [...new Set(items.map((item) => item.productId))].sort((left, right) => left - right);
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) {
    throw serviceError('TERMINAL_PRODUCT_REQUIRED', 'productId is required');
  }
  return ids;
}
