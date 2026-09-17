// Capture original headers, lines and ledger facts. No business effect is replayed.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hash, requireRule, SPEC, group, currency, equalDecimal, multiplyExact, salesperson } from '../src/services/vegaMigrationSpecification.mjs';
import { identifier, projection, permissionsSql, assertReadOnlyPermissions, identitySql, assertSourceIdentity } from './vega-migration-spec-preflight.mjs';

export const families = new Set(['ALFAT', 'ALIRS', 'SATFAT', 'SATIRS', 'STKGIR', 'STKCIK', 'DEVGIR', 'DEVCIK', 'CARCIK', 'CARGIR', 'CARCIKIADE', 'CARGIRIADE', 'SAYIMGIRIS', 'SAYIMCIKIS', 'DEPOHAR', 'TOPLUCARIBORDRO']);
export function historyTable(table) {
  const match = table.match(/^(F010[234])(D\d{4})TBL(.+)$/);
  if (!match) return null;
  const [, company, period, suffix] = match;
  if (['STOKHAREKETLERI', 'CARIHAREKETLERI', 'CARIGENELHAREKET', 'KASA', 'BANKA', 'BANKAHAREKETLERI'].includes(suffix)) return { company, period, family: suffix, kind: 'movement' };
  const doc = suffix.match(/^(.+)(BASLIK|HAREKET)$/);
  return doc && families.has(doc[1]) ? { company, period, family: doc[1], kind: doc[2] === 'BASLIK' ? 'document' : 'line' } : null;
}
export const sourceKey = (table, id) => { requireRule(historyTable(table) && /^\d+$/.test(String(id)), 'HISTORY_SOURCE_IDENTITY_REQUIRED'); return `${SPEC.source}/${table}/${id}`; };
export function linkHeader(table, row, headersByType, headersByFamily) {
  const d = historyTable(table); requireRule(d, 'HISTORY_TABLE_REQUIRED');
  const base = `${d.company}/${d.period}/`;
  let matches;
  if (d.kind === 'line') matches = headersByFamily.get(`${base}${d.family}/${row.EVRAKNO}`) || [];
  else if (d.family === 'KASA') matches = headersByType.get(`${base}${row.BELGEIZAHAT}/${row.BELGELINK}`) || [];
  else if (d.family === 'CARIGENELHAREKET') {
    // General ledger contains document/application links, not LN/IZAHAT rows.
    // Preserve both references without counting it as a second financial posting.
    const origin = headersByType.get(`${base}${row.BELGEIZAHAT}/${row.BELGEIND}`) || [];
    const applied = headersByType.get(`${base}${row.ISLEMIZAHAT}/${row.ISLEMIND}`) || [];
    if (origin.length !== 1 || applied.length !== 1) return { status: 'REVIEW', reason: 'GENERAL_LEDGER_DUAL_RELATION_REVIEW' };
    const relatedHeaderKeys = [...new Set([origin[0].key, applied[0].key])];
    if (row.IPTAL === true || origin[0].row.IPTAL === true || applied[0].row.IPTAL === true) return { status: 'EXCLUDE_CANCELLED', relatedHeaderKeys };
    if (origin[0].row.IPTAL !== false || applied[0].row.IPTAL !== false) return { status: 'REVIEW', reason: 'CANCELLATION_UNKNOWN', relatedHeaderKeys };
    return { status: 'RELATED_ONLY', relatedHeaderKeys, reason: 'NO_ADDITIONAL_FINANCIAL_POSTING' };
  }
  else if (d.family === 'CARIHAREKETLERI') matches = headersByType.get(`${base}${row.IZAHAT}/${row.LN}`) || [];
  else if (d.family === 'STOKHAREKETLERI') matches = headersByType.get(`${base}${row.IZAHAT}/${row.BELGENO}`) || [];
  else return { status: 'REVIEW', reason: 'MOVEMENT_LINK_ADAPTER_REQUIRED' };
  if (matches.length !== 1) return { status: 'REVIEW', reason: matches.length ? 'AMBIGUOUS_HEADER_LINK' : 'ORPHAN_HEADER_LINK' };
  const h = matches[0];
  return { status: h.row.IPTAL === true ? 'EXCLUDE_CANCELLED' : h.row.IPTAL === false ? 'LINKED' : 'REVIEW', headerKey: h.key, reason: h.row.IPTAL == null ? 'CANCELLATION_UNKNOWN' : null };
}

export async function main(args = process.argv.slice(2)) {
  requireRule(args.length === 1 && /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/.test(args[0] || ''), 'HISTORY_RUN_REQUIRED');
  const dir = path.join(process.env.LOCALAPPDATA, 'MelisaERPServer/migration-spec', args[0]), read = name => JSON.parse(fs.readFileSync(path.join(dir, name)));
  const output = path.join(dir, 'history'); fs.mkdirSync(output);
  const save = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value), { flag: 'wx' });
  const metadata = read('source-metadata.json'), census = read('source-census.json'), preflight = read('preflight.json');
  const tables = census.filter(t => historyTable(t.table));
  const report = { run: args[0], mode: 'SELECT_ONLY', status: 'RUNNING', sqlWrites: 0, window: preflight.window, tables: [], issues: [], atomic: false };
  let close;
  try {
    process.chdir(fileURLToPath(new URL('../', import.meta.url)));
    const vega = await import('../src/config/vegaDatabase.js'); close = vega.closeVegaSqlPool;
    const sql = (await import('mssql/tedious.js')).default, pool = await vega.getVegaSqlPool(); pool.config.requestTimeout = 120000;
    const q = async (statement, cursor) => { requireRule(/^SELECT\b/.test(statement), 'SOURCE_SELECT_ONLY'); const r = pool.request(); if (cursor !== undefined) r.input('cursor', sql.BigInt, cursor); return (await r.query(statement)).recordset; };
    assertSourceIdentity((await q(identitySql))[0]);
    for (let i = 0; i < tables.length; i += 40) { const names = tables.slice(i, i + 40).map(t => t.table); assertReadOnlyPermissions(await q(permissionsSql(names)), names); }
    const currentMetadata = await q("SELECT t.name tableName,c.name columnName,ty.name dataType,c.column_id ordinal FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE s.name=N'dbo' AND (t.name LIKE N'F010[234]%TBL%' OR t.name=N'TBLDONEM') ORDER BY t.name,c.column_id");
    requireRule(hash(currentMetadata) === hash(metadata), 'SOURCE_SCHEMA_CHANGED');
    const headers = [];
    for (const entry of tables.sort((a, b) => Number(historyTable(b.table).kind === 'document') - Number(historyTable(a.table).kind === 'document'))) {
      const table = entry.table, descriptor = historyTable(table), cols = metadata.filter(c => c.tableName === table);
      if (!cols.some(c => c.columnName === 'IND' && /^(int|bigint|smallint)$/.test(c.dataType))) { report.issues.push({ table, reason: 'UNSUPPORTED_IDENTITY' }); continue; }
      const filename = path.join(output, `${table}.jsonl`), fd = fs.openSync(filename, 'wx'); let count = 0;
      const capture = async collect => {
        let cursor = '-9223372036854775808', total = 0; const digest = createHash('sha256');
        while (true) {
          const rows = await q(`SELECT TOP (2000) ${projection(cols)} FROM dbo.${identifier(table)} WHERE IND>@cursor ORDER BY IND`, cursor);
          if (!rows.length) break;
          for (const row of rows) {
            requireRule(BigInt(row.IND) > BigInt(cursor), 'HISTORY_CURSOR_NOT_MONOTONIC'); cursor = String(row.IND);
            const line = JSON.stringify(row) + '\n'; digest.update(line); if (collect) fs.writeSync(fd, line);
            if (collect && descriptor.kind === 'document') headers.push({ key: sourceKey(table, row.IND), table, ...descriptor, row });
            total++;
          }
        }
        return { count: total, hash: digest.digest('hex') };
      };
      let first, second;
      try { first = await capture(true); count = first.count; second = await capture(false); } finally { fs.closeSync(fd); }
      const stable = first.count === second.count && first.hash === second.hash;
      report.tables.push({ table, ...descriptor, count, hash: first.hash, twoPassStable: stable });
      if (!stable) report.issues.push({ table, reason: 'SOURCE_CHANGED_BETWEEN_READS' });
      if (report.tables.length % 20 === 0) console.log(JSON.stringify({ phase: 'history-capture', tables: report.tables.length, total: tables.length, rows: report.tables.reduce((n, t) => n + t.count, 0) }));
    }
    const byType = group(headers, h => `${h.company}/${h.period}/${h.row.BELGETIPI}/${h.row.IND}`), byFamily = group(headers, h => `${h.company}/${h.period}/${h.family}/${h.row.IND}`);
    const prefixCounts = new Map(), headerCounts = [], relations = [], pakelLedgers = [], pakelFinance = [];
    const pakelIds = new Set(read('F0103TBLCARI.json').filter(c => String(c.FIRMAKODU).trim() === 'PAKEL').map(c => String(c.IND)));
    for (const entry of report.tables) {
      if (entry.kind === 'document') {
        const hs = headers.filter(h => h.table === entry.table), scoped = hs.filter(h => h.row.TARIH?.slice(0, 10) >= report.window.startDate && h.row.TARIH.slice(0, 10) < report.window.endExclusive);
        headerCounts.push({ table: entry.table, all: hs.length, inDateWindow: scoped.length, active: scoped.filter(h => h.row.IPTAL === false).length, cancelled: scoped.filter(h => h.row.IPTAL === true).length, unknownCancellation: scoped.filter(h => h.row.IPTAL == null).length });
        if (entry.company === 'F0102' && entry.family === 'STKCIK') for (const h of scoped.filter(h => h.row.IPTAL === false)) { const p = salesperson(h.row.BELGENO).sourcePrefix; prefixCounts.set(p, (prefixCounts.get(p) || 0) + 1); }
        continue;
      }
      const stats = { table: entry.table, linked: 0, relatedOnly: 0, cancelledEffectsExcluded: 0, review: 0 }, detailFile = path.join(output, `${entry.table}-relations.jsonl`), fd = fs.openSync(detailFile, 'wx');
      const content = fs.readFileSync(path.join(output, `${entry.table}.jsonl`), 'utf8');
      try { for (const line of content.split('\n')) {
        if (!line) continue; const row = JSON.parse(line), link = linkHeader(entry.table, row, byType, byFamily);
        if (link.status === 'LINKED') stats.linked++; else if (link.status === 'RELATED_ONLY') stats.relatedOnly++; else if (link.status === 'EXCLUDE_CANCELLED') stats.cancelledEffectsExcluded++; else stats.review++;
        fs.writeSync(fd, JSON.stringify({ key: sourceKey(entry.table, row.IND), ...link }) + '\n');
        if (entry.company === 'F0103' && entry.family === 'CARIHAREKETLERI' && pakelIds.has(String(row.FIRMANO)) && row.TARIH?.startsWith('2026-01-23')) pakelLedgers.push({ key: sourceKey(entry.table, row.IND), row, link });
        if (entry.company === 'F0103' && entry.family === 'KASA' && row.TARIH?.startsWith('2026-01-23') && [row.GELIR, row.GIDER].some(v => v != null && equalDecimal(v, '701330'))) pakelFinance.push({ key: sourceKey(entry.table, row.IND), row, link });
      } } finally { fs.closeSync(fd); }
      relations.push(stats);
    }
    const pakelPairs = [];
    for (const l of pakelLedgers) for (const f of pakelFinance) {
      const amountMatch = [l.row.BORC, l.row.ALACAK].some(v => v != null && equalDecimal(v, multiplyExact('16310', '43')));
      const matched = l.link.status === 'LINKED' && f.link.status === 'LINKED' && l.link.headerKey === f.link.headerKey && amountMatch && currency(l.row.PARABIRIMI) === 'USD' && l.row.KUR != null && f.row.KUR != null && equalDecimal(l.row.KUR, '43') && equalDecimal(f.row.KUR, '43');
      pakelPairs.push({ ledgerKey: l.key, financeKey: f.key, headerKey: l.link.headerKey, amountMatch, sourceFinanceAccount: f.row.KASAADI, linked: matched, paymentMethod: 'UNKNOWN' });
    }
    save('pakel-case.json', { status: pakelPairs.filter(p => p.linked).length === 1 ? 'PASS_SOURCE_RELATION' : 'REVIEW', ledgers: pakelLedgers, finance: pakelFinance, pairs: pakelPairs });
    save('header-counts.json', headerCounts); save('relation-counts.json', relations); save('salesperson-prefixes.json', [...prefixCounts].map(([prefix, count]) => ({ prefix, count, personId: null, status: 'REVIEW' })));
    report.summary = { capturedRows: report.tables.reduce((n, t) => n + t.count, 0), headerRows: headers.length, sourceRelationReviews: relations.reduce((n, t) => n + t.review, 0), cancelledEffectsExcluded: relations.reduce((n, t) => n + t.cancelledEffectsExcluded, 0), pakelLinkedPairs: pakelPairs.filter(p => p.linked).length };
    report.status = report.issues.length ? 'SOURCE_CHANGED_REVIEW_REQUIRED' : 'HISTORY_CAPTURED_NATIVE_APPLY_NOT_IMPLEMENTED';
  } catch (e) { report.status = 'BLOCKED'; report.failure = { code: /^[A-Z_0-9]+$/.test(e.code || e.message) ? e.code || e.message : 'HISTORY_CAPTURE_FAILED', sqlNumber: e.number ?? null }; process.exitCode = 1; }
  finally { if (close) await close().catch(() => {}); save('manifest.json', report); console.log(JSON.stringify({ ...report, tables: undefined })); }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
