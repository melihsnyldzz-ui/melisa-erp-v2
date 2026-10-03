import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { buildTerminalReceiptPdf } from './terminalReceiptPdf.mjs';

const fixture = (rows = 1, currency = 'USD') => ({
  id: 42, documentNo: 'MN-PDF-42', documentDate: '2026-09-15',
  customerName: 'İŞIK ÇOCUK GİYİM', documentCurrency: currency,
  subtotal: 123.45, discountTotal: 7.89, grandTotal: 115.56,
  items: Array.from({ length: rows }, (_, index) => ({
    stockCode: 'ÜRÜN-' + String(index + 1).padStart(3, '0'),
    productName: 'Çıtçıtlı örgü şapka', quantity: 2.5, unitPrice: 7.91,
    lineTotal: 19.78, currency, unitName: 'ADET'
  }))
});

// Read the PDF's actual embedded Unicode maps and positioned text. This small
// parser is intentionally limited to the PDFKit output shape used by this test;
// it is not an application PDF parser or a substitute for rendered-page review.
function inspectPdf(buffer) {
  const source = buffer.toString('latin1');
  const objects = new Map([...source.matchAll(/(\d+) 0 obj\n([\s\S]*?)\nendobj/g)]
    .map(match => [Number(match[1]), match[2]]));
  const stream = object => {
    const start = object.indexOf('stream\n');
    if (start < 0) return '';
    const bytes = Buffer.from(object.slice(start + 7, object.lastIndexOf('\nendstream')), 'latin1');
    return (object.slice(0, start).includes('/FlateDecode') ? inflateSync(bytes) : bytes).toString('utf8');
  };
  const fonts = new Map();
  for (const object of objects.values()) {
    for (const match of object.matchAll(/\/(F\d+) (\d+) 0 R/g)) {
      const font = objects.get(Number(match[2]));
      const unicodeId = font?.match(/\/ToUnicode (\d+) 0 R/);
      if (!unicodeId) continue;
      const cmap = stream(objects.get(Number(unicodeId[1])));
      const characters = new Map();
      for (const range of cmap.matchAll(/<([0-9a-f]+)>\s+<[0-9a-f]+>\s+\[([^\]]+)\]/gi)) {
        let index = parseInt(range[1], 16);
        for (const item of range[2].matchAll(/<([^>]+)>/g)) {
          const codeUnits = item[1].replace(/\s/g, '').match(/.{4}/g).map(value => parseInt(value, 16));
          characters.set(index++, String.fromCharCode(...codeUnits));
        }
      }
      fonts.set(match[1], characters);
    }
  }
  const pages = [];
  for (const object of objects.values()) {
    if (!/\/Type \/Page\b/.test(object)) continue;
    const contentId = Number(object.match(/\/Contents (\d+) 0 R/)[1]);
    const content = stream(objects.get(contentId));
    const blocks = [];
    for (const block of content.matchAll(/BT\n([\s\S]*?)\nET/g)) {
      const selected = block[1].match(/\/(F\d+) ([\d.]+) Tf/);
      const position = block[1].match(/1 0 0 1 ([-\d.]+) ([-\d.]+) Tm/);
      if (!selected || !position) continue;
      const mapping = fonts.get(selected[1]);
      let value = '';
      for (const text of block[1].matchAll(/\[([\s\S]*?)\] TJ/g)) {
        for (const hex of text[1].matchAll(/<([0-9a-f]+)>/gi)) {
          value += (hex[1].match(/.{4}/g) || []).map(code => mapping.get(parseInt(code, 16)) ?? '\uFFFD').join('');
        }
      }
      blocks.push({ text: value, x: Number(position[1]), y: Number(position[2]) });
    }
    pages.push(blocks);
  }
  return { source, pages, blocks: pages.flat() };
}

test('A4 embeds Turkish Unicode and faithfully renders supplied prices, totals and discount', async () => {
  const input = fixture();
  const pdf = await buildTerminalReceiptPdf(input);
  assert.ok(Buffer.isBuffer(pdf));
  assert.match(pdf.subarray(0, 8).toString(), /^%PDF-1\./);
  const result = inspectPdf(pdf);
  assert.match(result.source, /\/MediaBox \[0 0 595\.28 841\.89\]/);
  assert.equal((result.source.match(/\/FontFile2 /g) || []).length, 2);
  const text = result.blocks.map(block => block.text);
  for (const expected of ['MN-PDF-42', '15.09.2026', 'İŞIK ÇOCUK GİYİM', 'ÜRÜN-001',
    'Çıtçıtlı örgü şapka', '2,5', '7,91 $', '19,78 $', '123,45 $', '7,89 $', '115,56 $', 'İNDİRİM:']) {
    assert.ok(text.includes(expected), expected + ' must survive PDF text extraction');
  }
  assert.ok(text.some(value => value.includes('Yalnız:') && value.includes('DOLAR')));
  assert.ok(text.every(value => !value.includes('\uFFFD')));
  assert.equal(input.items[0].lineTotal, 19.78);
});

test('USD, EUR and TRY symbols stay searchable and the zero-discount row is omitted', async () => {
  for (const [currency, symbol] of [['USD', '$'], ['EUR', '€'], ['TRY', '₺']]) {
    const input = { ...fixture(1, currency), discountTotal: 0 };
    const { blocks } = inspectPdf(await buildTerminalReceiptPdf(input));
    assert.ok(blocks.some(block => block.text === '115,56 ' + symbol));
    assert.ok(!blocks.some(block => block.text === 'İNDİRİM:'));
    assert.ok(!blocks.some(block => block.text === 'ARA TOPLAM:'));
  }
});

test('40 normal rows fit A4 and 100 rows paginate with repeated headers, every row and one final total', async () => {
  for (const count of [40, 100]) {
    const { pages, blocks } = inspectPdf(await buildTerminalReceiptPdf(fixture(count)));
    assert.equal(pages.length, count === 40 ? 1 : 3);
    for (let index = 1; index <= count; index++) {
      assert.equal(blocks.filter(block => block.text === 'ÜRÜN-' + String(index).padStart(3, '0')).length, 1);
    }
    pages.forEach((page, index) => {
      assert.ok(page.some(block => block.text === 'Stok Kodu'));
      assert.ok(page.some(block => block.text === 'Malın Cinsi'));
      assert.ok(page.some(block => block.text === (index + 1) + ' / ' + pages.length));
      assert.ok(page.every(block => block.x >= 27 && block.x < 569 && block.y > 20 && block.y < 842));
    });
    assert.equal(blocks.filter(block => block.text === 'GENEL TOPLAM:').length, 1);
    assert.ok(pages.at(-1).some(block => block.text === '115,56 $'));
  }
});

test('long identity fields and product cells wrap without losing text or invading the totals', async () => {
  const input = fixture(40);
  input.documentNo = 'UZUN-FİŞ-NUMARASI-'.repeat(10) + 'SONBELGE';
  input.customerName = 'ŞAFAK ÇOCUK ÜRÜNLERİ İTHALAT İHRACAT '.repeat(8) + 'SONCARİ';
  input.items.forEach((item, index) => {
    item.stockCode = 'UZUN-STOK-KODU-'.repeat(4) + index;
    item.productName = 'İşlemeli pamuklu çıtçıtlı ürün açıklaması '.repeat(4) + 'SONÜRÜN';
  });
  const { pages, blocks } = inspectPdf(await buildTerminalReceiptPdf(input));
  assert.ok(pages.length > 1);
  const allText = blocks.map(block => block.text).join('');
  for (const marker of ['SONBELGE', 'SONCARİ', 'SONÜRÜN']) assert.ok(allText.includes(marker));
  assert.equal((allText.match(/SONÜRÜN/g) || []).length, 40);
  pages.forEach(page => {
    const table = page.find(block => block.text === 'Stok Kodu');
    const names = page.filter(block => block.text.includes('SONÜRÜN'));
    assert.ok(names.every(block => block.y < table.y && block.y > 115));
    assert.ok(page.every(block => block.y > 20 && block.y < 842));
  });
});

test('invalid model values or a single impossible row fail clearly before returning a PDF', async () => {
  for (const invalid of [{ items: [] }, { grandTotal: -1 }, { documentDate: 'invalid' }, { documentCurrency: 'ZZZ' }]) {
    await assert.rejects(buildTerminalReceiptPdf({ ...fixture(), ...invalid }));
  }
  const input = fixture();
  input.items[0].productName = 'Sığmayacak kadar uzun açıklama '.repeat(2000);
  await assert.rejects(buildTerminalReceiptPdf(input), /satırı tek A4 sayfaya sığmıyor/);
});
