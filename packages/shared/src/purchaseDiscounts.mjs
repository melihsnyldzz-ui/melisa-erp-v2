const SCALE = 10000;
const MAX_UNITS = BigInt(Number.MAX_SAFE_INTEGER);

function invalid(message) {
  return Object.assign(new Error(message), { code: 'PURCHASE_DISCOUNT_VALIDATION_FAILED', statusCode: 400 });
}

function finite(value, field, { min = 0, max = Infinity, positive = false } = {}) {
  const number = Number(value);
  if (!['string', 'number'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(number) || number < min || number > max || (positive && number === 0)) {
    throw invalid(`${field} geçerli ${positive ? 'pozitif' : 'negatif olmayan'} bir sayı olmalı.`);
  }
  return number;
}

function units(value, field) {
  const scaled = Math.round((value + Number.EPSILON) * SCALE);
  if (!Number.isSafeInteger(scaled) || scaled < 0) throw invalid(`${field} hesaplama sınırını aşıyor.`);
  return BigInt(scaled);
}

function money(value) {
  if (value < 0n || value > MAX_UNITS) throw invalid('Fiş tutarı hesaplama sınırını aşıyor.');
  return Number(value) / SCALE;
}

const sum = values => values.reduce((total, value) => total + value, 0n);
const multiplyRate = (amount, rate) => (amount * units(rate, 'İskonto oranı') + 500000n) / 1000000n;

// Largest remainders close every allocation at decimal(18,4), including TRY conversion.
function allocate(total, weights) {
  const base = sum(weights);
  if (base === 0n) {
    if (total !== 0n) throw invalid('Sıfır tutarlı satırlara indirim dağıtılamaz.');
    return weights.map(() => 0n);
  }
  const shares = weights.map(weight => total * weight / base);
  let remainder = total - sum(shares);
  const order = weights.map((weight, index) => ({ index, remainder: total * weight % base }))
    .sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (const row of order) {
    if (remainder === 0n) break;
    shares[row.index] += 1n;
    remainder -= 1n;
  }
  return shares;
}

export function getPurchaseTotals({
  items = [], invoiceDiscountType = 'rate', invoiceDiscountRate = 0,
  invoiceDiscountAmount = 0, supplierDiscountRate = 0, exchangeRate = 1,
} = {}) {
  if (!Array.isArray(items)) throw invalid('Alış satırları liste olmalı.');
  if (!['rate', 'amount'].includes(invoiceDiscountType)) throw invalid('Fiş indirimi yüzde veya tutar olmalı.');
  const invoiceRate = money(units(finite(invoiceDiscountRate, 'Fiş iskonto oranı', { max: 100 }), 'Fiş iskonto oranı'));
  const supplierRate = money(units(finite(supplierDiscountRate, 'Tedarikçi iskonto oranı', { max: 100 }), 'Tedarikçi iskonto oranı'));
  const fixedAmount = units(finite(invoiceDiscountAmount, 'Fiş iskonto tutarı'), 'Fiş iskonto tutarı');
  if ((invoiceDiscountType === 'amount' && invoiceRate !== 0) || (invoiceDiscountType === 'rate' && fixedAmount !== 0n)) {
    throw invalid('Fiş iskontosu aynı anda yüzde ve tutar olamaz.');
  }
  const rate = finite(exchangeRate, 'Fiş kuru', { positive: true });
  const lines = items.map((item, index) => {
    const quantity = finite(item.quantity, `${index + 1}. satır miktarı`, { positive: true });
    const price = finite(item.purchasePrice, `${index + 1}. satır alış fiyatı`);
    const lineRate = finite(item.lineDiscountRate ?? 0, `${index + 1}. satır iskonto oranı`, { max: 100 });
    const gross = units(quantity * price, 'Satır tutarı');
    const lineDiscount = multiplyRate(gross, lineRate);
    return { item, quantity, gross, lineDiscount, afterLine: gross - lineDiscount };
  });
  const subtotal = sum(lines.map(line => line.gross));
  const lineDiscountTotal = sum(lines.map(line => line.lineDiscount));
  const afterLine = subtotal - lineDiscountTotal;
  const invoiceDiscount = invoiceDiscountType === 'amount' ? fixedAmount : multiplyRate(afterLine, invoiceRate);
  if (invoiceDiscount > afterLine) throw invalid('Fiş iskonto tutarı satır iskontoları sonrası ara toplamı aşamaz.');
  const invoiceShares = allocate(invoiceDiscount, lines.map(line => line.afterLine));
  const afterInvoice = lines.map((line, index) => line.afterLine - invoiceShares[index]);
  const supplierDiscount = multiplyRate(sum(afterInvoice), supplierRate);
  const supplierShares = allocate(supplierDiscount, afterInvoice);
  const nets = afterInvoice.map((amount, index) => amount - supplierShares[index]);
  const grandTotal = sum(nets);
  const [rateWhole, rateFraction] = rate.toFixed(8).split('.');
  if (!/^\d+$/.test(rateWhole) || !rateFraction) throw invalid('Fiş kuru hesaplama sınırını aşıyor.');
  const rateUnits = BigInt(rateWhole) * 100000000n + BigInt(rateFraction);
  if (rateUnits <= 0n || rateUnits > MAX_UNITS) throw invalid('Fiş kuru hesaplama sınırını aşıyor.');
  const amountTry = (grandTotal * rateUnits + 50000000n) / 100000000n;
  const tryShares = allocate(amountTry, nets);

  return {
    invoiceDiscountType, invoiceDiscountRate: invoiceRate, invoiceDiscountAmount: money(fixedAmount), supplierDiscountRate: supplierRate,
    subtotal: money(subtotal), lineDiscountTotal: money(lineDiscountTotal), afterLineDiscounts: money(afterLine),
    invoiceDiscountTotal: money(invoiceDiscount), supplierDiscountTotal: money(supplierDiscount),
    discountTotal: money(lineDiscountTotal + invoiceDiscount + supplierDiscount), grandTotal: money(grandTotal),
    amountTry: money(amountTry), stockCostEffectTry: money(amountTry),
    items: lines.map((line, index) => ({
      item: line.item, lineTotal: money(line.afterLine),
      invoiceDiscountShare: money(invoiceShares[index]), supplierDiscountShare: money(supplierShares[index]),
      documentDiscountShare: money(invoiceShares[index] + supplierShares[index]),
      netLineTotal: money(nets[index]), lineTotalTry: money(tryShares[index]),
      netUnitPrice: money(units(money(nets[index]) / line.quantity, 'Net birim alış')),
      unitCostTry: money(units(money(tryShares[index]) / line.quantity, 'Birim maliyet TRY')),
    })),
  };
}

export function allocatePurchaseLineTotals(payload) {
  return getPurchaseTotals(payload).items;
}
