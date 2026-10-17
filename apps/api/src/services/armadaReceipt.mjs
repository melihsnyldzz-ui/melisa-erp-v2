import { serializeArmadaDocument } from './armadaDocumentCodec.mjs';

const SCALE = 100000000n;
const currencies = { $: 'USD', TL: 'TRY', '€': 'EUR' };
const fail = () => { throw Object.assign(new Error('ARMADA_RECEIPT_SNAPSHOT_INVALID'), { code: 'ARMADA_RECEIPT_SNAPSHOT_INVALID' }); };
const requireValue = (condition) => { if (!condition) fail(); };
const positiveId = (value) => Number.isSafeInteger(value) && value > 0;
function text(value, limit = 160) {
  requireValue(typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= limit
    && !/[|\u0000-\u001f\u007f\ufffd]/u.test(value));
  return value;
}
function amount(value) {
  requireValue(typeof value === 'string' && /^\d{1,12}(?:\.\d{1,8})?$/.test(value));
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(8, '0'));
}
function decimal(value) {
  const fraction = String(value % SCALE).padStart(8, '0').replace(/0+$/, '');
  return `${value / SCALE}${fraction ? '.' + fraction : ''}`;
}
const multiply = (a, b) => (a * b + SCALE / 2n) / SCALE;
function documentDate(value) {
  requireValue(typeof value === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(value));
  const [day, month, year] = value.split('.');
  const iso = `${year}-${month}-${day}`;
  requireValue(Number(year) >= 1900 && new Date(`${iso}T00:00:00.000Z`).toISOString().slice(0, 10) === iso);
  return iso;
}

// Projection only: the caller must first load the owned, hash-checked journal
// and freshly reconcile its expected snapshot with Armada and all Vega effects.
// This does not enable additional VAT, unit or discount accounting contracts.
export function createArmadaReceipt({ intent, snapshot, result, checkedAt }) {
  try {
    requireValue(result?.state === 'VERIFIED' && positiveId(result.documentId));
    text(result.documentNumber, 80);
    requireValue(typeof checkedAt === 'string' && new Date(checkedAt).toISOString() === checkedAt);
    const expected = snapshot?.expected;
    requireValue(expected?.company === 'F0102' && expected.period === 'D0007'
      && intent?.company === expected.company && intent.period === expected.period
      && positiveId(intent.actorUserId) && intent.customerId === expected.customerId
      && positiveId(expected.customerId) && positiveId(expected.personnelId) && expected.depotId === 1
      && positiveId(expected.armadaTerminalId));
    requireValue(result.currency === expected.currency && amount(result.total) === amount(expected.total)
      && (!expected.vegaDocumentId || result.documentId === expected.vegaDocumentId));
    serializeArmadaDocument(snapshot.document);
    const { header, lines: wireLines } = snapshot.document;
    requireValue(Array.isArray(expected.lines) && expected.lines.length === wireLines.length && wireLines.length <= 100);
    const labels = snapshot.receiptLabels;
    if (labels !== undefined) requireValue(labels && labels.customerId === expected.customerId
      && Array.isArray(labels.lines) && labels.lines.length === wireLines.length);
    const currency = currencies[header.Parabirimi];
    const rate = amount(header.Kur);
    const date = documentDate(header.Tarih);
    requireValue(currency && header.Parabirimi === expected.currency && rate > 0n
      && rate === amount(expected.exchangeRate) && (currency !== 'TRY' || rate === SCALE)
      && date === expected.date && header.BelgeNo === expected.documentNumber
      && header.UID === expected.uid && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(expected.uid)
      && header.BelgeKod === expected.uid.replaceAll('-', '') && header.BelgeTip === '33'
      && header.CariExtId === String(expected.customerId) && header.Terminal === String(expected.armadaTerminalId)
      && header.Depo === header.CikanDepo);
    for (const field of ['AIsk1', 'AIsk2', 'AIsk3', 'AIsk4', 'OtvToplam', 'OdemeTutar']) requireValue(amount(header[field]) === 0n);
    let subtotal = 0n, discountTotal = 0n, taxTotal = 0n, grandTotal = 0n, baseTotal = 0n;
    const lines = wireLines.map((line, index) => {
      const expectedLine = expected.lines[index];
      requireValue(positiveId(expectedLine?.stockId) && positiveId(expectedLine.unitId) && expectedLine.unit === 'ADET'
        && line.StokExtId === String(expectedLine.unitId) && line.Barcode === expectedLine.barcode
        && line.Stok === line.Barcode && line.Parabirimi === header.Parabirimi && amount(line.Kur) === rate);
      const quantity = amount(line.Miktar), unitPrice = amount(line.Fiyat), lineSubtotal = amount(line.Tutar);
      const discount = amount(line.IskToplam), tax = amount(line.KDVTutar), lineTotal = amount(line.SatirToplam);
      const basePrice = multiply(unitPrice, rate), baseLine = multiply(quantity, basePrice);
      requireValue(quantity > 0n && quantity % SCALE === 0n && quantity === amount(expectedLine.quantity)
        && basePrice === amount(expectedLine.unitPrice) && baseLine === amount(expectedLine.total)
        && tax === amount(expectedLine.taxAmount) && tax === 0n && discount === 0n
        && lineSubtotal === multiply(quantity, unitPrice) && lineTotal === lineSubtotal);
      for (const field of ['KDV', 'Isk1', 'Isk2', 'Isk3', 'Isk4', 'AltIskonto', 'Otv', 'OtvTutar']) requireValue(amount(line[field]) === 0n);
      subtotal += lineSubtotal; discountTotal += discount; taxTotal += tax; grandTotal += lineTotal; baseTotal += baseLine;
      const lineLabels = labels?.lines[index];
      if (labels) requireValue(lineLabels && lineLabels.stockId === expectedLine.stockId
        && lineLabels.unitId === expectedLine.unitId && lineLabels.barcode === expectedLine.barcode);
      return { stockId: expectedLine.stockId, unitId: expectedLine.unitId, barcode: text(line.Barcode), unit: expectedLine.unit,
        ...(lineLabels?.stockCode !== undefined ? { stockCode: text(lineLabels.stockCode) } : {}),
        ...(lineLabels?.productName !== undefined ? { productName: text(lineLabels.productName) } : {}),
        quantity: decimal(quantity), unitPrice: decimal(unitPrice), subtotal: decimal(lineSubtotal),
        discountTotal: decimal(discount), taxAmount: decimal(tax), lineTotal: decimal(lineTotal) };
    });
    requireValue(subtotal === amount(header.BelgeTutar) && subtotal === amount(header.AraToplam)
      && discountTotal === amount(header.IskontoTop) && taxTotal === amount(header.BelgeKDV)
      && grandTotal === amount(header.NetToplam) && baseTotal === amount(expected.total));
    return { version: 1, source: 'armada-vega-journal',
      clientEventId: text(intent.requestClientEventId ?? intent.clientEventId), documentId: result.documentId,
      documentNumber: result.documentNumber, documentDate: date, checkedAt,
      customerId: expected.customerId, customerCode: text(header.Cari), terminalCode: text(intent.terminalCode),
      ...(labels?.customerName !== undefined ? { customerName: text(labels.customerName) } : {}),
      personnelCode: text(header.Personel), depotCode: text(header.Depo), currency, exchangeRate: decimal(rate),
      subtotal: decimal(subtotal), discountTotal: decimal(discountTotal), taxTotal: decimal(taxTotal),
      grandTotal: decimal(grandTotal), baseCurrency: 'TRY', baseTotal: decimal(baseTotal), collectionConfirmed: false, lines };
  } catch {
    fail();
  }
}
