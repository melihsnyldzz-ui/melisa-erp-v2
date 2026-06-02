import sql from 'mssql';
import { getSqlPool } from '../config/database.js';

function numberValue(value) {
  return Number(value || 0);
}

function toDeviceDto(row) {
  return {
    id: Number(row.id),
    deviceCode: row.device_code,
    deviceName: row.device_name,
    assignedUserId: row.assigned_user_id ? Number(row.assigned_user_id) : null,
    assignedUser: row.assigned_user || '-',
    isActive: Boolean(row.is_active),
    lastSyncAt: row.last_sync_at,
    lastSeenAt: row.last_seen_at,
    offlineSinceAt: row.offline_since_at,
    pendingCount: numberValue(row.pending_count),
    failedCount: numberValue(row.failed_count),
    syncedCount: numberValue(row.synced_count),
    saleCount: numberValue(row.sale_count),
    saleTotal: numberValue(row.sale_total),
    status: row.offline_since_at ? 'offline' : row.last_seen_at ? 'online' : 'unknown',
  };
}

function toQueueDto(row) {
  return {
    id: Number(row.id),
    deviceId: Number(row.terminal_device_id),
    deviceCode: row.device_code,
    deviceName: row.device_name,
    userId: row.user_id ? Number(row.user_id) : null,
    username: row.username || '-',
    eventType: row.event_type,
    clientRequestId: row.client_request_id,
    status: row.status,
    retryCount: numberValue(row.retry_count),
    lastError: row.last_error || '',
    targetEntity: row.target_entity || '',
    targetEntityId: row.target_entity_id ? Number(row.target_entity_id) : null,
    receivedAt: row.received_at,
    processedAt: row.processed_at,
  };
}

export async function getTerminalAdminOverview(query = {}) {
  const status = typeof query.status === 'string' ? query.status.trim().toLowerCase() : '';
  const pool = await getSqlPool();
  const queueRequest = pool.request().input('status', sql.NVarChar(20), status);

  const [summaryResult, devicesResult, queueResult] = await Promise.all([
    pool.request().query(`
      SELECT
        (SELECT COUNT_BIG(1) FROM dbo.terminal_devices) AS device_count,
        (SELECT COUNT_BIG(1) FROM dbo.terminal_devices WHERE is_active = 1) AS active_device_count,
        (SELECT COUNT_BIG(1) FROM dbo.terminal_devices WHERE offline_since_at IS NOT NULL) AS offline_device_count,
        COALESCE(SUM(CASE WHEN q.status = N'pending' THEN 1 ELSE 0 END), 0) AS pending_sync_count,
        COALESCE(SUM(CASE WHEN q.status = N'processing' THEN 1 ELSE 0 END), 0) AS processing_sync_count,
        COALESCE(SUM(CASE WHEN q.status = N'synced' THEN 1 ELSE 0 END), 0) AS synced_sync_count,
        COALESCE(SUM(CASE WHEN q.status = N'failed' THEN 1 ELSE 0 END), 0) AS failed_sync_count,
        MAX(q.received_at) AS last_queue_at,
        MAX(q.processed_at) AS last_processed_at
      FROM dbo.terminal_sync_queue q;
    `),
    pool.request().query(`
      SELECT
        d.id,
        d.device_code,
        d.device_name,
        d.assigned_user_id,
        u.username AS assigned_user,
        d.is_active,
        d.last_sync_at,
        d.last_seen_at,
        d.offline_since_at,
        COALESCE(SUM(CASE WHEN q.status = N'pending' THEN 1 ELSE 0 END), 0) AS pending_count,
        COALESCE(SUM(CASE WHEN q.status = N'failed' THEN 1 ELSE 0 END), 0) AS failed_count,
        COALESCE(SUM(CASE WHEN q.status = N'synced' THEN 1 ELSE 0 END), 0) AS synced_count,
        COALESCE(s.sale_count, 0) AS sale_count,
        COALESCE(s.sale_total, 0) AS sale_total
      FROM dbo.terminal_devices d
      LEFT JOIN dbo.users u ON u.id = d.assigned_user_id
      LEFT JOIN dbo.terminal_sync_queue q ON q.terminal_device_id = d.id
      OUTER APPLY (
        SELECT COUNT_BIG(1) AS sale_count, COALESCE(SUM(si.amount_try), 0) AS sale_total
        FROM dbo.sales_invoices si
        WHERE si.terminal_device_id = d.id
      ) s
      GROUP BY d.id, d.device_code, d.device_name, d.assigned_user_id, u.username, d.is_active,
        d.last_sync_at, d.last_seen_at, d.offline_since_at, s.sale_count, s.sale_total
      ORDER BY d.is_active DESC, d.last_seen_at DESC, d.id ASC;
    `),
    queueRequest.query(`
      SELECT TOP 120
        q.id,
        q.terminal_device_id,
        d.device_code,
        d.device_name,
        q.user_id,
        u.username,
        q.event_type,
        q.client_request_id,
        q.status,
        q.retry_count,
        q.last_error,
        q.target_entity,
        q.target_entity_id,
        q.received_at,
        q.processed_at
      FROM dbo.terminal_sync_queue q
      INNER JOIN dbo.terminal_devices d ON d.id = q.terminal_device_id
      LEFT JOIN dbo.users u ON u.id = q.user_id
      WHERE (@status = N'' OR q.status = @status)
      ORDER BY q.received_at DESC, q.id DESC;
    `),
  ]);

  const summaryRow = summaryResult.recordset[0] || {};
  return {
    summary: {
      deviceCount: numberValue(summaryRow.device_count),
      activeDeviceCount: numberValue(summaryRow.active_device_count),
      offlineDeviceCount: numberValue(summaryRow.offline_device_count),
      pendingSyncCount: numberValue(summaryRow.pending_sync_count),
      processingSyncCount: numberValue(summaryRow.processing_sync_count),
      syncedSyncCount: numberValue(summaryRow.synced_sync_count),
      failedSyncCount: numberValue(summaryRow.failed_sync_count),
      lastQueueAt: summaryRow.last_queue_at,
      lastProcessedAt: summaryRow.last_processed_at,
    },
    devices: devicesResult.recordset.map(toDeviceDto),
    queue: queueResult.recordset.map(toQueueDto),
    filters: {
      status: status || 'all',
    },
  };
}
