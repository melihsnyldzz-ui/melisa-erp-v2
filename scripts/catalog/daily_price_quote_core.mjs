import { createHash } from 'node:crypto';

export const APPROVED_MAIN_CATALOG_SHA256 = '54166e9f7ad64e8ef084fcb2e338f654ae94d1396a60ed204d696187f1fd23b5';
export const DAILY_PRICE_POLICY_VERSION = 'daily-fixed-price-safe-quote-v1';
export const DAILY_PRICE_TIME_ZONE = 'Europe/Istanbul';
export const LOCAL_SYNTHETIC_MODE = 'LOCAL_SYNTHETIC_REVIEW_ONLY';
export const SUPPORTED_CURRENCIES = Object.freeze(['TRY', 'USD', 'EUR']);

const FORBIDDEN_LINE_OVERRIDE_FIELDS = Object.freeze([
  'unitPrice',
  'salePrice',
  'price',
  'currency',
  'discountRate',
  'paymentTerms',
  'validUntil',
]);

const FORBIDDEN_ACTION_FIELDS = Object.freeze([
  'send',
  'persist',
  'publish',
  'createOrder',
  'reserveStock',
  'collectPayment',
  'writeErp',
  'writeVega',
]);

const FORBIDDEN_SUMMARY_FIELDS = new Set([
  'salePrice',
  'unitPrice',
  'lockedUnitPrice',
  'stockQuantity',
  'availableStockSnapshot',
  'lineTotal',
  'goodsSubtotal',
  'grandTotal',
  'barcode',
  'customerName',
  'customerPhone',
  'customerEmail',
  'address',
]);

const trustedPriceBooks = new WeakSet();
const trustedQuoteDrafts = new WeakSet();

function quoteError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function normalizeSha256(value) {
  return text(value).toLowerCase();
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function dateInTimeZone(value, timeZone = DAILY_PRICE_TIME_ZONE) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw quoteError('QUOTE_SOURCE_TIME_INVALID', 'Catalog generatedAt must be a valid timestamp');
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsed);
  const part = (type) => parts.find((row) => row.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function sha256Json(value) {
  return createHash('sha256')
    .update(JSON.stringify(stableValue(value)))
    .digest('hex');
}

function positivePrice(value) {
  if (value === null || value === undefined || typeof value === 'boolean') {
    throw quoteError('QUOTE_PRICE_INVALID', 'Product price must be a positive amount');
  }
  const raw = text(value);
  if (!/^\d+(?:\.\d{1,4})?$/.test(raw)) {
    throw quoteError('QUOTE_PRICE_INVALID', 'Product price must use at most four decimal places');
  }
  const [whole, fraction = ''] = raw.split('.');
  const scaled = BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, '0'));
  if (scaled <= 0n) {
    throw quoteError('QUOTE_PRICE_INVALID', 'Product price must be greater than zero');
  }
  return {
    scaled,
    formatted: `${whole}.${fraction.padEnd(4, '0')}`,
  };
}

function scaledAmount(value) {
  const whole = value / 10_000n;
  const fraction = String(value % 10_000n).padStart(4, '0');
  return `${whole}.${fraction}`;
}

function positiveStock(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw quoteError('QUOTE_STOCK_UNAVAILABLE', 'Product stock must be positive');
  }
  return number;
}

function normalizeCurrency(value) {
  const currency = text(value).toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw quoteError('QUOTE_CURRENCY_INVALID', `Unsupported currency: ${currency || 'missing'}`);
  }
  return currency;
}

function assertCatalogState(catalog, actualCatalogSha256, businessDate) {
  const actualHash = normalizeSha256(actualCatalogSha256);
  if (actualHash !== APPROVED_MAIN_CATALOG_SHA256) {
    throw quoteError('QUOTE_SOURCE_HASH_MISMATCH', 'Approved main catalog hash changed');
  }
  if (!isIsoDate(businessDate)) {
    throw quoteError('QUOTE_BUSINESS_DATE_INVALID', 'Business date must be YYYY-MM-DD');
  }
  if (
    catalog?.publicationStatus !== 'approved-internal-main-selection-not-published'
    || catalog?.selectionStatus !== 'owner-approved-main-selection-external-publication-blocked'
    || catalog?.approval?.status !== 'OWNER_APPROVED'
    || catalog?.approval?.externalPublicationApproved !== false
    || !Array.isArray(catalog?.products)
    || catalog.products.length !== 30
  ) {
    throw quoteError('QUOTE_SOURCE_NOT_APPROVED', 'Catalog is not the approved 30-product internal selection');
  }
  if (!text(catalog.generatedAt)) {
    throw quoteError('QUOTE_SOURCE_TIME_INVALID', 'Catalog generatedAt is required');
  }
  const sourceDate = dateInTimeZone(catalog.generatedAt);
  if (sourceDate < businessDate) {
    throw quoteError('QUOTE_PRICE_STALE', 'Catalog prices belong to an earlier Istanbul business date');
  }
  if (sourceDate > businessDate) {
    throw quoteError('QUOTE_PRICE_FUTURE', 'Catalog prices belong to a future Istanbul business date');
  }
  return sourceDate;
}

export function validateDailyPriceProduct(product) {
  const sourceId = Number(product?.sourceId);
  const stockCode = text(product?.stockCode);
  const productName = text(product?.customerFacingName || product?.productName);
  if (!Number.isInteger(sourceId) || sourceId <= 0 || !stockCode || !productName) {
    throw quoteError('QUOTE_PRODUCT_IDENTITY_INVALID', 'Product identity is incomplete');
  }
  if (stockCode === '7770 CONCEPT') {
    throw quoteError('QUOTE_BLOCKED_PRODUCT', 'Blocked catalog product cannot enter a daily price book');
  }
  const currency = normalizeCurrency(product.currency);
  const price = positivePrice(product.salePrice);
  const availableStockSnapshot = positiveStock(product.stockQuantity);
  return {
    sourceId,
    stockCode,
    productName,
    currency,
    lockedUnitPrice: price.formatted,
    availableStockSnapshot,
    packageContentVerificationPending: Array.isArray(product.reviewFlags)
      && product.reviewFlags.includes('PACKAGE_CONTENT_VERIFICATION_PENDING'),
  };
}

export function parseDailyPriceQuoteArgs(args = []) {
  const result = { help: false };
  for (const arg of args) {
    if (arg === '--help') {
      result.help = true;
      continue;
    }
    throw quoteError('QUOTE_ARGUMENT_INVALID', `Unsupported argument: ${arg}`);
  }
  return result;
}

export function currentDateInIstanbul(now = new Date()) {
  return dateInTimeZone(now);
}

export function buildDailyPriceBooks({
  catalogSource,
  now = new Date(),
} = {}) {
  if (typeof catalogSource !== 'string' || !catalogSource.trim()) {
    throw quoteError('QUOTE_SOURCE_INVALID', 'Raw catalog source is required');
  }
  const actualCatalogSha256 = createHash('sha256').update(catalogSource).digest('hex');
  if (actualCatalogSha256 !== APPROVED_MAIN_CATALOG_SHA256) {
    throw quoteError('QUOTE_SOURCE_HASH_MISMATCH', 'Approved main catalog hash changed');
  }
  let catalog;
  try {
    catalog = JSON.parse(catalogSource);
  } catch {
    throw quoteError('QUOTE_SOURCE_INVALID', 'Approved main catalog is not valid JSON');
  }
  const businessDate = currentDateInIstanbul(now);
  const sourceDate = assertCatalogState(catalog, actualCatalogSha256, businessDate);
  const products = catalog.products.map(validateDailyPriceProduct);
  const sourceIds = products.map((product) => product.sourceId);
  if (new Set(sourceIds).size !== products.length) {
    throw quoteError('QUOTE_PRODUCT_DUPLICATE', 'Catalog contains duplicate product identities');
  }

  return SUPPORTED_CURRENCIES
    .map((currency) => {
      const items = products
        .filter((product) => product.currency === currency)
        .sort((left, right) => left.sourceId - right.sourceId)
        .map((product) => ({
          ...product,
          sourceRef: `${APPROVED_MAIN_CATALOG_SHA256}:${product.sourceId}`,
        }));
      if (!items.length) return null;
      const core = {
        schemaVersion: 1,
        policyVersion: DAILY_PRICE_POLICY_VERSION,
        kind: 'daily-fixed-price-book',
        mode: LOCAL_SYNTHETIC_MODE,
        status: 'INTERNAL_PRICE_LOCK_NOT_APPROVED_FOR_EXTERNAL_RELEASE',
        businessDate,
        timeZone: DAILY_PRICE_TIME_ZONE,
        effectiveAt: catalog.generatedAt,
        expiresAt: null,
        technicalSameDateGuard: businessDate,
        validityPolicy: 'UNCONFIGURED_OWNER_DECISION_REQUIRED',
        dailyPriceApprovalStatus: 'NOT_APPROVED',
        priceCalculationPolicy: 'SOURCE_SALE_PRICE_IDENTITY_TEST',
        costMarginPolicy: 'UNCONFIGURED',
        source: {
          catalogSha256: APPROVED_MAIN_CATALOG_SHA256,
          publicationStatus: catalog.publicationStatus,
          retrievedAt: catalog.generatedAt,
          sourceDate,
        },
        currency,
        paymentTerms: 'PREPAID',
        automaticDiscountRate: '0.0000',
        freightStatus: 'NOT_QUOTED',
        items,
        restrictions: {
          singleCurrencyOnly: true,
          priceOverrideAllowed: false,
          currencyConversionAllowed: false,
          canSend: false,
          canPersist: false,
          canPublish: false,
          stockReserved: false,
          externalUseAllowed: false,
        },
      };
      const priceBook = {
        ...core,
        priceBookVersion: sha256Json(core),
      };
      trustedPriceBooks.add(priceBook);
      return deepFreeze(priceBook);
    })
    .filter(Boolean);
}

export function assertPriceBookIntegrity(priceBook) {
  if (!priceBook || typeof priceBook !== 'object') {
    throw quoteError('QUOTE_PRICE_BOOK_INVALID', 'Price book is required');
  }
  if (!trustedPriceBooks.has(priceBook)) {
    throw quoteError('QUOTE_PRICE_BOOK_UNTRUSTED', 'Price book was not created from the pinned raw catalog source');
  }
  const copy = { ...priceBook };
  delete copy.priceBookVersion;
  const expected = sha256Json(copy);
  if (normalizeSha256(priceBook.priceBookVersion) !== expected) {
    throw quoteError('QUOTE_PRICE_BOOK_TAMPERED', 'Daily price book integrity check failed');
  }
  if (
    priceBook.schemaVersion !== 1
    || priceBook.policyVersion !== DAILY_PRICE_POLICY_VERSION
    || priceBook.kind !== 'daily-fixed-price-book'
    || priceBook.mode !== LOCAL_SYNTHETIC_MODE
    || priceBook.status !== 'INTERNAL_PRICE_LOCK_NOT_APPROVED_FOR_EXTERNAL_RELEASE'
    || !isIsoDate(priceBook.businessDate)
    || priceBook.timeZone !== DAILY_PRICE_TIME_ZONE
    || priceBook.technicalSameDateGuard !== priceBook.businessDate
    || priceBook.validityPolicy !== 'UNCONFIGURED_OWNER_DECISION_REQUIRED'
    || priceBook.expiresAt !== null
    || priceBook.dailyPriceApprovalStatus !== 'NOT_APPROVED'
    || priceBook.priceCalculationPolicy !== 'SOURCE_SALE_PRICE_IDENTITY_TEST'
    || priceBook.costMarginPolicy !== 'UNCONFIGURED'
    || priceBook.source?.catalogSha256 !== APPROVED_MAIN_CATALOG_SHA256
    || priceBook.source?.publicationStatus !== 'approved-internal-main-selection-not-published'
    || priceBook.source?.sourceDate !== priceBook.businessDate
    || priceBook.effectiveAt !== priceBook.source?.retrievedAt
    || !SUPPORTED_CURRENCIES.includes(priceBook.currency)
    || priceBook.paymentTerms !== 'PREPAID'
    || priceBook.automaticDiscountRate !== '0.0000'
    || priceBook.freightStatus !== 'NOT_QUOTED'
    || priceBook.restrictions?.singleCurrencyOnly !== true
    || priceBook.restrictions?.priceOverrideAllowed !== false
    || priceBook.restrictions?.currencyConversionAllowed !== false
    || priceBook.restrictions?.canSend !== false
    || priceBook.restrictions?.canPersist !== false
    || priceBook.restrictions?.canPublish !== false
    || priceBook.restrictions?.stockReserved !== false
    || priceBook.restrictions?.externalUseAllowed !== false
    || !Array.isArray(priceBook.items)
    || priceBook.items.length < 1
  ) {
    throw quoteError('QUOTE_PRICE_BOOK_POLICY_INVALID', 'Daily price book policy changed');
  }
  const sourceIds = new Set();
  for (const item of priceBook.items) {
    const sourceId = Number(item?.sourceId);
    if (
      !Number.isInteger(sourceId)
      || sourceId <= 0
      || sourceIds.has(sourceId)
      || !text(item?.stockCode)
      || !text(item?.productName)
      || item?.currency !== priceBook.currency
      || item?.sourceRef !== `${APPROVED_MAIN_CATALOG_SHA256}:${sourceId}`
      || typeof item?.packageContentVerificationPending !== 'boolean'
    ) {
      throw quoteError('QUOTE_PRICE_BOOK_POLICY_INVALID', 'Locked product identity or provenance is invalid');
    }
    positivePrice(item.lockedUnitPrice);
    positiveStock(item.availableStockSnapshot);
    sourceIds.add(sourceId);
  }
  return priceBook;
}

function assertRequestedLineShape(line) {
  const override = FORBIDDEN_LINE_OVERRIDE_FIELDS.find((field) =>
    Object.prototype.hasOwnProperty.call(line || {}, field));
  if (override) {
    throw quoteError('QUOTE_PRICE_OVERRIDE_FORBIDDEN', `Caller cannot override ${override}`);
  }
  const quantity = Number(line?.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw quoteError('QUOTE_QUANTITY_INVALID', 'Quote quantity must be a positive whole number');
  }
  return quantity;
}

export function assertLocalSyntheticAction(action = {}) {
  const forbidden = FORBIDDEN_ACTION_FIELDS.find((field) => action?.[field] === true);
  if (forbidden) {
    throw quoteError('QUOTE_EXTERNAL_ACTION_FORBIDDEN', `${forbidden} is outside the local synthetic package`);
  }
  return {
    canSend: false,
    canPersist: false,
    canPublish: false,
    stockReserved: false,
    externalUseAllowed: false,
  };
}

export function buildSafeQuoteDraft(input = {}) {
  const forbiddenTerm = ['paymentTerms', 'discountRate', 'freightAmount', 'exchangeRate', 'quoteDate']
    .find((field) => Object.prototype.hasOwnProperty.call(input, field));
  if (forbiddenTerm) {
    throw quoteError('QUOTE_TERMS_OVERRIDE_FORBIDDEN', `Caller cannot override ${forbiddenTerm}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'buyerReference')) {
    throw quoteError('QUOTE_REAL_CUSTOMER_FORBIDDEN', 'Synthetic buyer identity is generated by the program');
  }

  const priceBooks = Array.isArray(input.priceBooks) ? input.priceBooks : [];
  const requestedLines = Array.isArray(input.requestedLines) ? input.requestedLines : [];
  if (!priceBooks.length || !requestedLines.length) {
    throw quoteError('QUOTE_LINE_REQUIRED', 'At least one locked product line is required');
  }
  priceBooks.forEach(assertPriceBookIntegrity);
  const businessDates = new Set(priceBooks.map((book) => book.businessDate));
  const sourceHashes = new Set(priceBooks.map((book) => book.source?.catalogSha256));
  if (businessDates.size !== 1 || sourceHashes.size !== 1) {
    throw quoteError('QUOTE_PRICE_BOOK_SET_INVALID', 'Price books must share one date and source');
  }
  const lockedDate = priceBooks[0].businessDate;
  const currentBusinessDate = currentDateInIstanbul(input.now || new Date());
  if (lockedDate !== currentBusinessDate) {
    throw quoteError('QUOTE_PRICE_EXPIRED', 'Daily price books are not current for the real Istanbul business date');
  }
  const destinationCountry = text(input.destinationCountry).toUpperCase();
  if (destinationCountry) {
    throw quoteError(
      'QUOTE_DESTINATION_POLICY_UNCONFIGURED',
      'Country scope is not configured for the first local synthetic package',
    );
  }
  const quoteDate = lockedDate;
  const buyerReference = 'SYNTHETIC-LOCAL-REVIEW';

  const itemIndex = new Map();
  for (const book of priceBooks) {
    for (const item of book.items || []) {
      if (itemIndex.has(item.sourceId)) {
        throw quoteError('QUOTE_PRODUCT_DUPLICATE', 'Product exists in more than one price book');
      }
      itemIndex.set(item.sourceId, { book, item });
    }
  }

  const requestedIds = requestedLines.map((line) => Number(line?.sourceId));
  if (new Set(requestedIds).size !== requestedIds.length) {
    throw quoteError('QUOTE_PRODUCT_DUPLICATE', 'Quote contains duplicate product lines');
  }
  const selected = requestedLines.map((line) => {
    const quantity = assertRequestedLineShape(line);
    const sourceId = Number(line?.sourceId);
    const match = itemIndex.get(sourceId);
    if (!match) {
      throw quoteError('QUOTE_PRODUCT_NOT_FOUND', `Product ${sourceId || 'missing'} is not in the locked books`);
    }
    if (text(line.stockCode) !== match.item.stockCode) {
      throw quoteError('QUOTE_PRODUCT_IDENTITY_MISMATCH', `Stock code does not match product ${sourceId}`);
    }
    if (quantity > match.item.availableStockSnapshot) {
      throw quoteError('QUOTE_STOCK_INSUFFICIENT', `Requested quantity exceeds the stock snapshot for ${sourceId}`);
    }
    const unitPrice = positivePrice(match.item.lockedUnitPrice);
    return {
      priceBookVersion: match.book.priceBookVersion,
      sourceId,
      stockCode: match.item.stockCode,
      productName: match.item.productName,
      quantity,
      currency: match.book.currency,
      unitPrice: unitPrice.formatted,
      lineTotal: scaledAmount(unitPrice.scaled * BigInt(quantity)),
      packageContentVerificationPending: match.item.packageContentVerificationPending,
    };
  });

  const currencies = new Set(selected.map((line) => line.currency));
  if (currencies.size !== 1) {
    throw quoteError('QUOTE_CURRENCY_MIXED', 'A quote cannot mix currencies without an approved rate policy');
  }
  const currency = selected[0].currency;
  const goodsSubtotalScaled = selected.reduce(
    (total, line) => total + positivePrice(line.lineTotal).scaled,
    0n,
  );
  const packageContentPendingCount = selected
    .filter((line) => line.packageContentVerificationPending).length;
  const blockers = [
    'EXTERNAL_OWNER_APPROVAL_REQUIRED',
    'DAILY_PRICE_BOOK_OWNER_APPROVAL_REQUIRED',
    'PRICE_CALCULATION_POLICY_UNCONFIGURED',
    'COST_MARGIN_SOURCE_UNCONFIGURED',
    'VALIDITY_POLICY_UNCONFIGURED',
    'FRESH_STOCK_RECHECK_REQUIRED_BEFORE_EXTERNAL_USE',
    'SHIPPING_QUOTE_NOT_AVAILABLE',
    'INCOTERM_TAX_AND_COUNTRY_TERMS_UNCONFIGURED',
    'RETURN_OR_REMEDY_TERMS_REQUIRE_OWNER_CONFIRMATION',
    'DESTINATION_COUNTRY_SCOPE_UNVERIFIED',
  ];
  blockers.push('DESTINATION_COUNTRY_REQUIRED');
  if (packageContentPendingCount) blockers.push('PACKAGE_CONTENT_VERIFICATION_PENDING');

  const draftCore = {
    schemaVersion: 1,
    policyVersion: DAILY_PRICE_POLICY_VERSION,
    mode: LOCAL_SYNTHETIC_MODE,
    status: 'DRAFT_ONLY',
    quoteVersion: 1,
    quoteDate,
    validOnDate: quoteDate,
    timeZone: DAILY_PRICE_TIME_ZONE,
    buyerReference,
    destinationRegion: 'EUROPE',
    destinationCountry: destinationCountry || null,
    currency,
    dailyPriceApprovalStatus: 'NOT_APPROVED',
    priceCalculationPolicy: 'SOURCE_SALE_PRICE_IDENTITY_TEST',
    validityPolicy: 'UNCONFIGURED_OWNER_DECISION_REQUIRED',
    paymentTerms: 'PREPAID',
    automaticDiscountRate: '0.0000',
    freight: {
      status: 'NOT_QUOTED',
      included: false,
      amount: null,
    },
    returnTerms: {
      status: 'OWNER_CONFIRMATION_REQUIRED',
      policy: 'RESOLUTION_FIRST_RETURN_LAST_OPTION',
    },
    lines: selected,
    totals: {
      goodsSubtotal: scaledAmount(goodsSubtotalScaled),
      shippingAmount: null,
      payableTotal: null,
      note: 'Door-delivered total is not calculated without an official shipping quote.',
    },
    packageContentPendingCount,
    blockers,
    safety: assertLocalSyntheticAction(),
  };
  const quoteDraftVersion = sha256Json(draftCore);
  const quoteDraft = {
    ...draftCore,
    quoteId: `SYN-${quoteDate.replaceAll('-', '')}-${quoteDraftVersion.slice(0, 12).toUpperCase()}`,
    quoteDraftVersion,
  };
  trustedQuoteDrafts.add(quoteDraft);
  return deepFreeze(quoteDraft);
}

export function assertQuoteDraftIntegrity(quote) {
  if (!quote || typeof quote !== 'object' || !trustedQuoteDrafts.has(quote)) {
    throw quoteError('QUOTE_DRAFT_UNTRUSTED', 'Quote draft was not created by the local synthetic core');
  }
  const copy = { ...quote };
  delete copy.quoteId;
  delete copy.quoteDraftVersion;
  const expectedVersion = sha256Json(copy);
  const expectedId = `SYN-${quote.validOnDate.replaceAll('-', '')}-${expectedVersion.slice(0, 12).toUpperCase()}`;
  if (
    quote.quoteDraftVersion !== expectedVersion
    || quote.quoteId !== expectedId
    || quote.schemaVersion !== 1
    || quote.policyVersion !== DAILY_PRICE_POLICY_VERSION
    || quote.mode !== LOCAL_SYNTHETIC_MODE
    || quote.status !== 'DRAFT_ONLY'
    || quote.buyerReference !== 'SYNTHETIC-LOCAL-REVIEW'
    || quote.destinationRegion !== 'EUROPE'
    || quote.destinationCountry !== null
    || quote.dailyPriceApprovalStatus !== 'NOT_APPROVED'
    || quote.priceCalculationPolicy !== 'SOURCE_SALE_PRICE_IDENTITY_TEST'
    || quote.validityPolicy !== 'UNCONFIGURED_OWNER_DECISION_REQUIRED'
    || quote.paymentTerms !== 'PREPAID'
    || quote.automaticDiscountRate !== '0.0000'
    || quote.freight?.status !== 'NOT_QUOTED'
    || quote.freight?.included !== false
    || quote.freight?.amount !== null
    || quote.totals?.payableTotal !== null
    || quote.safety?.canSend !== false
    || quote.safety?.canPersist !== false
    || quote.safety?.canPublish !== false
    || quote.safety?.stockReserved !== false
    || quote.safety?.externalUseAllowed !== false
    || !quote.blockers?.includes('DAILY_PRICE_BOOK_OWNER_APPROVAL_REQUIRED')
  ) {
    throw quoteError('QUOTE_DRAFT_TAMPERED', 'Quote draft integrity or policy check failed');
  }
  return quote;
}

export function assertQuoteDraftCurrent(quote, now = new Date()) {
  assertQuoteDraftIntegrity(quote);
  const businessDate = currentDateInIstanbul(now);
  if (quote.validOnDate !== businessDate) {
    throw quoteError('QUOTE_PRICE_EXPIRED', 'Daily quote draft is not current for this Istanbul business date');
  }
  return quote;
}

function findForbiddenSummaryField(value, path = 'summary') {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findForbiddenSummaryField(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return '';
  }
  if (!value || typeof value !== 'object') return '';
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_SUMMARY_FIELDS.has(key)) return `${path}.${key}`;
    const found = findForbiddenSummaryField(child, `${path}.${key}`);
    if (found) return found;
  }
  return '';
}

export function buildSafeEvidenceSummary({ catalog, priceBooks, quoteDraft } = {}) {
  (priceBooks || []).forEach(assertPriceBookIntegrity);
  assertQuoteDraftIntegrity(quoteDraft);
  const summary = {
    schemaVersion: 1,
    policyVersion: DAILY_PRICE_POLICY_VERSION,
    mode: LOCAL_SYNTHETIC_MODE,
    businessDate: quoteDraft?.quoteDate || null,
    sourceCatalog: {
      sha256: APPROVED_MAIN_CATALOG_SHA256,
      generatedAt: catalog?.generatedAt || null,
      productCount: Array.isArray(catalog?.products) ? catalog.products.length : 0,
      packageContentPendingProductCount: Array.isArray(catalog?.products)
        ? catalog.products.filter((product) => Array.isArray(product?.reviewFlags)
          && product.reviewFlags.includes('PACKAGE_CONTENT_VERIFICATION_PENDING')).length
        : 0,
      publicationStatus: catalog?.publicationStatus || null,
    },
    priceBooks: (priceBooks || []).map((book) => ({
      currency: book.currency,
      productCount: Array.isArray(book.items) ? book.items.length : 0,
      priceBookVersion: book.priceBookVersion,
      effectiveAt: book.effectiveAt,
      expiresAt: book.expiresAt,
      dailyPriceApprovalStatus: book.dailyPriceApprovalStatus,
      priceCalculationPolicy: book.priceCalculationPolicy,
      validityPolicy: book.validityPolicy,
    })),
    syntheticQuote: {
      quoteId: quoteDraft?.quoteId || null,
      quoteDraftVersion: quoteDraft?.quoteDraftVersion || null,
      status: quoteDraft?.status || null,
      currency: quoteDraft?.currency || null,
      lineCount: Array.isArray(quoteDraft?.lines) ? quoteDraft.lines.length : 0,
      dailyPriceApprovalStatus: quoteDraft?.dailyPriceApprovalStatus || null,
      priceCalculationPolicy: quoteDraft?.priceCalculationPolicy || null,
      validityPolicy: quoteDraft?.validityPolicy || null,
      paymentTerms: quoteDraft?.paymentTerms || null,
      automaticDiscountRate: quoteDraft?.automaticDiscountRate || null,
      freightStatus: quoteDraft?.freight?.status || null,
      packageContentPendingCount: Number(quoteDraft?.packageContentPendingCount || 0),
      blockers: quoteDraft?.blockers || [],
      safety: quoteDraft?.safety || assertLocalSyntheticAction(),
    },
    commercialValuesRedacted: true,
    databaseWritePerformed: false,
    erpOrVegaWritePerformed: false,
    externalMessageSent: false,
    orderCreated: false,
    paymentCollected: false,
    stockReserved: false,
    pdfOrSitePublished: false,
    localModelUsed: false,
  };
  const forbiddenPath = findForbiddenSummaryField(summary);
  if (forbiddenPath) {
    throw quoteError('QUOTE_SUMMARY_FIELD_FORBIDDEN', `Commercial field leaked into evidence: ${forbiddenPath}`);
  }
  return summary;
}
