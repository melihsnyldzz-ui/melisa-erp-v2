import { createHash } from 'node:crypto';
import { ARMADA_HEADER_FIELDS, ARMADA_LINE_FIELDS } from './armadaDocumentCodec.mjs';
import { ARMADA_SALE_ENDPOINT } from './armadaSaleSubmission.mjs';
import { pilotError } from './armadaPilotCompiler.mjs';

const S = 100000000n;
const PERCENT_SCALE = 100n * S;
const reject = (code, message) => { throw pilotError(code, message); };
const blank = (fields) => Object.fromEntries(fields.map((key) => [key, '']));
const receiptLabel = (value) => typeof value === 'string'
  ? value.replace(/[|\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, 160).trim() : '';
const optionalLabel = (key, value) => { const label = receiptLabel(value); return label ? { [key]: label } : {}; };
export const currencyCode = (value) => ({ '$': 'USD', USD: 'USD', TL: 'TRY', TRY: 'TRY', '€': 'EUR', EUR: 'EUR' })[String(value).trim()];
const symbol = (value) => ({ USD: '$', TRY: 'TL', EUR: '€' })[value];
export function amount(value) {
  const raw = String(value ?? '');
  if (!/^-?\d{1,12}(?:\.\d{1,8})?$/.test(raw)) reject('ARMADA_NUMBER_INVALID', 'Miktar, fiyat veya kur geçerli değil.');
  const negative = raw.startsWith('-');
  const [a, b = ''] = (negative ? raw.slice(1) : raw).split('.');
  return (BigInt(a) * S + BigInt(b.padEnd(8, '0'))) * (negative ? -1n : 1n);
}
export function amountText(value) {
  const sign = value < 0n ? '-' : ''; const n = value < 0n ? -value : value;
  const fraction = String(n % S).padStart(8, '0').replace(/0+$/, '');
  return `${sign}${n / S}${fraction ? '.' + fraction : ''}`;
}
const multiply = (a, b) => (a * b + S / 2n) / S;
const divide = (a, b) => (a * S + b / 2n) / b;
const positiveId = (value) => Number.isSafeInteger(value) && value > 0;
const off = (value) => value === false || value === 0;
function assertDailyDepot(depotId) {
  // Daily preflight reads stock and reservations only from the verified depot 1.
  if (depotId !== 1) reject('ARMADA_DEPOT_SCOPE_INVALID', 'Bu terminal sürümü yalnızca doğrulanmış merkez depoda kullanılabilir.');
}
function vegaId(value) {
  if (!/^vega-[1-9]\d{0,9}$/.test(value || '')) reject('ARMADA_SOURCE_ID_INVALID', 'Vega kart kimliği gerekli.');
  const id = Number(value.slice(5));
  if (id > 2147483647) reject('ARMADA_SOURCE_ID_INVALID', 'Vega kart kimliği geçerli değil.');
  return id;
}

export function normalizeDailySale(payload, actor, profile) {
  assertDailyDepot(profile.depotId);
  if (!positiveId(Number(actor?.id)) || String(actor?.username || '').toLowerCase() !== profile.username
    || payload.terminalCode !== profile.terminalCode) reject('ARMADA_OPERATOR_MISMATCH', 'Bu personel için Armada terminal eşleştirmesi tanımlı değil.');
  if (payload.company !== 'F0102' || payload.period !== 'D0007' || payload.customerSource !== 'vega'
    || payload.testMode === true) reject('ARMADA_SOURCE_MISMATCH', 'Vega firma/dönem veya fiş türü uygun değil.');
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(payload.clientEventId || '')) reject('ARMADA_EVENT_REQUIRED', 'Kalıcı işlem kimliği gerekli.');
  const currency = currencyCode(payload.documentCurrency);
  if (!currency) reject('ARMADA_CURRENCY_REQUIRED', 'Fiş para birimi tanımlı değil.');
  const rate = amount(payload.exchangeRate);
  if (rate <= 0n || (currency === 'TRY' && rate !== S)) reject('ARMADA_RATE_INVALID', 'Fiş kuru geçerli değil.');
  if (!Array.isArray(payload.items) || !payload.items.length || payload.items.length > 100) reject('ARMADA_LINES_INVALID', 'Fişte 1–100 satır olmalı.');
  const items = payload.items.map((item) => {
    if (item.productSource !== 'vega' || !positiveId(Number(item.unitId)) || Number(item.unitId) > 2147483647
      || currencyCode(item.currency) !== currency || typeof item.barcode !== 'string' || !item.barcode.trim()
      || item.barcode.length > 100 || /[|\r\n\x00-\x1f]/.test(item.barcode)) reject('ARMADA_LINE_SOURCE_INVALID', 'Satırın Vega birim, barkod veya para birimi bilgisi eksik.');
    const quantity = amount(item.quantity), price = amount(item.unitPrice);
    if (quantity <= 0n || quantity % S !== 0n || price < 0n) reject('ARMADA_LINE_AMOUNT_INVALID', 'Adet pozitif tam sayı, fiyat sıfır veya pozitif olmalı.');
    return { stockId: vegaId(item.productId), unitId: Number(item.unitId), barcode: item.barcode,
      quantity: amountText(quantity), unitPrice: amountText(price) };
  });
  const note = String(payload.note || '').trim();
  if (note.length > 500 || /[|\r\n\x00-\x1f]/.test(note)) reject('ARMADA_NOTE_INVALID', 'Fiş notu tek satır ve en fazla 500 karakter olmalı.');
  return { company: 'F0102', period: 'D0007', terminalCode: payload.terminalCode,
    clientEventId: payload.clientEventId, actorUserId: Number(actor.id), customerId: vegaId(payload.customerId),
    currency, exchangeRate: amountText(rate), note, items };
}

export function dailyDocumentNumber(intent) {
  // Stable 80-bit identity with the verified 30-character MELISA/0001 format.
  const hash = createHash('sha256').update(JSON.stringify([intent.company, intent.period, intent.terminalCode, intent.clientEventId])).digest();
  let n = BigInt('0x' + hash.subarray(0, 10).toString('hex')), letters = '';
  for (let i = 0; i < 18; i++) { letters = String.fromCharCode(65 + Number(n % 26n)) + letters; n /= 26n; }
  return 'MELISA-' + letters + '-0001';
}

export function compileDailySale(intent, profile, bridge, vega, operator, { uid, date, localDateTime }) {
  assertDailyDepot(profile.depotId);
  if (bridge?.ok !== true || bridge.recordsets?.[0]?.length !== 1) reject('ARMADA_TERMINAL_READ_INVALID', 'Armada terminal ayarları okunamadı.');
  const t = bridge.recordsets[0][0];
  assertDailyDepot(t.depotId);
  if (!/^[A-Z]{2,8}\d{1,12}$/.test(t.nextNumber || '') || Number(t.nextNumber.match(/\d+$/)[0].slice(-7)) <= 1) reject('ARMADA_COUNTER_UNCONFIRMED', 'Armada sayacının korunacağı doğrulanamadı.');
  if (t.terminalId !== profile.terminalId || t.personnelId !== profile.personnelId || t.personnelCode !== profile.personnelCode
    || t.depotId !== profile.depotId || t.depotCode !== profile.depotCode || t.priceType !== 'FIYAT' || Number(t.priceNumber) !== 1
    || !Number.isFinite(Number(t.discountLimit))) reject('ARMADA_TERMINAL_CHANGED', 'Armada personel, depo veya fiyat ayarı değişti.');
  if (vega?.database !== 'VEGA2026' || vega.company !== intent.company || vega.period !== intent.period) reject('ARMADA_SOURCE_MISMATCH', 'Vega kapsamı doğrulanamadı.');
  const [customers, units, stocks, reservations, collisions] = vega.recordsets || [];
  if (customers?.length !== 1 || !Array.isArray(units) || !Array.isArray(stocks) || !Array.isArray(reservations) || !Array.isArray(collisions)) reject('ARMADA_PREFLIGHT_INCOMPLETE', 'Vega ön kontrolü tamamlanamadı.');
  if (collisions.length) reject('ARMADA_DOCUMENT_NUMBER_USED', 'Fiş numarası Vega’da mevcut; tekrar gönderilmedi.');
  const customer = customers[0];
  if (customer.id !== intent.customerId || customer.status !== 1 || !off(customer.deleted) || !off(customer.saleProhibited)
    || currencyCode(customer.currency) !== intent.currency || !customer.code) reject('ARMADA_CUSTOMER_RESTRICTED', 'Cari pasif, satışa kapalı veya para birimi değişmiş.');
  const wantedUnits = new Set(intent.items.map((i) => i.unitId));
  if (units.length !== wantedUnits.size || new Set(units.map((u) => u.unitId)).size !== units.length) reject('ARMADA_PRODUCT_INCOMPLETE', 'Bazı birim kartları bulunamadı veya belirsiz.');
  const rate = amount(intent.exchangeRate), warnings = [], totals = new Map();
  const discount = amount(Math.max(0, Math.min(3, Number(operator?.maxSaleDiscountPercent || 0), Number(t.discountLimit))));
  let total = 0n, baseTotal = 0n;
  const expectedLines = [];
  const lines = intent.items.map((item, index) => {
    const u = units.find((row) => row.unitId === item.unitId);
    if (!u || u.stockId !== item.stockId || u.unitStockId !== item.stockId || u.barcode !== item.barcode
      || u.unit !== 'ADET' || amount(u.factor) !== S || u.status !== 1 || !off(u.cancelled)
      || (u.deleted !== null && !off(u.deleted)) || !off(u.saleProhibited)) reject('ARMADA_PRODUCT_RESTRICTED', 'Ürün pasif, satışa kapalı veya ADET/barkod eşleşmesi uygun değil.');
    // Only the verified zero-tax contract is enabled. Never invent a tax treatment.
    if (amount(u.taxRate) !== 0n) reject('ARMADA_TAX_UNSUPPORTED', 'Bu ürünün KDV’li aktarımı henüz doğrulanmadı; fiş gönderilmedi.');
    const sourceCurrency = currencyCode(u.currency);
    if (!sourceCurrency) reject('ARMADA_PRICE_CURRENCY_UNKNOWN', 'Ürün liste fiyatının para birimi tanımlı değil.');
    let reference = amount(u.price);
    if (reference < 0n) reject('ARMADA_PRICE_INVALID', 'Ürün liste fiyatı geçerli değil.');
    if (sourceCurrency !== intent.currency) {
      const sourceRate = sourceCurrency === 'TRY' ? S : amount(vega.rates?.[sourceCurrency]);
      if (sourceRate <= 0n) reject('ARMADA_SOURCE_RATE_REQUIRED', 'Ürün para birimi için doğrulanmış kur gerekli.');
      reference = divide(multiply(reference, sourceRate), rate);
    }
    const quantity = amount(item.quantity), price = amount(item.unitPrice);
    // Currency conversion may round to cents. No blanket epsilon may grant a discount.
    const roundedReference = ((reference + 500000n) / 1000000n) * 1000000n;
    // Keep the percentage division in integer arithmetic (e.g. 1.36% is exact).
    const minimum = operator?.canChangeSalePrice
      ? (roundedReference * (PERCENT_SCALE - discount) + PERCENT_SCALE / 2n) / PERCENT_SCALE
      : roundedReference;
    if (price < minimum || (!operator?.canChangeSalePrice && price !== roundedReference && price !== reference)) reject('ARMADA_PRICE_AUTHORITY', 'Satır fiyatı güncel liste/kur veya personel fiyat yetkisiyle uyuşmuyor.');
    const lineTotal = multiply(quantity, price), basePrice = multiply(price, rate), baseLine = multiply(quantity, basePrice);
    total += lineTotal; baseTotal += baseLine;
    totals.set(item.stockId, (totals.get(item.stockId) || 0n) + quantity);
    expectedLines.push({ stockId: item.stockId, unitId: item.unitId, unit: 'ADET', barcode: item.barcode,
      quantity: item.quantity, unitPrice: amountText(basePrice), total: amountText(baseLine), taxAmount: '0' });
    return Object.assign(blank(ARMADA_LINE_FIELDS), { Id: String(index + 1), Stok: item.barcode, Barcode: item.barcode,
      Miktar: item.quantity, Fiyat: item.unitPrice, Tutar: amountText(lineTotal), Isk1: '0', Isk2: '0', Isk3: '0', Isk4: '0', AltIskonto: '0',
      IskToplam: '0', SatirToplam: amountText(lineTotal), KDV: '0', KDVTutar: '0', StokExtId: String(item.unitId), SatirSayisi: String(index + 1),
      Parabirimi: symbol(intent.currency), Kur: intent.exchangeRate, RBMiktar: '0', MiktarBos: '0', Kampanya: '0', Otv: '0', OtvTutar: '0' });
  });
  for (const [stockId, requested] of totals) {
    const matching = stocks.filter((r) => r.stockId === stockId), reserved = reservations.filter((r) => r.stockId === stockId);
    if (matching.length !== 1 || reserved.length !== 1) reject('ARMADA_STOCK_UNKNOWN', 'Stok/rezerv bilgisi okunamadı.');
    const physical = amount(matching[0].quantity), reservation = amount(reserved[0].quantity);
    const cardReserved = amount(units.find((u) => u.stockId === stockId).cardReserved);
    const effectiveReserved = reservation > cardReserved ? reservation : cardReserved;
    if (effectiveReserved > 0n && requested > physical - effectiveReserved) reject('ARMADA_RESERVED_STOCK', 'Fiş ayrılmış/rezerve stoğa giriyor; rezerv yetkili kişi tarafından incelenmeli.');
    if (requested > physical) {
      if (profile.allowInsufficientStock !== true) reject('ARMADA_STOCK_INSUFFICIENT', 'Stok yetersiz.');
      warnings.push({ code: 'INSUFFICIENT_STOCK_ALLOWED', stockId, onHand: amountText(physical), quantity: amountText(requested), approval: 'owner-2026-09-12' });
    }
  }
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(uid || '') || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) reject('ARMADA_ID_INVALID', 'Belge kimliği/tarihi geçerli değil.');
  const number = dailyDocumentNumber(intent), [year, month, day] = date.split('-');
  const header = Object.assign(blank(ARMADA_HEADER_FIELDS), { Id: '1', Cari: customer.code, CariExtId: String(intent.customerId),
    BelgeNo: number, BelgeKod: uid.replaceAll('-', ''), Tarih: `${day}.${month}.${year}`, BelgeTutar: amountText(total), AraToplam: amountText(total),
    BelgeKDV: '0', NetToplam: amountText(total), BelgeTip: '33', IskontoTop: '0', AIsk1: '0', AIsk2: '0', AIsk3: '0', AIsk4: '0', Vade: date,
    Parabirimi: symbol(intent.currency), Kur: intent.exchangeRate, VgFatInd: '0', Terminal: String(t.terminalId), Kapali: '0', BelgeNot: intent.note,
    Depo: t.depotCode, KayitTarihi: localDateTime, CikanDepo: t.depotCode, UID: uid, Personel: t.personnelCode, OtvToplam: '0', OdemeTutar: '0', SonBakiye: '0' });
  // Display labels are selected from Vega and travel in the same protected
  // snapshot as the sale; request-provided names never become receipt labels.
  const receiptLabels = { customerId: customer.id, ...optionalLabel('customerName', customer.customerName),
    lines: intent.items.map((item) => {
      const unit = units.find((row) => row.unitId === item.unitId);
      return { stockId: item.stockId, unitId: item.unitId, barcode: item.barcode,
        ...optionalLabel('stockCode', unit.stockCode), ...optionalLabel('productName', unit.productName) };
    }) };
  return { endpoint: ARMADA_SALE_ENDPOINT, armadaUserId: String(t.terminalId), document: { header, lines }, warnings, receiptLabels,
    expected: { company: intent.company, period: intent.period, uid, armadaTerminalId: t.terminalId, customerId: intent.customerId,
      personnelId: t.personnelId, depotId: t.depotId, documentNumber: number, date, currency: symbol(intent.currency),
      exchangeRate: intent.exchangeRate, exchangeRateSource: 'terminal', total: amountText(baseTotal), lines: expectedLines } };
}
