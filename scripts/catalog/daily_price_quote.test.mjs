import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  APPROVED_MAIN_CATALOG_SHA256,
  LOCAL_SYNTHETIC_MODE,
  assertLocalSyntheticAction,
  assertPriceBookIntegrity,
  assertQuoteDraftCurrent,
  assertQuoteDraftIntegrity,
  buildDailyPriceBooks,
  buildSafeEvidenceSummary,
  buildSafeQuoteDraft,
  parseDailyPriceQuoteArgs,
  validateDailyPriceProduct,
} from './daily_price_quote_core.mjs';

const APPROVED_CATALOG_SOURCE = readFileSync(
  new URL('../../output/pdf/catalog_work/catalog-selection.json', import.meta.url),
  'utf8',
);
const APPROVED_CATALOG = JSON.parse(APPROVED_CATALOG_SOURCE);
const SAME_DAY_NOW = new Date('2026-08-31T19:30:00.000Z');
const NEXT_DAY_NOW = new Date('2026-09-01T09:00:00.000Z');

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function rehashPriceBook(priceBook) {
  const copy = { ...priceBook };
  delete copy.priceBookVersion;
  return createHash('sha256').update(JSON.stringify(stableValue(copy))).digest('hex');
}

function books(now = SAME_DAY_NOW) {
  return buildDailyPriceBooks({ catalogSource: APPROVED_CATALOG_SOURCE, now });
}

function draftInput(priceBooks = books(), now = SAME_DAY_NOW) {
  const item = priceBooks
    .flatMap((book) => book.items)
    .find((row) => row.packageContentVerificationPending)
    || priceBooks[0].items[0];
  return {
    priceBooks,
    now,
    requestedLines: [{ sourceId: item.sourceId, stockCode: item.stockCode, quantity: 1 }],
  };
}

test('CLI has no user-selectable business date and rejects publish or write arguments', () => {
  assert.deepEqual(parseDailyPriceQuoteArgs([]), { help: false });
  assert.equal(parseDailyPriceQuoteArgs(['--help']).help, true);
  assert.throws(() => parseDailyPriceQuoteArgs(['--business-date', '2026-08-31']), {
    code: 'QUOTE_ARGUMENT_INVALID',
  });
  assert.throws(() => parseDailyPriceQuoteArgs(['--publish']), { code: 'QUOTE_ARGUMENT_INVALID' });
  assert.throws(() => parseDailyPriceQuoteArgs(['--write']), { code: 'QUOTE_ARGUMENT_INVALID' });
});

test('raw catalog bytes are hashed inside the core and pinned to the owner-approved source', () => {
  assert.equal(createHash('sha256').update(APPROVED_CATALOG_SOURCE).digest('hex'), APPROVED_MAIN_CATALOG_SHA256);
  const priceBooks = books();
  assert.equal(priceBooks.reduce((total, book) => total + book.items.length, 0), 30);
  assert.throws(() => buildDailyPriceBooks({
    catalogSource: `${APPROVED_CATALOG_SOURCE}\n`,
    now: SAME_DAY_NOW,
  }), { code: 'QUOTE_SOURCE_HASH_MISMATCH' });
  const changed = JSON.parse(APPROVED_CATALOG_SOURCE);
  changed.products[0].salePrice = 0.01;
  assert.throws(() => buildDailyPriceBooks({
    catalogSource: JSON.stringify(changed),
    now: SAME_DAY_NOW,
  }), { code: 'QUOTE_SOURCE_HASH_MISMATCH' });
});

test('the real Istanbul date is mandatory and stale or future source data fails closed', () => {
  assert.equal(books(SAME_DAY_NOW)[0].businessDate, '2026-08-31');
  assert.throws(() => books(NEXT_DAY_NOW), { code: 'QUOTE_PRICE_STALE' });
  assert.throws(() => books(new Date('2026-08-30T09:00:00.000Z')), { code: 'QUOTE_PRICE_FUTURE' });
});

test('product validator rejects invalid price, stock, currency, identity, and the blocked product', () => {
  const sample = APPROVED_CATALOG.products[0];
  assert.throws(() => validateDailyPriceProduct({ ...sample, salePrice: 0 }), { code: 'QUOTE_PRICE_INVALID' });
  assert.throws(() => validateDailyPriceProduct({ ...sample, stockQuantity: 0 }), { code: 'QUOTE_STOCK_UNAVAILABLE' });
  assert.throws(() => validateDailyPriceProduct({ ...sample, currency: 'GBP' }), { code: 'QUOTE_CURRENCY_INVALID' });
  assert.throws(() => validateDailyPriceProduct({ ...sample, sourceId: null }), { code: 'QUOTE_PRODUCT_IDENTITY_INVALID' });
  assert.throws(() => validateDailyPriceProduct({ ...sample, stockCode: '7770 CONCEPT' }), { code: 'QUOTE_BLOCKED_PRODUCT' });
});

test('price books are deterministic, split by native currency, frozen, and source-bound', () => {
  const first = books();
  const second = books();
  assert.deepEqual(first.map((book) => [book.currency, book.items.length]), [['TRY', 17], ['USD', 13]]);
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first[0]), true);
  assert.equal(Object.isFrozen(first[0].items[0]), true);
  assertPriceBookIntegrity(first[0]);

  const forged = structuredClone(first[0]);
  forged.source.catalogSha256 = 'attacker-controlled-source';
  forged.currency = 'GBP';
  forged.items[0].currency = 'GBP';
  forged.items[0].lockedUnitPrice = '0.0100';
  delete forged.items[0].availableStockSnapshot;
  forged.priceBookVersion = rehashPriceBook(forged);
  assert.throws(() => assertPriceBookIntegrity(forged), { code: 'QUOTE_PRICE_BOOK_UNTRUSTED' });
  assert.throws(() => buildSafeQuoteDraft({
    priceBooks: [forged],
    now: SAME_DAY_NOW,
    requestedLines: [{ sourceId: forged.items[0].sourceId, stockCode: forged.items[0].stockCode, quantity: 999_999 }],
  }), { code: 'QUOTE_PRICE_BOOK_UNTRUSTED' });
});

test('price approval, calculation, margin, and validity remain explicitly unconfigured', () => {
  for (const book of books()) {
    assert.equal(book.dailyPriceApprovalStatus, 'NOT_APPROVED');
    assert.equal(book.priceCalculationPolicy, 'SOURCE_SALE_PRICE_IDENTITY_TEST');
    assert.equal(book.costMarginPolicy, 'UNCONFIGURED');
    assert.equal(book.validityPolicy, 'UNCONFIGURED_OWNER_DECISION_REQUIRED');
    assert.equal(book.expiresAt, null);
  }
});

test('quote prices and currency come only from the locked book', () => {
  const input = draftInput();
  assert.throws(() => buildSafeQuoteDraft({
    ...input,
    requestedLines: [{ ...input.requestedLines[0], unitPrice: 1 }],
  }), { code: 'QUOTE_PRICE_OVERRIDE_FORBIDDEN' });
  assert.throws(() => buildSafeQuoteDraft({ ...input, discountRate: 10 }), {
    code: 'QUOTE_TERMS_OVERRIDE_FORBIDDEN',
  });
  assert.throws(() => buildSafeQuoteDraft({ ...input, paymentTerms: 'NET30' }), {
    code: 'QUOTE_TERMS_OVERRIDE_FORBIDDEN',
  });
  assert.throws(() => buildSafeQuoteDraft({ ...input, quoteDate: '2026-08-31' }), {
    code: 'QUOTE_TERMS_OVERRIDE_FORBIDDEN',
  });
});

test('unknown, mismatched, duplicate, invalid-quantity, and insufficient-stock lines fail closed', () => {
  const input = draftInput();
  const line = input.requestedLines[0];
  assert.throws(() => buildSafeQuoteDraft({
    ...input,
    requestedLines: [{ sourceId: 9999, stockCode: '9999 TEST', quantity: 1 }],
  }), { code: 'QUOTE_PRODUCT_NOT_FOUND' });
  assert.throws(() => buildSafeQuoteDraft({
    ...input,
    requestedLines: [{ ...line, stockCode: 'WRONG' }],
  }), { code: 'QUOTE_PRODUCT_IDENTITY_MISMATCH' });
  assert.throws(() => buildSafeQuoteDraft({ ...input, requestedLines: [line, line] }), {
    code: 'QUOTE_PRODUCT_DUPLICATE',
  });
  for (const quantity of [0, -1, 1.5, Number.POSITIVE_INFINITY]) {
    assert.throws(() => buildSafeQuoteDraft({
      ...input,
      requestedLines: [{ ...line, quantity }],
    }), { code: 'QUOTE_QUANTITY_INVALID' });
  }
  assert.throws(() => buildSafeQuoteDraft({
    ...input,
    requestedLines: [{ ...line, quantity: 999_999 }],
  }), { code: 'QUOTE_STOCK_INSUFFICIENT' });
});

test('mixed native currencies are never converted automatically', () => {
  const priceBooks = books();
  const tryItem = priceBooks.find((book) => book.currency === 'TRY').items[0];
  const usdItem = priceBooks.find((book) => book.currency === 'USD').items[0];
  assert.throws(() => buildSafeQuoteDraft({
    priceBooks,
    now: SAME_DAY_NOW,
    requestedLines: [
      { sourceId: tryItem.sourceId, stockCode: tryItem.stockCode, quantity: 1 },
      { sourceId: usdItem.sourceId, stockCode: usdItem.stockCode, quantity: 1 },
    ],
  }), { code: 'QUOTE_CURRENCY_MIXED' });
});

test('buyer identity is generated locally and country policy cannot be invented', () => {
  const input = draftInput();
  assert.throws(() => buildSafeQuoteDraft({ ...input, buyerReference: 'SYNTHETIC-CLAIMED-BUYER' }), {
    code: 'QUOTE_REAL_CUSTOMER_FORBIDDEN',
  });
  for (const destinationCountry of ['DE', 'US', 'ZZ']) {
    assert.throws(() => buildSafeQuoteDraft({ ...input, destinationCountry }), {
      code: 'QUOTE_DESTINATION_POLICY_UNCONFIGURED',
    });
  }
});

test('draft is prepaid, zero-auto-discount, freight-excluded, internal, and current only today', () => {
  const draft = buildSafeQuoteDraft(draftInput());
  assert.equal(draft.mode, LOCAL_SYNTHETIC_MODE);
  assert.equal(draft.status, 'DRAFT_ONLY');
  assert.equal(draft.buyerReference, 'SYNTHETIC-LOCAL-REVIEW');
  assert.equal(draft.paymentTerms, 'PREPAID');
  assert.equal(draft.automaticDiscountRate, '0.0000');
  assert.equal(draft.freight.status, 'NOT_QUOTED');
  assert.equal(draft.totals.payableTotal, null);
  assert.equal(draft.safety.canSend, false);
  assert.equal(draft.safety.canPersist, false);
  assert.equal(draft.safety.canPublish, false);
  assert.equal(draft.safety.stockReserved, false);
  assert.equal(draft.safety.externalUseAllowed, false);
  assertQuoteDraftIntegrity(draft);
  assertQuoteDraftCurrent(draft, SAME_DAY_NOW);
  assert.throws(() => assertQuoteDraftCurrent(draft, NEXT_DAY_NOW), { code: 'QUOTE_PRICE_EXPIRED' });
});

test('quote draft is frozen and a copied or changed draft is not trusted', () => {
  const draft = buildSafeQuoteDraft(draftInput());
  assert.equal(Object.isFrozen(draft), true);
  assert.equal(Object.isFrozen(draft.lines[0]), true);
  const forged = structuredClone(draft);
  forged.paymentTerms = 'NET30';
  forged.blockers = [];
  assert.throws(() => assertQuoteDraftIntegrity(forged), { code: 'QUOTE_DRAFT_UNTRUSTED' });
});

test('package uncertainty and every unresolved commercial gate remain visible', () => {
  const draft = buildSafeQuoteDraft(draftInput());
  assert.equal(draft.packageContentPendingCount, 1);
  for (const blocker of [
    'PACKAGE_CONTENT_VERIFICATION_PENDING',
    'SHIPPING_QUOTE_NOT_AVAILABLE',
    'DESTINATION_COUNTRY_REQUIRED',
    'DESTINATION_COUNTRY_SCOPE_UNVERIFIED',
    'EXTERNAL_OWNER_APPROVAL_REQUIRED',
    'DAILY_PRICE_BOOK_OWNER_APPROVAL_REQUIRED',
    'PRICE_CALCULATION_POLICY_UNCONFIGURED',
    'COST_MARGIN_SOURCE_UNCONFIGURED',
    'VALIDITY_POLICY_UNCONFIGURED',
  ]) {
    assert.ok(draft.blockers.includes(blocker), blocker);
  }
  assert.equal(draft.returnTerms.policy, 'RESOLUTION_FIRST_RETURN_LAST_OPTION');
});

test('external actions fail closed', () => {
  for (const field of ['send', 'persist', 'publish', 'createOrder', 'reserveStock', 'collectPayment', 'writeErp', 'writeVega']) {
    assert.throws(() => assertLocalSyntheticAction({ [field]: true }), {
      code: 'QUOTE_EXTERNAL_ACTION_FORBIDDEN',
    });
  }
});

test('redacted evidence contains no price, exact stock, customer, or barcode fields', () => {
  const priceBooks = books();
  const quoteDraft = buildSafeQuoteDraft(draftInput(priceBooks));
  const summary = buildSafeEvidenceSummary({ catalog: APPROVED_CATALOG, priceBooks, quoteDraft });
  const encoded = JSON.stringify(summary);
  for (const forbidden of ['lockedUnitPrice', 'unitPrice', 'stockQuantity', 'availableStockSnapshot', 'goodsSubtotal', 'barcode', 'customerName']) {
    assert.equal(encoded.includes(`\"${forbidden}\"`), false);
  }
  assert.equal(summary.commercialValuesRedacted, true);
  assert.equal(summary.sourceCatalog.packageContentPendingProductCount, 10);
  assert.equal(summary.databaseWritePerformed, false);
  assert.equal(summary.externalMessageSent, false);
});

test('CLI source has no network, database, message, publication, or filesystem write capability', () => {
  const source = readFileSync(new URL('./daily_price_quote.mjs', import.meta.url), 'utf8');
  for (const forbidden of ['writeFile', 'appendFile', 'rename(', 'fetch(', 'axios', 'mssql', 'sales-offers', 'whatsapp']) {
    assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
  assert.ok(source.includes("import { readFile } from 'node:fs/promises'"));
});

