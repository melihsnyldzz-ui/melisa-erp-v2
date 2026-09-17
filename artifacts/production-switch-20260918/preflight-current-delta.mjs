import fs from 'node:fs';
import path from 'node:path';
import sql from '../../apps/api/node_modules/mssql/msnodesqlv8.js';

const RUN_ID = 'PRODUCTION-SWITCH-20260918-01';
const SERVER = 'Semih\\MELISADEV';
const LIVE = 'MELISA_ERP_V2';
const TARGET = 'MELISA_ERP_PROD_CANDIDATE_20260917_01';
const outDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1)));
const pool = await new sql.ConnectionPool({
  connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${SERVER};Database=master;Trusted_Connection=Yes;TrustServerCertificate=Yes;Encrypt=No`,
  requestTimeout: 180000,
  connectionTimeout: 15000,
}).connect();

const q = async (text) => (await pool.request().query(text)).recordset;
try {
  const identity = (await q("SELECT @@SERVERNAME server,DB_NAME() [database],IS_SRVROLEMEMBER(N'sysadmin') sysadmin"))[0];
  if (String(identity.server).toLowerCase() !== SERVER.toLowerCase() || identity.database !== 'master') throw Error('PREFLIGHT_IDENTITY_REJECTED');
  const databases = await q(`SELECT name,state_desc,user_access_desc,is_read_only FROM sys.databases WHERE name IN(N'${LIVE}',N'${TARGET}') ORDER BY name`);
  if (databases.length !== 2 || databases.some((row) => row.state_desc !== 'ONLINE')) throw Error('DATABASE_NOT_ONLINE');

  const missingSales = await q(`SELECT l.id,l.document_no,l.status,l.document_date,l.created_at,l.finalized_at,l.cancelled_at,l.document_currency,l.grand_total
    FROM [${LIVE}].dbo.sales_invoices l
    WHERE NOT EXISTS(SELECT 1 FROM [${TARGET}].dbo.sales_invoices t WHERE t.document_no=l.document_no)
    ORDER BY l.created_at,l.id`);
  const missingTerminal = await q(`SELECT l.id,l.client_request_id,l.event_type,l.status,l.received_at,l.processed_at,l.target_entity,l.target_entity_id
    FROM [${LIVE}].dbo.terminal_sync_queue l
    WHERE NOT EXISTS(SELECT 1 FROM [${TARGET}].dbo.terminal_sync_queue t WHERE t.client_request_id=l.client_request_id)
    ORDER BY l.received_at,l.id`);
  const userDifferences = await q(`SELECT l.id,l.username,l.role_id,l.is_active,l.updated_at,
      CASE WHEN t.id IS NULL THEN 1 ELSE 0 END missing_in_candidate,
      CASE WHEN t.id IS NOT NULL AND l.password_hash<>t.password_hash THEN 1 ELSE 0 END password_changed,
      CASE WHEN t.id IS NOT NULL AND (ISNULL(l.role_id,-1)<>ISNULL(t.role_id,-1) OR l.is_active<>t.is_active) THEN 1 ELSE 0 END authorization_changed
    FROM [${LIVE}].dbo.users l LEFT JOIN [${TARGET}].dbo.users t ON t.username=l.username
    WHERE t.id IS NULL OR l.password_hash<>t.password_hash OR ISNULL(l.role_id,-1)<>ISNULL(t.role_id,-1) OR l.is_active<>t.is_active
    ORDER BY l.username`);
  const missingAudits = await q(`SELECT l.id,l.action,l.entity_type,l.entity_id,l.created_at
    FROM [${LIVE}].dbo.audit_logs l
    WHERE NOT EXISTS(SELECT 1 FROM [${TARGET}].dbo.audit_logs t
      WHERE t.action=l.action AND t.entity_type=l.entity_type
        AND ISNULL(t.entity_id,-1)=ISNULL(l.entity_id,-1)
        AND t.created_at=l.created_at AND ISNULL(t.after_json,N'')=ISNULL(l.after_json,N''))
    ORDER BY l.created_at,l.id`);
  const missingImages = await q(`SELECT l.id,l.vega_source_id,l.stock_code,l.updated_at
    FROM [${LIVE}].dbo.vega_product_images l
    WHERE NOT EXISTS(SELECT 1 FROM [${TARGET}].dbo.vega_product_images t WHERE t.vega_source_id=l.vega_source_id)
    ORDER BY l.updated_at,l.id`);
  const counts = (await pool.request().query(`
    SELECT N'LIVE' scope,
      (SELECT COUNT_BIG(*) FROM [${LIVE}].dbo.sales_invoices) sales_invoices,
      (SELECT COUNT_BIG(*) FROM [${LIVE}].dbo.terminal_sync_queue) terminal_events,
      (SELECT COUNT_BIG(*) FROM [${LIVE}].dbo.audit_logs) audits,
      (SELECT COUNT_BIG(*) FROM [${LIVE}].dbo.users) users,
      (SELECT COUNT_BIG(*) FROM [${LIVE}].dbo.stock_movements) stock_movements,
      (SELECT COUNT_BIG(*) FROM [${LIVE}].dbo.customer_movements) customer_movements
    UNION ALL SELECT N'CANDIDATE',
      (SELECT COUNT_BIG(*) FROM [${TARGET}].dbo.sales_invoices),
      (SELECT COUNT_BIG(*) FROM [${TARGET}].dbo.terminal_sync_queue),
      (SELECT COUNT_BIG(*) FROM [${TARGET}].dbo.audit_logs),
      (SELECT COUNT_BIG(*) FROM [${TARGET}].dbo.users),
      (SELECT COUNT_BIG(*) FROM [${TARGET}].dbo.stock_movements),
      (SELECT COUNT_BIG(*) FROM [${TARGET}].dbo.customer_movements)`)).recordset;
  const blockers = [];
  if (missingSales.length) blockers.push('LIVE_SALES_NOT_IN_CANDIDATE');
  if (missingTerminal.length) blockers.push('LIVE_TERMINAL_EVENTS_NOT_IN_CANDIDATE');
  if (userDifferences.length) blockers.push('LIVE_USER_AUTH_DIFFERENCE');
  if (missingAudits.length) blockers.push('LIVE_AUDITS_NOT_IN_CANDIDATE');
  if (missingImages.length) blockers.push('LIVE_IMAGES_NOT_IN_CANDIDATE');
  const report = {
    runId: RUN_ID,
    generatedAt: new Date().toISOString(),
    mode: 'READ_ONLY_CURRENT_DELTA_PREFLIGHT',
    identity,
    databases,
    counts,
    missing: {
      salesInvoices: missingSales,
      terminalEvents: missingTerminal,
      userDifferences,
      audits: missingAudits,
      productImages: missingImages,
    },
    writes: { live: 0, candidate: 0, vega: 0 },
    blockers,
    status: blockers.length ? 'FAIL' : 'PASS',
  };
  fs.writeFileSync(path.join(outDir, 'current-delta-preflight.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ runId: RUN_ID, status: report.status, blockers, counts, missingCounts: Object.fromEntries(Object.entries(report.missing).map(([key, value]) => [key, value.length])) }));
  if (blockers.length) process.exitCode = 2;
} finally {
  await pool.close();
}
