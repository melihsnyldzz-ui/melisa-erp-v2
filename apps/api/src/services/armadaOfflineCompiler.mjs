import { ARMADA_HEADER_FIELDS, ARMADA_LINE_FIELDS } from './armadaDocumentCodec.mjs';
import { ARMADA_SALE_ENDPOINT } from './armadaSaleSubmission.mjs';
import { amount, amountText, currencyCode, dailyDocumentNumber } from './armadaDailyCompiler.mjs';
import { verifyTerminalRateSnapshot } from './terminalRateSnapshot.mjs';
import { verifyOfflineCatalogSnapshot } from './terminalOfflineCatalogSnapshot.mjs';
import { pilotError } from './armadaPilotCompiler.mjs';

const S = 100000000n, PERCENT = 100n * S;
const blank = (fields) => Object.fromEntries(fields.map((key) => [key, '']));
const reject = (code, message) => { throw pilotError(code, message); };
const off = (value) => value === false || value === 0;
const positiveId = (value) => Number.isSafeInteger(value) && value > 0;
const symbol = (value) => ({ USD: '$', TRY: 'TL', EUR: '€' })[value];
const multiply = (a, b) => (a * b + S / 2n) / S;
const divide = (a, b) => (a * S + b / 2n) / b;
const label = (value) => typeof value === 'string'
  ? value.replace(/[|\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, 160).trim() : '';
const optionalLabel = (key, value) => { const text = label(value); return text ? { [key]: text } : {}; };
function discountLimit(value) {
  const result = amount(value);
  if (result < 0n || result > PERCENT) reject('ARMADA_OFFLINE_AUTHORITY_INVALID', 'Kayıtlı fiyat yetkisi geçerli değil.');
  return result;
}

// Compile only authenticated cache proofs. No fabricated live stock, reservations,
// SQL resultsets, current Armada counter or send-time source reads enter this path.
export function compileOfflineSale(intent, payload, profile, operator, { uid, date, localDateTime }) {
  const context = verifyOfflineCatalogSnapshot(payload.offlineContext, 'context', profile);
  const customer = verifyOfflineCatalogSnapshot(payload.customerOfflineCard, 'customer', profile);
  const rates = verifyTerminalRateSnapshot({ snapshot: payload.rateSnapshot, profile, currency: intent.currency,
    exchangeRate: intent.exchangeRate, company: intent.company, period: intent.period });
  const terminal = context.terminal;
  if (context.terminalCode !== intent.terminalCode || context.username !== profile.username
    || context.actorUserId !== intent.actorUserId || !terminal || !context.operator
    || !positiveId(terminal.terminalId) || !positiveId(terminal.personnelId)
    || terminal.terminalId !== profile.terminalId || terminal.personnelId !== profile.personnelId
    || terminal.personnelCode !== profile.personnelCode || terminal.depotId !== 1 || profile.depotId !== 1
    || terminal.depotCode !== profile.depotCode || terminal.priceType !== 'FIYAT' || Number(terminal.priceNumber) !== 1
    || typeof context.operator.canChangeSalePrice !== 'boolean' || typeof operator?.canChangeSalePrice !== 'boolean') {
    reject('ARMADA_OFFLINE_CONTEXT_MISMATCH', 'İndirilmiş personel veya terminal bilgisi bu oturumla eşleşmiyor.');
  }
  if (customer.id !== intent.customerId || customer.status !== 1 || !off(customer.deleted) || !off(customer.saleProhibited)
    || currencyCode(customer.currency) !== intent.currency || typeof customer.code !== 'string' || !customer.code.trim()) {
    reject('ARMADA_CUSTOMER_RESTRICTED', 'İndirilmiş cari bilgisi fişle eşleşmiyor veya satışa kapalı.');
  }
  const canChangePrice = context.operator.canChangeSalePrice && operator.canChangeSalePrice;
  const discount = [3n * S, discountLimit(context.operator.maxSaleDiscountPercent),
    discountLimit(operator.maxSaleDiscountPercent), discountLimit(terminal.discountLimit)].reduce((a, b) => a < b ? a : b);
  const rate = amount(intent.exchangeRate), expectedLines = [], labels = [];
  let total = 0n, baseTotal = 0n;
  const lines = intent.items.map((item, index) => {
    const card = verifyOfflineCatalogSnapshot(payload.items[index].offlineCard, 'product', profile);
    if (card.stockId !== item.stockId || card.unitStockId !== item.stockId || card.unitId !== item.unitId
      || card.barcode !== item.barcode || card.unit !== 'ADET' || amount(card.factor) !== S || card.status !== 1
      || !off(card.cancelled) || (card.deleted !== null && !off(card.deleted)) || !off(card.saleProhibited)) {
      reject('ARMADA_PRODUCT_RESTRICTED', 'İndirilmiş ürün, birim veya barkod bilgisi fişle eşleşmiyor.');
    }
    if (amount(card.taxRate) !== 0n) reject('ARMADA_TAX_UNSUPPORTED', 'Bu ürünün KDV’li aktarımı henüz doğrulanmadı.');
    const sourceCurrency = currencyCode(card.currency);
    if (!sourceCurrency) reject('ARMADA_PRICE_CURRENCY_UNKNOWN', 'İndirilmiş ürün fiyatının para birimi bilinmiyor.');
    let reference = amount(card.price);
    if (reference < 0n) reject('ARMADA_PRICE_INVALID', 'İndirilmiş liste fiyatı geçerli değil.');
    if (sourceCurrency !== intent.currency) {
      const sourceRate = sourceCurrency === 'TRY' ? S : amount(rates.rates[sourceCurrency]);
      if (sourceRate <= 0n) reject('ARMADA_SOURCE_RATE_REQUIRED', 'Ürün para biriminin kayıtlı kuru gerekli.');
      reference = divide(multiply(reference, sourceRate), rate);
    }
    const roundedReference = ((reference + 500000n) / 1000000n) * 1000000n;
    const minimum = canChangePrice ? (roundedReference * (PERCENT - discount) + PERCENT / 2n) / PERCENT : roundedReference;
    const quantity = amount(item.quantity), price = amount(item.unitPrice);
    if (quantity <= 0n || quantity % S !== 0n || price < 0n) reject('ARMADA_LINE_AMOUNT_INVALID', 'Miktar veya fiyat geçerli değil.');
    if (price < minimum || (!canChangePrice && price !== roundedReference && price !== reference)) {
      reject('ARMADA_PRICE_AUTHORITY', 'Satır fiyatı indirilmiş liste/kur ve personel fiyat yetkisiyle uyuşmuyor.');
    }
    const lineTotal = multiply(quantity, price), basePrice = multiply(price, rate), baseLine = multiply(quantity, basePrice);
    total += lineTotal; baseTotal += baseLine;
    expectedLines.push({ stockId: item.stockId, unitId: item.unitId, unit: 'ADET', barcode: item.barcode,
      quantity: item.quantity, unitPrice: amountText(basePrice), total: amountText(baseLine), taxAmount: '0' });
    labels.push({ stockId: item.stockId, unitId: item.unitId, barcode: item.barcode,
      ...optionalLabel('stockCode', card.stockCode), ...optionalLabel('productName', card.productName) });
    return Object.assign(blank(ARMADA_LINE_FIELDS), { Id: String(index + 1), Stok: item.barcode, Barcode: item.barcode,
      Miktar: item.quantity, Fiyat: item.unitPrice, Tutar: amountText(lineTotal), Isk1: '0', Isk2: '0', Isk3: '0', Isk4: '0', AltIskonto: '0',
      IskToplam: '0', SatirToplam: amountText(lineTotal), KDV: '0', KDVTutar: '0', StokExtId: String(item.unitId), SatirSayisi: String(index + 1),
      Parabirimi: symbol(intent.currency), Kur: intent.exchangeRate, RBMiktar: '0', MiktarBos: '0', Kampanya: '0', Otv: '0', OtvTutar: '0' });
  });
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(uid || '') || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')
    || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) reject('ARMADA_ID_INVALID', 'Belge kimliği veya tarihi geçerli değil.');
  const number = dailyDocumentNumber(intent), [year, month, day] = date.split('-');
  const header = Object.assign(blank(ARMADA_HEADER_FIELDS), { Id: '1', Cari: customer.code, CariExtId: String(intent.customerId),
    BelgeNo: number, BelgeKod: uid.replaceAll('-', ''), Tarih: `${day}.${month}.${year}`, BelgeTutar: amountText(total), AraToplam: amountText(total),
    BelgeKDV: '0', NetToplam: amountText(total), BelgeTip: '33', IskontoTop: '0', AIsk1: '0', AIsk2: '0', AIsk3: '0', AIsk4: '0', Vade: date,
    Parabirimi: symbol(intent.currency), Kur: intent.exchangeRate, VgFatInd: '0', Terminal: String(terminal.terminalId), Kapali: '0', BelgeNot: intent.note,
    Depo: terminal.depotCode, KayitTarihi: localDateTime, CikanDepo: terminal.depotCode, UID: uid, Personel: terminal.personnelCode,
    OtvToplam: '0', OdemeTutar: '0', SonBakiye: '0' });
  return { sendMode: 'offline', endpoint: ARMADA_SALE_ENDPOINT, armadaUserId: String(terminal.terminalId), document: { header, lines },
    provenance: { source: 'signed-offline-catalog', contextIssuedAt: payload.offlineContext.issuedAt,
      customerIssuedAt: payload.customerOfflineCard.issuedAt, productIssuedAt: payload.items.map((item) => item.offlineCard.issuedAt),
      liveStockChecked: false, liveReservationsChecked: false, decision: 'owner-offline-send-2026-09-12' },
    rateSnapshot: rates.snapshot, receiptLabels: { customerId: customer.id, ...optionalLabel('customerName', customer.customerName), lines: labels },
    expected: { company: intent.company, period: intent.period, uid, armadaTerminalId: terminal.terminalId, customerId: intent.customerId,
      personnelId: terminal.personnelId, depotId: terminal.depotId, documentNumber: number, date, currency: symbol(intent.currency),
      exchangeRate: intent.exchangeRate, exchangeRateSource: 'signed-offline-catalog', total: amountText(baseTotal), lines: expectedLines } };
}
