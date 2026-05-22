import { getSqlPool } from '../config/database.js';

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export async function getMonitoringSummaryData() {
  const pool = await getSqlPool();
  const [syncQueue, importAudit, finalizeAudit, authAudit] = await Promise.all([
    pool.request().query(`
      SELECT
        COALESCE(SUM(CASE WHEN status IN (N'pending', N'processing') THEN 1 ELSE 0 END), 0) AS pending_sync_count,
        COALESCE(SUM(CASE WHEN status = N'failed' THEN 1 ELSE 0 END), 0) AS failed_sync_count
      FROM dbo.terminal_sync_queue;
    `),
    pool.request().query(`
      SELECT
        COALESCE(COUNT_BIG(1), 0) AS import_event_count
      FROM dbo.audit_logs
      WHERE action IN (N'import_products', N'import_customers')
        AND created_at >= DATEADD(day, -1, SYSUTCDATETIME());
    `),
    pool.request().query(`
      SELECT
        COALESCE(COUNT_BIG(1), 0) AS finalize_event_count
      FROM dbo.audit_logs
      WHERE action IN (N'sales_invoice_finalized', N'purchase_invoice_finalized')
        AND created_at >= DATEADD(day, -1, SYSUTCDATETIME());
    `),
    pool.request().query(`
      SELECT TOP (10)
        action,
        entity_type,
        created_at
      FROM dbo.audit_logs
      WHERE created_at >= DATEADD(day, -1, SYSUTCDATETIME())
      ORDER BY created_at DESC, id DESC;
    `),
  ]);

  const syncRow = syncQueue.recordset?.[0] || {};
  const importRow = importAudit.recordset?.[0] || {};
  const finalizeRow = finalizeAudit.recordset?.[0] || {};

  return {
    api: {
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    db: {
      connectionStatus: 'ok',
      checkedAt: new Date().toISOString(),
    },
    terminal: {
      pendingSyncCount: numberValue(syncRow.pending_sync_count),
      failedSyncCount: numberValue(syncRow.failed_sync_count),
    },
    imports: {
      importEventsLast24h: numberValue(importRow.import_event_count),
      failedImportCount: 0,
      note: 'Import failures are currently observed through API error logs; persistent import job table is a production TODO.',
    },
    finalize: {
      finalizeEventsLast24h: numberValue(finalizeRow.finalize_event_count),
      failedFinalizeCount: 0,
      note: 'Finalize failures are currently observed through API error logs; persistent failed-finalize metric is a production TODO.',
    },
    audit: {
      recentEvents: authAudit.recordset || [],
      anomalyNotes: [
        'Watch high frequency auth failures.',
        'Watch repeated import validation failures.',
        'Watch duplicate finalize attempts.',
        'Watch failed terminal sync growth.',
      ],
    },
  };
}
