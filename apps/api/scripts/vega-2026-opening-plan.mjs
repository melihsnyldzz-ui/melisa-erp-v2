import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTestPool, root, hash, requireRule } from './vega-native-migration-runtime.mjs';
import { readHistory, headers, link, key, ledgerEffect, add } from './vega-native-migration-adapters.mjs';
import { patchId, patchPrefix, is2026Opening, compareOpening } from './vega-2026-opening-model.mjs';

export const directory = path.join(root, patchId);
export function save(name, value) {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, name), JSON.stringify(value), { flag: 'wx' });
}
export const read = name => JSON.parse(fs.readFileSync(path.join(directory, name)));

export async function makePlan(request) {
  const accounts = (await request().query('SELECT id,party_entity_id,currency_code,customer_id,supplier_id,CONVERT(varchar(100),current_balance) current_balance FROM dbo.party_currency_accounts ORDER BY id')).recordset;
  const sourceLinks = (await request().query('SELECT party_entity_id,source_company,source_id,customer_id,supplier_id FROM dbo.party_source_links ORDER BY id')).recordset;
  const hs = headers(), hm = new Map(hs.all.map(h => [h.key, h]));
  const sources = [], rejected = [], excluded = [], movements = [];
  for (const company of ['F0102', 'F0103']) {
    const role = company === 'F0102' ? 'customer' : 'supplier';
    const table = company + 'D0007TBLCARIHAREKETLERI';
    for (const row of readHistory(table)) {
      if (!is2026Opening(row)) continue;
      const sourceKey = key(table, row.IND), linked = link(table, row, hs), header = hm.get(linked.headerKey);
      if (linked.status === 'EXCLUDE_CANCELLED' || header?.row.IPTAL === true) { excluded.push({ sourceKey, reason: 'CANCELLED' }); continue; }
      if (linked.status !== 'LINKED' || header?.row.IPTAL !== false) { rejected.push({ sourceKey, reason: 'SOURCE_OPENING_HEADER_UNRESOLVED' }); continue; }
      let money;
      try { money = ledgerEffect(row, role); } catch { rejected.push({ sourceKey, reason: 'SOURCE_OPENING_CURRENCY_AMOUNT_UNRESOLVED' }); continue; }
      const links = sourceLinks.filter(l => l.source_company === company && String(l.source_id) === String(row.FIRMANO));
      const matches = accounts.filter(a => links.some(l => String(l.party_entity_id) === String(a.party_entity_id)) && a.currency_code === money.currency);
      if (links.length !== 1 || matches.length !== 1) { rejected.push({ sourceKey, reason: 'SOURCE_OPENING_ACCOUNT_UNRESOLVED' }); continue; }
      sources.push({ accountId: String(matches[0].id), role, sourceKey, headerKey: header.key, effect: money.effect, currency: money.currency, raw: row, headerHash: hash(header.row), payloadHash: hash(row) });
    }
    movements.push(...(await request().query(`SELECT id,${role}_id party_id,party_entity_id,party_currency_account_id,COALESCE(account_currency,currency_code) currency_code,CONVERT(varchar(10),document_date,23) document_date,affects_balance,CONVERT(varchar(100),COALESCE(balance_effect_exact,CONVERT(decimal(28,8),balance_effect))) effect,source_record_key,source_payload_hash,source_document_key,N'${role}' role FROM dbo.${role}_movements ORDER BY id`)).recordset);
  }
  const grouped = new Map();
  for (const m of movements) {
    const matches = m.party_currency_account_id ? accounts.filter(a => String(a.id) === String(m.party_currency_account_id)) : accounts.filter(a => String(a[m.role + '_id']) === String(m.party_id) && a.currency_code === m.currency_code);
    if (!matches.length) continue;
    requireRule(matches.length === 1, 'MOVEMENT_ACCOUNT_NOT_UNIQUE');
    const id = String(matches[0].id);
    requireRule(matches[0].currency_code === m.currency_code, 'CURRENCY_MIX_REJECTED');
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(m);
  }
  const details = accounts.map(a => {
    const id = String(a.id), src = sources.filter(s => s.accountId === id), ms = grouped.get(id) || [];
    const role = a.customer_id != null ? 'customer' : 'supplier';
    const base = { accountId: id, partyEntityId: String(a.party_entity_id), partyId: String(a[role + '_id']), role, currency: a.currency_code, currentBalance: a.current_balance };
    if (!src.length) return { ...base, status: 'NO_EXPLICIT_2026_OPENING', historical: compareOpening('0', ms, new Set()).historical };
    for (const s of src) {
      const matches = ms.filter(m => m.source_record_key === s.sourceKey);
      requireRule(matches.length === 1 && matches[0].source_payload_hash === s.payloadHash && matches[0].effect === s.effect && matches[0].source_document_key === s.headerKey, 'NATIVE_SOURCE_OPENING_MISMATCH');
    }
    const correctionKey = patchPrefix + a.party_entity_id + '/' + a.currency_code;
    const comparison = compareOpening(add(src.map(s => s.effect)), ms, new Set(src.map(s => s.sourceKey)));
    const existing = ms.filter(m => m.source_record_key?.startsWith(patchPrefix));
    requireRule(existing.length <= 1 && existing.every(m => m.source_record_key === correctionKey), 'DUPLICATE_CORRECTION');
    return { ...base, status: comparison.remaining === '0.00000000' ? 'MATCHED' : 'DIFFERENT', correctionKey, ...comparison, sources: src.map(({ raw, ...s }) => s), existingCorrectionCount: existing.length };
  });
  const summary = { totalAccounts: details.length, sourceOpeningRows: sources.length, anchoredAccounts: details.filter(d => d.sources).length, differenceAccounts: details.filter(d => d.status === 'DIFFERENT').length, noExplicitOpeningAccounts: details.filter(d => !d.sources).length, rejectedSourceRecords: rejected.length, cancelledSourceRecords: excluded.length };
  return { patchId, sourceSnapshot: 'spec-20260917-01', summary, details, rejected, excluded, sourceHash: hash(sources), ledgerHash: hash(movements.filter(m => !m.source_record_key?.startsWith(patchPrefix))) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pool = await getTestPool();
  try { const plan = await makePlan(() => pool.request()); save('plan.json', plan); console.log(JSON.stringify({ ...plan.summary, pakel: plan.details.find(d => d.role === 'supplier' && d.partyId === '10183' && d.currency === 'USD') })); }
  finally { await pool.close(); }
}
