import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScreenDeepLink, readScreenDeepLink } from './screenDeepLink.js';
import { screenRegistry } from '../data/mockNavigationData.js';

test('invalid explicit purchase draft identities cannot reopen as a new invoice', () => {
  for (const id of ['not-an-id', '9007199254740992', '00000000-0000-0000-0000-invalid00000', 0, -1, ' ', false]) {
    const link = buildScreenDeepLink('', 'purchase-invoice', { purchaseDraftId: id, supplierId: 12 });
    assert.equal(new URLSearchParams(link).get('purchaseDraftId'), String(id));
    assert.equal(readScreenDeepLink(link, screenRegistry), null);
  }
});

test('the same invalid-record protection applies to other record-owning screens', () => {
  for (const [screen, key] of [
    ['sales-invoice', 'salesDraftId'], ['product-card', 'productId'],
    ['customer-card', 'customerId'], ['supplier-card', 'supplierId'],
    ['sales-offer', 'offerId'], ['sales-order', 'orderId'],
  ]) {
    const link = buildScreenDeepLink('', screen, { [key]: 'invalid-record' });
    assert.equal(readScreenDeepLink(link, screenRegistry), null);
  }
});

test('valid numeric purchase draft identities still round-trip exactly', () => {
  for (const id of [42, '42', String(Number.MAX_SAFE_INTEGER)]) {
    const link = buildScreenDeepLink('', 'purchase-invoice', { purchaseDraftId: id });
    assert.deepEqual(readScreenDeepLink(link, screenRegistry), {
      screenId: 'purchase-invoice', payload: { purchaseDraftId: String(id) },
    });
  }
});

test('valid UUID purchase draft identities retain their lowercase normalization', () => {
  const id = 'ABCDEF12-1234-5678-9ABC-DEF012345678';
  const link = buildScreenDeepLink('', 'purchase-invoice', { purchaseDraftId: id });
  assert.deepEqual(readScreenDeepLink(link, screenRegistry), {
    screenId: 'purchase-invoice', payload: { purchaseDraftId: id.toLowerCase() },
  });
});

test('new and reset invoices discard the prior saved identity and retain supplier context', () => {
  for (const payload of [{}, { purchaseDraftId: undefined }, { purchaseDraftId: null }, { purchaseDraftId: '' }]) {
    const link = buildScreenDeepLink('?purchaseDraftId=42', 'purchase-invoice', payload);
    assert.deepEqual(readScreenDeepLink(link, screenRegistry), { screenId: 'purchase-invoice', payload: {} });
  }
  const link = buildScreenDeepLink('?purchaseDraftId=42', 'purchase-invoice', { supplierId: 12 });
  assert.deepEqual(readScreenDeepLink(link, screenRegistry), {
    screenId: 'purchase-invoice', payload: { supplierId: '12' },
  });
});

test('leaving the invoice screen removes its identity while preserving unrelated query data', () => {
  const link = buildScreenDeepLink('?purchaseDraftId=invalid-record&salesDraftId=7&campaign=erp', 'dashboard');
  assert.equal(new URLSearchParams(link).get('campaign'), 'erp');
  assert.deepEqual(readScreenDeepLink(link, screenRegistry), { screenId: 'dashboard', payload: {} });
  assert.equal(new URLSearchParams(link).has('purchaseDraftId'), false);
  assert.equal(new URLSearchParams(link).has('salesDraftId'), false);
});

test('role restrictions and duplicate record rejection remain in force', () => {
  const link = buildScreenDeepLink('', 'purchase-invoice', { purchaseDraftId: 42 });
  assert.equal(readScreenDeepLink(link, screenRegistry, new Set(['dashboard'])), null);
  assert.equal(readScreenDeepLink(link + '&purchaseDraftId=43', screenRegistry), null);
});
