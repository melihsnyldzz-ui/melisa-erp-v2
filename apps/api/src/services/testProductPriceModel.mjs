export const TEST_PRICE_PRODUCT_ID = '301986';
export const productPriceError = (code, message, statusCode = 400) => Object.assign(new Error(message), {code, statusCode});
const invalid = () => productPriceError('TEST_PRODUCT_PRICE_INVALID', 'Fiyat, birim, döviz ve değişiklik gerekçesini kontrol edin.');
const unavailable = () => productPriceError('TEST_PRODUCT_PRICE_UNAVAILABLE', 'Kayıtlı TEST fiyatları doğrulanamadı.', 503);
const ID = /^[1-9]\d*$/;
const REVISION = /^[A-F0-9]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURRENCIES = ['TRY', 'USD', 'EUR'];
const isId = value => typeof value === 'string' && ID.test(value) && BigInt(value) <= 9223372036854775807n;
const isExact = value => value === null || (typeof value === 'string' && /^(0|[1-9]\d{0,19})\.\d{8}$/.test(value));
const objectWith = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const isText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);

export function assertProductPriceActor(actor, write = false) {
  if (!isId(String(actor?.id)) || (write && String(actor.id) !== '16') || !Array.isArray(actor.permissions)
      || !['product.view', 'purchase.view', ...(write ? ['product.price.edit'] : [])].every(key => actor.permissions.includes(key))) {
    throw productPriceError('TEST_PRODUCT_PRICE_FORBIDDEN', 'Bu TEST fiyat işlemi için yetkiniz yok.', 403);
  }
}
export function assertProductPriceId(value) {
  if (String(value) !== TEST_PRICE_PRODUCT_ID) throw productPriceError('TEST_PRODUCT_PRICE_SCOPE', 'Yalnız ayrılmış TEST ürününün fiyatları düzenlenebilir.', 403);
  return TEST_PRICE_PRODUCT_ID;
}
export function parseProductPrice(body) {
  if (!objectWith(body, ['requestId', 'expectedRevision', 'priceId', 'tuple', 'priceExact', 'reason'])
      || typeof body.requestId !== 'string' || !UUID.test(body.requestId)
      || typeof body.expectedRevision !== 'string' || !/^[a-f0-9]{64}$/i.test(body.expectedRevision)
      || (body.priceId !== null && !isId(body.priceId)) || !isExact(body.priceExact)
      || !objectWith(body.tuple, ['type', 'unitId', 'tier', 'currency'])
      || !CURRENCIES.includes(body.tuple.currency)
      || !isText(body.reason, 500) || body.reason.trim().length < 3) throw invalid();
  const tuple = body.tuple;
  if ((tuple.type === 'purchase' && (tuple.unitId !== null || tuple.tier !== 0))
      || (tuple.type === 'sale' && (!isId(tuple.unitId) || !Number.isInteger(tuple.tier) || tuple.tier < 1 || tuple.tier > 6))
      || !['sale', 'purchase'].includes(tuple.type)) throw invalid();
  const input = {requestId: body.requestId.toLowerCase(), expectedRevision: body.expectedRevision.toUpperCase(), priceId: body.priceId,
    tuple: {type: tuple.type, unitId: tuple.unitId, tier: tuple.tier, currency: tuple.currency}, priceExact: body.priceExact, reason: body.reason.trim()};
  return {...input, payloadJson: JSON.stringify({productId: TEST_PRICE_PRODUCT_ID, ...input})};
}
function priceRow(raw, capabilities) {
  if (!raw || !isId(raw.id) || !isId(raw.versionId) || typeof raw.revision !== 'string' || !REVISION.test(raw.revision) || !isExact(raw.priceExact)
      || !capabilities.currencies.includes(raw.currency) || !raw.provenance
      || !isText(raw.provenance.source, 80) || raw.provenance.actorId !== '16'
      || !isText(raw.provenance.reason, 500) || raw.provenance.reason.trim().length < 3
      || typeof raw.provenance.changedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(raw.provenance.changedAt) || !Number.isFinite(Date.parse(raw.provenance.changedAt))) throw unavailable();
  if ((raw.type === 'purchase' && (raw.unitId !== null || raw.tier !== capabilities.purchaseTier))
      || (raw.type === 'sale' && (!capabilities.units.some(unit => unit.id === raw.unitId) || !capabilities.saleTiers.includes(raw.tier)))
      || !['sale', 'purchase'].includes(raw.type)) throw unavailable();
  return {id: raw.id, versionId: raw.versionId, type: raw.type, unitId: raw.unitId, tier: raw.tier, currency: raw.currency,
    priceExact: raw.priceExact, revision: raw.revision,
    provenance: {source: raw.provenance.source, actorId: raw.provenance.actorId, changedAt: raw.provenance.changedAt, reason: raw.provenance.reason}};
}
export function productPriceContext(raw, canEdit = raw?.capabilities?.canEdit === true) {
  const product = raw?.product, c = raw?.capabilities;
  if (!product || product.id !== TEST_PRICE_PRODUCT_ID || product.stockCode !== 'TEST-DAILY-PURCHASE' || !isText(product.name, 250)
      || product.unit !== 'ADET' || product.synthetic !== true || typeof raw.revision !== 'string' || !REVISION.test(raw.revision)
      || !c || !Array.isArray(c.currencies) || c.currencies.length < 1 || c.currencies.length > 3
      || c.currencies.some(currency => !CURRENCIES.includes(currency)) || new Set(c.currencies).size !== c.currencies.length
      || c.purchaseTier !== 0 || !Array.isArray(c.saleTiers) || c.saleTiers.length < 1 || c.saleTiers.length > 6
      || c.saleTiers.some(tier => !Number.isInteger(tier) || tier < 1 || tier > 6) || new Set(c.saleTiers).size !== c.saleTiers.length
      || !Array.isArray(c.units) || c.units.length < 1 || c.units.length > 100
      || c.units.some(unit => !unit || !isId(unit.id) || !isText(unit.label, 40) || !isExact(unit.factorExact8) || unit.factorExact8 === null
        || BigInt(unit.factorExact8.replace('.', '')) <= 0n || typeof unit.isMainUnit !== 'boolean')
      || new Set(c.units.map(unit => unit.id)).size !== c.units.length || c.units.filter(unit => unit.isMainUnit).length < 1
      || !Array.isArray(c.supportedTuples) || c.supportedTuples.length < 1 || c.supportedTuples.length > 1000
      || c.supportedTuples.some(tuple => !objectWith(tuple, ['type','unitId','tier','currency']) || !c.currencies.includes(tuple.currency)
        || (tuple.type === 'purchase' && (tuple.unitId !== null || tuple.tier !== 0))
        || (tuple.type === 'sale' && (!c.units.some(unit => unit.id === tuple.unitId) || !c.saleTiers.includes(tuple.tier))) || !['sale','purchase'].includes(tuple.type))
      || typeof c.canEdit !== 'boolean' || !Array.isArray(raw.prices) || raw.prices.length > 1000 || !Array.isArray(raw.recentChanges) || raw.recentChanges.length > 100) throw unavailable();
  const capabilities = {currencies: [...c.currencies], units: c.units.map(unit => ({id: unit.id, label: unit.label, factorExact8: unit.factorExact8, isMainUnit: unit.isMainUnit})),
    purchaseTier: c.purchaseTier, saleTiers: [...c.saleTiers], supportedTuples: c.supportedTuples.map(tuple => ({...tuple})), canEdit: canEdit && c.canEdit};
  const prices = raw.prices.map(row => priceRow(row, capabilities));
  const tuples = prices.map(row => JSON.stringify([row.type, row.unitId, row.tier, row.currency]));
  if (new Set(prices.map(row => row.id)).size !== prices.length || new Set(tuples).size !== prices.length
      || prices.some(row => row.revision !== raw.revision || !capabilities.supportedTuples.some(tuple => ['type','unitId','tier','currency'].every(key => tuple[key] === row[key])))) throw unavailable();
  return {product: {id: product.id, stockCode: product.stockCode, name: product.name, unit: product.unit, synthetic: true}, capabilities,
    revision: raw.revision, prices, recentChanges: raw.recentChanges.map(row => priceRow(row, capabilities))};
}
export function assertSupportedProductPrice(input, context) {
  const {tuple} = input, c = context.capabilities;
  if (!c.supportedTuples.some(row => ['type','unitId','tier','currency'].every(key => row[key] === tuple[key]))) {
    throw productPriceError('TEST_PRODUCT_PRICE_UNSUPPORTED', 'Bu ürün için seçilen fiyat türü, birim, kademe veya döviz desteklenmiyor.', 409);
  }
  // Price identity, full-payload replay and CAS belong to the owner writer.
  // Checking current priceId/revision here would reject historical replays.
}
