import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportRowsToCsv } from './exportUtils.js';

async function captureCsv(t, options) {
  const blobs = [];
  const links = [];
  const events = [];
  t.mock.method(URL, 'createObjectURL', (blob) => {
    blobs.push(blob);
    return 'blob:synthetic-csv';
  });
  t.mock.method(URL, 'revokeObjectURL', (url) => {
    assert.equal(url, 'blob:synthetic-csv');
    events.push('revoke');
  });
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement(tag) {
      assert.equal(tag, 'a');
      const link = { click() { events.push('click'); } };
      links.push(link);
      return link;
    },
    body: {
      appendChild() { events.push('append'); },
      removeChild() { events.push('remove'); },
    },
  } });
  try {
    exportRowsToCsv(options);
    assert.equal(blobs.length, 1);
    assert.equal(blobs[0].type, 'text/csv;charset=utf-8');
    const bytes = new Uint8Array(await blobs[0].arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.deepEqual(events, ['append', 'click', 'remove', 'revoke']);
    return { text: await blobs[0].text(), links };
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
  }
}

test('CSV makes formula-like headers, cells and callback results literal text', async (t) => {
  const values = ['=1+1', '+SUM(A1:A2)', '-1+2', '@SUM(A1)',
    '  =1+1', '\t=1+1', '\r=1+1', '\n=1+1', '\ttext'];
  const result = await captureCsv(t, {
    filename: 'Formula report',
    columns: [{ label: '=header', value: (row) => row.value }],
    rows: values.map((value) => ({ value })),
  });
  const literalCell = (value) => `"'${value.replaceAll('"', '""')}"`;
  assert.equal(result.text, ['=header', ...values].map(literalCell).join('\r\n'));
  assert.equal(result.links[0].download, 'formula-report.csv');
});

test('CSV preserves numbers, unknown values, identifiers and escaped text', async (t) => {
  const result = await captureCsv(t, {
    filename: 'rapor',
    columns: [{ key: 'value', label: 'Değer' }],
    rows: [-12, 0, null, undefined, '', '0000123', '123.45000000',
      'a;"b"', 'satır\nsonu', 'normal metin'].map((value) => ({ value })),
  });
  assert.equal(result.text, ['"Değer"', '"-12"', '"0"', '""', '""', '""',
    '"0000123"', '"123.45000000"', '"a;""b"""', '"satır\nsonu"',
    '"normal metin"'].join('\r\n'));
});

test('empty CSV still protects the header without adding data rows', async (t) => {
  const result = await captureCsv(t, {
    filename: 'empty', columns: [{ key: 'value', label: '+header' }], rows: [],
  });
  assert.equal(result.text, '"\'+header"');
});
