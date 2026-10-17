function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatNumber(value, minimumFractionDigits = 0) {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatMoney(value, currency = 'USD') {
  return `${formatNumber(value, 2)} ${escapeHtml(currency)}`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : new Intl.DateTimeFormat('tr-TR').format(date);
}

function proformaPdfFileName(value) {
  const safeNo = String(value || 'PROFORMA')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 90);
  return `${safeNo || 'PROFORMA'}_Melisa_Baby.pdf`;
}

function documentRow(label, value) {
  return `<div class="document-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '-')}</strong></div>`;
}

function detailRow(label, value) {
  return `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '-')}</strong></div>`;
}

export function buildProformaInvoiceHtml({
  header = {},
  seller = {},
  buyer = {},
  shipment = {},
  bank = {},
  lines = [],
  logoUrl = '/melisa-baby-watermark.png',
  generatedAt = new Date(),
} = {}) {
  const includedLines = lines.filter((line) => line.included !== false);
  const currency = header.currency || 'USD';
  const totalQuantity = includedLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  const subtotal = includedLines.reduce(
    (sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0),
    0,
  );
  const freightAmount = Math.max(0, Number(shipment.freightAmount || 0));
  const payableTotal = subtotal + freightAmount;
  const missingGtipCount = includedLines.filter((line) => !String(line.gtipCode || '').trim()).length;
  const rowHtml = includedLines.map((line, index) => {
    const lineTotal = Number(line.quantity || 0) * Number(line.unitPrice || 0);
    return `
      <tr>
        <td class="center">${index + 1}</td>
        <td><strong>${escapeHtml(line.stockCode || '-')}</strong><small>${escapeHtml(line.description || line.productName || '-')}</small></td>
        <td>${escapeHtml(line.gtipCode || 'TEYİT EDİLECEK')}</td>
        <td class="num">${formatNumber(line.quantity)}</td>
        <td class="center">${escapeHtml(line.unitName || 'ADET')}</td>
        <td class="num">${formatNumber(line.unitPrice, 2)}</td>
        <td class="num strong">${formatNumber(lineTotal, 2)}</td>
      </tr>
    `;
  }).join('');
  const bankAccounts = [
    { currency: 'TRY', iban: bank.tryIban },
    { currency: 'USD', iban: bank.usdIban || String(bank.iban || '').replace(/^USD IBAN:\s*/i, '') },
    { currency: 'EUR', iban: bank.eurIban },
  ].filter((item) => item.iban);
  const bankRows = bankAccounts.map((item) => `
    <div class="bank-account"><span>${escapeHtml(item.currency)}</span><strong>${escapeHtml(item.iban)}</strong></div>
  `).join('');
  const incoterm = shipment.incoterm || 'TEYİT EDİLECEK';
  const pdfFileName = proformaPdfFileName(header.proformaNo);

  return `<!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(pdfFileName)}</title>
        <style>
          * { box-sizing: border-box; }
          @page { size: A4; margin: 10mm 10mm 13mm; }
          body { margin: 0; color: #26313f; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 9.4px; }
          .page { max-width: 190mm; margin: 0 auto; }
          .document-header { display: grid; grid-template-columns: 1.22fr .82fr .96fr; gap: 9px; align-items: stretch; }
          .company-card { padding: 7px 2px; border-top: 3px solid #111827; border-bottom: 3px solid #111827; line-height: 1.35; }
          .company-card strong { display: block; margin-bottom: 3px; color: #111827; font-size: 10.6px; }
          .company-card span { display: block; color: #475569; }
          .brand-card { display: grid; place-items: center; min-height: 94px; padding: 5px; }
          .brand-card img { display: block; width: 100%; max-width: 47mm; height: auto; object-fit: contain; }
          .brand-fallback { display: none; color: #dc2626; font-size: 28px; font-weight: 800; }
          .document-card { align-self: center; border: 1px solid #64748b; }
          .document-title { padding: 7px 8px; border-bottom: 2px solid #111827; background: #f8fafc; text-align: center; }
          .document-title h1 { margin: 0; color: #111827; font-size: 16px; letter-spacing: .45px; }
          .document-title small { display: block; margin-top: 2px; color: #dc2626; font-size: 8px; font-weight: 800; }
          .document-row { display: grid; grid-template-columns: 42% 58%; border-bottom: 1px solid #cbd5e1; }
          .document-row:last-child { border-bottom: 0; }
          .document-row span, .document-row strong { padding: 4px 5px; }
          .document-row span { border-right: 1px solid #cbd5e1; color: #475569; font-weight: 700; }
          .party-grid { display: grid; grid-template-columns: 1.35fr .65fr; gap: 8px; margin-top: 10px; }
          .party-card, .shipment-card { border: 1px solid #64748b; }
          .section-title { padding: 5px 7px; border-bottom: 2px solid #111827; background: #f1f5f9; color: #111827; font-size: 9px; font-weight: 800; letter-spacing: .25px; }
          .buyer-body { min-height: 105px; padding: 8px; line-height: 1.4; }
          .buyer-body strong { display: block; margin-bottom: 4px; color: #111827; font-size: 11px; }
          .buyer-body span { display: block; }
          .buyer-meta { display: grid; grid-template-columns: 1fr 1fr; margin-top: 5px; gap: 2px 10px; color: #475569; }
          .shipment-body { display: grid; grid-template-columns: 1fr 1fr; }
          .detail-row { min-height: 31px; padding: 5px 6px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; }
          .detail-row:nth-child(even) { border-right: 0; }
          .detail-row span, .detail-row strong { display: block; }
          .detail-row span { color: #64748b; font-size: 7.8px; font-weight: 800; text-transform: uppercase; }
          .detail-row strong { margin-top: 3px; color: #111827; font-size: 8.8px; }
          .notice { margin: 8px 0; padding: 6px 8px; border: 1px solid #f59e0b; background: #fffbeb; color: #92400e; font-size: 8.6px; }
          .notice strong { color: #b91c1c; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          th { padding: 6px 4px; border: 1px solid #111827; background: #e2e8f0; color: #111827; text-align: left; font-size: 8px; }
          td { padding: 4px; border: 1px solid #94a3b8; vertical-align: top; font-size: 8.2px; }
          tbody tr:nth-child(even) td { background: #f8fafc; }
          td small { display: block; margin-top: 2px; color: #475569; font-size: 7.5px; line-height: 1.25; }
          th:nth-child(1) { width: 4%; } th:nth-child(2) { width: 31%; } th:nth-child(3) { width: 17%; }
          th:nth-child(4) { width: 10%; } th:nth-child(5) { width: 9%; } th:nth-child(6) { width: 14%; } th:nth-child(7) { width: 15%; }
          .num { text-align: right; white-space: nowrap; }
          .center { text-align: center; }
          .strong { font-weight: 800; }
          .summary-grid { display: grid; grid-template-columns: 1.16fr .84fr; gap: 8px; margin-top: 8px; page-break-inside: avoid; }
          .terms-box, .totals-box { border: 1px solid #64748b; }
          .terms-body { display: grid; grid-template-columns: 1fr 1fr; }
          .term { min-height: 36px; padding: 5px 7px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; }
          .term:nth-child(even) { border-right: 0; }
          .term span, .term strong { display: block; }
          .term span { color: #64748b; font-size: 7.8px; font-weight: 800; text-transform: uppercase; }
          .term strong { margin-top: 4px; color: #111827; font-size: 8.8px; line-height: 1.3; }
          .total-row { display: flex; justify-content: space-between; gap: 12px; padding: 5px 7px; border-bottom: 1px solid #cbd5e1; }
          .total-row:last-child { border: 0; background: #111827; color: #fff; font-size: 10px; }
          .total-row span { font-weight: 700; }
          .bank-and-notes { display: grid; grid-template-columns: 1.05fr .95fr; gap: 8px; margin-top: 8px; page-break-inside: avoid; }
          .bank-box, .notes-box { border: 1px solid #64748b; }
          .bank-name { padding: 7px; border-bottom: 1px solid #cbd5e1; color: #111827; font-weight: 800; }
          .bank-account { display: grid; grid-template-columns: 42px 1fr; border-bottom: 1px solid #e2e8f0; }
          .bank-account span, .bank-account strong { padding: 5px 7px; }
          .bank-account span { border-right: 1px solid #e2e8f0; color: #dc2626; font-weight: 800; }
          .bank-account strong { font-size: 8.4px; letter-spacing: .1px; }
          .swift { padding: 5px 7px; background: #f8fafc; }
          .notes-body { min-height: 112px; padding: 7px; color: #334155; line-height: 1.45; }
          .notes-body strong { color: #111827; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 46px; margin-top: 16px; page-break-inside: avoid; }
          .signature { border-top: 1px solid #64748b; padding-top: 6px; text-align: center; color: #64748b; font-size: 8px; }
          .footer { margin-top: 8px; padding-top: 5px; border-top: 1px solid #cbd5e1; color: #64748b; text-align: right; font-size: 7.5px; }
          @media print { .page { max-width: none; } }
        </style>
      </head>
      <body>
        <main class="page">
          <header class="document-header">
            <section class="company-card">
              <strong>${escapeHtml(seller.name || 'Melisa Bebe Tekstil')}</strong>
              <span>${escapeHtml(seller.address || '-')}</span>
              <span>${escapeHtml(seller.cityCountry || '-')}</span>
              <span>Tel: ${escapeHtml(seller.phone || '-')} · Fax: ${escapeHtml(seller.fax || '-')}</span>
              <span>Vergi Dairesi: ${escapeHtml(seller.taxOffice || '-')} · VKN: ${escapeHtml(seller.taxNumber || '-')}</span>
              <span>MERSİS: ${escapeHtml(seller.mersis || '-')} · Ticaret Sicil: ${escapeHtml(seller.tradeRegistry || '-')}</span>
            </section>
            <section class="brand-card">
              <img src="${escapeHtml(logoUrl)}" alt="Melisa Baby" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" />
              <div class="brand-fallback">Melisa</div>
            </section>
            <section class="document-card">
              <div class="document-title"><h1>PROFORMA INVOICE</h1><small>TİCARİ FATURA DEĞİLDİR</small></div>
              ${documentRow('Proforma No', header.proformaNo)}
              ${documentRow('Kaynak Fiş', header.sourceDocumentNo)}
              ${documentRow('Tarih', formatDate(header.issueDate))}
              ${documentRow('Geçerlilik', formatDate(header.validUntil))}
              ${documentRow('Para Birimi', currency)}
            </section>
          </header>

          <section class="party-grid">
            <section class="party-card">
              <div class="section-title">SAYIN / CONSIGNEE</div>
              <div class="buyer-body">
                <strong>${escapeHtml(buyer.name || '-')}</strong>
                <span>${escapeHtml(buyer.address || '-')}</span>
                <span>${escapeHtml(buyer.cityCountry || '-')}</span>
                <div class="buyer-meta">
                  <span>Yetkili: ${escapeHtml(buyer.contactName || '-')}</span>
                  <span>Vergi/VAT: ${escapeHtml(buyer.taxNumber || '-')}</span>
                  <span>Telefon: ${escapeHtml(buyer.phone || '-')}</span>
                  <span>E-posta: ${escapeHtml(buyer.email || '-')}</span>
                </div>
              </div>
            </section>
            <section class="shipment-card">
              <div class="section-title">TESLİMAT / DELIVERY</div>
              <div class="shipment-body">
                ${detailRow('Incoterm', incoterm)}
                ${detailRow('Taşıma', shipment.transportMode)}
                ${detailRow('Teslim yeri', shipment.deliveryPlace)}
                ${detailRow('Ödeme', shipment.paymentTerms)}
                ${detailRow('Koli', shipment.packageCount)}
                ${detailRow('Net / Brüt', `${shipment.netWeight || '-'} / ${shipment.grossWeight || '-'}`)}
              </div>
            </section>
          </section>

          <section class="notice">
            <strong>PROFORMA - NOT A TAX INVOICE.</strong>
            Bu belge teklif ve ödeme hazırlığı içindir; e-Fatura, ETTN veya resmî ihracat faturası değildir.
            ${missingGtipCount ? ` ${missingGtipCount} satırın GTİP kodu sevk öncesinde teyit edilmelidir.` : ''}
          </section>

          <table>
            <thead><tr><th>#</th><th>STOK KODU / ÜRÜN</th><th>GTİP / HS CODE</th><th class="num">MİKTAR</th><th>BİRİM</th><th class="num">BİRİM FİYAT</th><th class="num">TUTAR ${escapeHtml(currency)}</th></tr></thead>
            <tbody>${rowHtml || '<tr><td colspan="7">Proforma satırı bulunmuyor.</td></tr>'}</tbody>
          </table>

          <section class="summary-grid">
            <section class="terms-box">
              <div class="section-title">TİCARİ KOŞULLAR / COMMERCIAL TERMS</div>
              <div class="terms-body">
                <div class="term"><span>Teslim şekli</span><strong>${escapeHtml(incoterm)}</strong></div>
                <div class="term"><span>Teslim yeri</span><strong>${escapeHtml(shipment.deliveryPlace || 'TEYİT EDİLECEK')}</strong></div>
                <div class="term"><span>Ödeme şekli</span><strong>${escapeHtml(shipment.paymentTerms || 'TEYİT EDİLECEK')}</strong></div>
                <div class="term"><span>Gönderilme şekli</span><strong>${escapeHtml(shipment.transportMode || '-')}</strong></div>
                <div class="term"><span>Menşe</span><strong>${escapeHtml(shipment.originCountry || 'Türkiye')}</strong></div>
                <div class="term"><span>Koli / Ağırlık</span><strong>${escapeHtml(shipment.packageCount || '-')} · ${escapeHtml(shipment.netWeight || '-')} net · ${escapeHtml(shipment.grossWeight || '-')} brüt</strong></div>
              </div>
            </section>
            <section class="totals-box">
              <div class="section-title">TUTARLAR / TOTALS</div>
              <div class="total-row"><span>Mal Hizmet Toplamı</span><strong>${formatMoney(subtotal, currency)}</strong></div>
              <div class="total-row"><span>Nakliye Bedeli</span><strong>${formatMoney(freightAmount, currency)}</strong></div>
              <div class="total-row"><span>Toplam İskonto</span><strong>0,00 ${escapeHtml(currency)}</strong></div>
              <div class="total-row"><span>Ara Toplam</span><strong>${formatMoney(payableTotal, currency)}</strong></div>
              <div class="total-row"><span>Hesaplanan KDV (%0)</span><strong>0,00 ${escapeHtml(currency)}</strong></div>
              <div class="total-row"><span>Toplam Adet</span><strong>${formatNumber(totalQuantity)}</strong></div>
              <div class="total-row"><span>ÖDENECEK TUTAR</span><strong>${formatMoney(payableTotal, currency)}</strong></div>
            </section>
          </section>

          <section class="bank-and-notes">
            <section class="bank-box">
              <div class="section-title">BANKA HESAPLARI / BANK ACCOUNTS</div>
              <div class="bank-name">${escapeHtml(bank.name || 'Kuveyt Türk Katılım Bankası')}</div>
              ${bankRows || '<div class="bank-name">Banka hesabı tanımlı değil.</div>'}
              <div class="swift"><strong>SWIFT:</strong> ${escapeHtml(bank.swift || '-')}</div>
            </section>
            <section class="notes-box">
              <div class="section-title">AÇIKLAMALAR / NOTES</div>
              <div class="notes-body">
                <strong>MALLAR TÜRK MENŞELİDİR / GOODS ARE OF TURKISH ORIGIN.</strong><br />
                ${escapeHtml(shipment.notes || 'Teslim ve ödeme koşulları sevk öncesinde taraflarca teyit edilmelidir.')}<br />
                GTİP, menşe, ağırlık ve ihracat istisnası nihai ticari faturada yetkili kişi tarafından doğrulanmalıdır.
              </div>
            </section>
          </section>

          <section class="signatures"><div class="signature">Hazırlayan / Kaşe - İmza</div><div class="signature">Alıcı Onayı / Kaşe - İmza</div></section>
          <footer class="footer">Melisa ERP Proforma Hazırlama · ${escapeHtml(new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(generatedAt))}</footer>
        </main>
      </body>
    </html>`;
}

export function printProformaInvoice(data) {
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    throw new Error('Proforma önizlemesi açılamadı. Tarayıcı açılır pencere iznini kontrol edin.');
  }

  const logoUrl = new URL('/melisa-baby-watermark.png', window.location.origin).href;
  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(buildProformaInvoiceHtml({ ...data, logoUrl }));
  printWindow.document.close();
  printWindow.addEventListener('load', () => {
    printWindow.focus();
    // Tarayıcının yerel yazdırma penceresi güvenli biçimde dosya konumunu seçtirir.
    // Chrome/Edge, belge başlığını önerilen PDF dosya adı olarak kullanır.
    printWindow.setTimeout(() => printWindow.print(), 350);
  }, { once: true });
}
