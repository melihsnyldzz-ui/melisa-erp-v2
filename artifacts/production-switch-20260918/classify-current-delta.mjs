import fs from 'node:fs';
import path from 'node:path';
import sql from '../../apps/api/node_modules/mssql/msnodesqlv8.js';

const RUN_ID = 'PRODUCTION-SWITCH-20260918-01';
const SERVER = 'Semih\\MELISADEV';
const LIVE = 'MELISA_ERP_V2';
const TARGET = 'MELISA_ERP_PROD_CANDIDATE_20260917_01';
const SNAPSHOT_CUTOFF = '2026-09-16T11:31:20.000';
const LIVE2_ACCEPTED_AT = '2026-09-17T19:52:47.984';
const MERGED_DOCUMENT = 'MN-161137ab5dd7473395198aa822';
const outDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1)));
const raw = JSON.parse(fs.readFileSync(path.join(outDir, 'current-delta-preflight.json'), 'utf8'));
const pool = await new sql.ConnectionPool({ connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${SERVER};Database=master;Trusted_Connection=Yes;TrustServerCertificate=Yes;Encrypt=No` }).connect();
const q = async (text) => (await pool.request().query(text)).recordset;
try {
  const current = (await pool.request().query(`
    SELECT
      (SELECT COUNT_BIG(*) FROM [${LIVE}].dbo.sales_invoices WHERE created_at>N'${LIVE2_ACCEPTED_AT}') new_sales,
      (SELECT COUNT_BIG(*) FROM [${LIVE}].dbo.terminal_sync_queue WHERE received_at>N'${LIVE2_ACCEPTED_AT}') new_terminal,
      (SELECT COUNT_BIG(*) FROM [${LIVE}].dbo.audit_logs WHERE created_at>N'${LIVE2_ACCEPTED_AT}') new_audits,
      (SELECT MAX(created_at) FROM [${LIVE}].dbo.sales_invoices) latest_sale,
      (SELECT MAX(received_at) FROM [${LIVE}].dbo.terminal_sync_queue) latest_terminal,
      (SELECT MAX(created_at) FROM [${LIVE}].dbo.audit_logs) latest_audit`)).recordset[0];
  const mapped = (await q(`SELECT s.id,
      (SELECT COUNT_BIG(*) FROM [${TARGET}].dbo.audit_logs a WHERE a.entity_type=N'sales_invoice' AND a.entity_id=s.id
        AND a.action IN(N'sales_invoice_draft_created',N'sales_profit_snapshot_created',N'sales_invoice_finalized',N'native_sale_finalized',N'terminal_receipt_print_requested',N'terminal_receipt_print_completed')) mapped_audits
    FROM [${TARGET}].dbo.sales_invoices s WHERE s.document_no=N'${MERGED_DOCUMENT}'`))[0];
  const historicalSales = raw.missing.salesInvoices.filter((row) => new Date(row.created_at).getTime() <= new Date(SNAPSHOT_CUTOFF + 'Z').getTime());
  const historicalTerminal = raw.missing.terminalEvents.filter((row) => new Date(row.received_at).getTime() <= new Date(SNAPSHOT_CUTOFF + 'Z').getTime());
  const classifications = {
    historicalBeforeAcceptedSnapshot: {
      salesInvoices: historicalSales.length,
      terminalEvents: historicalTerminal.length,
      economicTreatment: 'Effects already represented by accepted snapshot; document relations intentionally excluded by LIVE2 decision.',
    },
    mappedMergeAudits: {
      sourceRows: raw.missing.audits.length,
      candidateRows: Number(mapped?.mapped_audits || 0),
      documentNo: MERGED_DOCUMENT,
    },
    candidateCredentialAuthority: {
      sourcePasswordDifferences: raw.missing.userDifferences.length,
      usernames: raw.missing.userDifferences.map((row) => row.username),
      basis: 'LIVE3 candidate interactive login PASS; role and active state unchanged.',
    },
    newSinceLive2Acceptance: {
      salesInvoices: Number(current.new_sales),
      terminalEvents: Number(current.new_terminal),
      audits: Number(current.new_audits),
    },
  };
  const blockers = [];
  if (historicalSales.length !== raw.missing.salesInvoices.length) blockers.push('UNCLASSIFIED_LIVE_SALE');
  if (historicalTerminal.length !== raw.missing.terminalEvents.length) blockers.push('UNCLASSIFIED_TERMINAL_EVENT');
  if (raw.missing.audits.length !== 6 || Number(mapped?.mapped_audits || 0) < 6) blockers.push('MERGED_AUDIT_NOT_PRESERVED');
  if (raw.missing.userDifferences.some((row) => Number(row.authorization_changed) !== 0 || Number(row.missing_in_candidate) !== 0)) blockers.push('USER_AUTHORIZATION_DIFFERENCE');
  if (Number(current.new_sales) || Number(current.new_terminal) || Number(current.new_audits)) blockers.push('POST_LIVE2_OPERATION_DETECTED');
  const report = {
    runId: RUN_ID,
    generatedAt: new Date().toISOString(),
    mode: 'READ_ONLY_DELTA_CLASSIFICATION',
    snapshotCutoff: SNAPSHOT_CUTOFF,
    live2AcceptedAt: LIVE2_ACCEPTED_AT,
    current,
    classifications,
    sourceWrites: { live: 0, candidate: 0, vega: 0 },
    blockers,
    status: blockers.length ? 'FAIL' : 'PASS',
  };
  fs.writeFileSync(path.join(outDir, 'current-delta-classification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (blockers.length) process.exitCode = 2;
} finally {
  await pool.close();
}
