import { existsSync } from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { buildTerminalA4Model } from './terminalReceiptA4.mjs';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 27.36;
const WIDTHS = [100.8, 221.04, 32.4, 40.32, 66.96, 79.2];
const TABLE_WIDTH = WIDTHS.reduce((sum, width) => sum + width, 0);
const RIGHT = LEFT + TABLE_WIDTH;
const FONT_SIZE = 9;
const FONT_NAMES = { regular: 'ReceiptRegular', bold: 'ReceiptBold' };

function resolveFonts() {
  const configured = [
    process.env.TERMINAL_RECEIPT_PDF_FONT_REGULAR,
    process.env.TERMINAL_RECEIPT_PDF_FONT_BOLD
  ];
  if (configured.some(Boolean)) {
    if (configured.every(file => file && existsSync(file))) return configured;
    throw new Error('Fiş PDF yazı tipleri bulunamadı. Normal ve kalın Unicode yazı tipi yollarını kontrol edin.');
  }
  const windowsFonts = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');
  const candidates = [
    [path.join(windowsFonts, 'arial.ttf'), path.join(windowsFonts, 'arialbd.ttf')],
    ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'],
    ['/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf', '/usr/share/fonts/dejavu-sans-fonts/DejaVuSans-Bold.ttf'],
    ['/Library/Fonts/Arial.ttf', '/Library/Fonts/Arial Bold.ttf']
  ];
  const found = candidates.find(pair => pair.every(file => existsSync(file)));
  if (!found) throw new Error('Fiş PDF için Türkçe destekleyen Arial veya DejaVu Sans yazı tipleri kurulmalı.');
  return found;
}

function setFont(doc, bold = false, size = FONT_SIZE) {
  return doc.font(bold ? FONT_NAMES.bold : FONT_NAMES.regular).fontSize(size);
}

function measure(doc, value, width, { bold = false, size = FONT_SIZE } = {}) {
  return setFont(doc, bold, size).heightOfString(value || ' ', { width, lineGap: 0 });
}

function drawText(doc, value, x, y, width, options = {}) {
  const { bold = false, size = FONT_SIZE, align = 'left' } = options;
  setFont(doc, bold, size).fillColor('black').text(value, x, y, { width, lineGap: 0, align });
}

function drawLine(doc, x1, y, x2) {
  doc.lineWidth(0.55).strokeColor('black').moveTo(x1, y).lineTo(x2, y).stroke();
}

function layoutReceipt(doc, model) {
  const top = 25.2;
  const documentNumberX = 190;
  const documentNumberWidth = 250;
  const dateX = 447;
  const topHeight = Math.max(
    measure(doc, model.title, 150),
    measure(doc, model.documentNumber, documentNumberWidth),
    measure(doc, model.date, RIGHT - dateX)
  );
  const customerTop = Math.max(59.04, top + topHeight + 16);
  const customerHeight = measure(doc, model.customer, TABLE_WIDTH);
  const tableHeaderTop = Math.max(126, customerTop + customerHeight + 18);
  const headerHeight = Math.max(...model.headers.map((value, index) => measure(doc, value, WIDTHS[index] - 4)));
  const tableLineY = tableHeaderTop + headerHeight + 3;
  const rowTop = tableLineY + 5;

  // Reserve the final totals and words on every page, so a last-page row cannot
  // collide with a discount or a longer Turkish amount-in-words line.
  const wordsHeight = measure(doc, model.amountWords, TABLE_WIDTH - 45, { bold: true, size: 8 });
  const wordsTop = PAGE_HEIGHT - 42 - wordsHeight;
  const totalTop = wordsTop - 26;
  const subtotalTop = totalTop - 32;
  const footerLineY = (model.hasDiscount ? subtotalTop : totalTop) - 9;
  const bodyBottom = Math.min(723.6, footerLineY - 12);
  if (bodyBottom - rowTop < 40) throw new Error('Fiş başlığı bir A4 sayfaya sığmıyor.');

  const pages = [];
  let rows = [];
  let y = rowTop;
  for (const row of model.rows) {
    const height = Math.max(13, ...row.map((value, index) => Math.ceil(measure(doc, value, WIDTHS[index] - 4)) + 3));
    if (height > bodyBottom - rowTop) throw new Error('Bir fiş satırı tek A4 sayfaya sığmıyor.');
    if (y + height > bodyBottom && rows.length) {
      pages.push(rows);
      rows = [];
      y = rowTop;
    }
    rows.push({ values: row, y, height });
    y += height;
  }
  if (rows.length) pages.push(rows);
  return { pages, top, documentNumberX, documentNumberWidth, dateX, customerTop,
    tableHeaderTop, tableLineY, wordsTop, totalTop, subtotalTop, footerLineY };
}

function drawPage(doc, model, layout, pageIndex) {
  doc.addPage({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0 });
  drawText(doc, model.title, LEFT, layout.top, 150);
  drawText(doc, model.documentNumber, layout.documentNumberX, layout.top, layout.documentNumberWidth, { align: 'right' });
  drawText(doc, model.date, layout.dateX, layout.top, RIGHT - layout.dateX, { align: 'right' });
  drawText(doc, model.customer, LEFT, layout.customerTop, TABLE_WIDTH);

  let x = LEFT;
  model.headers.forEach((value, index) => {
    drawText(doc, value, x, layout.tableHeaderTop, WIDTHS[index] - 4, { align: index >= 4 ? 'right' : 'left' });
    x += WIDTHS[index];
  });
  drawLine(doc, LEFT, layout.tableLineY, RIGHT);
  for (const row of layout.pages[pageIndex]) {
    x = LEFT;
    row.values.forEach((value, index) => {
      drawText(doc, value, x, row.y, WIDTHS[index] - 4, { align: index >= 4 ? 'right' : 'left' });
      x += WIDTHS[index];
    });
  }

  if (pageIndex === layout.pages.length - 1) {
    drawLine(doc, 470, layout.footerLineY, RIGHT);
    if (model.hasDiscount) {
      drawText(doc, 'ARA TOPLAM:', 320, layout.subtotalTop, 115);
      drawText(doc, model.subtotal, 435, layout.subtotalTop, RIGHT - 435, { align: 'right' });
      drawText(doc, 'İNDİRİM:', 320, layout.subtotalTop + 16, 115);
      drawText(doc, model.discount, 435, layout.subtotalTop + 16, RIGHT - 435, { align: 'right' });
    }
    drawText(doc, 'GENEL TOPLAM:', 320, layout.totalTop, 115, { bold: true });
    drawText(doc, model.grandTotal, 435, layout.totalTop, RIGHT - 435, { bold: true, align: 'right' });
    drawText(doc, model.amountWords, LEFT, layout.wordsTop, TABLE_WIDTH - 45, { bold: true, size: 8 });
  } else {
    drawText(doc, 'Devamı sonraki sayfada', LEFT, PAGE_HEIGHT - 50, 400, { size: 8 });
  }
  drawText(doc, (pageIndex + 1) + ' / ' + layout.pages.length, RIGHT - 50, PAGE_HEIGHT - 29, 50, { size: 8, align: 'right' });
}

/** Builds a read-only A4 view of the existing commercial invoice model. */
export async function buildTerminalReceiptPdf(invoice) {
  const model = buildTerminalA4Model(invoice);
  const [regular, bold] = resolveFonts();
  const doc = new PDFDocument({
    autoFirstPage: false,
    compress: true,
    info: { Title: 'Melisa A4 - ' + model.documentNumber, Author: 'Melisa', Subject: 'Satış fişi' }
  });
  const chunks = [];
  const completed = new Promise((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.once('error', reject);
    doc.once('end', () => resolve(Buffer.concat(chunks)));
  });
  // Attach a handler immediately; synchronous font/layout failures must not leave
  // a later stream error as an unhandled rejection.
  completed.catch(() => {});
  try {
    doc.registerFont(FONT_NAMES.regular, regular);
    doc.registerFont(FONT_NAMES.bold, bold);
    const layout = layoutReceipt(doc, model);
    layout.pages.forEach((_, pageIndex) => drawPage(doc, model, layout, pageIndex));
    doc.end();
  } catch (error) {
    doc.destroy();
    throw error;
  }
  return completed;
}
