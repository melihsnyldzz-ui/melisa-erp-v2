import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { hash, requireRule, group, equalDecimal } from '../src/services/vegaMigrationSpecification.mjs';
import { historyTable, sourceKey, linkHeader } from './vega-migration-spec-history.mjs';
const [run] = process.argv.slice(2);
requireRule(process.argv.length === 3 && /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/.test(run || ''), 'REPORT_RUN_REQUIRED');
const dir = path.join(process.env.LOCALAPPDATA, 'MelisaERPServer/migration-spec', run), read = n => JSON.parse(fs.readFileSync(path.join(dir, n)));
const plan = read('plan/plan.json'), history = read('history/manifest.json'), backup = read('backup-receipt.json');
requireRule(history.status === 'HISTORY_CAPTURED_NATIVE_APPLY_NOT_IMPLEMENTED' && history.issues.length === 0, 'STABLE_HISTORY_REQUIRED');
const output = path.join(dir, 'report'); fs.mkdirSync(output);
const privateWrite = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2), { flag: 'wx' });
const headers = [], native = new Map(), counts = [];
function rows(table) {
  const text = fs.readFileSync(path.join(dir, 'history', `${table}.jsonl`), 'utf8');
  return text.trim() ? text.trimEnd().split('\n').map(JSON.parse) : [];
}
for (const t of history.tables) {
  const fileHash = createHash('sha256').update(fs.readFileSync(path.join(dir, 'history', `${t.table}.jsonl`))).digest('hex');
  requireRule(fileHash === t.hash && t.twoPassStable === true, 'HISTORY_CHANGED');
  if (t.kind === 'document') for (const row of rows(t.table)) headers.push({ key: sourceKey(t.table, row.IND), table: t.table, ...historyTable(t.table), row });
}
for (const type of ['sales', 'purchase']) for (const r of read(`target-${type}_invoices.json`)) if (r.is_migrated && r.migration_source_key) {
  const key = r.migration_source_key.replace(/^VEGA2026\/F010[234]\/D\d{4}\//, 'VEGA2026/');
  if (!native.has(key)) native.set(key, []); native.get(key).push({ ...r, type });
}
const byType = group(headers, h => `${h.company}/${h.period}/${h.row.BELGETIPI}/${h.row.IND}`), byFamily = group(headers, h => `${h.company}/${h.period}/${h.family}/${h.row.IND}`);
const docFd = fs.openSync(path.join(output, 'document-differences.jsonl'), 'wx'), linkFd = fs.openSync(path.join(output, 'relation-reviews.jsonl'), 'wx');
let unmappedNativeDocuments = 0, matchedNativeDocuments = 0, nativeFieldDifferences = 0, relationReviews = 0, cancelledEffects = 0, relatedOnly = 0;
try {
  for (const table of history.tables.filter(t => t.kind === 'document')) {
    const scoped = headers.filter(h => h.table === table.table && h.row.TARIH?.slice(0, 10) >= plan.window.startDate && h.row.TARIH.slice(0, 10) < plan.window.endExclusive && h.row.IPTAL === false);
    const count = { table: table.table, company: table.company, period: table.period, family: table.family, sourceActiveInWindow: scoped.length, nativeProvenanceMatches: 0 };
    for (const h of scoped) {
      const target = native.get(h.key) || [];
      // Finance documents use separate ledger provenance; no false missing-invoice claim.
      if (!['STKCIK', 'STKGIR', 'ALFAT', 'ALIRS', 'SATFAT', 'SATIRS', 'CARCIKIADE', 'CARGIRIADE'].includes(h.family)) continue;
      if (target.length !== 1) { unmappedNativeDocuments++; fs.writeSync(docFd, JSON.stringify({ sourceKey: h.key, documentNo: h.row.BELGENO, date: h.row.TARIH, reason: target.length ? 'AMBIGUOUS_NATIVE_PROVENANCE' : h.company === 'F0104' ? 'F0104_REVIEW' : 'NO_DIRECT_NATIVE_PROVENANCE', eventLinkMayExplain: true }) + '\n'); continue; }
      count.nativeProvenanceMatches++; matchedNativeDocuments++;
      const fields = [];
      if (h.row.BELGENO !== target[0].document_no) fields.push('documentNo');
      if (h.row.TARIH?.slice(0, 10) !== target[0].document_date?.slice(0, 10)) fields.push('documentDate');
      if (h.row.TUTAR != null && target[0].amount_try != null && !equalDecimal(h.row.TUTAR, target[0].amount_try)) fields.push('sourceTotalVsTargetTRY');
      if (h.row.ACIKLAMA && !String(target[0].description || '').includes(h.row.ACIKLAMA)) fields.push('sourceNote');
      if (fields.length) { nativeFieldDifferences += fields.length; fs.writeSync(docFd, JSON.stringify({ sourceKey: h.key, targetId: target[0].id, fields, reason: 'NATIVE_FIELD_DIFFERENCE' }) + '\n'); }
    }
    counts.push(count);
  }
  const relationCounts = [];
  for (const t of history.tables.filter(t => t.kind !== 'document')) {
    const stats = { table: t.table, linked: 0, relatedOnly: 0, excludedCancelled: 0, reviews: 0 };
    for (const row of rows(t.table)) {
      const link = linkHeader(t.table, row, byType, byFamily);
      if (link.status === 'LINKED') stats.linked++;
      else if (link.status === 'RELATED_ONLY') { stats.relatedOnly++; relatedOnly++; }
      else if (link.status === 'EXCLUDE_CANCELLED') { stats.excludedCancelled++; cancelledEffects++; }
      else { stats.reviews++; relationReviews++; fs.writeSync(linkFd, JSON.stringify({ sourceKey: sourceKey(t.table, row.IND), ...link }) + '\n'); }
    }
    relationCounts.push(stats);
  }
  privateWrite('relation-counts.json', relationCounts);
} finally { fs.closeSync(docFd); fs.closeSync(linkFd); }
privateWrite('document-counts.json', counts);
const pakel = read('history/pakel-case.json');
const report = { run, status: 'PARTIAL_IMPLEMENTATION_NOT_MIGRATED', planHash: plan.planHash, sourceReadOnly: true, sourcePermissionsVerifiedTables: read('preflight.json').sourcePermissions.tables, businessSqlWrites: 0, target: plan.specification.target, startDate: plan.window.startDate, structureDifferences2020_2021: plan.structureDifferences2020_2021.length, sourceArchive: { tables: history.tables.length, rows: history.summary.capturedRows, headers: history.summary.headerRows, atomic: false, twoPassStable: true }, initialDifferences: plan.counts, historyComparison: { matchedNativeDocuments, documentsWithoutDirectNativeProvenance: unmappedNativeDocuments, nativeFieldDifferences, relationReviews, cancelledEffectsExcluded: cancelledEffects, generalLedgerRelatedOnly: relatedOnly, note: 'Not every missing direct provenance key proves a missing commercial event; explicit invoice/slip links still need reconciliation. Finance documents use separate ledger mappings.' }, backup: { status: backup.status, planHashMatches: backup.planHash === plan.planHash, backupSetGuid: backup.backupSetGuid, restoreExecuted: false }, pakel: { status: pakel.status, pairs: pakel.pairs, targetReconciled: false }, protectedTerminalIds: plan.protectedIds, salespersonMappings: read('history/salesperson-prefixes.json'), outstanding: ['NATIVE_MULTICURRENCY_PARTY_SCHEMA_AND_ADAPTERS', 'NATIVE_HISTORICAL_LINE_DISCOUNTS_RETURNS_FINANCE_AND_NOTES', 'SOURCE_RELATION_REVIEWS_AND_ANNUAL_CARRYOVERS', 'PRODUCT_AND_PARTY_IDENTITY_REVIEWS', 'F0104_DOCUMENT_EVENT_LINKS', 'SALESPERSON_IDENTITY_MAPPINGS', 'TEST_APPLY_WITH_IDEMPOTENCY_AND_ALL_DIMENSION_RECONCILIATION', 'CHATGPT_NEW_ERP_POST_APPLY_VERIFICATION'], criticalDimensions: plan.reconciliation.dimensions, privateDetails: output, successfulTargetRecordsRolledBack: false, liveEnabled: false };
privateWrite('summary.json', report);
const publicDir = fileURLToPath(new URL('../../../artifacts/migration-spec-20260917/', import.meta.url));
fs.writeFileSync(path.join(publicDir, `${run}-report.json`), JSON.stringify(report, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ ...report, criticalDimensions: undefined, salespersonMappings: undefined }));
