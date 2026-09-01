import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  LIVE_VEGA_FIELD_MAPPING_APPROVAL_REF,
  LIVE_VEGA_FIELD_MAPPING_VERSION,
  LIVE_VEGA_OBSERVATION_MODE,
  REQUIRED_LIVE_VEGA_TABLES,
  assertLiveReadOnlyPermissions,
  buildApprovedProductIdentityRegistry,
  buildDailyPriceStockSnapshot,
  buildIdentitySnapshotEvidenceSummary,
  buildLiveReadOnlyPermissionQuery,
  buildLiveVegaObservationSource,
  buildLiveVegaSnapshotQuery,
} from './product_identity_daily_snapshot_core.mjs';

const APPROVED_CATALOG_SOURCE = readFileSync(
  new URL('../../output/pdf/catalog_work/catalog-selection.json', import.meta.url),
  'utf8',
);
const APPROVED_CATALOG = JSON.parse(APPROVED_CATALOG_SOURCE);
const LIVE_NOW = new Date('2026-09-01T09:00:00.000Z');
const LIVE_OBSERVED_AT = new Date('2026-09-01T08:59:00.000Z');

function registry() {
  return buildApprovedProductIdentityRegistry({ catalogSource: APPROVED_CATALOG_SOURCE });
}

function permissionRows(overrides = {}) {
  return REQUIRED_LIVE_VEGA_TABLES.map((tableName) => ({
    object_name: tableName,
    can_select: 1,
    can_insert: 0,
    can_update: 0,
    can_delete: 0,
    can_alter: 0,
    can_control: 0,
    ...overrides,
  }));
}

function permissionEvidence() {
  return assertLiveReadOnlyPermissions(permissionRows());
}

function liveRows() {
  return APPROVED_CATALOG.products.map((product) => ({
    source_id: product.sourceId,
    stock_code: product.stockCode,
    sale_price: product.salePrice,
    sale_currency: product.currency,
    stock_quantity: product.stockQuantity,
    stock_basis: 'PERIOD_MOVEMENT_NET',
    reserved_quantity: 0,
    is_passive: 0,
  }));
}

function liveObservationSource({ identityRegistry = registry(), rows = liveRows(), permissions = permissionEvidence() } = {}) {
  return buildLiveVegaObservationSource({
    identityRegistry,
    rows,
    permissionEvidence: permissions,
    observedAt: LIVE_OBSERVED_AT,
  });
}

function liveSnapshot({ identityRegistry = registry(), rows = liveRows() } = {}) {
  return buildDailyPriceStockSnapshot({
    identityRegistry,
    observationSource: liveObservationSource({ identityRegistry, rows }),
    now: LIVE_NOW,
  });
}

test('permission preflight covers all required tables and rejects every write-capable permission', () => {
  const query = buildLiveReadOnlyPermissionQuery();
  for (const tableName of REQUIRED_LIVE_VEGA_TABLES) assert.match(query, new RegExp(tableName));
  const evidence = permissionEvidence();
  assert.equal(evidence.checkedTableCount, 3);
  assert.equal(evidence.selectPermissionConfirmed, true);
  assert.equal(evidence.writePermissionAbsent, true);

  assert.throws(() => assertLiveReadOnlyPermissions(permissionRows({ can_update: 1 })), {
    code: 'DAILY_SNAPSHOT_WRITE_PERMISSION_PRESENT',
  });
  assert.throws(() => assertLiveReadOnlyPermissions(permissionRows({ can_select: 0 })), {
    code: 'DAILY_SNAPSHOT_SELECT_PERMISSION_MISSING',
  });
});

test('live query is parameterized, SELECT-only, exact-scope, and exposes the approved raw fields', () => {
  const identityRegistry = registry();
  const query = buildLiveVegaSnapshotQuery(identityRegistry);
  assert.match(query, /@liveSourceId0/);
  assert.match(query, /@liveStockCode29/);
  assert.match(query, /SATISFIYATI1/);
  assert.match(query, /PB1/);
  assert.match(query, /SUM\(CAST\(ISNULL\(movement\.GIREN/);
  assert.match(query, /product\.REZERV/);
  assert.match(query, /product\.STATUS/);
  for (const forbidden of [/\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i, /\bMERGE\b/i, /\bEXEC(?:UTE)?\b/i]) {
    assert.doesNotMatch(query, forbidden);
  }
});

test('live observation produces a complete read-only snapshot bound to the approved identity registry', () => {
  const identityRegistry = registry();
  const value = liveSnapshot({ identityRegistry });
  assert.equal(value.source.mode, LIVE_VEGA_OBSERVATION_MODE);
  assert.equal(value.source.liveVegaReadPerformed, true);
  assert.equal(value.source.databaseReadPerformed, true);
  assert.equal(value.source.permissionEvidence.selectPermissionConfirmed, true);
  assert.equal(value.source.permissionEvidence.writePermissionAbsent, true);
  assert.equal(value.source.fieldMappingVersion, LIVE_VEGA_FIELD_MAPPING_VERSION);
  assert.equal(value.source.sourceFieldMappingApproval.approvalRef, LIVE_VEGA_FIELD_MAPPING_APPROVAL_REF);
  assert.equal(value.restrictions.sourceFieldMappingApprovalStatus, 'OWNER_APPROVED_FOR_READ_ONLY_SNAPSHOT_TEST');
  assert.equal(value.restrictions.dailyPriceApprovalStatus, 'NOT_APPROVED');
  assert.equal(value.restrictions.canCreateCustomerReadyPriceBook, false);
  assert.equal(value.productCount, 30);
  assert.equal(value.identityRegistry.identityRegistrySha256, identityRegistry.identityRegistrySha256);
});

test('raw currency aliases normalize narrowly and reserved stock stays separate without subtraction', () => {
  const rows = liveRows();
  const usdIndex = rows.findIndex((row) => row.sale_currency === 'USD');
  rows[usdIndex].sale_currency = '$';
  rows[usdIndex].reserved_quantity = 2;
  const value = liveSnapshot({ rows });
  const item = value.items.find((candidate) => candidate.sourceId === rows[usdIndex].source_id);
  assert.equal(item.currency, 'USD');
  assert.equal(item.observedReservedQuantity, 2);
  assert.equal(item.observedStockQuantity, Number(rows[usdIndex].stock_quantity));
  assert.equal(item.reservationAdjustmentPolicy, 'OBSERVED_SEPARATELY_NOT_SUBTRACTED');
  assert.equal(item.stockSourceBasis, 'PERIOD_MOVEMENT_NET');
  assert.equal(item.observedActivityStatus, 'ACTIVE_FILTER_CONFIRMED');
});

test('missing, extra, duplicate, or mismatched live product rows fail closed', () => {
  const missing = liveRows();
  missing.pop();
  assert.throws(() => liveObservationSource({ rows: missing }), {
    code: 'DAILY_SNAPSHOT_PRODUCT_MISSING',
  });

  const extra = liveRows();
  extra[extra.length - 1] = { ...extra[extra.length - 1], source_id: 999999, stock_code: 'EXTRA' };
  assert.throws(() => liveObservationSource({ rows: extra }), {
    code: 'DAILY_SNAPSHOT_PRODUCT_EXTRA',
  });

  const duplicate = liveRows();
  duplicate[1].source_id = duplicate[0].source_id;
  assert.throws(() => liveObservationSource({ rows: duplicate }), {
    code: 'DAILY_SNAPSHOT_PRODUCT_DUPLICATE',
  });

  const mismatch = liveRows();
  mismatch[0].stock_code = 'WRONG UNIQUE CODE';
  assert.throws(() => liveObservationSource({ rows: mismatch }), {
    code: 'DAILY_SNAPSHOT_PRODUCT_IDENTITY_MISMATCH',
  });
});

test('unknown stock basis, passive products, negative reserve, and unknown currency fail closed', () => {
  const badBasis = liveRows();
  badBasis[0].stock_basis = 'ATTACKER_BASIS';
  assert.throws(() => liveObservationSource({ rows: badBasis }), {
    code: 'DAILY_SNAPSHOT_STOCK_BASIS_INVALID',
  });

  const passive = liveRows();
  passive[0].is_passive = 1;
  assert.throws(() => liveSnapshot({ rows: passive }), {
    code: 'DAILY_SNAPSHOT_PRODUCT_PASSIVE',
  });

  const negativeReserve = liveRows();
  negativeReserve[0].reserved_quantity = -1;
  assert.throws(() => liveSnapshot({ rows: negativeReserve }), {
    code: 'DAILY_SNAPSHOT_STOCK_INVALID',
  });

  const unknownCurrency = liveRows();
  unknownCurrency[0].sale_currency = 'GBP';
  assert.throws(() => liveSnapshot({ rows: unknownCurrency }), {
    code: 'DAILY_SNAPSHOT_CURRENCY_INVALID',
  });
});

test('tampered live provenance and caller self-approval cannot create a customer-ready price book', () => {
  const identityRegistry = registry();
  const observation = JSON.parse(liveObservationSource({ identityRegistry }));
  observation.sourceFieldMappingApproval.status = 'CALLER_APPROVED';
  assert.throws(() => buildDailyPriceStockSnapshot({
    identityRegistry,
    observationSource: JSON.stringify(observation),
    now: LIVE_NOW,
  }), { code: 'DAILY_SNAPSHOT_PROVENANCE_INVALID' });

  const selfApproved = JSON.parse(liveObservationSource({ identityRegistry }));
  selfApproved.approved = true;
  selfApproved.dailyPriceApprovalStatus = 'APPROVED';
  const value = buildDailyPriceStockSnapshot({
    identityRegistry,
    observationSource: JSON.stringify(selfApproved),
    now: LIVE_NOW,
  });
  assert.equal(value.restrictions.dailyPriceApprovalStatus, 'NOT_APPROVED');
  assert.equal(value.dailyPriceApprovalBinding.status, 'NOT_APPROVED');
  assert.equal(value.restrictions.canCreateCustomerReadyPriceBook, false);
});

test('live evidence summary is redacted and states read-only facts without implying price approval', () => {
  const identityRegistry = registry();
  const dailySnapshot = liveSnapshot({ identityRegistry });
  const summary = buildIdentitySnapshotEvidenceSummary({ identityRegistry, dailySnapshot });
  const encoded = JSON.stringify(summary);
  assert.equal(summary.mode, 'LIVE_VEGA_READ_ONLY_SNAPSHOT_TEST');
  assert.equal(summary.databaseReadPerformed, true);
  assert.equal(summary.databaseWritePerformed, false);
  assert.equal(summary.dailySnapshot.selectPermissionConfirmed, true);
  assert.equal(summary.dailySnapshot.writePermissionAbsent, true);
  assert.equal(summary.dailySnapshot.dailyPriceApprovalStatus, 'NOT_APPROVED');
  assert.equal(Object.values(summary.dailySnapshot.currencyProductCounts).reduce((total, count) => total + count, 0), 30);
  assert.equal(Object.values(summary.dailySnapshot.stockSourceBasisCounts).reduce((total, count) => total + count, 0), 30);
  assert.equal(summary.dailySnapshot.productsWithPositiveReservedStockCount, 0);
  for (const forbidden of ['observedSalePrice', 'observedStockQuantity', 'observedReservedQuantity', 'barcode', 'purchasePrice', 'customerName']) {
    assert.equal(encoded.includes(`\"${forbidden}\"`), false, forbidden);
  }
});

test('live CLI has no file write, message, quote, order, reservation, or price-approval capability', () => {
  const source = readFileSync(new URL('./product_identity_daily_snapshot_live.mjs', import.meta.url), 'utf8').toLowerCase();
  for (const forbidden of ['writefile', 'appendfile', 'rename(', 'whatsapp', 'sales-offers', 'createorder', 'reservestock', 'approveprice']) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.ok(source.includes('buildlivereadonlypermissionquery'));
  assert.ok(source.includes('buildlivevegasnapshotquery'));
  assert.ok(source.includes('getvegasqlpool'));
});
