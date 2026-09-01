import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  APPROVED_MAIN_CATALOG_SHA256,
  DAILY_SNAPSHOT_POLICY_VERSION,
  EXPECTED_UPSTREAM_SOURCE_IDENTITY,
  MIGRATION_OBSERVATION_MODE,
  MIGRATION_OBSERVATION_SOURCE,
  PRODUCT_IDENTITY_POLICY_VERSION,
  assertDailySnapshotIntegrity,
  assertIdentityRegistryIntegrity,
  buildApprovedProductIdentityRegistry,
  buildCatalogMigrationObservationSource,
  buildDailyPriceStockSnapshot,
  buildIdentitySnapshotEvidenceSummary,
  parseProductIdentitySnapshotArgs,
} from './product_identity_daily_snapshot_core.mjs';

const APPROVED_CATALOG_SOURCE = readFileSync(
  new URL('../../output/pdf/catalog_work/catalog-selection.json', import.meta.url),
  'utf8',
);
const SAME_DAY_NOW = new Date('2026-08-31T19:30:00.000Z');
const NEXT_DAY_NOW = new Date('2026-09-01T09:00:00.000Z');
const PREVIOUS_DAY_NOW = new Date('2026-08-30T09:00:00.000Z');

function registry() {
  return buildApprovedProductIdentityRegistry({ catalogSource: APPROVED_CATALOG_SOURCE });
}

function observationObject() {
  return JSON.parse(buildCatalogMigrationObservationSource({
    catalogSource: APPROVED_CATALOG_SOURCE,
  }));
}

function snapshot({ identityRegistry = registry(), observation = observationObject(), now = SAME_DAY_NOW } = {}) {
  return buildDailyPriceStockSnapshot({
    identityRegistry,
    observationSource: JSON.stringify(observation),
    now,
  });
}

function hasField(value, fieldName) {
  if (Array.isArray(value)) return value.some((item) => hasField(item, fieldName));
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => key === fieldName || hasField(child, fieldName));
}

test('CLI accepts only help and has no user-selectable date, write, live, or approval argument', () => {
  assert.deepEqual(parseProductIdentitySnapshotArgs([]), { help: false });
  assert.equal(parseProductIdentitySnapshotArgs(['--help']).help, true);
  for (const args of [
    ['--business-date', '2026-08-31'],
    ['--write'],
    ['--live-vega'],
    ['--approve'],
  ]) {
    assert.throws(() => parseProductIdentitySnapshotArgs(args), {
      code: 'DAILY_SNAPSHOT_ARGUMENT_INVALID',
    });
  }
});

test('raw approved catalog bytes are pinned inside the identity builder', () => {
  assert.equal(
    createHash('sha256').update(APPROVED_CATALOG_SOURCE).digest('hex'),
    APPROVED_MAIN_CATALOG_SHA256,
  );
  assert.throws(() => buildApprovedProductIdentityRegistry({
    catalogSource: `${APPROVED_CATALOG_SOURCE}\n`,
  }), { code: 'PRODUCT_IDENTITY_SOURCE_HASH_MISMATCH' });
  const changed = JSON.parse(APPROVED_CATALOG_SOURCE);
  changed.products[0].productName = 'ATTACKER NAME';
  assert.throws(() => buildApprovedProductIdentityRegistry({
    catalogSource: JSON.stringify(changed),
  }), { code: 'PRODUCT_IDENTITY_SOURCE_HASH_MISMATCH' });
});

test('identity registry contains exactly the approved identities and no daily commercial facts', () => {
  const value = registry();
  assert.equal(value.policyVersion, PRODUCT_IDENTITY_POLICY_VERSION);
  assert.equal(value.productCount, 30);
  assert.equal(value.products.length, 30);
  assert.equal(new Set(value.products.map((product) => product.sourceId)).size, 30);
  assert.equal(new Set(value.products.map((product) => product.stockCode)).size, 30);
  assert.equal(value.products.some((product) => product.stockCode === '7770 CONCEPT'), false);
  assert.equal(value.products.some((product) => product.stockCode === '8023 CONCEPT'), true);
  assert.equal(value.products.filter((product) => product.customerFacingName).length, 10);
  for (const forbidden of ['currency', 'salePrice', 'stockQuantity', 'reservedQuantity', 'exchangeRate', 'cost', 'margin']) {
    assert.equal(hasField(value.products, forbidden), false, forbidden);
  }
  assert.equal(value.approvalLimits.priceApproved, false);
  assert.equal(value.approvalLimits.stockApproved, false);
  assert.equal(value.approvalLimits.currencyApproved, false);
  assert.equal(value.approvalLimits.ownerApprovedCustomerFacingNameCount, 10);
  assert.equal(value.approvalLimits.sourceNameRetainedCount, 20);
  assert.equal(value.approvalLimits.sourceMetadataApprovalStatus, 'NOT_SEPARATELY_OWNER_APPROVED');
  assert.match(value.sourceCatalog.selectionApprovalBindingSha256, /^[a-f0-9]{64}$/);
  assertIdentityRegistryIntegrity(value);
});

test('identity registry is deterministic, sorted, frozen, and rejects copied or changed objects', () => {
  const first = registry();
  const second = registry();
  assert.equal(first.identityRegistrySha256, second.identityRegistrySha256);
  assert.deepEqual(first.products.map((product) => product.sourceId), [...first.products]
    .sort((left, right) => left.sourceId - right.sourceId)
    .map((product) => product.sourceId));
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.products[0]), true);
  const forged = structuredClone(first);
  forged.products[0].approvedDisplayName = 'FORGED';
  assert.throws(() => assertIdentityRegistryIntegrity(forged), {
    code: 'PRODUCT_IDENTITY_REGISTRY_UNTRUSTED',
  });
});

test('migration observation is explicit about being local, old-source, read-only, and not live Vega', () => {
  const observation = observationObject();
  assert.equal(observation.captureContractVersion, DAILY_SNAPSHOT_POLICY_VERSION);
  assert.equal(observation.sourceMode, MIGRATION_OBSERVATION_MODE);
  assert.equal(observation.observationSource, MIGRATION_OBSERVATION_SOURCE);
  assert.deepEqual(observation.upstreamOrigin, EXPECTED_UPSTREAM_SOURCE_IDENTITY);
  assert.equal(observation.completeness.returnedProductCount, 30);
  assert.equal(observation.readOnlyEvidence.liveVegaReadPerformed, false);
  assert.equal(observation.readOnlyEvidence.databaseWritePerformed, false);
  assert.equal(observation.readOnlyEvidence.erpOrVegaWritePerformed, false);
  assert.equal(observation.readOnlyEvidence.networkRequestPerformed, false);
  assert.equal(observation.products.every((product) => product.reservedQuantity === null), true);
  assert.equal(observation.products.every((product) => product.isPassive === null), true);
});

test('daily snapshot binds a separate hash to the same 30-product identity registry', () => {
  const identityRegistry = registry();
  const dailySnapshot = snapshot({ identityRegistry });
  assert.notEqual(dailySnapshot.dailySnapshotSha256, identityRegistry.identityRegistrySha256);
  assert.equal(dailySnapshot.identityRegistry.identityRegistrySha256, identityRegistry.identityRegistrySha256);
  assert.equal(dailySnapshot.identityRegistry.membershipSha256, identityRegistry.membershipSha256);
  assert.equal(dailySnapshot.productCount, 30);
  assert.equal(dailySnapshot.status, 'CAPTURED_NOT_PRICE_APPROVED');
  assert.equal(dailySnapshot.source.liveVegaReadPerformed, false);
  assert.equal(dailySnapshot.restrictions.canCreateCustomerReadyPriceBook, false);
  assertDailySnapshotIntegrity(dailySnapshot);
});

test('price, stock, and observation time change only the daily facts hash', () => {
  const identityRegistry = registry();
  const baseline = snapshot({ identityRegistry });

  const priceChanged = observationObject();
  priceChanged.products[0].salePrice = Number(priceChanged.products[0].salePrice) + 0.01;
  const priceSnapshot = snapshot({ identityRegistry, observation: priceChanged });

  const stockChanged = observationObject();
  stockChanged.products[0].stockQuantity = Number(stockChanged.products[0].stockQuantity) + 1;
  const stockSnapshot = snapshot({ identityRegistry, observation: stockChanged });

  const timeChanged = observationObject();
  timeChanged.observedAt = '2026-08-31T19:00:00.000Z';
  const timeSnapshot = snapshot({ identityRegistry, observation: timeChanged });

  for (const changed of [priceSnapshot, stockSnapshot, timeSnapshot]) {
    assert.equal(changed.identityRegistry.identityRegistrySha256, identityRegistry.identityRegistrySha256);
    assert.notEqual(changed.dailySnapshotSha256, baseline.dailySnapshotSha256);
  }
});

test('input row ordering changes raw bytes but not the canonical daily snapshot hash', () => {
  const identityRegistry = registry();
  const baseline = snapshot({ identityRegistry });
  const reversed = observationObject();
  reversed.products.reverse();
  const reordered = snapshot({ identityRegistry, observation: reversed });
  assert.notEqual(reordered.rawObservationSha256, baseline.rawObservationSha256);
  assert.notEqual(reordered.evidenceEnvelopeSha256, baseline.evidenceEnvelopeSha256);
  assert.equal(reordered.dailySnapshotSha256, baseline.dailySnapshotSha256);
  assert.deepEqual(reordered.items, baseline.items);
});

test('missing, extra, duplicate, and mismatched product identities fail closed', () => {
  const missing = observationObject();
  missing.products.pop();
  assert.throws(() => snapshot({ observation: missing }), {
    code: 'DAILY_SNAPSHOT_PRODUCT_MISSING',
  });

  const extra = observationObject();
  extra.products[extra.products.length - 1] = {
    ...extra.products[extra.products.length - 1],
    sourceId: 999999,
    stockCode: 'EXTRA PRODUCT',
  };
  assert.throws(() => snapshot({ observation: extra }), {
    code: 'DAILY_SNAPSHOT_PRODUCT_EXTRA',
  });

  const duplicateId = observationObject();
  duplicateId.products[1].sourceId = duplicateId.products[0].sourceId;
  assert.throws(() => snapshot({ observation: duplicateId }), {
    code: 'DAILY_SNAPSHOT_PRODUCT_DUPLICATE',
  });

  const duplicateStockCode = observationObject();
  duplicateStockCode.products[1].stockCode = duplicateStockCode.products[0].stockCode;
  assert.throws(() => snapshot({ observation: duplicateStockCode }), {
    code: 'DAILY_SNAPSHOT_STOCK_CODE_DUPLICATE',
  });

  const identityMismatch = observationObject();
  identityMismatch.products[0].stockCode = 'WRONG UNIQUE STOCK CODE';
  assert.throws(() => snapshot({ observation: identityMismatch }), {
    code: 'DAILY_SNAPSHOT_PRODUCT_IDENTITY_MISMATCH',
  });
});

test('invalid commercial facts or unsupported migration-only fields fail closed', () => {
  const cases = [
    ['salePrice', -1, 'DAILY_SNAPSHOT_PRICE_INVALID'],
    ['salePrice', 1.12345, 'DAILY_SNAPSHOT_PRICE_INVALID'],
    ['currency', 'GBP', 'DAILY_SNAPSHOT_CURRENCY_INVALID'],
    ['stockQuantity', -1, 'DAILY_SNAPSHOT_STOCK_INVALID'],
    ['stockQuantity', 'not-a-number', 'DAILY_SNAPSHOT_STOCK_INVALID'],
    ['reservedQuantity', 5, 'DAILY_SNAPSHOT_RESERVED_STOCK_UNEXPECTED'],
    ['isPassive', false, 'DAILY_SNAPSHOT_ACTIVITY_STATUS_UNEXPECTED'],
    ['isPassive', true, 'DAILY_SNAPSHOT_ACTIVITY_STATUS_UNEXPECTED'],
  ];
  for (const [field, value, code] of cases) {
    const observation = observationObject();
    observation.products[0][field] = value;
    assert.throws(() => snapshot({ observation }), { code });
  }
});

test('zero stock or zero source price stays visible but is not quotable', () => {
  const observation = observationObject();
  observation.products[0].stockQuantity = 0;
  observation.products[1].salePrice = 0;
  const value = snapshot({ observation });
  assert.equal(value.productCount, 30);
  assert.equal(value.nonQuotableItemCount, 2);
  assert.equal(value.completenessStatus, 'COMPLETE_WITH_NON_QUOTABLE_ITEMS');
  assert.equal(value.items.find((item) => item.sourceId === observation.products[0].sourceId).itemStatus, 'NOT_QUOTABLE');
  assert.equal(value.items.find((item) => item.sourceId === observation.products[1].sourceId).itemStatus, 'NOT_QUOTABLE');
  assert.equal(value.items.every((item) => item.observedReservedQuantity === null), true);
  assert.equal(value.items.every((item) => item.observedActivityStatus === 'NOT_CAPTURED'), true);
});

test('stale, future, partial, and wrong-provenance observations fail closed', () => {
  assert.throws(() => snapshot({ now: NEXT_DAY_NOW }), { code: 'DAILY_SNAPSHOT_STALE' });
  assert.throws(() => snapshot({ now: PREVIOUS_DAY_NOW }), { code: 'DAILY_SNAPSHOT_FUTURE' });

  const sameDayFuture = observationObject();
  sameDayFuture.observedAt = '2026-08-31T20:00:00.000Z';
  assert.throws(() => snapshot({ observation: sameDayFuture }), {
    code: 'DAILY_SNAPSHOT_OBSERVED_AT_FUTURE',
  });

  const partial = observationObject();
  partial.completeness.complete = false;
  assert.throws(() => snapshot({ observation: partial }), {
    code: 'DAILY_SNAPSHOT_PROVENANCE_INVALID',
  });

  const wrongCompany = observationObject();
  wrongCompany.upstreamOrigin.companyCode = 'F9999';
  assert.throws(() => snapshot({ observation: wrongCompany }), {
    code: 'DAILY_SNAPSHOT_PROVENANCE_INVALID',
  });

  const wrongObservationSource = observationObject();
  wrongObservationSource.observationSource = 'vega-live-read-only';
  assert.throws(() => snapshot({ observation: wrongObservationSource }), {
    code: 'DAILY_SNAPSHOT_PROVENANCE_INVALID',
  });

  const wrongMapping = observationObject();
  wrongMapping.fieldMappingVersion = 'attacker-mapping';
  assert.throws(() => snapshot({ observation: wrongMapping }), {
    code: 'DAILY_SNAPSHOT_PROVENANCE_INVALID',
  });
});

test('caller cannot self-approve a snapshot and a copied snapshot is untrusted', () => {
  const observation = observationObject();
  observation.approved = true;
  observation.approvalId = 'CALLER-CLAIM';
  const value = snapshot({ observation });
  assert.equal(value.restrictions.dailyPriceApprovalStatus, 'NOT_APPROVED');
  assert.equal(value.dailyPriceApprovalBinding.status, 'NOT_APPROVED');
  assert.equal(value.dailyPriceApprovalBinding.approvalId, null);
  assert.equal(value.dailyPriceApprovalBinding.requiredScope.identityRegistrySha256, value.identityRegistry.identityRegistrySha256);
  assert.equal(value.dailyPriceApprovalBinding.requiredScope.dailySnapshotSha256, value.dailySnapshotSha256);
  assert.equal(value.dailyPriceApprovalBinding.requiredScope.evidenceEnvelopeSha256, value.evidenceEnvelopeSha256);
  assert.equal(value.dailyPriceApprovalBinding.requiredScope.businessDate, value.businessDate);

  const forged = structuredClone(value);
  forged.restrictions.dailyPriceApprovalStatus = 'APPROVED';
  assert.throws(() => assertDailySnapshotIntegrity(forged), {
    code: 'DAILY_SNAPSHOT_UNTRUSTED',
  });
});

test('redacted evidence contains hashes and counts but no price, exact stock, barcode, cost, or customer fields', () => {
  const identityRegistry = registry();
  const dailySnapshot = snapshot({ identityRegistry });
  const summary = buildIdentitySnapshotEvidenceSummary({ identityRegistry, dailySnapshot });
  const encoded = JSON.stringify(summary);
  for (const forbidden of [
    'observedSalePrice',
    'observedStockQuantity',
    'observedReservedQuantity',
    'barcode',
    'purchasePrice',
    'customerName',
  ]) {
    assert.equal(encoded.includes(`\"${forbidden}\"`), false, forbidden);
  }
  assert.equal(summary.commercialValuesRedacted, true);
  assert.equal(summary.dailySnapshot.liveVegaReadPerformed, false);
  assert.equal(summary.databaseWritePerformed, false);
  assert.equal(summary.externalMessageSent, false);
});

test('CLI source has no network, database, filesystem write, message, quote, order, or approval capability', () => {
  const source = readFileSync(new URL('./product_identity_daily_snapshot.mjs', import.meta.url), 'utf8').toLowerCase();
  for (const forbidden of [
    'writefile',
    'appendfile',
    'rename(',
    'fetch(',
    'axios',
    'mssql',
    'getvegaproducts',
    'whatsapp',
    'sales-offers',
    'createorder',
    'approveprice',
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.ok(source.includes("import { readfile } from 'node:fs/promises'"));
});
