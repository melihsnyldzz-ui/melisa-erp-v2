export const PROFORMA_DRAFT_SCHEMA_VERSION = 1;

const ALLOWED_CURRENCIES = new Set(['USD', 'EUR', 'TRY']);

/** @type {Array<keyof import('./proformaTypes').Header>} */
const HEADER_FIELDS = [
  'proformaNo',
  'sourceDocumentNo',
  'issueDate',
  'validUntil',
  'currency',
];

/** @type {Array<keyof import('./proformaTypes').Buyer>} */
const BUYER_FIELDS = [
  'name',
  'customerCode',
  'address',
  'cityCountry',
  'contactName',
  'phone',
  'email',
  'taxNumber',
];

/** @type {Array<keyof import('./proformaTypes').ShipmentText>} */
const SHIPMENT_TEXT_FIELDS = [
  'incoterm',
  'paymentTerms',
  'transportMode',
  'deliveryPlace',
  'packageCount',
  'netWeight',
  'grossWeight',
  'originCountry',
  'notes',
];

/** @type {Array<keyof import('./proformaTypes').LineText>} */
const LINE_TEXT_FIELDS = [
  'id',
  'stockCode',
  'description',
  'barcode',
  'gtipCode',
  'gtipStatus',
  'gtipConfidence',
  'gtipMaterialBasis',
  'gtipNote',
  'gtipSource',
  'gtipRuleId',
  'unitName',
];

const ERROR_MESSAGES = {
  SOURCE_CURRENCY_REQUIRED: 'Kaynak fiş para birimi bulunamadı.',
  CURRENCY_MISMATCH: 'Proforma para birimi kaynak fiş para birimiyle aynı olmalıdır.',
  PROFORMA_NO_REQUIRED: 'Proforma numarası zorunludur.',
  BUYER_REQUIRED: 'Alıcı unvanı zorunludur.',
  ISSUE_DATE_INVALID: 'Düzenleme tarihi geçerli olmalıdır.',
  VALID_UNTIL_INVALID: 'Geçerlilik tarihi geçerli olmalıdır.',
  VALID_UNTIL_BEFORE_ISSUE: 'Geçerlilik tarihi düzenleme tarihinden önce olamaz.',
  FREIGHT_INVALID: 'Nakliye bedeli sıfır veya pozitif, sonlu bir sayı olmalıdır.',
  INCLUDED_LINE_REQUIRED: 'PDF için en az bir ürün satırı dahil edilmelidir.',
  QUANTITY_INVALID: 'Dahil edilen ürünlerin miktarı sıfırdan büyük, sonlu bir sayı olmalıdır.',
  PRICE_INVALID: 'Dahil edilen ürünlerin birim fiyatı sıfır veya pozitif, sonlu bir sayı olmalıdır.',
};

const WARNING_MESSAGES = {
  INCOTERM_MISSING: 'Teslim şekli seçilmedi; çıktıda teyit uyarısı gösterilmelidir.',
  PAYMENT_TERMS_MISSING: 'Ödeme şekli girilmedi; çıktıda teyit uyarısı gösterilmelidir.',
  GTIP_MISSING: 'Dahil edilen ürünlerde eksik GTİP kodu var; sevk öncesinde insan teyidi gerekir.',
};

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function trimmedText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function safeText(value, fallback = '', maxLength = 5000) {
  const nextValue = typeof value === 'string' ? value : fallback;
  return String(nextValue ?? '').slice(0, maxLength);
}

function strictNumber(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeCurrency(value) {
  const currency = trimmedText(value).toUpperCase();
  return ALLOWED_CURRENCIES.has(currency) ? currency : '';
}

/**
 * @template {string} K
 * @param {unknown} value
 * @param {K[]} fields
 * @param {unknown} defaults
 * @returns {Record<K, string>}
 */
function copyTextFields(value, fields, defaults = {}) {
  const source = isRecord(value) ? value : {};
  const fallback = isRecord(defaults) ? defaults : {};
  return /** @type {Record<K, string>} */ (Object.fromEntries(fields.map((field) => [
    field,
    safeText(source[field], safeText(fallback[field])),
  ])));
}

function lineKey(line, index) {
  const id = safeText(line?.id, '', 200).trim();
  return id || `index:${index}`;
}

function normalizeDraftLine(line, defaults = {}, index = 0) {
  const source = isRecord(line) ? line : {};
  const fallback = isRecord(defaults) ? defaults : {};
  const normalized = {
    ...copyTextFields(source, LINE_TEXT_FIELDS, fallback),
    included: true,
    gtipRequiresReview: true,
    quantity: 0,
    unitPrice: 0,
  };
  const quantity = strictNumber(source.quantity);
  const fallbackQuantity = strictNumber(fallback.quantity);
  const unitPrice = strictNumber(source.unitPrice);
  const fallbackUnitPrice = strictNumber(fallback.unitPrice);

  normalized.id = safeText(fallback.id, normalized.id || `line-${index}`, 200);
  normalized.stockCode = safeText(fallback.stockCode, normalized.stockCode, 200);
  normalized.barcode = safeText(fallback.barcode, normalized.barcode, 200);
  normalized.unitName = safeText(fallback.unitName, normalized.unitName || 'ADET', 100);
  normalized.included = typeof source.included === 'boolean'
    ? source.included
    : fallback.included !== false;
  normalized.gtipRequiresReview = typeof source.gtipRequiresReview === 'boolean'
    ? source.gtipRequiresReview
    : fallback.gtipRequiresReview !== false;
  normalized.quantity = quantity !== null && quantity >= 0
    ? quantity
    : Math.max(0, fallbackQuantity ?? 0);
  normalized.unitPrice = unitPrice !== null && unitPrice >= 0
    ? unitPrice
    : Math.max(0, fallbackUnitPrice ?? 0);

  return normalized;
}

/** @param {unknown} lines @param {unknown} defaults */
function normalizeDraftLines(lines, defaults = []) {
  const sourceLines = Array.isArray(lines) ? lines : [];
  const fallbackLines = Array.isArray(defaults) ? defaults : [];

  if (!fallbackLines.length) {
    return sourceLines
      .filter(isRecord)
      .slice(0, 1000)
      .map((line, index) => normalizeDraftLine(line, {}, index));
  }

  const sourceByKey = new Map(
    sourceLines
      .filter(isRecord)
      .map((line, index) => [lineKey(line, index), line]),
  );

  return fallbackLines.map((fallbackLine, index) => (
    normalizeDraftLine(sourceByKey.get(lineKey(fallbackLine, index)), fallbackLine, index)
  ));
}

/** @param {import('./proformaTypes').DraftInput} input @param {import('./proformaTypes').DraftInput} defaults */
function normalizeDraftSections({ header, buyer, shipment, lines }, defaults = {}) {
  const defaultHeader = isRecord(defaults.header) ? defaults.header : {};
  const normalizedHeader = copyTextFields(header, HEADER_FIELDS, defaultHeader);
  const sourceCurrency = normalizeCurrency(defaultHeader.currency || normalizedHeader.currency);
  const draftCurrency = normalizeCurrency(normalizedHeader.currency);
  normalizedHeader.currency = sourceCurrency || draftCurrency;

  const normalizedShipment = { ...copyTextFields(
    shipment,
    SHIPMENT_TEXT_FIELDS,
    isRecord(defaults.shipment) ? defaults.shipment : {},
  ), freightAmount: 0 };
  const freightAmount = strictNumber(shipment?.freightAmount);
  const fallbackFreight = strictNumber(defaults.shipment?.freightAmount);
  normalizedShipment.freightAmount = freightAmount !== null && freightAmount >= 0
    ? freightAmount
    : Math.max(0, fallbackFreight ?? 0);

  return {
    header: normalizedHeader,
    buyer: copyTextFields(buyer, BUYER_FIELDS, isRecord(defaults.buyer) ? defaults.buyer : {}),
    shipment: normalizedShipment,
    lines: normalizeDraftLines(lines, defaults.lines),
  };
}

/** @param {string} code @param {string} message @param {Partial<import('./proformaTypes').ValidationIssue>} extra @returns {import('./proformaTypes').ValidationIssue} */
function issue(code, message, extra = {}) {
  return { code, message, ...extra };
}

export function isSourceLockedCurrency(value, sourceCurrency) {
  const normalizedSource = normalizeCurrency(sourceCurrency);
  return Boolean(normalizedSource) && normalizeCurrency(value) === normalizedSource;
}

export function isFiniteNonNegativeAmount(value) {
  const number = strictNumber(value);
  return number !== null && number >= 0;
}

export function isPositiveFiniteQuantity(value) {
  const number = strictNumber(value);
  return number !== null && number > 0;
}

export function isValidIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function isValidProformaDateRange(issueDate, validUntil) {
  return isValidIsoDate(issueDate)
    && isValidIsoDate(validUntil)
    && validUntil >= issueDate;
}

/** @param {import('./proformaTypes').DraftIdentityInput} input */
export function buildVersionedProformaDraft({
  sourceFingerprint,
  draftOwnerId,
  header,
  buyer,
  shipment,
  lines,
} = {}) {
  const normalizedFingerprint = trimmedText(sourceFingerprint);
  const normalizedOwnerId = trimmedText(draftOwnerId);
  if (!normalizedFingerprint || !normalizedOwnerId) return null;

  return {
    schemaVersion: PROFORMA_DRAFT_SCHEMA_VERSION,
    sourceFingerprint: normalizedFingerprint,
    draftOwnerId: normalizedOwnerId,
    ...normalizeDraftSections({ header, buyer, shipment, lines }),
  };
}

/** @param {unknown} value @param {{sourceFingerprint?: unknown, draftOwnerId?: unknown, defaults?: import('./proformaTypes').DraftInput}} options */
export function restoreVersionedProformaDraft(value, {
  sourceFingerprint,
  draftOwnerId,
  defaults = {},
} = {}) {
  if (!isRecord(value) || value.schemaVersion !== PROFORMA_DRAFT_SCHEMA_VERSION) return null;

  const normalizedFingerprint = trimmedText(sourceFingerprint);
  const normalizedOwnerId = trimmedText(draftOwnerId);
  if (!normalizedFingerprint || !normalizedOwnerId) return null;
  if (trimmedText(value.sourceFingerprint) !== normalizedFingerprint) return null;
  if (trimmedText(value.draftOwnerId) !== normalizedOwnerId) return null;
  if (!isRecord(value.header) || !isRecord(value.buyer) || !isRecord(value.shipment) || !Array.isArray(value.lines)) return null;

  const defaultCurrency = normalizeCurrency(defaults.header?.currency);
  const storedCurrency = normalizeCurrency(value.header.currency);
  if (!defaultCurrency || storedCurrency !== defaultCurrency) return null;

  return normalizeDraftSections({ header: value.header, buyer: value.buyer, shipment: value.shipment, lines: value.lines }, defaults);
}

/** @param {import('./proformaTypes').DraftInput & {sourceCurrency?: string}} input */
export function validateProformaForPdf({
  header = {},
  buyer = {},
  shipment = {},
  lines = [],
  sourceCurrency = '',
} = {}) {
  const errors = [];
  const warnings = [];
  const normalizedSourceCurrency = normalizeCurrency(sourceCurrency);
  const includedLines = Array.isArray(lines)
    ? lines.filter((line) => isRecord(line) && line.included !== false)
    : [];

  if (!normalizedSourceCurrency) {
    errors.push(issue('SOURCE_CURRENCY_REQUIRED', ERROR_MESSAGES.SOURCE_CURRENCY_REQUIRED, { field: 'header.currency' }));
  } else if (!isSourceLockedCurrency(header.currency, normalizedSourceCurrency)) {
    errors.push(issue('CURRENCY_MISMATCH', ERROR_MESSAGES.CURRENCY_MISMATCH, { field: 'header.currency' }));
  }
  if (!trimmedText(header.proformaNo)) {
    errors.push(issue('PROFORMA_NO_REQUIRED', ERROR_MESSAGES.PROFORMA_NO_REQUIRED, { field: 'header.proformaNo' }));
  }
  if (!trimmedText(buyer.name)) {
    errors.push(issue('BUYER_REQUIRED', ERROR_MESSAGES.BUYER_REQUIRED, { field: 'buyer.name' }));
  }

  const issueDateValid = isValidIsoDate(header.issueDate);
  const validUntilValid = isValidIsoDate(header.validUntil);
  if (!issueDateValid) {
    errors.push(issue('ISSUE_DATE_INVALID', ERROR_MESSAGES.ISSUE_DATE_INVALID, { field: 'header.issueDate' }));
  }
  if (!validUntilValid) {
    errors.push(issue('VALID_UNTIL_INVALID', ERROR_MESSAGES.VALID_UNTIL_INVALID, { field: 'header.validUntil' }));
  }
  if (issueDateValid && validUntilValid && header.validUntil < header.issueDate) {
    errors.push(issue('VALID_UNTIL_BEFORE_ISSUE', ERROR_MESSAGES.VALID_UNTIL_BEFORE_ISSUE, { field: 'header.validUntil' }));
  }

  if (!isFiniteNonNegativeAmount(shipment.freightAmount)) {
    errors.push(issue('FREIGHT_INVALID', ERROR_MESSAGES.FREIGHT_INVALID, { field: 'shipment.freightAmount' }));
  }
  if (!includedLines.length) {
    errors.push(issue('INCLUDED_LINE_REQUIRED', ERROR_MESSAGES.INCLUDED_LINE_REQUIRED, { field: 'lines' }));
  }

  includedLines.forEach((line, index) => {
    if (!isPositiveFiniteQuantity(line.quantity)) {
      errors.push(issue('QUANTITY_INVALID', ERROR_MESSAGES.QUANTITY_INVALID, {
        field: `lines.${index}.quantity`,
        lineId: line.id ?? null,
      }));
    }
    if (!isFiniteNonNegativeAmount(line.unitPrice)) {
      errors.push(issue('PRICE_INVALID', ERROR_MESSAGES.PRICE_INVALID, {
        field: `lines.${index}.unitPrice`,
        lineId: line.id ?? null,
      }));
    }
  });

  if (!trimmedText(shipment.incoterm)) {
    warnings.push(issue('INCOTERM_MISSING', WARNING_MESSAGES.INCOTERM_MISSING, { field: 'shipment.incoterm' }));
  }
  if (!trimmedText(shipment.paymentTerms)) {
    warnings.push(issue('PAYMENT_TERMS_MISSING', WARNING_MESSAGES.PAYMENT_TERMS_MISSING, { field: 'shipment.paymentTerms' }));
  }

  const missingGtipCount = includedLines.filter((line) => !trimmedText(line.gtipCode)).length;
  if (missingGtipCount) {
    warnings.push(issue('GTIP_MISSING', WARNING_MESSAGES.GTIP_MISSING, {
      field: 'lines',
      count: missingGtipCount,
    }));
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/** @param {{validation?: {isValid: boolean}, isConfirmed?: boolean, hasDetail?: boolean}} input */
export function canGenerateProformaPdf({ validation, isConfirmed, hasDetail } = {}) {
  return Boolean(hasDetail && isConfirmed && validation?.isValid);
}
