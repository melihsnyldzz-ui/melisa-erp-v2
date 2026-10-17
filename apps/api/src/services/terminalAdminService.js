import sql from 'mssql';
import { getSqlPool } from '../config/database.js';
import { sqlNormalizedLike, toSearchPattern } from './queryHelpers.js';

function numberValue(value) {
  return Number(value || 0);
}

function trimText(value, maxLength = 120) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10))
    ? value.slice(0, 10)
    : null;
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
  const status = trimText(query.status, 20).toLowerCase();
  const search = trimText(query.search);
  const dateFrom = normalizeDate(query.dateFrom);
  const dateTo = normalizeDate(query.dateTo);
  const deviceId = Number(query.deviceId || 0);
  const pool = await getSqlPool();
  const terminalSearchPredicates = [
    'd.device_code',
    'd.device_name',
    'u.username',
    'q.client_request_id',
    'q.event_type',
  ].map((column) => sqlNormalizedLike(column, '@searchLike')).join(' OR ');
  const terminalSummarySearchPredicates = [
    'd.device_code',
    'd.device_name',
    'u.username',
    'q.client_request_id',
    'q.event_type',
  ].map((column) => sqlNormalizedLike(column, '@summarySearchLike')).join(' OR ');
  const queueFilters = [
    '(@status = N\'\' OR q.status = @status)',
    `(@search = N'' OR ${terminalSearchPredicates})`,
    '(@dateFrom IS NULL OR q.received_at >= @dateFrom)',
    '(@dateTo IS NULL OR q.received_at < DATEADD(day, 1, @dateTo))',
    '(@deviceId = 0 OR q.terminal_device_id = @deviceId)',
  ];
  const queueRequest = pool.request()
    .input('status', sql.NVarChar(20), status)
    .input('search', sql.NVarChar(120), search)
    .input('searchLike', sql.NVarChar(140), toSearchPattern(search) || '')
    .input('dateFrom', sql.Date, dateFrom)
    .input('dateTo', sql.Date, dateTo)
    .input('deviceId', sql.BigInt, Number.isInteger(deviceId) && deviceId > 0 ? deviceId : 0);

  const [summaryResult, devicesResult, queueResult] = await Promise.all([
    pool.request()
      .input('summaryStatus', sql.NVarChar(20), status)
      .input('summarySearch', sql.NVarChar(120), search)
      .input('summarySearchLike', sql.NVarChar(140), toSearchPattern(search) || '')
      .input('summaryDateFrom', sql.Date, dateFrom)
      .input('summaryDateTo', sql.Date, dateTo)
      .input('summaryDeviceId', sql.BigInt, Number.isInteger(deviceId) && deviceId > 0 ? deviceId : 0)
      .query(`
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
      FROM dbo.terminal_sync_queue q
      INNER JOIN dbo.terminal_devices d ON d.id = q.terminal_device_id
      LEFT JOIN dbo.users u ON u.id = q.user_id
      WHERE (@summaryStatus = N'' OR q.status = @summaryStatus)
        AND (@summarySearch = N'' OR ${terminalSummarySearchPredicates})
        AND (@summaryDateFrom IS NULL OR q.received_at >= @summaryDateFrom)
        AND (@summaryDateTo IS NULL OR q.received_at < DATEADD(day, 1, @summaryDateTo))
        AND (@summaryDeviceId = 0 OR q.terminal_device_id = @summaryDeviceId);
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
      WHERE ${queueFilters.join(' AND ')}
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
      search,
      dateFrom,
      dateTo,
      deviceId: Number.isInteger(deviceId) && deviceId > 0 ? deviceId : null,
    },
  };
}
