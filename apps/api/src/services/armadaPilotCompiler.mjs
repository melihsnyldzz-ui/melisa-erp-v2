import { ARMADA_HEADER_FIELDS, ARMADA_LINE_FIELDS } from './armadaDocumentCodec.mjs';
import { ARMADA_SALE_ENDPOINT } from './armadaSaleSubmission.mjs';

export function pilotError(code, message) { return Object.assign(new Error(message), { code, statusCode: 409 }); }
const reject = (code, message) => { throw pilotError(code, message); };
const blank = (fields) => Object.fromEntries(fields.map((field) => [field, '']));
const decimal = (value) => {
  const raw = String(value ?? '');
  if (!/^\d{1,12}(?:\.\d{1,8})?$/.test(raw)) reject('ARMADA_NUMBER_UNKNOWN', 'Sayısal kaynak değeri doğrulanamadı.');
  const [a, b = ''] = raw.split('.'); return BigInt(a) * 100000000n + BigInt(b.padEnd(8, '0'));
};
const decimalString = (value) => `${value / 100000000n}.${String(value % 100000000n).padStart(8, '0')}`.replace(/\.?0+$/, '');
const falseFlag = (value) => value === false || value === 0;

export function getPilotDocumentNumber(profile, bridge) {
  const custom = profile.pilotDocumentNumber;
  if (custom !== undefined) {
    // Armada and Vega both store at most 30 characters. Numara.numVal reads
    // the final digit run (last seven digits); 0001 stays below AHM's counter.
    if (!/^MELISA-[A-Z]{18}-0001$/.test(custom)) reject('ARMADA_NUMBER_INVALID', 'Ayrı Melisa fiş numarası doğrulanamadı.');
    return custom;
  }
  return bridge?.recordsets?.[0]?.[0]?.nextNumber;
}

export function getTerminalPilotRate(intent) {
  const value = intent?.displayExchangeRate;
  const raw = typeof value === 'number' || typeof value === 'string' ? String(value).trim() : '';
  if (!/^\d{1,12}(?:\.\d{1,8})?$/.test(raw) || decimal(raw) <= 0n) {
    reject('ARMADA_TERMINAL_RATE_REQUIRED', 'Terminal fişinde geçerli bir döviz kuru gerekli. Kur otomatik olarak 1 kabul edilmez.');
  }
  return decimalString(decimal(raw));
}

export function normalizeArmadaPilot(payload, actor, profile) {
  if (!/^[a-z0-9-]{8,80}$/.test(profile.pilotId || '')) reject('ARMADA_PILOT_DISABLED', 'Armada pilot kimliği yapılandırılmadı.');
  if (profile.username !== 'ahmet' || String(actor?.username || '').toLowerCase() !== profile.username
    || !Number.isSafeInteger(Number(actor?.id)) || Number(actor.id) < 1
    || payload.terminalCode !== profile.terminalCode || profile.terminalCode !== 'TERM-V2-001') reject('ARMADA_OPERATOR_MISMATCH', 'Armada personel veya terminal eşleştirmesi uygun değil.');
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(payload.clientEventId || '')) reject('ARMADA_EVENT_REQUIRED', 'Kalıcı işlem kimliği gerekli.');
  const item = payload.items?.[0];
  if (payload.customerId !== 'vega-102' || payload.customerSource !== 'vega'
    || payload.company !== 'F0102' || payload.period !== 'D0007' || payload.documentCurrency !== 'USD'
    || payload.items?.length !== 1 || item?.productId !== 'vega-161383' || item.productSource !== 'vega'
    || Number(item.unitId) !== 160452 || item.barcode !== '8690000006489'
    || decimal(item.quantity) !== 100000000n || decimal(item.unitPrice) !== 847000000n
    || item.currency !== 'USD') reject('ARMADA_PILOT_SCOPE_MISMATCH', 'İlk pilot yalnız belirlenen cari ve üründen 1 ADET / 8,47 USD içindir.');
  return { company: 'F0102', period: 'D0007', terminalCode: profile.terminalCode,
    clientEventId: profile.pilotId, requestClientEventId: payload.clientEventId,
    actorUserId: Number(actor.id), customerId: 102, stockId: 161383, unitId: 160452,
    quantity: '1', unitPrice: '8.47', currency: '$',
    displayExchangeRate: getTerminalPilotRate({ displayExchangeRate: payload.exchangeRate }),
    ...(profile.pilotDocumentNumber !== undefined ? { documentNumber: getPilotDocumentNumber(profile) } : {}) };
}

export function validatePilotReadings(profile, bridge, vega, number) {
  const [terminals, collisions] = bridge?.recordsets || [];
  if (bridge?.ok !== true || terminals?.length !== 1 || !Array.isArray(collisions)) reject('ARMADA_TERMINAL_READ_INVALID', 'Armada terminal ayarları doğrulanamadı.');
  const t = terminals[0];
  if (t.terminalId !== profile.terminalId || t.personnelCode !== '103 (102)' || t.personnelId !== 102
    || t.depotCode !== 'MERKEZ' || t.depotId !== 1 || t.priceType !== 'FIYAT' || Number(t.priceNumber) !== 1
    || decimal(t.discountLimit) !== 0n) reject('ARMADA_TERMINAL_OR_NUMBER_CHANGED', 'Terminal ayarları değişti; gönderim yapılmadı.');
  if (profile.pilotDocumentNumber !== undefined) {
    if (number !== getPilotDocumentNumber(profile, bridge)
      || !/^AHM\d{1,12}$/.test(t.nextNumber || '')
      || Number(t.nextNumber.match(/\d+$/)[0].slice(-7)) <= 1) {
      reject('ARMADA_COUNTER_PRESERVATION_UNCONFIRMED', 'Ayrı Melisa numarasının AHMET sayacını koruyacağı doğrulanamadı.');
    }
    // Bridge collisions describe the existing AHM counter, not this custom
    // number. The exact custom number is checked in Vega below.
  } else {
    if (t.nextNumber !== number || collisions.length) reject('ARMADA_TERMINAL_OR_NUMBER_CHANGED', 'Terminal ayarları veya belge numarası değişti; gönderim yapılmadı.');
    if (!/^[A-Z]{2,8}\d{1,12}$/.test(number || '') || !number.startsWith(profile.documentPrefix)) reject('ARMADA_NUMBER_INVALID', 'Belge serisi doğrulanamadı.');
  }
  if (vega?.database !== 'VEGA2026' || vega.company !== 'F0102' || vega.period !== 'D0007') reject('ARMADA_SOURCE_MISMATCH', 'Vega firma/dönem kapsamı değişti.');
  const [customers, units, inventory, reservations, numbers] = vega.recordsets || [];
  if (customers?.length !== 1 || units?.length !== 1 || inventory?.length !== 1 || reservations?.length !== 1 || !Array.isArray(numbers)) reject('ARMADA_PREFLIGHT_INCOMPLETE', 'Vega ön kontrolleri tamamlanamadı.');
  if (numbers.length) reject('ARMADA_DOCUMENT_NUMBER_USED', 'Gönderilecek fiş numarası Vega’da zaten kullanılmış; gönderim yapılmadı.');
  const c = customers[0], u = units[0], stock = inventory[0], reserved = reservations[0];
  if (c.id !== 102 || c.code !== '1-PEŞİN $' || c.currency !== '$' || c.status !== 1
    || !falseFlag(c.deleted) || !falseFlag(c.saleProhibited)) reject('ARMADA_CUSTOMER_RESTRICTED', 'Vega cari durumu satışa uygun değil.');
  if (u.stockId !== 161383 || u.unitId !== 160452 || u.unitStockId !== 161383 || u.barcode !== '8690000006489'
    || u.unit !== 'ADET' || u.status !== 1 || !falseFlag(u.cancelled) || (u.deleted !== null && !falseFlag(u.deleted))
    || !falseFlag(u.saleProhibited) || decimal(u.factor) !== 100000000n || decimal(u.price) !== 847000000n
    || u.currency !== '$' || decimal(u.taxRate) !== 0n) reject('ARMADA_PRODUCT_OR_PRICE_CHANGED', 'Ürün, birim, fiyat veya vergi bilgisi değişti.');
  // This is a current physical-stock preflight, not an atomic lock on Vega.
  // The controlled pilot requires an explicit operational pause of other writers.
  if (profile.controlledPilotWindow !== true) reject('ARMADA_PILOT_WINDOW_REQUIRED', 'İlk satış için eşzamanlı diğer stok çıkışları durdurulmuş olmalı.');
  if (Number(stock.recordCount) < 1 || decimal(stock.quantity) < 100000000n
    || Number(reserved.recordCount) !== 0 || decimal(u.cardReserved) !== 0n) reject('ARMADA_STOCK_REVIEW_REQUIRED', 'Stok veya rezerv durumu pilot gönderime uygun değil.');
  return { terminal: t };
}

export function compileArmadaPilot(intent, profile, bridge, vega, { uid, date, localDateTime }) {
  const number = getPilotDocumentNumber(profile, bridge);
  if (profile.pilotDocumentNumber !== undefined && intent.documentNumber !== number) reject('ARMADA_NUMBER_CHANGED', 'Hazırlanan Melisa fiş numarası değişti; gönderim yapılmadı.');
  const { terminal } = validatePilotReadings(profile, bridge, vega, number);
  // The owner-selected rate travels with the terminal document and is immutable
  // once prepared. Armada's currency master is not this transaction's rate.
  const rate = getTerminalPilotRate(intent);
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(uid || '') || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) reject('ARMADA_GENERATED_ID_INVALID', 'Belge kimliği üretilemedi.');
  const product = decimal('8.47') * decimal(rate);
  if (product % 100000000n) reject('ARMADA_AMOUNT_PRECISION_UNSUPPORTED', 'Kur dönüşümündeki yuvarlama kuralı desteklenmiyor.');
  const baseAmount = decimalString(product / 100000000n);
  const [year, month, day] = date.split('-');
  const header = Object.assign(blank(ARMADA_HEADER_FIELDS), {
    Id: '1', Cari: '1-PEŞİN $', CariExtId: '102', BelgeNo: number, BelgeKod: uid.replaceAll('-', ''),
    Tarih: `${day}.${month}.${year}`, BelgeTutar: '8.47', AraToplam: '8.47', BelgeKDV: '0', NetToplam: '8.47',
    BelgeTip: '33', IskontoTop: '0', AIsk1: '0', AIsk2: '0', AIsk3: '0', AIsk4: '0', Vade: date,
    Parabirimi: '$', Kur: rate, VgFatInd: '0', Terminal: String(terminal.terminalId), Kapali: '0',
    Depo: 'MERKEZ', KayitTarihi: localDateTime, CikanDepo: 'MERKEZ', UID: uid, Personel: '103 (102)',
    OtvToplam: '0', OdemeTutar: '0', SonBakiye: '0',
  });
  const line = Object.assign(blank(ARMADA_LINE_FIELDS), { Id: '1', Stok: '8690000006489', Barcode: '8690000006489',
    Miktar: '1', Fiyat: '8.47', Tutar: '8.47', Isk1: '0', Isk2: '0', Isk3: '0', Isk4: '0', AltIskonto: '0',
    IskToplam: '0', SatirToplam: '8.47', KDV: '0', KDVTutar: '0', StokExtId: '160452', SatirSayisi: '1',
    Parabirimi: '$', Kur: rate, RBMiktar: '0', MiktarBos: '0', Kampanya: '0', Otv: '0', OtvTutar: '0' });
  return { endpoint: ARMADA_SALE_ENDPOINT, armadaUserId: String(profile.terminalId), document: { header, lines: [line] },
    expected: { company: 'F0102', period: 'D0007', uid, armadaTerminalId: profile.terminalId, customerId: 102,
      personnelId: 102, depotId: 1, documentNumber: number, date, currency: '$', exchangeRate: rate,
      exchangeRateSource: 'terminal', total: baseAmount,
      ...(profile.pilotDocumentNumber !== undefined ? { armadaCounterNumber: terminal.nextNumber } : {}),
      lines: [{ stockId: 161383, unitId: 160452, unit: 'ADET', barcode: '8690000006489', quantity: '1',
        unitPrice: baseAmount, total: baseAmount, taxAmount: '0' }] } };
}
