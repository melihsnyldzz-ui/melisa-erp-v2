// New specification entrypoint. Old frozen rehearsal runners are not reused.
// This produces an auditable plan and differences; it cannot write to SQL.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SPEC, hash, clean, group, requireRule, assertTestIdentity, stockSelection, resolveUnits, mergeDepots, planBarcodes, planParties, reconciliationSummary, salesperson, sumExact } from '../src/services/vegaMigrationSpecification.mjs';

export function buildPlan({ preflight, captures, targetCaptures, cards, units, quantities, partyCards, activity, products, targetBarcodes, targetParties, migrationMap, targetMetadata, sourceMetadata, census, sales, terminalQueue, decisions = {} }) {
  assertTestIdentity(preflight.targetIdentity);
  requireRule(preflight.status === 'PREFLIGHT_CAPTURED_NOT_MIGRATED' && preflight.window.startDate === SPEC.startDate && preflight.sourcePermissions.writePermissions === false, 'READ_ONLY_PREFLIGHT_REQUIRED');
  requireRule(captures.every(c => c.twoPassStable === true), 'STABLE_MASTER_CAPTURE_REQUIRED');
  const sourceCards = cards.map(c => ({ id: String(c.IND), code: c.STOKKODU, name: c.MALINCINSI }));
  const sourceCodes = group(cards, c => clean(c.STOKKODU));
  const normalizedUnits = units.map(u => ({ id: String(u.IND), productId: String(u.STOKNO), barcode: u.BARCODE, name: u.BIRIMADI, multiplier: u.CARPAN }));
  const barcodePlan = planBarcodes(sourceCards, normalizedUnits, decisions.productMerges || []);
  const byUnits = group(normalizedUnits, u => u.productId), byQuantity = group(quantities.rows, q => String(q.STOKNO)), byTarget = group(products.filter(p => !p.is_deleted), p => clean(p.stock_code));
  const productsById = new Map(products.map(p => [String(p.id), p]));
  const legacy = group(migrationMap.filter(m => m.source_system === SPEC.source && m.entity_type === 'product' && m.company === 'F0102'), m => String(m.source_id));
  const stockDetails = [], stockDifferences = [], productDifferences = [];
  for (const c of cards) {
    const id = String(c.IND), depotRows = byQuantity.get(id), merged = depotRows ? mergeDepots(depotRows.map(r => ({ depotId: r.DEPO, quantity: r.quantity }))) : null;
    const quantity = merged?.quantity ?? c.KALAN, active = c.STATUS === 1 ? true : c.STATUS === 2 ? false : null;
    const selection = stockSelection({ active, quantity }), unit = resolveUnits(byUnits.get(id) || []), explicit = legacy.get(id) || [];
    const targetCandidates = explicit.length === 1 ? [productsById.get(String(explicit[0].target_id))].filter(Boolean) : explicit.length === 0 && sourceCodes.get(clean(c.STOKKODU))?.length === 1 ? byTarget.get(clean(c.STOKKODU)) || [] : [];
    const target = targetCandidates.length === 1 ? targetCandidates[0] : null;
    const data = { sourceId: id, stockCode: c.STOKKODU, name: c.MALINCINSI, active, selection, quantity: quantity ?? null, quantityBasis: merged ? quantities.basis : 'SOURCE_CARD_KALAN', targetDepot: SPEC.depot, sourceDepots: merged?.sourceDepots ?? [{ depotId: c.DEPO, quantity: c.KALAN }], unit, targetId: target?.id ?? null, canonicalSourceId: barcodePlan.canonical[id], brand: c.KOD1, category: c.KOD4, sourcePayloadHash: hash(c), sourcePayloadFile: 'F0102TBLSTOKLAR.json' };
    stockDetails.push(data);
    if (selection.include !== true) continue;
    if (!target) { productDifferences.push({ sourceId: id, reason: targetCandidates.length ? 'AMBIGUOUS_TARGET' : 'MISSING_TARGET', stockCode: c.STOKKODU }); continue; }
    for (const [sourceField, targetField] of [['STOKKODU', 'stock_code'], ['MALINCINSI', 'name'], ['KOD1', 'brand'], ['KOD4', 'category']]) {
      if (String(c[sourceField] ?? '') !== String(target[targetField] ?? '')) productDifferences.push({ sourceId: id, targetId: target.id, field: targetField, source: c[sourceField], target: target[targetField] });
    }
    // Comparison is signed; retained terminal effects are reconciled separately.
    const actual = target.current_stock_qty == null ? null : String(target.current_stock_qty);
    const difference = quantity == null || actual == null ? null : sumExact([actual, String(quantity).startsWith('-') ? String(quantity).slice(1) : `-${quantity}`]);
    if (difference !== '0') stockDifferences.push({ sourceId: id, targetId: target.id, sourceQuantity: quantity, targetQuantity: actual, difference, phase: 'BEFORE_MIGRATION_TERMINAL_DELTA_NOT_SUBTRACTED' });
  }
  const included = new Set(stockDetails.filter(s => s.selection.include === true).map(s => s.sourceId));
  const targetBarcodeMap = group(targetBarcodes.filter(b => b.is_active), b => String(b.barcode));
  const stockById = new Map(stockDetails.map(s => [s.sourceId, s]));
  const barcodeDifferences = [];
  for (const b of barcodePlan.mappings.filter(b => b.sourceIds.some(id => included.has(id)))) {
    const target = stockById.get(b.canonicalSourceId)?.targetId, matches = targetBarcodeMap.get(b.barcode) || [];
    if (!target || matches.length !== 1 || String(matches[0].product_id) !== String(target)) barcodeDifferences.push({ ...b, expectedTargetId: target ?? null, actualTargetIds: matches.map(m => m.product_id), reason: matches.length ? 'BARCODE_TARGET_CONFLICT' : 'BARCODE_MISSING' });
  }
  const historyAccounts = new Set(activity.flatMap(a => a.rows.map(r => `${a.table.slice(0, 5)}/${r.FIRMANO}`)));
  const normalizedParties = partyCards.flatMap(({ company, rows }) => rows.map(c => ({ key: `${company}/${c.IND}`, company, id: c.IND, code: c.FIRMAKODU, name: c.FIRMAADI, currency: c.PARABIRIMI, active: c.STATUS === 1 ? true : c.STATUS === 2 ? false : null, balances: [{ currency: c.PARABIRIMI, amount: c.BAKIYE }], hasHistory: historyAccounts.has(`${company}/${c.IND}`), contact: Object.fromEntries(Object.entries(c).filter(([k]) => /TELEFON|ADRES|SEHIR|ULKE|MAIL/.test(k))), sourcePayloadHash: hash(c), balanceBasis: 'CARD_VALUE_FOR_SCOPE_ONLY_NOT_VERIFIED_CURRENCY_BALANCE' })));
  const parties = planParties(normalizedParties, decisions.partyGroups || []);
  const targetPartyMap = new Map(targetParties.map(p => [`${p.role}/${p.code}/${p.currency}`, p]));
  const partyDifferences = parties.accounts.filter(a => !targetPartyMap.has(`${a.role}/${clean(a.code)}/${a.accountCurrency}`)).map(a => ({ sourceKey: a.key, role: a.role, code: a.code, currency: a.accountCurrency, reason: 'MISSING_EXACT_CODE_CURRENCY_ACCOUNT' }));
  const periods = preflight.periods.map(p => {
    const prefix = `F${String(p.FIND).padStart(4, '0')}D${String(p.IND).padStart(4, '0')}`;
    const tables = census.filter(t => t.table.startsWith(prefix) && ['document', 'movement', 'line_or_auxiliary'].includes(t.kind));
    const core = tables.filter(t => /TBL(STKCIKBASLIK|ALFATBASLIK|STOKHAREKETLERI|CARIHAREKETLERI)$/.test(t.table));
    return { company: prefix.slice(0, 5), period: prefix.slice(5), year: p.DONEM, tables: tables.length, nonempty: tables.filter(t => t.rows !== '0').length, core: core.map(t => ({ table: t.table, rows: t.rows, firstDate: t.firstDate, lastDate: t.lastDate })), dateAnomalies: core.filter(t => t.rows !== '0' && (t.firstDate?.slice(0, 4) !== String(p.DONEM) || t.lastDate?.slice(0, 4) !== String(p.DONEM))) };
  });
  const structureDifferences = [];
  for (const company of ['F0102', 'F0103']) for (const family of ['STKCIKBASLIK', 'STKCIKHAREKET', 'ALFATBASLIK', 'ALFATHAREKET', 'CARIHAREKETLERI', 'STOKHAREKETLERI', 'KASA']) {
    const reference = new Map(sourceMetadata.filter(c => c.tableName === `${company}D0007TBL${family}`).map(c => [c.columnName, c.dataType]));
    for (const period of ['D0001', 'D0002']) {
      const table = `${company}${period}TBL${family}`, cols = sourceMetadata.filter(c => c.tableName === table), index = new Map(cols.map(c => [c.columnName, c.dataType]));
      const missing = [...reference.keys()].filter(k => !index.has(k)), changed = cols.filter(c => reference.has(c.columnName) && reference.get(c.columnName) !== c.dataType);
      if (!cols.length || missing.length || changed.length) structureDifferences.push({ table, missing, changed });
    }
  }
  const protectedIds = [...new Set([...terminalQueue.filter(q => q.target_entity === 'sales_invoice').map(q => String(q.target_entity_id)), ...sales.filter(s => s.terminal_client_event_id || s.client_event_id || /terminalClientEventId:/.test(s.description || '')).map(s => String(s.id))])];
  const salespersonMappings = [...group(sales.filter(s => s.is_migrated), s => salesperson(s.document_no, decisions.people).sourcePrefix)].map(([prefix, rs]) => ({ prefix, count: rs.length, ...salesperson(rs[0].document_no, decisions.people) }));
  const blockers = ['FULL_HISTORY_ROWS_AND_RELATIONS_NOT_CAPTURED', 'CANCELLED_EFFECT_RECONCILIATION_REQUIRED', 'ANNUAL_CARRYOVER_DEDUPLICATION_REQUIRED', 'NATIVE_MULTI_CURRENCY_PARTY_ACCOUNTS_REQUIRED', 'NATIVE_LINE_DISCOUNT_AND_RETURN_ADAPTERS_REQUIRED', 'F0104_RELATION_REVIEW', 'PAKEL_LIVE_RELATION_ACCEPTANCE_REQUIRED', 'ALL_DIMENSION_TARGET_RECONCILIATION_REQUIRED', 'FRESH_BACKUP_REQUIRED_BEFORE_APPLY'];
  if (barcodePlan.conflicts.length) blockers.push('CROSS_PRODUCT_BARCODE_REVIEW');
  if (stockDetails.some(s => s.selection.include === null || s.quantity === null)) blockers.push('UNKNOWN_STOCK_SCOPE_OR_QUANTITY');
  if (stockDetails.some(s => s.selection.include && s.unit.status !== 'VERIFIED')) blockers.push('UNIT_EVIDENCE_REVIEW');
  if (parties.reviews.length) blockers.push('PARTY_IDENTITY_REVIEW');
  if (salespersonMappings.some(s => s.status !== 'VERIFIED')) blockers.push('SALESPERSON_MAPPING_REVIEW');
  const plan = { specification: SPEC, run: preflight.run, window: preflight.window, mode: 'PLAN_ONLY', sourceHash: hash(captures), targetHash: hash(targetCaptures), sourceAtomic: false, targetAtomic: false, periods, structureDifferences2020_2021: structureDifferences, targetPartySchema: targetMetadata.filter(c => ['customers', 'suppliers'].includes(c.tableName)).map(c => ({ table: c.tableName, column: c.columnName })), counts: { sourceCards: cards.length, includedCards: included.size, excludedPassiveZero: stockDetails.filter(s => s.selection.include === false).length, unknownStockScope: stockDetails.filter(s => s.selection.include === null).length, negativeCards: stockDetails.filter(s => s.quantity != null && String(s.quantity).startsWith('-')).length, allBarcodeMappings: barcodePlan.mappings.length, barcodeConflicts: barcodePlan.conflicts.length, productDifferences: productDifferences.length, stockDifferences: stockDifferences.length, barcodeDifferences: barcodeDifferences.length, partyDifferences: partyDifferences.length, customerAccounts: parties.accounts.filter(a => a.role === 'customer').length, supplierAccounts: parties.accounts.filter(a => a.role === 'supplier').length }, protectedIds, protectedQueueHash: hash(terminalQueue), protectedSalesHash: hash(sales.filter(s => protectedIds.includes(String(s.id)))), blockers, reconciliation: reconciliationSummary({}), status: 'BLOCKED_FOR_APPLY', liveEnabled: false, clearExistingData: false, rollbackSuccessfulRecords: false };
  plan.planHash = hash(plan);
  return { plan, stockDetails, negativeStocks: stockDetails.filter(s => s.quantity != null && String(s.quantity).startsWith('-')), productDifferences, stockDifferences, barcodeDifferences, barcodePlan, parties, partyDifferences, salespersonMappings };
}

export function main(args = process.argv.slice(2)) {
  requireRule(args.length === 1 && /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/.test(args[0] || ''), 'PLAN_RUN_REQUIRED_NO_APPLY_MODE');
  const directory = path.join(process.env.LOCALAPPDATA, 'MelisaERPServer/migration-spec', args[0]);
  const read = name => JSON.parse(fs.readFileSync(path.join(directory, name)));
  const captures = read('source-captures.json'), targetCaptures = read('target-captures.json');
  for (const c of [...captures, ...targetCaptures.map(t => ({ ...t, table: `target-${t.table}` }))]) requireRule(hash(read(`${c.table}.json`)) === c.hash, 'CAPTURE_HASH_CHANGED');
  const result = buildPlan({ preflight: read('preflight.json'), captures, targetCaptures, cards: read('F0102TBLSTOKLAR.json'), units: read('F0102TBLBIRIMLEREX.json'), quantities: read('current-quantities.json'), partyCards: ['F0102', 'F0103', 'F0104'].map(company => ({ company, rows: read(`${company}TBLCARI.json`) })), activity: read('party-activity.json'), products: read('target-products.json'), targetBarcodes: read('target-product_barcodes.json'), targetParties: ['customer', 'supplier'].flatMap(role => read(`target-${role}s.json`).map(p => ({ ...p, role, code: clean(p[`${role}_code`]), currency: p.currency_code }))), migrationMap: read('target-migration_map.json'), targetMetadata: read('target-metadata.json'), sourceMetadata: read('source-metadata.json'), census: read('source-census.json'), sales: read('target-sales_invoices.json'), terminalQueue: read('target-terminal_sync_queue.json'), decisions: fs.existsSync(path.join(directory, 'reviewed-decisions.json')) ? read('reviewed-decisions.json') : {} });
  // Exclusive directory means a failed/old plan is never overwritten.
  const output = path.join(directory, 'plan'); fs.mkdirSync(output);
  for (const [name, value] of Object.entries(result)) fs.writeFileSync(path.join(output, `${name}.json`), JSON.stringify(value), { flag: 'wx' });
  const summary = { ...result.plan, periods: undefined, targetPartySchema: undefined, protectedSalesHash: undefined, protectedQueueHash: undefined, privateDetails: output };
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2), { flag: 'wx' });
  const publicPath = fileURLToPath(new URL('../../../artifacts/migration-spec-20260917/', import.meta.url)); fs.mkdirSync(publicPath, { recursive: true });
  fs.writeFileSync(path.join(publicPath, `${args[0]}-summary.json`), JSON.stringify(summary, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(summary));
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
