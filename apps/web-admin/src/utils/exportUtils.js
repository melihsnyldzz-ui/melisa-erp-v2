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

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function printHtmlDocument(html, title = 'Melisa ERP') {
  const iframe = document.createElement('iframe');
  iframe.title = title;
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';

  iframe.onload = () => {
    const printWindow = iframe.contentWindow;

    if (!printWindow) {
      iframe.remove();
      return;
    }

    printWindow.focus();
    printWindow.print();
    window.setTimeout(() => iframe.remove(), 1000);
  };

  iframe.srcdoc = html;
  document.body.appendChild(iframe);
}

const PRINT_COMPANY_INFO_STORAGE_KEY = 'melisa.erp.printCompanyInfo';

const defaultPrintCompanyInfo = {
  name: 'Melisa Bebe ERP',
  taxOffice: '',
  taxNumber: '',
  address: '',
  phone: '',
};

export function savePrintCompanyInfo(companyInfo = {}) {
  try {
    localStorage.setItem(PRINT_COMPANY_INFO_STORAGE_KEY, JSON.stringify({
      ...defaultPrintCompanyInfo,
      ...companyInfo,
    }));
  } catch {
    // Local storage is optional; print output falls back to defaults.
  }
}

function getPrintCompanyInfo(override = {}) {
  try {
    const stored = JSON.parse(localStorage.getItem(PRINT_COMPANY_INFO_STORAGE_KEY) || '{}');
    return {
      ...defaultPrintCompanyInfo,
      ...stored,
      ...override,
    };
  } catch {
    return {
      ...defaultPrintCompanyInfo,
      ...override,
    };
  }
}

export function exportRowsToCsv({ filename, columns, rows }) {
  const header = columns.map((column) => csvEscape(column.label)).join(';');
  const body = rows.map((row) => (
    columns.map((column) => csvEscape(typeof column.value === 'function' ? column.value(row) : row[column.key])).join(';')
  ));
  const csv = `\uFEFF${[header, ...body].join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });

  downloadBlob(blob, `${safeFilePart(filename)}.csv`);
}

function columnValue(column, row) {
  return typeof column.value === 'function' ? column.value(row) : row[column.key];
}

export function exportRowsToExcel({ filename, title = 'Melisa ERP Raporu', columns, rows }) {
  const tableRows = rows.map((row) => `
    <tr>
      ${columns.map((column) => `<td>${htmlEscape(columnValue(column, row))}</td>`).join('')}
    </tr>
  `).join('');
  const html = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
          caption { text-align: left; font-size: 16px; font-weight: 800; padding: 8px 0; }
          th { background: #f2f4f7; color: #101828; border: 1px solid #98a2b3; padding: 6px; }
          td { border: 1px solid #d0d5dd; padding: 6px; mso-number-format: "\\@"; }
        </style>
      </head>
      <body>
        <table>
          <caption>${htmlEscape(title)}</caption>
          <thead>
            <tr>${columns.map((column) => `<th>${htmlEscape(column.label)}</th>`).join('')}</tr>
          </thead>
          <tbody>${tableRows || `<tr><td colspan="${columns.length}">Kayıt yok.</td></tr>`}</tbody>
        </table>
      </body>
    </html>`;

  downloadBlob(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }), `${safeFilePart(filename)}.xls`);
}

export function printRowsReport({ title = 'Melisa ERP Raporu', subtitle = '', columns, rows }) {
  const printCompany = getPrintCompanyInfo();
  const companySubline = [printCompany.address, printCompany.phone].filter(Boolean).join(' / ');
  const html = `<!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>${htmlEscape(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 20px; font-family: Arial, sans-serif; color: #101828; background: #fff; }
          .header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 4px solid #b42318; padding-bottom: 12px; margin-bottom: 14px; }
          .brand strong { display: block; font-size: 22px; }
          .brand span { display: block; color: #667085; font-size: 12px; margin-top: 4px; }
          .title { text-align: right; }
          .title strong { display: block; color: #b42318; font-size: 21px; }
          .title span { display: block; color: #344054; font-size: 12px; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f2f4f7; color: #182230; border: 1px solid #d0d5dd; padding: 7px; text-align: left; font-size: 11px; }
          td { border: 1px solid #d0d5dd; padding: 7px; font-size: 12px; }
          .footer { margin-top: 16px; color: #667085; font-size: 11px; }
          @media print {
            body { padding: 12mm; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <section class="header">
          <div class="brand">
            <strong>${htmlEscape(printCompany.name || 'Melisa Bebe ERP')}</strong>
            <span>${htmlEscape(companySubline || 'Liste çıktısı / Yazdır penceresinden PDF olarak kaydedilebilir.')}</span>
          </div>
          <div class="title">
            <strong>${htmlEscape(title)}</strong>
            <span>${htmlEscape(subtitle || new Date().toLocaleString('tr-TR'))}</span>
          </div>
        </section>
        <table>
          <thead>
            <tr>${columns.map((column) => `<th>${htmlEscape(column.label)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map((row) => `
              <tr>${columns.map((column) => `<td>${htmlEscape(columnValue(column, row))}</td>`).join('')}</tr>
            `).join('') : `<tr><td colspan="${columns.length}">Kayıt yok.</td></tr>`}
          </tbody>
        </table>
        <section class="footer">Satır sayısı: ${rows.length}</section>
        <script>
          window.onload = function () {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>`;

  printHtmlDocument(html, title);
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

function formatDocumentIdentity(documentNo = '-') {
  const text = String(documentNo || '-').trim();
  if (!text || text === '-') {
    return { series: '-', number: '-' };
  }

  const match = text.match(/^([A-Z]+[-_][A-Z0-9]*)[-_](\d{3,})$/i);
  if (match) {
    return { series: match[1], number: match[2] };
  }

  const parts = text.split(/[-_]/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      series: parts.slice(0, -1).join('-'),
      number: parts[parts.length - 1],
    };
  }

  return { series: '-', number: text };
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
    const lineDiscountRate = Number(item.lineDiscountRate || 0);
    const grossLineTotal = quantity * unitPrice;
    const netLineTotal = Number(item.lineTotal ?? item.totalAmount ?? grossLineTotal * (1 - lineDiscountRate / 100));
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${htmlEscape(item.stockCode || '')}</td>
        <td>${htmlEscape(item.barcode || '')}</td>
        <td>${htmlEscape(item.productName || '')}</td>
        <td class="num">${formatNumber(quantity)}</td>
        <td>${htmlEscape(itemCurrency)}</td>
        <td class="num">${formatMoney(unitPrice, itemCurrency)}</td>
        <td class="num">${lineDiscountRate ? `%${formatNumber(lineDiscountRate)}` : '-'}</td>
        <td class="num">${formatMoney(netLineTotal, itemCurrency)}</td>
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
  companyInfo = {},
}) {
  const totalCurrency = totals.currency || currency || 'TRY';
  const discountValue = totals.discountAmount ?? totals.discountTotal ?? totals.totalDiscount ?? 0;
  const tryValue = totals.tryEquivalent ?? totals.amountTry ?? totals.totalTry ?? 0;
  const grandTotal = totals.grandTotal ?? totals.totalAmount ?? totals.originalTotal ?? 0;
  const printCompany = getPrintCompanyInfo(companyInfo);
  const taxLine = [printCompany.taxOffice, printCompany.taxNumber].filter(Boolean).join(' / ');
  const documentIdentity = formatDocumentIdentity(documentNo);
  const html = `<!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>${htmlEscape(title)} ${htmlEscape(documentNo)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 22px; font-family: Arial, sans-serif; color: #111827; background: #fff; }
          .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 4px solid #b42318; padding-bottom: 14px; margin-bottom: 14px; }
          .brand strong { display: block; color: #111827; font-size: 22px; }
          .brand span { display: block; margin-top: 4px; color: #667085; font-size: 12px; }
          .brand small { display: block; margin-top: 3px; color: #344054; font-size: 11px; }
          .doc-title { text-align: right; }
          .doc-title strong { display: block; font-size: 22px; color: #b42318; }
          .doc-title span { display: block; margin-top: 5px; color: #344054; font-size: 12px; }
          .doc-title small { display: block; margin-top: 5px; color: #667085; font-size: 11px; }
          .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
          .info-row { border: 1px solid #d0d5dd; padding: 8px; min-height: 48px; background: #fcfcfd; }
          .info-row span { display: block; color: #667085; font-size: 11px; font-weight: 700; text-transform: uppercase; }
          .info-row strong { display: block; margin-top: 5px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f2f4f7; color: #182230; font-size: 11px; text-align: left; border: 1px solid #d0d5dd; padding: 7px; }
          td { border: 1px solid #d0d5dd; padding: 7px; font-size: 12px; }
          .num { text-align: right; }
          .document-grid { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 14px; align-items: start; margin-top: 14px; }
          .totals { border: 1px solid #d0d5dd; background: #fff; }
          .total-row { display: flex; justify-content: space-between; border-bottom: 1px solid #e4e7ec; padding: 8px 10px; font-size: 12px; }
          .total-row:last-child { border-bottom: 0; font-weight: 800; color: #027a48; font-size: 15px; }
          .description { border: 1px solid #d0d5dd; padding: 10px; min-height: 72px; font-size: 12px; background: #fcfcfd; }
          .footer { margin-top: 26px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; color: #667085; font-size: 11px; }
          .signature { border-top: 1px solid #98a2b3; padding-top: 8px; text-align: center; margin-top: 34px; }
          @media print {
            body { padding: 14mm; }
            .no-print { display: none; }
            .document-grid { grid-template-columns: minmax(0, 1fr) 86mm; }
          }
        </style>
      </head>
      <body>
        <section class="header">
          <div class="brand">
            <strong>${htmlEscape(printCompany.name || 'Melisa Bebe ERP')}</strong>
            <span>${htmlEscape(printCompany.address || 'Adres bilgisi sistem ayarlarından girilebilir.')}</span>
            <small>${htmlEscape(printCompany.phone || 'Telefon bilgisi yok')}</small>
            <small>${htmlEscape(taxLine || 'Vergi bilgisi yok')}</small>
          </div>
          <div class="doc-title">
            <strong>${htmlEscape(title)}</strong>
            <span>${htmlEscape(documentNo)} / ${htmlEscape(status)}</span>
            <small>Belge çıktısı / PDF için Yazdır penceresinde PDF olarak kaydet seçilebilir.</small>
          </div>
        </section>
        <section class="info-grid">
          ${buildInfoRows([
            { label: 'Belge Seri', value: documentIdentity.series },
            { label: 'Belge No', value: documentIdentity.number },
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
              <th class="num">İsk %</th>
              <th class="num">Satır Toplamı</th>
            </tr>
          </thead>
          <tbody>
            ${items.length > 0 ? buildItemRows(items, currency) : '<tr><td colspan="9">Satır yok.</td></tr>'}
          </tbody>
        </table>
        <section class="document-grid">
          <section class="description"><strong>Açıklama:</strong> ${htmlEscape(description || 'Belge açıklaması yok.')}</section>
          <section class="totals">
            <div class="total-row"><span>Ara toplam</span><strong>${formatMoney(totals.subtotal, totalCurrency)}</strong></div>
            <div class="total-row"><span>İskonto</span><strong>${formatMoney(discountValue, totalCurrency)}</strong></div>
            <div class="total-row"><span>TRY karşılığı</span><strong>${formatMoney(tryValue, 'TRY')}</strong></div>
            <div class="total-row"><span>Genel toplam</span><strong>${formatMoney(grandTotal, totalCurrency)}</strong></div>
          </section>
        </section>
        <section class="footer">
          <div class="signature">Hazırlayan</div>
          <div class="signature">Kontrol Eden</div>
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

  printHtmlDocument(html, title);
}
export function printFinanceReceipt(receipt = {}) {
  const type = receipt.type || 'Cari Makbuz';
  const receiptNo = receipt.receiptNo || '-';
  const currency = receipt.currency || 'TRY';
  const isPayment = String(type).toLocaleLowerCase('tr-TR').includes('ödeme')
    || String(type).toLocaleLowerCase('tr-TR').includes('ödeme')
    || receipt.partyType === 'supplier';
  const titleColor = isPayment ? '#b42318' : '#007a4d';
  const directionLabel = isPayment ? 'Çıkış' : 'Giriş';
  const partyTypeLabel = receipt.partyType === 'supplier' ? 'Tedarikçi' : 'Müşteri';
  const balanceEffect = Number(receipt.balanceEffect ?? 0);
  const amount = Number(receipt.amount || 0);
  const printCompany = getPrintCompanyInfo();
  const companySubline = [printCompany.address, printCompany.phone].filter(Boolean).join(' / ');
  const html = `<!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>${htmlEscape(type)} ${htmlEscape(receiptNo)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 22px; font-family: Arial, sans-serif; color: #101828; background: #f8fafc; }
          .receipt { max-width: 720px; margin: 0 auto; background: #fff; border: 1px solid #d0d5dd; box-shadow: 0 14px 34px rgba(15, 23, 42, 0.12); }
          .header { display: flex; justify-content: space-between; gap: 20px; padding: 18px 20px; border-bottom: 4px solid ${titleColor}; }
          .brand strong { display: block; font-size: 22px; color: #101828; }
          .brand span { display: block; margin-top: 4px; color: #667085; font-size: 12px; }
          .title { text-align: right; }
          .title strong { display: block; color: ${titleColor}; font-size: 21px; }
          .title span { display: block; margin-top: 5px; color: #344054; font-size: 12px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 16px 20px; }
          .cell, .info-row { border: 1px solid #d0d5dd; padding: 10px; min-height: 56px; }
          .cell span, .info-row span { display: block; color: #667085; font-size: 11px; font-weight: 700; text-transform: uppercase; }
          .cell strong, .info-row strong { display: block; margin-top: 6px; font-size: 14px; color: #101828; }
          .amount-box { margin: 0 20px 16px; border: 2px solid ${titleColor}; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; }
          .amount-box span { color: #475467; font-weight: 700; }
          .amount-box strong { color: ${titleColor}; font-size: 24px; }
          .note { margin: 0 20px 16px; border: 1px solid #d0d5dd; padding: 10px; min-height: 44px; font-size: 12px; color: #344054; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; padding: 28px 20px 20px; }
          .signature { border-top: 1px solid #98a2b3; padding-top: 8px; text-align: center; color: #667085; font-size: 12px; }
          .footer { padding: 0 20px 16px; color: #667085; font-size: 11px; }
          @media print {
            body { padding: 0; background: #fff; }
            .receipt { box-shadow: none; border: 0; }
          }
        </style>
      </head>
      <body>
        <main class="receipt">
          <section class="header">
            <div class="brand">
              <strong>${htmlEscape(printCompany.name || 'Melisa Bebe ERP')}</strong>
              <span>${htmlEscape(companySubline || 'Finans makbuzu / Yazdır penceresinden PDF olarak kaydedilebilir.')}</span>
            </div>
            <div class="title">
              <strong>${htmlEscape(type)}</strong>
              <span>${htmlEscape(receiptNo)} / ${htmlEscape(receipt.source || 'ERP')}</span>
            </div>
          </section>
          <section class="grid">
            ${buildInfoRows([
              { label: 'Makbuz No', value: receiptNo },
              { label: 'Tarih', value: receipt.documentDate || '-' },
              { label: 'Cari Türü', value: partyTypeLabel },
              { label: 'Cari', value: `${receipt.partyCode || '-'} / ${receipt.partyName || '-'}` },
              { label: 'Ödeme Şekli', value: receipt.paymentMethod || '-' },
              { label: 'Kasa / Banka', value: receipt.accountLabel || receipt.accountName || receipt.accountCode || '-' },
              { label: 'Hareket Yönü', value: directionLabel },
              { label: 'Para Birimi', value: currency },
              { label: 'Bakiye Etkisi', value: formatMoney(balanceEffect, currency) },
            ])}
          </section>
          <section class="amount-box">
            <span>${htmlEscape(isPayment ? 'Ödenen Tutar' : 'Tahsil Edilen Tutar')}</span>
            <strong>${formatMoney(amount, currency)}</strong>
          </section>
          <section class="note">
            <strong>Açıklama:</strong> ${htmlEscape(receipt.description || `${partyTypeLabel} cari hareket makbuzu`)}
          </section>
          <section class="signatures">
            <div class="signature">Teslim Eden</div>
            <div class="signature">Teslim Alan</div>
          </section>
          <section class="footer">
            Bu belge Melisa ERP finans hareketlerinden üretilmiştir. Eski kayıtlarda ödeme şekli DB'de saklanmadığında '-' görünebilir.
          </section>
        </main>
        <script>
          window.onload = function () {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>`;

  printHtmlDocument(html, type);
}

function buildStatementRows(rows = [], { partyKey, movementLabel, debitWhenPositive = true }) {
  return rows.map((row) => {
    const effect = Number(row.balanceEffect || row.amount || 0);
    const debit = debitWhenPositive
       ? (effect >= 0 ? effect : 0)
      : (effect < 0 ? Math.abs(effect) : 0);
    const credit = debitWhenPositive
       ? (effect < 0 ? Math.abs(effect) : 0)
      : (effect >= 0 ? effect : 0);

    return `
      <tr>
        <td>${htmlEscape(row.documentDate || '-')}</td>
        <td>${htmlEscape(row[partyKey] || row.customerName || row.supplierName || row.customerCode || row.supplierCode || '-')}</td>
        <td>${htmlEscape(row.documentNo || '-')}</td>
        <td>${htmlEscape(movementLabel(row, row.movementType))}</td>
        <td class="num debit">${debit ? formatMoney(debit, row.currency) : '-'}</td>
        <td class="num credit">${credit ? formatMoney(credit, row.currency) : '-'}</td>
        <td class="num">${formatMoney(effect, row.currency)}</td>
        <td>${htmlEscape(row.currency || 'TRY')}</td>
      </tr>
    `;
  }).join('');
}

function buildStatementTotals(totals = []) {
  return totals.map((total) => `
    <div class="total-card">
      <span>${htmlEscape(total.currency)} bakiye</span>
      <strong>${formatMoney(total.balance, total.currency)}</strong>
      <small>Borç ${formatMoney(total.debit, total.currency)} / Alacak ${formatMoney(total.credit, total.currency)}</small>
    </div>
  `).join('');
}

export function printLedgerStatement({
  title = 'Cari Ekstre',
  partyLabel = 'Cari',
  filters = {},
  rows = [],
  cancelledRows = [],
  totals = [],
  cancelledTotals = [],
  movementLabel = (value) => value || '-',
  partyKey = 'partyName',
  debitWhenPositive = true,
}) {
  const printCompany = getPrintCompanyInfo();
  const companySubline = [printCompany.address, printCompany.phone].filter(Boolean).join(' / ');
  const html = `<!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>${htmlEscape(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 20px; font-family: Arial, sans-serif; color: #101828; background: #fff; }
          .header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 4px solid #b42318; padding-bottom: 12px; margin-bottom: 14px; }
          .brand strong { display: block; font-size: 22px; }
          .brand span { display: block; color: #667085; font-size: 12px; margin-top: 4px; }
          .title { text-align: right; }
          .title strong { display: block; color: #b42318; font-size: 21px; }
          .title span { display: block; color: #344054; font-size: 12px; margin-top: 5px; }
          .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
          .info-row { border: 1px solid #d0d5dd; padding: 8px; min-height: 48px; }
          .info-row span { display: block; color: #667085; font-size: 11px; font-weight: 800; text-transform: uppercase; }
          .info-row strong { display: block; margin-top: 5px; font-size: 13px; }
          .totals { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
          .total-card { border: 1px solid #d0d5dd; padding: 9px; background: #f8fafc; }
          .total-card span { display: block; color: #667085; font-size: 11px; font-weight: 800; text-transform: uppercase; }
          .total-card strong { display: block; margin-top: 5px; color: #007a4d; font-size: 16px; }
          .total-card small { display: block; margin-top: 4px; color: #475467; font-size: 11px; }
          h2 { margin: 18px 0 8px; font-size: 15px; color: #101828; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f2f4f7; color: #182230; border: 1px solid #d0d5dd; padding: 7px; text-align: left; font-size: 11px; }
          td { border: 1px solid #d0d5dd; padding: 7px; font-size: 12px; }
          .num { text-align: right; }
          .debit { color: #b42318; font-weight: 800; }
          .credit { color: #007a4d; font-weight: 800; }
          .cancelled th { background: #fff1f3; }
          .footer { margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 28px; color: #667085; font-size: 11px; }
          .signature { border-top: 1px solid #98a2b3; padding-top: 8px; text-align: center; margin-top: 32px; }
          @media print {
            body { padding: 12mm; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
          }
        </style>
      </head>
      <body>
        <section class="header">
          <div class="brand">
            <strong>${htmlEscape(printCompany.name || 'Melisa Bebe ERP')}</strong>
            <span>${htmlEscape(companySubline || 'Cari ekstre çıktısı / Yazdır penceresinden PDF olarak kaydedilebilir.')}</span>
          </div>
          <div class="title">
            <strong>${htmlEscape(title)}</strong>
            <span>${new Date().toLocaleString('tr-TR')}</span>
          </div>
        </section>
        <section class="info-grid">
          ${buildInfoRows([
            { label: 'Cari türü', value: partyLabel },
            { label: 'Arama', value: filters.search || '-' },
            { label: 'Başlangıç', value: filters.dateFrom || '-' },
            { label: 'Bitiş', value: filters.dateTo || '-' },
          ])}
        </section>
        <section class="totals">
          ${totals.length ? buildStatementTotals(totals) : '<div class="total-card"><span>Bakiye</span><strong>0</strong><small>Normal hareket yok</small></div>'}
        </section>
        <h2>Normal Ekstre Satırları</h2>
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>${htmlEscape(partyLabel)}</th>
              <th>Belge No</th>
              <th>İşlem</th>
              <th class="num">Borç</th>
              <th class="num">Alacak</th>
              <th class="num">Bakiye Etkisi</th>
              <th>PB</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? buildStatementRows(rows, { partyKey, movementLabel, debitWhenPositive }) : '<tr><td colspan="8">Normal ekstre satırı yok.</td></tr>'}
          </tbody>
        </table>
        ${cancelledRows.length ? `
          <h2>İptal İzleri</h2>
          <section class="totals">${buildStatementTotals(cancelledTotals)}</section>
          <table class="cancelled">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>${htmlEscape(partyLabel)}</th>
                <th>Belge No</th>
                <th>İşlem</th>
                <th class="num">Borç</th>
                <th class="num">Alacak</th>
                <th class="num">Bakiye Etkisi</th>
                <th>PB</th>
              </tr>
            </thead>
            <tbody>${buildStatementRows(cancelledRows, { partyKey, movementLabel, debitWhenPositive })}</tbody>
          </table>
        ` : ''}
        <section class="footer">
          <div class="signature">Hazırlayan</div>
          <div class="signature">Onaylayan</div>
        </section>
        <script>
          window.onload = function () {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>`;

  printHtmlDocument(html, title);
}
