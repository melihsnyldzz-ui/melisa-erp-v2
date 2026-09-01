import sql from 'mssql';
import { createHash } from 'node:crypto';
import { getSqlPool } from '../config/database.js';
import { getVegaProductMetadataFromWorker } from './vegaProductMetadataClientService.js';

const COVERAGE_RULES = [
  {
    key: 'sales',
    label: 'Satis fisleri',
    actions: ['sales_invoice_draft_created', 'sales_invoice_finalized', 'sales_invoice_finalized_corrected', 'sales_invoice_cancelled'],
    risk: 'high',
    description: 'Satis taslak, kesinlestirme ve iptal akislari.',
  },
  {
    key: 'purchase',
    label: 'Alis fisleri',
    actions: ['purchase_invoice_draft_created', 'purchase_invoice_finalized', 'purchase_invoice_finalized_corrected', 'purchase_invoice_cancelled'],
    risk: 'high',
    description: 'Alis taslak, kesinlestirme ve iptal akislari.',
  },
  {
    key: 'finance',
    label: 'Tahsilat ve odeme',
    actions: [
      'customer_collection_created', 'supplier_payment_created',
      'finance_account_created', 'finance_account_updated',
      'cash_session_opened', 'cash_session_closed',
      'cash_expense_created', 'cash_transfer_created',
    ],
    risk: 'critical',
    description: 'Cari bakiye ve kasa/banka etkisi olan finans hareketleri.',
  },
  {
    key: 'stock',
    label: 'Stok ve urun',
    actions: ['product_created', 'products_bulk_created', 'product_updated', 'products_bulk_updated', 'product_passive_changed', 'stock_count_adjustment_applied'],
    risk: 'critical',
    description: 'Urun karti, aktif/pasif ve stok sayim duzeltmeleri.',
  },
  {
    key: 'customer_supplier',
    label: 'Cari kartlar',
    actions: ['customer_created', 'customer_updated', 'customer_passive_changed', 'supplier_created', 'supplier_updated'],
    risk: 'medium',
    description: 'Musteri ve tedarikci kart degisiklikleri.',
  },
  {
    key: 'import',
    label: 'Import',
    actions: ['import_products', 'import_customers', 'import_suppliers'],
    risk: 'critical',
    description: 'Toplu veri aktarim apply sonuclari.',
  },
  {
    key: 'auth_settings',
    label: 'Yetki ve ayarlar',
    actions: ['user_access_updated', 'system_settings_updated', 'currency_rates_updated'],
    risk: 'critical',
    description: 'Kullanici/yetki, sistem ayari ve doviz kuru degisiklikleri.',
  },
  {
    key: 'crm_pipeline',
    label: 'Teklif ve siparis',
    actions: ['sales_offer_created', 'sales_offer_updated', 'sales_offer_status_changed', 'sales_order_created', 'sales_order_updated', 'sales_order_status_changed'],
    risk: 'medium',
    description: 'CRM sinirindaki teklif/siparis pipeline olaylari.',
  },
  {
    key: 'terminal',
    label: 'Terminal',
    actions: ['terminal_sales_submitted', 'terminal_receipt_print_requested', 'terminal_receipt_print_completed'],
    risk: 'high',
    description: 'Terminal satis submit, sync ve ERP bilgisayari yazici izleri.',
  },
];

const METADATA_EVENT_ACTIONS = new Set([
  'product_created',
  'product_updated',
  'products_bulk_updated',
  'product_passive_changed',
  'supplier_created',
  'supplier_updated',
  'stock_count_adjustment_applied',
]);

const PRODUCT_FIELD_GROUPS = Object.freeze({
  stockCode: 'identity',
  barcode: 'identity',
  productName: 'catalog',
  brand: 'catalog',
  category: 'catalog',
  supplierId: 'supplier',
  supplierCode: 'supplier',
  supplierName: 'supplier',
  currency: 'currency',
  salePrice: 'pricing',
  purchasePrice: 'pricing',
  purchaseDiscountRate: 'pricing',
  averageCostTry: 'pricing',
  stockQuantity: 'stock',
  isActive: 'status',
});

const SUPPLIER_FIELD_GROUPS = Object.freeze({
  supplierCode: 'identity',
  name: 'catalog',
  isActive: 'status',
});

const VEGA_PRODUCT_METADATA_GROUPS = Object.freeze({
  identity: ['stock_code'],
  catalog: ['product_name', 'brand', 'special_code_2', 'special_code_3', 'category', 'special_code_5', 'special_code_6', 'special_code_7', 'special_code_8', 'special_code_9', 'special_code_10', 'special_code_11', 'special_code_12', 'special_code_13', 'special_code_14', 'special_code_15', 'special_code_16', 'special_code_17', 'special_code_18', 'special_code_19', 'special_code_20', 'special_code_21'],
  stock: ['stock_quantity', 'reserved_quantity', 'critical_level'],
  pricing: ['purchase_price_local', 'purchase_price_foreign', 'purchase_discount_rate'],
  status: ['status_code', 'cancelled', 'deleted'],
});

function toAuditDto(row) {
  let beforeSnapshot = null;
  let afterSnapshot = null;

  try {
    beforeSnapshot = row.before_json ? JSON.parse(row.before_json) : null;
  } catch {
    beforeSnapshot = null;
  }

  try {
    afterSnapshot = row.after_json ? JSON.parse(row.after_json) : null;
  } catch {
    afterSnapshot = null;
  }

  return {
    id: Number(row.id),
    actorUserId: row.actor_user_id ? Number(row.actor_user_id) : null,
    actorName: row.actor_name || 'SYSTEM',
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id ? Number(row.entity_id) : null,
    reason: row.reason || '',
    source: row.source || '',
    createdAt: row.created_at,
    beforeSnapshot,
    afterSnapshot,
    hasBeforeSnapshot: Boolean(row.before_json),
    hasAfterSnapshot: Boolean(row.after_json),
  };
}

function normalizeLimit(value) {
  const numericLimit = Number(value || 100);
  if (!Number.isInteger(numericLimit) || numericLimit < 1) {
    return 100;
  }
  return Math.min(numericLimit, 500);
}

function normalizeCursor(value) {
  if (value === undefined || value === null || value === '') return 0;
  const numericCursor = Number(value);
  if (!Number.isSafeInteger(numericCursor) || numericCursor < 0) {
    const error = new Error('after must be a non-negative integer');
    error.code = 'AUDIT_METADATA_CURSOR_INVALID';
    error.statusCode = 400;
    throw error;
  }
  return numericCursor;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function addTextFilter({ clauses, request, name, value, column }) {
  const trimmed = normalizeText(value);
  if (!trimmed) return;
  request.input(name, sql.NVarChar(250), `%${trimmed}%`);
  clauses.push(`${column} LIKE @${name}`);
}

export async function writeAuditLog(request, {
  action,
  entityType,
  entityId,
  beforeSnapshot = null,
  afterSnapshot = null,
  actor = null,
}) {
  const actorId = actor?.id ? Number(actor.id) : null;
  const actorName = actor?.username || 'SYSTEM';

  await request
    .input('auditAction', sql.NVarChar(80), action)
    .input('auditEntityType', sql.NVarChar(80), entityType)
    .input('auditEntityId', sql.BigInt, entityId)
    .input('auditBeforeJson', sql.NVarChar(sql.MAX), beforeSnapshot ? JSON.stringify(beforeSnapshot) : null)
    .input('auditAfterJson', sql.NVarChar(sql.MAX), afterSnapshot ? JSON.stringify(afterSnapshot) : null)
    .input('auditActorUserId', sql.BigInt, actorId)
    .input('auditReason', sql.NVarChar(500), `actor:${actorName}`)
    .input('auditSource', sql.NVarChar(80), actor ? 'web-admin' : 'SYSTEM')
    .query(`
      INSERT INTO dbo.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_json,
        after_json,
        reason,
        source,
        created_at
      )
      VALUES (
        @auditActorUserId,
        @auditAction,
        @auditEntityType,
        @auditEntityId,
        @auditBeforeJson,
        @auditAfterJson,
        @auditReason,
        @auditSource,
        SYSUTCDATETIME()
      );
    `);
}

export async function listAuditLogs(query = {}) {
  const pool = await getSqlPool();
  const request = pool.request();
  const limit = normalizeLimit(query.limit);
  const clauses = ['1 = 1'];

  request.input('limit', sql.Int, limit);

  addTextFilter({ clauses, request, name: 'action', value: query.action, column: 'a.action' });
  addTextFilter({ clauses, request, name: 'entityType', value: query.entityType, column: 'a.entity_type' });
  addTextFilter({ clauses, request, name: 'source', value: query.source, column: 'a.source' });

  const search = normalizeText(query.search);
  if (search) {
    request.input('search', sql.NVarChar(250), `%${search}%`);
    clauses.push(`(
      a.action LIKE @search OR
      a.entity_type LIKE @search OR
      a.reason LIKE @search OR
      a.source LIKE @search OR
      u.username LIKE @search
    )`);
  }

  const fromDate = normalizeText(query.fromDate);
  if (fromDate) {
    request.input('fromDate', sql.DateTime2, fromDate);
    clauses.push('a.created_at >= @fromDate');
  }

  const toDate = normalizeText(query.toDate);
  if (toDate) {
    request.input('toDate', sql.DateTime2, toDate);
    clauses.push('a.created_at < DATEADD(day, 1, @toDate)');
  }

  const result = await request.query(`
    SELECT TOP (@limit)
      a.id,
      a.actor_user_id,
      u.username AS actor_name,
      a.action,
      a.entity_type,
      a.entity_id,
      a.before_json,
      a.after_json,
      a.reason,
      a.source,
      a.created_at
    FROM dbo.audit_logs a
    LEFT JOIN dbo.users u ON u.id = a.actor_user_id
    WHERE ${clauses.join('\n      AND ')}
    ORDER BY a.created_at DESC, a.id DESC;
  `);

  return {
    data: result.recordset.map(toAuditDto),
    meta: {
      source: 'sql-audit-logs',
      limit,
      filters: {
        search,
        action: normalizeText(query.action),
        entityType: normalizeText(query.entityType),
        source: normalizeText(query.source),
        fromDate,
        toDate,
      },
      readOnly: true,
    },
  };
}

export async function getAuditCoverage() {
  const pool = await getSqlPool();
  const result = await pool.request().query(`
    SELECT
      action,
      entity_type,
      COUNT(1) AS event_count,
      MAX(created_at) AS last_seen_at
    FROM dbo.audit_logs
    GROUP BY action, entity_type;
  `);

  const countsByAction = new Map(result.recordset.map((row) => [row.action, {
    action: row.action,
    entityType: row.entity_type,
    count: Number(row.event_count || 0),
    lastSeenAt: row.last_seen_at,
  }]));

  const coverage = COVERAGE_RULES.map((rule) => {
    const actionStats = rule.actions.map((action) => countsByAction.get(action) || {
      action,
      entityType: null,
      count: 0,
      lastSeenAt: null,
    });
    const coveredActions = actionStats.filter((item) => item.count > 0).length;

    return {
      ...rule,
      coveredActions,
      expectedActions: rule.actions.length,
      status: coveredActions === rule.actions.length
        ? 'covered'
        : coveredActions > 0
          ? 'partial'
          : 'missing',
      actions: actionStats,
    };
  });

  return {
    coverage,
    summary: {
      totalAreas: coverage.length,
      coveredAreas: coverage.filter((item) => item.status === 'covered').length,
      partialAreas: coverage.filter((item) => item.status === 'partial').length,
      missingAreas: coverage.filter((item) => item.status === 'missing').length,
    },
    readOnly: true,
    source: 'sql-audit-coverage',
  };
}

/**
 * Returns an intentionally narrow event feed for integrations.  It never
 * returns audit snapshots, actor data, reasons, names, prices, or stock
 * values: only a durable opaque entity reference and coarse field groups.
 */
export async function listAuditMetadataEvents(query = {}) {
  const pool = await getSqlPool();
  const after = normalizeCursor(query.after);
  const limit = normalizeLimit(query.limit);
  const request = pool.request()
    .input('auditMetadataAfter', sql.BigInt, after)
    .input('auditMetadataLimit', sql.Int, limit);

  const actions = [...METADATA_EVENT_ACTIONS];
  const placeholders = actions.map((action, index) => {
    const name = `auditMetadataAction${index}`;
    request.input(name, sql.NVarChar(120), action);
    return `@${name}`;
  });

  const result = await request.query(`
    SELECT TOP (@auditMetadataLimit)
      id,
      action,
      entity_type,
      entity_id,
      before_json,
      after_json,
      created_at
    FROM dbo.audit_logs
    WHERE id > @auditMetadataAfter
      AND action IN (${placeholders.join(', ')})
      AND (entity_id IS NOT NULL OR action = N'products_bulk_updated')
    ORDER BY id ASC;
  `);

  const highWaterResult = await pool.request().query(`
    SELECT MAX(id) AS high_water_mark
    FROM dbo.audit_logs
    WHERE action IN (
      N'product_created', N'product_updated', N'products_bulk_updated', N'product_passive_changed',
      N'supplier_created', N'supplier_updated', N'stock_count_adjustment_applied'
    );
  `);

  const events = result.recordset.flatMap(toAuditMetadataEvents);

  return {
    data: events,
    meta: {
      source: 'sql-audit-metadata-events',
      readOnly: true,
      valuesOmitted: true,
      cursor: after,
      nextCursor: events.at(-1)?.cursor ?? after,
      highWaterMark: Number(highWaterResult.recordset?.[0]?.high_water_mark || after),
      limit,
    },
  };
}

/**
 * Read-only Vega stock-card state feed. Vega cards do not provide a durable
 * per-update audit cursor, so this endpoint exposes only opaque, grouped state
 * fingerprints. Consumers compare fingerprints over time; no card values or
 * direct Vega identifiers cross the ERP boundary.
 */
export async function listVegaProductMetadata(query = {}) {
  return getVegaProductMetadataFromWorker(query);
}

export function toAuditMetadataEvent(row = {}) {
  const action = String(row.action || '');
  const entityType = String(row.entity_type || '');
  const entityId = Number(row.entity_id);
  const cursor = Number(row.id);
  if (!METADATA_EVENT_ACTIONS.has(action)
    || !Number.isSafeInteger(entityId) || entityId < 1
    || !Number.isSafeInteger(cursor) || cursor < 1) return null;

  const beforeSnapshot = parseSnapshot(row.before_json);
  const afterSnapshot = parseSnapshot(row.after_json);
  return {
    cursor,
    sourceEventId: `audit-log:${cursor}`,
    action,
    entityType,
    entityRef: opaqueEntityRef(entityType, entityId),
    changedFieldGroups: changedFieldGroups(entityType, beforeSnapshot, afterSnapshot),
    occurredAt: row.created_at,
  };
}

export function toVegaProductMetadataEvent(row = {}) {
  const entityId = Number(row.source_id);
  if (!Number.isSafeInteger(entityId) || entityId < 1) return null;
  const groupFingerprints = Object.fromEntries(Object.entries(VEGA_PRODUCT_METADATA_GROUPS)
    .map(([group, fields]) => [group, opaqueMetadataFingerprint(group, fields.map((field) => row[field]))]));
  return {
    entityRef: opaqueEntityRef('vega_product', entityId),
    groupFingerprints,
    stateFingerprint: opaqueMetadataFingerprint('state', Object.values(groupFingerprints)),
  };
}

/**
 * A single audit row can safely fan out only when the source is the supported
 * bulk-product audit shape.  The result still contains no product values: it
 * exposes one opaque product identity and coarse changed-field groups per row.
 */
export function toAuditMetadataEvents(row = {}) {
  if (row?.action !== 'products_bulk_updated') {
    const event = toAuditMetadataEvent(row);
    return event ? [event] : [];
  }

  const cursor = Number(row.id);
  if (!Number.isSafeInteger(cursor) || cursor < 1) return [];

  const beforeRows = Array.isArray(parseSnapshot(row.before_json).rows)
    ? parseSnapshot(row.before_json).rows
    : [];
  const afterRows = Array.isArray(parseSnapshot(row.after_json).rows)
    ? parseSnapshot(row.after_json).rows
    : [];
  const afterById = new Map(afterRows.map((item) => [Number(item?.id), item]));

  return beforeRows
    .map((before) => ({ entityId: Number(before?.id), before, after: afterById.get(Number(before?.id)) }))
    .filter((item) => Number.isSafeInteger(item.entityId) && item.entityId > 0 && item.after && typeof item.after === 'object')
    .sort((left, right) => left.entityId - right.entityId)
    .map((item, index) => ({
      cursor,
      sourceEventId: `audit-log:${cursor}:item:${index + 1}`,
      action: 'products_bulk_updated',
      entityType: 'product',
      entityRef: opaqueEntityRef('product', item.entityId),
      changedFieldGroups: changedFieldGroups('product', item.before, item.after),
      occurredAt: row.created_at,
    }));
}

export function opaqueEntityRef(entityType, entityId) {
  const type = String(entityType || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_') || 'ENTITY';
  const digest = createHash('sha256')
    .update(`MELISA_ERP_V2|${type}|${Number(entityId)}`)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
  return `${type}-${digest}`;
}

export function changedFieldGroups(entityType, beforeSnapshot, afterSnapshot) {
  const fieldGroups = entityType === 'product'
    ? PRODUCT_FIELD_GROUPS
    : entityType === 'supplier'
      ? SUPPLIER_FIELD_GROUPS
      : {};
  const before = beforeSnapshot && typeof beforeSnapshot === 'object' ? beforeSnapshot : {};
  const after = afterSnapshot && typeof afterSnapshot === 'object' ? afterSnapshot : {};
  const changed = Object.keys(fieldGroups).filter((field) => !sameJsonValue(before[field], after[field]));
  return [...new Set(changed.map((field) => fieldGroups[field]))].sort();
}

function parseSnapshot(value) {
  if (!value) return {};
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function opaqueMetadataFingerprint(group, values) {
  return createHash('sha256')
    .update(`MELISA_ERP_V2|VEGA_PRODUCT|${group}|${JSON.stringify(values.map((value) => value ?? null))}`)
    .digest('hex')
    .slice(0, 32)
    .toUpperCase();
}

function normalizeOffset(value) {
  const offset = Number(value);
  return Number.isSafeInteger(offset) && offset >= 0 ? Math.min(offset, 1000000) : 0;
}

function sameJsonValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}
