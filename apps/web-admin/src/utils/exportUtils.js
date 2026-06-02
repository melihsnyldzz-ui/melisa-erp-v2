function safeFilePart(value) {
  return String(value || 'rapor')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'rapor';
}

function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportRowsToCsv({ filename, columns, rows }) {
  const header = columns.map((column) => csvEscape(column.label)).join(';');
  const body = rows.map((row) => (
    columns.map((column) => csvEscape(typeof column.value === 'function' ? column.value(row) : row[column.key])).join(';')
  ));
  const csv = `\uFEFF${[header, ...body].join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `${safeFilePart(filename)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printCurrentScreen(title = 'Melisa ERP') {
  const previousTitle = document.title;
  document.title = title;
  window.print();
  document.title = previousTitle;
}

function htmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMoney(value, currency = 'TRY') {
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency || 'TRY',
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency || ''}`.trim();
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function buildInfoRows(rows = []) {
  return rows.map(({ label, value }) => `
    <div class="info-row">
      <span>${htmlEscape(label)}</span>
      <strong>${htmlEscape(value || '-')}</strong>
    </div>
  `).join('');
}

function buildItemRows(items = [], currency = 'TRY') {
  return items.map((item, index) => {
    const unitPrice = Number(item.unitPrice ?? item.purchasePrice ?? 0);
    const quantity = Number(item.quantity || 0);
    const itemCurrency = item.currency || currency || 'TRY';
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${htmlEscape(item.stockCode || '')}</td>
        <td>${htmlEscape(item.barcode || '')}</td>
        <td>${htmlEscape(item.productName || '')}</td>
        <td class="num">${formatNumber(quantity)}</td>
        <td>${htmlEscape(itemCurrency)}</td>
        <td class="num">${formatMoney(unitPrice, itemCurrency)}</td>
        <td class="num">${formatMoney(quantity * unitPrice, itemCurrency)}</td>
      </tr>
    `;
  }).join('');
}

export function printBusinessDocument({
  title = 'Belge',
  documentNo = '-',
  status = '-',
  date = '-',
  partyLabel = 'Cari',
  partyName = '-',
  currency = 'TRY',
  exchangeRate = 1,
  description = '',
  items = [],
  totals = {},
  extraInfo = [],
}) {
  const printWindow = window.open('', '_blank', 'width=980,height=720');
  if (!printWindow) {
    printCurrentScreen(`Melisa ERP - ${title}`);
    return;
  }

  const totalCurrency = totals.currency || currency || 'TRY';
  const html = `<!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>${htmlEscape(title)} ${htmlEscape(documentNo)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #111827; background: #fff; }
          .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid #b42318; padding-bottom: 14px; margin-bottom: 18px; }
          .brand strong { display: block; color: #111827; font-size: 22px; }
          .brand span { display: block; margin-top: 4px; color: #667085; font-size: 12px; }
          .doc-title { text-align: right; }
          .doc-title strong { display: block; font-size: 20px; color: #b42318; }
          .doc-title span { display: block; margin-top: 5px; color: #344054; font-size: 12px; }
          .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
          .info-row { border: 1px solid #d0d5dd; padding: 8px; min-height: 48px; }
          .info-row span { display: block; color: #667085; font-size: 11px; font-weight: 700; text-transform: uppercase; }
          .info-row strong { display: block; margin-top: 5px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f2f4f7; color: #182230; font-size: 11px; text-align: left; border: 1px solid #d0d5dd; padding: 7px; }
          td { border: 1px solid #d0d5dd; padding: 7px; font-size: 12px; }
          .num { text-align: right; }
          .totals { width: 360px; margin: 16px 0 0 auto; border: 1px solid #d0d5dd; }
          .total-row { display: flex; justify-content: space-between; border-bottom: 1px solid #e4e7ec; padding: 8px 10px; font-size: 12px; }
          .total-row:last-child { border-bottom: 0; font-weight: 800; color: #027a48; font-size: 15px; }
          .description { margin-top: 14px; border: 1px solid #d0d5dd; padding: 10px; min-height: 42px; font-size: 12px; }
          .footer { margin-top: 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; color: #667085; font-size: 11px; }
          .signature { border-top: 1px solid #98a2b3; padding-top: 8px; text-align: center; margin-top: 34px; }
          @media print {
            body { padding: 14mm; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <section class="header">
          <div class="brand">
            <strong>Melisa Bebe ERP</strong>
            <span>Belge çıktısı / PDF için Yazdır penceresinde PDF olarak kaydet seçilebilir.</span>
          </div>
          <div class="doc-title">
            <strong>${htmlEscape(title)}</strong>
            <span>${htmlEscape(documentNo)} / ${htmlEscape(status)}</span>
          </div>
        </section>
        <section class="info-grid">
          ${buildInfoRows([
            { label: 'Belge No', value: documentNo },
            { label: 'Tarih', value: date },
            { label: partyLabel, value: partyName },
            { label: 'Durum', value: status },
            { label: 'Para Birimi', value: currency },
            { label: 'Kur', value: exchangeRate },
            ...extraInfo,
          ])}
        </section>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Stok Kodu</th>
              <th>Barkod</th>
              <th>Ürün</th>
              <th class="num">Miktar</th>
              <th>PB</th>
              <th class="num">Birim Fiyat</th>
              <th class="num">Satır Toplamı</th>
            </tr>
          </thead>
          <tbody>
            ${items.length > 0 ? buildItemRows(items, currency) : '<tr><td colspan="8">Satır yok.</td></tr>'}
          </tbody>
        </table>
        <section class="totals">
          <div class="total-row"><span>Ara toplam</span><strong>${formatMoney(totals.subtotal, totalCurrency)}</strong></div>
          <div class="total-row"><span>İskonto</span><strong>${formatMoney(totals.discountAmount ?? totals.discountTotal ?? totals.totalDiscount, totalCurrency)}</strong></div>
          <div class="total-row"><span>TRY karşılığı</span><strong>${formatMoney(totals.tryEquivalent ?? totals.amountTry, 'TRY')}</strong></div>
          <div class="total-row"><span>Genel toplam</span><strong>${formatMoney(totals.grandTotal, totalCurrency)}</strong></div>
        </section>
        ${description ? `<section class="description"><strong>Açıklama:</strong> ${htmlEscape(description)}</section>` : ''}
        <section class="footer">
          <div class="signature">Hazırlayan</div>
          <div class="signature">Onay / Teslim Alan</div>
        </section>
        <script>
          window.onload = function () {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
