// This process has only the configured read-only Vega login. No target writer.
import { fileURLToPath } from 'node:url';
import tedious from 'mssql/tedious.js';
import { identitySql, assertSourceIdentity, permissionsSql, assertReadOnlyPermissions, projection, identifier } from './vega-migration-spec-preflight.mjs';
import { readSource, requireRule, hash } from './vega-native-migration-runtime.mjs';
import { headers, readHistory, link } from './vega-native-migration-adapters.mjs';
import { is2026Opening, patchId } from './vega-2026-opening-model.mjs';
import { save } from './vega-2026-opening-plan.mjs';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const { getVegaSqlConfig } = await import('../src/config/vegaDatabase.js');
class SourcePool extends tedious.ConnectionPool { request() { return new tedious.Request(this); } }
const pool = await new SourcePool(getVegaSqlConfig()).connect();
try {
  const q = async statement => {
    requireRule(/^SELECT\b/.test(statement), 'SOURCE_SELECT_ONLY');
    return (await pool.request().query(statement)).recordset;
  };
  assertSourceIdentity((await q(identitySql))[0]);
  const metadata = readSource('source-metadata.json'), hs = headers(), hm = new Map(hs.all.map(h => [h.key, h]));
  const captured = [], wantedHeaders = new Map();
  for (const company of ['F0102', 'F0103']) {
    const table = company + 'D0007TBLCARIHAREKETLERI';
    assertReadOnlyPermissions(await q(permissionsSql([table])), [table]);
    const expected = [...readHistory(table)].filter(is2026Opening);
    const statement = `SELECT ${projection(metadata.filter(c => c.tableName === table))} FROM dbo.${identifier(table)} WHERE TARIH>='20260101' AND TARIH<'20260102' AND IZAHAT IN ('103','104') ORDER BY IND`;
    const actual = await q(statement), again = await q(statement);
    requireRule(hash(expected) === hash(actual) && hash(actual) === hash(again), 'LIVE_OPENING_SOURCE_CHANGED');
    captured.push({ table, rows: actual.length, hash: hash(actual) });
    for (const r of expected) {
      const h = hm.get(link(table, r, hs).headerKey);
      requireRule(h, 'OPENING_HEADER_REQUIRED');
      if (!wantedHeaders.has(h.table)) wantedHeaders.set(h.table, []);
      wantedHeaders.get(h.table).push(h.row);
    }
  }
  for (const [table, raw] of wantedHeaders) {
    assertReadOnlyPermissions(await q(permissionsSql([table])), [table]);
    const unique = [...new Map(raw.map(r => [r.IND, r])).values()].sort((a,b) => Number(a.IND)-Number(b.IND));
    const ids = unique.map(r => String(r.IND)); requireRule(ids.every(v => /^\d+$/.test(v)), 'HEADER_IDS');
    const statement = `SELECT ${projection(metadata.filter(c => c.tableName === table))} FROM dbo.${identifier(table)} WHERE IND IN (${ids.join(',')}) ORDER BY IND`;
    const actual = await q(statement), again = await q(statement);
    requireRule(hash(unique) === hash(actual) && hash(actual) === hash(again), 'LIVE_OPENING_HEADER_CHANGED');
    captured.push({ table, rows: actual.length, hash: hash(actual) });
  }
  const result = { patchId, at: new Date().toISOString(), source: 'VEGA2026', mode: 'SELECT_ONLY', writes: 0, matchesFrozenSource: true, captured };
  save('source-check.json', result); console.log(JSON.stringify(result));
} finally { await pool.close(); }
