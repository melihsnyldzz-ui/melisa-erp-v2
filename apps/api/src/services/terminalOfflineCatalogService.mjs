import { readArmadaProfile, queryArmadaBridge } from './armadaReadBridgeClient.mjs';
import { queryArmadaVega } from './armadaVegaClientService.mjs';
import { issueOfflineCatalogSnapshot } from './terminalOfflineCatalogSnapshot.mjs';
import { issueTerminalRateSnapshot } from './terminalRateSnapshot.mjs';
import { explicitSaleCurrency } from './explicitSaleCurrency.mjs';

const fail = (code, message, statusCode = 503) => { throw Object.assign(new Error(message), { code, statusCode }); };
const id = (value) => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;

export function createOfflineCatalogEnricher({ loadProfile = readArmadaProfile, readCards = (kind, ids) =>
  queryArmadaVega({ operation: 'offline-catalog', kind, ids }), issue = issueOfflineCatalogSnapshot } = {}) {
  return async function enrich(kind, rows) {
    if (!['product', 'customer'].includes(kind) || !Array.isArray(rows) || rows.length > 500) {
      fail('TERMINAL_OFFLINE_CATALOG_INVALID', 'İndirilen kart listesi doğrulanamadı.');
    }
    const profile = await loadProfile();
    const wanted = rows.map((row) => kind === 'product' ? row.unitId : row.sourceId);
    // Cards without an authoritative unit remain readable; never invent a unit.
    const usableIds = [...new Set(wanted.filter(id))];
    const cards = usableIds.length ? await readCards(kind, usableIds) : [];
    if (!Array.isArray(cards) || cards.length !== usableIds.length) {
      fail('TERMINAL_OFFLINE_CATALOG_CHANGED', 'İndirme sırasında bazı kartlar değişti. Verileri yeniden güncelleyin.');
    }
    const byId = new Map();
    for (const card of cards) {
      const key = kind === 'product' ? card.unitId : card.id;
      if (!usableIds.includes(key) || byId.has(key)) fail('TERMINAL_OFFLINE_CATALOG_AMBIGUOUS', 'Kart eşleştirmesi belirsiz.');
      byId.set(key, card);
    }
    return rows.map((row, index) => {
      if (row.source !== 'vega' || !id(row.sourceId) || row.id !== `vega-${row.sourceId}`
        || (kind === 'product' && (row.sourceContext?.company !== 'F0102' || row.sourceContext?.period !== 'D0007'))
        || (kind === 'customer' && (row.company !== 'F0102' || row.period !== 'D0007'))) {
        fail('TERMINAL_OFFLINE_CATALOG_SOURCE_MISMATCH', 'İndirilen kartın firma veya dönem bilgisi eşleşmiyor.');
      }
      const card = byId.get(wanted[index]);
      if (!card) return { ...row, offlineCard: null };
      if (kind === 'product') {
        if (card.stockId !== row.sourceId || card.unitStockId !== row.sourceId) {
          fail('TERMINAL_OFFLINE_PRODUCT_CHANGED', 'İndirme sırasında ürün veya barkod değişti. Verileri yeniden güncelleyin.');
        }
        const barcode = row.matchedBarcode || row.barcode || row.barcodeMasked;
        const missingBarcode = (value) => value == null || (typeof value === 'string' && !value.trim());
        // The list DTO represents an empty SQL barcode as null. Keep these
        // cards readable without inventing a barcode or granting sale proof.
        if (missingBarcode(barcode) && missingBarcode(card.barcode)) return { ...row, offlineCard: null };
        if (card.barcode !== barcode) {
          fail('TERMINAL_OFFLINE_PRODUCT_CHANGED', 'İndirme sırasında ürün veya barkod değişti. Verileri yeniden güncelleyin.');
        }
      }
      // The displayed and signed currencies must share the same supported
      // canonical value. Unknown source currencies remain null in both.
      const saleCurrency = explicitSaleCurrency(card.currency);
      const offlineCard = issue(kind, { ...card, currency: saleCurrency.currency }, profile);
      if (kind === 'customer') return { ...row, customerCode: card.code, customerName: card.customerName,
        currency: saleCurrency.currency, offlineCard };
      return { ...row, salePrice: card.price === null ? null : Number(card.price),
        ...saleCurrency, unitName: card.unit, offlineCard };
    });
  };
}

async function defaultAuthorize(terminalCode, userId) {
  return (await import('./terminalService.js')).getTerminalOperatorContext(terminalCode, userId);
}
async function defaultRates() { return (await import('./currencyRateService.js')).getCurrencyRates({}); }

export function createOfflineContextLoader({ loadProfile = readArmadaProfile, readBridge = queryArmadaBridge,
  authorize = defaultAuthorize, readRates = defaultRates, issue = issueOfflineCatalogSnapshot } = {}) {
  return async function loadContext({ terminalCode, actor }) {
    if (!id(Number(actor?.id)) || typeof actor?.username !== 'string' || !actor.username.trim()
      || typeof terminalCode !== 'string' || !/^[A-Za-z0-9._:-]{1,80}$/.test(terminalCode)) {
      fail('TERMINAL_OFFLINE_ACTOR_REQUIRED', 'Personel veya terminal bilgisi geçerli değil.', 400);
    }
    const profile = await loadProfile();
    const rateData = await readRates();
    const rateSet = { ...rateData, rateSnapshot: issueTerminalRateSnapshot({ rateSet: rateData, profile }) };
    const denied = (code, message) => ({ offlineContext: null, rateSet, capability: { enabled: false, code, message, temporary: false } });
    const permissions = Array.isArray(actor.permissions) ? actor.permissions : [];
    if (!permissions.includes('terminal.sales.create') && !(permissions.includes('sales.create') && permissions.includes('sales.finalize'))) {
      return denied('TERMINAL_SALE_PERMISSION_REQUIRED', 'Bu personelin fiş gönderme yetkisi yok.');
    }
    if (profile.dailyEnabled !== true || profile.username !== actor.username.toLowerCase() || profile.terminalCode !== terminalCode) {
      return denied('ARMADA_OPERATOR_MISMATCH', 'Bu personelin gönderim eşleştirmesi tanımlı değil.');
    }
    let operator;
    try { operator = await authorize(terminalCode, Number(actor.id)); }
    catch (error) {
      if (['TERMINAL_EMPLOYEE_SALE_RESTRICTED', 'TERMINAL_EMPLOYEE_NOT_ASSIGNED', 'TERMINAL_DEVICE_NOT_ACTIVE'].includes(error.code)) {
        return denied(error.code, 'Bu personelin terminalden satış yetkisi açık değil.');
      }
      throw error;
    }
    const bridge = await readBridge(profile, 'snapshot');
    const terminals = bridge?.recordsets?.[0], row = terminals?.[0];
    if (bridge?.ok !== true || terminals?.length !== 1 || row.terminalId !== profile.terminalId
      || row.personnelId !== profile.personnelId || row.personnelCode !== profile.personnelCode
      || row.depotId !== 1 || profile.depotId !== 1 || row.depotCode !== profile.depotCode
      || row.priceType !== 'FIYAT' || Number(row.priceNumber) !== 1
      || row.discountLimit === null || !Number.isFinite(Number(row.discountLimit)) || Number(row.discountLimit) < 0
      || Number(row.discountLimit) > 100 || typeof operator?.canChangeSalePrice !== 'boolean'
      || !Number.isFinite(operator.maxSaleDiscountPercent) || operator.maxSaleDiscountPercent < 0 || operator.maxSaleDiscountPercent > 100) {
      fail('TERMINAL_OFFLINE_MAPPING_CHANGED', 'Terminalin personel, depo veya fiyat ayarı doğrulanamadı.');
    }
    // Explicit allowlist: no profile secret or authentication credential is ever
    // placed in a client snapshot; the wire counter is irrelevant to MELISA IDs.
    const terminal = Object.fromEntries(['terminalId', 'personnelId', 'personnelCode', 'depotId', 'depotCode', 'priceType', 'priceNumber', 'discountLimit']
      .map((name) => [name, row[name]]));
    const data = { terminalCode, username: profile.username, actorUserId: Number(actor.id), terminal,
      operator: { canChangeSalePrice: operator.canChangeSalePrice, maxSaleDiscountPercent: operator.maxSaleDiscountPercent } };
    return { offlineContext: issue('context', data, profile), rateSet,
      capability: { enabled: true, code: 'TERMINAL_OFFLINE_READY', message: 'Cihaz satışa hazır.', temporary: false } };
  };
}

export const enrichOfflineCatalog = createOfflineCatalogEnricher();
export const loadTerminalOfflineContext = createOfflineContextLoader();
