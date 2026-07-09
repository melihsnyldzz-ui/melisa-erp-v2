import sql from 'mssql';
import { getSqlPool } from '../config/database.js';

const COVERAGE_RULES = [
  {
    key: 'sales',
    label: 'Satis fisleri',
    actions: ['sales_invoice_draft_created', 'sales_invoice_finalized', 'sales_invoice_cancelled'],
    risk: 'high',
    description: 'Satis taslak, kesinlestirme ve iptal akislari.',
  },
  {
    key: 'purchase',
    label: 'Alis fisleri',
    actions: ['purchase_invoice_draft_created', 'purchase_invoice_finalized', 'purchase_invoice_cancelled'],
    risk: 'high',
    description: 'Alis taslak, kesinlestirme ve iptal akislari.',
  },
  {
    key: 'finance',
    label: 'Tahsilat ve odeme',
    actions: ['customer_collection_created', 'supplier_payment_created', 'finance_account_created', 'finance_account_updated'],
    risk: 'critical',
    description: 'Cari bakiye ve kasa/banka etkisi olan finans hareketleri.',
  },
  {
    key: 'stock',
    label: 'Stok ve urun',
    actions: ['product_created', 'product_updated', 'product_passive_changed', 'stock_count_adjustment_applied'],
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
    actions: ['terminal_sales_submitted'],
    risk: 'high',
    description: 'Terminal satis submit ve sync izleri.',
  },
];

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
