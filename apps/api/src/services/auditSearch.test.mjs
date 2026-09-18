import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAuditSearch } from './auditService.js';

test('keeps audit and record identifiers as exact bigint candidates', () => {
  assert.deepEqual(normalizeAuditSearch(' 34463 '), {
    text: '34463',
    pattern: '%34463%',
    numericId: 34463,
  });
});

test('keeps usernames, actions and document numbers as text-only searches', () => {
  assert.deepEqual(normalizeAuditSearch('sales_invoice_finalized'), {
    text: 'sales_invoice_finalized',
    pattern: '%sales_invoice_finalized%',
    numericId: null,
  });
  assert.equal(normalizeAuditSearch('MN-1e802899f0c64fd097d46fa769').numericId, null);
});

test('does not coerce unsafe or mixed identifiers to bigint', () => {
  assert.equal(normalizeAuditSearch('9007199254740992').numericId, null);
  assert.equal(normalizeAuditSearch('34463-A').numericId, null);
  assert.deepEqual(normalizeAuditSearch(''), { text: '', pattern: null, numericId: null });
});
