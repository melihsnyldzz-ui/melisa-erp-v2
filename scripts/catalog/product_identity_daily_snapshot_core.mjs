import { createHash } from 'node:crypto';

export const APPROVED_MAIN_CATALOG_SHA256 = '54166e9f7ad64e8ef084fcb2e338f654ae94d1396a60ed204d696187f1fd23b5';
export const PRODUCT_IDENTITY_POLICY_VERSION = 'approved-product-identity-registry-v1';
export const DAILY_SNAPSHOT_POLICY_VERSION = 'daily-price-stock-snapshot-v1';
export const DAILY_SNAPSHOT_TIME_ZONE = 'Europe/Istanbul';
export const MIGRATION_OBSERVATION_MODE = 'APPROVED_CATALOG_MIGRATION_NOT_LIVE_REFRESH';
export const MIGRATION_OBSERVATION_SOURCE = 'approved-catalog-file';
export const LIVE_VEGA_OBSERVATION_MODE = 'LIVE_VEGA_READ_ONLY_SNAPSHOT_TEST';
export const LIVE_VEGA_OBSERVATION_SOURCE = 'direct-parameterized-select';
export const LIVE_VEGA_FIELD_MAPPING_VERSION = 'vega-f0102-d0007-default-unit-sale1-net-stock-v1';
export const LIVE_VEGA_FIELD_MAPPING_APPROVAL_REF = 'current-thread-user-approval-2026-09-01';
export const EXPECTED_UPSTREAM_SOURCE_IDENTITY = Object.freeze({
  source: 'vega-live-read-only',
  companyCode: 'F0102',
  periodCode: 'D0007',
  year: 2026,
});
export const REQUIRED_LIVE_VEGA_TABLES = Object.freeze([
  'F0102TBLSTOKLAR',
  'F0102D0007TBLSTOKHAREKETLERI',
  'F0102TBLBIRIMLEREX',
]);

const SUPPORTED_CURRENCIES = Object.freeze(['TRY', 'USD', 'EUR']);
const EXPECTED_PRODUCT_COUNT = 30;
const BLOCKED_STOCK_CODE = '7770 CONCEPT';
const REQUIRED_REPLACEMENT_STOCK_CODE = '8023 CONCEPT';
const FORBIDDEN_IDENTITY_FIELDS = new Set([
  'currency',
  'salePrice',
  'purchasePrice',
  'stockQuantity',
  'reservedQuantity',
  'exchangeRate',
  'cost',
  'margin',
  'validUntil',
  'freight',
  'customer',
]);
const FORBIDDEN_EVIDENCE_FIELDS = new Set([
  'observedSalePrice',
  'observedStockQuantity',
  'observedReservedQuantity',
  'barcode',
  'purchasePrice',
  'cost',
  'customerName',
  'customerPhone',
  'customerEmail',
]);

const trustedIdentityRegistries = new WeakSet();
const trustedDailySnapshots = new WeakSet();

function snapshotError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
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

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function dateInTimeZone(value, timeZone = DAILY_SNAPSHOT_TIME_ZONE) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw snapshotError('DAILY_SNAPSHOT_TIME_INVALID', 'Observation time must be a valid timestamp');
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

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function parseRawJson(rawSource, code, message) {
  if (typeof rawSource !== 'string' || !rawSource.trim()) {
    throw snapshotError(code, message);
  }
  try {
    return JSON.parse(rawSource);
  } catch {
    throw snapshotError(code, message);
  }
}

function normalizeCurrency(value) {
  const rawCurrency = text(value).toUpperCase();
  const currency = ['₺', 'TL', 'TRY'].includes(rawCurrency)
    ? 'TRY'
    : ['$', 'US$', 'USD'].includes(rawCurrency)
      ? 'USD'
      : ['€', 'EUR'].includes(rawCurrency)
        ? 'EUR'
        : rawCurrency;
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw snapshotError('DAILY_SNAPSHOT_CURRENCY_INVALID', `Unsupported currency: ${currency || 'missing'}`);
  }
  return currency;
}

function nonNegativeDecimal(value, fieldName) {
  if (value === null || value === undefined || typeof value === 'boolean') {
    throw snapshotError('DAILY_SNAPSHOT_PRICE_INVALID', `${fieldName} must be a non-negative amount`);
  }
  const raw = text(value);
  if (!/^\d+(?:\.\d{1,4})?$/.test(raw)) {
    throw snapshotError('DAILY_SNAPSHOT_PRICE_INVALID', `${fieldName} must use at most four decimal places`);
  }
  const [whole, fraction = ''] = raw.split('.');
  const scaled = BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, '0'));
  return {
    scaled,
    formatted: `${whole}.${fraction.padEnd(4, '0')}`,
  };
}

function nonNegativeStock(value, fieldName) {
  if (value === null || value === undefined || typeof value === 'boolean' || text(value) === '') {
    throw snapshotError('DAILY_SNAPSHOT_STOCK_INVALID', `${fieldName} must be a non-negative number`);
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw snapshotError('DAILY_SNAPSHOT_STOCK_INVALID', `${fieldName} must be a non-negative number`);
  }
  return number;
}

function assertExpectedUpstreamSourceIdentity(sourceIdentity) {
  if (
    sourceIdentity?.source !== EXPECTED_UPSTREAM_SOURCE_IDENTITY.source
    || sourceIdentity?.companyCode !== EXPECTED_UPSTREAM_SOURCE_IDENTITY.companyCode
    || sourceIdentity?.periodCode !== EXPECTED_UPSTREAM_SOURCE_IDENTITY.periodCode
    || Number(sourceIdentity?.year) !== EXPECTED_UPSTREAM_SOURCE_IDENTITY.year
  ) {
    throw snapshotError('DAILY_SNAPSHOT_PROVENANCE_INVALID', 'Source company, period, year, or mode changed');
  }
}

function assertApprovedCatalog(catalog, actualHash) {
  if (actualHash !== APPROVED_MAIN_CATALOG_SHA256) {
    throw snapshotError('PRODUCT_IDENTITY_SOURCE_HASH_MISMATCH', 'Approved main catalog hash changed');
  }
  assertExpectedUpstreamSourceIdentity(catalog?.sourceIdentity);
  if (
    catalog?.publicationStatus !== 'approved-internal-main-selection-not-published'
    || catalog?.selectionStatus !== 'owner-approved-main-selection-external-publication-blocked'
    || catalog?.approval?.status !== 'OWNER_APPROVED'
    || catalog?.approval?.externalPublicationApproved !== false
    || catalog?.approval?.erpOrVegaWriteApproved !== false
    || !Array.isArray(catalog?.approval?.approvedScope)
    || !Array.isArray(catalog?.products)
    || catalog.products.length !== EXPECTED_PRODUCT_COUNT
  ) {
    throw snapshotError('PRODUCT_IDENTITY_SOURCE_NOT_APPROVED', 'Catalog is not the approved internal 30-product selection');
  }
  if (!text(catalog.generatedAt) || Number.isNaN(new Date(catalog.generatedAt).getTime())) {
    throw snapshotError('PRODUCT_IDENTITY_SOURCE_TIME_INVALID', 'Approved catalog timestamp is invalid');
  }
  return catalog;
}

function readApprovedCatalog(catalogSource) {
  if (typeof catalogSource !== 'string' || !catalogSource.trim()) {
    throw snapshotError('PRODUCT_IDENTITY_SOURCE_INVALID', 'Raw approved catalog source is required');
  }
  const actualHash = createHash('sha256').update(catalogSource).digest('hex');
  const catalog = parseRawJson(
    catalogSource,
    'PRODUCT_IDENTITY_SOURCE_INVALID',
    'Approved catalog must be valid JSON',
  );
  return assertApprovedCatalog(catalog, actualHash);
}

function canonicalIdentityRows(products = []) {
  return products
    .map((product) => {
      const sourceId = Number(product?.sourceId);
      const stockCode = text(product?.stockCode);
      const sourceProductName = text(product?.productName);
      const customerFacingName = text(product?.customerFacingName) || null;
      const brand = text(product?.brand);
      const category = text(product?.category);
      const unitName = text(product?.unitName);
      if (
        !Number.isInteger(sourceId)
        || sourceId <= 0
        || !stockCode
        || !sourceProductName
        || !brand
        || !category
        || !unitName
      ) {
        throw snapshotError('PRODUCT_IDENTITY_INVALID', 'Approved product identity is incomplete');
      }
      if (stockCode === BLOCKED_STOCK_CODE) {
        throw snapshotError('PRODUCT_IDENTITY_BLOCKED', 'Blocked product cannot enter the identity registry');
      }
      const nameApprovalStatus = customerFacingName
        ? text(product?.nameApproval?.status)
        : 'SOURCE_NAME_RETAINED';
      if (customerFacingName && nameApprovalStatus !== 'owner-approved-for-internal-catalog') {
        throw snapshotError('PRODUCT_IDENTITY_NAME_NOT_APPROVED', 'Customer-facing product name is not owner approved');
      }
      return {
        sourceId,
        stockCode,
        sourceProductName,
        customerFacingName,
        approvedDisplayName: customerFacingName || sourceProductName,
        brand,
        category,
        unitName,
        nameApprovalStatus,
        packageContentVerificationStatus: Array.isArray(product?.reviewFlags)
          && product.reviewFlags.includes('PACKAGE_CONTENT_VERIFICATION_PENDING')
          ? 'PENDING_PHYSICAL_OR_SUPPLIER_VERIFICATION'
          : 'NOT_FLAGGED_PENDING',
      };
    })
    .sort((left, right) => left.sourceId - right.sourceId || left.stockCode.localeCompare(right.stockCode));
}

function assertUniqueIdentities(products) {
  const sourceIds = new Set();
  const stockCodes = new Set();
  for (const product of products) {
    if (sourceIds.has(product.sourceId)) {
      throw snapshotError('PRODUCT_IDENTITY_SOURCE_ID_DUPLICATE', `Duplicate sourceId: ${product.sourceId}`);
    }
    if (stockCodes.has(product.stockCode)) {
      throw snapshotError('PRODUCT_IDENTITY_STOCK_CODE_DUPLICATE', `Duplicate stockCode: ${product.stockCode}`);
    }
    sourceIds.add(product.sourceId);
    stockCodes.add(product.stockCode);
  }
}

function findForbiddenField(value, forbiddenFields, path = 'payload') {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findForbiddenField(value[index], forbiddenFields, `${path}[${index}]`);
      if (found) return found;
    }
    return '';
  }
  if (!value || typeof value !== 'object') return '';
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenFields.has(key)) return `${path}.${key}`;
    const found = findForbiddenField(child, forbiddenFields, `${path}.${key}`);
    if (found) return found;
  }
  return '';
}

function identityMembershipHash(products) {
  return sha256Json(products.map(({ sourceId, stockCode }) => ({ sourceId, stockCode })));
}

export function parseProductIdentitySnapshotArgs(args = []) {
  const result = { help: false };
  for (const arg of args) {
    if (arg === '--help') {
      result.help = true;
      continue;
    }
    throw snapshotError('DAILY_SNAPSHOT_ARGUMENT_INVALID', `Unsupported argument: ${arg}`);
  }
  return result;
}

export function currentDateInIstanbul(now = new Date()) {
  return dateInTimeZone(now);
}

export function buildApprovedProductIdentityRegistry({ catalogSource } = {}) {
  const catalog = readApprovedCatalog(catalogSource);
  const products = canonicalIdentityRows(catalog.products);
  assertUniqueIdentities(products);
  if (products.length !== EXPECTED_PRODUCT_COUNT) {
    throw snapshotError('PRODUCT_IDENTITY_COUNT_INVALID', 'Identity registry must contain exactly 30 products');
  }
  if (!products.some((product) => product.stockCode === REQUIRED_REPLACEMENT_STOCK_CODE)) {
    throw snapshotError('PRODUCT_IDENTITY_REQUIRED_REPLACEMENT_MISSING', 'Approved 8023 CONCEPT replacement is missing');
  }
  const forbiddenPath = findForbiddenField(products, FORBIDDEN_IDENTITY_FIELDS, 'identityRegistry.products');
  if (forbiddenPath) {
    throw snapshotError('PRODUCT_IDENTITY_COMMERCIAL_FIELD_FORBIDDEN', `Commercial field leaked into identity registry: ${forbiddenPath}`);
  }

  const ownerApprovedCustomerFacingNameCount = products
    .filter((product) => product.customerFacingName).length;
  const selectionApprovalBindingSha256 = sha256Json({
    sourceCatalogSha256: APPROVED_MAIN_CATALOG_SHA256,
    approvedAt: catalog.approval.approvedAt,
    approvedCandidate: catalog.approval.approvedCandidate,
    approvedScope: [...catalog.approval.approvedScope].sort(),
  });
  const core = {
    schemaVersion: 1,
    policyVersion: PRODUCT_IDENTITY_POLICY_VERSION,
    canonicalizationVersion: 'source-id-stock-code-v1',
    kind: 'approved-product-identity-registry',
    status: 'OWNER_APPROVED_MEMBERSHIP_NAMES_AND_BRAND_SCOPE',
    sourceCatalog: {
      sha256: APPROVED_MAIN_CATALOG_SHA256,
      approvedAt: catalog.approval.approvedAt,
      selectionApprovalStatus: catalog.approval.status,
      approvedScope: [...catalog.approval.approvedScope].sort(),
      selectionApprovalBindingSha256,
    },
    productCount: products.length,
    membershipSha256: identityMembershipHash(products),
    products,
    blockedProducts: [{ stockCode: BLOCKED_STOCK_CODE, status: 'BLOCKED' }],
    approvalLimits: {
      productMembershipApproved: true,
      ownerApprovedCustomerFacingNameCount,
      sourceNameRetainedCount: products.length - ownerApprovedCustomerFacingNameCount,
      brandCompositionApproved: true,
      sourceMetadataApprovalStatus: 'NOT_SEPARATELY_OWNER_APPROVED',
      priceApproved: false,
      stockApproved: false,
      currencyApproved: false,
      priceFormulaApproved: false,
      externalPublicationApproved: false,
      customerSendApproved: false,
      erpOrVegaWriteApproved: false,
    },
  };
  const identityRegistrySha256 = sha256Json(core);
  const registry = {
    ...core,
    registryId: `ROSTER-${identityRegistrySha256.slice(0, 16).toUpperCase()}`,
    identityRegistrySha256,
  };
  trustedIdentityRegistries.add(registry);
  return deepFreeze(registry);
}

export function assertIdentityRegistryIntegrity(registry) {
  if (!registry || typeof registry !== 'object' || !trustedIdentityRegistries.has(registry)) {
    throw snapshotError('PRODUCT_IDENTITY_REGISTRY_UNTRUSTED', 'Identity registry was not built from the pinned raw catalog');
  }
  const { registryId, identityRegistrySha256, ...core } = registry;
  const expectedSha256 = sha256Json(core);
  if (
    identityRegistrySha256 !== expectedSha256
    || registryId !== `ROSTER-${expectedSha256.slice(0, 16).toUpperCase()}`
    || registry.schemaVersion !== 1
    || registry.policyVersion !== PRODUCT_IDENTITY_POLICY_VERSION
    || registry.kind !== 'approved-product-identity-registry'
    || registry.status !== 'OWNER_APPROVED_MEMBERSHIP_NAMES_AND_BRAND_SCOPE'
    || registry.sourceCatalog?.sha256 !== APPROVED_MAIN_CATALOG_SHA256
    || registry.productCount !== EXPECTED_PRODUCT_COUNT
    || !Array.isArray(registry.products)
    || registry.products.length !== EXPECTED_PRODUCT_COUNT
    || registry.membershipSha256 !== identityMembershipHash(registry.products)
    || !/^[a-f0-9]{64}$/.test(registry.sourceCatalog?.selectionApprovalBindingSha256)
    || registry.approvalLimits?.ownerApprovedCustomerFacingNameCount !== 10
    || registry.approvalLimits?.sourceNameRetainedCount !== 20
    || registry.approvalLimits?.sourceMetadataApprovalStatus !== 'NOT_SEPARATELY_OWNER_APPROVED'
    || registry.approvalLimits?.priceApproved !== false
    || registry.approvalLimits?.stockApproved !== false
    || registry.approvalLimits?.currencyApproved !== false
    || registry.approvalLimits?.priceFormulaApproved !== false
    || registry.approvalLimits?.externalPublicationApproved !== false
    || registry.approvalLimits?.customerSendApproved !== false
    || registry.approvalLimits?.erpOrVegaWriteApproved !== false
  ) {
    throw snapshotError('PRODUCT_IDENTITY_REGISTRY_TAMPERED', 'Identity registry integrity or policy changed');
  }
  assertUniqueIdentities(registry.products);
  const forbiddenPath = findForbiddenField(registry.products, FORBIDDEN_IDENTITY_FIELDS, 'identityRegistry.products');
  if (forbiddenPath) {
    throw snapshotError('PRODUCT_IDENTITY_COMMERCIAL_FIELD_FORBIDDEN', `Commercial field leaked into identity registry: ${forbiddenPath}`);
  }
  return registry;
}

export function buildCatalogMigrationObservationSource({ catalogSource } = {}) {
  const catalog = readApprovedCatalog(catalogSource);
  const observation = {
    schemaVersion: 1,
    captureContractVersion: DAILY_SNAPSHOT_POLICY_VERSION,
    sourceMode: MIGRATION_OBSERVATION_MODE,
    observationSource: MIGRATION_OBSERVATION_SOURCE,
    upstreamOrigin: { ...EXPECTED_UPSTREAM_SOURCE_IDENTITY },
    sourceCatalogSha256: APPROVED_MAIN_CATALOG_SHA256,
    fieldMappingVersion: 'catalog-selection-sale-price-stock-v1-not-live-vega',
    observedAt: catalog.generatedAt,
    businessDate: dateInTimeZone(catalog.generatedAt),
    completeness: {
      complete: true,
      requestedProductCount: EXPECTED_PRODUCT_COUNT,
      returnedProductCount: catalog.products.length,
    },
    readOnlyEvidence: {
      liveVegaReadPerformed: false,
      sourceRowsFromApprovedCatalog: true,
      databaseWritePerformed: false,
      erpOrVegaWritePerformed: false,
      networkRequestPerformed: false,
    },
    products: catalog.products.map((product) => ({
      sourceId: product.sourceId,
      stockCode: product.stockCode,
      currency: product.currency,
      salePrice: product.salePrice,
      stockQuantity: product.stockQuantity,
      reservedQuantity: null,
      isPassive: null,
    })),
  };
  return JSON.stringify(observation);
}

export function buildLiveReadOnlyPermissionQuery() {
  const tableValues = REQUIRED_LIVE_VEGA_TABLES
    .map((tableName) => `(N'${tableName}')`)
    .join(', ');
  return `
    SELECT
      target.object_name,
      HAS_PERMS_BY_NAME(CONCAT(N'dbo.', target.object_name), N'OBJECT', N'SELECT') AS can_select,
      HAS_PERMS_BY_NAME(CONCAT(N'dbo.', target.object_name), N'OBJECT', N'INSERT') AS can_insert,
      HAS_PERMS_BY_NAME(CONCAT(N'dbo.', target.object_name), N'OBJECT', N'UPDATE') AS can_update,
      HAS_PERMS_BY_NAME(CONCAT(N'dbo.', target.object_name), N'OBJECT', N'DELETE') AS can_delete,
      HAS_PERMS_BY_NAME(CONCAT(N'dbo.', target.object_name), N'OBJECT', N'ALTER') AS can_alter,
      HAS_PERMS_BY_NAME(CONCAT(N'dbo.', target.object_name), N'OBJECT', N'CONTROL') AS can_control
    FROM (VALUES ${tableValues}) target(object_name)
    ORDER BY target.object_name;
  `;
}

export function assertLiveReadOnlyPermissions(rows = []) {
  if (!Array.isArray(rows) || rows.length !== REQUIRED_LIVE_VEGA_TABLES.length) {
    throw snapshotError('DAILY_SNAPSHOT_PERMISSION_EVIDENCE_INCOMPLETE', 'Vega permission evidence is incomplete');
  }
  const rowsByName = new Map(rows.map((row) => [text(row?.object_name), row]));
  for (const tableName of REQUIRED_LIVE_VEGA_TABLES) {
    const row = rowsByName.get(tableName);
    if (!row || Number(row.can_select) !== 1) {
      throw snapshotError('DAILY_SNAPSHOT_SELECT_PERMISSION_MISSING', `SELECT permission is missing for ${tableName}`);
    }
    if (['can_insert', 'can_update', 'can_delete', 'can_alter', 'can_control']
      .some((key) => Number(row[key]) !== 0)) {
      throw snapshotError('DAILY_SNAPSHOT_WRITE_PERMISSION_PRESENT', `Write-capable permission is present for ${tableName}`);
    }
  }
  return deepFreeze({
    checkedTableCount: REQUIRED_LIVE_VEGA_TABLES.length,
    selectPermissionConfirmed: true,
    writePermissionAbsent: true,
  });
}

export function buildLiveVegaSnapshotQuery(identityRegistry) {
  assertIdentityRegistryIntegrity(identityRegistry);
  const targetValues = identityRegistry.products
    .map((_, index) => `(@liveSourceId${index}, @liveStockCode${index})`)
    .join(', ');
  return `
    WITH requested_products(source_id, expected_stock_code) AS (
      SELECT source_id, expected_stock_code
      FROM (VALUES ${targetValues}) requested_values(source_id, expected_stock_code)
    ),
    period_stock AS (
      SELECT
        movement.STOKNO AS source_id,
        SUM(CAST(ISNULL(movement.GIREN, 0) - ISNULL(movement.CIKAN, 0) AS decimal(19, 4))) AS movement_net_stock,
        COUNT_BIG(1) AS movement_count
      FROM dbo.F0102D0007TBLSTOKHAREKETLERI movement
      INNER JOIN requested_products requested ON requested.source_id = movement.STOKNO
      GROUP BY movement.STOKNO
    )
    SELECT
      product.IND AS source_id,
      LTRIM(RTRIM(product.STOKKODU)) AS stock_code,
      unit_row.SATISFIYATI1 AS sale_price,
      LTRIM(RTRIM(ISNULL(unit_row.PB1, N''))) AS sale_currency,
      CAST(CASE
        WHEN ISNULL(period_stock.movement_count, 0) > 0 THEN ISNULL(period_stock.movement_net_stock, 0)
        ELSE ISNULL(product.KALAN, 0)
      END AS decimal(19, 4)) AS stock_quantity,
      CASE
        WHEN ISNULL(period_stock.movement_count, 0) > 0 THEN N'PERIOD_MOVEMENT_NET'
        ELSE N'CARD_REMAINING_FALLBACK'
      END AS stock_basis,
      CAST(ISNULL(product.REZERV, 0) AS decimal(19, 4)) AS reserved_quantity,
      CAST(CASE
        WHEN ISNULL(product.STATUS, 0) = 1
          AND ISNULL(product.DELETED, 0) = 0
          AND ISNULL(product.IPTAL, 0) = 0
        THEN 0 ELSE 1
      END AS int) AS is_passive
    FROM requested_products requested
    INNER JOIN dbo.F0102TBLSTOKLAR product ON product.IND = requested.source_id
    LEFT JOIN period_stock ON period_stock.source_id = product.IND
    OUTER APPLY (
      SELECT TOP (1)
        unit_candidate.SATISFIYATI1,
        unit_candidate.PB1
      FROM dbo.F0102TBLBIRIMLEREX unit_candidate
      WHERE unit_candidate.STOKNO = product.IND
      ORDER BY
        CASE WHEN ISNULL(unit_candidate.VARSAYILAN, 0) = 1 THEN 0 ELSE 1 END,
        CASE WHEN ISNULL(unit_candidate.ANABIRIM, 0) = 1 THEN 0 ELSE 1 END,
        unit_candidate.IND ASC
    ) unit_row
    WHERE
      ISNULL(product.STATUS, 0) = 1
      AND ISNULL(product.DELETED, 0) = 0
      AND ISNULL(product.IPTAL, 0) = 0
    ORDER BY product.IND ASC;
  `;
}

export function buildLiveVegaObservationSource({
  identityRegistry,
  rows,
  permissionEvidence,
  observedAt,
} = {}) {
  assertIdentityRegistryIntegrity(identityRegistry);
  if (
    permissionEvidence?.checkedTableCount !== REQUIRED_LIVE_VEGA_TABLES.length
    || permissionEvidence?.selectPermissionConfirmed !== true
    || permissionEvidence?.writePermissionAbsent !== true
  ) {
    throw snapshotError('DAILY_SNAPSHOT_PERMISSION_EVIDENCE_INVALID', 'Verified read-only permission evidence is required');
  }
  if (!Array.isArray(rows)) {
    throw snapshotError('DAILY_SNAPSHOT_LIVE_ROWS_INVALID', 'Live Vega rows are required');
  }
  const products = rows.map((row) => {
    const passiveRaw = row?.is_passive;
    const isPassive = passiveRaw === false || Number(passiveRaw) === 0
      ? false
      : passiveRaw === true || Number(passiveRaw) === 1
        ? true
        : null;
    const stockBasis = text(row?.stock_basis);
    if (!['PERIOD_MOVEMENT_NET', 'CARD_REMAINING_FALLBACK'].includes(stockBasis)) {
      throw snapshotError('DAILY_SNAPSHOT_STOCK_BASIS_INVALID', 'Live stock basis is missing or unknown');
    }
    if (isPassive === null) {
      throw snapshotError('DAILY_SNAPSHOT_ACTIVITY_STATUS_INVALID', 'Live activity status is invalid');
    }
    return {
      sourceId: Number(row?.source_id),
      stockCode: text(row?.stock_code),
      currency: text(row?.sale_currency),
      salePrice: row?.sale_price,
      stockQuantity: row?.stock_quantity,
      stockBasis,
      reservedQuantity: row?.reserved_quantity,
      isPassive,
    };
  });
  assertObservationIdentityCoverage(identityRegistry, products);
  const observationTime = new Date(observedAt);
  if (Number.isNaN(observationTime.getTime())) {
    throw snapshotError('DAILY_SNAPSHOT_TIME_INVALID', 'Live observation time must be a valid timestamp');
  }
  const observation = {
    schemaVersion: 1,
    captureContractVersion: DAILY_SNAPSHOT_POLICY_VERSION,
    sourceMode: LIVE_VEGA_OBSERVATION_MODE,
    observationSource: LIVE_VEGA_OBSERVATION_SOURCE,
    upstreamOrigin: { ...EXPECTED_UPSTREAM_SOURCE_IDENTITY },
    sourceCatalogSha256: APPROVED_MAIN_CATALOG_SHA256,
    fieldMappingVersion: LIVE_VEGA_FIELD_MAPPING_VERSION,
    sourceFieldMappingApproval: {
      status: 'OWNER_APPROVED_FOR_READ_ONLY_SNAPSHOT_TEST',
      approvalRef: LIVE_VEGA_FIELD_MAPPING_APPROVAL_REF,
    },
    observedAt: observationTime.toISOString(),
    businessDate: dateInTimeZone(observationTime),
    completeness: {
      complete: products.length === EXPECTED_PRODUCT_COUNT,
      requestedProductCount: EXPECTED_PRODUCT_COUNT,
      returnedProductCount: products.length,
    },
    readOnlyEvidence: {
      liveVegaReadPerformed: true,
      databaseReadPerformed: true,
      queryType: 'SELECT_ONLY',
      permissionEvidence: { ...permissionEvidence },
      databaseWritePerformed: false,
      erpOrVegaWritePerformed: false,
      externalHttpRequestPerformed: false,
    },
    products,
  };
  return JSON.stringify(observation);
}

function assertObservationEnvelope(observation, businessDate) {
  assertExpectedUpstreamSourceIdentity(observation?.upstreamOrigin);
  const commonInvalid = (
    observation?.schemaVersion !== 1
    || observation?.captureContractVersion !== DAILY_SNAPSHOT_POLICY_VERSION
    || observation?.sourceCatalogSha256 !== APPROVED_MAIN_CATALOG_SHA256
    || !isIsoDate(observation?.businessDate)
    || observation.businessDate !== dateInTimeZone(observation?.observedAt)
    || observation.businessDate !== businessDate
    || observation?.completeness?.complete !== true
    || observation?.completeness?.requestedProductCount !== EXPECTED_PRODUCT_COUNT
    || observation?.completeness?.returnedProductCount !== EXPECTED_PRODUCT_COUNT
    || observation?.readOnlyEvidence?.databaseWritePerformed !== false
    || observation?.readOnlyEvidence?.erpOrVegaWritePerformed !== false
    || !Array.isArray(observation?.products)
  );
  const migrationValid = observation?.sourceMode === MIGRATION_OBSERVATION_MODE
    && observation?.observationSource === MIGRATION_OBSERVATION_SOURCE
    && observation?.fieldMappingVersion === 'catalog-selection-sale-price-stock-v1-not-live-vega'
    && observation?.readOnlyEvidence?.liveVegaReadPerformed === false
    && observation?.readOnlyEvidence?.sourceRowsFromApprovedCatalog === true
    && observation?.readOnlyEvidence?.networkRequestPerformed === false;
  const liveValid = observation?.sourceMode === LIVE_VEGA_OBSERVATION_MODE
    && observation?.observationSource === LIVE_VEGA_OBSERVATION_SOURCE
    && observation?.fieldMappingVersion === LIVE_VEGA_FIELD_MAPPING_VERSION
    && observation?.sourceFieldMappingApproval?.status === 'OWNER_APPROVED_FOR_READ_ONLY_SNAPSHOT_TEST'
    && observation?.sourceFieldMappingApproval?.approvalRef === LIVE_VEGA_FIELD_MAPPING_APPROVAL_REF
    && observation?.readOnlyEvidence?.liveVegaReadPerformed === true
    && observation?.readOnlyEvidence?.databaseReadPerformed === true
    && observation?.readOnlyEvidence?.queryType === 'SELECT_ONLY'
    && observation?.readOnlyEvidence?.externalHttpRequestPerformed === false
    && observation?.readOnlyEvidence?.permissionEvidence?.checkedTableCount === REQUIRED_LIVE_VEGA_TABLES.length
    && observation?.readOnlyEvidence?.permissionEvidence?.selectPermissionConfirmed === true
    && observation?.readOnlyEvidence?.permissionEvidence?.writePermissionAbsent === true;
  if (commonInvalid || (!migrationValid && !liveValid)) {
    throw snapshotError('DAILY_SNAPSHOT_PROVENANCE_INVALID', 'Observation source, completeness, date, or read-only evidence changed');
  }
}

function assertObservationIdentityCoverage(registry, rows) {
  const seenSourceIds = new Set();
  const seenStockCodes = new Set();
  for (const row of rows) {
    const sourceId = Number(row?.sourceId);
    const stockCode = text(row?.stockCode);
    if (seenSourceIds.has(sourceId)) {
      throw snapshotError('DAILY_SNAPSHOT_PRODUCT_DUPLICATE', `Duplicate observation sourceId: ${sourceId}`);
    }
    if (seenStockCodes.has(stockCode)) {
      throw snapshotError('DAILY_SNAPSHOT_STOCK_CODE_DUPLICATE', `Duplicate observation stockCode: ${stockCode}`);
    }
    seenSourceIds.add(sourceId);
    seenStockCodes.add(stockCode);
  }

  const expectedById = new Map(registry.products.map((product) => [product.sourceId, product]));
  const extras = [...seenSourceIds].filter((sourceId) => !expectedById.has(sourceId));
  if (extras.length) {
    throw snapshotError('DAILY_SNAPSHOT_PRODUCT_EXTRA', `Unexpected products in observation: ${extras.join(', ')}`);
  }
  const missing = registry.products
    .filter((product) => !seenSourceIds.has(product.sourceId))
    .map((product) => product.sourceId);
  if (missing.length) {
    throw snapshotError('DAILY_SNAPSHOT_PRODUCT_MISSING', `Missing products in observation: ${missing.join(', ')}`);
  }
  for (const row of rows) {
    const expected = expectedById.get(Number(row.sourceId));
    if (text(row.stockCode) !== expected.stockCode) {
      throw snapshotError('DAILY_SNAPSHOT_PRODUCT_IDENTITY_MISMATCH', `Stock code mismatch for ${expected.sourceId}`);
    }
  }
}

function normalizeObservationItems(registry, rows, sourceMode) {
  const registryById = new Map(registry.products.map((product) => [product.sourceId, product]));
  return rows
    .map((row) => {
      const identity = registryById.get(Number(row.sourceId));
      const price = nonNegativeDecimal(row.salePrice, 'salePrice');
      const observedStockQuantity = nonNegativeStock(row.stockQuantity, 'stockQuantity');
      const currency = normalizeCurrency(row.currency);
      const blockers = [];
      if (price.scaled === 0n) blockers.push('ZERO_SALE_PRICE');
      if (observedStockQuantity === 0) blockers.push('ZERO_STOCK');
      let observedReservedQuantity = null;
      let observedActivityStatus = 'NOT_CAPTURED';
      let stockSourceBasis = 'APPROVED_CATALOG_RECORDED_STOCK';
      let reservationAdjustmentPolicy = 'UNCONFIGURED_NO_SUBTRACTION_PERFORMED';
      let sourceFieldRefs = {
        price: 'catalog-selection.products[].salePrice',
        currency: 'catalog-selection.products[].currency',
        stock: 'catalog-selection.products[].stockQuantity',
        reservedStock: 'NOT_CAPTURED',
        activityStatus: 'NOT_CAPTURED',
      };

      if (sourceMode === LIVE_VEGA_OBSERVATION_MODE) {
        observedReservedQuantity = nonNegativeStock(row.reservedQuantity, 'reservedQuantity');
        if (row.isPassive !== false) {
          throw snapshotError('DAILY_SNAPSHOT_PRODUCT_PASSIVE', `Approved product ${identity.sourceId} is not active`);
        }
        if (!['PERIOD_MOVEMENT_NET', 'CARD_REMAINING_FALLBACK'].includes(row.stockBasis)) {
          throw snapshotError('DAILY_SNAPSHOT_STOCK_BASIS_INVALID', `Stock basis is invalid for ${identity.sourceId}`);
        }
        observedActivityStatus = 'ACTIVE_FILTER_CONFIRMED';
        stockSourceBasis = row.stockBasis;
        reservationAdjustmentPolicy = 'OBSERVED_SEPARATELY_NOT_SUBTRACTED';
        if (observedReservedQuantity > observedStockQuantity) {
          blockers.push('RESERVED_STOCK_EXCEEDS_OBSERVED_STOCK');
        }
        sourceFieldRefs = {
          price: 'F0102TBLBIRIMLEREX.SATISFIYATI1',
          currency: 'F0102TBLBIRIMLEREX.PB1',
          stock: row.stockBasis === 'PERIOD_MOVEMENT_NET'
            ? 'SUM(F0102D0007TBLSTOKHAREKETLERI.GIREN-CIKAN)'
            : 'F0102TBLSTOKLAR.KALAN',
          reservedStock: 'F0102TBLSTOKLAR.REZERV',
          activityStatus: 'F0102TBLSTOKLAR.STATUS/DELETED/IPTAL',
        };
      } else {
        if (row.reservedQuantity !== null) {
          throw snapshotError(
            'DAILY_SNAPSHOT_RESERVED_STOCK_UNEXPECTED',
            'Migration observation cannot claim a reserved-stock value that was not captured',
          );
        }
        if (row.isPassive !== null) {
          throw snapshotError(
            'DAILY_SNAPSHOT_ACTIVITY_STATUS_UNEXPECTED',
            'Migration observation cannot claim an activity value that was not captured',
          );
        }
        blockers.push('RESERVED_STOCK_NOT_CAPTURED');
        blockers.push('ACTIVITY_STATUS_NOT_CAPTURED');
      }
      return {
        sourceId: identity.sourceId,
        stockCode: identity.stockCode,
        identityMatchStatus: 'MATCHED',
        currency,
        observedSalePrice: price.formatted,
        observedStockQuantity,
        observedReservedQuantity,
        observedActivityStatus,
        stockSourceBasis,
        reservationAdjustmentPolicy,
        itemStatus: blockers.some((blocker) => blocker === 'ZERO_SALE_PRICE' || blocker === 'ZERO_STOCK')
          ? 'NOT_QUOTABLE'
          : 'OBSERVED_NOT_PRICE_APPROVED',
        blockers,
        sourceFieldRefs,
      };
    })
    .sort((left, right) => left.sourceId - right.sourceId || left.stockCode.localeCompare(right.stockCode));
}

export function buildDailyPriceStockSnapshot({
  identityRegistry,
  observationSource,
  now = new Date(),
} = {}) {
  assertIdentityRegistryIntegrity(identityRegistry);
  if (typeof observationSource !== 'string' || !observationSource.trim()) {
    throw snapshotError('DAILY_SNAPSHOT_SOURCE_INVALID', 'Raw observation source is required');
  }
  const rawObservationSha256 = createHash('sha256').update(observationSource).digest('hex');
  const observation = parseRawJson(
    observationSource,
    'DAILY_SNAPSHOT_SOURCE_INVALID',
    'Observation source must be valid JSON',
  );
  const currentTime = new Date(now);
  const observedTime = new Date(observation?.observedAt);
  if (Number.isNaN(currentTime.getTime()) || Number.isNaN(observedTime.getTime())) {
    throw snapshotError('DAILY_SNAPSHOT_TIME_INVALID', 'Current time and observation time must be valid timestamps');
  }
  const businessDate = currentDateInIstanbul(currentTime);
  const observedBusinessDate = dateInTimeZone(observedTime);
  if (observedBusinessDate < businessDate) {
    throw snapshotError('DAILY_SNAPSHOT_STALE', 'Observation belongs to an earlier Istanbul business date');
  }
  if (observedBusinessDate > businessDate) {
    throw snapshotError('DAILY_SNAPSHOT_FUTURE', 'Observation belongs to a future Istanbul business date');
  }
  if (observedTime.getTime() > currentTime.getTime()) {
    throw snapshotError('DAILY_SNAPSHOT_OBSERVED_AT_FUTURE', 'Observation time cannot be later than the current time');
  }
  assertObservationEnvelope(observation, businessDate);
  assertObservationIdentityCoverage(identityRegistry, observation.products);
  const items = normalizeObservationItems(identityRegistry, observation.products, observation.sourceMode);
  if (items.length !== EXPECTED_PRODUCT_COUNT) {
    throw snapshotError('DAILY_SNAPSHOT_COUNT_INVALID', 'Daily snapshot must contain exactly 30 products');
  }
  const isLiveVegaSnapshot = observation.sourceMode === LIVE_VEGA_OBSERVATION_MODE;
  const nonQuotableItemCount = items.filter((item) => item.itemStatus === 'NOT_QUOTABLE').length;

  const core = {
    schemaVersion: 1,
    policyVersion: DAILY_SNAPSHOT_POLICY_VERSION,
    canonicalizationVersion: 'source-id-stock-code-v1',
    kind: 'daily-price-stock-snapshot',
    status: isLiveVegaSnapshot
      ? 'LIVE_READ_ONLY_CAPTURED_NOT_PRICE_APPROVED'
      : 'CAPTURED_NOT_PRICE_APPROVED',
    businessDate,
    timeZone: DAILY_SNAPSHOT_TIME_ZONE,
    observedAt: observation.observedAt,
    identityRegistry: {
      registryId: identityRegistry.registryId,
      identityRegistrySha256: identityRegistry.identityRegistrySha256,
      membershipSha256: identityRegistry.membershipSha256,
      productCount: identityRegistry.productCount,
    },
    source: {
      mode: observation.sourceMode,
      observationSource: observation.observationSource,
      upstreamOrigin: { ...observation.upstreamOrigin },
      fieldMappingVersion: observation.fieldMappingVersion,
      sourceCatalogSha256: observation.sourceCatalogSha256,
      authenticityStatus: isLiveVegaSnapshot
        ? 'PROCESS_BOUND_DIRECT_SELECT_EVIDENCE_NOT_DIGITALLY_SIGNED'
        : 'UNATTESTED_LOCAL_MIGRATION_INPUT',
      liveVegaReadPerformed: isLiveVegaSnapshot,
      databaseReadPerformed: isLiveVegaSnapshot,
      permissionEvidence: isLiveVegaSnapshot
        ? { ...observation.readOnlyEvidence.permissionEvidence }
        : null,
      sourceFieldMappingApproval: isLiveVegaSnapshot
        ? { ...observation.sourceFieldMappingApproval }
        : null,
    },
    completenessStatus: nonQuotableItemCount
      ? 'COMPLETE_WITH_NON_QUOTABLE_ITEMS'
      : 'COMPLETE_30_OF_30',
    productCount: items.length,
    nonQuotableItemCount,
    sourceFactsSha256: sha256Json({
      observationSource: observation.observationSource,
      upstreamOrigin: observation.upstreamOrigin,
      fieldMappingVersion: observation.fieldMappingVersion,
      sourceFieldMappingApproval: observation.sourceFieldMappingApproval || null,
      permissionEvidence: observation.readOnlyEvidence.permissionEvidence || null,
      observedAt: observation.observedAt,
      businessDate,
      items,
    }),
    items,
    policyRefs: {
      marketScope: 'EUROPE_POLICY_SEPARATE_NOT_EVALUATED',
      paymentTerms: 'PREPAID_POLICY_SEPARATE_NOT_EVALUATED',
      returnRemedy: 'RESOLUTION_FIRST_RETURN_LAST_OPTION_POLICY_SEPARATE_NOT_EVALUATED',
    },
    restrictions: {
      dailyPriceApprovalStatus: 'NOT_APPROVED',
      sourceFieldMappingApprovalStatus: isLiveVegaSnapshot
        ? 'OWNER_APPROVED_FOR_READ_ONLY_SNAPSHOT_TEST'
        : 'NOT_APPROVED',
      priceCalculationPolicy: 'SOURCE_SALE_PRICE_IDENTITY_TEST',
      costMarginPolicy: 'UNCONFIGURED',
      roundingPolicy: 'UNCONFIGURED',
      validityPolicy: 'UNCONFIGURED_OWNER_DECISION_REQUIRED',
      freshnessWindowPolicy: 'UNCONFIGURED_OWNER_DECISION_REQUIRED',
      stockIsReservationOrGuarantee: false,
      canCreateCustomerReadyPriceBook: false,
      canSend: false,
      canPersist: false,
      canPublish: false,
      canWriteErpOrVega: false,
    },
    blockers: isLiveVegaSnapshot
      ? [
        'LIVE_VEGA_CAPTURE_IS_READ_ONLY_TEST_NOT_PRICE_APPROVAL',
        'DAILY_PRICE_BOOK_OWNER_APPROVAL_REQUIRED',
        'PRICE_CALCULATION_POLICY_UNCONFIGURED',
        'COST_MARGIN_SOURCE_UNCONFIGURED',
        'ROUNDING_POLICY_UNCONFIGURED',
        'VALIDITY_POLICY_UNCONFIGURED',
        'FRESHNESS_WINDOW_POLICY_UNCONFIGURED',
        'RESERVED_STOCK_POLICY_UNCONFIGURED',
      ]
      : [
        'LIVE_VEGA_CAPTURE_NOT_PERFORMED',
        'SOURCE_FIELD_MAPPING_OWNER_APPROVAL_REQUIRED',
        'SOURCE_AUTHENTICITY_NOT_ATTESTED',
        'DAILY_PRICE_BOOK_OWNER_APPROVAL_REQUIRED',
        'PRICE_CALCULATION_POLICY_UNCONFIGURED',
        'COST_MARGIN_SOURCE_UNCONFIGURED',
        'ROUNDING_POLICY_UNCONFIGURED',
        'VALIDITY_POLICY_UNCONFIGURED',
        'FRESHNESS_WINDOW_POLICY_UNCONFIGURED',
        'RESERVED_STOCK_POLICY_UNCONFIGURED',
        'ACTIVITY_STATUS_NOT_CAPTURED',
      ],
  };
  const dailySnapshotSha256 = sha256Json(core);
  const evidenceEnvelopeSha256 = sha256Json({
    dailySnapshotSha256,
    rawObservationSha256,
    observationSource: observation.observationSource,
    upstreamOrigin: observation.upstreamOrigin,
    observedAt: observation.observedAt,
    businessDate,
  });
  const snapshot = {
    ...core,
    rawObservationSha256,
    evidenceEnvelopeSha256,
    snapshotId: `DAILY-${businessDate.replaceAll('-', '')}-${dailySnapshotSha256.slice(0, 16).toUpperCase()}`,
    dailySnapshotSha256,
    dailyPriceApprovalBinding: {
      status: 'NOT_APPROVED',
      requiredScope: {
        identityRegistrySha256: identityRegistry.identityRegistrySha256,
        dailySnapshotSha256,
        evidenceEnvelopeSha256,
        businessDate,
      },
      approvalId: null,
      approvedAt: null,
    },
  };
  trustedDailySnapshots.add(snapshot);
  return deepFreeze(snapshot);
}

export function assertDailySnapshotIntegrity(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || !trustedDailySnapshots.has(snapshot)) {
    throw snapshotError('DAILY_SNAPSHOT_UNTRUSTED', 'Snapshot was not created from a trusted in-process identity registry and raw observation');
  }
  const {
    rawObservationSha256,
    evidenceEnvelopeSha256,
    snapshotId,
    dailySnapshotSha256,
    dailyPriceApprovalBinding,
    ...core
  } = snapshot;
  const expectedSha256 = sha256Json(core);
  const expectedEvidenceEnvelopeSha256 = sha256Json({
    dailySnapshotSha256,
    rawObservationSha256,
    observationSource: snapshot.source?.observationSource,
    upstreamOrigin: snapshot.source?.upstreamOrigin,
    observedAt: snapshot.observedAt,
    businessDate: snapshot.businessDate,
  });
  const migrationBoundaryValid = snapshot.source?.mode === MIGRATION_OBSERVATION_MODE
    && snapshot.status === 'CAPTURED_NOT_PRICE_APPROVED'
    && snapshot.source?.observationSource === MIGRATION_OBSERVATION_SOURCE
    && snapshot.source?.authenticityStatus === 'UNATTESTED_LOCAL_MIGRATION_INPUT'
    && snapshot.source?.liveVegaReadPerformed === false
    && snapshot.source?.databaseReadPerformed === false
    && snapshot.source?.permissionEvidence === null
    && snapshot.source?.sourceFieldMappingApproval === null
    && snapshot.restrictions?.sourceFieldMappingApprovalStatus === 'NOT_APPROVED';
  const liveBoundaryValid = snapshot.source?.mode === LIVE_VEGA_OBSERVATION_MODE
    && snapshot.status === 'LIVE_READ_ONLY_CAPTURED_NOT_PRICE_APPROVED'
    && snapshot.source?.observationSource === LIVE_VEGA_OBSERVATION_SOURCE
    && snapshot.source?.fieldMappingVersion === LIVE_VEGA_FIELD_MAPPING_VERSION
    && snapshot.source?.authenticityStatus === 'PROCESS_BOUND_DIRECT_SELECT_EVIDENCE_NOT_DIGITALLY_SIGNED'
    && snapshot.source?.liveVegaReadPerformed === true
    && snapshot.source?.databaseReadPerformed === true
    && snapshot.source?.permissionEvidence?.checkedTableCount === REQUIRED_LIVE_VEGA_TABLES.length
    && snapshot.source?.permissionEvidence?.selectPermissionConfirmed === true
    && snapshot.source?.permissionEvidence?.writePermissionAbsent === true
    && snapshot.source?.sourceFieldMappingApproval?.status === 'OWNER_APPROVED_FOR_READ_ONLY_SNAPSHOT_TEST'
    && snapshot.source?.sourceFieldMappingApproval?.approvalRef === LIVE_VEGA_FIELD_MAPPING_APPROVAL_REF
    && snapshot.restrictions?.sourceFieldMappingApprovalStatus === 'OWNER_APPROVED_FOR_READ_ONLY_SNAPSHOT_TEST';
  if (
    !/^[a-f0-9]{64}$/.test(rawObservationSha256)
    || evidenceEnvelopeSha256 !== expectedEvidenceEnvelopeSha256
    || dailySnapshotSha256 !== expectedSha256
    || snapshotId !== `DAILY-${snapshot.businessDate.replaceAll('-', '')}-${expectedSha256.slice(0, 16).toUpperCase()}`
    || snapshot.schemaVersion !== 1
    || snapshot.policyVersion !== DAILY_SNAPSHOT_POLICY_VERSION
    || snapshot.kind !== 'daily-price-stock-snapshot'
    || (!migrationBoundaryValid && !liveBoundaryValid)
    || snapshot.timeZone !== DAILY_SNAPSHOT_TIME_ZONE
    || snapshot.productCount !== EXPECTED_PRODUCT_COUNT
    || !Array.isArray(snapshot.items)
    || snapshot.items.length !== EXPECTED_PRODUCT_COUNT
    || snapshot.identityRegistry?.productCount !== EXPECTED_PRODUCT_COUNT
    || snapshot.restrictions?.dailyPriceApprovalStatus !== 'NOT_APPROVED'
    || snapshot.restrictions?.canCreateCustomerReadyPriceBook !== false
    || snapshot.restrictions?.canSend !== false
    || snapshot.restrictions?.canPersist !== false
    || snapshot.restrictions?.canPublish !== false
    || snapshot.restrictions?.canWriteErpOrVega !== false
    || dailyPriceApprovalBinding?.status !== 'NOT_APPROVED'
    || dailyPriceApprovalBinding?.requiredScope?.identityRegistrySha256 !== snapshot.identityRegistry.identityRegistrySha256
    || dailyPriceApprovalBinding?.requiredScope?.dailySnapshotSha256 !== dailySnapshotSha256
    || dailyPriceApprovalBinding?.requiredScope?.evidenceEnvelopeSha256 !== evidenceEnvelopeSha256
    || dailyPriceApprovalBinding?.requiredScope?.businessDate !== snapshot.businessDate
    || dailyPriceApprovalBinding?.approvalId !== null
    || dailyPriceApprovalBinding?.approvedAt !== null
  ) {
    throw snapshotError('DAILY_SNAPSHOT_TAMPERED', 'Daily snapshot integrity, provenance, or approval boundary changed');
  }
  return snapshot;
}

export function buildIdentitySnapshotEvidenceSummary({ identityRegistry, dailySnapshot } = {}) {
  assertIdentityRegistryIntegrity(identityRegistry);
  assertDailySnapshotIntegrity(dailySnapshot);
  if (dailySnapshot.identityRegistry.identityRegistrySha256 !== identityRegistry.identityRegistrySha256) {
    throw snapshotError('DAILY_SNAPSHOT_REGISTRY_MISMATCH', 'Snapshot belongs to another identity registry');
  }
  const currencyProductCounts = Object.fromEntries(
    [...new Set(dailySnapshot.items.map((item) => item.currency))]
      .sort()
      .map((currency) => [
        currency,
        dailySnapshot.items.filter((item) => item.currency === currency).length,
      ]),
  );
  const stockSourceBasisCounts = Object.fromEntries(
    [...new Set(dailySnapshot.items.map((item) => item.stockSourceBasis))]
      .sort()
      .map((stockSourceBasis) => [
        stockSourceBasis,
        dailySnapshot.items.filter((item) => item.stockSourceBasis === stockSourceBasis).length,
      ]),
  );
  const productsWithPositiveReservedStockCount = dailySnapshot.items
    .filter((item) => Number(item.observedReservedQuantity) > 0).length;
  const productsWithReservedExceedingStockCount = dailySnapshot.items
    .filter((item) => Number(item.observedReservedQuantity) > Number(item.observedStockQuantity)).length;
  const summary = {
    schemaVersion: 1,
    mode: dailySnapshot.source.liveVegaReadPerformed
      ? 'LIVE_VEGA_READ_ONLY_SNAPSHOT_TEST'
      : 'LOCAL_SYNTHETIC_READ_ONLY_CONTRACT_PREVIEW',
    identityRegistry: {
      registryId: identityRegistry.registryId,
      identityRegistrySha256: identityRegistry.identityRegistrySha256,
      membershipSha256: identityRegistry.membershipSha256,
      productCount: identityRegistry.productCount,
      approvalStatus: identityRegistry.status,
      priceIncluded: false,
      stockIncluded: false,
      currencyIncluded: false,
    },
    dailySnapshot: {
      snapshotId: dailySnapshot.snapshotId,
      dailySnapshotSha256: dailySnapshot.dailySnapshotSha256,
      rawObservationSha256: dailySnapshot.rawObservationSha256,
      evidenceEnvelopeSha256: dailySnapshot.evidenceEnvelopeSha256,
      businessDate: dailySnapshot.businessDate,
      observedAt: dailySnapshot.observedAt,
      productCount: dailySnapshot.productCount,
      nonQuotableItemCount: dailySnapshot.nonQuotableItemCount,
      currencyProductCounts,
      stockSourceBasisCounts,
      productsWithPositiveReservedStockCount,
      productsWithReservedExceedingStockCount,
      completenessStatus: dailySnapshot.completenessStatus,
      sourceMode: dailySnapshot.source.mode,
      sourceAuthenticityStatus: dailySnapshot.source.authenticityStatus,
      liveVegaReadPerformed: dailySnapshot.source.liveVegaReadPerformed,
      databaseReadPerformed: dailySnapshot.source.databaseReadPerformed,
      selectPermissionConfirmed: dailySnapshot.source.permissionEvidence?.selectPermissionConfirmed || false,
      writePermissionAbsent: dailySnapshot.source.permissionEvidence?.writePermissionAbsent || false,
      sourceFieldMappingApprovalStatus: dailySnapshot.restrictions.sourceFieldMappingApprovalStatus,
      dailyPriceApprovalStatus: dailySnapshot.restrictions.dailyPriceApprovalStatus,
      blockers: dailySnapshot.blockers,
    },
    commercialValuesRedacted: true,
    databaseReadPerformed: dailySnapshot.source.databaseReadPerformed,
    databaseWritePerformed: false,
    erpOrVegaWritePerformed: false,
    externalMessageSent: false,
    orderCreated: false,
    paymentCollected: false,
    stockReserved: false,
    pdfOrSitePublished: false,
    localModelUsed: false,
  };
  const forbiddenPath = findForbiddenField(summary, FORBIDDEN_EVIDENCE_FIELDS, 'summary');
  if (forbiddenPath) {
    throw snapshotError('DAILY_SNAPSHOT_EVIDENCE_FIELD_FORBIDDEN', `Commercial field leaked into evidence: ${forbiddenPath}`);
  }
  return summary;
}
