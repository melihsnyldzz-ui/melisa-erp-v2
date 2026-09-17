import test from 'node:test';
import assert from 'node:assert/strict';
import { SPEC, hash, sumExact, stockSelection, resolveUnits, mergeDepots, planBarcodes, partySelection, planParties, migrationWindow, salesperson, planHistory, openingBalances, verifyPakelRelationship, reconcileDimension, reconciliationSummary, assertWritePrerequisites, assertTestIdentity } from '../src/services/vegaMigrationSpecification.mjs';
import { sourceTableKind, projection, identifier, assertReadOnlyPermissions } from './vega-migration-spec-preflight.mjs';
import { historyTable, sourceKey, linkHeader } from './vega-migration-spec-history.mjs';
import { buildPlan } from './vega-migration-spec-plan.mjs';

const window = migrationWindow({ endExclusive: '2026-09-18' });
test('exact quantities including negative and more than four decimal places', () => {
  assert.equal(sumExact(['9007199254740993', '-0.000001', '0.1']), '9007199254740993.099999');
  assert.throws(() => sumExact([null]), /DECIMAL_REQUIRED/);
});
test('active zero included; passive zero excluded; passive negative preserved', () => {
  assert.equal(stockSelection({ active: true, quantity: '0' }).include, true);
  assert.equal(stockSelection({ active: false, quantity: '0' }).include, false);
  assert.equal(stockSelection({ active: false, quantity: '-3' }).include, true);
  assert.equal(stockSelection({ active: false, quantity: null }).include, null);
});
test('duplicate ADET technical ids do not make stock UNKNOWN', () => {
  assert.equal(resolveUnits([{ id: 3, name: 'ADET', multiplier: '1' }, { id: 6, name: ' adet ', multiplier: '1.0000' }]).status, 'VERIFIED');
  assert.equal(resolveUnits([{ id: 3, name: 'ADET', multiplier: '12' }]).status, 'REVIEW');
});
test('all depots merge with exact signed total; duplicate depot observations rejected', () => {
  assert.deepEqual(mergeDepots([{ depotId: 1, quantity: '10' }, { depotId: 2, quantity: '-12.25' }]).quantity, '-2.25');
  assert.throws(() => mergeDepots([{ depotId: 1, quantity: '1' }, { depotId: 1, quantity: '1' }]), /DUPLICATE_DEPOT/);
});
const cards = [{ id: 1, code: 'A', name: 'Model 1' }, { id: 2, code: 'B', name: 'Model 1' }];
test('all alternative barcodes are retained, leading zeros preserved', () => {
  const p = planBarcodes(cards, [{ id: 1, productId: 1, barcode: '001' }, { id: 2, productId: 1, barcode: '002' }]);
  assert.deepEqual(p.mappings.map(r => r.barcode), ['001', '002']);
});
test('shared barcode and equal name still require a reviewed duplicate decision', () => {
  const units = [{ id: 1, productId: 1, barcode: '001' }, { id: 2, productId: 2, barcode: '001' }];
  assert.equal(planBarcodes(cards, units).conflicts.length, 1);
  const merge = { approved: true, reference: 'owner-review-1', sourceIds: [1, 2], canonicalId: 1, evidenceHash: hash(cards), nameModelEvidence: 'Same model confirmed' };
  const p = planBarcodes(cards, units, [merge]);
  assert.equal(p.mappings.length, 1); assert.equal(p.sourceCodeAliases.length, 2);
  assert.throws(() => planBarcodes(cards, units, [{ ...merge, evidenceHash: 'changed' }]), /MERGE_EVIDENCE_CHANGED/);
});
test('passive party with balance OR history survives; F0104 never auto-classified', () => {
  const p = { company: 'F0103', active: false, balances: [{ currency: 'USD', amount: '0' }], hasHistory: true };
  assert.equal(partySelection(p).include, true);
  assert.equal(partySelection({ ...p, hasHistory: false }).include, false);
  assert.equal(partySelection({ ...p, company: 'F0104' }).include, null);
  assert.equal(partySelection({ ...p, hasHistory: false, balances: [{ amount: '-4' }] }).include, true);
});
const party = (key, code, cur) => ({ key, code, name: code, currency: cur, company: 'F0102', active: true, balances: [{ currency: cur, amount: '0' }], hasHistory: false });
test('three cash customers stay separate even with a proposed group', () => {
  const rows = [party('a', '1-PEŞİN $', 'USD'), party('b', '2-PEŞİN TL', 'TL'), party('c', '3-PEŞİN €', 'EUR')];
  assert.equal(planParties(rows).parties.length, 3);
  assert.throws(() => planParties(rows, [{ keys: ['a', 'b'], verified: true, reference: 'x', evidenceHash: hash(rows.slice(0, 2)) }]), /PARTY_GROUP_INVALID/);
});
test('verified real party groups preserve every currency account and code', () => {
  const rows = [party('a', 'A-USD', 'USD'), party('b', 'A-EUR', 'EUR')];
  const p = planParties(rows, [{ keys: ['a', 'b'], verified: true, reference: 'owner', evidenceHash: hash(rows) }]);
  assert.equal(p.parties.length, 1); assert.deepEqual(p.accounts.map(a => a.accountCurrency), ['USD', 'EUR']);
  assert.deepEqual(p.accounts.map(a => a.code), ['A-USD', 'A-EUR']);
});
test('start cannot silently move from 2020; invalid dates rejected', () => {
  assert.throws(() => migrationWindow({ startDate: '2022-01-01', endExclusive: '2026-09-18' }), /START_YEAR_OWNER_APPROVAL_REQUIRED/);
  assert.throws(() => migrationWindow({ endExclusive: '2026-02-30' }), /VALID_MIGRATION_WINDOW/);
  assert.equal(migrationWindow({ startDate: '2022-01-01', endExclusive: '2026-09-18', startApproval: { startDate: '2022-01-01', approved: true, reference: 'owner' } }).openingRequired, true);
});
const doc = (key, more = {}) => ({ key, company: 'F0102', number: 'AHM-001', date: '2020-01-12T10:00:00', kind: 'stock_exit', cancelled: false, lines: [{ code: 'P', quantity: '3', price: '2.15', discount: '7.25', note: 'original' }], note: 'source note', ...more });
const effect = (key, documentKey, more = {}) => ({ key, documentKey, kind: 'stock', verifiedEffectKey: key, effectEvidenceHash: hash({ quantity: '-3' }), ...more });
test('cancelled documents and effects excluded; real returns and original fields retained', () => {
  const original = doc('return', { kind: 'return' });
  const p = planHistory({ documents: [doc('cancel', { cancelled: true }), original], effects: [effect('e1', 'cancel'), effect('e2', 'return')], window });
  assert.equal(p.effects.length, 1); assert.equal(p.documents.length, 1);
  assert.deepEqual(p.documents[0].lines, original.lines); assert.equal(p.documents[0].date, original.date);
});
test('unlinked and cancelled-state-unknown effects cannot be posted', () => {
  const p = planHistory({ documents: [doc('x', { cancelled: null })], effects: [effect('a', 'absent'), effect('b', 'x')], window });
  assert.equal(p.effects.length, 0); assert.equal(p.reviews.length, 2);
});
test('linked invoice and stock slip retain both documents but one verified stock effect', () => {
  const documents = [doc('a'), doc('b', { kind: 'sales_invoice' })];
  const eventLinks = [{ documentKeys: ['a', 'b'], eventKey: 'event-1', verified: true, reference: 'explicit-link', evidenceHash: hash(documents) }];
  const effects = [effect('s1', 'a', { verifiedEffectKey: 'shared' }), effect('s2', 'b', { verifiedEffectKey: 'shared' })];
  const p = planHistory({ documents, effects, window, eventLinks });
  assert.equal(p.documents.length, 2); assert.equal(p.effects.length, 1); assert.equal(p.effects[0].sourceKeys.length, 2);
  assert.equal(planHistory({ documents, effects, window }).reviews[0].reason, 'DUPLICATE_EVENT_EFFECT_CONFLICT');
});
test('annual carryover cannot duplicate historical activity', () => {
  const p = planHistory({ documents: [doc('a')], effects: [effect('x', 'a', { periodCarryover: true })], window });
  assert.equal(p.effects.length, 0); assert.equal(p.excluded[0].reason, 'PERIOD_CARRYOVER_RECONCILE_ONLY');
});
test('orders, cheques, F0104 are not silently mapped into sales', () => {
  const p = planHistory({ documents: [doc('a', { kind: 'order' }), doc('b', { kind: 'cheque' }), doc('c', { company: 'F0104' })], effects: [], window });
  assert.equal(p.documents.length, 0); assert.equal(p.reviews[0].reason, 'F0104_RELATION_REVIEW');
});
test('prefix preserves salesperson evidence without guessing a person', () => {
  assert.deepEqual(salesperson('AHM001').sourcePrefix, 'AHM'); assert.equal(salesperson('TUR-012').personId, null);
  assert.equal(salesperson('AHM001', { AHM: { verified: true, personId: 3, reference: 'owner' } }).personId, 3);
});
test('opening balances remain separate and require the exact start-date evidence', () => {
  const balancesAtStart = ['USD', 'EUR', 'TL'].map(currency => ({ currency, amount: '5', verified: true, evidence: 'source-row', asOf: window.startDate }));
  assert.deepEqual(openingBalances({ balancesAtStart, window }).map(r => r.currency), ['USD', 'EUR', 'TRY']);
  assert.throws(() => openingBalances({ balancesAtStart: [{ ...balancesAtStart[0], asOf: '2022-01-01' }], window }), /OPENING_BALANCE_EVIDENCE/);
});
test('PAKEL 16310 USD / 701330 / 43 needs a linked source transaction; MERKEZ does not imply cash', () => {
  const ledger = { key: 'l', company: 'F0103', partyCode: 'PAKEL', date: '2026-01-23', currency: 'USD', amount: '16310' };
  const finance = { key: 'f', accountCode: 'MERKEZ', date: '2026-01-23', amount: '701330', rate: '43' };
  assert.equal(verifyPakelRelationship({ ledger, finance }).status, 'REVIEW');
  const proof = verifyPakelRelationship({ ledger, finance, link: { verified: true, reference: 'source-doc', ledgerKey: 'l', financeKey: 'f' } });
  assert.equal(proof.status, 'PASS'); assert.equal(proof.paymentMethod, 'UNKNOWN'); assert.equal(proof.createFinancialEvents, 1);
});
test('record reconciliation detects field loss, missing/extra rows and duplicate keys', () => {
  assert.equal(reconcileDimension([{ key: '1', note: 'hello' }], [{ key: '1' }], ['note']).details[0].reason, 'UNVERIFIED_FIELD');
  assert.equal(reconcileDimension([{ key: '1', v: 1 }], [{ key: '2', v: 1 }], ['v']).differenceCount, 2);
  assert.equal(reconcileDimension([{ key: '1' }, { key: '1' }], [], ['v']).details[0].reason, 'DUPLICATE_KEY');
  assert.equal(reconciliationSummary({}).status, 'PARTIAL');
});
test('only exact TEST identity accepted; backup and full evidence needed; no cleanup flag', () => {
  assert.throws(() => assertTestIdentity({ database: 'MELISA_ERP_V2', server: SPEC.server }), /EXACT_TEST_TARGET/);
  const proof = { identity: { database: SPEC.target, server: SPEC.server }, backup: { status: 'PASS_VERIFIED_TEST_BACKUP', database: SPEC.target, identity: { server: SPEC.server }, planHash: 'c'.repeat(64), backupSetGuid: 'g', targetHash: 'd'.repeat(64) }, planHash: 'c'.repeat(64), targetBeforeHash: 'd'.repeat(64), targetNowHash: 'd'.repeat(64), protectedBeforeHash: 'a'.repeat(64), protectedNowHash: 'a'.repeat(64), unresolved: [], adaptersVerified: true };
  assert.equal(assertWritePrerequisites(proof).clearExistingData, false);
  assert.equal(assertWritePrerequisites(proof).rollbackSuccessfulRecords, false);
  assert.throws(() => assertWritePrerequisites({ ...proof, unresolved: ['missing'] }), /MIGRATION_NOT_READY/);
  assert.throws(() => assertWritePrerequisites({ ...proof, protectedNowHash: 'b'.repeat(64) }), /PROTECTED_TERMINAL_CHANGED/);
  assert.throws(() => assertWritePrerequisites({ ...proof, targetNowHash: 'b'.repeat(64) }), /TARGET_CHANGED_AFTER_BACKUP/);
});
test('source discovery includes 2020 period and alternatives; column capture excludes credentials/media', () => {
  assert.equal(sourceTableKind('F0102D0001TBLSTKCIKBASLIK'), 'document');
  assert.equal(sourceTableKind('F0102TBLBIRIMLEREX'), 'master');
  assert.equal(sourceTableKind('F0103D0002TBLSIPBASLIK'), 'excluded_order_or_cheque');
  assert.throws(() => identifier('x];DROP'), /IDENTIFIER_REJECTED/);
  const p = projection([{ columnName: 'ACIKLAMA', dataType: 'nvarchar' }, { columnName: 'PASSWORD', dataType: 'nvarchar' }, { columnName: 'RESIM', dataType: 'image' }]);
  assert.equal(p, '[ACIKLAMA]');
  assert.throws(() => assertReadOnlyPermissions([{ table: 'x', canSelect: 1, INSERT: 1 }], ['x']), /SOURCE_EFFECTIVE_PERMISSIONS/);
});
test('historical identity includes company and period; source ids repeating annually are distinct', () => {
  assert.notEqual(sourceKey('F0102D0001TBLSTKCIKBASLIK', 1), sourceKey('F0102D0002TBLSTKCIKBASLIK', 1));
  assert.equal(historyTable('F0103D0001TBLCARCIKIADEBASLIK').family, 'CARCIKIADE');
  assert.equal(historyTable('F0102D0001TBLSIPBASLIK'), null);
});
test('source fact linkage distinguishes cancellation, ambiguity, and period', () => {
  const cancelled = { key: 'c', row: { IPTAL: true } };
  const type = new Map([['F0103/D0007/11/22', [cancelled]]]);
  assert.equal(linkHeader('F0103D0007TBLKASA', { BELGEIZAHAT: 11, BELGELINK: 22 }, type, new Map()).status, 'EXCLUDE_CANCELLED');
  assert.equal(linkHeader('F0103D0006TBLKASA', { BELGEIZAHAT: 11, BELGELINK: 22 }, type, new Map()).reason, 'ORPHAN_HEADER_LINK');
  type.set('F0103/D0007/11/22', [cancelled, cancelled]);
  assert.equal(linkHeader('F0103D0007TBLKASA', { BELGEIZAHAT: 11, BELGELINK: 22 }, type, new Map()).reason, 'AMBIGUOUS_HEADER_LINK');
});
test('general ledger references use BELGEIND and ISLEMIND without a duplicate posting', () => {
  const h = { key: 'h', row: { IPTAL: false } }, index = new Map([['F0103/D0007/11/22', [h]]]);
  const link = linkHeader('F0103D0007TBLCARIGENELHAREKET', { BELGEIZAHAT: 11, BELGEIND: 22, ISLEMIZAHAT: 11, ISLEMIND: 22 }, index, new Map());
  assert.equal(link.status, 'RELATED_ONLY'); assert.deepEqual(link.relatedHeaderKeys, ['h']);
  assert.equal(link.reason, 'NO_ADDITIONAL_FINANCIAL_POSTING');
});
test('new entrypoint applies signed quantities, all barcodes and source scope to an actual plan', () => {
  const p = buildPlan({ preflight: { targetIdentity: { database: SPEC.target, server: SPEC.server }, status: 'PREFLIGHT_CAPTURED_NOT_MIGRATED', window, sourcePermissions: { writePermissions: false }, periods: [], run: 'test' }, captures: [], targetCaptures: [], cards: [{ IND: 1, STOKKODU: 'A', MALINCINSI: 'A', STATUS: 1, KALAN: '-2', KOD1: 'B', KOD4: 'C' }, { IND: 2, STOKKODU: 'Z', STATUS: 2, KALAN: '0' }], units: [{ IND: 1, STOKNO: 1, BARCODE: '001', BIRIMADI: 'ADET', CARPAN: '1' }, { IND: 2, STOKNO: 1, BARCODE: '002', BIRIMADI: 'ADET', CARPAN: '1' }], quantities: { rows: [] }, partyCards: [], activity: [], products: [{ id: 9, stock_code: 'A', name: 'A', brand: 'B', category: 'C', current_stock_qty: '-2', is_deleted: false }], targetBarcodes: [{ product_id: 9, barcode: '001', is_active: true }], targetParties: [], migrationMap: [], targetMetadata: [], sourceMetadata: [], census: [], sales: [], terminalQueue: [] });
  assert.equal(p.plan.counts.includedCards, 1); assert.equal(p.plan.counts.excludedPassiveZero, 1);
  assert.equal(p.stockDifferences.length, 0); assert.equal(p.barcodeDifferences.length, 1);
  assert.equal(p.stockDetails[0].unit.status, 'VERIFIED'); assert.equal(p.plan.status, 'BLOCKED_FOR_APPLY');
});
