// User-selected borderless wholesale invoice. Pure rendering; no requests or writes.
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const knownNumber = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const currencyCode = (value) => ({ '$': 'USD', '€': 'EUR', '₺': 'TRY', TL: 'TRY' })[value] || value || 'TRY';
const currencySymbol = (value) => ({ USD: '$', EUR: '€', TRY: '₺' })[currencyCode(value)] || value;
const quantity = (value) => knownNumber(value)
  ? new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 8 }).format(Number(value)) : '—';
const money = (value, currency, maximumFractionDigits = 2) => knownNumber(value)
  ? `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits }).format(Number(value))} ${escape(currencySymbol(currency))}` : '—';

function receiptDate(value) {
  const iso = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  return iso ? `${iso[3]}.${iso[2]}.${iso[1]}` : String(value || '—').split(' ')[0];
}

const ones = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const tens = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
function wordsUnderThousand(value) {
  const hundred = Math.floor(value / 100);
  return [hundred > 1 ? ones[hundred] : '', hundred ? 'yüz' : '', tens[Math.floor(value % 100 / 10)], ones[value % 10]].filter(Boolean).join(' ');
}
function integerWords(value) {
  if (value === 0n) return 'sıfır';
  const scales = ['', 'bin', 'milyon', 'milyar', 'trilyon', 'katrilyon'];
  const parts = [];
  let index = 0;
  while (value > 0n) {
    if (index >= scales.length) return '';
    const group = Number(value % 1000n);
    if (group) parts.unshift([index === 1 && group === 1 ? '' : wordsUnderThousand(group), scales[index]].filter(Boolean).join(' '));
    value /= 1000n;
    index++;
  }
  return parts.join(' ');
}

export function amountInTurkishWords(value, currency = 'TRY') {
  if (!knownNumber(value)) return '';
  // Round decimal text to cents without binary floating-point drift (e.g. 1.995).
  const match = String(value).trim().match(/^(-?)(\d{1,18})(?:\.(\d+))?$/);
  const unit = { USD: ['dolar', 'sent'], EUR: ['euro', 'sent'], TRY: ['Türk lirası', 'kuruş'] }[currencyCode(currency)];
  if (!match || !unit) return '';
  const fraction = (match[3] || '').padEnd(3, '0');
  const cents = BigInt(match[2]) * 100n + BigInt(fraction.slice(0, 2)) + (Number(fraction[2]) >= 5 ? 1n : 0n);
  const wholeWords = integerWords(cents / 100n);
  if (!wholeWords) return '';
  const minor = Number(cents % 100n);
  const words = [match[1] && cents ? 'eksi' : '', wholeWords, unit[0], minor ? wordsUnderThousand(minor) : '', minor ? unit[1] : ''].filter(Boolean).join(' ');
  return words[0].toLocaleUpperCase('tr-TR') + words.slice(1);
}

export function buildInvoiceReceiptHtml({
  title = 'Satış Fişi', documentNo = '—', status = '—', date,
  partyName = '—', employeeName, currency = 'TRY', items = [], totals = {}, extraInfo = [], hasUnsavedChanges = false,
} = {}) {
  const totalCurrency = totals.currency || currency;
  const discount = totals.discountAmount ?? totals.discountTotal ?? totals.totalDiscount;
  const tax = totals.taxTotal ?? totals.vatAmount ?? totals.taxAmount;
  const total = totals.grandTotal ?? totals.totalAmount ?? totals.originalTotal;
  const totalWords = amountInTurkishWords(total, totalCurrency);
  const personnel = employeeName || extraInfo.find(({ label }) => label === 'Personel')?.value || '—';
  const state = String(status).toLocaleUpperCase('tr-TR');
  const stateLabel = ['DRAFT', 'TASLAK'].includes(state) ? 'TASLAK'
    : ['CANCELLED', 'CANCELED', 'İPTAL', 'IPTAL'].includes(state) ? 'İPTAL' : '';
  const purchase = title.toLocaleLowerCase('tr-TR').includes('alış');
  const documentState = [purchase ? 'ALIŞ FİŞİ' : '', stateLabel, hasUnsavedChanges ? 'KAYDEDİLMEMİŞ DEĞİŞİKLİKLER' : ''].filter(Boolean).join(' · ');
  const adjustmentRows = [
    ...(Number(discount) || Number(tax) ? [['Ara toplam', totals.subtotal]] : []),
    ...(Number(discount) ? [['İndirim', discount]] : []),
    ...(Number(tax) ? [['KDV', tax]] : []),
  ];
  const itemRows = items.map((item) => {
    const itemCurrency = item.lineCurrency || item.currency || currency;
    const unitPrice = item.unitPriceOriginal ?? item.unitPrice ?? item.purchasePrice;
    const lineTotal = item.lineTotalOriginal ?? item.lineTotal ?? item.totalAmount ?? (
      knownNumber(unitPrice) && knownNumber(item.quantity)
        ? Number(unitPrice) * Number(item.quantity) * (1 - Number(item.lineDiscountRate || 0) / 100) : undefined
    );
    return `<tr class="item">
      <td class="stock-code">${escape(item.stockCode || '—')}</td>
      <td class="product-name">${escape(item.productName || '—')}</td>
      <td class="number quantity">${quantity(item.quantity)}</td>
      <td class="unit">${escape(item.unit || 'ADET')}</td>
      <td class="number price">${money(unitPrice, itemCurrency, 8)}</td>
      <td class="number amount">${money(lineTotal, itemCurrency)}</td>
    </tr>`;
  }).join('');
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
    <title>${escape(title)} ${escape(documentNo)}</title>
    <style>
      * { box-sizing: border-box; }
      @page { size: A4 portrait; margin: 5mm 7mm; }
      body { margin: 0; background: #fff; color: #000; font: 10pt/1.35 Arial, Helvetica, sans-serif; }
      .receipt { width: 100%; max-width: 196mm; margin: 0 auto; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      col.stock { width: 18%; } col.product { width: 40%; } col.qty { width: 7%; }
      col.unit { width: 8%; } col.price { width: 13%; } col.amount { width: 14%; }
      th, td { border: 0; padding: 1.35pt 4pt; vertical-align: top; text-align: left; }
      thead { display: table-header-group; }
      .identity-cell { padding: 0 4pt 20pt; }
      .identity { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; text-align: left; }
      .identity .personnel { text-align: center; } .identity .date { text-align: right; }
      .identity .label { display: block; font-size: 8pt; font-weight: normal; margin-bottom: 1pt; }
      .identity strong { display: block; font-size: 12pt; line-height: 1.25; overflow-wrap: anywhere; }
      .document-state { margin-top: 5pt; font-weight: bold; font-size: 9pt; }
      .columns th { font-size: 10.5pt; font-weight: bold; padding-bottom: 8pt; }
      .number { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .unit { white-space: nowrap; }
      .stock-code, .product-name { overflow-wrap: anywhere; }
      tr.item { break-inside: avoid; page-break-inside: avoid; }
      .receipt-summary { display: flex; align-items: flex-end; justify-content: space-between; gap: 8mm; padding: 26pt 4pt 0; break-inside: avoid; page-break-inside: avoid; }
      .amount-words { flex: 1; font-size: 9pt; }
      .totals { min-width: 62mm; }
      .total-row { display: flex; justify-content: space-between; gap: 6mm; margin-top: 3pt; }
      .total-row strong { white-space: nowrap; }
      .grand { font-size: 11pt; font-weight: bold; }
      @media screen { body { padding: 5mm 7mm; } }
    </style></head><body><main class="receipt" data-template="plain-invoice-v2">
    <table aria-label="${escape(title)} ürün satırları">
      <colgroup><col class="stock"><col class="product"><col class="qty"><col class="unit"><col class="price"><col class="amount"></colgroup>
      <thead>
        <tr><td colspan="6" class="identity-cell"><header class="identity">
          <div class="party"><span class="label">CARİ</span><strong>${escape(partyName)}</strong></div>
          <div class="personnel"><span class="label">PERSONEL</span><strong>${escape(personnel)}</strong></div>
          <div class="date"><span class="label">TARİH</span><strong>${escape(receiptDate(date))}</strong></div>
        </header>${documentState ? `<div class="document-state">${escape(documentState)}</div>` : ''}</td></tr>
        <tr class="columns"><th scope="col">Stok Kodu</th><th scope="col">Malın Cinsi</th><th scope="col" class="number">Miktar</th><th scope="col" aria-label="Birim"></th><th scope="col" class="number">Fiyat</th><th scope="col" class="number">Tutar</th></tr>
      </thead>
      <tbody>${itemRows || '<tr><td colspan="6">Satır yok.</td></tr>'}</tbody>
    </table>
    <footer class="receipt-summary">
      <div class="amount-words">${totalWords ? `<strong>Yalnız:</strong> ${escape(totalWords)}.` : ''}</div>
      <div class="totals">${adjustmentRows.map(([label, value]) => `<div class="total-row"><span>${escape(label)}</span><strong>${money(value, totalCurrency)}</strong></div>`).join('')}
        <div class="total-row grand"><span>GENEL TOPLAM:</span><strong>${money(total, totalCurrency)}</strong></div>
      </div>
    </footer>
    </main></body></html>`;
}
